import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import type { WcvManager } from './wcv-manager.js';
import type { ExtensionHost } from './extension-host.js';
import type { PtyManager } from './pty-manager.js';
import type { NotificationManager } from './notification-manager.js';
import type { WorkspaceManager } from './workspace-manager.js';
import type { MeetingDetectionService } from './meeting-detection.js';
import type { AudioCaptureManager } from './audio-capture-manager.js';
import type { ExtensionStoreManager } from './extension-store-manager.js';
import type { PanelBounds, WebContentsViewOptions } from '@pm-os/types';

// ---------------------------------------------------------------------------
// Safe logging — guard against EPIPE when stdout/stderr pipe is broken.
// ---------------------------------------------------------------------------
function safeLog(...args: unknown[]): void {
  try { console.log(...args); } catch {}
}
function safeError(...args: unknown[]): void {
  try { console.error(...args); } catch {}
}

export function registerIpcHandlers(
  window: BrowserWindow,
  wcv: WcvManager,
  extensionHost?: ExtensionHost,
  ptyManager?: PtyManager,
  notificationManager?: NotificationManager,
  workspaceManager?: WorkspaceManager,
  meetingDetection?: MeetingDetectionService,
  audioCaptureManager?: AudioCaptureManager,
  extensionStoreManager?: ExtensionStoreManager,
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

  ipcMain.handle('wcv:open-devtools', (_event, id: string) => {
    wcv.openDevTools(id);
  });

  ipcMain.handle('wcv:reload', (_event, id: string) => {
    wcv.reload(id);
  });

  // Extension handlers
  ipcMain.handle('extensions:list', () => {
    return extensionHost?.getManifests() ?? [];
  });

  ipcMain.handle('extension:get-themes', () => {
    return extensionHost?.getExtensionThemes() ?? [];
  });

  ipcMain.handle('extension:get-configs', () => {
    return extensionHost?.getExtensionConfigs() ?? [];
  });

  ipcMain.handle('extension:activate-installed', async (_e, extPath: string) => {
    return extensionHost?.loadSingleExtension(extPath);
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
  ipcMain.handle('terminal:create', (_e, options?: { cwd?: string; shell?: string }) => {
    if (!ptyManager) return null;
    safeLog('[ipc] terminal:create', options);
    const id = ptyManager.create(options);

    ptyManager.onData(id, (data) => {
      try { window.webContents.send('terminal:data', { id, data }); } catch {}
    });

    ptyManager.onExit(id, (exitCode) => {
      safeLog(`[ipc] terminal:exit ${id} code=${exitCode}`);
      try { window.webContents.send('terminal:exit', { id, exitCode }); } catch {}
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
    safeLog(`[ipc] terminal:destroy ${id}`);
    ptyManager?.destroy(id);
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

  ipcMain.handle('fs:mkdir', async (_e, dirPath: string) => {
    const fs = require('fs');
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      return true;
    } catch { return false; }
  });

  ipcMain.handle('fs:delete', async (_e, targetPath: string) => {
    const fs = require('fs');
    try {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
      return true;
    } catch { return false; }
  });

  ipcMain.handle('fs:rename', async (_e, oldPath: string, newPath: string) => {
    const fs = require('fs');
    try {
      fs.renameSync(oldPath, newPath);
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

  // System handlers
  ipcMain.handle('system:check-claude-code', async () => {
    const { execFileSync } = require('child_process');
    try {
      const version = execFileSync('claude', ['--version'], { encoding: 'utf-8', timeout: 5000 }).trim();
      return { installed: true, version };
    } catch {
      return { installed: false, version: null };
    }
  });

  // Settings handlers
  ipcMain.handle('settings:get-enabled-apps', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const settingsPath = path.join(os.homedir(), '.pm-os', 'settings.json');
    try {
      if (fs.existsSync(settingsPath)) return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      return null;
    } catch { return null; }
  });

  ipcMain.handle('settings:save', (_e: any, settings: any) => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = path.join(os.homedir(), '.pm-os');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(settings, null, 2));
    return true;
  });

  // Onboarding flag — persisted in Electron's userData directory so it
  // survives across sessions but is removed on uninstall.
  ipcMain.handle('settings:isOnboarded', () => {
    const fs = require('fs');
    const path = require('path');
    const flagPath = path.join(app.getPath('userData'), 'onboarded.flag');
    return fs.existsSync(flagPath);
  });

  ipcMain.handle('settings:setOnboarded', () => {
    const fs = require('fs');
    const path = require('path');
    const flagPath = path.join(app.getPath('userData'), 'onboarded.flag');
    fs.writeFileSync(flagPath, 'true', 'utf-8');
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

  ipcMain.handle('git:clone', async (_e, url: string, targetPath: string) => {
    const { execFileSync } = require('child_process');
    const path = require('path');
    try {
      safeLog(`[ipc] git:clone ${url} into ${targetPath}`);
      execFileSync('git', ['clone', url], { cwd: targetPath, encoding: 'utf-8', timeout: 300000, maxBuffer: 10 * 1024 * 1024 });
      const repoName = url.split('/').pop()?.replace('.git', '') || 'repository';
      const clonedPath = path.join(targetPath, repoName);
      safeLog(`[ipc] git:clone success → ${clonedPath}`);
      return { success: true, clonedPath };
    } catch (err: any) {
      safeError(`[ipc] git:clone failed:`, err.stderr?.toString() || err.message);
      return { success: false, error: err.stderr?.toString() || err.message };
    }
  });

  ipcMain.handle('git:diff', async (_e, projectPath: string) => {
    const { execSync } = require('child_process');
    try {
      const diff = execSync('git diff', { cwd: projectPath, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
      return diff;
    } catch { return ''; }
  });

  ipcMain.handle('git:diff-staged', async (_e, projectPath: string) => {
    const { execSync } = require('child_process');
    try {
      const diff = execSync('git diff --staged', { cwd: projectPath, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
      return diff;
    } catch { return ''; }
  });

  ipcMain.handle('git:status-files', async (_e, projectPath: string) => {
    const { execSync } = require('child_process');
    try {
      const output = execSync('git status --porcelain', { cwd: projectPath, encoding: 'utf-8' });
      return output.split('\n').filter(Boolean).map((line: string) => ({
        status: line.substring(0, 2).trim(),
        path: line.substring(3),
      }));
    } catch { return []; }
  });

  // MCP health check — reads Claude Code's global .mcp.json
  ipcMain.handle('mcp:check-installed', async () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    // Check Claude Code's global MCP config
    const globalMcpPaths = [
      path.join(os.homedir(), '.claude', '.mcp.json'),
      path.join(os.homedir(), '.claude.json'),
    ];

    let installedMcps: string[] = [];
    for (const mcpPath of globalMcpPaths) {
      try {
        if (fs.existsSync(mcpPath)) {
          const config = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
          const servers = config.mcpServers || config;
          installedMcps = Object.keys(servers);
          break;
        }
      } catch {}
    }

    // Also check project-level .mcp.json files
    const wsPath = path.join(os.homedir(), 'pm-os-projects');
    const projectMcps: Record<string, string[]> = {};
    try {
      if (fs.existsSync(wsPath)) {
        const dirs = fs.readdirSync(wsPath, { withFileTypes: true });
        for (const dir of dirs) {
          if (!dir.isDirectory()) continue;
          const projMcp = path.join(wsPath, dir.name, '.mcp.json');
          try {
            if (fs.existsSync(projMcp)) {
              const config = JSON.parse(fs.readFileSync(projMcp, 'utf-8'));
              projectMcps[dir.name] = Object.keys(config.mcpServers || config);
            }
          } catch {}
        }
      }
    } catch {}

    // Required MCPs based on PM-OS apps
    const required = [
      { id: 'slack', name: 'Slack MCP', npmPackage: '@anthropic/mcp-slack', forApp: 'Slack' },
      { id: 'notion', name: 'Notion MCP', npmPackage: '@anthropic/mcp-notion', forApp: 'Notion' },
      { id: 'atlassian', name: 'Atlassian MCP', npmPackage: '@anthropic/mcp-atlassian', forApp: 'Jira & Confluence' },
      { id: 'gmail', name: 'Gmail MCP', npmPackage: '@anthropic/mcp-gmail', forApp: 'Gmail' },
      { id: 'figma', name: 'Figma MCP', npmPackage: '@anthropic/mcp-figma', forApp: 'Figma' },
    ];

    const results = required.map(req => ({
      ...req,
      installed: installedMcps.some(m => m.toLowerCase().includes(req.id)),
    }));

    return { globalMcps: installedMcps, projectMcps, required: results };
  });

  // Workspace handlers
  ipcMain.handle('workspace:is-open', () => workspaceManager?.isOpen() ?? false);
  ipcMain.handle('workspace:get-folders', () => workspaceManager?.getFolders() ?? []);
  ipcMain.handle('workspace:get-name', () => workspaceManager?.getName() ?? '');
  ipcMain.handle('workspace:get-recent', () => workspaceManager?.getRecent() ?? []);
  ipcMain.handle('workspace:open-folder', () => workspaceManager?.openFolder());
  ipcMain.handle('workspace:open-path', (_e, folderPath: string) => workspaceManager?.openFolderDirect(folderPath));
  ipcMain.handle('workspace:open-from-file', () => workspaceManager?.openWorkspaceFromFile());
  ipcMain.handle('workspace:add-folder', () => workspaceManager?.addFolderToWorkspace());
  ipcMain.handle('workspace:save-as', () => workspaceManager?.saveWorkspaceAs());
  ipcMain.handle('workspace:close', () => workspaceManager?.closeWorkspace());
  ipcMain.handle('workspace:remove-folder', (_e, folderPath: string) => workspaceManager?.removeFolderFromWorkspace(folderPath));

  // Meeting detection handlers
  ipcMain.handle('meeting:get-active', () => meetingDetection?.getActiveMeeting());
  ipcMain.handle('meeting:skip-transcription', () => meetingDetection?.skipTranscription());
  ipcMain.handle('meeting:force-stop', () => meetingDetection?.endMeeting());

  // Audio capture handlers
  ipcMain.handle('audio:start-capture', () => audioCaptureManager?.startCapture());
  ipcMain.handle('audio:stop-capture', () => audioCaptureManager?.stopCapture());
  ipcMain.handle('audio:get-status', () => audioCaptureManager?.getStatus());

  // Extension command handlers
  ipcMain.handle('extension:get-commands', () => {
    const { getDeclaredCommands } = require('./vscode-shim/commands');
    const cmds = getDeclaredCommands();
    return Array.from(cmds.entries()).map(([id, data]: [string, { title: string; category?: string }]) => ({
      id,
      title: data.title,
      category: data.category,
    }));
  });

  ipcMain.handle('extension:execute-command', async (_e: any, commandId: string, ...args: any[]) => {
    const { executeCommand } = require('./vscode-shim/commands');
    return executeCommand(commandId, ...args);
  });

  // Extension store handlers (Open VSX)
  ipcMain.handle('extension-store:search', (_event, query: string, category?: string, offset?: number, size?: number) =>
    extensionStoreManager?.search(query, category, offset, size));
  ipcMain.handle('extension-store:get-extension', (_event, namespace: string, name: string) =>
    extensionStoreManager?.getExtension(namespace, name));
  ipcMain.handle('extension-store:install', (_event, namespace: string, name: string, version: string) =>
    extensionStoreManager?.install(namespace, name, version));
  ipcMain.handle('extension-store:uninstall', (_event, id: string) =>
    extensionStoreManager?.uninstall(id));
  ipcMain.handle('extension-store:get-installed', () =>
    extensionStoreManager?.getInstalled() ?? []);
  ipcMain.handle('extension-store:check-updates', () => extensionStoreManager?.checkUpdates() ?? []);
  ipcMain.handle('extension-store:update', (_e: any, namespace: string, name: string, version: string) =>
    extensionStoreManager?.updateExtension(namespace, name, version));
}
