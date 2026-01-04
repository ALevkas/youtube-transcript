# Agent Guidelines for YouTube Transcript LLM

This document provides guidelines for agentic coding agents working on this Chrome extension.

## Build & Test Commands

```bash
# Build the project
npm run build

# Watch mode for development
npm run watch

# Run all tests (watch mode)
npm test

# Run tests once
npm run test:run

# Run a single test file
npx vitest run <path-to-test-file>

# Run tests matching a pattern
npx vitest run -t "test-name"

# Clean dist directory
npm run clean
```

## Code Style Guidelines

### TypeScript & Types
- **Strict typing**: Always use explicit types, never `any`. Use `unknown` for generic payloads.
- **Type imports**: Use `import type` for type-only imports to reduce runtime overhead.
- **Interfaces vs Types**: Use `interface` for objects that may be extended, `type` for unions/primitives.
- **Type assertions**: Use sparingly. Prefer type guards (`instanceof Error`) where possible.
- **File extensions**: Use `.js` extensions in TypeScript imports for ES modules compatibility.

```typescript
// Good
import type { LLMProvider, PromptTemplate } from '../types/index.js';
const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TRANSCRIPT' }) as TranscriptResultPayload;

// Bad
import { LLMProvider, PromptTemplate } from '../types/index'; // Missing .js
const data: any = getData(); // Avoid 'any'
```

### Imports
- Group imports: type imports first, then value imports.
- Use relative paths with `../` to navigate up the directory structure.
- Absolute imports are not used in this project.

```typescript
import type { LLMProvider, StorageData } from '../types/index.js';
import { LLM_PROVIDERS } from '../config/providers.js';
import { DEFAULT_PROMPTS, fillPromptTemplate } from '../config/prompts.js';
```

### Naming Conventions
- **Variables & Functions**: camelCase (`sendToLLM`, `getVideoInfo`)
- **Types & Interfaces**: PascalCase (`LLMConfig`, `TranscriptSegment`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PROMPTS`, `LLM_PROVIDERS`)
- **Boolean functions**: Prefix with `is`, `has`, `can`, etc. (`isLoading`, `hasTranscript`)
- **Event handlers**: Prefix with `handle` or use descriptive names (`handleQuickButtonClick`)

### Error Handling
- Always use try-catch for async operations and external API calls.
- Check errors with `instanceof Error` before accessing error properties.
- Return error objects with `{ success: boolean; error?: string }` pattern for async operations.
- Console logs should use `[YouTube Transcript LLM]` prefix for consistency.
- Provide graceful fallbacks where possible (e.g., multiple extraction methods).

```typescript
// Good
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }
  return await response.json();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('[YouTube Transcript LLM] Fetch error:', message);
  return { success: false, error: message };
}

// Bad
try {
  await fetch(url);
} catch (e) {
  console.log(e); // Using console.log, missing prefix
}
```

### Async/Await
- Use `async/await` instead of Promise chains for better readability.
- Always handle Promise rejections with try-catch.
- Use `Promise<void>` for async functions that don't return a value.

### DOM Manipulation
- Cache DOM elements in an `elements` object at the top of files.
- Use null assertion (`!`) only when element existence is guaranteed by HTML.
- Type cast DOM elements: `document.getElementById('input') as HTMLInputElement`.
- Use class-based state management: `classList.add('hidden')`, `classList.remove('hidden')`.

```typescript
const elements = {
  input: document.getElementById('input') as HTMLInputElement,
  button: document.querySelector('button')!,
};

elements.input.value = 'test';
elements.button.classList.add('loading');
```

### Testing
- Test files use `*.test.ts` suffix in the same directory as the code.
- Use Vitest: `import { describe, it, expect } from 'vitest'`.
- Group related tests with `describe()` blocks.
- Test names should be descriptive: "should replace single variable".
- Test both success and error cases.
- Use `expect()` for assertions, no `toBeNullish()` assertions (use `toBeNull()` or `toBeUndefined()`).

### File Organization
- **types/index.ts**: All shared type definitions.
- **config/**: Configuration files (providers, prompts).
- **background/**: Service worker for extension lifecycle.
- **content/**: Content scripts injected into YouTube pages.
- **popup/**: Extension popup UI and logic.
- Within files: Types/Constants → Functions → Event Listeners → Initialization.

### Comments & Documentation
- Use JSDoc comments for functions with parameters and return values.
- Add section headers with `// ===` dividers for logical groupings.
- Keep inline comments minimal, only for complex logic.
- Always log with `[YouTube Transcript LLM]` prefix for debugging.

### Chrome Extension Specifics
- Use `chrome.storage.sync` for user settings (synced across devices).
- Use `chrome.storage.local` for temporary data (pending prompts).
- Content scripts should inline types if ES module imports cause issues.
- Background service worker uses `chrome.runtime.onInstalled` for setup.
- Message passing: `chrome.tabs.sendMessage()` with type and optional payload.

### Code Patterns
- State management: Use a single state object per file, update immutably when needed.
- Template functions: Use regex replacement for variable substitution.
- MutationObserver: Always disconnect observers when done to prevent memory leaks.
- Event listeners: Remove them when no longer needed or use `AbortController` for cleanup.

### Storage
- Always save settings after user changes with `chrome.storage.sync.set()`.
- Load settings at initialization with `chrome.storage.sync.get()`.
- Type storage data with `Partial<StorageData>` for partial loads.
- Default values should be set when extension is installed.

```typescript
const defaultSettings: StorageData = {
  selectedProvider: 'chatgpt',
  selectedPromptId: 'summary',
  customPrompts: [],
  lastUsedSettings: { provider: 'chatgpt', promptId: 'summary' }
};

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set(defaultSettings);
  }
});
```

## Summary

This Chrome extension extracts YouTube transcripts and sends them to LLMs (ChatGPT, Claude, Gemini) for analysis. The codebase uses TypeScript with strict mode, Vitest for testing, and follows modern async/await patterns. Always prioritize type safety, error handling, and maintain consistency with existing patterns.
