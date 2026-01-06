# Privacy Policy for YouTube Transcript to LLM

**Last updated:** January 6, 2026

## Overview

YouTube Transcript to LLM is a browser extension that extracts transcripts from YouTube videos and sends them to Large Language Model (LLM) services for analysis. This privacy policy explains how the extension handles your data.

## Data Collection

**We do not collect, store, or transmit any personal data to our servers.** The extension operates entirely locally on your device.

### What data the extension accesses:

1. **YouTube Video Data**
   - Video title, channel name, duration, and URL from YouTube pages you visit
   - Video transcripts/captions (when available)
   - This data is accessed only when you actively use the extension on a YouTube video page

2. **User Preferences**
   - Selected LLM provider (ChatGPT, Claude, Gemini, Grok, or Perplexity)
   - Selected prompt template
   - Output language preference
   - Custom prompt templates you create

### How data is stored:

- **Chrome Sync Storage (`chrome.storage.sync`)**: Stores your preferences (selected provider, prompt ID, custom prompts). This data syncs across your Chrome browsers if you're signed into Chrome.
- **Chrome Local Storage (`chrome.storage.local`)**: Temporarily stores the prompt text when transferring it to an LLM tab. This data is automatically cleared after use.

### Data NOT collected:

- We do NOT collect browsing history
- We do NOT collect personal information
- We do NOT use analytics or tracking
- We do NOT have external servers that receive your data
- We do NOT sell or share any data with third parties

## Third-Party Services

When you choose to send a transcript to an LLM service, the extension opens a new tab with your selected provider (ChatGPT, Claude, Gemini, Grok, or Perplexity) and injects the prompt into their interface.

**Important:** Once you send data to these third-party LLM services, their respective privacy policies apply:

- [OpenAI (ChatGPT) Privacy Policy](https://openai.com/privacy/)
- [Anthropic (Claude) Privacy Policy](https://www.anthropic.com/privacy)
- [Google (Gemini) Privacy Policy](https://policies.google.com/privacy)
- [xAI (Grok) Privacy Policy](https://x.ai/legal/privacy-policy)
- [Perplexity Privacy Policy](https://www.perplexity.ai/privacy)

## Permissions

The extension requires the following permissions:

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access the current YouTube tab to extract video information and transcripts |
| `storage` | Save your preferences locally |
| `tabs` | Open new tabs for LLM services |
| `contextMenus` | Add right-click menu option on YouTube |
| `clipboardWrite` | Copy transcripts to clipboard when requested |
| Host permissions for YouTube and LLM sites | Required to extract transcripts and inject prompts |

## Data Security

All data processing happens locally in your browser. No data is transmitted to external servers controlled by us. Your preferences are stored using Chrome's built-in storage APIs which are encrypted and secured by Chrome.

## Children's Privacy

This extension does not knowingly collect any personal information from children under 13 years of age.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last updated" date at the top of this document.

## Contact

If you have any questions about this privacy policy, please open an issue on our GitHub repository.

## Open Source

This extension is open source. You can review the complete source code to verify our privacy practices.
