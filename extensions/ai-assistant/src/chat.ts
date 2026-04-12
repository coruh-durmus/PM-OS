import type { ClaudeClient } from '@pm-os/claude';
import type { AiChatMessage } from '@pm-os/types';

/**
 * Context provided to skills when they execute.
 */
export interface SkillContext {
  projectPath: string | null;
  activePanel: { id: string; url: string; title: string } | null;
  claudeMd: string | null;
}

/**
 * A skill is a focused AI capability triggered by a slash command.
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  execute(client: ClaudeClient, userMessage: string, context: SkillContext): Promise<string>;
}

const DEFAULT_SYSTEM_PROMPT = `You are PM-OS AI Assistant, a helpful product management copilot.
You help product managers with summarization, drafting documents, extracting action items,
logging decisions, and cross-referencing project information.
Be concise, structured, and actionable in your responses.`;

/**
 * ChatEngine manages an AI chat session with skill dispatch.
 *
 * When a message starts with a registered `/command`, the engine dispatches
 * to the matching skill. Otherwise it routes to the general Claude conversation.
 */
export class ChatEngine {
  private client: ClaudeClient | null;
  private skills = new Map<string, Skill>();
  private history: AiChatMessage[] = [];

  constructor(client?: ClaudeClient) {
    this.client = client ?? null;
  }

  /**
   * Register a skill that can be invoked via `/skillId`.
   */
  registerSkill(skill: Skill): void {
    this.skills.set(skill.id, skill);
  }

  /**
   * Return all registered skills.
   */
  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Send a message. If it starts with `/command`, dispatch to the matching skill.
   * Otherwise, send as a general conversation turn.
   */
  async send(message: string, context: SkillContext): Promise<string> {
    if (!this.client) {
      return 'Please configure your Claude API key in project settings to use the AI Assistant.';
    }

    this.history.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    let response: string;

    // Check for skill command
    const commandMatch = message.match(/^\/(\S+)\s*(.*)/s);
    if (commandMatch) {
      const [, commandId, rest] = commandMatch;
      const skill = this.skills.get(commandId);
      if (skill) {
        response = await skill.execute(this.client, rest.trim(), context);
      } else {
        response = `Unknown command: /${commandId}. Available commands: ${this.listCommands()}`;
      }
    } else {
      response = await this.generalConversation(message, context);
    }

    this.history.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    });

    return response;
  }

  /**
   * Get the full chat history.
   */
  getHistory(): AiChatMessage[] {
    return [...this.history];
  }

  /**
   * Clear chat history.
   */
  clearHistory(): void {
    this.history = [];
  }

  private async generalConversation(message: string, context: SkillContext): Promise<string> {
    const systemParts = [DEFAULT_SYSTEM_PROMPT];

    if (context.projectPath) {
      systemParts.push(`Current project path: ${context.projectPath}`);
    }
    if (context.activePanel) {
      systemParts.push(
        `Active panel: "${context.activePanel.title}" (${context.activePanel.url})`,
      );
    }
    if (context.claudeMd) {
      systemParts.push(`Project instructions:\n${context.claudeMd}`);
    }

    systemParts.push(
      `Available commands: ${this.listCommands()}`,
    );

    // Build messages from recent history for context (last 20 turns)
    const recentHistory = this.history.slice(-20);
    const messages = recentHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    return this.client!.complete(messages, {
      system: systemParts.join('\n\n'),
    });
  }

  private listCommands(): string {
    if (this.skills.size === 0) return '(none registered)';
    return Array.from(this.skills.values())
      .map((s) => `/${s.id} - ${s.description}`)
      .join(', ');
  }
}
