/**
 * Background Service Worker
 * Handles extension lifecycle and context menu
 */

// Install handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[YouTube Transcript LLM] Extension installed');

    // Set default settings
    chrome.storage.sync.set({
      selectedProvider: 'chatgpt',
      selectedPromptId: 'summary',
      customPrompts: []
    });
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message.type, 'from:', sender.tab?.url);

  // Keep the message channel open for async responses
  return false;
});

// Optional: Context menu for quick access
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-llm',
    title: 'Send transcript to LLM',
    contexts: ['page'],
    documentUrlPatterns: ['https://www.youtube.com/watch*']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'send-to-llm' && tab?.id) {
    // Open popup (or trigger action)
    chrome.action.openPopup();
  }
});

console.log('[YouTube Transcript LLM] Background service worker started');
