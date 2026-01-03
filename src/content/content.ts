import type {
  Message,
  TranscriptResultPayload,
  TranscriptSegment,
  VideoInfoPayload,
  VideoMetadata
} from '../types';

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

/**
 * Extract ytInitialPlayerResponse from page
 */
function getPlayerResponse(): PlayerResponse | null {
  try {
    // Try to get from window object
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      if (text.includes('ytInitialPlayerResponse')) {
        const match = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
        if (match) {
          return JSON.parse(match[1]);
        }
      }
    }

    // Fallback: try accessing from window (may not work in content script context)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * Fetch transcript from YouTube's timedtext API
 */
async function fetchTranscript(captionUrl: string): Promise<TranscriptSegment[]> {
  const response = await fetch(captionUrl);
  const text = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
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
 */
function getVideoMetadata(): VideoMetadata | null {
  const playerResponse = getPlayerResponse();

  if (playerResponse?.videoDetails) {
    const { title, videoId, lengthSeconds, author } = playerResponse.videoDetails;
    const duration = parseInt(lengthSeconds, 10);

    return {
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      channelName: author,
      duration: formatTimestamp(duration)
    };
  }

  // Fallback: extract from DOM
  const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string');
  const channelEl = document.querySelector('#channel-name a');

  return {
    title: titleEl?.textContent?.trim() || document.title.replace(' - YouTube', ''),
    url: window.location.href,
    channelName: channelEl?.textContent?.trim() || 'Unknown',
    duration: '0:00'
  };
}

/**
 * Main function to extract transcript
 */
async function extractTranscript(): Promise<TranscriptResultPayload> {
  try {
    const playerResponse = getPlayerResponse();

    if (!playerResponse) {
      return {
        success: false,
        error: 'Could not find video data. Please refresh the page and try again.'
      };
    }

    const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      return {
        success: false,
        error: 'No captions available for this video.'
      };
    }

    // Prefer manual captions over auto-generated
    const manualTrack = captionTracks.find(t => !t.kind || t.kind !== 'asr');
    const selectedTrack = manualTrack || captionTracks[0];

    const segments = await fetchTranscript(selectedTrack.baseUrl);
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

console.log('[YouTube Transcript LLM] Content script loaded');
