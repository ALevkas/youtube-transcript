import { describe, it, expect } from 'vitest';
import { DEFAULT_PROMPTS, fillPromptTemplate } from './prompts';

describe('prompts', () => {
  describe('DEFAULT_PROMPTS', () => {
    it('should have at least one default prompt', () => {
      expect(DEFAULT_PROMPTS.length).toBeGreaterThan(0);
    });

    it('should have unique IDs', () => {
      const ids = DEFAULT_PROMPTS.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have one default prompt marked as default', () => {
      const defaults = DEFAULT_PROMPTS.filter(p => p.isDefault);
      expect(defaults.length).toBe(1);
    });

    it('all prompts should have required fields', () => {
      for (const prompt of DEFAULT_PROMPTS) {
        expect(prompt.id).toBeTruthy();
        expect(prompt.name).toBeTruthy();
        expect(prompt.template).toBeTruthy();
        expect(prompt.isBuiltIn).toBe(true);
      }
    });

    it('should contain summary prompt', () => {
      const summary = DEFAULT_PROMPTS.find(p => p.id === 'summary');
      expect(summary).toBeDefined();
      expect(summary?.isDefault).toBe(true);
    });
  });

  describe('fillPromptTemplate', () => {
    it('should replace single variable', () => {
      const template = 'Hello {name}!';
      const result = fillPromptTemplate(template, { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should replace multiple variables', () => {
      const template = '{greeting} {name}! Welcome to {place}.';
      const result = fillPromptTemplate(template, {
        greeting: 'Hello',
        name: 'User',
        place: 'the app'
      });
      expect(result).toBe('Hello User! Welcome to the app.');
    });

    it('should replace same variable multiple times', () => {
      const template = '{word} {word} {word}';
      const result = fillPromptTemplate(template, { word: 'test' });
      expect(result).toBe('test test test');
    });

    it('should leave unmatched variables unchanged', () => {
      const template = 'Hello {name}! Your age is {age}.';
      const result = fillPromptTemplate(template, { name: 'User' });
      expect(result).toBe('Hello User! Your age is {age}.');
    });

    it('should handle empty variables object', () => {
      const template = 'Hello {name}!';
      const result = fillPromptTemplate(template, {});
      expect(result).toBe('Hello {name}!');
    });

    it('should handle empty string values', () => {
      const template = 'Hello {name}!';
      const result = fillPromptTemplate(template, { name: '' });
      expect(result).toBe('Hello !');
    });

    it('should work with actual prompt template', () => {
      const summaryPrompt = DEFAULT_PROMPTS.find(p => p.id === 'summary');
      expect(summaryPrompt).toBeDefined();

      const result = fillPromptTemplate(summaryPrompt!.template, {
        video_title: 'Test Video',
        video_url: 'https://youtube.com/watch?v=123',
        channel_name: 'Test Channel',
        transcript: 'This is a test transcript.',
        duration: '10:30'
      });

      expect(result).toContain('Test Video');
      expect(result).toContain('https://youtube.com/watch?v=123');
      expect(result).toContain('This is a test transcript.');
    });
  });
});
