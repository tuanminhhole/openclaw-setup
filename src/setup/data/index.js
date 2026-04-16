// @ts-nocheck
/**
 * setup/data/index.js — Shared data for CLI + Wizard
 *
 * Provides CLI-compatible views of PROVIDERS, SKILLS, CHANNELS, and OLLAMA_MODELS.
 * The wizard uses these via IIFE concatenation (providers.js, skills.js, channels.js).
 * The CLI imports this file directly via createRequire.
 *
 * Structure deliberately kept flat & forward-compatible:
 *   - PROVIDERS: { [key]: { name, icon, envKey?, isProxy?, isLocal? } }
 *   - SKILLS:    [{ value, name, slug? }]
 *   - CHANNELS:  { [key]: { name, type, icon } }
 *   - OLLAMA_MODELS: [{ id, name, reasoning, input, cost, contextWindow, maxTokens }]
 */
(function (root) {
  // ── CLI-facing PROVIDERS (display + config metadata) ──────────────────────────
  // Keep in sync with setup/data/providers.js model IDs
  const PROVIDERS = {
    '9router':   { name: '9Router Proxy (Khuyên dùng)',  icon: '🔀', isProxy: true },
    'openai':    { name: 'OpenAI (ChatGPT)',              icon: '🧠', envKey: 'OPENAI_API_KEY' },
    'ollama':    { name: 'Local Ollama',                  icon: '🏠', isLocal: true },
    'google':    { name: 'Google (Gemini)',               icon: '⚡', envKey: 'GEMINI_API_KEY' },
    'anthropic': { name: 'Anthropic (Claude)',            icon: '🦄', envKey: 'ANTHROPIC_API_KEY' },
    'xai':       { name: 'xAI (Grok)',                   icon: '✖️', envKey: 'XAI_API_KEY' },
    'groq':      { name: 'Groq (LPU)',                   icon: '🏎️', envKey: 'GROQ_API_KEY' },
    'openrouter':{ name: 'OpenRouter',                   icon: '🌐', envKey: 'OPENROUTER_API_KEY' },
  };

  // ── CLI-facing SKILLS (value = selection key, slug = ClawHub package name) ────
  // Keep in sync with setup/data/skills.js skill IDs
  const SKILLS = [
    { value: 'browser',          name: '🌐 Browser Automation (Playwright) (⭐ Khuyên dùng)', slug: null },
    { value: 'memory',           name: '🧠 Long-term Memory (⭐ Khuyên dùng)',                 slug: 'memory' },
    { value: 'scheduler',        name: '⏰ Native Cron Scheduler (⭐ Khuyên dùng)',             slug: null },
    { value: 'rag',              name: '📚 RAG / Knowledge Base',                              slug: 'rag' },
    { value: 'image-gen',        name: '🎨 Image Generation (DALL·E / Flux)',                  slug: 'image-gen' },
    { value: 'code-interpreter', name: '💻 Code Interpreter (Python/JS)',                      slug: 'code-interpreter' },
    { value: 'email',            name: '📧 Email Assistant',                                   slug: 'email-assistant' },
    { value: 'tts',              name: '🔊 Text-To-Speech (OpenAI/ElevenLabs)',                slug: 'tts' },
    { value: 'web-search',       name: '🔍 Web Search',                                        slug: 'web-search' },
  ];

  // ── CLI-facing CHANNELS ───────────────────────────────────────────────────────
  // Keep in sync with setup/data/channels.js channel keys
  const CHANNELS = {
    'telegram':           { name: 'Telegram',                     type: 'telegram',           icon: '🤖' },
    'zalo-bot':           { name: 'Zalo OA (Bot Platform)',        type: 'zalo-bot',           icon: '🔑' },
    'zalo-personal':      { name: 'Zalo Personal (Quét QR)',       type: 'zalo-personal',      icon: '📱' },
  };

  // ── Ollama model definitions (single source of truth for all config JSON writes) ──
  // Used in: models.json per-agent, openclaw.json models.providers.ollama
  const OLLAMA_MODELS = [
    { id: 'gemma4:e2b',     name: 'Gemma 4 E2B',    reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
    { id: 'gemma4:e4b',     name: 'Gemma 4 E4B',    reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
    { id: 'gemma4:26b',     name: 'Gemma 4 26B',    reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
    { id: 'gemma4:31b',     name: 'Gemma 4 31B',    reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
    { id: 'qwen3:8b',       name: 'Qwen 3 8B',      reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
    { id: 'deepseek-r1:8b', name: 'DeepSeek R1 8B', reasoning: true,  input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 64000,  maxTokens: 8192 },
    { id: 'llama3.3:8b',    name: 'Llama 3.3 8B',   reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
    { id: 'gemma3:12b',     name: 'Gemma 3 12B',    reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
  ];

  // ── Node.js export (for CLI via createRequire) ────────────────────────────────
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PROVIDERS, SKILLS, CHANNELS, OLLAMA_MODELS };
  }

  // ── Browser global (future use if wizard imports this directly) ───────────────
  if (typeof root !== 'undefined') {
    root.__openclawData = { PROVIDERS, SKILLS, CHANNELS, OLLAMA_MODELS };
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {}));
