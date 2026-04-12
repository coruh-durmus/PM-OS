export class AiPanel {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = container;
  }

  render(): void {
    this.el.textContent = '';
    this.el.style.cssText =
      'display: flex; flex-direction: column; height: 100%; background: var(--bg-primary);';

    // Chat messages area
    const messagesArea = document.createElement('div');
    messagesArea.style.cssText =
      'flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;';

    const welcome = document.createElement('div');
    welcome.style.cssText =
      'text-align: center; padding: 40px 20px; color: var(--text-muted);';

    const welcomeIcon = document.createElement('div');
    welcomeIcon.style.cssText = 'font-size: 28px; margin-bottom: 8px;';
    welcomeIcon.textContent = '\u2726';
    welcome.appendChild(welcomeIcon);

    const welcomeTitle = document.createElement('div');
    welcomeTitle.style.cssText =
      'font-size: 16px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px;';
    welcomeTitle.textContent = 'AI Assistant';
    welcome.appendChild(welcomeTitle);

    const welcomeDesc = document.createElement('div');
    welcomeDesc.style.cssText = 'font-size: 12px;';
    welcomeDesc.textContent =
      'Ask me to summarize, draft, extract action items, or cross-reference project context.';
    welcome.appendChild(welcomeDesc);

    const welcomeHint = document.createElement('div');
    welcomeHint.style.cssText =
      'margin-top: 12px; font-size: 11px; color: var(--text-muted);';
    welcomeHint.textContent =
      'Configure your Claude API key in project settings to enable AI features.';
    welcome.appendChild(welcomeHint);

    messagesArea.appendChild(welcome);
    this.el.appendChild(messagesArea);

    // Skills bar
    const skillsBar = document.createElement('div');
    skillsBar.style.cssText =
      'padding: 8px 16px; display: flex; gap: 6px; flex-wrap: wrap; border-top: 1px solid var(--border);';
    const skills = [
      '/summarize',
      '/draft',
      '/extract-actions',
      '/decision-log',
      '/cross-reference',
    ];
    for (const skill of skills) {
      const chip = document.createElement('span');
      chip.textContent = skill;
      chip.style.cssText =
        'padding: 3px 8px; font-size: 11px; background: var(--bg-surface); color: var(--text-secondary); border-radius: 10px; cursor: pointer;';
      chip.addEventListener(
        'mouseenter',
        () => (chip.style.background = 'var(--bg-hover)'),
      );
      chip.addEventListener(
        'mouseleave',
        () => (chip.style.background = 'var(--bg-surface)'),
      );
      chip.addEventListener('click', () => {
        const input = this.el.querySelector('input') as HTMLInputElement;
        if (input) {
          input.value = skill + ' ';
          input.focus();
        }
      });
      skillsBar.appendChild(chip);
    }
    this.el.appendChild(skillsBar);

    // Input area
    const inputArea = document.createElement('div');
    inputArea.style.cssText =
      'padding: 12px 16px; border-top: 1px solid var(--border); display: flex; gap: 8px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Ask the AI assistant...';
    input.style.cssText =
      'flex: 1; padding: 8px 12px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 13px; outline: none; font-family: var(--font-sans);';
    input.addEventListener(
      'focus',
      () => (input.style.borderColor = 'var(--accent)'),
    );
    input.addEventListener(
      'blur',
      () => (input.style.borderColor = 'var(--border)'),
    );

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Send';
    sendBtn.style.cssText =
      'padding: 8px 16px; background: var(--accent); color: #1e1e2e; border: none; border-radius: var(--radius-sm); cursor: pointer; font-weight: 500; font-size: 13px;';

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);
    this.el.appendChild(inputArea);
  }
}
