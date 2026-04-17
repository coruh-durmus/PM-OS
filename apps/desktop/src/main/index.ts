import { app, dialog } from 'electron';
import { createMainWindow } from './window.js';

// ---------------------------------------------------------------------------
// Global EPIPE guard — must be installed before anything writes to stdout/stderr.
// When a PTY process exits, the stdout/stderr pipe can break. If any
// console.log/warn/error fires after that, Node throws an uncaught EPIPE that
// kills the entire Electron app. We catch it here and swallow it safely.
// ---------------------------------------------------------------------------
process.on('uncaughtException', (error) => {
  if ((error as NodeJS.ErrnoException).code === 'EPIPE') {
    // Use raw write with its own try-catch — console.error would EPIPE again.
    try { process.stderr.write('[main] EPIPE error suppressed\n'); } catch {}
    return;
  }
  // For non-EPIPE errors: show a dialog so the user sees what happened,
  // but don't re-throw (which would double-crash the app).
  try { process.stderr.write(`[main] Uncaught exception: ${error.stack || error.message}\n`); } catch {}
  try { dialog.showErrorBox('Uncaught Exception', error.stack || error.message); } catch {}
});

// Disable FedCM (Federated Credential Management) — Electron doesn't fully
// support it, and Google Sign-In / Figma crash when it's partially available.
// This makes Google fall back to standard OAuth popup flow which works fine.
app.commandLine.appendSwitch('disable-features', 'FedCm,FedCmButtonMode,FedCmIdpSigninStatus,FedCmMultipleIdentityProviders,ThirdPartyCookieDeprecation,TrackingProtection3pcd');

// Enable WebAuthentication (passkeys/FIDO2) support in Electron
app.commandLine.appendSwitch('enable-features', 'WebAuthenticationMacOSPasskeys');
app.commandLine.appendSwitch('enable-web-authentication-api');

// Log WebAuthn/passkey events for debugging auth issues
app.on('certificate-error', (_event, _wc, url, error) => {
  try { console.log(`[auth:cert-error] ${url}: ${error}`); } catch {}
});

// Handle select-hid-device for hardware security keys (FIDO2/U2F)
app.on('select-hid-device' as any, (event: any, details: any, callback: any) => {
  try { console.log(`[auth:hid-device]`, JSON.stringify(details)); } catch {}
  // Auto-select the first HID device if available
  if (details?.deviceList?.length > 0) {
    callback(details.deviceList[0].deviceId);
  } else {
    callback('');
  }
});

import { WcvManager } from './wcv-manager.js';
import { SessionSync } from './session-sync.js';
import { registerIpcHandlers } from './ipc.js';
import { ExtensionHost } from './extension-host.js';
import { PtyManager } from './pty-manager.js';
import { NotificationManager } from './notification-manager.js';
import { WorkspaceManager } from './workspace-manager.js';
import { createAppMenu } from './app-menu.js';
import { MeetingDetectionService } from './meeting-detection.js';
import { AudioCaptureManager } from './audio-capture-manager.js';
import { ExtensionStoreManager } from './extension-store-manager.js';
import { setMainWebContents } from './vscode-shim/window.js';

// ---------------------------------------------------------------------------
// Safe logging helpers — guard every write against EPIPE so that a broken pipe
// never bubbles up as an uncaught exception.
// ---------------------------------------------------------------------------
function safeLog(...args: unknown[]): void {
  try { console.log(...args); } catch {}
}

function safeError(...args: unknown[]): void {
  try { console.error(...args); } catch {}
}

let wcvManager: WcvManager | null = null;
let ptyManager: PtyManager | null = null;

app.whenReady().then(async () => {
  safeLog(`[main] Electron ${process.versions.electron}, Chrome ${process.versions.chrome}, Node ${process.versions.node}`);
  const mainWindow = createMainWindow();
  const notificationManager = new NotificationManager();
  notificationManager.setWindow(mainWindow);
  const sessionSync = new SessionSync();
  const meetingDetection = new MeetingDetectionService();
  meetingDetection.setWindow(mainWindow);
  const audioCaptureManager = new AudioCaptureManager();
  wcvManager = new WcvManager(mainWindow, notificationManager, sessionSync, meetingDetection);
  ptyManager = new PtyManager();
  const extensionHost = new ExtensionHost();
  const workspaceManager = new WorkspaceManager();
  workspaceManager.setWindow(mainWindow);
  const extensionStoreManager = new ExtensionStoreManager();
  extensionStoreManager.setProgressCallback((data) => {
    try { mainWindow.webContents.send('extension-store:progress', data); } catch {}
  });
  createAppMenu(workspaceManager);
  registerIpcHandlers(mainWindow, wcvManager, extensionHost, ptyManager, notificationManager, workspaceManager, meetingDetection, audioCaptureManager, extensionStoreManager);

  // Wire up vscode-shim status bar IPC to the main window
  setMainWebContents(mainWindow.webContents);

  // Let meeting detection check workspace state directly
  meetingDetection.setWorkspaceChecker(workspaceManager);

  await extensionHost.loadAll();

  mainWindow.show();
});

app.on('window-all-closed', () => {
  if (wcvManager) {
    wcvManager.destroyAll();
  }
  if (ptyManager) {
    ptyManager.destroyAll();
  }
  app.quit();
});
