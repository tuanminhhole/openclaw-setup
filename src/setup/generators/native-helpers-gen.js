// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * Native generator helpers for 9Router / multi-bot runtime.
 * Do NOT add import/export statements. Edit, then run: node build.mjs
 */

const SMART_ROUTE_PROVIDER_MODELS = globalThis.__openclawCommon.SMART_ROUTE_PROVIDER_MODELS;
const SMART_ROUTE_PROVIDER_ORDER = globalThis.__openclawCommon.SMART_ROUTE_PROVIDER_ORDER;

function buildNativeScriptCtx(options) {
  const relayPluginSpec = options?.relayPluginSpec || 'openclaw-telegram-multibot-relay';
  const buildTelegramPostInstallChecklist = options?.buildTelegramPostInstallChecklist || (() => '');

  const lang = document.getElementById('cfg-language')?.value || 'vi';
  const isVi = lang === 'vi';
  const provider = PROVIDERS[state.config.provider];
  const ch = CHANNELS[state.channel];
  const is9Router = !!(provider && provider.isProxy);
  const isOllama = !!(provider && provider.isLocal);
  const nativeSkillConfigs = state.config.skills
    .map((sid) => SKILLS.find((s) => s.id === sid))
    .filter((skill) => skill && skill.id !== 'scheduler' && skill.slug);
  const selectedModel = (state.config.model || 'ollama/gemma4:e2b').replace('ollama/', '');
  const isMultiBot = state.botCount > 1 && state.channel === 'telegram';
  const projectDir = state.config.projectPath || '.';
  const todayStamp = new Date().toISOString().slice(0, 10);

  const allPlugins = [];
  if (ch && ch.pluginInstall) allPlugins.push(ch.pluginInstall);
  state.config.plugins.forEach(function(pid) {
    const p = PLUGINS.find((x) => x.id === pid);
    if (p) allPlugins.push(p.package);
  });
  if (isMultiBot && state.channel === 'telegram') allPlugins.push(relayPluginSpec);
  const uniquePlugins = [...new Set(allPlugins)];
  const pluginCmd = uniquePlugins.length > 0 ? uniquePlugins.map(function(pkg) { return 'call npm exec -- openclaw plugins install ' + pkg + ' || echo [WARN] Plugin ' + pkg + ' cai dat that bai (co the do rate limit). Ban co the cai thu cong sau.'; }).join('\r\n') : '';
  const nativeSkillInstallCmds = nativeSkillConfigs.map((skill) => `call openclaw skills install ${skill.slug} || echo Warning: Failed to install skill ${skill.slug}`);

  Object.assign(globalThis, {
    isVi,
    provider,
    is9Router,
    selectedModel,
    isMultiBot,
    projectDir,
  });

  function native9RouterSyncScriptContent() {
    return `const fs = require('fs');
const path = require('path');
const INTERVAL = 30000;
const DB_PATH = path.join(process.env.DATA_DIR || '.9router', 'db', 'data.sqlite');
const PORT = process.env.PORT || 20128;
const COMBO_NAME = 'smart-route';
const API_BASE = \\\`http://localhost:\\\${PORT}\\\`;

function ensureSettings() {
  try {
    let Database;
    try {
      const cp = require('child_process');
      const npmRoot = cp.execSync('npm root -g').toString().trim();
      Database = require(path.join(npmRoot, '9router', 'node_modules', 'better-sqlite3'));
    } catch {
      try { Database = require('better-sqlite3'); } catch { return; }
    }
    const db = Database(DB_PATH);
    const existing = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    if (!existing) {
      db.prepare("INSERT INTO settings (id, data) VALUES (1, ?)").run(JSON.stringify({ requireLogin: false }));
    } else {
      try {
        const data = JSON.parse(existing.data || '{}');
        if (data.requireLogin !== false) {
          data.requireLogin = false;
          db.prepare("UPDATE settings SET data = ? WHERE id = 1").run(JSON.stringify(data));
        }
      } catch {}
    }
    db.close();
  } catch (e) {}
}

const sync = async () => {
  try {
    if (!fs.existsSync(DB_PATH)) return;

    let existingCombo = null;
    try {
      const resp = await fetch(\\\`\\\${API_BASE}/api/combos\\\`);
      if (resp.status === 401) {
        ensureSettings();
        return;
      }
      const data = await resp.json();
      if (data.combos) {
        existingCombo = data.combos.find(c => c.name === COMBO_NAME);
      }
    } catch (e) { return; }

    if (existingCombo) return;

    let activeProviders = [];
    try {
      const resp = await fetch(\\\`\\\${API_BASE}/api/providers\\\`);
      const data = await resp.json();
      const conns = data.connections || data.providerConnections || [];
      activeProviders = [...new Set(
        conns.filter(c => c && c.provider && c.isActive !== false && !c.disabled).map(c => c.provider)
      )];
    } catch (e) { return; }

    if (!activeProviders.length) return;

    let models = [];
    try {
      const resp = await fetch(\\\`\\\${API_BASE}/api/models\\\`);
      const data = await resp.json();
      if (data.models && Array.isArray(data.models)) {
        models = data.models
          .filter(m => activeProviders.includes(m.provider))
          .filter(m => !/(embedding|image|tts|stt|audio|vision)/i.test(m.model))
          .map(m => m.fullModel);
      }
      models = [...new Set(models)];
    } catch (e) { return; }

    if (!models.length) return;

    try {
      await fetch(\\\`\\\${API_BASE}/api/combos\\\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: COMBO_NAME, models })
      });
      console.log('[sync-combo] Created smart-route with ' + models.length + ' models');
    } catch (e) {}
  } catch (e) {}
};

if (fs.existsSync(DB_PATH)) ensureSettings();
setTimeout(sync, 10000);
setInterval(sync, INTERVAL);`;
  }

  function native9RouterServerEntryLookup() {
    return "node -e \"const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');const home=os.homedir();const roots=[];try{const root=cp.execSync('npm root -g',{stdio:['ignore','pipe','ignore'],encoding:'utf8'}).trim();if(root)roots.push(root);}catch{}for(const prefix of [process.env.npm_config_prefix,process.env.NPM_CONFIG_PREFIX,process.env.PREFIX,process.env.NPM_PREFIX,path.join(home,'.local'),path.join(home,'.npm-global'),path.join(home,'.local','share','npm')].filter(Boolean)){roots.push(path.join(prefix,'lib','node_modules'));}roots.push(path.join(home,'.local','share','npm','lib','node_modules'));roots.push(path.join(home,'.local','lib','node_modules'));const seen=new Set();const found=roots.map(root=>path.join(root,'9router','app','server.js')).find(candidate=>{if(seen.has(candidate))return false;seen.add(candidate);return fs.existsSync(candidate);});if(!found)process.exit(1);console.log(found);\"";
  }

  function windowsHiddenNodeLaunch(targetPath, extraEnv = {}, extraArgs = []) {
    const envAssignments = Object.entries(extraEnv)
      .map(([k, v]) => `$env:${k}='${String(v).replace(/'/g, "''")}'; `)
      .join('');
    const safePath = targetPath.replace(/\\/g, '\\\\').replace(/'/g, "''");
    const argList = [`'${safePath}'`, ...extraArgs.map(a => `'${String(a).replace(/'/g, "''")}' `)].join(',');
    return `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${envAssignments}Start-Process -WindowStyle Hidden -FilePath (Get-Command node).Source -ArgumentList @(${argList})"`;
  }

  function providerLines(arr, shell) {
    if (is9Router) {
      if (shell === 'bat') {
        arr.push(':: Dung 9Router dang chay (neu co) - tranh loi EBUSY khi npm cap nhat file dang bi lock');
        arr.push('wmic process where "Name=\'node.exe\' and CommandLine like \'%%9router%%\'" delete >nul 2>&1');
        arr.push('wmic process where "Name=\'cmd.exe\' and CommandLine like \'%%9router%%\'" delete >nul 2>&1');
        arr.push('timeout /t 3 /nobreak >nul');
        arr.push('call npm install -g 9router || goto :fail');
        arr.push('echo [OK] 9Router da duoc cai dat thanh cong.');
        arr.push('if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"');
        arr.push('if not exist "%DATA_DIR%\\db.json" (');
        arr.push('> "%DATA_DIR%\\db.json" (');
        arr.push('echo({');
        arr.push('echo(  "providerConnections": [],');
        arr.push('echo(  "providerNodes": [],');
        arr.push('echo(  "proxyPools": [],');
        arr.push('echo(  "modelAliases": {},');
        arr.push('echo(  "mitmAlias": {},');
        arr.push('echo(  "combos": [],');
        arr.push('echo(  "apiKeys": [],');
        arr.push('echo(  "settings": {');
        arr.push('echo(    "requireLogin": false,');
        arr.push('echo(    "cloudEnabled": false,');
        arr.push('echo(    "tunnelEnabled": false,');
        arr.push('echo(    "comboStrategy": "fallback",');
        arr.push('echo(    "mitmRouterBaseUrl": "http://localhost:20128"');
        arr.push('echo(  },');
        arr.push('echo(  "pricing": {}');
        arr.push('echo(}');
        arr.push(')');
        arr.push(')');
        arr.push('echo Khoi dong 9Router (background)...');
        arr.push('echo $env:DATA_DIR = \'%DATA_DIR%\' > "%TEMP%\\oc-start9r.ps1"');
        arr.push('echo $b = Join-Path $env:APPDATA \'npm\\9router.cmd\' >> "%TEMP%\\oc-start9r.ps1"');
        arr.push('echo if ^(-not ^(Test-Path $b^)^) { $b = Join-Path $env:APPDATA \'npm\\9router\' } >> "%TEMP%\\oc-start9r.ps1"');
        arr.push(`echo Start-Process 'cmd.exe' -WindowStyle Hidden -WorkingDirectory '${projectDir}' -ArgumentList ^('/c "' + $b + '" -n -H 0.0.0.0 -p 20128 --skip-update'^) >> "%TEMP%\\oc-start9r.ps1"`);
        arr.push('powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\\oc-start9r.ps1"');
        arr.push('del "%TEMP%\\oc-start9r.ps1" >nul 2>&1');
        arr.push('timeout /t 8 /nobreak >nul');
      } else {
        arr.push('npm install -g 9router');
        arr.push('mkdir -p ".9router"');
        arr.push('if [ ! -f ".9router/db.json" ]; then cat > ".9router/db.json" << \'DBJSON\'\n{\n  "providerConnections": [],\n  "providerNodes": [],\n  "proxyPools": [],\n  "modelAliases": {},\n  "mitmAlias": {},\n  "combos": [],\n  "apiKeys": [],\n  "settings": {\n    "requireLogin": false,\n    "cloudEnabled": false,\n    "tunnelEnabled": false,\n    "comboStrategy": "fallback",\n    "mitmRouterBaseUrl": "http://localhost:20128"\n  },\n  "pricing": {}\n}\nDBJSON\nfi');
        arr.push('NINE_ROUTER_BIN="$(command -v 9router)"');
        arr.push('nohup env PORT=20128 HOSTNAME=0.0.0.0 DATA_DIR="$PWD/.9router" "$NINE_ROUTER_BIN" -n -H 0.0.0.0 -p 20128 --skip-update > /tmp/9router.log 2>&1 &');
        arr.push('nohup env DATA_DIR="$PWD/.9router" node ./.9router/9router-smart-route-sync.js > /tmp/9router-sync.log 2>&1 &');
        arr.push('sleep 5');
      }
    } else if (isOllama) {
      if (shell === 'bat') {
        arr.push('where ollama >nul 2>&1 || (powershell -Command "Invoke-WebRequest -Uri https://ollama.com/download/OllamaSetup.exe -OutFile OllamaSetup.exe" && OllamaSetup.exe && del OllamaSetup.exe)');
        arr.push('ollama pull ' + selectedModel);
      } else {
        arr.push('command -v ollama > /dev/null 2>&1 || curl -fsSL https://ollama.com/install.sh | sh');
        arr.push('ollama pull ' + selectedModel);
      }
    }
  }

  const multiBotAgentMetas = isMultiBot
    ? state.bots.slice(0, state.botCount).map((bot, idx) => {
        const name = bot?.name || `Bot ${idx + 1}`;
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `bot-${idx + 1}`;
        return {
          idx,
          name,
          desc: bot?.desc || state.config.description || (isVi ? 'Tro ly AI ca nhan' : 'Personal AI assistant'),
          persona: bot?.persona || '',
          slashCmd: bot?.slashCmd || '',
          token: (bot?.token || '').trim(),
          agentId: slug,
          accountId: idx === 0 ? 'default' : slug,
          workspaceDir: `workspace-${slug}`,
        };
      })
    : [];

  function sharedNativeEnvContent() {
    const envPreview = (document.getElementById('env-content')?.textContent || '').trim();
    if (envPreview) return `${envPreview}\n`;

    const lines = [];
    if (provider.isProxy) {
      lines.push('# 9Router: no AI API key needed');
    } else if (provider.isLocal) {
      lines.push('OLLAMA_HOST=http://localhost:11434');
      lines.push('OLLAMA_API_KEY=ollama-local');
    } else {
      lines.push(`${provider.envKey}=${(state.config.apiKey || '').trim() || '<your_api_key>'}`);
    }
    multiBotAgentMetas.forEach((meta, idx) => {
      lines.push(`TELEGRAM_BOT_TOKEN_${idx + 1}=${meta.token || `<token_for_${meta.agentId}>`}`);
    });
    if (state.groupId) lines.push(`TELEGRAM_GROUP_ID=${state.groupId}`);
    return `${lines.join('\n')}\n`;
  }


  function sharedNativeExecApprovalsContent() {
    return JSON.stringify({
      version: 1,
      defaults: {
        security: 'full',
        ask: 'off',
        askFallback: 'full',
      },
      agents: {
        main: { security: 'full', ask: 'off', askFallback: 'full', autoAllowSkills: true },
        ...Object.fromEntries(multiBotAgentMetas.map((meta) => [meta.agentId, { security: 'full', ask: 'off', askFallback: 'full', autoAllowSkills: true }])),
      },
    }, null, 2);
  }

  function sharedNativeConfigContent() {
    const groupId = state.groupId || '';
    const telegramAccounts = Object.fromEntries(multiBotAgentMetas.map((meta) => [meta.accountId, {
      botToken: meta.token || '<your_bot_token>',
    }]));
    const cfg = {
      meta: { lastTouchedVersion: (globalThis.__openclawCommon.OPENCLAW_NPM_SPEC || 'latest').replace('openclaw@', '') },
      agents: {
        defaults: {
          model: { primary: state.config.model, fallbacks: [] },
          compaction: { mode: 'safeguard' },
          timeoutSeconds: provider.isLocal ? 900 : 120,
          ...(provider.isLocal ? { llm: { idleTimeoutSeconds: 300 } } : {}),
        },
        list: multiBotAgentMetas.map((meta) => ({
          id: meta.agentId,
          name: meta.name,
          model: { primary: state.config.model, fallbacks: [] },
        })),
      },
      commands: {
        native: 'auto',
        nativeSkills: 'auto',
        restart: true,
        ownerDisplay: 'raw',
        ...(state.config.skills.includes('scheduler') ? { ownerAllowFrom: ['*'] } : {}),
      },
      bindings: multiBotAgentMetas.map((meta) => ({
        agentId: meta.agentId,
        match: { channel: 'telegram', accountId: meta.accountId },
      })),
      channels: {
        telegram: {
          enabled: true,
          defaultAccount: 'default',
          dmPolicy: 'open',
          allowFrom: ['*'],
          groupPolicy: groupId ? 'allowlist' : 'open',
          groupAllowFrom: ['*'],
          groups: {
            [groupId || '*']: { enabled: true, requireMention: false },
          },
          replyToMode: 'first',
          reactionLevel: 'minimal',
          actions: {
            sendMessage: true,
            reactions: true,
          },
          accounts: telegramAccounts,
        },
      },
      tools: {
        profile: 'full',
        ...(state.config.skills.includes('scheduler') ? { alsoAllow: ['group:automation'] } : {}),
        exec: { host: 'gateway', security: 'full', ask: 'off' },
        agentToAgent: {
          enabled: true,
          allow: multiBotAgentMetas.map((meta) => meta.agentId),
        },
      },
      plugins: {
        entries: {},
      },
      ...(provider.isProxy ? {
        models: {
          mode: 'merge',
          providers: {
            '9router': globalThis.__openclawCommon.build9RouterProviderConfig(
              globalThis.__openclawCommon.get9RouterBaseUrl('native')
            )
          }
        }
      } : {}),
      gateway: {
        port: 18789,
        mode: 'local',
        bind: state.nativeOs === 'vps' ? 'lan' : 'loopback',
        controlUi: {
          allowedOrigins: getGatewayAllowedOrigins(18789),
        },
        auth: { mode: 'token', token: crypto.randomUUID().replace(/-/g, '') },
      },
    };
    // Enable memory-core with dreaming by default
    cfg.plugins.entries = cfg.plugins.entries || {};
    cfg.plugins.entries['memory-core'] = {
      config: {
        dreaming: {
          enabled: state.config.skills.includes('memory'),
        },
      },
    };
    return JSON.stringify(cfg, null, 2);
  }

  function sharedNativeFileMap() {
    const files = {
      '.env': sharedNativeEnvContent(),
      '.openclaw/openclaw.json': sharedNativeConfigContent(),
      '.openclaw/exec-approvals.json': sharedNativeExecApprovalsContent(),
      [globalThis.__openclawCommon.TELEGRAM_SETUP_GUIDE_FILENAME]: buildTelegramPostInstallChecklist(),
      'upgrade.ps1': globalThis.__openclawInstall.buildUpgradePs1(),
      'upgrade.sh': globalThis.__openclawInstall.buildUpgradeSh(),
    };
    // auth-profiles.json NOT generated for native: .env is the single source of truth.
    // start-bot scripts load .env as env vars before openclaw starts, so
    // GEMINI_API_KEY / OPENAI_API_KEY / etc. from .env are picked up automatically.
    // Generating auth-profiles.json would override .env updates (higher priority).
    multiBotAgentMetas.forEach((meta) => {
      Object.entries(botWorkspaceFiles(meta.idx)).forEach(([name, content]) => {
        files[`.openclaw/${meta.workspaceDir}/${name}`] = content;
      });
    });
    if (is9Router) files['.9router/9router-smart-route-sync.js'] = native9RouterSyncScriptContent();
    return files;
  }

  return {
    ch,
    isVi,
    provider,
    is9Router,
    isOllama,
    selectedModel,
    isMultiBot,
    projectDir,
    todayStamp,
    allPlugins,
    pluginCmd,
    nativeSkillInstallCmds,
    nativeSkillConfigs,
    providerLines,
    sharedNativeFileMap,
    sharedNativeEnvContent,
    sharedNativeExecApprovalsContent,
    sharedNativeConfigContent,
    native9RouterSyncScriptContent,
    native9RouterServerEntryLookup,
    windowsHiddenNodeLaunch,
  };
}
