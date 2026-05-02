# PMOS

Open-beta desktop app for project managers — VS Code-style explorer, embedded
Slack/Notion/Figma/Jira panels, terminal, Claude integration, Open VSX
marketplace.

## Download — macOS (Apple Silicon)

[**PMOS-0.1.1-arm64.dmg**](https://github.com/coruh-durmus/PM-OS/releases/latest)

Requirements: macOS 11+ on M1/M2/M3/M4. Intel Macs are not supported in 0.1.1.

## Install

Open the DMG and drag **PMOS** into Applications, then launch it. The build is signed with a Developer ID and notarized by Apple — Gatekeeper accepts it on first launch with no extra steps.

## Reporting issues

Bugs and feedback: <https://github.com/coruh-durmus/PM-OS/issues>

## Build from source

```bash
pnpm install
pnpm dev
```

Native module rebuild (Apple Silicon / Electron 41):

```bash
cd apps/desktop && npx @electron/rebuild -f -w node-pty
```

Package a signed + notarized DMG (arm64). Requires `apps/desktop/.env` with `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`:

```bash
pnpm release:mac
# output: apps/desktop/release/PMOS-<version>-arm64.dmg
```
