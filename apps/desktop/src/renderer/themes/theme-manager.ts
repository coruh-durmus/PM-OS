import { themes, Theme } from './themes';

const STORAGE_KEY = 'pm-os-theme';

export class ThemeManager {
  private currentTheme: Theme;
  private listeners: Array<(theme: Theme) => void> = [];
  private allThemes: Theme[];

  constructor() {
    this.allThemes = [...themes];
    const savedId = localStorage.getItem(STORAGE_KEY);
    this.currentTheme = this.allThemes.find(t => t.id === savedId) ?? this.allThemes[0];
    this.applyTheme(this.currentTheme);
    this.loadExtensionThemes();
  }

  private async loadExtensionThemes(): Promise<void> {
    try {
      const extThemes: Theme[] = await (window as any).pmOs.extensions?.getThemes?.() ?? [];
      for (const t of extThemes) {
        if (!this.allThemes.find(e => e.id === t.id)) {
          this.allThemes.push(t);
        }
      }
      // If saved theme was an extension theme, apply it now
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId && savedId !== this.currentTheme.id) {
        const found = this.allThemes.find(t => t.id === savedId);
        if (found) {
          this.currentTheme = found;
          this.applyTheme(found);
        }
      }
    } catch {}
  }

  getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  getThemes(): Theme[] {
    return this.allThemes;
  }

  setTheme(id: string): void {
    const theme = this.allThemes.find(t => t.id === id);
    if (!theme) return;
    this.currentTheme = theme;
    localStorage.setItem(STORAGE_KEY, id);
    this.applyTheme(theme);
    this.listeners.forEach(cb => cb(theme));
  }

  onChange(callback: (theme: Theme) => void): void {
    this.listeners.push(callback);
  }

  private applyTheme(theme: Theme): void {
    const root = document.documentElement;
    for (const [prop, value] of Object.entries(theme.colors)) {
      root.style.setProperty(prop, value);
    }
  }
}
