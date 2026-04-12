interface ConnectorTemplate {
  name: string;
  displayName: string;
  description: string;
  category: string;
  icon: string;
  config: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
  requiredEnvVars?: string[];
}

const connectorTemplates: ConnectorTemplate[] = [
  {
    name: 'slack',
    displayName: 'Slack',
    description: 'Read channels, threads, send messages via Slack API',
    category: 'Communication',
    icon: '#',
    config: { command: 'npx', args: ['-y', '@anthropic/mcp-slack'] },
    requiredEnvVars: ['SLACK_BOT_TOKEN'],
  },
  {
    name: 'notion',
    displayName: 'Notion',
    description: 'Read and write Notion pages, databases, and blocks',
    category: 'Knowledge',
    icon: 'N',
    config: { command: 'npx', args: ['-y', '@anthropic/mcp-notion'] },
    requiredEnvVars: ['NOTION_API_KEY'],
  },
  {
    name: 'google-calendar',
    displayName: 'Google Calendar',
    description: 'View and create calendar events',
    category: 'Productivity',
    icon: '\u{1F4C5}',
    config: { command: 'npx', args: ['-y', '@anthropic/mcp-google-calendar'] },
    requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  {
    name: 'linear',
    displayName: 'Linear',
    description: 'Manage issues, projects, and sprints in Linear',
    category: 'Project Management',
    icon: '\u25C8',
    config: { command: 'npx', args: ['-y', '@anthropic/mcp-linear'] },
    requiredEnvVars: ['LINEAR_API_KEY'],
  },
  {
    name: 'jira',
    displayName: 'Jira',
    description: 'Create and manage Jira issues and boards',
    category: 'Project Management',
    icon: '\u{1F537}',
    config: { command: 'npx', args: ['-y', '@anthropic/mcp-jira'] },
    requiredEnvVars: ['JIRA_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
  },
  {
    name: 'github',
    displayName: 'GitHub',
    description: 'Access repos, issues, PRs, and code search',
    category: 'Development',
    icon: '\u{1F419}',
    config: { command: 'npx', args: ['-y', '@anthropic/mcp-github'] },
    requiredEnvVars: ['GITHUB_TOKEN'],
  },
  {
    name: 'filesystem',
    displayName: 'Filesystem',
    description: 'Read and write files on the local filesystem',
    category: 'System',
    icon: '\u{1F4C1}',
    config: { command: 'npx', args: ['-y', '@anthropic/mcp-filesystem', '/'] },
  },
  {
    name: 'brave-search',
    displayName: 'Brave Search',
    description: 'Web search via Brave Search API',
    category: 'Research',
    icon: '\u{1F50D}',
    config: { command: 'npx', args: ['-y', '@anthropic/mcp-brave-search'] },
    requiredEnvVars: ['BRAVE_API_KEY'],
  },
  {
    name: 'figma',
    displayName: 'Figma',
    description: 'Access Figma files, components, and design tokens',
    category: 'Design',
    icon: 'F',
    config: { command: 'npx', args: ['-y', '@anthropic/mcp-figma'] },
    requiredEnvVars: ['FIGMA_ACCESS_TOKEN'],
  },
  {
    name: 'memory',
    displayName: 'Memory',
    description: 'Persistent memory for Claude across sessions',
    category: 'System',
    icon: '\u{1F9E0}',
    config: { command: 'npx', args: ['-y', '@anthropic/mcp-memory'] },
  },
  {
    name: 'puppeteer',
    displayName: 'Puppeteer',
    description: 'Browser automation, screenshots, and web scraping',
    category: 'Research',
    icon: '\u{1F310}',
    config: { command: 'npx', args: ['-y', '@anthropic/mcp-puppeteer'] },
  },
  {
    name: 'postgres',
    displayName: 'PostgreSQL',
    description: 'Query and manage PostgreSQL databases',
    category: 'Data',
    icon: '\u{1F418}',
    config: { command: 'npx', args: ['-y', '@anthropic/mcp-postgres'] },
    requiredEnvVars: ['DATABASE_URL'],
  },
];

export class McpPanel {
  private el: HTMLElement;
  private selectedProject: { name: string; path: string } | null = null;

  constructor(container: HTMLElement) {
    this.el = container;
  }

  async render(): Promise<void> {
    this.el.innerHTML = '';
    this.el.style.cssText = 'display: flex; flex-direction: column; height: 100%; overflow-y: auto;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;';

    const title = document.createElement('h2');
    title.textContent = 'MCP Center';
    title.style.cssText = 'font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0 0 4px 0;';
    header.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'Manage MCP servers and connectors for Claude Code';
    subtitle.style.cssText = 'font-size: 12px; color: var(--text-muted);';
    header.appendChild(subtitle);

    this.el.appendChild(header);

    // Project selector
    const projectSection = document.createElement('div');
    projectSection.style.cssText = 'padding: 12px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;';

    const projectLabel = document.createElement('div');
    projectLabel.textContent = 'Project';
    projectLabel.style.cssText = 'font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px;';
    projectSection.appendChild(projectLabel);

    const select = document.createElement('select');
    select.style.cssText = 'width: 100%; padding: 6px 10px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; font-family: var(--font-sans); outline: none;';

    const projects: Array<{ name: string; path: string }> = await (window as any).pmOs.mcp.listProjects();

    const placeholder = document.createElement('option');
    placeholder.textContent = projects.length ? 'Select a project...' : 'No projects \u2014 create one first';
    placeholder.value = '';
    select.appendChild(placeholder);

    for (const p of projects) {
      const opt = document.createElement('option');
      opt.value = p.path;
      opt.textContent = p.name;
      if (this.selectedProject?.path === p.path) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener('change', () => {
      const proj = projects.find(p => p.path === select.value);
      this.selectedProject = proj ?? null;
      this.render();
    });

    projectSection.appendChild(select);
    this.el.appendChild(projectSection);

    // Content area
    const content = document.createElement('div');
    content.style.cssText = 'flex: 1; overflow-y: auto; padding: 16px 20px;';

    if (this.selectedProject) {
      // Show active servers
      await this.renderActiveServers(content);
      // Show connector library
      this.renderConnectorLibrary(content);
    } else {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align: center; padding: 40px; color: var(--text-muted);';
      const emptyIcon = document.createElement('div');
      emptyIcon.style.cssText = 'font-size: 32px; margin-bottom: 8px;';
      emptyIcon.textContent = '\u{1F50C}';
      empty.appendChild(emptyIcon);
      const emptyText = document.createElement('div');
      emptyText.textContent = 'Select a project above to manage its MCP servers';
      empty.appendChild(emptyText);
      content.appendChild(empty);
    }

    this.el.appendChild(content);
  }

  private async renderActiveServers(container: HTMLElement): Promise<void> {
    const sectionTitle = document.createElement('div');
    sectionTitle.textContent = 'ACTIVE SERVERS';
    sectionTitle.style.cssText = 'font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 10px;';
    container.appendChild(sectionTitle);

    const config = await (window as any).pmOs.mcp.getConfig(this.selectedProject!.path);
    const servers = config.mcpServers || {};
    const serverNames = Object.keys(servers);

    if (serverNames.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 16px; background: var(--bg-surface); border-radius: var(--radius-md); color: var(--text-muted); font-size: 12px; margin-bottom: 20px; text-align: center;';
      empty.textContent = 'No MCP servers configured. Add one from the library below.';
      container.appendChild(empty);
      return;
    }

    for (const name of serverNames) {
      const srv = servers[name];
      const card = document.createElement('div');
      card.style.cssText = 'padding: 12px 14px; background: var(--bg-surface); border-radius: var(--radius-md); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;';

      const info = document.createElement('div');

      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-weight: 500; font-size: 13px; color: var(--text-primary); display: flex; align-items: center; gap: 6px;';
      const dot = document.createElement('span');
      dot.style.cssText = 'width: 6px; height: 6px; border-radius: 50%; background: var(--success);';
      nameEl.appendChild(dot);
      nameEl.appendChild(document.createTextNode(name));
      info.appendChild(nameEl);

      const cmdEl = document.createElement('div');
      cmdEl.style.cssText = 'font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px;';
      cmdEl.textContent = [srv.command, ...(srv.args || [])].join(' ');
      info.appendChild(cmdEl);

      card.appendChild(info);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '\u2715';
      removeBtn.style.cssText = 'background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 4px 8px; border-radius: var(--radius-sm);';
      removeBtn.addEventListener('mouseenter', () => removeBtn.style.color = 'var(--error)');
      removeBtn.addEventListener('mouseleave', () => removeBtn.style.color = 'var(--text-muted)');
      removeBtn.addEventListener('click', async () => {
        await (window as any).pmOs.mcp.removeServer(this.selectedProject!.path, name);
        this.render();
      });
      card.appendChild(removeBtn);

      container.appendChild(card);
    }

    const spacer = document.createElement('div');
    spacer.style.height = '20px';
    container.appendChild(spacer);
  }

  private renderConnectorLibrary(container: HTMLElement): void {
    const sectionTitle = document.createElement('div');
    sectionTitle.textContent = 'CONNECTOR LIBRARY';
    sectionTitle.style.cssText = 'font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 10px;';
    container.appendChild(sectionTitle);

    // Group by category
    const categories = new Map<string, ConnectorTemplate[]>();
    for (const tmpl of connectorTemplates) {
      if (!categories.has(tmpl.category)) categories.set(tmpl.category, []);
      categories.get(tmpl.category)!.push(tmpl);
    }

    for (const [category, templates] of categories) {
      const catHeader = document.createElement('div');
      catHeader.textContent = category;
      catHeader.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-secondary); margin: 12px 0 6px 0;';
      container.appendChild(catHeader);

      for (const tmpl of templates) {
        const card = document.createElement('div');
        card.style.cssText = 'padding: 10px 14px; background: var(--bg-surface); border-radius: var(--radius-md); margin-bottom: 6px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.1s;';
        card.addEventListener('mouseenter', () => card.style.background = 'var(--bg-hover)');
        card.addEventListener('mouseleave', () => card.style.background = 'var(--bg-surface)');

        const icon = document.createElement('div');
        icon.textContent = tmpl.icon;
        icon.style.cssText = 'width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 16px; background: var(--bg-primary); border-radius: var(--radius-sm); flex-shrink: 0;';
        card.appendChild(icon);

        const info = document.createElement('div');
        info.style.cssText = 'flex: 1; min-width: 0;';

        const name = document.createElement('div');
        name.textContent = tmpl.displayName;
        name.style.cssText = 'font-weight: 500; font-size: 13px; color: var(--text-primary);';
        info.appendChild(name);

        const desc = document.createElement('div');
        desc.textContent = tmpl.description;
        desc.style.cssText = 'font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        info.appendChild(desc);

        card.appendChild(info);

        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add';
        addBtn.style.cssText = 'padding: 4px 10px; background: var(--accent); color: #1e1e2e; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap; flex-shrink: 0;';
        addBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.addConnector(tmpl);
        });
        card.appendChild(addBtn);

        container.appendChild(card);
      }
    }
  }

  private async addConnector(tmpl: ConnectorTemplate): Promise<void> {
    const serverConfig: any = { ...tmpl.config };

    // If there are required env vars, prompt for them
    if (tmpl.requiredEnvVars && tmpl.requiredEnvVars.length > 0) {
      const env: Record<string, string> = {};
      for (const varName of tmpl.requiredEnvVars) {
        const value = prompt(`Enter ${varName} for ${tmpl.displayName}:`);
        if (!value) return; // User cancelled
        env[varName] = value;
      }
      serverConfig.env = { ...serverConfig.env, ...env };
    }

    await (window as any).pmOs.mcp.addServer(this.selectedProject!.path, tmpl.name, serverConfig);
    this.render();
  }
}
