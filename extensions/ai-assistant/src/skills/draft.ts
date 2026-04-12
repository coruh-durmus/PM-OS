import type { ClaudeClient } from '@pm-os/claude';
import type { Skill, SkillContext } from '../chat.js';

const TEMPLATES: Record<string, string> = {
  prd: `Generate a PRD (Product Requirements Document) with the following structure:

# [Title]

## Overview
(Brief description of the feature/product)

## Problem Statement
(What problem does this solve?)

## Goals & Success Metrics
- Goal 1 ...
- Metric: ...

## User Stories
- As a [role], I want [feature] so that [benefit]

## Requirements
### Must Have
### Nice to Have

## Technical Considerations

## Timeline & Milestones

## Open Questions`,

  'status-update': `Generate a project status update with this structure:

# Status Update - [Date]

## Summary
(1-2 sentence overview)

## Progress This Week
- Completed: ...
- In Progress: ...

## Blockers
- (any blockers, or "None")

## Next Week
- Planned: ...

## Risks & Mitigations

## Key Metrics`,

  'slack-reply': `Draft a professional Slack reply that is:
- Concise and to the point
- Friendly but professional tone
- Uses bullet points for multiple items
- Ends with a clear next step or question if appropriate`,

  'meeting-notes': `Generate structured meeting notes with this format:

# Meeting Notes - [Date]

## Attendees
- (list)

## Agenda
1. ...

## Discussion
### Topic 1
- Key points discussed
- Decisions made

## Action Items
- [ ] [Owner] Task - Due [date]

## Next Steps
- Next meeting: ...
- Follow-ups: ...`,
};

const SYSTEM_PROMPT = `You are a document drafting assistant for product managers.
You create well-structured, professional documents based on the user's input and the selected template.
Fill in the template with relevant content based on the context provided.
If information is missing, use reasonable placeholders marked with [TODO: ...].`;

/**
 * Draft skill: generates formatted documents from templates.
 */
export const draftSkill: Skill = {
  id: 'draft',
  name: 'Draft',
  description: 'Draft a document (prd/status-update/slack-reply/meeting-notes)',
  systemPrompt: SYSTEM_PROMPT,

  async execute(client: ClaudeClient, userMessage: string, context: SkillContext): Promise<string> {
    // Parse the draft type from the beginning of the message
    const parts = userMessage.match(/^(\S+)\s*([\s\S]*)/);
    const draftType = parts?.[1]?.toLowerCase() ?? '';
    const content = parts?.[2]?.trim() ?? userMessage;

    const template = TEMPLATES[draftType];

    if (!template && draftType && !Object.keys(TEMPLATES).includes(draftType)) {
      const available = Object.keys(TEMPLATES).join(', ');
      return `Unknown draft type: "${draftType}". Available types: ${available}\n\nUsage: /draft <type> <context>\nExample: /draft prd A feature for automated standup summaries`;
    }

    const contextParts: string[] = [];
    if (context.projectPath) {
      contextParts.push(`Project: ${context.projectPath}`);
    }
    if (context.activePanel) {
      contextParts.push(`Reference: ${context.activePanel.title}`);
    }

    const fullMessage = [
      template ? `Use this template:\n${template}` : 'Create a professional document based on the following:',
      contextParts.length > 0 ? `Context:\n${contextParts.join('\n')}` : '',
      `User input:\n${content}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    return client.complete(
      [{ role: 'user', content: fullMessage }],
      { system: SYSTEM_PROMPT },
    );
  },
};
