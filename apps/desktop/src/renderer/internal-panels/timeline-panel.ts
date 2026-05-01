import {
  ACTIVE_FILE_EVENT,
  type ActiveFileDetail,
} from '../shared/active-file-event.js';

interface CommitRow {
  hash: string;
  subject: string;
  relTime: string;
  author: string;
}

export interface TimelinePanelOptions {
  /**
   * Called whenever the active file changes so the surrounding
   * SidebarSection can show the file name next to the "TIMELINE" title.
   */
  onActiveFileNameChanged?: (filename: string | null) => void;
}

export class TimelinePanel {
  private el: HTMLElement;
  private listEl: HTMLElement;
  private current: ActiveFileDetail = { path: null, content: null, isMarkdown: false };
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentRequestId = 0;
  private popupBackdrop: HTMLElement | null = null;
  private onActiveFileNameChanged?: (filename: string | null) => void;

  constructor(container: HTMLElement, options?: TimelinePanelOptions) {
    this.el = container;
    this.el.style.cssText = 'padding: 4px 0;';
    this.onActiveFileNameChanged = options?.onActiveFileNameChanged;
    this.listEl = document.createElement('div');
    this.el.appendChild(this.listEl);

    window.addEventListener(ACTIVE_FILE_EVENT, this.onActiveFile as EventListener);
    this.renderEmpty('No active file');
  }

  dispose(): void {
    window.removeEventListener(ACTIVE_FILE_EVENT, this.onActiveFile as EventListener);
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.closeDiffPopup();
  }

  private onActiveFile = (event: Event): void => {
    const detail = (event as CustomEvent<ActiveFileDetail>).detail;
    this.current = detail;

    const filename = detail.path ? detail.path.split('/').pop() ?? null : null;
    this.onActiveFileNameChanged?.(filename);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (!detail.path) {
      this.renderEmpty('No active file');
      return;
    }

    this.renderLoading();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.loadCommits(detail.path!);
    }, 150);
  };

  private async loadCommits(path: string): Promise<void> {
    const requestId = ++this.currentRequestId;
    const folders: string[] = await (window as any).pmOs.workspace.getFolders();
    const root = pickWorkspaceRoot(path, folders);
    if (!root) {
      if (requestId === this.currentRequestId) this.renderEmpty('Not a git repo or no commits');
      return;
    }
    const relativePath = path.startsWith(root + '/') ? path.slice(root.length + 1) : path;

    let commits: CommitRow[] = [];
    try {
      commits = await (window as any).pmOs.git.logFile(root, relativePath, 50);
    } catch {
      commits = [];
    }

    if (requestId !== this.currentRequestId) return; // Newer request superseded this one.

    if (!commits || commits.length === 0) {
      this.renderEmpty('Not a git repo or no commits');
      return;
    }

    this.renderRows(commits, root, relativePath);
  }

  private renderEmpty(text: string): void {
    while (this.listEl.firstChild) this.listEl.removeChild(this.listEl.firstChild);
    const empty = document.createElement('div');
    empty.style.cssText = 'padding: 8px 12px; color: var(--text-muted); font-size: 12px;';
    empty.textContent = text;
    this.listEl.appendChild(empty);
  }

  private renderLoading(): void {
    while (this.listEl.firstChild) this.listEl.removeChild(this.listEl.firstChild);
    const loading = document.createElement('div');
    loading.style.cssText = 'padding: 8px 12px; color: var(--text-muted); font-size: 12px;';
    loading.textContent = 'Loading…';
    this.listEl.appendChild(loading);
  }

  private renderRows(commits: CommitRow[], root: string, relativePath: string): void {
    while (this.listEl.firstChild) this.listEl.removeChild(this.listEl.firstChild);

    for (const commit of commits) {
      const row = document.createElement('div');
      row.className = 'timeline-row';
      row.style.cssText = 'padding: 3px 12px 3px 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); white-space: nowrap;';

      row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-hover)');
      row.addEventListener('mouseleave', () => row.style.background = '');

      const dot = document.createElement('span');
      dot.className = 'codicon codicon-circle-large-outline';
      dot.style.cssText = 'font-size: 12px; color: var(--text-muted); flex-shrink: 0;';
      row.appendChild(dot);

      const subject = document.createElement('span');
      subject.textContent = commit.subject;
      subject.style.cssText = 'flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis;';
      row.appendChild(subject);

      const time = document.createElement('span');
      time.textContent = commit.relTime;
      time.style.cssText = 'flex-shrink: 0; color: var(--text-muted); font-size: 11px;';
      row.appendChild(time);

      row.title = `${commit.author} · ${commit.hash.slice(0, 7)} · ${commit.subject}`;
      row.addEventListener('click', () => this.openDiffPopup(commit, root, relativePath));

      this.listEl.appendChild(row);
    }
  }

  private async openDiffPopup(commit: CommitRow, root: string, relativePath: string): Promise<void> {
    this.closeDiffPopup();

    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; align-items: center; justify-content: center;';

    const card = document.createElement('div');
    card.style.cssText = 'width: min(800px, 90vw); height: min(600px, 80vh); background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: var(--shadow-xl); display: flex; flex-direction: column; overflow: hidden;';

    const header = document.createElement('div');
    header.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px;';

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'flex: 1; min-width: 0;';

    const title = document.createElement('div');
    title.textContent = commit.subject;
    title.style.cssText = 'font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    titleWrap.appendChild(title);

    const sub = document.createElement('div');
    sub.textContent = `${commit.hash.slice(0, 7)} · ${commit.author} · ${commit.relTime}`;
    sub.style.cssText = 'font-size: 11px; color: var(--text-muted); margin-top: 2px;';
    titleWrap.appendChild(sub);

    header.appendChild(titleWrap);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    closeBtn.style.cssText = 'width: 24px; height: 24px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
    const closeIcon = document.createElement('span');
    closeIcon.className = 'codicon codicon-close';
    closeBtn.appendChild(closeIcon);
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'var(--bg-hover)');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'transparent');
    closeBtn.addEventListener('click', () => this.closeDiffPopup());
    header.appendChild(closeBtn);

    card.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = "flex: 1; overflow: auto; padding: 12px 16px; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5; color: var(--text-secondary); white-space: pre;";

    const loading = document.createElement('div');
    loading.style.cssText = 'color: var(--text-muted);';
    loading.textContent = 'Loading diff…';
    body.appendChild(loading);

    card.appendChild(body);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    this.popupBackdrop = backdrop;

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeDiffPopup();
    });
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeDiffPopup();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    let diff = '';
    try {
      diff = await (window as any).pmOs.git.showFileDiff(root, commit.hash, relativePath);
    } catch {
      diff = '';
    }

    if (this.popupBackdrop !== backdrop) return; // popup was closed while loading

    body.textContent = '';
    if (!diff) {
      const noDiff = document.createElement('div');
      noDiff.style.cssText = 'color: var(--text-muted);';
      noDiff.textContent = 'No diff available for this commit.';
      body.appendChild(noDiff);
      return;
    }

    for (const rawLine of diff.split('\n')) {
      const line = document.createElement('div');
      line.textContent = rawLine || ' ';
      if (rawLine.startsWith('+++') || rawLine.startsWith('---')) {
        line.style.color = 'var(--text-primary)';
        line.style.fontWeight = '600';
      } else if (rawLine.startsWith('@@')) {
        line.style.color = 'var(--accent)';
      } else if (rawLine.startsWith('+')) {
        line.style.color = 'var(--success)';
      } else if (rawLine.startsWith('-')) {
        line.style.color = 'var(--error)';
      }
      body.appendChild(line);
    }
  }

  private closeDiffPopup(): void {
    if (this.popupBackdrop) {
      this.popupBackdrop.remove();
      this.popupBackdrop = null;
    }
  }
}

function pickWorkspaceRoot(path: string, folders: string[]): string | null {
  let best: string | null = null;
  for (const folder of folders) {
    if (path === folder || path.startsWith(folder + '/')) {
      if (!best || folder.length > best.length) best = folder;
    }
  }
  return best;
}
