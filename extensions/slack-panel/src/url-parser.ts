export interface SlackContext {
  workspace: string | null;
  channelId: string | null;
  threadTs: string | null;
}

export function parseSlackUrl(url: string): SlackContext {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('.slack.com') && u.hostname !== 'app.slack.com')
      return { workspace: null, channelId: null, threadTs: null };

    const workspace = u.hostname.replace('.slack.com', '');
    const parts = u.pathname.split('/').filter(Boolean);
    const clientIdx = parts.indexOf('client');
    const channelId =
      clientIdx !== -1 && parts.length > clientIdx + 2
        ? parts[clientIdx + 2]
        : null;
    const threadTs = u.searchParams.get('thread_ts') ?? null;

    return { workspace, channelId, threadTs };
  } catch {
    return { workspace: null, channelId: null, threadTs: null };
  }
}
