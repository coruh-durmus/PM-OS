---
name: add-extension
description: Scaffold a new bundled PMOS extension under extensions/<name>/ following the project's CJS/esbuild contract. Use when the user asks to add an extension, create a new extension, scaffold a panel/integration, or extend PMOS with a new module. Argument is the kebab-case extension name (e.g. "linear-panel").
---

# Add a new bundled extension

Create a new extension under `extensions/<name>/` that matches the existing pattern. Bundled extensions are loaded by `ExtensionHost` at startup via `require()` of their compiled `dist/index.js`.

## The CJS contract (read this before writing files)

PMOS' `ExtensionHost` does `require('extensions/<name>/dist/index.js')`, so:

- The bundle **must be CommonJS** — `package.json` must NOT have `"type": "module"`.
- `esbuild` must run with `--platform=node --format=cjs`.
- The extension exports `{ activate(context), deactivate?() }` — either as a default export or as a named `Extension` object. See `extensions/notion-panel/src/index.ts` for the canonical shape.
- Runtime third-party deps (e.g., `marked`, `yaml`) must be bundled by esbuild — do NOT add `--packages=external`. The extension's `node_modules/` is excluded from the packaged DMG (see `apps/desktop/package.json` `extraResources.filter`).
- Workspace deps (`@pm-os/types`, `@pm-os/event-bus`, `@pm-os/claude`) are also bundled into `dist/index.js` by esbuild.

If any of these are violated, packaging will silently produce a broken DMG (extension fails to load at runtime) — there's no build-time check.

## Inputs

`$ARGUMENTS` is the kebab-case extension name. If empty, ask the user.

Examples: `linear-panel`, `slack-summarizer`, `jira-cli`.

## Steps

1. **Validate the name.** Must be kebab-case, no spaces, no leading dot. If `extensions/<name>/` already exists, stop and ask.

2. **Pick a reference extension** based on what the user is building:
   - Embedded SaaS panel (Slack/Notion-style WebContentsView) → copy `extensions/notion-panel/` structure.
   - Pure logic extension (no UI panel, hooks into events) → copy `extensions/automation-engine/` structure.
   - Markdown/file processor → copy `extensions/markdown-viewer/` structure.

3. **Create the directory structure:**
   ```
   extensions/<name>/
   ├── package.json
   ├── tsconfig.json
   └── src/
       └── index.ts
   ```

4. **`package.json` template** (adapt `displayName`, `description`, and `dependencies`):
   ```json
   {
     "name": "@pm-os/<name>",
     "version": "0.1.0",
     "private": true,
     "displayName": "PM-OS <DisplayName>",
     "description": "<one-line description>",
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "exports": {
       ".": {
         "types": "./dist/index.d.ts",
         "import": "./dist/index.js"
       }
     },
     "scripts": {
       "build": "esbuild src/index.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist/index.js --sourcemap",
       "clean": "rm -rf dist",
       "test": "vitest run"
     },
     "dependencies": {
       "@pm-os/types": "workspace:*",
       "@pm-os/event-bus": "workspace:*"
     },
     "devDependencies": {
       "esbuild": "^0.25.0",
       "typescript": "^5.7.0",
       "vitest": "^3.1.0"
     }
   }
   ```

   Add to `dependencies` only what's needed at runtime. Most extensions need just `@pm-os/types` and `@pm-os/event-bus`. Pure logic extensions can drop `@pm-os/event-bus`.

   For extensions that interact with Anthropic, also add `"@pm-os/claude": "workspace:*"` (see `extensions/ai-assistant`).

5. **`tsconfig.json` template:**
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "./dist",
       "rootDir": "./src"
     },
     "include": ["src"],
     "exclude": ["src/__tests__"]
   }
   ```

6. **`src/index.ts` template** (adjust for what the extension does):
   ```ts
   import type { Extension, ExtensionContext } from '@pm-os/types';

   const extension: Extension = {
     activate(context: ExtensionContext) {
       console.log(`[${context.extensionId}] activated`);
       // TODO: register panel descriptor / event handlers / commands
     },

     deactivate() {
       console.log('[<name>] deactivated');
     },
   };

   export default extension;
   ```

   For a panel extension, register a panel descriptor in `context.globalState` — see `extensions/notion-panel/src/index.ts` for the shape (id, title, icon, position, closable, webContentsViewOptions with id/url/partition).

7. **Install dependencies and build:**
   ```
   pnpm install        # picks up the new workspace package
   pnpm -F @pm-os/<name> build
   ```

   If `pnpm install` fails with a workspace error, check the name in `package.json` matches `@pm-os/<name>` exactly.

8. **Verify the extension loads.** From the repo root:
   ```
   pnpm dev
   ```
   Look for `[<name>] activated` in the main process console (or DevTools console for renderer extensions). If you see "Cannot find module" or "module is not defined", the bundle came out as ESM — re-check `package.json` does not have `"type": "module"` and the build script uses `--format=cjs`.

9. **Tell the user the extension is registered**, where to find the entry point, and what to fill in next (the `activate` body).

## Don't

- Don't add the extension to `apps/desktop/package.json` — `ExtensionHost` discovers extensions by scanning `extensions/*/package.json` at runtime.
- Don't put runtime code outside `src/` — `apps/desktop/package.json`'s `extraResources.filter` excludes `src/`, `__tests__/`, configs, and `node_modules/` from the packaged DMG. Only `dist/` and `package.json` ship.
- Don't add `"type": "module"` — `ExtensionHost` uses `require()`, which fails on ESM.
- Don't introduce native (C++/Rust) dependencies in extensions. Native modules go in the main app or a workspace package and are exposed through `context`.
