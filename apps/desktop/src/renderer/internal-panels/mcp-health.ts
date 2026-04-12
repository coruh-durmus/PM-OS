export class McpHealthChecker {
  private notified = false;

  async checkAndNotify(): Promise<void> {
    if (this.notified) return;

    try {
      const result = await (window as any).pmOs.mcp.checkInstalled();
      const missing = result.required.filter((r: any) => !r.installed);

      if (missing.length > 0) {
        this.showNotification(missing);
        this.notified = true;
      }
    } catch {}
  }

  private showNotification(missing: Array<{ name: string; forApp: string; npmPackage: string }>): void {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed; bottom: 32px; right: 16px; width: 360px;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      z-index: 900; padding: 16px; font-size: 12px;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';

    const title = document.createElement('span');
    title.textContent = 'Recommended MCP Servers';
    title.style.cssText = 'font-weight: 600; font-size: 13px; color: var(--text-primary);';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText = 'background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px;';
    closeBtn.addEventListener('click', () => banner.remove());
    header.appendChild(closeBtn);

    banner.appendChild(header);

    const desc = document.createElement('div');
    desc.textContent = 'Install these MCPs so Claude Code can interact with your PM tools:';
    desc.style.cssText = 'color: var(--text-muted); margin-bottom: 10px; line-height: 1.4;';
    banner.appendChild(desc);

    for (const mcp of missing) {
      const row = document.createElement('div');
      row.style.cssText = 'padding: 6px 0; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border);';

      const info = document.createElement('div');
      const name = document.createElement('div');
      name.textContent = mcp.name;
      name.style.cssText = 'font-weight: 500; color: var(--text-primary);';
      info.appendChild(name);
      const sub = document.createElement('div');
      sub.textContent = 'For ' + mcp.forApp;
      sub.style.cssText = 'font-size: 10px; color: var(--text-muted);';
      info.appendChild(sub);
      row.appendChild(info);

      const installBtn = document.createElement('button');
      installBtn.textContent = 'Install';
      installBtn.style.cssText = 'padding: 3px 10px; background: var(--accent); color: #1e1e2e; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; font-weight: 500;';
      installBtn.addEventListener('click', () => {
        installBtn.textContent = 'See Terminal';
        installBtn.disabled = true;
        // Copy install command to clipboard
        navigator.clipboard.writeText('claude mcp add ' + mcp.npmPackage).catch(() => {});
      });
      row.appendChild(installBtn);

      banner.appendChild(row);
    }

    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top: 10px; font-size: 10px; color: var(--text-muted);';
    footer.textContent = 'Use Ctrl+` to open terminal, then run the install commands.';
    banner.appendChild(footer);

    document.body.appendChild(banner);

    // Auto-dismiss after 30s
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 30000);
  }
}
