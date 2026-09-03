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

  // Idempotent config upgrade replayed on every runtime start. Docker embeds it in the container
  // entrypoint; the native runtime (local-server.js) runs it via `node -e` before every gateway
  // (re)start — one script, both deploy modes, so native bots stop missing config fixes like the
  // smart-route contextWindow 200000/131072 → 1048576 (Kent chot 01/09/2026; chi dung den DUNG
  // hai gia tri setup tung ghi, custom tuning giu nguyen). Full rationale sits with the
  // entrypoint block inside buildDockerArtifacts.
  // ⚠️ toolResultMaxChars: openclaw ≥2026.8 BO key nay khoi schema va TU CHOI BOOT khi thay no.
  // Ban cu cua script nay them key vo dieu kien moi lan container start — nen mot khach rebuild
  // image (Dockerfile keo openclaw moi) la roi vao vong: gateway chet vi key ⇒ xoa tay ⇒ entrypoint
  // them lai ⇒ chet tiep, khong lo ra thu pham (ca that 103.98.149.154, 31/08/2026, 66 lan restart).
  // Gio gate theo version openclaw THAT trong container: <2026.8 thi backfill nhu cu, ≥2026.8 thi
  // GO key neu con (tu chua cac project da nhiem). Khong doc duoc version thi KHONG dong nao chay
  // — tha thieu mot default con hon gieo key lam gateway tu choi boot.
  const contextDefaultsScript = `const fs=require('fs'),path=require('path');const p=path.join(process.cwd(),'.openclaw','openclaw.json');if(fs.existsSync(p)){const c=JSON.parse(fs.readFileSync(p,'utf8'));let ch=false;c.skills=c.skills||{};c.skills.workshop=c.skills.workshop||{};if(!c.skills.workshop.approvalPolicy){c.skills.workshop.approvalPolicy='auto';ch=true;}if(c.browser&&c.browser.enabled!==false){c.tools=c.tools||{};const dn=Array.isArray(c.tools.deny)?c.tools.deny:[];if(!dn.includes('browser')){dn.push('browser');c.tools.deny=dn;ch=true;}}let ocMajorMinor=0;try{const v=String(require('child_process').execSync('openclaw --version',{stdio:['ignore','pipe','ignore']})).match(/(\\d{4})\\.(\\d+)/);if(v)ocMajorMinor=Number(v[1])*100+Number(v[2]);}catch(e){}const d=(c.agents&&c.agents.defaults)?c.agents.defaults:null;if(d){if(d.imageMaxDimensionPx===undefined){d.imageMaxDimensionPx=1024;ch=true;}if(d.imageQuality===undefined){d.imageQuality='efficient';ch=true;}if(ocMajorMinor&&ocMajorMinor<202608){d.contextLimits=d.contextLimits||{};if(d.contextLimits.toolResultMaxChars===undefined){d.contextLimits.toolResultMaxChars=12000;ch=true;}}else if(ocMajorMinor>=202608&&d.contextLimits&&d.contextLimits.toolResultMaxChars!==undefined){delete d.contextLimits.toolResultMaxChars;ch=true;}}if(ocMajorMinor>=202608){const ag=c.agents||{};const nEntries=(Array.isArray(ag.list)?ag.list.length:0)+(ag.entries&&typeof ag.entries==='object'?Object.keys(ag.entries).length:0);if(nEntries>1&&ag.ownership!=='explicit'){ag.ownership='explicit';c.agents=ag;ch=true;}try{const agRoot=path.join(process.cwd(),'.openclaw','agents');for(const id of fs.readdirSync(agRoot)){const sf=path.join(agRoot,id,'sessions','sessions.json');if(fs.existsSync(sf)){fs.renameSync(sf,sf+'.bak-legacy-'+Date.now());console.log('[migrate] parked legacy session store '+sf);}}}catch(e){}if(c.commands&&c.commands.ownerDisplay!==undefined){delete c.commands.ownerDisplay;ch=true;}if(c.plugins&&c.plugins.bundledDiscovery!==undefined){delete c.plugins.bundledDiscovery;ch=true;}if(Array.isArray(ag.list)){ag.entries=(ag.entries&&typeof ag.entries==='object'&&!Array.isArray(ag.entries))?ag.entries:{};for(const a of ag.list){if(a&&a.id&&!ag.entries[a.id]){const{id:_aid,...rest}=a;ag.entries[_aid]=rest;}}delete ag.list;c.agents=ag;ch=true;console.log('[migrate] moved agents.list into agents.entries');}try{const ea=path.join(process.cwd(),'.openclaw','exec-approvals.json');if(fs.existsSync(ea)){fs.renameSync(ea,ea+'.bak-legacy-'+Date.now());console.log('[migrate] parked legacy exec approvals '+ea);}}catch(e){}}const pr=c.models&&c.models.providers&&c.models.providers['9router'];if(pr&&Array.isArray(pr.models)){for(const m of pr.models){if(m&&m.id==='smart-route'&&(m.contextWindow===200000||m.contextWindow===131072)){m.contextWindow=1048576;ch=true;}}}if(ch)fs.writeFileSync(p,JSON.stringify(c,null,2));}`;

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
      ? `\n# Install skills (ClawHub)\n${allSkills.map((skill) => `RUN openclaw skills install ${skill} --acknowledge-install-policy-warning || openclaw skills install ${skill} --acknowledge-clawhub-risk || echo "Warning: Failed to install ${skill} due to rate limits."`).join('\n')}\n`
      : '';
    const pluginLines = dockerfilePlugins.length > 0
      ? `\n# Install plugins (ClawHub)\n${dockerfilePlugins.map((p) => `RUN openclaw plugins install ${p} --accept-capabilities || openclaw plugins install ${p} --acknowledge-clawhub-risk || echo "Warning: Failed to install plugin ${p}"`).join('\n')}\n`
      : '';
    const patchLine = `RUN node -e "const fs=require('fs');const path=require('path');const dir='/usr/local/lib/node_modules/openclaw/dist';const from='\\t\\t\\t\\t\\tonAgentRunStart: (runId) => {';const to='\\t\\t\\t\\t\\ttimeoutOverrideSeconds: Math.max(1, Math.ceil(timeoutMs / 1e3)),\\n\\t\\t\\t\\t\\tonAgentRunStart: (runId) => {';const files=fs.readdirSync(dir).filter(n=>/\\.js$/.test(n));let patched=0;for(const file of files){const p=path.join(dir,file);let s='';try{s=fs.readFileSync(p,'utf8');}catch{continue;}if(s.includes(to)||!s.includes(from))continue;s=s.replace(from,to);fs.writeFileSync(p,s);patched++;}if(!patched){process.exit(0);}"`;
    
    // Dynamic runtime configuration: backup config before any first-run install, restore after.
    // Missing plugin install may touch openclaw.json, so preserve critical fields.
    const backupConfigScript = `const fs=require('fs'),path=require('path'),p=path.join(process.cwd(),'.openclaw','openclaw.json'),b=p.replace('openclaw.json','.openclaw-config-backup.json');if(fs.existsSync(p)){fs.copyFileSync(p,b);}`;

    const restoreConfigScript = `const fs=require('fs'),os=require('os'),path=require('path'),p=path.join(process.cwd(),'.openclaw','openclaw.json'),b=p.replace('openclaw.json','.openclaw-config-backup.json');if(fs.existsSync(p)&&fs.existsSync(b)){const c=JSON.parse(fs.readFileSync(p,'utf8'));const bk=JSON.parse(fs.readFileSync(b,'utf8'));const keep=['agents','channels','bindings','commands','models','browser','skills','plugins','tools'];for(const k of keep){if(bk[k]&&!c[k])c[k]=bk[k];}const gp=Number(process.env.OPENCLAW_GATEWAY_PORT||process.env.OPENCLAW_PORT)||c.gateway?.port||bk.gateway?.port||18789;const a=new Set(['http://localhost:'+gp,'http://127.0.0.1:'+gp,'http://0.0.0.0:'+gp]);for(const entries of Object.values(os.networkInterfaces()||{})){for(const entry of entries||[]){if(!entry||entry.internal||entry.family!=='IPv4'||!entry.address)continue;a.add('http://'+entry.address+':'+gp);}}c.tools=Object.assign({},c.tools,{profile:'full',exec:{host:'gateway',security:'full',ask:'off'}});c.gateway=Object.assign({},c.gateway,{port:gp,bind:'custom',customBindHost:'0.0.0.0',mode:c.gateway?.mode||bk.gateway?.mode||'local',controlUi:Object.assign({},c.gateway?.controlUi,{allowedOrigins:Array.from(a).filter(Boolean)})});fs.writeFileSync(p,JSON.stringify(c,null,2));fs.unlinkSync(b);}`;
    // One-shot migration for projects created by an older setup: the learning-memory
    // SKILL and the memory-tencentdb plugin are deprecated (replaced by the learning-memory
    // context-engine plugin). Drop their config entries so they stop loading; the skill
    // folders + tencentdb install are removed by the shell steps that follow.
    const deprecatedCleanupScript = `const fs=require('fs'),path=require('path');const p=path.join(process.cwd(),'.openclaw','openclaw.json');if(fs.existsSync(p)){const c=JSON.parse(fs.readFileSync(p,'utf8'));let ch=false;if(c.plugins&&c.plugins.entries&&c.plugins.entries['memory-tencentdb']){delete c.plugins.entries['memory-tencentdb'];ch=true;}if(c.plugins&&Array.isArray(c.plugins.allow)){const n=c.plugins.allow.filter(x=>x!=='memory-tencentdb'&&x!=='@tencentdb-agent-memory/memory-tencentdb');if(n.length!==c.plugins.allow.length){c.plugins.allow=n;ch=true;}}if(c.skills&&c.skills.entries&&c.skills.entries['learning-memory']){delete c.skills.entries['learning-memory'];ch=true;}if(ch)fs.writeFileSync(p,JSON.stringify(c,null,2));}`;
    // One-shot upgrade for projects created by an older setup (their openclaw.json was
    // generated before these defaults existed, and bot-config-gen only runs when a bot is
    // created/regenerated — so a plain rebuild would never pick them up):
    //   • skills.workshop.approvalPolicy:'auto' → the assistant can author a workspace
    //     skill end-to-end on request instead of stopping at "proposal awaiting approval".
    //   • tools.deny gains `browser` on projects that have browsing enabled, so the model
    //     stops reaching for the native tool instead of the plugin's browser-tool.js.
    // (messages.ackReaction is handled separately, below, because it is Zalo-only.)
    //   • imageMaxDimensionPx / imageQuality / contextLimits.toolResultMaxChars → keep one
    //     heavy turn (deep research, 4K chart read-back) from overflowing the context
    //     window mid tool-loop, which cannot be compacted and poisons the session.
    //   • smart-route contextWindow 200000 → 131072: the old declared window exceeded the
    //     smallest upstream in typical free-model combos, so full sessions deadlocked —
    //     the compaction summarize call itself overflowed and only /new recovered. Only the
    //     exact setup-written 200000 is rewritten; an operator's custom value is left alone.
    // Each key is only filled in when absent, so an operator's own tuning is never clobbered.
    // (The script itself lives at module scope — the native runtime replays the exact same
    // migration before every gateway (re)start, since native projects have no entrypoint.)
    // Companion backfill for the same older projects: their TOOLS.md was generated before the
    // skill-authoring / long-turn guidance existed, and workspace files are only written when a
    // bot is created — so a rebuild alone leaves the assistant stopping at "proposal awaiting
    // approval" even once approvalPolicy is 'auto'. (TOOLS.md is listed in AGENTS.md as required
    // reading, so guidance lands there rather than in the main manual.) Appends the block once
    // per workspace, keyed off the `skill_workshop` marker, never rewriting a file that has it.
    const agentsGuidanceScript = `const fs=require('fs'),path=require('path');const vi=['','## 🛠️ Tự tạo skill & việc dài','','**Tự tạo skill:** Khi user nhờ tạo một kỹ năng/quy trình dùng lại (vd _"tạo skill X"_), bạn TỰ làm từ đầu đến cuối — dùng tool **skill_workshop**: tạo proposal RỒI **apply luôn trong cùng lượt** (môi trường này bật approvalPolicy auto, không cần chờ ai duyệt). Skill ghi vào skills/<tên>/SKILL.md và **tự nạp** qua watcher — KHÔNG cần sửa openclaw.json. Đừng dừng ở _"đã tạo proposal, chờ duyệt"_. KHÔNG nhúng bí mật vào skill — đọc từ biến môi trường lúc chạy.','','**Việc dài, nhiều bước (research sâu, dựng báo cáo/PDF):** ảnh/chart bạn vừa tạo thì **đừng đọc lại** bằng tool ảnh (chèn thẳng file vào tài liệu; kiểm bằng file tồn tại / build thành công) — đọc lại ảnh lớn ngốn ngữ cảnh gấp nhiều lần bạn tưởng. Tạo hình cạnh dài khoảng 1280px, đừng 4K trừ khi user yêu cầu. Research nhiều nguồn thì dùng **sessions_spawn** mỗi nhánh một subagent, bảo chúng **ghi dữ liệu thô ra file** và **chỉ trả tóm tắt ngắn kèm đường dẫn**; bạn tổng hợp từ file.',''].join('\\n');const en=['','## 🛠️ Authoring skills & long work','','**Authoring skills:** When the user asks for a reusable capability (e.g. _"make a skill for X"_), do it end-to-end — use the **skill_workshop** tool: create the proposal AND **apply it in the same turn** (this environment sets approvalPolicy auto, so no separate approval is needed). The skill lands in skills/<name>/SKILL.md and **auto-loads** via the watcher — no openclaw.json edit required. Do not stop at _"proposal created, awaiting approval"_. Never hardcode secrets into a skill — read them from environment variables at runtime.','','**Long multi-step work (deep research, building reports/PDFs):** do not read back an image or chart you just made (drop the file straight in; verify via file exists / build succeeded) — re-reading a large image costs far more context than it looks. Render at about 1280px on the long edge, skip 4K unless asked. For multi-source research, use **sessions_spawn** with one subagent per branch, have them **write raw findings to files** and **return only a short summary plus paths**; synthesize from the files.',''].join('\\n');const root=path.join(process.cwd(),'.openclaw');let dirs=[];try{dirs=fs.readdirSync(root).filter(n=>n.indexOf('workspace')===0);}catch(e){}for(const d of dirs){const f=path.join(root,d,'TOOLS.md');try{if(!fs.existsSync(f))continue;const cur=fs.readFileSync(f,'utf8');if(cur.indexOf('skill_workshop')!==-1)continue;const isVi=/Kỹ năng|Ghi chú|Xử lý lỗi|môi trường/.test(cur);fs.appendFileSync(f,(cur.endsWith('\\n')?'':'\\n')+(isVi?vi:en));}catch(e){}}`;
    const securityCompatScript = `const fs=require('fs'),path=require('path');const scopes=['operator.admin','operator.pairing','operator.approvals'];function uniq(a){return Array.from(new Set([...(Array.isArray(a)?a:[]),...scopes]));}function walk(v){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(walk);return;}if(Array.isArray(v.scopes)||Array.isArray(v.approvedScopes)){v.scopes=uniq(v.scopes);v.approvedScopes=uniq(v.approvedScopes);}Object.values(v).forEach(walk);}const home=process.env.OPENCLAW_HOME||path.join(process.cwd(),'.openclaw');const state=process.env.OPENCLAW_STATE_DIR||home;const cfgPath=path.join(process.cwd(),'.openclaw','openclaw.json');if(fs.existsSync(cfgPath)){const c=JSON.parse(fs.readFileSync(cfgPath,'utf8'));const p=c.models&&c.models.providers&&c.models.providers['9router'];if(p){p.request=Object.assign({},p.request,{allowPrivateNetwork:true});}fs.writeFileSync(cfgPath,JSON.stringify(c,null,2));}for(const root of Array.from(new Set([home,state]))){const f=path.join(root,'devices','paired.json');if(fs.existsSync(f)){const d=JSON.parse(fs.readFileSync(f,'utf8'));walk(d);fs.writeFileSync(f,JSON.stringify(d,null,2));}}`;

    const runtimeParts = runtimeCommandParts.filter(Boolean);
    const runtimePrelude = [
      'export OPENCLAW_HOME="${OPENCLAW_HOME:-$PWD/.openclaw}"',
      'export OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-$OPENCLAW_HOME}"',
      'mkdir -p "$OPENCLAW_HOME" "$OPENCLAW_STATE_DIR"',
      // `openclaw plugins install` unpacks into extensions/.openclaw-install-stage-XXXXXX and removes
      // it when it finishes. An interrupted install leaves the staging copy behind — and it still
      // carries a plugin manifest, so the gateway logs "duplicate plugin id detected" on every boot
      // and a stale build competes with the real one for the same id. Found on a production host: a
      // zalo-connect 3.0.7 stage dir shadowing 3.0.17 for a week. Nothing is installing at entrypoint
      // time, so any stage dir here is by definition abandoned.
      'for stage in "$OPENCLAW_HOME"/extensions/.openclaw-install-stage-*; do',
      '  [ -d "$stage" ] || continue',
      '  echo "[entrypoint] removing abandoned plugin staging dir $(basename "$stage")"',
      '  rm -rf "$stage"',
      'done',
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
      '    *) openclaw plugins install "$spec" --accept-capabilities 2>/dev/null || openclaw plugins install "$spec" --acknowledge-clawhub-risk 2>/dev/null || echo "[entrypoint] warning: failed to install plugin $spec" ;;',
      '  esac',
      '}',
      'ensure_skill() {',
      '  id="$1"',
      '  if find "$OPENCLAW_HOME" -maxdepth 4 -type d -path "*/skills/$id" -print -quit 2>/dev/null | grep -q .; then',
      '    echo "[entrypoint] skill $id already installed"',
      '    return 0',
      '  fi',
      '  echo "[entrypoint] skill $id missing; installing"',
      '  openclaw skills install "$id" --acknowledge-install-policy-warning 2>/dev/null || openclaw skills install "$id" --acknowledge-clawhub-risk 2>/dev/null || echo "[entrypoint] warning: failed to install skill $id"',
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
      // ZaloConnect install from ClawHub (latest). ensure_plugin skips when extensions/zalo-connect
      // already exists, so restarts never re-download; the "Update" button in the dashboard fetches
      // newer versions. No dist patching, no mentions.js, no watchdog: sticker/mention/reaction are
      // native ZaloConnect actions.
      const zaloConnectSpec = common.ZALO_CONNECT_PLUGIN_SPEC || 'clawhub:openclaw-zalo-connect';
      runtimeParts.push(`ensure_plugin zalo-connect "${zaloConnectSpec}"`);
      // Backfill the inbound-message ack reaction for projects created before it was
      // seeded. Kept out of the shared migration because zalo-connect reads the GLOBAL
      // messages.ackReaction, and that same key also feeds Telegram/Discord/Slack/
      // WhatsApp — which accept only their own fixed reaction sets and would reject an
      // arbitrary emoji. Absent-only, so an operator's own choice is never overwritten.
      const ackReactionScript = `const fs=require('fs'),path=require('path');const p=path.join(process.cwd(),'.openclaw','openclaw.json');if(fs.existsSync(p)){const c=JSON.parse(fs.readFileSync(p,'utf8'));let ch=false;c.messages=c.messages||{};if(c.messages.ackReaction===undefined){c.messages.ackReaction='🦞';ch=true;}if(c.messages.ackReactionScope===undefined){c.messages.ackReactionScope='all';ch=true;}if(ch)fs.writeFileSync(p,JSON.stringify(c,null,2));}`;
      runtimeParts.push(`node - <<'NODE'\n${ackReactionScript}\nNODE`);
    }
    // Always-on memory context engine for every bot (see bot-config-gen: plugins.slots
    // .contextEngine = "learning-memory"). ensure_plugin skips if already installed.
    runtimeParts.push('ensure_plugin learning-memory "clawhub:openclaw-learning-memory"');
    // Migrate off the deprecated learning-memory SKILL + memory-tencentdb plugin (older setups).
    runtimeParts.push(`node - <<'NODE'\n${deprecatedCleanupScript}\nNODE`);
    runtimeParts.push('find "$OPENCLAW_HOME" -maxdepth 4 -type d -path "*/skills/learning-memory" -exec rm -rf {} + 2>/dev/null || true');
    runtimeParts.push('if [ -d "$OPENCLAW_HOME/extensions/memory-tencentdb" ] || openclaw plugins list 2>/dev/null | grep -q memory-tencentdb; then openclaw plugins uninstall memory-tencentdb --force 2>/dev/null || true; fi');
    // Backfill skill-authoring + context defaults for configs from an older setup (see above).
    runtimeParts.push(`node - <<'NODE'\n${contextDefaultsScript}\nNODE`);
    runtimeParts.push(`node - <<'NODE'\n${agentsGuidanceScript}\nNODE`);
    // browser-tool.js is a CDP client only — it has no code to launch a browser, so it
    // needs something listening on a debug port. On a desktop that is the operator's own
    // Chrome (started by start-chrome), reached through the host gateway. On a server there
    // is no such Chrome, and browsing simply failed. Start a headless Chromium on loopback
    // 9222 — the second entry in browser-tool.js's candidate list — so the same tool works
    // on every OS.
    //
    // Emitted unconditionally and gated at RUNTIME on the plugin being installed, not on
    // hasBrowser: the dashboard creates projects without that flag, so an operator who turns
    // browser-automation on later (the common path) would otherwise never get this block.
    //
    // Chromium is baked into the image only when hasBrowser was known at build time. When it
    // is missing — every project whose image predates the plugin — download it once instead
    // of telling the bot to give up; that message is what makes it answer "there is no
    // browser in my environment". The download goes to a path under $OPENCLAW_HOME, which is
    // a bind mount, so recreating the container does not pay for it again. It runs in the
    // background: the gateway must not wait ~150MB before answering messages.
    //
    // Skipped when a host Chrome is already reachable (it is tried first anyway) or when
    // something already holds 9222, so a desktop does not pay for an idle browser.
    runtimeParts.push([
      // Not exported: the plugin (and anything else in the image) resolves Playwright's own
      // cache, and pointing that at an empty directory would break a Chromium that IS baked in.
      'openclaw_browsers_dir="$OPENCLAW_HOME/browsers"',
      // The installed plugin folder, not the config: browsing needs browser-tool.js, which
      // ships with the plugin, so "enabled in config but never installed" has nothing to serve.
      'browser_automation_enabled() {',
      '  [ -d "$OPENCLAW_HOME/extensions/browser-automation" ]',
      '}',
      'find_chrome_bin() {',
      '  for candidate in /usr/bin/google-chrome /usr/bin/chromium /usr/bin/chromium-browser; do',
      '    [ -x "$candidate" ] && echo "$candidate" && return 0',
      '  done',
      '  ls -d "$openclaw_browsers_dir"/chromium-*/chrome-linux*/chrome "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome /root/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | head -n 1',
      '}',
      'launch_headless_chrome() {',
      '  echo "[entrypoint] starting local headless Chromium on 127.0.0.1:9222"',
      '  "$1" --headless=new --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 \\',
      '    --no-sandbox --disable-dev-shm-usage --disable-gpu --no-first-run --no-default-browser-check \\',
      '    --user-data-dir=/tmp/openclaw-headless-chrome >/tmp/openclaw-headless-chrome.log 2>&1 &',
      '}',
      'start_local_headless_chrome() {',
      '  browser_automation_enabled || return 0',
      '  if curl -s -m 2 http://127.0.0.1:9222/json/version >/dev/null 2>&1; then return 0; fi',
      '  host_ip="$(getent hosts host.docker.internal 2>/dev/null | awk \'{print $1}\' | head -n 1)"',
      '  if [ -n "$host_ip" ] && curl -s -m 2 "http://$host_ip:9222/json/version" >/dev/null 2>&1; then',
      '    echo "[entrypoint] host Chrome reachable at $host_ip:9222; not starting a local one"',
      '    return 0',
      '  fi',
      '  chrome_bin="$(find_chrome_bin || true)"',
      '  if [ -n "$chrome_bin" ] && [ -x "$chrome_bin" ]; then',
      '    launch_headless_chrome "$chrome_bin"',
      '    return 0',
      '  fi',
      '  echo "[entrypoint] browser-automation is on but this image has no Chromium; downloading it once (~150MB) in the background"',
      '  (',
      '    mkdir -p "$openclaw_browsers_dir"',
      '    PLAYWRIGHT_BROWSERS_PATH="$openclaw_browsers_dir" npx --yes playwright install --with-deps chromium >/tmp/openclaw-chromium-install.log 2>&1 \\',
      '      || PLAYWRIGHT_BROWSERS_PATH="$openclaw_browsers_dir" npx --yes playwright install chromium >>/tmp/openclaw-chromium-install.log 2>&1',
      '    installed_bin="$(find_chrome_bin || true)"',
      '    if [ -n "$installed_bin" ] && [ -x "$installed_bin" ]; then',
      '      echo "[entrypoint] Chromium ready at $installed_bin"',
      '      launch_headless_chrome "$installed_bin"',
      '    else',
      '      echo "[entrypoint] Chromium download failed; see /tmp/openclaw-chromium-install.log — browsing still works if the operator runs start-chrome on the host"',
      '    fi',
      '  ) &',
      '}',
      // `set -e` is on: a non-zero return here must never stop the gateway from starting.
      'start_local_headless_chrome || true',
    ].join('\n'));
    // openclaw ≥2026.8 TACH duckduckgo khoi bundle thanh plugin external co capability consent.
    // Config do setup sinh (bot chon skill web-search) van khai `plugins.entries.duckduckgo`,
    // va gateway 2026.8.x TU CHOI ready khi entry khai ma plugin chua cai ("Plugin verification
    // failed … requires capability consent") — do that tren 103.98.149.154, 31/08/2026.
    // Cai o day, truoc gateway run, dung lenh + co ma chinh gateway goi y; `yes |` cho cau hoi
    // consent; loi khong chan boot (|| true) — thieu web search chi la mat mot tool phu.
    runtimeParts.push([
      'if grep -q \'"duckduckgo"\' "$OPENCLAW_HOME/openclaw.json" 2>/dev/null && [ ! -d "$OPENCLAW_HOME/extensions/duckduckgo" ]; then',
      '  echo "[entrypoint] installing external duckduckgo plugin (openclaw >=2026.8 unbundled it)"',
      '  yes | openclaw plugins install @openclaw/duckduckgo-plugin --accept-capabilities || true',
      'fi',
    ].join('\n'));
    // ── Doctor-on-upgrade ─────────────────────────────────────────────────────────────────
    // Update openclaw khong bao gio chi la "doi so version": schema config doi (key cu bi TU CHOI
    // chu khong bo qua) va state DB doi migration (audit-events-v2…), va doctor chi chay sach khi
    // gateway DANG TAT — tuc dung ngay tai day, truoc `gateway run`, trong container vua boot.
    // So version hien tai voi lan boot truoc (marker trong $OPENCLAW_HOME); khac nhau moi chay,
    // hai luot vi doctor boc migration theo LOP (ca that 103.98.149.154 can nhieu luot). `yes |`
    // vi doctor co cau hoi tuong tac; loi doctor khong chan boot — gateway se tu noi not phan con
    // thieu, con hon container chet cung khong ai chan doan duoc.
    runtimeParts.push([
      'OC_VER="$(openclaw --version 2>/dev/null | head -1)"',
      'OC_VER_MARKER="$OPENCLAW_HOME/.openclaw-last-version"',
      'if [ -n "$OC_VER" ] && [ "$OC_VER" != "$(cat "$OC_VER_MARKER" 2>/dev/null)" ]; then',
      '  echo "[entrypoint] openclaw version changed ($(cat "$OC_VER_MARKER" 2>/dev/null || echo none) -> $OC_VER); running doctor --fix"',
      '  yes | openclaw doctor --fix || true',
      '  yes | openclaw doctor --fix || true',
      '  printf %s "$OC_VER" > "$OC_VER_MARKER" || true',
      'fi',
    ].join('\n'));
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
      # 9router blocks the default password for "remote" access, and inside Docker every
      # host request arrives via the bridge network, so it always counts as remote — without
      # this the user can NEVER log in with the documented default (measured 02/09/2026).
      - INITIAL_PASSWORD=123456
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
      # 9router blocks the default password for "remote" access, and inside Docker every
      # host request arrives via the bridge network, so it always counts as remote — without
      # this the user can NEVER log in with the documented default (measured 02/09/2026).
      - INITIAL_PASSWORD=123456
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
    contextDefaultsScript,
  };

})(typeof globalThis !== 'undefined' ? globalThis : {});
if (typeof exports !== 'undefined' && typeof globalThis !== 'undefined' && globalThis.__openclawDockerGen) {
  Object.assign(exports, globalThis.__openclawDockerGen);
}
