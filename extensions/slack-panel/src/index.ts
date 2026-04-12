import type { Extension, ExtensionContext, PanelApi } from '@pm-os/types';
import { EventBus } from '@pm-os/event-bus';
import { createSlackContextProvider } from './context-provider.js';

const PANEL_ID = 'slack-panel';

const slackPanelExtension: Extension = {
  activate(context: ExtensionContext) {
    const eventBus = new EventBus();

    // Register the Slack panel descriptor in global state so the shell
    // can create the WebContentsView with the correct options.
    context.globalState.set(PANEL_ID, {
      id: PANEL_ID,
      title: 'Slack',
      icon: 'message-square',
      position: 'main' as const,
      closable: true,
      webContentsViewOptions: {
        id: PANEL_ID,
        url: 'https://app.slack.com',
        partition: 'persist:slack',
        show: true,
      },
    });

    // When a PanelApi becomes available (provided by the shell at runtime),
    // wire up the context provider. For now we store the setup function.
    context.globalState.set(`${PANEL_ID}:setup`, (panelApi: PanelApi) => {
      const disposable = createSlackContextProvider(panelApi, eventBus, PANEL_ID);
      context.subscriptions.push(disposable);
    });
  },

  deactivate() {
    // Cleanup handled by subscriptions
  },
};

export default slackPanelExtension;
export { slackPanelExtension };
