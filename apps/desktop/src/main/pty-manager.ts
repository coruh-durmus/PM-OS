import * as pty from 'node-pty';
import os from 'node:os';

interface PtySession {
  pty: pty.IPty;
  onDataCallback?: (data: string) => void;
  onExitCallback?: (code: number) => void;
}

export class PtyManager {
  private sessions = new Map<string, PtySession>();
  private nextId = 1;

  create(options?: { cwd?: string; shell?: string }): string {
    const id = `terminal-${this.nextId++}`;
    const shell =
      options?.shell ??
      (os.platform() === 'win32'
        ? 'powershell.exe'
        : process.env.SHELL || '/bin/zsh');
    const cwd = options?.cwd ?? os.homedir();

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: { ...process.env } as Record<string, string>,
    });

    const session: PtySession = { pty: ptyProcess };
    this.sessions.set(id, session);

    return id;
  }

  onData(id: string, callback: (data: string) => void): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.onDataCallback = callback;
    session.pty.onData((data) => callback(data));
  }

  onExit(id: string, callback: (code: number) => void): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.onExitCallback = callback;
    session.pty.onExit(({ exitCode }) => callback(exitCode));
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.pty.resize(cols, rows);
  }

  destroy(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.pty.kill();
    this.sessions.delete(id);
  }

  destroyAll(): void {
    for (const id of this.sessions.keys()) {
      this.destroy(id);
    }
  }
}
