---
name: release-mac
description: Cut a new PMOS Mac release — bump version, build signed + notarized DMG, tag, push, create GitHub release with the asset attached. Use when the user asks to release, ship, publish, cut a build, or bump the version. Takes a SemVer level (patch/minor/major) or an explicit version like 0.1.2.
disable-model-invocation: true
---

# Release a new Mac build

End-to-end release flow for the PMOS Mac DMG. Runs from the repo root.

## Inputs

`$ARGUMENTS` is one of:
- `patch` (default if empty) — bump the third digit
- `minor` — bump the second digit, reset patch to 0
- `major` — bump the first digit, reset minor and patch to 0
- An explicit SemVer like `0.1.2` or `1.0.0`

## Preconditions

Verify before doing anything destructive:

1. `git status` is clean (no uncommitted changes — the release commit must be reproducible).
2. `apps/desktop/.env` exists with `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. If missing, stop and tell the user — without these, notarization fails after a successful build (wasted ~10 min).
3. `security find-identity -v -p codesigning` shows a `Developer ID Application` cert. If only `Apple Development` is present, stop — see CLAUDE.md "Releasing the Mac DMG".
4. The user is on `main` (or has explicitly approved releasing from another branch).
5. `git fetch && git status` shows up-to-date with `origin/main` — don't release with un-pulled commits.

If any precondition fails, stop and ask before proceeding.

## Steps

1. **Compute the new version.** Read `apps/desktop/package.json` and `package.json` to confirm they match. Compute the new version per `$ARGUMENTS` (default `patch`). Confirm the result with the user before writing.

2. **Bump version in both files.**
   - `apps/desktop/package.json` — `version` field
   - `package.json` (root) — `version` field
   - `pnpm-lock.yaml` — usually doesn't need editing for version bumps, but run `pnpm install --lockfile-only` if it does.

3. **Build the signed + notarized DMG.**
   ```
   pnpm release:mac
   ```
   This takes 5–15 minutes (build + notary upload + Apple's queue + staple). Run with `run_in_background: true` and a 15-minute timeout. Surface the output file path when done.

4. **Verify the artifact.** After the build:
   ```
   ls -lh apps/desktop/release/PMOS-<version>-arm64.dmg
   spctl -a -vv apps/desktop/release/mac-arm64/PMOS.app
   ```
   The `spctl` call must say `accepted` and `source=Notarized Developer ID`. If not, stop — do not publish a broken build.

5. **Commit, tag, push.**
   ```
   git add apps/desktop/package.json package.json pnpm-lock.yaml
   git commit -m "chore(release): <version>"
   git tag v<version>
   git push && git push --tags
   ```

6. **Create the GitHub release with the asset attached.**
   ```
   gh release create v<version> apps/desktop/release/PMOS-<version>-arm64.dmg \
     --title "PMOS <version>" \
     --notes "$(cat <<'EOF'
   <release notes — see below for default template>
   EOF
   )"
   ```

   Default release-notes template (adapt for what actually changed since the last tag):
   ```markdown
   <one-line summary of the release>

   ## Install
   Download `PMOS-<version>-arm64.dmg`, mount, drag PMOS into Applications.

   This build is signed with a Developer ID and notarized — Gatekeeper accepts it on first launch.

   ## What's new
   - <bullet list — derive from `git log v<previous>..HEAD --oneline`>

   ## Known limitations
   - Apple Silicon only.
   - No auto-update yet — check Releases manually for newer versions.

   Bug reports: https://github.com/coruh-durmus/PM-OS/issues
   ```

   For "What's new", run `git log v<previous>..HEAD --oneline` and summarize.

7. **Confirm.** Print the release URL. Do not also push the DMG anywhere else (no S3, no manual mirrors) unless explicitly asked.

## Re-cutting an existing version

If the build had to be re-done for the same version (e.g., a fix landed before users downloaded):

```
gh release upload v<version> apps/desktop/release/PMOS-<version>-arm64.dmg --clobber
```

Then update the release notes if the previous text mentions issues that are now fixed:
```
gh release edit v<version> --notes "$(cat <<'EOF'
...
EOF
)"
```

## Failure modes to watch for

- **`pnpm: command not found`** in subshell — shell PATH may not include `~/.local/bin`. Use the full path or just `pnpm` from the user's interactive shell.
- **`electron-builder: command not found`** — `node_modules` is missing or symlinks were cleaned. Run `pnpm install` from root and retry.
- **Notarization stalled >20 min** — Apple's queue is backed up. `notarytool history` shows status. If stuck, the build can be resubmitted; don't kill electron-builder mid-process.
- **DMG `spctl` fails but `.app` passes** — that's expected. The `.app` inside is what Gatekeeper actually verifies; the DMG container itself is unsigned and that's fine.
- **Wrong cert picked for signing** — if you have multiple Developer ID Application certs, electron-builder may pick the wrong one. Set `mac.identity` in `apps/desktop/package.json` explicitly to the cert SHA.
