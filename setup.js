/* ============================================
   OpenClaw Setup Wizard — Logic v2
   Multi-model, Multi-plugin, Multi-channel
   ============================================ */

(function () {
  'use strict';

  // ========== CDN Logo URLs (thesvg.org) ==========
  const SVG_CDN = 'https://thesvg.org/icons';
  const LOGO = {
    gemini: `${SVG_CDN}/google-gemini/default.svg`,
    anthropic: `${SVG_CDN}/anthropic/light.svg`,
    openai: `${SVG_CDN}/openai/light.svg`,
    openrouter: `${SVG_CDN}/openrouter/light.svg`,
    ollama: `${SVG_CDN}/ollama/light.svg`,
    '9router': null, // Uses emoji icon 🔀 instead of SVG
  };

  // Language flag icons (inline SVG circles with flag colors)
  const FLAG_ICONS = {
    vi: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="#DA251D"/><polygon points="10,4 11.5,8.5 16,8.5 12.3,11.2 13.8,15.7 10,13 6.2,15.7 7.7,11.2 4,8.5 8.5,8.5" fill="#FFFF00"/></svg>`,
    en: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="#012169"/><path d="M0 0L20 20M20 0L0 20" stroke="white" stroke-width="3"/><path d="M0 0L20 20M20 0L0 20" stroke="#C8102E" stroke-width="1.5"/><path d="M10 0V20M0 10H20" stroke="white" stroke-width="5"/><path d="M10 0V20M0 10H20" stroke="#C8102E" stroke-width="3"/></svg>`,
  };

  // ========== State ==========
  const state = {
    currentStep: 1,
    totalSteps: 4,
    channel: null,
    config: {
      botName: '',
      description: '',
      provider: 'google',
      model: 'google/gemini-2.5-flash',
      language: 'vi',
      systemPrompt: '',
      plugins: [],
      skills: [],
    },
  };

  // ========== AI Providers & Models ==========
  const PROVIDERS = {
    google: {
      name: 'Google Gemini',
      logo: LOGO.gemini,
      envKey: 'GOOGLE_API_KEY',
      envLabel: 'Google AI API Key',
      envLink: 'https://aistudio.google.com/apikey',
      envInstructions: 'Vào <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> → Create API Key → Copy',
      free: true,
      models: [
        { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Nhanh, miễn phí, đa năng', badge: '🆓 Free' },
        { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Thông minh hơn, phân tích sâu', badge: '🆓 Free' },
        { id: 'google/gemini-3.0-flash', name: 'Gemini 3.0 Flash', desc: 'Thế hệ mới, cực nhanh', badge: '🆓 Free' },
      ],
    },
    anthropic: {
      name: 'Anthropic Claude',
      logo: LOGO.anthropic,
      envKey: 'ANTHROPIC_API_KEY',
      envLabel: 'Anthropic API Key',
      envLink: 'https://console.anthropic.com/settings/keys',
      envInstructions: 'Vào <a href="https://console.anthropic.com/settings/keys" target="_blank">console.anthropic.com</a> → Create Key → Copy',
      free: false,
      models: [
        { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', desc: 'Cân bằng tốc độ & chất lượng', badge: '💰 Paid' },
        { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', desc: 'Mạnh nhất, suy luận sâu', badge: '💰 Paid' },
        { id: 'anthropic/claude-haiku-3.5', name: 'Claude Haiku 3.5', desc: 'Nhanh, rẻ nhất', badge: '💰 Paid' },
      ],
    },
    openai: {
      name: 'OpenAI / Codex',
      logo: LOGO.openai,
      envKey: 'OPENAI_API_KEY',
      envLabel: 'OpenAI API Key',
      envLink: 'https://platform.openai.com/api-keys',
      envInstructions: 'Vào <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a> → Create new secret key → Copy. <br><strong>Lưu ý:</strong> Codex models cũng dùng chung API key này (không cần đăng nhập OAuth riêng).',
      free: false,
      models: [
        { id: 'openai/gpt-4o', name: 'GPT-4o', desc: 'Đa năng, nhanh', badge: '💰 Paid' },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Rẻ, phù hợp chat', badge: '💰 Paid' },
        { id: 'openai/o3', name: 'o3', desc: 'Suy luận mạnh nhất', badge: '💰 Paid' },
        { id: 'openai/codex-mini', name: 'Codex Mini', desc: 'Chuyên code, agent', badge: '💰 Paid' },
      ],
    },
    openrouter: {
      name: 'OpenRouter',
      logo: LOGO.openrouter,
      envKey: 'OPENROUTER_API_KEY',
      envLabel: 'OpenRouter API Key',
      envLink: 'https://openrouter.ai/keys',
      envInstructions: 'Vào <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a> → Create Key → Copy. OpenRouter hỗ trợ nhiều model miễn phí!',
      free: true,
      models: [
        { id: 'openrouter/google/gemma-3-12b-it:free', name: 'Gemma 3 12B', desc: 'Google, miễn phí', badge: '🆓 Free' },
        { id: 'openrouter/nvidia/nemotron-nano-9b-v2:free', name: 'Nemotron Nano 9B', desc: 'NVIDIA, miễn phí', badge: '🆓 Free' },
        { id: 'openrouter/qwen/qwen3-coder:free', name: 'Qwen 3 Coder', desc: 'Alibaba, code, miễn phí', badge: '🆓 Free' },
      ],
    },
    ollama: {
      name: 'Ollama (Local)',
      logo: LOGO.ollama,
      envKey: 'OLLAMA_HOST',
      envLabel: 'Ollama Host URL',
      envLink: 'https://ollama.com',
      envInstructions: 'Cài <a href="https://ollama.com" target="_blank">Ollama</a> → chạy <code>ollama serve</code> → model sẽ chạy offline trên máy bạn. Không cần API key!',
      free: true,
      isLocal: true,
      models: [
        { id: 'ollama/qwen3:8b', name: 'Qwen 3 8B', desc: 'Đa ngôn ngữ, nhẹ', badge: '🏠 Local' },
        { id: 'ollama/deepseek-r1:8b', name: 'DeepSeek R1 8B', desc: 'Suy luận, code', badge: '🏠 Local' },
        { id: 'ollama/llama3.3:8b', name: 'Llama 3.3 8B', desc: 'Meta, đa năng', badge: '🏠 Local' },
        { id: 'ollama/gemma3:12b', name: 'Gemma 3 12B', desc: 'Google, tiếng Việt tốt', badge: '🏠 Local' },
      ],
    },
    '9router': {
      name: '9Router (Proxy)',
      logo: null,
      logoEmoji: '🔀',
      envKey: null,
      envLabel: null,
      envLink: 'https://github.com/decolua/9router',
      envInstructions: '9Router chạy cùng Docker — <strong>không cần API key</strong>. Sau khi <code>docker compose up</code>, mở <a href="http://localhost:20128/dashboard" target="_blank">localhost:20128/dashboard</a> → đăng nhập OAuth vào các AI provider.',
      free: true,
      isProxy: true,
      models: [
        { id: 'openai/gpt-4o', name: 'Auto (9Router)', desc: '9Router tự route model tối ưu', badge: '🔀 Proxy' },
      ],
    },
  };

  // ========== Available Plugins (npm packages — runtime/channel extensions) ==========
  const PLUGINS = [
    {
      id: 'voice-call',
      name: 'Voice Call',
      icon: '📞',
      desc: 'Gọi thoại AI qua điện thoại',
      package: '@openclaw/voice-call',
    },
    {
      id: 'matrix',
      name: 'Matrix Chat',
      icon: '💬',
      desc: 'Kết nối thêm kênh Matrix/Element',
      package: '@openclaw/matrix',
    },
    {
      id: 'msteams',
      name: 'MS Teams',
      icon: '🏢',
      desc: 'Kết nối Microsoft Teams',
      package: '@openclaw/msteams',
    },
    {
      id: 'nostr',
      name: 'Nostr',
      icon: '🟣',
      desc: 'Kết nối mạng xã hội Nostr',
      package: '@openclaw/nostr',
    },
  ];

  // ========== Available Skills (ClawHub registry — agent capabilities) ==========
  const SKILLS = [
    {
      id: 'web-search',
      name: 'Web Search',
      icon: '🔍',
      desc: 'Tìm kiếm web, trả về kết quả realtime',
      slug: 'web-search',
      note: 'Cần API key (Tavily hoặc SerpApi) trong .env',
      envVars: ['TAVILY_API_KEY=<your_tavily_key>'],
    },
    {
      id: 'browser',
      name: 'Browser Automation',
      icon: '🌐',
      desc: 'Tự động thao tác trình duyệt (Playwright)',
      slug: 'browser-automation',
      note: 'Cần bật Chrome Debug Mode trên máy host',
    },
    {
      id: 'memory',
      name: 'Long-term Memory',
      icon: '🧠',
      desc: 'Nhớ hội thoại xuyên phiên, context dài hạn',
      slug: 'memory',
    },
    {
      id: 'rag',
      name: 'RAG / Knowledge Base',
      icon: '📚',
      desc: 'Chat với tài liệu, file PDF, codebase',
      slug: 'rag',
      note: 'Đặt file vào thư mục .openclaw/docs/',
    },
    {
      id: 'image-gen',
      name: 'Image Generation',
      icon: '🎨',
      desc: 'Tạo ảnh bằng AI (DALL·E, Flux...)',
      slug: 'image-gen',
      note: 'Dùng chung OPENAI_API_KEY (DALL-E) hoặc thêm FLUX_API_KEY',
      envVars: ['# FLUX_API_KEY=<your_flux_key>  # chỉ cần nếu dùng Flux'],
    },
    {
      id: 'scheduler',
      name: 'Bot Scheduler',
      icon: '⏰',
      desc: 'Bot tự nhắc nhở, lên lịch gửi tin nhắn',
      slug: 'scheduler',
    },
    {
      id: 'code-interpreter',
      name: 'Code Interpreter',
      icon: '💻',
      desc: 'Chạy code Python/JS trong sandbox',
      slug: 'code-interpreter',
    },
    {
      id: 'email',
      name: 'Email Assistant',
      icon: '📧',
      desc: 'Quản lý, soạn, tóm tắt email',
      slug: 'email-assistant',
      note: 'Cần cấu hình SMTP trong .env',
      envVars: ['SMTP_HOST=smtp.gmail.com', 'SMTP_PORT=587', 'SMTP_USER=<your_email>', 'SMTP_PASS=<your_app_password>'],
    },
  ];

  // ========== Channel definitions ==========
  const CHANNELS = {
    telegram: {
      name: 'Telegram',
      envKeys: [],
      envExtra: 'TELEGRAM_BOT_TOKEN=<your_bot_token>',
      credSteps: [
        { text: 'Mở Telegram → tìm <a href="https://t.me/BotFather" target="_blank">@BotFather</a> → gửi <code>/newbot</code> → đặt tên bot → copy token' },
      ],
      channelConfig: {
        telegram: {
          enabled: true,
          dmPolicy: 'open',
          allowFrom: ['*'],
          groupPolicy: 'allowlist',
          streaming: 'partial',
        },
      },
      pluginInstall: '',
    },
    'zalo-bot': {
      name: 'Zalo Bot API',
      envKeys: [],
      envExtra: 'ZALO_BOT_TOKEN=<your_zalo_bot_token>',
      credSteps: [
        { text: 'Vào <a href="https://developers.zalo.me" target="_blank">Zalo Bot Platform</a> → Tạo bot mới → copy Bot Token' },
      ],
      channelConfig: {
        zalo: {
          enabled: true,
        },
      },
      pluginInstall: '',
    },
    'zalo-personal': {
      name: 'Zalo Personal',
      envKeys: [],
      envExtra: '',
      credSteps: [
        { text: '⚠️ Sau khi bot chạy, bạn sẽ cần <strong>quét QR code</strong> trong Docker logs để login tài khoản Zalo cá nhân' },
      ],
      channelConfig: {
        zalouser: {
          enabled: true,
        },
      },
      pluginInstall: '',
    },
  };

  // ========== Default system prompts ==========
  const DEFAULT_PROMPTS = {
    vi: `Bạn là {BOT_NAME}, trợ lý AI cá nhân.

## Tính cách
- Thân thiện, hữu ích
- Trả lời bằng tiếng Việt
- Giọng văn tự nhiên, gần gũi

## Quy tắc
- Trả lời ngắn gọn, súc tích
- Hỏi lại khi chưa rõ yêu cầu`,
    en: `You are {BOT_NAME}, a personal AI assistant.

## Personality
- Friendly and helpful
- Reply in English
- Natural, conversational tone

## Rules
- Keep answers concise
- Ask for clarification when needed`,
  };

  // ========== DOM Ready ==========
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindChannelCards();
    bindNavButtons();
    bindFormEvents();
    renderProviderCards();
    renderPluginGrid();
    initLanguageSelector();
    updateUI();
  }

  // ========== Custom Language Selector ==========
  function initLanguageSelector() {
    // Inject flag SVGs into toggle buttons
    document.querySelectorAll('.lang-toggle__flag').forEach((el) => {
      const lang = el.dataset.lang || 'vi';
      if (FLAG_ICONS[lang]) el.innerHTML = FLAG_ICONS[lang];
    });
  }

  window.__selectLang = function (val) {
    const input = document.getElementById('cfg-language');
    if (input) input.value = val;

    // Toggle active button
    document.querySelectorAll('.lang-toggle__btn').forEach((btn) => {
      btn.classList.toggle('lang-toggle__btn--active', btn.dataset.lang === val);
    });

    // Trigger prompt update
    const prompt = document.getElementById('cfg-prompt');
    if (prompt && !prompt.dataset.userEdited) {
      const name = document.getElementById('cfg-name')?.value || 'Bot';
      prompt.value = DEFAULT_PROMPTS[val].replace('{BOT_NAME}', name);
      // Auto-expand
      prompt.style.height = 'auto';
      prompt.style.height = prompt.scrollHeight + 'px';
    }
  };

  // ========== Step 1: Channel Selection ==========
  function bindChannelCards() {
    document.querySelectorAll('.channel-card').forEach((card) => {
      card.addEventListener('click', () => {
        state.channel = card.dataset.channel;
        document.querySelectorAll('.channel-card').forEach((c) => c.classList.remove('channel-card--selected'));
        card.classList.add('channel-card--selected');
        updateNavButtons();
      });
    });
  }

  // ========== Navigation ==========
  function bindNavButtons() {
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');

    btnNext.addEventListener('click', () => {
      if (state.currentStep === 1 && !state.channel) return;
      if (state.currentStep === 2) saveFormData();

      // Zalo Personal: skip steps 2-3, jump from 1 → 4
      if (state.currentStep === 1 && state.channel === 'zalo-personal') {
        goToStep(4);
        return;
      }

      if (state.currentStep < state.totalSteps) {
        goToStep(state.currentStep + 1);
      }
    });

    btnPrev.addEventListener('click', () => {
      // Zalo Personal: from step 4, go back to step 1
      if (state.currentStep === 4 && state.channel === 'zalo-personal') {
        goToStep(1);
        return;
      }
      if (state.currentStep > 1) {
        goToStep(state.currentStep - 1);
      }
    });
  }

  function goToStep(step) {
    state.currentStep = step;
    if (step === 2) populateStep2();
    if (step === 3) populateStep3();
    if (step === 4) generateOutput();
    updateUI();
  }

  function updateUI() {
    document.querySelectorAll('.step').forEach((el) => {
      el.classList.toggle('step--active', parseInt(el.dataset.step) === state.currentStep);
    });

    document.querySelectorAll('.progress-step').forEach((el) => {
      const stepNum = parseInt(el.dataset.pstep);
      el.classList.toggle('progress-step--active', stepNum === state.currentStep);
      // Zalo Personal: mark steps 2-3 as completed when at step 4
      if (state.channel === 'zalo-personal' && state.currentStep === 4) {
        el.classList.toggle('progress-step--completed', stepNum < 4);
      } else {
        el.classList.toggle('progress-step--completed', stepNum < state.currentStep);
      }
    });

    document.querySelectorAll('.progress-line').forEach((el) => {
      const after = parseInt(el.dataset.after);
      if (state.channel === 'zalo-personal' && state.currentStep === 4) {
        el.classList.toggle('progress-line--active', true);
      } else {
        el.classList.toggle('progress-line--active', after < state.currentStep);
      }
    });

    updateNavButtons();
  }

  function updateNavButtons() {
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const btnNextLabel = document.getElementById('btn-next-label');

    btnPrev.style.visibility = state.currentStep === 1 ? 'hidden' : 'visible';

    if (state.currentStep === state.totalSteps) {
      btnNext.style.display = 'none';
    } else {
      btnNext.style.display = '';
      btnNext.disabled = state.currentStep === 1 && !state.channel;
      if (state.currentStep === 1 && state.channel === 'zalo-personal') {
        btnNextLabel.textContent = 'Cài đặt Zalo';
      } else {
        btnNextLabel.textContent = state.currentStep === 3 ? 'Generate Configs' : 'Tiếp theo';
      }
    }
  }

  // ========== Step 2: Bot Config ==========
  function renderProviderCards() {
    const grid = document.getElementById('provider-grid');
    if (!grid) return;

    grid.innerHTML = Object.entries(PROVIDERS).map(([key, p]) => {
      const iconHTML = p.logo
        ? `<img src="${p.logo}" alt="${p.name}" width="28" height="28">`
        : `<span style="font-size:28px;line-height:1">${p.logoEmoji || '🤖'}</span>`;
      const badgeClass = p.isProxy ? 'badge--proxy' : (p.free ? 'badge--free' : 'badge--paid');
      const badgeText = p.isProxy ? '🔀 Proxy' : (p.free ? '🆓 Free' : '🔒 Paid');
      return `
        <div class="provider-card" data-provider="${key}" onclick="window.__selectProvider('${key}')">
          <div class="provider-card__icon">${iconHTML}</div>
          <div class="provider-card__info">
            <div class="provider-card__name">${p.name}</div>
            <div class="provider-card__badge ${badgeClass}">${badgeText}</div>
          </div>
        </div>`;
    }).join('');
  }

  window.__selectProvider = function (key) {
    state.config.provider = key;
    const p = PROVIDERS[key];
    state.config.model = p.models[0].id;

    // Highlight card
    document.querySelectorAll('.provider-card').forEach((c) => c.classList.remove('provider-card--selected'));
    document.querySelector(`.provider-card[data-provider="${key}"]`)?.classList.add('provider-card--selected');

    // Update model dropdown
    const modelSelect = document.getElementById('cfg-model');
    if (modelSelect) {
      modelSelect.innerHTML = p.models.map((m) =>
        `<option value="${m.id}">${m.name} — ${m.desc} ${m.badge}</option>`
      ).join('');
    }
  };

  function renderPluginGrid() {
    // Skills grid (agent capabilities from ClawHub)
    const skillGrid = document.getElementById('plugin-grid');
    if (skillGrid) {
      skillGrid.innerHTML = SKILLS.map((s) => `
        <label class="plugin-card" data-skill="${s.id}">
          <input type="checkbox" class="plugin-checkbox" value="${s.id}" onchange="window.__toggleSkill('${s.id}', this.checked)">
          <div class="plugin-card__icon">${s.icon}</div>
          <div class="plugin-card__info">
            <div class="plugin-card__name">${s.name}</div>
            <div class="plugin-card__desc">${s.desc}</div>
            ${s.note ? `<div class="plugin-card__note">⚙️ ${s.note}</div>` : ''}
          </div>
          <div class="plugin-card__check">✓</div>
        </label>
      `).join('');
    }

    // Plugins grid (npm packages — extra channels/extensions)
    const pluginGrid = document.getElementById('extra-plugin-grid');
    if (pluginGrid) {
      pluginGrid.innerHTML = PLUGINS.map((p) => `
        <label class="plugin-card" data-plugin="${p.id}">
          <input type="checkbox" class="plugin-checkbox" value="${p.id}" onchange="window.__togglePlugin('${p.id}', this.checked)">
          <div class="plugin-card__icon">${p.icon}</div>
          <div class="plugin-card__info">
            <div class="plugin-card__name">${p.name}</div>
            <div class="plugin-card__desc">${p.desc}</div>
          </div>
          <div class="plugin-card__check">✓</div>
        </label>
      `).join('');
    }
  }

  window.__toggleSkill = function (id, checked) {
    if (checked && !state.config.skills.includes(id)) {
      state.config.skills.push(id);
    } else {
      state.config.skills = state.config.skills.filter((s) => s !== id);
    }
    document.querySelector(`.plugin-card[data-skill="${id}"]`)
      ?.classList.toggle('plugin-card--selected', checked);
  };

  window.__togglePlugin = function (id, checked) {
    if (checked && !state.config.plugins.includes(id)) {
      state.config.plugins.push(id);
    } else {
      state.config.plugins = state.config.plugins.filter((p) => p !== id);
    }
    document.querySelector(`.plugin-card[data-plugin="${id}"]`)
      ?.classList.toggle('plugin-card--selected', checked);
  };

  function bindFormEvents() {
    // Language change is now handled by __selectLang

    // Auto-expand textarea (JS fallback for field-sizing: content)
    const autoExpand = (el) => {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    };

    document.addEventListener('input', (e) => {
      if (e.target.id === 'cfg-name') {
        const prompt = document.getElementById('cfg-prompt');
        const lang = document.getElementById('cfg-language')?.value || 'vi';
        if (prompt && !prompt.dataset.userEdited) {
          prompt.value = DEFAULT_PROMPTS[lang].replace('{BOT_NAME}', e.target.value || 'Bot');
          autoExpand(prompt);
        }
      }
      if (e.target.id === 'cfg-prompt') {
        e.target.dataset.userEdited = 'true';
        autoExpand(e.target);
      }
    });
  }

  function populateStep2() {
    const prompt = document.getElementById('cfg-prompt');
    const lang = document.getElementById('cfg-language')?.value || 'vi';
    const name = document.getElementById('cfg-name')?.value || 'Bot';
    if (prompt && !prompt.dataset.userEdited) {
      prompt.value = DEFAULT_PROMPTS[lang].replace('{BOT_NAME}', name);
      setTimeout(() => { prompt.style.height = 'auto'; prompt.style.height = prompt.scrollHeight + 'px'; }, 50);
    }
    const channelLabel = document.getElementById('selected-channel-label');
    if (channelLabel && state.channel) {
      channelLabel.textContent = CHANNELS[state.channel].name;
    }
    // Select Google by default
    window.__selectProvider(state.config.provider || 'google');
  }

  function saveFormData() {
    state.config.botName = document.getElementById('cfg-name')?.value || 'Chat Bot';
    state.config.description = document.getElementById('cfg-desc')?.value || 'Personal AI assistant';
    state.config.model = document.getElementById('cfg-model')?.value || 'google/gemini-2.5-flash';
    state.config.language = document.getElementById('cfg-language')?.value || 'vi';
    state.config.systemPrompt = document.getElementById('cfg-prompt')?.value || DEFAULT_PROMPTS['vi'];
  }

  // ========== Step 3: Credentials ==========
  function populateStep3() {
    const ch = CHANNELS[state.channel];
    const provider = PROVIDERS[state.config.provider];
    if (!ch || !provider) return;

    const credContainer = document.getElementById('cred-steps');
    if (credContainer) {
      const steps = [];

      // Provider credential step
      if (provider.isProxy) {
        steps.push({ text: provider.envInstructions });
      } else if (provider.isLocal) {
        steps.push({ text: provider.envInstructions });
      } else {
        steps.push({ text: `Lấy <strong>${provider.envLabel}</strong>: ${provider.envInstructions}` });
      }

      // Channel-specific steps
      ch.credSteps.forEach((s) => steps.push(s));

      // Final step
      if (provider.isProxy) {
        steps.push({ text: 'Tạo file <code>docker/openclaw/.env</code> trong thư mục project — chỉ cần Bot Token (không cần AI API key!)' });
      } else {
        steps.push({ text: 'Tạo file <code>docker/openclaw/.env</code> trong thư mục project và paste tất cả key vào' });
      }

      credContainer.innerHTML = steps.map((s, i) => `
        <div class="cred-step">
          <span class="cred-step__number">${i + 1}</span>
          <span class="cred-step__text">${s.text}</span>
        </div>
      `).join('');
    }

    // Build .env preview
    const envContent = document.getElementById('env-content');
    if (envContent) {
      const lines = [];
      if (provider.isProxy) {
        // 9Router: no AI API key needed, only channel token
        lines.push('# Không cần AI API key — 9Router xử lý qua dashboard');
      } else if (provider.isLocal) {
        lines.push(`OLLAMA_HOST=http://host.docker.internal:11434`);
      } else {
        lines.push(`${provider.envKey}=<your_${provider.envKey.toLowerCase()}>`);
      }
      if (ch.envExtra) {
        lines.push(ch.envExtra);
      }

      // Skill-specific env vars
      const selectedSkillEnvVars = [];
      state.config.skills.forEach((sid) => {
        const skill = SKILLS.find((s) => s.id === sid);
        if (skill && skill.envVars && skill.envVars.length > 0) {
          selectedSkillEnvVars.push(`# --- ${skill.name} ---`);
          skill.envVars.forEach((v) => selectedSkillEnvVars.push(v));
        }
      });
      if (selectedSkillEnvVars.length > 0) {
        lines.push('');
        lines.push('# ====== Skill env vars ======');
        selectedSkillEnvVars.forEach((v) => lines.push(v));
      }

      envContent.innerHTML = lines.map((line) => {
        if (!line || line.trim() === '') return '';
        if (line.startsWith('#')) return `<span class="env-comment">${line}</span>`;
        const eq = line.indexOf('=');
        if (eq === -1) return line;
        const key = line.substring(0, eq);
        const val = line.substring(eq + 1);
        return `<span class="env-key">${key}</span>=<span class="env-val">${val}</span>`;
      }).join('\n');
    }

    // Zalo Personal warning
    const warningBox = document.getElementById('zalo-warning');
    if (warningBox) {
      warningBox.style.display = state.channel === 'zalo-personal' ? 'flex' : 'none';
    }
  }

  // ========== Step 4: Generate Output ==========
  function generateOutput() {
    const ch = CHANNELS[state.channel];
    if (!ch) return;

    // Zalo Personal: skip all Docker/config logic, just show install script + guide
    if (state.channel === 'zalo-personal') {
      generateZaloOutput();
      return;
    }

    const provider = PROVIDERS[state.config.provider];
    if (!provider) return;

    const is9Router = provider.isProxy;

    // Show/hide 9Router post-setup notice
    const routerNotice = document.getElementById('9router-notice');
    if (routerNotice) routerNotice.style.display = is9Router ? '' : 'none';

    // Show/hide Browser Automation notice + generate scripts
    const browserNotice = document.getElementById('browser-notice');
    const hasBrowserSkill = state.config.skills.includes('browser');
    if (browserNotice) browserNotice.style.display = hasBrowserSkill ? '' : 'none';

    if (hasBrowserSkill) {
      // Chrome Debug .bat script
      const chromeBat = `@echo off
echo ============================================
echo   OpenClaw - Chrome Debug Mode
echo ============================================
echo.
echo Dang tat Chrome cu (neu co)...
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 3 /nobreak >nul
echo Dang mo Chrome voi Debug Mode...
start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --remote-allow-origins=* ^
  --user-data-dir="%TEMP%\\chrome-debug"
timeout /t 4 /nobreak >nul
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:9222/json/version' -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host 'OK! Chrome Debug Mode dang chay tren port 9222.' -ForegroundColor Green } catch { Write-Host 'LOI: Port 9222 chua mo. Thu lai.' -ForegroundColor Red }"
echo.
pause`;
      setOutput('out-chrome-bat', chromeBat);

      // Task Scheduler PowerShell script
      const taskPs1 = `# ============================================
# OpenClaw - Auto-start Chrome Debug khi logon
# Chay script nay 1 lan voi Run as Administrator
# ============================================

# Duong dan toi file .bat
$batPath = "$env:USERPROFILE\\start-chrome-debug.bat"

# Kiem tra file .bat ton tai
if (-not (Test-Path $batPath)) {
  Write-Host "LOI: Khong tim thay $batPath" -ForegroundColor Red
  Write-Host "Hay luu file start-chrome-debug.bat vao $env:USERPROFILE truoc." -ForegroundColor Yellow
  exit 1
}

# Tao Scheduled Task
$action   = New-ScheduledTaskAction -Execute $batPath
$trigger  = New-ScheduledTaskTrigger -AtLogOn
$trigger.Delay = "PT10S"   # Delay 10 giay sau khi logon
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask \\
  -TaskName "OpenClaw-ChromeDebug" \\
  -Description "Tu dong bat Chrome Debug Mode cho OpenClaw Browser Automation" \\
  -Action $action \\
  -Trigger $trigger \\
  -Settings $settings \\
  -Force

Write-Host ""
Write-Host "DONE! Task 'OpenClaw-ChromeDebug' da duoc tao." -ForegroundColor Green
Write-Host "Chrome se tu dong bat Debug Mode moi khi ban dang nhap Windows (delay 10s)." -ForegroundColor Cyan`;
      setOutput('out-task-ps1', taskPs1);
    }

    // Show Docker output (ensure visible, may have been hidden by Zalo Personal)
    const dockerOut = document.getElementById('docker-output');
    const nativeOut = document.getElementById('native-output');
    const aiShortcut = document.getElementById('ai-agent-shortcut');
    if (dockerOut) dockerOut.style.display = '';
    if (nativeOut) nativeOut.style.display = 'none';
    if (aiShortcut) aiShortcut.style.display = '';

    // Reset step 4 heading
    const title = document.getElementById('step4-title');
    const desc = document.getElementById('step4-desc');
    if (title) title.textContent = '🎉 Config đã sẵn sàng!';
    if (desc) desc.textContent = 'Copy các file bên dưới vào thư mục project, hoặc dùng AI Agent (Antigravity) để tự động setup.';

    const agentId = state.config.botName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '') || 'chat';

    const hasBrowser = state.config.skills.includes('browser');

    // 1. openclaw.json
    const clawConfig = {
      meta: { lastTouchedVersion: '2026.3.24' },
      agents: {
        defaults: {
          model: { primary: state.config.model, fallbacks: [] },
          compaction: { mode: 'safeguard' },
        },
        list: [{
          id: agentId,
          model: { primary: state.config.model, fallbacks: [] },
        }],
      },
      commands: { native: 'auto', nativeSkills: 'auto', restart: true, ownerDisplay: 'raw' },
      channels: ch.channelConfig,
      gateway: {
        port: 18789,
        mode: 'local',
        auth: { mode: 'token', token: crypto.randomUUID().replace(/-/g, '') },
      },
    };

    // 9Router: add proxy endpoint config
    if (is9Router) {
      clawConfig.providers = {
        openai: {
          baseURL: 'http://9router:20128/v1',
        },
      };
    }

    // Browser Automation: inject browser config
    if (hasBrowser) {
      clawConfig.browser = {
        enabled: true,
        defaultProfile: 'host-chrome',
        profiles: {
          'host-chrome': {
            cdpUrl: 'http://127.0.0.1:9222',
            color: '#4285F4',
          },
        },
      };
    }

    setOutput('out-openclaw-json', JSON.stringify(clawConfig, null, 2));

    // 2. Agent YAML
    const agentYaml = `name: ${agentId}
description: "${state.config.description}"

model:
  primary: ${state.config.model}

system_prompt: |
${state.config.systemPrompt.split('\n').map((l) => '  ' + l).join('\n')}`;

    setOutput('out-agent-yaml', agentYaml);

    // 3. Dockerfile
    const allPlugins = [];
    if (ch.pluginInstall) allPlugins.push(ch.pluginInstall);
    state.config.plugins.forEach((pid) => {
      const plug = PLUGINS.find((p) => p.id === pid);
      if (plug) allPlugins.push(plug.package);
    });

    const allSkills = [];
    state.config.skills.forEach((sid) => {
      const skill = SKILLS.find((s) => s.id === sid);
      if (skill) allSkills.push(skill.slug);
    });

    const pluginLines = allPlugins.length > 0
      ? `\n# Install plugins (npm)\nRUN openclaw plugins install ${allPlugins.join(' ')}\n`
      : '';

    const skillLines = allSkills.length > 0
      ? `\n# Install skills (ClawHub)\nRUN openclaw skills install ${allSkills.join(' ')}\n`
      : '';

    // Browser Automation: extra Docker deps
    const browserAptExtra = hasBrowser ? ' socat' : '';
    const browserInstallLines = hasBrowser
      ? `\n# Browser Automation: Playwright engine\nRUN npm install -g agent-browser && npx agent-browser install --with-deps || true\n`
      : '';
    const browserCmd = hasBrowser
      ? 'CMD socat TCP-LISTEN:9222,fork,reuseaddr TCP:host.docker.internal:9222 & openclaw gateway run'
      : 'CMD ["openclaw", "gateway", "run"]';

    const dockerfile = `FROM node:22-slim

RUN apt-get update && apt-get install -y git curl${browserAptExtra} && rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw@latest
${pluginLines}${skillLines}${browserInstallLines}
WORKDIR /root/.openclaw

EXPOSE 18789

${browserCmd}`;

    setOutput('out-dockerfile', dockerfile);

    // 4. docker-compose.yml
    // extra_hosts always needed for browser (socat → host Chrome)
    const extraHostsBlock = `    extra_hosts:\n      - "host.docker.internal:host-gateway"`;

    let compose;
    if (is9Router) {
      compose = `services:
  ai-bot:
    build: .
    container_name: openclaw-bot
    restart: always
    env_file:
      - .env
    depends_on:
      - 9router
${extraHostsBlock}
    volumes:
      - <PROJECT_DIR>/.openclaw:/root/.openclaw
    ports:
      - "18789:18789"

  9router:
    image: node:22-slim
    container_name: 9router
    restart: always
    entrypoint: ["/bin/sh", "-c", "npm install -g 9router && 9router"]
    environment:
      - PORT=20128
      - HOSTNAME=0.0.0.0
    volumes:
      - 9router-data:/root/.9router
    ports:
      - "20128:20128"

volumes:
  9router-data:`;
    } else {
      compose = `services:
  ai-bot:
    build: .
    container_name: openclaw-bot
    restart: always
    env_file:
      - .env
${extraHostsBlock}
    volumes:
      - <PROJECT_DIR>/.openclaw:/root/.openclaw
    ports:
      - "18789:18789"`;
    }

    setOutput('out-compose', compose);

    // 5. Docker commands
    if (is9Router) {
      setOutput('out-commands', `cd <PROJECT_DIR>/docker/openclaw
docker compose build
docker compose up -d

# 📋 Sau khi chạy xong:
# 1. Mở http://localhost:20128/dashboard
# 2. Login OAuth vào AI providers (Google, Claude...)
# 3. Test bot trên Telegram! 🎉`);
    } else {
      setOutput('out-commands', `cd <PROJECT_DIR>/docker/openclaw
docker compose build
docker compose up -d
docker logs -f openclaw-bot`);
    }

    // Update agent filename
    const afEl = document.getElementById('agent-filename');
    if (afEl) afEl.textContent = `.openclaw/agents/${agentId}.yaml`;

    // Update .env filename in tree
    const envInfo = document.getElementById('env-info-tree');
    if (envInfo) {
      const keys = [];
      if (provider.envKey) keys.push(`${provider.envKey}=<your-key>`);
      if (!is9Router) ch.envKeys.forEach(k => keys.push(`${k.key}=<your-value>`));
      if (is9Router) keys.push('# AI key: config qua 9Router dashboard');
      envInfo.textContent = keys.join('\n');
    }
  }

  // ========== Zalo Personal Output (standalone) ==========
  function generateZaloOutput() {
    // Hide Docker, show Native, hide AI shortcut
    const dockerOut = document.getElementById('docker-output');
    const nativeOut = document.getElementById('native-output');
    const aiShortcut = document.getElementById('ai-agent-shortcut');
    if (dockerOut) dockerOut.style.display = 'none';
    if (nativeOut) nativeOut.style.display = '';
    if (aiShortcut) aiShortcut.style.display = 'none';

    // Update step 4 heading for Zalo
    const title = document.getElementById('step4-title');
    const desc = document.getElementById('step4-desc');
    if (title) title.textContent = '🚀 Cài đặt Zalo Personal';
    if (desc) desc.textContent = 'Chỉ 3 bước: Cài Node.js → Chạy script → Làm theo hướng dẫn.';

    // Hide ALL output sections in step 4, then re-show only native ones
    const step4 = nativeOut?.closest('.step');
    if (step4) {
      step4.querySelectorAll('.output-section').forEach(s => s.style.display = 'none');
      step4.querySelectorAll('.cred-section').forEach(s => { if (s.id !== 'ai-agent-shortcut') s.style.display = 'none'; });
    }
    // Re-show native sections
    nativeOut.querySelectorAll('.output-section').forEach(s => s.style.display = '');
    nativeOut.querySelectorAll('.cred-section').forEach(s => s.style.display = '');

    // Script: chỉ install + launch onboard (onboard tự hỏi API key)
    setOutput('out-native-script', `# Cài OpenClaw
npm install -g openclaw@latest

# Mở Setup Wizard
openclaw onboard`);

    // Cheat sheet
    setOutput('out-native-guide', `┌─────────────────────────────────────────────────────┐
│  OpenClaw sẽ hỏi lần lượt — chọn như sau:          │
├──────────────────────┬──────────────────────────────┤
│  Câu hỏi             │  Chọn                        │
├──────────────────────┼──────────────────────────────┤
│  Security warning    │  ✅ Yes                       │
│  Setup mode          │  ✅ QuickStart                │
│  Model provider      │  Chọn tuỳ ý (VD: Google)     │
│  API key             │  Nhập key của provider đã chọn│
│  Default model       │  Chọn model phù hợp           │
│  Select channel      │  ✅ Zalo (Personal Account)   │
│  Login via QR?       │  ✅ Yes                       │
│  ─── QR LOGIN ───    │  📱 Mở file QR → Quét Zalo   │
│  Did you scan QR?    │  ✅ Yes                       │
│  DM policy           │  ✅ Pairing (recommended)     │
│  Configure groups?   │  ✅ No                        │
│  Configure skills?   │  ✅ No                        │
│  Enable hooks?       │  ✅ Enter (chọn mặc định)     │
│  Hatch your bot?     │  ✅ Do this later             │
├──────────────────────┴──────────────────────────────┤
│  💡 Bước QR Login:                                  │
│  File QR sẽ lưu tại thư mục Temp trên máy.         │
│  Mở file ảnh → quét bằng Zalo điện thoại →          │
│  xác nhận kết nối → quay lại chọn Yes.              │
└─────────────────────────────────────────────────────┘`);
  }

  function setOutput(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ========== Copy to Clipboard ==========
  window.copyToClipboard = function (btnEl, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;

    navigator.clipboard.writeText(target.textContent).then(() => {
      const originalText = btnEl.innerHTML;
      btnEl.innerHTML = '✅ Copied!';
      btnEl.classList.add('btn-copy--copied');
      setTimeout(() => {
        btnEl.innerHTML = originalText;
        btnEl.classList.remove('btn-copy--copied');
      }, 2000);
    });
  };
})();
