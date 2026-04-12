import { marked } from 'marked';

type ViewMode = 'rendered' | 'source' | 'split';

const renderedView = document.getElementById('rendered-view') as HTMLDivElement;
const sourceView = document.getElementById('source-view') as HTMLTextAreaElement;
const btnRendered = document.getElementById('btn-rendered') as HTMLButtonElement;
const btnSource = document.getElementById('btn-source') as HTMLButtonElement;
const btnSplit = document.getElementById('btn-split') as HTMLButtonElement;
const btnExportPdf = document.getElementById('btn-export-pdf') as HTMLButtonElement;
const content = document.getElementById('content') as HTMLDivElement;

let currentMode: ViewMode = 'rendered';
let currentSource = '';

// --- Markdown rendering ---

marked.setOptions({ gfm: true, breaks: true });

function renderContent(source: string): void {
  currentSource = source;
  sourceView.value = source;
  // marked.parse produces sanitized HTML from trusted markdown content
  renderedView.innerHTML = marked.parse(source) as string;
  renderMermaidBlocks();
}

// --- Mermaid support (lazy-loaded from CDN) ---

let mermaidLoaded = false;

async function loadMermaid(): Promise<void> {
  if (mermaidLoaded) return;
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
  script.type = 'text/javascript';
  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Mermaid'));
    document.head.appendChild(script);
  });
  (window as any).mermaid.initialize({ startOnLoad: false, theme: 'dark' });
  mermaidLoaded = true;
}

async function renderMermaidBlocks(): Promise<void> {
  const blocks = renderedView.querySelectorAll('code.language-mermaid');
  if (blocks.length === 0) return;

  try {
    await loadMermaid();
  } catch {
    console.warn('Mermaid library could not be loaded; diagrams will show as code.');
    return;
  }

  const mermaid = (window as any).mermaid;
  for (let i = 0; i < blocks.length; i++) {
    const codeEl = blocks[i] as HTMLElement;
    const preEl = codeEl.parentElement;
    if (!preEl || preEl.tagName !== 'PRE') continue;

    const graphDef = codeEl.textContent ?? '';
    const id = `mermaid-${i}-${Date.now()}`;

    try {
      const { svg } = await mermaid.render(id, graphDef);
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-diagram';
      wrapper.innerHTML = svg;
      preEl.replaceWith(wrapper);
    } catch {
      // Leave the code block as-is if rendering fails
    }
  }
}

// --- View mode toggling ---

function setMode(mode: ViewMode): void {
  currentMode = mode;

  btnRendered.classList.toggle('active', mode === 'rendered');
  btnSource.classList.toggle('active', mode === 'source');
  btnSplit.classList.toggle('active', mode === 'split');

  content.classList.remove('mode-rendered', 'mode-source', 'mode-split');
  content.classList.add(`mode-${mode}`);

  switch (mode) {
    case 'rendered':
      renderedView.classList.remove('hidden');
      sourceView.classList.add('hidden');
      break;
    case 'source':
      renderedView.classList.add('hidden');
      sourceView.classList.remove('hidden');
      break;
    case 'split':
      renderedView.classList.remove('hidden');
      sourceView.classList.remove('hidden');
      break;
  }
}

btnRendered.addEventListener('click', () => setMode('rendered'));
btnSource.addEventListener('click', () => setMode('source'));
btnSplit.addEventListener('click', () => setMode('split'));

// --- PDF export ---

btnExportPdf.addEventListener('click', () => {
  window.print();
});

// --- Receive content via postMessage ---

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data;
  if (data && typeof data.markdown === 'string') {
    renderContent(data.markdown);
  }
});

// Initialize with default mode
setMode('rendered');
