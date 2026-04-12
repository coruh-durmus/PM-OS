import type { ClaudeClient } from '@pm-os/claude';
import type { Skill, SkillContext } from '../chat.js';

const SYSTEM_PROMPT = `You are a cross-referencing specialist for product managers.
Your job is to analyze information from multiple sources and find connections, contradictions, and gaps.

When cross-referencing, produce output in this format:

## Cross-Reference Analysis

### Sources Analyzed
- (list each source/document referenced)

### Connections Found
- (things that are mentioned across multiple sources, aligned information)

### Contradictions
- (any conflicting information between sources, or "None found")

### Gaps
- (information missing from one source that appears in another, open questions)

### Recommendations
- (suggested next steps based on the cross-reference analysis)

Be specific about which source each finding comes from.`;

/**
 * Cross-Reference skill: analyzes information across project resources.
 */
export const crossReferenceSkill: Skill = {
  id: 'cross-reference',
  name: 'Cross-Reference',
  description: 'Cross-reference information across project resources',
  systemPrompt: SYSTEM_PROMPT,

  async execute(client: ClaudeClient, userMessage: string, context: SkillContext): Promise<string> {
    const contextParts: string[] = [];

    if (context.projectPath) {
      contextParts.push(`Project: ${context.projectPath}`);
    }
    if (context.activePanel) {
      contextParts.push(`Current panel: ${context.activePanel.title} (${context.activePanel.url})`);
    }
    if (context.claudeMd) {
      contextParts.push(`Project notes:\n${context.claudeMd}`);
    }

    const fullMessage = contextParts.length > 0
      ? `${contextParts.join('\n')}\n\nCross-reference request:\n${userMessage}`
      : `Cross-reference request:\n${userMessage}`;

    return client.complete(
      [{ role: 'user', content: fullMessage }],
      { system: SYSTEM_PROMPT },
    );
  },
};
