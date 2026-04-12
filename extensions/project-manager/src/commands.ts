import type { CommandContribution } from '@pm-os/types';

/**
 * Command palette entries contributed by the Project Manager extension.
 */
export const commands: CommandContribution[] = [
  {
    command: 'pm-os.project.create',
    title: 'Create Project',
    category: 'Project',
  },
  {
    command: 'pm-os.project.open',
    title: 'Open Project',
    category: 'Project',
  },
  {
    command: 'pm-os.project.delete',
    title: 'Delete Project',
    category: 'Project',
  },
  {
    command: 'pm-os.project.list',
    title: 'List Projects',
    category: 'Project',
  },
  {
    command: 'pm-os.project.addLink',
    title: 'Add Link',
    category: 'Project',
  },
  {
    command: 'pm-os.project.removeLink',
    title: 'Remove Link',
    category: 'Project',
  },
  {
    command: 'pm-os.project.logDecision',
    title: 'Log Decision',
    category: 'Project',
  },
  {
    command: 'pm-os.project.viewDecisions',
    title: 'View Decisions',
    category: 'Project',
  },
];
