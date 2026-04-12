import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DecisionLog } from '../decision-log.js';

describe('DecisionLog', () => {
  let tmpDir: string;
  let log: DecisionLog;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-os-decision-test-'));
    // Create the .pm-os directory that DecisionLog expects
    fs.mkdirSync(path.join(tmpDir, '.pm-os'), { recursive: true });
    log = new DecisionLog(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('append', () => {
    it('should auto-assign id and timestamp', () => {
      const entry = log.append({
        title: 'Use React',
        context: 'Frontend framework choice',
        decision: 'Adopt React for the web UI',
        rationale: 'Team experience and ecosystem size',
        author: 'alice',
      });

      expect(entry.id).toBeDefined();
      expect(entry.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(entry.timestamp).toBeDefined();
      expect(new Date(entry.timestamp).getTime()).not.toBeNaN();
      expect(entry.title).toBe('Use React');
      expect(entry.author).toBe('alice');
    });

    it('should persist entries as NDJSON', () => {
      log.append({
        title: 'First',
        context: 'ctx',
        decision: 'dec',
        rationale: 'rat',
        author: 'a',
      });
      log.append({
        title: 'Second',
        context: 'ctx',
        decision: 'dec',
        rationale: 'rat',
        author: 'b',
      });

      const raw = fs.readFileSync(
        path.join(tmpDir, '.pm-os', 'decisions.log'),
        'utf-8',
      );
      const lines = raw.trim().split('\n');
      expect(lines).toHaveLength(2);

      // Each line must be valid JSON
      const first = JSON.parse(lines[0]);
      const second = JSON.parse(lines[1]);
      expect(first.title).toBe('First');
      expect(second.title).toBe('Second');
    });

    it('should include optional tags', () => {
      const entry = log.append({
        title: 'Tagged',
        context: 'ctx',
        decision: 'dec',
        rationale: 'rat',
        author: 'a',
        tags: ['architecture', 'frontend'],
      });

      expect(entry.tags).toEqual(['architecture', 'frontend']);
    });
  });

  describe('list', () => {
    it('should return an empty array when no log exists', () => {
      expect(log.list()).toEqual([]);
    });

    it('should return all appended entries', () => {
      log.append({
        title: 'A',
        context: 'c',
        decision: 'd',
        rationale: 'r',
        author: 'x',
      });
      log.append({
        title: 'B',
        context: 'c',
        decision: 'd',
        rationale: 'r',
        author: 'y',
      });

      const entries = log.list();
      expect(entries).toHaveLength(2);
      expect(entries[0].title).toBe('A');
      expect(entries[1].title).toBe('B');

      // Each entry should have unique ids
      expect(entries[0].id).not.toBe(entries[1].id);
    });
  });
});
