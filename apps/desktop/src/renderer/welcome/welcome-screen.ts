export class WelcomeScreen {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = container;
  }

  async render(): Promise<void> {
    while (this.el.firstChild) this.el.removeChild(this.el.firstChild);
    this.el.style.cssText = 'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg-primary);';

    const card = document.createElement('div');
    card.style.cssText = 'text-align: center; max-width: 480px; width: 100%; padding: 40px;';

    // Logo
    const logo = document.createElement('div');
    logo.style.cssText = 'font-size: 48px; font-weight: 800; color: var(--accent); letter-spacing: 3px; margin-bottom: 8px;';
    logo.textContent = 'PMOS';
    card.appendChild(logo);

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-size: 14px; color: var(--text-muted); margin-bottom: 32px;';
    subtitle.textContent = 'Product Manager Operating System';
    card.appendChild(subtitle);

    // Start section
    const startTitle = document.createElement('div');
    startTitle.style.cssText = 'font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 12px; text-align: left;';
    startTitle.textContent = 'Start';
    card.appendChild(startTitle);

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; flex-direction: column; gap: 6px; margin-bottom: 28px;';

    const openFolderBtn = this.createActionButton('\u{1F4C2}', 'Open Folder...', 'Cmd+O', async () => {
      await (window as any).pmOs.workspace.openFolder();
    });
    actions.appendChild(openFolderBtn);

    const openWorkspaceBtn = this.createActionButton('\u{1F4CB}', 'Open Workspace from File...', '', async () => {
      await (window as any).pmOs.workspace.openFromFile();
    });
    actions.appendChild(openWorkspaceBtn);

    card.appendChild(actions);

    // Recent section
    try {
      const recent: string[] = await (window as any).pmOs.workspace.getRecent();
      if (recent.length > 0) {
        const recentTitle = document.createElement('div');
        recentTitle.style.cssText = 'font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 10px; text-align: left;';
        recentTitle.textContent = 'Recent';
        card.appendChild(recentTitle);

        const recentList = document.createElement('div');
        recentList.style.cssText = 'display: flex; flex-direction: column; gap: 2px; margin-bottom: 28px;';

        for (const rPath of recent.slice(0, 5)) {
          const item = document.createElement('div');
          item.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: var(--radius-sm); cursor: pointer; transition: background 0.1s; text-align: left;';
          item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-surface)');
          item.addEventListener('mouseleave', () => item.style.background = '');

          const icon = document.createElement('span');
          icon.textContent = rPath.endsWith('.pmos-workspace') ? '\u{1F4CB}' : '\u{1F4C2}';
          icon.style.cssText = 'font-size: 14px; flex-shrink: 0;';
          item.appendChild(icon);

          const pathParts = rPath.split('/');
          const name = document.createElement('span');
          name.textContent = pathParts[pathParts.length - 1] || rPath;
          name.style.cssText = 'font-size: 13px; color: var(--accent); flex: 1;';
          item.appendChild(name);

          const fullPath = document.createElement('span');
          fullPath.textContent = rPath;
          fullPath.style.cssText = 'font-size: 10px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;';
          item.appendChild(fullPath);

          item.addEventListener('click', () => {
            if (rPath.endsWith('.pmos-workspace')) {
              (window as any).pmOs.workspace.openFromFile();
            } else {
              // Open the folder directly — use IPC
              (window as any).pmOs.fs.readDir(rPath).then(() => {
                // If readable, trigger workspace open
                (window as any).pmOs.workspace.openFolder();
              });
            }
          });

          recentList.appendChild(item);
        }

        card.appendChild(recentList);
      }
    } catch {
      // Recent workspaces unavailable — skip section
    }

    // Keyboard shortcuts
    const shortcutsTitle = document.createElement('div');
    shortcutsTitle.style.cssText = 'font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 10px; text-align: left;';
    shortcutsTitle.textContent = 'Shortcuts';
    card.appendChild(shortcutsTitle);

    const shortcuts = document.createElement('div');
    shortcuts.style.cssText = 'display: grid; grid-template-columns: 1fr auto; gap: 4px 16px; text-align: left;';

    const shortcutData = [
      ['Command Palette', 'Cmd+P'],
      ['Toggle Terminal', 'Ctrl+`'],
      ['Change Theme', 'Ctrl+Shift+T'],
      ['Open Folder', 'Cmd+O'],
    ];

    for (const [label, key] of shortcutData) {
      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      labelEl.style.cssText = 'font-size: 12px; color: var(--text-secondary);';
      shortcuts.appendChild(labelEl);

      const keyEl = document.createElement('span');
      keyEl.textContent = key;
      keyEl.style.cssText = 'font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); background: var(--bg-surface); padding: 1px 6px; border-radius: 3px;';
      shortcuts.appendChild(keyEl);
    }

    card.appendChild(shortcuts);

    this.el.appendChild(card);
  }

  private createActionButton(icon: string, label: string, shortcut: string, onClick: () => void): HTMLElement {
    const btn = document.createElement('div');
    btn.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: background 0.1s; text-align: left;';
    btn.addEventListener('mouseenter', () => btn.style.background = 'var(--bg-surface)');
    btn.addEventListener('mouseleave', () => btn.style.background = '');
    btn.addEventListener('click', onClick);

    const iconEl = document.createElement('span');
    iconEl.textContent = icon;
    iconEl.style.cssText = 'font-size: 16px; flex-shrink: 0;';
    btn.appendChild(iconEl);

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 13px; color: var(--accent); flex: 1;';
    btn.appendChild(labelEl);

    if (shortcut) {
      const keyEl = document.createElement('span');
      keyEl.textContent = shortcut;
      keyEl.style.cssText = 'font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);';
      btn.appendChild(keyEl);
    }

    return btn;
  }
}
