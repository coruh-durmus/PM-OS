import { describe, it, expect } from 'vitest';
import { parseFigmaUrl } from '../url-parser.js';

describe('parseFigmaUrl', () => {
  it('should parse a file URL', () => {
    const result = parseFigmaUrl(
      'https://www.figma.com/file/ABC123def456/My-Design-File',
    );
    expect(result).toEqual({
      fileKey: 'ABC123def456',
      fileName: 'My-Design-File',
      nodeId: null,
    });
  });

  it('should parse a design URL', () => {
    const result = parseFigmaUrl(
      'https://www.figma.com/design/XYZ789ghi012/Another-File',
    );
    expect(result).toEqual({
      fileKey: 'XYZ789ghi012',
      fileName: 'Another-File',
      nodeId: null,
    });
  });

  it('should parse a URL with node-id parameter', () => {
    const result = parseFigmaUrl(
      'https://www.figma.com/file/ABC123def456/My-Design-File?node-id=1-2',
    );
    expect(result).toEqual({
      fileKey: 'ABC123def456',
      fileName: 'My-Design-File',
      nodeId: '1-2',
    });
  });

  it('should parse a design URL with node-id parameter', () => {
    const result = parseFigmaUrl(
      'https://www.figma.com/design/XYZ789ghi012/Sprint-Designs?node-id=100-300',
    );
    expect(result).toEqual({
      fileKey: 'XYZ789ghi012',
      fileName: 'Sprint-Designs',
      nodeId: '100-300',
    });
  });

  it('should parse a file URL without a file name', () => {
    const result = parseFigmaUrl(
      'https://www.figma.com/file/ABC123def456',
    );
    expect(result).toEqual({
      fileKey: 'ABC123def456',
      fileName: null,
      nodeId: null,
    });
  });

  it('should decode percent-encoded file names', () => {
    const result = parseFigmaUrl(
      'https://www.figma.com/file/ABC123def456/My%20Design%20File',
    );
    expect(result).toEqual({
      fileKey: 'ABC123def456',
      fileName: 'My Design File',
      nodeId: null,
    });
  });

  it('should return nulls for a non-Figma URL', () => {
    const result = parseFigmaUrl('https://www.google.com');
    expect(result).toEqual({
      fileKey: null,
      fileName: null,
      nodeId: null,
    });
  });

  it('should return nulls for an invalid URL', () => {
    const result = parseFigmaUrl('not-a-url');
    expect(result).toEqual({
      fileKey: null,
      fileName: null,
      nodeId: null,
    });
  });

  it('should return nulls for Figma root URL without file path', () => {
    const result = parseFigmaUrl('https://www.figma.com/');
    expect(result).toEqual({
      fileKey: null,
      fileName: null,
      nodeId: null,
    });
  });
});
