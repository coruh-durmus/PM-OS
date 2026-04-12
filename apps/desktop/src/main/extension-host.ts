import path from 'node:path';
import fs from 'node:fs';
import type {
  ExtensionManifest,
  Extension,
  ExtensionContext,
  StateStorage,
} from '@pm-os/types';

export class ExtensionHost {
  private extensions = new Map<
    string,
    { manifest: ExtensionManifest; instance: Extension; context: ExtensionContext }
  >();
  private extensionsDir: string;

  constructor(extensionsDir?: string) {
    this.extensionsDir =
      extensionsDir ??
      path.join(__dirname, '..', '..', '..', '..', 'extensions');
  }

  async loadAll(): Promise<void> {
    if (!fs.existsSync(this.extensionsDir)) {
      console.log(
        `[ExtensionHost] No extensions directory at ${this.extensionsDir}`
      );
      return;
    }

    const entries = fs.readdirSync(this.extensionsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(
        this.extensionsDir,
        entry.name,
        'package.json'
      );
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const pkg = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const manifest: ExtensionManifest = {
          id: pkg.name,
          name: pkg.displayName ?? pkg.name,
          version: pkg.version,
          description: pkg.description ?? '',
          main: pkg.main ?? './dist/index.js',
          contributes: pkg.contributes,
        };

        const mainPath = path.join(
          this.extensionsDir,
          entry.name,
          manifest.main
        );
        if (!fs.existsSync(mainPath)) {
          console.log(
            `[ExtensionHost] Skipping ${manifest.id}: main not found at ${mainPath}`
          );
          continue;
        }

        const mod = require(mainPath);
        const instance: Extension = mod.default ?? mod;

        if (typeof instance.activate !== 'function') {
          console.log(
            `[ExtensionHost] Skipping ${manifest.id}: no activate() export`
          );
          continue;
        }

        const context = this.createContext(manifest, entry.name);
        await instance.activate(context);
        this.extensions.set(manifest.id, { manifest, instance, context });
        console.log(`[ExtensionHost] Activated: ${manifest.id}`);
      } catch (err) {
        console.error(`[ExtensionHost] Failed to load ${entry.name}:`, err);
      }
    }

    console.log(
      `[ExtensionHost] ${this.extensions.size} extension(s) activated`
    );
  }

  private createContext(
    manifest: ExtensionManifest,
    dirName: string
  ): ExtensionContext {
    const stateMap = new Map<string, unknown>();
    const storage: StateStorage = {
      get: <T>(key: string) => stateMap.get(key) as T | undefined,
      set: async <T>(key: string, value: T) => {
        stateMap.set(key, value);
      },
      delete: async (key: string) => {
        stateMap.delete(key);
      },
    };

    return {
      extensionId: manifest.id,
      extensionPath: path.join(this.extensionsDir, dirName),
      subscriptions: [],
      globalState: storage,
      workspaceState: storage,
    };
  }

  async deactivateAll(): Promise<void> {
    for (const [id, ext] of this.extensions) {
      try {
        await ext.instance.deactivate?.();
        for (const sub of ext.context.subscriptions) sub.dispose();
        console.log(`[ExtensionHost] Deactivated: ${id}`);
      } catch (err) {
        console.error(`[ExtensionHost] Error deactivating ${id}:`, err);
      }
    }
    this.extensions.clear();
  }

  getManifests(): ExtensionManifest[] {
    return Array.from(this.extensions.values()).map((e) => e.manifest);
  }
}
