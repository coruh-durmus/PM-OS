import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { SpeakerSegment } from './types.js';

export class DiarizationEngine {
  private pythonPath: string;
  private scriptPath: string;

  constructor(pythonPath: string, extensionPath: string) {
    this.pythonPath = pythonPath;
    this.scriptPath = path.join(extensionPath, 'scripts', 'diarize.py');
  }

  async diarize(audioPath: string): Promise<SpeakerSegment[]> {
    // Check if Python and script exist
    if (!fs.existsSync(this.pythonPath) || !fs.existsSync(this.scriptPath)) {
      console.error('[Diarization] Python or script not found');
      return [];
    }

    return new Promise((resolve) => {
      const outputPath = audioPath.replace(/\.wav$/, '-diarization.json');

      const proc = spawn(this.pythonPath, [
        this.scriptPath,
        '--audio', audioPath,
        '--output', outputPath,
      ]);

      let stderr = '';
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          console.error('[Diarization] Process exited with code', code, stderr);
          resolve([]);
          return;
        }

        try {
          const result = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
          resolve(result.segments || []);
        } catch (err) {
          console.error('[Diarization] Failed to parse output:', err);
          resolve([]);
        }
      });

      proc.on('error', (err) => {
        console.error('[Diarization] Failed to spawn:', err);
        resolve([]);
      });
    });
  }
}
