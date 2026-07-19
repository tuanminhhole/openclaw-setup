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

  function build9RouterSmartRouteSyncScript() {
    // First-install auto-sync: đăng nhập 9router bằng MẬT KHẨU MẶC ĐỊNH 123456 (9router cấp),
    // gom model của các provider đang active → tạo combo 'smart-route' MỘT LẦN rồi DỪNG.
    // KHÔNG tự tắt Require login nữa (require login giữ ON, pass mặc định 123456, user đổi sau).
    const lines = [
      "const fs = require('fs');",
      "const INTERVAL = 30000;",
      "const MAX_ATTEMPTS = 20; // ~10 phút; tạo combo lần đầu rồi dừng, không lặp vĩnh viễn",
      "const DEFAULT_PASSWORD = '123456'; // mật khẩu mặc định 9router",
      // Docker mounts the DB at /root/.9router; native installs pass NINEROUTER_DB_PATH so the
      // same sync script works on the host without hardcoding the container path.
      "const DB_PATH = process.env.NINEROUTER_DB_PATH || '/root/.9router/db/data.sqlite';",
      "const PORT = process.env.PORT || 20128;",
      "const COMBO_NAME = 'smart-route';",
      "const API_BASE = `http://localhost:${PORT}`;",
      "",
      "// Đăng nhập bằng mật khẩu mặc định → lấy cookie auth_token để gọi API quản trị.",
      "async function login() {",
      "  try {",
      "    const r = await fetch(`${API_BASE}/api/auth/login`, {",
      "      method: 'POST',",
      "      headers: { 'Content-Type': 'application/json' },",
      "      body: JSON.stringify({ password: DEFAULT_PASSWORD })",
      "    });",
      "    if (!r.ok) return '';",
      "    const sc = r.headers.get('set-cookie') || '';",
      "    const m = sc.match(/auth_token=[^;]+/);",
      "    return m ? m[0] : '';",
      "  } catch (e) { return ''; }",
      "}",
      "",
      "async function trySync() {",
      "  if (!fs.existsSync(DB_PATH)) return false;",
      "  const cookie = await login(); // mk mặc định 123456; nếu user đã đổi thì login fail",
      "  const authHeaders = cookie ? { Cookie: cookie } : {};",
      "",
      "  // Combo đã tồn tại? → coi như xong (chỉ tạo lần đầu).",
      "  try {",
      "    const r = await fetch(`${API_BASE}/api/combos`, { headers: authHeaders });",
      "    if (r.status === 401) return false;",
      "    const d = await r.json();",
      "    if ((d.combos || []).some(c => c.name === COMBO_NAME)) return true;",
      "  } catch (e) { return false; }",
      "",
      "  // Provider đang active.",
      "  let activeProviders = [];",
      "  try {",
      "    const r = await fetch(`${API_BASE}/api/providers`, { headers: authHeaders });",
      "    const d = await r.json();",
      "    const conns = d.connections || d.providerConnections || [];",
      "    activeProviders = [...new Set(",
      "      conns.filter(c => c && c.provider && c.isActive !== false && !c.disabled).map(c => c.provider)",
      "    )];",
      "  } catch (e) { return false; }",
      "  if (!activeProviders.length) return false;",
      "",
      "  // Model của provider active (bỏ embedding/image/tts/…).",
      "  let models = [];",
      "  try {",
      "    const r = await fetch(`${API_BASE}/api/models`, { headers: authHeaders });",
      "    const d = await r.json();",
      "    if (Array.isArray(d.models)) {",
      "      models = [...new Set(d.models",
      "        .filter(m => activeProviders.includes(m.provider))",
      "        .filter(m => !/(embedding|image|tts|stt|audio|vision)/i.test(m.model))",
      "        .map(m => m.fullModel))];",
      "    }",
      "  } catch (e) { return false; }",
      "  if (!models.length) return false;",
      "",
      "  // Tạo combo smart-route (lần đầu).",
      "  try {",
      "    await fetch(`${API_BASE}/api/combos`, {",
      "      method: 'POST',",
      "      headers: { 'Content-Type': 'application/json', ...authHeaders },",
      "      body: JSON.stringify({ name: COMBO_NAME, models })",
      "    });",
      "    console.log('[sync-combo] Created smart-route with ' + models.length + ' models');",
      "    return true;",
      "  } catch (e) { return false; }",
      "}",
      "",
      "let attempts = 0;",
      "let timer = null;",
      "async function tick() {",
      "  attempts++;",
      "  let done = false;",
      "  try { done = await trySync(); } catch (e) {}",
      "  if (done || attempts >= MAX_ATTEMPTS) {",
      "    if (timer) clearInterval(timer);",
      "    console.log('[sync-combo] finished (attempts=' + attempts + ', done=' + done + ')');",
      "  }",
      "}",
      "timer = setInterval(tick, INTERVAL);",
      "setTimeout(tick, 10000);",
    ];
    return lines.join('\n');
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

  function build9RouterComposeEntrypointScript(routerPort) {
      const port = routerPort || 20128;
      const nineRouterSpec = (typeof globalThis !== 'undefined' && globalThis.__openclawCommon && globalThis.__openclawCommon.NINE_ROUTER_NPM_SPEC) || '9router@latest';
      return [
      `npm install -g ` + nineRouterSpec,
      'node /tmp/patch-9router.js || true',
      'node -e "const fs=require(\'fs\'),path=require(\'path\'); const DB_PATH=\'/root/.9router/db/data.sqlite\'; const dir=path.dirname(DB_PATH); if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true}); try{ const {DatabaseSync}=require(\'node:sqlite\'); const db=new DatabaseSync(DB_PATH); db.prepare(\'CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)\').run(); const existing=db.prepare(\'SELECT * FROM settings WHERE id = 1\').get(); if(!existing){ db.prepare(\'INSERT INTO settings (id, data) VALUES (1, ?)\').run(JSON.stringify({requireLogin:true})); } db.close(); }catch(e){}" || true',
      'node /tmp/sync.js > /tmp/sync.log 2>&1 &',
      `exec 9router -n -l -H 0.0.0.0 -p ${port} --skip-update`
    ].join('\n');
  }

  function buildGatewayPatchCmd() {
    return `node -e \\"const fs=require('fs'),os=require('os'),path=require('path'),p=path.join(process.cwd(),'.openclaw','openclaw.json');if(fs.existsSync(p)){const c=JSON.parse(fs.readFileSync(p,'utf8'));const gp=Number(process.env.OPENCLAW_GATEWAY_PORT||process.env.OPENCLAW_PORT)||c.gateway?.port||18789;const a=new Set(['http://localhost:'+gp,'http://127.0.0.1:'+gp,'http://0.0.0.0:'+gp]);for(const entries of Object.values(os.networkInterfaces()||{})){for(const entry of entries||[]){if(!entry||entry.internal||entry.family!=='IPv4'||!entry.address)continue;a.add('http://' + entry.address + ':'+gp);}}const p9=c.models&&c.models.providers&&c.models.providers['9router'];if(p9){p9.request=Object.assign({},p9.request,{allowPrivateNetwork:true});}c.tools=Object.assign({},c.tools,{profile:'full',exec:{host:'gateway',security:'full',ask:'off'}});c.gateway=Object.assign({},c.gateway,{port:gp,bind:'custom',customBindHost:'0.0.0.0',controlUi:Object.assign({},c.gateway?.controlUi,{allowedOrigins:Array.from(a).filter(Boolean)})});fs.writeFileSync(p,JSON.stringify(c,null,2));}\\"`;
  }

  function buildDockerArtifacts(options) {
    const {
      openClawNpmSpec,
      openClawRuntimePackages = '',
      is9Router,
      isLocal,
      isMultiBot,
      hasBrowser = false,
      selectedModel,
      agentId,
      allSkills = [],
      dockerfilePlugins = [],
      dockerfileSkillInstallMode = 'none',
      runtimeCommandParts = [],
      volumeMount = '../../.openclaw:/home/node/project/.openclaw\n      - ../../:/mnt/project',
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
      gatewayPort = 18789,
      routerPort = 20128,
      osChoice = '',
      // Personal-Zalo backend: empty or the single supported `zalo-connect` channel.
      zaloBackend = '',
    } = options;
    // Windows bind-mounts give ClawHub-installed plugins world-writable perms (which openclaw
    // blocks), so on Windows we isolate extensions in a named volume. On macOS/Linux bind-mounts
    // are fine, so keep extensions under the .openclaw bind mount → plugins stay visible/synced
    // on the host (e.g. you can see zalo-mod in .openclaw/extensions).
    const useExtensionsVolume = osChoice === 'win';
    const extVolMount = useExtensionsVolume ? '\n      - openclaw-extensions:/home/node/project/.openclaw/extensions' : '';
    const extVolDecl = useExtensionsVolume ? '\n  openclaw-extensions:' : '';
    // SQLite state on Docker Desktop (macOS/Windows): the host bind mount goes through a
    // virtualized file share (virtiofs/gRPC-FUSE) whose locking/mmap semantics break SQLite WAL —
    // OpenClaw crashes with `Error: disk I/O error` on write (e.g. when a Zalo message arrives).
    // Keep `.openclaw/state` on a named volume (the Linux VM's native filesystem) instead; the
    // rest of `.openclaw` stays bind-mounted so workspaces/config remain visible on the host.
    // Linux/VPS bind mounts are native ext4 — unchanged there (and state stays host-visible).
    const useStateVolume = osChoice === 'macos' || osChoice === 'win';
    const stateVolMount = useStateVolume ? '\n      - openclaw-state:/home/node/project/.openclaw/state' : '';
    const stateVolDecl = useStateVolume ? '\n  openclaw-state:' : '';
    const stateVolBlock = useStateVolume ? '\n\nvolumes:\n  openclaw-state:' : '';
    const skillLines = dockerfileSkillInstallMode === 'build' && allSkills.length > 0
      ? `\n# Install skills (ClawHub)\n${allSkills.map((skill) => `RUN openclaw skills install ${skill} || echo "Warning: Failed to install ${skill} due to rate limits."`).join('\n')}\n`
      : '';
    const pluginLines = dockerfilePlugins.length > 0
      ? `\n# Install plugins (ClawHub)\n${dockerfilePlugins.map((p) => `RUN openclaw plugins install ${p} || echo "Warning: Failed to install plugin ${p}"`).join('\n')}\n`
      : '';
    const patchLine = `RUN node -e "const fs=require('fs');const path=require('path');const dir='/usr/local/lib/node_modules/openclaw/dist';const from='\\t\\t\\t\\t\\tonAgentRunStart: (runId) => {';const to='\\t\\t\\t\\t\\ttimeoutOverrideSeconds: Math.max(1, Math.ceil(timeoutMs / 1e3)),\\n\\t\\t\\t\\t\\tonAgentRunStart: (runId) => {';const files=fs.readdirSync(dir).filter(n=>/\\.js$/.test(n));let patched=0;for(const file of files){const p=path.join(dir,file);let s='';try{s=fs.readFileSync(p,'utf8');}catch{continue;}if(s.includes(to)||!s.includes(from))continue;s=s.replace(from,to);fs.writeFileSync(p,s);patched++;}if(!patched){process.exit(0);}"`;
    
    // Dynamic runtime configuration: backup config before any first-run install, restore after.
    // Missing plugin install may touch openclaw.json, so preserve critical fields.
    const backupConfigScript = `const fs=require('fs'),path=require('path'),p=path.join(process.cwd(),'.openclaw','openclaw.json'),b=p.replace('openclaw.json','.openclaw-config-backup.json');if(fs.existsSync(p)){fs.copyFileSync(p,b);}`;

    const restoreConfigScript = `const fs=require('fs'),os=require('os'),path=require('path'),p=path.join(process.cwd(),'.openclaw','openclaw.json'),b=p.replace('openclaw.json','.openclaw-config-backup.json');if(fs.existsSync(p)&&fs.existsSync(b)){const c=JSON.parse(fs.readFileSync(p,'utf8'));const bk=JSON.parse(fs.readFileSync(b,'utf8'));const keep=['agents','channels','bindings','commands','models','browser','skills','plugins','tools'];for(const k of keep){if(bk[k]&&!c[k])c[k]=bk[k];}const gp=Number(process.env.OPENCLAW_GATEWAY_PORT||process.env.OPENCLAW_PORT)||c.gateway?.port||bk.gateway?.port||18789;const a=new Set(['http://localhost:'+gp,'http://127.0.0.1:'+gp,'http://0.0.0.0:'+gp]);for(const entries of Object.values(os.networkInterfaces()||{})){for(const entry of entries||[]){if(!entry||entry.internal||entry.family!=='IPv4'||!entry.address)continue;a.add('http://'+entry.address+':'+gp);}}c.tools=Object.assign({},c.tools,{profile:'full',exec:{host:'gateway',security:'full',ask:'off'}});c.gateway=Object.assign({},c.gateway,{port:gp,bind:'custom',customBindHost:'0.0.0.0',mode:c.gateway?.mode||bk.gateway?.mode||'local',controlUi:Object.assign({},c.gateway?.controlUi,{allowedOrigins:Array.from(a).filter(Boolean)})});fs.writeFileSync(p,JSON.stringify(c,null,2));fs.unlinkSync(b);}`;
    const securityCompatScript = `const fs=require('fs'),path=require('path');const scopes=['operator.admin','operator.pairing','operator.approvals'];function uniq(a){return Array.from(new Set([...(Array.isArray(a)?a:[]),...scopes]));}function walk(v){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(walk);return;}if(Array.isArray(v.scopes)||Array.isArray(v.approvedScopes)){v.scopes=uniq(v.scopes);v.approvedScopes=uniq(v.approvedScopes);}Object.values(v).forEach(walk);}const home=process.env.OPENCLAW_HOME||path.join(process.cwd(),'.openclaw');const state=process.env.OPENCLAW_STATE_DIR||home;const cfgPath=path.join(process.cwd(),'.openclaw','openclaw.json');if(fs.existsSync(cfgPath)){const c=JSON.parse(fs.readFileSync(cfgPath,'utf8'));const p=c.models&&c.models.providers&&c.models.providers['9router'];if(p){p.request=Object.assign({},p.request,{allowPrivateNetwork:true});}fs.writeFileSync(cfgPath,JSON.stringify(c,null,2));}for(const root of Array.from(new Set([home,state]))){const f=path.join(root,'devices','paired.json');if(fs.existsSync(f)){const d=JSON.parse(fs.readFileSync(f,'utf8'));walk(d);fs.writeFileSync(f,JSON.stringify(d,null,2));}}`;

    const runtimeParts = runtimeCommandParts.filter(Boolean);
    const runtimePrelude = [
      'export OPENCLAW_HOME="${OPENCLAW_HOME:-$PWD/.openclaw}"',
      'export OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-$OPENCLAW_HOME}"',
      'mkdir -p "$OPENCLAW_HOME" "$OPENCLAW_STATE_DIR"',
      'if [ "$OPENCLAW_STATE_DIR" != "$OPENCLAW_HOME" ]; then',
      '  for path in "$OPENCLAW_HOME"/*; do',
      '    [ -e "$path" ] || continue',
      '    name="$(basename "$path")"',
      '    [ "$name" = "plugin-runtime-deps" ] && continue',
      '    [ "$name" = "logs" ] && continue',
      '    [ -e "$OPENCLAW_STATE_DIR/$name" ] || ln -s "$path" "$OPENCLAW_STATE_DIR/$name"',
      '  done',
      'fi',
      'ensure_plugin() {',
      '  id="$1"',
      '  spec="$2"',
      '  if [ -d "$OPENCLAW_HOME/extensions/$id" ]; then',
      '    echo "[entrypoint] plugin $id already installed"',
      '    return 0',
      '  fi',
      '  echo "[entrypoint] plugin $id missing; installing $spec"',
      '  case "$spec" in',
      '    https://*.git#*)',
      '      repo="${spec%%#*}"',
      '      ref="${spec##*#}"',
      '      tmp="/tmp/openclaw-plugin-$id-$ref"',
      '      rm -rf "$tmp"',
      '      if git clone --depth 1 --branch "$ref" "$repo" "$tmp" 2>/dev/null; then',
      '        # Docker Desktop bind mounts can reject chmod on packed .git objects (EACCES).',
      '        # OpenClaw only needs the plugin payload, never the clone metadata.',
      '        rm -rf "$tmp/.git"',
      '        openclaw plugins install "$tmp" 2>/dev/null || echo "[entrypoint] warning: failed to install cloned plugin $id"',
      '      else',
      '        echo "[entrypoint] warning: failed to clone plugin $spec"',
      '      fi',
      '      ;;',
      '    *) openclaw plugins install "$spec" 2>/dev/null || echo "[entrypoint] warning: failed to install plugin $spec" ;;',
      '  esac',
      '}',
      'ensure_skill() {',
      '  id="$1"',
      '  if find "$OPENCLAW_HOME" -maxdepth 4 -type d -path "*/skills/$id" -print -quit 2>/dev/null | grep -q .; then',
      '    echo "[entrypoint] skill $id already installed"',
      '    return 0',
      '  fi',
      '  echo "[entrypoint] skill $id missing; installing"',
      '  openclaw skills install "$id" 2>/dev/null || echo "[entrypoint] warning: failed to install skill $id"',
      '}',
      'echo "[entrypoint] ensuring runtime assets, then starting gateway"',
    ];
    runtimeParts.unshift(...runtimePrelude);
    // Backup config BEFORE plugin installs (runtimeCommandParts may contain plugin install commands)
    runtimeParts.unshift(`node - <<'NODE'\n${backupConfigScript}\nNODE`);
    // Restore config AFTER plugin installs (which may clobber openclaw.json)
    runtimeParts.push(`node - <<'NODE'\n${restoreConfigScript}\nNODE`);
    runtimeParts.push(`node - <<'NODE'\n${securityCompatScript}\nNODE`);
    if (zaloBackend === 'zalo-connect') {
      // Pinned ZaloConnect install (never `latest` — plan §4.1). ensure_plugin skips the
      // install when extensions/zalo-connect already exists, so restarts never re-download
      // and a reconnect never reinstalls. No dist patching, no mentions.js, no watchdog
      // hacks: sticker/mention/reaction are native ZaloConnect actions.
      const zaloConnectSpec = common.ZALO_CONNECT_PLUGIN_SPEC || 'https://github.com/tuanminhhole/openclaw-zalo-connect.git#v3.0.1';
      runtimeParts.push(`ensure_plugin zalo-connect "${zaloConnectSpec}"`);
    }
    runtimeParts.push('openclaw gateway run');
    const runtimeScript = ['#!/bin/sh', 'set -e', ...runtimeParts].join('\n');
    let browserInstall = '';
    if (hasBrowser) {
      browserInstall = '\n# Install browser and system dependencies for Playwright\nRUN npx playwright install-deps chromium && npx playwright install chromium\n';
    }
    const dockerfile = `FROM node:22-slim

RUN apt-get update && apt-get install -y git curl python3 && rm -rf /var/lib/apt/lists/*

ARG OPENCLAW_VER="${openClawNpmSpec}"
ARG CACHE_BUST=""
RUN echo "CACHE_BUST=$CACHE_BUST" && npm install -g $OPENCLAW_VER ${openClawRuntimePackages}${skillLines}${pluginLines}
${patchLine}${browserInstall}

COPY entrypoint.sh /usr/local/bin/openclaw-entrypoint.sh
RUN chmod +x /usr/local/bin/openclaw-entrypoint.sh
WORKDIR /home/node/project

EXPOSE ${gatewayPort}

CMD ["/bin/sh", "/usr/local/bin/openclaw-entrypoint.sh"]`;

    const syncScript = build9RouterSmartRouteSyncScript();
    const patchScript = build9RouterPatchScript();
    const docker9RouterEntrypointScript = build9RouterComposeEntrypointScript(routerPort);
    const extraHostsBlock = `    extra_hosts:\n      - "host.docker.internal:host-gateway"`;

    const appEnvironmentBlock = `    environment:\n      - HOME=/home/node/project/.openclaw\n      - OPENCLAW_HOME=/home/node/project/.openclaw\n      - OPENCLAW_STATE_DIR=/home/node/project/.openclaw\n      - OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1\n      - OPENCLAW_SETUP_OS=${osChoice || ''}\n      - OPENCLAW_BROWSER_HOST_OS=${osChoice || ''}\n      - OPENCLAW_GATEWAY_PORT=${gatewayPort}\n      - OPENCLAW_PORT=${gatewayPort}\n    tmpfs:\n      - /home/node/project/.openclaw/plugin-runtime-deps\n`;

    let compose;
    if (isMultiBot) {
      const dependsOn = is9Router
        ? '    depends_on:\n      - 9router\n'
        : isLocal
          ? '    depends_on:\n      ollama:\n        condition: service_healthy\n'
          : '';
      const extraHosts = `${extraHostsBlock}\n`;
      if (is9Router) {
        compose = `name: ${multiComposeName}
services:
  ai-bot:
    build: .
    container_name: ${multiAppContainerName}
    restart: always
    env_file:
      - ../../.env
${appEnvironmentBlock}${dependsOn}${extraHosts}    volumes:
      - ${volumeMount}${stateVolMount}
    ports:
      - "127.0.0.1:${gatewayPort}:${gatewayPort}"

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
      - PORT=${routerPort}
      - HOSTNAME=0.0.0.0
      - CI=true
    volumes:
      - 9router-data:/root/.9router
      - ./sync.js:/tmp/sync.js:ro
      - ./patch-9router.js:/tmp/patch-9router.js:ro
    ports:
      - "127.0.0.1:${routerPort}:${routerPort}"

volumes:
  9router-data:${stateVolDecl}`;
      } else if (isLocal) {
        const ollamaModelTag = String(selectedModel || 'ollama/gemma4:e2b').replace('ollama/', '');
        compose = `name: ${multiComposeName}
services:
  ai-bot:
    build: .
    container_name: ${multiAppContainerName}
    restart: always
    env_file:
      - ../../.env
${appEnvironmentBlock}${dependsOn}${extraHosts}    volumes:
      - ${volumeMount}${stateVolMount}
    ports:
      - "127.0.0.1:${gatewayPort}:${gatewayPort}"

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
  ollama-data:${stateVolDecl}`;
      } else {
        compose = `name: ${multiComposeName}
services:
  ai-bot:
    build: .
    container_name: ${multiAppContainerName}
    restart: always
    env_file:
      - ../../.env
${appEnvironmentBlock}${extraHosts}    volumes:
      - ${volumeMount}${stateVolMount}
    ports:
      - "127.0.0.1:${gatewayPort}:${gatewayPort}"${stateVolBlock}`;
      }
    } else if (is9Router) {
      compose = `name: ${singleComposeName}
services:
  ai-bot:
    build: .
    container_name: ${singleAppContainerName}
    restart: always
    env_file:
      - ../../.env
    depends_on:
      - 9router
${appEnvironmentBlock}${extraHostsBlock}\n    volumes:
      - ${volumeMount}${stateVolMount}
      - openclaw-plugins:/home/node/project/.openclaw/npm${extVolMount}
    ports:
      - "127.0.0.1:${gatewayPort}:${gatewayPort}"

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
      - PORT=${routerPort}
      - HOSTNAME=0.0.0.0
      - CI=true
    volumes:
      - 9router-data:/root/.9router
      - ./sync.js:/tmp/sync.js:ro
      - ./patch-9router.js:/tmp/patch-9router.js:ro
    ports:
      - "127.0.0.1:${routerPort}:${routerPort}"

volumes:
  9router-data:
  openclaw-plugins:${extVolDecl}${stateVolDecl}`;
    } else if (isLocal) {
      const ollamaModelTag = String(selectedModel || 'ollama/gemma4:e2b').replace('ollama/', '');
      compose = `name: ${singleComposeName}
services:
  ai-bot:
    build: .
    container_name: ${singleAppContainerName}
    restart: always
    env_file: ../../.env
${appEnvironmentBlock}    depends_on:
      ollama:
        condition: service_healthy
${extraHostsBlock}\n    ports:
      - "127.0.0.1:${gatewayPort}:${gatewayPort}"
    volumes:
      - ${volumeMount}${stateVolMount}

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
  ollama-data:${stateVolDecl}`;
    } else {
      compose = `name: ${singleComposeName}
services:
  ai-bot:
    build: .
    container_name: ${singleAppContainerName}
    restart: always
    env_file:
      - ../../.env
${appEnvironmentBlock}${plainSingleExtraHosts ? `${extraHostsBlock}\n` : ''}    volumes:
      - ${volumeMount}${stateVolMount}
    ports:
      - "127.0.0.1:${gatewayPort}:${gatewayPort}"${stateVolBlock}`;
    }

    return {
      dockerfile,
      compose,
      entrypointScript: runtimeScript,
      syncScript,
      patchScript,
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
