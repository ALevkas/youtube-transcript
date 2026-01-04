// LLM Provider types
export type LLMProvider = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity';

export interface LLMConfig {
  id: LLMProvider;
  name: string;
  url: string;
  inputSelector: string;
  submitSelector: string;
}

// Prompt template types
export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  isDefault?: boolean;
  isBuiltIn?: boolean;
}

// Video metadata
export interface VideoMetadata {
  title: string;
  url: string;
  channelName: string;
  duration: string;
}

// Transcript segment
export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

// Message types for communication between scripts
export type MessageType =
  | 'GET_TRANSCRIPT'
  | 'TRANSCRIPT_RESULT'
  | 'INJECT_PROMPT'
  | 'GET_VIDEO_INFO'
  | 'VIDEO_INFO_RESULT';

export interface Message {
  type: MessageType;
  payload?: unknown;
}

export interface TranscriptResultPayload {
  success: boolean;
  transcript?: string;
  segments?: TranscriptSegment[];
  error?: string;
}

export interface VideoInfoPayload {
  success: boolean;
  metadata?: VideoMetadata;
  error?: string;
}

export interface InjectPromptPayload {
  prompt: string;
  autoSubmit: boolean;
}

// Storage types
export interface StorageData {
  selectedProvider: LLMProvider;
  selectedPromptId: string;
  customPrompts: PromptTemplate[];
  lastUsedSettings: {
    provider: LLMProvider;
    promptId: string;
  };
}
