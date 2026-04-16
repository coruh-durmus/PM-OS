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

    // Check workspace state and show CTA if no workspace is open
    try {
      const isOpen = await (window as any).pmOs.workspace.isOpen();
      if (!isOpen) {
        this.renderWorkspaceCta(card);
      }
    } catch {
      // If isOpen fails, show the CTA as fallback
      this.renderWorkspaceCta(card);
    }

    this.el.appendChild(card);

    // Listen for workspace changes to update the view
    (window as any).pmOs.workspace.onChanged((data: any) => {
      if (data.isOpen) {
        // Workspace opened — remove CTA, keep just logo
        this.removeCtaElements(card);
      }
    });
  }

  private renderWorkspaceCta(card: HTMLElement): void {
    // Open Folder button
    const openBtn = document.createElement('button');
    openBtn.className = 'welcome-cta-btn';
    openBtn.style.cssText = 'display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; background: var(--accent); color: var(--bg-primary); border: none; border-radius: var(--radius-md); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; margin-bottom: 12px;';
    openBtn.textContent = 'Open Workspace';
    openBtn.addEventListener('mouseenter', () => openBtn.style.background = 'var(--accent-hover)');
    openBtn.addEventListener('mouseleave', () => openBtn.style.background = 'var(--accent)');
    openBtn.addEventListener('click', () => {
      (window as any).pmOs.workspace.openFolder();
    });
    card.appendChild(openBtn);

    // Shortcut hint
    const hint = document.createElement('div');
    hint.className = 'welcome-cta-hint';
    hint.style.cssText = 'font-size: 12px; color: var(--text-muted);';

    const hintText = document.createTextNode('or press ');
    hint.appendChild(hintText);

    const kbd = document.createElement('kbd');
    kbd.style.cssText = 'font-family: var(--font-mono); font-size: 11px; background: var(--bg-surface); padding: 1px 6px; border-radius: 3px; border: 1px solid var(--border);';
    kbd.textContent = 'Cmd+O';
    hint.appendChild(kbd);

    card.appendChild(hint);
  }

  private removeCtaElements(card: HTMLElement): void {
    const btn = card.querySelector('.welcome-cta-btn');
    const hint = card.querySelector('.welcome-cta-hint');
    if (btn) btn.remove();
    if (hint) hint.remove();
  }
}
