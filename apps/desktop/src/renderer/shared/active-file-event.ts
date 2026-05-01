export interface ActiveFileDetail {
  path: string | null;
  content: string | null;
  isMarkdown: boolean;
}

export const ACTIVE_FILE_EVENT = 'pm-os:active-file';

export function emitActiveFile(detail: ActiveFileDetail): void {
  window.dispatchEvent(new CustomEvent<ActiveFileDetail>(ACTIVE_FILE_EVENT, { detail }));
}

export interface ScrollToAnchorDetail {
  slug: string;
}

export const SCROLL_TO_ANCHOR_EVENT = 'pm-os:scroll-to-anchor';

export function emitScrollToAnchor(detail: ScrollToAnchorDetail): void {
  window.dispatchEvent(new CustomEvent<ScrollToAnchorDetail>(SCROLL_TO_ANCHOR_EVENT, { detail }));
}

export interface ScrollToLineDetail {
  line: number;
}

export const SCROLL_TO_LINE_EVENT = 'pm-os:scroll-to-line';

export function emitScrollToLine(detail: ScrollToLineDetail): void {
  window.dispatchEvent(new CustomEvent<ScrollToLineDetail>(SCROLL_TO_LINE_EVENT, { detail }));
}
