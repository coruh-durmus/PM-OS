import { describe, it, expect, vi } from 'vitest';
import { ChatEngine } from '../chat.js';
import type { Skill, SkillContext } from '../chat.js';
import type { ClaudeClient } from '@pm-os/claude';

const defaultContext: SkillContext = {
  projectPath: null,
  activePanel: null,
  claudeMd: null,
};

function makeMockClient(response = 'mock response'): ClaudeClient {
  return {
    complete: vi.fn().mockResolvedValue(response),
    stream: vi.fn(),
    cache: {} as ClaudeClient['cache'],
    costs: {} as ClaudeClient['costs'],
  } as unknown as ClaudeClient;
}

function makeMockSkill(id: string): Skill {
  return {
    id,
    name: `Test ${id}`,
    description: `Test skill ${id}`,
    systemPrompt: 'test prompt',
    execute: vi.fn().mockResolvedValue(`skill ${id} result`),
  };
}

describe('ChatEngine', () => {
  describe('without client', () => {
    it('returns API key message when no client is provided', async () => {
      const engine = new ChatEngine();
      const result = await engine.send('hello', defaultContext);
      expect(result).toContain('API key');
    });
  });

  describe('skill dispatch', () => {
    it('dispatches to skill when message starts with /command', async () => {
      const client = makeMockClient();
      const engine = new ChatEngine(client);
      const skill = makeMockSkill('summarize');
      engine.registerSkill(skill);

      const result = await engine.send('/summarize some content here', defaultContext);

      expect(skill.execute).toHaveBeenCalledWith(
        client,
        'some content here',
        defaultContext,
      );
      expect(result).toBe('skill summarize result');
    });

    it('returns error for unknown commands', async () => {
      const client = makeMockClient();
      const engine = new ChatEngine(client);
      engine.registerSkill(makeMockSkill('summarize'));

      const result = await engine.send('/unknown test', defaultContext);
      expect(result).toContain('Unknown command');
      expect(result).toContain('/unknown');
    });

    it('lists registered skills in unknown command message', async () => {
      const client = makeMockClient();
      const engine = new ChatEngine(client);
      engine.registerSkill(makeMockSkill('summarize'));
      engine.registerSkill(makeMockSkill('draft'));

      const result = await engine.send('/badcmd test', defaultContext);
      expect(result).toContain('/summarize');
      expect(result).toContain('/draft');
    });
  });

  describe('general conversation', () => {
    it('sends to ClaudeClient.complete for non-command messages', async () => {
      const client = makeMockClient('general reply');
      const engine = new ChatEngine(client);

      const result = await engine.send('What is PM-OS?', defaultContext);

      expect(client.complete).toHaveBeenCalled();
      expect(result).toBe('general reply');
    });

    it('includes project context in system prompt', async () => {
      const client = makeMockClient('context reply');
      const engine = new ChatEngine(client);

      const ctx: SkillContext = {
        projectPath: '/my/project',
        activePanel: { id: 'p1', url: 'https://example.com', title: 'Test Panel' },
        claudeMd: 'project instructions here',
      };

      await engine.send('hello', ctx);

      const callArgs = (client.complete as ReturnType<typeof vi.fn>).mock.calls[0];
      const system = callArgs[1]?.system as string;
      expect(system).toContain('/my/project');
      expect(system).toContain('Test Panel');
      expect(system).toContain('project instructions here');
    });
  });

  describe('message history', () => {
    it('tracks message history', async () => {
      const client = makeMockClient('response 1');
      const engine = new ChatEngine(client);

      await engine.send('hello', defaultContext);

      const history = engine.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('hello');
      expect(history[1].role).toBe('assistant');
      expect(history[1].content).toBe('response 1');
    });

    it('clears history', async () => {
      const client = makeMockClient();
      const engine = new ChatEngine(client);

      await engine.send('hello', defaultContext);
      expect(engine.getHistory()).toHaveLength(2);

      engine.clearHistory();
      expect(engine.getHistory()).toHaveLength(0);
    });

    it('includes skill responses in history', async () => {
      const client = makeMockClient();
      const engine = new ChatEngine(client);
      engine.registerSkill(makeMockSkill('summarize'));

      await engine.send('/summarize test', defaultContext);

      const history = engine.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('/summarize test');
      expect(history[1].content).toBe('skill summarize result');
    });
  });

  describe('skill registration', () => {
    it('returns all registered skills', () => {
      const engine = new ChatEngine();
      engine.registerSkill(makeMockSkill('a'));
      engine.registerSkill(makeMockSkill('b'));

      const skills = engine.getSkills();
      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.id)).toEqual(['a', 'b']);
    });
  });
});
