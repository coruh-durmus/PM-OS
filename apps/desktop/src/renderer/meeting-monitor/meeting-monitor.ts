interface Meeting {
  id: string;
  title: string;
  startTime: number;
  meetingUrl: string;
}

export class MeetingMonitor {
  private meetings: Meeting[] = [];
  private intervalId: number | null = null;
  private tooltipEl: HTMLElement | null = null;

  constructor() {
    this.loadMeetings();
    this.start();
  }

  addMeeting(title: string, startTime: Date, meetingUrl: string): void {
    this.meetings.push({
      id: 'meeting-' + Date.now(),
      title,
      startTime: startTime.getTime(),
      meetingUrl,
    });
    this.saveMeetings();
    this.check();
  }

  getMeetings(): Meeting[] {
    return this.meetings.filter(m => m.startTime > Date.now() - 3600000);
  }

  removeMeeting(id: string): void {
    this.meetings = this.meetings.filter(m => m.id !== id);
    this.saveMeetings();
  }

  private start(): void {
    this.intervalId = window.setInterval(() => this.check(), 30000);
    this.check();
  }

  private check(): void {
    const now = Date.now();
    // Clean old meetings
    this.meetings = this.meetings.filter(m => m.startTime > now - 3600000);
    this.saveMeetings();

    const upcoming = this.meetings
      .filter(m => m.startTime > now && m.startTime - now < 15 * 60 * 1000)
      .sort((a, b) => a.startTime - b.startTime);

    if (upcoming.length > 0) {
      this.showTooltip(upcoming[0]);
    } else {
      this.hideTooltip();
    }
  }

  private showTooltip(meeting: Meeting): void {
    this.hideTooltip();
    const minutesLeft = Math.ceil((meeting.startTime - Date.now()) / 60000);

    const el = document.createElement('div');
    el.style.cssText = 'position: fixed; bottom: 100px; left: 56px; width: 280px; background: var(--bg-surface); border: 1px solid var(--accent); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); z-index: 800; padding: 12px; font-size: 12px;';

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 6px;';

    const chip = document.createElement('span');
    const chipColor = minutesLeft <= 5 ? 'var(--error)' : minutesLeft <= 10 ? 'var(--warning)' : 'var(--accent)';
    chip.style.cssText = 'padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; background: ' + chipColor + '; color: #1e1e2e;';
    chip.textContent = minutesLeft <= 0 ? 'NOW' : minutesLeft + ' min';
    header.appendChild(chip);

    const title = document.createElement('span');
    title.textContent = meeting.title;
    title.style.cssText = 'font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    header.appendChild(title);
    el.appendChild(header);

    const timeText = document.createElement('div');
    timeText.textContent = new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    timeText.style.cssText = 'font-size: 11px; color: var(--text-muted); margin-bottom: 8px;';
    el.appendChild(timeText);

    if (meeting.meetingUrl) {
      const joinBtn = document.createElement('button');
      joinBtn.textContent = '\uD83C\uDFA5 Join Meeting';
      joinBtn.style.cssText = 'width: 100%; padding: 8px; background: var(--success); color: #1e1e2e; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; font-weight: 600;';
      joinBtn.addEventListener('click', () => {
        window.open(meeting.meetingUrl, '_blank');
      });
      el.appendChild(joinBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00D7';
    closeBtn.style.cssText = 'position: absolute; top: 4px; right: 8px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px;';
    closeBtn.addEventListener('click', () => this.hideTooltip());
    el.appendChild(closeBtn);

    document.body.appendChild(el);
    this.tooltipEl = el;
  }

  private hideTooltip(): void {
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
  }

  private loadMeetings(): void {
    try {
      const raw = localStorage.getItem('pm-os-meetings');
      if (raw) this.meetings = JSON.parse(raw);
    } catch {}
  }

  private saveMeetings(): void {
    localStorage.setItem('pm-os-meetings', JSON.stringify(this.meetings));
  }
}
