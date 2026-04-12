// TODO: Replace in-memory storage with PostgreSQL (see db/schema.sql)

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  provider: string;
}

/** In-memory token store keyed by `${sessionToken}:${provider}` */
const tokens = new Map<string, StoredToken>();

/** In-memory session store: sessionToken -> userId */
const sessions = new Map<string, string>();

// ---- Sessions ----

export function createSession(sessionToken: string, userId: string): void {
  sessions.set(sessionToken, userId);
}

export function getSession(sessionToken: string): string | null {
  return sessions.get(sessionToken) ?? null;
}

// ---- Tokens ----

function tokenKey(sessionToken: string, provider: string): string {
  return `${sessionToken}:${provider}`;
}

export function storeToken(sessionToken: string, provider: string, token: StoredToken): void {
  tokens.set(tokenKey(sessionToken, provider), token);
}

export function getToken(sessionToken: string, provider: string): StoredToken | null {
  return tokens.get(tokenKey(sessionToken, provider)) ?? null;
}

export function deleteToken(sessionToken: string, provider: string): boolean {
  return tokens.delete(tokenKey(sessionToken, provider));
}
