import { BrowserWindow, WebContentsView } from 'electron';
import type { PanelBounds, WebContentsViewOptions, WebContentsViewState } from '@pm-os/types';
import type { NotificationManager } from './notification-manager.js';

interface ManagedView {
  view: WebContentsView;
  id: string;
  currentUrl: string;
  title: string;
  loading: boolean;
}

export class WcvManager {
  private views = new Map<string, ManagedView>();
  private window: BrowserWindow;
  private notificationManager: NotificationManager | null;

  constructor(window: BrowserWindow, notificationManager?: NotificationManager) {
    this.window = window;
    this.notificationManager = notificationManager ?? null;
  }

  create(options: WebContentsViewOptions): string {
    const { id, url, partition, bounds, show } = options;

    if (this.views.has(id)) {
      this.navigate(id, url);
      return id;
    }

    const view = new WebContentsView({
      webPreferences: {
        partition: partition ?? `persist:${id}`,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Set user agent to Chrome (not Electron) so sites like Figma/Google
    // don't use FedCM or other APIs that Electron doesn't support
    const chromeUa = view.webContents.getUserAgent().replace(/\s*Electron\/\S+/, '');
    view.webContents.setUserAgent(chromeUa);

    const managed: ManagedView = { view, id, currentUrl: url, title: '', loading: true };
    this.views.set(id, managed);
    this.window.contentView.addChildView(view);

    if (bounds && show !== false) {
      view.setBounds(bounds);
    } else if (show === false) {
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }

    // Navigation events
    view.webContents.on('did-navigate', (_event, navigatedUrl) => {
      managed.currentUrl = navigatedUrl;
      this.sendToRenderer('wcv:url-changed', { id, url: navigatedUrl });
    });

    view.webContents.on('did-navigate-in-page', (_event, navigatedUrl) => {
      managed.currentUrl = navigatedUrl;
      this.sendToRenderer('wcv:url-changed', { id, url: navigatedUrl });
    });

    view.webContents.on('page-title-updated', (_event, title) => {
      managed.title = title;
      this.sendToRenderer('wcv:title-changed', { id, title });

      // Non-invasive notification detection via title changes
      const countMatch = title.match(/^\((\d+)\)/);
      if (countMatch && this.notificationManager) {
        const appName = this.getAppName(id);
        this.notificationManager.addNotification(id, appName, `New activity in ${appName}`, title);
      }
    });

    view.webContents.on('did-start-loading', () => {
      managed.loading = true;
      this.sendToRenderer('wcv:loading', { id, loading: true });
    });

    view.webContents.on('did-stop-loading', () => {
      managed.loading = false;
      this.sendToRenderer('wcv:loading', { id, loading: false });
    });

    // Popups: open in PM-OS browser tab instead of system browser
    view.webContents.setWindowOpenHandler(({ url: openUrl }) => {
      this.sendToRenderer('wcv:open-url', { url: openUrl });
      return { action: 'deny' };
    });

    // Allow all permissions
    view.webContents.session.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));
    view.webContents.session.setPermissionCheckHandler(() => true);

    // Log console errors from the embedded page
    view.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      if (level >= 2) { // warnings and errors
        console.error(`[${id}:console] ${message} (${sourceId}:${line})`);
      }
    });

    // Log render process crashes
    view.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[${id}:crash] Render process gone:`, details.reason, details.exitCode);
    });

    // Load
    view.webContents.loadURL(url).catch((err) => {
      console.error(`[WcvManager] Failed to load ${id}:`, err);
    });

    return id;
  }

  navigate(id: string, url: string): void {
    const managed = this.views.get(id);
    if (!managed) return;
    managed.currentUrl = url;
    managed.view.webContents.loadURL(url).catch((err) => {
      console.error(`[WcvManager] Failed to navigate ${id}:`, err);
    });
  }

  setBounds(id: string, bounds: PanelBounds): void {
    this.views.get(id)?.view.setBounds(bounds);
  }

  destroy(id: string): void {
    const managed = this.views.get(id);
    if (!managed) return;
    this.window.contentView.removeChildView(managed.view);
    managed.view.webContents.close();
    this.views.delete(id);
  }

  getState(id: string): WebContentsViewState | null {
    const managed = this.views.get(id);
    if (!managed) return null;
    return {
      id: managed.id,
      url: managed.currentUrl,
      title: managed.title,
      loading: managed.loading,
      canGoBack: managed.view.webContents.canGoBack(),
      canGoForward: managed.view.webContents.canGoForward(),
    };
  }

  goBack(id: string): void {
    this.views.get(id)?.view.webContents.goBack();
  }

  goForward(id: string): void {
    this.views.get(id)?.view.webContents.goForward();
  }

  reload(id: string): void {
    this.views.get(id)?.view.webContents.reload();
  }

  openDevTools(id: string): void {
    this.views.get(id)?.view.webContents.openDevTools({ mode: 'detach' });
  }

  destroyAll(): void {
    for (const id of this.views.keys()) {
      this.destroy(id);
    }
  }

  private getAppName(id: string): string {
    const names: Record<string, string> = {
      slack: 'Slack', notion: 'Notion', figma: 'Figma',
      gmail: 'Gmail', browser: 'Browser',
    };
    return names[id] || id;
  }

  private sendToRenderer(channel: string, data: Record<string, unknown>): void {
    if (!this.window.isDestroyed()) {
      this.window.webContents.send(channel, data);
    }
  }
}
