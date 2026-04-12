import { BrowserWindow, ipcMain, dialog } from 'electron';
import type { WcvManager } from './wcv-manager.js';
import type { ExtensionHost } from './extension-host.js';
import type { PtyManager } from './pty-manager.js';
import type { PanelBounds, WebContentsViewOptions } from '@pm-os/types';

export function registerIpcHandlers(
  window: BrowserWindow,
  wcv: WcvManager,
  extensionHost?: ExtensionHost,
  ptyManager?: PtyManager,
): void {
  ipcMain.handle('wcv:create', (_event, options: WebContentsViewOptions) => {
    return wcv.create(options);
  });

  ipcMain.handle('wcv:navigate', (_event, id: string, url: string) => {
    wcv.navigate(id, url);
  });

  ipcMain.handle('wcv:set-bounds', (_event, id: string, bounds: PanelBounds) => {
    wcv.setBounds(id, bounds);
  });

  ipcMain.handle('wcv:destroy', (_event, id: string) => {
    wcv.destroy(id);
  });

  ipcMain.handle('wcv:get-state', (_event, id: string) => {
    return wcv.getState(id);
  });

  ipcMain.handle('wcv:go-back', (_event, id: string) => {
    wcv.goBack(id);
  });

  ipcMain.handle('wcv:go-forward', (_event, id: string) => {
    wcv.goForward(id);
  });

  ipcMain.handle('wcv:reload', (_event, id: string) => {
    wcv.reload(id);
  });

  // Extension handlers
  ipcMain.handle('extensions:list', () => {
    return extensionHost?.getManifests() ?? [];
  });

  ipcMain.handle('dialog:open-directory', async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Terminal handlers
  ipcMain.handle('terminal:create', (_e, options?: { cwd?: string }) => {
    if (!ptyManager) return null;
    const id = ptyManager.create(options);

    ptyManager.onData(id, (data) => {
      window.webContents.send('terminal:data', { id, data });
    });

    ptyManager.onExit(id, (exitCode) => {
      window.webContents.send('terminal:exit', { id, exitCode });
    });

    return id;
  });

  ipcMain.handle('terminal:write', (_e, id: string, data: string) => {
    ptyManager?.write(id, data);
  });

  ipcMain.handle('terminal:resize', (_e, id: string, cols: number, rows: number) => {
    ptyManager?.resize(id, cols, rows);
  });

  ipcMain.handle('terminal:destroy', (_e, id: string) => {
    ptyManager?.destroy(id);
  });
}
