import { ExplorerPanel } from './explorer-panel.js';

interface ProjectsPanelOptions {
  onOpenFile?: (entry: { name: string; path: string; isDirectory: boolean }) => void;
}

export class ProjectsPanel {
  private el: HTMLElement;
  private disposeWorkspaceListener: (() => void) | null = null;
  private options: ProjectsPanelOptions;

  constructor(container: HTMLElement, options?: ProjectsPanelOptions) {
    this.el = container;
    this.options = options || {};
  }

  async render(): Promise<void> {
    while (this.el.firstChild) this.el.removeChild(this.el.firstChild);
    this.el.style.cssText = 'display: flex; flex-direction: column; height: 100%;';

    // Clean up previous workspace listener
    if (this.disposeWorkspaceListener) {
      this.disposeWorkspaceListener();
      this.disposeWorkspaceListener = null;
    }

    // Check if a workspace is open
    let workspaceOpen = false;
    try {
      workspaceOpen = await (window as any).pmOs.workspace.isOpen();
    } catch {
      workspaceOpen = false;
    }

    // Listen for workspace changes (both open→close and close→open)
    this.disposeWorkspaceListener = (window as any).pmOs.workspace.onChanged(() => {
      this.render();
    });

    if (!workspaceOpen) {
      this.renderNoWorkspace();
      return;
    }

    // Explorer tree (fills the entire panel)
    const treeContainer = document.createElement('div');
    treeContainer.style.cssText = 'flex: 1; overflow-y: auto;';
    this.el.appendChild(treeContainer);

    const explorer = new ExplorerPanel(treeContainer, { onOpenFile: this.options.onOpenFile });
    await explorer.render();
  }

  private renderNoWorkspace(): void {
    const emptyState = document.createElement('div');
    emptyState.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 24px; text-align: center;';

    const msg = document.createElement('div');
    msg.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5;';
    msg.textContent = 'Open a workspace to get started';
    emptyState.appendChild(msg);

    const openBtn = document.createElement('button');
    openBtn.textContent = 'Open Folder';
    openBtn.style.cssText = 'padding: 8px 20px; background: var(--accent); color: var(--bg-primary); border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--font-sans); transition: background 0.15s;';
    openBtn.addEventListener('mouseenter', () => openBtn.style.background = 'var(--accent-hover)');
    openBtn.addEventListener('mouseleave', () => openBtn.style.background = 'var(--accent)');
    openBtn.addEventListener('click', () => {
      (window as any).pmOs.workspace.openFolder();
    });
    emptyState.appendChild(openBtn);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size: 11px; color: var(--text-muted); margin-top: 10px;';
    const hintText = document.createTextNode('or press ');
    hint.appendChild(hintText);
    const kbd = document.createElement('kbd');
    kbd.style.cssText = 'font-family: var(--font-mono); font-size: 10px; background: var(--bg-surface); padding: 1px 6px; border-radius: 3px; border: 1px solid var(--border);';
    kbd.textContent = 'Cmd+O';
    hint.appendChild(kbd);
    emptyState.appendChild(hint);

    this.el.appendChild(emptyState);
  }
}
