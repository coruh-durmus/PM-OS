export class SettingsPanel {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = container;
  }

  render(): void {
    this.el.textContent = '';
    this.el.style.cssText = 'position: absolute; inset: 0; overflow-y: auto; padding: 24px 32px; color: var(--text-primary);';

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Settings';
    title.style.cssText = 'font-size: 20px; font-weight: 600; margin: 0 0 24px 0; color: var(--text-primary);';
    this.el.appendChild(title);

    // Terminal section
    this.renderSection('Terminal', [
      {
        label: 'Default Shell',
        description: 'The shell used when creating new terminals',
        type: 'select',
        options: ['zsh', 'bash'],
        value: localStorage.getItem('pm-os-default-shell') || 'zsh',
        onChange: (val) => localStorage.setItem('pm-os-default-shell', val),
      },
      {
        label: 'Font Size',
        description: 'Controls the font size in pixels of the terminal',
        type: 'number',
        value: localStorage.getItem('pm-os-terminal-font-size') || '13',
        onChange: (val) => localStorage.setItem('pm-os-terminal-font-size', val),
      },
    ]);

    // Editor section
    this.renderSection('Editor', [
      {
        label: 'Font Size',
        description: 'Controls the font size in pixels of the file viewer',
        type: 'number',
        value: localStorage.getItem('pm-os-editor-font-size') || '13',
        onChange: (val) => localStorage.setItem('pm-os-editor-font-size', val),
      },
      {
        label: 'Word Wrap',
        description: 'Controls whether lines should wrap in the source view',
        type: 'toggle',
        value: localStorage.getItem('pm-os-editor-word-wrap') || 'off',
        onChange: (val) => localStorage.setItem('pm-os-editor-word-wrap', val),
      },
    ]);

    // Appearance section
    this.renderSection('Appearance', [
      {
        label: 'Sidebar Width',
        description: 'Default width of the sidebar in pixels',
        type: 'number',
        value: localStorage.getItem('pm-os-sidebar-width') || '200',
        onChange: (val) => localStorage.setItem('pm-os-sidebar-width', val),
      },
    ]);

    // Automations section
    this.renderInfoSection('Automations', 'codicon-zap', 'Schedule recurring tasks like Slack summaries, Notion drafts, and notifications. Automations run on cron-based schedules.', [
      { label: 'Enable Automations', description: 'Allow automation engine to run scheduled tasks', type: 'toggle', value: localStorage.getItem('pm-os-automations-enabled') || 'on', onChange: (val) => localStorage.setItem('pm-os-automations-enabled', val) },
    ]);

    // MCP Center section
    this.renderInfoSection('MCP Center', 'codicon-server', 'Manage Model Context Protocol servers that provide AI tools and context for your projects.', [
      { label: 'Auto-Start MCP Servers', description: 'Automatically start configured MCP servers when opening a workspace', type: 'toggle', value: localStorage.getItem('pm-os-mcp-autostart') || 'on', onChange: (val) => localStorage.setItem('pm-os-mcp-autostart', val) },
    ]);
  }

  private renderInfoSection(title: string, iconClass: string, description: string, settings: SettingItem[]): void {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 32px;';

    const headingRow = document.createElement('div');
    headingRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border);';

    const icon = document.createElement('span');
    icon.className = `codicon ${iconClass}`;
    icon.style.cssText = 'font-size: 16px; color: var(--accent);';
    headingRow.appendChild(icon);

    const heading = document.createElement('h3');
    heading.textContent = title;
    heading.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0;';
    headingRow.appendChild(heading);

    section.appendChild(headingRow);

    const desc = document.createElement('div');
    desc.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5;';
    desc.textContent = description;
    section.appendChild(desc);

    for (const setting of settings) {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom: 16px;';

      const label = document.createElement('div');
      label.style.cssText = 'font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 4px;';
      label.textContent = setting.label;
      row.appendChild(label);

      const settingDesc = document.createElement('div');
      settingDesc.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-bottom: 8px;';
      settingDesc.textContent = setting.description;
      row.appendChild(settingDesc);

      if (setting.type === 'toggle') {
        const btn = document.createElement('button');
        let isOn = setting.value === 'on';
        const updateToggle = () => {
          btn.textContent = isOn ? 'On' : 'Off';
          btn.style.background = isOn ? 'var(--accent)' : 'var(--bg-surface)';
          btn.style.color = isOn ? 'var(--bg-primary)' : 'var(--text-secondary)';
        };
        btn.style.cssText = 'padding: 6px 16px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; font-family: inherit; cursor: pointer; transition: background 100ms ease;';
        updateToggle();
        btn.addEventListener('click', () => { isOn = !isOn; updateToggle(); setting.onChange(isOn ? 'on' : 'off'); });
        row.appendChild(btn);
      }

      section.appendChild(row);
    }

    this.el.appendChild(section);
  }

  private renderSection(title: string, settings: SettingItem[]): void {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 32px;';

    const heading = document.createElement('h3');
    heading.textContent = title;
    heading.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 1px solid var(--border);';
    section.appendChild(heading);

    for (const setting of settings) {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom: 16px;';

      const label = document.createElement('div');
      label.style.cssText = 'font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 4px;';
      label.textContent = setting.label;
      row.appendChild(label);

      const desc = document.createElement('div');
      desc.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-bottom: 8px;';
      desc.textContent = setting.description;
      row.appendChild(desc);

      if (setting.type === 'select') {
        const select = document.createElement('select');
        select.style.cssText = 'padding: 6px 10px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; font-family: inherit; outline: none; cursor: pointer; min-width: 120px;';
        for (const opt of setting.options || []) {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          option.selected = opt === setting.value;
          select.appendChild(option);
        }
        select.addEventListener('change', () => setting.onChange(select.value));
        row.appendChild(select);
      } else if (setting.type === 'number') {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = setting.value;
        input.min = '8';
        input.max = '32';
        input.style.cssText = 'padding: 6px 10px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; font-family: inherit; outline: none; width: 80px;';
        input.addEventListener('change', () => setting.onChange(input.value));
        row.appendChild(input);
      } else if (setting.type === 'toggle') {
        const btn = document.createElement('button');
        let isOn = setting.value === 'on';
        const updateToggle = () => {
          btn.textContent = isOn ? 'On' : 'Off';
          btn.style.background = isOn ? 'var(--accent)' : 'var(--bg-surface)';
          btn.style.color = isOn ? 'var(--bg-primary)' : 'var(--text-secondary)';
        };
        btn.style.cssText = 'padding: 6px 16px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; font-family: inherit; cursor: pointer; transition: background 100ms ease;';
        updateToggle();
        btn.addEventListener('click', () => {
          isOn = !isOn;
          updateToggle();
          setting.onChange(isOn ? 'on' : 'off');
        });
        row.appendChild(btn);
      }

      section.appendChild(row);
    }

    this.el.appendChild(section);
  }
}

interface SettingItem {
  label: string;
  description: string;
  type: 'select' | 'number' | 'toggle';
  options?: string[];
  value: string;
  onChange: (value: string) => void;
}
