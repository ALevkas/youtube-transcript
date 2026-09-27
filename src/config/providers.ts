import type { LLMConfig, LLMProvider } from '../types';

export const LLM_PROVIDERS: Record<LLMProvider, LLMConfig> = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    inputSelector: '#prompt-textarea, div.ProseMirror[contenteditable="true"]',
    submitSelector: '#composer-submit-button, [data-testid="send-button"], form button[type="submit"]'
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai/new',
    inputSelector: 'div.ProseMirror[contenteditable="true"]',
    submitSelector: '[data-testid="chat-input-send"], button[aria-label="Send message"]'
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    inputSelector: '.ql-editor[contenteditable="true"]',
    submitSelector: '.send-button button, button.send-button, button[aria-label="Send message"]'
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com/',
    inputSelector: 'textarea[aria-label], div[contenteditable="true"]',
    submitSelector: '[data-testid="chat-submit"], button[type="submit"]'
  },
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai/',
    inputSelector: '#ask-input, div[contenteditable="true"], textarea',
    submitSelector: 'button[aria-label="Submit"], button:has(use[*|href="#pplx-icon-arrow-right"])'
  },
};
