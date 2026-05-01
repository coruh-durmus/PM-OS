import { ProjectsPanel } from '../internal-panels/projects-panel.js';
import { ExtensionStorePanel } from '../internal-panels/extension-store-panel.js';
import { SearchPanel } from '../internal-panels/search-panel.js';
import { SourceControlPanel } from '../internal-panels/source-control-panel.js';
import { OutlinePanel } from '../internal-panels/outline-panel.js';
import { TimelinePanel } from '../internal-panels/timeline-panel.js';
import { SidebarSection } from './sidebar-section.js';

interface DisposablePanel {
  dispose?: () => void;
}

export class SidebarPanel {
  private el: HTMLElement;
  private contentEl: HTMLElement;
  private resizeHandle: HTMLElement;
  private visible = false;
  private activeView: string | null = null;
  private onOpenFile?: (entry: { name: string; path: string; isDirectory: boolean }) => void;

  private mountedPanels: DisposablePanel[] = [];
  private projectsPanel: ProjectsPanel | null = null;
  private timelineSection: SidebarSection | null = null;
  private workspaceSection: SidebarSection | null = null;

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
    void this.renderView(viewId);
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.visible = false;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private disposeMountedPanels(): void {
    for (const panel of this.mountedPanels) {
      try { panel.dispose?.(); } catch {}
    }
    this.mountedPanels = [];
    this.projectsPanel = null;
    this.timelineSection = null;
    this.workspaceSection = null;
  }

  private async renderView(viewId: string): Promise<void> {
    // Tear down previous view's panel listeners before clearing the DOM so
    // event subscriptions don't leak across view switches.
    this.disposeMountedPanels();

    while (this.contentEl.firstChild) {
      this.contentEl.removeChild(this.contentEl.firstChild);
    }

    switch (viewId) {
      case 'projects': {
        await this.renderProjectsAccordion();
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

  private async renderProjectsAccordion(): Promise<void> {
    // Use a flex column so the workspace section can grow and the others
    // stay at their content height (matches VS Code's Explorer view).
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-direction: column; height: 100%; min-height: 0;';
    this.contentEl.appendChild(wrapper);

    // ── Workspace section ─────────────────────────────────────────────
    const workspaceSection = new SidebarSection({
      id: 'workspace',
      title: 'Workspace',
      growToFill: true,
    });
    wrapper.appendChild(workspaceSection.el);
    this.workspaceSection = workspaceSection;

    const projectsPanel = new ProjectsPanel(workspaceSection.contentEl, {
      onOpenFile: this.onOpenFile,
      inSection: true,
    });
    this.projectsPanel = projectsPanel;
    this.mountedPanels.push(projectsPanel);
    await projectsPanel.render();
    workspaceSection.setActions(projectsPanel.getActions());

    // ── Outline section ───────────────────────────────────────────────
    const outlineSection = new SidebarSection({
      id: 'outline',
      title: 'Outline',
      defaultCollapsed: true,
    });
    wrapper.appendChild(outlineSection.el);

    const outlinePanel = new OutlinePanel(outlineSection.contentEl);
    this.mountedPanels.push(outlinePanel);

    // ── Timeline section ──────────────────────────────────────────────
    const timelineSection = new SidebarSection({
      id: 'timeline',
      title: 'Timeline',
      defaultCollapsed: true,
    });
    wrapper.appendChild(timelineSection.el);
    this.timelineSection = timelineSection;

    const timelinePanel = new TimelinePanel(timelineSection.contentEl, {
      onActiveFileNameChanged: (filename) => {
        this.timelineSection?.setSubtitle(filename);
      },
    });
    this.mountedPanels.push(timelinePanel);
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
