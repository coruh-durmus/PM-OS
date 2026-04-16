import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type {
  ExtensionRegistry,
  ExtensionRegistryEntry,
  ExtensionInstallProgress,
  InstalledExtensionState,
} from '@pm-os/types';

function safeLog(...args: unknown[]): void {
  try { console.log(...args); } catch {}
}
function safeError(...args: unknown[]): void {
  try { console.error(...args); } catch {}
}

export class ExtensionStoreManager {
  private stateFilePath: string;
  private installedState: Map<string, InstalledExtensionState> = new Map();
  private window: Electron.BrowserWindow | null = null;

  constructor() {
    this.stateFilePath = path.join(app.getPath('userData'), 'extension-store.json');
    this.loadState();
  }

  setWindow(win: Electron.BrowserWindow): void {
    this.window = win;
  }

  getRegistry(): { extensions: (ExtensionRegistryEntry & { installed: boolean; installedVersion?: string })[] } {
    const registry = this.readRegistry();
    const extensions = registry.extensions.map((ext) => {
      const state = this.installedState.get(ext.id);
      return {
        ...ext,
        installed: !!state,
        installedVersion: state?.version,
      };
    });
    return { extensions };
  }

  async installExtension(id: string, options?: { whisperModel?: string }): Promise<void> {
    const registry = this.readRegistry();
    const entry = registry.extensions.find((e) => e.id === id);
    if (!entry) {
      this.sendProgress({ extensionId: id, phase: 'error', error: `Extension "${id}" not found in registry` });
      return;
    }

    // Send downloading phase
    this.sendProgress({ extensionId: id, phase: 'downloading', percent: 0, currentItem: entry.name });

    const extensionsDir = path.join(app.getPath('userData'), 'extensions');
    const extDir = path.join(extensionsDir, id.replace(/\//g, '__'));

    try {
      // Create extension directory structure
      fs.mkdirSync(extDir, { recursive: true });

      // Simulate download progress
      this.sendProgress({ extensionId: id, phase: 'downloading', percent: 50, currentItem: entry.name });

      // Write a manifest for the installed extension
      const manifest = {
        id: entry.id,
        name: entry.name,
        version: entry.version,
        description: entry.description,
        author: entry.author,
        installedAt: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

      this.sendProgress({ extensionId: id, phase: 'extracting', percent: 75, currentItem: entry.name });

      // Handle variant selection (e.g., whisper model size)
      const selectedVariants: Record<string, string> = {};
      if (options?.whisperModel && entry.dependencies) {
        const whisperDep = entry.dependencies.find((d) => d.variants && d.variants.length > 0);
        if (whisperDep) {
          selectedVariants[whisperDep.id] = options.whisperModel;
        }
      }

      this.sendProgress({ extensionId: id, phase: 'installing-deps', percent: 90, currentItem: 'dependencies' });

      // Update installed state
      const state: InstalledExtensionState = {
        id: entry.id,
        version: entry.version,
        installedAt: new Date().toISOString(),
        selectedVariants: Object.keys(selectedVariants).length > 0 ? selectedVariants : undefined,
      };
      this.installedState.set(id, state);
      this.saveState();

      safeLog(`[extension-store] Installed ${id} v${entry.version}`);

      // Send complete
      this.sendProgress({ extensionId: id, phase: 'complete', percent: 100 });
      this.sendComplete({ extensionId: id, action: 'install' });
    } catch (err: any) {
      safeError(`[extension-store] Install failed for ${id}:`, err);
      this.sendProgress({ extensionId: id, phase: 'error', error: err.message });
    }
  }

  async uninstallExtension(id: string): Promise<void> {
    const extensionsDir = path.join(app.getPath('userData'), 'extensions');
    const extDir = path.join(extensionsDir, id.replace(/\//g, '__'));

    try {
      // Remove extension directory
      if (fs.existsSync(extDir)) {
        fs.rmSync(extDir, { recursive: true, force: true });
      }

      // Update installed state
      this.installedState.delete(id);
      this.saveState();

      safeLog(`[extension-store] Uninstalled ${id}`);

      this.sendComplete({ extensionId: id, action: 'uninstall' });
    } catch (err: any) {
      safeError(`[extension-store] Uninstall failed for ${id}:`, err);
    }
  }

  private readRegistry(): ExtensionRegistry {
    try {
      const registryPath = path.join(__dirname, '..', '..', 'src', 'main', 'extension-registry.json');
      // Try the dev path first, then the bundled path
      let rawPath = registryPath;
      if (!fs.existsSync(rawPath)) {
        rawPath = path.join(__dirname, 'extension-registry.json');
      }
      if (!fs.existsSync(rawPath)) {
        // Fallback: look relative to the app
        rawPath = path.join(app.getAppPath(), 'apps', 'desktop', 'src', 'main', 'extension-registry.json');
      }
      const raw = fs.readFileSync(rawPath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      safeError('[extension-store] Failed to read registry:', err);
      return { version: 1, extensions: [] };
    }
  }

  private loadState(): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
        const data = JSON.parse(raw) as InstalledExtensionState[];
        for (const entry of data) {
          this.installedState.set(entry.id, entry);
        }
        safeLog(`[extension-store] Loaded ${this.installedState.size} installed extension(s)`);
      }
    } catch (err) {
      safeError('[extension-store] Failed to load state:', err);
    }
  }

  private saveState(): void {
    try {
      const data = Array.from(this.installedState.values());
      fs.writeFileSync(this.stateFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      safeError('[extension-store] Failed to save state:', err);
    }
  }

  private sendProgress(progress: ExtensionInstallProgress): void {
    try {
      this.window?.webContents.send('extension-store:progress', progress);
    } catch {}
  }

  private sendComplete(data: { extensionId: string; action: string }): void {
    try {
      this.window?.webContents.send('extension-store:install-complete', data);
    } catch {}
  }
}
