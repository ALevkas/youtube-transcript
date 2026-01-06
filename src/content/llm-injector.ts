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
    inputSelector: '#prompt-textarea',
    submitSelector: '#composer-submit-button, [data-testid="send-button"]',
    waitTime: 2000
  },
  'chat.openai.com': {
    inputSelector: '#prompt-textarea',
    submitSelector: '#composer-submit-button, [data-testid="send-button"]',
    waitTime: 2000
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
  },
  'grok.com': {
    inputSelector: 'div[contenteditable="true"], textarea[placeholder*="Ask"]',
    submitSelector: 'button[type="submit"]',
    waitTime: 2500
  },
  'perplexity.ai': {
    inputSelector: 'textarea, div[contenteditable="true"]',
    submitSelector: 'button[aria-label="Submit"]',
    waitTime: 2500
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
    const hostname = window.location.hostname;

    // ChatGPT specific handling - use ProseMirror with clipboard paste
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
      const proseMirror = document.querySelector('#prompt-textarea') as HTMLElement;
      if (proseMirror && proseMirror.getAttribute('contenteditable') === 'true') {
        console.log('[LLM Injector] Using ProseMirror for ChatGPT');

        // Focus the editor
        proseMirror.focus();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Clear existing content
        proseMirror.innerHTML = '';

        // Create a paragraph element with the text (ProseMirror structure)
        const p = document.createElement('p');
        p.textContent = text;
        proseMirror.appendChild(p);

        // Dispatch input event to trigger React state update
        proseMirror.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));

        // Also trigger a beforeinput event
        proseMirror.dispatchEvent(new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));

        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('[LLM Injector] Text set in ProseMirror');
        return true;
      }
    }

    // Handle textarea
    if (element instanceof HTMLTextAreaElement) {
      element.value = text;
      element.focus();
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    // Handle contenteditable
    if (element.getAttribute('contenteditable') === 'true') {
      (element as HTMLElement).focus();
      element.textContent = text;
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        data: text
      }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    // Handle generic input
    if (element instanceof HTMLInputElement) {
      element.value = text;
      element.focus();
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

  // Site-specific fallbacks
  const hostname = window.location.hostname;

  if (hostname.includes('grok.com')) {
    const grokButtons = document.querySelectorAll('button:not([disabled])');
    for (const btn of grokButtons) {
      if (btn instanceof HTMLElement) {
        const type = btn.getAttribute('type') || '';
        const hasIcon = btn.querySelector('svg') !== null;
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        if (type === 'submit' && hasIcon) {
          btn.click();
          return true;
        }
        if (ariaLabel.includes('send') || ariaLabel.includes('отправить')) {
          btn.click();
          return true;
        }
      }
    }
    const input = document.querySelector('div[contenteditable="true"]');
    if (input instanceof HTMLElement) {
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return true;
    }
  }

  if (hostname.includes('perplexity.ai')) {
    const perplexityButtons = document.querySelectorAll('button:not([disabled])');
    for (const btn of perplexityButtons) {
      if (btn instanceof HTMLElement) {
        const hasIcon = btn.querySelector('svg') !== null;
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        if (ariaLabel === 'submit' && hasIcon) {
          btn.click();
          return true;
        }
      }
    }
    const textarea = document.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.focus();
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return true;
    }
  }

  // Generic fallback
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
