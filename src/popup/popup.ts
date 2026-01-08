import type {
  LLMProvider,
  PromptTemplate,
  StorageData,
  TranscriptResultPayload,
  VideoInfoPayload,
  VideoMetadata
} from '../types/index.js';
import { LLM_PROVIDERS } from '../config/providers.js';
import { DEFAULT_PROMPTS, fillPromptTemplate } from '../config/prompts.js';

// State
interface AppState {
  videoMetadata: VideoMetadata | null;
  transcript: string | null;
  selectedProvider: LLMProvider;
  selectedPromptId: string;
  selectedLanguage: string;
  prompts: PromptTemplate[];
  isLoading: boolean;
  editingPromptId: string | null;
}

const state: AppState = {
  videoMetadata: null,
  transcript: null,
  selectedProvider: 'chatgpt',
  selectedPromptId: 'summary',
  selectedLanguage: 'English',
  prompts: [...DEFAULT_PROMPTS],
  isLoading: false,
  editingPromptId: null
};

// DOM Elements
const elements = {
  errorContainer: document.getElementById('error-container')!,
  errorMessage: document.getElementById('error-message')!,
  notYoutube: document.getElementById('not-youtube')!,
  mainContent: document.getElementById('main-content')!,
  videoInfoSection: document.getElementById('video-info-section')!,
  videoTitle: document.getElementById('video-title')!,
  videoChannel: document.getElementById('video-channel')!,
  llmSelect: document.getElementById('llm-select') as HTMLSelectElement,
  promptSelect: document.getElementById('prompt-select') as HTMLSelectElement,
  languageSelect: document.getElementById('language-select') as HTMLSelectElement,
  promptPreviewText: document.getElementById('prompt-preview-text')!,
  sendBtn: document.getElementById('send-btn')!,
  sendRawBtn: document.getElementById('send-raw-btn')!,
  copyBtn: document.getElementById('copy-btn')!,
  copyWithPromptBtn: document.getElementById('copy-with-prompt-btn')!,
  toast: document.getElementById('toast')!,
  managePromptsBtn: document.getElementById('manage-prompts-btn')!,
  promptModal: document.getElementById('prompt-modal')!,
  closeModal: document.getElementById('close-modal')!,
  promptsList: document.getElementById('prompts-list')!,
  addPromptBtn: document.getElementById('add-prompt-btn')!,
  editPromptModal: document.getElementById('edit-prompt-modal')!,
  editModalTitle: document.getElementById('edit-modal-title')!,
  closeEditModal: document.getElementById('close-edit-modal')!,
  promptNameInput: document.getElementById('prompt-name-input') as HTMLInputElement,
  promptTemplateInput: document.getElementById('prompt-template-input') as HTMLTextAreaElement,
  cancelEditBtn: document.getElementById('cancel-edit-btn')!,
  savePromptBtn: document.getElementById('save-prompt-btn')!
};

// Utilities
function showError(message: string): void {
  elements.errorMessage.textContent = message;
  elements.errorContainer.classList.remove('hidden');
}

function hideError(): void {
  elements.errorContainer.classList.add('hidden');
}

function setLoading(loading: boolean): void {
  state.isLoading = loading;
  const btnText = elements.sendBtn.querySelector('.btn-text')!;
  const btnLoading = elements.sendBtn.querySelector('.btn-loading')!;

  if (loading) {
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    elements.sendBtn.setAttribute('disabled', 'true');
    elements.sendRawBtn.setAttribute('disabled', 'true');
    elements.copyBtn.setAttribute('disabled', 'true');
    elements.copyWithPromptBtn.setAttribute('disabled', 'true');
  } else {
    btnText.classList.remove('hidden');
    btnLoading.classList.add('hidden');
    if (state.transcript) {
      elements.sendBtn.removeAttribute('disabled');
      elements.sendRawBtn.removeAttribute('disabled');
      elements.copyBtn.removeAttribute('disabled');
      elements.copyWithPromptBtn.removeAttribute('disabled');
    }
  }
}

function showToast(message: string): void {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2000);
}

// Storage
async function loadSettings(): Promise<void> {
  // Load preferences from sync storage
  const syncResult = await chrome.storage.sync.get([
    'selectedProvider',
    'selectedPromptId',
    'selectedLanguage',
    'customPrompts' // Legacy: check sync storage for migration
  ]) as Partial<StorageData> & { selectedLanguage?: string };

  // Load custom prompts from local storage (larger quota)
  const localResult = await chrome.storage.local.get(['customPrompts']) as Pick<StorageData, 'customPrompts'>;

  if (syncResult.selectedProvider) {
    state.selectedProvider = syncResult.selectedProvider;
    elements.llmSelect.value = syncResult.selectedProvider;
  }

  if (syncResult.selectedPromptId) {
    state.selectedPromptId = syncResult.selectedPromptId;
  }

  if (syncResult.selectedLanguage) {
    state.selectedLanguage = syncResult.selectedLanguage;
    elements.languageSelect.value = syncResult.selectedLanguage;
  }

  // Prefer local storage, fallback to sync storage for migration
  const customPrompts = localResult.customPrompts || syncResult.customPrompts;
  if (customPrompts) {
    state.prompts = [...DEFAULT_PROMPTS, ...customPrompts];

    // Migrate from sync to local storage if needed
    if (syncResult.customPrompts && !localResult.customPrompts) {
      await chrome.storage.local.set({ customPrompts: syncResult.customPrompts });
      await chrome.storage.sync.remove('customPrompts');
    }
  }

  updatePromptSelect();
}

async function saveSettings(): Promise<void> {
  const customPrompts = state.prompts.filter(p => !p.isBuiltIn);

  // Save preferences to sync storage (small data, syncs across devices)
  await chrome.storage.sync.set({
    selectedProvider: state.selectedProvider,
    selectedPromptId: state.selectedPromptId,
    selectedLanguage: state.selectedLanguage
  });

  // Save custom prompts to local storage (larger quota - 10MB vs 8KB per item)
  await chrome.storage.local.set({ customPrompts });
}

// UI Updates
function updatePromptSelect(): void {
  elements.promptSelect.innerHTML = '';

  for (const prompt of state.prompts) {
    const option = document.createElement('option');
    option.value = prompt.id;
    option.textContent = prompt.name + (prompt.isBuiltIn ? '' : ' (Custom)');
    elements.promptSelect.appendChild(option);
  }

  elements.promptSelect.value = state.selectedPromptId;
  updatePromptPreview();
}

function updatePromptPreview(): void {
  const prompt = state.prompts.find(p => p.id === state.selectedPromptId);
  if (prompt) {
    const filled = fillPromptTemplate(prompt.template, {
      video_title: state.videoMetadata?.title || '[Video Title]',
      video_url: state.videoMetadata?.url || '[URL]',
      channel_name: state.videoMetadata?.channelName || '[Channel]',
      transcript: state.transcript?.slice(0, 200) + '...' || '[Transcript will appear here]',
      duration: state.videoMetadata?.duration || '[Duration]',
      output_language: state.selectedLanguage
    });
    elements.promptPreviewText.textContent = filled;
  }
}

function updateVideoInfo(metadata: VideoMetadata): void {
  state.videoMetadata = metadata;
  elements.videoTitle.textContent = metadata.title;
  elements.videoChannel.textContent = `${metadata.channelName} • ${metadata.duration}`;
  elements.videoInfoSection.classList.remove('hidden');
}

function renderPromptsList(): void {
  elements.promptsList.innerHTML = '';

  for (const prompt of state.prompts) {
    const item = document.createElement('div');
    item.className = 'prompt-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'prompt-item-name';
    nameSpan.textContent = prompt.name;

    if (prompt.isBuiltIn) {
      const badge = document.createElement('span');
      badge.className = 'prompt-item-badge';
      badge.textContent = 'Built-in';
      nameSpan.appendChild(badge);
    }

    const actions = document.createElement('div');
    actions.className = 'prompt-item-actions';

    if (!prompt.isBuiltIn) {
      const editBtn = document.createElement('button');
      editBtn.textContent = '✏️';
      editBtn.title = 'Edit';
      editBtn.addEventListener('click', () => openEditPromptModal(prompt.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete';
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Delete';
      deleteBtn.addEventListener('click', () => deletePrompt(prompt.id));

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
    }

    item.appendChild(nameSpan);
    item.appendChild(actions);
    elements.promptsList.appendChild(item);
  }
}

// Modals
function openPromptModal(): void {
  renderPromptsList();
  elements.promptModal.classList.remove('hidden');
}

function closePromptModal(): void {
  elements.promptModal.classList.add('hidden');
}

function openEditPromptModal(promptId: string | null = null): void {
  state.editingPromptId = promptId;

  if (promptId) {
    const prompt = state.prompts.find(p => p.id === promptId);
    if (prompt) {
      elements.editModalTitle.textContent = 'Edit Prompt';
      elements.promptNameInput.value = prompt.name;
      elements.promptTemplateInput.value = prompt.template;
    }
  } else {
    elements.editModalTitle.textContent = 'Add Prompt';
    elements.promptNameInput.value = '';
    elements.promptTemplateInput.value = '';
  }

  elements.editPromptModal.classList.remove('hidden');
}

function closeEditPromptModal(): void {
  elements.editPromptModal.classList.add('hidden');
  state.editingPromptId = null;
}

// Prompt CRUD
async function savePrompt(): Promise<void> {
  const name = elements.promptNameInput.value.trim();
  const template = elements.promptTemplateInput.value.trim();

  if (!name || !template) {
    showError('Please fill in all fields');
    return;
  }

  if (state.editingPromptId) {
    // Edit existing
    const index = state.prompts.findIndex(p => p.id === state.editingPromptId);
    if (index !== -1) {
      state.prompts[index] = {
        ...state.prompts[index],
        name,
        template
      };
    }
  } else {
    // Add new
    const newPrompt: PromptTemplate = {
      id: `custom-${Date.now()}`,
      name,
      template,
      isBuiltIn: false
    };
    state.prompts.push(newPrompt);
    state.selectedPromptId = newPrompt.id;
  }

  await saveSettings();
  updatePromptSelect();
  renderPromptsList();
  closeEditPromptModal();
  hideError();
}

async function deletePrompt(promptId: string): Promise<void> {
  state.prompts = state.prompts.filter(p => p.id !== promptId);

  if (state.selectedPromptId === promptId) {
    state.selectedPromptId = 'summary';
  }

  await saveSettings();
  updatePromptSelect();
  renderPromptsList();
}

// Main Actions
async function getVideoInfo(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.id || !tab.url?.includes('youtube.com/watch')) {
    elements.notYoutube.classList.remove('hidden');
    elements.mainContent.classList.add('hidden');
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_VIDEO_INFO' }) as VideoInfoPayload;

    if (response.success && response.metadata) {
      updateVideoInfo(response.metadata);
    }
  } catch {
    // Content script not ready, try again
    setTimeout(getVideoInfo, 500);
  }
}

async function getTranscript(): Promise<void> {
  setLoading(true);
  hideError();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      throw new Error('No active tab');
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TRANSCRIPT' }) as TranscriptResultPayload;

    if (response.success && response.transcript) {
      state.transcript = response.transcript;
      elements.sendBtn.removeAttribute('disabled');
      updatePromptPreview();
    } else {
      throw new Error(response.error || 'Failed to get transcript');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    showError(message);
  } finally {
    setLoading(false);
  }
}

async function sendToLLM(): Promise<void> {
  if (!state.transcript || !state.videoMetadata) {
    showError('No transcript available');
    return;
  }

  setLoading(true);
  hideError();

  try {
    const prompt = state.prompts.find(p => p.id === state.selectedPromptId);
    if (!prompt) {
      throw new Error('Prompt not found');
    }

    const filledPrompt = fillPromptTemplate(prompt.template, {
      video_title: state.videoMetadata.title,
      video_url: state.videoMetadata.url,
      channel_name: state.videoMetadata.channelName,
      transcript: state.transcript,
      duration: state.videoMetadata.duration,
      output_language: state.selectedLanguage
    });

    const provider = LLM_PROVIDERS[state.selectedProvider];

    // Store prompt for injection
    await chrome.storage.local.set({ pendingPrompt: filledPrompt });

    // Open LLM in new tab
    await chrome.tabs.create({ url: provider.url });

    // Save settings
    await saveSettings();

    // Close popup
    window.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    showError(message);
    setLoading(false);
  }
}

async function sendRawToLLM(): Promise<void> {
  if (!state.transcript) {
    showError('No transcript available');
    return;
  }

  setLoading(true);
  hideError();

  try {
    const provider = LLM_PROVIDERS[state.selectedProvider];

    // Store raw transcript for injection
    await chrome.storage.local.set({ pendingPrompt: state.transcript });

    // Open LLM in new tab
    await chrome.tabs.create({ url: provider.url });

    // Save settings
    await saveSettings();

    // Close popup
    window.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    showError(message);
    setLoading(false);
  }
}

async function copyTranscript(): Promise<void> {
  if (!state.transcript) {
    showError('No transcript available');
    return;
  }

  try {
    await navigator.clipboard.writeText(state.transcript);
    showToast('Transcript copied to clipboard!');
  } catch {
    showError('Failed to copy transcript');
  }
}

async function copyWithPrompt(): Promise<void> {
  if (!state.transcript || !state.videoMetadata) {
    showError('No transcript available');
    return;
  }

  try {
    const prompt = state.prompts.find(p => p.id === state.selectedPromptId);
    if (!prompt) {
      showError('Prompt not found');
      return;
    }

    const filledPrompt = fillPromptTemplate(prompt.template, {
      video_title: state.videoMetadata.title,
      video_url: state.videoMetadata.url,
      channel_name: state.videoMetadata.channelName,
      transcript: state.transcript,
      duration: state.videoMetadata.duration,
      output_language: state.selectedLanguage
    });

    await navigator.clipboard.writeText(filledPrompt);
    showToast('Copied with prompt!');
  } catch {
    showError('Failed to copy');
  }
}

// Event Listeners
elements.llmSelect.addEventListener('change', () => {
  state.selectedProvider = elements.llmSelect.value as LLMProvider;
  saveSettings();
});

elements.promptSelect.addEventListener('change', () => {
  state.selectedPromptId = elements.promptSelect.value;
  updatePromptPreview();
  saveSettings();
});

elements.languageSelect.addEventListener('change', () => {
  state.selectedLanguage = elements.languageSelect.value;
  updatePromptPreview();
  saveSettings();
});

elements.sendBtn.addEventListener('click', sendToLLM);
elements.sendRawBtn.addEventListener('click', sendRawToLLM);
elements.copyBtn.addEventListener('click', copyTranscript);
elements.copyWithPromptBtn.addEventListener('click', copyWithPrompt);
elements.managePromptsBtn.addEventListener('click', openPromptModal);
elements.closeModal.addEventListener('click', closePromptModal);
elements.addPromptBtn.addEventListener('click', () => openEditPromptModal(null));
elements.closeEditModal.addEventListener('click', closeEditPromptModal);
elements.cancelEditBtn.addEventListener('click', closeEditPromptModal);
elements.savePromptBtn.addEventListener('click', savePrompt);

// Close modals on background click
elements.promptModal.addEventListener('click', (e) => {
  if (e.target === elements.promptModal) {
    closePromptModal();
  }
});

elements.editPromptModal.addEventListener('click', (e) => {
  if (e.target === elements.editPromptModal) {
    closeEditPromptModal();
  }
});

// Reset video-specific state
function resetVideoState(): void {
  state.videoMetadata = null;
  state.transcript = null;

  // Reset UI
  elements.videoTitle.textContent = 'Loading...';
  elements.videoChannel.textContent = '';
  elements.videoInfoSection.classList.add('hidden');
  elements.sendBtn.setAttribute('disabled', 'true');
  elements.sendRawBtn.setAttribute('disabled', 'true');
  elements.copyBtn.setAttribute('disabled', 'true');
  elements.copyWithPromptBtn.setAttribute('disabled', 'true');
  hideError();
}

// Initialize
async function init(): Promise<void> {
  resetVideoState();
  await loadSettings();
  await getVideoInfo();
  await getTranscript();
}

init();
