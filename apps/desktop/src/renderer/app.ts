import { Sidebar } from './sidebar/sidebar';
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

    this.bottomPanel = new BottomPanel(
      document.getElementById('bottom-panel')!,
    );

    this.notificationCenter = new NotificationCenter();

    this.sidebarPanel = new SidebarPanel(
      document.getElementById('sidebar')!,
    );

    this.sidebar = new Sidebar(
      document.getElementById('activity-bar')!,
      this.panelContainer,
      this.bottomPanel,
      this.notificationCenter,
      this.sidebarPanel,
    );

    this.commandPalette = new CommandPalette(
      document.getElementById('command-palette')!,
      this.panelContainer,
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

    // Intercept links from embedded panels — open in Browser panel
    window.pmOs.wcv.onOpenUrl(({ url }: { url: string }) => {
      this.panelContainer.showPanel('browser', url);
    });

    // Listen for workspace changes
    (window as any).pmOs.workspace.onChanged((data: any) => {
      const titleEl = document.getElementById('titlebar-title');
      if (titleEl) {
        titleEl.textContent = data.isOpen ? data.name + ' \u2014 PMOS' : 'PMOS';
      }
      this.statusBar.setProject(data.isOpen ? data.name : 'No workspace open');
    });

    this.bindKeyboard();
    this.sidebar.render();
    this.panelContainer.render();
    this.statusBar.render();

    const meetingMonitor = new MeetingMonitor();
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        this.panelContainer.toggleBrowserSidebar();
      }

      // CMD+1-8 hotkeys for quick app switching
      const apps = [
        { id: 'slack', url: 'https://app.slack.com' },
        { id: 'notion', url: 'https://www.notion.so' },
        { id: 'figma', url: 'https://www.figma.com' },
        { id: 'gmail', url: 'https://mail.google.com' },
        { id: 'calendar', url: 'https://calendar.google.com' },
        { id: 'jira', url: 'https://www.atlassian.com/software/jira' },
        { id: 'confluence', url: 'https://www.atlassian.com/software/confluence' },
        { id: 'browser', url: 'https://www.google.com' },
      ];

      for (let i = 0; i < apps.length; i++) {
        if ((e.metaKey || e.ctrlKey) && e.key === String(i + 1)) {
          e.preventDefault();
          this.panelContainer.showPanel(apps[i].id, apps[i].url);
        }
      }
    });
  }
}
