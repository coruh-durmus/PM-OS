import type { PanelApi, Disposable } from '@pm-os/types';
import { EventBus } from '@pm-os/event-bus';
import { parseSlackUrl } from './url-parser.js';

/**
 * Listens for URL changes on the Slack panel and emits
 * `panel:context-changed` events via the event bus.
 */
export function createSlackContextProvider(
  panelApi: PanelApi,
  eventBus: EventBus,
  panelId: string,
): Disposable {
  const subscription = panelApi.onStateChanged((state) => {
    const context = parseSlackUrl(state.url);

    eventBus.emit('panel:context-changed', {
      panelId,
      url: state.url,
      title: state.title,
    });

    // Store parsed context for other extensions to query if needed
    void context;
  });

  return subscription;
}
