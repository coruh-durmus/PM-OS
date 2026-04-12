export interface FigmaContext {
  fileKey: string | null;
  fileName: string | null;
  nodeId: string | null;
}

export function parseFigmaUrl(url: string): FigmaContext {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('figma.com')) {
      return { fileKey: null, fileName: null, nodeId: null };
    }

    const parts = u.pathname.split('/').filter(Boolean);
    // Figma URLs: /file/{fileKey}/{fileName}?node-id={nodeId}
    // or /design/{fileKey}/{fileName}?node-id={nodeId}
    let fileKey: string | null = null;
    let fileName: string | null = null;

    const fileIdx = parts.indexOf('file');
    const designIdx = parts.indexOf('design');
    const baseIdx = fileIdx !== -1 ? fileIdx : designIdx;

    if (baseIdx !== -1 && parts.length > baseIdx + 1) {
      fileKey = parts[baseIdx + 1];
      fileName = parts.length > baseIdx + 2 ? decodeURIComponent(parts[baseIdx + 2]) : null;
    }

    const nodeId = u.searchParams.get('node-id') ?? null;

    return { fileKey, fileName, nodeId };
  } catch {
    return { fileKey: null, fileName: null, nodeId: null };
  }
}
