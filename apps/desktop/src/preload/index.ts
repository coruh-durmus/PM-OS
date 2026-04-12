import { contextBridge, ipcRenderer } from 'electron';
import type { PanelBounds, WebContentsViewOptions, WebContentsViewState } from '@pm-os/types';

const api = {
  wcv: {
    create(options: WebContentsViewOptions): Promise<string> {
      return ipcRenderer.invoke('wcv:create', options);
    },
    navigate(id: string, url: string): Promise<void> {
      return ipcRenderer.invoke('wcv:navigate', id, url);
    },
    setBounds(id: string, bounds: PanelBounds): Promise<void> {
      return ipcRenderer.invoke('wcv:set-bounds', id, bounds);
    },
    destroy(id: string): Promise<void> {
      return ipcRenderer.invoke('wcv:destroy', id);
    },
    getState(id: string): Promise<WebContentsViewState | null> {
      return ipcRenderer.invoke('wcv:get-state', id);
    },
    goBack(id: string): Promise<void> {
      return ipcRenderer.invoke('wcv:go-back', id);
    },
    goForward(id: string): Promise<void> {
      return ipcRenderer.invoke('wcv:go-forward', id);
    },
    reload(id: string): Promise<void> {
      return ipcRenderer.invoke('wcv:reload', id);
    },
    onUrlChanged(callback: (data: { id: string; url: string }) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; url: string }) => callback(data);
      ipcRenderer.on('wcv:url-changed', handler);
      return () => ipcRenderer.removeListener('wcv:url-changed', handler);
    },
    onTitleChanged(callback: (data: { id: string; title: string }) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; title: string }) => callback(data);
      ipcRenderer.on('wcv:title-changed', handler);
      return () => ipcRenderer.removeListener('wcv:title-changed', handler);
    },
    onLoading(callback: (data: { id: string; loading: boolean }) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; loading: boolean }) => callback(data);
      ipcRenderer.on('wcv:loading', handler);
      return () => ipcRenderer.removeListener('wcv:loading', handler);
    },
    onOpenUrl(callback: (data: { url: string }) => void): () => void {
      const listener = (_event: Electron.IpcRendererEvent, data: { url: string }) => callback(data);
      ipcRenderer.on('wcv:open-url', listener);
      return () => ipcRenderer.removeListener('wcv:open-url', listener);
    },
  },
  project: {
    list: () => ipcRenderer.invoke('project:list'),
    create: (name: string, projectType?: string) => ipcRenderer.invoke('project:create', name, projectType),
    delete: (name: string) => ipcRenderer.invoke('project:delete', name),
    getConfig: (path: string) => ipcRenderer.invoke('project:get-config', path),
    getLinks: (path: string) => ipcRenderer.invoke('project:get-links', path),
    addLink: (path: string, link: any) => ipcRenderer.invoke('project:add-link', path, link),
    removeLink: (path: string, linkId: string) => ipcRenderer.invoke('project:remove-link', path, linkId),
    getDecisions: (path: string) => ipcRenderer.invoke('project:get-decisions', path),
    addDecision: (path: string, entry: any) => ipcRenderer.invoke('project:add-decision', path, entry),
  },
  fs: {
    readDir: (dirPath: string) => ipcRenderer.invoke('fs:read-dir', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:read-file', filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:write-file', filePath, content),
    getWorkspacePath: () => ipcRenderer.invoke('fs:get-workspace-path'),
  },
  workspace: {
    isOpen: () => ipcRenderer.invoke('workspace:is-open'),
    getFolders: () => ipcRenderer.invoke('workspace:get-folders'),
    getName: () => ipcRenderer.invoke('workspace:get-name'),
    getRecent: () => ipcRenderer.invoke('workspace:get-recent'),
    openFolder: () => ipcRenderer.invoke('workspace:open-folder'),
    openFromFile: () => ipcRenderer.invoke('workspace:open-from-file'),
    addFolder: () => ipcRenderer.invoke('workspace:add-folder'),
    saveAs: () => ipcRenderer.invoke('workspace:save-as'),
    close: () => ipcRenderer.invoke('workspace:close'),
    removeFolder: (path: string) => ipcRenderer.invoke('workspace:remove-folder', path),
    onChanged: (callback: (data: any) => void) => {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on('workspace:changed', listener);
      return () => ipcRenderer.removeListener('workspace:changed', listener);
    },
    ensureClaudeMd: () => ipcRenderer.invoke('workspace:ensure-claude-md'),
  },
  notifications: {
    getAll: () => ipcRenderer.invoke('notifications:get-all'),
    getUnreadCount: () => ipcRenderer.invoke('notifications:get-unread-count'),
    markRead: (id: string) => ipcRenderer.invoke('notifications:mark-read', id),
    markAllRead: () => ipcRenderer.invoke('notifications:mark-all-read'),
    clearAll: () => ipcRenderer.invoke('notifications:clear-all'),
    getSettings: () => ipcRenderer.invoke('notifications:get-settings'),
    setAppEnabled: (appId: string, enabled: boolean) => ipcRenderer.invoke('notifications:set-app-enabled', appId, enabled),
    onNew: (callback: (notif: any) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, notif: any) => callback(notif);
      ipcRenderer.on('notification:new', listener);
      return () => ipcRenderer.removeListener('notification:new', listener);
    },
  },
  git: {
    getInfo: (projectPath: string) => ipcRenderer.invoke('git:get-info', projectPath),
    setRemote: (projectPath: string, url: string) => ipcRenderer.invoke('git:set-remote', projectPath, url),
    push: (projectPath: string) => ipcRenderer.invoke('git:push', projectPath),
    pull: (projectPath: string) => ipcRenderer.invoke('git:pull', projectPath),
    commitAll: (projectPath: string, message: string) => ipcRenderer.invoke('git:commit-all', projectPath, message),
  },
  mcp: {
    getConfig: (projectPath: string) => ipcRenderer.invoke('mcp:get-config', projectPath),
    saveConfig: (projectPath: string, config: any) => ipcRenderer.invoke('mcp:save-config', projectPath, config),
    addServer: (projectPath: string, name: string, config: any) => ipcRenderer.invoke('mcp:add-server', projectPath, name, config),
    removeServer: (projectPath: string, name: string) => ipcRenderer.invoke('mcp:remove-server', projectPath, name),
    listProjects: () => ipcRenderer.invoke('mcp:list-projects'),
    checkInstalled: () => ipcRenderer.invoke('mcp:check-installed'),
  },
  system: {
    checkClaudeCode: () => ipcRenderer.invoke('system:check-claude-code'),
  },
  settings: {
    getEnabledApps: () => ipcRenderer.invoke('settings:get-enabled-apps'),
    save: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  },
  dialog: {
    openDirectory(): Promise<string | null> {
      return ipcRenderer.invoke('dialog:open-directory');
    },
  },
  terminal: {
    create(options?: { cwd?: string }): Promise<string | null> {
      return ipcRenderer.invoke('terminal:create', options);
    },
    write(id: string, data: string): Promise<void> {
      return ipcRenderer.invoke('terminal:write', id, data);
    },
    resize(id: string, cols: number, rows: number): Promise<void> {
      return ipcRenderer.invoke('terminal:resize', id, cols, rows);
    },
    destroy(id: string): Promise<void> {
      return ipcRenderer.invoke('terminal:destroy', id);
    },
    onData(callback: (data: { id: string; data: string }) => void): () => void {
      const listener = (_event: Electron.IpcRendererEvent, data: { id: string; data: string }) => callback(data);
      ipcRenderer.on('terminal:data', listener);
      return () => ipcRenderer.removeListener('terminal:data', listener);
    },
    onExit(callback: (data: { id: string; exitCode: number }) => void): () => void {
      const listener = (_event: Electron.IpcRendererEvent, data: { id: string; exitCode: number }) => callback(data);
      ipcRenderer.on('terminal:exit', listener);
      return () => ipcRenderer.removeListener('terminal:exit', listener);
    },
  },
};

contextBridge.exposeInMainWorld('pmOs', api);

export type PmOsApi = typeof api;
