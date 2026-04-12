import { ThemeManager } from './theme-manager';

export class ThemePicker {
  private el: HTMLElement;
  private themeManager: ThemeManager;
  private visible = false;

  constructor(themeManager: ThemeManager) {
    this.themeManager = themeManager;
    this.el = document.createElement('div');
    this.el.className = 'theme-picker hidden';
    document.body.appendChild(this.el);
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) this.show();
    else this.hide();
  }

  private show(): void {
    this.el.classList.remove('hidden');
    this.render();
  }

  private hide(): void {
    this.el.classList.add('hidden');
    this.visible = false;
  }

  private clearChildren(el: HTMLElement): void {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  private render(): void {
    this.clearChildren(this.el);

    // Overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 999;';
    overlay.addEventListener('click', () => this.hide());
    this.el.appendChild(overlay);

    // Dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = 'position: fixed; top: 18%; left: 50%; transform: translateX(-50%); width: 420px; max-height: 500px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); z-index: 1000; overflow: hidden; display: flex; flex-direction: column;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 14px 16px; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 600; color: var(--text-primary);';
    header.textContent = 'Select Color Theme';
    dialog.appendChild(header);

    // List
    const list = document.createElement('div');
    list.style.cssText = 'overflow-y: auto; max-height: 400px; padding: 4px 0;';

    const currentId = this.themeManager.getCurrentTheme().id;
    const allThemes = this.themeManager.getThemes();

    for (const theme of allThemes) {
      const item = document.createElement('div');
      const isActive = theme.id === currentId;
      item.style.cssText = `padding: 10px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.1s; ${isActive ? 'background: var(--bg-hover);' : ''}`;
      item.addEventListener('mouseenter', () => { if (!isActive) item.style.background = 'var(--bg-hover)'; });
      item.addEventListener('mouseleave', () => { if (!isActive) item.style.background = ''; });

      // Color preview strip
      const preview = document.createElement('div');
      preview.style.cssText = 'display: flex; gap: 2px; flex-shrink: 0;';
      const previewColors = [theme.colors['--bg-primary'], theme.colors['--accent'], theme.colors['--success'], theme.colors['--error'], theme.colors['--warning']];
      for (const c of previewColors) {
        const dot = document.createElement('div');
        dot.style.cssText = `width: 12px; height: 12px; border-radius: 2px; background: ${c};`;
        preview.appendChild(dot);
      }
      item.appendChild(preview);

      // Name
      const name = document.createElement('span');
      name.textContent = theme.name;
      name.style.cssText = 'font-size: 13px; color: var(--text-primary); flex: 1;';
      item.appendChild(name);

      // Type badge
      const badge = document.createElement('span');
      badge.textContent = theme.type;
      badge.style.cssText = `font-size: 10px; padding: 2px 6px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; ${theme.type === 'dark' ? 'background: #333; color: #aaa;' : 'background: #ddd; color: #555;'}`;
      item.appendChild(badge);

      // Active check
      if (isActive) {
        const check = document.createElement('span');
        check.textContent = '\u2713';
        check.style.cssText = 'color: var(--accent); font-size: 14px; font-weight: 600;';
        item.appendChild(check);
      }

      item.addEventListener('click', () => {
        this.themeManager.setTheme(theme.id);
        this.hide();
      });

      list.appendChild(item);
    }

    dialog.appendChild(list);
    this.el.appendChild(dialog);
  }
}
