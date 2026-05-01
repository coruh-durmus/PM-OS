export * from './types';
export * as commands from './commands';
export * as window from './window';
export * as workspace from './workspace';

// Extensions namespace
const extensionRegistry = new Map<string, any>();

export const extensions = {
  getExtension(id: string): any | undefined {
    return extensionRegistry.get(id);
  },
  get all(): any[] {
    return Array.from(extensionRegistry.values());
  },
  _register(id: string, ext: any): void {
    extensionRegistry.set(id, ext);
  },
};

// Languages namespace
// Diagnostics aggregator: collectionName → uri → diagnostics[].
// Severity numbers follow the VS Code DiagnosticSeverity enum:
// Error=0, Warning=1, Information=2, Hint=3.
const allDiagnostics = new Map<string, Map<string, any[]>>();

function recomputeAndPushDiagnostics(): void {
  let errors = 0;
  let warnings = 0;
  for (const byUri of allDiagnostics.values()) {
    for (const diags of byUri.values()) {
      for (const d of diags) {
        if (d?.severity === 0) errors++;
        else if (d?.severity === 1) warnings++;
      }
    }
  }
  try {
    const { getMainWebContents } = require('./window');
    getMainWebContents()?.send('diagnostics:counts', { errors, warnings });
  } catch {}
}

export const languages = {
  registerHoverProvider(_selector: any, _provider: any) { return new (require('./types').Disposable)(() => {}); },
  registerCompletionItemProvider(_selector: any, _provider: any, ..._triggerChars: string[]) { return new (require('./types').Disposable)(() => {}); },
  registerDefinitionProvider(_selector: any, _provider: any) { return new (require('./types').Disposable)(() => {}); },
  registerCodeActionsProvider(_selector: any, _provider: any) { return new (require('./types').Disposable)(() => {}); },
  registerDocumentFormattingEditProvider(_selector: any, _provider: any) { return new (require('./types').Disposable)(() => {}); },
  createDiagnosticCollection(name?: string) {
    const collectionName = name ?? `__diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!allDiagnostics.has(collectionName)) allDiagnostics.set(collectionName, new Map());
    const items = allDiagnostics.get(collectionName)!;
    return {
      name: collectionName,
      set(uri: any, diags: any) {
        items.set(uri?.toString?.() ?? String(uri), Array.isArray(diags) ? diags : (diags ? [diags] : []));
        recomputeAndPushDiagnostics();
      },
      delete(uri: any) {
        items.delete(uri?.toString?.() ?? String(uri));
        recomputeAndPushDiagnostics();
      },
      clear() {
        items.clear();
        recomputeAndPushDiagnostics();
      },
      dispose() {
        allDiagnostics.delete(collectionName);
        recomputeAndPushDiagnostics();
      },
    };
  },
  getDiagnostics() {
    const out: any[] = [];
    for (const byUri of allDiagnostics.values()) {
      for (const [uri, diags] of byUri) out.push([uri, diags]);
    }
    return out;
  },
  getLanguages() { return Promise.resolve([]); },
  setTextDocumentLanguage(_doc: any, _lang: string) { return Promise.resolve(_doc); },
};

// Env namespace
export const env = {
  appName: 'PMOS',
  appRoot: process.cwd(),
  language: 'en',
  machineId: 'pmos-' + Date.now(),
  sessionId: 'session-' + Date.now(),
  uriScheme: 'pmos',
  clipboard: {
    readText() { return Promise.resolve(''); },
    writeText(_value: string) { return Promise.resolve(); },
  },
  openExternal(uri: any) { return Promise.resolve(true); },
};

// Version
export const version = '1.85.0';
