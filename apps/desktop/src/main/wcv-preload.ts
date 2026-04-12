import { ipcRenderer } from 'electron';

// Capture web Notification API calls and report to PM-OS
try {
  const OrigNotification = window.Notification;
  if (OrigNotification) {
    const PmOsNotification = function(title: string, options?: NotificationOptions) {
      ipcRenderer.send('wcv:notification', { title, body: options?.body || '' });
      return new OrigNotification(title, options);
    } as any;
    PmOsNotification.permission = OrigNotification.permission;
    PmOsNotification.requestPermission = OrigNotification.requestPermission?.bind(OrigNotification);
    Object.defineProperty(PmOsNotification, 'permission', {
      get: () => OrigNotification.permission,
    });
    window.Notification = PmOsNotification;
  }
} catch {}
