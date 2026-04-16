# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
pnpm install                     # Install all workspace dependencies
pnpm build                       # Build everything (packages → extensions → apps)
pnpm dev                         # Build + launch Electron app
pnpm test                        # Run all tests (~84 tests across 11 suites)
pnpm clean                       # Remove all dist/ directories

# Desktop app only (from apps/desktop/)
pnpm build:main                  # esbuild main process
pnpm build:preload               # esbuild preload
pnpm build:renderer              # esbuild renderer
pnpm build:css                   # Concatenate all CSS (variables.css first)

# Run a single extension's tests
cd extensions/project-manager && pnpm test
cd packages/event-bus && pnpm test

# Rebuild node-pty for Electron after npm updates
cd apps/desktop && npx @electron/rebuild -f -w node-pty
```

## Architecture

Custom Electron desktop app (Electron 41+, Chromium 146+) with a plugin-based extension system. Three layers communicate via IPC:

**Main Process** → manages Electron windows, WebContentsView panels, PTY terminals, file system, git, workspace state, notifications, session sync
**Preload** → `contextBridge` exposes `window.pmOs` API (wcv, terminal, project, fs, workspace, git, mcp, notifications, dialog, settings)
**Renderer** → single-page app with activity bar, panel container, bottom panel (multi-terminal), command palette, browser sidebar, theme system

### Monorepo Layout

- `packages/types` — shared TypeScript interfaces (`Extension`, `EventMap`, `PanelApi`, `ProjectConfig`, etc.)
- `packages/event-bus` — typed pub/sub with `Disposable` pattern
- `packages/claude` — Anthropic SDK wrapper with `SummaryCache` (TTL+LRU) and `CostTracker`
- `apps/desktop` — Electron shell (main + preload + renderer)
- `apps/auth-backend` — Hono OAuth service (PostgreSQL, Docker)
- `extensions/*` — 11 extensions loaded dynamically by `ExtensionHost`

### WebContentsView Panels

External sites (Slack, Notion, Figma, Gmail, Jira, Confluence, Calendar) are embedded via Electron's `WebContentsView` — not iframes (which are blocked by `X-Frame-Options: DENY`). Each panel gets a `persist:${id}` partition for session cookies. The user-agent is stripped of "Electron/" and app name to prevent sites from serving unsupported APIs like FedCM. Google auth cookies are automatically synced across all panel sessions via `SessionSync`.

### Session Sync

`SessionSync` (`src/main/session-sync.ts`) listens for cookie changes on Google auth domains (`.google.com`, `accounts.google.com`, `.googleapis.com`, etc.) and replicates them across all panel session partitions. A `syncing` flag prevents infinite replication loops. Only cookie sets are replicated — not removals — to avoid logout cascades.

### Extension System

Extensions export `{ activate(context), deactivate?() }`. The `ExtensionHost` scans `extensions/*/package.json`, reads `main`, calls `require()` (CJS). Extensions must bundle as CJS format (`--format=cjs` or default for `--platform=node`). Never set `"type": "module"` in extension `package.json`.

### IPC Pattern

All renderer↔main communication goes through the preload bridge:
- **Main:** `ipcMain.handle('channel:name', handler)` for request-response
- **Main:** `window.webContents.send('channel:name', data)` for events
- **Preload:** `ipcRenderer.invoke(...)` and `ipcRenderer.on(...)` exposed via `contextBridge`
- **Renderer:** `window.pmOs.namespace.method()`

New IPC requires changes in three files: `ipc.ts` (handler), `preload/index.ts` (bridge), renderer code (consumer).

### Terminal

Multi-terminal support (VS Code-style). `PtyManager` spawns tmux sessions (`tmux new-session -A -s pm-os-N`) with fallback to raw shell. Renderer uses `@xterm/xterm` with `FitAddon`. Bottom panel manages multiple terminal tabs with create/kill/switch. Killing the last terminal hides the panel; reopening creates a fresh one. `Ctrl+`` toggles panel, `Ctrl+Shift+`` creates new terminal.

### Browser Sidebar

Arc-style vertical sidebar for the Browser panel with bookmarks, folders, tabs, drag-and-drop reordering. Toggles with `Cmd+B`. Persisted in localStorage (`pm-os-bookmarks-v2`).

### Workspace & Projects

Projects require an open workspace — both UI and backend (`project:create` IPC) enforce this. Welcome screen shows "Open Workspace" CTA when no workspace is selected, just "PMOS" logo when one is open. Onboarding flag persisted in Electron's `userData` directory (survives restarts, removed on uninstall).

## Key Conventions

- **Build tool:** esbuild for all bundles. Main/preload: `--platform=node --external:electron --external:node-pty`. Renderer: `--platform=browser`. CSS: concatenated via `cat` (variables.css must be first).
- **TypeScript:** `ES2022` target, `bundler` module resolution, `strict` mode. All packages extend `tsconfig.base.json`.
- **Testing:** Vitest. Tests live in `src/__tests__/`. Packages without tests use `--passWithNoTests`.
- **Events:** Strongly typed via `EventMap` in `packages/types/src/events.ts`. Use `EventBus.on()` which returns a `Disposable`.
- **Theming:** CSS custom properties (45+ design tokens including colors, shadows, transitions, spacing, blur, radii). 9 themes in `renderer/themes/themes.ts`. Persisted in `localStorage`.
- **Design tokens:** Use CSS variables from `variables.css` — never hardcode colors, shadows, or transitions. Includes `--error-subtle`, `--accent-subtle`, `--accent-muted` for transparent tints.
- **Safe logging:** Main process uses `safeLog`/`safeError` wrappers (try-catch around console calls) to prevent EPIPE crashes from broken PTY pipes.
- **Workspace projects** live in `~/pm-os-projects/` with structure: `CLAUDE.md`, `.pm-os/config.json`, `.memory/project/` (committed), `.memory/user/` (gitignored).

## Gotchas

- `node-pty` is a native module — must be rebuilt for Electron's ABI after install: `npx @electron/rebuild -f -w node-pty`
- WebContentsView user-agent must strip "Electron/" and app name or Google/Figma will serve FedCM which crashes
- Same-domain popups must be allowed in `setWindowOpenHandler` for OAuth SSO flows (e.g., `figma.com/start_google_sso`)
- Extensions are `require()`'d (CJS) — ESM format will fail with "module is not defined"
- No hot reload — extension changes require app restart
- `prompt()` and `alert()` don't work in Electron renderer — use custom inline UI elements
- WebAuthn/passkeys are not fully supported in Electron's WebContentsView
- EPIPE errors from dead PTY pipes — main process has `uncaughtException` handler that suppresses these; all logging uses `safeLog`/`safeError`
- CSS concat order matters — `variables.css` must come before `reset.css` in `build:css` or variables are undefined during parse
- Google auth cookies are synced across panels — don't create separate auth flows per panel
