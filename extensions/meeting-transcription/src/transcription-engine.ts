import type { TranscriptSegment } from './types.js';

export class TranscriptionEngine {
  private modelPath: string;

  constructor(modelPath: string) {
    this.modelPath = modelPath;
  }

  async transcribe(audioPath: string): Promise<TranscriptSegment[]> {
    // Try to load whisper-node-addon
    // If not available (not installed yet), return placeholder
    try {
      // whisper-node-addon is externalized -- loaded at runtime only when deps are installed
      const whisper = require('whisper-node-addon');
      const result = await whisper.transcribe(audioPath, {
        modelPath: this.modelPath,
        language: 'en',
      });
      return result.segments.map((s: any) => ({
        start: s.start,
        end: s.end,
        text: s.text.trim(),
      }));
    } catch (err) {
      console.error('[TranscriptionEngine] Whisper not available:', err);
      return [];
    }
  }
}
