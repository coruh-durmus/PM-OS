import { TerminalPanel } from '../terminal/terminal.js';

interface PanelEntry {
  id: string;
  isWcv: boolean;
  internalEl?: HTMLElement;
}

export class PanelContainer {
  private el: HTMLElement;
  private panels = new Map<string, PanelEntry>();
  private terminals = new Map<string, TerminalPanel>();
  private terminalInitialized = new Set<string>();
  private activePanelId: string | null = null;
  private resizeObserver: ResizeObserver;
  private placeholderEl: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    this.placeholderEl = this.buildPlaceholder();
    this.resizeObserver = new ResizeObserver(() => {
      this.syncActiveBounds();
    });
    this.resizeObserver.observe(this.el);
  }

  render(): void {
    this.showPlaceholder();
  }

  showPlaceholder(): void {
    this.hideActivePanel();
    this.clearEl();
    this.el.appendChild(this.placeholderEl);
    this.activePanelId = null;
  }

  async showPanel(id: string, url?: string): Promise<void> {
    this.hideActivePanel();

    if (this.el.contains(this.placeholderEl)) {
      this.el.removeChild(this.placeholderEl);
    }

    let panel = this.panels.get(id);

    if (!panel) {
      const isWcv = !!url && url.startsWith('http');

      if (isWcv) {
        const bounds = this.getBounds();
        await window.pmOs.wcv.create({
          id,
          url,
          partition: `persist:${id}`,
          bounds,
          show: true,
        });
        panel = { id, isWcv: true };
      } else if (id === 'terminal') {
        const containerEl = document.createElement('div');
        containerEl.className = 'terminal-container';
        const terminalPanel = new TerminalPanel(containerEl);
        this.terminals.set(id, terminalPanel);
        panel = { id, isWcv: false, internalEl: containerEl };
        // init() is called after the element is appended to the DOM below
      } else {
        const internalEl = this.buildInternalPanel(id);
        panel = { id, isWcv: false, internalEl };
      }

      this.panels.set(id, panel);
    } else if (panel.isWcv) {
      const bounds = this.getBounds();
      await window.pmOs.wcv.setBounds(id, bounds);
    }

    if (!panel.isWcv && panel.internalEl) {
      for (const other of this.panels.values()) {
        if (other.internalEl && other.id !== id && this.el.contains(other.internalEl)) {
          this.el.removeChild(other.internalEl);
        }
      }
      if (!this.el.contains(panel.internalEl)) {
        this.el.appendChild(panel.internalEl);
      }
    }

    this.activePanelId = id;

    // Initialize terminal after container is in the DOM (only once)
    const terminal = this.terminals.get(id);
    if (terminal && !this.terminalInitialized.has(id)) {
      this.terminalInitialized.add(id);
      terminal.init().catch(() => {});
    } else if (terminal) {
      // Focus existing terminal when switching back to it
      terminal.focus();
    }
  }

  async destroyPanel(id: string): Promise<void> {
    const panel = this.panels.get(id);
    if (!panel) return;

    if (panel.isWcv) {
      await window.pmOs.wcv.destroy(id);
    } else if (panel.internalEl && this.el.contains(panel.internalEl)) {
      this.el.removeChild(panel.internalEl);
    }

    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.dispose();
      this.terminals.delete(id);
      this.terminalInitialized.delete(id);
    }

    this.panels.delete(id);

    if (this.activePanelId === id) {
      this.activePanelId = null;
    }
  }

  private hideActivePanel(): void {
    if (!this.activePanelId) return;
    const panel = this.panels.get(this.activePanelId);
    if (!panel) return;

    if (panel.isWcv) {
      window.pmOs.wcv.setBounds(this.activePanelId, { x: 0, y: 0, width: 0, height: 0 });
    } else if (panel.internalEl && this.el.contains(panel.internalEl)) {
      this.el.removeChild(panel.internalEl);
    }
  }

  private syncActiveBounds(): void {
    if (!this.activePanelId) return;
    const panel = this.panels.get(this.activePanelId);
    if (!panel || !panel.isWcv) return;
    const bounds = this.getBounds();
    window.pmOs.wcv.setBounds(this.activePanelId, bounds);
  }

  private getBounds(): { x: number; y: number; width: number; height: number } {
    const rect = this.el.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }

  private clearEl(): void {
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }
  }

  private buildPlaceholder(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'panel-placeholder';

    const content = document.createElement('div');
    content.className = 'panel-placeholder-content';

    const icon = document.createElement('div');
    icon.className = 'panel-placeholder-icon';
    icon.textContent = '\u{1F4BB}';
    content.appendChild(icon);

    const title = document.createElement('div');
    title.className = 'panel-placeholder-title';
    title.textContent = 'Welcome to PM-OS';
    content.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'panel-placeholder-subtitle';
    subtitle.textContent = 'Select a workspace or tool from the sidebar to get started';
    content.appendChild(subtitle);

    wrapper.appendChild(content);
    return wrapper;
  }

  private buildInternalPanel(id: string): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'panel-internal';

    const content = document.createElement('div');
    content.className = 'panel-internal-content';

    const icon = document.createElement('div');
    icon.className = 'panel-internal-icon';
    icon.textContent = '\u{1F6E0}';
    content.appendChild(icon);

    const title = document.createElement('div');
    title.className = 'panel-internal-title';
    title.textContent = id;
    content.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'panel-internal-subtitle';
    subtitle.textContent = `This panel will be available when the ${id} extension is installed.`;
    content.appendChild(subtitle);

    wrapper.appendChild(content);
    return wrapper;
  }
}
