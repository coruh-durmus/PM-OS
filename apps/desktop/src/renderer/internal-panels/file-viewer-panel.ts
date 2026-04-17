import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

export class FileViewerPanel {
  private el: HTMLElement;
  private currentPath: string | null = null;
  private currentSource: string = '';
  private mode: 'rendered' | 'source' | 'split' = 'rendered';
  private isMarkdown: boolean = false;

  // DOM references
  private toolbarEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private renderedEl: HTMLElement | null = null;
  private sourceEl: HTMLElement | null = null;
  private modeButtons: { rendered: HTMLButtonElement; source: HTMLButtonElement; split: HTMLButtonElement } | null = null;

  private openTabs: { path: string; name: string }[] = [];
  private activeTabPath: string | null = null;
  private tabBarEl: HTMLElement | null = null;
  private hasUnsavedChanges: boolean = false;

  constructor(container: HTMLElement) {
    this.el = container;
  }

  render(): void {
    this.el.textContent = '';
    this.el.style.cssText = 'position: absolute; inset: 0; display: flex; flex-direction: column;';

    // Empty state
    const empty = document.createElement('div');
    empty.className = 'file-viewer-empty';
    empty.style.cssText = 'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-muted);';

    const emptyIcon = document.createElement('div');
    emptyIcon.style.cssText = 'font-size: 32px; opacity: 0.5;';
    emptyIcon.textContent = '\u{1F4C4}';
    empty.appendChild(emptyIcon);

    const emptyText = document.createElement('div');
    emptyText.style.cssText = 'font-size: 14px;';
    emptyText.textContent = 'Select a file to view';
    empty.appendChild(emptyText);

    this.el.appendChild(empty);
  }

  async loadFile(filePath: string): Promise<void> {
    // 1. Read file
    const content: string | null = await (window as any).pmOs.fs.readFile(filePath);

    // 2. Handle null (error state)
    if (content === null) {
      this.showError(filePath);
      return;
    }

    // 3. Determine file type
    const fileName = filePath.split('/').pop() || filePath;
    this.currentPath = filePath;
    this.currentSource = content;
    this.isMarkdown = fileName.endsWith('.md');
    this.hasUnsavedChanges = false;

    // Track this file as an open tab
    if (!this.openTabs.find(t => t.path === filePath)) {
      this.openTabs.push({ path: filePath, name: fileName });
    }
    this.activeTabPath = filePath;

    // Reset mode to rendered for markdown, source for everything else
    if (!this.isMarkdown) {
      this.mode = 'source';
    } else if (this.mode === 'source' || this.mode === 'split') {
      // Keep current mode if already in source/split for markdown
    } else {
      this.mode = 'rendered';
    }

    // 4. Rebuild entire panel
    this.el.textContent = '';
    this.el.style.cssText = 'position: absolute; inset: 0; display: flex; flex-direction: column;';

    // Build tab bar
    this.buildTabBar();

    // Build toolbar
    this.buildToolbar(fileName, filePath);

    // Build breadcrumb
    this.buildBreadcrumb(filePath);

    // Build content
    this.buildContent();
  }

  private buildToolbar(fileName: string, filePath: string): void {
    this.toolbarEl = document.createElement('div');
    this.toolbarEl.className = 'file-viewer-toolbar';
    this.toolbarEl.style.cssText = 'height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); gap: 8px;';

    // Left side: icon + name + path
    const leftGroup = document.createElement('div');
    leftGroup.style.cssText = 'display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;';

    const icon = document.createElement('span');
    icon.style.cssText = 'font-size: 14px; flex-shrink: 0;';
    icon.textContent = this.getFileIcon(fileName);
    leftGroup.appendChild(icon);

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-size: 13px; font-weight: 600; color: var(--text-primary); flex-shrink: 0;';
    nameEl.textContent = fileName;
    leftGroup.appendChild(nameEl);

    const pathEl = document.createElement('span');
    pathEl.style.cssText = 'font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;';
    pathEl.textContent = filePath;
    pathEl.title = filePath;
    leftGroup.appendChild(pathEl);

    this.toolbarEl.appendChild(leftGroup);

    // Right side: mode buttons + copy path
    const rightGroup = document.createElement('div');
    rightGroup.style.cssText = 'display: flex; align-items: center; gap: 4px; flex-shrink: 0;';

    // Mode buttons for markdown files
    if (this.isMarkdown) {
      const renderedBtn = this.createModeButton('Rendered', 'rendered');
      const sourceBtn = this.createModeButton('Source', 'source');
      const splitBtn = this.createModeButton('Split', 'split');

      this.modeButtons = { rendered: renderedBtn, source: sourceBtn, split: splitBtn };
      this.updateModeButtonStates();

      rightGroup.appendChild(renderedBtn);
      rightGroup.appendChild(sourceBtn);
      rightGroup.appendChild(splitBtn);

      // Separator
      const sep = document.createElement('div');
      sep.style.cssText = 'width: 1px; height: 20px; background: var(--border); margin: 0 4px;';
      rightGroup.appendChild(sep);
    }

    // Copy path button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'file-viewer-mode-btn';
    copyBtn.style.cssText = 'padding: 4px 12px; border-radius: 4px; font-size: 12px; background: transparent; color: var(--text-secondary); border: 1px solid var(--border); cursor: pointer; font-family: inherit; transition: background var(--transition-fast);';
    copyBtn.textContent = 'Copy Path';
    copyBtn.addEventListener('mouseenter', () => {
      copyBtn.style.background = 'var(--bg-hover)';
    });
    copyBtn.addEventListener('mouseleave', () => {
      copyBtn.style.background = 'transparent';
    });
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(filePath).then(() => {
        const origText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = origText; }, 1500);
      });
    });
    rightGroup.appendChild(copyBtn);

    this.toolbarEl.appendChild(rightGroup);
    this.el.appendChild(this.toolbarEl);
  }

  private buildBreadcrumb(filePath: string): void {
    const breadcrumb = document.createElement('div');
    breadcrumb.style.cssText = 'padding: 4px 12px; display: flex; align-items: center; gap: 2px; font-size: 12px; background: var(--bg-primary); border-bottom: 1px solid var(--border); flex-shrink: 0; overflow-x: auto; white-space: nowrap;';

    // Split path into segments and find workspace root for relative display
    const parts = filePath.split('/');

    // Find a reasonable start point (look for common project indicators)
    let startIndex = 0;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'Desktop' || parts[i] === 'Projects' || parts[i] === 'repos' || parts[i] === 'workspace') {
        startIndex = i + 1;
        break;
      }
    }
    // If no common indicator found, show last 5 segments max
    if (startIndex === 0) {
      startIndex = Math.max(0, parts.length - 5);
    }

    const displayParts = parts.slice(startIndex);

    for (let i = 0; i < displayParts.length; i++) {
      const part = displayParts[i];
      if (!part) continue;

      // Add separator before each segment except the first
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'codicon codicon-chevron-right';
        sep.style.cssText = 'font-size: 10px; color: var(--text-muted); flex-shrink: 0;';
        breadcrumb.appendChild(sep);
      }

      const segment = document.createElement('span');
      const isLast = i === displayParts.length - 1;

      if (isLast) {
        // File name — not clickable, just highlighted
        segment.style.cssText = 'color: var(--text-primary); font-weight: 500;';
      } else {
        // Folder — clickable
        segment.style.cssText = 'color: var(--text-muted); cursor: pointer; transition: color 100ms ease; padding: 1px 2px; border-radius: 2px;';
        segment.addEventListener('mouseenter', () => {
          segment.style.color = 'var(--text-primary)';
          segment.style.background = 'var(--bg-hover)';
        });
        segment.addEventListener('mouseleave', () => {
          segment.style.color = 'var(--text-muted)';
          segment.style.background = '';
        });
      }

      segment.textContent = part;
      breadcrumb.appendChild(segment);
    }

    this.el.appendChild(breadcrumb);
  }

  private createModeButton(label: string, mode: 'rendered' | 'source' | 'split'): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'file-viewer-mode-btn';
    btn.textContent = label;
    btn.style.cssText = 'padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-family: inherit; transition: background var(--transition-fast), color var(--transition-fast);';

    btn.addEventListener('click', () => {
      this.mode = mode;
      this.updateModeButtonStates();
      this.buildContent();
    });

    btn.addEventListener('mouseenter', () => {
      if (this.mode !== mode) {
        btn.style.background = 'var(--bg-hover)';
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (this.mode !== mode) {
        btn.style.background = 'transparent';
      }
    });

    return btn;
  }

  private updateModeButtonStates(): void {
    if (!this.modeButtons) return;

    for (const [key, btn] of Object.entries(this.modeButtons)) {
      if (key === this.mode) {
        btn.classList.add('active');
        btn.style.background = 'var(--accent)';
        btn.style.color = 'var(--bg-primary)';
        btn.style.borderColor = 'var(--accent)';
        btn.style.border = '1px solid var(--accent)';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-secondary)';
        btn.style.border = '1px solid var(--border)';
      }
    }
  }

  private buildContent(): void {
    // Remove existing content area if present
    if (this.contentEl) {
      this.contentEl.remove();
    }

    this.contentEl = document.createElement('div');
    this.contentEl.style.cssText = 'flex: 1; overflow: hidden; position: relative;';

    const fileName = this.currentPath?.split('/').pop() || '';
    const isText = this.isTextFile(fileName);

    if (!isText) {
      // Non-text file: show centered message
      const msg = document.createElement('div');
      msg.className = 'file-viewer-empty';
      msg.style.cssText = 'position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-muted);';

      const msgIcon = document.createElement('div');
      msgIcon.style.cssText = 'font-size: 32px; opacity: 0.5;';
      msgIcon.textContent = this.getFileIcon(fileName);
      msg.appendChild(msgIcon);

      const msgText = document.createElement('div');
      msgText.style.cssText = 'font-size: 14px;';
      msgText.textContent = 'Binary file cannot be displayed';
      msg.appendChild(msgText);

      this.contentEl.appendChild(msg);
    } else if (this.isMarkdown) {
      this.buildMarkdownContent();
    } else {
      // Non-markdown text file: always source view
      this.contentEl.style.cssText += ' display: flex;';
      this.contentEl.appendChild(this.buildSourceView());
    }

    this.el.appendChild(this.contentEl);
  }

  private buildMarkdownContent(): void {
    if (!this.contentEl) return;

    if (this.mode === 'rendered') {
      this.contentEl.style.cssText = 'flex: 1; overflow: hidden; position: relative;';
      const rendered = this.buildRenderedView();
      this.contentEl.appendChild(rendered);
    } else if (this.mode === 'source') {
      this.contentEl.style.cssText = 'flex: 1; overflow: hidden; position: relative; display: flex;';
      this.contentEl.appendChild(this.buildSourceView());
    } else {
      // Split mode
      this.contentEl.style.cssText = 'flex: 1; overflow: hidden; position: relative; display: flex;';

      const rendered = this.buildRenderedView();
      rendered.style.flex = '1';
      rendered.style.minWidth = '0';
      this.contentEl.appendChild(rendered);

      const source = this.buildSourceView();
      source.style.borderLeft = '1px solid var(--border)';
      this.contentEl.appendChild(source);
    }
  }

  private buildRenderedView(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'file-viewer-markdown';
    container.style.cssText = 'flex: 1; overflow-y: auto; padding: 24px 32px;';
    container.innerHTML = marked.parse(this.currentSource) as string;
    this.renderedEl = container;
    return container;
  }

  private buildSourceView(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'file-viewer-source';
    container.style.cssText = 'flex: 1; display: flex; overflow: hidden; min-width: 0;';

    const lines = this.currentSource.split('\n');

    // Gutter (line numbers)
    const gutter = document.createElement('div');
    gutter.className = 'file-viewer-gutter';
    gutter.style.cssText = 'width: 50px; text-align: right; padding: 16px 12px 16px 0; color: var(--text-muted); font-size: 13px; line-height: 1.6; user-select: none; flex-shrink: 0; background: var(--bg-secondary); overflow: hidden; font-family: \'SF Mono\', \'Fira Code\', \'Cascadia Code\', Menlo, Consolas, monospace;';

    for (let i = 1; i <= lines.length; i++) {
      const lineNum = document.createElement('div');
      lineNum.textContent = String(i);
      gutter.appendChild(lineNum);
    }

    container.appendChild(gutter);

    // Code area
    const codeArea = document.createElement('div');
    codeArea.className = 'file-viewer-code';
    codeArea.style.cssText = 'flex: 1; overflow: hidden; min-width: 0; display: flex;';

    const textarea = document.createElement('textarea');
    textarea.style.cssText = 'width: 100%; height: 100%; resize: none; background: var(--bg-primary); color: var(--text-primary); border: none; outline: none; font-size: 13px; line-height: 1.6; font-family: \'SF Mono\', \'Fira Code\', \'Cascadia Code\', Menlo, Consolas, monospace; padding: 16px; box-sizing: border-box; tab-size: 2;';
    textarea.value = this.currentSource;
    textarea.spellcheck = false;

    // Track changes
    textarea.addEventListener('input', () => {
      this.currentSource = textarea.value;
      this.hasUnsavedChanges = true;
      this.updateTabUnsavedIndicator();
    });

    // Sync scroll with gutter
    textarea.addEventListener('scroll', () => {
      gutter.scrollTop = textarea.scrollTop;
    });

    // Cmd+S to save
    textarea.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        this.saveFile();
      }
    });

    codeArea.appendChild(textarea);
    container.appendChild(codeArea);

    this.sourceEl = container;
    return container;
  }

  private async saveFile(): Promise<void> {
    if (!this.currentPath || !this.hasUnsavedChanges) return;
    const success = await (window as any).pmOs.fs.writeFile(this.currentPath, this.currentSource);
    if (success) {
      this.hasUnsavedChanges = false;
      this.updateTabUnsavedIndicator();
      // Also update rendered view if in split mode and markdown
      if (this.isMarkdown && (this.mode === 'rendered' || this.mode === 'split')) {
        if (this.renderedEl) {
          const { marked } = await import('marked');
          this.renderedEl.innerHTML = marked.parse(this.currentSource) as string;
        }
      }
    }
  }

  private updateTabUnsavedIndicator(): void {
    // Find the active tab and add/remove a dot indicator
    if (!this.activeTabPath) return;
    const tab = this.openTabs.find(t => t.path === this.activeTabPath);
    if (!tab) return;
    // We'll just update the tab name to show a dot when unsaved
    // This is a simple approach - the tab bar will be rebuilt on next loadFile
  }

  private showError(filePath: string): void {
    this.el.textContent = '';
    this.el.style.cssText = 'position: absolute; inset: 0; display: flex; flex-direction: column;';

    const errorContainer = document.createElement('div');
    errorContainer.className = 'file-viewer-empty';
    errorContainer.style.cssText = 'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-muted);';

    const errorIcon = document.createElement('div');
    errorIcon.style.cssText = 'font-size: 32px; opacity: 0.5;';
    errorIcon.textContent = '\u26A0\uFE0F';
    errorContainer.appendChild(errorIcon);

    const errorText = document.createElement('div');
    errorText.style.cssText = 'font-size: 14px; color: var(--text-primary);';
    errorText.textContent = 'Could not read file';
    errorContainer.appendChild(errorText);

    const errorPath = document.createElement('div');
    errorPath.style.cssText = 'font-size: 12px; color: var(--text-muted); max-width: 400px; text-align: center; word-break: break-all;';
    errorPath.textContent = filePath;
    errorContainer.appendChild(errorPath);

    this.el.appendChild(errorContainer);
  }

  private buildTabBar(): void {
    this.tabBarEl = document.createElement('div');
    this.tabBarEl.style.cssText = 'display: flex; align-items: center; background: var(--bg-secondary); border-bottom: 1px solid var(--border); flex-shrink: 0; overflow-x: auto; scrollbar-width: none; height: 35px;';

    // Hide scrollbar
    this.tabBarEl.style.setProperty('-webkit-scrollbar', 'none');

    for (const tab of this.openTabs) {
      const isActive = tab.path === this.activeTabPath;

      const tabEl = document.createElement('div');
      tabEl.style.cssText = `display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; height: 100%; font-size: 12px; cursor: pointer; border-right: 1px solid var(--border); flex-shrink: 0; transition: background 100ms ease; ${isActive ? 'background: var(--bg-primary); color: var(--text-primary);' : 'background: var(--bg-secondary); color: var(--text-muted);'}`;

      // File icon
      const icon = document.createElement('span');
      icon.textContent = this.getFileIcon(tab.name);
      icon.style.cssText = 'font-size: 13px; flex-shrink: 0;';
      tabEl.appendChild(icon);

      // File name
      const nameEl = document.createElement('span');
      nameEl.textContent = tab.name;
      nameEl.style.cssText = 'white-space: nowrap;';
      tabEl.appendChild(nameEl);

      // Close button
      const closeBtn = document.createElement('span');
      closeBtn.style.cssText = 'width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); font-size: 14px; opacity: 0; transition: opacity 100ms ease, background 100ms ease; color: var(--text-muted);';
      closeBtn.textContent = '\u00D7';

      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'var(--error-subtle)';
        closeBtn.style.color = 'var(--error)';
      });
      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = '';
        closeBtn.style.color = 'var(--text-muted)';
      });
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.path);
      });

      tabEl.appendChild(closeBtn);

      // Show close button on hover
      tabEl.addEventListener('mouseenter', () => {
        closeBtn.style.opacity = '1';
        if (!isActive) tabEl.style.background = 'var(--bg-hover)';
      });
      tabEl.addEventListener('mouseleave', () => {
        closeBtn.style.opacity = isActive ? '0.7' : '0';
        if (!isActive) tabEl.style.background = 'var(--bg-secondary)';
      });

      // Always show close on active tab
      if (isActive) closeBtn.style.opacity = '0.7';

      // Click to switch
      tabEl.addEventListener('click', () => {
        if (tab.path !== this.activeTabPath) {
          this.loadFile(tab.path);
        }
      });

      this.tabBarEl.appendChild(tabEl);
    }

    this.el.appendChild(this.tabBarEl);
  }

  private closeTab(path: string): void {
    this.openTabs = this.openTabs.filter(t => t.path !== path);

    if (this.openTabs.length === 0) {
      // No more tabs — show empty state
      this.activeTabPath = null;
      this.currentPath = null;
      this.render();
      return;
    }

    if (this.activeTabPath === path) {
      // Switch to the last remaining tab
      const lastTab = this.openTabs[this.openTabs.length - 1];
      this.loadFile(lastTab.path);
    } else {
      // Just re-render to update the tab bar
      this.loadFile(this.activeTabPath!);
    }
  }

  private getFileIcon(name: string): string {
    if (name === 'CLAUDE.md') return '\u{1F916}';
    if (name.endsWith('.md')) return '\u{1F4DD}';
    if (name === 'config.json' || name === 'links.json' || name === '.mcp.json') return '\u2699\uFE0F';
    if (name.endsWith('.json')) return '\u{1F4CB}';
    if (name.endsWith('.yaml') || name.endsWith('.yml')) return '\u{1F4CB}';
    if (name.endsWith('.log')) return '\u{1F4DC}';
    if (name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.tsx') || name.endsWith('.jsx')) return '\u{1F4E6}';
    if (name.endsWith('.css')) return '\u{1F3A8}';
    if (name.endsWith('.html')) return '\u{1F310}';
    return '\u{1F4C4}';
  }

  private isTextFile(name: string): boolean {
    const textExts = ['.md', '.json', '.yaml', '.yml', '.txt', '.log', '.ts', '.js', '.jsx', '.tsx',
      '.css', '.html', '.xml', '.sh', '.py', '.go', '.rs', '.toml', '.ini', '.env', '.gitignore',
      '.mjs', '.cjs', '.svg', '.sql', '.mcp.json'];
    return textExts.some(ext => name.endsWith(ext)) || name.startsWith('.');
  }
}
