import { marked } from 'marked';
import { slugify } from '../shared/markdown-slug.js';
import { extractCodeSymbols, isCodeFile, type CodeSymbol } from '../shared/code-symbols.js';
import {
  ACTIVE_FILE_EVENT,
  emitScrollToAnchor,
  emitScrollToLine,
  type ActiveFileDetail,
} from '../shared/active-file-event.js';

interface OutlineEntry {
  name: string;
  depth: number;     // markdown: heading depth 1-6 normalized; code: 0 or 1
  iconClass: string; // codicon class
  onClick: () => void;
}

export class OutlinePanel {
  private el: HTMLElement;
  private listEl: HTMLElement;
  private current: ActiveFileDetail = { path: null, content: null, isMarkdown: false };

  constructor(container: HTMLElement) {
    this.el = container;
    this.el.style.cssText = 'padding: 4px 0;';
    this.listEl = document.createElement('div');
    this.el.appendChild(this.listEl);

    window.addEventListener(ACTIVE_FILE_EVENT, this.onActiveFile as EventListener);
    this.renderEntries(this.computeEntries());
  }

  dispose(): void {
    window.removeEventListener(ACTIVE_FILE_EVENT, this.onActiveFile as EventListener);
  }

  private onActiveFile = (event: Event): void => {
    const detail = (event as CustomEvent<ActiveFileDetail>).detail;
    this.current = detail;
    this.renderEntries(this.computeEntries());
  };

  private computeEntries(): OutlineEntry[] {
    const { path, content, isMarkdown } = this.current;
    if (!path || content == null) return [];

    if (isMarkdown) {
      const tokens = marked.lexer(content);
      const headings = tokens.filter((t: any) => t.type === 'heading') as any[];
      if (headings.length === 0) return [];
      const minDepth = Math.min(...headings.map(h => h.depth));
      return headings.map(h => ({
        name: h.text,
        depth: h.depth - minDepth,
        iconClass: 'codicon-symbol-string',
        onClick: () => emitScrollToAnchor({ slug: slugify(h.text) }),
      }));
    }

    if (isCodeFile(path)) {
      const symbols = extractCodeSymbols(content, path);
      if (symbols.length === 0) return [];
      return symbols.map((s: CodeSymbol) => ({
        name: s.name,
        depth: s.depth,
        iconClass: kindToIcon(s.kind),
        onClick: () => emitScrollToLine({ line: s.line }),
      }));
    }

    return [];
  }

  private renderEntries(entries: OutlineEntry[]): void {
    while (this.listEl.firstChild) this.listEl.removeChild(this.listEl.firstChild);

    if (!this.current.path) {
      this.appendEmpty('No active file');
      return;
    }
    if (entries.length === 0) {
      this.appendEmpty('No outline available');
      return;
    }

    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'outline-row';
      row.style.cssText = `padding: 2px 8px 2px ${8 + entry.depth * 12}px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden;`;

      row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-hover)');
      row.addEventListener('mouseleave', () => row.style.background = '');
      row.addEventListener('click', entry.onClick);

      const icon = document.createElement('span');
      icon.className = 'codicon ' + entry.iconClass;
      icon.style.cssText = 'font-size: 13px; flex-shrink: 0; color: var(--text-muted);';
      row.appendChild(icon);

      const name = document.createElement('span');
      name.textContent = entry.name;
      name.style.cssText = 'overflow: hidden; text-overflow: ellipsis;';
      name.title = entry.name;
      row.appendChild(name);

      this.listEl.appendChild(row);
    }
  }

  private appendEmpty(text: string): void {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding: 8px 12px; color: var(--text-muted); font-size: 12px;';
    empty.textContent = text;
    this.listEl.appendChild(empty);
  }
}

function kindToIcon(kind: CodeSymbol['kind']): string {
  switch (kind) {
    case 'class': return 'codicon-symbol-class';
    case 'function': return 'codicon-symbol-method';
    case 'method': return 'codicon-symbol-method';
    case 'const': return 'codicon-symbol-variable';
    default: return 'codicon-symbol-string';
  }
}
