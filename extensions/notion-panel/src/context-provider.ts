import type { PanelApi, Disposable } from '@pm-os/types';
import { EventBus } from '@pm-os/event-bus';
import { parseNotionUrl } from './url-parser.js';

/**
 * Listens for URL changes on the Notion panel and emits
 * `panel:context-changed` events via the event bus.
 */
export function createNotionContextProvider(
  panelApi: PanelApi,
  eventBus: EventBus,
  panelId: string,
): Disposable {
  const subscription = panelApi.onStateChanged((state) => {
    const context = parseNotionUrl(state.url);

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
