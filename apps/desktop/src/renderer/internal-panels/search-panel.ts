export class SearchPanel {
  private el: HTMLElement;
  private resultsEl: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private onOpenFile?: (entry: { name: string; path: string; isDirectory: boolean }) => void;
  private searching = false;

  constructor(container: HTMLElement, options?: { onOpenFile?: (entry: { name: string; path: string; isDirectory: boolean }) => void }) {
    this.el = container;
    this.onOpenFile = options?.onOpenFile;
  }

  async render(): Promise<void> {
    this.el.textContent = '';
    this.el.style.cssText = 'height: 100%; display: flex; flex-direction: column; overflow: hidden;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); flex-shrink: 0;';
    header.textContent = 'Search';
    this.el.appendChild(header);

    // Search input
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = 'padding: 0 12px 8px; flex-shrink: 0;';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search files...';
    this.searchInput.style.cssText = 'width: 100%; padding: 6px 8px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 12px; outline: none; font-family: inherit; box-sizing: border-box;';
    this.searchInput.addEventListener('focus', () => {
      this.searchInput!.style.borderColor = 'var(--accent)';
    });
    this.searchInput.addEventListener('blur', () => {
      this.searchInput!.style.borderColor = 'var(--border)';
    });

    let debounceTimer: ReturnType<typeof setTimeout>;
    this.searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.performSearch(this.searchInput!.value);
      }, 300);
    });
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(debounceTimer);
        this.performSearch(this.searchInput!.value);
      }
    });

    inputContainer.appendChild(this.searchInput);
    this.el.appendChild(inputContainer);

    // Results area
    this.resultsEl = document.createElement('div');
    this.resultsEl.style.cssText = 'flex: 1; overflow-y: auto; font-size: 12px;';
    this.el.appendChild(this.resultsEl);

    // Auto-focus search input
    requestAnimationFrame(() => this.searchInput?.focus());
  }

  focus(): void {
    this.searchInput?.focus();
  }

  private async performSearch(query: string): Promise<void> {
    if (!this.resultsEl) return;
    if (!query || query.length < 2) {
      this.resultsEl.textContent = '';
      if (query.length === 1) {
        const hint = document.createElement('div');
        hint.style.cssText = 'padding: 12px; color: var(--text-muted); font-size: 12px;';
        hint.textContent = 'Type at least 2 characters';
        this.resultsEl.appendChild(hint);
      }
      return;
    }

    if (this.searching) return;
    this.searching = true;

    this.resultsEl.textContent = '';
    const loadingEl = document.createElement('div');
    loadingEl.style.cssText = 'padding: 12px; color: var(--text-muted); font-size: 12px;';
    loadingEl.textContent = 'Searching...';
    this.resultsEl.appendChild(loadingEl);

    try {
      const folders: string[] = await (window as any).pmOs.workspace.getFolders();
      const results: SearchResult[] = [];

      for (const folder of folders) {
        await this.searchDirectory(folder, query.toLowerCase(), results, 0);
        if (results.length >= 100) break; // Cap results
      }

      this.resultsEl.textContent = '';

      if (results.length === 0) {
        const noResults = document.createElement('div');
        noResults.style.cssText = 'padding: 12px; color: var(--text-muted); font-size: 12px;';
        noResults.textContent = `No results for "${query}"`;
        this.resultsEl.appendChild(noResults);
      } else {
        // Group by file
        const grouped = new Map<string, SearchResult[]>();
        for (const r of results) {
          const existing = grouped.get(r.filePath) || [];
          existing.push(r);
          grouped.set(r.filePath, existing);
        }

        const countEl = document.createElement('div');
        countEl.style.cssText = 'padding: 6px 12px; color: var(--text-muted); font-size: 11px; border-bottom: 1px solid var(--border);';
        countEl.textContent = `${results.length} results in ${grouped.size} files`;
        this.resultsEl.appendChild(countEl);

        for (const [filePath, fileResults] of grouped) {
          this.renderFileResults(filePath, fileResults, query);
        }
      }
    } catch (err) {
      this.resultsEl.textContent = '';
      const errEl = document.createElement('div');
      errEl.style.cssText = 'padding: 12px; color: var(--error); font-size: 12px;';
      errEl.textContent = 'Search failed';
      this.resultsEl.appendChild(errEl);
    }

    this.searching = false;
  }

  private async searchDirectory(dirPath: string, query: string, results: SearchResult[], depth: number): Promise<void> {
    if (depth > 8 || results.length >= 100) return;

    const entries: { name: string; path: string; isDirectory: boolean }[] = await (window as any).pmOs.fs.readDir(dirPath);

    for (const entry of entries) {
      if (results.length >= 100) return;

      // Skip common non-searchable directories
      if (entry.isDirectory) {
        if (['node_modules', '.git', 'dist', '.next', '.cache', '__pycache__', '.pm-os'].includes(entry.name)) continue;
        await this.searchDirectory(entry.path, query, results, depth + 1);
      } else {
        // Only search text files
        if (!this.isSearchableFile(entry.name)) continue;

        try {
          const content: string | null = await (window as any).pmOs.fs.readFile(entry.path);
          if (!content) continue;

          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(query)) {
              results.push({
                filePath: entry.path,
                fileName: entry.name,
                line: i + 1,
                text: lines[i].trim(),
                column: lines[i].toLowerCase().indexOf(query),
              });
              if (results.length >= 100) return;
            }
          }
        } catch {}
      }
    }
  }

  private renderFileResults(filePath: string, results: SearchResult[], query: string): void {
    if (!this.resultsEl) return;

    const fileName = filePath.split('/').pop() || filePath;
    // Get relative path
    const parts = filePath.split('/');
    let relPath = filePath;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'Desktop' || parts[i] === 'Projects') {
        relPath = parts.slice(i + 1).join('/');
        break;
      }
    }

    // File header
    const fileHeader = document.createElement('div');
    fileHeader.style.cssText = 'padding: 6px 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: background 100ms ease;';
    fileHeader.addEventListener('mouseenter', () => { fileHeader.style.background = 'var(--bg-hover)'; });
    fileHeader.addEventListener('mouseleave', () => { fileHeader.style.background = ''; });

    const fileIcon = document.createElement('span');
    fileIcon.className = 'codicon codicon-file';
    fileIcon.style.cssText = 'color: var(--text-muted); flex-shrink: 0;';
    fileHeader.appendChild(fileIcon);

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-weight: 500; color: var(--text-primary);';
    nameEl.textContent = fileName;
    fileHeader.appendChild(nameEl);

    const pathEl = document.createElement('span');
    pathEl.style.cssText = 'font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    pathEl.textContent = relPath;
    fileHeader.appendChild(pathEl);

    const countBadge = document.createElement('span');
    countBadge.style.cssText = 'font-size: 10px; background: var(--bg-surface); color: var(--text-muted); padding: 1px 5px; border-radius: 8px; margin-left: auto; flex-shrink: 0;';
    countBadge.textContent = String(results.length);
    fileHeader.appendChild(countBadge);

    fileHeader.addEventListener('click', () => {
      if (this.onOpenFile) {
        this.onOpenFile({ name: fileName, path: filePath, isDirectory: false });
      }
    });

    this.resultsEl.appendChild(fileHeader);

    // Result lines
    for (const result of results) {
      const lineEl = document.createElement('div');
      lineEl.style.cssText = 'padding: 3px 12px 3px 36px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 12px; transition: background 100ms ease;';
      lineEl.addEventListener('mouseenter', () => { lineEl.style.background = 'var(--bg-hover)'; });
      lineEl.addEventListener('mouseleave', () => { lineEl.style.background = ''; });

      const lineNum = document.createElement('span');
      lineNum.style.cssText = 'color: var(--text-muted); font-size: 11px; min-width: 30px; text-align: right; flex-shrink: 0; font-family: \'SF Mono\', monospace;';
      lineNum.textContent = String(result.line);
      lineEl.appendChild(lineNum);

      const textEl = document.createElement('span');
      textEl.style.cssText = 'color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

      // Highlight the match
      const text = result.text;
      const lowerText = text.toLowerCase();
      const matchIndex = lowerText.indexOf(query.toLowerCase());
      if (matchIndex >= 0) {
        const before = text.substring(0, matchIndex);
        const match = text.substring(matchIndex, matchIndex + query.length);
        const after = text.substring(matchIndex + query.length);

        textEl.appendChild(document.createTextNode(before));
        const highlight = document.createElement('span');
        highlight.style.cssText = 'background: var(--warning); color: var(--bg-primary); border-radius: 2px; padding: 0 1px;';
        highlight.textContent = match;
        textEl.appendChild(highlight);
        textEl.appendChild(document.createTextNode(after));
      } else {
        textEl.textContent = text;
      }

      lineEl.appendChild(textEl);

      lineEl.addEventListener('click', () => {
        if (this.onOpenFile) {
          this.onOpenFile({ name: fileName, path: filePath, isDirectory: false });
        }
      });

      this.resultsEl!.appendChild(lineEl);
    }
  }

  private isSearchableFile(name: string): boolean {
    const exts = ['.md', '.json', '.yaml', '.yml', '.txt', '.log', '.ts', '.js', '.jsx', '.tsx',
      '.css', '.html', '.xml', '.sh', '.py', '.go', '.rs', '.toml', '.ini', '.env',
      '.mjs', '.cjs', '.svg', '.sql', '.gitignore'];
    return exts.some(ext => name.endsWith(ext)) || name.startsWith('.');
  }
}

interface SearchResult {
  filePath: string;
  fileName: string;
  line: number;
  text: string;
  column: number;
}
