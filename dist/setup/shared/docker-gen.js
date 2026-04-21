// @ts-nocheck
(function (root) {
  const common = (typeof globalThis !== 'undefined' && globalThis.__openclawCommon) || {};
  const SUPPORTED_CODEX_MODELS = common.SUPPORTED_CODEX_MODELS || ['cx/gpt-5.4', 'cx/gpt-5.3-codex', 'cx/gpt-5.2', 'cx/gpt-5.4-mini'];
  const SMART_ROUTE_PROVIDER_MODELS = common.SMART_ROUTE_PROVIDER_MODELS || { codex: SUPPORTED_CODEX_MODELS };
  const SMART_ROUTE_PROVIDER_ORDER = common.SMART_ROUTE_PROVIDER_ORDER || ['codex'];

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
const PM=${JSON.stringify(SMART_ROUTE_PROVIDER_MODELS)};
const PREF=${JSON.stringify(SMART_ROUTE_PROVIDER_ORDER)};
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
    const rawConnections = Array.isArray(d.connections) ? d.connections : Array.isArray(d.providerConnections) ? d.providerConnections : [];
    const a = [...new Set(rawConnections.filter(c => c && c.provider && c.isActive !== false && !c.disabled).map(c => c.provider))];
    if (!a.length) { removeSmartRoute(); return; }
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

function build9RouterPatchScript() {
    return `const fs=require('fs');const path=require('path');const cp=require('child_process');
const MODELS=${JSON.stringify(SUPPORTED_CODEX_MODELS.map((model) => model.replace('cx/', '')))};
const MODEL_NAMES={"gpt-5.4":"GPT 5.4","gpt-5.4-mini":"GPT 5.4 Mini","gpt-5.3-codex":"GPT 5.3 Codex","gpt-5.2":"GPT 5.2"};
const SELF_TEST_BLOCK=[
'codex: {',
'    url: "https://chatgpt.com/backend-api/codex/responses",',
'    method: "POST",',
'    authHeader: "Authorization",',
'    authPrefix: "Bearer ",',
'    extraHeaders: { "Content-Type": "application/json", "originator": "codex-cli", "User-Agent": "codex-cli/1.0.18 (macOS; arm64)" },',
'    body: JSON.stringify({',
'      model: "gpt-5.2",',
'      instructions: "You are a coding assistant.",',
'      input: [{ role: "user", content: [{ type: "input_text", text: "Reply with exactly: ok" }] }],',
'      stream: true,',
'      store: false,',
'    }),',
'    acceptStatuses: [200, 400],',
'    refreshable: true,',
'  },'
].join('\\n');
const roots=new Set();
function add(p){if(p)roots.add(p);}
try{const npmRoot=cp.execSync('npm root -g',{stdio:['ignore','pipe','ignore'],encoding:'utf8'}).trim();if(npmRoot)add(path.join(npmRoot,'9router'));}catch{}
add(path.join(process.env.APPDATA||'','npm','node_modules','9router'));
add('/usr/local/lib/node_modules/9router');
add('/usr/lib/node_modules/9router');
add(path.join(process.cwd(),'node_modules','9router'));
function patchFile(filePath, transform){if(!fs.existsSync(filePath))return false;const before=fs.readFileSync(filePath,'utf8');const after=transform(before);if(!after||after===before)return false;fs.writeFileSync(filePath,after);return true;}
function patchText(text,replacers){let next=text;for(const replacer of replacers){next=replacer(next);}return next===text?null:next;}
function patchProviderModels(root){return patchFile(path.join(root,'open-sse','config','providerModels.js'),(text)=>text.replace(/cx:\\s*\\[[\\s\\S]*?\\],/,()=>{const lines=MODELS.map((id)=>'    { id: "'+id+'", name: "'+(MODEL_NAMES[id]||id)+'" },');return 'cx: [  // OpenAI Codex\\n'+lines.join('\\n')+'\\n  ],';}));}
function patchCodexLikeFile(filePath){return patchFile(filePath,(text)=>{if(text.includes('max_output_tokens'))return text;return patchText(text,[
  (value)=>value.replace(/delete (\\w+)\\.max_tokens,delete \\1\\.user/g,'delete $1.max_tokens,delete $1.max_output_tokens,delete $1.user'),
  (value)=>value.replace(/delete (\\w+)\\.max_tokens;(\\s*)delete \\1\\.user/g,'delete $1.max_tokens;$2delete $1.max_output_tokens;$2delete $1.user'),
  (value)=>value.replace('    delete body.max_tokens;\\n','    delete body.max_tokens;\\n    delete body.max_output_tokens;\\n')
]);});}
function patchCodexExecutor(root){let touched=0;touched+=patchCodexLikeFile(path.join(root,'open-sse','executors','codex.js'))?1:0;const chunksDir=path.join(root,'app','.next','server','chunks');if(fs.existsSync(chunksDir)){for(const entry of fs.readdirSync(chunksDir)){if(!entry.endsWith('.js'))continue;touched+=patchCodexLikeFile(path.join(chunksDir,entry))?1:0;}}return touched;}
function patchResponsesNullGuard(root){let touched=0;const chunksDir=path.join(root,'app','.next','server','chunks');if(!fs.existsSync(chunksDir))return touched;for(const entry of fs.readdirSync(chunksDir)){if(!entry.endsWith('.js'))continue;touched+=patchFile(path.join(chunksDir,entry),(text)=>patchText(text,[
  (value)=>value.replace('let b=a.content.find(a=>"output_text"===a.type);','let b=a.content.find(a=>a&&"output_text"===a.type);'),
  (value)=>value.replace('let c=a.content.find(a=>"string"==typeof a.text);','let c=a.content.find(a=>a&&"string"==typeof a.text);'),
  (value)=>value.replace('let b=a.filter(a=>a?.type==="message");','let b=a.filter(a=>a&&a?.type==="message");'),
  (value)=>value.replace('for(let a of j){let b=a.type||(a.role?"message":null);','for(let a of j){let b=a&&(a.type||(a.role?"message":null));'),
  (value)=>value.replace('for(let a of b.messages||[]){if("system"===a.role){','for(let a of b.messages||[])if(a){if("system"===a.role){'),
  (value)=>value.replace('let b=Array.isArray(a.content)?a.content.map(a=>"input_text"===a.type||"output_text"===a.type?{type:"text",text:a.text}:"input_image"===a.type?{type:"image_url",image_url:{url:a.image_url||a.file_id||"",detail:a.detail||"auto"}}:a):a.content;','let b=Array.isArray(a.content)?a.content.map(a=>a&&("input_text"===a.type||"output_text"===a.type)?{type:"text",text:a.text}:a&&"input_image"===a.type?{type:"image_url",image_url:{url:a.image_url||a.file_id||"",detail:a.detail||"auto"}}:a).filter(Boolean):a.content;'),
  (value)=>value.replace('c="string"==typeof a.content?[{type:b,text:a.content}]:Array.isArray(a.content)?a.content.map(a=>{if("text"===a.type)return{type:b,text:a.text};if("image_url"===a.type)return{type:"input_image",image_url:"string"==typeof a.image_url?a.image_url:a.image_url?.url,detail:a.image_url?.detail||"auto"};if("input_image"===a.type)return a;let c=a.text||a.content||JSON.stringify(a);return{type:b,text:"string"==typeof c?c:JSON.stringify(c)}}):[];','c="string"==typeof a.content?[{type:b,text:a.content}]:Array.isArray(a.content)?a.content.map(a=>{if(!a)return null;if("text"===a.type)return{type:b,text:a.text};if("image_url"===a.type)return{type:"input_image",image_url:"string"==typeof a.image_url?a.image_url:a.image_url?.url,detail:a.image_url?.detail||"auto"};if("input_image"===a.type)return a;let c=a.text||a.content||JSON.stringify(a);return{type:b,text:"string"==typeof c?c:JSON.stringify(c)}}).filter(Boolean):[];'),
  (value)=>value.replace('b.tools&&Array.isArray(b.tools)&&(e.tools=b.tools.map(a=>{if(a.function)return a;let b=a.name;return b&&"string"==typeof b&&""!==b.trim()?{type:"function",function:{name:b,description:String(a.description||""),parameters:i(a.parameters),strict:a.strict}}:null}).filter(Boolean))','b.tools&&Array.isArray(b.tools)&&(e.tools=b.tools.map(a=>{if(!a)return null;if(a.function)return a;let b=a.name;return b&&"string"==typeof b&&""!==b.trim()?{type:"function",function:{name:b,description:String(a.description||""),parameters:i(a.parameters),strict:a.strict}}:null}).filter(Boolean))'),
  (value)=>value.replace('b.tools&&Array.isArray(b.tools)&&(e.tools=b.tools.map(a=>"function"===a.type?{type:"function",name:a.function.name,description:String(a.function.description||""),parameters:i(a.function.parameters),strict:a.function.strict}:a)),','b.tools&&Array.isArray(b.tools)&&(e.tools=b.tools.map(a=>a&&"function"===a.type?{type:"function",name:a.function.name,description:String(a.function.description||""),parameters:i(a.function.parameters),strict:a.function.strict}:a).filter(Boolean)),'),
  (value)=>value.replace('filter(a=>"function_call"===a.type)','filter(a=>a&&"function_call"===a.type)'),
  (value)=>value.replace(/filter\\(a=>"text"===a\\.type\\)/g,'filter(a=>a&&"text"===a.type)'),
  (value)=>value.replace(/find\\(a=>"message_stop"===a\\.type\\)/g,'find(a=>a&&"message_stop"===a.type)'),
  (value)=>value.replace(/find\\(a=>"content_block_delta"===a\\.type\\)/g,'find(a=>a&&"content_block_delta"===a.type)'),
  (value)=>value.replace(/find\\(a=>"message_delta"===a\\.type\\)/g,'find(a=>a&&"message_delta"===a.type)'),
  (value)=>value.replace(/find\\(a=>"message_start"===a\\.type\\)/g,'find(a=>a&&"message_start"===a.type)'),
  (value)=>value.replace(/for\\(let e of a\\.content\\)(?!if\\(e\\))/g,'for(let e of a.content)if(e)')
] ))?1:0;}return touched;}
function patchSelfTest(root){return patchFile(path.join(root,'src','app','api','providers','[id]','test','testUtils.js'),(text)=>{if(text.includes('model: "gpt-5.2"')&&text.includes('store: false')&&text.includes('acceptStatuses: [200, 400]'))return text;return text.replace(/codex:\\s*\\{[\\s\\S]*?refreshable:\\s*true,\\s*\\},/,SELF_TEST_BLOCK);});}
let touched=0;
for(const root of roots){if(!root||!fs.existsSync(root))continue;touched+=patchProviderModels(root)?1:0;touched+=patchCodexExecutor(root)?1:0;touched+=patchResponsesNullGuard(root)?1:0;touched+=patchSelfTest(root)?1:0;}
if(touched){console.log('[patch-9router] Applied Codex compatibility patch.');}else{console.log('[patch-9router] No compatible 9router source files found to patch.');}`;
  }

  function build9RouterComposeEntrypointScript(syncScriptBase64, patchScriptBase64) {
      const nineRouterSpec = (typeof globalThis !== 'undefined' && globalThis.__openclawCommon && globalThis.__openclawCommon.NINE_ROUTER_NPM_SPEC) || '9router@latest';
      return [
      `npm install -g ${nineRouterSpec}`,
      `node -e "require('fs').writeFileSync('/tmp/patch-9router.js',Buffer.from('${patchScriptBase64}','base64').toString())"`,
      `node -e "require('fs').writeFileSync('/tmp/sync.js',Buffer.from('${syncScriptBase64}','base64').toString())"`,
      'node /tmp/patch-9router.js || true',
      'node /tmp/sync.js > /tmp/sync.log 2>&1 &',
      'exec 9router -n -l -H 0.0.0.0 -p 20128 --skip-update'
    ].join('\n');
  }

  function buildGatewayPatchCmd() {
    return `node -e \\"const fs=require('fs'),os=require('os'),path=require('path'),p=path.join(process.cwd(),'.openclaw','openclaw.json');if(fs.existsSync(p)){const c=JSON.parse(fs.readFileSync(p,'utf8'));const a=new Set(['http://localhost:18791','http://127.0.0.1:18791','http://0.0.0.0:18791']);for(const entries of Object.values(os.networkInterfaces()||{})){for(const entry of entries||[]){if(!entry||entry.internal||entry.family!=='IPv4'||!entry.address)continue;a.add('http://' + entry.address + ':18791');}}c.tools=Object.assign({},c.tools,{profile:'full',exec:{host:'gateway',security:'full',ask:'off'}});c.gateway=Object.assign({},c.gateway,{port:18791,bind:'custom',customBindHost:'0.0.0.0',controlUi:Object.assign({},c.gateway?.controlUi,{allowedOrigins:Array.from(a).filter(Boolean)})});fs.writeFileSync(p,JSON.stringify(c,null,2));}\\"`;
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
      volumeMount = '../..:/root/project',
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

    const browserAptExtra = hasBrowser ? ' xvfb socat' : '';
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
    const setupInternalIpScript = `const fs=require('fs'),os=require('os'),path=require('path'),p=path.join(process.cwd(),'.openclaw','openclaw.json');if(fs.existsSync(p)){const c=JSON.parse(fs.readFileSync(p,'utf8'));const a=new Set(['http://localhost:18791','http://127.0.0.1:18791','http://0.0.0.0:18791']);for(const entries of Object.values(os.networkInterfaces()||{})){for(const entry of entries||[]){if(!entry||entry.internal||entry.family!=='IPv4'||!entry.address)continue;a.add('http://' + entry.address + ':18791');}}c.tools=Object.assign({},c.tools,{profile:'full',exec:{host:'gateway',security:'full',ask:'off'}});c.gateway=Object.assign({},c.gateway,{port:18791,bind:'custom',customBindHost:'0.0.0.0',controlUi:Object.assign({},c.gateway?.controlUi,{allowedOrigins:Array.from(a).filter(Boolean)})});fs.writeFileSync(p,JSON.stringify(c,null,2));}`;
    const setupInternalIpB64 = encodeBase64Utf8(setupInternalIpScript);

    const runtimeParts = runtimeCommandParts.filter(Boolean);
    runtimeParts.unshift('export OPENCLAW_HOME="$PWD/.openclaw"');
    runtimeParts.unshift('export OPENCLAW_STATE_DIR="$PWD/.openclaw"');
    runtimeParts.unshift(`node -e 'eval(Buffer.from("${setupInternalIpB64}","base64").toString())'`);
    if (hasBrowser) {
      runtimeParts.push('socat TCP-LISTEN:9222,fork,reuseaddr TCP:host.docker.internal:9222 &');
      runtimeParts.push('Xvfb :99 -screen 0 1280x720x24 > /dev/null 2>&1 & DISPLAY=:99 openclaw gateway run');
    } else {
      runtimeParts.push('openclaw gateway run');
    }
    const runtimeScript = ['#!/bin/sh', 'set -e', ...runtimeParts].join('\n');
    const runtimeScriptB64 = encodeBase64Utf8(runtimeScript);
    const dockerfile = `FROM node:22-slim

RUN apt-get update && apt-get install -y git curl${browserAptExtra} && rm -rf /var/lib/apt/lists/*
${browserInstallLines}
ARG OPENCLAW_VER="${openClawNpmSpec}"
ARG CACHE_BUST=""
RUN npm install -g ${openClawNpmSpec} ${openClawRuntimePackages}${skillLines}
${patchLine}
RUN node -e "require('fs').writeFileSync('/usr/local/bin/openclaw-entrypoint.sh', Buffer.from('${runtimeScriptB64}','base64').toString())" && chmod +x /usr/local/bin/openclaw-entrypoint.sh
WORKDIR /root/project

EXPOSE 18791

CMD ["/bin/sh", "/usr/local/bin/openclaw-entrypoint.sh"]`;

    const syncScript = build9RouterSmartRouteSyncScript('/root/.9router/db.json');
    const syncScriptBase64 = encodeBase64Utf8(syncScript);
    const patchScript = build9RouterPatchScript();
    const patchScriptBase64 = encodeBase64Utf8(patchScript);
    const docker9RouterEntrypointScript = build9RouterComposeEntrypointScript(syncScriptBase64, patchScriptBase64);
    const extraHostsBlock = `    extra_hosts:\n      - "host.docker.internal:host-gateway"`;

    const appEnvironmentBlock = '    environment:\n      - OPENCLAW_HOME=/root/project/.openclaw\n      - OPENCLAW_STATE_DIR=/root/project/.openclaw\n';

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
${appEnvironmentBlock}${dependsOn}${extraHosts}    volumes:
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
${appEnvironmentBlock}${dependsOn}${extraHosts}    volumes:
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
${appEnvironmentBlock}${extraHosts}    volumes:
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
${appEnvironmentBlock}${hasBrowser ? `${extraHostsBlock}\n` : ''}    volumes:
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
${appEnvironmentBlock}    depends_on:
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
${appEnvironmentBlock}${plainSingleExtraHosts ? `${extraHostsBlock}\n` : ''}    volumes:
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
    build9RouterPatchScript,
    build9RouterComposeEntrypointScript,
    buildGatewayPatchCmd,
    buildDockerArtifacts,
  };

})(typeof globalThis !== 'undefined' ? globalThis : {});
if (typeof exports !== 'undefined' && typeof globalThis !== 'undefined' && globalThis.__openclawDockerGen) {
  Object.assign(exports, globalThis.__openclawDockerGen);
}
