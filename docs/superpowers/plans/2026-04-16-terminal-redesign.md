# Terminal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the PMOS terminal panel to match VS Code's UX — instances sidebar, shell dropdown, context menu, maximize, and visual polish.

**Architecture:** Three new renderer components (TerminalInstancesPanel, TerminalDropdown, TerminalContextMenu) plug into the existing BottomPanel class. PTY manager, IPC, and preload get a minor `shell` option extension. No structural changes to the terminal data pipeline.

**Tech Stack:** TypeScript, xterm.js, node-pty, Electron IPC, CSS custom properties

---

## File Map

### New files (3)
| File | Responsibility |
|------|---------------|
| `apps/desktop/src/renderer/bottom-panel/terminal-dropdown.ts` | Shell picker dropdown menu (zsh/bash) |
| `apps/desktop/src/renderer/bottom-panel/terminal-context-menu.ts` | `...` button context menu (rename, clear, kill, etc.) |
| `apps/desktop/src/renderer/bottom-panel/terminal-instances-panel.ts` | Right sidebar listing all terminal instances |

### Modified files (8)
| File | What changes |
|------|-------------|
| `apps/desktop/src/main/pty-manager.ts` | Use `options.shell` when no tmux |
| `apps/desktop/src/main/ipc.ts` | Pass `shell` option in `terminal:create` handler |
| `apps/desktop/src/preload/index.ts` | Extend `create()` type: `{ cwd?, shell? }` |
| `apps/desktop/src/renderer/terminal/terminal.ts` | Accept `shell` in `init()`, expose `clear()`, `getSelection()`, `writeText()` |
| `apps/desktop/src/renderer/bottom-panel/bottom-panel.ts` | New buttons, wire dropdown/menu/instances, maximize, shell param |
| `apps/desktop/src/renderer/index.html` | Replace action buttons, add instances panel container |
| `apps/desktop/src/renderer/terminal/terminal.css` | New button styles, instances panel styles, visual polish |
| `apps/desktop/src/renderer/styles/layout.css` | Header height 30px -> 35px |

---

### Task 1: Shell option in PTY pipeline

**Files:**
- Modify: `apps/desktop/src/main/ipc.ts:85`
- Modify: `apps/desktop/src/preload/index.ts:165`

The PtyManager already reads `options?.shell` (line 45 of pty-manager.ts), so no change needed there. We need to pass the option through IPC and preload.

- [ ] **Step 1: Update IPC handler to accept shell option**

In `apps/desktop/src/main/ipc.ts`, change line 85 from:
```typescript
ipcMain.handle('terminal:create', (_e, options?: { cwd?: string }) => {
```
to:
```typescript
ipcMain.handle('terminal:create', (_e, options?: { cwd?: string; shell?: string }) => {
```

- [ ] **Step 2: Update preload type to include shell**

In `apps/desktop/src/preload/index.ts`, change line 165 from:
```typescript
create(options?: { cwd?: string }): Promise<string | null> {
```
to:
```typescript
create(options?: { cwd?: string; shell?: string }): Promise<string | null> {
```

- [ ] **Step 3: Build and verify**

Run: `pnpm build 2>&1 | tail -5`
Expected: Build succeeds, no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/ipc.ts apps/desktop/src/preload/index.ts
git commit -m "feat(terminal): pass shell option through IPC pipeline"
```

---

### Task 2: Extend TerminalPanel with clear, getSelection, writeText

**Files:**
- Modify: `apps/desktop/src/renderer/terminal/terminal.ts`

Add methods the context menu needs. Also update `init()` to accept a shell option.

- [ ] **Step 1: Add shell option to init() and new public methods**

In `apps/desktop/src/renderer/terminal/terminal.ts`, add the `shell` parameter to `init()` and three new methods after `fit()`:

Change the `init()` signature from:
```typescript
async init(): Promise<void> {
```
to:
```typescript
async init(options?: { shell?: string }): Promise<void> {
```

And change the PTY create call inside `init()` from:
```typescript
this.sessionId = await window.pmOs.terminal.create();
```
to:
```typescript
this.sessionId = await window.pmOs.terminal.create(options);
```

Add these methods after `fit()` (after line 113):

```typescript
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
```

- [ ] **Step 2: Build and verify**

Run: `pnpm build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/terminal/terminal.ts
git commit -m "feat(terminal): add clear, getSelection, writeText methods and shell option"
```

---

### Task 3: Create TerminalDropdown component

**Files:**
- Create: `apps/desktop/src/renderer/bottom-panel/terminal-dropdown.ts`

A floating dropdown menu anchored below the `v` button with "zsh" and "bash" options.

- [ ] **Step 1: Create the dropdown component**

Create `apps/desktop/src/renderer/bottom-panel/terminal-dropdown.ts`:

```typescript
export class TerminalDropdown {
  private el: HTMLElement;
  private anchorEl: HTMLElement;
  private onSelect: (shell: string) => void;
  private visible = false;
  private outsideClickHandler: (e: MouseEvent) => void;
  private escapeHandler: (e: KeyboardEvent) => void;

  constructor(anchorEl: HTMLElement, onSelect: (shell: string) => void) {
    this.anchorEl = anchorEl;
    this.onSelect = onSelect;

    this.el = document.createElement('div');
    this.el.className = 'terminal-dropdown';
    this.el.style.cssText = 'position: fixed; z-index: 1000; display: none; min-width: 140px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); overflow: hidden; font-size: 12px;';

    const shells = ['zsh', 'bash'];
    for (const shell of shells) {
      const item = document.createElement('div');
      item.className = 'terminal-dropdown-item';
      item.style.cssText = 'padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: var(--text-primary); transition: background var(--transition-fast);';

      const icon = document.createElement('span');
      icon.style.cssText = 'font-size: 13px; color: var(--text-muted);';
      icon.textContent = '\u25B8';
      item.appendChild(icon);

      const label = document.createElement('span');
      label.textContent = shell;
      item.appendChild(label);

      item.addEventListener('mouseenter', () => {
        item.style.background = 'var(--bg-hover)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = '';
      });
      item.addEventListener('click', () => {
        this.onSelect(shell);
        this.hide();
      });

      this.el.appendChild(item);
    }

    document.body.appendChild(this.el);

    this.outsideClickHandler = (e: MouseEvent) => {
      if (!this.el.contains(e.target as Node) && !this.anchorEl.contains(e.target as Node)) {
        this.hide();
      }
    };

    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.hide();
    };
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    const rect = this.anchorEl.getBoundingClientRect();
    this.el.style.top = `${rect.bottom + 4}px`;
    this.el.style.right = `${window.innerWidth - rect.right}px`;
    this.el.style.left = 'auto';
    this.el.style.display = 'block';
    this.visible = true;

    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler);
      document.addEventListener('keydown', this.escapeHandler);
    }, 0);
  }

  hide(): void {
    this.el.style.display = 'none';
    this.visible = false;
    document.removeEventListener('click', this.outsideClickHandler);
    document.removeEventListener('keydown', this.escapeHandler);
  }
}
```

- [ ] **Step 2: Build and verify**

Run: `pnpm build 2>&1 | tail -5`
Expected: Build succeeds (unused import is fine — it gets wired in Task 6).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/bottom-panel/terminal-dropdown.ts
git commit -m "feat(terminal): add TerminalDropdown shell picker component"
```

---

### Task 4: Create TerminalContextMenu component

**Files:**
- Create: `apps/desktop/src/renderer/bottom-panel/terminal-context-menu.ts`

A floating context menu with all `...` menu actions.

- [ ] **Step 1: Create the context menu component**

Create `apps/desktop/src/renderer/bottom-panel/terminal-context-menu.ts`:

```typescript
interface ContextMenuActions {
  onRename: () => void;
  onChangeCwd: () => void;
  onClear: () => void;
  onKill: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onSelectDefaultShell: () => void;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action: () => void;
  separatorAfter?: boolean;
}

export class TerminalContextMenu {
  private el: HTMLElement;
  private anchorEl: HTMLElement;
  private visible = false;
  private outsideClickHandler: (e: MouseEvent) => void;
  private escapeHandler: (e: KeyboardEvent) => void;

  constructor(anchorEl: HTMLElement, actions: ContextMenuActions) {
    this.anchorEl = anchorEl;

    const items: MenuItem[] = [
      { label: 'Rename Terminal', action: actions.onRename },
      { label: 'Change Working Directory', action: actions.onChangeCwd },
      { label: 'Clear Terminal', shortcut: '\u2318K', action: actions.onClear },
      { label: 'Kill Terminal', action: actions.onKill, separatorAfter: true },
      { label: 'Copy', shortcut: '\u2318C', action: actions.onCopy },
      { label: 'Paste', shortcut: '\u2318V', action: actions.onPaste, separatorAfter: true },
      { label: 'Select Default Shell', action: actions.onSelectDefaultShell },
    ];

    this.el = document.createElement('div');
    this.el.className = 'terminal-context-menu';
    this.el.style.cssText = 'position: fixed; z-index: 1000; display: none; min-width: 200px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); overflow: hidden; font-size: 12px; padding: 4px 0;';

    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'terminal-context-menu-item';
      row.style.cssText = 'padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; color: var(--text-primary); transition: background var(--transition-fast);';

      const label = document.createElement('span');
      label.textContent = item.label;
      row.appendChild(label);

      if (item.shortcut) {
        const shortcut = document.createElement('span');
        shortcut.textContent = item.shortcut;
        shortcut.style.cssText = 'color: var(--text-muted); font-size: 11px; margin-left: 24px;';
        row.appendChild(shortcut);
      }

      row.addEventListener('mouseenter', () => {
        row.style.background = 'var(--bg-hover)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = '';
      });
      row.addEventListener('click', () => {
        item.action();
        this.hide();
      });

      this.el.appendChild(row);

      if (item.separatorAfter) {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: var(--border); margin: 4px 0;';
        this.el.appendChild(sep);
      }
    }

    document.body.appendChild(this.el);

    this.outsideClickHandler = (e: MouseEvent) => {
      if (!this.el.contains(e.target as Node) && !this.anchorEl.contains(e.target as Node)) {
        this.hide();
      }
    };

    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.hide();
    };
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    const rect = this.anchorEl.getBoundingClientRect();
    this.el.style.top = `${rect.bottom + 4}px`;
    this.el.style.right = `${window.innerWidth - rect.right}px`;
    this.el.style.left = 'auto';
    this.el.style.display = 'block';
    this.visible = true;

    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler);
      document.addEventListener('keydown', this.escapeHandler);
    }, 0);
  }

  hide(): void {
    this.el.style.display = 'none';
    this.visible = false;
    document.removeEventListener('click', this.outsideClickHandler);
    document.removeEventListener('keydown', this.escapeHandler);
  }
}
```

- [ ] **Step 2: Build and verify**

Run: `pnpm build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/bottom-panel/terminal-context-menu.ts
git commit -m "feat(terminal): add TerminalContextMenu component"
```

---

### Task 5: Create TerminalInstancesPanel component

**Files:**
- Create: `apps/desktop/src/renderer/bottom-panel/terminal-instances-panel.ts`

Right sidebar listing all terminal instances. Auto-shows at 2+ terminals, auto-hides at 1.

- [ ] **Step 1: Create the instances panel component**

Create `apps/desktop/src/renderer/bottom-panel/terminal-instances-panel.ts`:

```typescript
interface TerminalInstanceInfo {
  id: string;
  shellName: string;
  workspaceName: string;
  el: HTMLElement;
}

interface InstancesPanelCallbacks {
  onSwitch: (id: string) => void;
  onKill: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export class TerminalInstancesPanel {
  private el: HTMLElement;
  private listEl: HTMLElement;
  private instances: TerminalInstanceInfo[] = [];
  private activeId: string | null = null;
  private callbacks: InstancesPanelCallbacks;

  constructor(container: HTMLElement, callbacks: InstancesPanelCallbacks) {
    this.el = container;
    this.callbacks = callbacks;

    this.el.style.cssText = 'width: 200px; background: var(--bg-secondary); border-left: 1px solid var(--border); overflow-y: auto; flex-shrink: 0; display: none;';

    this.listEl = document.createElement('div');
    this.listEl.style.cssText = 'padding: 4px 0;';
    this.el.appendChild(this.listEl);
  }

  addInstance(id: string, shellName: string, workspaceName: string): void {
    const row = document.createElement('div');
    row.className = 'terminal-instance';
    row.dataset.id = id;
    row.style.cssText = 'height: 28px; padding: 0 8px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: background var(--transition-fast); position: relative; border-left: 2px solid transparent;';

    // Icon
    const icon = document.createElement('span');
    icon.style.cssText = 'font-size: 13px; color: var(--text-muted); flex-shrink: 0;';
    icon.textContent = '\u25B8';
    row.appendChild(icon);

    // Info container
    const info = document.createElement('div');
    info.className = 'terminal-instance-info';
    info.style.cssText = 'flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px;';

    const nameEl = document.createElement('span');
    nameEl.className = 'terminal-instance-name';
    nameEl.style.cssText = 'font-size: 12px; color: var(--text-primary); font-weight: 500; white-space: nowrap;';
    nameEl.textContent = shellName;
    info.appendChild(nameEl);

    const wsEl = document.createElement('span');
    wsEl.className = 'terminal-instance-workspace';
    wsEl.style.cssText = 'font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    wsEl.textContent = workspaceName;
    info.appendChild(wsEl);

    row.appendChild(info);

    // Hover actions
    const actions = document.createElement('div');
    actions.className = 'terminal-instance-actions';
    actions.style.cssText = 'display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity var(--transition-fast); flex-shrink: 0;';

    const renameBtn = this.createInstanceAction('\u270E', 'Rename', () => {
      this.startInlineRename(id, nameEl);
    });
    actions.appendChild(renameBtn);

    const killBtn = this.createInstanceAction('\u2715', 'Kill', () => {
      this.callbacks.onKill(id);
    });
    killBtn.addEventListener('mouseenter', () => {
      killBtn.style.color = 'var(--error)';
    });
    killBtn.addEventListener('mouseleave', () => {
      killBtn.style.color = 'var(--text-muted)';
    });
    actions.appendChild(killBtn);

    row.appendChild(actions);

    // Hover to show actions
    row.addEventListener('mouseenter', () => {
      if (this.activeId !== id) {
        row.style.background = 'rgba(69, 71, 90, 0.5)';
      }
      actions.style.opacity = '1';
    });
    row.addEventListener('mouseleave', () => {
      if (this.activeId !== id) {
        row.style.background = '';
      }
      actions.style.opacity = '0';
    });

    // Click to switch
    row.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.terminal-instance-actions')) {
        this.callbacks.onSwitch(id);
      }
    });

    this.listEl.appendChild(row);
    this.instances.push({ id, shellName, workspaceName, el: row });
    this.updateVisibility();
  }

  removeInstance(id: string): void {
    const index = this.instances.findIndex(i => i.id === id);
    if (index === -1) return;
    this.instances[index].el.remove();
    this.instances.splice(index, 1);
    this.updateVisibility();
  }

  setActive(id: string): void {
    this.activeId = id;
    for (const inst of this.instances) {
      if (inst.id === id) {
        inst.el.style.background = 'var(--bg-hover)';
        inst.el.style.borderLeftColor = 'var(--accent)';
      } else {
        inst.el.style.background = '';
        inst.el.style.borderLeftColor = 'transparent';
      }
    }
  }

  renameInstance(id: string, name: string): void {
    const inst = this.instances.find(i => i.id === id);
    if (!inst) return;
    inst.shellName = name;
    const nameEl = inst.el.querySelector('.terminal-instance-name') as HTMLElement;
    if (nameEl) nameEl.textContent = name;
  }

  updateInstanceId(oldId: string, newId: string): void {
    const inst = this.instances.find(i => i.id === oldId);
    if (inst) {
      inst.id = newId;
      inst.el.dataset.id = newId;
    }
    if (this.activeId === oldId) {
      this.activeId = newId;
    }
  }

  get count(): number {
    return this.instances.length;
  }

  get isVisible(): boolean {
    return this.el.style.display !== 'none';
  }

  private updateVisibility(): void {
    if (this.instances.length >= 2) {
      this.el.style.display = 'block';
    } else {
      this.el.style.display = 'none';
    }
  }

  private createInstanceAction(icon: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.style.cssText = 'width: 18px; height: 18px; border: none; background: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 11px; padding: 0; transition: color var(--transition-fast), background var(--transition-fast);';
    btn.textContent = icon;
    btn.title = title;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'var(--bg-hover)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '';
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  private startInlineRename(id: string, nameEl: HTMLElement): void {
    const inst = this.instances.find(i => i.id === id);
    if (!inst) return;

    const currentName = inst.shellName;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.style.cssText = 'width: 80px; font-size: 12px; font-weight: 500; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--accent); border-radius: 2px; padding: 0 4px; outline: none; font-family: inherit;';

    nameEl.textContent = '';
    nameEl.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      const newName = input.value.trim() || currentName;
      nameEl.textContent = newName;
      inst.shellName = newName;
      this.callbacks.onRename(id, newName);
    };

    const cancel = () => {
      nameEl.textContent = currentName;
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });

    input.addEventListener('blur', () => {
      commit();
    });
  }
}
```

- [ ] **Step 2: Build and verify**

Run: `pnpm build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/bottom-panel/terminal-instances-panel.ts
git commit -m "feat(terminal): add TerminalInstancesPanel sidebar component"
```

---

### Task 6: Update HTML structure with new buttons and instances panel container

**Files:**
- Modify: `apps/desktop/src/renderer/index.html`

Replace the old action buttons with the new set, add instances panel container.

- [ ] **Step 1: Update the bottom panel HTML**

In `apps/desktop/src/renderer/index.html`, replace the entire bottom-panel div (lines 26-38):

```html
    <div id="bottom-panel" class="hidden">
      <div id="bottom-panel-resize-handle"></div>
      <div id="bottom-panel-header">
        <span id="bottom-panel-title">TERMINAL</span>
        <div id="bottom-panel-tabs"></div>
        <div id="bottom-panel-actions">
          <button id="bottom-panel-new-terminal" title="New Terminal">+</button>
          <button id="bottom-panel-kill-terminal" title="Kill Terminal">&#x1F5D1;</button>
          <button id="bottom-panel-close" title="Close Panel">&times;</button>
        </div>
      </div>
      <div id="bottom-panel-content"></div>
    </div>
```

with:

```html
    <div id="bottom-panel" class="hidden">
      <div id="bottom-panel-resize-handle"></div>
      <div id="bottom-panel-header">
        <span id="bottom-panel-title">TERMINAL</span>
        <div id="bottom-panel-tabs"></div>
        <div id="bottom-panel-actions">
          <button id="bp-new-terminal" title="New Terminal">+</button>
          <button id="bp-shell-dropdown" title="Launch Shell...">\u25BE</button>
          <button id="bp-context-menu" title="More Actions...">\u22EF</button>
          <button id="bp-maximize" title="Maximize Panel">\u25A1</button>
          <div class="bp-actions-separator"></div>
          <button id="bp-close" title="Close Panel">&times;</button>
        </div>
      </div>
      <div id="bottom-panel-body">
        <div id="bottom-panel-content"></div>
        <div id="bottom-panel-instances"></div>
      </div>
    </div>
```

- [ ] **Step 2: Build and verify**

Run: `pnpm build 2>&1 | tail -5`
Expected: Build succeeds. (BottomPanel queries by ID — old IDs will break; we fix that in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/index.html
git commit -m "feat(terminal): update HTML with new action buttons and instances container"
```

---

### Task 7: Rewrite BottomPanel to wire all new components

**Files:**
- Modify: `apps/desktop/src/renderer/bottom-panel/bottom-panel.ts`

This is the main integration task. Replace the entire BottomPanel class to use new button IDs, wire dropdown, context menu, instances panel, maximize, and shell selection.

- [ ] **Step 1: Rewrite bottom-panel.ts**

Replace the full contents of `apps/desktop/src/renderer/bottom-panel/bottom-panel.ts` with:

```typescript
import { TerminalPanel } from '../terminal/terminal.js';
import { TerminalDropdown } from './terminal-dropdown.js';
import { TerminalContextMenu } from './terminal-context-menu.js';
import { TerminalInstancesPanel } from './terminal-instances-panel.js';

interface TerminalTab {
  id: string;
  name: string;
  shellName: string;
  panel: TerminalPanel;
  containerEl: HTMLElement;
  tabEl: HTMLElement;
}

export class BottomPanel {
  private el: HTMLElement;
  private bodyEl: HTMLElement;
  private contentEl: HTMLElement;
  private resizeHandle: HTMLElement;
  private closeBtn: HTMLElement;
  private newBtn: HTMLElement;
  private tabStrip: HTMLElement;
  private tabs: TerminalTab[] = [];
  private activeTabId: string | null = null;
  private visible = false;
  private shellNameCounts: Map<string, number> = new Map();
  private maximized = false;
  private savedHeight: string = '';
  private dropdown: TerminalDropdown;
  private contextMenu: TerminalContextMenu;
  private instancesPanel: TerminalInstancesPanel;

  constructor(el: HTMLElement) {
    this.el = el;
    this.bodyEl = el.querySelector('#bottom-panel-body')!;
    this.contentEl = el.querySelector('#bottom-panel-content')!;
    this.resizeHandle = el.querySelector('#bottom-panel-resize-handle')!;
    this.closeBtn = el.querySelector('#bp-close')!;
    this.newBtn = el.querySelector('#bp-new-terminal')!;
    this.tabStrip = el.querySelector('#bottom-panel-tabs')!;

    const dropdownBtn = el.querySelector('#bp-shell-dropdown')! as HTMLElement;
    const contextMenuBtn = el.querySelector('#bp-context-menu')! as HTMLElement;
    const maximizeBtn = el.querySelector('#bp-maximize')! as HTMLElement;

    this.closeBtn.addEventListener('click', () => this.hide());
    this.newBtn.addEventListener('click', () => this.createNewTerminal());

    // Maximize toggle
    maximizeBtn.addEventListener('click', () => {
      this.maximized = !this.maximized;
      if (this.maximized) {
        this.savedHeight = this.el.style.height || '';
        this.el.style.height = '70vh';
        maximizeBtn.textContent = '\u25A3';
        maximizeBtn.title = 'Restore Panel';
      } else {
        this.el.style.height = this.savedHeight || '280px';
        maximizeBtn.textContent = '\u25A1';
        maximizeBtn.title = 'Maximize Panel';
      }
      // Refit active terminal
      if (this.activeTabId) {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab) requestAnimationFrame(() => tab.panel.fit());
      }
    });

    // Shell dropdown
    this.dropdown = new TerminalDropdown(dropdownBtn, (shell) => {
      this.createNewTerminal(shell);
    });
    dropdownBtn.addEventListener('click', () => this.dropdown.toggle());

    // Context menu
    this.contextMenu = new TerminalContextMenu(contextMenuBtn, {
      onRename: () => this.renameActiveTerminal(),
      onChangeCwd: () => this.changeCwd(),
      onClear: () => this.clearActiveTerminal(),
      onKill: () => this.killActiveTerminal(),
      onCopy: () => this.copySelection(),
      onPaste: () => this.pasteToTerminal(),
      onSelectDefaultShell: () => this.selectDefaultShell(),
    });
    contextMenuBtn.addEventListener('click', () => this.contextMenu.toggle());

    // Instances panel
    const instancesEl = el.querySelector('#bottom-panel-instances')! as HTMLElement;
    this.instancesPanel = new TerminalInstancesPanel(instancesEl, {
      onSwitch: (id) => this.switchTab(id),
      onKill: (id) => this.killTerminal(id),
      onRename: (id, name) => this.updateTabName(id, name),
    });

    this.setupResize();
  }

  toggle(): void {
    if (this.visible) { this.hide(); } else { this.show(); }
  }

  show(): void {
    this.el.classList.remove('hidden');
    this.visible = true;

    if (this.tabs.length === 0) {
      this.createNewTerminal();
    } else if (this.activeTabId) {
      const tab = this.tabs.find(t => t.id === this.activeTabId);
      if (tab) { tab.panel.fit(); tab.panel.focus(); }
    }
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.visible = false;
  }

  get isVisible(): boolean { return this.visible; }

  createNewTerminal(shell?: string): void {
    const shellName = shell || this.getDefaultShell();
    const displayName = this.generateDisplayName(shellName);

    // Create container
    const containerEl = document.createElement('div');
    containerEl.className = 'terminal-container';
    containerEl.style.display = 'none';
    this.contentEl.appendChild(containerEl);

    const panel = new TerminalPanel(containerEl);

    // Create tab element
    const tabEl = document.createElement('div');
    tabEl.className = 'terminal-tab';

    const tabName = document.createElement('span');
    tabName.className = 'terminal-tab-name';
    tabName.textContent = displayName;

    const tabClose = document.createElement('button');
    tabClose.className = 'terminal-tab-close';
    tabClose.textContent = '\u00D7';
    tabClose.title = 'Kill Terminal';

    tabEl.appendChild(tabName);
    tabEl.appendChild(tabClose);
    this.tabStrip.appendChild(tabEl);

    const tempId = `pending-${Date.now()}`;
    const workspaceName = this.getWorkspaceName();

    const tab: TerminalTab = { id: tempId, name: displayName, shellName, panel, containerEl, tabEl };
    this.tabs.push(tab);

    // Add to instances panel
    this.instancesPanel.addInstance(tempId, displayName, workspaceName);

    // Tab click handlers
    tabEl.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).classList.contains('terminal-tab-close')) {
        this.switchTab(tab.id);
      }
    });
    tabClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.killTerminal(tab.id);
    });

    // Switch to new tab
    this.switchTab(tab.id);
    this.updateTabStripVisibility();

    // Init terminal with shell option
    panel.init({ shell: shellName }).then(() => {
      const sessionId = panel.getSessionId();
      if (sessionId) {
        const oldId = tab.id;
        tab.id = sessionId;
        if (this.activeTabId === oldId) this.activeTabId = sessionId;
        this.instancesPanel.updateInstanceId(oldId, sessionId);

        // Re-bind click handlers with real ID
        tabEl.onclick = null;
        tabEl.addEventListener('click', (e) => {
          if (!(e.target as HTMLElement).classList.contains('terminal-tab-close')) {
            this.switchTab(sessionId);
          }
        });
        tabClose.onclick = null;
        tabClose.addEventListener('click', (e) => {
          e.stopPropagation();
          this.killTerminal(sessionId);
        });
      }
    }).catch(() => {});
  }

  killActiveTerminal(): void {
    if (this.activeTabId) this.killTerminal(this.activeTabId);
  }

  private killTerminal(id: string): void {
    const index = this.tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    const tab = this.tabs[index];
    tab.panel.dispose();
    tab.containerEl.remove();
    tab.tabEl.remove();
    this.tabs.splice(index, 1);
    this.instancesPanel.removeInstance(id);

    if (this.tabs.length === 0) {
      this.activeTabId = null;
      this.shellNameCounts.clear();
      this.hide();
    } else if (this.activeTabId === id) {
      const newIndex = Math.min(index, this.tabs.length - 1);
      this.switchTab(this.tabs[newIndex].id);
    }
    this.updateTabStripVisibility();
  }

  private switchTab(id: string): void {
    this.activeTabId = id;
    this.instancesPanel.setActive(id);

    for (const tab of this.tabs) {
      const isActive = tab.id === id;
      tab.containerEl.style.display = isActive ? 'block' : 'none';
      tab.tabEl.classList.toggle('active', isActive);

      if (isActive) {
        requestAnimationFrame(() => { tab.panel.fit(); tab.panel.focus(); });
      }
    }
  }

  private updateTabStripVisibility(): void {
    // Show tab strip only when instances panel is hidden (1 or fewer terminals)
    this.tabStrip.style.display = this.instancesPanel.isVisible ? 'none' : 'flex';
  }

  private updateTabName(id: string, name: string): void {
    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return;
    tab.name = name;
    const nameEl = tab.tabEl.querySelector('.terminal-tab-name') as HTMLElement;
    if (nameEl) nameEl.textContent = name;
  }

  private renameActiveTerminal(): void {
    if (!this.activeTabId) return;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) return;

    // If instances panel is visible, rename happens there
    if (this.instancesPanel.isVisible) {
      const nameEl = tab.tabEl.querySelector('.terminal-tab-name') as HTMLElement;
      // Trigger rename in instances panel by simulating pencil click
      const instNameEl = document.querySelector(`.terminal-instance[data-id="${tab.id}"] .terminal-instance-name`) as HTMLElement;
      if (instNameEl) {
        const renameBtn = document.querySelector(`.terminal-instance[data-id="${tab.id}"] button[title="Rename"]`) as HTMLButtonElement;
        if (renameBtn) renameBtn.click();
      }
    } else {
      // Inline rename on tab pill
      const nameEl = tab.tabEl.querySelector('.terminal-tab-name') as HTMLElement;
      if (!nameEl) return;
      const currentName = tab.name;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentName;
      input.style.cssText = 'width: 60px; font-size: 11px; font-weight: 500; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--accent); border-radius: 2px; padding: 0 4px; outline: none; font-family: inherit;';
      nameEl.textContent = '';
      nameEl.appendChild(input);
      input.focus();
      input.select();

      const commit = () => {
        const newName = input.value.trim() || currentName;
        nameEl.textContent = newName;
        tab.name = newName;
        this.instancesPanel.renameInstance(tab.id, newName);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); nameEl.textContent = currentName; }
      });
      input.addEventListener('blur', () => commit());
    }
  }

  private async changeCwd(): Promise<void> {
    const path = await (window as any).pmOs.dialog.openDirectory();
    if (path && this.activeTabId) {
      const tab = this.tabs.find(t => t.id === this.activeTabId);
      if (tab) tab.panel.writeText(`cd "${path}"\r`);
    }
  }

  private clearActiveTerminal(): void {
    if (!this.activeTabId) return;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab) tab.panel.clear();
  }

  private async copySelection(): Promise<void> {
    if (!this.activeTabId) return;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab) {
      const sel = tab.panel.getSelection();
      if (sel) await navigator.clipboard.writeText(sel);
    }
  }

  private async pasteToTerminal(): Promise<void> {
    if (!this.activeTabId) return;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab) {
      const text = await navigator.clipboard.readText();
      if (text) tab.panel.writeText(text);
    }
  }

  private selectDefaultShell(): void {
    const current = localStorage.getItem('pm-os-default-shell') || 'zsh';
    const next = current === 'zsh' ? 'bash' : 'zsh';
    localStorage.setItem('pm-os-default-shell', next);
  }

  private getDefaultShell(): string {
    return localStorage.getItem('pm-os-default-shell') || this.getShellName();
  }

  private getShellName(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac') || userAgent.includes('darwin')) return 'zsh';
    return 'bash';
  }

  private getWorkspaceName(): string {
    try {
      const name = (window as any).pmOs?.workspace?.getName?.();
      if (name && typeof name.then === 'function') return 'PMOS';
      return name || 'PMOS';
    } catch { return 'PMOS'; }
  }

  private generateDisplayName(shellName: string): string {
    const count = (this.shellNameCounts.get(shellName) || 0) + 1;
    this.shellNameCounts.set(shellName, count);
    return count === 1 ? shellName : `${shellName} (${count})`;
  }

  private setupResize(): void {
    let startY = 0;
    let startHeight = 0;

    const onMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight * 0.7, startHeight + delta));
      this.el.style.height = `${newHeight}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (this.activeTabId) {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab) tab.panel.fit();
      }
    };

    this.resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      startY = e.clientY;
      startHeight = this.el.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }
}
```

- [ ] **Step 2: Build and verify**

Run: `pnpm build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/bottom-panel/bottom-panel.ts
git commit -m "feat(terminal): rewrite BottomPanel with dropdown, context menu, instances panel, maximize"
```

---

### Task 8: Update CSS with new styles and visual polish

**Files:**
- Modify: `apps/desktop/src/renderer/terminal/terminal.css`
- Modify: `apps/desktop/src/renderer/styles/layout.css`

Update header height, add new button styles, instances panel styles, separator styles.

- [ ] **Step 1: Update layout.css header height**

In `apps/desktop/src/renderer/styles/layout.css`, change lines 186-187:
```css
#bottom-panel-header {
  height: 30px;
  min-height: 30px;
```
to:
```css
#bottom-panel-header {
  height: 35px;
  min-height: 35px;
```

And add after `#bottom-panel-content` (after line 211):
```css
#bottom-panel-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

#bottom-panel-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}
```

Wait — `#bottom-panel-content` already exists at line 207. We need to remove the old one and make the new `#bottom-panel-body` the flex container. Let me be precise:

Replace lines 207-210:
```css
#bottom-panel-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}
```
with:
```css
#bottom-panel-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

#bottom-panel-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}
```

- [ ] **Step 2: Update terminal.css with new button IDs and styles**

In `apps/desktop/src/renderer/terminal/terminal.css`, replace the entire `/* ─── Action Buttons ─── */` section (lines 118-175) with:

```css
/* ─── Action Buttons ─── */
#bottom-panel-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

#bottom-panel-actions button {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  padding: 0;
  transition: color var(--transition-fast),
              background var(--transition-fast),
              transform var(--transition-fast);
}

#bottom-panel-actions button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

#bottom-panel-actions button:active {
  transform: scale(0.95);
}

#bp-new-terminal {
  font-size: 16px !important;
  color: var(--accent) !important;
}

#bp-new-terminal:hover {
  background: var(--accent-subtle) !important;
}

#bp-close {
  font-size: 15px !important;
}

.bp-actions-separator {
  width: 1px;
  height: 18px;
  background: var(--border);
  margin: 0 2px;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Build and verify**

Run: `pnpm build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Run tests**

Run: `pnpm test 2>&1 | grep -E "Tests|pass|fail"`
Expected: All 84 tests pass, no failures.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/terminal/terminal.css apps/desktop/src/renderer/styles/layout.css
git commit -m "feat(terminal): update CSS with new button styles, header height, and body layout"
```

---

### Task 9: Final build, test, and verify

**Files:** None (verification only)

- [ ] **Step 1: Clean build**

Run: `pnpm clean && pnpm build 2>&1 | tail -10`
Expected: All 17 packages build, zero errors.

- [ ] **Step 2: Run tests**

Run: `pnpm test 2>&1 | grep -E "Tests|pass|fail"`
Expected: All 84 tests pass.

- [ ] **Step 3: Verify all new files exist**

Run:
```bash
ls -la apps/desktop/src/renderer/bottom-panel/terminal-dropdown.ts \
       apps/desktop/src/renderer/bottom-panel/terminal-context-menu.ts \
       apps/desktop/src/renderer/bottom-panel/terminal-instances-panel.ts
```
Expected: All 3 files exist.

- [ ] **Step 4: Verify key integration points**

Run:
```bash
grep -n "TerminalDropdown\|TerminalContextMenu\|TerminalInstancesPanel" apps/desktop/src/renderer/bottom-panel/bottom-panel.ts
grep -n "bp-new-terminal\|bp-shell-dropdown\|bp-context-menu\|bp-maximize\|bp-close" apps/desktop/src/renderer/index.html
grep -n "shell" apps/desktop/src/main/ipc.ts apps/desktop/src/preload/index.ts
```

- [ ] **Step 5: Launch for manual testing**

Run: `pnpm dev`

Manual test checklist:
1. `+` creates a new terminal with default shell
2. `v` dropdown shows zsh/bash, creates terminal with chosen shell
3. `...` menu: rename, change cwd, clear, kill, copy, paste, select default shell all work
4. Maximize toggles panel height
5. Single terminal: no instances panel, tab pill in header
6. Create 2nd terminal: instances panel appears on right, header tabs disappear
7. Kill back to 1: instances panel hides, tab returns
8. Click instance row: switches terminal
9. Hover instance row: action icons appear (rename, kill)
10. Rename editing works (Enter confirms, Escape cancels)
