import * as esbuild from 'esbuild';
import { cpSync } from 'node:fs';

// Bundle the webview viewer.ts for the browser
await esbuild.build({
  entryPoints: ['src/webview/viewer.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'dist/webview/viewer.js',
  minify: false,
  sourcemap: true,
});

// Copy static webview assets (HTML, CSS) to dist
cpSync('src/webview/index.html', 'dist/webview/index.html');
cpSync('src/webview/styles.css', 'dist/webview/styles.css');

console.log('Build complete: main (tsc) + webview (esbuild) + static assets copied');
