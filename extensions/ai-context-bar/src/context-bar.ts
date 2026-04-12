import type { Disposable } from '@pm-os/types';
import type { EventBus } from '@pm-os/event-bus';
import type { ClaudeClient } from '@pm-os/claude';

/**
 * An action the user can trigger from the context bar.
 */
export interface ContextAction {
  id: string;
  label: string;
  icon: string;
}

/**
 * Full state of the AI Context Bar, pushed to subscribers on every change.
 */
export interface ContextBarState {
  panelId: string;
  url: string;
  title: string;
  summary: string | null;
  loading: boolean;
  actions: ContextAction[];
}

type StateCallback = (state: ContextBarState) => void;

/** PM-focused system prompt used for content summarization. */
const PM_SYSTEM_PROMPT = [
  'You are a concise product-management assistant inside PM-OS.',
  'Summarize the provided content in 2-4 bullet points.',
  'Focus on decisions, action items, blockers, and deadlines.',
  'Use plain language a PM can skim in 10 seconds.',
].join(' ');

// ── Panel-type action sets ──────────────────────────────────────────

const SLACK_ACTIONS: ContextAction[] = [
  { id: 'summarize', label: 'Summarize', icon: 'sparkles' },
  { id: 'extract-actions', label: 'Extract Action Items', icon: 'list-checks' },
  { id: 'draft-reply', label: 'Draft Reply', icon: 'reply' },
  { id: 'save-to-project', label: 'Save to Project', icon: 'folder-plus' },
];

const NOTION_ACTIONS: ContextAction[] = [
  { id: 'summarize', label: 'Summarize', icon: 'sparkles' },
  { id: 'draft-prd', label: 'Draft PRD', icon: 'file-text' },
  { id: 'save-to-project', label: 'Save to Project', icon: 'folder-plus' },
];

const BROWSER_ACTIONS: ContextAction[] = [
  { id: 'summarize', label: 'Summarize', icon: 'sparkles' },
  { id: 'save-to-project', label: 'Save to Project', icon: 'folder-plus' },
];

const DEFAULT_ACTIONS: ContextAction[] = [
  { id: 'summarize', label: 'Summarize', icon: 'sparkles' },
  { id: 'save-to-project', label: 'Save to Project', icon: 'folder-plus' },
];

/**
 * Detects the panel type from its id.
 */
function detectPanelType(panelId: string): 'slack' | 'notion' | 'browser' | 'default' {
  const id = panelId.toLowerCase();
  if (id.includes('slack')) return 'slack';
  if (id.includes('notion')) return 'notion';
  if (id.includes('browser') || id.includes('web')) return 'browser';
  return 'default';
}

/**
 * Controller that drives the AI Context Bar.
 *
 * Listens to `panel:context-changed` events on the shared EventBus, maintains
 * the bar's state, and exposes helpers for AI summarization and panel-specific
 * actions.
 */
export class ContextBarController {
  private state: ContextBarState = {
    panelId: '',
    url: '',
    title: '',
    summary: null,
    loading: false,
    actions: DEFAULT_ACTIONS,
  };

  private subscribers = new Set<StateCallback>();
  private eventSub: Disposable;

  constructor(
    private bus: EventBus,
    private claude?: ClaudeClient,
  ) {
    this.eventSub = this.bus.on('panel:context-changed', (payload) => {
      this.state = {
        panelId: payload.panelId,
        url: payload.url,
        title: payload.title,
        summary: null,
        loading: false,
        actions: this.getActionsForPanel(payload.panelId),
      };
      this.notify();
    });
  }

  /** Register a callback that fires whenever state changes. Returns a Disposable. */
  subscribe(callback: StateCallback): Disposable {
    this.subscribers.add(callback);
    // Immediately deliver current state so the UI can render on attach.
    callback(this.state);
    return {
      dispose: () => {
        this.subscribers.delete(callback);
      },
    };
  }

  /** Return a snapshot of the current state. */
  getState(): Readonly<ContextBarState> {
    return this.state;
  }

  /**
   * Summarize arbitrary content using the shared ClaudeClient.
   * Updates internal state (loading / summary) and notifies subscribers.
   */
  async summarize(content: string): Promise<string> {
    if (!this.claude) {
      throw new Error('ClaudeClient not configured — cannot summarize');
    }

    this.state = { ...this.state, loading: true, summary: null };
    this.notify();

    try {
      const summary = await this.claude.complete(
        [{ role: 'user', content }],
        {
          system: PM_SYSTEM_PROMPT,
          maxTokens: 512,
          cacheKey: `ctx-bar:${this.state.panelId}:${hashContent(content)}`,
        },
      );

      this.state = { ...this.state, loading: false, summary };
      this.notify();

      this.bus.emit('ai:summary-ready', {
        panelId: this.state.panelId,
        summary,
      });

      return summary;
    } catch (err) {
      this.state = { ...this.state, loading: false };
      this.notify();
      throw err;
    }
  }

  /** Return the set of actions appropriate for a given panel type. */
  getActionsForPanel(panelId: string): ContextAction[] {
    switch (detectPanelType(panelId)) {
      case 'slack':
        return SLACK_ACTIONS;
      case 'notion':
        return NOTION_ACTIONS;
      case 'browser':
        return BROWSER_ACTIONS;
      default:
        return DEFAULT_ACTIONS;
    }
  }

  /** Tear down event subscriptions. */
  dispose(): void {
    this.eventSub.dispose();
    this.subscribers.clear();
  }

  // ── Private helpers ───────────────────────────────────────────────

  private notify(): void {
    for (const cb of this.subscribers) {
      cb(this.state);
    }
  }
}

/**
 * Simple string hash for cache-key generation.
 * Not cryptographic — just avoids re-summarizing identical content.
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}
