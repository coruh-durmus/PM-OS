interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
}

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

export class BrowserSidebar {
  private el: HTMLElement;
  private bookmarks: Bookmark[] = [];
  private tabs: BrowserTab[] = [];
  private onNavigate: (url: string) => void;
  private onNewTab: () => void;
  private visible = false;

  constructor(container: HTMLElement, callbacks: { onNavigate: (url: string) => void; onNewTab: () => void }) {
    this.el = container;
    this.onNavigate = callbacks.onNavigate;
    this.onNewTab = callbacks.onNewTab;
    this.loadBookmarks();
  }

  show(): void {
    this.visible = true;
    this.el.style.display = 'flex';
    this.render();
  }

  hide(): void {
    this.visible = false;
    this.el.style.display = 'none';
  }

  get isVisible(): boolean { return this.visible; }

  updateActiveTab(url: string, title: string): void {
    const active = this.tabs.find(t => t.active);
    if (active) {
      active.url = url;
      active.title = title || url;
    }
    this.render();
  }

  render(): void {
    while (this.el.firstChild) this.el.removeChild(this.el.firstChild);
    this.el.style.cssText = 'display: flex; flex-direction: column; width: 220px; min-width: 220px; background: var(--bg-secondary); border-right: 1px solid var(--border); overflow: hidden; font-size: 12px;';

    // Address bar
    this.renderAddressBar();

    // Bookmarks section
    this.renderBookmarks();

    // Tabs section
    this.renderTabs();
  }

  private renderAddressBar(): void {
    const bar = document.createElement('div');
    bar.style.cssText = 'padding: 8px; border-bottom: 1px solid var(--border); flex-shrink: 0;';

    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display: flex; gap: 4px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search or enter URL...';
    const activeTab = this.tabs.find(t => t.active);
    if (activeTab) input.value = activeTab.url;
    input.style.cssText = 'flex: 1; padding: 5px 8px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 11px; outline: none; font-family: var(--font-sans); min-width: 0;';
    input.addEventListener('focus', () => { input.select(); input.style.borderColor = 'var(--accent)'; });
    input.addEventListener('blur', () => input.style.borderColor = 'var(--border)');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let url = input.value.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          if (url.includes('.') && !url.includes(' ')) {
            url = 'https://' + url;
          } else {
            url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
          }
        }
        this.onNavigate(url);
      }
    });

    inputRow.appendChild(input);
    bar.appendChild(inputRow);
    this.el.appendChild(bar);
  }

  private renderBookmarks(): void {
    const section = document.createElement('div');
    section.style.cssText = 'padding: 6px 0; border-bottom: 1px solid var(--border); flex-shrink: 0;';

    const header = document.createElement('div');
    header.style.cssText = 'padding: 2px 10px; display: flex; justify-content: space-between; align-items: center;';

    const title = document.createElement('span');
    title.textContent = 'Bookmarks';
    title.style.cssText = 'font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-muted);';
    header.appendChild(title);

    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.title = 'Bookmark current page';
    addBtn.style.cssText = 'background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 0 4px;';
    addBtn.addEventListener('click', () => this.bookmarkCurrentPage());
    header.appendChild(addBtn);

    section.appendChild(header);

    for (const bm of this.bookmarks) {
      const item = document.createElement('div');
      item.style.cssText = 'padding: 4px 10px; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-hover)');
      item.addEventListener('mouseleave', () => item.style.background = '');

      const icon = document.createElement('span');
      icon.textContent = '\u2B50';
      icon.style.cssText = 'font-size: 10px; flex-shrink: 0;';
      item.appendChild(icon);

      const label = document.createElement('span');
      label.textContent = bm.title || bm.url;
      label.style.cssText = 'overflow: hidden; text-overflow: ellipsis;';
      item.appendChild(label);

      item.addEventListener('click', () => this.onNavigate(bm.url));

      // Right-click to remove
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.bookmarks = this.bookmarks.filter(b => b.id !== bm.id);
        this.saveBookmarks();
        this.render();
      });

      section.appendChild(item);
    }

    if (this.bookmarks.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 4px 10px; font-size: 10px; color: var(--text-muted); font-style: italic;';
      empty.textContent = 'No bookmarks yet';
      section.appendChild(empty);
    }

    this.el.appendChild(section);
  }

  private renderTabs(): void {
    const section = document.createElement('div');
    section.style.cssText = 'flex: 1; overflow-y: auto; padding: 6px 0;';

    // New tab button
    const newTab = document.createElement('div');
    newTab.style.cssText = 'padding: 5px 10px; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-muted);';
    newTab.addEventListener('mouseenter', () => newTab.style.background = 'var(--bg-hover)');
    newTab.addEventListener('mouseleave', () => newTab.style.background = '');

    const plusIcon = document.createElement('span');
    plusIcon.textContent = '+';
    plusIcon.style.cssText = 'font-size: 14px;';
    newTab.appendChild(plusIcon);

    const newTabLabel = document.createElement('span');
    newTabLabel.textContent = 'New Tab';
    newTab.appendChild(newTabLabel);

    newTab.addEventListener('click', () => this.onNewTab());
    section.appendChild(newTab);

    // Tab list
    for (const tab of this.tabs) {
      const item = document.createElement('div');
      item.style.cssText = `padding: 5px 10px; display: flex; align-items: center; gap: 6px; cursor: pointer; color: ${tab.active ? 'var(--text-primary)' : 'var(--text-secondary)'}; background: ${tab.active ? 'var(--bg-surface)' : ''}; white-space: nowrap; overflow: hidden; border-radius: 0;`;
      item.addEventListener('mouseenter', () => { if (!tab.active) item.style.background = 'var(--bg-hover)'; });
      item.addEventListener('mouseleave', () => { if (!tab.active) item.style.background = ''; });

      const favicon = document.createElement('span');
      favicon.textContent = '\uD83C\uDF10';
      favicon.style.cssText = 'font-size: 10px; flex-shrink: 0;';
      item.appendChild(favicon);

      const label = document.createElement('span');
      label.textContent = tab.title || tab.url;
      label.style.cssText = 'overflow: hidden; text-overflow: ellipsis; flex: 1;';
      item.appendChild(label);

      // Active indicator
      if (tab.active) {
        item.style.borderLeft = '2px solid var(--accent)';
      }

      section.appendChild(item);
    }

    this.el.appendChild(section);
  }

  private bookmarkCurrentPage(): void {
    const active = this.tabs.find(t => t.active);
    if (!active) return;

    // Check if already bookmarked
    if (this.bookmarks.some(b => b.url === active.url)) return;

    this.bookmarks.push({
      id: 'bm-' + Date.now(),
      title: active.title || active.url,
      url: active.url,
    });
    this.saveBookmarks();
    this.render();
  }

  private loadBookmarks(): void {
    try {
      const raw = localStorage.getItem('pm-os-bookmarks');
      if (raw) this.bookmarks = JSON.parse(raw);
    } catch {}
  }

  private saveBookmarks(): void {
    localStorage.setItem('pm-os-bookmarks', JSON.stringify(this.bookmarks));
  }

  // Called by panel-container when browser panel is shown
  addTab(url: string, title: string): void {
    // Deactivate all
    this.tabs.forEach(t => t.active = false);
    this.tabs.push({ id: 'tab-' + Date.now(), title, url, active: true });
    if (this.visible) this.render();
  }

  setActiveUrl(url: string, title: string): void {
    const active = this.tabs.find(t => t.active);
    if (active) {
      active.url = url;
      active.title = title || url;
    }
    if (this.visible) this.render();
  }
}
