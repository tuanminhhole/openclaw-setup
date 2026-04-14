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
  // ========== Available Plugins (npm packages — runtime/channel extensions) ==========
  const PLUGINS = [
    {
      id: 'telegram-multibot-relay',
      name: 'Telegram Multi-Bot Relay',
      icon: '🤝',
      descVi: 'Điều phối nhiều bot Telegram trong cùng group — tự động khi chọn nhiều bot', descEn: 'Coordinate multiple Telegram bots in one group — auto-selected with multi-bot',
      package: 'openclaw-telegram-multibot-relay',
      hidden: true, // hidden in UI, auto-selected programmatically
    },
    {
      id: 'voice-call',
      name: 'Voice Call',
      icon: '📞',
      descVi: 'Gọi thoại AI qua điện thoại', descEn: 'AI voice calls via phone',
      package: '@openclaw/voice-call',
    },
    {
      id: 'matrix',
      name: 'Matrix Chat',
      icon: '💬',
      descVi: 'Kết nối thêm kênh Matrix/Element', descEn: 'Connect to Matrix/Element channels',
      package: '@openclaw/matrix',
    },
    {
      id: 'msteams',
      name: 'MS Teams',
      icon: '🏢',
      descVi: 'Kết nối Microsoft Teams', descEn: 'Connect Microsoft Teams',
      package: '@openclaw/msteams',
    },
    {
      id: 'nostr',
      name: 'Nostr',
      icon: '🟣',
      descVi: 'Kết nối mạng xã hội Nostr', descEn: 'Connect Nostr social network',
      package: '@openclaw/nostr',
    },
  ];

