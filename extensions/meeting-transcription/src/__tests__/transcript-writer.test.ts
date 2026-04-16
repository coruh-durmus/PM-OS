import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TranscriptWriter } from '../transcript-writer.js';
import type { TranscriptSegment, MeetingMetadata } from '../types.js';

describe('TranscriptWriter', () => {
  let tmpDir: string;
  const writer = new TranscriptWriter();

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  function makeTmpDir(): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcript-test-'));
    return tmpDir;
  }

  const metadata: MeetingMetadata = {
    meetingId: 'mtg-001',
    date: '2026-04-14T10:00:00Z',
    duration: 1800,
    platform: 'Google Meet',
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
    participants: ['You', 'SPEAKER_00', 'SPEAKER_01'],
  };

  const segments: TranscriptSegment[] = [
    { start: 0, end: 5, text: 'Hello everyone', speaker: 'You' },
    { start: 6, end: 12, text: 'Hi, thanks for joining', speaker: 'SPEAKER_00' },
    { start: 13, end: 20, text: 'Glad to be here', speaker: 'SPEAKER_01' },
  ];

  it('creates transcript file with correct path', async () => {
    const projectPath = makeTmpDir();
    const filePath = await writer.write(projectPath, metadata, segments);

    expect(filePath).toBe(
      path.join(projectPath, '.memory', 'project', 'transcriptions', 'mtg-001.md')
    );
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('writes valid YAML frontmatter', async () => {
    const projectPath = makeTmpDir();
    const filePath = await writer.write(projectPath, metadata, segments);
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/^---\n/);
    expect(content).toContain('meetingId: "mtg-001"');
    expect(content).toContain('date: "2026-04-14T10:00:00Z"');
    expect(content).toContain('duration: 1800');
    expect(content).toContain('platform: "Google Meet"');
    expect(content).toContain('participants:');
    expect(content).toContain('  - You');
    expect(content).toContain('  - SPEAKER_00');
  });

  it('writes transcript body with speaker labels and timestamps', async () => {
    const projectPath = makeTmpDir();
    const filePath = await writer.write(projectPath, metadata, segments);
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('## Transcript');
    expect(content).toContain('**[00:00] You:** Hello everyone');
    expect(content).toContain('**[00:06] SPEAKER_00:** Hi, thanks for joining');
    expect(content).toContain('**[00:13] SPEAKER_01:** Glad to be here');
  });

  it('formats hours correctly for long meetings', async () => {
    const projectPath = makeTmpDir();
    const longSegments: TranscriptSegment[] = [
      { start: 3661, end: 3670, text: 'Over an hour in', speaker: 'You' },
    ];
    const filePath = await writer.write(projectPath, metadata, longSegments);
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('**[01:01:01] You:** Over an hour in');
  });

  it('uses "Unknown" for segments without speaker', async () => {
    const projectPath = makeTmpDir();
    const noSpeaker: TranscriptSegment[] = [
      { start: 0, end: 5, text: 'Who said this?' },
    ];
    const filePath = await writer.write(projectPath, metadata, noSpeaker);
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('**[00:00] Unknown:** Who said this?');
  });

  it('creates transcriptions directory if it does not exist', async () => {
    const projectPath = makeTmpDir();
    const transcriptDir = path.join(projectPath, '.memory', 'project', 'transcriptions');

    expect(fs.existsSync(transcriptDir)).toBe(false);
    await writer.write(projectPath, metadata, segments);
    expect(fs.existsSync(transcriptDir)).toBe(true);
  });
});
