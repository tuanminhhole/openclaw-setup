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

    // ─── Per-bot openclaw.json (delegates to centralized builder) ──────────────
    function botConfigContent(botIndex) {
      const bot = state.bots[botIndex] || {};
      const botName = bot.name || `Bot ${botIndex + 1}`;
      const agentId = botName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const basePort = 18791 + botIndex;
      const groupId = state.groupId || '';

      // Force use global provider if proxy mode is chosen globally, else use bot specific provider
      const botProvider = (provider && provider.isProxy) ? provider : (PROVIDERS[bot.provider] || provider);
      const actualModel = botProvider.isProxy ? provider.models[0].id : (bot.model || state.config.model);
      const bcfg = globalThis.__openclawBotConfig;

      const cfg = bcfg.buildOpenclawJson({
        channelKey: state.channel,
        deployMode: state.deployMode,
        providerKey: botProvider.isProxy ? '9router' : (bot.provider || state.config.provider),
        provider: botProvider,
        model: actualModel,
        isMultiBot,
        agentMetas: [{
          agentId,
          name: botName,
          token: (bot.token || state.config.botToken || '').trim(),
          workspaceDir: `workspace-${agentId}`,
        }],
        groupId,
        selectedSkills: state.config.skills,
        skills: SKILLS,
        hasBrowserDesktop: hasBrowser && state.browserMode === 'desktop',
        hasBrowserServer: hasBrowser && state.browserMode !== 'desktop',
        gatewayPort: basePort,
        gatewayAllowedOrigins: getGatewayAllowedOrigins(basePort),
        osChoice: state.nativeOs || '',
        selectedModel: typeof selectedModel !== 'undefined' ? selectedModel : '',
      });

      return JSON.stringify(cfg, null, 2);
    }

    function botAuthProfilesContent(botIndex) {
      const bot = state.bots[botIndex] || {};
      const botProvider = PROVIDERS[bot.provider] || provider;
      const common = globalThis.__openclawCommon;
      const authProviderName = botProvider.isProxy ? '9router' : (bot.provider || state.config.provider);
      const apiKeyVal = botProvider.isProxy
        ? common.NINE_ROUTER_PROXY_API_KEY
        : ((bot.apiKey || state.config.apiKey || '').trim() || `<your_${(botProvider.envKey || 'API_KEY').toLowerCase()}>`);
      return common.buildAuthProfilesString({
        providerKey: authProviderName,
        provider: botProvider,
        providerKeyVal: apiKeyVal,
        isProxy: botProvider.isProxy,
        isLocal: botProvider.isLocal,
        deployMode: state.deployMode,
      });
    }

    function botExecApprovalsContent(botIndex) {
      const bot = state.bots[botIndex] || {};
      const botName = bot.name || `Bot ${botIndex + 1}`;
      const agentId = botName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const bcfg = globalThis.__openclawBotConfig;
      return JSON.stringify(bcfg.buildExecApprovalsJson({
        agentMetas: [{ agentId }],
      }), null, 2);
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
