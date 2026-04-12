import { BrowserWindow } from 'electron';

export interface AppNotification {
  id: string;
  appId: string;        // e.g., 'slack', 'notion', 'gmail'
  appName: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  url?: string;
}

interface NotificationSettings {
  [appId: string]: boolean;  // true = enabled, false = muted
}

export class NotificationManager {
  private notifications: AppNotification[] = [];
  private settings: NotificationSettings = {};
  private window: BrowserWindow | null = null;
  private nextId = 1;
  private maxNotifications = 100;

  constructor() {
    // All apps enabled by default
    for (const app of ['slack', 'notion', 'figma', 'gmail', 'browser']) {
      this.settings[app] = true;
    }
  }

  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  addNotification(appId: string, appName: string, title: string, body: string, url?: string): AppNotification | null {
    // Check if notifications are enabled for this app
    if (this.settings[appId] === false) return null;

    const notification: AppNotification = {
      id: `notif-${this.nextId++}`,
      appId,
      appName,
      title,
      body,
      timestamp: Date.now(),
      read: false,
      url,
    };

    this.notifications.unshift(notification);

    // Cap the list
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    // Forward to renderer
    this.window?.webContents.send('notification:new', notification);

    return notification;
  }

  getAll(): AppNotification[] {
    return this.notifications;
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  markRead(id: string): void {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) notif.read = true;
  }

  markAllRead(): void {
    for (const n of this.notifications) n.read = true;
  }

  clearAll(): void {
    this.notifications = [];
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  setAppEnabled(appId: string, enabled: boolean): void {
    this.settings[appId] = enabled;
  }
}
