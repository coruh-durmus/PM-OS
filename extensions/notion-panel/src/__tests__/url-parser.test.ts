import { describe, it, expect } from 'vitest';
import { parseNotionUrl } from '../url-parser.js';

describe('parseNotionUrl', () => {
  it('should parse a page URL with ID', () => {
    const result = parseNotionUrl(
      'https://www.notion.so/myworkspace/My-Page-abc123def456789012345678abcdef01',
    );
    expect(result).toEqual({
      pageId: 'abc123def456789012345678abcdef01',
      workspaceSlug: 'myworkspace',
    });
  });

  it('should parse a page URL with dashes in the page name', () => {
    const result = parseNotionUrl(
      'https://notion.so/team/Sprint-Planning-Q1-1234567890abcdef1234567890abcdef',
    );
    expect(result).toEqual({
      pageId: '1234567890abcdef1234567890abcdef',
      workspaceSlug: 'team',
    });
  });

  it('should parse a notion.site URL', () => {
    const result = parseNotionUrl(
      'https://myworkspace.notion.site/Page-Title-aabbccdd11223344aabbccdd11223344',
    );
    expect(result).toEqual({
      pageId: 'aabbccdd11223344aabbccdd11223344',
      workspaceSlug: 'Page-Title-aabbccdd11223344aabbccdd11223344',
    });
  });

  it('should return null pageId for workspace root URL', () => {
    const result = parseNotionUrl('https://www.notion.so/myworkspace');
    expect(result).toEqual({
      pageId: null,
      workspaceSlug: 'myworkspace',
    });
  });

  it('should return nulls for a non-Notion URL', () => {
    const result = parseNotionUrl('https://www.google.com');
    expect(result).toEqual({
      pageId: null,
      workspaceSlug: null,
    });
  });

  it('should return nulls for an invalid URL', () => {
    const result = parseNotionUrl('not-a-url');
    expect(result).toEqual({
      pageId: null,
      workspaceSlug: null,
    });
  });
});
