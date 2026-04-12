import type { Extension, ExtensionContext, PanelApi } from '@pm-os/types';
import { EventBus } from '@pm-os/event-bus';
import { createFigmaContextProvider } from './context-provider.js';

const PANEL_ID = 'figma-panel';

const figmaPanelExtension: Extension = {
  activate(context: ExtensionContext) {
    const eventBus = new EventBus();

    // Register the Figma panel descriptor in global state so the shell
    // can create the WebContentsView with the correct options.
    context.globalState.set(PANEL_ID, {
      id: PANEL_ID,
      title: 'Figma',
      icon: 'pen-tool',
      position: 'main' as const,
      closable: true,
      webContentsViewOptions: {
        id: PANEL_ID,
        url: 'https://www.figma.com',
        partition: 'persist:figma',
        show: true,
      },
    });

    // When a PanelApi becomes available (provided by the shell at runtime),
    // wire up the context provider.
    context.globalState.set(`${PANEL_ID}:setup`, (panelApi: PanelApi) => {
      const disposable = createFigmaContextProvider(panelApi, eventBus, PANEL_ID);
      context.subscriptions.push(disposable);
    });
  },

  deactivate() {
    // Cleanup handled by subscriptions
  },
};

export default figmaPanelExtension;
export { figmaPanelExtension };
