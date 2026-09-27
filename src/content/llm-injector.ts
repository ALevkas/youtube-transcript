// Types inlined to avoid ES module syntax in content scripts
interface InjectPromptPayload {
  prompt: string;
  autoSubmit?: boolean;
}

interface Message {
  type: string;
  payload?: unknown;
}

interface InjectionConfig {
  inputSelector: string;
  submitSelector: string;
  waitTime: number;
}

const SITE_CONFIGS: Record<string, InjectionConfig> = {
  'chatgpt.com': {
    inputSelector: '#prompt-textarea, div.ProseMirror[contenteditable="true"]',
    submitSelector: '#composer-submit-button, [data-testid="send-button"], form button[type="submit"]',
    waitTime: 2000
  },
  'chat.openai.com': {
    inputSelector: '#prompt-textarea, div.ProseMirror[contenteditable="true"]',
    submitSelector: '#composer-submit-button, [data-testid="send-button"], form button[type="submit"]',
    waitTime: 2000
  },
  'claude.ai': {
    inputSelector: 'div.ProseMirror[contenteditable="true"]',
    submitSelector: '[data-testid="chat-input-send"], button[aria-label="Send message"]',
    waitTime: 1500
  },
  'gemini.google.com': {
    inputSelector: '.ql-editor[contenteditable="true"]',
    submitSelector: '.send-button button, button.send-button, button[aria-label="Send message"]',
    waitTime: 1500
  },
  'grok.com': {
    inputSelector: 'textarea[aria-label], div[contenteditable="true"]',
    submitSelector: '[data-testid="chat-submit"], button[type="submit"]',
    waitTime: 2500
  },
  'perplexity.ai': {
    inputSelector: '#ask-input, div[contenteditable="true"], textarea',
    submitSelector: 'button[aria-label="Submit"], button:has(use[*|href="#pplx-icon-arrow-right"])',
    waitTime: 2500
  }
};

const SUBMIT_TIMEOUT_MS = 10000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

function getInputText(element: Element): string {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value;
  }
  return (element as HTMLElement).innerText;
}

/**
 * Set value in input field (handles textarea and rich editors: ProseMirror, Quill, Lexical).
 * execCommand('insertText') goes through the editor's native input pipeline,
 * so framework state (React, ProseMirror, Lexical) sees the text.
 */
async function setInputValue(element: Element, text: string): Promise<boolean> {
  try {
    const input = element as HTMLElement;
    input.focus();
    document.execCommand('selectAll');
    document.execCommand('insertText', false, text);
    await sleep(200);

    if (getInputText(element).trim().length > 0) {
      return true;
    }

    // Fallback for plain fields when execCommand is unavailable
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, text);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    return false;
  } catch (e) {
    console.error('[YouTube Transcript LLM] Error setting input value:', e);
    return false;
  }
}

function isButtonEnabled(button: HTMLElement): boolean {
  return !button.hasAttribute('disabled') && button.getAttribute('aria-disabled') !== 'true';
}

/**
 * Wait for an enabled submit button and click it; fall back to pressing Enter in the input
 */
async function clickSubmit(selector: string, input: Element): Promise<boolean> {
  const deadline = Date.now() + SUBMIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const button = [...document.querySelectorAll<HTMLElement>(selector)].find(isButtonEnabled);
    if (button) {
      button.click();
      return true;
    }
    await sleep(250);
  }

  console.warn('[YouTube Transcript LLM] Submit button not found, pressing Enter');
  (input as HTMLElement).focus();
  const enterInit: KeyboardEventInit = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  input.dispatchEvent(new KeyboardEvent('keydown', enterInit));
  input.dispatchEvent(new KeyboardEvent('keyup', enterInit));
  await sleep(500);
  return getInputText(input).trim().length === 0;
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
    await sleep(config.waitTime);

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
      const submitSuccess = await clickSubmit(config.submitSelector, input);
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
