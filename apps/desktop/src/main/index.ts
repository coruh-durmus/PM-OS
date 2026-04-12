import { app } from 'electron';
import { createMainWindow } from './window.js';

// Disable FedCM (Federated Credential Management) — Electron doesn't fully
// support it, and Google Sign-In / Figma crash when it's partially available.
// This makes Google fall back to standard OAuth popup flow which works fine.
app.commandLine.appendSwitch('disable-features', 'FedCm,FedCmButtonMode,FedCmIdpSigninStatus,FedCmMultipleIdentityProviders');

import { WcvManager } from './wcv-manager.js';
import { registerIpcHandlers } from './ipc.js';
import { ExtensionHost } from './extension-host.js';
import { PtyManager } from './pty-manager.js';
import { NotificationManager } from './notification-manager.js';
import { WorkspaceManager } from './workspace-manager.js';
import { createAppMenu } from './app-menu.js';

let wcvManager: WcvManager | null = null;
let ptyManager: PtyManager | null = null;

app.whenReady().then(async () => {
  const mainWindow = createMainWindow();
  const notificationManager = new NotificationManager();
  notificationManager.setWindow(mainWindow);
  wcvManager = new WcvManager(mainWindow, notificationManager);
  ptyManager = new PtyManager();
  const extensionHost = new ExtensionHost();
  const workspaceManager = new WorkspaceManager();
  workspaceManager.setWindow(mainWindow);
  createAppMenu(workspaceManager);
  registerIpcHandlers(mainWindow, wcvManager, extensionHost, ptyManager, notificationManager, workspaceManager);

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
