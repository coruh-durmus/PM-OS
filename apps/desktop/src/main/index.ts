import { app } from 'electron';
import { createMainWindow } from './window.js';
import { WcvManager } from './wcv-manager.js';
import { registerIpcHandlers } from './ipc.js';
import { ExtensionHost } from './extension-host.js';

let wcvManager: WcvManager | null = null;

app.whenReady().then(async () => {
  const mainWindow = createMainWindow();
  wcvManager = new WcvManager(mainWindow);
  const extensionHost = new ExtensionHost();
  registerIpcHandlers(mainWindow, wcvManager, extensionHost);

  await extensionHost.loadAll();

  mainWindow.show();
});

app.on('window-all-closed', () => {
  if (wcvManager) {
    wcvManager.destroyAll();
  }
  app.quit();
});
