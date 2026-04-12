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

  // Project Manager handlers
  const os = require('os');
  const path = require('path');

  // Lazy-load ProjectStore — create it once when first used
  let projectStore: any = null;
  const getProjectStore = () => {
    if (!projectStore) {
      try {
        const { ProjectStore } = require(path.join(__dirname, '..', '..', '..', '..', 'extensions', 'project-manager', 'dist', 'index.js'));
        const baseDir = path.join(os.homedir(), 'pm-os-projects');
        projectStore = new ProjectStore(baseDir);
      } catch (e) {
        console.error('[IPC] Failed to load ProjectStore:', e);
      }
    }
    return projectStore;
  };

  let decisionLog: any = null;
  const getDecisionLog = (projectPath: string) => {
    try {
      const { DecisionLog } = require(path.join(__dirname, '..', '..', '..', '..', 'extensions', 'project-manager', 'dist', 'index.js'));
      return new DecisionLog(projectPath);
    } catch { return null; }
  };

  ipcMain.handle('project:list', () => {
    return getProjectStore()?.list() ?? [];
  });

  ipcMain.handle('project:create', async (_e, name: string) => {
    return getProjectStore()?.create(name);
  });

  ipcMain.handle('project:delete', (_e, name: string) => {
    getProjectStore()?.delete(name);
  });

  ipcMain.handle('project:get-config', (_e, projectPath: string) => {
    return getProjectStore()?.getConfig(projectPath);
  });

  ipcMain.handle('project:get-links', (_e, projectPath: string) => {
    return getProjectStore()?.getLinks(projectPath) ?? [];
  });

  ipcMain.handle('project:add-link', (_e, projectPath: string, link: any) => {
    getProjectStore()?.addLink(projectPath, link);
  });

  ipcMain.handle('project:remove-link', (_e, projectPath: string, linkId: string) => {
    getProjectStore()?.removeLink(projectPath, linkId);
  });

  ipcMain.handle('project:get-decisions', (_e, projectPath: string) => {
    return getDecisionLog(projectPath)?.list() ?? [];
  });

  ipcMain.handle('project:add-decision', (_e, projectPath: string, entry: any) => {
    return getDecisionLog(projectPath)?.append(entry);
  });

  // File system handlers
  ipcMain.handle('fs:read-dir', async (_e, dirPath: string) => {
    const fs = require('fs');
    const path = require('path');
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries
        .filter((e: any) => !e.name.startsWith('.') || e.name === '.pm-os' || e.name === '.memory' || e.name === '.mcp.json')
        .map((e: any) => ({
          name: e.name,
          path: path.join(dirPath, e.name),
          isDirectory: e.isDirectory(),
        }))
        .sort((a: any, b: any) => {
          // Directories first, then alphabetical
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
    } catch { return []; }
  });

  ipcMain.handle('fs:read-file', async (_e, filePath: string) => {
    const fs = require('fs');
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch { return null; }
  });

  ipcMain.handle('fs:write-file', async (_e, filePath: string, content: string) => {
    const fs = require('fs');
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch { return false; }
  });

  ipcMain.handle('fs:get-workspace-path', () => {
    const os = require('os');
    const path = require('path');
    return path.join(os.homedir(), 'pm-os-projects');
  });

  ipcMain.handle('workspace:ensure-claude-md', async () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const wsPath = path.join(os.homedir(), 'pm-os-projects');
    const claudePath = path.join(wsPath, 'CLAUDE.md');
    if (!fs.existsSync(wsPath)) fs.mkdirSync(wsPath, { recursive: true });
    if (!fs.existsSync(claudePath)) {
      fs.writeFileSync(claudePath, `# PM-OS Workspace\n\nShared AI instructions for all projects in this workspace.\n`);
    }
    return claudePath;
  });
}
