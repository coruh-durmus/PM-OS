import type { TabBar } from '../panels/tab-bar';
import type { BottomPanel } from '../bottom-panel/bottom-panel';

interface Command {
  id: string;
  title: string;
  category: string;
  action: () => void;
}

export class CommandPalette {
  private el: HTMLElement;
  private tabBar: TabBar;
  private bottomPanel: BottomPanel;
  private commands: Command[] = [];
  private filteredCommands: Command[] = [];
  private selectedIndex = 0;
  private inputEl!: HTMLInputElement;
  private resultsEl!: HTMLElement;

  constructor(el: HTMLElement, tabBar: TabBar, bottomPanel: BottomPanel) {
    this.el = el;
    this.tabBar = tabBar;
    this.bottomPanel = bottomPanel;
    this.setupCommands();
    this.buildDom();
    this.bindEvents();
  }

  toggle(): void {
    if (this.el.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }

  show(): void {
    this.el.classList.remove('hidden');
    this.inputEl.value = '';
    this.filter('');
    this.inputEl.focus();
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.inputEl.value = '';
  }

  private setupCommands(): void {
    this.commands = [
      {
        id: 'open-slack',
        title: 'Open Slack',
        category: 'Workspace',
        action: () => this.tabBar.openTab('slack', 'Slack', 'https://app.slack.com'),
      },
      {
        id: 'open-notion',
        title: 'Open Notion',
        category: 'Workspace',
        action: () => this.tabBar.openTab('notion', 'Notion', 'https://www.notion.so'),
      },
      {
        id: 'open-browser',
        title: 'Open Browser',
        category: 'Workspace',
        action: () => this.tabBar.openTab('browser', 'Browser', 'https://www.google.com'),
      },
      {
        id: 'open-figma',
        title: 'Open Figma',
        category: 'Workspace',
        action: () => this.tabBar.openTab('figma', 'Figma', 'https://www.figma.com'),
      },
      {
        id: 'open-ai-assistant',
        title: 'Open AI Assistant',
        category: 'Tools',
        action: () => this.tabBar.openTab('ai-assistant', 'AI Assistant'),
      },
      {
        id: 'open-terminal',
        title: 'Toggle Terminal',
        category: 'Tools',
        action: () => this.bottomPanel.toggle(),
      },
      {
        id: 'open-projects',
        title: 'Open Projects',
        category: 'Tools',
        action: () => this.tabBar.openTab('projects', 'Projects'),
      },
    ];
    this.filteredCommands = [...this.commands];
  }

  private buildDom(): void {
    const overlay = document.createElement('div');
    overlay.className = 'command-palette-overlay';
    overlay.addEventListener('click', () => this.hide());

    const dialog = document.createElement('div');
    dialog.className = 'command-palette-dialog';

    this.inputEl = document.createElement('input');
    this.inputEl.className = 'command-palette-input';
    this.inputEl.type = 'text';
    this.inputEl.placeholder = 'Type a command...';
    dialog.appendChild(this.inputEl);

    this.resultsEl = document.createElement('div');
    this.resultsEl.className = 'command-palette-results';
    dialog.appendChild(this.resultsEl);

    this.el.appendChild(overlay);
    this.el.appendChild(dialog);
  }

  private bindEvents(): void {
    this.inputEl.addEventListener('input', () => {
      this.filter(this.inputEl.value);
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
        this.renderResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.renderResults();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.executeSelected();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
    });
  }

  private filter(query: string): void {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.filteredCommands = [...this.commands];
    } else {
      this.filteredCommands = this.commands.filter((cmd) => {
        return this.fuzzyMatch(q, cmd.title.toLowerCase()) ||
               this.fuzzyMatch(q, cmd.category.toLowerCase());
      });
    }
    this.selectedIndex = 0;
    this.renderResults();
  }

  private fuzzyMatch(query: string, target: string): boolean {
    let qi = 0;
    for (let ti = 0; ti < target.length && qi < query.length; ti++) {
      if (query[qi] === target[ti]) {
        qi++;
      }
    }
    return qi === query.length;
  }

  private renderResults(): void {
    while (this.resultsEl.firstChild) {
      this.resultsEl.removeChild(this.resultsEl.firstChild);
    }

    let lastCategory = '';

    for (let i = 0; i < this.filteredCommands.length; i++) {
      const cmd = this.filteredCommands[i];

      if (cmd.category !== lastCategory) {
        const categoryEl = document.createElement('div');
        categoryEl.className = 'command-palette-category';
        categoryEl.textContent = cmd.category;
        this.resultsEl.appendChild(categoryEl);
        lastCategory = cmd.category;
      }

      const itemEl = document.createElement('div');
      itemEl.className = 'command-palette-item' + (i === this.selectedIndex ? ' selected' : '');
      itemEl.textContent = cmd.title;
      itemEl.addEventListener('click', () => {
        this.selectedIndex = i;
        this.executeSelected();
      });
      itemEl.addEventListener('mouseenter', () => {
        this.selectedIndex = i;
        this.renderResults();
      });
      this.resultsEl.appendChild(itemEl);
    }
  }

  private executeSelected(): void {
    const cmd = this.filteredCommands[this.selectedIndex];
    if (cmd) {
      this.hide();
      cmd.action();
    }
  }
}
