# Implementation Plan: VS Code-like File Explorer & Markdown Viewer

## Context

The ExplorerPanel already shows a file tree in the sidebar, but clicking a file only does `console.log`. The markdown-viewer extension has a full `marked`-based renderer with GFM and dark-theme CSS, but it's not wired to anything. The goal is: click a file in the explorer, it opens in the main panel area, and `.md` files render as human-readable content.

## Architecture Overview

```
User clicks file in ExplorerPanel (sidebar)
  -> onOpenFile callback fires
    -> PanelContainer.openFile(filePath)
      -> showPanel('file-viewer') -- makes file viewer visible in main area
      -> FileViewerPanel.loadFile(filePath) -- reads + renders the file
        -> .md files: rendered markdown (default) with Source/Split toggle
        -> other text files: source view with line numbers
        -> binary files: "cannot preview" placeholder
```

**Callback chain:** App -> SidebarPanel -> ProjectsPanel -> ExplorerPanel -> PanelContainer

---

## Agent Teams

### Agent 1: File Viewer Panel (Core Component)

**Task:** Create the new `FileViewerPanel` class and its CSS stylesheet.

**Files to create:**
- `apps/desktop/src/renderer/internal-panels/file-viewer-panel.ts`
- `apps/desktop/src/renderer/internal-panels/file-viewer-panel.css`

**Detailed spec for `file-viewer-panel.ts`:**

```typescript
// DOM structure the panel must build:
//
// wrapper (position: absolute; inset: 0; display: flex; flex-direction: column)
//   toolbar (height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between)
//     left section:
//       file icon (emoji, based on extension - reuse getFileIcon logic from explorer-panel.ts)
//       file name (bold, var(--text-primary))
//       file path (truncated, var(--text-muted), font-size: 11px)
//     right section:
//       [.md only] mode buttons: "Rendered" | "Source" | "Split"
//       "Copy Path" button
//   content area (flex: 1; overflow: hidden)
//     rendered-view: div.file-viewer-markdown (overflow-y: auto; padding: 24px 32px; innerHTML from marked)
//     source-view: div (display: flex)
//       gutter (width: 50px; text-align: right; color: var(--text-muted); user-select: none; padding: 16px 8px 16px 0)
//       code-area (flex: 1; overflow: auto; padding: 16px)
//         <pre><code>file content</code></pre>
//     [split mode] both views side by side (flex: 1 each, border between)

export class FileViewerPanel {
  private el: HTMLElement;
  private currentPath: string | null = null;
  private currentSource: string = '';
  private mode: 'rendered' | 'source' | 'split' = 'rendered';
  private isMarkdown: boolean = false;
  
  // DOM references
  private toolbar: HTMLElement | null = null;
  private contentArea: HTMLElement | null = null;
  private renderedView: HTMLElement | null = null;
  private sourceView: HTMLElement | null = null;
  private modeButtons: HTMLElement | null = null;

  constructor(container: HTMLElement);
  render(): void;                           // builds the initial empty state
  loadFile(filePath: string): Promise<void>; // reads file, detects type, renders
  private buildToolbar(fileName: string, filePath: string, isMarkdown: boolean): HTMLElement;
  private renderMarkdownContent(source: string): void;
  private renderSourceContent(source: string, filePath: string): void;
  private renderErrorState(message: string): void;
  private setMode(mode: 'rendered' | 'source' | 'split'): void;
  private getFileIcon(name: string): string;
  private isTextFile(ext: string): boolean;
}
```

**Markdown rendering approach:**
- Import `marked` directly: `import { marked } from 'marked';`
- Configure: `marked.setOptions({ gfm: true, breaks: true });`
- Render: `this.renderedView.innerHTML = marked.parse(source) as string;`
- The `marked` library will be added to `apps/desktop/package.json` dependencies

**Text file extensions to recognize:** `.md`, `.json`, `.yaml`, `.yml`, `.txt`, `.log`, `.ts`, `.js`, `.jsx`, `.tsx`, `.css`, `.html`, `.xml`, `.sh`, `.py`, `.go`, `.rs`, `.toml`, `.ini`, `.env`, `.gitignore`, `.mjs`, `.cjs`, `.svg`, `.sql`

**Detailed spec for `file-viewer-panel.css`:**
- Port ALL markdown styles from `extensions/markdown-viewer/src/webview/styles.css` lines 122-295
- Change selector scope from `#rendered-view` to `.file-viewer-markdown`
- Toolbar styles: background `var(--bg-secondary)`, border-bottom `1px solid var(--border)`, height 36px
- Mode toggle buttons: same pattern as webview's `.toolbar-btn` / `.toolbar-btn.active` styles
- Source view gutter: `var(--text-muted)`, font-size 12px, monospace
- Source view code: `var(--text-primary)`, font-family monospace, line-height 1.6
- All colors MUST use CSS variables from `variables.css` (never hardcode)

**Dependencies:** `marked` package (added by Agent 4)

---

### Agent 1 Verifier

**Verification checklist:**

1. **File exists:** `apps/desktop/src/renderer/internal-panels/file-viewer-panel.ts` exists and exports `FileViewerPanel` class
2. **File exists:** `apps/desktop/src/renderer/internal-panels/file-viewer-panel.css` exists
3. **Class API:** FileViewerPanel has `constructor(container: HTMLElement)`, `render()`, and `loadFile(filePath: string): Promise<void>` as public methods
4. **Markdown rendering:** The `loadFile` method imports and uses `marked` to render `.md` files. Verify `marked.parse()` is called with GFM enabled
5. **Source view:** Non-markdown text files render with line numbers (verify gutter div exists with numbered spans)
6. **Mode toggle:** For `.md` files, toolbar shows Rendered/Source/Split buttons. Clicking them changes the view mode
7. **Error handling:** `loadFile` handles null return from `fs.readFile` gracefully (shows error message, not crash)
8. **CSS scoping:** All markdown styles use `.file-viewer-markdown` selector (not `#rendered-view`)
9. **CSS variables:** No hardcoded colors in CSS — all use `var(--*)` tokens
10. **Toolbar content:** Shows file icon, file name (bold), and file path (muted)
11. **TypeScript:** File compiles without type errors when `marked` types are available

**Verification commands:**
```bash
# Check files exist
ls apps/desktop/src/renderer/internal-panels/file-viewer-panel.ts
ls apps/desktop/src/renderer/internal-panels/file-viewer-panel.css

# Check class exports
grep -n "export class FileViewerPanel" apps/desktop/src/renderer/internal-panels/file-viewer-panel.ts

# Check marked import
grep -n "import.*marked" apps/desktop/src/renderer/internal-panels/file-viewer-panel.ts

# Check loadFile method
grep -n "loadFile" apps/desktop/src/renderer/internal-panels/file-viewer-panel.ts

# Check CSS uses variables not hardcoded colors
grep -c "#[0-9a-fA-F]" apps/desktop/src/renderer/internal-panels/file-viewer-panel.css  # should be 0

# Check CSS scope
grep -c "file-viewer-markdown" apps/desktop/src/renderer/internal-panels/file-viewer-panel.css  # should be > 0
grep -c "#rendered-view" apps/desktop/src/renderer/internal-panels/file-viewer-panel.css  # should be 0

# Check source view line numbers
grep -n "gutter\|line-number" apps/desktop/src/renderer/internal-panels/file-viewer-panel.ts

# Check error handling
grep -n "null\|error\|Cannot" apps/desktop/src/renderer/internal-panels/file-viewer-panel.ts
```

---

### Agent 2: Panel Container Integration

**Task:** Register the file viewer in PanelContainer and add the `openFile()` public method.

**Files to modify:**
- `apps/desktop/src/renderer/panels/panel-container.ts`

**Detailed changes:**

1. **Add import** (top of file):
```typescript
import { FileViewerPanel } from '../internal-panels/file-viewer-panel';
```

2. **Add private field** (in PanelContainer class, after line 23):
```typescript
private fileViewer: FileViewerPanel | null = null;
```

3. **Add case in `buildInternalPanel()`** (in the switch at line 234, before `default:`):
```typescript
case 'file-viewer': {
  const panel = new FileViewerPanel(wrapper);
  panel.render();
  this.fileViewer = panel;
  break;
}
```

4. **Add public method** (new method on PanelContainer class):
```typescript
async openFile(filePath: string): Promise<void> {
  await this.showPanel('file-viewer');
  if (this.fileViewer) {
    await this.fileViewer.loadFile(filePath);
  }
}
```

**Critical detail:** The `buildInternalPanel` method is called once per panel ID (panels are cached in the `Map`). The `openFile` method must work for subsequent calls — it reuses the existing FileViewerPanel instance and just calls `loadFile()` with the new path.

---

### Agent 2 Verifier

**Verification checklist:**

1. **Import exists:** `FileViewerPanel` is imported from the correct path
2. **Private field:** `fileViewer` field exists on PanelContainer class
3. **Switch case:** `'file-viewer'` case exists in `buildInternalPanel()`, creates FileViewerPanel, stores reference in `this.fileViewer`
4. **openFile method:** Public `openFile(filePath: string)` method exists, calls `showPanel('file-viewer')` then `this.fileViewer.loadFile(filePath)`
5. **No regressions:** All other switch cases (projects, ai-assistant, automations, mcp, extensions) are unchanged
6. **Existing panels still work:** `showPanel()` still handles WebContentsView panels and other internal panels correctly

**Verification commands:**
```bash
# Check import
grep -n "FileViewerPanel" apps/desktop/src/renderer/panels/panel-container.ts

# Check private field
grep -n "fileViewer" apps/desktop/src/renderer/panels/panel-container.ts

# Check switch case
grep -n "file-viewer" apps/desktop/src/renderer/panels/panel-container.ts

# Check openFile method
grep -n "openFile" apps/desktop/src/renderer/panels/panel-container.ts

# Check existing cases are untouched
grep -n "case 'projects'\|case 'ai-assistant'\|case 'automations'\|case 'mcp'\|case 'extensions'" apps/desktop/src/renderer/panels/panel-container.ts
```

---

### Agent 3: Explorer Callback Wiring

**Task:** Wire the ExplorerPanel's file click to trigger PanelContainer.openFile() via a callback chain through ProjectsPanel, SidebarPanel, and App.

**Files to modify:**
- `apps/desktop/src/renderer/internal-panels/explorer-panel.ts`
- `apps/desktop/src/renderer/internal-panels/projects-panel.ts`
- `apps/desktop/src/renderer/sidebar-panel/sidebar-panel.ts`
- `apps/desktop/src/renderer/app.ts`

**Detailed changes:**

#### `explorer-panel.ts`
- Add callback property: `private onOpenFile?: (entry: FileEntry) => void`
- Modify constructor to accept options: `constructor(container: HTMLElement, options?: { onOpenFile?: (entry: FileEntry) => void })`
- Store callback: `this.onOpenFile = options?.onOpenFile`
- Change `openFile` method (line 304-308) from:
  ```typescript
  private openFile(entry: FileEntry): void {
    console.log('[Explorer] Open file:', entry.path);
  }
  ```
  To:
  ```typescript
  private openFile(entry: FileEntry): void {
    if (this.onOpenFile) {
      this.onOpenFile(entry);
    }
  }
  ```

#### `projects-panel.ts`
- Read the current file first to understand its constructor and how it creates ExplorerPanel
- Add options to constructor: accept `onOpenFile` callback
- Pass `onOpenFile` to ExplorerPanel when creating it

#### `sidebar-panel.ts`
- Add `onOpenFile` callback field (passed via constructor options or setter method)
- In `renderView('projects')`: pass `onOpenFile` to `ProjectsPanel` constructor

#### `app.ts`
- In `initApp()`, define the `onOpenFile` callback:
  ```typescript
  const onOpenFile = (entry: { name: string; path: string; isDirectory: boolean }) => {
    this.panelContainer.openFile(entry.path);
  };
  ```
- Pass it to `SidebarPanel` constructor (modify the SidebarPanel instantiation around line 39-41)

**Pattern reference:** This follows the same callback injection pattern used by `BrowserSidebar` which receives `onNavigate` and `onNewTab` callbacks.

---

### Agent 3 Verifier

**Verification checklist:**

1. **ExplorerPanel callback:** Constructor accepts `options?: { onOpenFile?: ... }`, stores it, and `openFile()` calls it instead of `console.log`
2. **No more console.log:** The string `'[Explorer] Open file:'` should NOT appear in explorer-panel.ts
3. **ProjectsPanel passthrough:** Accepts `onOpenFile` and passes it to ExplorerPanel
4. **SidebarPanel passthrough:** Accepts `onOpenFile` and passes it to ProjectsPanel in `renderView('projects')`
5. **App wiring:** `app.ts` creates the callback and passes it to SidebarPanel
6. **Callback calls panelContainer:** The callback in `app.ts` calls `this.panelContainer.openFile(entry.path)`
7. **Type safety:** The `FileEntry` interface (or equivalent) is used consistently across all files
8. **No broken constructors:** All existing instantiations of ExplorerPanel, ProjectsPanel, SidebarPanel still work (the new parameter is optional or has a default)

**Verification commands:**
```bash
# Check console.log is removed from explorer
grep -n "console.log.*Explorer.*Open" apps/desktop/src/renderer/internal-panels/explorer-panel.ts  # should return nothing

# Check callback in explorer
grep -n "onOpenFile" apps/desktop/src/renderer/internal-panels/explorer-panel.ts

# Check callback in projects-panel
grep -n "onOpenFile" apps/desktop/src/renderer/internal-panels/projects-panel.ts

# Check callback in sidebar-panel
grep -n "onOpenFile" apps/desktop/src/renderer/sidebar-panel/sidebar-panel.ts

# Check callback in app
grep -n "onOpenFile\|openFile" apps/desktop/src/renderer/app.ts

# Check panelContainer.openFile is called
grep -n "panelContainer.openFile" apps/desktop/src/renderer/app.ts
```

---

### Agent 4: Dependencies & Build Configuration

**Task:** Add the `marked` dependency and update the CSS build to include the new stylesheet.

**Files to modify:**
- `apps/desktop/package.json`

**Detailed changes:**

#### `apps/desktop/package.json`
1. Add `"marked": "^15.0.0"` to the `dependencies` section (NOT devDependencies — it's used at runtime in the renderer bundle)
2. Find the `build:css` script — it concatenates CSS files via `cat`. Add `src/renderer/internal-panels/file-viewer-panel.css` to the concatenation list (AFTER `variables.css` and `reset.css`, order matters)

**Post-change command:**
```bash
cd /Users/coruh.durmus/Desktop/PMOS && pnpm install
```

---

### Agent 4 Verifier

**Verification checklist:**

1. **marked in dependencies:** `apps/desktop/package.json` has `"marked"` in `dependencies` (not devDependencies)
2. **Version:** marked version is `"^15.0.0"` (matching the markdown-viewer extension)
3. **CSS build:** The `build:css` script includes `file-viewer-panel.css` in the concatenation
4. **CSS order:** `variables.css` comes BEFORE `file-viewer-panel.css` in the cat order (critical: variables must be defined before use)
5. **pnpm install succeeds:** Running `pnpm install` from the project root completes without errors
6. **No lockfile conflicts:** `pnpm-lock.yaml` updates cleanly

**Verification commands:**
```bash
# Check marked in dependencies
grep -n "marked" apps/desktop/package.json

# Check CSS build includes new file
grep -n "file-viewer-panel" apps/desktop/package.json

# Check CSS order (variables.css must come first)
grep -n "build:css" apps/desktop/package.json

# Install and verify
cd /Users/coruh.durmus/Desktop/PMOS && pnpm install

# Full build test
pnpm build
```

---

## Agent Execution Order

```
Agent 4 (Dependencies)  -- FIRST (must install marked before others can import it)
  |
  v
Agent 1 (File Viewer Panel)  +  Agent 2 (Panel Container)  -- PARALLEL (independent)
  |                                |
  v                                v
Agent 3 (Explorer Callback Wiring)  -- LAST (depends on Agent 1 + Agent 2 outputs)
```

## Final Integration Verification

After all agents complete, run this full verification:

```bash
# 1. Build succeeds
cd /Users/coruh.durmus/Desktop/PMOS && pnpm build

# 2. Tests pass
pnpm test

# 3. All new files exist
ls apps/desktop/src/renderer/internal-panels/file-viewer-panel.ts
ls apps/desktop/src/renderer/internal-panels/file-viewer-panel.css

# 4. Key integration points
grep -n "FileViewerPanel" apps/desktop/src/renderer/panels/panel-container.ts
grep -n "openFile" apps/desktop/src/renderer/panels/panel-container.ts
grep -n "onOpenFile" apps/desktop/src/renderer/internal-panels/explorer-panel.ts
grep -n "onOpenFile" apps/desktop/src/renderer/app.ts

# 5. Launch and manual test
pnpm dev
```

**Manual test script:**
1. Launch app with `pnpm dev`
2. Open a workspace (click Projects in activity bar, ensure workspace is open)
3. Expand a project folder in the explorer tree
4. Click a `.md` file (e.g., `CLAUDE.md`) -> should open in main panel as rendered markdown
5. Verify headings, bold text, lists, code blocks render correctly
6. Click "Source" button -> should show raw markdown with line numbers
7. Click "Split" button -> should show both views side by side
8. Click "Rendered" button -> back to rendered view
9. Click a `.json` file -> should show source view with line numbers
10. Click back to Slack/Notion in activity bar -> file viewer hides, web panel shows
11. Click Projects again, click another file -> file viewer shows with new content
