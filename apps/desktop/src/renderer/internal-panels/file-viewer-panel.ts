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

    // Build toolbar
    this.buildToolbar(fileName, filePath);

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
    codeArea.style.cssText = 'flex: 1; overflow: auto; padding: 16px; min-width: 0;';

    const pre = document.createElement('pre');
    pre.style.cssText = 'margin: 0; background: var(--bg-primary);';

    const code = document.createElement('code');
    code.style.cssText = 'white-space: pre; font-size: 13px; line-height: 1.6; font-family: \'SF Mono\', \'Fira Code\', \'Cascadia Code\', Menlo, Consolas, monospace; color: var(--text-primary);';
    code.textContent = this.currentSource;

    pre.appendChild(code);
    codeArea.appendChild(pre);
    container.appendChild(codeArea);

    // Sync scroll between gutter and code area
    codeArea.addEventListener('scroll', () => {
      gutter.scrollTop = codeArea.scrollTop;
    });

    this.sourceEl = container;
    return container;
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
