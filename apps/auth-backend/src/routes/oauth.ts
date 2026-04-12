import { Hono } from 'hono';
import { getProviderConfig } from '../services/oauth-providers.js';
import { storeToken, createSession } from '../services/token-store.js';

const oauthRoutes = new Hono();

/**
 * POST /oauth/:provider/start
 * Generates an OAuth redirect URL for the given provider.
 */
oauthRoutes.post('/:provider/start', async (c) => {
  const provider = c.req.param('provider');
  const config = getProviderConfig(provider);
  if (!config) {
    return c.json({ error: `Unknown provider: ${provider}` }, 400);
  }

  if (!config.clientId) {
    return c.json({ error: `Missing client ID for ${provider}` }, 500);
  }

  const state = crypto.randomUUID();
  const redirectUri = `${c.req.header('origin') ?? 'http://localhost:3001'}/oauth/${provider}/callback`;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });

  if (config.scopes.length > 0) {
    params.set('scope', config.scopes.join(','));
  }

  // For Notion, the owner param is required
  if (provider === 'notion') {
    params.set('owner', 'user');
  }

  const authUrl = `${config.authorizationUrl}?${params.toString()}`;
  return c.json({ authUrl, state });
});

/**
 * GET /oauth/:provider/callback
 * Handles the OAuth callback and exchanges the code for tokens.
 */
oauthRoutes.get('/:provider/callback', async (c) => {
  const provider = c.req.param('provider');
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400);
  }

  const config = getProviderConfig(provider);
  if (!config) {
    return c.json({ error: `Unknown provider: ${provider}` }, 400);
  }

  const redirectUri = `${c.req.header('origin') ?? 'http://localhost:3001'}/oauth/${provider}/callback`;

  // Exchange code for tokens
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  // Notion uses Basic auth for token exchange
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (provider === 'notion') {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  try {
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      return c.json({ error: 'Token exchange failed', details: errorBody }, 502);
    }

    const tokenData = await tokenResponse.json() as Record<string, unknown>;

    // Create a session and store the token
    const sessionToken = crypto.randomUUID();
    const userId = (tokenData.user_id as string) ?? (tokenData.owner as Record<string, string>)?.user?.id ?? 'unknown';
    createSession(sessionToken, userId);

    storeToken(sessionToken, provider, {
      accessToken: (tokenData.access_token as string) ?? (tokenData.authed_user as Record<string, string>)?.access_token ?? '',
      refreshToken: tokenData.refresh_token as string | undefined,
      expiresAt: tokenData.expires_in ? Date.now() + (tokenData.expires_in as number) * 1000 : undefined,
      provider,
    });

    return c.json({ sessionToken, provider, state });
  } catch (err) {
    return c.json({ error: 'Token exchange request failed', details: String(err) }, 502);
  }
});

export { oauthRoutes };
