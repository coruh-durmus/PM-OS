import fs from 'node:fs';
import path from 'node:path';

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export function loadMcpConfig(projectPath: string): Record<string, McpServerConfig> {
  const configPath = path.join(projectPath, '.mcp.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return raw.mcpServers ?? raw;
  } catch {
    return {};
  }
}
