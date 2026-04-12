export interface NotionContext {
  pageId: string | null;
  workspaceSlug: string | null;
}

export function parseNotionUrl(url: string): NotionContext {
  try {
    const u = new URL(url);
    if (
      !u.hostname.includes('notion.so') &&
      !u.hostname.includes('notion.site')
    )
      return { pageId: null, workspaceSlug: null };

    const parts = u.pathname.split('/').filter(Boolean);
    const lastSegment = parts[parts.length - 1] ?? '';
    const match = lastSegment.match(/([a-f0-9]{32})$/);

    return {
      pageId: match ? match[1] : null,
      workspaceSlug: parts[0] ?? null,
    };
  } catch {
    return { pageId: null, workspaceSlug: null };
  }
}
