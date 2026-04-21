// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * Native generator helpers for 9Router / multi-bot runtime.
 * Do NOT add import/export statements. Edit, then run: node build.mjs
 */

const SMART_ROUTE_PROVIDER_MODELS = {
  codex: ['cx/gpt-5.4', 'cx/gpt-5.3-codex', 'cx/gpt-5.2', 'cx/gpt-5.4-mini'],
  'claude-code': ['cc/claude-opus-4-6', 'cc/claude-sonnet-4-6', 'cc/claude-opus-4-5-20251101', 'cc/claude-sonnet-4-5-20250929', 'cc/claude-haiku-4-5-20251001'],
  github: ['gh/gpt-5.4', 'gh/gpt-5.3-codex', 'gh/gpt-5.2-codex', 'gh/gpt-5.2', 'gh/gpt-5.1-codex-max', 'gh/gpt-5.1-codex', 'gh/gpt-5.1', 'gh/gpt-5', 'gh/gpt-4.1', 'gh/gpt-4o', 'gh/claude-opus-4.6', 'gh/claude-sonnet-4.6', 'gh/claude-sonnet-4.5', 'gh/claude-opus-4.5', 'gh/claude-haiku-4.5', 'gh/gemini-3-pro-preview', 'gh/gemini-3-flash-preview', 'gh/gemini-2.5-pro'],
  cursor: ['cu/default', 'cu/claude-4.6-opus-max', 'cu/claude-4.5-opus-high-thinking', 'cu/claude-4.5-sonnet-thinking', 'cu/claude-4.5-sonnet', 'cu/gpt-5.3-codex', 'cu/gpt-5.2-codex', 'cu/gemini-3-flash-preview'],
  kilo: ['kc/anthropic/claude-sonnet-4-20250514', 'kc/anthropic/claude-opus-4-20250514', 'kc/google/gemini-2.5-pro', 'kc/google/gemini-2.5-flash', 'kc/openai/gpt-4.1', 'kc/deepseek/deepseek-chat'],
  cline: ['cl/anthropic/claude-sonnet-4.6', 'cl/anthropic/claude-opus-4.6', 'cl/openai/gpt-5.3-codex', 'cl/openai/gpt-5.4', 'cl/google/gemini-3.1-pro-preview'],
  'gemini-cli': ['gc/gemini-3-flash-preview', 'gc/gemini-3-pro-preview'],
  iflow: ['if/qwen3-coder-plus', 'if/kimi-k2', 'if/kimi-k2-thinking', 'if/glm-4.7', 'if/deepseek-r1', 'if/deepseek-v3.2', 'if/deepseek-v3', 'if/qwen3-max', 'if/qwen3-235b', 'if/iflow-rome-30ba3b'],
  qwen: ['qw/qwen3-coder-plus', 'qw/qwen3-coder-flash', 'qw/vision-model', 'qw/coder-model'],
  kiro: ['kr/claude-sonnet-4.5', 'kr/claude-haiku-4.5', 'kr/deepseek-3.2', 'kr/deepseek-3.1', 'kr/qwen3-coder-next'],
  ollama: ['ollama/gemma4:e2b', 'ollama/gemma4:e4b', 'ollama/gemma4:26b', 'ollama/gemma4:31b', 'ollama/qwen3.5', 'ollama/kimi-k2.5', 'ollama/glm-5', 'ollama/glm-4.7-flash', 'ollama/minimax-m2.5', 'ollama/gpt-oss:120b'],
  'kimi-coding': ['kmc/kimi-k2.5', 'kmc/kimi-k2.5-thinking', 'kmc/kimi-latest'],
  glm: ['glm/glm-5.1', 'glm/glm-5', 'glm/glm-4.7'],
  'glm-cn': ['glm/glm-5.1', 'glm/glm-5', 'glm/glm-4.7'],
  minimax: ['minimax/MiniMax-M2.7', 'minimax/MiniMax-M2.5', 'minimax/MiniMax-M2.1'],
  kimi: ['kimi/kimi-k2.5', 'kimi/kimi-k2.5-thinking', 'kimi/kimi-latest'],
  deepseek: ['deepseek/deepseek-chat', 'deepseek/deepseek-reasoner'],
  xai: ['xai/grok-4', 'xai/grok-4-fast-reasoning', 'xai/grok-code-fast-1'],
  mistral: ['mistral/mistral-large-latest', 'mistral/codestral-latest'],
  groq: ['groq/llama-3.3-70b-versatile', 'groq/openai/gpt-oss-120b'],
  cerebras: ['cerebras/gpt-oss-120b'],
  alicode: ['alicode/qwen3.5-plus', 'alicode/qwen3-coder-plus'],
  openai: ['openai/gpt-4o', 'openai/gpt-4.1'],
  anthropic: ['anthropic/claude-sonnet-4', 'anthropic/claude-haiku-3.5'],
  gemini: ['gemini/gemini-2.5-flash', 'gemini/gemini-2.5-pro'],
};
const SMART_ROUTE_PROVIDER_ORDER = ['openai', 'anthropic', 'claude-code', 'codex', 'cursor', 'github', 'cline', 'kimi', 'minimax', 'deepseek', 'glm', 'alicode', 'xai', 'mistral', 'kilo', 'kiro', 'iflow', 'qwen', 'gemini-cli', 'ollama'];

function buildNativeScriptCtx(options) {
  const relayPluginSpec = options?.relayPluginSpec || 'openclaw-telegram-multibot-relay';
  const buildTelegramPostInstallChecklist = options?.buildTelegramPostInstallChecklist || (() => '');

  const lang = document.getElementById('cfg-language')?.value || 'vi';
  const isVi = lang === 'vi';
  const provider = PROVIDERS[state.config.provider];
  const ch = CHANNELS[state.channel];
  const is9Router = !!(provider && provider.isProxy);
  const isOllama = !!(provider && provider.isLocal);
  const hasBrowser = state.config.skills.includes('browser');
  const nativeSkillConfigs = state.config.skills
    .map((sid) => SKILLS.find((s) => s.id === sid))
    .filter((skill) => skill && skill.id !== 'scheduler' && skill.slug && skill.slug !== 'browser-automation');
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
    hasBrowser,
    is9Router,
    selectedModel,
    isMultiBot,
    projectDir,
  });

  function native9RouterSyncScriptContent() {
    return `const fs=require('fs');
const path=require('path');
const INTERVAL=30000;
const p=path.join(process.env.DATA_DIR||'.9router','db.json');
const ROUTER='http://localhost:20128';
const PM=${JSON.stringify(SMART_ROUTE_PROVIDER_MODELS)};
const PREF=${JSON.stringify(SMART_ROUTE_PROVIDER_ORDER)};
console.log('[sync-combo] 9Router sync loop started...');
const sync=async()=>{try{const res=await fetch(ROUTER+'/api/providers');if(!res.ok){console.log('[sync-combo] API not ready, retrying...');return;}const d=await res.json();const rawConnections=Array.isArray(d.connections)?d.connections:Array.isArray(d.providerConnections)?d.providerConnections:[];const a=[...new Set(rawConnections.filter(c=>c&&c.provider&&c.isActive!==false&&!c.disabled).map(c=>c.provider))];let db={};try{db=JSON.parse(fs.readFileSync(p,'utf8'));}catch{}if(!db.combos)db.combos=[];const removeSmartRoute=()=>{const next=db.combos.filter(x=>x.id!=='smart-route');if(next.length!==db.combos.length){db.combos=next;fs.writeFileSync(p,JSON.stringify(db,null,2));console.log('[sync-combo] Removed smart-route (no active providers)');}};if(!a.length){removeSmartRoute();return;}a.sort((x,y)=>(PREF.indexOf(x)===-1?99:PREF.indexOf(x))-(PREF.indexOf(y)===-1?99:PREF.indexOf(y)));const m=a.flatMap(provider=>PM[provider]||[]);if(!m.length){removeSmartRoute();return;}const c={id:'smart-route',name:'smart-route',alias:'smart-route',models:m};const i=db.combos.findIndex(x=>x.id==='smart-route');if(i>=0){if(JSON.stringify(db.combos[i].models)!==JSON.stringify(c.models)){db.combos[i]=c;fs.writeFileSync(p,JSON.stringify(db,null,2));console.log('[sync-combo] Updated smart-route: '+c.models.length+' models from: '+a.join(','));}}else{db.combos.push(c);fs.writeFileSync(p,JSON.stringify(db,null,2));console.log('[sync-combo] Created smart-route: '+c.models.length+' models from: '+a.join(','));}}catch(e){console.log('[sync-combo] Error:',e.message);}};setTimeout(sync,5000);setInterval(sync,INTERVAL);`;
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
      meta: { lastTouchedVersion: '2026.3.24' },
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
          workspace: '.openclaw/' + meta.workspaceDir,
          agentDir: `agents/${meta.agentId}/agent`,
          model: { primary: state.config.model, fallbacks: [] },
        })),
      },
      commands: { native: 'auto', nativeSkills: 'auto', restart: true, ownerDisplay: 'raw' },
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
            '9router': {
              baseUrl: 'http://localhost:20128/v1',
              apiKey: 'sk-no-key',
              api: 'openai-responses',
              models: [
                {
                  id: 'smart-route',
                  name: 'Smart Proxy (Auto Route)',
                  contextWindow: 200000,
                  maxTokens: 8192,
                },
                { id: 'cx/gpt-5.4', name: 'Codex GPT 5.4', contextWindow: 200000, maxTokens: 8192 },
                { id: 'cx/gpt-5.3-codex', name: 'Codex GPT 5.3', contextWindow: 200000, maxTokens: 8192 },
                { id: 'cx/gpt-5.2', name: 'Codex GPT 5.2', contextWindow: 200000, maxTokens: 8192 },
                { id: 'cx/gpt-5.4-mini', name: 'Codex GPT 5.4 Mini', contextWindow: 200000, maxTokens: 8192 }
              ]
            }
          }
        }
      } : {}),
      gateway: {
        port: 18791,
        mode: 'local',
        bind: 'loopback',
        controlUi: {
          allowedOrigins: getGatewayAllowedOrigins(18791),
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
    hasBrowser,
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
