import { AiPanel } from '../internal-panels/ai-panel';
import { AutomationsPanel } from '../internal-panels/automations-panel';
import { McpPanel } from '../internal-panels/mcp-panel';
import { ExtensionStorePanel } from '../internal-panels/extension-store-panel';
import { WelcomeScreen } from '../welcome/welcome-screen.js';
import { BrowserSidebar } from '../browser-sidebar/browser-sidebar.js';
import { FileViewerPanel } from '../internal-panels/file-viewer-panel';

interface PanelEntry {
  id: string;
  isWcv: boolean;
  internalEl?: HTMLElement;
}

export class PanelContainer {
  private el: HTMLElement;
  private panels = new Map<string, PanelEntry>();
  private activePanelId: string | null = null;
  private resizeObserver: ResizeObserver;
  private placeholderEl: HTMLElement;
  private browserSidebar: BrowserSidebar | null = null;
  private browserSidebarEl: HTMLElement | null = null;
  private browserSidebarVisible = false;
  private fileViewer: FileViewerPanel | null = null;

  constructor(el: HTMLElement) {
    this.el = el;
    this.placeholderEl = this.buildPlaceholder();
    this.resizeObserver = new ResizeObserver(() => {
      this.syncActiveBounds();
    });
    this.resizeObserver.observe(this.el);

    window.pmOs.wcv.onUrlChanged(({ id, url }: { id: string; url: string }) => {
      if (id === 'browser' && this.browserSidebar) {
        this.browserSidebar.setActiveUrl(url, '');
      }
    });

    window.pmOs.wcv.onTitleChanged(({ id, title }: { id: string; title: string }) => {
      if (id === 'browser' && this.browserSidebar) {
        // Update title on the active tab
        this.browserSidebar.updateActiveTab('', title);
      }
    });
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

    // Show/hide browser sidebar
    if (id === 'browser') {
      this.showBrowserSidebar();
    } else {
      this.hideBrowserSidebar();
    }
  }

  async navigatePanel(id: string, url: string): Promise<void> {
    const panel = this.panels.get(id);
    if (panel && panel.isWcv) {
      await window.pmOs.wcv.navigate(id, url);
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

  private showBrowserSidebar(): void {
    if (!this.browserSidebarEl) {
      this.browserSidebarEl = document.createElement('div');
      this.browserSidebarEl.className = 'browser-sidebar';
      this.el.appendChild(this.browserSidebarEl);

      this.browserSidebar = new BrowserSidebar(this.browserSidebarEl, {
        onNavigate: (url: string) => {
          window.pmOs.wcv.navigate('browser', url);
        },
        onNewTab: () => {
          window.pmOs.wcv.navigate('browser', 'https://www.google.com');
        },
      });

      // Re-sync bounds when sidebar is toggled
      this.browserSidebar.setOnToggle(() => {
        this.browserSidebarVisible = this.browserSidebar!.isVisible;
        this.syncActiveBounds();
      });

      // Add initial tab
      this.browserSidebar.addTab('https://www.google.com', 'Google');
    }

    this.browserSidebarVisible = !this.browserSidebar!.isCollapsed;
    this.browserSidebar!.show();

    // Re-sync WCV bounds to account for sidebar width
    this.syncActiveBounds();
  }

  toggleBrowserSidebar(): void {
    if (this.browserSidebar) {
      this.browserSidebar.toggle();
    }
  }

  async openFile(filePath: string): Promise<void> {
    await this.showPanel('file-viewer');
    if (this.fileViewer) {
      await this.fileViewer.loadFile(filePath);
    }
  }

  private hideBrowserSidebar(): void {
    if (this.browserSidebarEl) {
      this.browserSidebarEl.style.display = 'none';
    }
    this.browserSidebarVisible = false;
    this.syncActiveBounds();
  }

  private getBounds(): { x: number; y: number; width: number; height: number } {
    const rect = this.el.getBoundingClientRect();
    const sidebarOffset = this.browserSidebarVisible ? 220 : 0;
    return {
      x: Math.round(rect.x) + sidebarOffset,
      y: Math.round(rect.y),
      width: Math.round(rect.width) - sidebarOffset,
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
    wrapper.style.cssText = 'position: absolute; inset: 0;';

    const welcome = new WelcomeScreen(wrapper);
    welcome.render();

    return wrapper;
  }

  private buildInternalPanel(id: string): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: absolute; inset: 0; overflow: hidden;';

    switch (id) {
      case 'ai-assistant': {
        const panel = new AiPanel(wrapper);
        panel.render();
        break;
      }
      case 'automations': {
        const panel = new AutomationsPanel(wrapper);
        panel.render();
        break;
      }
      case 'mcp': {
        const panel = new McpPanel(wrapper);
        panel.render();
        break;
      }
      case 'extensions': {
        const panel = new ExtensionStorePanel(wrapper);
        panel.render();
        break;
      }
      case 'file-viewer': {
        const panel = new FileViewerPanel(wrapper);
        panel.render();
        this.fileViewer = panel;
        break;
      }
      default: {
        // Generic fallback for unknown panels
        wrapper.style.cssText =
          'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;';
        const content = document.createElement('div');
        content.style.cssText = 'text-align: center; color: var(--text-muted);';
        const fallbackIcon = document.createElement('div');
        fallbackIcon.style.cssText = 'font-size: 32px; margin-bottom: 8px;';
        fallbackIcon.textContent = '\u{1F6E0}';
        content.appendChild(fallbackIcon);
        const fallbackName = document.createElement('div');
        fallbackName.style.fontWeight = '500';
        fallbackName.textContent = id;
        content.appendChild(fallbackName);
        wrapper.appendChild(content);
      }
    }

    return wrapper;
  }
}
