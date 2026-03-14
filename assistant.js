(function () {
  'use strict';

  const STORAGE = {
    model: 'cf4_model',
    draft: 'cf4_assistant_draft',
    current: 'cf4_assistant_current',
    conversations: 'cf4_assistant_conversations',
    ui: 'cf4_assistant_ui',
    providerKeys: 'cf4_provider_keys',
    geminiModel: 'cf4_gemini_model',
    geminiUsage: 'cf4_gemini_usage',
    audioModel: 'cf4_audio_model',
    groqKey: 'cf4_groq_key'
  };

  const GEMINI_MODELS = [
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', rpm: 15, rpd: 1000 },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', rpm: 10, rpd: 250 },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', rpm: 5, rpd: 100 }
  ];

  const MODELS = [
    { id: 'assistant:max', provider: 'smart', model: 'assistant:max', label: 'Recommended - Max', supportsImages: true, supportsPdf: true },
    { id: 'groq:meta-llama/llama-4-scout-17b-16e-instruct', provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Groq - Llama 4 Scout', supportsImages: true, supportsPdf: false },
    { id: 'groq:openai/gpt-oss-120b', provider: 'groq', model: 'openai/gpt-oss-120b', label: 'Groq - GPT OSS 120B', supportsImages: false, supportsPdf: false },
    { id: 'groq:openai/gpt-oss-20b', provider: 'groq', model: 'openai/gpt-oss-20b', label: 'Groq - GPT OSS 20B', supportsImages: false, supportsPdf: false },
    { id: 'groq:moonshotai/kimi-k2-instruct', provider: 'groq', model: 'moonshotai/kimi-k2-instruct', label: 'Groq - Kimi K2', supportsImages: false, supportsPdf: false },
    { id: 'groq:qwen/qwen3-32b', provider: 'groq', model: 'qwen/qwen3-32b', label: 'Groq - Qwen3 32B', supportsImages: false, supportsPdf: false },
    { id: 'groq:llama-3.3-70b-versatile', provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'Groq - Llama 3.3 70B Versatile', supportsImages: false, supportsPdf: false },
    { id: 'groq:llama-3.1-8b-instant', provider: 'groq', model: 'llama-3.1-8b-instant', label: 'Groq - Llama 3.1 8B Instant', supportsImages: false, supportsPdf: false },
    { id: 'openai:gpt-4.1-mini', provider: 'openai', model: 'gpt-4.1-mini', label: 'OpenAI - GPT-4.1 mini', supportsImages: true, supportsPdf: false }
  ];

  const QA = {
    modes: 'How do the assistant modes and model routing work inside CodeForge?',
    translate: 'How should I translate code comments, prompts, or text output inside this workspace?',
    autocopy: 'What does Auto-Copy mean in this assistant and when should I use it?',
    export: 'How do exports, saved conversations, and workspace persistence work in this app?',
    explain: 'Walk through my code step by step. Explain the algorithm, key variables, complexity, and likely output.',
    fix: '',
    optimize: 'Optimize my code for better time and space complexity while keeping it correct. Return the complete optimized file in a cpp block.',
    review: 'Code review this solution for correctness, edge cases, efficiency, readability, and C++ best practices.',
    complexity: 'Analyze time complexity and space complexity of my code and suggest any meaningful Big-O improvements.',
    tests: 'Generate 6 precise test cases for this code, each with a name, exact stdin, and expected stdout.'
  };

  const uploadCache = new Map();
  let recognition = null;
  let dictationBase = '';
  let dictationFinal = '';

  const state = {
    isOpen: false,
    minimized: true,
    maximized: false,
    showHistory: false,
    isSending: false,
    isListening: false,
    unread: 0,
    model: localStorage.getItem(STORAGE.model) || 'assistant:max',
    draft: sessionStorage.getItem(STORAGE.draft) || '',
    currentConversationId: localStorage.getItem(STORAGE.current) || '',
    conversations: parseJson(localStorage.getItem(STORAGE.conversations), []),
    providerKeys: normalizeProviderKeys(parseJson(localStorage.getItem(STORAGE.providerKeys), { groq: [], gemini: [], openai: [] })),
    geminiModel: localStorage.getItem(STORAGE.geminiModel) || 'gemini-2.5-flash-lite',
    geminiUsage: parseJson(localStorage.getItem(STORAGE.geminiUsage), {}),
    audioModel: localStorage.getItem(STORAGE.audioModel) || 'whisper-large-v3-turbo',
    pendingAttachments: [],
    sendOnStop: false
  };

  function $(id) { return document.getElementById(id); }
  function parseJson(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
  function setJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function bridge() {
    return window.CodeForgeBridge || {
      getCode() { return ''; },
      getStd() { return 'c++17'; },
      getFlags() { return []; },
      getLastResult() { return null; },
      getTests() { return []; },
      getActiveFile() { return null; },
      getMemoryStatus() { return null; },
      getMemoryRuntimeSummary() { return ''; },
      getMemoryPromptContext() { return ''; },
      applyCode() { return false; },
      showToast() {}
    };
  }

  function toast(message, type, duration) {
    bridge().showToast(message, type, duration);
  }

  function normalizeProviderKeys(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const norm = value => Array.isArray(value)
      ? [...new Set(value.map(v => String(v || '').trim()).filter(Boolean))]
      : [];
    return {
      groq: norm(src.groq),
      gemini: norm(src.gemini),
      openai: norm(src.openai)
    };
  }

  function persist() {
    setJson(STORAGE.conversations, state.conversations);
    localStorage.setItem(STORAGE.current, state.currentConversationId || '');
    localStorage.setItem(STORAGE.model, state.model);
    localStorage.setItem(STORAGE.geminiModel, state.geminiModel);
    localStorage.setItem(STORAGE.audioModel, state.audioModel);
    setJson(STORAGE.providerKeys, normalizeProviderKeys(state.providerKeys));
    setJson(STORAGE.geminiUsage, state.geminiUsage);
    setJson(STORAGE.ui, { isOpen: !!state.isOpen, showHistory: !!state.showHistory, unread: Number(state.unread || 0) });
    try { sessionStorage.setItem(STORAGE.draft, state.draft || ''); } catch {}
  }

  function loadUiState() {
    const ui = parseJson(localStorage.getItem(STORAGE.ui), {});
    state.isOpen = !!ui.isOpen;
    state.showHistory = !!ui.showHistory;
    state.unread = Number(ui.unread || 0);
    state.maximized = false;
  }

  function buildWelcomeMessage() {
    return 'I can help with this CodeForge workspace and also answer general questions. Ask about models, prompts, coding, tests, compiler output, exports, or anything else you need.';
  }

  function freshConversation() {
    const now = Date.now();
    return {
      id: 'chat_' + now + '_' + uid(),
      title: 'New chat',
      createdAt: now,
      updatedAt: now,
      messages: [{ id: uid(), role: 'assistant', content: buildWelcomeMessage(), model: state.model }]
    };
  }

  function ensureConversation() {
    if (!state.conversations.length) {
      const convo = freshConversation();
      state.conversations = [convo];
      state.currentConversationId = convo.id;
    }
    if (!getCurrentConversation()) state.currentConversationId = state.conversations[0].id;
  }

  function getCurrentConversation() {
    return state.conversations.find(c => c.id === state.currentConversationId) || null;
  }

  function updateConversationTitle(convo) {
    const user = (convo.messages || []).find(msg => msg.role === 'user' && String(msg.content || '').trim());
    const compact = user ? String(user.content || '').replace(/\s+/g, ' ').trim() : '';
    convo.title = compact ? (compact.length > 52 ? compact.slice(0, 52) + '...' : compact) : 'New chat';
  }

  function getModelOption(id) {
    return MODELS.find(model => model.id === (id || state.model)) || MODELS[0];
  }

  function getGeminiModelOption() {
    return GEMINI_MODELS.find(model => model.value === state.geminiModel) || GEMINI_MODELS[0];
  }

  function getProviderKey(provider) {
    state.providerKeys = normalizeProviderKeys(state.providerKeys);
    return state.providerKeys[provider][0] || '';
  }

  function hasAnyProviderKey() {
    state.providerKeys = normalizeProviderKeys(state.providerKeys);
    return ['groq', 'gemini', 'openai'].some(provider => !!(state.providerKeys[provider] && state.providerKeys[provider][0]));
  }

  function setProviderKey(provider, key) {
    const cleaned = String(key || '').trim();
    const next = state.providerKeys[provider].filter(Boolean).filter(v => v !== cleaned);
    state.providerKeys[provider] = cleaned ? [cleaned].concat(next) : next;
    if (provider === 'groq') localStorage.setItem(STORAGE.groqKey, cleaned);
    persist();
  }

  function currentQuickActionPrompt(key) {
    if (key !== 'fix') return QA[key] || '';
    const last = bridge().getLastResult();
    const err = last && last.stderr;
    return err
      ? 'My code has the following errors:\n```\n' + String(err).slice(0, 2000) + '\n```\nFix all errors and return the complete corrected code in a cpp block.'
      : 'Review my code for bugs, edge cases, and potential issues. If changes are needed, return the complete corrected code in a cpp block.';
  }

  function taskNameForQuickAction(key) {
    return key || 'general-chat';
  }

  function buildRuntimeSummary() {
    const api = bridge();
    const file = api.getActiveFile ? api.getActiveFile() : null;
    const result = api.getLastResult();
    const lines = [
      'Mode: CodeForge assistant',
      'Compiler standard: ' + api.getStd(),
      'Compiler flags: ' + (api.getFlags() || []).join(' '),
      'Active file: ' + (file ? file.name : 'none'),
      'Tests on active file: ' + ((api.getTests() || []).length),
      'Audio model: ' + state.audioModel,
      'Assistant model: ' + getModelOption().label,
      'Gemini analysis model: ' + getGeminiModelOption().label,
      result ? ('Last run: provider ' + result.provider + ', exit ' + result.exitCode + ', status ' + result.status) : 'Last run: not executed yet'
    ];
    const memorySummary = api.getMemoryRuntimeSummary ? api.getMemoryRuntimeSummary() : '';
    if (memorySummary) lines.push(memorySummary);
    return lines.join('\n');
  }

  function buildSystemPrompt(attachmentHints, taskName) {
    const api = bridge();
    const code = api.getCode();
    const result = api.getLastResult();
    const memoryStatus = api.getMemoryStatus ? api.getMemoryStatus() : null;
    const memoryContext = api.getMemoryPromptContext
      ? api.getMemoryPromptContext({ surface: 'assistant', taskName: taskName || 'general-chat', maxChars: 7000 })
      : '';
    const styleInstruction = memoryStatus && memoryStatus.outputStyleInstruction
      ? memoryStatus.outputStyleInstruction
      : 'Use a technical, clear, and beginner-friendly style unless the user clearly wants something else.';
    let prompt =
      'You are ForgeAI, a Verba-grade assistant embedded inside CodeForge IDE.\n' +
      'You are grounded first in the active C++ workspace, but may answer normal questions too.\n' +
      'Prefer explanations that are accurate, fast to understand, and comfortable for a beginner.\n\n' +
      'Preferred response style:\n' + styleInstruction + '\n\n' +
      'Current runtime state:\n' + buildRuntimeSummary() + '\n\n';
    if (memoryContext) prompt += 'Active memory context:\n' + memoryContext + '\n\n';
    prompt += 'Current code:\n```cpp\n' + code + '\n```\n\n';
    if (result) {
      prompt += 'Last execution:\nProvider: ' + result.provider + ' | Exit: ' + result.exitCode + ' | Status: ' + result.status + '\n';
      if ((result.stdout || '').trim()) prompt += 'stdout:\n```\n' + String(result.stdout).slice(0, 3000) + '\n```\n';
      if ((result.stderr || '').trim()) prompt += 'stderr:\n```\n' + String(result.stderr).slice(0, 3000) + '\n```\n';
      prompt += '\n';
    }
    if (attachmentHints) prompt += 'Attachment guidance:\n' + attachmentHints + '\n\n';
    prompt +=
      'Strict rules:\n' +
      '1. When providing C++ code, return the complete file in a cpp block.\n' +
      '2. Never use placeholders such as rest of code unchanged.\n' +
      '3. Reference compiler errors when available.\n' +
      '4. Treat the current message, attachments, runtime state, code, tests, and compile output as more reliable than long-term memory when they conflict.\n' +
      '5. Keep answers useful for online judges and modern C++ workflows.\n' +
      '6. Be concise when possible, but prioritize correctness and completeness.\n';
    return prompt;
  }

  function buildAttachmentHints(items) {
    if (!items.length) return '';
    const lines = [];
    if (items.some(item => item.kind === 'pdf')) lines.push('- PDFs: inspect directly, OCR if needed, extract values and structure.');
    if (items.some(item => item.kind === 'text')) lines.push('- Text files: read directly and preserve structure when useful.');
    if (items.some(item => item.kind === 'image')) lines.push('- Images: inspect directly, OCR readable text, and extract important details.');
    return lines.join('\n');
  }

  function normalizeAttachment(file) {
    const mime = (file.type || '').toLowerCase();
    if (!file || file.size > 20 * 1024 * 1024) throw new Error('Each attachment must be 20 MB or smaller.');
    if (/^image\/(png|jpeg|webp)$/.test(mime)) return { kind: 'image', file, name: file.name, mimeType: mime, size: file.size };
    if (mime === 'application/pdf' || /\.pdf$/i.test(file.name || '')) return { kind: 'pdf', file, name: file.name, mimeType: 'application/pdf', size: file.size };
    if (mime === 'text/plain' || mime === 'text/markdown' || mime === 'text/csv' || mime === 'application/json' || /\.(txt|md|csv|json)$/i.test(file.name || '')) {
      return { kind: 'text', file, name: file.name, mimeType: mime || 'text/plain', size: file.size };
    }
    throw new Error('Unsupported attachment type: ' + (file.name || 'file'));
  }

  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file text.'));
      reader.readAsText(file);
    });
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file data.'));
      reader.readAsDataURL(file);
    });
  }

  function attachmentSummary(items) {
    const counts = { image: 0, pdf: 0, text: 0 };
    items.forEach(item => { counts[item.kind] = (counts[item.kind] || 0) + 1; });
    const parts = [];
    if (counts.image) parts.push(counts.image + ' image' + (counts.image > 1 ? 's' : ''));
    if (counts.pdf) parts.push(counts.pdf + ' PDF' + (counts.pdf > 1 ? 's' : ''));
    if (counts.text) parts.push(counts.text + ' file' + (counts.text > 1 ? 's' : ''));
    return parts.join(' + ');
  }

  function attachmentOnlyPrompt(items) {
    const hasPdf = items.some(item => item.kind === 'pdf');
    const hasText = items.some(item => item.kind === 'text');
    if (hasPdf) return 'Please analyze this PDF and summarize the important content.';
    if (hasText) return 'Please analyze these attached files and summarize the important content.';
    return items.length > 1
      ? 'Please analyze these images and extract the important details and any readable text.'
      : 'Please analyze this image and extract the important details and any readable text.';
  }

  function isLongOutput(text) {
    return /(complete implementation|full code|full file|detailed|comprehensive|documentation|entire file|report)/i.test(text);
  }

  function isContextHeavy(text) {
    return /(analyze|architecture|design|refactor|plan|compare|research|codebase|system design)/i.test(text);
  }

  function isQuick(text) {
    return /(quick|brief|short|one line|tl;dr)/i.test(text);
  }

  function resolveModel(attachments, text) {
    const selected = getModelOption();
    if (selected.id !== 'assistant:max') {
      if (attachments.length && getProviderKey('gemini')) {
        if (attachments.some(item => item.kind === 'image' || item.kind === 'pdf' || item.kind === 'text')) {
          return { provider: 'gemini', model: state.geminiModel, label: getGeminiModelOption().label, supportsImages: true, supportsPdf: true };
        }
      }
      return selected;
    }
    if (attachments.length) {
      if (getProviderKey('gemini')) return { provider: 'gemini', model: state.geminiModel, label: getGeminiModelOption().label, supportsImages: true, supportsPdf: true };
      return getModelOption('groq:meta-llama/llama-4-scout-17b-16e-instruct');
    }
    if (isLongOutput(text)) return getModelOption('groq:llama-3.3-70b-versatile');
    if (isContextHeavy(text)) return getModelOption('groq:moonshotai/kimi-k2-instruct');
    if (isQuick(text)) return getModelOption('groq:llama-3.1-8b-instant');
    return getModelOption('groq:llama-3.3-70b-versatile');
  }

  async function uploadGeminiFile(file, key) {
    const cacheKey = [file.name, file.size, file.type, file.lastModified].join('|');
    const cached = uploadCache.get(cacheKey);
    if (cached && Date.now() - cached.uploadedAt < (25 * 60 * 1000)) return cached;
    const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(file.size),
        'X-Goog-Upload-Header-Content-Type': file.type || 'application/octet-stream',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ file: { display_name: file.name } }),
      signal: AbortSignal.timeout(30000)
    });
    if (!start.ok) throw new Error('Gemini upload start failed.');
    const uploadUrl = start.headers.get('x-goog-upload-url');
    if (!uploadUrl) throw new Error('Gemini upload session missing.');
    const finish = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize'
      },
      body: await file.arrayBuffer(),
      signal: AbortSignal.timeout(60000)
    });
    if (!finish.ok) throw new Error('Gemini upload failed.');
    const data = await finish.json();
    const fileData = data.file || data;
    const out = {
      uri: fileData.uri,
      mimeType: fileData.mimeType || file.type || 'application/octet-stream',
      uploadedAt: Date.now(),
      fileName: file.name
    };
    uploadCache.set(cacheKey, out);
    return out;
  }

  async function prepareAttachments(items, provider) {
    const prepared = [];
    if (provider === 'gemini') {
      const key = getProviderKey('gemini');
      if (!key) throw new Error('A Gemini key is required for this request.');
      for (const item of items) {
        if (item.kind === 'text') prepared.push({ kind: 'text', name: item.name, textContent: await readAsText(item.file), mimeType: item.mimeType });
        else {
          const uploaded = await uploadGeminiFile(item.file, key);
          prepared.push({ kind: item.kind, name: item.name, mimeType: uploaded.mimeType, fileUri: uploaded.uri });
        }
      }
      return prepared;
    }
    for (const item of items) {
      if (item.kind === 'pdf') throw new Error('PDF analysis requires Gemini in this browser-only build.');
      if (item.kind === 'text') prepared.push({ kind: 'text', name: item.name, textContent: await readAsText(item.file), mimeType: item.mimeType });
      if (item.kind === 'image') prepared.push({ kind: 'image', name: item.name, dataUrl: await readAsDataUrl(item.file), mimeType: item.mimeType });
    }
    return prepared;
  }

  function conversationHistoryMessages() {
    const convo = getCurrentConversation();
    return (convo ? convo.messages : [])
      .filter(msg => msg && (msg.role === 'user' || msg.role === 'assistant'))
      .slice(-8);
  }

  function buildChatMessages(promptText, attachments, taskName) {
    const messages = [{ role: 'system', content: buildSystemPrompt(buildAttachmentHints(attachments), taskName) }];
    conversationHistoryMessages().forEach(msg => {
      messages.push({ role: msg.role, content: msg.content });
    });
    let userText = promptText;
    const textAttachments = attachments.filter(item => item.kind === 'text');
    if (textAttachments.length) {
      userText += '\n\n' + textAttachments.map(item => 'Attached file: ' + item.name + '\n\n' + String(item.textContent || '').slice(0, 200000)).join('\n\n');
    }
    const imageAttachments = attachments.filter(item => item.kind === 'image');
    if (!imageAttachments.length) {
      messages.push({ role: 'user', content: userText });
      return messages;
    }
    messages.push({
      role: 'user',
      content: [{ type: 'text', text: userText }].concat(imageAttachments.map(item => ({ type: 'image_url', image_url: { url: item.dataUrl } })))
    });
    return messages;
  }

  async function requestChat(target, promptText, attachments, taskName) {
    const key = getProviderKey(target.provider);
    if (!key) throw new Error('No ' + target.provider + ' key configured. Save one in Settings first.');
    const endpoint = target.provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.groq.com/openai/v1/chat/completions';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: target.model,
        messages: buildChatMessages(promptText, attachments, taskName),
        temperature: 0.1,
        max_tokens: 4096
      }),
      signal: AbortSignal.timeout(60000)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err.error && err.error.message) || ('HTTP ' + response.status));
    }
    const data = await response.json();
    return normalizeAssistantText(data.choices?.[0]?.message?.content || 'No response received.');
  }

  async function requestGemini(target, promptText, attachments, taskName) {
    const key = getProviderKey('gemini');
    if (!key) throw new Error('No Gemini key configured. Save one in Settings first.');
    const contents = conversationHistoryMessages().map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    const parts = [{ text: buildSystemPrompt(buildAttachmentHints(attachments), taskName) + '\n\nUser request:\n' + promptText }];
    attachments.forEach(item => {
      if (item.kind === 'text') parts.push({ text: 'Attached file: ' + item.name + '\n\n' + String(item.textContent || '').slice(0, 200000) });
      else parts.push({ file_data: { mime_type: item.mimeType, file_uri: item.fileUri } });
    });
    contents.push({ role: 'user', parts });
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(target.model) + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
      signal: AbortSignal.timeout(90000)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err.error && err.error.message) || ('Gemini HTTP ' + response.status));
    }
    const data = await response.json();
    updateGeminiUsage(target.model);
    const text = (data.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('\n').trim();
    return normalizeAssistantText(text || 'No response received.');
  }

  function updateGeminiUsage(model) {
    const option = GEMINI_MODELS.find(item => item.value === model) || getGeminiModelOption();
    const current = state.geminiUsage[model] || { minute: { windowStart: Date.now(), used: 0 }, daily: { date: new Date().toDateString(), used: 0 } };
    const now = Date.now();
    if (now - current.minute.windowStart > 60000) current.minute = { windowStart: now, used: 0 };
    if (current.daily.date !== new Date().toDateString()) current.daily = { date: new Date().toDateString(), used: 0 };
    current.minute.used += 1;
    current.daily.used += 1;
    current.rpm = option.rpm;
    current.rpd = option.rpd;
    state.geminiUsage[model] = current;
    persist();
    renderGeminiUsage();
  }

  function normalizeAssistantText(text) {
    return String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function pushMessage(role, content, extra) {
    ensureConversation();
    const convo = getCurrentConversation();
    const message = {
      id: uid(),
      role,
      content: String(content || ''),
      model: extra && extra.model ? extra.model : null,
      provider: extra && extra.provider ? extra.provider : null,
      attachments: extra && Array.isArray(extra.attachments) ? extra.attachments : []
    };
    convo.messages.push(message);
    convo.updatedAt = Date.now();
    updateConversationTitle(convo);
    if (role === 'assistant' && !state.isOpen) state.unread = Math.min(9, Number(state.unread || 0) + 1);
    persist();
    render();
    return message;
  }

  function renderThinking(text) {
    const match = String(text || '').match(/<think>([\s\S]*?)<\/think>/i);
    if (!match) return { thinking: '', final: String(text || '') };
    return {
      thinking: normalizeAssistantText(match[1]),
      final: normalizeAssistantText(String(text || '').replace(match[0], '').trim())
    };
  }

  function renderMessageHtml(text) {
    const parts = renderThinking(text);
    let html = esc(parts.final || text);
    html = html.replace(/```([\w+#.\-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const clean = String(code || '').trim();
      const encoded = encodeURIComponent(clean);
      const isCpp = /^(cpp|c\+\+|cxx|c)$/i.test(String(lang || '').trim());
      return '<div class="assistant-code-wrap"><div class="assistant-code-head"><span>' + esc(String(lang || 'code').trim() || 'code') + '</span><div class="assistant-code-actions"><button class="assistant-code-copy" data-copy-code="' + encoded + '">Copy</button>' + (isCpp ? '<button class="assistant-code-apply" data-apply-code="' + encoded + '">Apply</button>' : '') + '</div></div><pre class="assistant-code"><code>' + clean + '</code></pre></div>';
    });
    html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>[\s\S]*?<\/li>\n?)+)/g, '<ul>$1</ul>');
    html = html.split(/\n{2,}/).map(block => {
      block = block.trim();
      if (!block) return '';
      if (/^<(h[3-4]|ul|div|pre)/.test(block)) return block;
      return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
    }).filter(Boolean).join('\n');
    if (parts.thinking) {
      html = '<div class="assistant-thinking"><strong>Thinking</strong><span class="assistant-thinking-dots"><span></span><span></span><span></span></span><p>' + esc(parts.thinking).replace(/\n/g, '<br>') + '</p></div>' + html;
    }
    return html;
  }

  function renderHistory() {
    const list = $('assistantHistoryList');
    if (!list) return;
    const items = state.conversations.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    list.innerHTML = items.map(convo => {
      const active = convo.id === state.currentConversationId ? ' active' : '';
      const stamp = new Date(convo.updatedAt || convo.createdAt || Date.now()).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      return '<div class="assistant-history-item' + active + '" data-conversation-id="' + esc(convo.id) + '">' +
        '<div class="assistant-history-copy"><span class="assistant-history-title">' + esc(convo.title || 'New chat') + '</span><span class="assistant-history-meta">' + esc(stamp) + '</span></div>' +
        '<button class="assistant-history-delete" data-delete-conversation="' + esc(convo.id) + '" title="Delete conversation" aria-label="Delete conversation">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>' +
        '</button>' +
      '</div>';
    }).join('');
  }

  function renderMessages() {
    const messages = $('assistantMessages');
    const empty = $('assistantEmpty');
    if (!messages) return;
    const convo = getCurrentConversation();
    const items = convo ? convo.messages || [] : [];
    messages.innerHTML = '';
    if (empty) empty.classList.toggle('hidden', !!items.length);
    items.forEach(msg => {
      const row = document.createElement('div');
      row.className = 'assistant-msg ' + (msg.role === 'user' ? 'user msg-enter-user' : 'msg-enter-assistant') + (msg.error ? ' error' : '');
      const avatar = msg.role === 'assistant'
        ? '<div class="assistant-avatar-dot"><div class="assistant-robot-badge"><span class="assistant-robot-eye"></span></div></div>'
        : '';
      const attachments = (msg.attachments || []).length
        ? '<div class="assistant-attachments">' + msg.attachments.map(item => '<span class="assistant-attachment-chip">' + esc(item.name || item.kind || 'attachment') + '</span>').join('') + '</div>'
        : '';
      const bubble = msg.role === 'user'
        ? '<div class="assistant-bubble">' + attachments + '<p>' + esc(msg.content).replace(/\n/g, '<br>') + '</p></div>'
        : '<div class="assistant-bubble">' + attachments + renderMessageHtml(msg.content) + (msg.model ? '<span class="assistant-model-stamp">via ' + esc(String(msg.model).split('/').pop()) + '</span>' : '') + '</div>';
      row.innerHTML = avatar + '<div class="assistant-bubble-wrap">' + bubble + '</div>';
      messages.appendChild(row);
    });
    messages.scrollTop = messages.scrollHeight;
  }

  function renderAttachmentPreview() {
    const wrap = $('assistantAttachmentPreview');
    const kind = $('assistantAttachmentKind');
    const meta = $('assistantAttachmentMeta');
    if (!wrap || !kind || !meta) return;
    if (!state.pendingAttachments.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    kind.textContent = attachmentSummary(state.pendingAttachments);
    meta.textContent = state.pendingAttachments.length === 1 ? state.pendingAttachments[0].name : state.pendingAttachments.slice(0, 3).map(item => item.name).join(', ');
  }

  function renderUnread() {
    const badge = $('assistantUnread');
    if (!badge) return;
    badge.textContent = state.unread > 9 ? '9+' : String(state.unread || 0);
    badge.classList.toggle('visible', state.unread > 0);
  }

  function renderRuntimeMeta() {
    const meta = $('assistantRuntimeMeta');
    const line = $('assistantModelMeta');
    const target = resolveModel(state.pendingAttachments, state.draft || '');
    const providerLabel = target.provider === 'smart' ? 'SMART' : String(target.provider || '').toUpperCase();
    if (meta) meta.textContent = 'codeforge | ' + providerLabel + ' | ' + String(bridge().getStd() || 'c++17').toUpperCase();
    if (line) line.textContent = target.label + ' | ' + (state.pendingAttachments.length ? attachmentSummary(state.pendingAttachments) : 'text only');
  }

  function syncComposerHeight() {
    const input = $('assistantInput');
    if (!input) return;
    input.style.height = '44px';
    input.style.height = Math.min(108, Math.max(44, input.scrollHeight)) + 'px';
  }

  function renderGeminiUsage() {
    const title = $('settings-gemini-usage-title');
    const minuteLabel = $('gemini-usage-minute-label');
    const dailyLabel = $('gemini-usage-daily-label');
    const minuteBar = $('gemini-usage-minute-bar');
    const dailyBar = $('gemini-usage-daily-bar');
    const option = getGeminiModelOption();
    const usage = state.geminiUsage[state.geminiModel] || { minute: { used: 0 }, daily: { used: 0 } };
    const minuteUsed = usage.minute?.used || 0;
    const dailyUsed = usage.daily?.used || 0;
    if (title) title.textContent = option.label + ' usage';
    if (minuteLabel) minuteLabel.textContent = minuteUsed + ' / ' + option.rpm + ' used | ' + Math.max(option.rpm - minuteUsed, 0) + ' left';
    if (dailyLabel) dailyLabel.textContent = dailyUsed + ' / ' + option.rpd + ' used | ' + Math.max(option.rpd - dailyUsed, 0) + ' left';
    if (minuteBar) minuteBar.style.width = Math.min(100, option.rpm ? (minuteUsed / option.rpm) * 100 : 0) + '%';
    if (dailyBar) dailyBar.style.width = Math.min(100, option.rpd ? (dailyUsed / option.rpd) * 100 : 0) + '%';
  }

  function syncSettingsFields() {
    const map = {
      'settings-groq-key': getProviderKey('groq'),
      'settings-gemini-key': getProviderKey('gemini'),
      'settings-openai-key': getProviderKey('openai'),
      'settings-model': state.model,
      'assistantModelSelect': state.model,
      'settings-gemini-model': state.geminiModel,
      'settings-audio-model': state.audioModel
    };
    Object.keys(map).forEach(id => {
      const el = $(id);
      if (el) el.value = map[id];
    });
    const geminiVault = $('settings-gemini-vault');
    const keyVault = $('settings-key-vault');
    if (geminiVault) geminiVault.value = state.providerKeys.gemini.join('\n');
    if (keyVault) {
      keyVault.value = ['[groq]', state.providerKeys.groq.join('\n'), '', '[gemini]', state.providerKeys.gemini.join('\n'), '', '[openai]', state.providerKeys.openai.join('\n')].join('\n');
    }
    const dot = $('ai-btn-dot');
    if (dot) dot.classList.toggle('on', hasAnyProviderKey());
    renderGeminiUsage();
  }

  function render() {
    const panel = $('assistantPanel');
    const shell = $('assistantShell');
    const history = $('assistantHistoryPanel');
    const input = $('assistantInput');
    const send = $('assistantSend');
    const mic = $('assistantMicBtn');
    const dot = $('ai-btn-dot');
    if (shell) shell.classList.toggle('open', !!state.isOpen);
    if (panel) {
      panel.hidden = !state.isOpen;
      panel.classList.toggle('maximized', !!state.maximized);
    }
    if (history) history.hidden = !state.showHistory;
    if (input && input.value !== state.draft) input.value = state.draft || '';
    if (input) syncComposerHeight();
    if (send) {
      send.classList.toggle('loading', !!state.isSending);
      send.disabled = !!state.isSending;
    }
    if (mic) {
      mic.classList.toggle('listening', !!state.isListening);
      mic.setAttribute('aria-pressed', state.isListening ? 'true' : 'false');
      mic.title = state.isListening ? 'Stop voice input' : 'Voice input (English)';
    }
    if (dot) dot.classList.toggle('on', hasAnyProviderKey());
    renderUnread();
    renderHistory();
    renderMessages();
    renderAttachmentPreview();
    renderRuntimeMeta();
    syncSettingsFields();
    persist();
  }

  function showPanel() {
    const panel = $('assistantPanel');
    if (!panel) return;
    state.isOpen = true;
    state.minimized = false;
    state.unread = 0;
    panel.hidden = false;
    panel.classList.remove('verba-panel-closing');
    void panel.offsetWidth;
    panel.classList.add('verba-panel-open');
    setTimeout(() => panel.classList.remove('verba-panel-open'), 380);
    render();
    setTimeout(() => {
      const input = $('assistantInput');
      if (input) input.focus();
      syncComposerHeight();
    }, 120);
  }

  function hidePanel() {
    const panel = $('assistantPanel');
    if (!panel) return;
    if (state.isListening) stopDictation();
    state.isOpen = false;
    state.minimized = true;
    state.maximized = false;
    panel.classList.remove('verba-panel-open');
    panel.classList.add('verba-panel-closing');
    setTimeout(() => {
      if (!state.isOpen) {
        panel.hidden = true;
        panel.classList.remove('verba-panel-closing');
      }
    }, 220);
    render();
  }

  function addTypingRow() {
    const messages = $('assistantMessages');
    if (!messages) return;
    const row = document.createElement('div');
    row.id = 'verba-typing';
    row.className = 'verba-typing-row';
    row.innerHTML = '<div class="assistant-avatar-dot"><div class="assistant-robot-badge"><span class="assistant-robot-eye"></span></div></div><div class="verba-typing-bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  function removeTypingRow() {
    const row = $('verba-typing');
    if (row) row.remove();
  }

  async function sendMessage(text, customAttachments, taskName) {
    const promptText = String(text || '').trim();
    const attachments = Array.isArray(customAttachments) ? customAttachments.slice() : state.pendingAttachments.slice();
    if (!promptText && !attachments.length) return;
    if (state.isSending) return;
    const finalText = promptText || attachmentOnlyPrompt(attachments);
    const task = taskName || 'general-chat';
    let target = resolveModel(attachments, finalText);
    if (attachments.some(item => item.kind === 'pdf') && target.provider !== 'gemini') {
      if (getProviderKey('gemini')) target = { provider: 'gemini', model: state.geminiModel, label: getGeminiModelOption().label };
      else {
        pushMessage('assistant', 'Error: PDF analysis requires a Gemini key in this browser-only build.', { provider: 'gemini', model: state.geminiModel });
        return;
      }
    }
    if (state.isListening) stopDictation();
    state.isSending = true;
    render();
    addTypingRow();
    try {
      const prepared = await prepareAttachments(attachments, target.provider);
      state.draft = '';
        state.pendingAttachments = [];
        pushMessage('user', finalText, { provider: target.provider, model: target.model, attachments: prepared.map(item => ({ name: item.name, kind: item.kind })) });
        const reply = target.provider === 'gemini'
          ? await requestGemini(target, finalText, prepared, task)
          : await requestChat(target, finalText, prepared, task);
      removeTypingRow();
      pushMessage('assistant', reply, { provider: target.provider, model: target.model });
    } catch (error) {
      removeTypingRow();
      pushMessage('assistant', 'Error: ' + error.message, { provider: target.provider, model: target.model });
    } finally {
      state.isSending = false;
      render();
    }
  }

  function parseVaultTextarea(text) {
    const out = { groq: [], gemini: [], openai: [] };
    let current = '';
    String(text || '').split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const section = trimmed.match(/^\[(groq|gemini|openai)\]$/i);
      if (section) {
        current = section[1].toLowerCase();
        return;
      }
      if (current) out[current].push(trimmed);
    });
    return out;
  }

  function saveSettings(options) {
    const opts = options || {};
    const groq = $('settings-groq-key');
    const gemini = $('settings-gemini-key');
    const openai = $('settings-openai-key');
    const model = $('settings-model');
    const geminiModel = $('settings-gemini-model');
    const audio = $('settings-audio-model');
    const geminiVault = $('settings-gemini-vault');
    const keyVault = $('settings-key-vault');
    if (groq) setProviderKey('groq', groq.value);
    if (gemini) setProviderKey('gemini', gemini.value);
    if (openai) setProviderKey('openai', openai.value);
    if (geminiVault) state.providerKeys.gemini = normalizeProviderKeys({ gemini: String(geminiVault.value || '').split(/\r?\n/) }).gemini;
    if (keyVault) state.providerKeys = normalizeProviderKeys(parseVaultTextarea(keyVault.value));
    if (model) state.model = model.value;
    if (geminiModel) state.geminiModel = geminiModel.value;
    if (audio) state.audioModel = audio.value;
    persist();
    render();
    if (!opts.silent) toast('Assistant settings saved', 'success');
  }

  async function testProvider(provider) {
    const key = getProviderKey(provider);
    if (!key) {
      toast('No ' + provider + ' key saved yet.', 'warn');
      return;
    }
    try {
      if (provider === 'gemini') {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(state.geminiModel) + ':generateContent?key=' + encodeURIComponent(key), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] }),
          signal: AbortSignal.timeout(30000)
        });
        if (!response.ok) throw new Error('Gemini key test failed.');
      } else {
        const target = provider === 'openai'
          ? { provider: 'openai', model: 'gpt-4.1-mini' }
          : { provider: 'groq', model: 'llama-3.1-8b-instant' };
        const endpoint = provider === 'openai'
          ? 'https://api.openai.com/v1/chat/completions'
          : 'https://api.groq.com/openai/v1/chat/completions';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({ model: target.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 8 }),
          signal: AbortSignal.timeout(30000)
        });
        if (!response.ok) throw new Error(provider + ' key test failed.');
      }
      toast(provider.toUpperCase() + ' key looks valid', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function copyTranscript() {
    const convo = getCurrentConversation();
    if (!convo) return;
    const fullChat = (convo.messages || []).map(msg => (msg.role === 'user' ? 'You' : 'ForgeAI') + ':\n' + (msg.content || '')).join('\n\n---\n\n');
    navigator.clipboard.writeText(fullChat)
      .then(() => toast('Transcript copied', 'success'))
      .catch(() => toast('Copy failed', 'error'));
  }

  function startDictation(sendOnStop) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast('Speech recognition is not available in this browser.', 'warn');
      return;
    }
    if (!recognition) {
      recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = 'en-US';
        recognition.onresult = event => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) dictationFinal = [dictationFinal, transcript.trim()].filter(Boolean).join(' ');
            else interim += ' ' + transcript;
          }
          state.draft = [dictationBase, dictationFinal, interim.trim()].filter(Boolean).join(' ').trim();
          const input = $('assistantInput');
          if (input) input.value = state.draft;
          syncComposerHeight();
          render();
        };
      recognition.onend = () => {
        state.isListening = false;
        const shouldSend = !!state.sendOnStop;
        render();
        if (shouldSend && (state.draft || '').trim()) sendMessage(state.draft);
      };
    }
    state.sendOnStop = !!sendOnStop;
    dictationBase = state.draft || '';
    dictationFinal = '';
    state.isListening = true;
    render();
    try { recognition.start(); } catch {}
  }

  function stopDictation() {
    if (recognition) {
      try { recognition.stop(); } catch {}
    }
    state.isListening = false;
    render();
  }

  function updateRobot(clientX, clientY) {
    document.querySelectorAll('.assistant-robot-badge').forEach(node => {
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(-4, Math.min(4, (clientX - cx) / rect.width * 8));
      const dy = Math.max(-4, Math.min(4, (clientY - cy) / rect.height * 8));
      node.style.setProperty('--robot-px', dx.toFixed(2) + 'px');
      node.style.setProperty('--robot-py', dy.toFixed(2) + 'px');
    });
  }

  function installEvents() {
    const launcher = $('assistantLauncher');
    const topbar = $('ai-toggle-btn');
    const history = $('assistantHistoryBtn');
    const quickNew = $('assistantQuickNewBtn');
    const historyNew = $('assistantNewChatBtn');
    const close = $('assistantCloseBtn');
    const min = $('assistantMinBtn');
    const max = $('assistantMaxBtn');
    const clear = $('assistantClearBtn');
    const copy = $('assistantCopyLastBtn');
    const send = $('assistantSend');
    const input = $('assistantInput');
    const attachBtn = $('assistantAttachBtn');
    const fileInput = $('assistantFileInput');
    const micBtn = $('assistantMicBtn');
    const removeAttachment = $('assistantAttachmentRemove');
    const modelSelect = $('assistantModelSelect');

    if (launcher) launcher.addEventListener('click', () => { state.isOpen ? hidePanel() : showPanel(); });
    if (topbar) topbar.addEventListener('click', () => setTimeout(() => { state.isOpen ? hidePanel() : showPanel(); }, 0));
    if (history) history.addEventListener('click', () => { if (!state.isOpen) showPanel(); state.showHistory = !state.showHistory; render(); });
    if (quickNew) quickNew.addEventListener('click', () => {
      const convo = freshConversation();
      state.conversations.unshift(convo);
      state.currentConversationId = convo.id;
      state.pendingAttachments = [];
      state.draft = '';
      persist();
      render();
      toast('New chat started', 'success');
    });
    if (historyNew) historyNew.addEventListener('click', () => quickNew && quickNew.click());
    if (close) close.addEventListener('click', hidePanel);
    if (min) min.addEventListener('click', hidePanel);
    if (max) max.addEventListener('click', () => { if (!state.isOpen) showPanel(); state.maximized = !state.maximized; render(); });
    if (clear) clear.addEventListener('click', () => {
      const convo = getCurrentConversation();
      if (!convo) return;
      convo.messages = [{ id: uid(), role: 'assistant', content: buildWelcomeMessage(), model: state.model }];
      convo.updatedAt = Date.now();
      updateConversationTitle(convo);
      persist();
      render();
      toast('Current thread cleared', 'success');
    });
    if (copy) copy.addEventListener('click', copyTranscript);
    if (send) send.addEventListener('click', () => sendMessage(state.draft));
    if (input) {
      input.value = state.draft || '';
      syncComposerHeight();
      input.addEventListener('input', () => {
        state.draft = input.value;
        syncComposerHeight();
        renderRuntimeMeta();
        persist();
      });
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendMessage(state.draft);
        }
      });
      input.addEventListener('paste', event => {
        const files = Array.from(event.clipboardData?.items || []).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
        if (!files.length) return;
        event.preventDefault();
        try { state.pendingAttachments = files.map(normalizeAttachment); render(); } catch (error) { toast(error.message, 'error'); }
      });
      ['dragenter', 'dragover'].forEach(type => input.addEventListener(type, event => {
        event.preventDefault();
        $('assistantInputWrap')?.classList.add('drag-over');
      }));
      ['dragleave', 'drop'].forEach(type => input.addEventListener(type, event => {
        event.preventDefault();
        $('assistantInputWrap')?.classList.remove('drag-over');
      }));
      input.addEventListener('drop', event => {
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.length) return;
        try { state.pendingAttachments = files.map(normalizeAttachment); render(); } catch (error) { toast(error.message, 'error'); }
      });
    }
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', () => { fileInput.accept = 'image/png,image/jpeg,image/webp,application/pdf,.pdf,text/plain,.txt,text/markdown,.md,text/csv,.csv,application/json,.json'; fileInput.value = ''; fileInput.click(); });
      ['dragenter', 'dragover'].forEach(type => attachBtn.addEventListener(type, event => { event.preventDefault(); attachBtn.classList.add('drag-over'); }));
      ['dragleave', 'drop'].forEach(type => attachBtn.addEventListener(type, event => { event.preventDefault(); attachBtn.classList.remove('drag-over'); }));
      attachBtn.addEventListener('drop', event => {
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.length) return;
        try { state.pendingAttachments = files.map(normalizeAttachment); render(); } catch (error) { toast(error.message, 'error'); }
      });
      fileInput.addEventListener('change', () => {
        try { state.pendingAttachments = Array.from(fileInput.files || []).map(normalizeAttachment); render(); } catch (error) { toast(error.message, 'error'); }
      });
    }
    if (micBtn) micBtn.addEventListener('click', () => { state.isListening ? stopDictation() : startDictation(false); });
    if (removeAttachment) removeAttachment.addEventListener('click', () => { state.pendingAttachments = []; render(); toast('Attachments cleared', 'info'); });
    if (modelSelect) modelSelect.addEventListener('change', () => { state.model = modelSelect.value; persist(); render(); });
    document.addEventListener('click', event => {
      const historyRow = event.target.closest('[data-conversation-id]');
      const deleteBtn = event.target.closest('[data-delete-conversation]');
      const copyCode = event.target.closest('[data-copy-code]');
      const applyCode = event.target.closest('[data-apply-code]');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-delete-conversation');
        state.conversations = state.conversations.filter(convo => convo.id !== id);
        ensureConversation();
        persist();
        render();
        return;
      }
      if (historyRow) {
        state.currentConversationId = historyRow.getAttribute('data-conversation-id') || state.currentConversationId;
        state.showHistory = false;
        persist();
        render();
        return;
      }
      if (copyCode) navigator.clipboard.writeText(decodeURIComponent(copyCode.getAttribute('data-copy-code') || '')).then(() => toast('Code copied', 'success')).catch(() => toast('Copy failed', 'error'));
      if (applyCode) {
        const ok = bridge().applyCode(decodeURIComponent(applyCode.getAttribute('data-apply-code') || ''));
        toast(ok ? 'Code applied to editor' : 'Unable to apply code', ok ? 'success' : 'error');
      }
    });
    document.addEventListener('keydown', event => {
      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && event.key.toLowerCase() === 'u' && state.isOpen) {
        event.preventDefault();
        attachBtn && attachBtn.click();
      } else if (event.key === 'Escape' && state.isOpen && !event.target.closest('textarea')) {
        hidePanel();
      } else if (ctrl && event.shiftKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        state.isListening ? stopDictation() : startDictation(true);
      }
    });
    window.addEventListener('mousemove', event => updateRobot(event.clientX, event.clientY));
    document.addEventListener('touchmove', event => {
      if (event.touches.length) updateRobot(event.touches[0].clientX, event.touches[0].clientY);
    }, { passive: true });
    const launcherEl = $('assistantLauncher');
    if (launcherEl) {
      launcherEl.addEventListener('mousemove', event => {
        const rect = launcherEl.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) - 0.5;
        const y = ((event.clientY - rect.top) / rect.height) - 0.5;
        launcherEl.style.setProperty('--assistant-tilt-x', (x * 10).toFixed(2) + 'deg');
        launcherEl.style.setProperty('--assistant-tilt-y', (-y * 10).toFixed(2) + 'deg');
      });
      launcherEl.addEventListener('mouseleave', () => {
        launcherEl.style.setProperty('--assistant-tilt-x', '0deg');
        launcherEl.style.setProperty('--assistant-tilt-y', '0deg');
      });
    }
    [['groq-show-btn', 'settings-groq-key'], ['gemini-show-btn', 'settings-gemini-key'], ['openai-show-btn', 'settings-openai-key']].forEach(pair => {
      const btn = $(pair[0]);
      if (btn) btn.addEventListener('click', () => {
        const field = $(pair[1]);
        if (field) field.type = field.type === 'password' ? 'text' : 'password';
      });
    });
    const directSave = { 'groq-save-btn': 'groq', 'gemini-save-btn': 'gemini', 'openai-save-btn': 'openai' };
    Object.keys(directSave).forEach(id => {
      const btn = $(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const provider = directSave[id];
        const field = $('settings-' + provider + '-key');
        if (field) setProviderKey(provider, field.value);
        syncSettingsFields();
        toast(provider.toUpperCase() + ' key saved', 'success');
      });
    });
    const tests = { 'groq-test-btn': 'groq', 'gemini-test-btn': 'gemini', 'openai-test-btn': 'openai' };
    Object.keys(tests).forEach(id => {
      const btn = $(id);
      if (btn) btn.addEventListener('click', () => testProvider(tests[id]));
    });
    const geminiVaultSave = $('gemini-vault-save-btn');
    if (geminiVaultSave) geminiVaultSave.addEventListener('click', () => {
      const field = $('settings-gemini-vault');
      state.providerKeys.gemini = normalizeProviderKeys({ gemini: String(field?.value || '').split(/\r?\n/) }).gemini;
      persist();
      syncSettingsFields();
      toast('Gemini vault saved', 'success');
    });
    const keyVaultSave = $('key-vault-save-btn');
    if (keyVaultSave) keyVaultSave.addEventListener('click', () => {
      const field = $('settings-key-vault');
      state.providerKeys = normalizeProviderKeys(parseVaultTextarea(field?.value || ''));
      persist();
      syncSettingsFields();
      toast('Key vault saved', 'success');
    });
    const usageReset = $('gemini-usage-reset-btn');
    if (usageReset) usageReset.addEventListener('click', () => {
      state.geminiUsage[state.geminiModel] = { minute: { windowStart: Date.now(), used: 0 }, daily: { date: new Date().toDateString(), used: 0 } };
      persist();
      renderGeminiUsage();
      toast('Gemini usage reset', 'success');
    });
    const geminiModelSelect = $('settings-gemini-model');
    if (geminiModelSelect) geminiModelSelect.addEventListener('change', () => { state.geminiModel = geminiModelSelect.value; persist(); render(); });
    const audioModelSelect = $('settings-audio-model');
    if (audioModelSelect) audioModelSelect.addEventListener('change', () => { state.audioModel = audioModelSelect.value; persist(); render(); });
    document.querySelectorAll('[data-assistant-qa]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-assistant-qa');
        const prompt = currentQuickActionPrompt(key);
        if (!prompt) return;
        if (!state.isOpen) showPanel();
        state.draft = prompt;
        render();
        sendMessage(prompt, null, taskNameForQuickAction(key));
      });
    });
  }

  function init() {
    loadUiState();
    ensureConversation();
    window.CodeForgeAssistant = {
      open: showPanel,
      close: hidePanel,
      toggle: function () { state.isOpen ? hidePanel() : showPanel(); },
      isOpen: function () { return !!state.isOpen; },
      saveSettings: saveSettings,
      syncSettingsFields: syncSettingsFields
    };
    render();
    installEvents();
    window.addEventListener('codeforge:memory-changed', () => render());
    window.CodeForgeAssistantHooks = {
      getPendingAttachmentsForMemory: async function () {
        const items = state.pendingAttachments.slice();
        const out = [];
        for (const item of items) {
          if (item.kind === 'text') out.push({ kind: item.kind, name: item.name, textContent: await readAsText(item.file) });
          else out.push({ kind: item.kind, name: item.name });
        }
        return out;
      }
    };
    syncSettingsFields();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
