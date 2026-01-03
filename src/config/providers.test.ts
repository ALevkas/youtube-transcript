import { describe, it, expect } from 'vitest';
import { LLM_PROVIDERS } from './providers';

describe('providers', () => {
  describe('LLM_PROVIDERS', () => {
    it('should have chatgpt provider', () => {
      expect(LLM_PROVIDERS.chatgpt).toBeDefined();
      expect(LLM_PROVIDERS.chatgpt.id).toBe('chatgpt');
      expect(LLM_PROVIDERS.chatgpt.name).toBe('ChatGPT');
      expect(LLM_PROVIDERS.chatgpt.url).toContain('chat.openai.com');
    });

    it('should have claude provider', () => {
      expect(LLM_PROVIDERS.claude).toBeDefined();
      expect(LLM_PROVIDERS.claude.id).toBe('claude');
      expect(LLM_PROVIDERS.claude.name).toBe('Claude');
      expect(LLM_PROVIDERS.claude.url).toContain('claude.ai');
    });

    it('should have gemini provider', () => {
      expect(LLM_PROVIDERS.gemini).toBeDefined();
      expect(LLM_PROVIDERS.gemini.id).toBe('gemini');
      expect(LLM_PROVIDERS.gemini.name).toBe('Gemini');
      expect(LLM_PROVIDERS.gemini.url).toContain('gemini.google.com');
    });

    it('all providers should have required fields', () => {
      for (const [key, provider] of Object.entries(LLM_PROVIDERS)) {
        expect(provider.id).toBe(key);
        expect(provider.name).toBeTruthy();
        expect(provider.url).toMatch(/^https:\/\//);
        expect(provider.inputSelector).toBeTruthy();
        expect(provider.submitSelector).toBeTruthy();
      }
    });

    it('all providers should have valid URLs', () => {
      for (const provider of Object.values(LLM_PROVIDERS)) {
        expect(() => new URL(provider.url)).not.toThrow();
      }
    });
  });
});
