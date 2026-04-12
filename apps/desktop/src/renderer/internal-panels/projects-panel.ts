import { ExplorerPanel } from './explorer-panel.js';

export class ProjectsPanel {
  private el: HTMLElement;
  private explorer: ExplorerPanel;

  constructor(container: HTMLElement) {
    this.el = container;
    this.explorer = new ExplorerPanel(container);
  }

  async render(): Promise<void> {
    this.el.textContent = '';
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
    createBtn.addEventListener('click', () => this.createProject());
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

  private async createProject(): Promise<void> {
    const name = prompt('Project name:');
    if (!name || !name.trim()) return;
    try {
      await (window as any).pmOs.project.create(name.trim());
      this.render();
    } catch (err: any) {
      alert('Failed to create project: ' + (err.message || err));
    }
  }
}
