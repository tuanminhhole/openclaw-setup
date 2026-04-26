// @ts-nocheck
/**
 * @fileoverview Centralized bot configuration builders — single source of truth.
 *
 * Generates openclaw.json, auth-profiles.json, exec-approvals.json, and .env content.
 * Used by BOTH the Wizard (IIFE bundle) and CLI (CJS require).
 *
 * Pattern: same as common-gen.js / workspace-gen.js — IIFE + CJS dual export.
 */
(function (root) {

  const _common = (typeof root !== 'undefined' && root.__openclawCommon) || {};

  // ── Helper: slugify a bot name into a safe agent ID ─────────────────────────
  function slugify(name) {
    return String(name || 'bot').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'bot';
  }

  // ── Helper: detect if channel is zalo personal ───────────────────────────────
  function isZaloPersonal(channelKey) {
    return channelKey === 'zalo-personal';
  }

  // ── Helper: generate a random token (works in both browser + Node) ──────────
  function generateToken() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '');
    }
    // Fallback for older Node.js
    const hex = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 32; i++) result += hex[Math.floor(Math.random() * 16)];
    return result;
  }


  // ═══════════════════════════════════════════════════════════════════════════════
  // buildOpenclawJson — the ONE function that generates the full openclaw.json
  // ═══════════════════════════════════════════════════════════════════════════════
  /**
   * @param {object} opts
   * @param {string} opts.channelKey       - 'telegram' | 'zalo-personal' | 'zalo-bot'
   * @param {string} opts.deployMode       - 'docker' | 'native'
   * @param {string} opts.providerKey      - '9router' | 'openai' | 'ollama' | ...
   * @param {object} opts.provider         - Provider metadata object from PROVIDERS
   * @param {string} opts.model            - Primary model ID (e.g. 'smart-route', 'gemma4:e2b')
   * @param {boolean} opts.isMultiBot      - Multi-bot mode
   * @param {Array}  opts.agentMetas       - [{ agentId, name, desc, persona, token, slashCmd, accountId, workspaceDir }]
   * @param {string} opts.groupId          - Telegram group ID (multi-bot only)
   * @param {Array}  opts.selectedSkills   - ['browser', 'memory', 'scheduler', ...]
   * @param {Array}  opts.skills           - Full SKILLS registry array
   * @param {boolean} opts.hasBrowserDesktop - Browser desktop mode
   * @param {boolean} opts.hasBrowserServer  - Browser server mode
   * @param {number} [opts.gatewayPort=18791]
   * @param {Array}  [opts.gatewayAllowedOrigins]
   * @param {string} [opts.osChoice]       - 'windows' | 'macos' | 'vps' | 'ubuntu'
   * @param {string} [opts.selectedModel]  - For Ollama: specific model selected
   */
  function buildOpenclawJson(opts) {
    const {
      channelKey = 'telegram',
      deployMode = 'docker',
      providerKey = '9router',
      provider = {},
      model = 'smart-route',
      isMultiBot = false,
      agentMetas = [],
      groupId = '',
      selectedSkills = [],
      skills = [],
      hasBrowserDesktop = false,
      hasBrowserServer = false,
      gatewayPort = 18791,
      gatewayAllowedOrigins = [],
      osChoice = '',
      selectedModel = '',
    } = opts;

    const common = _common;
    const is9Router = providerKey === '9router';
    const isLocal = !!provider.isLocal;

    // ── agents ────────────────────────────────────────────────────────────────
    const agentsList = agentMetas.map((meta) => ({
      id: meta.agentId,
      ...(meta.name ? { name: meta.name } : {}),
      workspace: `.openclaw/${meta.workspaceDir || 'workspace-' + meta.agentId}`,
      agentDir: `agents/${meta.agentId}/agent`,
      model: { primary: model, fallbacks: [] },
    }));

    const cfg = {
      meta: { lastTouchedVersion: (_common.OPENCLAW_NPM_SPEC || 'latest').replace('openclaw@', '') },
      agents: {
        defaults: {
          model: { primary: model, fallbacks: [] },
          compaction: { mode: 'safeguard' },
          timeoutSeconds: isLocal ? 900 : 120,
          ...(isLocal ? { llm: { idleTimeoutSeconds: 300 } } : {}),
        },
        list: agentsList,
      },
    };

    // ── models.providers ──────────────────────────────────────────────────────
    if (is9Router && common.build9RouterProviderConfig) {
      cfg.models = {
        mode: 'merge',
        providers: {
          '9router': common.build9RouterProviderConfig(
            common.get9RouterBaseUrl ? common.get9RouterBaseUrl(deployMode) : 'http://9router:20128/v1'
          ),
        },
      };
    } else if (isLocal) {
      const ollamaBaseUrl = deployMode === 'docker' ? 'http://ollama:11434' : 'http://localhost:11434';
      const OLLAMA_MODELS = (typeof root !== 'undefined' && root.__openclawData && root.__openclawData.OLLAMA_MODELS)
        || (typeof _OLLAMA_MODELS !== 'undefined' ? _OLLAMA_MODELS : []);
      const modelList = selectedModel
        ? [{ id: selectedModel, name: selectedModel, contextWindow: 128000, maxTokens: 8192 }]
        : OLLAMA_MODELS;
      cfg.models = {
        mode: 'merge',
        providers: {
          ollama: {
            baseUrl: ollamaBaseUrl,
            api: 'ollama',
            apiKey: 'ollama-local',
            models: modelList,
          },
        },
      };
    }

    // ── commands ──────────────────────────────────────────────────────────────
    cfg.commands = { native: 'auto', nativeSkills: 'auto', restart: true, ownerDisplay: 'raw' };

    // ── bindings (multi-bot or Zalo) ─────────────────────────────────────────
    if (isMultiBot && channelKey === 'telegram') {
      cfg.bindings = agentMetas.map((meta) => ({
        agentId: meta.agentId,
        match: { channel: 'telegram', accountId: meta.accountId || 'default' },
      }));
    }

    // ── channels ─────────────────────────────────────────────────────────────
    cfg.channels = buildChannelConfig({
      channelKey, isMultiBot, groupId, agentMetas, botName: agentMetas[0]?.name || 'Bot',
      agentId: agentMetas[0]?.agentId || 'bot',
    });

    // ── tools ────────────────────────────────────────────────────────────────
    cfg.tools = { profile: 'full', exec: { host: 'gateway', security: 'full', ask: 'off' } };
    if (isMultiBot) {
      cfg.tools.agentToAgent = {
        enabled: true,
        allow: agentMetas.map((meta) => meta.agentId),
      };
    }

    // ── gateway ──────────────────────────────────────────────────────────────
    cfg.gateway = {
      port: gatewayPort,
      mode: 'local',
      bind: (deployMode === 'docker' || osChoice === 'vps') ? 'custom' : 'loopback',
      ...(deployMode === 'docker' || osChoice === 'vps' ? { customBindHost: '0.0.0.0' } : {}),
      controlUi: {
        allowedOrigins: gatewayAllowedOrigins.length > 0
          ? gatewayAllowedOrigins
          : [`http://localhost:${gatewayPort}`, `http://127.0.0.1:${gatewayPort}`, `http://0.0.0.0:${gatewayPort}`],
      },
      auth: { mode: 'token', token: generateToken() },
    };

    // ── browser ──────────────────────────────────────────────────────────────
    if (hasBrowserDesktop) {
      cfg.browser = {
        enabled: true,
        defaultProfile: 'host-chrome',
        profiles: { 'host-chrome': { cdpUrl: 'http://127.0.0.1:9222', color: '#4285F4' } },
      };
    } else if (hasBrowserServer) {
      cfg.browser = { enabled: true };
    }

    // ── skills ───────────────────────────────────────────────────────────────
    const skillEntries = buildSkillsEntries(skills, selectedSkills);
    if (Object.keys(skillEntries).length > 0) {
      cfg.skills = { entries: skillEntries };
    }

    // ── plugins (memory-core dreaming + zalo-mod) ────────────────────────────
    const pluginsConfig = buildPluginsConfig({
      channelKey,
      selectedSkills,
      botName: agentMetas[0]?.name || 'Bot',
      agentId: agentMetas[0]?.agentId || 'bot',
    });
    cfg.plugins = pluginsConfig.plugins;

    // ── bindings for zalouser ────────────────────────────────────────────────
    if (isZaloPersonal(channelKey)) {
      cfg.bindings = cfg.bindings || [];
      const firstAgentId = agentMetas[0]?.agentId || 'bot';
      if (!cfg.bindings.some(b => b.match && b.match.channel === 'zalouser')) {
        cfg.bindings.push({ agentId: firstAgentId, match: { channel: 'zalouser' } });
      }
    }

    return cfg;
  }


  // ═══════════════════════════════════════════════════════════════════════════════
  // buildChannelConfig — returns the full `channels: { ... }` object
  // ═══════════════════════════════════════════════════════════════════════════════
  function buildChannelConfig(opts) {
    const { channelKey, isMultiBot, groupId, agentMetas = [], botName, agentId } = opts;
    const channels = {};

    if (channelKey === 'telegram') {
      const telegramConfig = {
        enabled: true,
        defaultAccount: 'default',
        dmPolicy: 'open',
        allowFrom: ['*'],
        replyToMode: 'first',
        reactionLevel: 'minimal',
        actions: {
          sendMessage: true,
          reactions: true,
        },
        accounts: {},
      };

      if (isMultiBot) {
        // Multiple accounts — each bot gets its own account keyed by accountId
        telegramConfig.accounts = {};
        for (const meta of agentMetas) {
          telegramConfig.accounts[meta.accountId || 'default'] = {
            botToken: meta.token || '<your_bot_token>',
          };
        }
        telegramConfig.groupPolicy = groupId ? 'allowlist' : 'open';
        telegramConfig.groupAllowFrom = ['*'];
        telegramConfig.groups = {
          [groupId || '*']: { enabled: true, requireMention: false },
        };
      } else {
        // Single bot
        telegramConfig.accounts = {
          default: {
            botToken: (agentMetas[0] && agentMetas[0].token) || '<your_bot_token>',
          },
        };
      }

      channels.telegram = telegramConfig;
    } else if (isZaloPersonal(channelKey)) {
      // Zalo Personal — matches live Mkt/Williams configs
      channels.zalouser = {
        enabled: true,
        defaultAccount: 'default',
        dmPolicy: 'open',
        allowFrom: ['*'],
        groupPolicy: 'allowlist',
        groupAllowFrom: ['*'],
        historyLimit: 50,
        groups: {
          '*': { enabled: true, requireMention: false },
        },
      };
    } else if (channelKey === 'zalo-bot') {
      channels.zalo = { enabled: true, provider: 'official_account' };
    }

    return channels;
  }


  // ═══════════════════════════════════════════════════════════════════════════════
  // buildPluginsConfig — returns { plugins: { ... } }
  // ═══════════════════════════════════════════════════════════════════════════════
  function buildPluginsConfig(opts) {
    const { channelKey, selectedSkills = [], botName = 'Bot', agentId = 'bot' } = opts;

    const entries = {};

    // memory-core with dreaming — always present
    entries['memory-core'] = {
      config: {
        dreaming: {
          enabled: selectedSkills.includes('memory'),
        },
      },
    };

    const allow = [];

    // zalo-mod plugin for Zalo Personal
    if (isZaloPersonal(channelKey)) {
      allow.push('zalo-mod');
      entries['zalo-mod'] = {
        enabled: true,
        config: {
          botName: botName,
          groupNames: {},
          zaloDisplayNames: [botName],
          welcomeEnabled: true,
          spamRepeatN: 3,
          spamWindowSeconds: 300,
        },
      };
    }

    const plugins = { entries };
    if (allow.length > 0) {
      plugins.allow = allow;
    }

    return { plugins };
  }


  // ═══════════════════════════════════════════════════════════════════════════════
  // buildSkillsEntries — returns { slug: { enabled: true } } map
  // ═══════════════════════════════════════════════════════════════════════════════
  function buildSkillsEntries(skills, selectedSkillIds) {
    const entries = {};
    if (!skills || !selectedSkillIds) return entries;

    for (const skill of skills) {
      const skillId = skill.value || skill.id;
      if (!selectedSkillIds.includes(skillId)) continue;
      // Skills without a slug are native (browser, scheduler) — not in skills.entries
      const slug = skill.slug;
      if (!slug) continue;
      // Skip browser-automation slug (handled by browser config)
      if (slug === 'browser-automation') continue;
      entries[slug] = { enabled: true };
    }

    return entries;
  }


  // ═══════════════════════════════════════════════════════════════════════════════
  // buildExecApprovalsJson — exec-approvals.json content
  // ═══════════════════════════════════════════════════════════════════════════════
  function buildExecApprovalsJson(opts) {
    const { agentMetas = [] } = opts;
    const agentEntries = {};
    agentEntries.main = { security: 'full', ask: 'off', askFallback: 'full', autoAllowSkills: true };
    for (const meta of agentMetas) {
      agentEntries[meta.agentId] = { security: 'full', ask: 'off', askFallback: 'full', autoAllowSkills: true };
    }
    return {
      version: 1,
      defaults: { security: 'full', ask: 'off', askFallback: 'full' },
      agents: agentEntries,
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════════
  // buildEnvFileContent — .env file content for a single bot
  // ═══════════════════════════════════════════════════════════════════════════════
  /**
   * @param {object} opts
   * @param {object} opts.provider         - Provider metadata
   * @param {string} opts.providerKeyVal   - API key value
   * @param {string} opts.channelKey       - Channel type
   * @param {string} opts.botToken         - Bot token
   * @param {boolean} opts.isMultiBot
   * @param {string} opts.groupId
   * @param {Array}  opts.selectedSkills
   * @param {string} opts.ttsOpenaiKey
   * @param {string} opts.ttsElevenKey
   * @param {string} opts.smtpHost
   * @param {string} opts.smtpPort
   * @param {string} opts.smtpUser
   * @param {string} opts.smtpPass
   * @param {boolean} opts.isSharedEnv     - If true, omit per-bot token (multi-bot shared .env)
   */
  function buildEnvFileContent(opts) {
    const {
      provider = {},
      providerKeyVal = '',
      channelKey = 'telegram',
      botToken = '',
      isMultiBot = false,
      groupId = '',
      selectedSkills = [],
      ttsOpenaiKey = '',
      ttsElevenKey = '',
      smtpHost = 'smtp.gmail.com',
      smtpPort = '587',
      smtpUser = '',
      smtpPass = '',
      isSharedEnv = false,
    } = opts;

    const lines = [];

    if (provider.isLocal) {
      lines.push('OLLAMA_HOST=http://localhost:11434');
      lines.push('OLLAMA_API_KEY=ollama-local');
    } else if (provider.isProxy) {
      lines.push('# 9Router: no API key needed');
    } else if (provider.envKey) {
      lines.push(`${provider.envKey}=${providerKeyVal || '<your_api_key>'}`);
    }

    if (!isSharedEnv) {
      if (channelKey === 'telegram') {
        lines.push(`TELEGRAM_BOT_TOKEN=${botToken || '<your_bot_token>'}`);
        if (isMultiBot && groupId) lines.push(`TELEGRAM_GROUP_ID=${groupId}`);
      } else if (channelKey === 'zalo-bot') {
        lines.push('ZALO_APP_ID=');
        lines.push('ZALO_APP_SECRET=');
        lines.push(`ZALO_BOT_TOKEN=${botToken || '<your_zalo_bot_token>'}`);
      }
    }

    if (selectedSkills.includes('tts')) {
      lines.push('');
      lines.push('# --- Text-To-Speech ---');
      if (ttsOpenaiKey) lines.push(`OPENAI_API_KEY=${ttsOpenaiKey}`);
      if (ttsElevenKey) lines.push(`ELEVENLABS_API_KEY=${ttsElevenKey}`);
    }

    if (selectedSkills.includes('email')) {
      lines.push('');
      lines.push('# --- Email ---');
      lines.push(`SMTP_HOST=${smtpHost}`);
      lines.push(`SMTP_PORT=${smtpPort}`);
      lines.push(`SMTP_USER=${smtpUser}`);
      lines.push(`SMTP_PASS=${smtpPass}`);
    }

    return lines.join('\n') + '\n';
  }


  // ═══════════════════════════════════════════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════════════════════════════════════════
  const exports = {
    slugify,
    isZaloPersonal,
    generateToken,
    buildOpenclawJson,
    buildChannelConfig,
    buildPluginsConfig,
    buildSkillsEntries,
    buildExecApprovalsJson,
    buildEnvFileContent,
  };

  if (typeof root !== 'undefined') {
    root.__openclawBotConfig = exports;
  }

})(typeof globalThis !== 'undefined' ? globalThis : {});
if (typeof exports !== 'undefined' && typeof globalThis !== 'undefined' && globalThis.__openclawBotConfig) {
  Object.assign(exports, globalThis.__openclawBotConfig);
}
