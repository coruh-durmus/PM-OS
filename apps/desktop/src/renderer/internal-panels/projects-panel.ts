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
    // Check if wizard already showing
    if (this.el.querySelector('.create-project-wizard')) return;

    const header = this.el.querySelector('div');
    if (!header) return;

    const wizard = document.createElement('div');
    wizard.className = 'create-project-wizard';
    wizard.style.cssText = 'padding: 10px 12px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px;';

    let currentStep = 1;
    let projectName = '';
    let selectedType = '';

    const projectTypes = [
      { id: 'new-feature', emoji: '\u{1F680}', label: 'New Feature', desc: 'Building a new product feature' },
      { id: 'research', emoji: '\u{1F52C}', label: 'Research', desc: 'User research, market analysis' },
      { id: 'bug-fix', emoji: '\u{1F41B}', label: 'Bug Fix', desc: 'Fixing issues or improving features' },
      { id: 'strategy', emoji: '\u{1F4CA}', label: 'Strategy', desc: 'Roadmap, OKRs, planning' },
      { id: 'documentation', emoji: '\u{1F4DD}', label: 'Docs', desc: 'Specs, runbooks, onboarding' },
      { id: 'custom', emoji: '\u{1F3AF}', label: 'Custom', desc: 'Start with a blank project' },
    ];

    const renderStep = () => {
      wizard.innerHTML = '';

      // Step indicator
      const stepIndicator = document.createElement('div');
      stepIndicator.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 2px;';
      const dot1 = document.createElement('div');
      dot1.style.cssText = `width: 6px; height: 6px; border-radius: 50%; background: ${currentStep >= 1 ? 'var(--accent)' : 'var(--border)'};`;
      const dot2 = document.createElement('div');
      dot2.style.cssText = `width: 6px; height: 6px; border-radius: 50%; background: ${currentStep >= 2 ? 'var(--accent)' : 'var(--border)'};`;
      const stepLabel = document.createElement('span');
      stepLabel.style.cssText = 'font-size: 10px; color: var(--text-muted); margin-left: 4px;';
      stepLabel.textContent = currentStep === 1 ? 'Step 1 of 2 — Name' : 'Step 2 of 2 — Type';
      stepIndicator.appendChild(dot1);
      stepIndicator.appendChild(dot2);
      stepIndicator.appendChild(stepLabel);
      wizard.appendChild(stepIndicator);

      if (currentStep === 1) {
        // Step 1: Name input
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Project name...';
        input.value = projectName;
        input.style.cssText = 'width: 100%; padding: 6px 8px; background: var(--bg-primary); border: 1px solid var(--accent); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 12px; outline: none; font-family: var(--font-sans); box-sizing: border-box;';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 6px; justify-content: flex-end;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding: 4px 10px; background: none; border: 1px solid var(--border); color: var(--text-muted); border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; font-family: var(--font-sans);';
        cancelBtn.addEventListener('click', () => wizard.remove());

        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next \u2192';
        nextBtn.style.cssText = 'padding: 4px 10px; background: var(--accent); color: #1e1e2e; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; font-weight: 600; font-family: var(--font-sans);';

        const goNext = () => {
          const name = input.value.trim();
          if (!name) {
            input.style.borderColor = 'var(--error)';
            input.placeholder = 'Name is required';
            return;
          }
          projectName = name;
          currentStep = 2;
          renderStep();
        };

        nextBtn.addEventListener('click', goNext);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') goNext();
          if (e.key === 'Escape') wizard.remove();
        });

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(nextBtn);
        wizard.appendChild(input);
        wizard.appendChild(btnRow);

        // Focus after DOM insertion
        requestAnimationFrame(() => input.focus());
      } else {
        // Step 2: Type selection
        const namePreview = document.createElement('div');
        namePreview.style.cssText = 'font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;';
        namePreview.innerHTML = `<span style="color: var(--text-primary); font-weight: 500;">${projectName}</span>`;
        wizard.appendChild(namePreview);

        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px;';

        for (const pt of projectTypes) {
          const card = document.createElement('div');
          card.style.cssText = `padding: 8px; border: 1px solid ${selectedType === pt.id ? 'var(--accent)' : 'var(--border)'}; border-radius: var(--radius-sm); cursor: pointer; transition: border-color 0.15s; background: ${selectedType === pt.id ? 'rgba(137, 180, 250, 0.08)' : 'var(--bg-primary)'};`;
          card.innerHTML = `<div style="font-size: 14px; margin-bottom: 2px;">${pt.emoji} <span style="font-size: 11px; font-weight: 500; color: var(--text-primary);">${pt.label}</span></div><div style="font-size: 10px; color: var(--text-muted); line-height: 1.3;">${pt.desc}</div>`;

          card.addEventListener('mouseenter', () => {
            if (selectedType !== pt.id) card.style.borderColor = 'var(--text-muted)';
          });
          card.addEventListener('mouseleave', () => {
            if (selectedType !== pt.id) card.style.borderColor = 'var(--border)';
          });
          card.addEventListener('click', () => {
            selectedType = pt.id;
            // Update all cards
            const allCards = grid.querySelectorAll('div[data-type-card]');
            allCards.forEach((c: Element) => {
              (c as HTMLElement).style.borderColor = 'var(--border)';
              (c as HTMLElement).style.background = 'var(--bg-primary)';
            });
            card.style.borderColor = 'var(--accent)';
            card.style.background = 'rgba(137, 180, 250, 0.08)';
          });
          card.setAttribute('data-type-card', pt.id);
          grid.appendChild(card);
        }

        wizard.appendChild(grid);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 6px; justify-content: flex-end;';

        const backBtn = document.createElement('button');
        backBtn.textContent = '\u2190 Back';
        backBtn.style.cssText = 'padding: 4px 10px; background: none; border: 1px solid var(--border); color: var(--text-muted); border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; font-family: var(--font-sans);';
        backBtn.addEventListener('click', () => {
          currentStep = 1;
          renderStep();
        });

        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create Project';
        createBtn.style.cssText = 'padding: 4px 10px; background: var(--accent); color: #1e1e2e; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; font-weight: 600; font-family: var(--font-sans);';

        createBtn.addEventListener('click', async () => {
          if (!selectedType) {
            // Flash the grid border briefly
            grid.style.outline = '1px solid var(--error)';
            setTimeout(() => grid.style.outline = 'none', 800);
            return;
          }
          createBtn.textContent = 'Creating...';
          createBtn.style.opacity = '0.7';
          (createBtn as HTMLButtonElement).disabled = true;
          try {
            // Pass type to IPC — 'bug-fix' and 'custom' won't have templates, which is fine
            await (window as any).pmOs.project.create(projectName, selectedType);
            this.render();
          } catch (err: any) {
            createBtn.textContent = 'Error — Retry';
            createBtn.style.opacity = '1';
            (createBtn as HTMLButtonElement).disabled = false;
          }
        });

        btnRow.appendChild(backBtn);
        btnRow.appendChild(createBtn);
        wizard.appendChild(btnRow);
      }
    };

    renderStep();

    // Insert after header
    header.insertAdjacentElement('afterend', wizard);
  }
}
