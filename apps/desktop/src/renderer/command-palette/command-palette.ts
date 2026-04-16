import type { PanelContainer } from '../panels/panel-container';
import type { BottomPanel } from '../bottom-panel/bottom-panel';

export interface Command {
  id: string;
  title: string;
  category: string;
  action: () => void;
}

export class CommandPalette {
  private el: HTMLElement;
  private panelContainer: PanelContainer;
  private bottomPanel: BottomPanel;
  private commands: Command[] = [];
  private filteredCommands: Command[] = [];
  private selectedIndex = 0;
  private inputEl!: HTMLInputElement;
  private resultsEl!: HTMLElement;

  constructor(el: HTMLElement, panelContainer: PanelContainer, bottomPanel: BottomPanel) {
    this.el = el;
    this.panelContainer = panelContainer;
    this.bottomPanel = bottomPanel;
    this.setupCommands();
    this.buildDom();
    this.bindEvents();
  }

  addCommand(command: Command): void {
    this.commands.push(command);
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
        action: () => this.panelContainer.showPanel('slack', 'https://app.slack.com'),
      },
      {
        id: 'open-notion',
        title: 'Open Notion',
        category: 'Workspace',
        action: () => this.panelContainer.showPanel('notion', 'https://www.notion.so'),
      },
      {
        id: 'open-browser',
        title: 'Open Browser',
        category: 'Workspace',
        action: () => this.panelContainer.showPanel('browser', 'https://www.google.com'),
      },
      {
        id: 'open-figma',
        title: 'Open Figma',
        category: 'Workspace',
        action: () => this.panelContainer.showPanel('figma', 'https://www.figma.com'),
      },
      {
        id: 'open-gmail',
        title: 'Open Gmail',
        category: 'Workspace',
        action: () => this.panelContainer.showPanel('gmail', 'https://mail.google.com'),
      },
      {
        id: 'open-calendar',
        title: 'Open Calendar',
        category: 'Workspace',
        action: () => this.panelContainer.showPanel('calendar', 'https://calendar.google.com'),
      },
      {
        id: 'open-jira',
        title: 'Open Jira',
        category: 'Workspace',
        action: () => this.panelContainer.showPanel('jira', 'https://www.atlassian.com/software/jira'),
      },
      {
        id: 'open-confluence',
        title: 'Open Confluence',
        category: 'Workspace',
        action: () => this.panelContainer.showPanel('confluence', 'https://www.atlassian.com/software/confluence'),
      },
      {
        id: 'open-terminal',
        title: 'Toggle Terminal',
        category: 'Tools',
        action: () => this.bottomPanel.toggle(),
      },
      {
        id: 'create-terminal',
        title: 'Create New Terminal',
        category: 'Terminal',
        action: () => {
          this.bottomPanel.show();
          this.bottomPanel.createNewTerminal();
        },
      },
      {
        id: 'kill-terminal',
        title: 'Kill Terminal',
        category: 'Terminal',
        action: () => this.bottomPanel.killActiveTerminal(),
      },
      {
        id: 'open-projects',
        title: 'Open Projects',
        category: 'Tools',
        action: () => this.panelContainer.showPanel('projects'),
      },
      {
        id: 'open-mcp',
        title: 'Open MCP Center',
        category: 'Tools',
        action: () => this.panelContainer.showPanel('mcp'),
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
