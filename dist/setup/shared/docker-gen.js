// @ts-nocheck
(function (root) {
  function encodeBase64Utf8(value) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(String(value), 'utf8').toString('base64');
    }
    return btoa(String.fromCharCode(...new TextEncoder().encode(String(value))));
  }

  function indentBlock(text, spaces) {
    const prefix = ' '.repeat(spaces);
    return String(text).split('\n').map((line) => `${prefix}${line}`).join('\n');
  }

  function build9RouterSmartRouteSyncScript(dbPath) {
    return `const fs=require('fs');const INTERVAL=30000;const p='${dbPath}';
const PM={codex:['cx/gpt-5.4','cx/gpt-5.3-codex','cx/gpt-5.3-codex-high','cx/gpt-5.2-codex','cx/gpt-5.2','cx/gpt-5.1-codex-max','cx/gpt-5.1-codex','cx/gpt-5.1','cx/gpt-5-codex'],'claude-code':['cc/claude-opus-4-6','cc/claude-sonnet-4-6','cc/claude-opus-4-5-20251101','cc/claude-sonnet-4-5-20250929','cc/claude-haiku-4-5-20251001'],github:['gh/gpt-5.4','gh/gpt-5.3-codex','gh/gpt-5.2-codex','gh/gpt-5.2','gh/gpt-5.1-codex-max','gh/gpt-5.1-codex','gh/gpt-5.1','gh/gpt-5','gh/gpt-4.1','gh/gpt-4o','gh/claude-opus-4.6','gh/claude-sonnet-4.6','gh/claude-sonnet-4.5','gh/claude-opus-4.5','gh/claude-haiku-4.5','gh/gemini-3-pro-preview','gh/gemini-3-flash-preview','gh/gemini-2.5-pro'],cursor:['cu/default','cu/claude-4.6-opus-max','cu/claude-4.5-opus-high-thinking','cu/claude-4.5-sonnet-thinking','cu/claude-4.5-sonnet','cu/gpt-5.3-codex','cu/gpt-5.2-codex','cu/gemini-3-flash-preview'],'kilo:['kc/anthropic/claude-sonnet-4-20250514','kc/anthropic/claude-opus-4-20250514','kc/google/gemini-2.5-pro','kc/google/gemini-2.5-flash','kc/openai/gpt-4.1','kc/deepseek/deepseek-chat'],'cline':['cl/anthropic/claude-sonnet-4.6','cl/anthropic/claude-opus-4.6','cl/openai/gpt-5.3-codex','cl/openai/gpt-5.4','cl/google/gemini-3.1-pro-preview'],'gemini-cli':['gc/gemini-3-flash-preview','gc/gemini-3-pro-preview'],'iflow':['if/qwen3-coder-plus','if/kimi-k2','if/kimi-k2-thinking','if/glm-4.7','if/deepseek-r1','if/deepseek-v3.2','if/deepseek-v3','if/qwen3-max','if/qwen3-235b','if/iflow-rome-30ba3b'],'qwen':['qw/qwen3-coder-plus','qw/qwen3-coder-flash','qw/vision-model','qw/coder-model'],'kiro':['kr/claude-sonnet-4.5','kr/claude-haiku-4.5','kr/deepseek-3.2','kr/deepseek-3.1','kr/qwen3-coder-next'],'ollama':['ollama/gemma4:e2b','ollama/gemma4:e4b','ollama/gemma4:26b','ollama/gemma4:31b','ollama/qwen3.5','ollama/kimi-k2.5','ollama/glm-5','ollama/glm-4.7-flash','ollama/minimax-m2.5','ollama/gpt-oss:120b'],'kimi-coding':['kmc/kimi-k2.5','kmc/kimi-k2.5-thinking','kmc/kimi-latest'],'glm':['glm/glm-5.1','glm/glm-5','glm/glm-4.7'],'glm-cn':['glm/glm-5.1','glm/glm-5','glm/glm-4.7'],'minimax':['minimax/MiniMax-M2.7','minimax/MiniMax-M2.5','minimax/MiniMax-M2.1'],'kimi':['kimi/kimi-k2.5','kimi/kimi-k2.5-thinking','kimi/kimi-latest'],'deepseek':['deepseek/deepseek-chat','deepseek/deepseek-reasoner'],'xai':['xai/grok-4','xai/grok-4-fast-reasoning','xai/grok-code-fast-1'],'mistral':['mistral/mistral-large-latest','mistral/codestral-latest'],'groq':['groq/llama-3.3-70b-versatile','groq/openai/gpt-oss-120b'],'cerebras':['cerebras/gpt-oss-120b'],'alicode':['alicode/qwen3.5-plus','alicode/qwen3-coder-plus'],'openai':['openai/gpt-4o','openai/gpt-4.1'],'anthropic':['anthropic/claude-sonnet-4','anthropic/claude-haiku-3.5'],'gemini':['gemini/gemini-2.5-flash','gemini/gemini-2.5-pro']};
console.log('[sync-combo] 9Router sync loop started...');
const sync = async () => {
  try {
    let db = {};
    try { db = JSON.parse(fs.readFileSync(p, 'utf8')); } catch(e){}
    if (!db.combos) db.combos = [];
    const removeSmartRoute = () => {
      const next = db.combos.filter(x => x.id !== 'smart-route');
      if (next.length !== db.combos.length) {
        db.combos = next;
        fs.writeFileSync(p, JSON.stringify(db, null, 2));
        console.log('[sync-combo] Removed smart-route (no active providers)');
      }
    };
    const res = await fetch('http://localhost:20128/api/providers');
    if (!res.ok) { console.log('[sync-combo] API not ready, retrying...'); return; }
    const d = await res.json();
    const a = (d.connections || []).filter(c => c && c.provider && c.isActive !== false && !c.disabled).map(c => c.provider);
    if (!a.length) { removeSmartRoute(); return; }
    const PREF = ['openai','anthropic','claude-code','codex','cursor','github','cline','kimi','minimax','deepseek','glm','alicode','xai','mistral','kilo','kiro','iflow','qwen','gemini-cli','ollama'];
    a.sort((x, y) => (PREF.indexOf(x) === -1 ? 99 : PREF.indexOf(x)) - (PREF.indexOf(y) === -1 ? 99 : PREF.indexOf(y)));
    const m = a.flatMap(pv => PM[pv] || []);
    if (!m.length) { removeSmartRoute(); return; }
    const c = { id: 'smart-route', name: 'smart-route', alias: 'smart-route', models: m };
    const i = db.combos.findIndex(x => x.id === 'smart-route');
    if (i >= 0) {
      if (JSON.stringify(db.combos[i].models) !== JSON.stringify(c.models)) {
        db.combos[i] = c;
        fs.writeFileSync(p, JSON.stringify(db, null, 2));
        console.log('[sync-combo] Updated smart-route: ' + c.models.length + ' models');
      }
    } else {
      db.combos.push(c);
      fs.writeFileSync(p, JSON.stringify(db, null, 2));
      console.log('[sync-combo] Created smart-route: ' + c.models.length + ' models');
    }
  } catch (e) {}
};
setTimeout(sync, 5000);
setInterval(sync, INTERVAL);`;
  }

  function build9RouterComposeEntrypointScript(syncScriptBase64) {
    return [
      'npm install -g 9router',
      `node -e "require('fs').writeFileSync('/tmp/sync.js',Buffer.from('${syncScriptBase64}','base64').toString())"`,
      'node /tmp/sync.js > /tmp/sync.log 2>&1 &',
      'exec 9router -n -l -H 0.0.0.0 -p 20128 --skip-update'
    ].join('\n');
  }

  function buildGatewayPatchCmd() {
    return `node -e \\"const fs=require('fs'),os=require('os'),p='/root/.openclaw/openclaw.json';if(fs.existsSync(p)){const c=JSON.parse(fs.readFileSync(p,'utf8'));const a=new Set(['http://localhost:18791','http://127.0.0.1:18791','http://0.0.0.0:18791']);for(const entries of Object.values(os.networkInterfaces()||{})){for(const entry of entries||[]){if(!entry||entry.internal||entry.family!=='IPv4'||!entry.address)continue;a.add('http://' + entry.address + ':18791');}}c.tools=Object.assign({},c.tools,{profile:'full',exec:{host:'gateway',security:'full',ask:'off'}});c.gateway=Object.assign({},c.gateway,{port:18791,bind:'custom',customBindHost:'0.0.0.0',controlUi:Object.assign({},c.gateway?.controlUi,{allowedOrigins:Array.from(a).filter(Boolean)})});fs.writeFileSync(p,JSON.stringify(c,null,2));}\\"`;
  }

  function buildDockerArtifacts(options) {
    const {
      openClawNpmSpec,
      openClawRuntimePackages,
      is9Router,
      isLocal,
      isMultiBot,
      hasBrowser,
      selectedModel,
      agentId,
      allSkills = [],
      dockerfileSkillInstallMode = 'none',
      runtimeCommandParts = [],
      volumeMount = '../../.openclaw:/root/.openclaw',
      singleComposeName = 'oc-bot',
      multiComposeName = 'oc-multibot',
      singleAppContainerName = 'openclaw-bot',
      multiAppContainerName = 'openclaw-multibot',
      singleRouterContainerName = '9router',
      multiRouterContainerName = '9router-multibot',
      singleOllamaContainerName = 'ollama',
      multiOllamaContainerName = 'ollama-multibot',
      plainSingleExtraHosts = false,
      multiOllamaNumParallel = 1,
      singleOllamaNumParallel = 1,
      emitBrowserInstall = true,
    } = options;

    const browserAptExtra = hasBrowser ? ' xvfb' : '';
    const browserInstallLines = hasBrowser && emitBrowserInstall
      ? [
          '',
          '# Browser Automation: Playwright engine (needed for native CDP)',
          'RUN npm install -g agent-browser playwright \\',
          '    && npx playwright install chromium --with-deps \\',
          '    && ln -f -s /root/.cache/ms-playwright/chromium-*/chrome-linux*/chrome /usr/bin/google-chrome',
          '',
          ''
        ].join('\n')
      : '';
    const skillLines = dockerfileSkillInstallMode === 'build' && allSkills.length > 0
      ? `\n# Install skills (ClawHub)\n${allSkills.map((skill) => `RUN openclaw skills install ${skill} || echo "Warning: Failed to install ${skill} due to rate limits."`).join('\n')}\n`
      : '';
    const patchLine = `RUN node -e "const fs=require('fs');const path=require('path');const dir='/usr/local/lib/node_modules/openclaw/dist';const from='\\t\\t\\t\\t\\tonAgentRunStart: (runId) => {';const to='\\t\\t\\t\\t\\ttimeoutOverrideSeconds: Math.max(1, Math.ceil(timeoutMs / 1e3)),\\n\\t\\t\\t\\t\\tonAgentRunStart: (runId) => {';const files=fs.readdirSync(dir).filter(n=>/\\.js$/.test(n));let patched=0;for(const file of files){const p=path.join(dir,file);let s='';try{s=fs.readFileSync(p,'utf8');}catch{continue;}if(s.includes(to)||!s.includes(from))continue;s=s.replace(from,to);fs.writeFileSync(p,s);patched++;}if(!patched){process.exit(0);}"`;
    
    // Dynamic runtime configuration injection for container internal IPs
    const setupInternalIpScript = `const fs=require('fs'),os=require('os'),p='/root/.openclaw/openclaw.json';if(fs.existsSync(p)){const c=JSON.parse(fs.readFileSync(p,'utf8'));const a=new Set(['http://localhost:18791','http://127.0.0.1:18791','http://0.0.0.0:18791']);for(const entries of Object.values(os.networkInterfaces()||{})){for(const entry of entries||[]){if(!entry||entry.internal||entry.family!=='IPv4'||!entry.address)continue;a.add('http://' + entry.address + ':18791');}}c.tools=Object.assign({},c.tools,{profile:'full',exec:{host:'gateway',security:'full',ask:'off'}});c.gateway=Object.assign({},c.gateway,{port:18791,bind:'custom',customBindHost:'0.0.0.0',controlUi:Object.assign({},c.gateway?.controlUi,{allowedOrigins:Array.from(a).filter(Boolean)})});fs.writeFileSync(p,JSON.stringify(c,null,2));}`;
    const setupInternalIpB64 = encodeBase64Utf8(setupInternalIpScript);

    const runtimeParts = runtimeCommandParts.filter(Boolean);
    runtimeParts.unshift(`node -e "eval(Buffer.from('${setupInternalIpB64}','base64').toString())" &&`);
    if (hasBrowser) {
      runtimeParts.push('(Xvfb :99 -screen 0 1280x720x24 > /dev/null 2>&1 &) && export DISPLAY=:99 && openclaw gateway run');
    } else {
      runtimeParts.push('openclaw gateway run');
    }
    const dockerfile = `FROM node:22-slim

RUN apt-get update && apt-get install -y git curl${browserAptExtra} && rm -rf /var/lib/apt/lists/*
${browserInstallLines}
ARG OPENCLAW_VER="${openClawNpmSpec}"
RUN npm install -g ${openClawNpmSpec} ${openClawRuntimePackages}${skillLines}
${patchLine}
WORKDIR /root/.openclaw

EXPOSE 18791

CMD sh -c "${runtimeParts.join(' ')}"`;

    const syncScript = build9RouterSmartRouteSyncScript('/root/.9router/db.json');
    const syncScriptBase64 = encodeBase64Utf8(syncScript);
    const docker9RouterEntrypointScript = build9RouterComposeEntrypointScript(syncScriptBase64);
    const extraHostsBlock = `    extra_hosts:\n      - "host.docker.internal:host-gateway"`;

    let compose;
    if (isMultiBot) {
      const dependsOn = is9Router
        ? '    depends_on:\n      - 9router\n'
        : isLocal
          ? '    depends_on:\n      ollama:\n        condition: service_healthy\n'
          : '';
      const extraHosts = hasBrowser ? `${extraHostsBlock}\n` : '';
      if (is9Router) {
        compose = `name: ${multiComposeName}
services:
  ai-bot:
    build: .
    container_name: ${multiAppContainerName}
    restart: always
    env_file:
      - .env
${dependsOn}${extraHosts}    volumes:
      - ${volumeMount}
    ports:
      - "18791:18791"

  9router:
    image: node:22-slim
    container_name: ${multiRouterContainerName}
    restart: always
    entrypoint:
      - /bin/sh
      - -c
      - |
${indentBlock(docker9RouterEntrypointScript, 8)}
    environment:
      - PORT=20128
      - HOSTNAME=0.0.0.0
      - CI=true
    volumes:
      - 9router-data:/root/.9router
    ports:
      - "20128:20128"

volumes:
  9router-data:`;
      } else if (isLocal) {
        const ollamaModelTag = String(selectedModel || 'ollama/gemma4:e2b').replace('ollama/', '');
        compose = `name: ${multiComposeName}
services:
  ai-bot:
    build: .
    container_name: ${multiAppContainerName}
    restart: always
    env_file:
      - .env
${dependsOn}${extraHosts}    volumes:
      - ${volumeMount}
    ports:
      - "18791:18791"

  ollama:
    image: ollama/ollama:latest
    container_name: ${multiOllamaContainerName}
    restart: always
    environment:
      - OLLAMA_KEEP_ALIVE=24h
      - OLLAMA_NUM_PARALLEL=${multiOllamaNumParallel}
    volumes:
      - ollama-data:/root/.ollama
    entrypoint:
      - /bin/sh
      - -c
      - |
        ollama serve &
        until ollama list > /dev/null 2>&1; do sleep 1; done
        ollama pull ${ollamaModelTag}
        wait
    healthcheck:
      test: ["CMD-SHELL", "ollama list > /dev/null 2>&1"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

volumes:
  ollama-data:`;
      } else {
        compose = `name: ${multiComposeName}
services:
  ai-bot:
    build: .
    container_name: ${multiAppContainerName}
    restart: always
    env_file:
      - .env
${extraHosts}    volumes:
      - ${volumeMount}
    ports:
      - "18791:18791"`;
      }
    } else if (is9Router) {
      compose = `name: ${singleComposeName}
services:
  ai-bot:
    build: .
    container_name: ${singleAppContainerName}
    restart: always
    env_file:
      - .env
    depends_on:
      - 9router
${hasBrowser ? `${extraHostsBlock}\n` : ''}    volumes:
      - ${volumeMount}
    ports:
      - "18791:18791"

  9router:
    image: node:22-slim
    container_name: ${singleRouterContainerName}
    restart: always
    entrypoint:
      - /bin/sh
      - -c
      - |
${indentBlock(docker9RouterEntrypointScript, 8)}
    environment:
      - PORT=20128
      - HOSTNAME=0.0.0.0
      - CI=true
    volumes:
      - 9router-data:/root/.9router
    ports:
      - "20128:20128"

volumes:
  9router-data:`;
    } else if (isLocal) {
      const ollamaModelTag = String(selectedModel || 'ollama/gemma4:e2b').replace('ollama/', '');
      compose = `name: ${singleComposeName}
services:
  ai-bot:
    build: .
    container_name: ${singleAppContainerName}
    restart: always
    env_file: .env
    depends_on:
      ollama:
        condition: service_healthy
${hasBrowser ? `${extraHostsBlock}\n` : ''}    ports:
      - "18791:18791"
    volumes:
      - ${volumeMount}

  ollama:
    image: ollama/ollama:latest
    container_name: ${singleOllamaContainerName}
    restart: always
    environment:
      - OLLAMA_KEEP_ALIVE=24h
      - OLLAMA_NUM_PARALLEL=${singleOllamaNumParallel}
    volumes:
      - ollama-data:/root/.ollama
    entrypoint:
      - /bin/sh
      - -c
      - |
        ollama serve &
        until ollama list > /dev/null 2>&1; do sleep 1; done
        ollama pull ${ollamaModelTag}
        wait
    healthcheck:
      test: ["CMD-SHELL", "ollama list > /dev/null 2>&1"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

volumes:
  ollama-data:`;
    } else {
      compose = `name: ${singleComposeName}
services:
  ai-bot:
    build: .
    container_name: ${singleAppContainerName}
    restart: always
    env_file:
      - .env
${plainSingleExtraHosts ? `${extraHostsBlock}\n` : ''}    volumes:
      - ${volumeMount}
    ports:
      - "18791:18791"`;
    }

    return {
      dockerfile,
      compose,
      syncScript,
      docker9RouterEntrypointScript,
      gatewayPatchCmd: buildGatewayPatchCmd(),
    };
  }

  root.__openclawDockerGen = {
    encodeBase64Utf8,
    indentBlock,
    build9RouterSmartRouteSyncScript,
    build9RouterComposeEntrypointScript,
    buildGatewayPatchCmd,
    buildDockerArtifacts,
  };

})(typeof globalThis !== 'undefined' ? globalThis : {});
if (typeof exports !== 'undefined' && typeof globalThis !== 'undefined' && globalThis.__openclawDockerGen) {
  Object.assign(exports, globalThis.__openclawDockerGen);
}
