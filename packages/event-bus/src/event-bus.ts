import type { Disposable, EventName, EventPayload, EventHandler } from '@pm-os/types';

/**
 * Strongly-typed event bus for cross-extension communication in PM-OS.
 *
 * Extensions use `on()` to subscribe and `emit()` to publish. Subscriptions
 * return a `Disposable` so they can be pushed onto `ExtensionContext.subscriptions`
 * for automatic cleanup.
 */
export class EventBus {
  private listeners = new Map<EventName, Set<EventHandler<EventName>>>();

  /**
   * Subscribe to an event. Returns a Disposable that removes the listener
   * when disposed.
   */
  on<E extends EventName>(event: E, handler: EventHandler<E>): Disposable {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as EventHandler<EventName>);

    return {
      dispose: () => {
        set!.delete(handler as EventHandler<EventName>);
        if (set!.size === 0) {
          this.listeners.delete(event);
        }
      },
    };
  }

  /**
   * Emit an event to all registered listeners.
   */
  emit<E extends EventName>(event: E, payload: EventPayload<E>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }

  /**
   * Remove all listeners, optionally for a single event.
   */
  removeAllListeners(event?: EventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
