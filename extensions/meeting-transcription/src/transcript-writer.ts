import * as fs from 'fs';
import * as path from 'path';
import type { TranscriptSegment, MeetingMetadata } from './types.js';

export class TranscriptWriter {
  async write(projectPath: string, metadata: MeetingMetadata, segments: TranscriptSegment[]): Promise<string> {
    const transcriptDir = path.join(projectPath, '.memory', 'project', 'transcriptions');
    if (!fs.existsSync(transcriptDir)) {
      fs.mkdirSync(transcriptDir, { recursive: true });
    }

    const fileName = `${metadata.meetingId}.md`;
    const filePath = path.join(transcriptDir, fileName);

    const yaml = this.buildYamlFrontmatter(metadata);
    const body = this.buildTranscriptBody(segments);
    const content = `---\n${yaml}---\n\n## Transcript\n\n${body}`;

    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  private buildYamlFrontmatter(meta: MeetingMetadata): string {
    const lines = [
      `meetingId: "${meta.meetingId}"`,
      `date: "${meta.date}"`,
      `duration: ${meta.duration}`,
      `platform: "${meta.platform}"`,
      `meetingUrl: "${meta.meetingUrl}"`,
      `participants:`,
      ...meta.participants.map(p => `  - ${p}`),
    ];
    return lines.join('\n') + '\n';
  }

  private buildTranscriptBody(segments: TranscriptSegment[]): string {
    return segments.map(seg => {
      const time = this.formatTime(seg.start);
      const speaker = seg.speaker || 'Unknown';
      return `**[${time}] ${speaker}:** ${seg.text}`;
    }).join('\n\n');
  }

  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
