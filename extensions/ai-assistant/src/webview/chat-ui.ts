/**
 * Chat UI for the AI Assistant webview.
 *
 * Communicates with the extension host via the postMessage API.
 * Messages sent to the host: { type: 'send', message: string }
 * Messages received from host: { type: 'response', content: string }
 *                              { type: 'skills', skills: Array<{ id, name, description }> }
 *                              { type: 'history', messages: Array<{ role, content, timestamp }> }
 *                              { type: 'clear' }
 *
 * Note: innerHTML is used intentionally for rendering trusted markdown content
 * from the AI assistant. Content originates from the Claude API, not from
 * untrusted user uploads.
 */

interface SkillInfo {
  id: string;
  name: string;
  description: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Simple markdown-to-HTML for rendering assistant responses.
// Content is from the Claude API (trusted source).
function renderMarkdown(text: string): string {
  let html = text
    // Code blocks (fenced)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Checkbox list items
    .replace(/^- \[x\] (.+)$/gm, '<li class="task done"><input type="checkbox" checked disabled /> $1</li>')
    .replace(/^- \[ \] (.+)$/gm, '<li class="task"><input type="checkbox" disabled /> $1</li>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Numbered list items
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr />')
    // Line breaks (double newline = paragraph)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines within paragraphs
    .replace(/\n/g, '<br />');

  // Wrap in paragraph tags
  html = `<p>${html}</p>`;
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, '<ul>$&</ul>');

  return html;
}

const messagesEl = document.getElementById('messages')!;
const inputEl = document.getElementById('message-input') as HTMLTextAreaElement;
const sendBtn = document.getElementById('btn-send')!;
const clearBtn = document.getElementById('btn-clear')!;
const skillPickerEl = document.getElementById('skill-picker')!;
const skillListEl = document.getElementById('skill-list')!;

let skills: SkillInfo[] = [];
let isWaiting = false;

function addMessage(role: 'user' | 'assistant', content: string): void {
  const bubble = document.createElement('div');
  bubble.classList.add('message', role);

  if (role === 'assistant') {
    // Trusted content from Claude API -- markdown rendering is intentional
    bubble.innerHTML = renderMarkdown(content); // eslint-disable-line no-unsanitized/property
  } else {
    bubble.textContent = content;
  }

  messagesEl.appendChild(bubble);
  scrollToBottom();
}

function scrollToBottom(): void {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showSkillPicker(): void {
  if (skills.length === 0) return;

  // Clear and rebuild skill list using DOM methods
  while (skillListEl.firstChild) {
    skillListEl.removeChild(skillListEl.firstChild);
  }
  for (const skill of skills) {
    const li = document.createElement('li');
    li.textContent = `/${skill.id} - ${skill.description}`;
    li.addEventListener('click', () => {
      inputEl.value = `/${skill.id} `;
      hideSkillPicker();
      inputEl.focus();
    });
    skillListEl.appendChild(li);
  }
  skillPickerEl.classList.remove('hidden');
}

function hideSkillPicker(): void {
  skillPickerEl.classList.add('hidden');
}

function sendMessage(): void {
  const message = inputEl.value.trim();
  if (!message || isWaiting) return;

  addMessage('user', message);
  inputEl.value = '';
  inputEl.style.height = 'auto';
  isWaiting = true;
  sendBtn.setAttribute('disabled', 'true');

  // Send to extension host
  window.postMessage({ type: 'send', message }, '*');
}

// Auto-resize textarea
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;

  // Show/hide skill picker on /
  if (inputEl.value === '/') {
    showSkillPicker();
  } else {
    hideSkillPicker();
  }
});

// Send on Enter (Shift+Enter for newline)
inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

clearBtn.addEventListener('click', () => {
  // Clear messages using safe DOM method
  while (messagesEl.firstChild) {
    messagesEl.removeChild(messagesEl.firstChild);
  }
  window.postMessage({ type: 'clear' }, '*');
});

// Listen for messages from the extension host
window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data;

  switch (data.type) {
    case 'response':
      addMessage('assistant', data.content);
      isWaiting = false;
      sendBtn.removeAttribute('disabled');
      break;

    case 'skills':
      skills = data.skills;
      break;

    case 'history':
      // Clear and rebuild from history
      while (messagesEl.firstChild) {
        messagesEl.removeChild(messagesEl.firstChild);
      }
      for (const msg of data.messages as ChatMessage[]) {
        addMessage(msg.role, msg.content);
      }
      break;

    case 'clear':
      while (messagesEl.firstChild) {
        messagesEl.removeChild(messagesEl.firstChild);
      }
      break;
  }
});
