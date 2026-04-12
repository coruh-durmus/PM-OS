import { Hono } from 'hono';
import { getToken, deleteToken, getSession, storeToken } from '../services/token-store.js';
import { getProviderConfig } from '../services/oauth-providers.js';

const apiRoutes = new Hono();

/**
 * POST /api/token
 * Returns the access token for a provider given a session token.
 */
apiRoutes.post('/api/token', async (c) => {
  const { sessionToken, provider } = await c.req.json<{ sessionToken: string; provider: string }>();

  if (!sessionToken || !provider) {
    return c.json({ error: 'Missing sessionToken or provider' }, 400);
  }

  const userId = getSession(sessionToken);
  if (!userId) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  const token = getToken(sessionToken, provider);
  if (!token) {
    return c.json({ error: `No connection found for ${provider}` }, 404);
  }

  // Check if token is expired
  if (token.expiresAt && token.expiresAt < Date.now()) {
    return c.json({ error: 'Token expired, use /api/refresh' }, 401);
  }

  return c.json({ accessToken: token.accessToken, expiresAt: token.expiresAt });
});

/**
 * POST /api/refresh
 * Refreshes an expired token using the stored refresh token.
 */
apiRoutes.post('/api/refresh', async (c) => {
  const { sessionToken, provider } = await c.req.json<{ sessionToken: string; provider: string }>();

  if (!sessionToken || !provider) {
    return c.json({ error: 'Missing sessionToken or provider' }, 400);
  }

  const userId = getSession(sessionToken);
  if (!userId) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  const token = getToken(sessionToken, provider);
  if (!token) {
    return c.json({ error: `No connection found for ${provider}` }, 404);
  }

  if (!token.refreshToken) {
    return c.json({ error: 'No refresh token available' }, 400);
  }

  const config = getProviderConfig(provider);
  if (!config) {
    return c.json({ error: `Unknown provider: ${provider}` }, 400);
  }

  try {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: token.refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return c.json({ error: 'Token refresh failed', details: errorBody }, 502);
    }

    const data = await response.json() as Record<string, unknown>;

    storeToken(sessionToken, provider, {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token as string) ?? token.refreshToken,
      expiresAt: data.expires_in ? Date.now() + (data.expires_in as number) * 1000 : undefined,
      provider,
    });

    return c.json({ accessToken: data.access_token, expiresAt: data.expires_in });
  } catch (err) {
    return c.json({ error: 'Token refresh request failed', details: String(err) }, 502);
  }
});

/**
 * DELETE /api/connection/:provider
 * Revokes and deletes a provider connection.
 */
apiRoutes.delete('/api/connection/:provider', async (c) => {
  const provider = c.req.param('provider');
  const sessionToken = c.req.header('authorization')?.replace('Bearer ', '');

  if (!sessionToken) {
    return c.json({ error: 'Missing authorization header' }, 401);
  }

  const userId = getSession(sessionToken);
  if (!userId) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  const deleted = deleteToken(sessionToken, provider);
  if (!deleted) {
    return c.json({ error: `No connection found for ${provider}` }, 404);
  }

  return c.json({ ok: true, provider });
});

export { apiRoutes };
