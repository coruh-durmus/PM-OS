interface BookmarkFolder {
  id: string;
  name: string;
  items: BookmarkItem[];
  collapsed: boolean;
}

interface BookmarkItem {
  id: string;
  title: string;
  url: string;
}

interface BrowserTab {
  id: string;
  title: string;
  url: string;
}

export class BrowserSidebar {
  private el: HTMLElement;
  private folders: BookmarkFolder[] = [];
  private rootBookmarks: BookmarkItem[] = []; // bookmarks not in any folder
  private tabs: BrowserTab[] = [];
  private activeTabId: string | null = null;
  private onNavigate: (url: string) => void;
  private onToggle: (() => void) | null = null;
  private dragData: { type: 'tab' | 'bookmark'; id: string; sourceFolder?: string } | null = null;
  private collapsed = false;

  constructor(container: HTMLElement, callbacks: { onNavigate: (url: string) => void; onNewTab: () => void }) {
    this.el = container;
    this.onNavigate = callbacks.onNavigate;
    this.collapsed = localStorage.getItem('pm-os-browser-sidebar-collapsed') === 'true';
    this.loadBookmarks();
  }

  setOnToggle(cb: () => void): void {
    this.onToggle = cb;
  }

  show(): void {
    if (this.collapsed) {
      this.el.style.display = 'none';
    } else {
      this.el.style.display = 'flex';
      this.render();
    }
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
    localStorage.setItem('pm-os-browser-sidebar-collapsed', String(this.collapsed));
    if (this.collapsed) {
      this.el.style.display = 'none';
    } else {
      this.el.style.display = 'flex';
      this.render();
    }
    this.onToggle?.();
  }

  get isVisible(): boolean {
    return this.el.style.display !== 'none' && !this.collapsed;
  }

  get isCollapsed(): boolean {
    return this.collapsed;
  }

  addTab(url: string, title: string): void {
    const tab: BrowserTab = { id: 'tab-' + Date.now(), title: title || url, url };
    this.tabs.push(tab);
    this.activeTabId = tab.id;
    this.render();
  }

  setActiveUrl(url: string, title: string): void {
    const active = this.tabs.find(t => t.id === this.activeTabId);
    if (active) {
      if (url) active.url = url;
      if (title) active.title = title;
    }
    this.render();
  }

  /** Compat shim — called by panel-container when page title changes */
  updateActiveTab(url: string, title: string): void {
    this.setActiveUrl(url, title);
  }

  private render(): void {
    while (this.el.firstChild) this.el.removeChild(this.el.firstChild);
    this.el.style.cssText = 'display: flex; flex-direction: column; width: 220px; min-width: 220px; background: var(--bg-secondary); border-right: 1px solid var(--border); overflow: hidden; font-size: 12px;';

    this.renderAddressBar();
    this.renderBookmarksSection();
    this.renderTabsSection();
  }

  // ─── ADDRESS BAR ───
  private renderAddressBar(): void {
    const bar = document.createElement('div');
    bar.style.cssText = 'padding: 8px; border-bottom: 1px solid var(--border); flex-shrink: 0;';

    // Toggle button row
    const toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 4px;';
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '\u00AB'; // «
    toggleBtn.title = 'Hide sidebar (Cmd+B)';
    toggleBtn.style.cssText = 'background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 0 4px; border-radius: var(--radius-sm);';
    toggleBtn.addEventListener('mouseenter', () => toggleBtn.style.color = 'var(--text-primary)');
    toggleBtn.addEventListener('mouseleave', () => toggleBtn.style.color = 'var(--text-muted)');
    toggleBtn.addEventListener('click', () => this.toggle());
    toggleRow.appendChild(toggleBtn);
    bar.appendChild(toggleRow);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search or enter URL...';
    const active = this.tabs.find(t => t.id === this.activeTabId);
    if (active) input.value = active.url;
    input.style.cssText = 'width: 100%; padding: 5px 8px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 11px; outline: none; font-family: var(--font-sans); box-sizing: border-box;';
    input.addEventListener('focus', () => { input.select(); input.style.borderColor = 'var(--accent)'; });
    input.addEventListener('blur', () => input.style.borderColor = 'var(--border)');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let url = input.value.trim();
        if (!url) return;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = url.includes('.') && !url.includes(' ') ? 'https://' + url : 'https://www.google.com/search?q=' + encodeURIComponent(url);
        }
        // Navigate current tab
        const activeTab = this.tabs.find(t => t.id === this.activeTabId);
        if (activeTab) {
          activeTab.url = url;
          this.onNavigate(url);
        }
      }
    });

    bar.appendChild(input);
    this.el.appendChild(bar);
  }

  // ─── BOOKMARKS ───
  private renderBookmarksSection(): void {
    const section = document.createElement('div');
    section.style.cssText = 'border-bottom: 1px solid var(--border); flex-shrink: 0; max-height: 40%; overflow-y: auto;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 4px 10px; display: flex; justify-content: space-between; align-items: center;';

    const title = document.createElement('span');
    title.textContent = 'Bookmarks';
    title.style.cssText = 'font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-muted);';
    header.appendChild(title);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 2px;';

    // Add folder button
    const addFolderBtn = document.createElement('button');
    addFolderBtn.textContent = '\uD83D\uDCC1+';
    addFolderBtn.title = 'New folder';
    addFolderBtn.style.cssText = 'background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 10px; padding: 0 3px;';
    addFolderBtn.addEventListener('click', () => this.createFolder());
    btnRow.appendChild(addFolderBtn);

    // Add bookmark button (bookmark current page)
    const addBmBtn = document.createElement('button');
    addBmBtn.textContent = '\u2B50+';
    addBmBtn.title = 'Bookmark current page';
    addBmBtn.style.cssText = 'background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 10px; padding: 0 3px;';
    addBmBtn.addEventListener('click', () => this.bookmarkCurrentPage());
    btnRow.appendChild(addBmBtn);

    header.appendChild(btnRow);
    section.appendChild(header);

    // Drop zone for root level
    section.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      section.style.background = 'rgba(137,180,250,0.05)';
    });
    section.addEventListener('dragleave', () => {
      section.style.background = '';
    });
    section.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      section.style.background = '';
      this.handleDrop(null); // drop to root
    });

    // Render folders
    for (const folder of this.folders) {
      section.appendChild(this.renderFolder(folder));
    }

    // Render root bookmarks (not in any folder)
    for (const bm of this.rootBookmarks) {
      section.appendChild(this.renderBookmarkItem(bm, null));
    }

    if (this.folders.length === 0 && this.rootBookmarks.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 4px 10px 6px; font-size: 10px; color: var(--text-muted); font-style: italic;';
      empty.textContent = 'Drag tabs here to bookmark';
      section.appendChild(empty);
    }

    this.el.appendChild(section);
  }

  private renderFolder(folder: BookmarkFolder): HTMLElement {
    const container = document.createElement('div');

    // Folder header
    const row = document.createElement('div');
    row.style.cssText = 'padding: 3px 10px; display: flex; align-items: center; gap: 4px; cursor: pointer; color: var(--text-secondary);';
    row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-hover)');
    row.addEventListener('mouseleave', () => row.style.background = '');

    const chevron = document.createElement('span');
    chevron.textContent = folder.collapsed ? '\u25B6' : '\u25BC';
    chevron.style.cssText = 'font-size: 7px; width: 10px; color: var(--text-muted); flex-shrink: 0;';
    row.appendChild(chevron);

    const icon = document.createElement('span');
    icon.textContent = '\uD83D\uDCC1';
    icon.style.cssText = 'font-size: 11px; flex-shrink: 0;';
    row.appendChild(icon);

    const name = document.createElement('span');
    name.textContent = folder.name;
    name.style.cssText = 'font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;';
    row.appendChild(name);

    // Delete folder
    const delBtn = document.createElement('span');
    delBtn.textContent = '\u00D7';
    delBtn.style.cssText = 'color: var(--text-muted); cursor: pointer; font-size: 12px; opacity: 0; transition: opacity 0.1s;';
    row.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
    row.addEventListener('mouseleave', () => delBtn.style.opacity = '0');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.folders = this.folders.filter(f => f.id !== folder.id);
      this.saveBookmarks();
      this.render();
    });
    row.appendChild(delBtn);

    row.addEventListener('click', () => {
      folder.collapsed = !folder.collapsed;
      this.saveBookmarks();
      this.render();
    });

    // Drop zone for this folder
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.style.background = 'rgba(137,180,250,0.15)';
      row.style.outline = '1px solid var(--accent)';
    });
    row.addEventListener('dragleave', () => {
      row.style.background = '';
      row.style.outline = '';
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.style.background = '';
      row.style.outline = '';
      this.handleDrop(folder.id);
    });

    container.appendChild(row);

    // Folder contents
    if (!folder.collapsed) {
      for (const bm of folder.items) {
        const bmEl = this.renderBookmarkItem(bm, folder.id);
        bmEl.style.paddingLeft = '26px'; // indent
        container.appendChild(bmEl);
      }
    }

    return container;
  }

  private renderBookmarkItem(bm: BookmarkItem, folderId: string | null): HTMLElement {
    const item = document.createElement('div');
    item.style.cssText = 'padding: 3px 10px; display: flex; align-items: center; gap: 5px; cursor: pointer; color: var(--text-secondary); white-space: nowrap;';
    item.draggable = true;
    item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-hover)');
    item.addEventListener('mouseleave', () => item.style.background = '');

    // Drag
    item.addEventListener('dragstart', (e) => {
      this.dragData = { type: 'bookmark', id: bm.id, sourceFolder: folderId ?? undefined };
      e.dataTransfer?.setData('text/plain', bm.url);
      item.style.opacity = '0.4';
    });
    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
      this.dragData = null;
    });

    const icon = document.createElement('span');
    icon.textContent = '\u2B50';
    icon.style.cssText = 'font-size: 9px; flex-shrink: 0;';
    item.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = bm.title || bm.url;
    label.style.cssText = 'overflow: hidden; text-overflow: ellipsis; flex: 1; font-size: 11px;';
    item.appendChild(label);

    // Delete on hover
    const delBtn = document.createElement('span');
    delBtn.textContent = '\u00D7';
    delBtn.style.cssText = 'color: var(--text-muted); cursor: pointer; font-size: 11px; opacity: 0;';
    item.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
    item.addEventListener('mouseleave', () => delBtn.style.opacity = '0');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeBookmark(bm.id, folderId);
    });
    item.appendChild(delBtn);

    item.addEventListener('click', () => {
      // Navigate current tab to this bookmark
      const active = this.tabs.find(t => t.id === this.activeTabId);
      if (active) {
        active.url = bm.url;
        active.title = bm.title;
        this.onNavigate(bm.url);
        this.render();
      }
    });

    return item;
  }

  // ─── TABS ───
  private renderTabsSection(): void {
    const section = document.createElement('div');
    section.style.cssText = 'flex: 1; overflow-y: auto; padding: 4px 0;';

    // New Tab button
    const newTabBtn = document.createElement('div');
    newTabBtn.style.cssText = 'padding: 5px 10px; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-muted);';
    newTabBtn.addEventListener('mouseenter', () => newTabBtn.style.background = 'var(--bg-hover)');
    newTabBtn.addEventListener('mouseleave', () => newTabBtn.style.background = '');

    const plus = document.createElement('span');
    plus.textContent = '+';
    plus.style.cssText = 'font-size: 14px;';
    newTabBtn.appendChild(plus);

    const label = document.createElement('span');
    label.textContent = 'New Tab';
    newTabBtn.appendChild(label);

    newTabBtn.addEventListener('click', () => {
      this.openNewTab();
    });
    section.appendChild(newTabBtn);

    // Tab list
    for (const tab of this.tabs) {
      const isActive = tab.id === this.activeTabId;
      const item = document.createElement('div');
      item.style.cssText = `padding: 5px 10px; display: flex; align-items: center; gap: 5px; cursor: pointer; color: ${isActive ? 'var(--text-primary)' : 'var(--text-secondary)'}; background: ${isActive ? 'var(--bg-surface)' : ''}; white-space: nowrap; border-left: ${isActive ? '2px solid var(--accent)' : '2px solid transparent'};`;
      item.draggable = true;
      item.addEventListener('mouseenter', () => { if (!isActive) item.style.background = 'var(--bg-hover)'; });
      item.addEventListener('mouseleave', () => { if (!isActive) item.style.background = ''; });

      // Drag (for dragging to bookmarks)
      item.addEventListener('dragstart', (e) => {
        this.dragData = { type: 'tab', id: tab.id };
        e.dataTransfer?.setData('text/plain', tab.url);
        item.style.opacity = '0.4';
      });
      item.addEventListener('dragend', () => {
        item.style.opacity = '1';
        this.dragData = null;
      });

      const favicon = document.createElement('span');
      favicon.textContent = '\uD83C\uDF10';
      favicon.style.cssText = 'font-size: 10px; flex-shrink: 0;';
      item.appendChild(favicon);

      const tabLabel = document.createElement('span');
      tabLabel.textContent = tab.title || tab.url;
      tabLabel.style.cssText = 'overflow: hidden; text-overflow: ellipsis; flex: 1; font-size: 11px;';
      item.appendChild(tabLabel);

      // Close tab
      if (this.tabs.length > 1) {
        const closeBtn = document.createElement('span');
        closeBtn.textContent = '\u00D7';
        closeBtn.style.cssText = 'color: var(--text-muted); cursor: pointer; font-size: 11px; opacity: 0;';
        item.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
        item.addEventListener('mouseleave', () => closeBtn.style.opacity = '0');
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeTab(tab.id);
        });
        item.appendChild(closeBtn);
      }

      item.addEventListener('click', () => {
        this.switchToTab(tab.id);
      });

      section.appendChild(item);
    }

    this.el.appendChild(section);
  }

  // ─── TAB ACTIONS ───
  private openNewTab(): void {
    const url = 'https://www.google.com';
    const tab: BrowserTab = { id: 'tab-' + Date.now(), title: 'New Tab', url };
    this.tabs.push(tab);
    this.activeTabId = tab.id;
    this.onNavigate(url);
    this.render();
  }

  private switchToTab(tabId: string): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    this.activeTabId = tabId;
    this.onNavigate(tab.url);
    this.render();
  }

  private closeTab(tabId: string): void {
    const idx = this.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    this.tabs.splice(idx, 1);
    if (this.activeTabId === tabId) {
      const nextTab = this.tabs[Math.min(idx, this.tabs.length - 1)];
      if (nextTab) {
        this.activeTabId = nextTab.id;
        this.onNavigate(nextTab.url);
      }
    }
    this.render();
  }

  // ─── DRAG & DROP ───
  private handleDrop(targetFolderId: string | null): void {
    if (!this.dragData) return;

    if (this.dragData.type === 'tab') {
      // Tab dropped onto bookmarks -> create bookmark
      const tab = this.tabs.find(t => t.id === this.dragData!.id);
      if (!tab) return;
      const bm: BookmarkItem = { id: 'bm-' + Date.now(), title: tab.title, url: tab.url };
      if (targetFolderId) {
        const folder = this.folders.find(f => f.id === targetFolderId);
        if (folder && !folder.items.some(i => i.url === bm.url)) folder.items.push(bm);
      } else {
        if (!this.rootBookmarks.some(b => b.url === bm.url)) this.rootBookmarks.push(bm);
      }
    } else if (this.dragData.type === 'bookmark') {
      // Bookmark moved between folders
      const bmId = this.dragData.id;
      const sourceFolder = this.dragData.sourceFolder;
      let bm: BookmarkItem | undefined;

      // Remove from source
      if (sourceFolder) {
        const sf = this.folders.find(f => f.id === sourceFolder);
        if (sf) {
          const idx = sf.items.findIndex(i => i.id === bmId);
          if (idx !== -1) bm = sf.items.splice(idx, 1)[0];
        }
      } else {
        const idx = this.rootBookmarks.findIndex(b => b.id === bmId);
        if (idx !== -1) bm = this.rootBookmarks.splice(idx, 1)[0];
      }

      // Add to target
      if (bm) {
        if (targetFolderId) {
          const tf = this.folders.find(f => f.id === targetFolderId);
          if (tf) tf.items.push(bm);
        } else {
          this.rootBookmarks.push(bm);
        }
      }
    }

    this.dragData = null;
    this.saveBookmarks();
    this.render();
  }

  // ─── BOOKMARK ACTIONS ───
  private bookmarkCurrentPage(): void {
    const active = this.tabs.find(t => t.id === this.activeTabId);
    if (!active) return;
    if (this.rootBookmarks.some(b => b.url === active.url)) return;
    this.rootBookmarks.push({ id: 'bm-' + Date.now(), title: active.title, url: active.url });
    this.saveBookmarks();
    this.render();
  }

  private createFolder(): void {
    const name = 'New Folder';
    this.folders.push({ id: 'folder-' + Date.now(), name, items: [], collapsed: false });
    this.saveBookmarks();
    this.render();
  }

  private removeBookmark(bmId: string, folderId: string | null): void {
    if (folderId) {
      const folder = this.folders.find(f => f.id === folderId);
      if (folder) folder.items = folder.items.filter(i => i.id !== bmId);
    } else {
      this.rootBookmarks = this.rootBookmarks.filter(b => b.id !== bmId);
    }
    this.saveBookmarks();
    this.render();
  }

  // ─── PERSISTENCE ───
  private loadBookmarks(): void {
    try {
      const raw = localStorage.getItem('pm-os-bookmarks-v2');
      if (raw) {
        const data = JSON.parse(raw);
        this.folders = data.folders || [];
        this.rootBookmarks = data.root || [];
      }
    } catch {}
  }

  private saveBookmarks(): void {
    localStorage.setItem('pm-os-bookmarks-v2', JSON.stringify({
      folders: this.folders,
      root: this.rootBookmarks,
    }));
  }
}
