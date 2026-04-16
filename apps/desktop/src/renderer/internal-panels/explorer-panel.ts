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

export class ExplorerPanel {
  private el: HTMLElement;
  private roots: WorkspaceRoot[] = [];
  private onOpenFile?: (entry: FileEntry) => void;

  constructor(container: HTMLElement, options?: { onOpenFile?: (entry: FileEntry) => void }) {
    this.el = container;
    this.onOpenFile = options?.onOpenFile;
  }

  async render(): Promise<void> {
    this.el.textContent = '';
    this.el.style.cssText = 'height: 100%; overflow-y: auto; font-size: 13px; user-select: none;';

    const folders: string[] = await (window as any).pmOs.workspace.getFolders();

    // Section header with "Add Folder" button
    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;';

    const headerLabel = document.createElement('span');
    headerLabel.textContent = 'Explorer';
    header.appendChild(headerLabel);

    if (folders.length > 0) {
      const addFolderBtn = document.createElement('button');
      addFolderBtn.title = 'Add Folder to Workspace';
      addFolderBtn.style.cssText = 'width: 20px; height: 20px; border: none; background: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; padding: 0; transition: color var(--transition-fast), background var(--transition-fast);';
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
      header.appendChild(addFolderBtn);
    }

    this.el.appendChild(header);

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

    // Render each workspace root
    for (const root of this.roots) {
      this.renderRoot(root, this.el);
    }
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

    // Render children and git info if expanded
    if (root.expanded && root.children) {
      this.renderNodes(root.children, container);
      this.renderWorkspaceGitInfo(root.path, container);
    }
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

  private async renderWorkspaceGitInfo(projectPath: string, container: HTMLElement): Promise<void> {
    const info = await (window as any).pmOs.git.getInfo(projectPath);

    const bar = document.createElement('div');
    bar.style.cssText = 'padding: 4px 12px 8px 28px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 10px;';

    // Branch badge
    if (info.branch) {
      const branch = document.createElement('span');
      branch.style.cssText = 'padding: 1px 6px; background: var(--bg-surface); border-radius: 8px; color: var(--text-secondary);';
      branch.textContent = '\u2387 ' + info.branch;
      bar.appendChild(branch);
    }

    // Dirty/clean indicator
    const status = document.createElement('span');
    if (info.dirty) {
      status.style.cssText = 'color: var(--warning);';
      status.textContent = '\u25CF ' + info.modifiedCount + ' modified';
    } else {
      status.style.cssText = 'color: var(--success);';
      status.textContent = '\u2713 clean';
    }
    bar.appendChild(status);

    // Remote link
    if (info.remote) {
      const remote = document.createElement('span');
      remote.style.cssText = 'color: var(--accent); cursor: pointer;';
      const displayUrl = info.remote
        .replace('https://github.com/', '')
        .replace('git@github.com:', '')
        .replace('.git', '');
      remote.textContent = '\u2197 ' + displayUrl;
      remote.title = info.remote;
      bar.appendChild(remote);
    } else {
      const noRemote = document.createElement('span');
      noRemote.style.cssText = 'color: var(--text-muted); cursor: pointer;';
      noRemote.textContent = '+ Connect to GitHub';
      noRemote.addEventListener('click', async () => {
        const url = prompt('Enter GitHub remote URL (e.g., https://github.com/user/repo.git):');
        if (url) {
          await (window as any).pmOs.git.setRemote(projectPath, url);
          this.render();
        }
      });
      bar.appendChild(noRemote);
    }

    container.appendChild(bar);

    // Contributors row
    if (info.contributors && info.contributors.length > 0) {
      const contribRow = document.createElement('div');
      contribRow.style.cssText = 'padding: 0 12px 6px 28px; display: flex; gap: 4px; align-items: center; font-size: 10px; color: var(--text-muted);';

      const label = document.createElement('span');
      label.textContent = '\u{1F465}';
      contribRow.appendChild(label);

      for (const name of info.contributors.slice(0, 5)) {
        const avatar = document.createElement('span');
        avatar.style.cssText = 'padding: 1px 5px; background: var(--bg-surface); border-radius: 8px; font-size: 10px; color: var(--text-secondary);';
        avatar.textContent = name;
        avatar.title = name;
        contribRow.appendChild(avatar);
      }
      if (info.contributors.length > 5) {
        const more = document.createElement('span');
        more.textContent = '+' + (info.contributors.length - 5) + ' more';
        more.style.color = 'var(--text-muted)';
        contribRow.appendChild(more);
      }

      container.appendChild(contribRow);
    }

    // Last commit
    if (info.lastCommit) {
      const commitRow = document.createElement('div');
      commitRow.style.cssText = 'padding: 0 12px 8px 28px; font-size: 10px; color: var(--text-muted);';
      commitRow.textContent = `${info.lastCommit.hash} ${info.lastCommit.message} \u2014 ${info.lastCommit.author}, ${info.lastCommit.timeAgo}`;
      container.appendChild(commitRow);
    }

    // Action buttons
    if (info.remote) {
      const actions = document.createElement('div');
      actions.style.cssText = 'padding: 0 12px 10px 28px; display: flex; gap: 6px;';

      const pushBtn = document.createElement('button');
      pushBtn.textContent = '\u2191 Push';
      pushBtn.style.cssText = 'padding: 2px 8px; font-size: 10px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-secondary); cursor: pointer;';
      pushBtn.addEventListener('click', async () => {
        pushBtn.textContent = '\u2191 Pushing...';
        const result = await (window as any).pmOs.git.push(projectPath);
        pushBtn.textContent = result.success ? '\u2713 Pushed' : '\u2717 Failed';
        setTimeout(() => { pushBtn.textContent = '\u2191 Push'; }, 2000);
      });
      actions.appendChild(pushBtn);

      const pullBtn = document.createElement('button');
      pullBtn.textContent = '\u2193 Pull';
      pullBtn.style.cssText = pushBtn.style.cssText;
      pullBtn.addEventListener('click', async () => {
        pullBtn.textContent = '\u2193 Pulling...';
        const result = await (window as any).pmOs.git.pull(projectPath);
        pullBtn.textContent = result.success ? '\u2713 Pulled' : '\u2717 Failed';
        setTimeout(() => { pullBtn.textContent = '\u2193 Pull'; this.render(); }, 2000);
      });
      actions.appendChild(pullBtn);

      if (info.dirty) {
        const commitBtn = document.createElement('button');
        commitBtn.textContent = '\u2713 Commit All';
        commitBtn.style.cssText = pushBtn.style.cssText;
        commitBtn.addEventListener('click', async () => {
          const msg = prompt('Commit message:', 'Update project');
          if (!msg) return;
          commitBtn.textContent = 'Committing...';
          const result = await (window as any).pmOs.git.commitAll(projectPath, msg);
          commitBtn.textContent = result.success ? '\u2713 Committed' : '\u2717 Failed';
          setTimeout(() => this.render(), 1500);
        });
        actions.appendChild(commitBtn);
      }

      container.appendChild(actions);
    }
  }

  private openFile(entry: FileEntry): void {
    if (this.onOpenFile) {
      this.onOpenFile(entry);
    }
  }
}
