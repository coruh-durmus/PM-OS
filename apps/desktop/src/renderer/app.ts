import { Sidebar } from './sidebar/sidebar';
import { TabBar } from './panels/tab-bar';
import { PanelContainer } from './panels/panel-container';
import { CommandPalette } from './command-palette/command-palette';
import { StatusBar } from './status-bar/status-bar';

export class App {
  private sidebar!: Sidebar;
  private tabBar!: TabBar;
  private panelContainer!: PanelContainer;
  private commandPalette!: CommandPalette;
  private statusBar!: StatusBar;

  init(): void {
    this.panelContainer = new PanelContainer(
      document.getElementById('panel-container')!,
    );

    this.tabBar = new TabBar(
      document.getElementById('tab-bar')!,
      this.panelContainer,
    );

    this.sidebar = new Sidebar(
      document.getElementById('sidebar')!,
      this.tabBar,
    );

    this.commandPalette = new CommandPalette(
      document.getElementById('command-palette')!,
      this.tabBar,
    );

    this.statusBar = new StatusBar(
      document.getElementById('status-bar')!,
    );

    this.bindKeyboard();
    this.sidebar.render();
    this.tabBar.render();
    this.panelContainer.render();
    this.statusBar.render();
  }

  private bindKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      // Cmd+P / Ctrl+P toggles command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        this.commandPalette.toggle();
      }
      // Ctrl+` opens terminal
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        this.tabBar.openTab('terminal', 'Terminal');
      }
    });
  }
}
