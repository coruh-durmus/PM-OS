interface TerminalInstanceInfo {
  id: string;
  shellName: string;
  workspaceName: string;
  el: HTMLElement;
}

interface InstancesPanelCallbacks {
  onSwitch: (id: string) => void;
  onKill: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export class TerminalInstancesPanel {
  private el: HTMLElement;
  private listEl: HTMLElement;
  private instances: TerminalInstanceInfo[] = [];
  private activeId: string | null = null;
  private callbacks: InstancesPanelCallbacks;

  constructor(container: HTMLElement, callbacks: InstancesPanelCallbacks) {
    this.el = container;
    this.callbacks = callbacks;

    this.el.style.cssText = 'width: 200px; background: var(--bg-secondary); border-left: 1px solid var(--border); overflow-y: auto; flex-shrink: 0; display: none;';

    this.listEl = document.createElement('div');
    this.listEl.style.cssText = 'padding: 4px 0;';
    this.el.appendChild(this.listEl);
  }

  addInstance(id: string, shellName: string, workspaceName: string): void {
    const row = document.createElement('div');
    row.className = 'terminal-instance';
    row.dataset.id = id;
    row.style.cssText = 'height: 22px; padding: 0 8px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: background var(--transition-fast); position: relative; border-left: 2px solid transparent;';

    const icon = document.createElement('span');
    icon.className = 'codicon codicon-terminal';
    icon.style.cssText = 'flex-shrink: 0; color: var(--text-muted);';
    row.appendChild(icon);

    const info = document.createElement('div');
    info.className = 'terminal-instance-info';
    info.style.cssText = 'flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px;';

    const nameEl = document.createElement('span');
    nameEl.className = 'terminal-instance-name';
    nameEl.style.cssText = 'font-size: 11px; color: var(--text-primary); font-weight: 500; white-space: nowrap;';
    nameEl.textContent = shellName;
    info.appendChild(nameEl);

    const wsEl = document.createElement('span');
    wsEl.className = 'terminal-instance-workspace';
    wsEl.style.cssText = 'font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    wsEl.textContent = workspaceName;
    info.appendChild(wsEl);

    row.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'terminal-instance-actions';
    actions.style.cssText = 'display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity var(--transition-fast); flex-shrink: 0;';

    const renameBtn = this.createInstanceAction('codicon-edit', 'Rename', () => {
      this.startInlineRename(id, nameEl);
    });
    actions.appendChild(renameBtn);

    const killBtn = this.createInstanceAction('codicon-trash', 'Kill', () => {
      this.callbacks.onKill(id);
    });
    killBtn.addEventListener('mouseenter', () => { killBtn.style.color = 'var(--error)'; });
    killBtn.addEventListener('mouseleave', () => { killBtn.style.color = 'var(--text-muted)'; });
    actions.appendChild(killBtn);

    row.appendChild(actions);

    row.addEventListener('mouseenter', () => {
      if (this.activeId !== id) row.style.background = 'rgba(69, 71, 90, 0.5)';
      actions.style.opacity = '1';
    });
    row.addEventListener('mouseleave', () => {
      if (this.activeId !== id) row.style.background = '';
      actions.style.opacity = '0';
    });

    row.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.terminal-instance-actions')) {
        this.callbacks.onSwitch(id);
      }
    });

    this.listEl.appendChild(row);
    this.instances.push({ id, shellName, workspaceName, el: row });
    this.updateVisibility();
  }

  removeInstance(id: string): void {
    const index = this.instances.findIndex(i => i.id === id);
    if (index === -1) return;
    this.instances[index].el.remove();
    this.instances.splice(index, 1);
    this.updateVisibility();
  }

  setActive(id: string): void {
    this.activeId = id;
    for (const inst of this.instances) {
      if (inst.id === id) {
        inst.el.style.background = 'var(--bg-hover)';
        inst.el.style.borderLeftColor = 'var(--accent)';
      } else {
        inst.el.style.background = '';
        inst.el.style.borderLeftColor = 'transparent';
      }
    }
  }

  renameInstance(id: string, name: string): void {
    const inst = this.instances.find(i => i.id === id);
    if (!inst) return;
    inst.shellName = name;
    const nameEl = inst.el.querySelector('.terminal-instance-name') as HTMLElement;
    if (nameEl) nameEl.textContent = name;
  }

  updateInstanceId(oldId: string, newId: string): void {
    const inst = this.instances.find(i => i.id === oldId);
    if (inst) {
      inst.id = newId;
      inst.el.dataset.id = newId;
    }
    if (this.activeId === oldId) {
      this.activeId = newId;
    }
  }

  get count(): number {
    return this.instances.length;
  }

  get isVisible(): boolean {
    return this.el.style.display !== 'none';
  }

  private updateVisibility(): void {
    if (this.instances.length >= 2) {
      this.el.style.display = 'block';
    } else {
      this.el.style.display = 'none';
    }
  }

  private createInstanceAction(icon: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.style.cssText = 'width: 18px; height: 18px; border: none; background: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; padding: 0; transition: color var(--transition-fast), background var(--transition-fast);';
    const iconEl = document.createElement('span');
    iconEl.className = `codicon ${icon}`;
    btn.appendChild(iconEl);
    btn.title = title;
    btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--bg-hover)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = ''; });
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  private startInlineRename(id: string, nameEl: HTMLElement): void {
    const inst = this.instances.find(i => i.id === id);
    if (!inst) return;

    const currentName = inst.shellName;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.style.cssText = 'width: 80px; font-size: 12px; font-weight: 500; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--accent); border-radius: 2px; padding: 0 4px; outline: none; font-family: inherit;';

    nameEl.textContent = '';
    nameEl.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      const newName = input.value.trim() || currentName;
      nameEl.textContent = newName;
      inst.shellName = newName;
      this.callbacks.onRename(id, newName);
    };

    const cancel = () => {
      nameEl.textContent = currentName;
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });

    input.addEventListener('blur', () => { commit(); });
  }
}
