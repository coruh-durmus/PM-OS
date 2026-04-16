export class TerminalDropdown {
  private el: HTMLElement;
  private anchorEl: HTMLElement;
  private onSelect: (shell: string) => void;
  private visible = false;
  private outsideClickHandler: (e: MouseEvent) => void;
  private escapeHandler: (e: KeyboardEvent) => void;
  private items: Map<string, HTMLElement> = new Map();

  constructor(anchorEl: HTMLElement, onSelect: (shell: string) => void) {
    this.anchorEl = anchorEl;
    this.onSelect = onSelect;

    this.el = document.createElement('div');
    this.el.className = 'terminal-dropdown';
    this.el.style.cssText = 'position: fixed; z-index: 1000; display: none; min-width: 160px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); overflow: hidden; font-size: 13px;';

    const shells = ['zsh', 'bash'];
    for (const shell of shells) {
      const item = document.createElement('div');
      item.className = 'terminal-dropdown-item';
      item.style.cssText = 'padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: var(--text-primary); transition: background 100ms ease;';

      const checkmark = document.createElement('span');
      checkmark.className = 'codicon codicon-check';
      checkmark.style.cssText = 'width: 16px; font-size: 14px; color: var(--accent); visibility: hidden;';
      item.appendChild(checkmark);

      const iconEl = document.createElement('span');
      iconEl.className = 'codicon codicon-terminal';
      iconEl.style.cssText = 'color: var(--text-muted);';
      item.appendChild(iconEl);

      const label = document.createElement('span');
      label.textContent = shell;
      item.appendChild(label);

      item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-hover)'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
      item.addEventListener('click', () => { this.onSelect(shell); this.hide(); });

      this.el.appendChild(item);
      this.items.set(shell, checkmark);
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
    // Update checkmarks based on current default
    const defaultShell = localStorage.getItem('pm-os-default-shell') || 'zsh';
    for (const [shell, checkEl] of this.items) {
      checkEl.style.visibility = shell === defaultShell ? 'visible' : 'hidden';
    }

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
