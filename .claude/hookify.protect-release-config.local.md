---
name: protect-release-config
enabled: true
event: edit
pattern: (apps/desktop/\.env|apps/desktop/build/entitlements\.mac\.plist|apps/desktop/package\.json)
action: warn
---

**Release-critical file edit — confirm intent before changing.**

You are about to edit a file that controls Mac code-signing or notarization:

- `apps/desktop/.env` — Apple ID, app-specific password, team ID
- `apps/desktop/build/entitlements.mac.plist` — hardened-runtime entitlements
- `apps/desktop/package.json` — `build.mac` block (identity, notarize, hardenedRuntime)

A wrong change here can:
- Break notarization for the next release (hours of debugging)
- Leak Apple credentials if `.env` is committed
- Make existing distributed builds fail Gatekeeper checks

Before proceeding:
1. Confirm the user explicitly asked for this edit (or it's a clear follow-up to one).
2. If editing `.env`, double-check the file is in `.gitignore` — never commit credentials.
3. If editing `package.json` `build.mac`, mention what you are changing and why before applying.
4. After the edit, suggest a verification path (`pnpm release:mac` then `spctl -a -vv` on the resulting `.app`).
