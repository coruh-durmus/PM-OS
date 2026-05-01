#!/usr/bin/env bash
# Build and package the Mac DMG.
#
# Why the dance: pnpm creates symlinks at apps/desktop/node_modules/@pm-os/*
# pointing to packages/* outside apps/desktop/. electron-builder follows
# those symlinks during asar packaging and aborts because the resolved real
# paths are outside the app directory. Those workspace deps are already
# bundled into dist/main/index.js by esbuild, so they're not needed at
# packaging time. Remove the symlinks, package, then restore via pnpm install.

set -e
cd "$(dirname "$0")/.."

cleanup() {
  ( cd ../.. && pnpm install --silent ) >/dev/null 2>&1 || true
}
trap cleanup EXIT

rm -rf node_modules/@pm-os
electron-builder --mac --arm64 --publish=never
