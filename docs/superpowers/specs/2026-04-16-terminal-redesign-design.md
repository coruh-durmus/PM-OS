# Terminal Redesign: VS Code-style UX

## Context

The PMOS terminal works (xterm.js + node-pty + tmux fallback) but has a basic UI compared to VS Code. The goal is to match VS Code's terminal UX — specifically the instances sidebar, richer action buttons, and visual polish — while keeping the existing PTY/IPC architecture unchanged.

## Scope

**In scope (user-selected):**
- A) Right-side terminal instances panel (auto-shows at 2+ terminals)
- D) More action buttons (shell dropdown, context menu, split, maximize)
- E) Visual polish (VS Code-matching spacing, icons, hover states)

**Out of scope:**
- Top tab bar with Problems/Output/Debug Console/Ports sections
- True side-by-side split terminal rendering (split button creates a new terminal for now)

## Architecture

### Component Structure (Approach 2: Component Extraction)

New components plug into the existing `BottomPanel` class. PTY manager, IPC, and preload get a minor extension (shell type option) but no structural changes.

```
BottomPanel (existing, modified)
  |
  +-- Header (modified layout)
  |     +-- "TERMINAL" label
  |     +-- Tab pills (visible when instances panel hidden, i.e. single terminal)
  |     +-- Action buttons: [+] [v] [...] [split] [maximize] [x]
  |
  +-- Content area (existing)
  |     +-- Terminal containers (xterm.js instances)
  |
  +-- TerminalInstancesPanel (NEW, right sidebar)
        +-- Instance rows (click to switch, hover for actions)
```

### Files to Create

| File | Component | Purpose |
|------|-----------|---------|
| `renderer/bottom-panel/terminal-instances-panel.ts` | `TerminalInstancesPanel` | Right sidebar listing all terminal instances |
| `renderer/bottom-panel/terminal-dropdown.ts` | `TerminalDropdown` | Shell picker dropdown (zsh/bash) |
| `renderer/bottom-panel/terminal-context-menu.ts` | `TerminalContextMenu` | `...` button menu (rename, clear, kill, etc.) |

### Files to Modify

| File | Changes |
|------|---------|
| `renderer/bottom-panel/bottom-panel.ts` | New header buttons, wire dropdown/menu/instances panel, maximize toggle, shell type param |
| `renderer/terminal/terminal.ts` | Accept shell type option, expose `clear()` method, support rename |
| `renderer/terminal/terminal.css` | Updated button styles, instances panel styles, polish |
| `renderer/styles/layout.css` | Header height 30px -> 35px, instances panel layout |
| `renderer/index.html` | Add instances panel container div, update action buttons |
| `main/pty-manager.ts` | Accept shell override param (currently hardcoded to platform default) |
| `main/ipc.ts` | Pass shell option through `terminal:create` |
| `preload/index.ts` | Extend `create()` options type with `shell` param |

## Detailed Design

### 1. Terminal Header

**Layout:** `[TERMINAL] [tabs] ---- [+][v][...][split][max][x]`

**Current structure (index.html):**
```html
<div id="bottom-panel-header">
  <span id="bottom-panel-title">TERMINAL</span>
  <div id="bottom-panel-tabs"></div>
  <div id="bottom-panel-actions">
    <button id="bottom-panel-new-terminal" title="New Terminal">+</button>
    <button id="bottom-panel-kill-terminal" title="Kill Terminal">trash</button>
    <button id="bottom-panel-close" title="Close Panel">x</button>
  </div>
</div>
```

**New structure:**
```html
<div id="bottom-panel-header">
  <span id="bottom-panel-title">TERMINAL</span>
  <div id="bottom-panel-tabs"></div>
  <div id="bottom-panel-actions">
    <button id="bp-new-terminal" title="New Terminal">+</button>
    <button id="bp-shell-dropdown" title="Launch Shell...">v</button>
    <button id="bp-context-menu" title="More Actions...">...</button>
    <button id="bp-split" title="Split Terminal">split-icon</button>
    <button id="bp-maximize" title="Maximize Panel">max-icon</button>
    <div class="bp-actions-separator"></div>
    <button id="bp-close" title="Close Panel">x</button>
  </div>
</div>
```

**Button behaviors:**
- `+` — Creates terminal with default shell (zsh unless user changed default)
- `v` — Opens TerminalDropdown (zsh, bash)
- `...` — Opens TerminalContextMenu
- Split — Creates new terminal (same as `+`; visual distinction for future split support)
- Maximize — Toggles panel height between current and 70vh; icon changes between `□` and `⊡`
- `x` — Hides panel (unchanged)

**Kill button removed** from header. Kill is now in the `...` context menu.

### 2. Terminal Instances Panel

**Class:** `TerminalInstancesPanel`

**Visibility:**
- Hidden when 0-1 terminals exist
- Auto-appears when 2nd terminal is created
- Auto-hides when terminal count drops back to 1
- When hidden, header tabs are visible (single terminal tab pill)
- When visible, header tabs are hidden (instances panel replaces them)

**Layout:**
- Docked to the right inside `#bottom-panel`
- Width: 200px
- Background: `var(--bg-secondary)`
- Border-left: `1px solid var(--border)`
- Content area shrinks to accommodate: `calc(100% - 200px)` width

**API:**
```typescript
class TerminalInstancesPanel {
  private el: HTMLElement;
  private instances: TerminalInstanceInfo[];
  private activeId: string | null;
  private onSwitch: (id: string) => void;
  private onKill: (id: string) => void;
  private onRename: (id: string, name: string) => void;

  constructor(container: HTMLElement, callbacks: {
    onSwitch: (id: string) => void;
    onKill: (id: string) => void;
    onRename: (id: string, name: string) => void;
  });

  addInstance(id: string, shellName: string, workspaceName: string): void;
  removeInstance(id: string): void;
  setActive(id: string): void;
  renameInstance(id: string, name: string): void;

  get count(): number;
  get isVisible(): boolean;

  show(): void;
  hide(): void;
}

interface TerminalInstanceInfo {
  id: string;
  shellName: string;      // "zsh", "bash", or user-renamed
  workspaceName: string;   // workspace folder name
}
```

**Instance row DOM:**
```
<div class="terminal-instance" data-id="...">
  <span class="terminal-instance-icon">icon</span>
  <div class="terminal-instance-info">
    <span class="terminal-instance-name">zsh</span>
    <span class="terminal-instance-workspace">PMOS</span>
  </div>
  <div class="terminal-instance-actions"> <!-- visible on hover -->
    <button class="ti-rename" title="Rename">pencil</button>
    <button class="ti-split" title="Split">split</button>
    <button class="ti-kill" title="Kill">trash</button>
  </div>
</div>
```

**Active state:** `var(--bg-hover)` background + 2px `var(--accent)` left border.

**Hover state (non-active):** `var(--bg-hover)` at 50% opacity. Action icons fade in on hover.

**Rename flow:** Click rename icon -> instance name becomes an inline `<input>` -> Enter confirms, Escape cancels.

### 3. Shell Dropdown

**Class:** `TerminalDropdown`

```typescript
class TerminalDropdown {
  constructor(anchorEl: HTMLElement, onSelect: (shell: string) => void);
  show(): void;
  hide(): void;
  toggle(): void;
}
```

**Menu items:**
- Terminal icon + "zsh"
- Terminal icon + "bash"

**Positioning:** Anchored below `#bp-shell-dropdown`, aligned to button's right edge.

**Styling:**
- Background: `var(--bg-surface)`
- Border: `1px solid var(--border)`
- Border-radius: `var(--radius-sm)` (4px)
- Box-shadow: `var(--shadow-lg)`
- Min-width: 140px
- Item padding: 6px 12px
- Item hover: `var(--bg-hover)`
- Font: 12px

**Dismiss:** Click item, click outside, Escape key.

### 4. Context Menu

**Class:** `TerminalContextMenu`

```typescript
class TerminalContextMenu {
  constructor(anchorEl: HTMLElement, actions: {
    onRename: () => void;
    onChangeCwd: () => void;
    onClear: () => void;
    onKill: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onSelectDefaultShell: () => void;
  });
  show(): void;
  hide(): void;
  toggle(): void;
}
```

**Menu items:**
| Label | Shortcut | Separator after? |
|-------|----------|-----------------|
| Rename Terminal | — | no |
| Change Working Directory | — | no |
| Clear Terminal | `Cmd+K` | no |
| Kill Terminal | — | yes |
| Copy | `Cmd+C` | no |
| Paste | `Cmd+V` | yes |
| Select Default Shell | — | no |

**Separator:** 1px `var(--border)` horizontal line with 4px vertical margin.

**Shortcut display:** Right-aligned, `var(--text-muted)`, 11px font.

**Positioning & styling:** Same pattern as TerminalDropdown.

**Action implementations:**
- Rename: Triggers inline rename in instances panel (or tab pill if single terminal)
- Change CWD: Opens `window.pmOs.dialog.openDirectory()`, then writes `cd "path"\r` to terminal
- Clear: Writes `\x0c` (form feed / Ctrl+L) to active terminal
- Kill: Kills active terminal (calls `dispose()`)
- Copy: Reads xterm selection via `terminal.getSelection()`, writes to clipboard
- Paste: Reads clipboard, writes to terminal
- Select Default Shell: Stores preference in localStorage, used by `+` button

### 5. Visual Polish

**Header (35px height):**
- Increase from 30px to 35px for breathing room
- All action buttons: 28x28px hit area, 16px icon content
- Button default: `var(--text-muted)`, no background
- Button hover: `var(--text-primary)`, `var(--bg-hover)` background, `var(--radius-sm)` corners
- Button active (pressed): scale 0.95
- 4px gap between buttons
- 1px `var(--border)` vertical separator before close `x` button
- Buttons use SVG-like text icons or Unicode symbols for consistency

**Tab pills (single-terminal mode):**
- Active: `var(--text-primary)` text, 2px `var(--accent)` bottom bar, no background tint
- Inactive: `var(--text-muted)` text
- Close `x`: appears on hover only, 14px, rounds to error-red on hover
- Font: 12px medium weight (active), regular (inactive)

**Instances panel rows:**
- Height: 28px
- Icon: monospace terminal glyph, 14px, `var(--text-muted)`
- Shell name: 12px, `var(--text-primary)`, font-weight 500
- Workspace label: 11px, `var(--text-muted)`
- Hover action icons: 14px, fade in 120ms transition
- Active: `var(--bg-hover)` + 2px left `var(--accent)` border
- Non-active hover: lighter `var(--bg-hover)` at reduced opacity

### 6. IPC & PTY Changes

**PtyManager.create() modification:**
```typescript
// Current:
create(options?: { cwd?: string }): string

// New:
create(options?: { cwd?: string; shell?: string }): string
```

When `shell` is provided ("zsh" or "bash"), use it instead of the platform default. The shell path is resolved: "zsh" -> `/bin/zsh`, "bash" -> `/bin/bash`.

**Preload API extension:**
```typescript
// Current:
create(options?: { cwd?: string }): Promise<string | null>

// New:
create(options?: { cwd?: string; shell?: string }): Promise<string | null>
```

**IPC handler:** Passes `shell` through to PtyManager.

### 7. Keyboard Shortcuts

| Shortcut | Action | New? |
|----------|--------|------|
| `Ctrl+`` | Toggle terminal panel | Existing |
| `Ctrl+Shift+`` | New terminal + show panel | Existing |
| `Cmd+K` (in terminal) | Clear terminal | New |

### 8. State Persistence

- **Default shell preference:** `localStorage.setItem('pm-os-default-shell', 'zsh')` — read by `+` button
- **Terminal names:** In-memory only (lost on restart, like VS Code)
- **Maximize state:** In-memory only

## Component Dependency Order

```
1. PtyManager + IPC + Preload (shell option) -- foundation
2. TerminalDropdown + TerminalContextMenu -- independent UI components
3. TerminalInstancesPanel -- depends on BottomPanel API
4. BottomPanel modifications -- wires everything together
5. CSS + HTML updates -- visual layer
```

## Verification Plan

1. `pnpm build` succeeds
2. `pnpm test` passes (no regressions)
3. Launch with `pnpm dev`:
   - `+` creates a new terminal with default shell
   - `v` dropdown shows zsh/bash, creates terminal with chosen shell
   - `...` menu: rename, change cwd, clear, kill, copy, paste, select default shell all work
   - Maximize toggles panel height
   - Single terminal: no instances panel, tab in header
   - Create 2nd terminal: instances panel appears on right, header tabs disappear
   - Kill terminals back to 1: instances panel disappears, tab returns to header
   - Click instance row: switches terminal
   - Hover instance row: action icons appear (rename, split, kill)
   - Rename inline editing works (Enter confirms, Escape cancels)
   - Close `x` hides panel
   - `Ctrl+`` toggles, `Ctrl+Shift+`` creates new
