import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadMcpConfig } from '../loader.js';

describe('loadMcpConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty object when .mcp.json is missing', () => {
    const result = loadMcpConfig(tmpDir);
    expect(result).toEqual({});
  });

  it('loads config with mcpServers key', () => {
    const config = {
      mcpServers: {
        'my-server': {
          command: 'npx',
          args: ['my-mcp-server'],
          env: { API_KEY: 'test' },
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));

    const result = loadMcpConfig(tmpDir);
    expect(result).toEqual({
      'my-server': {
        command: 'npx',
        args: ['my-mcp-server'],
        env: { API_KEY: 'test' },
      },
    });
  });

  it('loads config with flat structure (no mcpServers wrapper)', () => {
    const config = {
      'another-server': {
        command: 'node',
        args: ['server.js'],
      },
    };
    fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));

    const result = loadMcpConfig(tmpDir);
    expect(result).toEqual({
      'another-server': {
        command: 'node',
        args: ['server.js'],
      },
    });
  });

  it('returns empty object for malformed JSON', () => {
    fs.writeFileSync(path.join(tmpDir, '.mcp.json'), '{ invalid json }}}');

    const result = loadMcpConfig(tmpDir);
    expect(result).toEqual({});
  });
});
