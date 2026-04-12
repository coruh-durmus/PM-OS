import type { Extension, ExtensionContext } from '@pm-os/types';
import { EventBus } from '@pm-os/event-bus';
import { ClaudeClient } from '@pm-os/claude';
import { ChatEngine } from './chat.js';
import { summarizeSkill } from './skills/summarize.js';
import { draftSkill } from './skills/draft.js';
import { extractActionsSkill } from './skills/extract-actions.js';
import { decisionLogSkill } from './skills/decision-log.js';
import { crossReferenceSkill } from './skills/cross-reference.js';

export { ChatEngine } from './chat.js';
export type { Skill, SkillContext } from './chat.js';
export { summarizeSkill } from './skills/summarize.js';
export { draftSkill } from './skills/draft.js';
export { extractActionsSkill } from './skills/extract-actions.js';
export { decisionLogSkill } from './skills/decision-log.js';
export { crossReferenceSkill } from './skills/cross-reference.js';

/**
 * PM-OS AI Assistant extension.
 *
 * Provides a chat-based AI copilot with specialized skills for product managers:
 * - /summarize  : Structured summaries with TL;DR, key points, actions, decisions
 * - /draft      : Document drafting (PRD, status update, Slack reply, meeting notes)
 * - /extract-actions : Action item extraction with owner, deadline, priority
 * - /decision-log    : Format decisions for the project decision log
 * - /cross-reference : Cross-reference information across project resources
 */
const extension: Extension = {
  activate(context: ExtensionContext): void {
    const bus = new EventBus();

    // Attempt to create a Claude client from project settings
    const apiKey = context.globalState.get<string>('claudeApiKey');
    const client = apiKey ? new ClaudeClient({ apiKey }) : undefined;

    const engine = new ChatEngine(client);

    // Register all skills
    engine.registerSkill(summarizeSkill);
    engine.registerSkill(draftSkill);
    engine.registerSkill(extractActionsSkill);
    engine.registerSkill(decisionLogSkill);
    engine.registerSkill(crossReferenceSkill);

    // Listen for AI context bar actions from other extensions
    const sub = bus.on('ai:context-bar-action', ({ action, panelId, data }) => {
      console.log(`[ai-assistant] Context bar action: ${action} on panel ${panelId}`, data);
    });

    context.subscriptions.push(sub);

    // Store engine reference for other extensions
    context.globalState.set('chatEngine', engine);

    console.log(`[${context.extensionId}] AI Assistant activated with ${engine.getSkills().length} skills`);
  },

  deactivate(): void {
    console.log('[ai-assistant] AI Assistant deactivated');
  },
};

export default extension;
