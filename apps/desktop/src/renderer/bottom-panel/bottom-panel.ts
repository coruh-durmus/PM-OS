import { TerminalPanel } from '../terminal/terminal.js';

export class BottomPanel {
  private el: HTMLElement;
  private contentEl: HTMLElement;
  private resizeHandle: HTMLElement;
  private closeBtn: HTMLElement;
  private terminal: TerminalPanel | null = null;
  private initialized = false;
  private visible = false;

  constructor(el: HTMLElement) {
    this.el = el;
    this.contentEl = el.querySelector('#bottom-panel-content')!;
    this.resizeHandle = el.querySelector('#bottom-panel-resize-handle')!;
    this.closeBtn = el.querySelector('#bottom-panel-close')!;

    this.closeBtn.addEventListener('click', () => this.hide());
    this.setupResize();
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    this.el.classList.remove('hidden');
    this.visible = true;

    if (!this.initialized) {
      this.initialized = true;
      const container = document.createElement('div');
      container.className = 'terminal-container';
      this.contentEl.appendChild(container);

      this.terminal = new TerminalPanel(container);
      this.terminal.init().catch(() => {});
    } else {
      this.terminal?.focus();
    }
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.visible = false;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private setupResize(): void {
    let startY = 0;
    let startHeight = 0;

    const onMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight * 0.7, startHeight + delta));
      this.el.style.height = `${newHeight}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    this.resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      startY = e.clientY;
      startHeight = this.el.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }
}
