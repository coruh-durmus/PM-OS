import type { ClaudeClient } from '@pm-os/claude';
import type { Skill, SkillContext } from '../chat.js';

const SYSTEM_PROMPT = `You are a summarization expert for product managers.
Given content, produce a structured summary in the following format:

## TL;DR
(1-2 sentence executive summary)

## Key Points
- (bullet list of the most important points)

## Action Items
- [ ] (specific actionable tasks extracted from the content)

## Decisions Made
- (any decisions that were reached, or "None identified" if none)

Be concise and focus on what matters to a product manager: decisions, blockers, action items, and key takeaways.`;

/**
 * Summarize skill: produces structured summaries from content.
 */
export const summarizeSkill: Skill = {
  id: 'summarize',
  name: 'Summarize',
  description: 'Summarize content with TL;DR, key points, action items, and decisions',
  systemPrompt: SYSTEM_PROMPT,

  async execute(client: ClaudeClient, userMessage: string, context: SkillContext): Promise<string> {
    const contextParts: string[] = [];

    if (context.activePanel) {
      contextParts.push(`Source: ${context.activePanel.title} (${context.activePanel.url})`);
    }

    const fullMessage = contextParts.length > 0
      ? `${contextParts.join('\n')}\n\nContent to summarize:\n${userMessage}`
      : `Content to summarize:\n${userMessage}`;

    return client.complete(
      [{ role: 'user', content: fullMessage }],
      { system: SYSTEM_PROMPT },
    );
  },
};
