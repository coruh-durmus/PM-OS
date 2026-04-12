import { BrowserWindow, ipcMain, dialog } from 'electron';
import type { WcvManager } from './wcv-manager.js';
import type { ExtensionHost } from './extension-host.js';
import type { PtyManager } from './pty-manager.js';
import type { NotificationManager } from './notification-manager.js';
import type { PanelBounds, WebContentsViewOptions } from '@pm-os/types';

export function registerIpcHandlers(
  window: BrowserWindow,
  wcv: WcvManager,
  extensionHost?: ExtensionHost,
  ptyManager?: PtyManager,
  notificationManager?: NotificationManager,
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

  // Notification center handlers
  ipcMain.handle('notifications:get-all', () => {
    return notificationManager?.getAll() ?? [];
  });

  ipcMain.handle('notifications:get-unread-count', () => {
    return notificationManager?.getUnreadCount() ?? 0;
  });

  ipcMain.handle('notifications:mark-read', (_e, id: string) => {
    notificationManager?.markRead(id);
  });

  ipcMain.handle('notifications:mark-all-read', () => {
    notificationManager?.markAllRead();
  });

  ipcMain.handle('notifications:clear-all', () => {
    notificationManager?.clearAll();
  });

  ipcMain.handle('notifications:get-settings', () => {
    return notificationManager?.getSettings() ?? {};
  });

  ipcMain.handle('notifications:set-app-enabled', (_e, appId: string, enabled: boolean) => {
    notificationManager?.setAppEnabled(appId, enabled);
  });

  // MCP Center handlers
  ipcMain.handle('mcp:get-config', (_e, projectPath: string) => {
    const fs = require('fs');
    const p = require('path');
    const mcpPath = p.join(projectPath, '.mcp.json');
    try {
      if (!fs.existsSync(mcpPath)) return { mcpServers: {} };
      return JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
    } catch { return { mcpServers: {} }; }
  });

  ipcMain.handle('mcp:save-config', (_e, projectPath: string, config: any) => {
    const fs = require('fs');
    const p = require('path');
    const mcpPath = p.join(projectPath, '.mcp.json');
    try {
      fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2), 'utf-8');
      return true;
    } catch { return false; }
  });

  ipcMain.handle('mcp:add-server', (_e, projectPath: string, name: string, serverConfig: any) => {
    const fs = require('fs');
    const p = require('path');
    const mcpPath = p.join(projectPath, '.mcp.json');
    try {
      let config = { mcpServers: {} } as any;
      if (fs.existsSync(mcpPath)) {
        config = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
        if (!config.mcpServers) config.mcpServers = {};
      }
      config.mcpServers[name] = serverConfig;
      fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2), 'utf-8');
      return true;
    } catch { return false; }
  });

  ipcMain.handle('mcp:remove-server', (_e, projectPath: string, name: string) => {
    const fs = require('fs');
    const p = require('path');
    const mcpPath = p.join(projectPath, '.mcp.json');
    try {
      if (!fs.existsSync(mcpPath)) return false;
      const config = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      if (config.mcpServers) delete config.mcpServers[name];
      fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2), 'utf-8');
      return true;
    } catch { return false; }
  });

  ipcMain.handle('mcp:list-projects', () => {
    const fs = require('fs');
    const p = require('path');
    const os = require('os');
    const wsPath = p.join(os.homedir(), 'pm-os-projects');
    try {
      if (!fs.existsSync(wsPath)) return [];
      return fs.readdirSync(wsPath, { withFileTypes: true })
        .filter((d: any) => d.isDirectory() && fs.existsSync(p.join(wsPath, d.name, '.pm-os', 'config.json')))
        .map((d: any) => ({ name: d.name, path: p.join(wsPath, d.name) }));
    } catch { return []; }
  });

  // Git info handlers
  ipcMain.handle('git:get-info', async (_e, projectPath: string) => {
    const { execFileSync } = require('child_process');
    const info: any = { branch: null, remote: null, dirty: false, modifiedCount: 0, lastCommit: null, contributors: [] };

    try {
      // Current branch
      info.branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectPath, encoding: 'utf-8' }).trim();
    } catch {}

    try {
      // Remote URL
      info.remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: projectPath, encoding: 'utf-8' }).trim();
    } catch {}

    try {
      // Status — count modified files
      const status = execFileSync('git', ['status', '--porcelain'], { cwd: projectPath, encoding: 'utf-8' }).trim();
      const lines = status ? status.split('\n') : [];
      info.modifiedCount = lines.length;
      info.dirty = lines.length > 0;
    } catch {}

    try {
      // Last commit
      const log = execFileSync('git', ['log', '-1', '--format=%H|%an|%ar|%s'], { cwd: projectPath, encoding: 'utf-8' }).trim();
      if (log) {
        const [hash, author, timeAgo, message] = log.split('|');
        info.lastCommit = { hash: hash?.slice(0, 7), author, timeAgo, message };
      }
    } catch {}

    try {
      // Contributors (unique authors from git log, last 50 commits)
      const authors = execFileSync('git', ['log', '--format=%an', '-50'], { cwd: projectPath, encoding: 'utf-8' }).trim();
      if (authors) {
        const unique = [...new Set(authors.split('\n').filter(Boolean))];
        info.contributors = unique.slice(0, 10);
      }
    } catch {}

    return info;
  });

  ipcMain.handle('git:set-remote', async (_e, projectPath: string, remoteUrl: string) => {
    const { execFileSync } = require('child_process');
    try {
      // Check if origin exists
      try {
        execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: projectPath, encoding: 'utf-8' });
        // Origin exists, update it
        execFileSync('git', ['remote', 'set-url', 'origin', remoteUrl], { cwd: projectPath, encoding: 'utf-8' });
      } catch {
        // No origin, add it
        execFileSync('git', ['remote', 'add', 'origin', remoteUrl], { cwd: projectPath, encoding: 'utf-8' });
      }
      return true;
    } catch { return false; }
  });

  ipcMain.handle('git:push', async (_e, projectPath: string) => {
    const { execFileSync } = require('child_process');
    try {
      execFileSync('git', ['push', '-u', 'origin', 'HEAD'], { cwd: projectPath, encoding: 'utf-8', timeout: 30000 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.stderr?.toString() || err.message };
    }
  });

  ipcMain.handle('git:pull', async (_e, projectPath: string) => {
    const { execFileSync } = require('child_process');
    try {
      const output = execFileSync('git', ['pull', '--rebase'], { cwd: projectPath, encoding: 'utf-8', timeout: 30000 });
      return { success: true, output };
    } catch (err: any) {
      return { success: false, error: err.stderr?.toString() || err.message };
    }
  });

  ipcMain.handle('git:commit-all', async (_e, projectPath: string, message: string) => {
    const { execFileSync } = require('child_process');
    try {
      execFileSync('git', ['add', '-A'], { cwd: projectPath, encoding: 'utf-8' });
      execFileSync('git', ['commit', '-m', message], { cwd: projectPath, encoding: 'utf-8' });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.stderr?.toString() || err.message };
    }
  });
}
