import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../event-bus.js';

describe('EventBus', () => {
  it('delivers payload to subscribers', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('panel:context-changed', handler);
    bus.emit('panel:context-changed', {
      panelId: 'slack',
      url: 'https://app.slack.com/foo',
      title: 'general',
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      panelId: 'slack',
      url: 'https://app.slack.com/foo',
      title: 'general',
    });
  });

  it('disposable removes the listener', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const sub = bus.on('project:changed', handler);
    sub.dispose();

    bus.emit('project:changed', { projectPath: '/tmp/proj' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple listeners on the same event', () => {
    const bus = new EventBus();
    const handlerA = vi.fn();
    const handlerB = vi.fn();

    bus.on('auth:changed', handlerA);
    bus.on('auth:changed', handlerB);

    bus.emit('auth:changed', { provider: 'slack', authenticated: true });

    expect(handlerA).toHaveBeenCalledOnce();
    expect(handlerB).toHaveBeenCalledOnce();
  });

  it('does not cross-deliver between different events', () => {
    const bus = new EventBus();
    const panelHandler = vi.fn();
    const projectHandler = vi.fn();

    bus.on('panel:context-changed', panelHandler);
    bus.on('project:changed', projectHandler);

    bus.emit('panel:context-changed', {
      panelId: 'browser',
      url: 'https://example.com',
      title: 'Example',
    });

    expect(panelHandler).toHaveBeenCalledOnce();
    expect(projectHandler).not.toHaveBeenCalled();
  });
});
