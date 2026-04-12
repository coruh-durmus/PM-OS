import type { ClaudeClient } from '@pm-os/claude';
import type { Skill, SkillContext } from '../chat.js';

const SYSTEM_PROMPT = `You are an action item extraction specialist for product managers.
Given meeting notes, Slack conversations, documents, or any text, extract all action items.

Format each action item as:

- [ ] **[Owner]** Task description | Priority: High/Medium/Low | Due: [date or "TBD"]

Group action items by owner when possible. If the owner is unclear, mark as **[Unassigned]**.
If the deadline is not mentioned, mark as "TBD".
Infer priority from urgency cues in the text (e.g., "ASAP" = High, "when you get a chance" = Low).

End with a summary count: "Total: X action items (Y high, Z medium, W low)"`;

/**
 * Extract Actions skill: pulls action items with owner, deadline, and priority.
 */
export const extractActionsSkill: Skill = {
  id: 'extract-actions',
  name: 'Extract Actions',
  description: 'Extract action items with owner, deadline, and priority from text',
  systemPrompt: SYSTEM_PROMPT,

  async execute(client: ClaudeClient, userMessage: string, context: SkillContext): Promise<string> {
    const contextParts: string[] = [];

    if (context.activePanel) {
      contextParts.push(`Source: ${context.activePanel.title} (${context.activePanel.url})`);
    }

    const fullMessage = contextParts.length > 0
      ? `${contextParts.join('\n')}\n\nExtract action items from:\n${userMessage}`
      : `Extract action items from:\n${userMessage}`;

    return client.complete(
      [{ role: 'user', content: fullMessage }],
      { system: SYSTEM_PROMPT },
    );
  },
};
