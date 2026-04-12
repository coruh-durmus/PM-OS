import type { Extension, ExtensionContext } from '@pm-os/types';
import { EventBus } from '@pm-os/event-bus';
import { ContextBarController } from './context-bar.js';

export { ContextBarController } from './context-bar.js';
export type { ContextAction, ContextBarState } from './context-bar.js';

/**
 * PM-OS AI Context Bar extension.
 *
 * Provides an AI-powered sidebar that reacts to the active panel, summarizes
 * its content, and offers panel-specific actions (extract action items, draft
 * PRD, etc.).
 */
const extension: Extension = {
  activate(context: ExtensionContext): void {
    const bus = new EventBus();
    const controller = new ContextBarController(bus);

    // Store controller so other extensions can access it
    context.globalState.set('contextBarController', controller);

    // Wire up action events
    const actionSub = bus.on('ai:context-bar-action', ({ action, panelId, data }) => {
      console.log(
        `[ai-context-bar] Action "${action}" triggered on panel "${panelId}"`,
        data ?? '',
      );
    });

    context.subscriptions.push(actionSub);
    context.subscriptions.push(controller);

    console.log(`[${context.extensionId}] AI Context Bar activated`);
  },

  deactivate(): void {
    console.log('[ai-context-bar] AI Context Bar deactivated');
  },
};

export default extension;
