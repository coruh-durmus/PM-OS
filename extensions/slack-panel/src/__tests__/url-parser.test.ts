import { describe, it, expect } from 'vitest';
import { parseSlackUrl } from '../url-parser.js';

describe('parseSlackUrl', () => {
  it('should parse a channel URL', () => {
    const result = parseSlackUrl(
      'https://app.slack.com/client/T12345678/C98765432',
    );
    expect(result).toEqual({
      workspace: 'app',
      channelId: 'C98765432',
      threadTs: null,
    });
  });

  it('should parse a workspace-specific channel URL', () => {
    const result = parseSlackUrl(
      'https://myteam.slack.com/client/T12345678/C11111111',
    );
    expect(result).toEqual({
      workspace: 'myteam',
      channelId: 'C11111111',
      threadTs: null,
    });
  });

  it('should parse a thread URL', () => {
    const result = parseSlackUrl(
      'https://app.slack.com/client/T12345678/C98765432?thread_ts=1234567890.123456',
    );
    expect(result).toEqual({
      workspace: 'app',
      channelId: 'C98765432',
      threadTs: '1234567890.123456',
    });
  });

  it('should return nulls for a non-Slack URL', () => {
    const result = parseSlackUrl('https://www.google.com');
    expect(result).toEqual({
      workspace: null,
      channelId: null,
      threadTs: null,
    });
  });

  it('should return nulls for an invalid URL', () => {
    const result = parseSlackUrl('not-a-url');
    expect(result).toEqual({
      workspace: null,
      channelId: null,
      threadTs: null,
    });
  });

  it('should handle Slack root URL without channel', () => {
    const result = parseSlackUrl('https://app.slack.com/');
    expect(result).toEqual({
      workspace: 'app',
      channelId: null,
      threadTs: null,
    });
  });
});
