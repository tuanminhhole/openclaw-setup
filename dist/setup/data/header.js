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
    totalSteps: 5,
    channel: null,
    deployMode: 'docker', // 'docker' | 'native'
    nativeOs: 'win',     // 'win' | 'linux' | 'vps' | 'linux-desktop'
    config: {
      botName: '',
      description: '',
      emoji: '🤖',
      provider: 'google',
      model: 'google/gemini-2.5-flash',
      language: 'vi',
      systemPrompt: '',
      userInfo: '',
      securityRules: '',
      plugins: [],
      skills: [],
      // Persisted credential inputs (Bug 1+2 fix)
      botToken: '',
      apiKey: '',
      projectPath: '',
    },
  };

  // Runtime packages installed alongside openclaw in native and Docker flows.
  const openClawRuntimePackages = globalThis.__openclawCommon?.OPENCLAW_RUNTIME_PACKAGES
    || 'grammy @grammyjs/runner @grammyjs/transformer-throttler @buape/carbon @larksuiteoapi/node-sdk @slack/web-api';

  function getGatewayAllowedOrigins(port) {
    const normalizedPort = Number(port) || 18791;
    const origins = new Set([
      `http://localhost:${normalizedPort}`,
      `http://127.0.0.1:${normalizedPort}`,
      `http://0.0.0.0:${normalizedPort}`,
    ]);
    const currentHost = (window.location && window.location.hostname) ? window.location.hostname.trim() : '';
    if (currentHost) {
      origins.add(`http://${currentHost}:${normalizedPort}`);
    }
    return Array.from(origins);
  }
