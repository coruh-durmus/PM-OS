# PMOS

Open-beta desktop app for project managers — VS Code-style explorer, embedded
Slack/Notion/Figma/Jira panels, terminal, Claude integration, Open VSX
marketplace.

## Download — macOS (Apple Silicon)

[**PMOS-0.1.1-arm64.dmg**](https://github.com/coruh-durmus/PM-OS/releases/latest)

Requirements: macOS 11+ on M1/M2/M3/M4. Intel Macs are not supported in 0.1.1.

## Install

1. Open the DMG and drag **PMOS** into Applications.
2. **First launch:** macOS shows _"PMOS can't be opened because Apple cannot
   check it for malicious software"_ — this beta is not yet code-signed.
   Bypass:
   - In `/Applications`, right-click **PMOS → Open**, then click **Open** in
     the dialog. macOS remembers the choice and won't ask again.
   - Or from Terminal: `xattr -cr /Applications/PMOS.app`

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

Package a local DMG (arm64, unsigned):

```bash
pnpm release:mac
# output: apps/desktop/release/PMOS-0.1.1-arm64.dmg
```
