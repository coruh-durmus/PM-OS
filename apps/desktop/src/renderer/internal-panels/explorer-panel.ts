import type { SidebarSectionAction } from '../sidebar-panel/sidebar-section.js';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface TreeNode {
  entry: FileEntry;
  expanded: boolean;
  children: TreeNode[] | null; // null = not loaded yet
  depth: number;
}

interface WorkspaceRoot {
  name: string;
  path: string;
  expanded: boolean;
  children: TreeNode[] | null;
}

interface ExplorerPanelOptions {
  onOpenFile?: (entry: FileEntry) => void;
  /**
   * When true, the explorer skips rendering its own header — the surrounding
   * SidebarSection provides the title — and exposes `getActions()` so the
   * section header can host the search + add-folder buttons.
   */
  inSection?: boolean;
}

export class ExplorerPanel {
  private el: HTMLElement;
  private roots: WorkspaceRoot[] = [];
  private onOpenFile?: (entry: FileEntry) => void;
  private searchContainer: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private searchResultsEl: HTMLElement | null = null;
  private treeContainer: HTMLElement | null = null;
  private searchVisible = false;
  private inSection: boolean;

  constructor(container: HTMLElement, options?: ExplorerPanelOptions) {
    this.el = container;
    this.onOpenFile = options?.onOpenFile;
    this.inSection = !!options?.inSection;
  }

  async render(): Promise<void> {
    this.el.textContent = '';
    this.el.style.cssText = 'height: 100%; overflow-y: auto; font-size: 13px; user-select: none;';

    const folders: string[] = await (window as any).pmOs.workspace.getFolders();

    // When mounted inside a SidebarSection the section header already shows
    // the title and hosts the action buttons via getActions(); skip rendering
    // an internal header to avoid duplication.
    if (!this.inSection) {
      const header = document.createElement('div');
      header.style.cssText = 'padding: 8px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;';

      const headerLabel = document.createElement('span');
      headerLabel.textContent = 'Explorer';
      header.appendChild(headerLabel);

      if (folders.length > 0) {
        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display: flex; gap: 2px;';

        // Search button
        const searchBtn = document.createElement('button');
        searchBtn.title = 'Search Files (Cmd+Shift+F)';
        searchBtn.style.cssText = 'width: 20px; height: 20px; border: none; background: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; padding: 0; transition: color var(--transition-fast), background var(--transition-fast);';
        const searchIcon = document.createElement('span');
        searchIcon.className = 'codicon codicon-search';
        searchBtn.appendChild(searchIcon);
        searchBtn.addEventListener('mouseenter', () => { searchBtn.style.color = 'var(--text-primary)'; searchBtn.style.background = 'var(--bg-hover)'; });
        searchBtn.addEventListener('mouseleave', () => { searchBtn.style.color = 'var(--text-muted)'; searchBtn.style.background = ''; });
        searchBtn.addEventListener('click', () => this.toggleSearch());
        btnGroup.appendChild(searchBtn);

        // Add folder button
        const addFolderBtn = document.createElement('button');
        addFolderBtn.title = 'Add Folder to Workspace';
        addFolderBtn.style.cssText = searchBtn.style.cssText;
        const addIcon = document.createElement('span');
        addIcon.className = 'codicon codicon-new-folder';
        addFolderBtn.appendChild(addIcon);
        addFolderBtn.addEventListener('mouseenter', () => { addFolderBtn.style.color = 'var(--text-primary)'; addFolderBtn.style.background = 'var(--bg-hover)'; });
        addFolderBtn.addEventListener('mouseleave', () => { addFolderBtn.style.color = 'var(--text-muted)'; addFolderBtn.style.background = ''; });
        addFolderBtn.addEventListener('click', async () => {
          await (window as any).pmOs.workspace.addFolder();
          this.roots = [];
          await this.render();
        });
        btnGroup.appendChild(addFolderBtn);

        header.appendChild(btnGroup);
      }

      this.el.appendChild(header);
    }

    // Search bar (hidden by default)
    this.searchContainer = document.createElement('div');
    this.searchContainer.style.cssText = 'padding: 0 12px 8px; display: none;';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search files...';
    searchInput.style.cssText = 'width: 100%; padding: 5px 8px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 12px; outline: none; font-family: inherit; box-sizing: border-box;';
    searchInput.addEventListener('focus', () => { searchInput.style.borderColor = 'var(--accent)'; });
    searchInput.addEventListener('blur', () => { searchInput.style.borderColor = 'var(--border)'; });

    let debounceTimer: ReturnType<typeof setTimeout>;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.performSearch(searchInput.value), 300);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.hideSearch(); searchInput.value = ''; }
      if (e.key === 'Enter') { clearTimeout(debounceTimer); this.performSearch(searchInput.value); }
    });
    this.searchInput = searchInput;
    this.searchContainer.appendChild(searchInput);
    this.el.appendChild(this.searchContainer);

    // Search results container (replaces tree when searching)
    this.searchResultsEl = document.createElement('div');
    this.searchResultsEl.style.cssText = 'display: none; flex: 1; overflow-y: auto; font-size: 12px;';
    this.el.appendChild(this.searchResultsEl);

    if (folders.length === 0) {
      const msg = document.createElement('div');
      msg.style.cssText = 'padding: 16px; color: var(--text-muted); font-size: 12px; text-align: center;';
      msg.textContent = 'No workspace open';
      this.el.appendChild(msg);
      return;
    }

    // Build roots on first render (preserve state across re-renders)
    if (this.roots.length === 0) {
      for (const folder of folders) {
        const folderName = folder.split('/').pop() || folder;
        this.roots.push({
          name: folderName,
          path: folder,
          expanded: folders.length === 1, // auto-expand if single folder
          children: null,
        });
      }
      // Load children for expanded roots
      for (const root of this.roots) {
        if (root.expanded) {
          await this.loadRootChildren(root);
        }
      }
    }

    // Tree container (hidden when searching)
    this.treeContainer = document.createElement('div');
    for (const root of this.roots) {
      this.renderRoot(root, this.treeContainer);
    }
    this.el.appendChild(this.treeContainer);
  }

  private async loadRootChildren(root: WorkspaceRoot): Promise<void> {
    const entries: FileEntry[] = await (window as any).pmOs.fs.readDir(root.path);
    root.children = entries.map(e => ({ entry: e, expanded: false, children: null, depth: 1 }));
  }

  private renderRoot(root: WorkspaceRoot, container: HTMLElement): void {
    // Root folder header (collapsible section)
    const rootHeader = document.createElement('div');
    rootHeader.style.cssText = 'padding: 4px 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-primary); transition: background var(--transition-fast);';

    rootHeader.addEventListener('mouseenter', () => { rootHeader.style.background = 'var(--bg-hover)'; });
    rootHeader.addEventListener('mouseleave', () => { rootHeader.style.background = ''; });

    // Chevron
    const chevron = document.createElement('span');
    chevron.className = root.expanded ? 'codicon codicon-chevron-down' : 'codicon codicon-chevron-right';
    chevron.style.cssText = 'font-size: 10px; color: var(--text-muted); flex-shrink: 0;';
    rootHeader.appendChild(chevron);

    // Folder name
    const nameEl = document.createElement('span');
    nameEl.textContent = root.name;
    rootHeader.appendChild(nameEl);

    rootHeader.addEventListener('click', async () => {
      root.expanded = !root.expanded;
      if (root.expanded && root.children === null) {
        await this.loadRootChildren(root);
      }
      await this.render();
    });

    container.appendChild(rootHeader);

    // Render children if expanded. Per-workspace git info now lives in
    // the bottom status bar (single source of truth).
    if (root.expanded && root.children) {
      this.renderNodes(root.children, container);
    }
  }

  /**
   * Returns the section-header actions (search + add folder) when the panel
   * runs inside a SidebarSection. Returns an empty list when no workspace is
   * open so the caller can omit the buttons entirely.
   */
  getActions(): SidebarSectionAction[] {
    return [
      {
        icon: 'codicon-search',
        title: 'Search Files (Cmd+Shift+F)',
        onClick: () => this.toggleSearch(),
      },
      {
        icon: 'codicon-new-folder',
        title: 'Add Folder to Workspace',
        onClick: async () => {
          await (window as any).pmOs.workspace.addFolder();
          this.roots = [];
          await this.render();
        },
      },
    ];
  }

  dispose(): void {
    // Currently the explorer holds no global event listeners. Keeping the
    // method so SidebarPanel can call it uniformly across mounted panels.
  }

  private renderNodes(nodes: TreeNode[], container: HTMLElement): void {
    for (const node of nodes) {
      const row = this.createRow(node);
      container.appendChild(row);

      if (node.expanded && node.children) {
        const childContainer = document.createElement('div');
        this.renderNodes(node.children, childContainer);
        container.appendChild(childContainer);
      }
    }
  }

  private createRow(node: TreeNode): HTMLElement {
    const row = document.createElement('div');
    const pad = node.depth * 16 + 12;
    row.style.cssText = `padding: 3px 8px 3px ${pad}px; cursor: pointer; display: flex; align-items: center; gap: 4px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;

    row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-hover)');
    row.addEventListener('mouseleave', () => row.style.background = '');

    if (node.entry.isDirectory) {
      // Chevron
      const chevron = document.createElement('span');
      chevron.className = node.expanded ? 'codicon codicon-chevron-down' : 'codicon codicon-chevron-right';
      chevron.style.cssText = 'font-size: 10px; width: 12px; color: var(--text-muted); flex-shrink: 0;';
      row.appendChild(chevron);

      // Icon
      const icon = document.createElement('span');
      icon.textContent = '\u{1F4C1}';
      icon.style.cssText = 'font-size: 14px; flex-shrink: 0;';
      row.appendChild(icon);

      // Name (bold for directories)
      const name = document.createElement('span');
      name.textContent = node.entry.name;
      name.style.fontWeight = '500';
      row.appendChild(name);

      row.addEventListener('click', async () => {
        await this.toggleDirectory(node);
      });
    } else {
      // Spacer for alignment with directory chevrons
      const spacer = document.createElement('span');
      spacer.style.cssText = 'width: 12px; flex-shrink: 0;';
      row.appendChild(spacer);

      // Icon based on file type
      const icon = document.createElement('span');
      icon.textContent = this.getFileIcon(node.entry.name);
      icon.style.cssText = 'font-size: 14px; flex-shrink: 0;';
      row.appendChild(icon);

      // Name
      const name = document.createElement('span');
      name.textContent = node.entry.name;
      name.style.color = 'var(--text-secondary)';
      row.appendChild(name);

      row.addEventListener('click', () => {
        this.openFile(node.entry);
      });
    }

    // Right-click context menu
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, node);
    });

    return row;
  }

  private getFileIcon(name: string): string {
    if (name === 'CLAUDE.md') return '\u{1F916}';
    if (name.endsWith('.md')) return '\u{1F4DD}';
    if (name === 'config.json' || name === 'links.json' || name === '.mcp.json') return '\u2699\uFE0F';
    if (name.endsWith('.json')) return '\u{1F4CB}';
    if (name.endsWith('.yaml') || name.endsWith('.yml')) return '\u{1F4CB}';
    if (name.endsWith('.log')) return '\u{1F4DC}';
    return '\u{1F4C4}';
  }

  private async toggleDirectory(node: TreeNode): Promise<void> {
    if (node.expanded) {
      node.expanded = false;
    } else {
      if (node.children === null) {
        const entries: FileEntry[] = await (window as any).pmOs.fs.readDir(node.entry.path);
        node.children = entries.map(e => ({
          entry: e,
          expanded: false,
          children: null,
          depth: node.depth + 1,
        }));
      }
      node.expanded = true;
    }
    await this.render();
  }

  private toggleSearch(): void {
    if (this.searchVisible) {
      this.hideSearch();
    } else {
      this.showSearch();
    }
  }

  private showSearch(): void {
    this.searchVisible = true;
    if (this.searchContainer) this.searchContainer.style.display = 'block';
    requestAnimationFrame(() => this.searchInput?.focus());
  }

  private hideSearch(): void {
    this.searchVisible = false;
    if (this.searchContainer) this.searchContainer.style.display = 'none';
    if (this.searchResultsEl) { this.searchResultsEl.style.display = 'none'; this.searchResultsEl.textContent = ''; }
    if (this.treeContainer) this.treeContainer.style.display = 'block';
  }

  private async performSearch(query: string): Promise<void> {
    if (!this.searchResultsEl || !this.treeContainer) return;
    if (!query || query.length < 2) {
      this.searchResultsEl.style.display = 'none';
      this.searchResultsEl.textContent = '';
      this.treeContainer.style.display = 'block';
      return;
    }

    this.treeContainer.style.display = 'none';
    this.searchResultsEl.style.display = 'block';
    this.searchResultsEl.textContent = '';

    const loading = document.createElement('div');
    loading.style.cssText = 'padding: 12px; color: var(--text-muted); font-size: 12px;';
    loading.textContent = 'Searching...';
    this.searchResultsEl.appendChild(loading);

    const results: { filePath: string; fileName: string; line: number; text: string }[] = [];
    const folders: string[] = await (window as any).pmOs.workspace.getFolders();

    for (const folder of folders) {
      await this.searchDir(folder, query.toLowerCase(), results, 0);
      if (results.length >= 100) break;
    }

    this.searchResultsEl.textContent = '';

    if (results.length === 0) {
      const noResults = document.createElement('div');
      noResults.style.cssText = 'padding: 12px; color: var(--text-muted); font-size: 12px;';
      noResults.textContent = `No results for "${query}"`;
      this.searchResultsEl.appendChild(noResults);
      return;
    }

    // Group by file
    const grouped = new Map<string, typeof results>();
    for (const r of results) {
      const arr = grouped.get(r.filePath) || [];
      arr.push(r);
      grouped.set(r.filePath, arr);
    }

    const countEl = document.createElement('div');
    countEl.style.cssText = 'padding: 6px 12px; color: var(--text-muted); font-size: 11px; border-bottom: 1px solid var(--border);';
    countEl.textContent = `${results.length} results in ${grouped.size} files`;
    this.searchResultsEl.appendChild(countEl);

    for (const [filePath, fileResults] of grouped) {
      const fileName = filePath.split('/').pop() || filePath;

      const fileHeader = document.createElement('div');
      fileHeader.style.cssText = 'padding: 5px 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: background 100ms ease; font-weight: 500; color: var(--text-primary);';
      fileHeader.addEventListener('mouseenter', () => { fileHeader.style.background = 'var(--bg-hover)'; });
      fileHeader.addEventListener('mouseleave', () => { fileHeader.style.background = ''; });

      const fileIcon = document.createElement('span');
      fileIcon.className = 'codicon codicon-file';
      fileIcon.style.cssText = 'color: var(--text-muted); flex-shrink: 0;';
      fileHeader.appendChild(fileIcon);

      const nameEl = document.createElement('span');
      nameEl.textContent = fileName;
      fileHeader.appendChild(nameEl);

      const badge = document.createElement('span');
      badge.style.cssText = 'font-size: 10px; background: var(--bg-surface); color: var(--text-muted); padding: 1px 5px; border-radius: 8px; margin-left: auto; font-weight: 400;';
      badge.textContent = String(fileResults.length);
      fileHeader.appendChild(badge);

      fileHeader.addEventListener('click', () => {
        if (this.onOpenFile) this.onOpenFile({ name: fileName, path: filePath, isDirectory: false });
      });
      this.searchResultsEl!.appendChild(fileHeader);

      for (const result of fileResults) {
        const lineEl = document.createElement('div');
        lineEl.style.cssText = 'padding: 2px 12px 2px 32px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 100ms ease;';
        lineEl.addEventListener('mouseenter', () => { lineEl.style.background = 'var(--bg-hover)'; });
        lineEl.addEventListener('mouseleave', () => { lineEl.style.background = ''; });

        const lineNum = document.createElement('span');
        lineNum.style.cssText = "color: var(--text-muted); font-size: 11px; min-width: 24px; text-align: right; flex-shrink: 0; font-family: 'SF Mono', monospace;";
        lineNum.textContent = String(result.line);
        lineEl.appendChild(lineNum);

        const textEl = document.createElement('span');
        textEl.style.cssText = 'color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px;';

        const matchIdx = result.text.toLowerCase().indexOf(query.toLowerCase());
        if (matchIdx >= 0) {
          textEl.appendChild(document.createTextNode(result.text.substring(0, matchIdx)));
          const hl = document.createElement('span');
          hl.style.cssText = 'background: var(--warning); color: var(--bg-primary); border-radius: 2px; padding: 0 1px;';
          hl.textContent = result.text.substring(matchIdx, matchIdx + query.length);
          textEl.appendChild(hl);
          textEl.appendChild(document.createTextNode(result.text.substring(matchIdx + query.length)));
        } else {
          textEl.textContent = result.text;
        }

        lineEl.appendChild(textEl);
        lineEl.addEventListener('click', () => {
          if (this.onOpenFile) this.onOpenFile({ name: fileName, path: filePath, isDirectory: false });
        });
        this.searchResultsEl!.appendChild(lineEl);
      }
    }
  }

  private async searchDir(dirPath: string, query: string, results: { filePath: string; fileName: string; line: number; text: string }[], depth: number): Promise<void> {
    if (depth > 8 || results.length >= 100) return;
    const entries: FileEntry[] = await (window as any).pmOs.fs.readDir(dirPath);

    for (const entry of entries) {
      if (results.length >= 100) return;
      if (entry.isDirectory) {
        if (['node_modules', '.git', 'dist', '.next', '.cache', '__pycache__'].includes(entry.name)) continue;
        await this.searchDir(entry.path, query, results, depth + 1);
      } else {
        const textExts = ['.md', '.json', '.yaml', '.yml', '.txt', '.log', '.ts', '.js', '.jsx', '.tsx', '.css', '.html', '.sh', '.py', '.toml', '.mjs', '.cjs'];
        if (!textExts.some(ext => entry.name.endsWith(ext))) continue;
        try {
          const content: string | null = await (window as any).pmOs.fs.readFile(entry.path);
          if (!content) continue;
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(query)) {
              results.push({ filePath: entry.path, fileName: entry.name, line: i + 1, text: lines[i].trim() });
              if (results.length >= 100) return;
            }
          }
        } catch {}
      }
    }
  }

  private openFile(entry: FileEntry): void {
    if (this.onOpenFile) {
      this.onOpenFile(entry);
    }
  }

  private showContextMenu(e: MouseEvent, node: TreeNode): void {
    // Remove any existing context menu
    document.querySelector('.explorer-context-menu')?.remove();

    const menu = document.createElement('div');
    menu.className = 'explorer-context-menu';
    menu.style.cssText = 'position: fixed; z-index: 1000; min-width: 180px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); overflow: hidden; font-size: 13px; padding: 4px 0;';
    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;

    const items: { label: string; icon: string; action: () => void; destructive?: boolean; separator?: boolean }[] = [];

    if (node.entry.isDirectory) {
      items.push({ label: 'New File', icon: 'codicon-new-file', action: () => this.createNewItem(node, false) });
      items.push({ label: 'New Folder', icon: 'codicon-new-folder', action: () => this.createNewItem(node, true) });
      items.push({ label: '', icon: '', action: () => {}, separator: true });
    }

    items.push({ label: 'Rename', icon: 'codicon-edit', action: () => this.renameItem(node) });
    items.push({ label: 'Delete', icon: 'codicon-trash', action: () => this.deleteItem(node), destructive: true });

    if (node.entry.isDirectory) {
      items.push({ label: '', icon: '', action: () => {}, separator: true });
      items.push({ label: 'Open in Terminal', icon: 'codicon-terminal', action: () => this.openInTerminal(node) });
    }

    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: var(--border); margin: 4px 0;';
        menu.appendChild(sep);
        continue;
      }

      const row = document.createElement('div');
      row.style.cssText = 'padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: var(--text-primary); transition: background 100ms ease;';

      const iconEl = document.createElement('span');
      iconEl.className = `codicon ${item.icon}`;
      iconEl.style.cssText = 'color: var(--text-muted); flex-shrink: 0;';
      row.appendChild(iconEl);

      const label = document.createElement('span');
      label.textContent = item.label;
      if (item.destructive) label.style.color = 'var(--error)';
      row.appendChild(label);

      row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-hover)'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      row.addEventListener('click', () => { menu.remove(); item.action(); });

      menu.appendChild(row);
    }

    document.body.appendChild(menu);

    const dismiss = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) { menu.remove(); document.removeEventListener('click', dismiss); }
    };
    const escDismiss = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { menu.remove(); document.removeEventListener('keydown', escDismiss); }
    };
    setTimeout(() => {
      document.addEventListener('click', dismiss);
      document.addEventListener('keydown', escDismiss);
    }, 0);
  }

  private async createNewItem(parentNode: TreeNode, isDirectory: boolean): Promise<void> {
    const name = prompt(isDirectory ? 'New folder name:' : 'New file name:');
    if (!name) return;
    const parentPath = parentNode.entry.path;
    const newPath = parentPath + '/' + name;

    if (isDirectory) {
      await (window as any).pmOs.fs.mkdir(newPath);
    } else {
      await (window as any).pmOs.fs.writeFile(newPath, '');
    }

    // Reload parent's children
    parentNode.children = null;
    parentNode.expanded = true;
    const entries: FileEntry[] = await (window as any).pmOs.fs.readDir(parentNode.entry.path);
    parentNode.children = entries.map(e => ({ entry: e, expanded: false, children: null, depth: parentNode.depth + 1 }));
    await this.render();
  }

  private async renameItem(node: TreeNode): Promise<void> {
    const oldName = node.entry.name;
    const newName = prompt('Rename to:', oldName);
    if (!newName || newName === oldName) return;

    const parentPath = node.entry.path.substring(0, node.entry.path.lastIndexOf('/'));
    const newPath = parentPath + '/' + newName;
    const success = await (window as any).pmOs.fs.rename(node.entry.path, newPath);
    if (success) {
      node.entry.name = newName;
      node.entry.path = newPath;
      await this.render();
    }
  }

  private async deleteItem(node: TreeNode): Promise<void> {
    const confirmed = confirm(`Delete "${node.entry.name}"? This cannot be undone.`);
    if (!confirmed) return;
    const success = await (window as any).pmOs.fs.delete(node.entry.path);
    if (success) {
      // Remove from parent and re-render
      for (const root of this.roots) {
        if (root.children) {
          this.removeNodeFromTree(root.children, node);
        }
      }
      await this.render();
    }
  }

  private removeNodeFromTree(nodes: TreeNode[], target: TreeNode): boolean {
    const index = nodes.indexOf(target);
    if (index !== -1) {
      nodes.splice(index, 1);
      return true;
    }
    for (const n of nodes) {
      if (n.children && this.removeNodeFromTree(n.children, target)) return true;
    }
    return false;
  }

  private openInTerminal(node: TreeNode): void {
    // Dispatch custom event that BottomPanel can listen for
    window.dispatchEvent(new CustomEvent('pm-os:open-terminal-in-folder', { detail: { path: node.entry.path } }));
  }
}
