import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectStore } from '../project-store.js';

describe('ProjectStore', () => {
  let tmpDir: string;
  let store: ProjectStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-os-test-'));
    store = new ProjectStore(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('should create a project with the correct directory structure', () => {
      const config = store.create('my-project');

      const projectDir = path.join(tmpDir, 'my-project');

      // Verify directories exist
      expect(fs.existsSync(path.join(projectDir, '.pm-os', 'automations'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, '.memory', 'project'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, '.memory', 'user'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'docs'))).toBe(true);

      // Verify config
      expect(config.name).toBe('my-project');
      expect(config.settings).toEqual({});
      expect(config.createdAt).toBeDefined();
      expect(config.updatedAt).toBeDefined();

      // Verify config.json on disk
      const onDisk = JSON.parse(
        fs.readFileSync(path.join(projectDir, '.pm-os', 'config.json'), 'utf-8'),
      );
      expect(onDisk.name).toBe('my-project');

      // Verify links.json
      const links = JSON.parse(
        fs.readFileSync(path.join(projectDir, '.pm-os', 'links.json'), 'utf-8'),
      );
      expect(links).toEqual([]);

      // Verify .gitignore in memory dirs
      const projectGitignore = fs.readFileSync(
        path.join(projectDir, '.memory', 'project', '.gitignore'),
        'utf-8',
      );
      expect(projectGitignore).toContain('*');
      expect(projectGitignore).toContain('!.gitignore');

      const userGitignore = fs.readFileSync(
        path.join(projectDir, '.memory', 'user', '.gitignore'),
        'utf-8',
      );
      expect(userGitignore).toContain('*');
      expect(userGitignore).toContain('!.gitignore');

      // Verify CLAUDE.md
      const claude = fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf-8');
      expect(claude).toContain('# my-project');

      // Verify git was initialized
      expect(fs.existsSync(path.join(projectDir, '.git'))).toBe(true);
    });

    it('should throw if the project already exists', () => {
      store.create('duplicate');
      expect(() => store.create('duplicate')).toThrow('already exists');
    });
  });

  describe('list', () => {
    it('should return an empty array when no projects exist', () => {
      expect(store.list()).toEqual([]);
    });

    it('should list created projects', () => {
      store.create('alpha');
      store.create('beta');

      const summaries = store.list();
      const names = summaries.map((s) => s.name).sort();

      expect(names).toEqual(['alpha', 'beta']);
      expect(summaries[0].path).toBeDefined();
      expect(summaries[0].updatedAt).toBeDefined();
    });

    it('should skip directories without config.json', () => {
      store.create('valid');
      fs.mkdirSync(path.join(tmpDir, 'orphan'));

      const summaries = store.list();
      expect(summaries).toHaveLength(1);
      expect(summaries[0].name).toBe('valid');
    });
  });

  describe('getConfig', () => {
    it('should return the project config', () => {
      store.create('cfg-test');
      const projectPath = path.join(tmpDir, 'cfg-test');
      const config = store.getConfig(projectPath);

      expect(config.name).toBe('cfg-test');
      expect(config.settings).toEqual({});
    });
  });

  describe('links', () => {
    it('should add and retrieve links', () => {
      store.create('link-test');
      const projectPath = path.join(tmpDir, 'link-test');

      store.addLink(projectPath, {
        id: 'link-1',
        type: 'slack',
        name: '#general',
        url: 'https://slack.com/channel/general',
      });

      const links = store.getLinks(projectPath);
      expect(links).toHaveLength(1);
      expect(links[0].id).toBe('link-1');
      expect(links[0].type).toBe('slack');
    });

    it('should remove links by id', () => {
      store.create('rm-link-test');
      const projectPath = path.join(tmpDir, 'rm-link-test');

      store.addLink(projectPath, {
        id: 'a',
        type: 'slack',
        name: '#a',
        url: 'https://example.com/a',
      });
      store.addLink(projectPath, {
        id: 'b',
        type: 'notion',
        name: 'Page B',
        url: 'https://example.com/b',
      });

      store.removeLink(projectPath, 'a');

      const links = store.getLinks(projectPath);
      expect(links).toHaveLength(1);
      expect(links[0].id).toBe('b');
    });
  });

  describe('delete', () => {
    it('should remove the project directory', () => {
      store.create('doomed');
      const projectDir = path.join(tmpDir, 'doomed');
      expect(fs.existsSync(projectDir)).toBe(true);

      store.delete('doomed');
      expect(fs.existsSync(projectDir)).toBe(false);
    });

    it('should throw if the project does not exist', () => {
      expect(() => store.delete('ghost')).toThrow('does not exist');
    });
  });
});
