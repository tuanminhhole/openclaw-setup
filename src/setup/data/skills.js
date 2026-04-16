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
  // ========== Available Skills (ClawHub registry — agent capabilities) ==========
  const SKILLS = [
    {
      id: 'browser',
      name: 'Browser Automation ⭐(Khuyên dùng)',
      icon: '🌐',
      descVi: 'Tự động thao tác trình duyệt (Playwright)', descEn: 'Automated browser control (Playwright)',
      slug: 'browser-automation',
      noteVi: 'Cần bật Chrome Debug Mode trên máy host', noteEn: 'Requires Chrome Debug Mode on host',
    },
    {
      id: 'memory',
      name: 'Long-term Memory ⭐(Khuyên dùng)',
      icon: '🧠',
      descVi: 'Nhớ hội thoại xuyên phiên, context dài hạn', descEn: 'Cross-session memory, long-term context',
      slug: 'memory',
    },
    {
      id: 'scheduler',
      name: 'Native Cron Scheduler ⭐(Khuyên dùng)',
      icon: '⏰',
      descVi: 'Gọi Cron gốc trên nền tảng (không tải qua HUB)', descEn: 'Native Cron background jobs (No skill download)',
    },
    {
      id: 'rag',
      name: 'RAG / Knowledge Base',
      icon: '📚',
      descVi: 'Chat với tài liệu, file PDF, codebase', descEn: 'Chat with docs, PDFs, codebase',
      slug: 'rag',
      noteVi: 'Đặt file vào thư mục .openclaw/docs/', noteEn: 'Put files in .openclaw/docs/ folder',
    },
    {
      id: 'image-gen',
      name: 'Image Generation',
      icon: '🎨',
      descVi: 'Tạo ảnh bằng AI (DALL·E, Flux, Midjourney...)', descEn: 'Generate images via AI (DALL-E, Flux, Midjourney...)',
      slug: 'image-gen',
      noteVi: 'Dùng chung OPENAI_API_KEY (DALL-E) hoặc thêm FLUX_API_KEY', noteEn: 'Uses OPENAI_API_KEY (DALL-E) or FLUX_API_KEY',
      envVars: ['# FLUX_API_KEY=<your_flux_key>  # chỉ cần nếu dùng Flux'],
    },
    {
      id: 'code-interpreter',
      name: 'Code Interpreter',
      icon: '💻',
      descVi: 'Chạy code Python/JS trong sandbox', descEn: 'Run Python/JS code in sandbox',
      slug: 'code-interpreter',
    },
    {
      id: 'email',
      name: 'Email Assistant',
      icon: '📧',
      descVi: 'Quản lý, soạn, tóm tắt email (Gmail, Outlook...)', descEn: 'Manage, compose, summarize emails (Gmail, Outlook...)',
      slug: 'email-assistant',
      noteVi: 'Cần cấu hình SMTP trong .env', noteEn: 'Requires SMTP configuration in .env',
      envVars: ['SMTP_HOST=smtp.gmail.com', 'SMTP_PORT=587', 'SMTP_USER=<your_email>', 'SMTP_PASS=<your_app_password>'],
    },
    {
      id: 'web-search',
      name: 'Web Search',
      icon: '🔍',
      descVi: 'Tìm kiếm web thời gian thực (DuckDuckGo) — không cần API key', descEn: 'Real-time web search (DuckDuckGo) — no API key needed',
      slug: 'web-search',
    },
    {
      id: 'notion',
      name: 'Notion',
      icon: '📓',
      descVi: 'Tạo, chỉnh sửa trang và database Notion', descEn: 'Create and edit Notion pages and databases',
      slug: 'notion',
      noteVi: 'Cần Notion Integration Token', noteEn: 'Requires Notion Integration Token',
      envVars: ['NOTION_API_KEY=<your_notion_integration_token>'],
    },
    {
      id: 'slack',
      name: 'Slack',
      icon: '🗨️',
      descVi: 'Gửi tin, react, ghim tin nhắn trong Slack', descEn: 'Send messages, react, pin items in Slack',
      slug: 'slack',
      noteVi: 'Cần Slack Bot Token', noteEn: 'Requires Slack Bot Token',
      envVars: ['SLACK_BOT_TOKEN=<your_slack_bot_token>'],
    },
  ];

  function providerSupportsMemoryEmbeddings(providerKey) {
    const provider = PROVIDERS[providerKey];
    if (!provider) return false;
    return !!provider.supportsEmbeddings;
  }

  function getSkillDisplayName(skill, providerKey, lang) {
    const normalizedName = String(skill.name || '')
      .replace(/\s*[⭐🌟]\s*\((Khuyên dùng|Recommended)\)\s*/gi, '')
      .replace(/\s*[⭐🌟]\s*(Khuyên dùng|Recommended)\s*/gi, '')
      .trim();
    if (skill.id === 'memory') {
      return 'Long-term Memory';
    }
    return normalizedName;
  }

  function getSkillBadge(skill, providerKey, lang) {
    const isVi = lang !== 'en';
    if (skill.id === 'memory' && providerSupportsMemoryEmbeddings(providerKey)) {
      return {
        text: isVi ? 'Khuyên dùng' : 'Recommended',
        className: 'plugin-card__badge plugin-card__badge--recommended'
      };
    }
    if (skill.id === 'browser' || skill.id === 'scheduler') {
      return {
        text: isVi ? 'Khuyên dùng' : 'Recommended',
        className: 'plugin-card__badge plugin-card__badge--recommended'
      };
    }
    return null;
  }

  function getSkillExtraNote(skill, providerKey, lang) {
    const isVi = lang !== 'en';
    const baseNote = isVi ? (skill.noteVi || skill.note || '') : (skill.noteEn || skill.note || '');
    if (skill.id !== 'memory' || providerSupportsMemoryEmbeddings(providerKey)) {
      return baseNote;
    }
    const providerName = PROVIDERS[providerKey]?.name || providerKey;
    const memoryNote = isVi
      ? `Provider hiện tại (${providerName}) chưa có đường embeddings được xác nhận trong wizard, nên memory search sẽ không được gắn khuyên dùng.`
      : `The current provider (${providerName}) does not have a confirmed embeddings path in the wizard, so memory search is not marked recommended.`;
    return baseNote ? `${baseNote} ${memoryNote}` : memoryNote;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getSkillTooltipContent(skill, providerKey, lang) {
    const desc = lang === 'vi' ? (skill.descVi || skill.desc || '') : (skill.descEn || skill.desc || '');
    const note = getSkillExtraNote(skill, providerKey, lang);
    return [desc, note].filter(Boolean).join('\n\n');
  }

  function getPluginTooltipContent(plugin, lang) {
    return lang === 'vi' ? (plugin.descVi || plugin.desc || '') : (plugin.descEn || plugin.desc || '');
  }

