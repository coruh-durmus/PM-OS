import { SettingsPanel } from '../internal-panels/settings-panel';
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
  private browserToolbarEl: HTMLElement | null = null;
  private browserUrlText: HTMLElement | null = null;
  private browserBackBtn: HTMLButtonElement | null = null;
  private browserFwdBtn: HTMLButtonElement | null = null;
  private browserReloadBtn: HTMLButtonElement | null = null;
  private browserCurrentUrl: string = '';

  constructor(el: HTMLElement) {
    this.el = el;
    this.placeholderEl = this.buildPlaceholder();
    this.resizeObserver = new ResizeObserver(() => {
      this.syncActiveBounds();
    });
    this.resizeObserver.observe(this.el);

    window.pmOs.wcv.onUrlChanged(({ id, url }: { id: string; url: string }) => {
      if (id === 'browser') {
        this.browserCurrentUrl = url;
        if (this.browserSidebar) this.browserSidebar.setActiveUrl(url, '');
        if (this.browserUrlText) {
          try {
            const u = new URL(url);
            this.browserUrlText.textContent = u.hostname + (u.pathname !== '/' ? u.pathname : '');
          } catch {
            this.browserUrlText.textContent = url;
          }
        }
        this.updateBrowserNavState();
      }
    });

    window.pmOs.wcv.onTitleChanged(({ id, title }: { id: string; title: string }) => {
      if (id === 'browser' && this.browserSidebar) {
        this.browserSidebar.updateActiveTab('', title);
      }
    });

    window.pmOs.wcv.onLoading(({ id, loading }: { id: string; loading: boolean }) => {
      if (id === 'browser' && this.browserReloadBtn) {
        this.browserReloadBtn.innerHTML = loading
          ? '<span class="codicon codicon-close"></span>'
          : '<span class="codicon codicon-refresh"></span>';
        this.browserReloadBtn.title = loading ? 'Stop' : 'Reload';
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

    // Show/hide browser sidebar and toolbar
    if (id === 'browser') {
      this.showBrowserToolbar();
      this.showBrowserSidebar();
    } else {
      this.hideBrowserToolbar();
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

  private buildBrowserToolbar(): HTMLElement {
    const bar = document.createElement('div');
    bar.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; height: 32px; z-index: 6; display: flex; align-items: center; padding: 0 8px; gap: 2px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); font-size: 13px;';

    const btnStyle = 'width: 24px; height: 24px; border: none; background: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; padding: 0; transition: color 100ms ease, background 100ms ease;';

    const makeBtn = (iconClass: string, title: string, onClick: () => void): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.style.cssText = btnStyle;
      btn.title = title;
      btn.innerHTML = `<span class="codicon ${iconClass}"></span>`;
      btn.addEventListener('mouseenter', () => { btn.style.color = 'var(--text-primary)'; btn.style.background = 'var(--bg-hover)'; });
      btn.addEventListener('mouseleave', () => { btn.style.color = 'var(--text-muted)'; btn.style.background = ''; });
      btn.addEventListener('click', onClick);
      return btn;
    };

    // Left group
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; align-items: center; gap: 2px;';

    left.appendChild(makeBtn('codicon-layout-sidebar-left', 'Toggle Sidebar (Cmd+B)', () => this.toggleBrowserSidebar()));

    this.browserBackBtn = makeBtn('codicon-arrow-left', 'Back', () => window.pmOs.wcv.goBack('browser'));
    left.appendChild(this.browserBackBtn);

    this.browserFwdBtn = makeBtn('codicon-arrow-right', 'Forward', () => window.pmOs.wcv.goForward('browser'));
    left.appendChild(this.browserFwdBtn);

    this.browserReloadBtn = makeBtn('codicon-refresh', 'Reload', () => window.pmOs.wcv.reload('browser'));
    left.appendChild(this.browserReloadBtn);

    bar.appendChild(left);

    // Center — URL bar
    const center = document.createElement('div');
    center.style.cssText = 'flex: 1; display: flex; justify-content: center; padding: 0 12px; min-width: 0;';

    const urlBar = document.createElement('div');
    urlBar.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 3px 12px; background: var(--bg-surface); border-radius: 16px; max-width: 400px; width: 100%; cursor: text; transition: background 100ms ease;';
    urlBar.addEventListener('mouseenter', () => { urlBar.style.background = 'var(--bg-hover)'; });
    urlBar.addEventListener('mouseleave', () => { urlBar.style.background = 'var(--bg-surface)'; });

    const linkIcon = document.createElement('span');
    linkIcon.className = 'codicon codicon-link';
    linkIcon.style.cssText = 'color: var(--text-muted); flex-shrink: 0; font-size: 12px;';
    urlBar.appendChild(linkIcon);

    this.browserUrlText = document.createElement('span');
    this.browserUrlText.style.cssText = 'color: var(--text-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;';
    this.browserUrlText.textContent = 'google.com';
    urlBar.appendChild(this.browserUrlText);

    // Click to edit URL
    urlBar.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = this.browserCurrentUrl || '';
      input.style.cssText = 'width: 100%; background: var(--bg-primary); border: 1px solid var(--accent); border-radius: 16px; padding: 3px 12px; color: var(--text-primary); font-size: 12px; outline: none; font-family: inherit;';

      urlBar.style.display = 'none';
      center.appendChild(input);
      input.focus();
      input.select();

      const commit = () => {
        let url = input.value.trim();
        if (url) {
          if (!url.includes('://')) {
            if (url.includes('.') && !url.includes(' ')) {
              url = 'https://' + url;
            } else {
              url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
            }
          }
          window.pmOs.wcv.navigate('browser', url);
        }
        input.remove();
        urlBar.style.display = 'flex';
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { input.remove(); urlBar.style.display = 'flex'; }
      });
      input.addEventListener('blur', () => { input.remove(); urlBar.style.display = 'flex'; });
    });

    center.appendChild(urlBar);
    bar.appendChild(center);

    // Right group
    const right = document.createElement('div');
    right.style.cssText = 'display: flex; align-items: center; gap: 2px;';
    right.appendChild(makeBtn('codicon-bookmark', 'Bookmark This Page', () => {
      if (this.browserSidebar && this.browserCurrentUrl) {
        this.browserSidebar.bookmarkCurrentPage?.();
      }
    }));
    bar.appendChild(right);

    return bar;
  }

  private async updateBrowserNavState(): Promise<void> {
    try {
      const state = await window.pmOs.wcv.getState('browser');
      if (state) {
        if (this.browserBackBtn) {
          this.browserBackBtn.style.opacity = state.canGoBack ? '1' : '0.3';
          this.browserBackBtn.style.pointerEvents = state.canGoBack ? 'auto' : 'none';
        }
        if (this.browserFwdBtn) {
          this.browserFwdBtn.style.opacity = state.canGoForward ? '1' : '0.3';
          this.browserFwdBtn.style.pointerEvents = state.canGoForward ? 'auto' : 'none';
        }
      }
    } catch {}
  }

  private showBrowserToolbar(): void {
    if (!this.browserToolbarEl) {
      this.browserToolbarEl = this.buildBrowserToolbar();
      this.el.appendChild(this.browserToolbarEl);
    }
    this.browserToolbarEl.style.display = 'flex';
    this.updateBrowserNavState();
  }

  private hideBrowserToolbar(): void {
    if (this.browserToolbarEl) {
      this.browserToolbarEl.style.display = 'none';
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
    const toolbarHeight = this.activePanelId === 'browser' ? 32 : 0;
    return {
      x: Math.round(rect.x) + sidebarOffset,
      y: Math.round(rect.y) + toolbarHeight,
      width: Math.round(rect.width) - sidebarOffset,
      height: Math.round(rect.height) - toolbarHeight,
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
      case 'settings': {
        const panel = new SettingsPanel(wrapper);
        panel.render();
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
