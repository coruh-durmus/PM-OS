# PM-OS: Product Manager Operating System — Design Spec

## Overview

PM-OS is an open-source desktop application that serves as a unified operating system for product managers. Built as a lightweight VS Code fork with a suite of purpose-built extensions, it brings Slack, Notion, and web browsing into a single workspace with AI embedded throughout.

**Core problems solved:**
1. **Context switching** — Slack, Notion, browser, terminal all live in one window
2. **Repetitive tasks** — AI drafts standups, status updates, replies; automations handle recurring work
3. **Information overload** — AI summarizes channels, pages, threads; triages by importance
4. **Decision tracking** — Per-project decision logs, memory, and linked external resources

## Architecture

**Approach: Extension-Based Shell**

A minimal VS Code fork with all PM functionality delivered as 9 core extensions. The fork itself handles branding, theme, welcome screen, layout presets, and — critically — **Electron BrowserView integration** for embedding third-party web apps.

**Why the fork needs BrowserView support:** VS Code's standard webview API uses sandboxed iframes. Slack, Notion, and most web apps set `X-Frame-Options: DENY` headers that block iframe embedding. The fork must expose Electron's `BrowserView` (or `<webview>` tag) as a new panel type that extensions can use to embed external sites with full functionality (login, cookies, navigation).

```
PM-OS Shell (VS Code fork)
├── BrowserView Panel API (fork-level, enables embedding external sites)
├── Slack Panel Extension (BrowserView + AI context bar)
├── Notion Panel Extension (BrowserView + AI context bar)
├── Browser Panel Extension (BrowserView + AI context bar)
├── AI Assistant Extension (sidebar chat + terminal)
├── Project Manager Extension (per-project config/memory)
├── Automation Engine Extension (cron + event triggers)
├── MCP/Plugin Manager Extension (extensibility)
├── Markdown Viewer Extension (auto-renders .md files)
└── Auth Extension (OAuth via hosted backend)
```

**Cross-Extension Communication:** Extensions share state and events via:
- VS Code commands as inter-extension RPC (e.g., `pm-os.slack.getActiveChannel`)
- A shared `pm-os.context` event bus (implemented as a VS Code EventEmitter in a shared extension API)
- Project state read from disk (config.json, links.json) via the Project Manager extension

**Auth Backend**: A lightweight Node.js service that handles OAuth2 flows for Slack, Notion, and other services. Stores tokens server-side, provides session-based access to the desktop app. Self-hosters can run it locally or use BYOK (works for Notion integration tokens and Claude API keys; Slack requires the hosted OAuth flow via a registered PM-OS Slack app).

**AI Cost Model**: Users bring their own Claude API key (BYOK). PM-OS includes client-side cost estimation, summary caching (avoid re-summarizing unchanged content), and configurable spending limits.

## Extension Details

### 1. Slack Panel Extension

Embeds Slack's web client using the fork's **BrowserView Panel API** (not a standard VS Code webview — standard webviews cannot embed Slack due to X-Frame-Options). An **AI Context Bar** sits alongside (right side) providing AI-powered insights via the Slack API.

**v0.1 capabilities:**
- Embed Slack web client via Electron BrowserView
- AI context bar: channel summary, thread summary
- Detect active channel/thread via webview URL changes
- Read channel/thread content via Slack Web API
- Surface summaries and action items in the context bar

### 2. Notion Panel Extension

Embeds Notion's web client via BrowserView with an AI context bar.

**v0.1 capabilities:**
- Embed Notion web client via Electron BrowserView
- AI context bar: page summary, PRD drafting assistance
- Detect active page via webview URL changes
- Read/write page content via Notion API
- Draft content based on project context and templates

### 3. Browser Panel Extension

General-purpose browser webview with an AI context bar for research workflows.

**v0.1 capabilities:**
- Tabbed browser webview (enhanced Simple Browser)
- AI context bar: page summary, clip content to project
- Extract page content via readability-style parsing
- Save research snippets to project docs

### 4. Markdown Viewer Extension

Automatically opens `.md` files in a rendered, readable view instead of raw source. Ships as a default extension — PMs work with markdown constantly (PRDs, specs, meeting notes, CLAUDE.md) and should never have to read raw markup.

**Behavior:**
- When a `.md` file is opened, it renders as formatted HTML by default (not raw text)
- Supports GitHub-Flavored Markdown (tables, task lists, fenced code blocks, footnotes)
- Live preview updates as the file is edited (split view: source left, rendered right)
- Single-click opens rendered view; a toggle switches to source editing mode

**v0.1 capabilities:**
- Auto-render `.md` files on open (rendered view is the default)
- GFM support including tables, task lists, code blocks with syntax highlighting
- Toggle between rendered view and source editor
- Split view mode (source + preview side-by-side) for editing
- Support for mermaid diagrams (common in PM specs)
- Print/export to PDF for sharing with stakeholders
- Dark/light theme matching PM-OS theme

### 5. AI Assistant Extension

The central AI brain — a conversational sidebar and integrated terminal.

**Sidebar:**
- Conversational Claude interface
- Can see the active panel's context (which Slack channel, which Notion page, which URL)
- Cross-tool actions: "Create a Notion page from this Slack thread", "Update the roadmap based on these decisions"
- Project-aware: uses the active project's CLAUDE.md and memory

**Terminal:**
- Integrated terminal compatible with Claude Code
- PM-specific skills loaded from the project
- MCP servers available for API interactions

**v0.1 built-in skills:**
- Summarize (channel, thread, page, article)
- Draft (PRD, status update, Slack reply, meeting notes)
- Extract action items
- Update decision log
- Cross-reference project context

### 6. Project Manager Extension

Manages PM workspaces with per-project isolation.

**Project structure:**
```
~/pm-os-projects/
├── q3-launch/
│   ├── CLAUDE.md              # AI instructions for this project
│   ├── .memory/
│   │   ├── project/           # Shared project memory (committed to git)
│   │   └── user/              # Personal user memory (.gitignore'd)
│   ├── docs/                  # Local PRDs, specs, notes
│   ├── .pm-os/
│   │   ├── config.json        # Project settings
│   │   ├── links.json         # Pointers to Slack channels, Notion pages, Jira boards
│   │   ├── decisions.log      # Decision tracking
│   │   └── automations/       # Project-specific automation configs
│   └── .mcp.json              # Project-specific MCP servers
├── platform-redesign/
│   └── ...
```

**v0.1 capabilities:**
- Create/delete/switch projects via command palette and sidebar tree view
- Edit CLAUDE.md and project config
- Manage links.json (add/remove external resource pointers)
- Decision log (append entries with timestamp, context, rationale)
- Sidebar tree showing projects and their linked resources

### 7. Automation Engine Extension

Runs scheduled and event-driven automations per project.

**Scheduled (cron-style):**
```yaml
name: "Morning Standup Summary"
schedule: "0 9 * * 1-5"
actions:
  - summarize_slack:
      channels: ["#product-team", "#engineering"]
      timeframe: "since yesterday 5pm"
  - draft_notion:
      template: "standup-summary"
      destination: "Standups/{{date}}"
  - notify_slack:
      channel: "#product-team"
      message: "Standup summary ready: {{notion_link}}"
```

**Trigger-based (event-driven):**
```yaml
name: "Escalated Thread Summary"
trigger:
  type: "slack_thread"
  condition: "reply_count > 10 AND mentions_me"
actions:
  - summarize_thread: {}
  - add_to_decisions_log:
      project: "current"
  - notify:
      method: "desktop_notification"
```

**v0.1 capabilities:**
- 2-3 preset automation templates (morning summary, thread escalation)
- YAML-based configuration
- Background scheduler in extension host (runs only while PM-OS is open; missed schedules fire on next app launch)
- Action modules: summarize_slack, draft_notion, notify_slack, notify_desktop
- Automation log in `.pm-os/automation-log/`

### 8. MCP/Plugin Manager Extension

Extensibility system for adding new tool integrations.

**v0.1 capabilities:**
- Load MCP servers from project-level `.mcp.json`
- Install MCP servers manually (no marketplace yet)
- Settings UI to configure MCP server parameters
- Pre-bundled MCP configs for common PM tools (Jira, Linear, Google Calendar)

### 9. Auth Extension

Manages authentication for third-party services.

**v0.1 capabilities:**
- OAuth flows for Slack and Notion (via hosted auth backend)
- BYOK fallback for self-hosters
- Secure token storage via system keychain
- Token refresh handling
- Settings UI for managing connected accounts

## AI Context Bar Pattern

The AI context bar is a consistent UX pattern across all panel extensions:

```
┌─────────────────────────────────────────────┐
│  Panel Layout                               │
│  ┌───────────────────┐ ┌─────────────────┐  │
│  │  Webview           │ │ AI Context Bar  │  │
│  │  (Slack/Notion/    │ │ ┌─────────────┐ │  │
│  │   Browser)         │ │ │ Summary     │ │  │
│  │                    │ │ │ ...         │ │  │
│  │  No injection.     │ │ ├─────────────┤ │  │
│  │  Pure third-party  │ │ │ Actions     │ │  │
│  │  experience.       │ │ │ • Draft PRD │ │  │
│  │                    │ │ │ • Extract   │ │  │
│  │                    │ │ │ • Save clip │ │  │
│  │                    │ │ ├─────────────┤ │  │
│  │                    │ │ │ Suggestions │ │  │
│  │                    │ │ │ ...         │ │  │
│  └───────────────────┘ └─┴─────────────┴─┘  │
└─────────────────────────────────────────────┘
```

- Sits alongside the webview (collapsible, resizable)
- Updates when the active URL/page/channel changes
- Reads content via official APIs only (no DOM injection)
- Actions execute via official APIs and MCP
- Results can be saved to the active project

## Auth Backend

**Tech stack:** Node.js + Express (or Hono), PostgreSQL, deployed as a cloud service.

**Endpoints:**
- `POST /oauth/:provider/start` — Initiate OAuth flow, return redirect URL
- `GET /oauth/:provider/callback` — Handle OAuth callback, store tokens
- `POST /api/token` — Exchange session token for API access
- `POST /api/refresh` — Refresh expired tokens
- `DELETE /api/connection/:provider` — Revoke connection

**Security:**
- Tokens encrypted at rest
- Session tokens with expiry
- HTTPS only
- Rate limiting

**Self-hosted:** The auth backend can be run locally via Docker. BYOK mode bypasses the backend entirely — users paste API keys into PM-OS settings.

## MVP Scope (v0.1)

| Extension | Scope |
|-----------|-------|
| Shell (Fork) | Rebranded VS Code, PM theme, welcome screen, panel layout presets, BrowserView Panel API |
| Slack Panel | Webview + AI context bar (channel summary, thread summary) |
| Notion Panel | Webview + AI context bar (page summary, PRD drafting) |
| Browser Panel | Webview + AI context bar (page summary, clip-to-project) |
| Markdown Viewer | Auto-render .md on open, GFM support, split view editing, mermaid diagrams, PDF export |
| AI Assistant | Sidebar chat + terminal. 5 built-in skills. Project-aware. |
| Project Manager | Create/switch projects, CLAUDE.md, memory, links.json, decision log |
| Automation Engine | 2-3 preset templates, YAML config, background scheduler |
| MCP/Plugin Manager | Load from .mcp.json, manual install, pre-bundled configs |
| Auth | Slack + Notion OAuth, BYOK fallback, keychain storage |

## Tech Stack

- **Desktop shell**: VS Code fork (Electron, TypeScript)
- **Extensions**: TypeScript (VS Code Extension API)
- **Auth backend**: Node.js/TypeScript + PostgreSQL
- **AI**: Claude API via Anthropic SDK
- **APIs**: Slack Web API, Notion API, standard web APIs
- **Build**: VS Code's existing build system (gulp) + extension bundling (esbuild)
- **Extension registry**: Open VSX (Microsoft's marketplace ToS prohibits use by forks) or no marketplace in v0.1

## Collaboration (v0.1)

Projects are Git repositories, enabling team collaboration out of the box:

- Each project is initialized as a git repo (or can be linked to an existing one)
- PMs share projects by pushing to a remote (GitHub, GitLab, etc.)
- Local docs, CLAUDE.md, config, links.json, automation configs — all version-controlled
- `.memory/project/` is committed — shared AI context about the project (decisions, learnings, patterns) available to all team members
- `.memory/user/` is `.gitignore`d — personal AI memory (preferences, individual workflow notes) stays local
- Decision log entries get committed with timestamps and author attribution
- Standard git workflows apply: branches, pull requests, merge

This gives PMs version history, conflict resolution, and team sharing without building custom sync infrastructure.

## Future Roadmap (Post v0.1)

1. **Extension marketplace** — Own marketplace or GitHub-based registry for community extensions
2. **Offline mode** — Graceful degradation when no internet (project management works, AI/API features disabled)
3. **Mobile companion** — Read-only mobile view of project state and automation results
