import { TerminalPanel } from '../terminal/terminal.js';
import { TerminalDropdown } from './terminal-dropdown.js';
import { TerminalContextMenu } from './terminal-context-menu.js';
import { TerminalInstancesPanel } from './terminal-instances-panel.js';

interface TerminalTab {
  id: string;
  name: string;
  shellName: string;
  panel: TerminalPanel;
  containerEl: HTMLElement;
  tabEl: HTMLElement;
}

export class BottomPanel {
  private el: HTMLElement;
  private bodyEl: HTMLElement;
  private contentEl: HTMLElement;
  private resizeHandle: HTMLElement;
  private closeBtn: HTMLElement;
  private newBtn: HTMLElement;
  private tabStrip: HTMLElement;
  private tabs: TerminalTab[] = [];
  private activeTabId: string | null = null;
  private visible = false;
  private shellNameCounts: Map<string, number> = new Map();
  private maximized = false;
  private savedHeight: string = '';
  private dropdown: TerminalDropdown;
  private contextMenu: TerminalContextMenu;
  private instancesPanel: TerminalInstancesPanel;

  constructor(el: HTMLElement) {
    this.el = el;
    this.bodyEl = el.querySelector('#bottom-panel-body')!;
    this.contentEl = el.querySelector('#bottom-panel-content')!;
    this.resizeHandle = el.querySelector('#bottom-panel-resize-handle')!;
    this.closeBtn = el.querySelector('#bp-close')!;
    this.newBtn = el.querySelector('#bp-new-terminal')!;
    this.tabStrip = el.querySelector('#bottom-panel-tabs')!;

    const dropdownBtn = el.querySelector('#bp-shell-dropdown')! as HTMLElement;
    const contextMenuBtn = el.querySelector('#bp-context-menu')! as HTMLElement;
    const maximizeBtn = el.querySelector('#bp-maximize')! as HTMLElement;

    this.closeBtn.addEventListener('click', () => this.hide());
    this.newBtn.addEventListener('click', () => this.createNewTerminal());

    // Maximize toggle
    maximizeBtn.addEventListener('click', () => {
      this.maximized = !this.maximized;
      if (this.maximized) {
        this.savedHeight = this.el.style.height || '';
        this.el.style.height = '70vh';
        maximizeBtn.innerHTML = '<span class="codicon codicon-chevron-down"></span>';
        maximizeBtn.title = 'Restore Panel';
      } else {
        this.el.style.height = this.savedHeight || '280px';
        maximizeBtn.innerHTML = '<span class="codicon codicon-chevron-up"></span>';
        maximizeBtn.title = 'Maximize Panel';
      }
      if (this.activeTabId) {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab) requestAnimationFrame(() => tab.panel.fit());
      }
    });

    // Shell dropdown
    this.dropdown = new TerminalDropdown(dropdownBtn, (shell) => {
      this.createNewTerminal(shell);
    });
    dropdownBtn.addEventListener('click', () => this.dropdown.toggle());

    // Context menu
    this.contextMenu = new TerminalContextMenu(contextMenuBtn, {
      onRename: () => this.renameActiveTerminal(),
      onChangeCwd: () => this.changeCwd(),
      onClear: () => this.clearActiveTerminal(),
      onKill: () => this.killActiveTerminal(),
      onCopy: () => this.copySelection(),
      onPaste: () => this.pasteToTerminal(),
      onSelectDefaultShell: () => this.selectDefaultShell(),
    });
    contextMenuBtn.addEventListener('click', () => this.contextMenu.toggle());

    // Instances panel
    const instancesEl = el.querySelector('#bottom-panel-instances')! as HTMLElement;
    this.instancesPanel = new TerminalInstancesPanel(instancesEl, {
      onSwitch: (id) => this.switchTab(id),
      onKill: (id) => this.killTerminal(id),
      onRename: (id, name) => this.updateTabName(id, name),
    });

    this.setupResize();

    // Listen for "Open in Terminal" from explorer context menu
    window.addEventListener('pm-os:open-terminal-in-folder', ((e: CustomEvent) => {
      const folderPath = e.detail?.path;
      if (folderPath) {
        this.show();
        this.createNewTerminal(undefined, folderPath);
      }
    }) as EventListener);
  }

  toggle(): void {
    if (this.visible) { this.hide(); } else { this.show(); }
  }

  show(): void {
    this.el.classList.remove('hidden');
    this.visible = true;

    if (this.tabs.length === 0) {
      this.createNewTerminal();
    } else if (this.activeTabId) {
      const tab = this.tabs.find(t => t.id === this.activeTabId);
      if (tab) { tab.panel.fit(); tab.panel.focus(); }
    }
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.visible = false;
  }

  get isVisible(): boolean { return this.visible; }

  async createNewTerminal(shell?: string, forceCwd?: string): Promise<void> {
    // If multiple workspace folders and no cwd specified, ask the user to pick
    if (!forceCwd) {
      try {
        const folders: string[] = await (window as any).pmOs.workspace.getFolders();
        if (folders && folders.length > 1) {
          this.showFolderPicker(folders, shell);
          return;
        }
      } catch {}
    }

    const shellName = shell || this.getDefaultShell();
    const displayName = this.generateDisplayName(shellName);

    // Get workspace folder for terminal cwd
    let cwd: string | undefined = forceCwd;
    if (!cwd) {
      try {
        const folders: string[] = await (window as any).pmOs.workspace.getFolders();
        if (folders && folders.length > 0) {
          cwd = folders[0];
        }
      } catch {}
    }


    const containerEl = document.createElement('div');
    containerEl.className = 'terminal-container';
    containerEl.style.display = 'none';
    this.contentEl.appendChild(containerEl);

    const panel = new TerminalPanel(containerEl);

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

    const tempId = `pending-${Date.now()}`;
    const workspaceName = cwd ? (cwd.split('/').pop() || 'PMOS') : this.getWorkspaceName();

    const tab: TerminalTab = { id: tempId, name: displayName, shellName, panel, containerEl, tabEl };
    this.tabs.push(tab);

    this.instancesPanel.addInstance(tempId, displayName, workspaceName);

    tabEl.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).classList.contains('terminal-tab-close')) {
        this.switchTab(tab.id);
      }
    });
    tabClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.killTerminal(tab.id);
    });

    this.switchTab(tab.id);
    this.updateTabStripVisibility();

    panel.init({ shell: shellName, cwd }).then(() => {
      const sessionId = panel.getSessionId();
      if (sessionId) {
        const oldId = tab.id;
        tab.id = sessionId;
        if (this.activeTabId === oldId) this.activeTabId = sessionId;
        this.instancesPanel.updateInstanceId(oldId, sessionId);

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
    if (this.activeTabId) this.killTerminal(this.activeTabId);
  }

  private killTerminal(id: string): void {
    const index = this.tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    const tab = this.tabs[index];
    tab.panel.dispose();
    tab.containerEl.remove();
    tab.tabEl.remove();
    this.tabs.splice(index, 1);
    this.instancesPanel.removeInstance(id);

    if (this.tabs.length === 0) {
      this.activeTabId = null;
      this.shellNameCounts.clear();
      this.hide();
    } else if (this.activeTabId === id) {
      const newIndex = Math.min(index, this.tabs.length - 1);
      this.switchTab(this.tabs[newIndex].id);
    }
    this.updateTabStripVisibility();
  }

  private showFolderPicker(folders: string[], shell?: string): void {
    // Remove existing picker if any
    const existing = document.querySelector('.terminal-folder-picker');
    if (existing) existing.remove();

    const picker = document.createElement('div');
    picker.className = 'terminal-folder-picker';
    picker.style.cssText = 'position: fixed; z-index: 1000; min-width: 200px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); overflow: hidden; font-size: 13px; padding: 4px 0;';

    // Title
    const title = document.createElement('div');
    title.style.cssText = 'padding: 8px 12px 4px; font-size: 11px; color: var(--text-muted); font-weight: 500;';
    title.textContent = 'Select working directory';
    picker.appendChild(title);

    for (const folder of folders) {
      const folderName = folder.split('/').pop() || folder;
      const item = document.createElement('div');
      item.style.cssText = 'padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: var(--text-primary); transition: background 100ms ease;';

      const iconEl = document.createElement('span');
      iconEl.className = 'codicon codicon-folder';
      iconEl.style.cssText = 'color: var(--text-muted); flex-shrink: 0;';
      item.appendChild(iconEl);

      const label = document.createElement('span');
      label.textContent = folderName;
      item.appendChild(label);

      item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-hover)'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
      item.addEventListener('click', () => {
        picker.remove();
        document.removeEventListener('click', outsideHandler);
        document.removeEventListener('keydown', escapeHandler);
        this.createNewTerminal(shell, folder);
      });

      picker.appendChild(item);
    }

    // Position centered in the terminal panel area
    const panelRect = this.el.getBoundingClientRect();
    picker.style.top = `${panelRect.top + 40}px`;
    picker.style.left = `${panelRect.left + (panelRect.width / 2) - 100}px`;

    document.body.appendChild(picker);

    const outsideHandler = (e: MouseEvent) => {
      if (!picker.contains(e.target as Node)) {
        picker.remove();
        document.removeEventListener('click', outsideHandler);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        picker.remove();
        document.removeEventListener('click', outsideHandler);
        document.removeEventListener('keydown', escapeHandler);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', outsideHandler);
      document.addEventListener('keydown', escapeHandler);
    }, 0);
  }

  private switchTab(id: string): void {
    this.activeTabId = id;
    this.instancesPanel.setActive(id);

    for (const tab of this.tabs) {
      const isActive = tab.id === id;
      tab.containerEl.style.display = isActive ? 'block' : 'none';
      tab.tabEl.classList.toggle('active', isActive);

      if (isActive) {
        requestAnimationFrame(() => { tab.panel.fit(); tab.panel.focus(); });
      }
    }
  }

  private updateTabStripVisibility(): void {
    this.tabStrip.style.display = this.instancesPanel.isVisible ? 'none' : 'flex';
  }

  private updateTabName(id: string, name: string): void {
    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return;
    tab.name = name;
    const nameEl = tab.tabEl.querySelector('.terminal-tab-name') as HTMLElement;
    if (nameEl) nameEl.textContent = name;
  }

  private renameActiveTerminal(): void {
    if (!this.activeTabId) return;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) return;

    if (this.instancesPanel.isVisible) {
      const renameBtn = document.querySelector(`.terminal-instance[data-id="${tab.id}"] button[title="Rename"]`) as HTMLButtonElement;
      if (renameBtn) renameBtn.click();
    } else {
      const nameEl = tab.tabEl.querySelector('.terminal-tab-name') as HTMLElement;
      if (!nameEl) return;
      const currentName = tab.name;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentName;
      input.style.cssText = 'width: 60px; font-size: 11px; font-weight: 500; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--accent); border-radius: 2px; padding: 0 4px; outline: none; font-family: inherit;';
      nameEl.textContent = '';
      nameEl.appendChild(input);
      input.focus();
      input.select();

      const commit = () => {
        const newName = input.value.trim() || currentName;
        nameEl.textContent = newName;
        tab.name = newName;
        this.instancesPanel.renameInstance(tab.id, newName);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); nameEl.textContent = currentName; }
      });
      input.addEventListener('blur', () => commit());
    }
  }

  private async changeCwd(): Promise<void> {
    const path = await (window as any).pmOs.dialog.openDirectory();
    if (path && this.activeTabId) {
      const tab = this.tabs.find(t => t.id === this.activeTabId);
      if (tab) tab.panel.writeText(`cd "${path}"\r`);
    }
  }

  private clearActiveTerminal(): void {
    if (!this.activeTabId) return;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab) tab.panel.clear();
  }

  private async copySelection(): Promise<void> {
    if (!this.activeTabId) return;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab) {
      const sel = tab.panel.getSelection();
      if (sel) await navigator.clipboard.writeText(sel);
    }
  }

  private async pasteToTerminal(): Promise<void> {
    if (!this.activeTabId) return;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab) {
      const text = await navigator.clipboard.readText();
      if (text) tab.panel.writeText(text);
    }
  }

  private selectDefaultShell(): void {
    const current = localStorage.getItem('pm-os-default-shell') || 'zsh';
    const next = current === 'zsh' ? 'bash' : 'zsh';
    localStorage.setItem('pm-os-default-shell', next);
  }

  private getDefaultShell(): string {
    return localStorage.getItem('pm-os-default-shell') || this.getShellName();
  }

  private getShellName(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac') || userAgent.includes('darwin')) return 'zsh';
    return 'bash';
  }

  private getWorkspaceName(): string {
    try {
      const name = (window as any).pmOs?.workspace?.getName?.();
      if (name && typeof name.then === 'function') return 'PMOS';
      return name || 'PMOS';
    } catch { return 'PMOS'; }
  }

  private generateDisplayName(shellName: string): string {
    const count = (this.shellNameCounts.get(shellName) || 0) + 1;
    this.shellNameCounts.set(shellName, count);
    return count === 1 ? shellName : `${shellName} (${count})`;
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
      if (this.activeTabId) {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab) tab.panel.fit();
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
