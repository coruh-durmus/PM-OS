interface ContextMenuActions {
  onRename: () => void;
  onChangeCwd: () => void;
  onClear: () => void;
  onKill: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onSelectDefaultShell: () => void;
}

interface MenuItem {
  label: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
  separatorAfter?: boolean;
  destructive?: boolean;
}

export class TerminalContextMenu {
  private el: HTMLElement;
  private anchorEl: HTMLElement;
  private visible = false;
  private outsideClickHandler: (e: MouseEvent) => void;
  private escapeHandler: (e: KeyboardEvent) => void;

  constructor(anchorEl: HTMLElement, actions: ContextMenuActions) {
    this.anchorEl = anchorEl;

    const items: MenuItem[] = [
      { label: 'Rename Terminal', icon: 'codicon-edit', action: actions.onRename },
      { label: 'Change Working Directory', icon: 'codicon-folder-opened', action: actions.onChangeCwd },
      { label: 'Clear Terminal', icon: 'codicon-clear-all', shortcut: '\u2318K', action: actions.onClear },
      { label: 'Kill Terminal', icon: 'codicon-trash', action: actions.onKill, separatorAfter: true, destructive: true },
      { label: 'Copy', icon: 'codicon-copy', shortcut: '\u2318C', action: actions.onCopy },
      { label: 'Paste', icon: 'codicon-clippy', shortcut: '\u2318V', action: actions.onPaste, separatorAfter: true },
      { label: 'Select Default Shell', icon: 'codicon-terminal', action: actions.onSelectDefaultShell },
    ];

    this.el = document.createElement('div');
    this.el.className = 'terminal-context-menu';
    this.el.style.cssText = 'position: fixed; z-index: 1000; display: none; min-width: 220px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); overflow: hidden; font-size: 13px; padding: 4px 0;';

    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'terminal-context-menu-item';
      row.style.cssText = 'padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: var(--text-primary); transition: background 100ms ease;';

      if (item.icon) {
        const iconEl = document.createElement('span');
        iconEl.className = `codicon ${item.icon}`;
        iconEl.style.cssText = 'color: var(--text-muted); flex-shrink: 0;';
        row.appendChild(iconEl);
      }

      const label = document.createElement('span');
      label.style.cssText = 'flex: 1;';
      label.textContent = item.label;
      if (item.destructive) label.style.color = 'var(--error)';
      row.appendChild(label);

      if (item.shortcut) {
        const shortcut = document.createElement('span');
        shortcut.textContent = item.shortcut;
        shortcut.style.cssText = "color: var(--text-muted); font-size: 11px; font-family: 'SF Mono', 'Fira Code', Menlo, monospace; flex-shrink: 0;";
        row.appendChild(shortcut);
      }

      row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-hover)'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      row.addEventListener('click', () => { item.action(); this.hide(); });

      this.el.appendChild(row);

      if (item.separatorAfter) {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: var(--border); margin: 4px 0;';
        this.el.appendChild(sep);
      }
    }

    document.body.appendChild(this.el);

    this.outsideClickHandler = (e: MouseEvent) => {
      if (!this.el.contains(e.target as Node) && !this.anchorEl.contains(e.target as Node)) {
        this.hide();
      }
    };

    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.hide();
    };
  }

  toggle(): void {
    if (this.visible) { this.hide(); } else { this.show(); }
  }

  show(): void {
    const rect = this.anchorEl.getBoundingClientRect();
    this.el.style.top = `${rect.bottom + 4}px`;
    this.el.style.right = `${window.innerWidth - rect.right}px`;
    this.el.style.left = 'auto';
    this.el.style.display = 'block';
    this.visible = true;

    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler);
      document.addEventListener('keydown', this.escapeHandler);
    }, 0);
  }

  hide(): void {
    this.el.style.display = 'none';
    this.visible = false;
    document.removeEventListener('click', this.outsideClickHandler);
    document.removeEventListener('keydown', this.escapeHandler);
  }
}
