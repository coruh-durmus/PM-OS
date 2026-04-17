export class StatusBar {
  private el: HTMLElement;
  private projectEl!: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  render(): void {
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    const left = document.createElement('div');
    left.className = 'status-bar-left';
    left.textContent = 'PM-OS v0.1.0';
    this.el.appendChild(left);

    const right = document.createElement('div');
    right.className = 'status-bar-right';
    this.projectEl = document.createElement('span');
    this.projectEl.textContent = 'No project open';
    right.appendChild(this.projectEl);
    this.el.appendChild(right);

    // Listen for extension status bar items
    (window as any).pmOs.extensions?.onStatusBarUpdate?.((data: any) => {
      let item = this.el.querySelector(`[data-ext-status="${data.id}"]`) as HTMLElement;
      if (!item) {
        item = document.createElement('span');
        item.dataset.extStatus = data.id;
        item.style.cssText = 'cursor: pointer; padding: 0 6px; font-size: 11px;';
        this.el.appendChild(item);
      }
      item.textContent = data.text || '';
      item.title = data.tooltip || '';
      if (data.color) item.style.color = data.color;
    });

    (window as any).pmOs.extensions?.onStatusBarRemove?.((data: any) => {
      const item = this.el.querySelector(`[data-ext-status="${data.id}"]`);
      if (item) item.remove();
    });
  }

  setProject(name: string): void {
    if (this.projectEl) {
      this.projectEl.textContent = name;
    }
  }
}
