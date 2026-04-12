import type { Extension, ExtensionContext } from '@pm-os/types';
import { renderMarkdown } from './renderer.js';

export { renderMarkdown } from './renderer.js';

const markdownViewer: Extension = {
  activate(context: ExtensionContext): void {
    console.log(`[${context.extensionId}] Markdown Viewer activated`);
  },

  deactivate(): void {
    console.log('[markdown-viewer] Markdown Viewer deactivated');
  },
};

export default markdownViewer;
