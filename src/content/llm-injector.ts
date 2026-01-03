import type { InjectPromptPayload, Message } from '../types';

interface InjectionConfig {
  inputSelector: string;
  submitSelector: string;
  waitTime: number;
}

const SITE_CONFIGS: Record<string, InjectionConfig> = {
  'chat.openai.com': {
    inputSelector: '#prompt-textarea',
    submitSelector: '[data-testid="send-button"]',
    waitTime: 1000
  },
  'claude.ai': {
    inputSelector: '[contenteditable="true"].ProseMirror',
    submitSelector: 'button[aria-label="Send Message"]',
    waitTime: 1500
  },
  'gemini.google.com': {
    inputSelector: '.ql-editor, [contenteditable="true"]',
    submitSelector: 'button[aria-label="Send message"], button.send-button',
    waitTime: 1500
  }
};

/**
 * Wait for an element to appear in DOM
 */
function waitForElement(selector: string, timeout = 10000): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * Set value in input field (handles both textarea and contenteditable)
 */
async function setInputValue(element: Element, text: string): Promise<boolean> {
  try {
    // Handle textarea
    if (element instanceof HTMLTextAreaElement) {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    // Handle contenteditable
    if (element.getAttribute('contenteditable') === 'true') {
      element.textContent = text;

      // Dispatch input event for React/Vue frameworks
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        data: text
      }));

      // Some sites need focus event
      (element as HTMLElement).focus();

      return true;
    }

    // Handle generic input
    if (element instanceof HTMLInputElement) {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    return false;
  } catch (e) {
    console.error('Error setting input value:', e);
    return false;
  }
}

/**
 * Click submit button
 */
async function clickSubmit(selector: string): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 500));

  const button = document.querySelector(selector);
  if (button instanceof HTMLElement) {
    button.click();
    return true;
  }

  // Try alternative selectors
  const alternativeButtons = document.querySelectorAll('button[type="submit"], button:has(svg)');
  for (const btn of alternativeButtons) {
    if (btn instanceof HTMLElement && !btn.hasAttribute('disabled')) {
      const text = btn.textContent?.toLowerCase() || '';
      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
      if (text.includes('send') || ariaLabel.includes('send')) {
        btn.click();
        return true;
      }
    }
  }

  return false;
}

/**
 * Get current site config
 */
function getCurrentSiteConfig(): InjectionConfig | null {
  const hostname = window.location.hostname;

  for (const [domain, config] of Object.entries(SITE_CONFIGS)) {
    if (hostname.includes(domain)) {
      return config;
    }
  }

  return null;
}

/**
 * Inject prompt into LLM interface
 */
async function injectPrompt(payload: InjectPromptPayload): Promise<{ success: boolean; error?: string }> {
  const config = getCurrentSiteConfig();

  if (!config) {
    return { success: false, error: 'Unsupported LLM site' };
  }

  try {
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, config.waitTime));

    // Find input element
    const input = await waitForElement(config.inputSelector);
    if (!input) {
      return { success: false, error: 'Could not find input field' };
    }

    // Set the prompt text
    const setSuccess = await setInputValue(input, payload.prompt);
    if (!setSuccess) {
      return { success: false, error: 'Could not set prompt text' };
    }

    // Auto-submit if requested
    if (payload.autoSubmit) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const submitSuccess = await clickSubmit(config.submitSelector);
      if (!submitSuccess) {
        return { success: true, error: 'Prompt inserted but could not auto-submit' };
      }
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// Listen for injection requests
chrome.runtime.onMessage.addListener((
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: { success: boolean; error?: string }) => void
) => {
  if (message.type === 'INJECT_PROMPT') {
    const payload = message.payload as InjectPromptPayload;
    injectPrompt(payload).then(sendResponse);
    return true; // Keep channel open for async response
  }
  return false;
});

// Check for stored prompt to inject on page load
chrome.storage.local.get(['pendingPrompt'], (result) => {
  if (result.pendingPrompt) {
    const payload: InjectPromptPayload = {
      prompt: result.pendingPrompt,
      autoSubmit: true
    };

    // Clear the pending prompt
    chrome.storage.local.remove(['pendingPrompt']);

    // Inject after page loads
    injectPrompt(payload).then(response => {
      console.log('[LLM Injector] Injection result:', response);
    });
  }
});

console.log('[YouTube Transcript LLM] LLM injector loaded');
