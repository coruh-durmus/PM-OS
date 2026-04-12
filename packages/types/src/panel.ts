/**
 * Rectangle bounds for positioning a panel or WebContentsView.
 */
export interface PanelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Options for creating a WebContentsView-backed panel.
 */
export interface WebContentsViewOptions {
  id: string;
  url: string;
  partition?: string;
  bounds?: PanelBounds;
  show?: boolean;
}

/**
 * Observable state of a WebContentsView panel.
 */
export interface WebContentsViewState {
  id: string;
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

/**
 * Where a panel can be placed in the shell layout.
 */
export type PanelPosition = 'main' | 'left' | 'right' | 'bottom';

/**
 * Describes a panel that an extension contributes to the shell.
 */
export interface PanelDescriptor {
  id: string;
  title: string;
  icon?: string;
  position: PanelPosition;
  closable?: boolean;
  webContentsViewOptions?: WebContentsViewOptions;
}

/**
 * API surface that the shell exposes for controlling a panel.
 */
export interface PanelApi {
  show(): void;
  hide(): void;
  focus(): void;
  setBounds(bounds: PanelBounds): void;
  navigate(url: string): void;
  reload(): void;
  goBack(): void;
  goForward(): void;
  getState(): WebContentsViewState;
  onStateChanged(handler: (state: WebContentsViewState) => void): { dispose(): void };
}
