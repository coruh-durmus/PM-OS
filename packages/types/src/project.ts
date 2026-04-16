/**
 * Per-project configuration stored in .pm-os/config.json.
 */
export interface ProjectConfig {
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  notionPageUrl?: string;
  notionPageId?: string;
}

/**
 * User-configurable project settings.
 */
export interface ProjectSettings {
  claudeApiKey?: string;
  slackWorkspace?: string;
  notionWorkspace?: string;
  theme?: string;
}

/**
 * A link to an external resource (Slack channel, Notion page, Jira board, etc.)
 * stored in .pm-os/links.json.
 */
export interface ProjectLink {
  id: string;
  type: string;
  name: string;
  url: string;
  metadata?: Record<string, unknown>;
}

/**
 * An entry in the project decision log (.pm-os/decisions.log).
 */
export interface DecisionLogEntry {
  id: string;
  timestamp: string;
  title: string;
  context: string;
  decision: string;
  rationale: string;
  author: string;
  tags?: string[];
}

/**
 * Full runtime state of the active project.
 */
export interface ProjectState {
  path: string;
  config: ProjectConfig;
  links: ProjectLink[];
  decisions: DecisionLogEntry[];
}

/**
 * Lightweight summary of a project for listing/switching.
 */
export interface ProjectSummary {
  name: string;
  path: string;
  description?: string;
  updatedAt: string;
}
