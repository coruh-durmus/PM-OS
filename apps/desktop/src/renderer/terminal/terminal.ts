import { Terminal as XTerm, ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexLuminance(hex: string): number {
  const c = hex.replace('#', '');
  if (c.length !== 6) return 0;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  if ([r, g, b].some(Number.isNaN)) return 0;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function deriveTerminalTheme(): ITheme {
  const bg = readCssVar('--bg-primary') || '#1e1e2e';
  const fg = readCssVar('--text-primary') || '#cdd6f4';
  const accent = readCssVar('--accent') || '#89b4fa';
  const hover = readCssVar('--bg-hover') || '#45475a';
  const error = readCssVar('--error') || '#f38ba8';
  const success = readCssVar('--success') || '#a6e3a1';
  const warning = readCssVar('--warning') || '#f9e2af';
  const muted = readCssVar('--text-muted') || '#6c7086';
  const isLight = hexLuminance(bg) > 0.5;

  const common = {
    background: bg,
    foreground: fg,
    cursor: accent,
    cursorAccent: bg,
    selectionBackground: hover,
    selectionForeground: fg,
    red: error,
    green: success,
    yellow: warning,
    blue: accent,
    brightRed: error,
    brightGreen: success,
    brightYellow: warning,
    brightBlue: accent,
  };

  if (isLight) {
    return {
      ...common,
      black: '#5c5f77',
      magenta: '#8839ef',
      cyan: '#179299',
      white: '#acb0be',
      brightBlack: muted,
      brightMagenta: '#8839ef',
      brightCyan: '#179299',
      brightWhite: '#4c4f69',
    };
  }
  return {
    ...common,
    black: hover,
    magenta: '#cba6f7',
    cyan: '#94e2d5',
    white: '#bac2de',
    brightBlack: muted,
    brightMagenta: '#cba6f7',
    brightCyan: '#94e2d5',
    brightWhite: fg,
  };
}

export class TerminalPanel {
  private terminal: XTerm;
  private fitAddon: FitAddon;
  private sessionId: string | null = null;
  private cleanupData?: () => void;
  private cleanupExit?: () => void;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    this.terminal = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace",
      theme: deriveTerminalTheme(),
      allowProposedApi: true,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(new WebLinksAddon());
  }

  async init(options?: { shell?: string; cwd?: string }): Promise<void> {
    // Mount terminal to DOM
    this.terminal.open(this.container);
    this.fitAddon.fit();

    // Create PTY session
    this.sessionId = await window.pmOs.terminal.create(options);
    if (!this.sessionId) {
      this.terminal.writeln('\x1b[31mFailed to create terminal session\x1b[0m');
      return;
    }

    // Wire up data flow: PTY → xterm
    this.cleanupData = window.pmOs.terminal.onData(({ id, data }: { id: string; data: string }) => {
      if (id === this.sessionId) {
        this.terminal.write(data);
      }
    });

    // Wire up: xterm → PTY
    this.terminal.onData((data: string) => {
      if (this.sessionId) {
        window.pmOs.terminal.write(this.sessionId, data);
      }
    });

    // Handle resize
    this.terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      if (this.sessionId) {
        window.pmOs.terminal.resize(this.sessionId, cols, rows);
      }
    });

    // Handle exit
    this.cleanupExit = window.pmOs.terminal.onExit(({ id, exitCode }: { id: string; exitCode: number }) => {
      if (id === this.sessionId) {
        this.terminal.writeln(`\r\n\x1b[33mProcess exited with code ${exitCode}\x1b[0m`);
        this.sessionId = null;
      }
    });

    // Observe container resize to fit terminal
    const resizeObserver = new ResizeObserver(() => {
      try { this.fitAddon.fit(); } catch {}
    });
    resizeObserver.observe(this.container);

    // Focus terminal
    this.terminal.focus();
  }

  focus(): void {
    this.terminal.focus();
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  fit(): void {
    try { this.fitAddon.fit(); } catch {}
  }

  applyCurrentTheme(): void {
    this.terminal.options.theme = deriveTerminalTheme();
  }

  clear(): void {
    this.terminal.write('\x1b[2J\x1b[H');
  }

  getSelection(): string {
    return this.terminal.getSelection();
  }

  writeText(text: string): void {
    if (this.sessionId) {
      window.pmOs.terminal.write(this.sessionId, text);
    }
  }

  dispose(): void {
    this.cleanupData?.();
    this.cleanupExit?.();
    if (this.sessionId) {
      window.pmOs.terminal.destroy(this.sessionId);
    }
    this.terminal.dispose();
  }
}
