import { Sidebar } from './sidebar/sidebar';
import { TabBar } from './panels/tab-bar';
import { PanelContainer } from './panels/panel-container';
import { CommandPalette } from './command-palette/command-palette';
import { StatusBar } from './status-bar/status-bar';
import { BottomPanel } from './bottom-panel/bottom-panel';

export class App {
  private sidebar!: Sidebar;
  private tabBar!: TabBar;
  private panelContainer!: PanelContainer;
  private commandPalette!: CommandPalette;
  private statusBar!: StatusBar;
  private bottomPanel!: BottomPanel;

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

    this.sidebar = new Sidebar(
      document.getElementById('sidebar')!,
      this.tabBar,
      this.bottomPanel,
    );

    this.commandPalette = new CommandPalette(
      document.getElementById('command-palette')!,
      this.tabBar,
      this.bottomPanel,
    );

    this.statusBar = new StatusBar(
      document.getElementById('status-bar')!,
    );

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
    });
  }
}
