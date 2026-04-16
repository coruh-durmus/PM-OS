import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

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
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        cursorAccent: '#1e1e2e',
        selectionBackground: '#45475a',
        selectionForeground: '#cdd6f4',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#cba6f7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#cba6f7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      },
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
