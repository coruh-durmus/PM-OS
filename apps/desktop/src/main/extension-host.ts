import path from 'node:path';
import fs from 'node:fs';
import type {
  ExtensionManifest,
  Extension,
  ExtensionContext,
  StateStorage,
} from '@pm-os/types';

// Hook require('vscode') to return our shim
const Module = require('module');
const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (
  request: string,
  parent: any,
  ...args: any[]
) {
  if (request === 'vscode') {
    return require.resolve('./vscode-shim/index');
  }
  return originalResolveFilename.call(this, request, parent, ...args);
};

function safeLog(...args: unknown[]): void {
  try { console.log(...args); } catch {}
}
function safeError(...args: unknown[]): void {
  try { console.error(...args); } catch {}
}

export class ExtensionHost {
  private extensions = new Map<
    string,
    { manifest: ExtensionManifest; instance: Extension; context: ExtensionContext }
  >();
  private extensionsDir: string;
  private extensionThemes: any[] = [];
  private extensionConfigs: any[] = [];

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

    // Load installed extensions from user directory
    const { app } = require('electron');
    const userExtDir = path.join(app.getPath('userData'), 'extensions');
    if (fs.existsSync(userExtDir)) {
      const installedDirs = fs.readdirSync(userExtDir, { withFileTypes: true });
      for (const dir of installedDirs) {
        if (!dir.isDirectory()) continue;
        const extPath = path.join(userExtDir, dir.name);
        // VSIX extracts with extension/ subdirectory
        const manifestPaths = [
          path.join(extPath, 'extension', 'package.json'),
          path.join(extPath, 'package.json'),
        ];
        let manifest: any = null;
        let manifestDir = extPath;
        for (const mp of manifestPaths) {
          try {
            if (fs.existsSync(mp)) {
              manifest = JSON.parse(fs.readFileSync(mp, 'utf-8'));
              manifestDir = path.dirname(mp);
              break;
            }
          } catch {}
        }
        if (!manifest) {
          safeLog(`[ext-host] Skipping ${dir.name} — no package.json found`);
          continue;
        }

        const id = manifest.name || dir.name;
        const mainEntry = manifest.main || './dist/index.js';
        const mainPath = path.resolve(manifestDir, mainEntry);

        if (!fs.existsSync(mainPath)) {
          safeLog(`[ext-host] Skipping ${id} — main entry not found: ${mainPath}`);
          // Still register for contributes parsing (themes, snippets don't need main)
          this.processContributes(manifest, manifestDir);
          continue;
        }

        try {
          const instance = require(mainPath);
          const ext = instance.default || instance;
          if (typeof ext.activate === 'function') {
            const context = this.createContext(
              {
                id,
                name: manifest.displayName ?? manifest.name ?? dir.name,
                version: manifest.version ?? '0.0.0',
                description: manifest.description ?? '',
                main: mainEntry,
                contributes: manifest.contributes,
              },
              dir.name
            );
            await ext.activate(context);
            this.extensions.set(id, {
              instance: ext,
              context,
              manifest: {
                id,
                name: manifest.displayName ?? manifest.name ?? dir.name,
                version: manifest.version ?? '0.0.0',
                description: manifest.description ?? '',
                main: mainEntry,
                contributes: manifest.contributes,
              },
            });
            safeLog(`[ext-host] Activated installed extension: ${id}`);
          }
          this.processContributes(manifest, manifestDir);
        } catch (err) {
          safeError(`[ext-host] Failed to activate ${id}:`, err);
          // Still try contributes even if activation fails
          this.processContributes(manifest, manifestDir);
        }
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

  private processContributes(manifest: any, extensionPath: string): void {
    if (!manifest.contributes) return;

    // Register commands declared by the extension
    if (manifest.contributes.commands) {
      const { declareCommand } = require('./vscode-shim/commands');
      for (const cmd of manifest.contributes.commands) {
        if (cmd.command && cmd.title) {
          declareCommand(cmd.command, cmd.title, cmd.category);
          safeLog(`[ext-host] Registered command: ${cmd.command}`);
        }
      }
    }

    // Parse and register theme contributions
    if (manifest.contributes.themes) {
      for (const themeContrib of manifest.contributes.themes) {
        try {
          const themePath = path.join(extensionPath, themeContrib.path);
          if (fs.existsSync(themePath)) {
            const themeJson = JSON.parse(fs.readFileSync(themePath, 'utf-8'));
            const colors = themeJson.colors || {};

            // Map VS Code color keys to PMOS CSS variables
            const mappedColors: Record<string, string> = {};
            const map: Record<string, string> = {
              'editor.background': '--bg-primary',
              'sideBar.background': '--bg-secondary',
              'editor.selectionBackground': '--bg-surface',
              'list.hoverBackground': '--bg-hover',
              'editor.foreground': '--text-primary',
              'descriptionForeground': '--text-secondary',
              'disabledForeground': '--text-muted',
              'button.background': '--accent',
              'button.hoverBackground': '--accent-hover',
              'panel.border': '--border',
              'terminal.ansiGreen': '--success',
              'terminal.ansiYellow': '--warning',
              'terminal.ansiRed': '--error',
              // Additional fallbacks
              'activityBar.background': '--bg-secondary',
              'editorGroupHeader.tabsBackground': '--bg-secondary',
              'tab.inactiveBackground': '--bg-secondary',
              'input.background': '--bg-surface',
              'dropdown.background': '--bg-surface',
              'editorWidget.background': '--bg-surface',
              'list.activeSelectionBackground': '--bg-hover',
              'foreground': '--text-primary',
              'editor.lineHighlightBackground': '--bg-hover',
              'focusBorder': '--accent',
              'editorCursor.foreground': '--accent',
              'tab.activeBorder': '--accent',
              'panelTitle.activeBorder': '--accent',
              'contrastBorder': '--border',
              'widget.border': '--border',
              'editorGroup.border': '--border',
              'sideBar.border': '--border',
              'titleBar.activeBackground': '--bg-secondary',
              'titleBar.activeForeground': '--text-primary',
              'statusBar.background': '--bg-secondary',
              'statusBar.foreground': '--text-muted',
            };

            // First pass: direct mappings
            for (const [vsKey, cssVar] of Object.entries(map)) {
              if (colors[vsKey] && !mappedColors[cssVar]) {
                mappedColors[cssVar] = colors[vsKey];
              }
            }

            // Ensure all 13 CSS vars have values (fallback to sensible defaults from the theme)
            if (!mappedColors['--bg-primary'] && colors['editor.background']) mappedColors['--bg-primary'] = colors['editor.background'];
            if (!mappedColors['--text-primary'] && colors['foreground']) mappedColors['--text-primary'] = colors['foreground'];

            const themeType = (themeContrib.uiTheme === 'vs') ? 'light' : 'dark';
            const themeId = `ext-${manifest.name || 'unknown'}-${(themeContrib.label || 'theme').toLowerCase().replace(/\s+/g, '-')}`;

            const themeData = {
              id: themeId,
              name: themeContrib.label || themeJson.name || 'Extension Theme',
              type: themeType,
              colors: mappedColors,
              source: 'extension',
            };

            // Store for IPC retrieval
            this.extensionThemes.push(themeData);

            safeLog(`[ext-host] Registered theme: ${themeData.name} (${themeId})`);
          }
        } catch (err) {
          safeError(`[ext-host] Failed to load theme:`, err);
        }
      }
    }
    if (manifest.contributes.configuration) {
      const configs = Array.isArray(manifest.contributes.configuration)
        ? manifest.contributes.configuration
        : [manifest.contributes.configuration];

      for (const config of configs) {
        if (config.properties) {
          this.extensionConfigs.push({
            extensionId: manifest.name || 'unknown',
            extensionName: manifest.displayName || manifest.name || 'Unknown Extension',
            title: config.title || manifest.displayName || manifest.name,
            properties: config.properties,
          });
          safeLog(`[ext-host] Registered ${Object.keys(config.properties).length} settings from ${manifest.name}`);
        }
      }
    }

    if (manifest.contributes.snippets) {
      safeLog(
        `[ext-host] Extension contributes ${manifest.contributes.snippets.length} snippet(s)`
      );
    }
    if (manifest.contributes.languages) {
      safeLog(
        `[ext-host] Extension contributes ${manifest.contributes.languages.length} language(s)`
      );
    }
  }

  async loadSingleExtension(extPath: string): Promise<{ success: boolean; id?: string; error?: string }> {
    const manifestPaths = [
      path.join(extPath, 'extension', 'package.json'),
      path.join(extPath, 'package.json'),
    ];

    let manifest: any = null;
    let manifestDir = extPath;
    for (const mp of manifestPaths) {
      try {
        if (fs.existsSync(mp)) {
          manifest = JSON.parse(fs.readFileSync(mp, 'utf-8'));
          manifestDir = path.dirname(mp);
          break;
        }
      } catch {}
    }

    if (!manifest) {
      return { success: false, error: 'No package.json found' };
    }

    const id = manifest.name || path.basename(extPath);

    // Skip if already loaded
    if (this.extensions.has(id)) {
      safeLog(`[ext-host] Extension ${id} already loaded`);
      return { success: true, id };
    }

    const mainEntry = manifest.main || './dist/index.js';
    const mainPath = path.resolve(manifestDir, mainEntry);

    // Try to activate
    if (fs.existsSync(mainPath)) {
      try {
        const instance = require(mainPath);
        const ext = instance.default || instance;
        if (typeof ext.activate === 'function') {
          const context = this.createContext(
            {
              id,
              name: manifest.displayName ?? manifest.name ?? path.basename(extPath),
              version: manifest.version ?? '0.0.0',
              description: manifest.description ?? '',
              main: mainEntry,
              contributes: manifest.contributes,
            },
            path.basename(extPath)
          );
          await ext.activate(context);
          this.extensions.set(id, {
            instance: ext,
            context,
            manifest: {
              id,
              name: manifest.displayName ?? manifest.name ?? path.basename(extPath),
              version: manifest.version ?? '0.0.0',
              description: manifest.description ?? '',
              main: mainEntry,
              contributes: manifest.contributes,
            },
          });
          safeLog(`[ext-host] Hot-activated extension: ${id}`);
        }
      } catch (err) {
        safeError(`[ext-host] Failed to hot-activate ${id}:`, err);
      }
    }

    // Always process contributes (themes, commands, settings work without activation)
    this.processContributes(manifest, manifestDir);

    safeLog(`[ext-host] Hot-loaded extension: ${id}`);
    return { success: true, id };
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

  getExtensionThemes(): any[] {
    return this.extensionThemes;
  }

  getExtensionConfigs(): any[] {
    return this.extensionConfigs;
  }
}
