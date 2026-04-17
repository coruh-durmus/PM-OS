import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';

const OPEN_VSX_API = 'https://open-vsx.org/api';
const EXTENSIONS_DIR = path.join(app.getPath('userData'), 'extensions');
const INSTALLED_FILE = path.join(app.getPath('userData'), 'installed-extensions.json');

interface SearchResult {
  offset: number;
  totalSize: number;
  extensions: ExtensionInfo[];
}

interface ExtensionInfo {
  name: string;
  namespace: string;
  displayName: string;
  description: string;
  version: string;
  iconUrl: string | null;
  downloadCount: number;
  averageRating: number | null;
  downloadUrl: string | null;
  categories: string[];
}

interface InstalledExtension {
  id: string;
  name: string;
  namespace: string;
  displayName: string;
  description: string;
  version: string;
  installedAt: string;
  extensionPath: string;
}

function safeLog(...args: unknown[]): void { try { console.log(...args); } catch {} }
function safeError(...args: unknown[]): void { try { console.error(...args); } catch {} }

export class ExtensionStoreManager {
  private progressCallback?: (data: any) => void;

  setProgressCallback(cb: (data: any) => void): void {
    this.progressCallback = cb;
  }

  async search(query: string, category?: string, offset: number = 0, size: number = 20): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (category && category !== 'All') params.set('category', category);
    params.set('size', String(size));
    params.set('offset', String(offset));
    params.set('sortBy', 'relevance');
    params.set('sortOrder', 'desc');

    const url = `${OPEN_VSX_API}/-/search?${params.toString()}`;
    const data = await this.fetchJson(url);

    return {
      offset: data.offset || 0,
      totalSize: data.totalSize || 0,
      extensions: (data.extensions || []).map((ext: any) => this.mapExtension(ext)),
    };
  }

  async getExtension(namespace: string, name: string): Promise<ExtensionInfo | null> {
    try {
      const data = await this.fetchJson(`${OPEN_VSX_API}/${namespace}/${name}`);
      return this.mapExtension(data);
    } catch {
      return null;
    }
  }

  async install(namespace: string, name: string, version: string): Promise<void> {
    const id = `${namespace}.${name}`;
    const debugLog = (msg: string) => {
      safeLog(msg);
      try { fs.appendFileSync('/tmp/pmos-install-debug.log', msg + '\n'); } catch {}
    };
    debugLog(`[store] === INSTALL START === ${new Date().toISOString()}`);
    debugLog(`[store] Installing ${id}@${version}`);
    debugLog(`[store] EXTENSIONS_DIR=${EXTENSIONS_DIR}`);
    debugLog(`[store] namespace=${namespace}, name=${name}, version=${version}`);

    // Ensure extensions directory exists
    if (!fs.existsSync(EXTENSIONS_DIR)) {
      fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
    }

    const extDir = path.join(EXTENSIONS_DIR, id);
    const vsixPath = path.join(EXTENSIONS_DIR, `${id}.vsix`);

    try {
      // 1. Get download URL
      this.sendProgress({ id, stage: 'downloading', percent: 0 });
      const detailUrl = `${OPEN_VSX_API}/${namespace}/${name}/${version}`;
      debugLog(`[store] Fetching details from: ${detailUrl}`);
      const details = await this.fetchJson(detailUrl);
      const downloadUrl = details.files?.download;
      debugLog(`[store] Download URL: ${downloadUrl || 'NONE'}`);
      if (!downloadUrl) throw new Error('No download URL found');

      // 2. Download VSIX
      await this.downloadFile(downloadUrl, vsixPath, (percent) => {
        this.sendProgress({ id, stage: 'downloading', percent });
      });

      // 3. Extract VSIX (ZIP format)
      this.sendProgress({ id, stage: 'extracting', percent: 75 });
      const vsixStat = fs.statSync(vsixPath);
      debugLog(`[store] VSIX downloaded: ${vsixPath} (${vsixStat.size} bytes)`);
      await this.extractVsix(vsixPath, extDir);
      debugLog(`[store] VSIX extracted to: ${extDir}`);

      // 4. Clean up VSIX file
      try { fs.unlinkSync(vsixPath); } catch {}

      // 5. Register as installed
      this.sendProgress({ id, stage: 'registering', percent: 90 });
      const installed = this.getInstalled();
      const manifest = this.readManifest(extDir);
      // Find icon file from the extracted extension
      let iconPath: string | null = null;
      if (manifest?.icon) {
        const tryPaths = [
          path.join(extDir, 'extension', manifest.icon),
          path.join(extDir, manifest.icon),
        ];
        for (const ip of tryPaths) {
          if (fs.existsSync(ip)) { iconPath = ip; break; }
        }
      }

      installed.push({
        id,
        name,
        namespace,
        displayName: manifest?.displayName || name,
        description: manifest?.description || '',
        version,
        installedAt: new Date().toISOString(),
        extensionPath: extDir,
        iconPath: iconPath,
      });
      fs.writeFileSync(INSTALLED_FILE, JSON.stringify(installed, null, 2));

      this.sendProgress({ id, stage: 'complete', percent: 100 });
      safeLog(`[store] Installed ${id}@${version} to ${extDir}`);
    } catch (err) {
      debugLog(`[store] === INSTALL FAILED for ${id} ===`);
      debugLog(`[store] Error: ${err instanceof Error ? err.stack : String(err)}`);
      safeError(`[store] Install failed for ${id}:`, err);
      // Cleanup on failure
      try { fs.rmSync(extDir, { recursive: true, force: true }); } catch {}
      try { fs.unlinkSync(vsixPath); } catch {}
      this.sendProgress({ id, stage: 'error', percent: 0, error: String(err) });
      throw err;
    }
  }

  async uninstall(id: string): Promise<void> {
    safeLog(`[store] Uninstalling ${id}`);
    const extDir = path.join(EXTENSIONS_DIR, id);
    try { fs.rmSync(extDir, { recursive: true, force: true }); } catch {}

    const installed = this.getInstalled().filter(e => e.id !== id);
    fs.writeFileSync(INSTALLED_FILE, JSON.stringify(installed, null, 2));
    safeLog(`[store] Uninstalled ${id}`);
  }

  getInstalled(): InstalledExtension[] {
    try {
      if (fs.existsSync(INSTALLED_FILE)) {
        return JSON.parse(fs.readFileSync(INSTALLED_FILE, 'utf-8'));
      }
    } catch {}
    return [];
  }

  getInstalledPaths(): string[] {
    return this.getInstalled().map(e => e.extensionPath).filter(p => fs.existsSync(p));
  }

  async checkUpdates(): Promise<{ id: string; currentVersion: string; latestVersion: string; displayName: string }[]> {
    const installed = this.getInstalled();
    const updates: { id: string; currentVersion: string; latestVersion: string; displayName: string }[] = [];

    for (const ext of installed) {
      try {
        const latest = await this.fetchJson(`${OPEN_VSX_API}/${ext.namespace}/${ext.name}`);
        const latestVersion = latest.version || latest.latestVersion;
        if (latestVersion && latestVersion !== ext.version) {
          updates.push({
            id: ext.id,
            currentVersion: ext.version,
            latestVersion,
            displayName: ext.displayName || ext.name,
          });
        }
      } catch {}
    }

    return updates;
  }

  async updateExtension(namespace: string, name: string, version: string): Promise<void> {
    const id = `${namespace}.${name}`;
    await this.uninstall(id);
    await this.install(namespace, name, version);
  }

  private mapExtension(data: any): ExtensionInfo {
    return {
      name: data.name || '',
      namespace: data.namespace?.name || data.namespace || '',
      displayName: data.displayName || data.name || '',
      description: data.description || '',
      version: data.version || data.latestVersion || '',
      iconUrl: data.files?.icon || data.iconUrl || null,
      downloadCount: data.downloadCount || 0,
      averageRating: data.averageRating ?? null,
      downloadUrl: data.files?.download || null,
      categories: data.categories || [],
    };
  }

  private readManifest(extDir: string): any {
    // VSIX extracts with an 'extension/' subdirectory
    const paths = [
      path.join(extDir, 'extension', 'package.json'),
      path.join(extDir, 'package.json'),
    ];
    for (const p of paths) {
      try {
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
      } catch {}
    }
    return null;
  }

  private async extractVsix(vsixPath: string, targetDir: string): Promise<void> {
    const { execSync } = require('child_process');
    if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
    // VSIX is a ZIP file — use unzip
    execSync(`unzip -o -q "${vsixPath}" -d "${targetDir}"`, { stdio: 'pipe' });
  }

  private sendProgress(data: any): void {
    this.progressCallback?.(data);
  }

  private fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          this.fetchJson(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`Failed to parse response from ${url}`)); }
        });
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  private downloadFile(url: string, dest: string, onProgress?: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          this.downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
          return;
        }
        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let receivedBytes = 0;
        const file = fs.createWriteStream(dest);

        if (onProgress && totalBytes > 0) {
          res.on('data', (chunk) => {
            receivedBytes += chunk.length;
            onProgress(Math.round((receivedBytes / totalBytes) * 70));
          });
        }

        // Use pipe for proper backpressure handling — prevents truncated files
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', (err) => { file.close(); reject(err); });
      }).on('error', reject);
    });
  }
}
