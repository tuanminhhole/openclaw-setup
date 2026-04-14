// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * @fileoverview Part of the OpenClaw Setup Wizard IIFE bundle.
 * This file is concatenated (not imported) — globals are shared via setup.js IIFE scope.
 * Do NOT add import/export statements. Edit, then run: node build.mjs
 *
 * @global {object}  state       - Wizard UI state
 * @global {object}  PROVIDERS   - AI provider registry
 * @global {Array}   SKILLS      - Available skills
 * @global {Array}   PLUGINS     - Available plugins
 * @global {object}  CHANNELS    - Channel definitions
 * @global {boolean} isVi        - Vietnamese language mode
 * @global {object}  provider    - Current primary provider config
 * @global {boolean} isMultiBot  - Multi-bot mode flag
 * @global {boolean} hasBrowser  - Browser plugin selected
 * @global {boolean} is9Router   - 9Router proxy mode
 * @global {string}  projectDir  - Output project directory path
 * @global {Function} getGatewayAllowedOrigins
 */
  // ========== AI Providers & Models ==========
  const PROVIDERS = {
    google: {
      name: 'Google Gemini',
      logo: LOGO.gemini,
      supportsEmbeddings: true,
      envKey: 'GOOGLE_API_KEY',
      envLabel: 'Google AI API Key',
      envLink: 'https://aistudio.google.com/apikey',
      envInstructionsVi: 'Vào <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> → Create API Key → Copy', envInstructionsEn: 'Go to <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> → Create API Key → Copy',
      free: true,
      models: [
        { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', descVi: 'Nhanh, miễn phí, đa năng', descEn: 'Fast, free, versatile', badge: '🆓 Free' },
        { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', descVi: 'Thông minh hơn, phân tích sâu', descEn: 'Smarter, deeper analysis', badge: '🆓 Free' },
        { id: 'google/gemini-3-flash', name: 'Gemini 3 Flash', descVi: 'Thế hệ mới, cực nhanh', descEn: 'Next gen, extremely fast', badge: '🆓 Free' },
      ],
    },
    anthropic: {
      name: 'Anthropic Claude',
      logo: LOGO.anthropic,
      supportsEmbeddings: false,
      envKey: 'ANTHROPIC_API_KEY',
      envLabel: 'Anthropic API Key',
      envLink: 'https://console.anthropic.com/settings/keys',
      envInstructionsVi: 'Vào <a href="https://console.anthropic.com/settings/keys" target="_blank">console.anthropic.com</a> → Create Key → Copy', envInstructionsEn: 'Go to <a href="https://console.anthropic.com/settings/keys" target="_blank">console.anthropic.com/settings/keys</a> → Create Key → Copy',
      free: false,
      models: [
        { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', descVi: 'Cân bằng tốc độ & chất lượng', descEn: 'Balanced speed & quality', badge: '💰 Paid' },
        { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', descVi: 'Mạnh nhất, suy luận sâu', descEn: 'Strongest, deep reasoning', badge: '💰 Paid' },
        { id: 'anthropic/claude-haiku-3.5', name: 'Claude Haiku 3.5', descVi: 'Nhanh, rẻ nhất', descEn: 'Fastest, cheapest', badge: '💰 Paid' },
      ],
    },
    openai: {
      name: 'OpenAI / Codex',
      logo: LOGO.openai,
      supportsEmbeddings: true,
      envKey: 'OPENAI_API_KEY',
      envLabel: 'OpenAI API Key',
      envLink: 'https://platform.openai.com/api-keys',
      envInstructionsVi: 'Vào <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a> → Create new secret key → Copy. <br><strong>Lưu ý:</strong> Codex models cũng dùng chung API key này.', envInstructionsEn: 'Go to <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a> → Create new secret key → Copy. <br><strong>Note:</strong> Codex models also use this key.',
      free: false,
      models: [
        { id: 'openai/gpt-4o', name: 'GPT-4o', descVi: 'Đa năng, nhanh', descEn: 'Versatile, rapid', badge: '💰 Paid' },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', descVi: 'Rẻ, phù hợp chat', descEn: 'Cheap, good for chat', badge: '💰 Paid' },
        { id: 'openai/o3', name: 'o3', descVi: 'Suy luận mạnh nhất', descEn: 'Strongest reasoning', badge: '💰 Paid' },
        { id: 'openai/codex-mini', name: 'Codex Mini', descVi: 'Chuyên code, agent', descEn: 'Optimized for code/agents', badge: '💰 Paid' },
      ],
    },
    openrouter: {
      name: 'OpenRouter',
      logo: LOGO.openrouter,
      supportsEmbeddings: false,
      envKey: 'OPENROUTER_API_KEY',
      envLabel: 'OpenRouter API Key',
      envLink: 'https://openrouter.ai/keys',
      envInstructionsVi: 'Vào <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a> → Create Key → Copy. OpenRouter hỗ trợ nhiều model miễn phí!', envInstructionsEn: 'Go to <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a> → Create Key → Copy. OpenRouter provides many free models!',
      free: true,
      models: [
        { id: 'openrouter/google/gemma-3-12b-it:free', name: 'Gemma 3 12B', descVi: 'Google, miễn phí', descEn: 'Google, free', badge: '🆓 Free' },
        { id: 'openrouter/nvidia/nemotron-nano-9b-v2:free', name: 'Nemotron Nano 9B', descVi: 'NVIDIA, miễn phí', descEn: 'NVIDIA, free', badge: '🆓 Free' },
        { id: 'openrouter/qwen/qwen3-coder:free', name: 'Qwen 3 Coder', descVi: 'Alibaba, code, miễn phí', descEn: 'Alibaba, code, free', badge: '🆓 Free' },
      ],
    },
    ollama: {
      name: 'Ollama (Local)',
      logo: LOGO.ollama,
      supportsEmbeddings: true,
      envKey: 'OLLAMA_HOST',
      envLabel: 'Ollama Host URL',
      envLink: 'https://ollama.com',
      envInstructionsVi: 'Cài <a href="https://ollama.com" target="_blank">Ollama</a> → chạy <code>ollama serve</code> → model chạy offline trên máy bạn.', envInstructionsEn: 'Install <a href="https://ollama.com" target="_blank">Ollama</a> → run <code>ollama serve</code> → model will run offline on your machine.',
      free: true,
      isLocal: true,
      models: [
        { id: 'ollama/gemma4:e2b', name: 'Gemma 4 E2B',   descVi: '🟢 Nhẹ nhất (~4-6 GB RAM) — Edge, laptop, test nhanh', descEn: '🟢 Lightest (~4-6 GB RAM) — Edge, laptop, fastest startup', badge: '🆕 Apr 2 2026' },
        { id: 'ollama/gemma4:e4b', name: 'Gemma 4 E4B',   descVi: '🟡 Cân bằng (~8-10 GB RAM) — Khuyên dùng', descEn: '🟡 Balanced (~8-10 GB RAM) — Recommended', badge: '🆕 Apr 2 2026' },
        { id: 'ollama/gemma4:26b', name: 'Gemma 4 26B',   descVi: '🟠 Mạnh (~18-24 GB RAM/VRAM) — Máy mạnh', descEn: '🟠 Powerful (~18-24 GB RAM/VRAM) — High-end machine', badge: '🆕 Apr 2 2026' },
        { id: 'ollama/gemma4:31b', name: 'Gemma 4 31B',   descVi: '🔴 Mạnh nhất (~24+ GB RAM/VRAM) — Workstation/GPU', descEn: '🔴 Most powerful (~24+ GB RAM/VRAM) — Workstation/GPU', badge: '🆕 Apr 2 2026' },
        { id: 'ollama/qwen3:8b', name: 'Qwen 3 8B', descVi: 'Đa ngôn ngữ, nhẹ', descEn: 'Multi-lingual, lightweight', badge: '🏠 Local' },
        { id: 'ollama/deepseek-r1:8b', name: 'DeepSeek R1 8B', descVi: 'Suy luận, code', descEn: 'Reasoning, code', badge: '🏠 Local' },
        { id: 'ollama/llama3.3:8b', name: 'Llama 3.3 8B', descVi: 'Meta, đa năng', descEn: 'Meta, versatile', badge: '🏠 Local' },
        { id: 'ollama/gemma3:12b', name: 'Gemma 3 12B', descVi: 'Google, tiếng Việt tốt', descEn: 'Google, great logic', badge: '🏠 Local' },
      ],
    },
    '9router': {
      name: '9Router (Proxy)',
      logo: null,
      logoEmoji: '🔀',
      supportsEmbeddings: false,
      envKey: null,
      envLabel: null,
      envLink: 'https://github.com/decolua/9router',
      envInstructionsVi: '9Router chạy cùng Docker — <strong>không cần API key</strong>. Sau khi <code>docker compose up</code>, mở <a href="http://localhost:20128/dashboard" target="_blank">localhost:20128/dashboard</a> → đăng nhập OAuth.<br>✅ <b>Mới v0.3.75:</b> Claude Code, Codex, Gemini CLI và Antigravity có thể dùng 9Router làm endpoint trực tiếp.<br><span style="color:var(--danger)">⚠️ <b>CẢNH BÁO:</b> TUYỆT ĐỐI KHÔNG chọn Provider <b>Antigravity</b> khi đăng nhập OAuth trên dashboard 9Router (nguy cơ bị ban Google Account vĩnh viễn).</span>', envInstructionsEn: '9Router runs with Docker — <strong>no API key needed</strong>. After <code>docker compose up</code>, open <a href="http://localhost:20128/dashboard" target="_blank">localhost:20128/dashboard</a> and OAuth login.<br>✅ <b>New in v0.3.75:</b> Claude Code, Codex, Gemini CLI, and Antigravity can use 9Router as their endpoint directly.<br><span style="color:var(--danger)">⚠️ <b>WARNING:</b> Do NOT select <b>Antigravity</b> as your OAuth Provider when logging into the 9Router dashboard (high risk of permanent Google Account ban).</span>',
      free: true,
      isProxy: true,
      models: [
        { id: '9router/smart-route', name: 'Smart Proxy (Auto Route)', descVi: 'Tự động luân chuyển FREE models — không tốn xu', descEn: 'Auto-routing across FREE providers — zero cost', badgeVi: '🌟 Khuyên dùng', badgeEn: '🌟 Recommended' }
      ],
    },
  };

