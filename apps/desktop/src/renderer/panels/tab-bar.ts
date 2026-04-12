import type { PanelContainer } from './panel-container';

interface Tab {
  id: string;
  title: string;
  url?: string;
}

export class TabBar {
  private el: HTMLElement;
  private panelContainer: PanelContainer;
  private tabs: Tab[] = [];
  private activeTabId: string | null = null;

  constructor(el: HTMLElement, panelContainer: PanelContainer) {
    this.el = el;
    this.panelContainer = panelContainer;
  }

  openTab(id: string, title: string, url?: string): void {
    const existing = this.tabs.find((t) => t.id === id);
    if (existing) {
      this.activateTab(id);
      if (url) {
        this.panelContainer.navigatePanel(id, url);
      }
      return;
    }

    this.tabs.push({ id, title, url });
    this.activateTab(id);
    this.render();
  }

  closeTab(id: string): void {
    const index = this.tabs.findIndex((t) => t.id === id);
    if (index === -1) return;

    this.panelContainer.destroyPanel(id);
    this.tabs.splice(index, 1);

    if (this.activeTabId === id) {
      if (this.tabs.length > 0) {
        const nextIndex = Math.min(index, this.tabs.length - 1);
        this.activateTab(this.tabs[nextIndex].id);
      } else {
        this.activeTabId = null;
        this.panelContainer.showPlaceholder();
      }
    }

    this.render();
  }

  updateTabTitle(id: string, title: string): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (tab) {
      tab.title = title;
      this.render();
    }
  }

  private activateTab(id: string): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;

    this.activeTabId = id;
    this.panelContainer.showPanel(id, tab.url);
    this.render();
  }

  render(): void {
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    for (const tab of this.tabs) {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab' + (tab.id === this.activeTabId ? ' tab-active' : '');
      tabEl.dataset.id = tab.id;

      const titleEl = document.createElement('span');
      titleEl.className = 'tab-title';
      titleEl.textContent = tab.title;
      tabEl.appendChild(titleEl);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '\u00D7';
      closeBtn.title = 'Close tab';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', () => {
        this.activateTab(tab.id);
      });

      this.el.appendChild(tabEl);
    }
  }
}
