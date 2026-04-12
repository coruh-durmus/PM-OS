import type { TabBar } from '../panels/tab-bar';
import type { BottomPanel } from '../bottom-panel/bottom-panel';

interface SidebarItem {
  id: string;
  title: string;
  icon: string;
  url?: string;
  action?: 'toggle-terminal';
}

const workspaceItems: SidebarItem[] = [
  { id: 'slack', title: 'Slack', icon: '#', url: 'https://app.slack.com' },
  { id: 'notion', title: 'Notion', icon: 'N', url: 'https://www.notion.so' },
  { id: 'browser', title: 'Browser', icon: '\u{1F310}', url: 'https://www.google.com' },
  { id: 'figma', title: 'Figma', icon: 'F', url: 'https://www.figma.com' },
];

const toolItems: SidebarItem[] = [
  { id: 'ai-assistant', title: 'AI Assistant', icon: '\u{2728}' },
  { id: 'terminal', title: 'Terminal', icon: '>', action: 'toggle-terminal' },
  { id: 'projects', title: 'Projects', icon: '\u{1F4C1}' },
  { id: 'automations', title: 'Automations', icon: '\u{26A1}' },
];

export class Sidebar {
  private el: HTMLElement;
  private tabBar: TabBar;
  private bottomPanel: BottomPanel;

  constructor(el: HTMLElement, tabBar: TabBar, bottomPanel: BottomPanel) {
    this.el = el;
    this.tabBar = tabBar;
    this.bottomPanel = bottomPanel;
  }

  render(): void {
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    const logo = document.createElement('div');
    logo.className = 'sidebar-logo';
    logo.textContent = 'PM-OS';
    this.el.appendChild(logo);

    this.el.appendChild(this.createSection('Workspace', workspaceItems));
    this.el.appendChild(this.createSection('Tools', toolItems));
  }

  private createSection(title: string, items: SidebarItem[]): HTMLElement {
    const section = document.createElement('div');
    section.className = 'sidebar-section';

    const heading = document.createElement('div');
    heading.className = 'sidebar-section-title';
    heading.textContent = title;
    section.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'sidebar-items';

    for (const item of items) {
      const el = document.createElement('button');
      el.className = 'sidebar-item';
      el.dataset.id = item.id;

      const icon = document.createElement('span');
      icon.className = 'sidebar-item-icon';
      icon.textContent = item.icon;
      el.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'sidebar-item-label';
      label.textContent = item.title;
      el.appendChild(label);

      el.addEventListener('click', () => {
        if (item.action === 'toggle-terminal') {
          this.bottomPanel.toggle();
        } else {
          this.tabBar.openTab(item.id, item.title, item.url);
        }
      });

      list.appendChild(el);
    }

    section.appendChild(list);
    return section;
  }
}
