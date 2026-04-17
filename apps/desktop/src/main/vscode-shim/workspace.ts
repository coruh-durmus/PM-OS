import { Disposable, EventEmitter, Uri, ConfigurationTarget } from './types';

let workspaceFolderPaths: string[] = [];

export function setWorkspaceFolders(paths: string[]): void {
  workspaceFolderPaths = paths;
}

export function getWorkspaceFolders(): { uri: Uri; name: string; index: number }[] | undefined {
  if (workspaceFolderPaths.length === 0) return undefined;
  return workspaceFolderPaths.map((p, i) => ({
    uri: Uri.file(p),
    name: p.split('/').pop() || p,
    index: i,
  }));
}

const configStore = new Map<string, any>();
const configChangeEmitter = new EventEmitter<{ affectsConfiguration(section: string): boolean }>();

export function getConfiguration(section?: string): any {
  return {
    get<T>(key: string, defaultValue?: T): T {
      const fullKey = section ? `${section}.${key}` : key;
      const val = configStore.get(fullKey);
      return val !== undefined ? val : (defaultValue as T);
    },
    has(key: string): boolean {
      const fullKey = section ? `${section}.${key}` : key;
      return configStore.has(fullKey);
    },
    update(key: string, value: any, target?: ConfigurationTarget): Promise<void> {
      const fullKey = section ? `${section}.${key}` : key;
      configStore.set(fullKey, value);
      configChangeEmitter.fire({ affectsConfiguration: (s: string) => fullKey.startsWith(s) });
      return Promise.resolve();
    },
    inspect(key: string): any {
      const fullKey = section ? `${section}.${key}` : key;
      return { key: fullKey, globalValue: configStore.get(fullKey) };
    },
  };
}

export const onDidChangeConfiguration = configChangeEmitter.event;
export const onDidChangeWorkspaceFolders = new EventEmitter<any>().event;
export const onDidOpenTextDocument = new EventEmitter<any>().event;
export const onDidCloseTextDocument = new EventEmitter<any>().event;
export const onDidSaveTextDocument = new EventEmitter<any>().event;

export const fs = {
  readFile(uri: Uri): Promise<Uint8Array> {
    const nodeFs = require('fs');
    return Promise.resolve(nodeFs.readFileSync(uri.fsPath));
  },
  writeFile(uri: Uri, content: Uint8Array): Promise<void> {
    const nodeFs = require('fs');
    nodeFs.writeFileSync(uri.fsPath, content);
    return Promise.resolve();
  },
  stat(uri: Uri): Promise<{ type: number; size: number; ctime: number; mtime: number }> {
    const nodeFs = require('fs');
    const s = nodeFs.statSync(uri.fsPath);
    return Promise.resolve({ type: s.isDirectory() ? 2 : 1, size: s.size, ctime: s.ctimeMs, mtime: s.mtimeMs });
  },
};

export const textDocuments: any[] = [];
export const name: string | undefined = undefined;
export const rootPath: string | undefined = undefined;
