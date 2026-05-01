export interface SidebarSectionAction {
  icon: string;
  title: string;
  onClick: () => void;
}

export interface SidebarSectionOptions {
  id: string;
  title: string;
  defaultCollapsed?: boolean;
  growToFill?: boolean;
}

export class SidebarSection {
  el: HTMLElement;
  contentEl: HTMLElement;

  private headerEl: HTMLElement;
  private titleEl: HTMLElement;
  private subtitleEl: HTMLElement;
  private actionsEl: HTMLElement;
  private chevronEl: HTMLElement;
  private collapsed: boolean;
  private storageKey: string;

  constructor(opts: SidebarSectionOptions) {
    this.storageKey = `sidebar-section-${opts.id}`;
    const stored = localStorage.getItem(this.storageKey);
    if (stored === 'collapsed') this.collapsed = true;
    else if (stored === 'expanded') this.collapsed = false;
    else this.collapsed = !!opts.defaultCollapsed;

    this.el = document.createElement('div');
    this.el.className = 'sidebar-section' + (opts.growToFill ? ' grow' : '') + (this.collapsed ? ' collapsed' : '');
    this.el.dataset.sectionId = opts.id;

    this.headerEl = document.createElement('div');
    this.headerEl.className = 'sidebar-section-header';

    this.chevronEl = document.createElement('span');
    this.chevronEl.className = 'codicon ' + (this.collapsed ? 'codicon-chevron-right' : 'codicon-chevron-down');
    this.headerEl.appendChild(this.chevronEl);

    this.titleEl = document.createElement('span');
    this.titleEl.className = 'sidebar-section-title';
    this.titleEl.textContent = opts.title;
    this.headerEl.appendChild(this.titleEl);

    this.subtitleEl = document.createElement('span');
    this.subtitleEl.className = 'sidebar-section-subtitle';
    this.headerEl.appendChild(this.subtitleEl);

    this.actionsEl = document.createElement('span');
    this.actionsEl.className = 'sidebar-section-actions';
    this.headerEl.appendChild(this.actionsEl);

    this.headerEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.sidebar-section-actions')) return;
      this.setCollapsed(!this.collapsed);
    });

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'sidebar-section-content';

    this.el.appendChild(this.headerEl);
    this.el.appendChild(this.contentEl);
  }

  setCollapsed(value: boolean): void {
    this.collapsed = value;
    this.el.classList.toggle('collapsed', value);
    this.chevronEl.classList.toggle('codicon-chevron-right', value);
    this.chevronEl.classList.toggle('codicon-chevron-down', !value);
    try { localStorage.setItem(this.storageKey, value ? 'collapsed' : 'expanded'); } catch {}
  }

  isCollapsed(): boolean {
    return this.collapsed;
  }

  setTitle(title: string): void {
    this.titleEl.textContent = title;
  }

  setSubtitle(subtitle: string | null): void {
    this.subtitleEl.textContent = subtitle ?? '';
  }

  setActions(actions: SidebarSectionAction[]): void {
    while (this.actionsEl.firstChild) this.actionsEl.removeChild(this.actionsEl.firstChild);
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.title = action.title;
      btn.type = 'button';
      const icon = document.createElement('span');
      icon.className = 'codicon ' + action.icon;
      btn.appendChild(icon);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        action.onClick();
      });
      this.actionsEl.appendChild(btn);
    }
  }

  dispose(): void {
    // Sections themselves hold no listeners other than the header click,
    // which is destroyed when the element is removed from the DOM.
  }
}
