/**
 * Automation Engine extension entry point.
 *
 * Loads YAML workflow templates from the bundled templates directory and
 * registers them with the Scheduler. Built-in stub actions are wired into
 * the action registry on activation.
 */

import type { Extension, ExtensionContext } from '@pm-os/types';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Scheduler } from './scheduler.js';
import type { AutomationConfig } from './scheduler.js';
import { registerAction, executeActions } from './actions/index.js';
import { summarizeSlack } from './actions/summarize-slack.js';
import { draftNotion } from './actions/draft-notion.js';
import { notify } from './actions/notify.js';

/**
 * Load all .yaml files from the templates directory and return them as
 * AutomationConfig objects.
 */
function loadTemplates(templatesDir: string): AutomationConfig[] {
  let files: string[];
  try {
    files = readdirSync(templatesDir).filter((f) => f.endsWith('.yaml'));
  } catch {
    // Templates directory may not exist at runtime (e.g. in tests)
    return [];
  }

  const configs: AutomationConfig[] = [];
  for (const file of files) {
    const raw = readFileSync(join(templatesDir, file), 'utf-8');
    const parsed = parseYaml(raw) as Record<string, unknown>;
    configs.push({
      id: file.replace(/\.yaml$/, ''),
      name: (parsed.name as string) ?? file,
      schedule: (parsed.schedule as string) ?? '',
      actions: (parsed.actions as AutomationConfig['actions']) ?? [],
      enabled: (parsed.enabled as boolean) ?? false,
    });
  }

  return configs;
}

const scheduler = new Scheduler();

const automationEngineExtension: Extension = {
  activate(context: ExtensionContext) {
    // Register built-in actions
    registerAction('summarize_slack', summarizeSlack);
    registerAction('draft_notion', draftNotion);
    registerAction('notify', notify);

    // Load workflow templates
    const templatesDir = join(context.extensionPath, 'src', 'templates');
    const templates = loadTemplates(templatesDir);

    for (const config of templates) {
      scheduler.register(config, async (cfg) => {
        await executeActions(cfg.actions);
      });
    }

    // Start the cron check loop
    scheduler.start();

    // Ensure the scheduler stops on deactivation
    context.subscriptions.push({ dispose: () => scheduler.stop() });

    // Expose scheduler on global state so other extensions can register automations
    context.globalState.set('automation-engine:scheduler', scheduler);
  },

  deactivate() {
    scheduler.stop();
  },
};

export default automationEngineExtension;
export { automationEngineExtension, Scheduler };
export type { AutomationConfig, ActionConfig } from './scheduler.js';
