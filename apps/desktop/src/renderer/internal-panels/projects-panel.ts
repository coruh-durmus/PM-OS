import { ExplorerPanel } from './explorer-panel.js';

export class ProjectsPanel {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = container;
  }

  async render(): Promise<void> {
    while (this.el.firstChild) this.el.removeChild(this.el.firstChild);
    this.el.style.cssText = 'display: flex; flex-direction: column; height: 100%;';

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

  private showCreateInput(): void {
    // Check if input already showing
    if (this.el.querySelector('.create-project-input')) return;

    const header = this.el.querySelector('div');
    if (!header) return;

    const inputRow = document.createElement('div');
    inputRow.className = 'create-project-input';
    inputRow.style.cssText = 'padding: 6px 12px; border-bottom: 1px solid var(--border); display: flex; gap: 6px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Project name...';
    input.style.cssText = 'flex: 1; padding: 4px 8px; background: var(--bg-primary); border: 1px solid var(--accent); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 12px; outline: none; font-family: var(--font-sans);';

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '✓';
    confirmBtn.style.cssText = 'padding: 4px 8px; background: var(--accent); color: #1e1e2e; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; font-weight: 600;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '✕';
    cancelBtn.style.cssText = 'padding: 4px 8px; background: none; border: 1px solid var(--border); color: var(--text-muted); border-radius: var(--radius-sm); cursor: pointer; font-size: 12px;';

    const doCreate = async () => {
      const name = input.value.trim();
      if (!name) return;
      confirmBtn.textContent = '...';
      confirmBtn.disabled = true;
      try {
        await (window as any).pmOs.project.create(name);
        this.render();
      } catch (err: any) {
        input.style.borderColor = 'var(--error)';
        input.value = '';
        input.placeholder = 'Error: ' + (err.message || 'Failed');
      }
    };

    const doCancel = () => {
      inputRow.remove();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doCreate();
      if (e.key === 'Escape') doCancel();
    });
    confirmBtn.addEventListener('click', doCreate);
    cancelBtn.addEventListener('click', doCancel);

    inputRow.appendChild(input);
    inputRow.appendChild(confirmBtn);
    inputRow.appendChild(cancelBtn);

    // Insert after header
    header.insertAdjacentElement('afterend', inputRow);
    input.focus();
  }
}
