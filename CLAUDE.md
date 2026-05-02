# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
pnpm install                     # Install all workspace dependencies
pnpm build                       # Build everything (packages → extensions → apps)
pnpm dev                         # Build + launch Electron app
pnpm --filter @pm-os/desktop dev:watch   # Build + launch with auto-rebuild on renderer changes (Cmd+R to refresh)
pnpm test                        # Run all tests across workspaces
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

## Releasing the Mac DMG

`pnpm release:mac` (from repo root) produces a signed + notarized DMG at `apps/desktop/release/PMOS-<version>-arm64.dmg`. It reads `apps/desktop/.env` for `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (gitignored).

**Whenever a new DMG is built, publish it as a GitHub release** — never leave a built DMG sitting locally. Default flow:

1. Bump `version` in `apps/desktop/package.json` and root `package.json`.
2. Build: `pnpm release:mac`.
3. Commit the version bump, tag, push:
   ```
   git tag v<version> && git push && git push --tags
   ```
4. Create the release with the DMG attached:
   ```
   gh release create v<version> apps/desktop/release/PMOS-<version>-arm64.dmg \
     --title "PMOS <version>" --notes "..."
   ```

If a build replaces an existing tag's asset (e.g., re-cutting the same version after a fix), use `gh release upload v<version> <dmg> --clobber` and update the release notes if the previous text is now wrong.

The `/release-mac` slash command (in `.claude/skills/release-mac/`) automates this flow — it's user-only, so the user must invoke it explicitly.

## Claude automations in this repo

- **`.mcp.json`** — project-scoped MCP servers: `context7` (live docs for Electron, Anthropic SDK, marked, etc.) and `playwright` (browser automation for renderer testing).
- **`.claude/skills/release-mac/`** — user-only slash command for releasing the Mac DMG end-to-end (version bump → build → notarize → tag → GitHub release).
- **`.claude/skills/add-extension/`** — scaffold a new bundled extension matching the CJS/esbuild contract.
- **`.claude/agents/electron-security-reviewer.md`** — specialized reviewer for Electron-specific issues (`contextIsolation`, IPC validation, `WebContentsView` partition isolation, OAuth popup handling, extension host privileges). Invoke after changes to `apps/desktop/src/main/`, `src/preload/`, or `vscode-shim/`.
- **`.claude/hookify.protect-release-config.local.md`** — warns before edits to `.env`, `entitlements.mac.plist`, or `apps/desktop/package.json`.
- **`.claude/hookify.update-claude-md-before-commit.local.md`** — warns before `git commit` to ensure CLAUDE.md is up to date.

## Architecture

Custom Electron desktop app (Electron 41+, Chromium 146+) with a plugin-based extension system, VS Code extension compatibility, and Open VSX marketplace integration. Three layers communicate via IPC:

**Main Process** → manages Electron windows, WebContentsView panels, PTY terminals, file system, git, workspace state, notifications, session sync, extension host, VS Code API shim, extension store manager
**Preload** → `contextBridge` exposes `window.pmOs` API (wcv, terminal, fs, workspace, git, mcp, notifications, dialog, settings, extensions, extensionStore)
**Renderer** → single-page app with activity bar, panel container, bottom panel (multi-terminal), command palette, browser toolbar, file viewer, search, source control, settings, extension store, theme system

### Monorepo Layout

- `packages/types` — shared TypeScript interfaces (`Extension`, `EventMap`, `PanelApi`, etc.)
- `packages/event-bus` — typed pub/sub with `Disposable` pattern
- `packages/claude` — Anthropic SDK wrapper with `SummaryCache` (TTL+LRU) and `CostTracker`
- `apps/desktop` — Electron shell (main + preload + renderer)
- `apps/auth-backend` — Hono OAuth service (PostgreSQL, Docker)
- `extensions/*` — 12 bundled extensions loaded dynamically by `ExtensionHost`

### Key Renderer Components

- `internal-panels/file-viewer-panel.ts` — File viewer with markdown rendering (marked + GFM), source view with line numbers, file tabs, breadcrumbs, editable textarea with Cmd+S save
- `internal-panels/extension-store-panel.ts` — Open VSX marketplace UI: search, install/uninstall, detail view, update checking, installed tab
- `internal-panels/settings-panel.ts` — Settings for terminal, editor, appearance, automations, MCP, plus dynamically loaded extension settings
- `internal-panels/search-panel.ts` — Inline search in explorer with debounced results and match highlighting
- `internal-panels/source-control-panel.ts` — Git status with color-coded file changes
- `internal-panels/explorer-panel.ts` — VS Code-style workspace explorer with collapsible root folders, right-click context menu (create/rename/delete/open-in-terminal), inline search
- `panels/panel-container.ts` — Manages all panels including browser toolbar (Arc-style: back/forward/reload/URL bar)
- `bottom-panel/bottom-panel.ts` — VS Code-style terminal with shell dropdown, context menu, instances sidebar, maximize toggle
- `welcome/welcome-screen.ts` — Cursor-style welcome screen with inline SVG logo, action cards, recent projects, git clone dialog

### Extension System

#### Bundled Extensions
Extensions export `{ activate(context), deactivate?() }`. The `ExtensionHost` scans `extensions/*/package.json`, reads `main`, calls `require()` (CJS). Extensions must bundle as CJS format. Never set `"type": "module"` in extension `package.json`.

#### VS Code Extension Compatibility
Installed extensions from Open VSX can `require('vscode')` — a module resolution hook in `extension-host.ts` intercepts this and returns our `vscode-shim/` implementation:
- `vscode-shim/types.ts` — Uri, Position, Range, Selection, Disposable, EventEmitter, enums
- `vscode-shim/commands.ts` — registerCommand, executeCommand, getDeclaredCommands
- `vscode-shim/window.ts` — showInformationMessage, createStatusBarItem, createOutputChannel
- `vscode-shim/workspace.ts` — getConfiguration, workspaceFolders, fs operations
- `vscode-shim/index.ts` — re-exports all + extensions, languages (stubs), env

#### Extension Store (Open VSX)
`ExtensionStoreManager` connects to `https://open-vsx.org/api` for search, download VSIX, extract, and install. Extensions are stored at `<userData>/extensions/`. Hot-loading via `loadSingleExtension()` activates extensions without restart. `contributes.themes`, `contributes.commands`, and `contributes.configuration` are parsed from installed extension manifests.

### WebContentsView Panels

External sites (Slack, Notion, Figma, Gmail, Jira, Confluence, Calendar) are embedded via Electron's `WebContentsView` — not iframes. Each panel gets a `persist:${id}` partition. User-agent is stripped of "Electron/" to prevent FedCM. Google auth cookies synced across panels via `SessionSync`.

### Browser Panel

Arc-style navigation toolbar at the top (32px): sidebar toggle, back/forward/reload, centered URL bar (click to edit), bookmark button. Browser sidebar with bookmarks, folders, tabs, drag-and-drop. Toggles with `Cmd+B`.

### IPC Pattern

All renderer↔main communication goes through the preload bridge:
- **Main:** `ipcMain.handle('channel:name', handler)` for request-response
- **Main:** `window.webContents.send('channel:name', data)` for events
- **Preload:** `ipcRenderer.invoke(...)` and `ipcRenderer.on(...)` exposed via `contextBridge`
- **Renderer:** `window.pmOs.namespace.method()`

New IPC requires changes in three files: `ipc.ts` (handler), `preload/index.ts` (bridge), renderer code (consumer).

### Terminal

Multi-terminal support (VS Code-style). `PtyManager` spawns shells directly (zsh/bash, no tmux). Shell dropdown for choosing zsh or bash. Context menu with rename, change CWD, clear, kill, copy, paste, select default shell. Instances sidebar auto-shows at 2+ terminals. Maximize toggle. Terminal opens in workspace folder; folder picker when multiple workspace folders exist. `Ctrl+`` toggles panel, `Ctrl+Shift+`` creates new terminal.

### Workspace & Explorer

VS Code-style explorer with collapsible workspace root folders. Multi-folder workspace support via "Add Folder to Workspace" button. Right-click context menu: new file, new folder, rename, delete, open in terminal. Inline search with debounced results and match highlighting. Git info (branch, status, remote, contributors, last commit) per workspace root. Welcome screen (Cursor-style) with action cards: "Open project", "Clone repo" (inline dialog with native folder picker, auto-opens cloned workspace).

## Key Conventions

- **Build tool:** esbuild for all bundles. Main/preload: `--platform=node --external:electron --external:node-pty`. Renderer: `--platform=browser`. CSS: concatenated via `cat` (variables.css must be first).
- **TypeScript:** `ES2022` target, `bundler` module resolution, `strict` mode. All packages extend `tsconfig.base.json`.
- **Testing:** Vitest. Tests live in `src/__tests__/`. Packages without tests use `--passWithNoTests`.
- **Events:** Strongly typed via `EventMap` in `packages/types/src/events.ts`. Use `EventBus.on()` which returns a `Disposable`.
- **Theming:** CSS custom properties (45+ design tokens). 8 built-in themes + dynamic extension themes from Open VSX. Persisted in `localStorage`. Inline SVG logo uses `var(--text-primary)` and `var(--bg-primary)` for theme reactivity.
- **Design tokens:** Use CSS variables from `variables.css` — never hardcode colors. Includes `--error-subtle`, `--accent-subtle`, `--accent-muted` for transparent tints.
- **Icons:** Codicon font (`@vscode/codicons`) for all UI icons. Loaded via separate `codicon.css` in HTML. Never use unicode emoji for action icons.
- **Safe logging:** Main process uses `safeLog`/`safeError` wrappers (try-catch around console calls) to prevent EPIPE crashes from broken PTY pipes.
- **Inline UI:** `prompt()` and `alert()` don't work in Electron renderer — always use custom inline DOM elements for user input.
- **Renderer events:** Cross-panel signals in the renderer use `window.dispatchEvent(new CustomEvent('pm-os:<name>', { detail }))` (e.g. `pm-os:active-file`, `pm-os:scroll-to-anchor`, `pm-os:open-terminal-in-folder`). Centralize event names + payload types in `apps/desktop/src/renderer/shared/`. The `EventBus` in `packages/event-bus` is for main-process use.
- **Panel disposal:** Internal panels mounted by `SidebarPanel` (`apps/desktop/src/renderer/internal-panels/`) must implement `dispose()` if they subscribe to `window` events or workspace listeners. `SidebarPanel.renderView` calls it before clearing children to prevent leaks across view switches.
- **Import paths:** Relative imports in `apps/desktop` use `.js` suffix despite `.ts` source files (TS `bundler` resolution + esbuild rewrite at build time).

## Gotchas

- `node-pty` is a native module — must be rebuilt for Electron's ABI after install: `npx @electron/rebuild -f -w node-pty`
- WebContentsView user-agent must strip "Electron/" and app name or Google/Figma will serve FedCM which crashes
- Same-domain popups must be allowed in `setWindowOpenHandler` for OAuth SSO flows (e.g., `figma.com/start_google_sso`)
- Extensions are `require()`'d (CJS) — ESM format will fail with "module is not defined"
- `prompt()` and `alert()` don't work in Electron renderer — use custom inline UI elements
- WebAuthn/passkeys require code-signed app with Keychain entitlements — won't work in development (`npx electron`)
- EPIPE errors from dead PTY pipes — main process has `uncaughtException` handler that suppresses these; all logging uses `safeLog`/`safeError`
- CSS concat order matters — `variables.css` must come before `reset.css` in `build:css` or variables are undefined during parse
- Google auth cookies are synced across panels — don't create separate auth flows per panel
- VSIX download must use `res.pipe(file)` with `file.on('finish')` — manual `file.write()` causes truncated/corrupt ZIP files
- HTTP redirects in Node.js `https.get` require `res.resume()` before following — otherwise the connection hangs
- CSP must include `img-src 'self' https: data: file:` for extension icons from Open VSX and local installed extensions
- `ProjectsPanel.render()` has a `rendering` guard to prevent duplicate explorers from concurrent workspace change events
- Extension store uses `installingIds` Set to track in-progress installs — shared between list view and detail view
- Browser toolbar height (32px) must be accounted for in `getBounds()` — WebContentsView starts below the toolbar
- Browser sidebar CSS has `top: 32px` to sit below the toolbar — don't set to `top: 0`
- vscode-shim `require.resolve('./vscode-shim/index')` generates a benign esbuild warning — the shim is bundled correctly
- `marked@15` removed its built-in slugger — heading tags render without `id` attributes. Inject anchors via `marked.use({ renderer: { heading(token) { … } } })` and `slugify(token.text)` (see `apps/desktop/src/renderer/shared/markdown-slug.ts`).
- `tsc --noEmit` from `apps/desktop` currently fails with "Cannot find type definition file for 'node'" because pnpm doesn't hoist `@types/node` into the package's `node_modules`. Use `pnpm build` (esbuild) to validate; a fast sanity check that new modules made it into the bundle is `grep -c "<symbol>" apps/desktop/dist/{renderer,preload,main}/index.js`.
- Adding a new `.css` file in `apps/desktop/src/renderer/` requires updating the `build:css` script in `apps/desktop/package.json` — it `cat`s a hard-coded list, files outside that list are never bundled.
