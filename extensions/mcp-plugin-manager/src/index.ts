import type { Extension, ExtensionContext } from '@pm-os/types';
import { loadMcpConfig } from './loader.js';
import type { McpServerConfig } from './loader.js';

export { loadMcpConfig } from './loader.js';
export type { McpServerConfig } from './loader.js';

const mcpPluginManagerExtension: Extension = {
  activate(context: ExtensionContext) {
    // Expose the MCP config loader for other extensions / the shell
    context.globalState.set('mcp:loadConfig', loadMcpConfig);
  },

  deactivate() {
    // Cleanup handled by subscriptions
  },
};

export default mcpPluginManagerExtension;
export { mcpPluginManagerExtension };
