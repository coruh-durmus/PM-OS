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

export class ExplorerPanel {
  private el: HTMLElement;
  private workspacePath: string = '';
  private rootNodes: TreeNode[] = [];

  constructor(container: HTMLElement) {
    this.el = container;
  }

  async render(): Promise<void> {
    this.el.textContent = '';
    this.el.style.cssText = 'height: 100%; overflow-y: auto; font-size: 13px; user-select: none;';

    const folders: string[] = await (window as any).pmOs.workspace.getFolders();

    // Section header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);';
    header.textContent = 'Explorer';
    this.el.appendChild(header);

    if (folders.length === 0) {
      // Show "no workspace open" message
      const msg = document.createElement('div');
      msg.style.cssText = 'padding: 16px; color: var(--text-muted); font-size: 12px; text-align: center;';
      msg.textContent = 'No workspace open';
      this.el.appendChild(msg);
      return;
    }

    this.workspacePath = folders[0]; // Use first folder as root for now

    // For multi-folder workspaces, show each folder as a top-level root node
    if (folders.length > 1) {
      this.rootNodes = [];
      for (const folder of folders) {
        const folderName = folder.split('/').pop() || folder;
        this.rootNodes.push({
          entry: { name: folderName, path: folder, isDirectory: true },
          expanded: false,
          children: null,
          depth: 0,
        });
      }
    } else {
      // Single folder: load its children as root entries
      const entries: FileEntry[] = await (window as any).pmOs.fs.readDir(this.workspacePath);
      this.rootNodes = entries.map(e => ({ entry: e, expanded: false, children: null, depth: 0 }));
    }

    this.renderNodes(this.rootNodes, this.el);
  }

  private renderNodes(nodes: TreeNode[], container: HTMLElement): void {
    for (const node of nodes) {
      const row = this.createRow(node);
      container.appendChild(row);

      // Show git info for top-level project directories
      if (node.depth === 0 && node.entry.isDirectory) {
        this.renderProjectGitInfo(node.entry.path, container);
      }

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
      chevron.textContent = node.expanded ? '\u25BC' : '\u25B6';
      chevron.style.cssText = 'font-size: 8px; width: 12px; color: var(--text-muted); flex-shrink: 0;';
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
    // Re-render the whole tree
    await this.render();
  }

  private async renderProjectGitInfo(projectPath: string, container: HTMLElement): Promise<void> {
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
      // Parse GitHub URL for display
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
          // Re-render to show the remote
          this.render();
        }
      });
      bar.appendChild(noRemote);
    }

    container.appendChild(bar);

    // Contributors row (if any)
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

    // Last commit (if any)
    if (info.lastCommit) {
      const commitRow = document.createElement('div');
      commitRow.style.cssText = 'padding: 0 12px 8px 28px; font-size: 10px; color: var(--text-muted);';
      commitRow.textContent = `${info.lastCommit.hash} ${info.lastCommit.message} \u2014 ${info.lastCommit.author}, ${info.lastCommit.timeAgo}`;
      container.appendChild(commitRow);
    }

    // Action buttons (if remote is set)
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
    // For now, log the file open action
    // In future, this will open in an editor or markdown viewer
    console.log('[Explorer] Open file:', entry.path);
  }
}
