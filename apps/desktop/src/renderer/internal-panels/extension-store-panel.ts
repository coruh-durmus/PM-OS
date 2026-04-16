export class ExtensionStorePanel {
  private el: HTMLElement;
  private disposeProgress: (() => void) | null = null;
  private disposeComplete: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.el = container;
  }

  async render(): Promise<void> {
    while (this.el.firstChild) this.el.removeChild(this.el.firstChild);

    // Clean up previous listeners
    this.disposeProgress?.();
    this.disposeComplete?.();

    const root = document.createElement('div');
    root.className = 'extension-store';
    this.el.appendChild(root);

    // Header
    const header = document.createElement('div');
    header.className = 'extension-store-header';
    const title = document.createElement('span');
    title.textContent = 'EXTENSIONS';
    header.appendChild(title);

    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '\u21BB';
    refreshBtn.title = 'Refresh';
    refreshBtn.style.cssText = 'width: 22px; height: 22px; background: none; border: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); font-size: 16px; display: flex; align-items: center; justify-content: center;';
    refreshBtn.addEventListener('mouseenter', () => refreshBtn.style.color = 'var(--text-primary)');
    refreshBtn.addEventListener('mouseleave', () => refreshBtn.style.color = 'var(--text-muted)');
    refreshBtn.addEventListener('click', () => this.render());
    header.appendChild(refreshBtn);
    root.appendChild(header);

    // List
    const list = document.createElement('div');
    list.className = 'extension-store-list';
    root.appendChild(list);

    // Fetch registry
    try {
      const registry = await (window as any).pmOs.extensionStore.getRegistry();
      if (!registry?.extensions?.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding: 24px; text-align: center; color: var(--text-muted); font-size: 12px;';
        empty.textContent = 'No extensions available';
        list.appendChild(empty);
        return;
      }

      for (const ext of registry.extensions) {
        list.appendChild(this.buildCard(ext));
      }
    } catch {
      const errEl = document.createElement('div');
      errEl.style.cssText = 'padding: 24px; text-align: center; color: var(--error); font-size: 12px;';
      errEl.textContent = 'Failed to load extensions';
      list.appendChild(errEl);
    }
  }

  private buildCard(ext: any): HTMLElement {
    const card = document.createElement('div');
    card.className = 'extension-card';
    card.dataset.extId = ext.id;

    // Header row: icon + info
    const headerRow = document.createElement('div');
    headerRow.className = 'extension-card-header';

    const icon = document.createElement('div');
    icon.className = 'extension-card-icon';
    icon.appendChild(this.createExtensionIcon(ext.icon));
    headerRow.appendChild(icon);

    const info = document.createElement('div');
    info.className = 'extension-card-info';

    const name = document.createElement('div');
    name.className = 'extension-card-name';
    name.textContent = ext.name;
    info.appendChild(name);

    if (ext.author) {
      const author = document.createElement('div');
      author.className = 'extension-card-author';
      author.textContent = ext.author;
      info.appendChild(author);
    }

    headerRow.appendChild(info);
    card.appendChild(headerRow);

    // Description
    const desc = document.createElement('div');
    desc.className = 'extension-card-desc';
    desc.textContent = ext.description;
    card.appendChild(desc);

    // Meta: version + total size
    const meta = document.createElement('div');
    meta.className = 'extension-card-meta';

    const version = document.createElement('span');
    version.textContent = 'v' + ext.version;
    meta.appendChild(version);

    const totalSize = this.computeTotalSize(ext);
    const sizeEl = document.createElement('span');
    sizeEl.textContent = this.formatSize(totalSize);
    meta.appendChild(sizeEl);

    card.appendChild(meta);

    // Actions row
    const actions = document.createElement('div');
    actions.className = 'extension-card-actions';

    if (ext.installed) {
      const badge = document.createElement('span');
      badge.className = 'extension-installed-badge';
      badge.textContent = 'Installed';
      actions.appendChild(badge);

      const uninstallBtn = document.createElement('button');
      uninstallBtn.className = 'extension-uninstall-btn';
      uninstallBtn.textContent = 'Uninstall';
      uninstallBtn.addEventListener('click', () => this.handleUninstall(ext.id, card));
      actions.appendChild(uninstallBtn);
    } else {
      // Variant selector (e.g., whisper model size)
      let variantSelect: HTMLSelectElement | null = null;
      if (ext.dependencies) {
        for (const dep of ext.dependencies) {
          if (dep.variants && dep.variants.length > 0) {
            variantSelect = document.createElement('select');
            for (const v of dep.variants) {
              const opt = document.createElement('option');
              opt.value = v.id;
              opt.textContent = v.name;
              variantSelect.appendChild(opt);
            }
            actions.appendChild(variantSelect);
          }
        }
      }

      const installBtn = document.createElement('button');
      installBtn.className = 'extension-install-btn';
      installBtn.textContent = 'Install';
      installBtn.addEventListener('click', () => {
        const options: any = {};
        if (variantSelect) {
          options.whisperModel = variantSelect.value;
        }
        this.handleInstall(ext.id, card, installBtn, options);
      });
      actions.appendChild(installBtn);
    }

    card.appendChild(actions);
    return card;
  }

  private async handleInstall(id: string, card: HTMLElement, btn: HTMLButtonElement, options: any): Promise<void> {
    btn.disabled = true;
    btn.textContent = 'Installing...';

    // Add progress bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'extension-progress-bar';
    const progressFill = document.createElement('div');
    progressFill.className = 'extension-progress-fill';
    progressFill.style.width = '0%';
    progressContainer.appendChild(progressFill);
    card.appendChild(progressContainer);

    // Listen for progress
    this.disposeProgress = (window as any).pmOs.extensionStore.onProgress((data: any) => {
      if (data.extensionId !== id) return;
      if (data.percent !== undefined) {
        progressFill.style.width = data.percent + '%';
      }
      if (data.phase === 'error') {
        btn.textContent = 'Error';
        btn.disabled = false;
        progressContainer.remove();
      }
    });

    this.disposeComplete = (window as any).pmOs.extensionStore.onComplete((data: any) => {
      if (data.extensionId !== id) return;
      this.disposeProgress?.();
      this.disposeComplete?.();
      progressContainer.remove();

      // Re-render to show installed state
      this.render();
    });

    try {
      await (window as any).pmOs.extensionStore.install(id, options);
    } catch {
      btn.textContent = 'Install';
      btn.disabled = false;
      progressContainer.remove();
    }
  }

  private async handleUninstall(id: string, card: HTMLElement): Promise<void> {
    try {
      await (window as any).pmOs.extensionStore.uninstall(id);

      // Show restart notice
      const notice = document.createElement('div');
      notice.className = 'extension-restart-notice';
      notice.textContent = 'Restart required to complete uninstall';
      card.appendChild(notice);

      // Re-render after a brief delay
      setTimeout(() => this.render(), 1000);
    } catch {
      // Silently fail
    }
  }

  private computeTotalSize(ext: any): number {
    let total = ext.size || 0;
    if (ext.dependencies) {
      for (const dep of ext.dependencies) {
        if (dep.variants && dep.variants.length > 0) {
          total += dep.variants[0].size;
        } else {
          total += dep.size || 0;
        }
      }
    }
    return total;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(0) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
  }

  private createExtensionIcon(iconName?: string): SVGElement {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    if (iconName === 'microphone') {
      const path1 = document.createElementNS(svgNS, 'path');
      path1.setAttribute('d', 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z');
      svg.appendChild(path1);

      const path2 = document.createElementNS(svgNS, 'path');
      path2.setAttribute('d', 'M19 10v2a7 7 0 0 1-14 0v-2');
      svg.appendChild(path2);

      const line1 = document.createElementNS(svgNS, 'line');
      line1.setAttribute('x1', '12'); line1.setAttribute('y1', '19');
      line1.setAttribute('x2', '12'); line1.setAttribute('y2', '23');
      svg.appendChild(line1);

      const line2 = document.createElementNS(svgNS, 'line');
      line2.setAttribute('x1', '8'); line2.setAttribute('y1', '23');
      line2.setAttribute('x2', '16'); line2.setAttribute('y2', '23');
      svg.appendChild(line2);
    } else {
      // Default: package/box icon
      const path1 = document.createElementNS(svgNS, 'path');
      path1.setAttribute('d', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z');
      svg.appendChild(path1);

      const polyline = document.createElementNS(svgNS, 'polyline');
      polyline.setAttribute('points', '3.27 6.96 12 12.01 20.73 6.96');
      svg.appendChild(polyline);

      const line1 = document.createElementNS(svgNS, 'line');
      line1.setAttribute('x1', '12'); line1.setAttribute('y1', '22.08');
      line1.setAttribute('x2', '12'); line1.setAttribute('y2', '12');
      svg.appendChild(line1);
    }

    return svg;
  }
}
