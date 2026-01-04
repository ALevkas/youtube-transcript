import { describe, it, expect } from 'vitest';
import { LLM_PROVIDERS } from './providers';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('providers UI integration', () => {
  it('all LLM providers should be present in popup HTML', () => {
    const htmlPath = join(__dirname, '../popup/popup.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');

    const providerIds = Object.keys(LLM_PROVIDERS);

    for (const providerId of providerIds) {
      const optionPattern = new RegExp(`<option\\s+value=["']${providerId}["']>`);
      expect(htmlContent).toMatch(optionPattern);
    }
  });

  it('LLM providers in HTML should match configuration', () => {
    const htmlPath = join(__dirname, '../popup/popup.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');

    const selectMatch = htmlContent.match(/<select id="llm-select">([\s\S]*?)<\/select>/);
    expect(selectMatch).toBeDefined();

    const selectContent = selectMatch![1];
    const optionMatches = selectContent.matchAll(/<option value="([^"]+)">/g);

    const htmlProviderIds = Array.from(optionMatches, (m: RegExpMatchArray) => m[1]);
    const configProviderIds = Object.keys(LLM_PROVIDERS);

    expect(htmlProviderIds).toEqual(configProviderIds);
    expect(htmlProviderIds).toHaveLength(configProviderIds.length);
  });

  it('should not have extra providers in HTML that are not in config', () => {
    const htmlPath = join(__dirname, '../popup/popup.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');

    const selectMatch = htmlContent.match(/<select id="llm-select">([\s\S]*?)<\/select>/);
    expect(selectMatch).toBeDefined();

    const selectContent = selectMatch![1];
    const optionMatches = selectContent.matchAll(/<option value="([^"]+)">/g);

    const htmlProviderIds = Array.from(optionMatches, (m: RegExpMatchArray) => m[1]);
    const configProviderIds = Object.keys(LLM_PROVIDERS);

    for (const htmlProviderId of htmlProviderIds) {
      expect(configProviderIds).toContain(htmlProviderId);
    }
  });
});
