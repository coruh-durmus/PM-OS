import { BrowserWindow, WebContentsView } from 'electron';
import type { PanelBounds, WebContentsViewOptions, WebContentsViewState } from '@pm-os/types';
import type { NotificationManager } from './notification-manager.js';
import type { SessionSync } from './session-sync.js';
import type { MeetingDetectionService } from './meeting-detection.js';

// ---------------------------------------------------------------------------
// Safe logging — guard against EPIPE when stdout/stderr pipe is broken.
// ---------------------------------------------------------------------------
function safeLog(...args: unknown[]): void {
  try { console.log(...args); } catch {}
}
function safeError(...args: unknown[]): void {
  try { console.error(...args); } catch {}
}

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
  private sessionSync: SessionSync | null;
  private meetingDetection: MeetingDetectionService | null;

  constructor(window: BrowserWindow, notificationManager?: NotificationManager, sessionSync?: SessionSync, meetingDetection?: MeetingDetectionService) {
    this.window = window;
    this.notificationManager = notificationManager ?? null;
    this.sessionSync = sessionSync ?? null;
    this.meetingDetection = meetingDetection ?? null;
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

    // Register this partition for Google auth cookie sync across panels
    const resolvedPartition = partition ?? `persist:${id}`;
    if (this.sessionSync) {
      this.sessionSync.registerPartition(resolvedPartition);
    }

    // Strip Electron and app name from user-agent so sites serve standard
    // web flows (not FedCM or other unsupported Electron-specific APIs)
    const chromeUa = view.webContents.getUserAgent()
      .replace(/\s*Electron\/\S+/, '')
      .replace(/\s*@pm-os\/\S+/, '');
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
      this.meetingDetection?.checkUrl(id, navigatedUrl);
    });

    view.webContents.on('did-navigate-in-page', (_event, navigatedUrl) => {
      managed.currentUrl = navigatedUrl;
      this.sendToRenderer('wcv:url-changed', { id, url: navigatedUrl });
      this.meetingDetection?.checkUrl(id, navigatedUrl);
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

    // Handle popups (window.open, target="_blank")
    const parentHostname = new URL(url).hostname;
    view.webContents.setWindowOpenHandler(({ url: openUrl }) => {
      try {
        const u = new URL(openUrl);
        // Allow same-domain popups (SSO flows like figma.com/start_google_sso)
        if (u.hostname === parentHostname || u.hostname.endsWith('.' + parentHostname)) {
          return { action: 'allow' };
        }
        // Allow auth provider popups
        const authDomains = ['accounts.google.com', 'appleid.apple.com', 'login.microsoftonline.com', 'github.com', 'id.atlassian.com'];
        if (authDomains.some(d => u.hostname === d || u.hostname.endsWith('.' + d))) {
          return { action: 'allow' };
        }
      } catch {}
      // Other popups → open in PM-OS browser panel
      this.sendToRenderer('wcv:open-url', { url: openUrl });
      return { action: 'deny' };
    });

    // When an auth popup closes (user completes or cancels OAuth),
    // reload the parent so it picks up the new auth cookies.
    // DON'T intercept navigation or close popups early — let the
    // OAuth callback complete naturally in the popup.
    view.webContents.on('did-create-window', (childWindow) => {
      // Strip Electron from popup user-agent too
      const popupUa = childWindow.webContents.getUserAgent().replace(/\s*Electron\/\S+/, '');
      childWindow.webContents.setUserAgent(popupUa);

      // Grant permissions in popup
      childWindow.webContents.session.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));
      childWindow.webContents.session.setPermissionCheckHandler(() => true);

      // Only reload parent AFTER popup fully closes
      childWindow.on('closed', () => {
        setTimeout(() => {
          if (!view.webContents.isDestroyed()) view.webContents.reload();
        }, 500);
      });
    });

    // Allow all permissions
    view.webContents.session.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));
    view.webContents.session.setPermissionCheckHandler(() => true);

    // Log ALL console messages from embedded pages for debugging
    view.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const prefix = level === 0 ? 'DEBUG' : level === 1 ? 'INFO' : level === 2 ? 'WARN' : 'ERROR';
      safeLog(`[${id}:${prefix}] ${message} (${sourceId}:${line})`);
    });

    // Log the user agent being used
    safeLog(`[${id}:ua] ${view.webContents.getUserAgent()}`);

    // Log render process crashes
    view.webContents.on('render-process-gone', (_event, details) => {
      safeError(`[${id}:crash] Render process gone:`, details.reason, details.exitCode);
    });

    // Log detailed load events
    view.webContents.on('did-fail-load', (_event, errorCode, errorDesc, validatedURL) => {
      safeError(`[${id}:load-fail] ${errorCode} ${errorDesc} at ${validatedURL}`);
    });

    view.webContents.on('did-finish-load', () => {
      safeLog(`[${id}:loaded] ${view.webContents.getURL()}`);
    });

    // Load
    safeLog(`[${id}:loading] ${url}`);
    view.webContents.loadURL(url).catch((err) => {
      safeError(`[WcvManager] Failed to load ${id}:`, err);
    });

    return id;
  }

  navigate(id: string, url: string): void {
    const managed = this.views.get(id);
    if (!managed) return;
    managed.currentUrl = url;
    managed.view.webContents.loadURL(url).catch((err) => {
      safeError(`[WcvManager] Failed to navigate ${id}:`, err);
    });
  }

  setBounds(id: string, bounds: PanelBounds): void {
    this.views.get(id)?.view.setBounds(bounds);
  }

  destroy(id: string): void {
    const managed = this.views.get(id);
    if (!managed) return;
    this.views.delete(id);
    try {
      if (!this.window.isDestroyed()) {
        this.window.contentView.removeChildView(managed.view);
      }
      if (!managed.view.webContents.isDestroyed()) {
        managed.view.webContents.close();
      }
    } catch {
      // View may already be destroyed during app shutdown
    }
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
