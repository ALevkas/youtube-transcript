// Types inlined to avoid ES module syntax in content scripts
interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

interface VideoMetadata {
  title: string;
  url: string;
  channelName: string;
  duration: string;
}

interface TranscriptResultPayload {
  success: boolean;
  transcript?: string;
  segments?: TranscriptSegment[];
  error?: string;
}

interface VideoInfoPayload {
  success: boolean;
  metadata?: VideoMetadata;
  error?: string;
}

interface Message {
  type: string;
  payload?: unknown;
}

interface CaptionTrack {
  baseUrl: string;
  name: { simpleText: string };
  languageCode: string;
  kind?: string;
}

interface PlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
  videoDetails?: {
    title: string;
    videoId: string;
    lengthSeconds: string;
    author: string;
  };
}

interface InnertubeContext {
  client: {
    clientName: string;
    clientVersion: string;
  };
}

interface InnertubePlayerRequest {
  context: InnertubeContext;
  videoId: string;
}

// Innertube API configuration - using Android client to bypass POT token requirement
const INNERTUBE_CONTEXT: InnertubeContext = {
  client: {
    clientName: 'ANDROID',
    clientVersion: '20.10.38'
  }
};

/**
 * Extract JSON object from text starting at given position using bracket counting
 */
function extractJsonObject(text: string, startIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(startIndex, i + 1);
      }
    }
  }

  return null;
}

/**
 * Extract ytInitialPlayerResponse from page
 */
function getPlayerResponse(): PlayerResponse | null {
  try {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      const marker = 'ytInitialPlayerResponse';
      const markerIndex = text.indexOf(marker);

      if (markerIndex === -1) continue;

      // Find the opening brace after the marker
      const openBrace = text.indexOf('{', markerIndex);
      if (openBrace === -1) continue;

      // Extract JSON using bracket counting
      const jsonStr = extractJsonObject(text, openBrace);
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }
    }

    // Fallback: try accessing from window (may not work in content script context)
    const win = window as unknown as { ytInitialPlayerResponse?: PlayerResponse };
    if (win.ytInitialPlayerResponse) {
      return win.ytInitialPlayerResponse;
    }
  } catch (e) {
    console.error('Error parsing player response:', e);
  }
  return null;
}

/**
 * Extract INNERTUBE_API_KEY from the page
 */
function getInnertubeApiKey(): string | null {
  try {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      const match = text.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
      if (match) {
        return match[1];
      }
    }
  } catch (e) {
    console.error('[YouTube Transcript LLM] Error extracting API key:', e);
  }
  return null;
}

/**
 * Extract video ID from current URL
 */
function getVideoId(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get('v');
}

/**
 * Fetch player response via Innertube API (Android client)
 * This bypasses the POT token requirement
 */
async function fetchPlayerViaInnertube(videoId: string, apiKey: string): Promise<PlayerResponse | null> {
  const url = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;

  const requestBody: InnertubePlayerRequest = {
    context: INNERTUBE_CONTEXT,
    videoId: videoId
  };

  console.log('[YouTube Transcript LLM] Fetching via Innertube API...');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error('[YouTube Transcript LLM] Innertube API error:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[YouTube Transcript LLM] Innertube API response received');
    return data as PlayerResponse;
  } catch (e) {
    console.error('[YouTube Transcript LLM] Innertube fetch error:', e);
    return null;
  }
}

/**
 * Parse transcript XML response into segments
 */
function parseTranscriptXml(xmlText: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  // Use regex to parse XML to avoid Trusted Types issues with DOMParser
  const textRegex = /<text start="([^"]*)" dur="([^"]*)"[^>]*>([^<]*)<\/text>/g;
  let match;

  while ((match = textRegex.exec(xmlText)) !== null) {
    const start = parseFloat(match[1] || '0');
    const duration = parseFloat(match[2] || '0');
    const content = match[3] || '';

    // Decode HTML entities
    const decoded = content
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n/g, ' ')
      .trim();

    if (decoded) {
      segments.push({ text: decoded, start, duration });
    }
  }

  return segments;
}

/**
 * Fetch transcript via Innertube API (primary method)
 */
async function fetchTranscriptViaInnertube(): Promise<TranscriptSegment[]> {
  const videoId = getVideoId();
  if (!videoId) {
    throw new Error('Could not extract video ID from URL');
  }

  const apiKey = getInnertubeApiKey();
  if (!apiKey) {
    throw new Error('Could not find INNERTUBE_API_KEY');
  }

  console.log('[YouTube Transcript LLM] Using Innertube API with video:', videoId);

  const playerResponse = await fetchPlayerViaInnertube(videoId, apiKey);
  if (!playerResponse) {
    throw new Error('Failed to fetch player response via Innertube');
  }

  const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks || captionTracks.length === 0) {
    throw new Error('No caption tracks available');
  }

  // Prefer manual captions over auto-generated
  const manualTrack = captionTracks.find(t => !t.kind || t.kind !== 'asr');
  const selectedTrack = manualTrack || captionTracks[0];

  console.log('[YouTube Transcript LLM] Selected track:', selectedTrack.languageCode, selectedTrack.kind || 'manual');

  // Fetch the transcript XML
  const captionUrl = new URL(selectedTrack.baseUrl);
  // Remove fmt parameter to get clean XML
  captionUrl.searchParams.delete('fmt');

  const response = await fetch(captionUrl.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch transcript: ${response.status}`);
  }

  const xmlText = await response.text();
  if (xmlText.length === 0) {
    throw new Error('Empty transcript response');
  }

  console.log('[YouTube Transcript LLM] Transcript XML length:', xmlText.length);

  const segments = parseTranscriptXml(xmlText);
  console.log('[YouTube Transcript LLM] Parsed segments:', segments.length);

  return segments;
}

/**
 * Fetch transcript from YouTube's timedtext API (legacy method)
 */
async function fetchTranscript(captionUrl: string): Promise<TranscriptSegment[]> {
  // Add fmt=srv3 to get XML format with text elements
  const url = new URL(captionUrl);
  url.searchParams.set('fmt', 'srv3');

  console.log('[YouTube Transcript LLM] Fetching captions from:', url.toString());
  const response = await fetch(url.toString());

  if (!response.ok) {
    console.error('[YouTube Transcript LLM] Fetch failed:', response.status, response.statusText);
    throw new Error(`Failed to fetch captions: ${response.status}`);
  }

  const text = await response.text();
  console.log('[YouTube Transcript LLM] Caption response length:', text.length);

  if (text.length === 0) {
    throw new Error('Empty caption response from YouTube');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  // Check for parsing errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    console.error('[YouTube Transcript LLM] XML parse error:', parseError.textContent);
    throw new Error('Failed to parse captions XML');
  }

  const textElements = doc.querySelectorAll('text');

  const segments: TranscriptSegment[] = [];

  textElements.forEach((el) => {
    const start = parseFloat(el.getAttribute('start') || '0');
    const duration = parseFloat(el.getAttribute('dur') || '0');
    const content = el.textContent || '';

    // Decode HTML entities
    const decoded = content
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim();

    if (decoded) {
      segments.push({
        text: decoded,
        start,
        duration
      });
    }
  });

  return segments;
}

/**
 * Wait for an element to appear in DOM
 */
function waitForTranscriptElement(selector: string, timeout = 5000): Promise<Element | null> {
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
 * Parse timestamp string (e.g., "1:23" or "1:23:45") to seconds
 */
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':').map(p => parseInt(p, 10));
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Extract transcript from DOM by clicking "Show transcript" button
 */
async function extractTranscriptFromDOM(): Promise<TranscriptSegment[]> {
  console.log('[YouTube Transcript LLM] Trying DOM-based extraction...');

  // Find the "Show transcript" button
  const transcriptButtons = document.querySelectorAll('button');
  let showTranscriptBtn: HTMLElement | null = null;

  for (const btn of transcriptButtons) {
    const text = btn.textContent?.toLowerCase() || '';
    const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
    if (text.includes('show transcript') || ariaLabel.includes('show transcript')) {
      showTranscriptBtn = btn;
      break;
    }
  }

  // Alternative: look for the transcript section button
  if (!showTranscriptBtn) {
    const transcriptSection = document.querySelector('ytd-video-description-transcript-section-renderer');
    if (transcriptSection) {
      showTranscriptBtn = transcriptSection.querySelector('button') as HTMLElement | null;
    }
  }

  if (!showTranscriptBtn) {
    throw new Error('Could not find "Show transcript" button');
  }

  console.log('[YouTube Transcript LLM] Found transcript button, clicking...');
  showTranscriptBtn.click();

  // Wait for transcript panel to open and segments to load
  const segmentSelector = 'ytd-transcript-segment-renderer';
  await new Promise(resolve => setTimeout(resolve, 1000));

  const segment = await waitForTranscriptElement(segmentSelector, 5000);
  if (!segment) {
    throw new Error('Transcript segments did not load');
  }

  // Give a bit more time for all segments to load
  await new Promise(resolve => setTimeout(resolve, 500));

  // Extract all segments
  const segments: TranscriptSegment[] = [];
  const segmentElements = document.querySelectorAll(segmentSelector);

  console.log('[YouTube Transcript LLM] Found', segmentElements.length, 'segments in DOM');

  segmentElements.forEach((el) => {
    const timestampEl = el.querySelector('.segment-timestamp');
    const textEl = el.querySelector('.segment-text');

    if (timestampEl && textEl) {
      const timestampStr = timestampEl.textContent?.trim() || '0:00';
      const text = textEl.textContent?.trim() || '';

      if (text) {
        segments.push({
          text,
          start: parseTimestamp(timestampStr),
          duration: 0 // DOM doesn't provide duration
        });
      }
    }
  });

  // Close the transcript panel
  const closeButton = document.querySelector('button[aria-label="Close transcript"]');
  if (closeButton instanceof HTMLElement) {
    closeButton.click();
  }

  return segments;
}

/**
 * Format timestamp from seconds
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Convert segments to formatted transcript text
 */
function formatTranscript(segments: TranscriptSegment[], includeTimestamps = true): string {
  if (!includeTimestamps) {
    return segments.map(s => s.text).join(' ');
  }

  // Group segments by ~30 second intervals for readability
  const grouped: { timestamp: string; text: string[] }[] = [];
  let currentGroup: { timestamp: string; text: string[] } | null = null;

  for (const segment of segments) {
    const groupStart = Math.floor(segment.start / 30) * 30;

    if (!currentGroup || currentGroup.timestamp !== formatTimestamp(groupStart)) {
      if (currentGroup) {
        grouped.push(currentGroup);
      }
      currentGroup = {
        timestamp: formatTimestamp(groupStart),
        text: [segment.text]
      };
    } else {
      currentGroup.text.push(segment.text);
    }
  }

  if (currentGroup) {
    grouped.push(currentGroup);
  }

  return grouped
    .map(g => `[${g.timestamp}] ${g.text.join(' ')}`)
    .join('\n\n');
}

/**
 * Get video metadata from the page
 * Note: ytInitialPlayerResponse may be stale after SPA navigation,
 * so we prioritize DOM extraction for title/channel
 */
function getVideoMetadata(): VideoMetadata | null {
  const currentVideoId = getVideoId();

  // Always get title and channel from DOM (most up-to-date after SPA navigation)
  const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string');
  const channelEl = document.querySelector('#channel-name a, ytd-channel-name a');

  const title = titleEl?.textContent?.trim() || document.title.replace(' - YouTube', '');
  const channelName = channelEl?.textContent?.trim() || 'Unknown';

  // Try to get duration from player response (if it matches current video)
  let duration = '0:00';
  const playerResponse = getPlayerResponse();

  if (playerResponse?.videoDetails) {
    const responseVideoId = playerResponse.videoDetails.videoId;

    // Only use player response data if it matches current video
    if (responseVideoId === currentVideoId) {
      const lengthSeconds = parseInt(playerResponse.videoDetails.lengthSeconds, 10);
      duration = formatTimestamp(lengthSeconds);
    }
  }

  // Fallback: try to get duration from video element
  if (duration === '0:00') {
    const videoEl = document.querySelector('video');
    if (videoEl && videoEl.duration && isFinite(videoEl.duration)) {
      duration = formatTimestamp(Math.floor(videoEl.duration));
    }
  }

  return {
    title,
    url: `https://www.youtube.com/watch?v=${currentVideoId || ''}`,
    channelName,
    duration
  };
}

/**
 * Main function to extract transcript
 * Priority: 1) Innertube API (Android client) 2) DOM-based extraction
 */
async function extractTranscript(): Promise<TranscriptResultPayload> {
  try {
    console.log('[YouTube Transcript LLM] Starting transcript extraction...');

    let segments: TranscriptSegment[] = [];
    let innertubeError: string | null = null;

    // Method 1: Try Innertube API with Android client (bypasses POT token)
    try {
      segments = await fetchTranscriptViaInnertube();
      console.log('[YouTube Transcript LLM] Innertube extraction succeeded:', segments.length, 'segments');
    } catch (e) {
      innertubeError = e instanceof Error ? e.message : 'Innertube fetch failed';
      console.log('[YouTube Transcript LLM] Innertube extraction failed:', innertubeError);
    }

    // Method 2: If Innertube failed, try DOM-based extraction
    if (segments.length === 0) {
      console.log('[YouTube Transcript LLM] Trying DOM-based extraction as fallback...');
      try {
        segments = await extractTranscriptFromDOM();
        console.log('[YouTube Transcript LLM] DOM extraction succeeded:', segments.length, 'segments');
      } catch (domError) {
        const domErrorMsg = domError instanceof Error ? domError.message : 'DOM extraction failed';
        console.log('[YouTube Transcript LLM] DOM extraction failed:', domErrorMsg);

        // Return error with details from both methods
        if (innertubeError) {
          return {
            success: false,
            error: `Innertube API: ${innertubeError}. DOM fallback: ${domErrorMsg}`
          };
        }

        return {
          success: false,
          error: 'No captions available for this video.'
        };
      }
    }

    if (segments.length === 0) {
      return {
        success: false,
        error: 'No transcript segments found.'
      };
    }

    const transcript = formatTranscript(segments);

    return {
      success: true,
      transcript,
      segments
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to extract transcript: ${errorMessage}`
    };
  }
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: TranscriptResultPayload | VideoInfoPayload) => void
) => {
  if (message.type === 'GET_TRANSCRIPT') {
    extractTranscript().then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_VIDEO_INFO') {
    const metadata = getVideoMetadata();
    sendResponse({
      success: !!metadata,
      metadata: metadata || undefined,
      error: metadata ? undefined : 'Could not get video info'
    });
    return false;
  }

  return false;
});

// ============================================
// Quick Action Button - One-click send to LLM
// ============================================

const QUICK_BUTTON_ID = 'yt-transcript-llm-quick-btn';

const QUICK_BUTTON_STYLES = `
  #${QUICK_BUTTON_ID} {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 16px;
    height: 36px;
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    color: white;
    border: none;
    border-radius: 18px;
    font-family: "Roboto", "Arial", sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-left: 8px;
  }
  #${QUICK_BUTTON_ID}:hover {
    background: linear-gradient(135deg, #6d28d9 0%, #9333ea 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
  }
  #${QUICK_BUTTON_ID}:active {
    transform: translateY(0);
  }
  #${QUICK_BUTTON_ID}:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  #${QUICK_BUTTON_ID} .btn-icon {
    font-size: 16px;
  }
  #${QUICK_BUTTON_ID}.loading .btn-text {
    display: none;
  }
  #${QUICK_BUTTON_ID}.loading .btn-loading {
    display: inline-flex;
  }
  #${QUICK_BUTTON_ID} .btn-loading {
    display: none;
  }
  #${QUICK_BUTTON_ID} .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: yt-llm-spin 0.8s linear infinite;
  }
  @keyframes yt-llm-spin {
    to { transform: rotate(360deg); }
  }
`;

/**
 * Inject styles for quick action button
 */
function injectQuickButtonStyles(): void {
  if (document.getElementById('yt-transcript-llm-styles')) return;

  const style = document.createElement('style');
  style.id = 'yt-transcript-llm-styles';
  style.textContent = QUICK_BUTTON_STYLES;
  document.head.appendChild(style);
}

/**
 * Get saved LLM settings from storage
 */
interface LLMSettings {
  selectedProvider: string;
  selectedPromptId: string;
  selectedLanguage: string;
  customPrompts: Array<{
    id: string;
    name: string;
    template: string;
    isBuiltIn?: boolean;
  }>;
}

interface PromptTemplateLocal {
  id: string;
  name: string;
  template: string;
  isBuiltIn?: boolean;
}

// Default prompts (mirrored from config/prompts.ts for content script use)
const DEFAULT_PROMPTS_LOCAL: PromptTemplateLocal[] = [
  {
    id: 'summary',
    name: 'Summary',
    isBuiltIn: true,
    template: `Analyze the transcript of the YouTube video "{video_title}" ({video_url}):

---
{transcript}
---

Tasks (respond in {output_language}):
1. Brief summary (2-3 sentences)
2. Key points (bullet points)
3. Main conclusions and recommendations
4. Timestamps of important moments (if available)`
  },
  {
    id: 'key-points',
    name: 'Key Points',
    isBuiltIn: true,
    template: `Extract key points from the video "{video_title}":

{transcript}

Present in {output_language}:
- Main points (maximum 10)
- Important quotes
- Actionable takeaways`
  },
  {
    id: 'qa',
    name: 'Q&A Mode',
    isBuiltIn: true,
    template: `You are an expert on the content of the video "{video_title}".

Transcript:
{transcript}

Now I will ask questions about the content of this video. Answer based on the information from the transcript. Respond in {output_language}.`
  },
  {
    id: 'translate',
    name: 'Translate',
    isBuiltIn: true,
    template: `Translate the transcript of the video "{video_title}" to {output_language}, preserving the meaning and style of the original:

{transcript}`
  },
  {
    id: 'notes',
    name: 'Study Notes',
    isBuiltIn: true,
    template: `Create structured study notes for the video "{video_title}" ({video_url}):

{transcript}

Format the notes in {output_language}:
## Main Topic
## Key Concepts
## Examples and Cases
## Self-Check Questions
## Additional Resources (if mentioned)`
  }
];

const LLM_URLS: Record<string, string> = {
  chatgpt: 'https://chatgpt.com/',
  claude: 'https://claude.ai/new',
  gemini: 'https://gemini.google.com/app',
  grok: 'https://grok.com/',
  perplexity: 'https://www.perplexity.ai/'
};

async function getLLMSettings(): Promise<LLMSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['selectedProvider', 'selectedPromptId', 'selectedLanguage', 'customPrompts'], (result) => {
      resolve({
        selectedProvider: result.selectedProvider || 'chatgpt',
        selectedPromptId: result.selectedPromptId || 'summary',
        selectedLanguage: result.selectedLanguage || 'English',
        customPrompts: result.customPrompts || []
      });
    });
  });
}

/**
 * Fill prompt template with variables
 */
function fillPromptTemplateLocal(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Handle quick button click - extract transcript and send to LLM
 */
async function handleQuickButtonClick(button: HTMLButtonElement): Promise<void> {
  // Set loading state
  button.classList.add('loading');
  button.disabled = true;

  try {
    // 1. Get settings
    const settings = await getLLMSettings();
    console.log('[YouTube Transcript LLM] Quick send - Provider:', settings.selectedProvider, 'Prompt:', settings.selectedPromptId);

    // 2. Get metadata
    const metadata = getVideoMetadata();
    if (!metadata) {
      throw new Error('Could not get video metadata');
    }

    // 3. Extract transcript
    const result = await extractTranscript();
    if (!result.success || !result.transcript) {
      throw new Error(result.error || 'Failed to extract transcript');
    }

    // 4. Find the selected prompt
    const allPrompts = [...DEFAULT_PROMPTS_LOCAL, ...settings.customPrompts];
    const selectedPrompt = allPrompts.find(p => p.id === settings.selectedPromptId);
    if (!selectedPrompt) {
      throw new Error('Prompt not found');
    }

    // 5. Fill the prompt template
    const filledPrompt = fillPromptTemplateLocal(selectedPrompt.template, {
      video_title: metadata.title,
      video_url: metadata.url,
      channel_name: metadata.channelName,
      transcript: result.transcript,
      duration: metadata.duration,
      output_language: settings.selectedLanguage
    });

    // 6. Store prompt for injection
    await chrome.storage.local.set({ pendingPrompt: filledPrompt });

    // 7. Open LLM in new tab
    const llmUrl = LLM_URLS[settings.selectedProvider] || LLM_URLS.chatgpt;
    window.open(llmUrl, '_blank');

    console.log('[YouTube Transcript LLM] Quick send complete');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[YouTube Transcript LLM] Quick send error:', message);
    alert(`Error: ${message}`);
  } finally {
    button.classList.remove('loading');
    button.disabled = false;
  }
}

/**
 * Create quick action button element
 */
function createQuickButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = QUICK_BUTTON_ID;
  button.innerHTML = `
    <span class="btn-icon">✨</span>
    <span class="btn-text">LLM</span>
    <span class="btn-loading"><span class="spinner"></span></span>
  `;
  button.title = 'Send transcript to LLM';

  button.addEventListener('click', () => handleQuickButtonClick(button));

  return button;
}

/**
 * Inject quick action button into YouTube UI
 */
function injectQuickButton(): void {
  // Don't inject if already exists
  if (document.getElementById(QUICK_BUTTON_ID)) return;

  // Inject styles first
  injectQuickButtonStyles();

  const button = createQuickButton();

  // Target: the actions row below video (Share, Save, Clip, etc.)
  // Must be within ytd-watch-metadata to avoid sidebar matches
  const watchMetadata = document.querySelector('ytd-watch-metadata');

  if (watchMetadata) {
    // Find the flexible buttons container (contains Share, Save, Clip)
    const flexibleButtons = watchMetadata.querySelector('#flexible-item-buttons');

    // Or find the top-level buttons (contains Like, Dislike)
    const topLevelButtons = watchMetadata.querySelector('#top-level-buttons-computed');

    // Or the actions container
    const actionsInner = watchMetadata.querySelector('#actions-inner, #actions');

    if (flexibleButtons) {
      flexibleButtons.appendChild(button);
      console.log('[YouTube Transcript LLM] Quick button injected in flexible buttons');
    } else if (topLevelButtons && topLevelButtons.parentElement) {
      topLevelButtons.parentElement.appendChild(button);
      console.log('[YouTube Transcript LLM] Quick button injected after top-level buttons');
    } else if (actionsInner) {
      actionsInner.appendChild(button);
      console.log('[YouTube Transcript LLM] Quick button injected in actions');
    } else {
      console.log('[YouTube Transcript LLM] Could not find injection point in watch metadata');
    }
  } else {
    // Fallback for older YouTube layout
    const primaryInfo = document.querySelector('ytd-video-primary-info-renderer');
    if (primaryInfo) {
      const menuContainer = primaryInfo.querySelector('#menu-container');
      if (menuContainer) {
        menuContainer.appendChild(button);
        console.log('[YouTube Transcript LLM] Quick button injected in menu container (fallback)');
      }
    }
  }
}

/**
 * Remove quick button (for cleanup on navigation)
 */
function removeQuickButton(): void {
  const existing = document.getElementById(QUICK_BUTTON_ID);
  if (existing) {
    existing.remove();
  }
}

/**
 * Initialize quick button on page load and navigation
 */
function initQuickButton(): void {
  // Wait for YouTube UI to be ready
  const checkAndInject = (): void => {
    const videoPage = document.querySelector('ytd-watch-flexy');
    if (videoPage && getVideoId()) {
      injectQuickButton();
    }
  };

  // Initial check
  setTimeout(checkAndInject, 1500);

  // Re-inject on YouTube SPA navigation
  document.addEventListener('yt-navigate-finish', () => {
    removeQuickButton();
    setTimeout(checkAndInject, 1000);
  });

  // Also observe for dynamic content loading
  const observer = new MutationObserver(() => {
    if (getVideoId() && !document.getElementById(QUICK_BUTTON_ID)) {
      checkAndInject();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize quick button
initQuickButton();

console.log('[YouTube Transcript LLM] Content script loaded');
