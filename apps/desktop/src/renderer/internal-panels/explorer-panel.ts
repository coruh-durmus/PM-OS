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

    this.workspacePath = await (window as any).pmOs.fs.getWorkspacePath();
    await (window as any).pmOs.workspace.ensureClaudeMd();

    // Section header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);';
    header.textContent = 'Explorer';
    this.el.appendChild(header);

    // Load root entries
    const entries: FileEntry[] = await (window as any).pmOs.fs.readDir(this.workspacePath);
    this.rootNodes = entries.map(e => ({ entry: e, expanded: false, children: null, depth: 0 }));

    this.renderNodes(this.rootNodes, this.el);
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

  private openFile(entry: FileEntry): void {
    // For now, log the file open action
    // In future, this will open in an editor or markdown viewer
    console.log('[Explorer] Open file:', entry.path);
  }
}
