import type { LLMConfig, LLMProvider } from '../types';

export const LLM_PROVIDERS: Record<LLMProvider, LLMConfig> = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chat.openai.com/',
    inputSelector: '#prompt-textarea',
    submitSelector: '[data-testid="send-button"]'
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai/new',
    inputSelector: '[contenteditable="true"]',
    submitSelector: 'button[aria-label="Send Message"]'
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    inputSelector: '.ql-editor',
    submitSelector: 'button[aria-label="Send message"]'
  }
};
