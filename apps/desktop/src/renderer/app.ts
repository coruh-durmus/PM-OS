import { Sidebar } from './sidebar/sidebar';
import { TabBar } from './panels/tab-bar';
import { PanelContainer } from './panels/panel-container';
import { CommandPalette } from './command-palette/command-palette';
import { StatusBar } from './status-bar/status-bar';
import { BottomPanel } from './bottom-panel/bottom-panel';
import { ThemeManager } from './themes/theme-manager';
import { ThemePicker } from './themes/theme-picker';
import { NotificationCenter } from './notification-center/notification-center';
import { SidebarPanel } from './sidebar-panel/sidebar-panel';
import { McpHealthChecker } from './internal-panels/mcp-health.js';
import { Onboarding } from './onboarding/onboarding';
import { MeetingMonitor } from './meeting-monitor/meeting-monitor.js';

export class App {
  private sidebar!: Sidebar;
  private sidebarPanel!: SidebarPanel;
  private tabBar!: TabBar;
  private panelContainer!: PanelContainer;
  private commandPalette!: CommandPalette;
  private statusBar!: StatusBar;
  private bottomPanel!: BottomPanel;
  private themeManager!: ThemeManager;
  private themePicker!: ThemePicker;
  private notificationCenter!: NotificationCenter;

  init(): void {
    const onboarded = localStorage.getItem('pm-os-onboarded');
    if (!onboarded) {
      const onboarding = new Onboarding(document.getElementById('app')!);
      onboarding.start(() => {
        localStorage.setItem('pm-os-onboarded', 'true');
        this.initApp();
      });
      return;
    }
    this.initApp();
  }

  private initApp(): void {
    this.panelContainer = new PanelContainer(
      document.getElementById('panel-container')!,
    );

    this.tabBar = new TabBar(
      document.getElementById('tab-bar')!,
      this.panelContainer,
    );

    this.bottomPanel = new BottomPanel(
      document.getElementById('bottom-panel')!,
    );

    this.notificationCenter = new NotificationCenter();

    this.sidebarPanel = new SidebarPanel(
      document.getElementById('sidebar')!,
    );

    this.sidebar = new Sidebar(
      document.getElementById('activity-bar')!,
      this.tabBar,
      this.bottomPanel,
      this.notificationCenter,
      this.sidebarPanel,
    );

    this.commandPalette = new CommandPalette(
      document.getElementById('command-palette')!,
      this.tabBar,
      this.bottomPanel,
    );

    this.statusBar = new StatusBar(
      document.getElementById('status-bar')!,
    );

    this.themeManager = new ThemeManager();
    this.themePicker = new ThemePicker(this.themeManager);

    this.commandPalette.addCommand({
      id: 'change-theme',
      title: 'Preferences: Color Theme',
      category: 'Settings',
      action: () => this.themePicker.toggle(),
    });

    // Intercept links from embedded panels - open in Browser tab
    window.pmOs.wcv.onOpenUrl(({ url }: { url: string }) => {
      this.tabBar.openTab('browser', 'Browser', url);
    });

    // Listen for workspace changes
    (window as any).pmOs.workspace.onChanged((data: any) => {
      // Update title bar
      const titleEl = document.getElementById('titlebar-title');
      if (titleEl) {
        titleEl.textContent = data.isOpen ? data.name + ' \u2014 PMOS' : 'PMOS';
      }
      // Update status bar
      this.statusBar.setProject(data.isOpen ? data.name : 'No workspace open');
    });

    this.bindKeyboard();
    this.sidebar.render();
    this.tabBar.render();
    this.panelContainer.render();
    this.statusBar.render();

    // Start meeting monitor
    const meetingMonitor = new MeetingMonitor();

    // Check MCP health after 5 seconds
    const mcpChecker = new McpHealthChecker();
    setTimeout(() => mcpChecker.checkAndNotify(), 5000);
  }

  private bindKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        this.commandPalette.toggle();
      }
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        this.bottomPanel.toggle();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        this.themePicker.toggle();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        (window as any).pmOs.workspace.openFolder();
      }
      // Cmd+B toggles browser sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        this.panelContainer.toggleBrowserSidebar();
      }

      // CMD+1-9 hotkeys for quick app switching
      const appHotkeys = ['slack', 'notion', 'figma', 'gmail', 'calendar', 'jira', 'confluence', 'browser'];
      const appNames = ['Slack', 'Notion', 'Figma', 'Gmail', 'Calendar', 'Jira', 'Confluence', 'Browser'];
      const appUrls = [
        'https://app.slack.com', 'https://www.notion.so', 'https://www.figma.com',
        'https://mail.google.com', 'https://calendar.google.com', 'https://www.atlassian.com/software/jira',
        'https://www.atlassian.com/software/confluence', 'https://www.google.com'
      ];

      for (let i = 0; i < appHotkeys.length; i++) {
        // Check for Cmd+1 through Cmd+8
        if ((e.metaKey || e.ctrlKey) && e.key === String(i + 1)) {
          e.preventDefault();
          this.tabBar.openTab(appHotkeys[i], appNames[i], appUrls[i]);
        }
      }
    });
  }
}
