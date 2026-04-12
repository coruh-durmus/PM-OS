import type { Extension, ExtensionContext } from '@pm-os/types';
import { Keychain } from './keychain.js';
import { startOAuthFlow } from './oauth-flow.js';

export { Keychain } from './keychain.js';
export { startOAuthFlow } from './oauth-flow.js';

const authExtension: Extension = {
  activate(context: ExtensionContext) {
    // Initialize keychain with a storage path derived from global state
    const storagePath =
      (context.globalState.get('auth:storagePath') as string) ?? '.pm-os/credentials';
    const keychain = new Keychain(storagePath);

    // Expose keychain instance for other extensions
    context.globalState.set('auth:keychain', keychain);

    // Expose the OAuth flow starter
    context.globalState.set('auth:startOAuthFlow', startOAuthFlow);
  },

  deactivate() {
    // Cleanup handled by subscriptions
  },
};

export default authExtension;
export { authExtension };
