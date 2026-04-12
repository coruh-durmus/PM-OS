import { Sidebar } from './sidebar/sidebar';
import { TabBar } from './panels/tab-bar';
import { PanelContainer } from './panels/panel-container';
import { CommandPalette } from './command-palette/command-palette';
import { StatusBar } from './status-bar/status-bar';
import { BottomPanel } from './bottom-panel/bottom-panel';
import { ThemeManager } from './themes/theme-manager';
import { ThemePicker } from './themes/theme-picker';
import { NotificationCenter } from './notification-center/notification-center';

export class App {
  private sidebar!: Sidebar;
  private tabBar!: TabBar;
  private panelContainer!: PanelContainer;
  private commandPalette!: CommandPalette;
  private statusBar!: StatusBar;
  private bottomPanel!: BottomPanel;
  private themeManager!: ThemeManager;
  private themePicker!: ThemePicker;
  private notificationCenter!: NotificationCenter;

  init(): void {
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

    this.sidebar = new Sidebar(
      document.getElementById('activity-bar')!,
      this.tabBar,
      this.bottomPanel,
      this.notificationCenter,
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

    // Intercept links from embedded panels → open in Browser tab
    window.pmOs.wcv.onOpenUrl(({ url }: { url: string }) => {
      this.tabBar.openTab('browser', 'Browser', url);
    });

    this.bindKeyboard();
    this.sidebar.render();
    this.tabBar.render();
    this.panelContainer.render();
    this.statusBar.render();
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
    });
  }
}
