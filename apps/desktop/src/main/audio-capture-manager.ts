import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

function safeLog(...args: unknown[]): void {
  try { console.log(...args); } catch {}
}

interface CaptureState {
  active: boolean;
  startTime: number;
  systemAudioPath: string;
  micAudioPath: string;
}

export class AudioCaptureManager {
  private state: CaptureState | null = null;

  async startCapture(): Promise<{ systemAudioPath: string; micAudioPath: string }> {
    const tempDir = path.join(os.tmpdir(), 'pm-os-audio');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const timestamp = Date.now();
    const systemAudioPath = path.join(tempDir, `system-${timestamp}.wav`);
    const micAudioPath = path.join(tempDir, `mic-${timestamp}.wav`);

    this.state = { active: true, startTime: timestamp, systemAudioPath, micAudioPath };

    // NOTE: Actual audio capture via electron-audio-loopback will be wired
    // when the package is installed. For now, create placeholder files.
    safeLog('[AudioCapture] Started capture to', tempDir);

    return { systemAudioPath, micAudioPath };
  }

  async stopCapture(): Promise<{ systemAudioPath: string; micAudioPath: string; duration: number } | null> {
    if (!this.state) return null;
    const result = {
      systemAudioPath: this.state.systemAudioPath,
      micAudioPath: this.state.micAudioPath,
      duration: Math.floor((Date.now() - this.state.startTime) / 1000),
    };
    this.state = null;
    safeLog('[AudioCapture] Stopped capture, duration:', result.duration, 's');
    return result;
  }

  getStatus(): { active: boolean; duration?: number } {
    if (!this.state) return { active: false };
    return { active: true, duration: Math.floor((Date.now() - this.state.startTime) / 1000) };
  }
}
