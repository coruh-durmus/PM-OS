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

// Languages namespace (stub)
export const languages = {
  registerHoverProvider(_selector: any, _provider: any) { return new (require('./types').Disposable)(() => {}); },
  registerCompletionItemProvider(_selector: any, _provider: any, ..._triggerChars: string[]) { return new (require('./types').Disposable)(() => {}); },
  registerDefinitionProvider(_selector: any, _provider: any) { return new (require('./types').Disposable)(() => {}); },
  registerCodeActionsProvider(_selector: any, _provider: any) { return new (require('./types').Disposable)(() => {}); },
  registerDocumentFormattingEditProvider(_selector: any, _provider: any) { return new (require('./types').Disposable)(() => {}); },
  createDiagnosticCollection(_name?: string) {
    const items = new Map();
    return { name: _name, set(uri: any, diags: any) { items.set(uri.toString(), diags); }, delete(uri: any) { items.delete(uri.toString()); }, clear() { items.clear(); }, dispose() { items.clear(); } };
  },
  getDiagnostics() { return []; },
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
