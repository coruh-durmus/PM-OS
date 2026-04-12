import type { TabBar } from '../panels/tab-bar';
import type { BottomPanel } from '../bottom-panel/bottom-panel';
import type { NotificationCenter } from '../notification-center/notification-center';
import type { SidebarPanel } from '../sidebar-panel/sidebar-panel';
import { icons } from './icons';

interface ActivityItem {
  id: string;
  title: string;
  icon: string;          // key into the icons map
  url?: string;          // opens as webview tab
  action?: 'toggle-terminal' | 'toggle-notifications' | 'toggle-sidebar';
  sidebarView?: string;  // which sidebar view to show
}

const topItems: ActivityItem[] = [
  { id: 'slack', title: 'Slack', icon: 'slack', url: 'https://app.slack.com' },
  { id: 'notion', title: 'Notion', icon: 'notion', url: 'https://www.notion.so' },
  { id: 'figma', title: 'Figma', icon: 'figma', url: 'https://www.figma.com' },
  { id: 'gmail', title: 'Gmail', icon: 'gmail', url: 'https://mail.google.com' },
  { id: 'browser', title: 'Browser', icon: 'browser', url: 'https://www.google.com' },
];

const bottomItems: ActivityItem[] = [
  { id: 'ai-assistant', title: 'AI Assistant', icon: 'ai-assistant' },
  { id: 'terminal', title: 'Terminal', icon: 'terminal', action: 'toggle-terminal' },
  { id: 'projects', title: 'Projects', icon: 'projects', action: 'toggle-sidebar', sidebarView: 'projects' },
  { id: 'automations', title: 'Automations', icon: 'automations' },
  { id: 'mcp', title: 'MCP Center', icon: 'mcp' },
  { id: 'notifications', title: 'Notifications', icon: 'notifications', action: 'toggle-notifications' },
  { id: 'settings', title: 'Settings', icon: 'settings' },
];

export class Sidebar {
  private activityBar: HTMLElement;
  private tabBar: TabBar;
  private bottomPanel: BottomPanel;
  private notificationCenter: NotificationCenter | null;
  private sidebarPanel: SidebarPanel | null;
  private tooltip: HTMLElement | null = null;
  private activeId: string | null = null;

  constructor(activityBar: HTMLElement, tabBar: TabBar, bottomPanel: BottomPanel, notificationCenter?: NotificationCenter, sidebarPanel?: SidebarPanel) {
    this.activityBar = activityBar;
    this.tabBar = tabBar;
    this.bottomPanel = bottomPanel;
    this.notificationCenter = notificationCenter ?? null;
    this.sidebarPanel = sidebarPanel ?? null;
  }

  render(): void {
    while (this.activityBar.firstChild) {
      this.activityBar.removeChild(this.activityBar.firstChild);
    }

    const top = document.createElement('div');
    top.className = 'activity-bar-top';
    for (const item of topItems) {
      top.appendChild(this.createButton(item));
    }
    this.activityBar.appendChild(top);

    const bottom = document.createElement('div');
    bottom.className = 'activity-bar-bottom';
    for (const item of bottomItems) {
      bottom.appendChild(this.createButton(item));
    }
    this.activityBar.appendChild(bottom);
  }

  private createButton(item: ActivityItem): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'activity-bar-item';
    btn.dataset.id = item.id;
    btn.style.position = 'relative';
    btn.innerHTML = icons[item.icon] ?? '';

    // Notification badge
    if (item.id === 'notifications') {
      const badge = document.createElement('span');
      badge.className = 'notification-badge';
      badge.style.display = 'none';
      btn.appendChild(badge);
      this.notificationCenter?.setBadgeElement(badge);
    }

    // Tooltip on hover
    btn.addEventListener('mouseenter', (e) => {
      this.showTooltip(item.title, (e.target as HTMLElement).closest('.activity-bar-item')!);
    });
    btn.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });

    // Click action
    btn.addEventListener('click', (e) => {
      if (item.action === 'toggle-terminal') {
        this.bottomPanel.toggle();
        return;
      }
      if (item.action === 'toggle-notifications') {
        e.stopPropagation();
        this.notificationCenter?.toggle();
        return;
      }
      if (item.action === 'toggle-sidebar' && item.sidebarView) {
        this.sidebarPanel?.toggle(item.sidebarView);
        this.setActive(item.id);
        return;
      }
      this.setActive(item.id);
      this.tabBar.openTab(item.id, item.title, item.url);
    });

    return btn;
  }

  private setActive(id: string): void {
    this.activeId = id;
    const items = this.activityBar.querySelectorAll('.activity-bar-item');
    for (const el of items) {
      el.classList.toggle('active', (el as HTMLElement).dataset.id === id);
    }
  }

  private showTooltip(text: string, anchor: HTMLElement): void {
    this.hideTooltip();
    const tip = document.createElement('div');
    tip.className = 'activity-bar-tooltip';
    tip.textContent = text;
    document.body.appendChild(tip);

    const rect = anchor.getBoundingClientRect();
    tip.style.top = `${rect.top + rect.height / 2 - tip.offsetHeight / 2}px`;
    this.tooltip = tip;
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }
}
