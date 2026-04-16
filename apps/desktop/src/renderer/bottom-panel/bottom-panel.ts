import { TerminalPanel } from '../terminal/terminal.js';

interface TerminalTab {
  id: string;
  name: string;
  panel: TerminalPanel;
  containerEl: HTMLElement;
  tabEl: HTMLElement;
}

export class BottomPanel {
  private el: HTMLElement;
  private contentEl: HTMLElement;
  private resizeHandle: HTMLElement;
  private closeBtn: HTMLElement;
  private newBtn: HTMLElement;
  private killBtn: HTMLElement;
  private tabStrip: HTMLElement;
  private tabs: TerminalTab[] = [];
  private activeTabId: string | null = null;
  private visible = false;
  private shellNameCounts: Map<string, number> = new Map();

  constructor(el: HTMLElement) {
    this.el = el;
    this.contentEl = el.querySelector('#bottom-panel-content')!;
    this.resizeHandle = el.querySelector('#bottom-panel-resize-handle')!;
    this.closeBtn = el.querySelector('#bottom-panel-close')!;
    this.newBtn = el.querySelector('#bottom-panel-new-terminal')!;
    this.killBtn = el.querySelector('#bottom-panel-kill-terminal')!;
    this.tabStrip = el.querySelector('#bottom-panel-tabs')!;

    this.closeBtn.addEventListener('click', () => this.hide());
    this.newBtn.addEventListener('click', () => this.createNewTerminal());
    this.killBtn.addEventListener('click', () => this.killActiveTerminal());
    this.setupResize();
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    this.el.classList.remove('hidden');
    this.visible = true;

    if (this.tabs.length === 0) {
      this.createNewTerminal();
    } else if (this.activeTabId) {
      const tab = this.tabs.find(t => t.id === this.activeTabId);
      if (tab) {
        tab.panel.fit();
        tab.panel.focus();
      }
    }
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.visible = false;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  createNewTerminal(): void {
    const shellName = this.getShellName();
    const displayName = this.generateDisplayName(shellName);

    // Create container for this terminal
    const containerEl = document.createElement('div');
    containerEl.className = 'terminal-container';
    containerEl.style.display = 'none';
    this.contentEl.appendChild(containerEl);

    // Create TerminalPanel
    const panel = new TerminalPanel(containerEl);

    // Create tab element
    const tabEl = document.createElement('div');
    tabEl.className = 'terminal-tab';

    const tabName = document.createElement('span');
    tabName.className = 'terminal-tab-name';
    tabName.textContent = displayName;

    const tabClose = document.createElement('button');
    tabClose.className = 'terminal-tab-close';
    tabClose.textContent = '\u00D7';
    tabClose.title = 'Kill Terminal';

    tabEl.appendChild(tabName);
    tabEl.appendChild(tabClose);
    this.tabStrip.appendChild(tabEl);

    // Use a temporary ID until the PTY session returns the real one
    const tempId = `pending-${Date.now()}`;

    const tab: TerminalTab = {
      id: tempId,
      name: displayName,
      panel,
      containerEl,
      tabEl,
    };

    this.tabs.push(tab);

    // Tab click handlers
    tabEl.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).classList.contains('terminal-tab-close')) {
        this.switchTab(tab.id);
      }
    });

    tabClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.killTerminal(tab.id);
    });

    // Switch to the new tab
    this.switchTab(tab.id);

    // Initialize the terminal (async, will get session ID)
    panel.init().then(() => {
      const sessionId = panel.getSessionId();
      if (sessionId) {
        tab.id = sessionId;
        // Update activeTabId if this tab is still the active one
        if (this.activeTabId === tempId) {
          this.activeTabId = sessionId;
        }
        // Re-bind tab click handler with correct ID
        tabEl.onclick = null;
        tabEl.addEventListener('click', (e) => {
          if (!(e.target as HTMLElement).classList.contains('terminal-tab-close')) {
            this.switchTab(sessionId);
          }
        });
        tabClose.onclick = null;
        tabClose.addEventListener('click', (e) => {
          e.stopPropagation();
          this.killTerminal(sessionId);
        });
      }
    }).catch(() => {});
  }

  killActiveTerminal(): void {
    if (this.activeTabId) {
      this.killTerminal(this.activeTabId);
    }
  }

  private killTerminal(id: string): void {
    const index = this.tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    const tab = this.tabs[index];

    // Dispose the terminal
    tab.panel.dispose();

    // Remove DOM elements
    tab.containerEl.remove();
    tab.tabEl.remove();

    // Remove from tabs array
    this.tabs.splice(index, 1);

    // If no tabs remain, hide the panel entirely
    if (this.tabs.length === 0) {
      this.activeTabId = null;
      this.shellNameCounts.clear();
      this.hide();
    } else if (this.activeTabId === id) {
      // Killed tab was active — switch to nearest
      const newIndex = Math.min(index, this.tabs.length - 1);
      this.switchTab(this.tabs[newIndex].id);
    }
  }

  private switchTab(id: string): void {
    this.activeTabId = id;

    for (const tab of this.tabs) {
      const isActive = tab.id === id;
      tab.containerEl.style.display = isActive ? 'block' : 'none';
      tab.tabEl.classList.toggle('active', isActive);

      if (isActive) {
        // Defer fit to next frame so layout is settled
        requestAnimationFrame(() => {
          tab.panel.fit();
          tab.panel.focus();
        });
      }
    }
  }

  private getShellName(): string {
    // Try to detect shell from environment
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac') || userAgent.includes('darwin')) {
      return 'zsh';
    }
    return 'bash';
  }

  private generateDisplayName(shellName: string): string {
    const count = (this.shellNameCounts.get(shellName) || 0) + 1;
    this.shellNameCounts.set(shellName, count);
    if (count === 1) {
      return shellName;
    }
    return `${shellName} (${count})`;
  }

  private setupResize(): void {
    let startY = 0;
    let startHeight = 0;

    const onMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight * 0.7, startHeight + delta));
      this.el.style.height = `${newHeight}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Refit the active terminal after resize
      if (this.activeTabId) {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab) {
          tab.panel.fit();
        }
      }
    };

    this.resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      startY = e.clientY;
      startHeight = this.el.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }
}
