import type { Extension, ExtensionContext, PanelApi } from '@pm-os/types';
import { EventBus } from '@pm-os/event-bus';
import { createNotionContextProvider } from './context-provider.js';

const PANEL_ID = 'notion-panel';

const notionPanelExtension: Extension = {
  activate(context: ExtensionContext) {
    const eventBus = new EventBus();

    // Register the Notion panel descriptor in global state so the shell
    // can create the WebContentsView with the correct options.
    context.globalState.set(PANEL_ID, {
      id: PANEL_ID,
      title: 'Notion',
      icon: 'file-text',
      position: 'main' as const,
      closable: true,
      webContentsViewOptions: {
        id: PANEL_ID,
        url: 'https://notion.so',
        partition: 'persist:notion',
        show: true,
      },
    });

    // When a PanelApi becomes available (provided by the shell at runtime),
    // wire up the context provider.
    context.globalState.set(`${PANEL_ID}:setup`, (panelApi: PanelApi) => {
      const disposable = createNotionContextProvider(panelApi, eventBus, PANEL_ID);
      context.subscriptions.push(disposable);
    });
  },

  deactivate() {
    // Cleanup handled by subscriptions
  },
};

export default notionPanelExtension;
export { notionPanelExtension };
