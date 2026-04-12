export class AutomationsPanel {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = container;
  }

  render(): void {
    this.el.textContent = '';
    this.el.style.cssText = 'padding: 24px; overflow-y: auto; height: 100%;';

    const title = document.createElement('h2');
    title.textContent = 'Automations';
    title.style.cssText =
      'font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0 0 20px 0;';
    this.el.appendChild(title);

    const templates = [
      {
        name: 'Morning Standup Summary',
        schedule: 'Weekdays at 9:00 AM',
        description:
          'Summarizes Slack channels and creates a Notion standup page.',
        icon: '\u2600\uFE0F',
        enabled: false,
      },
      {
        name: 'Thread Escalation',
        schedule: 'Event-triggered',
        description:
          'Alerts when a Slack thread exceeds 10 replies and mentions you.',
        icon: '\u{1F514}',
        enabled: false,
      },
    ];

    for (const tmpl of templates) {
      const card = document.createElement('div');
      card.style.cssText =
        'padding: 16px; background: var(--bg-surface); border-radius: var(--radius-md); margin-bottom: 10px;';

      const header = document.createElement('div');
      header.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

      const nameRow = document.createElement('div');
      nameRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';
      const icon = document.createElement('span');
      icon.textContent = tmpl.icon;
      icon.style.fontSize = '18px';
      nameRow.appendChild(icon);
      const name = document.createElement('span');
      name.textContent = tmpl.name;
      name.style.cssText =
        'font-weight: 500; font-size: 14px; color: var(--text-primary);';
      nameRow.appendChild(name);
      header.appendChild(nameRow);

      // Toggle switch
      const toggle = document.createElement('div');
      toggle.style.cssText = `width: 36px; height: 20px; border-radius: 10px; background: ${tmpl.enabled ? 'var(--accent)' : 'var(--bg-hover)'}; cursor: pointer; position: relative; transition: background 0.2s;`;
      const knob = document.createElement('div');
      knob.style.cssText = `width: 16px; height: 16px; border-radius: 50%; background: white; position: absolute; top: 2px; ${tmpl.enabled ? 'right: 2px' : 'left: 2px'}; transition: left 0.2s, right 0.2s;`;
      toggle.appendChild(knob);
      toggle.addEventListener('click', () => {
        tmpl.enabled = !tmpl.enabled;
        toggle.style.background = tmpl.enabled
          ? 'var(--accent)'
          : 'var(--bg-hover)';
        knob.style.left = tmpl.enabled ? '' : '2px';
        knob.style.right = tmpl.enabled ? '2px' : '';
      });
      header.appendChild(toggle);

      card.appendChild(header);

      const schedule = document.createElement('div');
      schedule.textContent = tmpl.schedule;
      schedule.style.cssText =
        'font-size: 11px; color: var(--accent); margin-bottom: 4px;';
      card.appendChild(schedule);

      const desc = document.createElement('div');
      desc.textContent = tmpl.description;
      desc.style.cssText =
        'font-size: 12px; color: var(--text-muted); line-height: 1.4;';
      card.appendChild(desc);

      this.el.appendChild(card);
    }

    const note = document.createElement('div');
    note.style.cssText =
      'margin-top: 16px; padding: 12px; background: var(--bg-surface); border-radius: var(--radius-sm); font-size: 11px; color: var(--text-muted); line-height: 1.5;';
    note.textContent =
      'Automations run while PM-OS is open. Missed schedules fire on next launch. Configure project-specific automations in .pm-os/automations/.';
    this.el.appendChild(note);
  }
}
