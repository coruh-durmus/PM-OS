export class SourceControlPanel {
  private el: HTMLElement;
  private resultsEl: HTMLElement | null = null;
  private onOpenFile?: (entry: { name: string; path: string; isDirectory: boolean }) => void;

  constructor(container: HTMLElement, options?: { onOpenFile?: (entry: { name: string; path: string; isDirectory: boolean }) => void }) {
    this.el = container;
    this.onOpenFile = options?.onOpenFile;
  }

  async render(): Promise<void> {
    this.el.textContent = '';
    this.el.style.cssText = 'height: 100%; display: flex; flex-direction: column; overflow: hidden;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;';

    const title = document.createElement('span');
    title.textContent = 'Source Control';
    header.appendChild(title);

    const refreshBtn = document.createElement('button');
    refreshBtn.title = 'Refresh';
    refreshBtn.style.cssText = 'width: 20px; height: 20px; border: none; background: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; padding: 0;';
    const refreshIcon = document.createElement('span');
    refreshIcon.className = 'codicon codicon-refresh';
    refreshBtn.appendChild(refreshIcon);
    refreshBtn.addEventListener('click', () => this.loadChanges());
    refreshBtn.addEventListener('mouseenter', () => { refreshBtn.style.color = 'var(--text-primary)'; refreshBtn.style.background = 'var(--bg-hover)'; });
    refreshBtn.addEventListener('mouseleave', () => { refreshBtn.style.color = 'var(--text-muted)'; refreshBtn.style.background = ''; });
    header.appendChild(refreshBtn);

    this.el.appendChild(header);

    // Results
    this.resultsEl = document.createElement('div');
    this.resultsEl.style.cssText = 'flex: 1; overflow-y: auto; font-size: 12px;';
    this.el.appendChild(this.resultsEl);

    await this.loadChanges();
  }

  private async loadChanges(): Promise<void> {
    if (!this.resultsEl) return;
    this.resultsEl.textContent = '';

    const folders: string[] = await (window as any).pmOs.workspace.getFolders();
    if (!folders.length) {
      this.showEmpty('No workspace open');
      return;
    }

    let totalChanges = 0;

    for (const folder of folders) {
      const folderName = folder.split('/').pop() || folder;
      const files: { status: string; path: string }[] = await (window as any).pmOs.git.statusFiles(folder);

      if (files.length === 0) continue;
      totalChanges += files.length;

      // Folder header (if multi-folder workspace)
      if (folders.length > 1) {
        const folderHeader = document.createElement('div');
        folderHeader.style.cssText = 'padding: 6px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-primary); border-bottom: 1px solid var(--border);';
        folderHeader.textContent = folderName;
        this.resultsEl.appendChild(folderHeader);
      }

      // Changed files
      for (const file of files) {
        const row = document.createElement('div');
        row.style.cssText = 'padding: 4px 12px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: background 100ms ease;';
        row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-hover)'; });
        row.addEventListener('mouseleave', () => { row.style.background = ''; });

        // Status indicator
        const statusEl = document.createElement('span');
        const statusColor = this.getStatusColor(file.status);
        statusEl.style.cssText = `font-size: 11px; font-weight: 600; width: 14px; text-align: center; flex-shrink: 0; color: ${statusColor};`;
        statusEl.textContent = file.status;
        statusEl.title = this.getStatusLabel(file.status);
        row.appendChild(statusEl);

        // File icon
        const icon = document.createElement('span');
        icon.className = 'codicon codicon-file';
        icon.style.cssText = 'color: var(--text-muted); flex-shrink: 0;';
        row.appendChild(icon);

        // File name
        const fileName = file.path.split('/').pop() || file.path;
        const nameEl = document.createElement('span');
        nameEl.style.cssText = 'color: var(--text-primary); white-space: nowrap;';
        nameEl.textContent = fileName;
        row.appendChild(nameEl);

        // File path
        const pathEl = document.createElement('span');
        pathEl.style.cssText = 'color: var(--text-muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;';
        pathEl.textContent = file.path;
        row.appendChild(pathEl);

        // Click to open file
        row.addEventListener('click', () => {
          const fullPath = folder + '/' + file.path;
          if (this.onOpenFile) {
            this.onOpenFile({ name: fileName, path: fullPath, isDirectory: false });
          }
        });

        this.resultsEl.appendChild(row);
      }
    }

    if (totalChanges === 0) {
      this.showEmpty('No changes detected');
    }
  }

  private showEmpty(message: string): void {
    if (!this.resultsEl) return;
    const emptyEl = document.createElement('div');
    emptyEl.style.cssText = 'padding: 24px; color: var(--text-muted); font-size: 12px; text-align: center;';

    const icon = document.createElement('div');
    icon.className = 'codicon codicon-check';
    icon.style.cssText = 'font-size: 24px; margin-bottom: 8px; color: var(--success);';
    emptyEl.appendChild(icon);

    const msg = document.createElement('div');
    msg.textContent = message;
    emptyEl.appendChild(msg);

    this.resultsEl.appendChild(emptyEl);
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'M': return 'var(--warning)';
      case 'A': return 'var(--success)';
      case 'D': return 'var(--error)';
      case '??': return 'var(--text-muted)';
      case 'R': return 'var(--accent)';
      default: return 'var(--text-secondary)';
    }
  }

  private getStatusLabel(status: string): string {
    switch (status) {
      case 'M': return 'Modified';
      case 'A': return 'Added';
      case 'D': return 'Deleted';
      case '??': return 'Untracked';
      case 'R': return 'Renamed';
      default: return status;
    }
  }
}
