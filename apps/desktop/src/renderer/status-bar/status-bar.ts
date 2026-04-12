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
  }

  setProject(name: string): void {
    if (this.projectEl) {
      this.projectEl.textContent = name;
    }
  }
}
