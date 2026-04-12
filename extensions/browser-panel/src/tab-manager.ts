export interface BrowserTab {
  id: string;
  url: string;
  title: string;
}

/**
 * Manages multiple browser tabs within the browser panel.
 * Tracks the active tab, URLs, and titles.
 */
export class TabManager {
  private tabs = new Map<string, BrowserTab>();
  private activeTabId: string | null = null;
  private nextId = 1;

  /**
   * Open a new tab with the given URL.
   * Returns the new tab's ID.
   */
  openTab(url: string): string {
    const id = `tab-${this.nextId++}`;
    const tab: BrowserTab = { id, url, title: url };
    this.tabs.set(id, tab);
    this.activeTabId = id;
    return id;
  }

  /**
   * Close a tab by ID.
   * If the closed tab was active, the most recent remaining tab becomes active.
   */
  closeTab(id: string): void {
    this.tabs.delete(id);
    if (this.activeTabId === id) {
      const remaining = Array.from(this.tabs.keys());
      this.activeTabId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    }
  }

  /**
   * Get all currently open tabs.
   */
  getActiveTabs(): BrowserTab[] {
    return Array.from(this.tabs.values());
  }

  /**
   * Get the currently active tab, or null if no tabs are open.
   */
  getActiveTab(): BrowserTab | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) ?? null;
  }

  /**
   * Set the active tab by ID.
   */
  setActiveTab(id: string): void {
    if (this.tabs.has(id)) {
      this.activeTabId = id;
    }
  }

  /**
   * Update the title of a tab.
   */
  updateTabTitle(id: string, title: string): void {
    const tab = this.tabs.get(id);
    if (tab) {
      tab.title = title;
    }
  }

  /**
   * Update the URL of a tab.
   */
  updateTabUrl(id: string, url: string): void {
    const tab = this.tabs.get(id);
    if (tab) {
      tab.url = url;
    }
  }
}
