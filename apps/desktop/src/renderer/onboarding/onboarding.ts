/**
 * PM-OS First-Run Onboarding Wizard
 *
 * A multi-step overlay that guides new users through workspace setup,
 * app selection, Claude Code verification, and MCP connector configuration.
 */

interface AppOption {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface McpConnector {
  id: string;
  name: string;
  appId: string;
  envVars: { key: string; label: string; placeholder: string }[];
}

const APPS: AppOption[] = [
  { id: 'slack', name: 'Slack', icon: '#', color: '#e01e5a' },
  { id: 'notion', name: 'Notion', icon: 'N', color: '#ffffff' },
  { id: 'figma', name: 'Figma', icon: 'F', color: '#a259ff' },
  { id: 'gmail', name: 'Gmail', icon: 'M', color: '#ea4335' },
  { id: 'jira', name: 'Jira', icon: 'J', color: '#0052cc' },
  { id: 'confluence', name: 'Confluence', icon: 'C', color: '#1868db' },
  { id: 'browser', name: 'Browser', icon: 'B', color: '#89b4fa' },
];

const MCP_CONNECTORS: McpConnector[] = [
  {
    id: 'slack-mcp',
    name: 'Slack MCP',
    appId: 'slack',
    envVars: [
      { key: 'SLACK_BOT_TOKEN', label: 'Bot Token', placeholder: 'xoxb-...' },
      { key: 'SLACK_TEAM_ID', label: 'Team ID', placeholder: 'T01234...' },
    ],
  },
  {
    id: 'notion-mcp',
    name: 'Notion MCP',
    appId: 'notion',
    envVars: [
      { key: 'NOTION_API_KEY', label: 'API Key', placeholder: 'ntn_...' },
    ],
  },
  {
    id: 'atlassian-mcp',
    name: 'Atlassian MCP (Jira + Confluence)',
    appId: 'jira',
    envVars: [
      { key: 'ATLASSIAN_API_TOKEN', label: 'API Token', placeholder: 'Your Atlassian API token' },
      { key: 'ATLASSIAN_EMAIL', label: 'Email', placeholder: 'you@company.com' },
      { key: 'ATLASSIAN_SITE_URL', label: 'Site URL', placeholder: 'https://yoursite.atlassian.net' },
    ],
  },
  {
    id: 'gmail-mcp',
    name: 'Gmail MCP',
    appId: 'gmail',
    envVars: [
      { key: 'GMAIL_OAUTH_CLIENT_ID', label: 'OAuth Client ID', placeholder: 'your-client-id.apps.googleusercontent.com' },
      { key: 'GMAIL_OAUTH_CLIENT_SECRET', label: 'OAuth Client Secret', placeholder: 'GOCSPX-...' },
    ],
  },
];

const TOTAL_STEPS = 6;

/** Remove all child nodes from an element (safe alternative to innerHTML = '') */
function clearChildren(el: HTMLElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

export class Onboarding {
  private root: HTMLElement;
  private overlay!: HTMLDivElement;
  private contentEl!: HTMLDivElement;
  private dotsEl!: HTMLDivElement;
  private navEl!: HTMLDivElement;
  private currentStep = 0;
  private onComplete!: () => void;

  // State
  private workspacePath: string = '';
  private selectedApps: Set<string> = new Set(APPS.map((a) => a.id));
  private claudeStatus: { installed: boolean; version: string | null } | null = null;
  private mcpSetupNow: Set<string> = new Set();
  private mcpEnvValues: Record<string, Record<string, string>> = {};

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(onComplete: () => void): void {
    this.onComplete = onComplete;
    this.buildOverlay();
    this.renderStep();
  }

  private buildOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'onboarding-overlay';

    const card = document.createElement('div');
    card.className = 'onboarding-card';

    this.dotsEl = document.createElement('div');
    this.dotsEl.className = 'onboarding-steps';
    card.appendChild(this.dotsEl);

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'onboarding-content';
    card.appendChild(this.contentEl);

    this.navEl = document.createElement('div');
    this.navEl.className = 'onboarding-nav';
    card.appendChild(this.navEl);

    this.overlay.appendChild(card);
    document.body.appendChild(this.overlay);
  }

  private renderDots(): void {
    clearChildren(this.dotsEl);
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const dot = document.createElement('div');
      dot.className = 'onboarding-dot';
      if (i === this.currentStep) dot.classList.add('active');
      else if (i < this.currentStep) dot.classList.add('completed');
      this.dotsEl.appendChild(dot);
    }
  }

  private renderNav(): void {
    clearChildren(this.navEl);

    if (this.currentStep > 0 && this.currentStep < TOTAL_STEPS - 1) {
      const backBtn = document.createElement('button');
      backBtn.className = 'onboarding-btn onboarding-btn-ghost';
      backBtn.textContent = 'Back';
      backBtn.addEventListener('click', () => this.goBack());
      this.navEl.appendChild(backBtn);
    }

    const spacer = document.createElement('div');
    spacer.className = 'onboarding-nav-spacer';
    this.navEl.appendChild(spacer);

    if (this.currentStep === 0) {
      const startBtn = document.createElement('button');
      startBtn.className = 'onboarding-btn onboarding-btn-primary';
      startBtn.textContent = 'Get Started';
      startBtn.addEventListener('click', () => this.goNext());
      this.navEl.appendChild(startBtn);
    } else if (this.currentStep === TOTAL_STEPS - 1) {
      const openBtn = document.createElement('button');
      openBtn.className = 'onboarding-btn onboarding-btn-primary';
      openBtn.textContent = 'Open Workspace';
      openBtn.addEventListener('click', () => this.finish());
      this.navEl.appendChild(openBtn);
    } else {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'onboarding-btn onboarding-btn-primary';
      nextBtn.textContent = 'Next';
      nextBtn.addEventListener('click', () => this.goNext());
      this.navEl.appendChild(nextBtn);
    }
  }

  private async goNext(): Promise<void> {
    if (this.currentStep >= TOTAL_STEPS - 1) return;
    this.contentEl.classList.add('fade-out');
    await this.wait(150);
    this.currentStep++;
    this.renderStep();
  }

  private async goBack(): Promise<void> {
    if (this.currentStep <= 0) return;
    this.contentEl.classList.add('fade-out');
    await this.wait(150);
    this.currentStep--;
    this.renderStep();
  }

  private renderStep(): void {
    this.renderDots();
    clearChildren(this.contentEl);
    this.contentEl.className = 'onboarding-content fade-in';

    switch (this.currentStep) {
      case 0:
        this.renderWelcome();
        break;
      case 1:
        this.renderWorkspace();
        break;
      case 2:
        this.renderApps();
        break;
      case 3:
        this.renderClaudeCode();
        break;
      case 4:
        this.renderMcp();
        break;
      case 5:
        this.renderDone();
        break;
    }

    this.renderNav();

    // Trigger fade-in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.contentEl.classList.add('visible');
      });
    });
  }

  /* ------ Step 1: Welcome ------ */
  private renderWelcome(): void {
    const wrap = document.createElement('div');
    wrap.className = 'onboarding-welcome-center';

    const logo = document.createElement('div');
    logo.className = 'onboarding-logo';
    const logoText = document.createElement('div');
    logoText.className = 'onboarding-logo-text';
    logoText.textContent = 'PM-OS';
    logo.appendChild(logoText);
    wrap.appendChild(logo);

    const tagline = document.createElement('div');
    tagline.className = 'onboarding-tagline';
    tagline.textContent = 'Your unified workspace for product management';
    wrap.appendChild(tagline);

    const desc = document.createElement('p');
    desc.style.textAlign = 'center';
    desc.textContent =
      'Bring Slack, Notion, Figma, and your favourite tools together in one window -- powered by AI.';
    wrap.appendChild(desc);

    this.contentEl.appendChild(wrap);
  }

  /* ------ Step 2: Workspace ------ */
  private renderWorkspace(): void {
    const h2 = document.createElement('h2');
    h2.textContent = 'Choose a workspace folder';
    this.contentEl.appendChild(h2);

    const desc = document.createElement('p');
    desc.textContent =
      'This is where PM-OS will store your projects, settings, and AI memory.';
    this.contentEl.appendChild(desc);

    const row = document.createElement('div');
    row.className = 'onboarding-workspace-row';

    const pathDisplay = document.createElement('div');
    pathDisplay.className = 'onboarding-path-display';
    if (this.workspacePath) {
      pathDisplay.textContent = this.workspacePath;
    } else {
      pathDisplay.textContent = 'No folder selected';
      pathDisplay.classList.add('empty');
    }
    row.appendChild(pathDisplay);

    const browseBtn = document.createElement('button');
    browseBtn.className = 'onboarding-btn onboarding-btn-secondary';
    browseBtn.textContent = 'Browse';
    browseBtn.addEventListener('click', async () => {
      const result = await window.pmOs.dialog.openDirectory();
      if (result) {
        this.workspacePath = result;
        pathDisplay.textContent = result;
        pathDisplay.classList.remove('empty');
      }
    });
    row.appendChild(browseBtn);

    this.contentEl.appendChild(row);

    // Default path suggestion
    const createRow = document.createElement('div');
    createRow.className = 'onboarding-workspace-row';

    const createBtn = document.createElement('button');
    createBtn.className = 'onboarding-btn onboarding-btn-ghost';
    createBtn.textContent = 'Use default: ~/pm-os-projects';
    createBtn.addEventListener('click', async () => {
      const wsPath = await window.pmOs.fs.getWorkspacePath();
      this.workspacePath = wsPath;
      pathDisplay.textContent = wsPath;
      pathDisplay.classList.remove('empty');
    });
    createRow.appendChild(createBtn);

    this.contentEl.appendChild(createRow);
  }

  /* ------ Step 3: Apps ------ */
  private renderApps(): void {
    const h2 = document.createElement('h2');
    h2.textContent = 'Choose your apps';
    this.contentEl.appendChild(h2);

    const desc = document.createElement('p');
    desc.textContent = 'Select which apps to include in your sidebar. You can change this later.';
    this.contentEl.appendChild(desc);

    const grid = document.createElement('div');
    grid.className = 'onboarding-app-grid';

    for (const app of APPS) {
      const item = document.createElement('div');
      item.className = 'onboarding-app-item';
      if (this.selectedApps.has(app.id)) item.classList.add('selected');

      const icon = document.createElement('div');
      icon.className = 'onboarding-app-icon';
      icon.textContent = app.icon;
      icon.style.background = app.color + '22';
      icon.style.color = app.color;
      item.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'onboarding-app-name';
      name.textContent = app.name;
      item.appendChild(name);

      const check = document.createElement('div');
      check.className = 'onboarding-app-check';
      check.textContent = '\u2713';
      item.appendChild(check);

      item.addEventListener('click', () => {
        if (this.selectedApps.has(app.id)) {
          this.selectedApps.delete(app.id);
          item.classList.remove('selected');
        } else {
          this.selectedApps.add(app.id);
          item.classList.add('selected');
        }
      });

      grid.appendChild(item);
    }

    this.contentEl.appendChild(grid);

    const hint = document.createElement('div');
    hint.className = 'onboarding-hint';
    hint.textContent = 'These apps will appear in your sidebar.';
    this.contentEl.appendChild(hint);
  }

  /* ------ Step 4: Claude Code ------ */
  private renderClaudeCode(): void {
    const h2 = document.createElement('h2');
    h2.textContent = 'Claude Code';
    this.contentEl.appendChild(h2);

    const desc = document.createElement('p');
    desc.textContent = 'PM-OS uses Claude Code for AI-powered project management, planning, and automation.';
    this.contentEl.appendChild(desc);

    if (this.claudeStatus === null) {
      // Show loading, then check
      const loading = document.createElement('div');
      loading.className = 'onboarding-loading';
      const spinner = document.createElement('div');
      spinner.className = 'onboarding-spinner';
      loading.appendChild(spinner);
      const text = document.createElement('span');
      text.textContent = 'Checking for Claude Code...';
      loading.appendChild(text);
      this.contentEl.appendChild(loading);

      this.checkClaudeCode().then(() => {
        if (this.currentStep === 3) {
          // Re-render if still on this step
          clearChildren(this.contentEl);
          this.renderClaudeCode();
        }
      });
      return;
    }

    const statusEl = document.createElement('div');
    statusEl.className = 'onboarding-claude-status';

    const iconEl = document.createElement('div');
    iconEl.className = 'onboarding-claude-icon';

    const infoEl = document.createElement('div');
    infoEl.className = 'onboarding-claude-info';

    if (this.claudeStatus.installed) {
      iconEl.classList.add('ready');
      iconEl.textContent = '\u2713';
      const title = document.createElement('h3');
      title.textContent = 'Claude Code is ready!';
      infoEl.appendChild(title);
      const version = document.createElement('span');
      version.textContent = this.claudeStatus.version ? `Version: ${this.claudeStatus.version}` : 'Installed';
      infoEl.appendChild(version);
    } else {
      iconEl.classList.add('missing');
      iconEl.textContent = '!';
      const title = document.createElement('h3');
      title.textContent = 'Claude Code not found';
      infoEl.appendChild(title);
      const subtitle = document.createElement('span');
      subtitle.textContent = 'Install it to unlock AI features';
      infoEl.appendChild(subtitle);
    }

    statusEl.appendChild(iconEl);
    statusEl.appendChild(infoEl);
    this.contentEl.appendChild(statusEl);

    if (!this.claudeStatus.installed) {
      const installLabel = document.createElement('p');
      installLabel.textContent = 'Install Claude Code by running:';
      installLabel.style.marginBottom = '8px';
      this.contentEl.appendChild(installLabel);

      const codeBlock = document.createElement('div');
      codeBlock.className = 'onboarding-code-block';
      codeBlock.textContent = 'npm install -g @anthropic-ai/claude-code';
      this.contentEl.appendChild(codeBlock);

      const loginLabel = document.createElement('p');
      loginLabel.textContent = 'Then open the terminal (Ctrl+`) and log in:';
      loginLabel.style.marginBottom = '8px';
      this.contentEl.appendChild(loginLabel);

      const loginBlock = document.createElement('div');
      loginBlock.className = 'onboarding-code-block';
      loginBlock.textContent = 'claude login';
      this.contentEl.appendChild(loginBlock);

      const recheckBtn = document.createElement('button');
      recheckBtn.className = 'onboarding-btn onboarding-btn-secondary';
      recheckBtn.textContent = 'Re-check';
      recheckBtn.style.marginTop = '8px';
      recheckBtn.addEventListener('click', async () => {
        this.claudeStatus = null;
        clearChildren(this.contentEl);
        this.renderClaudeCode();
      });
      this.contentEl.appendChild(recheckBtn);
    }
  }

  private async checkClaudeCode(): Promise<void> {
    try {
      this.claudeStatus = await window.pmOs.system.checkClaudeCode();
    } catch {
      this.claudeStatus = { installed: false, version: null };
    }
  }

  /* ------ Step 5: MCP Setup ------ */
  private renderMcp(): void {
    const h2 = document.createElement('h2');
    h2.textContent = 'MCP Connectors';
    this.contentEl.appendChild(h2);

    const desc = document.createElement('p');
    desc.textContent =
      'Recommended MCP connectors for your workflow. These let Claude Code interact with your tools directly.';
    this.contentEl.appendChild(desc);

    // Filter connectors based on selected apps
    const relevantConnectors = MCP_CONNECTORS.filter((c) => {
      if (c.appId === 'jira') {
        return this.selectedApps.has('jira') || this.selectedApps.has('confluence');
      }
      return this.selectedApps.has(c.appId);
    });

    if (relevantConnectors.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'onboarding-mcp-empty';
      empty.textContent = 'No MCP connectors recommended for your selected apps. You can add them later.';
      this.contentEl.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'onboarding-mcp-list';

    for (const connector of relevantConnectors) {
      const item = document.createElement('div');
      item.className = 'onboarding-mcp-item';

      const header = document.createElement('div');
      header.className = 'onboarding-mcp-header';

      const name = document.createElement('span');
      name.className = 'onboarding-mcp-name';
      name.textContent = connector.name;
      header.appendChild(name);

      const isSetupNow = this.mcpSetupNow.has(connector.id);

      const toggle = document.createElement('button');
      toggle.className = `onboarding-mcp-toggle ${isSetupNow ? 'now' : 'later'}`;
      toggle.textContent = isSetupNow ? 'Set up now' : 'Configure later';

      const fields = document.createElement('div');
      fields.className = `onboarding-mcp-fields ${isSetupNow ? '' : 'hidden'}`;

      // Initialise env values store for this connector
      if (!this.mcpEnvValues[connector.id]) {
        this.mcpEnvValues[connector.id] = {};
      }

      for (const envVar of connector.envVars) {
        const field = document.createElement('div');
        field.className = 'onboarding-mcp-field';

        const label = document.createElement('label');
        label.textContent = envVar.label;
        field.appendChild(label);

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = envVar.placeholder;
        input.value = this.mcpEnvValues[connector.id][envVar.key] || '';
        input.addEventListener('input', () => {
          this.mcpEnvValues[connector.id][envVar.key] = input.value;
        });
        field.appendChild(input);

        fields.appendChild(field);
      }

      toggle.addEventListener('click', () => {
        if (this.mcpSetupNow.has(connector.id)) {
          this.mcpSetupNow.delete(connector.id);
          toggle.textContent = 'Configure later';
          toggle.className = 'onboarding-mcp-toggle later';
          fields.classList.add('hidden');
        } else {
          this.mcpSetupNow.add(connector.id);
          toggle.textContent = 'Set up now';
          toggle.className = 'onboarding-mcp-toggle now';
          fields.classList.remove('hidden');
        }
      });

      header.appendChild(toggle);
      item.appendChild(header);
      item.appendChild(fields);
      list.appendChild(item);
    }

    this.contentEl.appendChild(list);
  }

  /* ------ Step 6: Done ------ */
  private renderDone(): void {
    const wrap = document.createElement('div');
    wrap.className = 'onboarding-done-center';

    const icon = document.createElement('div');
    icon.className = 'onboarding-done-icon';
    icon.textContent = '\u2713';
    wrap.appendChild(icon);

    const h2 = document.createElement('h2');
    h2.textContent = "You're all set!";
    wrap.appendChild(h2);

    const desc = document.createElement('p');
    desc.textContent = 'PM-OS is ready to go. Here is a summary of your setup:';
    wrap.appendChild(desc);

    const summary = document.createElement('div');
    summary.className = 'onboarding-summary';

    const addRow = (label: string, value: string) => {
      const row = document.createElement('div');
      row.className = 'onboarding-summary-row';
      const l = document.createElement('span');
      l.className = 'onboarding-summary-label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'onboarding-summary-value';
      v.textContent = value;
      row.appendChild(l);
      row.appendChild(v);
      summary.appendChild(row);
    };

    addRow('Workspace', this.workspacePath || '~/pm-os-projects (default)');
    addRow(
      'Apps',
      APPS.filter((a) => this.selectedApps.has(a.id))
        .map((a) => a.name)
        .join(', ') || 'None',
    );
    addRow(
      'Claude Code',
      this.claudeStatus?.installed ? 'Installed' : 'Not installed',
    );

    const mcpCount = this.mcpSetupNow.size;
    addRow('MCP Connectors', mcpCount > 0 ? `${mcpCount} to configure` : 'None selected');

    wrap.appendChild(summary);
    this.contentEl.appendChild(wrap);
  }

  /* ------ Finish ------ */
  private async finish(): Promise<void> {
    // Save settings
    try {
      const enabledApps: Record<string, boolean> = {};
      for (const app of APPS) {
        enabledApps[app.id] = this.selectedApps.has(app.id);
      }
      await window.pmOs.settings.save({
        workspacePath: this.workspacePath || null,
        enabledApps,
        onboardedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[Onboarding] Failed to save settings:', e);
    }

    // Save MCP configs for connectors the user chose "Set up now"
    if (this.workspacePath && this.mcpSetupNow.size > 0) {
      try {
        await this.saveMcpConfigs();
      } catch (e) {
        console.error('[Onboarding] Failed to save MCP configs:', e);
      }
    }

    // Remove overlay
    this.overlay.remove();
    this.onComplete();
  }

  private async saveMcpConfigs(): Promise<void> {
    for (const connectorId of this.mcpSetupNow) {
      const connector = MCP_CONNECTORS.find((c) => c.id === connectorId);
      if (!connector) continue;

      const envValues = this.mcpEnvValues[connectorId] || {};
      const hasValues = Object.values(envValues).some((v) => v.trim() !== '');
      if (!hasValues) continue;

      // Build MCP server config
      const env: Record<string, string> = {};
      for (const envVar of connector.envVars) {
        const val = envValues[envVar.key]?.trim();
        if (val) env[envVar.key] = val;
      }

      const serverConfig: Record<string, unknown> = { command: 'npx', args: ['-y', `@anthropic-ai/${connector.id}`], env };

      await window.pmOs.mcp.addServer(this.workspacePath, connector.id, serverConfig);
    }
  }

  /* ------ Utilities ------ */
  private wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
