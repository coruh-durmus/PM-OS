import { BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface WorkspaceConfig {
  folders: string[];
  name?: string;
}

export class WorkspaceManager {
  private window: BrowserWindow | null = null;
  private config: WorkspaceConfig = { folders: [] };
  private workspaceFile: string | null = null; // .pmos-workspace file path
  private recentWorkspaces: string[] = [];
  private recentFile: string;

  constructor() {
    this.recentFile = path.join(os.homedir(), '.pm-os', 'recent-workspaces.json');
    this.loadRecent();
  }

  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  isOpen(): boolean {
    return this.config.folders.length > 0;
  }

  getFolders(): string[] {
    return this.config.folders;
  }

  getName(): string {
    if (this.config.name) return this.config.name;
    if (this.config.folders.length === 1) return path.basename(this.config.folders[0]);
    return 'Workspace';
  }

  getWorkspaceFile(): string | null {
    return this.workspaceFile;
  }

  getRecent(): string[] {
    return this.recentWorkspaces;
  }

  async openFolder(): Promise<boolean> {
    if (!this.window) return false;
    const result = await dialog.showOpenDialog(this.window, {
      properties: ['openDirectory'],
      title: 'Open Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return false;

    this.config = { folders: [result.filePaths[0]] };
    this.workspaceFile = null;
    this.addToRecent(result.filePaths[0]);
    this.notifyRenderer();
    return true;
  }

  async addFolderToWorkspace(): Promise<boolean> {
    if (!this.window) return false;
    const result = await dialog.showOpenDialog(this.window, {
      properties: ['openDirectory'],
      title: 'Add Folder to Workspace',
    });
    if (result.canceled || result.filePaths.length === 0) return false;

    const folder = result.filePaths[0];
    if (!this.config.folders.includes(folder)) {
      this.config.folders.push(folder);
    }
    this.notifyRenderer();
    return true;
  }

  removeFolderFromWorkspace(folderPath: string): void {
    this.config.folders = this.config.folders.filter(f => f !== folderPath);
    this.notifyRenderer();
  }

  async openWorkspaceFromFile(): Promise<boolean> {
    if (!this.window) return false;
    const result = await dialog.showOpenDialog(this.window, {
      properties: ['openFile'],
      title: 'Open Workspace',
      filters: [{ name: 'PM-OS Workspace', extensions: ['pmos-workspace'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return false;

    return this.loadWorkspaceFile(result.filePaths[0]);
  }

  loadWorkspaceFile(filePath: string): boolean {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      this.config = {
        folders: (data.folders || []).map((f: any) => {
          // Resolve relative paths against workspace file location
          const p = typeof f === 'string' ? f : f.path;
          return path.isAbsolute(p) ? p : path.resolve(path.dirname(filePath), p);
        }),
        name: data.name,
      };
      this.workspaceFile = filePath;
      this.addToRecent(filePath);
      this.notifyRenderer();
      return true;
    } catch {
      return false;
    }
  }

  async saveWorkspaceAs(): Promise<boolean> {
    if (!this.window) return false;
    const result = await dialog.showSaveDialog(this.window, {
      title: 'Save Workspace As',
      filters: [{ name: 'PM-OS Workspace', extensions: ['pmos-workspace'] }],
      defaultPath: this.getName() + '.pmos-workspace',
    });
    if (result.canceled || !result.filePath) return false;

    const data = {
      name: this.config.name || this.getName(),
      folders: this.config.folders.map(f => ({ path: f })),
    };
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
    this.workspaceFile = result.filePath;
    this.addToRecent(result.filePath);
    return true;
  }

  openFolderDirect(folderPath: string): void {
    this.config = { folders: [folderPath] };
    this.workspaceFile = null;
    this.addToRecent(folderPath);
    this.notifyRenderer();
  }

  closeWorkspace(): void {
    this.config = { folders: [] };
    this.workspaceFile = null;
    this.notifyRenderer();
  }

  private addToRecent(pathOrFile: string): void {
    this.recentWorkspaces = [pathOrFile, ...this.recentWorkspaces.filter(r => r !== pathOrFile)].slice(0, 10);
    this.saveRecent();
  }

  private loadRecent(): void {
    try {
      if (fs.existsSync(this.recentFile)) {
        this.recentWorkspaces = JSON.parse(fs.readFileSync(this.recentFile, 'utf-8'));
      }
    } catch {
      this.recentWorkspaces = [];
    }
  }

  private saveRecent(): void {
    const dir = path.dirname(this.recentFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.recentFile, JSON.stringify(this.recentWorkspaces));
  }

  private notifyRenderer(): void {
    this.window?.webContents.send('workspace:changed', {
      folders: this.config.folders,
      name: this.getName(),
      isOpen: this.isOpen(),
    });
  }
}
