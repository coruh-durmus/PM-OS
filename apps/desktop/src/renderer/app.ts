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
      {
        onOpenFile: (entry) => {
          this.panelContainer.openFile(entry.path);
        },
      },
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

    // Meeting auto-detection notification
    (window as any).pmOs.meeting.onDetected((data: { panelId: string; url: string; platform: string }) => {
      this.showMeetingDetectedNotification(data);
    });
  }

  private showMeetingDetectedNotification(data: { panelId: string; url: string; platform: string; workspaceOpen?: boolean }): void {
    const el = document.createElement('div');
    el.style.cssText = 'position: fixed; bottom: 100px; left: 56px; width: 320px; background: var(--bg-surface); border: 1px solid var(--accent); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); z-index: 900; padding: 14px; font-size: 12px; animation: tooltip-enter 0.15s ease;';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-weight: 600; margin-bottom: 6px; color: var(--text-primary);';
    titleEl.textContent = `Meeting detected on ${data.platform}`;
    el.appendChild(titleEl);

    // If no workspace is open, show info message instead of countdown
    if (data.workspaceOpen === false) {
      const msgEl = document.createElement('div');
      msgEl.style.cssText = 'color: var(--text-secondary); margin-bottom: 10px; line-height: 1.4;';
      msgEl.textContent = 'Open a workspace to enable automatic transcription.';
      el.appendChild(msgEl);

      const closeBtn = document.createElement('button');
      closeBtn.style.cssText = 'background: var(--bg-hover); border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary); padding: 4px 12px; cursor: pointer; font-size: 12px;';
      closeBtn.textContent = 'Dismiss';
      closeBtn.addEventListener('click', () => el.remove());
      el.appendChild(closeBtn);

      document.body.appendChild(el);
      setTimeout(() => el.remove(), 8000);
      return;
    }

    let countdown = 5;
    let cancelled = false;

    const msgEl = document.createElement('div');
    msgEl.style.cssText = 'color: var(--text-secondary); margin-bottom: 10px;';
    msgEl.textContent = `Transcription starting in ${countdown}s...`;
    el.appendChild(msgEl);

    const skipBtn = document.createElement('button');
    skipBtn.style.cssText = 'background: var(--bg-hover); border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary); padding: 4px 12px; cursor: pointer; font-size: 12px;';
    skipBtn.textContent = 'Skip';
    skipBtn.addEventListener('click', () => {
      cancelled = true;
      (window as any).pmOs.meeting.skipTranscription();
      el.remove();
    });
    el.appendChild(skipBtn);

    document.body.appendChild(el);

    const timer = setInterval(() => {
      if (cancelled) { clearInterval(timer); return; }
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        msgEl.textContent = 'Starting transcription...';
        skipBtn.remove();
        (window as any).pmOs.audio.startCapture();
        setTimeout(() => el.remove(), 2000);
      } else {
        msgEl.textContent = `Transcription starting in ${countdown}s...`;
      }
    }, 1000);
  }

  private bindKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        this.commandPalette.toggle();
      }
      if (e.ctrlKey && e.shiftKey && e.key === '`') {
        e.preventDefault();
        this.bottomPanel.show();
        this.bottomPanel.createNewTerminal();
      } else if (e.ctrlKey && e.key === '`') {
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
