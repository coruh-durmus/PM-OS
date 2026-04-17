export class ExtensionStorePanel {
  private el: HTMLElement;
  private resultsEl: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private activeTab: 'marketplace' | 'installed' = 'marketplace';
  private searchOffset: number = 0;
  private searching = false;
  private installedExtensions: any[] = [];
  private installingIds: Set<string> = new Set();

  constructor(container: HTMLElement) {
    this.el = container;
  }

  async render(): Promise<void> {
    this.el.textContent = '';
    this.el.style.cssText = 'height: 100%; display: flex; flex-direction: column; overflow: hidden;';

    // Search bar
    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'padding: 8px 8px 0; flex-shrink: 0;';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search Extensions in Marketplace';
    this.searchInput.style.cssText = 'width: 100%; padding: 4px 8px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 2px; color: var(--text-primary); font-size: 12px; outline: none; font-family: inherit; box-sizing: border-box;';
    this.searchInput.addEventListener('focus', () => { this.searchInput!.style.borderColor = 'var(--accent)'; });
    this.searchInput.addEventListener('blur', () => { this.searchInput!.style.borderColor = 'var(--border)'; });

    let debounceTimer: ReturnType<typeof setTimeout>;
    this.searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { this.searchOffset = 0; this.performSearch(); }, 300);
    });
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { clearTimeout(debounceTimer); this.searchOffset = 0; this.performSearch(); }
    });
    searchWrap.appendChild(this.searchInput);
    this.el.appendChild(searchWrap);

    // Tabs
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display: flex; padding: 0 8px; flex-shrink: 0; margin-top: 4px;';

    try { this.installedExtensions = await (window as any).pmOs.extensionStore.getInstalled(); } catch { this.installedExtensions = []; }

    const mkTab = (label: string, id: 'marketplace' | 'installed') => {
      const tab = document.createElement('button');
      tab.textContent = label;
      const isActive = id === this.activeTab;
      tab.style.cssText = `padding: 6px 12px; border: none; background: none; font-size: 11px; font-weight: 500; cursor: pointer; font-family: inherit; border-bottom: 2px solid ${isActive ? 'var(--accent)' : 'transparent'}; color: ${isActive ? 'var(--text-primary)' : 'var(--text-muted)'}; transition: color 100ms;`;
      tab.addEventListener('click', () => { this.activeTab = id; this.render(); });
      return tab;
    };

    tabBar.appendChild(mkTab('Marketplace', 'marketplace'));
    tabBar.appendChild(mkTab(`Installed (${this.installedExtensions.length})`, 'installed'));
    this.el.appendChild(tabBar);

    const sep = document.createElement('div');
    sep.style.cssText = 'height: 1px; background: var(--border); flex-shrink: 0;';
    this.el.appendChild(sep);

    // Results
    this.resultsEl = document.createElement('div');
    this.resultsEl.style.cssText = 'flex: 1; overflow-y: auto;';
    this.el.appendChild(this.resultsEl);

    if (this.activeTab === 'marketplace') {
      this.performSearch();
    } else {
      this.showInstalled();
    }

    requestAnimationFrame(() => this.searchInput?.focus());
  }

  private async performSearch(): Promise<void> {
    if (!this.resultsEl || this.searching) return;
    this.searching = true;

    const query = this.searchInput?.value || '';
    this.resultsEl.textContent = '';

    const loading = document.createElement('div');
    loading.style.cssText = 'padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;';
    loading.textContent = 'Searching...';
    this.resultsEl.appendChild(loading);

    try {
      const result = await (window as any).pmOs.extensionStore.search(query, undefined, this.searchOffset);
      this.resultsEl.textContent = '';

      if (!result.extensions || result.extensions.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 12px;';
        empty.textContent = query ? `No results for "${query}"` : 'No extensions found';
        this.resultsEl.appendChild(empty);
        this.searching = false;
        return;
      }

      for (const ext of result.extensions) {
        this.renderExtensionRow(ext, this.resultsEl);
      }

      if (result.extensions.length >= 20 && this.searchOffset + 20 < result.totalSize) {
        const loadMore = document.createElement('div');
        loadMore.style.cssText = 'padding: 8px 16px; text-align: center;';
        const btn = document.createElement('button');
        btn.textContent = 'Show More';
        btn.style.cssText = 'padding: 4px 16px; background: none; border: 1px solid var(--border); border-radius: 2px; color: var(--text-muted); cursor: pointer; font-size: 11px; font-family: inherit;';
        btn.addEventListener('click', () => { this.searchOffset += 20; this.performSearch(); });
        loadMore.appendChild(btn);
        this.resultsEl.appendChild(loadMore);
      }
    } catch {
      this.resultsEl.textContent = '';
      const err = document.createElement('div');
      err.style.cssText = 'padding: 16px; text-align: center; color: var(--error); font-size: 12px;';
      err.textContent = 'Failed to connect to Open VSX. Check internet.';
      this.resultsEl.appendChild(err);
    }

    this.searching = false;
  }

  private renderExtensionRow(ext: any, container: HTMLElement): void {
    const isInstalled = this.installedExtensions.some(e => e.id === `${ext.namespace}.${ext.name}`);

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; padding: 8px 10px; gap: 10px; cursor: pointer; transition: background 80ms;';
    row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-hover)'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; });
    row.addEventListener('click', () => this.showDetail(ext));

    // Icon
    const icon = document.createElement('div');
    icon.style.cssText = 'width: 42px; height: 42px; border-radius: 4px; background: var(--bg-surface); flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center;';
    if (ext.iconUrl) {
      const img = document.createElement('img');
      img.src = ext.iconUrl;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
      img.onerror = () => { img.remove(); icon.innerHTML = '<span class="codicon codicon-extensions" style="font-size: 20px; color: var(--text-muted);"></span>'; };
      icon.appendChild(img);
    } else {
      icon.innerHTML = '<span class="codicon codicon-extensions" style="font-size: 20px; color: var(--text-muted);"></span>';
    }
    row.appendChild(icon);

    // Info
    const info = document.createElement('div');
    info.style.cssText = 'flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1px;';

    // Row 1: Name + Install
    const row1 = document.createElement('div');
    row1.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;';
    nameEl.textContent = ext.displayName || ext.name;
    row1.appendChild(nameEl);

    const btn = document.createElement('button');
    const extId = `${ext.namespace}.${ext.name}`;
    if (isInstalled) {
      btn.textContent = 'Installed';
      btn.style.cssText = 'padding: 1px 8px; font-size: 10px; background: none; border: 1px solid var(--border); border-radius: 2px; color: var(--success); cursor: default; font-family: inherit; flex-shrink: 0;';
    } else if (this.installingIds.has(extId)) {
      btn.textContent = 'Installing...';
      btn.style.cssText = 'padding: 1px 8px; font-size: 10px; background: var(--accent); border: none; border-radius: 2px; color: var(--bg-primary); cursor: default; font-family: inherit; flex-shrink: 0; opacity: 0.6;';
      btn.disabled = true;
    } else {
      btn.textContent = 'Install';
      btn.style.cssText = 'padding: 1px 8px; font-size: 10px; background: var(--accent); border: none; border-radius: 2px; color: var(--bg-primary); cursor: pointer; font-weight: 600; font-family: inherit; flex-shrink: 0;';
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        this.installingIds.add(extId);
        btn.textContent = 'Installing...';
        btn.style.opacity = '0.6';
        btn.disabled = true;
        try {
          await (window as any).pmOs.extensionStore.install(ext.namespace, ext.name, ext.version);
          // Hot-load the extension (no restart needed)
          try { await (window as any).pmOs.extensions.activateInstalled(
            (await (window as any).pmOs.extensionStore.getInstalled()).find((e: any) => e.id === extId)?.extensionPath || ''
          ); } catch {}
          // Update installed list
          this.installedExtensions.push({ id: extId, namespace: ext.namespace, name: ext.name, displayName: ext.displayName, version: ext.version });
          this.installingIds.delete(extId);
          btn.textContent = 'Installed';
          btn.style.background = 'none';
          btn.style.border = '1px solid var(--border)';
          btn.style.color = 'var(--success)';
          btn.style.opacity = '1';
        } catch {
          this.installingIds.delete(extId);
          btn.textContent = 'Failed';
          btn.style.background = 'var(--error)';
          setTimeout(() => { btn.textContent = 'Install'; btn.style.background = 'var(--accent)'; btn.style.opacity = '1'; btn.disabled = false; }, 2000);
        }
      });
    }
    row1.appendChild(btn);
    info.appendChild(row1);

    // Row 2: Publisher · downloads · rating
    const row2 = document.createElement('div');
    row2.style.cssText = 'font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    let meta = ext.namespace || '';
    if (ext.downloadCount > 0) meta += ` \u00B7 ${this.formatCount(ext.downloadCount)}`;
    if (ext.averageRating > 0) meta += ` \u00B7 \u2605 ${ext.averageRating.toFixed(1)}`;
    row2.textContent = meta;
    info.appendChild(row2);

    // Row 3: Description
    if (ext.description) {
      const row3 = document.createElement('div');
      row3.style.cssText = 'font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      row3.textContent = ext.description;
      info.appendChild(row3);
    }

    row.appendChild(info);
    container.appendChild(row);
  }

  private async showInstalled(): Promise<void> {
    if (!this.resultsEl) return;
    this.resultsEl.textContent = '';

    if (this.installedExtensions.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 12px;';
      empty.textContent = 'No extensions installed yet.';
      this.resultsEl.appendChild(empty);
      return;
    }

    // Check for updates
    let updates: any[] = [];
    try {
      updates = await (window as any).pmOs.extensionStore.checkUpdates();
    } catch {}

    for (const ext of this.installedExtensions) {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; padding: 8px 10px; gap: 10px; cursor: pointer; transition: background 80ms;';
      row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-hover)'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      // Click to show detail
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        this.showDetail({
          name: ext.name,
          namespace: ext.namespace,
          displayName: ext.displayName,
          description: ext.description,
          version: ext.version,
          iconUrl: ext.iconPath ? `file://${ext.iconPath}` : null,
          downloadCount: 0,
          averageRating: null,
          categories: [],
        });
      });

      const icon = document.createElement('div');
      icon.style.cssText = 'width: 42px; height: 42px; border-radius: 4px; background: var(--bg-surface); flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center;';
      if (ext.iconPath) {
        const img = document.createElement('img');
        img.src = `file://${ext.iconPath}`;
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        img.onerror = () => { img.remove(); icon.innerHTML = '<span class="codicon codicon-extensions" style="font-size: 20px; color: var(--text-muted);"></span>'; };
        icon.appendChild(img);
      } else {
        icon.innerHTML = '<span class="codicon codicon-extensions" style="font-size: 20px; color: var(--text-muted);"></span>';
      }
      row.appendChild(icon);

      const info = document.createElement('div');
      info.style.cssText = 'flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1px;';

      const row1 = document.createElement('div');
      row1.style.cssText = 'display: flex; align-items: center; gap: 6px;';
      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;';
      nameEl.textContent = ext.displayName || ext.name;
      row1.appendChild(nameEl);

      const update = updates.find((u: any) => u.id === ext.id);
      if (update) {
        const updateBtn = document.createElement('button');
        updateBtn.textContent = `Update to v${update.latestVersion}`;
        updateBtn.style.cssText = 'padding: 1px 8px; font-size: 10px; background: var(--accent); border: none; border-radius: 2px; color: var(--bg-primary); cursor: pointer; font-weight: 600; font-family: inherit; flex-shrink: 0; margin-right: 4px;';
        updateBtn.addEventListener('click', async () => {
          updateBtn.textContent = 'Updating...';
          updateBtn.disabled = true;
          try {
            await (window as any).pmOs.extensionStore.update(ext.namespace, ext.name, update.latestVersion);
            updateBtn.textContent = 'Updated!';
            updateBtn.style.background = 'var(--success)';
          } catch {
            updateBtn.textContent = 'Failed';
            updateBtn.style.background = 'var(--error)';
          }
        });
        row1.appendChild(updateBtn);
      }

      const unBtn = document.createElement('button');
      unBtn.textContent = 'Uninstall';
      unBtn.style.cssText = 'padding: 1px 8px; font-size: 10px; background: none; border: 1px solid var(--border); border-radius: 2px; color: var(--text-muted); cursor: pointer; font-family: inherit; flex-shrink: 0;';
      unBtn.addEventListener('mouseenter', () => { unBtn.style.color = 'var(--error)'; unBtn.style.borderColor = 'var(--error)'; });
      unBtn.addEventListener('mouseleave', () => { unBtn.style.color = 'var(--text-muted)'; unBtn.style.borderColor = 'var(--border)'; });
      unBtn.addEventListener('click', async () => {
        unBtn.textContent = '...';
        try {
          await (window as any).pmOs.extensionStore.uninstall(ext.id);
          row.remove();
          this.installedExtensions = this.installedExtensions.filter(e => e.id !== ext.id);
        } catch { unBtn.textContent = 'Error'; }
      });
      row1.appendChild(unBtn);
      info.appendChild(row1);

      const row2 = document.createElement('div');
      row2.style.cssText = 'font-size: 11px; color: var(--text-muted);';
      row2.textContent = `${ext.namespace} \u00B7 v${ext.version}`;
      info.appendChild(row2);

      if (ext.description) {
        const row3 = document.createElement('div');
        row3.style.cssText = 'font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        row3.textContent = ext.description;
        info.appendChild(row3);
      }

      row.appendChild(info);
      this.resultsEl.appendChild(row);
    }
  }

  private formatCount(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  private async showDetail(ext: any): Promise<void> {
    this.el.textContent = '';
    this.el.style.cssText = 'height: 100%; display: flex; flex-direction: column; overflow: hidden;';

    // Refresh installed list to catch installs done from list view
    try { this.installedExtensions = await (window as any).pmOs.extensionStore.getInstalled(); } catch {}

    const isInstalled = this.installedExtensions.some(e => e.id === `${ext.namespace}.${ext.name}`);

    // Back button header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px; flex-shrink: 0; border-bottom: 1px solid var(--border);';

    const backBtn = document.createElement('button');
    backBtn.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 12px; font-family: inherit; border-radius: 2px; transition: all 100ms;';
    backBtn.innerHTML = '<span class="codicon codicon-arrow-left"></span> Back';
    backBtn.addEventListener('mouseenter', () => { backBtn.style.color = 'var(--text-primary)'; backBtn.style.background = 'var(--bg-hover)'; });
    backBtn.addEventListener('mouseleave', () => { backBtn.style.color = 'var(--text-muted)'; backBtn.style.background = ''; });
    backBtn.addEventListener('click', () => this.render());
    header.appendChild(backBtn);
    this.el.appendChild(header);

    // Scrollable content
    const content = document.createElement('div');
    content.style.cssText = 'flex: 1; overflow-y: auto; padding: 16px;';

    // Top section: icon + info
    const top = document.createElement('div');
    top.style.cssText = 'display: flex; gap: 16px; margin-bottom: 16px;';

    // Large icon
    const iconEl = document.createElement('div');
    iconEl.style.cssText = 'width: 80px; height: 80px; border-radius: 6px; background: var(--bg-surface); flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center;';
    if (ext.iconUrl) {
      const img = document.createElement('img');
      img.src = ext.iconUrl;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
      img.onerror = () => { img.remove(); iconEl.innerHTML = '<span class="codicon codicon-extensions" style="font-size: 36px; color: var(--text-muted);"></span>'; };
      iconEl.appendChild(img);
    } else {
      iconEl.innerHTML = '<span class="codicon codicon-extensions" style="font-size: 36px; color: var(--text-muted);"></span>';
    }
    top.appendChild(iconEl);

    // Info column
    const infoCol = document.createElement('div');
    infoCol.style.cssText = 'flex: 1; min-width: 0;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;';
    nameEl.textContent = ext.displayName || ext.name;
    infoCol.appendChild(nameEl);

    const pubEl = document.createElement('div');
    pubEl.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-bottom: 8px;';
    pubEl.textContent = ext.namespace;
    infoCol.appendChild(pubEl);

    // Metadata row
    const metaRow = document.createElement('div');
    metaRow.style.cssText = 'display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); margin-bottom: 12px; flex-wrap: wrap;';

    if (ext.version) {
      const ver = document.createElement('span');
      ver.textContent = `v${ext.version}`;
      metaRow.appendChild(ver);
    }
    if (ext.downloadCount > 0) {
      const dl = document.createElement('span');
      dl.textContent = `${this.formatCount(ext.downloadCount)} installs`;
      metaRow.appendChild(dl);
    }
    if (ext.averageRating > 0) {
      const rating = document.createElement('span');
      rating.textContent = `\u2605 ${ext.averageRating.toFixed(1)}`;
      metaRow.appendChild(rating);
    }
    infoCol.appendChild(metaRow);

    // Install / Uninstall button
    const detailExtId = `${ext.namespace}.${ext.name}`;
    const isInstalling = this.installingIds.has(detailExtId);
    const actionBtn = document.createElement('button');
    if (isInstalling) {
      actionBtn.textContent = 'Installing...';
      actionBtn.style.cssText = 'padding: 6px 20px; background: var(--accent); border: none; border-radius: 4px; color: var(--bg-primary); cursor: default; font-size: 12px; font-weight: 600; font-family: inherit; opacity: 0.6;';
      actionBtn.disabled = true;

      // Listen for install completion so this button updates live
      const cleanupProgress = (window as any).pmOs.extensionStore.onProgress((data: any) => {
        if (data.id === detailExtId) {
          if (data.stage === 'complete') {
            cleanupProgress();
            this.installingIds.delete(detailExtId);
            actionBtn.textContent = 'Installed';
            actionBtn.style.opacity = '1';
            actionBtn.style.background = 'none';
            actionBtn.style.border = '1px solid var(--border)';
            actionBtn.style.color = 'var(--success)';
          } else if (data.stage === 'error') {
            cleanupProgress();
            this.installingIds.delete(detailExtId);
            actionBtn.textContent = 'Failed';
            actionBtn.style.opacity = '1';
            actionBtn.style.background = 'var(--error)';
          }
        }
      });
    } else if (isInstalled) {
      actionBtn.textContent = 'Uninstall';
      actionBtn.style.cssText = 'padding: 6px 20px; background: none; border: 1px solid var(--border); border-radius: 4px; color: var(--text-muted); cursor: pointer; font-size: 12px; font-family: inherit;';
      actionBtn.addEventListener('mouseenter', () => { actionBtn.style.color = 'var(--error)'; actionBtn.style.borderColor = 'var(--error)'; });
      actionBtn.addEventListener('mouseleave', () => { actionBtn.style.color = 'var(--text-muted)'; actionBtn.style.borderColor = 'var(--border)'; });
      actionBtn.addEventListener('click', async () => {
        actionBtn.textContent = 'Uninstalling...';
        actionBtn.disabled = true;
        try {
          await (window as any).pmOs.extensionStore.uninstall(`${ext.namespace}.${ext.name}`);
          this.installedExtensions = this.installedExtensions.filter(e => e.id !== `${ext.namespace}.${ext.name}`);
          actionBtn.textContent = 'Uninstalled';
          actionBtn.style.color = 'var(--success)';
        } catch { actionBtn.textContent = 'Failed'; }
      });
    } else {
      actionBtn.textContent = 'Install';
      actionBtn.style.cssText = 'padding: 6px 20px; background: var(--accent); border: none; border-radius: 4px; color: var(--bg-primary); cursor: pointer; font-size: 12px; font-weight: 600; font-family: inherit;';
      actionBtn.addEventListener('click', async () => {
        actionBtn.textContent = 'Installing...';
        actionBtn.disabled = true;
        actionBtn.style.opacity = '0.6';
        try {
          await (window as any).pmOs.extensionStore.install(ext.namespace, ext.name, ext.version);
          // Hot-load the extension (no restart needed)
          const extId = `${ext.namespace}.${ext.name}`;
          try { await (window as any).pmOs.extensions.activateInstalled(
            (await (window as any).pmOs.extensionStore.getInstalled()).find((e: any) => e.id === extId)?.extensionPath || ''
          ); } catch {}
          // Update installed list
          this.installedExtensions.push({ id: extId, namespace: ext.namespace, name: ext.name, displayName: ext.displayName, version: ext.version });
          actionBtn.textContent = 'Installed';
          actionBtn.style.background = 'none';
          actionBtn.style.border = '1px solid var(--border)';
          actionBtn.style.color = 'var(--success)';
        } catch {
          actionBtn.textContent = 'Install Failed';
          actionBtn.style.background = 'var(--error)';
          setTimeout(() => { actionBtn.textContent = 'Install'; actionBtn.style.background = 'var(--accent)'; actionBtn.style.opacity = '1'; actionBtn.disabled = false; }, 2000);
        }
      });
    }
    infoCol.appendChild(actionBtn);
    top.appendChild(infoCol);
    content.appendChild(top);

    // Description
    if (ext.description) {
      const descHeader = document.createElement('div');
      descHeader.style.cssText = 'font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px;';
      descHeader.textContent = 'Description';
      content.appendChild(descHeader);

      const descEl = document.createElement('div');
      descEl.style.cssText = 'font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px;';
      descEl.textContent = ext.description;
      content.appendChild(descEl);
    }

    // Categories
    if (ext.categories && ext.categories.length > 0) {
      const catHeader = document.createElement('div');
      catHeader.style.cssText = 'font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px;';
      catHeader.textContent = 'Categories';
      content.appendChild(catHeader);

      const catRow = document.createElement('div');
      catRow.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px;';
      for (const cat of ext.categories) {
        const chip = document.createElement('span');
        chip.style.cssText = 'padding: 2px 8px; background: var(--bg-surface); border-radius: 10px; font-size: 11px; color: var(--text-muted);';
        chip.textContent = cat;
        catRow.appendChild(chip);
      }
      content.appendChild(catRow);
    }

    // More info section
    const infoHeader = document.createElement('div');
    infoHeader.style.cssText = 'font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px;';
    infoHeader.textContent = 'More Information';
    content.appendChild(infoHeader);

    const infoTable = document.createElement('div');
    infoTable.style.cssText = 'font-size: 12px; display: grid; grid-template-columns: 100px 1fr; gap: 6px 12px; color: var(--text-secondary);';

    const addRow = (label: string, value: string) => {
      const l = document.createElement('span');
      l.style.cssText = 'color: var(--text-muted);';
      l.textContent = label;
      infoTable.appendChild(l);
      const v = document.createElement('span');
      v.textContent = value;
      infoTable.appendChild(v);
    };

    addRow('Publisher', ext.namespace || 'Unknown');
    addRow('Version', ext.version || 'Unknown');
    addRow('Identifier', `${ext.namespace}.${ext.name}`);
    if (ext.downloadCount > 0) addRow('Downloads', this.formatCount(ext.downloadCount));

    content.appendChild(infoTable);
    this.el.appendChild(content);
  }
}
