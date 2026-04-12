/**
 * A handle that can be disposed to release resources or unsubscribe.
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Describes an extension's metadata, loaded from its package.json.
 */
export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  main: string;
  activationEvents?: string[];
  contributes?: {
    commands?: CommandContribution[];
    panels?: PanelContribution[];
    sidebarViews?: SidebarViewContribution[];
  };
}

/**
 * A command contribution registered by an extension.
 */
export interface CommandContribution {
  command: string;
  title: string;
  category?: string;
  icon?: string;
}

/**
 * A panel contribution registered by an extension.
 */
export interface PanelContribution {
  id: string;
  title: string;
  icon?: string;
  defaultPosition?: string;
}

/**
 * A sidebar view contribution registered by an extension.
 */
export interface SidebarViewContribution {
  id: string;
  title: string;
  icon?: string;
}

/**
 * Context provided to an extension when it activates.
 */
export interface ExtensionContext {
  extensionId: string;
  extensionPath: string;
  subscriptions: Disposable[];
  globalState: StateStorage;
  workspaceState: StateStorage;
}

/**
 * Simple key-value state storage for extensions.
 */
export interface StateStorage {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
}

/**
 * The interface every PM-OS extension must implement.
 */
export interface Extension {
  activate(context: ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
