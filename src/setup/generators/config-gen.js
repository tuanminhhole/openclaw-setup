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
    function getGeneratedEnvContent(fallbackContent = '') {
      const text = (document.getElementById('env-content')?.textContent || '').trim();
      if (text) return `${text}\n`;
      return fallbackContent ? `${String(fallbackContent).trim()}\n` : '';
    }

    function botEnvContent(botIndex) {
      const bot = state.bots[botIndex] || {};
      const botProvider = (provider && provider.isProxy) ? provider : (PROVIDERS[bot.provider] || provider);
      const lines = [];
      if (botProvider.isProxy) {
        lines.push('# 9Router: no API key needed');
      } else if (botProvider.isLocal) {
        lines.push('OLLAMA_HOST=http://localhost:11434');
        lines.push('OLLAMA_API_KEY=ollama-local');
      } else {
        const keyVal = (bot.apiKey || state.config.apiKey || '').trim();
        lines.push(`${botProvider.envKey}=${keyVal || '<your_api_key>'}`);
      }
      const tok = (bot.token || state.config.botToken || '').trim();
      if (state.channel === 'telegram') {
        lines.push(`TELEGRAM_BOT_TOKEN=${tok || '<your_bot_token>'}`);
        if (state.groupId) lines.push(`TELEGRAM_GROUP_ID=${state.groupId}`);
      } else if (state.channel === 'zalo-bot') {
        lines.push('ZALO_APP_ID=');
        lines.push('ZALO_APP_SECRET=');
        lines.push(`ZALO_BOT_TOKEN=${tok || '<your_zalo_bot_token>'}`);
      }
      return lines.join('\n');
    }

    // ─── Per-bot openclaw.json (minimal — shared workspace) ──────────────────
    function botConfigContent(botIndex) {
      const bot = state.bots[botIndex] || {};
      const botName = bot.name || `Bot ${botIndex + 1}`;
      const agentId = botName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const basePort = 18791 + botIndex;
      const groupId = state.groupId || '';
      
      // Force use global provider if proxy mode is chosen globally, else use bot specific provider
      const botProvider = (provider && provider.isProxy) ? provider : (PROVIDERS[bot.provider] || provider);
      const actualModel = botProvider.isProxy ? provider.models[0].id : (bot.model || state.config.model);

      const cfg = {
        meta: { lastTouchedVersion: '2026.3.24' },
        agents: {
          defaults: {
            model: { primary: actualModel },
            compaction: { mode: 'safeguard' },
            timeoutSeconds: botProvider.isLocal ? 900 : 120,
            ...(botProvider.isLocal ? { llm: { idleTimeoutSeconds: 300 } } : {}),
          },
          list: [{
            id: agentId,
            workspace: `.openclaw/workspace-${agentId}`,
            agentDir: `agents/${agentId}/agent`,
            model: { primary: actualModel }
          }],
        },
        ...(botProvider.isProxy ? {
          models: {
            mode: 'merge',
            providers: {
              '9router': {
                baseUrl: state.deployMode === 'docker' ? 'http://9router:20128/v1' : 'http://localhost:20128/v1',
                apiKey: 'sk-no-key',
                api: 'openai-completions',
                models: [
                  {
                    id: 'smart-route',
                    name: 'Smart Proxy (Auto Route)',
                    contextWindow: 200000,
                    maxTokens: 8192,
                  }
                ]
              }
            }
          }
        } : {}),
        ...(botProvider.isLocal ? {
          models: {
            providers: {
              ollama: {
                baseUrl: state.deployMode === 'docker' ? 'http://ollama:11434' : 'http://localhost:11434',
                apiKey: 'ollama-local',
                api: 'ollama',
                models: [
                  { id: selectedModel, name: selectedModel, contextWindow: 128000, maxTokens: 8192 }
                ]
              }
            }
          }
        } : {}),
        commands: { native: 'auto', nativeSkills: 'auto', restart: true, ownerDisplay: 'raw' },
        channels: {},
        tools: { profile: 'full', exec: { host: 'gateway', security: 'full', ask: 'off' } },
        gateway: {
          port: basePort,
          mode: 'local',
          ...(state.deployMode === 'docker'
            ? { bind: 'custom', customBindHost: '0.0.0.0' }
            : { bind: 'loopback' }),
          controlUi: {
            allowedOrigins: getGatewayAllowedOrigins(basePort),
          },
          auth: { mode: 'token', token: crypto.randomUUID().replace(/-/g, '') },
        },
      };

      if (hasBrowser) {
        cfg.browser = { enabled: true };
      }

      const skillEntries = {};
      state.config.skills.forEach((sid) => {
        const skill = SKILLS.find((s) => s.id === sid);
        if (!skill) return;
        if (skill.id === 'scheduler' || skill.slug === 'browser-automation' || !skill.slug) return;
        skillEntries[skill.slug] = { enabled: true };
      });
      if (Object.keys(skillEntries).length > 0) {
        cfg.skills = { entries: skillEntries };
      }
      // Enable memory-core with dreaming by default
      cfg.plugins = cfg.plugins || {};
      cfg.plugins.entries = cfg.plugins.entries || {};
      cfg.plugins.entries['memory-core'] = {
        config: {
          dreaming: {
            enabled: true,
          },
        },
      };
      if (!state.config.skills.includes('memory')) {
        // User explicitly opted out of memory - disable dreaming but keep memory-core
        cfg.plugins.entries['memory-core'].config.dreaming.enabled = false;
      }

      if (state.channel === 'telegram') {
        const tok = (bot.token || state.config.botToken || '').trim();
        cfg.channels.telegram = {
          enabled: true,
          dmPolicy: 'open',
          allowFrom: ['*'],
          replyToMode: 'first',
          reactionLevel: 'ack',
          actions: {
            sendMessage: true,
            reactions: true,
          },
          accounts: {
            default: {
              botToken: tok || '<your_bot_token>',
              ackReaction: '👍',
            },
          },
        };
        if (isMultiBot) {
          cfg.channels.telegram.groupPolicy = groupId ? 'allowlist' : 'open';
          cfg.channels.telegram.groupAllowFrom = ['*'];
          cfg.channels.telegram.groups = {
            [groupId || '*']: {
              enabled: true,
              requireMention: false,
            },
          };
        }
      }
      
      if (state.channel === 'zalo-personal') {
        cfg.channels.zalouser = {
          enabled: true,
          dmPolicy: 'open',
          autoReply: true,
        };
        // plugins.entries.zalouser is REQUIRED for gateway to load the Zalo channel provider
        cfg.plugins = cfg.plugins || {};
        cfg.plugins.entries = cfg.plugins.entries || {};
        cfg.plugins.entries.zalouser = { enabled: true };
      } else if (state.channel === 'zalo-bot') {
        cfg.channels.zalo = { enabled: true, provider: 'official_account' };
      }

      return JSON.stringify(cfg, null, 2);
    }

    function botAuthProfilesContent(botIndex) {
      const bot = state.bots[botIndex] || {};
      const botProvider = PROVIDERS[bot.provider] || provider;
      let authProfilesJson;
      if (botProvider.isLocal) {
        authProfilesJson = {
          version: 1,
          profiles: {
            'ollama:default': {
              provider: 'ollama',
              type: 'api_key',
              key: 'ollama-local',
              url: 'http://localhost:11434',
            },
          },
          order: { ollama: ['ollama:default'] },
        };
      } else {
        const authProviderName = botProvider.isProxy ? '9router' : (bot.provider || state.config.provider);
        const authProfileId = botProvider.isProxy ? '9router-proxy' : `${authProviderName}:default`;
        const authKeyValue = botProvider.isProxy
          ? 'sk-no-key'
          : ((bot.apiKey || state.config.apiKey || '').trim() || `<your_${(botProvider.envKey || 'API_KEY').toLowerCase()}>`);
        authProfilesJson = {
          version: 1,
          profiles: {
            [authProfileId]: {
              provider: authProviderName,
              type: 'api_key',
              key: authKeyValue,
            },
          },
          order: { [authProviderName]: [authProfileId] },
        };
        if (!botProvider.isProxy && botProvider.baseURL) {
          authProfilesJson.profiles[authProfileId].url = botProvider.baseURL;
        }
      }
      return JSON.stringify(authProfilesJson, null, 2);
    }

    function botExecApprovalsContent(botIndex) {
      const bot = state.bots[botIndex] || {};
      const botName = bot.name || `Bot ${botIndex + 1}`;
      const agentId = botName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return JSON.stringify({
        version: 1,
        defaults: {
          security: 'full',
          ask: 'off',
          askFallback: 'full'
        },
        agents: {
          main: { security: 'full', ask: 'off', askFallback: 'full', autoAllowSkills: true },
          [agentId]: { security: 'full', ask: 'off', askFallback: 'full', autoAllowSkills: true }
        }
      }, null, 2);
    }


    function botWorkspaceFiles(botIndex) {
      const bot = state.bots[botIndex] || {};
      const botName = bot.name || `Bot ${botIndex + 1}`;
      const botDesc = bot.desc || state.config.description || '';
      const agentId = botName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const agentWorkspaceDir = `workspace-${agentId}`;
      const ownAliases = [botName, bot.slashCmd || '', `bot ${botIndex + 1}`].filter(Boolean);
      const otherAgents = state.bots.slice(0, state.botCount)
        .map((peer, idx) => ({
          name: peer.name || `Bot ${idx + 1}`,
          agentId: (peer.name || `Bot ${idx + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          desc: peer.desc || '',
        }))
        .filter((_, idx) => idx !== botIndex);
      const selectedSkillNames = state.config.skills.map((sid) => {
        const skill = SKILLS.find((s) => s.id === sid);
        return skill ? `- **${skill.name}**${skill.slug ? ` (${skill.slug})` : ''}` : null;
      }).filter(Boolean);

      return globalThis.__openclawWorkspace.buildWorkspaceFileMap({
        isVi,
        variant: isMultiBot ? 'relay' : 'single',
        botName,
        botDesc,
        ownAliases,
        otherAgents,
        skillListStr: selectedSkillNames.join('\n'),
        workspacePath: `.openclaw/${agentWorkspaceDir}/`,
        agentWorkspaceDir,
        persona: bot.persona || '',
        userInfo: state.config.userInfo || '',
        hasBrowser,
        soulVariant: 'wizard',
        memoryVariant: 'wizard',
      });
    }


    function botFiles(botIndex) {
      const bot = state.bots[botIndex] || {};
      const botName = bot.name || `Bot ${botIndex + 1}`;
      const agentId = botName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const base = '.';
      const files = {};
      const envContent = getGeneratedEnvContent(botEnvContent(botIndex));
      files[`${base}/.openclaw/openclaw.json`] = botConfigContent(botIndex);
      files[`${base}/.openclaw/exec-approvals.json`] = botExecApprovalsContent(botIndex);
      if (envContent) {
        files[`${base}/.env`] = envContent;
      }
      if (is9Router) files[`${base}/.9router/9router-smart-route-sync.js`] = native9RouterSyncScriptContent();
      files[`${base}/upgrade.ps1`] = globalThis.__openclawInstall.buildUpgradePs1();
      files[`${base}/upgrade.sh`] = globalThis.__openclawInstall.buildUpgradeSh();
      // auth-profiles.json NOT generated for native: .env is the single source of truth.
      // start-bot scripts load .env as env vars → GEMINI_API_KEY etc. are picked up by OpenClaw.
      // Generating auth-profiles.json would override .env credential updates (higher priority).
      Object.entries(botWorkspaceFiles(botIndex)).forEach(([name, content]) => {
        files[`${base}/.openclaw/workspace-${agentId}/${name}`] = content;
      });
      return files;
    }

    function appendShWriteCommands(arr, files) {
      Object.entries(files).forEach(([relPath, content]) => {
        const dir = relPath.substring(0, relPath.lastIndexOf('/'));
        if (dir) arr.push(`mkdir -p "${dir}"`);
        arr.push(`cat > "${relPath}" << 'CLAWEOF'\n${content}\nCLAWEOF`);
      });
    }

    function batEscapeEchoLine(line) {
      return line
        .replace(/\^/g, '^^')
        .replace(/&/g, '^&')
        .replace(/\|/g, '^|')
        .replace(/</g, '^<')
        .replace(/>/g, '^>')
        .replace(/\(/g, '^(')
        .replace(/\)/g, '^)')
        .replace(/%/g, '%%');
    }

    function appendBatWriteCommands(arr, files) {
      Object.entries(files).forEach(([relPath, content]) => {
        const winPath = relPath.replace(/\//g, '\\');
        const dir = winPath.substring(0, winPath.lastIndexOf('\\'));
        if (dir) arr.push(`if not exist "${dir}" mkdir "${dir}"`);
        arr.push(`> "${winPath}" (`);
        content.split('\n').forEach((line) => {
          arr.push(line.length ? `echo(${batEscapeEchoLine(line)}` : 'echo(');
        });
        arr.push(')');
      });
    }

    function mapWindowsNativeFiles(files) {
      return Object.fromEntries(Object.entries(files).map(([relPath, content]) => {
        const normalized = relPath.replace(/\\/g, '/');
        if (normalized.startsWith('.9router/')) {
          return [`%DATA_DIR%\\${normalized.slice('.9router/'.length).replace(/\//g, '\\')}`, content];
        }
        if (normalized.startsWith('.openclaw/')) {
          return [`%OPENCLAW_HOME%\\${normalized.slice('.openclaw/'.length).replace(/\//g, '\\')}`, content];
        }
        return [`%PROJECT_DIR%\\${normalized.replace(/\//g, '\\')}`, content];
      }));
    }
