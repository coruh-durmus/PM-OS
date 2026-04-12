/**
 * Stub action: desktop notification.
 *
 * Uses the Web Notification API when available (Electron renderer context),
 * otherwise falls back to console logging.
 */

import type { ActionHandler } from './index.js';

export const notify: ActionHandler = (params) => {
  const title = (params.title as string) ?? 'PM-OS Notification';
  const body = (params.body as string) ?? '';

  if (typeof globalThis.Notification !== 'undefined') {
    new globalThis.Notification(title, { body });
  } else {
    console.log(`[automation-engine] Notification: ${title} - ${body}`);
  }
};
