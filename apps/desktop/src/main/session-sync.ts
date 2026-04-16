import { session } from 'electron';

// ---------------------------------------------------------------------------
// Safe logging — guard against EPIPE when stdout/stderr pipe is broken.
// ---------------------------------------------------------------------------
function safeLog(...args: unknown[]): void {
  try { console.log(...args); } catch {}
}

/**
 * Google auth cookie domains to replicate across sessions.
 * These cover the OAuth login flow, session cookies, and API tokens.
 */
const GOOGLE_AUTH_DOMAINS = [
  '.google.com',
  'accounts.google.com',
  '.googleapis.com',
  '.gstatic.com',
  'myaccount.google.com',
];

/**
 * SessionSync replicates Google authentication cookies across all registered
 * Electron session partitions. This lets the user log into Google once in any
 * panel (Browser, Gmail, Figma, etc.) and have all other panels recognise
 * the same Google account.
 *
 * Only Google-related cookies are replicated — app-specific cookies (e.g.
 * Slack session cookies) are never touched.
 */
export class SessionSync {
  private partitions = new Set<string>();
  private syncing = false; // prevent infinite replication loops

  /**
   * Register a session partition for cookie sync.
   * Call this whenever a new WebContentsView is created.
   */
  registerPartition(partition: string): void {
    if (this.partitions.has(partition)) return;
    this.partitions.add(partition);

    const ses = session.fromPartition(partition);
    ses.cookies.on('changed', (_event, cookie, _cause, removed) => {
      if (this.syncing) return;
      if (removed) return; // don't replicate deletions — avoids logout cascades
      if (!this.isGoogleAuthCookie(cookie)) return;
      this.replicateCookie(partition, cookie);
    });

    safeLog(`[SessionSync] Registered partition: ${partition}`);

    // Copy existing Google cookies from other partitions into this new one
    // so panels that load before the user logs in still get auth cookies.
    this.seedCookies(partition);
  }

  /**
   * Copy all Google auth cookies from the first existing partition that has
   * them into a newly registered partition. This handles the case where the
   * user already logged into Google in another panel before this one loaded.
   */
  private async seedCookies(targetPartition: string): Promise<void> {
    this.syncing = true;
    try {
      const targetSession = session.fromPartition(targetPartition);
      let seeded = 0;

      for (const sourcePartition of this.partitions) {
        if (sourcePartition === targetPartition) continue;
        const sourceSession = session.fromPartition(sourcePartition);

        // Get all cookies from the source, filter to Google auth
        let cookies: Electron.Cookie[];
        try {
          cookies = await sourceSession.cookies.get({});
        } catch {
          continue;
        }

        const googleCookies = cookies.filter((c) => this.isGoogleAuthCookie(c));
        if (googleCookies.length === 0) continue;

        for (const cookie of googleCookies) {
          const url = `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
          try {
            await targetSession.cookies.set({
              url,
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain,
              path: cookie.path,
              secure: cookie.secure,
              httpOnly: cookie.httpOnly,
              expirationDate: cookie.expirationDate,
              sameSite: cookie.sameSite as 'unspecified' | 'no_restriction' | 'lax' | 'strict' | undefined,
            });
            seeded++;
          } catch {
            // Individual cookie failures are fine
          }
        }

        if (seeded > 0) {
          safeLog(`[SessionSync] Seeded ${seeded} Google cookies from ${sourcePartition} → ${targetPartition}`);
          break; // one source is enough
        }
      }
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Check whether a cookie belongs to a Google auth domain.
   */
  private isGoogleAuthCookie(cookie: Electron.Cookie): boolean {
    const domain = cookie.domain.startsWith('.')
      ? cookie.domain
      : '.' + cookie.domain;
    return GOOGLE_AUTH_DOMAINS.some(
      (d) => domain === d || domain.endsWith(d),
    );
  }

  /**
   * Copy a cookie from the source partition to every other registered partition.
   */
  private async replicateCookie(
    sourcePartition: string,
    cookie: Electron.Cookie,
  ): Promise<void> {
    this.syncing = true;
    try {
      const url = `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`;

      for (const partition of this.partitions) {
        if (partition === sourcePartition) continue;
        const targetSession = session.fromPartition(partition);
        try {
          await targetSession.cookies.set({
            url,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate,
            sameSite: cookie.sameSite as 'unspecified' | 'no_restriction' | 'lax' | 'strict' | undefined,
          });
        } catch {
          // Silently ignore individual cookie set failures
        }
      }

      safeLog(
        `[SessionSync] Replicated cookie "${cookie.name}" from ${sourcePartition} to ${this.partitions.size - 1} partition(s)`,
      );
    } finally {
      this.syncing = false;
    }
  }
}
