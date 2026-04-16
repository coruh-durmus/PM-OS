export type {
  Disposable,
  ExtensionManifest,
  CommandContribution,
  PanelContribution,
  SidebarViewContribution,
  ExtensionContext,
  StateStorage,
  Extension,
  ExtensionDependency,
  ExtensionDependencyVariant,
  ExtensionRegistryEntry,
  ExtensionRegistry,
  ExtensionInstallProgress,
  InstalledExtensionState,
} from './extension.js';

export type {
  PanelBounds,
  WebContentsViewOptions,
  WebContentsViewState,
  PanelPosition,
  PanelDescriptor,
  PanelApi,
} from './panel.js';

export type {
  ProjectConfig,
  ProjectSettings,
  ProjectLink,
  DecisionLogEntry,
  ProjectState,
  ProjectSummary,
} from './project.js';

export type {
  EventMap,
  EventName,
  EventPayload,
  EventHandler,
} from './events.js';

export type {
  AiSummaryRequest,
  AiDraftRequest,
  AiChatMessage,
  AiCostEstimate,
  ClaudeClientOptions,
} from './ai.js';
