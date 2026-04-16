import { ExplorerPanel } from './explorer-panel.js';

export class ProjectsPanel {
  private el: HTMLElement;
  private disposeWorkspaceListener: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.el = container;
  }

  async render(): Promise<void> {
    while (this.el.firstChild) this.el.removeChild(this.el.firstChild);
    this.el.style.cssText = 'display: flex; flex-direction: column; height: 100%;';

    // Clean up previous workspace listener
    if (this.disposeWorkspaceListener) {
      this.disposeWorkspaceListener();
      this.disposeWorkspaceListener = null;
    }

    // Check if a workspace is open before rendering project UI
    let workspaceOpen = false;
    try {
      workspaceOpen = await (window as any).pmOs.workspace.isOpen();
    } catch {
      workspaceOpen = false;
    }

    // Always listen for workspace changes (both open→close and close→open)
    this.disposeWorkspaceListener = (window as any).pmOs.workspace.onChanged(() => {
      this.render();
    });

    if (!workspaceOpen) {
      this.renderNoWorkspace();
      return;
    }

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); flex-shrink: 0;';

    const title = document.createElement('span');
    title.textContent = 'PROJECTS';
    title.style.cssText = 'font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);';
    header.appendChild(title);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 4px;';

    const createBtn = document.createElement('button');
    createBtn.textContent = '+';
    createBtn.title = 'New Project';
    createBtn.style.cssText = 'width: 22px; height: 22px; background: none; border: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); font-size: 16px; display: flex; align-items: center; justify-content: center;';
    createBtn.addEventListener('mouseenter', () => createBtn.style.color = 'var(--text-primary)');
    createBtn.addEventListener('mouseleave', () => createBtn.style.color = 'var(--text-muted)');
    createBtn.addEventListener('click', () => this.showCreateInput());
    btnRow.appendChild(createBtn);

    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '\u21BB';
    refreshBtn.title = 'Refresh';
    refreshBtn.style.cssText = createBtn.style.cssText;
    refreshBtn.addEventListener('mouseenter', () => refreshBtn.style.color = 'var(--text-primary)');
    refreshBtn.addEventListener('mouseleave', () => refreshBtn.style.color = 'var(--text-muted)');
    refreshBtn.addEventListener('click', () => this.render());
    btnRow.appendChild(refreshBtn);

    header.appendChild(btnRow);
    this.el.appendChild(header);

    // Explorer tree
    const treeContainer = document.createElement('div');
    treeContainer.style.cssText = 'flex: 1; overflow-y: auto;';
    this.el.appendChild(treeContainer);

    const explorer = new ExplorerPanel(treeContainer);
    await explorer.render();
  }

  private renderNoWorkspace(): void {
    const emptyState = document.createElement('div');
    emptyState.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 24px; text-align: center;';

    const msg = document.createElement('div');
    msg.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5;';
    msg.textContent = 'Open a workspace to manage projects';
    emptyState.appendChild(msg);

    const openBtn = document.createElement('button');
    openBtn.textContent = 'Open Workspace';
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

  private showCreateInput(): void {
    // Check if form already showing
    if (this.el.querySelector('.create-project-form')) return;

    const header = this.el.querySelector('div');
    if (!header) return;

    const form = document.createElement('div');
    form.className = 'create-project-form';
    form.style.cssText = 'padding: 10px 12px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Project name...';
    input.style.cssText = 'width: 100%; padding: 6px 8px; background: var(--bg-primary); border: 1px solid var(--accent); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 12px; outline: none; font-family: var(--font-sans); box-sizing: border-box;';

    const errorText = document.createElement('div');
    errorText.style.cssText = 'font-size: 11px; color: var(--error); display: none;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 6px; justify-content: flex-end;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding: 4px 10px; background: none; border: 1px solid var(--border); color: var(--text-muted); border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; font-family: var(--font-sans);';
    cancelBtn.addEventListener('click', () => form.remove());

    const createBtn = document.createElement('button');
    createBtn.textContent = 'Create';
    createBtn.style.cssText = 'padding: 4px 10px; background: var(--accent); color: #1e1e2e; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; font-weight: 600; font-family: var(--font-sans);';

    const doCreate = async () => {
      const name = input.value.trim();
      if (!name) {
        input.style.borderColor = 'var(--error)';
        input.placeholder = 'Name is required';
        return;
      }
      errorText.style.display = 'none';
      createBtn.textContent = 'Creating...';
      createBtn.style.opacity = '0.7';
      (createBtn as HTMLButtonElement).disabled = true;
      try {
        await (window as any).pmOs.project.create(name);
        this.render();
      } catch (err: any) {
        errorText.textContent = err?.message || 'Failed to create project';
        errorText.style.display = 'block';
        createBtn.textContent = 'Create';
        createBtn.style.opacity = '1';
        (createBtn as HTMLButtonElement).disabled = false;
      }
    };

    createBtn.addEventListener('click', doCreate);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doCreate();
      if (e.key === 'Escape') form.remove();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(createBtn);
    form.appendChild(input);
    form.appendChild(errorText);
    form.appendChild(btnRow);

    // Insert after header
    header.insertAdjacentElement('afterend', form);

    // Focus after DOM insertion
    requestAnimationFrame(() => input.focus());
  }
}
