export class NotificationCenter {
  private el: HTMLElement;
  private visible = false;
  private unreadCount = 0;
  private badgeEl: HTMLElement | null = null;
  private cleanupListener?: () => void;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'notification-center hidden';
    document.body.appendChild(this.el);
    this.startListening();
  }

  setBadgeElement(el: HTMLElement): void {
    this.badgeEl = el;
    this.updateBadge();
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) this.show();
    else this.hide();
  }

  private async show(): Promise<void> {
    this.el.classList.remove('hidden');
    await this.render();
  }

  private hide(): void {
    this.el.classList.add('hidden');
    this.visible = false;
  }

  private startListening(): void {
    // Listen for new notifications
    this.cleanupListener = (window as any).pmOs.notifications.onNew(() => {
      this.unreadCount++;
      this.updateBadge();
      if (this.visible) this.render();
    });

    // Initial count
    this.refreshUnreadCount();
  }

  private async refreshUnreadCount(): Promise<void> {
    this.unreadCount = await (window as any).pmOs.notifications.getUnreadCount();
    this.updateBadge();
  }

  private updateBadge(): void {
    if (!this.badgeEl) return;
    if (this.unreadCount > 0) {
      this.badgeEl.textContent = this.unreadCount > 9 ? '9+' : String(this.unreadCount);
      this.badgeEl.style.display = 'flex';
    } else {
      this.badgeEl.style.display = 'none';
    }
  }

  /** Remove all child nodes from an element safely */
  private clearElement(el: HTMLElement): void {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  private async render(): Promise<void> {
    this.clearElement(this.el);

    // Position the dropdown near the bell icon (bottom-left of the activity bar)
    this.el.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 56px;
      width: 360px;
      max-height: 500px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);';

    const title = document.createElement('span');
    title.textContent = 'Notifications';
    title.style.cssText = 'font-size: 13px; font-weight: 600; color: var(--text-primary);';
    header.appendChild(title);

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px;';

    const markAllBtn = document.createElement('button');
    markAllBtn.textContent = 'Mark all read';
    markAllBtn.style.cssText = 'background: none; border: none; color: var(--accent); cursor: pointer; font-size: 11px;';
    markAllBtn.addEventListener('click', async () => {
      await (window as any).pmOs.notifications.markAllRead();
      this.unreadCount = 0;
      this.updateBadge();
      this.render();
    });
    actions.appendChild(markAllBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 11px;';
    clearBtn.addEventListener('click', async () => {
      await (window as any).pmOs.notifications.clearAll();
      this.unreadCount = 0;
      this.updateBadge();
      this.render();
    });
    actions.appendChild(clearBtn);

    header.appendChild(actions);
    this.el.appendChild(header);

    // Meetings section
    this.renderMeetingsSection();

    // Settings section (collapsible)
    const settingsSection = document.createElement('div');
    settingsSection.style.cssText = 'padding: 8px 16px; border-bottom: 1px solid var(--border);';

    const settingsHeader = document.createElement('div');
    settingsHeader.style.cssText = 'font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; cursor: pointer;';
    settingsHeader.textContent = '\u2699 App Notifications';
    settingsSection.appendChild(settingsHeader);

    const settingsGrid = document.createElement('div');
    settingsGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 4px;';

    const settings = await (window as any).pmOs.notifications.getSettings();
    const apps = [
      { id: 'slack', name: 'Slack' },
      { id: 'notion', name: 'Notion' },
      { id: 'figma', name: 'Figma' },
      { id: 'gmail', name: 'Gmail' },
      { id: 'browser', name: 'Browser' },
    ];

    for (const app of apps) {
      const label = document.createElement('label');
      label.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); cursor: pointer; padding: 2px 0;';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = settings[app.id] !== false;
      checkbox.style.cssText = 'accent-color: var(--accent); cursor: pointer;';
      checkbox.addEventListener('change', () => {
        (window as any).pmOs.notifications.setAppEnabled(app.id, checkbox.checked);
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(app.name));
      settingsGrid.appendChild(label);
    }

    settingsSection.appendChild(settingsGrid);
    this.el.appendChild(settingsSection);

    // Notification list
    const listContainer = document.createElement('div');
    listContainer.style.cssText = 'flex: 1; overflow-y: auto; max-height: 320px;';

    const notifications = await (window as any).pmOs.notifications.getAll();

    if (notifications.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 12px;';
      const emptyIcon = document.createElement('div');
      emptyIcon.style.cssText = 'font-size: 24px; margin-bottom: 8px;';
      emptyIcon.textContent = '\uD83D\uDD14';
      empty.appendChild(emptyIcon);
      empty.appendChild(document.createTextNode('No notifications yet'));
      listContainer.appendChild(empty);
    } else {
      for (const notif of notifications) {
        const item = document.createElement('div');
        item.style.cssText = `padding: 10px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.1s; ${notif.read ? 'opacity: 0.6;' : ''}`;
        item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-hover)');
        item.addEventListener('mouseleave', () => item.style.background = '');

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;';

        const appLabel = document.createElement('span');
        appLabel.style.cssText = 'font-size: 11px; font-weight: 600; color: var(--accent);';
        appLabel.textContent = notif.appName;
        topRow.appendChild(appLabel);

        const time = document.createElement('span');
        time.style.cssText = 'font-size: 10px; color: var(--text-muted);';
        time.textContent = this.formatTime(notif.timestamp);
        topRow.appendChild(time);

        item.appendChild(topRow);

        const titleEl = document.createElement('div');
        titleEl.textContent = notif.title;
        titleEl.style.cssText = 'font-size: 12px; font-weight: 500; color: var(--text-primary); margin-bottom: 1px;';
        item.appendChild(titleEl);

        if (notif.body) {
          const bodyEl = document.createElement('div');
          bodyEl.textContent = notif.body;
          bodyEl.style.cssText = 'font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
          item.appendChild(bodyEl);
        }

        // Unread dot
        if (!notif.read) {
          const dot = document.createElement('div');
          dot.style.cssText = 'width: 6px; height: 6px; border-radius: 50%; background: var(--accent); position: absolute; right: 12px; top: 50%; transform: translateY(-50%);';
          item.style.position = 'relative';
          item.appendChild(dot);
        }

        item.addEventListener('click', async () => {
          await (window as any).pmOs.notifications.markRead(notif.id);
          this.unreadCount = Math.max(0, this.unreadCount - 1);
          this.updateBadge();
          item.style.opacity = '0.6';
        });

        listContainer.appendChild(item);
      }
    }

    this.el.appendChild(listContainer);

    // Click outside to close
    const closeOnOutside = (e: MouseEvent) => {
      if (!this.el.contains(e.target as Node)) {
        this.hide();
        document.removeEventListener('click', closeOnOutside);
      }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutside), 100);
  }

  private renderMeetingsSection(): void {
    const section = document.createElement('div');
    section.style.cssText = 'padding: 8px 16px; border-bottom: 1px solid var(--border);';

    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

    const sectionTitle = document.createElement('span');
    sectionTitle.style.cssText = 'font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;';
    sectionTitle.textContent = '\uD83D\uDCC5 Upcoming Meetings';
    sectionHeader.appendChild(sectionTitle);

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add';
    addBtn.style.cssText = 'background: none; border: none; color: var(--accent); cursor: pointer; font-size: 11px; font-weight: 600;';
    addBtn.addEventListener('click', () => {
      this.showAddMeetingForm(section);
    });
    sectionHeader.appendChild(addBtn);
    section.appendChild(sectionHeader);

    // List upcoming meetings from localStorage
    let meetings: { id: string; title: string; startTime: number; meetingUrl: string }[] = [];
    try {
      const raw = localStorage.getItem('pm-os-meetings');
      if (raw) meetings = JSON.parse(raw);
    } catch {}

    const now = Date.now();
    const upcoming = meetings
      .filter(m => m.startTime > now - 3600000)
      .sort((a, b) => a.startTime - b.startTime);

    if (upcoming.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size: 11px; color: var(--text-muted); padding: 4px 0;';
      empty.textContent = 'No upcoming meetings';
      section.appendChild(empty);
    } else {
      for (const meeting of upcoming) {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 4px 0; gap: 8px;';

        const info = document.createElement('div');
        info.style.cssText = 'flex: 1; min-width: 0;';

        const titleEl = document.createElement('div');
        titleEl.textContent = meeting.title;
        titleEl.style.cssText = 'font-size: 12px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        info.appendChild(titleEl);

        const timeEl = document.createElement('div');
        timeEl.textContent = new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        timeEl.style.cssText = 'font-size: 10px; color: var(--text-muted);';
        info.appendChild(timeEl);

        row.appendChild(info);

        if (meeting.meetingUrl) {
          const joinBtn = document.createElement('button');
          joinBtn.textContent = 'Join';
          joinBtn.style.cssText = 'padding: 2px 8px; background: var(--success); color: #1e1e2e; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 10px; font-weight: 600; flex-shrink: 0;';
          joinBtn.addEventListener('click', () => {
            window.open(meeting.meetingUrl, '_blank');
          });
          row.appendChild(joinBtn);
        }

        section.appendChild(row);
      }
    }

    this.el.appendChild(section);
  }

  private showAddMeetingForm(container: HTMLElement): void {
    // Remove existing form if any
    const existing = container.querySelector('.meeting-add-form');
    if (existing) {
      existing.remove();
      return;
    }

    const form = document.createElement('div');
    form.className = 'meeting-add-form';
    form.style.cssText = 'margin-top: 8px; display: flex; flex-direction: column; gap: 6px;';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = 'Meeting title';
    titleInput.style.cssText = 'padding: 6px 8px; background: var(--bg-input, var(--bg-hover)); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 12px; outline: none;';
    form.appendChild(titleInput);

    const dateInput = document.createElement('input');
    dateInput.type = 'datetime-local';
    dateInput.style.cssText = 'padding: 6px 8px; background: var(--bg-input, var(--bg-hover)); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 12px; outline: none;';
    form.appendChild(dateInput);

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'Meeting URL (optional)';
    urlInput.style.cssText = 'padding: 6px 8px; background: var(--bg-input, var(--bg-hover)); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 12px; outline: none;';
    form.appendChild(urlInput);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'padding: 6px 12px; background: var(--accent); color: #1e1e2e; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; font-weight: 600;';
    saveBtn.addEventListener('click', () => {
      const title = titleInput.value.trim();
      const dateVal = dateInput.value;
      if (!title || !dateVal) return;

      const startTime = new Date(dateVal).getTime();
      const meetingUrl = urlInput.value.trim();

      let meetings: { id: string; title: string; startTime: number; meetingUrl: string }[] = [];
      try {
        const raw = localStorage.getItem('pm-os-meetings');
        if (raw) meetings = JSON.parse(raw);
      } catch {}

      meetings.push({
        id: 'meeting-' + Date.now(),
        title,
        startTime,
        meetingUrl,
      });

      localStorage.setItem('pm-os-meetings', JSON.stringify(meetings));
      this.render();
    });
    form.appendChild(saveBtn);

    container.appendChild(form);
    titleInput.focus();
  }

  private formatTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
}
