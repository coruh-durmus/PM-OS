import type { Extension, ExtensionContext } from '@pm-os/types';
import { EventBus } from '@pm-os/event-bus';
import { ProjectStore } from './project-store.js';
import { DecisionLog } from './decision-log.js';
import { commands } from './commands.js';

export { ProjectStore } from './project-store.js';
export { DecisionLog } from './decision-log.js';
export { commands } from './commands.js';

/**
 * PM-OS Project Manager extension.
 *
 * Manages the lifecycle of PM-OS projects: creation, listing, switching,
 * link management, and decision logging.
 */
const extension: Extension = {
  activate(context: ExtensionContext): void {
    const bus = new EventBus();
    const store = new ProjectStore(context.extensionPath);

    // Register command handler subscription
    const sub = bus.on('command:execute', ({ commandId, args }) => {
      switch (commandId) {
        case 'pm-os.project.create': {
          const name = (args?.[0] as string) ?? 'untitled';
          store.create(name);
          bus.emit('project:changed', {
            projectPath: `${context.extensionPath}/${name}`,
          });
          break;
        }
        case 'pm-os.project.list': {
          store.list();
          break;
        }
        case 'pm-os.project.delete': {
          const projectName = (args?.[0] as string) ?? '';
          store.delete(projectName);
          bus.emit('project:changed', { projectPath: null });
          break;
        }
        case 'pm-os.project.logDecision': {
          const projectPath = args?.[0] as string;
          const entry = args?.[1] as Parameters<DecisionLog['append']>[0];
          if (projectPath && entry) {
            const log = new DecisionLog(projectPath);
            log.append(entry);
          }
          break;
        }
      }
    });

    context.subscriptions.push(sub);

    // Store references for potential use by other extensions
    context.globalState.set('projectStore', store);
    context.globalState.set('commands', commands);
  },

  deactivate(): void {
    // Cleanup handled by disposable subscriptions
  },
};

export default extension;
