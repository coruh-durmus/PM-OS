interface GitInfo {
  branch: string | null;
  remote: string | null;
  dirty: boolean;
  modifiedCount: number;
  lastCommit: any;
  contributors: string[];
}

export class StatusBar {
  private el: HTMLElement;

  private leftEl!: HTMLElement;
  private rightEl!: HTMLElement;

  private workspaceItem!: HTMLElement;
  private workspaceLabel!: HTMLElement;
  private branchItem!: HTMLElement;
  private branchLabel!: HTMLElement;
  private syncItem!: HTMLElement;
  private syncIcon!: HTMLElement;

  private errorItem!: HTMLElement;
  private errorCountEl!: HTMLElement;
  private warningItem!: HTMLElement;
  private warningCountEl!: HTMLElement;

  private currentRoot: string | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;
  private explicitProjectName: string | null = null;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  render(): void {
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    // ── Left cluster ─────────────────────────────────────────────────
    this.leftEl = document.createElement('div');
    this.leftEl.className = 'status-bar-left';

    this.workspaceItem = this.createItem({ icon: 'codicon-source-control' });
    this.workspaceLabel = this.workspaceItem.querySelector('.status-bar-text')!;
    this.workspaceLabel.textContent = 'No workspace';
    this.leftEl.appendChild(this.workspaceItem);

    this.branchItem = this.createItem({ icon: 'codicon-git-branch' });
    this.branchLabel = this.branchItem.querySelector('.status-bar-text')!;
    this.branchLabel.textContent = '';
    this.branchItem.style.display = 'none';
    this.leftEl.appendChild(this.branchItem);

    this.syncItem = this.createItem({ icon: 'codicon-cloud-upload', clickable: true, title: 'Push to remote' });
    this.syncIcon = this.syncItem.querySelector('.codicon')!;
    this.syncItem.style.display = 'none';
    this.syncItem.addEventListener('click', () => this.onSyncClick());
    this.leftEl.appendChild(this.syncItem);

    this.el.appendChild(this.leftEl);

    // ── Right cluster ────────────────────────────────────────────────
    this.rightEl = document.createElement('div');
    this.rightEl.className = 'status-bar-right';

    this.errorItem = this.createItem({ icon: 'codicon-error', title: '0 errors' });
    this.errorCountEl = this.errorItem.querySelector('.status-bar-text')!;
    this.errorCountEl.textContent = '0';
    this.rightEl.appendChild(this.errorItem);

    this.warningItem = this.createItem({ icon: 'codicon-warning', title: '0 warnings' });
    this.warningCountEl = this.warningItem.querySelector('.status-bar-text')!;
    this.warningCountEl.textContent = '0';
    this.rightEl.appendChild(this.warningItem);

    this.el.appendChild(this.rightEl);

    // ── Subscriptions ────────────────────────────────────────────────
    (window as any).pmOs.workspace?.onChanged?.(() => this.refresh());
    (window as any).pmOs.extensions?.onDiagnosticsCounts?.((data: { errors: number; warnings: number }) => {
      this.setDiagnostics(data.errors, data.warnings);
    });

    // Periodic refresh — picks up dirty-state changes that don't fire
    // workspace:changed events (e.g. user edited a file outside the app).
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => this.refresh(), 30_000);

    // Preserve extension status-bar item integration.
    (window as any).pmOs.extensions?.onStatusBarUpdate?.((data: any) => {
      let item = this.el.querySelector(`[data-ext-status="${data.id}"]`) as HTMLElement;
      if (!item) {
        item = document.createElement('span');
        item.dataset.extStatus = data.id;
        item.style.cssText = 'cursor: pointer; padding: 0 6px; font-size: 11px;';
        this.el.appendChild(item);
      }
      item.textContent = data.text || '';
      item.title = data.tooltip || '';
      if (data.color) item.style.color = data.color;
    });

    (window as any).pmOs.extensions?.onStatusBarRemove?.((data: any) => {
      const item = this.el.querySelector(`[data-ext-status="${data.id}"]`);
      if (item) item.remove();
    });

    // Initial fetch.
    void this.refresh();
  }

  /**
   * External API kept for compatibility with App.ts. Updates the workspace
   * label without disrupting the in-flight git refresh.
   */
  setProject(name: string): void {
    this.explicitProjectName = name;
    if (this.workspaceLabel) this.workspaceLabel.textContent = name;
  }

  setDiagnostics(errors: number, warnings: number): void {
    if (this.errorCountEl) {
      this.errorCountEl.textContent = String(errors);
      this.errorItem.title = `${errors} error${errors === 1 ? '' : 's'}`;
    }
    if (this.warningCountEl) {
      this.warningCountEl.textContent = String(warnings);
      this.warningItem.title = `${warnings} warning${warnings === 1 ? '' : 's'}`;
    }
  }

  private async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const folders: string[] = (await (window as any).pmOs.workspace?.getFolders?.()) ?? [];
      const root = folders[0] ?? null;
      this.currentRoot = root;

      // Workspace name — prefer the explicit one set via setProject(), then
      // fall back to workspace.getName(), then to the folder basename.
      let name = this.explicitProjectName;
      if (!name) {
        try { name = await (window as any).pmOs.workspace.getName(); } catch {}
      }
      if (!name && root) {
        name = root.split('/').pop() ?? root;
      }
      if (!name) name = 'No workspace';
      this.workspaceLabel.textContent = name;

      if (!root) {
        this.branchItem.style.display = 'none';
        this.syncItem.style.display = 'none';
        return;
      }

      let info: GitInfo | null = null;
      try {
        info = await (window as any).pmOs.git.getInfo(root);
      } catch {
        info = null;
      }

      if (!info || !info.branch) {
        this.branchItem.style.display = 'none';
        this.syncItem.style.display = 'none';
        return;
      }

      this.branchItem.style.display = '';
      this.branchLabel.textContent = info.branch + (info.dirty ? '*' : '');
      this.branchItem.title = info.dirty
        ? `${info.modifiedCount} modified · branch ${info.branch}`
        : `branch ${info.branch}`;

      this.syncItem.style.display = info.remote ? '' : 'none';
    } finally {
      this.refreshing = false;
    }
  }

  private async onSyncClick(): Promise<void> {
    if (!this.currentRoot) return;
    if (this.syncItem.classList.contains('spinning')) return;
    this.syncItem.classList.add('spinning');
    try {
      const result = await (window as any).pmOs.git.push(this.currentRoot);
      this.flashSync(result?.success);
    } catch {
      this.flashSync(false);
    } finally {
      this.syncItem.classList.remove('spinning');
      void this.refresh();
    }
  }

  private flashSync(success: boolean | undefined): void {
    const original = 'codicon-cloud-upload';
    const flashed = success ? 'codicon-check' : 'codicon-error';
    this.syncIcon.classList.remove(original);
    this.syncIcon.classList.add(flashed);
    setTimeout(() => {
      this.syncIcon.classList.remove(flashed);
      this.syncIcon.classList.add(original);
    }, 2000);
  }

  private createItem(opts: { icon: string; title?: string; clickable?: boolean }): HTMLElement {
    const item = document.createElement('span');
    item.className = 'status-bar-item' + (opts.clickable ? ' clickable' : '');
    if (opts.title) item.title = opts.title;

    const icon = document.createElement('span');
    icon.className = 'codicon ' + opts.icon;
    item.appendChild(icon);

    const text = document.createElement('span');
    text.className = 'status-bar-text';
    item.appendChild(text);

    return item;
  }
}
