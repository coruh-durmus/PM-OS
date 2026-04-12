import type { Extension, ExtensionContext } from '@pm-os/types';
import { EventBus } from '@pm-os/event-bus';
import { TabManager } from './tab-manager.js';

const PANEL_ID = 'browser-panel';

const browserPanelExtension: Extension = {
  activate(context: ExtensionContext) {
    const eventBus = new EventBus();
    const tabManager = new TabManager();

    // Open an initial tab
    tabManager.openTab('https://www.google.com');

    // Register the Browser panel descriptor in global state so the shell
    // can create the WebContentsView with the correct options.
    context.globalState.set(PANEL_ID, {
      id: PANEL_ID,
      title: 'Browser',
      icon: 'globe',
      position: 'main' as const,
      closable: true,
      webContentsViewOptions: {
        id: PANEL_ID,
        url: 'https://www.google.com',
        partition: 'persist:browser',
        show: true,
      },
    });

    // Store the tab manager so other extensions can interact with it
    context.globalState.set(`${PANEL_ID}:tabManager`, tabManager);
    context.globalState.set(`${PANEL_ID}:eventBus`, eventBus);
  },

  deactivate() {
    // Cleanup handled by subscriptions
  },
};

export default browserPanelExtension;
export { browserPanelExtension };
