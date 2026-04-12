import path from 'path';
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
      // Already exists — navigate to the URL instead
      this.navigate(id, url);
      return id;
    }

    const view = new WebContentsView({
      webPreferences: {
        partition: partition ?? `persist:${id}`,
        preload: path.join(__dirname, 'wcv-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    const managed: ManagedView = {
      view,
      id,
      currentUrl: url,
      title: '',
      loading: true,
    };

    this.views.set(id, managed);
    this.window.contentView.addChildView(view);

    if (bounds && show !== false) {
      view.setBounds(bounds);
    } else if (show === false) {
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }

    // Listen for navigation changes
    view.webContents.on('did-navigate', (_event, navigatedUrl) => {
      managed.currentUrl = navigatedUrl;
      this.sendToRenderer('wcv:url-changed', { id, url: navigatedUrl });
    });

    view.webContents.on('did-navigate-in-page', (_event, navigatedUrl) => {
      managed.currentUrl = navigatedUrl;
      this.sendToRenderer('wcv:url-changed', { id, url: navigatedUrl });
    });

    // Listen for title changes
    view.webContents.on('page-title-updated', (_event, title) => {
      managed.title = title;
      this.sendToRenderer('wcv:title-changed', { id, title });
    });

    // Listen for loading state changes
    view.webContents.on('did-start-loading', () => {
      managed.loading = true;
      this.sendToRenderer('wcv:loading', { id, loading: true });
    });

    view.webContents.on('did-stop-loading', () => {
      managed.loading = false;
      this.sendToRenderer('wcv:loading', { id, loading: false });
    });

    // Intercept new window requests (e.g., target="_blank" links)
    // Open them in PM-OS browser tab instead of system browser
    view.webContents.setWindowOpenHandler(({ url: openUrl }) => {
      this.sendToRenderer('wcv:open-url', { url: openUrl });
      return { action: 'deny' };
    });

    // Grant all permissions for embedded apps (notifications, media, WebAuthn/passkeys, etc.)
    view.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(true);
    });

    // Also allow permission checks (needed for WebAuthn/passkeys)
    view.webContents.session.setPermissionCheckHandler(() => {
      return true;
    });

    // Listen for notification events sent from wcv-preload
    view.webContents.ipc.on('wcv:notification', (_event, data: { title: string; body: string }) => {
      if (this.notificationManager) {
        const appName = this.getAppName(id);
        this.notificationManager.addNotification(id, appName, data.title, data.body);
      }
    });

    // Load the URL
    view.webContents.loadURL(url).catch((err) => {
      console.error(`[WcvManager] Failed to load URL for ${id}:`, err);
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
    const managed = this.views.get(id);
    if (!managed) return;
    managed.view.setBounds(bounds);
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
    const managed = this.views.get(id);
    if (!managed) return;
    if (managed.view.webContents.canGoBack()) {
      managed.view.webContents.goBack();
    }
  }

  goForward(id: string): void {
    const managed = this.views.get(id);
    if (!managed) return;
    if (managed.view.webContents.canGoForward()) {
      managed.view.webContents.goForward();
    }
  }

  reload(id: string): void {
    const managed = this.views.get(id);
    if (!managed) return;
    managed.view.webContents.reload();
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
