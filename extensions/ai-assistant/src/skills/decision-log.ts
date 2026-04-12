import type { ClaudeClient } from '@pm-os/claude';
import type { Skill, SkillContext } from '../chat.js';

const SYSTEM_PROMPT = `You are a decision documentation specialist for product managers.
Given a description of a decision (or context around one), format it as a structured decision log entry.

Use this format:

---
## Decision: [Clear, concise title]

**Date:** [Today's date or date mentioned]
**Status:** Decided
**Deciders:** [People involved, or "Not specified"]

### Context
(What was the situation or problem that prompted this decision?)

### Decision
(What was decided?)

### Rationale
(Why was this option chosen over alternatives?)

### Alternatives Considered
1. [Alternative 1] - [Why rejected]
2. [Alternative 2] - [Why rejected]

### Consequences
- [Expected outcomes, both positive and negative]

### Tags
[relevant-topic], [area]
---

If information is missing, infer what you can and mark unknowns with [TODO: ...].`;

/**
 * Decision Log skill: formats decisions for the project decision log.
 */
export const decisionLogSkill: Skill = {
  id: 'decision-log',
  name: 'Decision Log',
  description: 'Format a decision for the project decision log',
  systemPrompt: SYSTEM_PROMPT,

  async execute(client: ClaudeClient, userMessage: string, context: SkillContext): Promise<string> {
    const contextParts: string[] = [];

    if (context.projectPath) {
      contextParts.push(`Project: ${context.projectPath}`);
    }
    if (context.activePanel) {
      contextParts.push(`Source: ${context.activePanel.title}`);
    }

    const fullMessage = contextParts.length > 0
      ? `${contextParts.join('\n')}\n\nDecision to document:\n${userMessage}`
      : `Decision to document:\n${userMessage}`;

    return client.complete(
      [{ role: 'user', content: fullMessage }],
      { system: SYSTEM_PROMPT },
    );
  },
};
