import * as pty from 'node-pty';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Safe logging — guard against EPIPE when stdout/stderr pipe is broken
// (e.g. after a PTY process exits and breaks the pipe).
// ---------------------------------------------------------------------------
function safeLog(...args: unknown[]): void {
  try { console.log(...args); } catch {}
}
function safeError(...args: unknown[]): void {
  try { console.error(...args); } catch {}
}

interface PtySession {
  pty: pty.IPty;
  dead: boolean;
  onDataCallback?: (data: string) => void;
  onExitCallback?: (code: number) => void;
}

export class PtyManager {
  private sessions = new Map<string, PtySession>();
  private nextId = 1;

  create(options?: { cwd?: string; shell?: string }): string {
    const id = `terminal-${this.nextId++}`;
    const cwd = options?.cwd ?? os.homedir();

    // Use the requested shell, or fall back to the user's default shell
    const shellCmd =
      options?.shell ??
      (os.platform() === 'win32'
        ? 'powershell.exe'
        : process.env.SHELL || '/bin/zsh');
    const shellArgs: string[] = [];

    const ptyProcess = pty.spawn(shellCmd, shellArgs, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
    });

    const session: PtySession = { pty: ptyProcess, dead: false };
    this.sessions.set(id, session);

    safeLog(`[pty] Created ${id} (shell=${shellCmd}, cwd=${cwd})`);

    return id;
  }

  onData(id: string, callback: (data: string) => void): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.onDataCallback = callback;
    session.pty.onData((data) => {
      try { callback(data); } catch {}
    });
  }

  onExit(id: string, callback: (code: number) => void): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.onExitCallback = callback;
    session.pty.onExit(({ exitCode }) => {
      session.dead = true;
      safeLog(`[pty] Exited ${id} (code=${exitCode})`);
      try { callback(exitCode); } catch {}
    });
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (!session || session.dead) return;
    try {
      session.pty.write(data);
    } catch (err) {
      safeError(`[pty] Write failed for ${id}:`, err);
      session.dead = true;
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session || session.dead) return;
    try {
      session.pty.resize(cols, rows);
    } catch (err) {
      safeError(`[pty] Resize failed for ${id}:`, err);
    }
  }

  destroy(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    safeLog(`[pty] Destroying ${id}`);
    try {
      session.pty.kill();
    } catch (err) {
      // Process may already be dead — that is fine.
      safeError(`[pty] Kill failed for ${id} (already dead?):`, err);
    }
    this.sessions.delete(id);
  }

  destroyAll(): void {
    for (const id of this.sessions.keys()) {
      this.destroy(id);
    }
  }
}
