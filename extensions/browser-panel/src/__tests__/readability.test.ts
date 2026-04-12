import { describe, it, expect } from 'vitest';
import { extractReadableContent } from '../readability.js';

describe('extractReadableContent', () => {
  it('should strip script tags and their content', () => {
    const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    const result = extractReadableContent(html);
    expect(result).toBe('Hello World');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('script');
  });

  it('should strip style tags and their content', () => {
    const html = '<style>.foo { color: red; }</style><p>Content</p>';
    const result = extractReadableContent(html);
    expect(result).toBe('Content');
    expect(result).not.toContain('color');
  });

  it('should strip nav elements', () => {
    const html = '<nav><a href="/">Home</a><a href="/about">About</a></nav><main><p>Article text</p></main>';
    const result = extractReadableContent(html);
    expect(result).toBe('Article text');
    expect(result).not.toContain('Home');
  });

  it('should strip footer elements', () => {
    const html = '<p>Main content</p><footer>Copyright 2024</footer>';
    const result = extractReadableContent(html);
    expect(result).toBe('Main content');
    expect(result).not.toContain('Copyright');
  });

  it('should strip header elements', () => {
    const html = '<header><h1>Site Title</h1></header><article><p>Body text</p></article>';
    const result = extractReadableContent(html);
    expect(result).toBe('Body text');
    expect(result).not.toContain('Site Title');
  });

  it('should decode HTML entities', () => {
    const html = '<p>Tom &amp; Jerry &lt;3 &quot;cartoons&quot; &amp; &#39;fun&#39;</p>';
    const result = extractReadableContent(html);
    expect(result).toBe("Tom & Jerry <3 \"cartoons\" & 'fun'");
  });

  it('should extract plain text from nested HTML', () => {
    const html = '<div><h1>Title</h1><p>Paragraph <strong>bold</strong> text</p></div>';
    const result = extractReadableContent(html);
    expect(result).toBe('Title Paragraph bold text');
  });

  it('should truncate output to 10000 characters', () => {
    const html = '<p>' + 'a'.repeat(20000) + '</p>';
    const result = extractReadableContent(html);
    expect(result.length).toBeLessThanOrEqual(10000);
  });

  it('should handle empty HTML', () => {
    const result = extractReadableContent('');
    expect(result).toBe('');
  });
});
