/**
 * AI Context Bar webview script.
 *
 * Receives state updates from the host via `postMessage` and renders the
 * context bar UI accordingly using safe DOM methods (no innerHTML).
 */

// ── Types (mirrored from context-bar.ts to avoid bundling Node code) ──

interface ContextAction {
  id: string;
  label: string;
  icon: string;
}

interface ContextBarState {
  panelId: string;
  url: string;
  title: string;
  summary: string | null;
  loading: boolean;
  actions: ContextAction[];
}

// ── DOM references ──────────────────────────────────────────────────

const panelTitle = document.getElementById('panel-title') as HTMLHeadingElement;
const panelUrl = document.getElementById('panel-url') as HTMLSpanElement;
const loadingIndicator = document.getElementById('loading-indicator') as HTMLDivElement;
const summaryContent = document.getElementById('summary-content') as HTMLDivElement;
const actionGrid = document.getElementById('action-grid') as HTMLDivElement;
const collapseToggle = document.querySelector('.cb-collapse-toggle') as HTMLButtonElement;
const collapseIcon = document.querySelector('.cb-collapse-icon') as HTMLSpanElement;
const body = document.getElementById('cb-body') as HTMLDivElement;

// ── Icon map (simple text icons for lightweight rendering) ───────

const ICON_MAP: Record<string, string> = {
  sparkles: '\u2728',
  'list-checks': '\u2611',
  reply: '\u21A9',
  'folder-plus': '\uD83D\uDCC1',
  'file-text': '\uD83D\uDCC4',
};

// ── Collapse toggle ─────────────────────────────────────────────────

let collapsed = false;

collapseToggle.addEventListener('click', () => {
  collapsed = !collapsed;
  body.hidden = collapsed;
  collapseIcon.textContent = collapsed ? '\u25B6' : '\u25BC';
});

// ── Rendering (safe DOM methods only) ───────────────────────────────

function clearChildren(el: HTMLElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function renderState(state: ContextBarState): void {
  // Header
  panelTitle.textContent = state.title || 'No panel selected';
  panelUrl.textContent = state.url || '';
  panelUrl.title = state.url || '';

  // Loading
  loadingIndicator.hidden = !state.loading;

  // Summary
  clearChildren(summaryContent);

  if (state.loading) {
    // empty while loading — the dots indicator is a sibling
  } else if (state.summary) {
    renderSummary(summaryContent, state.summary);
  } else {
    const placeholder = document.createElement('p');
    placeholder.className = 'cb-placeholder';
    placeholder.textContent = 'Select a panel or click Summarize to begin.';
    summaryContent.appendChild(placeholder);
  }

  // Actions
  renderActions(state.actions, state.panelId);
}

/**
 * Parse simple markdown-like summary text and build DOM nodes.
 * Handles bullet lists (- / *) and **bold** spans.
 */
function renderSummary(container: HTMLElement, text: string): void {
  const lines = text.split('\n');
  let currentList: HTMLUListElement | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (currentList) {
        container.appendChild(currentList);
        currentList = null;
      }
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)/);
    if (bulletMatch) {
      if (!currentList) {
        currentList = document.createElement('ul');
      }
      const li = document.createElement('li');
      appendFormattedText(li, bulletMatch[1]);
      currentList.appendChild(li);
    } else {
      if (currentList) {
        container.appendChild(currentList);
        currentList = null;
      }
      const p = document.createElement('p');
      appendFormattedText(p, line);
      container.appendChild(p);
    }
  }

  if (currentList) {
    container.appendChild(currentList);
  }
}

/**
 * Append text to an element, converting **bold** markers into <strong>
 * elements while keeping everything else as safe text nodes.
 */
function appendFormattedText(parent: HTMLElement, text: string): void {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      parent.appendChild(strong);
    } else {
      parent.appendChild(document.createTextNode(part));
    }
  }
}

function renderActions(actions: ContextAction[], panelId: string): void {
  clearChildren(actionGrid);

  for (const action of actions) {
    const btn = document.createElement('button');
    btn.className = 'cb-action-btn';
    btn.dataset.actionId = action.id;
    btn.title = action.label;

    const icon = document.createElement('span');
    icon.className = 'cb-action-icon';
    icon.textContent = ICON_MAP[action.icon] ?? '\u26A1';

    const label = document.createElement('span');
    label.className = 'cb-action-label';
    label.textContent = action.label;

    btn.appendChild(icon);
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      window.parent.postMessage(
        { type: 'context-bar:action', actionId: action.id, panelId },
        '*',
      );
    });

    actionGrid.appendChild(btn);
  }
}

// ── Message listener ────────────────────────────────────────────────

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data;
  if (data && data.type === 'context-bar:state-update') {
    renderState(data.state as ContextBarState);
  }
});

// Signal readiness to host
window.parent.postMessage({ type: 'context-bar:ready' }, '*');
