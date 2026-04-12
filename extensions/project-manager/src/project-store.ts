import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { ProjectConfig, ProjectLink, ProjectSummary } from '@pm-os/types';

/**
 * Manages the on-disk layout of PM-OS projects.
 *
 * Each project lives as a subdirectory under `baseDir` and contains:
 *   .pm-os/config.json      – project metadata
 *   .pm-os/links.json       – external resource links
 *   .pm-os/decisions.log    – NDJSON decision log
 *   .pm-os/automations/     – automation definitions
 *   .memory/project/         – project-scoped memory (git-ignored)
 *   .memory/user/            – user-scoped memory (git-ignored)
 *   docs/                    – documentation
 *   CLAUDE.md                – Claude instructions
 */
export class ProjectStore {
  constructor(private readonly baseDir: string) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  /**
   * Create a new project with a fully initialized directory structure.
   */
  create(name: string): ProjectConfig {
    const projectDir = path.join(this.baseDir, name);

    if (fs.existsSync(projectDir)) {
      throw new Error(`Project "${name}" already exists`);
    }

    // Create all directories
    const dirs = [
      path.join(projectDir, '.pm-os', 'automations'),
      path.join(projectDir, '.memory', 'project'),
      path.join(projectDir, '.memory', 'user'),
      path.join(projectDir, 'docs'),
    ];
    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write .memory .gitignore so contents stay local
    const gitignoreContent = '*\n!.gitignore\n';
    fs.writeFileSync(path.join(projectDir, '.memory', 'project', '.gitignore'), gitignoreContent);
    fs.writeFileSync(path.join(projectDir, '.memory', 'user', '.gitignore'), gitignoreContent);

    // Write config
    const now = new Date().toISOString();
    const config: ProjectConfig = {
      name,
      createdAt: now,
      updatedAt: now,
      settings: {},
    };
    fs.writeFileSync(
      path.join(projectDir, '.pm-os', 'config.json'),
      JSON.stringify(config, null, 2) + '\n',
    );

    // Write empty links
    fs.writeFileSync(
      path.join(projectDir, '.pm-os', 'links.json'),
      JSON.stringify([], null, 2) + '\n',
    );

    // Write CLAUDE.md
    fs.writeFileSync(
      path.join(projectDir, 'CLAUDE.md'),
      `# ${name}\n\nProject-specific instructions for Claude.\n`,
    );

    // Initialize git repository
    execFileSync('git', ['init'], { cwd: projectDir, stdio: 'ignore' });

    return config;
  }

  /**
   * List all valid projects under the base directory.
   */
  list(): ProjectSummary[] {
    if (!fs.existsSync(this.baseDir)) {
      return [];
    }

    const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
    const summaries: ProjectSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const configPath = path.join(this.baseDir, entry.name, '.pm-os', 'config.json');
      if (!fs.existsSync(configPath)) continue;

      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const config: ProjectConfig = JSON.parse(raw);
        summaries.push({
          name: config.name,
          path: path.join(this.baseDir, entry.name),
          description: config.description,
          updatedAt: config.updatedAt,
        });
      } catch {
        // Skip malformed projects
      }
    }

    return summaries;
  }

  /**
   * Read a project's config.json.
   */
  getConfig(projectPath: string): ProjectConfig {
    const configPath = path.join(projectPath, '.pm-os', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as ProjectConfig;
  }

  /**
   * Read a project's links.json.
   */
  getLinks(projectPath: string): ProjectLink[] {
    const linksPath = path.join(projectPath, '.pm-os', 'links.json');
    const raw = fs.readFileSync(linksPath, 'utf-8');
    return JSON.parse(raw) as ProjectLink[];
  }

  /**
   * Append a link to a project's links.json.
   */
  addLink(projectPath: string, link: ProjectLink): void {
    const links = this.getLinks(projectPath);
    links.push(link);
    const linksPath = path.join(projectPath, '.pm-os', 'links.json');
    fs.writeFileSync(linksPath, JSON.stringify(links, null, 2) + '\n');
  }

  /**
   * Remove a link by id from a project's links.json.
   */
  removeLink(projectPath: string, linkId: string): void {
    const links = this.getLinks(projectPath);
    const filtered = links.filter((l) => l.id !== linkId);
    const linksPath = path.join(projectPath, '.pm-os', 'links.json');
    fs.writeFileSync(linksPath, JSON.stringify(filtered, null, 2) + '\n');
  }

  /**
   * Delete a project directory entirely.
   */
  delete(name: string): void {
    const projectDir = path.join(this.baseDir, name);
    if (!fs.existsSync(projectDir)) {
      throw new Error(`Project "${name}" does not exist`);
    }
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}
