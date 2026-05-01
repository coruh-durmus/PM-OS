import { Disposable, StatusBarAlignment, EventEmitter } from './types';

let mainWebContents: any = null;

export function setMainWebContents(wc: any): void {
  mainWebContents = wc;
}

export function getMainWebContents(): any {
  return mainWebContents;
}

// Message functions — log to console for now, IPC integration added later
export function showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
  console.log(`[ext:info] ${message}`);
  return Promise.resolve(items.length > 0 ? items[0] : undefined);
}

export function showWarningMessage(message: string, ...items: string[]): Promise<string | undefined> {
  console.warn(`[ext:warn] ${message}`);
  return Promise.resolve(items.length > 0 ? items[0] : undefined);
}

export function showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
  console.error(`[ext:error] ${message}`);
  return Promise.resolve(items.length > 0 ? items[0] : undefined);
}

export function showQuickPick(items: any[], options?: any): Promise<any | undefined> {
  console.log(`[ext:quickpick] ${JSON.stringify(items.slice(0, 5))}`);
  return Promise.resolve(undefined);
}

export function showInputBox(options?: any): Promise<string | undefined> {
  console.log(`[ext:inputbox] ${options?.prompt || ''}`);
  return Promise.resolve(undefined);
}

export interface StatusBarItemImpl {
  alignment: StatusBarAlignment;
  priority: number;
  text: string;
  tooltip: string;
  color: string | undefined;
  backgroundColor: any;
  command: string | undefined;
  show(): void;
  hide(): void;
  dispose(): void;
}

const statusBarItems: StatusBarItemImpl[] = [];

export function createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItemImpl {
  const id = `statusbar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const item: StatusBarItemImpl = {
    alignment: alignment ?? StatusBarAlignment.Left,
    priority: priority ?? 0,
    text: '',
    tooltip: '',
    color: undefined,
    backgroundColor: undefined,
    command: undefined,
    show() {
      if (!statusBarItems.includes(this)) statusBarItems.push(this);
      mainWebContents?.send('statusbar:update', { id, text: this.text, tooltip: this.tooltip, alignment: this.alignment, priority: this.priority, color: this.color, command: this.command });
    },
    hide() {
      const idx = statusBarItems.indexOf(this);
      if (idx >= 0) statusBarItems.splice(idx, 1);
      mainWebContents?.send('statusbar:remove', { id });
    },
    dispose() { this.hide(); },
  };
  return item;
}

export function getStatusBarItems(): StatusBarItemImpl[] { return statusBarItems; }

export interface OutputChannelImpl {
  name: string;
  append(value: string): void;
  appendLine(value: string): void;
  clear(): void;
  show(): void;
  hide(): void;
  dispose(): void;
}

export function createOutputChannel(name: string): OutputChannelImpl {
  let buffer = '';
  return {
    name,
    append(value: string) { buffer += value; },
    appendLine(value: string) { buffer += value + '\n'; console.log(`[${name}] ${value}`); },
    clear() { buffer = ''; },
    show() {},
    hide() {},
    dispose() { buffer = ''; },
  };
}

export const activeTextEditor: any = undefined;
export const visibleTextEditors: any[] = [];
export const onDidChangeActiveTextEditor = new EventEmitter<any>().event;
export const onDidChangeVisibleTextEditors = new EventEmitter<any[]>().event;
export const onDidChangeTextEditorSelection = new EventEmitter<any>().event;
