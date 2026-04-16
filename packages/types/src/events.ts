/**
 * Strongly-typed map of all cross-extension events in PM-OS.
 * Keys are dot-delimited event names; values are the payload shape.
 */
export type EventMap = {
  'panel:context-changed': { panelId: string; url: string; title: string };
  'project:changed': { projectPath: string | null };
  'project:config-updated': { projectPath: string };
  'auth:changed': { provider: string; authenticated: boolean };
  'ai:context-bar-action': { action: string; panelId: string; data?: unknown };
  'ai:summary-ready': { panelId: string; summary: string };
  'automation:triggered': { automationId: string; trigger: string };
  'command:execute': { commandId: string; args?: unknown[] };
  'meeting:detected': { panelId: string; url: string; platform: string };
  'meeting:started': { meetingId: string };
  'meeting:ended': { meetingId: string; duration: number };
  'meeting:transcription-complete': { meetingId: string; transcriptPath: string };
};

/** Union of all valid event names. */
export type EventName = keyof EventMap;

/** Extract the payload type for a given event name. */
export type EventPayload<E extends EventName> = EventMap[E];

/** Handler function signature for a given event. */
export type EventHandler<E extends EventName> = (payload: EventPayload<E>) => void;
