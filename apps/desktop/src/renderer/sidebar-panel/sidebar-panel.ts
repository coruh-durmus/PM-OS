import { ProjectsPanel } from '../internal-panels/projects-panel.js';
import { ExtensionStorePanel } from '../internal-panels/extension-store-panel.js';
import { SearchPanel } from '../internal-panels/search-panel.js';
import { SourceControlPanel } from '../internal-panels/source-control-panel.js';

export class SidebarPanel {
  private el: HTMLElement;
  private contentEl: HTMLElement;
  private resizeHandle: HTMLElement;
  private visible = false;
  private activeView: string | null = null;
  private onOpenFile?: (entry: { name: string; path: string; isDirectory: boolean }) => void;

  constructor(el: HTMLElement, options?: { onOpenFile?: (entry: { name: string; path: string; isDirectory: boolean }) => void }) {
    this.el = el;
    this.contentEl = el.querySelector('#sidebar-content')!;
    this.resizeHandle = el.querySelector('#sidebar-resize-handle')!;
    this.onOpenFile = options?.onOpenFile;
    this.setupResize();
  }

  toggle(viewId: string): void {
    if (this.visible && this.activeView === viewId) {
      this.hide();
    } else {
      this.show(viewId);
    }
  }

  show(viewId: string): void {
    this.el.classList.remove('hidden');
    this.visible = true;
    this.activeView = viewId;
    this.renderView(viewId);
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.visible = false;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private async renderView(viewId: string): Promise<void> {
    // Clear existing content safely
    while (this.contentEl.firstChild) {
      this.contentEl.removeChild(this.contentEl.firstChild);
    }

    switch (viewId) {
      case 'projects': {
        const panel = new ProjectsPanel(this.contentEl, { onOpenFile: this.onOpenFile });
        await panel.render();
        break;
      }
      case 'extensions': {
        const panel = new ExtensionStorePanel(this.contentEl);
        await panel.render();
        break;
      }
      case 'search': {
        const panel = new SearchPanel(this.contentEl, { onOpenFile: this.onOpenFile });
        await panel.render();
        break;
      }
      case 'source-control': {
        const panel = new SourceControlPanel(this.contentEl, { onOpenFile: this.onOpenFile });
        await panel.render();
        break;
      }
      default: {
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'padding: 16px; color: var(--text-muted); font-size: 12px;';
        placeholder.textContent = viewId + ' panel';
        this.contentEl.appendChild(placeholder);
      }
    }
  }

  private setupResize(): void {
    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(150, Math.min(500, startWidth + delta));
      this.el.style.width = newWidth + 'px';
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    this.resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      startX = e.clientX;
      startWidth = this.el.offsetWidth;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }
}
