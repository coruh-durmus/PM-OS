import { themes, Theme } from './themes';

const STORAGE_KEY = 'pm-os-theme';

export class ThemeManager {
  private currentTheme: Theme;
  private listeners: Array<(theme: Theme) => void> = [];

  constructor() {
    const savedId = localStorage.getItem(STORAGE_KEY);
    this.currentTheme = themes.find(t => t.id === savedId) ?? themes[0];
    this.applyTheme(this.currentTheme);
  }

  getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  getThemes(): Theme[] {
    return themes;
  }

  setTheme(id: string): void {
    const theme = themes.find(t => t.id === id);
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
