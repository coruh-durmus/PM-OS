import { Disposable } from './types';

const handlers = new Map<string, (...args: any[]) => any>();
const declarations = new Map<string, { title: string; category?: string }>();

export function registerCommand(commandId: string, handler: (...args: any[]) => any): Disposable {
  handlers.set(commandId, handler);
  return new Disposable(() => handlers.delete(commandId));
}

export function registerTextEditorCommand(commandId: string, handler: (...args: any[]) => any): Disposable {
  return registerCommand(commandId, handler);
}

export async function executeCommand<T>(commandId: string, ...args: any[]): Promise<T | undefined> {
  const handler = handlers.get(commandId);
  if (handler) return handler(...args);
  return undefined;
}

export function getCommands(filterInternal?: boolean): Promise<string[]> {
  return Promise.resolve(Array.from(handlers.keys()));
}

export function declareCommand(commandId: string, title: string, category?: string): void {
  declarations.set(commandId, { title, category });
}

export function getDeclaredCommands(): Map<string, { title: string; category?: string }> {
  return declarations;
}
