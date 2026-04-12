/**
 * Opens a BrowserWindow for OAuth authorization and extracts the
 * authorization code from the callback redirect.
 */
export async function startOAuthFlow(
  provider: string,
  authUrl: string,
  callbackUrl: string,
): Promise<string> {
  const { BrowserWindow } = await import('electron');

  return new Promise<string>((resolve, reject) => {
    const win = new BrowserWindow({
      width: 600,
      height: 700,
      title: `Sign in to ${provider}`,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Watch for navigation to the callback URL
    win.webContents.on('will-redirect', (_event, url) => {
      if (url.startsWith(callbackUrl)) {
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        if (code) {
          resolve(code);
        } else {
          reject(new Error(`No authorization code in callback URL for ${provider}`));
        }
        win.close();
      }
    });

    // Also handle will-navigate for providers that use navigations instead of redirects
    win.webContents.on('will-navigate', (_event, url) => {
      if (url.startsWith(callbackUrl)) {
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        if (code) {
          resolve(code);
        } else {
          reject(new Error(`No authorization code in callback URL for ${provider}`));
        }
        win.close();
      }
    });

    win.on('closed', () => {
      reject(new Error(`OAuth window closed before completing ${provider} sign-in`));
    });

    win.loadURL(authUrl);
  });
}
