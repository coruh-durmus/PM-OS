# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
pnpm install                     # Install all workspace dependencies
pnpm build                       # Build everything (packages → extensions → apps)
pnpm dev                         # Build + launch Electron app
pnpm test                        # Run all tests (88 tests across 11 suites)
pnpm clean                       # Remove all dist/ directories

# Desktop app only (from apps/desktop/)
pnpm build:main                  # esbuild main process
pnpm build:preload               # esbuild preload + wcv-preload
pnpm build:renderer              # esbuild renderer
pnpm build:css                   # Concatenate all CSS

# Run a single extension's tests
cd extensions/project-manager && pnpm test
cd packages/event-bus && pnpm test

# Rebuild node-pty for Electron after npm updates
cd apps/desktop && npx @electron/rebuild -f -w node-pty
```

## Architecture

Custom Electron desktop app (not a VS Code fork) with a plugin-based extension system. Three layers communicate via IPC:

**Main Process** → manages Electron windows, WebContentsView panels, PTY terminals, file system, git, workspace state, notifications
**Preload** → `contextBridge` exposes `window.pmOs` API (wcv, terminal, project, fs, workspace, git, mcp, notifications, dialog)
**Renderer** → single-page app with activity bar, tab bar, panel container, bottom panel (terminal), command palette, theme system

### Monorepo Layout

- `packages/types` — shared TypeScript interfaces (`Extension`, `EventMap`, `PanelApi`, `ProjectConfig`, etc.)
- `packages/event-bus` — typed pub/sub with `Disposable` pattern
- `packages/claude` — Anthropic SDK wrapper with `SummaryCache` (TTL+LRU) and `CostTracker`
- `apps/desktop` — Electron shell (main + preload + renderer)
- `apps/auth-backend` — Hono OAuth service (PostgreSQL, Docker)
- `extensions/*` — 11 extensions loaded dynamically by `ExtensionHost`

### WebContentsView Panels

External sites (Slack, Notion, Figma, Gmail) are embedded via Electron's `WebContentsView` — not iframes (which are blocked by `X-Frame-Options: DENY`). Each panel gets a `persist:${id}` partition for session cookies. The user-agent is stripped of "Electron/" to prevent sites from serving unsupported APIs like FedCM.

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

`PtyManager` spawns tmux sessions (`tmux new-session -A -s pm-os-N`) with fallback to raw shell. Renderer uses `@xterm/xterm` with `FitAddon`. Connected via `terminal:create/write/resize/destroy` IPC + `terminal:data/exit` events.

## Key Conventions

- **Build tool:** esbuild for all bundles. Main/preload: `--platform=node --external:electron --external:node-pty`. Renderer: `--platform=browser`. CSS: concatenated via `cat`.
- **TypeScript:** `ES2022` target, `bundler` module resolution, `strict` mode. All packages extend `tsconfig.base.json`.
- **Testing:** Vitest. Tests live in `src/__tests__/`. Packages without tests use `--passWithNoTests`.
- **Events:** Strongly typed via `EventMap` in `packages/types/src/events.ts`. Use `EventBus.on()` which returns a `Disposable`.
- **Theming:** CSS custom properties (13 color variables). 8 themes in `renderer/themes/themes.ts`. Persisted in `localStorage`.
- **Workspace projects** live in `~/pm-os-projects/` with structure: `CLAUDE.md`, `.pm-os/config.json`, `.memory/project/` (committed), `.memory/user/` (gitignored).

## Gotchas

- `node-pty` is a native module — must be rebuilt for Electron's ABI after install: `npx @electron/rebuild -f -w node-pty`
- WebContentsView user-agent must strip "Electron/" or Google/Figma will serve FedCM which crashes
- Extensions are `require()`'d (CJS) — ESM format will fail with "module is not defined"
- No hot reload — extension changes require app restart
- `prompt()` and `alert()` don't work in Electron renderer — use custom inline UI elements
- WebAuthn/passkeys are not fully supported in Electron's WebContentsView
