import { BrowserWindow, ipcMain, dialog } from 'electron';
import type { WcvManager } from './wcv-manager.js';
import type { PanelBounds, WebContentsViewOptions } from '@pm-os/types';

export function registerIpcHandlers(
  window: BrowserWindow,
  wcv: WcvManager,
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

  ipcMain.handle('dialog:open-directory', async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });
}
