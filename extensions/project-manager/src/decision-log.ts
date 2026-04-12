import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { DecisionLogEntry } from '@pm-os/types';

/**
 * Manages the append-only decision log for a project.
 *
 * Entries are stored as newline-delimited JSON (NDJSON) in
 * `.pm-os/decisions.log`. Each line is a complete JSON object.
 */
export class DecisionLog {
  private readonly logPath: string;

  constructor(projectPath: string) {
    this.logPath = path.join(projectPath, '.pm-os', 'decisions.log');
  }

  /**
   * Append a new decision entry. Auto-assigns `id` and `timestamp`.
   */
  append(
    entry: Omit<DecisionLogEntry, 'id' | 'timestamp'>,
  ): DecisionLogEntry {
    const full: DecisionLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    fs.appendFileSync(this.logPath, JSON.stringify(full) + '\n');
    return full;
  }

  /**
   * Read and parse all decision entries from the log.
   */
  list(): DecisionLogEntry[] {
    if (!fs.existsSync(this.logPath)) {
      return [];
    }

    const raw = fs.readFileSync(this.logPath, 'utf-8').trim();
    if (raw.length === 0) {
      return [];
    }

    return raw.split('\n').map((line) => JSON.parse(line) as DecisionLogEntry);
  }
}
