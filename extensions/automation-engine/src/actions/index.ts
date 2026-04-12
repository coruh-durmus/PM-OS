/**
 * Action registry -- maps action type strings to handler functions.
 *
 * Extensions and templates reference actions by type name (e.g. "summarize_slack").
 * The registry resolves these to concrete handler functions at runtime.
 */

import type { ActionConfig } from '../scheduler.js';

export type ActionHandler = (params: Record<string, unknown>) => void | Promise<void>;

const registry = new Map<string, ActionHandler>();

/**
 * Register an action handler for a given type name.
 */
export function registerAction(type: string, handler: ActionHandler): void {
  registry.set(type, handler);
}

/**
 * Retrieve the handler for a given action type, or undefined if not registered.
 */
export function getAction(type: string): ActionHandler | undefined {
  return registry.get(type);
}

/**
 * Execute a list of actions sequentially, looking each up in the registry.
 * Logs a warning for any unregistered action type.
 */
export async function executeActions(actions: ActionConfig[]): Promise<void> {
  for (const action of actions) {
    const handler = registry.get(action.type);
    if (!handler) {
      console.warn(`[automation-engine] No handler registered for action type: ${action.type}`);
      continue;
    }
    await handler(action.params);
  }
}
