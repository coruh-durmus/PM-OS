import { app } from 'electron';
import { createMainWindow } from './window.js';
import { WcvManager } from './wcv-manager.js';
import { registerIpcHandlers } from './ipc.js';
import { ExtensionHost } from './extension-host.js';
import { PtyManager } from './pty-manager.js';

let wcvManager: WcvManager | null = null;
let ptyManager: PtyManager | null = null;

app.whenReady().then(async () => {
  const mainWindow = createMainWindow();
  wcvManager = new WcvManager(mainWindow);
  ptyManager = new PtyManager();
  const extensionHost = new ExtensionHost();
  registerIpcHandlers(mainWindow, wcvManager, extensionHost, ptyManager);

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
