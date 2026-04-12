import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../renderer.js';

describe('renderMarkdown', () => {
  it('renders headings', () => {
    const html = renderMarkdown('# Hello World');
    expect(html).toContain('<h1');
    expect(html).toContain('Hello World');
  });

  it('renders multiple heading levels', () => {
    const source = '# H1\n## H2\n### H3';
    const html = renderMarkdown(source);
    expect(html).toContain('<h1');
    expect(html).toContain('<h2');
    expect(html).toContain('<h3');
  });

  it('renders GFM tables', () => {
    const source = [
      '| Name | Status |',
      '| ---- | ------ |',
      '| Alpha | Done |',
      '| Beta | WIP |',
    ].join('\n');
    const html = renderMarkdown(source);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>');
    expect(html).toContain('Alpha');
    expect(html).toContain('Beta');
  });

  it('renders task lists', () => {
    const source = '- [x] Completed\n- [ ] Pending';
    const html = renderMarkdown(source);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
    expect(html).toContain('Completed');
    expect(html).toContain('Pending');
  });

  it('renders fenced code blocks', () => {
    const source = '```javascript\nconst x = 1;\n```';
    const html = renderMarkdown(source);
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).toContain('const x = 1;');
  });

  it('renders inline code', () => {
    const html = renderMarkdown('Use `npm install` to install');
    expect(html).toContain('<code>npm install</code>');
  });

  it('renders blockquotes', () => {
    const html = renderMarkdown('> This is a quote');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('This is a quote');
  });

  it('renders links', () => {
    const html = renderMarkdown('[PM-OS](https://example.com)');
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain('PM-OS');
  });

  it('renders line breaks with GFM breaks option', () => {
    const html = renderMarkdown('Line one\nLine two');
    expect(html).toContain('<br');
  });
});
