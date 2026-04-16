import type { BrowserWindow } from 'electron';

function safeLog(...args: unknown[]): void {
  try { console.log(...args); } catch {}
}

interface ActiveMeeting {
  meetingId: string;
  panelId: string;
  url: string;
  platform: string;
  startTime: number;
}

/** Optional check for whether a workspace is open. */
export interface WorkspaceChecker {
  isOpen(): boolean;
}

const MEETING_PATTERNS: { pattern: RegExp; platform: string }[] = [
  { pattern: /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/, platform: 'Google Meet' },
  { pattern: /^https:\/\/[\w-]+\.zoom\.us\/(?:j|wc)\//, platform: 'Zoom' },
  { pattern: /^https:\/\/teams\.microsoft\.com\/.*(?:meeting|call)/, platform: 'Microsoft Teams' },
  { pattern: /^https:\/\/app\.slack\.com\/.*huddle/, platform: 'Slack Huddle' },
  { pattern: /^https:\/\/[\w-]+\.webex\.com\/(?:meet|join)/, platform: 'Webex' },
  { pattern: /^https:\/\/discord\.com\/channels\/\d+\/\d+/, platform: 'Discord' },
];

export class MeetingDetectionService {
  private window: BrowserWindow | null = null;
  private activeMeeting: ActiveMeeting | null = null;
  private workspaceChecker: WorkspaceChecker | null = null;

  setWindow(win: BrowserWindow): void {
    this.window = win;
  }

  setWorkspaceChecker(checker: WorkspaceChecker): void {
    this.workspaceChecker = checker;
  }

  checkUrl(panelId: string, url: string): void {
    const match = MEETING_PATTERNS.find(p => p.pattern.test(url));
    const workspaceOpen = !this.workspaceChecker || this.workspaceChecker.isOpen();

    if (match && !this.activeMeeting) {
      safeLog('[MeetingDetection] Meeting detected:', match.platform, url);
      this.sendToRenderer('meeting:detected', { panelId, url, platform: match.platform, workspaceOpen });
    } else if (this.activeMeeting && this.activeMeeting.panelId === panelId && !match) {
      // URL navigated away from meeting
      const result = this.endMeeting();
      if (result) {
        this.sendToRenderer('meeting:ended', result);
      }
    }
  }

  getActiveMeeting(): ActiveMeeting | null {
    return this.activeMeeting;
  }

  skipTranscription(): void {
    safeLog('[MeetingDetection] Transcription skipped');
    this.activeMeeting = null;
  }

  startMeeting(panelId: string, url: string, platform: string): void {
    this.activeMeeting = {
      meetingId: `meeting-${Date.now()}`,
      panelId,
      url,
      platform,
      startTime: Date.now(),
    };
    safeLog('[MeetingDetection] Meeting started:', this.activeMeeting.meetingId);
  }

  endMeeting(): { meetingId: string; duration: number } | null {
    if (!this.activeMeeting) return null;
    const result = {
      meetingId: this.activeMeeting.meetingId,
      duration: Math.floor((Date.now() - this.activeMeeting.startTime) / 1000),
    };
    safeLog('[MeetingDetection] Meeting ended:', result.meetingId, 'duration:', result.duration, 's');
    this.activeMeeting = null;
    return result;
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, data);
    }
  }
}
