import http from 'http';
import fs, { createReadStream, existsSync, promises as fsp } from 'fs';
import { createRequire } from 'module';
import { basename, dirname, extname, join, normalize, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execFile } from 'child_process';
import os from 'os';
import net from 'net';
import { DatabaseSync } from 'node:sqlite';
const _require = createRequire(import.meta.url);
function loadSharedModule(modulePath, globalName) {
  const loaded = _require(modulePath);
  if (loaded && Object.keys(loaded).length > 0) return loaded;
  return globalThis[globalName] || loaded || {};
}
const { buildWorkspaceFileMap } = loadSharedModule('../setup/shared/workspace-gen.js', '__openclawWorkspace');
const { buildOpenclawJson, buildEnvFileContent, buildExecApprovalsJson } = loadSharedModule('../setup/shared/bot-config-gen.js', '__openclawBotConfig');
const { buildDockerArtifacts } = loadSharedModule('../setup/shared/docker-gen.js', '__openclawDockerGen');
const { OPENCLAW_NPM_SPEC, NINE_ROUTER_NPM_SPEC, build9RouterProviderConfig, get9RouterBaseUrl } = loadSharedModule('../setup/shared/common-gen.js', '__openclawCommon');
const dataExport = loadSharedModule('../setup/data/index.js', '__openclawData');

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(__dirname, '../web');
const SETUP_VERSION = (() => { try { return JSON.parse(fs.readFileSync(resolve(__dirname, '../../package.json'), 'utf8')).version || '0.0.0'; } catch { return '0.0.0'; } })();
const DEFAULT_PROJECT_NAME = 'openclaw-bot';
const STATE_FILE = '.openclaw-setup-state.json';
const DEFAULT_MODEL = 'smart-route';
const logClients = new Set();
let zaloLoginInFlight = false;
const state = {
  installing: false,
  installed: false,
  lastError: null,
  projectDir: null,
  gatewayUrl: 'http://127.0.0.1:18789',
  gatewayPort: 18789,
  routerUrl: 'http://127.0.0.1:20128',
  routerPort: 20128,
  syncSource: 'config',
  botPid: null,
  mode: null,
  os: null,
  startedAt: null,
};

function sendLog(line) {
  const payload = `data: ${JSON.stringify({ line, ts: new Date().toISOString() })}\n\n`;
  for (const res of logClients) res.write(payload);
  process.stdout.write(`${line}\n`);
}

function extractCompletePngBase64(stdout) {
  const b64 = String(stdout || '').trim();
  if (b64.length < 100) return '';
  let buf;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    return '';
  }
  if (!buf || buf.length < 32) return '';
  const pngSig = '89504e470d0a1a0a';
  const hasSig = buf.subarray(0, 8).toString('hex') === pngSig;
  const hasIend = buf.includes(Buffer.from('49454e44ae426082', 'hex'));
  if (!hasSig || !hasIend) return '';
  return b64;
}

function detectOs() {
  const platform = process.platform;
  if (platform === 'win32') return 'win';
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return os.release().toLowerCase().includes('microsoft') ? 'linux-desktop' : 'linux-desktop';
  return 'linux-desktop';
}

// Blacklist of Windows system/large directories that should never be walked
const SYSTEM_DIR_BLACKLIST = new Set([
  'windows', 'program files', 'program files (x86)', 'programdata',
  '$recycle.bin', 'system volume information', 'recovery', 'boot',
  'perflogs', 'msocache', 'intel', 'amd', 'nvidia',
  '$windows.~bt', '$windows.~ws', 'config.msi', 'documents and settings',
  'swapfile.sys', 'pagefile.sys', 'hiberfil.sys',
]);

/** Discover all available drive letters on Windows (A-Z). Returns ['C:\\', 'D:\\', ...] */
async function getAvailableDrives() {
  if (process.platform !== 'win32') return ['/'];
  const drives = [];
  for (let code = 65; code <= 90; code++) { // A-Z
    const letter = String.fromCharCode(code);
    const drive = `${letter}:\\`;
    try {
      await fsp.access(drive);
      drives.push(drive);
    } catch {}
  }
  return drives.length ? drives : ['C:\\', 'D:\\'];
}

function recommendedMode(osChoice) {
  if (osChoice === 'win' || osChoice === 'macos') return 'docker';
  return 'native';
}

function commandExists(cmd, args = ['--version']) {
  return new Promise((resolve) => {
    const shell = process.platform === 'win32';
    execFile(cmd, args, { windowsHide: true, timeout: 5000, shell }, (err, stdout, stderr) => {
      resolve({ ok: !err, output: String(stdout || stderr || '').trim() });
    });
  });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    sendLog(`$ ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, { cwd: opts.cwd, shell: process.platform === 'win32', env: { ...process.env, ...(opts.env || {}) } });
    let stdout = '';
    let resolved = false;
    child.stdout.on('data', (d) => {
      const chunk = String(d);
      stdout += chunk;
      sendLog(chunk.trimEnd());
      if (opts.resolveOnPattern && opts.resolveOnPattern.test(stdout) && !resolved) {
        resolved = true;
        resolve();
        setTimeout(() => {
          try { child.kill('SIGTERM'); } catch {}
        }, 1000);
      }
    });
    child.stderr.on('data', (d) => sendLog(String(d).trimEnd()));
    child.on('error', (err) => {
      if (!resolved) reject(err);
    });
    child.on('close', (code) => {
      if (!resolved) {
        if (code === 0) resolve();
        else reject(new Error(`${cmd} exited ${code}`));
      }
    });
  });
}

function startDetached(cmd, args, opts = {}) {
  sendLog(`$ ${cmd} ${args.join(' ')} &`);
  const child = spawn(cmd, args, {
    cwd: opts.cwd,
    shell: process.platform === 'win32',
    detached: true,
    stdio: 'ignore',
    windowsHide: opts.windowsHide ?? true,
    env: { ...process.env, ...(opts.env || {}) },
  });
  child.unref();
  return child.pid;
}

async function getCurrentRuntimeVersions() {
  const [openclaw, nineRouter, node] = await Promise.all([
    commandExists('openclaw', ['--version']),
    commandExists('9router', ['--version']),
    commandExists('node', ['--version']),
  ]);
  return {
    openclaw: openclaw.ok ? (openclaw.output.split(/\r?\n/)[0] || '').trim() : '',
    nineRouter: nineRouter.ok ? (nineRouter.output.split(/\r?\n/)[0] || '').trim() : '',
    node: node.ok ? (node.output.split(/\r?\n/)[0] || '').trim() : process.version,
  };
}

async function resolveProjectRuntimeVersions(projectDir, mode = state.mode || 'docker') {
  const fallback = {
    openclaw: '',
    nineRouter: '',
    node: process.version || '',
  };
  if (!projectDir) return fallback;
  if (mode === 'docker') {
    const compose = await readComposeText(projectDir);
    const botContainer = getBotContainerName(projectDir);
    const routerContainer = parseComposeServiceContainerName(compose, '9router') || '9router';
    const [openclawOut, routerOut, nodeOut] = await Promise.all([
      runCapture('docker', ['exec', botContainer, 'node', '-e', "const fs=require('fs');const p='/usr/local/lib/node_modules/openclaw/package.json';process.stdout.write(fs.existsSync(p)?String(JSON.parse(fs.readFileSync(p,'utf8')).version||''):'')"], { shell: false }),
      runCapture('docker', ['exec', routerContainer, 'node', '-e', "fetch('http://localhost:20128/api/version').then(async r=>{const d=await r.json().catch(()=>({}));process.stdout.write(String(d.currentVersion||''));}).catch(()=>process.stdout.write(''))"], { shell: false }),
      runCapture('docker', ['exec', botContainer, 'node', '--version'], { shell: false }),
    ]);
    return {
      openclaw: String(openclawOut.stdout || '').trim(),
      nineRouter: String(routerOut.stdout || '').trim(),
      node: String(nodeOut.stdout || '').trim(),
    };
  }
  const current = await getCurrentRuntimeVersions();
  return {
    openclaw: current.openclaw || '',
    nineRouter: current.nineRouter || '',
    node: current.node || process.version || '',
  };
}

function runStreamed(cmd, args, opts = {}) {
  sendLog(`$ ${cmd} ${args.join(' ')}`);
  const child = spawn(cmd, args, {
    cwd: opts.cwd,
    shell: opts.shell ?? process.platform === 'win32',
    windowsHide: opts.windowsHide ?? true,
    env: { ...process.env, ...(opts.env || {}) },
  });
  child.stdout.on('data', (d) => sendLog(String(d).trimEnd()));
  child.stderr.on('data', (d) => sendLog(String(d).trimEnd()));
  child.on('error', (err) => sendLog(`ERROR: ${err.message}`));
  child.on('close', (code) => sendLog(`${cmd} exited ${code}`));
  return child.pid;
}

function runStreamedToLogFile(cmd, args, logFile, opts = {}) {
  sendLog(`$ ${cmd} ${args.join(' ')}`);
  const child = spawn(cmd, args, {
    cwd: opts.cwd,
    shell: opts.shell ?? process.platform === 'win32',
    windowsHide: opts.windowsHide ?? true,
    env: { ...process.env, ...(opts.env || {}) },
  });
  let offset = 0;
  const poll = setInterval(async () => {
    try {
      const data = opts.readLogFile ? await opts.readLogFile(logFile) : (existsSync(logFile) ? await fsp.readFile(logFile, 'utf8') : '');
      if (data.length <= offset) return;
      const chunk = data.slice(offset);
      offset = data.length;
      for (const line of chunk.split(/\r?\n/).filter(Boolean)) sendLog(line);
    } catch {}
  }, 700);
  child.on('error', (err) => sendLog(`ERROR: ${err.message}`));
  child.on('close', (code) => { clearInterval(poll); sendLog(`${cmd} exited ${code}`); });
  return child.pid;
}

function runCapture(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      shell: opts.shell ?? process.platform === 'win32',
      windowsHide: opts.windowsHide ?? true,
      env: { ...process.env, ...(opts.env || {}) },
    });
    let timedOut = false;
    const timer = Number.isFinite(opts.timeout) && opts.timeout > 0
      ? setTimeout(() => {
          timedOut = true;
          try { child.kill(); } catch {}
        }, opts.timeout)
      : null;
    child.stdout.on('data', (d) => { stdout += String(d); });
    child.stderr.on('data', (d) => { stderr += String(d); });
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: stderr + err.message });
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: timedOut ? 124 : code, stdout, stderr: timedOut ? `${stderr}
Timed out after ${opts.timeout}ms`.trim() : stderr });
    });
  });
}

function safeJoin(root, name) {
  const clean = normalize(String(name || '')).replace(/^([/\\])+/, '');
  if (!clean || clean.includes('..')) throw httpError(400, 'Invalid file path');
  const full = resolve(root, clean);
  if (!full.startsWith(resolve(root))) throw httpError(403, 'Path escapes project');
  return full;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function slugify(name, fallback = 'bot') {
  return String(name || fallback).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

function readEnvText(text = '') {
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function numberFrom(...values) {
  for (const value of values) {
    const n = Number(String(value ?? '').match(/\d{2,5}/)?.[0] || '');
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

async function readEnvFile(file) {
  return existsSync(file) ? readEnvText(await fsp.readFile(file, 'utf8').catch(() => '')) : {};
}

function openclawProjectEnv(projectDir) {
  return {
    ...process.env,
    OPENCLAW_HOME: join(projectDir, '.openclaw'),
    OPENCLAW_STATE_DIR: join(projectDir, '.openclaw'),
  };
}

async function runOpenclawJson(projectDir, args = [], timeout = 12000) {
  const out = await runCapture('openclaw', args, {
    cwd: projectDir,
    env: openclawProjectEnv(projectDir),
    shell: false,
    timeout,
  });
  if (out.code !== 0) throw new Error((out.stderr || out.stdout || `openclaw ${args.join(' ')} failed`).trim());
  const text = String(out.stdout || '').trim();
  return text ? JSON.parse(text) : null;
}

async function readComposeText(projectDir) {
  const p = join(projectDir || '', 'docker', 'openclaw', 'docker-compose.yml');
  return existsSync(p) ? await fsp.readFile(p, 'utf8').catch(() => '') : '';
}

function getComposeServiceBlock(compose = '', serviceName = '') {
  const lines = String(compose || '').split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^\\s{2}${serviceName}:\\s*$`).test(l));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^\s{2}\S/.test(lines[i])) { end = i; break; }
  return lines.slice(start, end).join('\n');
}

function parseComposeServiceContainerName(compose = '', serviceName = '') {
  const block = getComposeServiceBlock(compose, serviceName);
  return block.match(/^\s{4}container_name:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1]?.trim() || '';
}

function parseComposeHostPort(compose = '', containerPort = 0, serviceHint = '') {
  const lines = String(compose || '').split(/\r?\n/);
  let text = lines.join('\n');
  if (serviceHint) {
    const start = lines.findIndex((l) => new RegExp(`^\\s{2}${serviceHint}:\\s*$`).test(l));
    if (start >= 0) {
      let end = lines.length;
      for (let i = start + 1; i < lines.length; i++) if (/^\s{2}\S/.test(lines[i])) { end = i; break; }
      text = lines.slice(start, end).join('\n');
    }
  }
  const re = new RegExp(`["']?(?:127\\.0\\.0\\.1:)?(\\d{2,5}):${containerPort || '\\d{2,5}'}["']?`);
  return numberFrom(text.match(re)?.[1]);
}

function parseBaseUrlPort(baseUrl = '') {
  try {
    const u = new URL(baseUrl);
    return Number(u.port || (u.protocol === 'https:' ? 443 : 80)) || 0;
  } catch {
    return numberFrom(baseUrl);
  }
}

async function detectRuntime(projectDir) {
  const cfgPath = join(projectDir || '', '.openclaw', 'openclaw.json');
  const cfg = existsSync(cfgPath) ? JSON.parse(await fsp.readFile(cfgPath, 'utf8').catch(() => '{}')) : {};
  let cliGatewayStatus = null;
  let cliGatewayPort = 0;
  let cliRouterPort = 0;
  let syncSource = 'config';
  try {
    cliGatewayStatus = await runOpenclawJson(projectDir, ['gateway', 'status', '--json', '--no-probe'], 15000);
    cliGatewayPort = numberFrom(cliGatewayStatus?.gateway?.port);
    if (cliGatewayPort) syncSource = 'cli';
  } catch {}
  try {
    cliRouterPort = parseBaseUrlPort(await runOpenclawJson(projectDir, ['config', 'get', "models.providers['9router'].baseUrl", '--json'], 8000));
    if (cliRouterPort) syncSource = 'cli';
  } catch {}
  const rootEnv = await readEnvFile(join(projectDir || '', '.env'));
  const dockerEnv = await readEnvFile(join(projectDir || '', 'docker', 'openclaw', '.env'));
  const compose = await readComposeText(projectDir);
  const gatewayPort = numberFrom(
    cliGatewayPort,
    rootEnv.OPENCLAW_GATEWAY_PORT,
    rootEnv.OPENCLAW_PORT,
    dockerEnv.OPENCLAW_GATEWAY_PORT,
    dockerEnv.OPENCLAW_PORT,
    compose.match(/OPENCLAW_GATEWAY_PORT=(\d+)/)?.[1],
    compose.match(/OPENCLAW_PORT=(\d+)/)?.[1],
    parseComposeHostPort(compose, numberFrom(cfg.gateway?.port) || 18789, 'ai-bot'),
    cfg.gateway?.port,
    18789,
  ) || 18789;
  const providerBase = cfg.models?.providers?.['9router']?.baseUrl || '';
  const providerPort = cliRouterPort || parseBaseUrlPort(providerBase);
  const routerContainerPort = numberFrom(compose.match(/(?:PORT=|-p\s+)(\d{2,5})/)?.[1], providerPort, 20128) || 20128;
  const routerPort = numberFrom(
    parseComposeHostPort(compose, routerContainerPort, '9router'),
    /^(https?:\/\/)?(localhost|127\.0\.0\.1|host\.docker\.internal|9router)(:|\/)/i.test(providerBase) ? providerPort : 0,
    20128,
  ) || 20128;
  if (syncSource !== 'cli' && compose) syncSource = 'compose';
  return {
    gatewayPort,
    routerPort,
    gatewayUrl: `http://127.0.0.1:${gatewayPort}`,
    routerUrl: `http://127.0.0.1:${routerPort}`,
    mode: existsSync(join(projectDir || '', 'docker', 'openclaw', 'docker-compose.yml')) ? 'docker' : 'native',
    cliGatewayStatus,
    syncSource,
  };
}

async function syncRuntimeState(projectDir) {
  if (!projectDir || !existsSync(join(projectDir, '.openclaw', 'openclaw.json'))) return;
  await applyResolved9RouterApiKey(projectDir).catch(() => {});
  const rt = await detectRuntime(projectDir).catch(() => null);
  if (!rt) return;
  state.projectDir = projectDir;
  state.gatewayPort = rt.gatewayPort;
  state.routerPort = rt.routerPort;
  state.gatewayUrl = rt.gatewayUrl;
  state.routerUrl = rt.routerUrl;
  state.mode = state.mode || rt.mode;
  state.syncSource = rt.syncSource || 'config';
  state.installed = true;
  // Auto-sync Docker files if outdated
  if (rt.mode === 'docker') {
    await syncDockerInfra(projectDir).catch((err) =>
      sendLog(`[sync] Docker infra sync skipped: ${err.message}`)
    );
  }
}

function uniqueSlug(base, used) {
  let out = base;
  let i = 2;
  while (used.has(out)) out = `${base}-${i++}`;
  return out;
}

function uniqueDisplayName(base, used) {
  const clean = String(base || 'OpenClaw Bot').trim() || 'OpenClaw Bot';
  const taken = new Set(Array.from(used || []).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean));
  if (!taken.has(clean.toLowerCase())) return clean;
  let i = 2;
  let out = `${clean} ${i}`;
  while (taken.has(out.toLowerCase())) out = `${clean} ${++i}`;
  return out;
}

function parseIdentityFields(content = '') {
  const out = {};
  const lines = String(content || '').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*-\s*\*\*(?:TÃªn|Name)\s*:\*\*\s*(.+?)\s*$/i);
    if (m) out.name = m[1].trim();
    const r = line.match(/^\s*-\s*\*\*(?:Vai trÃ²|Role)\s*:\*\*\s*(.+?)\s*$/i);
    if (r) out.role = r[1].trim();
  }
  return out;
}

function usableIdentityName(name = '') {
  const clean = String(name || '').trim();
  if (clean && clean.length <= 60 && !/[*_"()]/.test(clean)) return clean;
  const bold = clean.match(/\*\*([^*]{1,40})\*\*/)?.[1]?.trim();
  return bold && !/[*_"()]/.test(bold) ? bold : '';
}

function workspaceRelForAgent(agent, cfg = {}, projectDir = '') {
  const hasOwnWorkspace = !!agent?.workspace;
  const raw = agent?.workspace || cfg.agents?.defaults?.workspace || '';
  const s = String(raw || '').replace(/\\/g, '/');
  let resolved = '';
  const m = s.match(/(?:^|\/)\.openclaw\/(.+)$/);
  if (m) resolved = m[1].replace(/^\/+/, '');
  else if (s.startsWith('.openclaw/')) resolved = s.replace(/^\.openclaw\//, '');
  else if (s.startsWith('workspace')) resolved = s;
  else resolved = `workspace-${agent?.id || 'workspace'}`;
  // When workspace came from defaults (shared), prefer per-agent dir if it exists
  if (!hasOwnWorkspace && agent?.id && resolved !== `workspace-${agent.id}`) {
    const perAgent = `workspace-${agent.id}`;
    if (projectDir) {
      if (existsSync(join(projectDir, '.openclaw', perAgent))) return perAgent;
    }
    if (projectDir && !existsSync(join(projectDir, '.openclaw', resolved))) return perAgent;
  }
  return resolved;
}

async function readAgentIdentity(projectDir, agent) {
  const cfgPath = join(projectDir || '', '.openclaw', 'openclaw.json');
  const cfg = existsSync(cfgPath) ? JSON.parse(await fsp.readFile(cfgPath, 'utf8').catch(() => '{}')) : {};
  const rel = workspaceRelForAgent(agent, cfg, projectDir);
  if (!rel) return {};
  const file = join(projectDir, '.openclaw', rel, 'IDENTITY.md');
  if (!existsSync(file)) return {};
  return parseIdentityFields(await fsp.readFile(file, 'utf8').catch(() => ''));
}

function ensureConfigShape(cfg) {
  if (!cfg || typeof cfg !== 'object') throw httpError(400, 'Invalid openclaw.json');
  cfg.agents = cfg.agents || {};
  cfg.agents.defaults = cfg.agents.defaults || { model: { primary: DEFAULT_MODEL, fallbacks: [] } };
  cfg.agents.defaults.model = cfg.agents.defaults.model || { primary: DEFAULT_MODEL, fallbacks: [] };
  if (!cfg.agents.defaults.model.primary || cfg.agents.defaults.model.primary === '9router/smart-route' || cfg.agents.defaults.model.primary === 'openai/smart-route') cfg.agents.defaults.model.primary = DEFAULT_MODEL;
  cfg.agents.list = Array.isArray(cfg.agents.list) ? cfg.agents.list : [];
  for (const agent of cfg.agents.list) {
    if (agent && typeof agent === 'object') {
      delete agent.channel;
      delete agent.role;
      delete agent.desc;
      delete agent.description;
      delete agent.persona;
    }
    agent.model = agent.model || { primary: cfg.agents.defaults.model.primary, fallbacks: [] };
    if (!agent.model.primary || agent.model.primary === '9router/smart-route' || agent.model.primary === 'openai/smart-route') agent.model.primary = DEFAULT_MODEL;
  }
  cfg.models = cfg.models || { mode: 'merge', providers: {} };
  cfg.models.providers = cfg.models.providers || {};
  if (!cfg.models.providers['9router']) cfg.models.providers['9router'] = cfg.models.providers.openai || (build9RouterProviderConfig ? build9RouterProviderConfig(get9RouterBaseUrl ? get9RouterBaseUrl(state.mode || 'docker', state.routerPort) : `http://9router:${state.routerPort || 20128}/v1`) : undefined);
  if (cfg.models.providers.openai?.baseUrl?.includes('9router')) delete cfg.models.providers.openai;
  cfg.channels = cfg.channels || {};
  cfg.bindings = Array.isArray(cfg.bindings) ? cfg.bindings : [];
  cfg.plugins = cfg.plugins || { entries: { 'memory-core': { config: { dreaming: { enabled: false } } } } };
  // Preserve plugins.allow — needed for non-bundled plugins like zalouser, zalo-mod
  if (!cfg.plugins.allow) cfg.plugins.allow = [];
  cfg.tools = cfg.tools || { profile: 'full', exec: { host: 'gateway', security: 'full', ask: 'off' } };
  return cfg;
}

function ensureTelegramChannel(cfg) {
  cfg.channels.telegram = cfg.channels.telegram || {};
  Object.assign(cfg.channels.telegram, {
    enabled: true,
    defaultAccount: cfg.channels.telegram.defaultAccount || 'default',
    dmPolicy: cfg.channels.telegram.dmPolicy || 'open',
    allowFrom: cfg.channels.telegram.allowFrom || ['*'],
    replyToMode: cfg.channels.telegram.replyToMode || 'first',
    reactionLevel: cfg.channels.telegram.reactionLevel || 'minimal',
    actions: cfg.channels.telegram.actions || { sendMessage: true, reactions: true },
    accounts: cfg.channels.telegram.accounts || {},
  });
}

function ensureZaloUserChannel(cfg) {
  cfg.channels.zalouser = cfg.channels.zalouser || {
    enabled: true,
    defaultAccount: 'default',
    accounts: {
      default: {
        enabled: true,
        profile: 'default',
      },
    },
    dmPolicy: 'open',
    groupPolicy: 'open',
    historyLimit: 50,
    groups: {
      '*': { enabled: true, requireMention: false },
    },
    allowFrom: ['*'],
    groupAllowFrom: ['*'],
  };
  // Ensure zalouser is in plugins.entries (plugins.allow is deprecated)
  cfg.plugins.entries = cfg.plugins.entries || {};
  cfg.plugins.entries.zalouser = cfg.plugins.entries.zalouser || { enabled: true };
  cfg.plugins.allow = cfg.plugins.allow || [];
  if (!cfg.plugins.allow.includes('zalouser')) cfg.plugins.allow.push('zalouser');
}

function ensureZaloApiChannel(cfg, token) {
  cfg.channels.zalo = cfg.channels.zalo || {};
  Object.assign(cfg.channels.zalo, {
    enabled: true,
    provider: cfg.channels.zalo.provider || 'official_account',
    botToken: token || cfg.channels.zalo.botToken || '<your_zalo_bot_token>',
  });
}

function ensureZaloModPluginConfig(entry, cfg) {
  entry.hooks = entry.hooks || {};
  entry.hooks.allowConversationAccess = true;
  entry.config = entry.config || {};
  // Auto-assign dashboardPort = gateway port + 1
  if (!entry.config.dashboardPort) {
    const gwPort = Number(cfg.gateway?.port) || state.gatewayPort || 18789;
    entry.config.dashboardPort = gwPort + 1;
  }
  // Auto-assign botName from first agent name
  if (!entry.config.botName) {
    const agentName = cfg.agents?.list?.[0]?.name;
    if (agentName) entry.config.botName = agentName;
  }
  // Auto-assign zaloDisplayNames from botName
  if ((!entry.config.zaloDisplayNames || entry.config.zaloDisplayNames.length === 0) && entry.config.botName) {
    entry.config.zaloDisplayNames = [entry.config.botName];
  }
}

function readProjectConfig(projectDir) {
  const cfgPath = join(projectDir || '', '.openclaw', 'openclaw.json');
  if (!projectDir || !existsSync(cfgPath)) return null;
  return { cfgPath, cfg: null };
}

// Read 9Router endpoint API key from the apiKeys table (NOT providerConnections which stores Gemini/OpenAI keys)
function read9RouterEndpointApiKey(sqlitePath) {
  if (!sqlitePath || !existsSync(sqlitePath)) return '';
  let db;
  try {
    db = new DatabaseSync(sqlitePath, { readOnly: true });
    const rows = db.prepare(`
      SELECT key FROM apiKeys
      WHERE isActive = 1
      ORDER BY createdAt DESC
      LIMIT 1
    `).all();
    return String(rows[0]?.key || '').trim();
  } catch {
    return '';
  } finally {
    try { db?.close(); } catch {}
  }
}

// Keep legacy alias for backward compat
function read9RouterApiKeyFromSqlite(sqlitePath) {
  return read9RouterEndpointApiKey(sqlitePath);
}

async function read9RouterApiKeyFromDocker(containerName) {
  if (!containerName) return '';
  const script = `
const { DatabaseSync } = require('node:sqlite');
let db;
try {
  db = new DatabaseSync('/root/.9router/db/data.sqlite', { readOnly: true });
  const rows = db.prepare("SELECT key FROM apiKeys WHERE isActive = 1 ORDER BY createdAt DESC LIMIT 1").all();
  process.stdout.write(rows[0] && rows[0].key ? rows[0].key : '');
} catch (err) {
  process.stderr.write(String(err && err.message || err));
  process.exit(1);
} finally {
  try { db && db.close(); } catch {}
}`;
  const out = await runCapture('docker', ['exec', containerName, 'node', '-e', script], { shell: false });
  if (out.code !== 0) return '';
  return String(out.stdout || '').trim();
}

async function create9RouterApiKeyFromDocker(containerName, keyName = 'openclaw-bot') {
  if (!containerName) return '';
  const script = `
const api = require('/usr/local/lib/node_modules/9router/src/cli/api/client.js');
api.createApiKey(${JSON.stringify(keyName)}).then((r) => {
  process.stdout.write(JSON.stringify(r || {}));
}).catch((err) => {
  process.stderr.write(String(err && err.message || err));
  process.exit(1);
});
`;
  const out = await runCapture('docker', ['exec', containerName, 'node', '-e', script], { shell: false });
  if (out.code !== 0) return '';
  try {
    const data = JSON.parse(String(out.stdout || '{}'));
    return String(data?.data?.key || '').trim();
  } catch {
    return '';
  }
}

async function resolveProject9RouterApiKey(projectDir, cfg = null) {
  const configApiKey = String(cfg?.models?.providers?.['9router']?.apiKey || '').trim();
  if (configApiKey && configApiKey !== 'sk-no-key') return configApiKey;
  const compose = await readComposeText(projectDir);
  if (compose) {
    const containerName = parseComposeServiceContainerName(compose, '9router') || '9router';
    const dockerApiKey = await read9RouterApiKeyFromDocker(containerName);
    if (dockerApiKey) return dockerApiKey;
    const createdApiKey = await create9RouterApiKeyFromDocker(containerName, `openclaw-${slugify(basename(projectDir || 'openclaw')) || 'bot'}`).catch(() => '');
    if (createdApiKey) return createdApiKey;
  }
  const nativeApiKey = read9RouterApiKeyFromSqlite(join(projectDir || '', '.9router', 'db', 'data.sqlite'));
  if (nativeApiKey) return nativeApiKey;
  const homeApiKey = read9RouterApiKeyFromSqlite(join(os.homedir(), '.9router', 'db', 'data.sqlite'));
  if (homeApiKey) return homeApiKey;
  return '';
}

async function applyResolved9RouterApiKey(projectDir, cfg = null) {
  if (!projectDir) return '';
  const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
  if (!existsSync(cfgPath)) return '';
  const current = cfg || ensureConfigShape(JSON.parse(await fsp.readFile(cfgPath, 'utf8')));
  const apiKey = await resolveProject9RouterApiKey(projectDir, current);
  if (!apiKey) return '';
  current.models = current.models || { mode: 'merge', providers: {} };
  current.models.providers = current.models.providers || {};
  current.models.providers['9router'] = current.models.providers['9router'] || (build9RouterProviderConfig ? build9RouterProviderConfig(get9RouterBaseUrl ? get9RouterBaseUrl(state.mode || 'docker', state.routerPort) : `http://9router:${state.routerPort || 20128}/v1`) : {});
  if (current.models.providers['9router'].apiKey !== apiKey) {
    current.models.providers['9router'].apiKey = apiKey;
    await fsp.writeFile(cfgPath, JSON.stringify(current, null, 2), 'utf8');
  }
  return apiKey;
}

async function readBotCredentials(projectDir) {
  const found = readProjectConfig(projectDir);
  if (!found) return { openclawToken: '', nineRouterApiKey: '' };
  const cfg = ensureConfigShape(JSON.parse(await fsp.readFile(found.cfgPath, 'utf8')));
  return {
    openclawToken: cfg.gateway?.auth?.token || '',
    nineRouterApiKey: await resolveProject9RouterApiKey(projectDir, cfg),
  };
}

async function updateBotCredentials(projectDir, body = {}) {
  const found = readProjectConfig(projectDir);
  if (!found) throw httpError(400, 'Install project not found');
  const raw = await fsp.readFile(found.cfgPath, 'utf8');
  const cfg = ensureConfigShape(JSON.parse(raw));
  const nineRouterApiKey = String(body.nineRouterApiKey || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'nineRouterApiKey')) {
    cfg.models = cfg.models || { mode: 'merge', providers: {} };
    cfg.models.providers = cfg.models.providers || {};
    cfg.models.providers['9router'] = cfg.models.providers['9router'] || (build9RouterProviderConfig ? build9RouterProviderConfig(get9RouterBaseUrl ? get9RouterBaseUrl(state.mode || 'docker', state.routerPort) : `http://9router:${state.routerPort || 20128}/v1`) : {});
    cfg.models.providers['9router'].apiKey = nineRouterApiKey;
    await appendEnvValue(projectDir, 'NINE_ROUTER_API_KEY', nineRouterApiKey);
  }
  await fsp.writeFile(found.cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  return readBotCredentials(projectDir);
}

async function appendEnvValue(projectDir, key, value) {
  const envPath = join(projectDir, '.env');
  const line = `${key}=${value || ''}`;
  let env = existsSync(envPath) ? await fsp.readFile(envPath, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  env = re.test(env) ? env.replace(re, line) : `${env.replace(/\s*$/, '\n')}${line}\n`;
  await fsp.writeFile(envPath, env, 'utf8');
}

function validateOpenclawConfig(cfg) {
  if (!Array.isArray(cfg.agents?.list)) throw httpError(500, 'openclaw.json missing agents.list');
  for (const a of cfg.agents.list) {
    if (!a.id) throw httpError(500, `Invalid agent entry: ${a.id || '(missing id)'}`);
  }
  if (!cfg.channels || typeof cfg.channels !== 'object') throw httpError(500, 'openclaw.json missing channels');

  // Self-healing: Garbage collect any orphaned telegram accounts that are no longer bound to any active agent
  if (cfg.channels?.telegram?.accounts) {
    const boundAccountIds = new Set(
      (cfg.bindings || []).map((b) => b.match?.accountId).filter(Boolean)
    );
    for (const accId of Object.keys(cfg.channels.telegram.accounts)) {
      if (!boundAccountIds.has(accId)) {
        delete cfg.channels.telegram.accounts[accId];
      }
    }
  }
}

function mapAgentChannel(agent, cfg) {
  const agentId = typeof agent === 'string' ? agent : agent?.id;
  if (agent && typeof agent === 'object' && ['telegram', 'zalo-personal', 'zalo-bot'].includes(agent.channel)) return agent.channel;
  const binding = (cfg.bindings || []).find((b) => b.agentId === agentId);
  const ch = binding?.match?.channel;
  if (ch === 'zalouser') return 'zalo-personal';
  if (ch === 'zalo') return 'zalo-bot';
  if (ch === 'telegram') return 'telegram';
  if (cfg.channels?.telegram && agentId) return 'telegram';
  return 'unknown';
}

function mapAgentChannels(agent, cfg) {
  if (agent?.channel && ['telegram', 'zalo-personal', 'zalo-bot'].includes(agent.channel)) return [agent.channel];
  const channels = (cfg.bindings || [])
    .filter((b) => b.agentId === agent?.id)
    .map((b) => b.match?.channel === 'zalouser' ? 'zalo-personal' : b.match?.channel === 'zalo' ? 'zalo-bot' : b.match?.channel)
    .filter((ch) => ['telegram', 'zalo-personal', 'zalo-bot'].includes(ch));
  if (channels.length) return Array.from(new Set(channels));
  const enabled = [];
  if (cfg.channels?.telegram?.enabled) enabled.push('telegram');
  if (cfg.channels?.zalouser?.enabled) enabled.push('zalo-personal');
  if (cfg.channels?.zalo?.enabled) enabled.push('zalo-bot');
  return enabled.length === 1 ? enabled : [mapAgentChannel(agent, cfg)];
}

async function listConfiguredBots(projectDir) {
  const cfgPath = join(projectDir || '', '.openclaw', 'openclaw.json');
  if (!projectDir || !existsSync(cfgPath)) return [];
  const raw = await fsp.readFile(cfgPath, 'utf8');
  const cfg = ensureConfigShape(JSON.parse(raw));
  const normalized = JSON.stringify(cfg, null, 2) + '\n';
  if (normalized !== raw) await fsp.writeFile(cfgPath, normalized, 'utf8');
  const rows = await Promise.all(cfg.agents.list.map(async (agent) => {
    const identity = await readAgentIdentity(projectDir, agent);
    const hasOwnWorkspace = !!agent.workspace;
    const identityName = usableIdentityName(identity.name);
    return mapAgentChannels(agent, cfg).map((channel) => ({
      id: agent.id,
      name: (hasOwnWorkspace ? identityName : agent.name) || agent.name || identityName || agent.id,
      role: identity.role || agent.role || agent.desc || agent.description || '',
      channel,
      workspace: agent.workspace || `.openclaw/${workspaceRelForAgent(agent, cfg, projectDir)}`,
      agentDir: agent.agentDir,
    }));
  }));
  return rows.flat();
}

async function rmInside(root, target) {
  const rootFull = resolve(root);
  const targetFull = resolve(root, target);
  if (targetFull === rootFull || !targetFull.startsWith(rootFull + '\\') && !targetFull.startsWith(rootFull + '/')) {
    throw httpError(403, 'Delete path escapes project');
  }
  await fsp.rm(targetFull, { recursive: true, force: true }).catch(() => {});
}

async function deleteBotInProject(projectDir, agentId) {
  if (!projectDir) throw httpError(400, 'Install project not found');
  const cleanId = slugify(agentId, '');
  if (!cleanId || cleanId !== agentId) throw httpError(400, 'Invalid bot id');
  const openclawHome = join(projectDir, '.openclaw');
  const cfgPath = join(openclawHome, 'openclaw.json');
  if (!existsSync(cfgPath)) throw httpError(404, 'openclaw.json not found');
  const cfg = ensureConfigShape(JSON.parse(await fsp.readFile(cfgPath, 'utf8')));
  const agent = cfg.agents.list.find((a) => a.id === agentId);
  if (!agent) throw httpError(404, 'Bot not found');

  const removedBindings = (cfg.bindings || []).filter((b) => b.agentId === agentId);
  cfg.agents.list = cfg.agents.list.filter((a) => a.id !== agentId);
  cfg.bindings = (cfg.bindings || []).filter((b) => b.agentId !== agentId);
  if (cfg.tools?.agentToAgent?.allow) {
    cfg.tools.agentToAgent.allow = cfg.tools.agentToAgent.allow.filter((id) => id !== agentId);
    if (cfg.tools.agentToAgent.allow.length < 2) delete cfg.tools.agentToAgent;
  }

  for (const binding of removedBindings) {
    const accountId = binding.match?.accountId;
    if (binding.match?.channel === 'telegram' && accountId && cfg.channels?.telegram?.accounts) delete cfg.channels.telegram.accounts[accountId];
  }
  if (cfg.channels?.telegram?.accounts?.[agentId]) delete cfg.channels.telegram.accounts[agentId];

  if (existsSync(cfgPath)) await fsp.copyFile(cfgPath, `${cfgPath}.bak`);
  await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');

  // Also clear bot tokens in .env files if deleting the primary bot
  if (agentId === 'bot') {
    const envPath = join(projectDir, '.env');
    if (existsSync(envPath)) {
      let envContent = await fsp.readFile(envPath, 'utf8');
      envContent = envContent
        .replace(/TELEGRAM_BOT_TOKEN=.*/g, 'TELEGRAM_BOT_TOKEN=')
      await fsp.writeFile(envPath, envContent, 'utf8');

      const dockerEnv = join(projectDir, 'docker', 'openclaw', '.env');
      if (existsSync(dockerEnv)) {
        await fsp.writeFile(dockerEnv, envContent, 'utf8');
      }
    }
  }

  const workspace = workspaceRelForAgent(agent, cfg, projectDir);
  if (workspace) await rmInside(openclawHome, workspace);
  await rmInside(projectDir, join('agents', agentId));
  await rmInside(openclawHome, join('agents', agentId));

  return { ok: true, agentId };
}

function portStatus(port) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: '127.0.0.1', port, timeout: 650 });
    sock.on('connect', () => { sock.destroy(); resolve('online'); });
    sock.on('timeout', () => { sock.destroy(); resolve('offline'); });
    sock.on('error', () => resolve('offline'));
  });
}

async function buildBotStatus() {
  if (state.projectDir) await syncRuntimeState(state.projectDir).catch(() => {});
  const [gatewayStatus, routerStatus, bots, runtimeVersions] = await Promise.all([
    portStatus(state.gatewayPort || 18789).catch(() => state.installed ? 'unknown' : 'offline'),
    portStatus(state.routerPort || 20128).catch(() => state.installed ? 'unknown' : 'offline'),
    listConfiguredBots(state.projectDir).catch(() => []),
    resolveProjectRuntimeVersions(state.projectDir, state.mode).catch(() => ({ openclaw: '', nineRouter: '', node: process.version || '' })),
  ]);
  const credentials = await readBotCredentials(state.projectDir).catch(() => ({ openclawToken: '', nineRouterApiKey: '' }));
  return { ...state, gatewayStatus, routerStatus, bots, credentials, runtimeVersions };
}

async function createBotInProject(projectDir, body = {}, runtime = {}) {
  if (!projectDir) throw httpError(400, 'Install project not found');
  const channel = body.channel || 'telegram';
  if (!['telegram', 'zalo-personal', 'zalo-bot'].includes(channel)) throw httpError(400, 'Unsupported channel');
  const token = String(body.token || '').trim();
  if ((channel === 'telegram' || channel === 'zalo-bot') && !token) throw httpError(400, 'Token is required for this channel');

  const requestedBotName = String(body.botName || '').trim() || 'OpenClaw Bot';
  const botDesc = String(body.role || body.botDesc || '').trim() || 'Personal OpenClaw assistant';
  const persona = String(body.personality || body.persona || '').trim();
  const emoji = String(body.emoji || '').trim();
  const userName = String(body.userName || '').trim();
  const userDesc = String(body.userDescription || body.userDesc || '').trim();
  const userInfo = [userName ? `- **TÃªn:** ${userName}` : '', userDesc ? `- **MÃ´ táº£:** ${userDesc}` : ''].filter(Boolean).join('\n');

  const openclawHome = join(projectDir, '.openclaw');
  await fsp.mkdir(openclawHome, { recursive: true });
  const cfgPath = join(openclawHome, 'openclaw.json');
  const cfg = ensureConfigShape(existsSync(cfgPath) ? JSON.parse(await fsp.readFile(cfgPath, 'utf8')) : buildOpenclawJson({
    botName: requestedBotName,
    channelKey: channel,
    providerKey: '9router',
    deployMode: runtime.mode || state.mode || 'docker',
    osChoice: runtime.os || state.os || detectOs(),
    selectedSkills: [],
    skills: dataExport.SKILLS || [],
    agentMetas: [],
  }));

  const existingAgentCount = cfg.agents.list.length;
  const used = new Set(cfg.agents.list.map((a) => a.id));
  const botName = uniqueDisplayName(requestedBotName, new Set(cfg.agents.list.map((a) => a.name || a.id)));
  const agentId = uniqueSlug(slugify(botName), used);
  const workspaceDir = `workspace-${agentId}`;
  const model = cfg.agents.defaults?.model?.primary || cfg.agents.list[0]?.model?.primary || DEFAULT_MODEL;
  cfg.agents.list.push({
    id: agentId,
    name: botName,
    workspace: `/root/project/.openclaw/${workspaceDir}`,
    agentDir: `agents/${agentId}/agent`,
    model: { primary: model === '9router/smart-route' || model === 'openai/smart-route' ? DEFAULT_MODEL : model, fallbacks: [] },
  });

  let accountId = 'default';
  let warning = '';
  if (channel === 'telegram') {
    ensureTelegramChannel(cfg);
    const accounts = cfg.channels.telegram.accounts || {};
    // Use 'default' for the first telegram account, agentId for subsequent ones
    const existingTelegramAccounts = Object.keys(accounts).filter((k) => accounts[k]?.botToken && accounts[k].botToken !== '<your_bot_token>');
    accountId = existingTelegramAccounts.length === 0 ? 'default' : agentId;
    accounts[accountId] = { botToken: token };
    cfg.channels.telegram.accounts = accounts;
    cfg.channels.telegram.defaultAccount = cfg.channels.telegram.defaultAccount || 'default';
    cfg.bindings.push({ agentId, match: { channel: 'telegram', accountId } });
    await appendEnvValue(projectDir, accountId === 'default' ? 'TELEGRAM_BOT_TOKEN' : `TELEGRAM_BOT_TOKEN_${agentId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`, token);
  } else if (channel === 'zalo-personal') {
    ensureZaloUserChannel(cfg);
    const hasZaloBinding = cfg.bindings.some((b) => b.match?.channel === 'zalouser');
    if (!hasZaloBinding) cfg.bindings.push({ agentId, match: { channel: 'zalouser' } });
    else warning = 'Zalo User already has a channel binding; new agent created, route manually if needed.';
  } else {
    ensureZaloApiChannel(cfg, token);
    const hasZaloApiBinding = cfg.bindings.some((b) => b.match?.channel === 'zalo');
    if (!hasZaloApiBinding) cfg.bindings.push({ agentId, match: { channel: 'zalo' } });
    await appendEnvValue(projectDir, 'ZALO_BOT_TOKEN', token);
  }

  if (cfg.agents.list.length > 1) {
    cfg.tools.agentToAgent = { enabled: true, allow: cfg.agents.list.map((a) => a.id) };
  }
  validateOpenclawConfig(cfg);
  if (existsSync(cfgPath)) await fsp.copyFile(cfgPath, `${cfgPath}.bak`);
  await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');

  const hasScheduler = !!(cfg.tools?.alsoAllow || []).includes('group:automation');
  const files = buildWorkspaceFileMap({
    isVi: true,
    botName,
    botDesc,
    persona,
    emoji,
    userInfo,
    agentWorkspaceDir: workspaceDir,
    workspacePath: `.openclaw/${workspaceDir}`,
    hasZaloMod: channel === 'zalo-personal',
    hasScheduler,
  });
  const wsRoot = join(openclawHome, workspaceDir);
  for (const [name, content] of Object.entries(files)) {
    await fsp.mkdir(dirname(join(wsRoot, name)), { recursive: true });
    await fsp.writeFile(join(wsRoot, name), content || '', 'utf8');
  }

  return { ok: true, agentId, accountId, channel, workspace: `.openclaw/${workspaceDir}`, warning };
}

async function updateBotInProject(projectDir, agentId, body = {}, runtime = {}) {
  if (!projectDir) throw httpError(400, 'Install project not found');
  const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
  if (!existsSync(cfgPath)) throw httpError(404, 'openclaw.json not found');
  const cfg = ensureConfigShape(JSON.parse(await fsp.readFile(cfgPath, 'utf8')));
  const agent = cfg.agents.list.find((a) => a.id === agentId);
  if (!agent) throw httpError(404, 'Bot not found');

  const channel = body.channel || (cfg.bindings || []).find((b) => b.agentId === agentId)?.match?.channel || 'telegram';
  const token = String(body.token || '').trim();
  const botName = uniqueDisplayName(String(body.botName || agent.name || agentId).trim() || agent.name || agentId, new Set(cfg.agents.list.filter((a) => a.id !== agentId).map((a) => a.name || a.id)));
  const botDesc = String(body.role || body.botDesc || agent.role || agent.desc || agent.description || '').trim();
  const persona = String(body.personality || body.persona || '').trim();
  const emoji = String(body.emoji || '').trim();
  const userName = String(body.userName || '').trim();
  const userDesc = String(body.userDescription || body.userDesc || '').trim();
  const userInfo = [userName ? `- **Tên:** ${userName}` : '', userDesc ? `- **Mô tả:** ${userDesc}` : ''].filter(Boolean).join('\n');
  const workspaceDir = workspaceRelForAgent(agent, cfg, projectDir) || `workspace-${agentId}`;
  agent.workspace = `/root/project/.openclaw/${workspaceDir}`;
  agent.agentDir = `agents/${agentId}/agent`;

  // Find the existing accountId from bindings BEFORE removing them
  const existingBinding = (cfg.bindings || []).find((b) => b.agentId === agentId && b.match?.channel === 'telegram');
  const existingAccountId = existingBinding?.match?.accountId || null;
  cfg.bindings = (cfg.bindings || []).filter((b) => b.agentId !== agentId);
  if (channel === 'telegram') {
    ensureTelegramChannel(cfg);
    const accounts = cfg.channels.telegram.accounts || {};
    // Preserve existing accountId; for first/only bot use 'default', otherwise agentId
    const existingTelegramAccounts = Object.keys(accounts).filter((k) => accounts[k]?.botToken);
    const accountId = existingAccountId || (existingTelegramAccounts.length === 0 ? 'default' : agentId);
    // If accountId changed (e.g. was agentId, now should be 'default'), clean up old key
    if (existingAccountId && existingAccountId !== accountId) delete accounts[existingAccountId];
    accounts[accountId] = { botToken: token || accounts[accountId]?.botToken || accounts[existingAccountId]?.botToken || '' };
    cfg.channels.telegram.accounts = accounts;
    cfg.channels.telegram.defaultAccount = cfg.channels.telegram.defaultAccount || 'default';
    cfg.bindings.push({ agentId, match: { channel: 'telegram', accountId } });
  } else if (channel === 'zalo-personal') {
    ensureZaloUserChannel(cfg);
    cfg.bindings.push({ agentId, match: { channel: 'zalouser' } });
  } else {
    ensureZaloApiChannel(cfg, token || cfg.channels?.zalo?.botToken || '');
    cfg.bindings.push({ agentId, match: { channel: 'zalo' } });
  }

  agent.name = botName;
  agent.role = botDesc;
  validateOpenclawConfig(cfg);
  if (existsSync(cfgPath)) await fsp.copyFile(cfgPath, `${cfgPath}.bak`);
  await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');

  // Synchronize the token to .env files for the primary bot to ensure Docker picks it up
  if (agentId === 'bot') {
    const envPath = join(projectDir, '.env');
    if (existsSync(envPath)) {
      let envContent = await fsp.readFile(envPath, 'utf8');
      if (channel === 'telegram') {
        if (envContent.includes('TELEGRAM_BOT_TOKEN=')) {
          envContent = envContent.replace(/TELEGRAM_BOT_TOKEN=.*/g, `TELEGRAM_BOT_TOKEN=${token}`);
        } else {
          envContent += `\nTELEGRAM_BOT_TOKEN=${token}\n`;
        }
      } else if (channel === 'zalo') {
        if (envContent.includes('ZALO_BOT_TOKEN=')) {
          envContent = envContent.replace(/ZALO_BOT_TOKEN=.*/g, `ZALO_BOT_TOKEN=${token}`);
        } else {
          envContent += `\nZALO_BOT_TOKEN=${token}\n`;
        }
      }
      await fsp.writeFile(envPath, envContent, 'utf8');

      const dockerEnv = join(projectDir, 'docker', 'openclaw', '.env');
      if (existsSync(dockerEnv)) {
        await fsp.writeFile(dockerEnv, envContent, 'utf8');
      }
    }
  }

  const hasScheduler = !!(cfg.tools?.alsoAllow || []).includes('group:automation');
  const files = buildWorkspaceFileMap({
    isVi: true,
    botName,
    botDesc,
    persona,
    emoji,
    userInfo,
    agentWorkspaceDir: workspaceDir,
    workspacePath: `.openclaw/${workspaceDir}`,
    hasZaloMod: channel === 'zalo-personal',
    hasScheduler,
  });
  const wsRoot = join(projectDir, '.openclaw', workspaceDir);
  for (const [name, content] of Object.entries(files)) {
    await fsp.mkdir(dirname(join(wsRoot, name)), { recursive: true });
    await fsp.writeFile(join(wsRoot, name), content || '', 'utf8');
  }
  return { ok: true, agentId, channel, workspace: `.openclaw/${workspaceDir}` };
}

function openclawRuntimeEnv(projectDir) {
  return {
    OPENCLAW_HOME: join(projectDir, '.openclaw'),
    OPENCLAW_STATE_DIR: join(projectDir, '.openclaw'),
    DATA_DIR: join(projectDir, '.9router'),
    OPENCLAW_GATEWAY_PORT: String(state.gatewayPort || 18789),
    OPENCLAW_PORT: String(state.gatewayPort || 18789),
  };
}

async function waitForDockerContainer(name, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      let status = '';
      await new Promise((resolve) => {
        const child = spawn('docker', ['inspect', '-f', '{{.State.Running}}', name], { shell: false, windowsHide: true });
        child.stdout.on('data', (d) => { status += String(d); });
        child.on('close', () => resolve());
        child.on('error', () => resolve());
      });
      if (status.trim() === 'true') return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function waitForGatewayZaloReady(botContainer, projectDir, timeoutMs = 90000) {
  const started = Date.now();
  // Use dynamic port from env: OPENCLAW_GATEWAY_PORT → OPENCLAW_PORT → fallback 18789
  const healthScript = 'const http=require("http");const port=process.env.OPENCLAW_GATEWAY_PORT||process.env.OPENCLAW_PORT||18789;const r=http.get("http://127.0.0.1:"+port+"/health",{timeout:2000},(res)=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>{try{const j=JSON.parse(d);process.stdout.write(j.ok?"READY":"WAIT")}catch{process.stdout.write("WAIT")}})});r.on("error",()=>process.stdout.write("WAIT"));r.on("timeout",()=>{r.destroy();process.stdout.write("WAIT")})';
  await waitForDockerContainer(botContainer, 15000);
  let ready = false;
  let attempts = 0;
  while (Date.now() - started < timeoutMs) {
    attempts++;
    try {
      const out = await runCapture('docker', ['exec', botContainer, 'node', '-e', healthScript], { cwd: projectDir, shell: false });
      const status = String(out.stdout || '').trim();
      if (status === 'READY') {
        const pluginCheck = await runCapture('docker', ['exec', botContainer, 'sh', '-c', 'openclaw channels status 2>&1 || true'], { cwd: projectDir, shell: false });
        const output = (pluginCheck.stdout || '') + ' ' + (pluginCheck.stderr || '');
        if (output.toLowerCase().includes('zalouser') || output.toLowerCase().includes('zalo personal')) {
          ready = true;
          break;
        }
        if (attempts > 2) sendLog('[zalouser] Gateway healthy but zalouser not yet loaded (' + Math.round((Date.now() - started) / 1000) + 's)...');
      } else {
        if (attempts > 2 && attempts % 3 === 0) sendLog('[zalouser] Waiting for gateway... (' + Math.round((Date.now() - started) / 1000) + 's)');
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (!ready) {
    sendLog('[zalouser] Gateway readiness timeout after ' + Math.round(timeoutMs / 1000) + 's — proceeding anyway.');
  }
  return ready;
}

async function startZaloUserLogin(projectDir, mode = state.mode) {
  const qrPaths = ['/tmp/openclaw/openclaw-zalouser-qr.png', '/tmp/openclaw/openclaw-zalouser-qr-default.png'];
  if (zaloLoginInFlight) {
    setImmediate(async () => {
      try {
        const botContainer = getBotContainerName(projectDir);
        const js = `const fs=require('fs');const ps=${JSON.stringify(qrPaths)};for(const p of ps){try{if(fs.existsSync(p)&&fs.statSync(p).size>100){process.stdout.write(fs.readFileSync(p).toString('base64'));break;}}catch{}}`;
        const out = await runCapture('docker', ['exec', botContainer, 'node', '-e', js], { cwd: projectDir, shell: false });
        const b64 = extractCompletePngBase64(out.stdout);
        if (b64.length > 100) {
          sendLog(`[zalouser:qr] data:image/png;base64,${b64}`);
          sendLog('[zalouser] Found running login session. Displaying current QR code.');
        }
      } catch {}
    });
    return { message: 'Zalo login is already running. Keep this modal open...' };
  }
  zaloLoginInFlight = true;
  sendLog('[zalouser] Preparing login. QR will be generated for the UI modal.');
  const composeFile = join(projectDir, 'docker', 'openclaw', 'docker-compose.yml');
  if ((mode === 'docker' || existsSync(composeFile)) && existsSync(composeFile)) {
    const botContainer = getBotContainerName(projectDir);
    // Verify if zalouser is properly registered in installs.json with channels array.
    // npm install --prefix misses this, which causes error:not configured.
    const checkRegistryScript = `
const fs = require('fs');
try {
  const dist = '/root/project/.openclaw/npm/node_modules/@openclaw/zalouser/dist/index.js';
  const inst = '/root/project/.openclaw/plugins/installs.json';
  if (!fs.existsSync(dist)) { console.log('MISSING'); process.exit(0); }
  if (!fs.existsSync(inst)) { console.log('MISSING_CHANNELS'); process.exit(0); }
  const j = JSON.parse(fs.readFileSync(inst, 'utf8'));
  const z = j.plugins.find(x => x.pluginId === 'zalouser');
  if (z && z.channels && z.channels.includes('zalouser')) {
    console.log('OK');
  } else {
    console.log('MISSING_CHANNELS');
  }
} catch(e) { console.log('MISSING'); }
`;
    const checkInstall = await runCapture('docker', ['exec', botContainer, 'node', '-e', checkRegistryScript], { cwd: projectDir, shell: false }).catch(() => ({ stdout: 'MISSING' }));
    const status = String(checkInstall.stdout || '').trim();
    if (status !== 'OK') {
      sendLog(status === 'MISSING' ? '[zalouser] Plugin not found — installing @openclaw/zalouser...' : '[zalouser] Plugin registry missing channels array — fixing install via CLI...');
      
      const fixScript = `
const fs=require('fs');
const cp=require('child_process');
const cfg='/root/project/.openclaw/openclaw.json';
const bk='/root/project/.openclaw/openclaw.json.zalo-backup';
try{if(fs.existsSync(cfg))fs.copyFileSync(cfg,bk);}catch(e){}
// Detect gateway version and pin zalouser plugin to match, preventing createSetupTranslator mismatch
let gatewayVer='';
try{gatewayVer=cp.execSync('openclaw --version 2>/dev/null',{encoding:'utf8'}).trim().replace(/[^0-9.]/g,'');}catch(e){}
const pluginSpec=gatewayVer ? '@openclaw/zalouser@'+gatewayVer : '@openclaw/zalouser';
console.log('Installing plugin via CLI: '+pluginSpec+'...');
try{cp.execSync('cd /root/project && openclaw plugins install '+pluginSpec+' --force',{stdio:'inherit'});}catch(e){
  // Fallback: try without version pin if exact version not found on registry
  if(gatewayVer){console.log('Pinned version failed, trying latest...');try{cp.execSync('cd /root/project && openclaw plugins install @openclaw/zalouser --force',{stdio:'inherit'});}catch(e2){console.error('Install failed');}}
  else{console.error('Install failed');}
}
try{
  if(fs.existsSync(bk)){
    const b=JSON.parse(fs.readFileSync(bk,'utf8'));
    const c=JSON.parse(fs.readFileSync(cfg,'utf8'));
    const keys=['agents','channels','bindings','gateway','models'];
    for(const k of keys){if(b[k])c[k]=b[k];}
    if(b.plugins){
      if(b.plugins.allow)c.plugins={...c.plugins,allow:b.plugins.allow};
      if(b.plugins.deny)c.plugins={...c.plugins,deny:b.plugins.deny};
      if(b.plugins.entries)c.plugins={...c.plugins,entries:b.plugins.entries};
    }
    if(!c.plugins)c.plugins={};if(!c.plugins.entries)c.plugins.entries={};
    if(!c.plugins.entries.zalouser)c.plugins.entries.zalouser={};
    c.plugins.entries.zalouser.enabled=true;
    fs.writeFileSync(cfg,JSON.stringify(c,null,2)+'\\n','utf8');
    fs.unlinkSync(bk);
    console.log('Config protected and restored.');
  }
}catch(e){}
try{
  console.log('Patching zalouser stability settings...');
  cp.execSync('ZALO_JS=$(find "/root/project/.openclaw" -path "*/zalouser/dist/zalo-js*.js" -type f 2>/dev/null | head -1); if [ -n "$ZALO_JS" ]; then sed -i "s/LISTENER_WATCHDOG_MAX_GAP_MS = 35e3/LISTENER_WATCHDOG_MAX_GAP_MS = 120e3/g" "$ZALO_JS"; echo "Patched watchdog gap to 120s"; fi', {shell:true,stdio:'inherit'});
}catch(e){}
try{
  const ep = '/root/project/docker/openclaw/entrypoint.sh';
  if (fs.existsSync(ep)) {
    let content = fs.readFileSync(ep, 'utf8');
    if (!content.includes('zalo-monitor')) {
      const monitor = "\\n# Zalo channel auto-restart monitor (background)\\n(\\n  sleep 180\\n  while true; do\\n    sleep 60\\n    STATUS=$(openclaw channels status 2>/dev/null | grep -i \\"Zalo Personal\\" || true)\\n    if echo \\"$STATUS\\" | grep -qi \\"stopped\\"; then\\n      echo \\"[zalo-monitor] Zalo channel stopped - restarting container in 5s\\"\\n      sleep 5\\n      kill 1 2>/dev/null || true\\n    fi\\n  done\\n) &\\n";
      // Insert before 'openclaw gateway run'
      const target = 'openclaw gateway run';
      if (content.includes(target)) {
        content = content.replace(target, monitor + target);
        fs.writeFileSync(ep, content, 'utf8');
        console.log('Added auto-restart monitor to entrypoint.sh');
      }
    }
  }
}catch(e){}
`;
      const install = await runCapture('docker', ['exec', botContainer, 'node', '-e', fixScript], { cwd: projectDir, shell: false });
      for (const line of `${install.stdout}\n${install.stderr}`.split(/\r?\n/).filter(Boolean)) sendLog(line);
      // Restart the gateway to load the new installs.json channels array so `openclaw channels login` works
      await restartDockerBotContainer(projectDir).catch((err) => sendLog(`[docker] restart skipped/failed: ${err.message}`));
      // Wait for gateway to fully reload zalouser plugin after restart (~20s for plugin load + buffer)
      sendLog('[zalouser] Waiting for gateway to load zalouser plugin...');
      await waitForGatewayZaloReady(botContainer, projectDir);
      sendLog('[zalouser] Gateway ready with zalouser plugin.');
    } else {
      sendLog('[zalouser] Plugin already properly installed with channels array — skipping install.');
      // Even when plugin is installed, gateway may still be booting (e.g. after recreateDockerBot)
      await waitForGatewayZaloReady(botContainer, projectDir);
    }
    
    // Clean old credentials & QR files inside container
    const credPath = '/root/project/.openclaw/credentials/zalouser/credentials.json';
    await runCapture('docker', ['exec', botContainer, 'sh', '-lc', `rm -f ${credPath} ${qrPaths.join(' ')}`], { cwd: projectDir, shell: false });
    
    sendLog('[zalouser] Generating Zalo QR. The image will appear automatically.');
    const loginCmd = 'cd /root/project && openclaw channels login --channel zalouser --verbose';
    
    // Retry-based login: the zalouser plugin may need time to connect to Zalo servers.
    // The CLI often exits with "Still preparing QR" on the first attempt.
    const MAX_LOGIN_ATTEMPTS = 4;
    const RETRY_DELAYS = [0, 8000, 15000, 20000];
    let restartAfterLogin = false;
    let loginAttempt = 0;
    let sent = false;

    // Start QR file polling in parallel (runs across all retry attempts)
    let tries = 0;
    const poll = setInterval(async () => {
      if (sent || tries++ > 120) {
        clearInterval(poll);
        if (!sent) sendLog('[zalouser] QR not found yet. Try closing/reopening login or recreate Zalo User bot.');
        return;
      }
      const js = `const fs=require('fs');const ps=${JSON.stringify(qrPaths)};for(const p of ps){try{if(fs.existsSync(p)&&fs.statSync(p).size>100){process.stdout.write(fs.readFileSync(p).toString('base64'));break;}}catch{}}`;
      const out = await runCapture('docker', ['exec', botContainer, 'node', '-e', js], { cwd: projectDir, shell: false });
      const b64 = extractCompletePngBase64(out.stdout);
      if (b64.length > 100) {
        sent = true;
        clearInterval(poll);
        sendLog(`[zalouser:qr] data:image/png;base64,${b64}`);
        sendLog('[zalouser] Scan this QR with the Zalo app.');
      }
    }, 1000);

    const runLoginAttempt = () => {
      loginAttempt++;
      if (loginAttempt > 1) sendLog(`[zalouser] Retry attempt ${loginAttempt}/${MAX_LOGIN_ATTEMPTS}...`);
      const child = spawn('docker', ['exec', botContainer, 'sh', '-lc', loginCmd], { cwd: projectDir, shell: false, windowsHide: true });
      const handleLoginLine = (line) => {
        sendLog(line);
        if (/login successful|saved auth/i.test(line)) restartAfterLogin = true;
      };
      child.stdout.on('data', (d) => String(d).split(/\r?\n/).filter(Boolean).forEach(handleLoginLine));
      child.stderr.on('data', (d) => String(d).split(/\r?\n/).filter(Boolean).forEach(handleLoginLine));
      child.on('error', (err) => sendLog(`[zalouser] Login process failed: ${err.message}`));
      child.on('close', async (code) => {
        sendLog(`[zalouser] Login process exited ${code}`);
        if (code === 0 || restartAfterLogin || sent) {
          // Success or QR already found by poll
          if (restartAfterLogin) {
            sendLog(`[zalouser] Login saved. Restarting ${botContainer} container so Zalo User can receive messages...`);
            await restartDockerBotContainer(projectDir).catch((err) => sendLog(`[zalouser] Container restart failed: ${err.message}`));
            sendLog(`[zalouser] ${botContainer} restarted. Try sending a Zalo message now.`);
          }
          zaloLoginInFlight = false;
        } else if (loginAttempt < MAX_LOGIN_ATTEMPTS && !sent) {
          // Failed with "Still preparing QR" — retry after delay
          const delay = RETRY_DELAYS[loginAttempt] || 10000;
          sendLog(`[zalouser] QR not ready yet. Waiting ${delay / 1000}s before retry...`);
          setTimeout(runLoginAttempt, delay);
        } else {
          sendLog('[zalouser] All login attempts exhausted. Try clicking "Đăng nhập Zalo" again.');
          zaloLoginInFlight = false;
        }
      });
    };

    runLoginAttempt();
    return { message: 'Generating Zalo QR. The image will appear automatically.' };
  }
  zaloLoginInFlight = false;
  return { message: 'Native Zalo login UI not implemented yet in local setup.' };
}

function getBotServiceName(projectDir) {
  const composeFile = join(projectDir || state.projectDir || '', 'docker', 'openclaw', 'docker-compose.yml');
  if (!existsSync(composeFile)) return 'ai-bot';
  try {
    const content = fs.readFileSync(composeFile, 'utf8');
    const servicesMatch = content.match(/services:\s*\n([\s\S]+?)(?=\n\S|\n$)/);
    if (servicesMatch) {
      const servicesText = servicesMatch[1];
      const keys = Array.from(servicesText.matchAll(/^\s{2}([a-zA-Z0-9_-]+):/gm)).map(m => m[1]);
      const botService = keys.find(k => k !== '9router');
      if (botService) return botService;
    }
  } catch (e) {}
  return 'ai-bot';
}

function getBotContainerName(projectDir) {
  const composeFile = join(projectDir || state.projectDir || '', 'docker', 'openclaw', 'docker-compose.yml');
  if (!existsSync(composeFile)) return 'openclaw-bot';
  try {
    const content = fs.readFileSync(composeFile, 'utf8');
    const containerMatch = content.match(/container_name:\s*([a-zA-Z0-9_-]+)/);
    if (containerMatch) return containerMatch[1];
  } catch (e) {}
  return 'openclaw-bot';
}

async function syncDockerInfra(projectDir, force = false) {
  const dockerDir = join(projectDir, 'docker', 'openclaw');
  if (!existsSync(join(dockerDir, 'docker-compose.yml'))) return false;

  // Check existing entrypoint version stamp
  const entrypointPath = join(dockerDir, 'entrypoint.sh');
  const existingEntrypoint = existsSync(entrypointPath)
    ? await fsp.readFile(entrypointPath, 'utf8').catch(() => '') : '';
  const existingVersion = (existingEntrypoint.match(/# openclaw-setup v([\d.]+)/) || [])[1] || '0.0.0';

  // Only regenerate if version differs OR force is true
  if (existingVersion === SETUP_VERSION && !force) return false;

  // Read existing compose to preserve customizations
  const compose = await readComposeText(projectDir);
  const botContainer = parseComposeServiceContainerName(compose, 'ai-bot') || `openclaw-${slugify(basename(projectDir))}`;
  const routerContainer = parseComposeServiceContainerName(compose, '9router') || `9router-${slugify(basename(projectDir))}`;
  const composeName = (compose.match(/^name:\s*(\S+)/m) || [])[1] || `oc-${slugify(basename(projectDir))}`;
  const gatewayPort = state.gatewayPort || 18789;
  const routerPort = state.routerPort || 20128;

  // Detect features from openclaw.json
  const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
  let hasZalo = false;
  try {
    const cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
    hasZalo = !!cfg.channels?.zalouser?.enabled;
  } catch {}

  // Regenerate with detected settings
  const docker = buildDockerArtifacts({
    is9Router: true,
    openClawNpmSpec: OPENCLAW_NPM_SPEC,
    openClawRuntimePackages: '',
    allSkills: [],
    dockerfilePlugins: [],
    gatewayPort,
    routerPort,
    singleComposeName: composeName,
    singleAppContainerName: botContainer,
    singleRouterContainerName: routerContainer,
    runtimeCommandParts: [
      hasZalo ? 'ensure_zalouser' : '',
      'while true; do sleep 5; openclaw devices approve --latest 2>/dev/null || true; done >/dev/null 2>&1 &',
    ].filter(Boolean),
    plainSingleExtraHosts: true,
  });

  // Inject version stamp into entrypoint
  let entryScript = docker.entrypointScript || '';
  entryScript = entryScript.replace('#!/bin/sh', `#!/bin/sh\n# openclaw-setup v${SETUP_VERSION}`);

  // Write updated files preserving env_file path convention
  const newCompose = String(docker.compose || '')
    .replace(/env_file:\s*\n\s*-\s*\.env/g, 'env_file:\n      - ../../.env')
    .replace(/env_file:\s*\.env/g, 'env_file: ../../.env');

  sendLog(`[sync] Updating Docker infrastructure files (v${existingVersion} \u2192 v${SETUP_VERSION})`);
  await fsp.writeFile(join(dockerDir, 'Dockerfile'), docker.dockerfile, 'utf8');
  await fsp.writeFile(join(dockerDir, 'docker-compose.yml'), newCompose, 'utf8');
  // Preserve zalo-mod dashboard port if plugin is active
  try {
    const syncCfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
    const zmEntry = syncCfg.plugins?.entries?.['zalo-mod'] || syncCfg.plugins?.entries?.['openclaw-zalo-mod'];
    if (zmEntry?.enabled !== false && zmEntry?.config?.dashboardPort) {
      const dp = zmEntry.config.dashboardPort;
      let cc = await fsp.readFile(join(dockerDir, 'docker-compose.yml'), 'utf8');
      if (!cc.includes(`:${dp}`)) {
        const gpStr = String(gatewayPort);
        cc = cc.replace(
          new RegExp(`^(\\s*-\\s*"(?:\\d+:)?${gpStr}(?::${gpStr})?"\\s*)$`, 'm'),
          `$1\n      - "127.0.0.1:${dp}:${dp}"  # zalo-mod dashboard`
        );
        await fsp.writeFile(join(dockerDir, 'docker-compose.yml'), cc, 'utf8');
      }
    }
  } catch {}
  await fsp.writeFile(entrypointPath, entryScript, 'utf8');
  if (docker.syncScript) await fsp.writeFile(join(dockerDir, 'sync.js'), docker.syncScript, 'utf8');
  if (docker.patchScript) await fsp.writeFile(join(dockerDir, 'patch-9router.js'), docker.patchScript, 'utf8');

  sendLog(`[sync] Docker files updated to v${SETUP_VERSION}. Next rebuild will use new infrastructure.`);
  return true;
}

async function recreateDockerBot(projectDir) {
  const composeFile = join(projectDir, 'docker', 'openclaw', 'docker-compose.yml');
  if (!existsSync(composeFile)) return false;
  const depDir = join(projectDir, '.openclaw', 'plugin-runtime-deps');
  await fsp.mkdir(depDir, { recursive: true }).catch(() => {});
  const serviceName = getBotServiceName(projectDir);
  const containerName = getBotContainerName(projectDir);
  sendLog(`[docker] Recreating ${serviceName} to reload openclaw.json/.env...`);
  await run('docker', ['compose', '-f', composeFile, 'up', '-d', '--build', '--force-recreate', serviceName], { cwd: projectDir });
  await waitForDockerContainer(containerName);
  return true;
}

async function updateRuntime(target, projectDir) {
  const isRouter = target === '9router';
  const spec = isRouter ? NINE_ROUTER_NPM_SPEC : OPENCLAW_NPM_SPEC;
  if (state.mode === 'docker' && projectDir) {
    const dockerDir = join(projectDir, 'docker', 'openclaw');
    if (isRouter) {
      await run('docker', ['compose', 'pull', '9router'], { cwd: dockerDir }).catch(() => {});
      await run('docker', ['compose', 'up', '-d', '--force-recreate', '9router'], { cwd: dockerDir });
    } else {
      // Ensure Docker files are current before rebuilding
      await syncDockerInfra(projectDir).catch(() => {});
      const serviceName = getBotServiceName(projectDir);
      const containerName = getBotContainerName(projectDir);
      await run('docker', ['compose', 'build', '--no-cache', serviceName], { cwd: dockerDir });
      await run('docker', ['compose', 'up', '-d', '--force-recreate', serviceName], { cwd: dockerDir });
    }
    await syncRuntimeState(projectDir).catch(() => {});
    return { ok: true, target, spec, mode: 'docker' };
  }
  await run('npm', ['install', '-g', spec]);
  if (isRouter) {
    await run('openclaw', ['gateway', 'stop'], { cwd: projectDir }).catch(() => {});
    await run('npm', ['install', '-g', NINE_ROUTER_NPM_SPEC]);
  } else {
    await run('npm', ['install', '-g', OPENCLAW_NPM_SPEC]);
  }
  await syncRuntimeState(projectDir).catch(() => {});
  return { ok: true, target, spec, mode: 'native' };
}

async function restartDockerBotContainer(projectDir = state.projectDir) {
  const containerName = getBotContainerName(projectDir);
  sendLog(`[docker] Restarting ${containerName} container...`);
  await run('docker', ['restart', containerName], { shell: false });
  await waitForDockerContainer(containerName);
  return true;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

async function writeCoreProject({ projectDir, osChoice, mode, gatewayPort = 18789, routerPort = 20128 }) {
  await fsp.mkdir(projectDir, { recursive: true });
  const openclawHome = join(projectDir, '.openclaw');
  await fsp.mkdir(openclawHome, { recursive: true });
  await fsp.mkdir(join(openclawHome, 'plugin-runtime-deps'), { recursive: true });

  const selectedSkills = [];
  const botName = 'OpenClaw Bot';
  const agentMetas = [{ agentId: 'bot', name: botName, description: 'Personal OpenClaw assistant' }];
  const common = { botName, channelKey: 'telegram', providerKey: '9router', model: DEFAULT_MODEL, deployMode: mode, osChoice, selectedSkills, skills: dataExport.SKILLS || [], agentMetas, gatewayPort, routerPort };
  const cfg = buildOpenclawJson(common);
  const env = buildEnvFileContent({ ...common, apiKey: '', botToken: '' });
  const approvals = buildExecApprovalsJson({ agentMetas });

  await fsp.writeFile(join(openclawHome, 'openclaw.json'), JSON.stringify(cfg, null, 2), 'utf8');
  await fsp.writeFile(join(projectDir, '.env'), env, 'utf8');
  await fsp.writeFile(join(openclawHome, 'exec-approvals.json'), JSON.stringify(approvals, null, 2), 'utf8');

  const workspaceDir = 'workspace-bot';
  const workspace = buildWorkspaceFileMap({
    isVi: true,
    botName,
    channelKey: 'telegram',
    providerKey: '9router',
    selectedSkills,
    skillsCatalog: dataExport.SKILLS || [],
    agentMetas,
    deployMode: mode,
    osChoice,
    agentWorkspaceDir: workspaceDir,
    workspacePath: `.openclaw/${workspaceDir}`,
  });
  const wsRoot = join(openclawHome, workspaceDir);
  for (const [name, content] of Object.entries(workspace)) {
    await fsp.mkdir(dirname(join(wsRoot, name)), { recursive: true });
    await fsp.writeFile(join(wsRoot, name), content || '', 'utf8');
  }

  if (mode === 'docker') {
    const projectName = slugify(basename(projectDir)) || 'bot';
    const docker = buildDockerArtifacts({
      is9Router: true,
      osChoice,
      openClawNpmSpec: OPENCLAW_NPM_SPEC,
      allSkills: [],
      dockerfilePlugins: [],
      gatewayPort,
      routerPort,
      singleComposeName: `oc-${projectName}`,
      singleAppContainerName: `openclaw-${projectName}`,
      singleRouterContainerName: `9router-${projectName}`,
    });
    const dockerDir = join(projectDir, 'docker', 'openclaw');
    await fsp.mkdir(dockerDir, { recursive: true });
    const compose = String(docker.compose || '')
      .replace(/env_file:\s*\n\s*-\s*\.env/g, 'env_file:\n      - ../../.env')
      .replace(/env_file:\s*\.env/g, 'env_file: ../../.env');
    sendLog(`[writeCoreProject] Writing docker files to ${dockerDir} (compose ${compose.length} bytes, routerPort=${routerPort})`);
    await fsp.writeFile(join(dockerDir, 'Dockerfile'), docker.dockerfile, 'utf8');
    await fsp.writeFile(join(dockerDir, 'docker-compose.yml'), compose, 'utf8');
    const entryScript = (docker.entrypointScript || docker.entrypoint || '').replace('#!/bin/sh', `#!/bin/sh\n# openclaw-setup v${SETUP_VERSION}`);
    await fsp.writeFile(join(dockerDir, 'entrypoint.sh'), entryScript, 'utf8');
    // Write 9router helper scripts as separate files (mounted as volumes)
    if (docker.syncScript) await fsp.writeFile(join(dockerDir, 'sync.js'), docker.syncScript, 'utf8');
    if (docker.patchScript) await fsp.writeFile(join(dockerDir, 'patch-9router.js'), docker.patchScript, 'utf8');
    // docker-compose.yml uses env_file: .env relative to docker/openclaw.
    await fsp.writeFile(join(dockerDir, '.env'), env, 'utf8');
  }
}

async function installCore({ osChoice, mode, projectDir, gatewayPort = 18789, routerPort = 20128 }) {
  state.installing = true;
  state.installed = false;
  state.lastError = null;
  state.projectDir = projectDir;
  state.mode = mode;
  state.os = osChoice;
  state.startedAt = new Date().toISOString();
  try {
    sendLog('OpenClaw local installer started');
    sendLog(`Target: OS=${osChoice}, mode=${mode}, project=${projectDir}, gatewayPort=${gatewayPort}, routerPort=${routerPort}`);
    await writeCoreProject({ projectDir, osChoice, mode, gatewayPort, routerPort });
    await run('npm', ['install', '-g', OPENCLAW_NPM_SPEC]);
    await run('npm', ['install', '-g', NINE_ROUTER_NPM_SPEC]);
    if (mode === 'docker') {
      const dockerDir = join(projectDir, 'docker', 'openclaw');
      const rootEnvPath = join(projectDir, '.env');
      const dockerEnvPath = join(dockerDir, '.env');
      await fsp.mkdir(dockerDir, { recursive: true });
      const envContent = existsSync(rootEnvPath)
        ? await fsp.readFile(rootEnvPath, 'utf8')
        : buildEnvFileContent({ botName: 'OpenClaw Bot', channelKey: 'telegram', providerKey: '9router', deployMode: mode, osChoice, selectedSkills: [], skills: dataExport.SKILLS || [], agentMetas: [{ agentId: 'bot', name: 'OpenClaw Bot', description: 'Personal OpenClaw assistant' }], apiKey: '', botToken: '' });
      await fsp.writeFile(dockerEnvPath, envContent, 'utf8');
      sendLog(`Docker env ready: ${dockerEnvPath}`);
      await run('docker', ['compose', 'up', '-d', '--build'], { cwd: dockerDir });
      await applyResolved9RouterApiKey(projectDir).catch(() => {});
      await recreateDockerBot(projectDir).catch(() => {});
    } else {
      const runtimeEnv = {
        OPENCLAW_HOME: join(projectDir, '.openclaw'),
        OPENCLAW_STATE_DIR: join(projectDir, '.openclaw'),
        DATA_DIR: join(projectDir, '.9router'),
        OPENCLAW_GATEWAY_PORT: String(gatewayPort),
        OPENCLAW_PORT: String(gatewayPort),
      };
      await run('openclaw', ['gateway', 'stop'], { cwd: projectDir, env: runtimeEnv }).catch(() => {});
      startDetached('9router', ['-n', '-l', '-H', '127.0.0.1', '-p', String(routerPort), '--skip-update'], { cwd: projectDir, env: runtimeEnv });
      state.botPid = startDetached('openclaw', ['gateway', 'run'], { cwd: projectDir, env: runtimeEnv });
      sendLog(`Native gateway started in background (pid=${state.botPid || 'unknown'})`);
    }
    state.installed = true;
    sendLog('✅ Install completed');
    sendLog(`Gateway: ${state.gatewayUrl}`);
    sendLog(`9Router: http://127.0.0.1:${state.routerPort || routerPort}`);
  } catch (err) {
    state.lastError = err.message;
    sendLog(`ERROR: ${err.message}`);
    throw err;
  } finally {
    state.installing = false;
  }
}

async function listMarkdownFiles(projectDir, agentId = '') {
  const out = [];
  const home = join(projectDir, '.openclaw');
  const cfgPath = join(home, 'openclaw.json');
  const cfg = existsSync(cfgPath) ? ensureConfigShape(JSON.parse(await fsp.readFile(cfgPath, 'utf8'))) : null;
  const agent = agentId && cfg ? cfg.agents.list.find((a) => a.id === agentId) : null;
  const workspaceDirs = agent
    ? [workspaceRelForAgent(agent, cfg, projectDir)]
    : [];
  if (agentId && !agent) throw httpError(404, 'Bot not found');
  const textExt = new Set(['.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.yml', '.yaml', '.env', '.sh', '.bat', '.ps1', '.html', '.css']);
  async function walk(absDir, relDir = '', depth = 0) {
    if (depth > 8) return;
    const entries = await fsp.readdir(absDir, { withFileTypes: true }).catch(() => []);
    for (const e of entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'plugin-runtime-deps') continue;
      const abs = join(absDir, e.name);
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      const relProject = rel.replace(/\\/g, '/');
      if (e.isDirectory()) {
        out.push({ name: relProject, path: relProject, type: 'dir' });
        await walk(abs, relProject, depth + 1);
        continue;
      }
      const st = await fsp.stat(abs).catch(() => null);
      const ext = extname(e.name).toLowerCase() || (e.name === '.env' ? '.env' : '');
      const isText = !!st && st.size <= 1024 * 1024 && (textExt.has(ext) || !ext);
      out.push({ name: relProject, path: relProject, type: 'file', content: isText ? await fsp.readFile(abs, 'utf8').catch(() => '') : '', editable: isText });
    }
  }
  if (existsSync(home)) {
    const dirs = workspaceDirs.length
      ? workspaceDirs
      : (await fsp.readdir(home, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory() && (d.name === 'workspace' || d.name.startsWith('workspace-'))).map((d) => d.name);
    for (const dir of dirs) {
      const abs = join(home, dir);
      if (existsSync(abs)) await walk(abs, `.openclaw/${dir}`);
    }
    // Also include project-level config files from .openclaw root
    const rootEntries = await fsp.readdir(home, { withFileTypes: true }).catch(() => []);
    const extraDirs = new Set(['extensions', 'plugins', 'agents', 'credentials']);
    for (const e of rootEntries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))) {
      if (e.isDirectory()) {
        // Walk extensions/ and agents/ directories so plugins show up in the tree
        if (extraDirs.has(e.name)) {
          const abs = join(home, e.name);
          await walk(abs, `.openclaw/${e.name}`);
        }
        continue;
      }
      const abs = join(home, e.name);
      const rel = `.openclaw/${e.name}`;
      const ext = extname(e.name).toLowerCase();
      const isText = textExt.has(ext);
      if (!isText) continue;
      const st = await fsp.stat(abs).catch(() => null);
      if (!st || st.size > 1024 * 1024) continue;
      out.push({ name: rel, path: rel, type: 'file', content: await fsp.readFile(abs, 'utf8').catch(() => ''), editable: true });
    }
  }
  return out;
}

async function saveState(rootProjectDir) {
  const file = join(rootProjectDir, STATE_FILE);
  await fsp.writeFile(file, JSON.stringify({
    projectDir: state.projectDir,
    mode: state.mode,
    os: state.os,
    installed: state.installed,
    gatewayUrl: state.gatewayUrl,
    gatewayPort: state.gatewayPort,
    routerUrl: state.routerUrl,
    routerPort: state.routerPort,
  }, null, 2), 'utf8').catch(() => {});
}

async function loadSavedState(rootProjectDir) {
  const file = join(rootProjectDir, STATE_FILE);
  if (!existsSync(file)) return;
  const saved = JSON.parse(await fsp.readFile(file, 'utf8'));
  if (saved?.projectDir && existsSync(join(saved.projectDir, '.openclaw', 'openclaw.json'))) {
    Object.assign(state, saved, { installed: !!saved.installed });
    await syncRuntimeState(state.projectDir);
  }
}

async function findLatestProject(rootProjectDir) {
  const roots = [
    process.env.OPENCLAW_PROJECT_DIR,
    process.env.OPENCLAW_HOME ? dirname(process.env.OPENCLAW_HOME) : '',
    rootProjectDir,
    join(rootProjectDir, DEFAULT_PROJECT_NAME),
    dirname(rootProjectDir),
    os.homedir(),
  ];
  // Scan all available drives, walking top-level dirs but skipping system folders
  const drives = await getAvailableDrives();
  for (const drive of drives) {
    const entries = await fsp.readdir(drive, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('$') && !SYSTEM_DIR_BLACKLIST.has(e.name.toLowerCase())) {
        roots.push(join(drive, e.name));
      }
    }
  }
  const candidates = [];
  async function walk(dir, depth = 0) {
    if (!dir || depth > 2 || !existsSync(dir)) return;
    if (existsSync(join(dir, '.openclaw', 'openclaw.json'))) {
      const st = await fsp.stat(join(dir, '.openclaw', 'openclaw.json')).catch(() => null);
      if (st) candidates.push({ dir, mtimeMs: st.mtimeMs });
      return;
    }
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && !SYSTEM_DIR_BLACKLIST.has(e.name.toLowerCase())) {
        await walk(join(dir, e.name), depth + 1);
      }
    }
  }
  for (const r of roots) await walk(r);
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.dir || null;
}

async function discoverProjects(rootProjectDir) {
  const roots = [
    process.env.OPENCLAW_PROJECT_DIR,
    rootProjectDir,
    dirname(rootProjectDir),
    process.env.OPENCLAW_HOME ? dirname(process.env.OPENCLAW_HOME) : '',
  ];
  // Add all available drives for scanning
  const drives = await getAvailableDrives();
  for (const drive of drives) roots.push(drive);
  const seen = new Set();
  const hits = [];
  async function walk(dir, depth = 0) {
    if (!dir || depth > 2 || !existsSync(dir)) return;
    const full = resolve(dir);
    if (full === resolve(os.homedir())) return;
    if (seen.has(full)) return;
    seen.add(full);
    const cfgPath = join(full, '.openclaw', 'openclaw.json');
    if (existsSync(cfgPath)) {
      const st = await fsp.stat(cfgPath).catch(() => null);
      const runtime = await detectRuntime(full).catch(() => ({ mode: 'unknown', gatewayPort: 0, routerPort: 0, syncSource: 'config' }));
      const bots = await listConfiguredBots(full).catch(() => []);
      const uniqueBotCount = new Set(bots.map((b) => b.id)).size;
      const hasDocker = existsSync(join(full, 'docker', 'openclaw', 'docker-compose.yml'));
      const isLikelyProject = uniqueBotCount > 0 || hasDocker || existsSync(join(full, '.env')) || existsSync(join(full, 'package.json'));
      if (!isLikelyProject) return;
      hits.push({
        projectDir: full,
        os: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux',
        mode: runtime.mode || 'unknown',
        gatewayPort: runtime.gatewayPort || 0,
        routerPort: runtime.routerPort || 0,
        syncSource: runtime.syncSource || 'config',
        botCount: uniqueBotCount,
        hasDocker,
        updatedAt: st?.mtimeMs || 0,
      });
      return;
    }
    const entries = await fsp.readdir(full, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === 'node_modules' || e.name.startsWith('.git') || SYSTEM_DIR_BLACKLIST.has(e.name.toLowerCase())) continue;
      await walk(join(full, e.name), depth + 1);
    }
  }
  for (const root of roots) await walk(root);
  hits.sort((a, b) =>
    (b.botCount - a.botCount) ||
    (Number(b.hasDocker) - Number(a.hasDocker)) ||
    (b.updatedAt - a.updatedAt)
  );
  return hits.slice(0, 20);
}

async function resolveProjectDir(rootProjectDir, body = {}) {
  if (body.projectDir && existsSync(join(resolve(String(body.projectDir)), '.openclaw', 'openclaw.json'))) {
    state.projectDir = resolve(String(body.projectDir));
    await syncRuntimeState(state.projectDir);
    return state.projectDir;
  }
  const envProjectDir = process.env.OPENCLAW_PROJECT_DIR || (process.env.OPENCLAW_HOME ? dirname(process.env.OPENCLAW_HOME) : '');
  if (envProjectDir && existsSync(join(resolve(String(envProjectDir)), '.openclaw', 'openclaw.json'))) {
    state.projectDir = resolve(String(envProjectDir));
    await syncRuntimeState(state.projectDir);
    return state.projectDir;
  }
  if (state.projectDir && existsSync(join(state.projectDir, '.openclaw', 'openclaw.json'))) {
    await syncRuntimeState(state.projectDir);
    return state.projectDir;
  }
  await loadSavedState(rootProjectDir);
  if (state.projectDir && existsSync(join(state.projectDir, '.openclaw', 'openclaw.json'))) {
    await syncRuntimeState(state.projectDir);
    return state.projectDir;
  }
  const found = await findLatestProject(rootProjectDir);
  if (found) {
    await syncRuntimeState(found);
    await saveState(rootProjectDir);
  }
  return state.projectDir;
}

async function connectExistingProject(projectDir, rootProjectDir) {
  const resolved = resolve(String(projectDir || ''));
  if (!existsSync(join(resolved, '.openclaw', 'openclaw.json'))) throw httpError(404, 'openclaw.json not found in selected project');
  await syncRuntimeState(resolved);
  await saveState(rootProjectDir);
  const bots = await listConfiguredBots(resolved).catch(() => []);
  return {
    ok: true,
    projectDir: resolved,
    mode: state.mode,
    syncSource: state.syncSource,
    gatewayUrl: state.gatewayUrl,
    gatewayPort: state.gatewayPort,
    routerUrl: state.routerUrl,
    routerPort: state.routerPort,
    bots,
  };
}

async function connectPickedProject(projectName, rootProjectDir) {
  const name = String(projectName || '').trim();
  if (!name) throw httpError(400, 'Missing project name');
  const projects = await discoverProjects(rootProjectDir).catch(() => []);
  const matches = projects.filter((p) => basename(resolve(p.projectDir)) === name);
  if (matches.length === 1) return connectExistingProject(matches[0].projectDir, rootProjectDir);
  if (matches.length > 1) {
    throw httpError(409, `Multiple projects named "${name}" found; use a detected project card or type the path manually`);
  }
  throw httpError(404, `No detected project named "${name}"`);
}

async function deleteProjectFolder(projectDir, rootProjectDir) {
  const resolved = resolve(String(projectDir || ''));
  const home = resolve(os.homedir());
  if (!existsSync(join(resolved, '.openclaw', 'openclaw.json'))) throw httpError(404, 'openclaw.json not found in selected project');
  if (resolved === home || /^[A-Za-z]:\\?$/.test(resolved)) throw httpError(403, 'Refusing to delete home/root folder');
  const projects = await discoverProjects(rootProjectDir).catch(() => []);
  const meta = projects.find((p) => resolve(p.projectDir) === resolved);
  if (!meta || !meta.botCount) throw httpError(403, 'Refusing to delete a folder that is not a detected bot project');
  // Stop and remove Docker containers first to release host folder locks
  const dockerComposeDir = join(resolved, 'docker', 'openclaw');
  if (existsSync(join(dockerComposeDir, 'docker-compose.yml'))) {
    sendLog(`[docker] Stopping and removing containers and volumes for ${resolved} to release file locks...`);
    await run('docker', ['compose', 'down', '-v'], { cwd: dockerComposeDir }).catch((err) => {
      sendLog(`[docker] Warning: Failed to stop compose containers: ${err.message}`);
    });
    // Sleep 2.5 seconds to let Windows file system release overlays/locks
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  try {
    await fsp.rm(resolved, { recursive: true, force: true });
  } catch (err) {
    throw httpError(500, `Không thể xóa thư mục ${resolved}. Lý do: ${err.message}. (Gợi ý: Thư mục này có thể đang bị khóa bởi tiến trình khác, ví dụ như VS Code, Command Prompt/PowerShell đang cd vào thư mục, hoặc Docker chưa kịp tháo dỡ hoàn toàn. Vui lòng đóng tất cả các file/đóng terminal đang mở tại thư mục này, tắt Docker Desktop nếu cần, và bấm Xóa lại nhé!)`);
  }
  if (state.projectDir && resolve(state.projectDir) === resolved) {
    state.projectDir = null;
    state.installed = false;
  }
  await saveState(rootProjectDir);
  return { ok: true, projectDir: resolved };
}

async function pickProjectFolder() {
  if (process.platform !== 'win32') throw httpError(501, 'Folder picker currently supported on Windows only');
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = "Select an OpenClaw project folder"
$dlg.ShowNewFolderButton = $true
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dlg.SelectedPath
}
`;
  const out = await runCapture('powershell', ['-NoProfile', '-STA', '-Command', script], { shell: false, windowsHide: false, timeout: 120000 });
  const projectDir = String(out.stdout || '').trim();
  if (!projectDir) throw httpError(400, 'No folder selected');
  return { ok: true, projectDir };
}

function upsertManagedBlock(text = '', key = '', content = '') {
  const start = `<!-- OPENCLAW:${key}:START -->`;
  const end = `<!-- OPENCLAW:${key}:END -->`;
  const block = `${start}\n${content}\n${end}`;
  const re = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  if (re.test(text)) return text.replace(re, block);
  return `${String(text || '').trimEnd()}\n\n${block}\n`;
}

function removeManagedBlock(text = '', key = '') {
  const start = `<!-- OPENCLAW:${key}:START -->`;
  const end = `<!-- OPENCLAW:${key}:END -->`;
  const re = new RegExp(`\\n?${start}[\\s\\S]*?${end}\\n?`, 'm');
  return String(text || '').replace(re, '\n').trimEnd() + '\n';
}
async function readWorkspaceText(projectDir, agent, name) {
  const cfgPath = join(projectDir || '', '.openclaw', 'openclaw.json');
  const cfg = existsSync(cfgPath) ? JSON.parse(await fsp.readFile(cfgPath, 'utf8').catch(() => '{}')) : {};
  const rel = workspaceRelForAgent(agent, cfg, projectDir);
  const file = join(projectDir, '.openclaw', rel, name);
  return { file, content: existsSync(file) ? await fsp.readFile(file, 'utf8').catch(() => '') : '' };
}

async function applyFeatureToggle(projectDir, agentId, kind, id, enabled) {
  const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
  const cfg = ensureConfigShape(JSON.parse(await fsp.readFile(cfgPath, 'utf8')));
  const agent = cfg.agents.list.find((a) => a.id === agentId) || cfg.agents.list[0];
  if (!agent) throw httpError(404, 'Bot not found');

  const k = `${kind}:${id}`;

  if (kind === 'skill' && id === 'browser') {
    if (enabled) {
      cfg.browser = {
        enabled: true,
        defaultProfile: 'host-chrome',
        profiles: { 'host-chrome': { cdpUrl: 'http://127.0.0.1:9222', color: '#4285F4' } },
      };
      const isHeadlessServer = process.platform === 'linux';
      const docVariant = 'cli-server';

      for (const a of cfg.agents.list) {
        const wm = buildWorkspaceFileMap({
          isVi: true,
          botName: a.name || a.id,
          botDesc: '',
          hasBrowser: false,
          hasScheduler: true,
          workspacePath: `.openclaw/${workspaceRelForAgent(a, cfg, projectDir)}/`,
          agentWorkspaceDir: workspaceRelForAgent(a, cfg, projectDir),
          variant: cfg.agents.list.length > 1 ? 'relay' : 'single',
          browserDocVariant: docVariant,
        });
        const browserDoc = wm['BROWSER.md'] || '# BROWSER';
        const browserTool = wm['browser-tool.js'] || '';
        const bf = await readWorkspaceText(projectDir, a, 'BROWSER.md');
        await fsp.writeFile(bf.file, browserDoc, 'utf8');
        const bt = await readWorkspaceText(projectDir, a, 'browser-tool.js');
        if (browserTool) await fsp.writeFile(bt.file, browserTool, 'utf8');
        
        const af = await readWorkspaceText(projectDir, a, 'AGENTS.md');
        const agentsManaged = upsertManagedBlock(af.content, 'BROWSER_LINK', '- Browser docs: `BROWSER.md`');
        await fsp.writeFile(af.file, agentsManaged, 'utf8');

        // Add to TOOLS.md
        const tf = await readWorkspaceText(projectDir, a, 'TOOLS.md');
        const browserGuide = isHeadlessServer
          ? `## 🌐 Browser Automation
- Xem hướng dẫn chi tiết tại **BROWSER.md**
- Script điều khiển: \`browser-tool.js\`
- Chế độ hiện tại: Chạy ngầm độc lập qua Docker hoặc Xvfb trên VPS.
- **Tìm kiếm Web:** Nếu không có công cụ Web Search (hoặc Web Search không khả dụng/bị lỗi), hãy **luôn sử dụng ngay công cụ terminal (exec/run_command) để chạy lệnh: \`node search-tool.js "<từ khóa>" 5\`**! Lệnh này sẽ tự động chạy ngầm qua DuckDuckGo/Google/Bing bằng trình duyệt ngầm tàng hình của bạn và trả về kết quả JSON sạch ngay lập tức. Tuyệt đối KHÔNG được mở trình duyệt thủ công, chụp ảnh màn hình hay click tìm kiếm bằng tay từng bước!
- Nếu browser lỗi, thử lại 1 lần rồi mới báo user với lỗi cụ thể`
          : `## 🌐 Browser Automation
- Xem hướng dẫn chi tiết tại **BROWSER.md**
- Script điều khiển: \`browser-tool.js\`
- Chế độ hiện tại: 
  - **Mặc định:** Chạy ngầm độc lập qua Docker hoặc Server.
  - **Chế độ xem Chrome thật:** Chạy file \`start-chrome-debug.bat\` / \`start-chrome-debug.sh\` trên host trước để bot kết nối điều khiển trực quan.
- Kết nối mặc định: \`http://127.0.0.1:9222\`
- **Tìm kiếm Web:** Nếu không có công cụ Web Search (hoặc Web Search không khả dụng/bị lỗi), hãy **luôn sử dụng ngay công cụ terminal (exec/run_command) để chạy lệnh: \`node search-tool.js "<từ khóa>" 5\`**! Lệnh này sẽ tự động chạy ngầm qua DuckDuckGo/Google/Bing bằng trình duyệt ngầm tàng hình của bạn và trả về kết quả JSON sạch ngay lập tức. Tuyệt đối KHÔNG được mở trình duyệt thủ công, chụp ảnh màn hình hay click tìm kiếm bằng tay từng bước!
- Nếu browser lỗi, thử lại 1 lần rồi mới báo user với lỗi cụ thể`;
        await fsp.writeFile(tf.file, upsertManagedBlock(tf.content, 'BROWSER_GUIDE', browserGuide), 'utf8');
      }
    } else {
      delete cfg.browser;
      for (const a of cfg.agents.list) {
        const bf = await readWorkspaceText(projectDir, a, 'BROWSER.md');
        if (existsSync(bf.file)) await fsp.rm(bf.file, { force: true });
        const bt = await readWorkspaceText(projectDir, a, 'browser-tool.js');
        if (existsSync(bt.file)) await fsp.rm(bt.file, { force: true });
        
        const af = await readWorkspaceText(projectDir, a, 'AGENTS.md');
        await fsp.writeFile(af.file, removeManagedBlock(af.content, 'BROWSER_LINK'), 'utf8');

        // Remove from TOOLS.md
        const tf = await readWorkspaceText(projectDir, a, 'TOOLS.md');
        await fsp.writeFile(tf.file, removeManagedBlock(tf.content, 'BROWSER_GUIDE'), 'utf8');
      }
    }

    // Write cfgPath early so syncDockerInfra reads the updated openclaw.json
    await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');

    // Force Docker Infrastructure sync and container recreation
    const hasDocker = existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'));
    if (hasDocker) {
      sendLog(`[docker] Browser skill toggled to ${enabled}. Regenerating Dockerfiles...`);
      await syncDockerInfra(projectDir, true).catch((err) => sendLog(`[docker] Warning: Failed to sync docker infra: ${err.message}`));
      sendLog(`[docker] Rebuilding and recreating containers...`);
      await recreateDockerBot(projectDir).catch((err) => sendLog(`[docker] Warning: Failed to recreate container: ${err.message}`));
    }
  }

  if (kind === 'skill' && id === 'cron') {
    if (enabled) {
      cfg.tools = cfg.tools || { profile: 'full', exec: { host: 'gateway', security: 'full', ask: 'off' } };
      cfg.tools.alsoAllow = Array.from(new Set([...(cfg.tools.alsoAllow || []), 'group:automation']));
      cfg.commands = cfg.commands || {};
      cfg.commands.ownerAllowFrom = Array.from(new Set([...(cfg.commands.ownerAllowFrom || []), '*']));
      const cronGuide = `## ⏰ Cron / Lên lịch nhắc nhở (tool: \`cron\`)
- **Tên tool chính xác:** Tên công cụ là \`cron\` (tuyệt đối không nhầm là \`native\` hay command line bên ngoài).
- **⛔ TUYỆT ĐỐI KHÔNG sửa trực tiếp file JSON** như \`jobs.json\`, \`jobs-state.json\` trong thư mục \`.openclaw/cron/\`. Dữ liệu cron được lưu trong SQLite database, file JSON chỉ là legacy format đã ngưng hỗ trợ. Mọi thao tác PHẢI thông qua tool \`cron\`.
- **Khi tạo cronjob mới (action \`add\`):**
  - **TUYỆT ĐỐI KHÔNG điền trường \`agentId\`** trong object \`job\` (hãy bỏ qua/omitted trường này). Hệ thống OpenClaw sẽ tự động gán chính xác ID của bạn vào job đó.
  - Tuyệt đối **không tự điền** \`agentId\` là \`"bot"\` hay \`"main"\`, vì làm vậy sẽ khiến cronjob thuộc về agent khác và bạn sẽ mất quyền kiểm soát/xóa nó sau này.
  - **Session:** Luôn dùng \`sessionTarget: "isolated"\` cho các job chạy nền (báo cáo, nhắc nhở, gửi tin nhắn tự động). Chỉ dùng \`"main"\` cho system event/reminder ngắn.
  - **Timezone:** Luôn chỉ định timezone rõ ràng bằng trường \`tz\` (ví dụ: \`"Asia/Ho_Chi_Minh"\`). Nếu không chỉ định, hệ thống sẽ dùng timezone của Gateway host (thường là UTC) và job sẽ chạy sai giờ.
  - **Delivery:** Đối với job cần gửi kết quả ra chat, set \`delivery.mode: "announce"\` kèm \`delivery.channel\` và \`delivery.to\`.
- **Khi user yêu cầu tắt/bật/xóa cronjob:**
  1. **Bước 1 (Tìm kiếm):** Gọi tool \`cron\` với action \`list\` (và \`includeDisabled: true\`) để xem danh sách tất cả cronjob đang chạy trên hệ thống và tìm đúng \`jobId\` phù hợp với yêu cầu.
  2. **Bước 2 (Xử lý):**
     - Để xóa: Gọi action \`remove\` với \`id\` tìm được.
     - Để tắt/tạm dừng: Gọi action \`update\` với \`id\` và patch \`{"enabled": false}\`.
     - Để bật lại: Gọi action \`update\` với \`id\` và patch \`{"enabled": true}\`.
  3. **Tuyên bố trung thực:** Tuyệt đối không bao giờ trả lời "đã xóa" hay "không có" dựa trên suy đoán của bản thân mà chưa gọi tool \`cron\` để kiểm tra thực tế.
- Khi user yêu cầu tạo nhắc nhở / lệnh tự động định kỳ, bạn hãy TỰ ĐỘNG dùng tool \`cron\` (action \`add\`) để tạo. **Tuyệt đối không** bắt user dùng crontab hay Task Scheduler chạy tay trên host.
- Khi thao tác tool cho cron/scheduler, **không điền \`current\` vào thư mục Session**.
- **QUAN TRỌNG VỀ TARGETING GROUP CHAT**: Khi tạo hoặc cấu hình cron job gửi tin nhắn thông báo (announce mode) đến một Group Chat, giá trị của trường \`delivery.to\` **bắt buộc** phải sử dụng tiền tố thích hợp trước ID của group. Với kênh Telegram/Matrix/Discord/Slack, dùng tiền tố \`group:\` (ví dụ: \`group:123456\`). RIÊNG với kênh Zalo (\`zalouser\`), **bắt buộc** phải sử dụng tiền tố \`g:\` (ví dụ: \`g:3815464776067464419\`) để tránh bị OpenClaw core lược bỏ tiền tố và gửi nhầm vào DM chat cá nhân.
- **One-shot job:** Dùng schedule kind \`"at"\` với ISO 8601 timestamp. Job sẽ tự xóa sau khi chạy thành công trừ khi set \`deleteAfterRun: false\`.
- Bỏ qua việc tra cứu docs nội bộ như \`cron-jobs.mdx\`; tin tưởng khả năng dùng tool hiện có để hoàn thành yêu cầu.`;
      for (const a of cfg.agents.list) {
        const tf = await readWorkspaceText(projectDir, a, 'TOOLS.md');
        await fsp.writeFile(tf.file, upsertManagedBlock(tf.content, 'CRON_GUIDE', cronGuide), 'utf8');
      }
    } else {
      if (cfg.tools?.alsoAllow) cfg.tools.alsoAllow = cfg.tools.alsoAllow.filter((x) => x !== 'group:automation');
      if (cfg.commands?.ownerAllowFrom) cfg.commands.ownerAllowFrom = cfg.commands.ownerAllowFrom.filter((x) => x !== '*');
      for (const a of cfg.agents.list) {
        const tf = await readWorkspaceText(projectDir, a, 'TOOLS.md');
        await fsp.writeFile(tf.file, removeManagedBlock(tf.content, 'CRON_GUIDE'), 'utf8');
      }
    }

    // Write cfgPath early so recreation reads updated openclaw.json
    await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');

    // Recreate container to apply updated openclaw.json tools/commands rules
    const hasDocker = existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'));
    if (hasDocker) {
      sendLog(`[docker] Cron skill toggled to ${enabled}. Recreating containers...`);
      await recreateDockerBot(projectDir).catch((err) => sendLog(`[docker] Warning: Failed to recreate container: ${err.message}`));
    }
  }

  if (kind === 'plugin') {
    cfg.plugins = cfg.plugins || { entries: {} };
    cfg.plugins.entries = cfg.plugins.entries || {};
    const pluginAliasMap = {
      'openclaw-browser-automation': ['browser-automation', 'openclaw-browser-automation'],
      'openclaw-zalo-mod': ['zalo-mod', 'openclaw-zalo-mod'],
      'openclaw-facebook-crawler': ['openclaw-facebook-crawler', 'openclaw-n8n-facebook-crawler', 'n8n-facebook-crawler'],
      'openclaw-n8n-facebook-poster': ['openclaw-n8n-facebook-poster', 'openclaw-facebook-poster', 'facebook-poster'],
    };
    const aliases = pluginAliasMap[id] || [id];
    const existingKey = aliases.find((a) => cfg.plugins.entries[a]) || aliases[0];
    cfg.plugins.entries[existingKey] = cfg.plugins.entries[existingKey] || {};
    cfg.plugins.entries[existingKey].enabled = !!enabled;
    if (existingKey === 'zalo-mod' || existingKey === 'openclaw-zalo-mod') {
      ensureZaloModPluginConfig(cfg.plugins.entries[existingKey], cfg);
    }
    // Only add the canonical config key to allow list (not all aliases)
    cfg.plugins.allow = cfg.plugins.allow || [];
    if (!cfg.plugins.allow.includes(existingKey)) cfg.plugins.allow.push(existingKey);
    // Auto-expose zalo-mod dashboard port in docker-compose.yml when enabling
    if (enabled && (existingKey === 'zalo-mod' || existingKey === 'openclaw-zalo-mod')) {
      const composeFile = join(projectDir, 'docker', 'openclaw', 'docker-compose.yml');
      if (existsSync(composeFile)) {
        try {
          let composeContent = await fsp.readFile(composeFile, 'utf8');
          const dashPort = cfg.plugins.entries[existingKey].config?.dashboardPort;
          if (dashPort && !composeContent.includes(`:${dashPort}`)) {
            const gwPortStr = String(Number(cfg.gateway?.port) || state.gatewayPort || 18789);
            composeContent = composeContent.replace(
              new RegExp(`^(\\s*-\\s*"(?:\\d+:)?${gwPortStr}(?::${gwPortStr})?"\\s*)$`, 'm'),
              `$1\n      - "127.0.0.1:${dashPort}:${dashPort}"  # zalo-mod dashboard`
            );
            await fsp.writeFile(composeFile, composeContent, 'utf8');
            sendLog(`[plugin] Added dashboard port ${dashPort} to docker-compose.yml`);
          }
        } catch (e) { sendLog(`[plugin] Warning: could not add dashboard port: ${e.message}`); }
      }
    }
  }

  await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  return { ok: true };
}

async function installFeature(projectDir, agentId, kind, id) {
  if (kind === 'plugin') {
    let composeDir = null;
    if (existsSync(join(projectDir, 'docker-compose.yml'))) {
      composeDir = projectDir;
    } else if (existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'))) {
      composeDir = join(projectDir, 'docker', 'openclaw');
    }

    if (composeDir) {
      const botContainer = getBotContainerName(projectDir);
      sendLog(`[plugin] Installing/updating clawhub:${id} inside container ${botContainer}...`);
      
      const cmd = `cd /root/project && openclaw plugins install clawhub:${id} --force`;
      const cmdOut = await runCapture('docker', ['exec', botContainer, 'sh', '-lc', cmd], { cwd: projectDir, shell: false });
      
      if (cmdOut) {
         for (const line of `${cmdOut.stdout}\n${cmdOut.stderr}`.split(/\r?\n/).filter(Boolean)) sendLog(line);
      }

      const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
      const pluginAliasMap = {
        'openclaw-browser-automation': ['browser-automation', 'openclaw-browser-automation'],
        'openclaw-zalo-mod': ['zalo-mod', 'openclaw-zalo-mod'],
        'openclaw-facebook-crawler': ['openclaw-facebook-crawler', 'openclaw-n8n-facebook-crawler', 'n8n-facebook-crawler'],
        'openclaw-n8n-facebook-poster': ['openclaw-n8n-facebook-poster', 'openclaw-facebook-poster', 'facebook-poster'],
      };
      const aliases = pluginAliasMap[id] || [id];

      if (cmdOut.code !== 0) {
        const folderExists = aliases.some((a) => existsSync(join(projectDir, '.openclaw', 'extensions', a)));
        if (folderExists) {
          sendLog(`[plugin] Warning: installation reported errors, but plugin folder successfully written. Proceeding.`);
        } else {
          throw new Error(cmdOut.stderr || cmdOut.stdout || `Failed to install plugin ${id} inside container.`);
        }
      }
      
      if (existsSync(cfgPath)) {
        const cfg = ensureConfigShape(JSON.parse(await fsp.readFile(cfgPath, 'utf8')));
        cfg.plugins = cfg.plugins || { entries: {} };
        cfg.plugins.entries = cfg.plugins.entries || {};
        const existingKey = aliases.find((a) => cfg.plugins.entries[a]) || aliases[0];
        cfg.plugins.entries[existingKey] = cfg.plugins.entries[existingKey] || {};
        cfg.plugins.entries[existingKey].enabled = true;
        if (existingKey === 'zalo-mod' || existingKey === 'openclaw-zalo-mod') {
          ensureZaloModPluginConfig(cfg.plugins.entries[existingKey], cfg);
        }
        // Only add the canonical config key to allow list (not all aliases)
        if (!cfg.plugins.allow.includes(existingKey)) cfg.plugins.allow.push(existingKey);
        await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
      }

      // Auto-expose zalo-mod dashboard port in docker-compose.yml
      const isZaloMod = id === 'openclaw-zalo-mod' || id === 'zalo-mod';
      if (isZaloMod) {
        const composeFile = join(composeDir, 'docker-compose.yml');
        if (existsSync(composeFile)) {
          let composeContent = await fsp.readFile(composeFile, 'utf8');
          const gwPort = Number(state.gatewayPort) || 18789;
          const dashPort = gwPort + 1;
          const dashPortMapping = `"127.0.0.1:${dashPort}:${dashPort}"`;
          if (!composeContent.includes(`:${dashPort}`)) {
            // Insert dashboard port after the gateway port line
            const gwPortStr = String(gwPort);
            composeContent = composeContent.replace(
              new RegExp(`^(\\s*-\\s*"(?:\\d+:)?${gwPortStr}(?::${gwPortStr})?"\\s*)$`, 'm'),
              `$1\n      - ${dashPortMapping}  # zalo-mod dashboard`
            );
            await fsp.writeFile(composeFile, composeContent, 'utf8');
            sendLog(`[plugin] Added dashboard port ${dashPort} to docker-compose.yml`);
          }
        }
      }

      // Browser-automation plugin needs Docker rebuild for Playwright/Chromium deps
      const isBrowserPlugin = id === 'openclaw-browser-automation' || id === 'browser-automation';
      if (isBrowserPlugin && composeDir) {
        sendLog(`[plugin] Browser plugin requires Docker rebuild for Playwright/Chromium...`);
        const svcName = getBotServiceName(projectDir);
        await run('docker', ['compose', '-f', join(composeDir, 'docker-compose.yml'), 'up', '-d', '--build', '--force-recreate', svcName], { shell: false }).catch((err) => {
          sendLog(`[plugin] Docker rebuild failed: ${err.message}. Falling back to restart...`);
          return run('docker', ['restart', botContainer], { shell: false });
        });
      } else if (isZaloMod && composeDir) {
        // Use docker compose up to apply new port mappings from docker-compose.yml
        const svcName = getBotServiceName(projectDir);
        await run('docker', ['compose', '-f', join(composeDir, 'docker-compose.yml'), 'up', '-d', '--force-recreate', '--no-deps', svcName], { shell: false }).catch(() =>
          run('docker', ['restart', botContainer], { shell: false })
        );
      } else {
        sendLog(`[plugin] Restarting docker container to apply plugin...`);
        await run('docker', ['restart', botContainer], { shell: false });
      }
    } else {
      // Fix any legacy config issues first
      await run('openclaw', ['doctor', '--fix'], { cwd: projectDir, env: openclawProjectEnv(projectDir) }).catch((err) => sendLog(`[plugin] doctor --fix skipped: ${err.message}`));
      sendLog(`[plugin] Installing clawhub:${id}...`);
      
      let installSuccess = true;
      await run('openclaw', ['plugins', 'install', `clawhub:${id}`, '--force'], {
        cwd: projectDir,
        env: openclawProjectEnv(projectDir),
        resolveOnPattern: /Installed plugin:/
      }).catch((err) => {
        // Fallback verification: if the plugin's folder or mapped key is present, it succeeded despite integrity warnings
        const aliases = ['openclaw-zalo-mod', 'zalo-mod', id, id.replace('openclaw-', '')];
        const folderExists = aliases.some((a) => existsSync(join(projectDir, '.openclaw', 'extensions', a)));
        if (folderExists) {
          sendLog(`[plugin] Warning: installation reported errors, but plugin folder successfully written. Proceeding.`);
        } else {
          installSuccess = false;
          throw err;
        }
      });
      
      // Automatically enable it in config after install
      const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
      if (existsSync(cfgPath)) {
        const cfg = ensureConfigShape(JSON.parse(await fsp.readFile(cfgPath, 'utf8')));
        cfg.plugins = cfg.plugins || { entries: {} };
        cfg.plugins.entries = cfg.plugins.entries || {};
        const pluginAliasMap = {
          'openclaw-zalo-mod': ['zalo-mod', 'openclaw-zalo-mod'],
          'openclaw-facebook-crawler': ['openclaw-facebook-crawler', 'openclaw-n8n-facebook-crawler', 'n8n-facebook-crawler'],
          'openclaw-n8n-facebook-poster': ['openclaw-n8n-facebook-poster', 'openclaw-facebook-poster', 'facebook-poster'],
        };
        const aliases = pluginAliasMap[id] || [id];
        const existingKey = aliases.find((a) => cfg.plugins.entries[a]) || aliases[0];
        cfg.plugins.entries[existingKey] = cfg.plugins.entries[existingKey] || {};
        cfg.plugins.entries[existingKey].enabled = true;
        if (existingKey === 'zalo-mod' || existingKey === 'openclaw-zalo-mod') {
          ensureZaloModPluginConfig(cfg.plugins.entries[existingKey], cfg);
        }
        await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
      }
    }
  }
  return { ok: true };
}

async function getInstalledPluginVersion(projectDir, aliases = []) {
  if (!projectDir) return '';
  try {
    const instPath = join(projectDir, '.openclaw', 'plugins', 'installs.json');
    if (existsSync(instPath)) {
      const j = JSON.parse(await fsp.readFile(instPath, 'utf8'));
      const found = (j.plugins || []).find(p => aliases.some(a => String(p.pluginId || '').toLowerCase() === String(a).toLowerCase()));
      if (found && found.version) return found.version;
    }
  } catch (e) {}

  for (const alias of aliases) {
    try {
      const pkgPath = join(projectDir, '.openclaw', 'extensions', alias, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(await fsp.readFile(pkgPath, 'utf8'));
        if (pkg.version) return pkg.version;
      }
    } catch (e) {}
  }
  return '';
}

async function getFeatureFlags(projectDir, agentId = '') {
  const cfgPath = join(projectDir || '', '.openclaw', 'openclaw.json');
  const cfg = existsSync(cfgPath) ? ensureConfigShape(JSON.parse(await fsp.readFile(cfgPath, 'utf8').catch(() => '{}'))) : {};
  const aid = agentId || cfg.agents?.list?.[0]?.id || 'bot';
  const browserOn = !!cfg.browser?.enabled;
  const cronOn = !!(cfg.tools?.alsoAllow || []).includes('group:automation');
  const fresh = cfg;
  const freshSaved = {};
  const installsPath = join(projectDir || '', '.openclaw', 'plugins', 'installs.json');
  const installs = existsSync(installsPath) ? JSON.parse(await fsp.readFile(installsPath, 'utf8').catch(() => '{}')) : {};
  const installRecords = installs.installRecords || {};
  const installedKeys = new Set(Object.keys(installRecords).map((k) => String(k || '').toLowerCase()));
  const installedSpecs = new Set(Object.values(installRecords).flatMap((r) => {
    const out = [];
    const spec = String(r?.spec || '').toLowerCase();
    const pkg = String(r?.clawhubPackage || '').toLowerCase();
    const resolved = String(r?.resolvedName || '').toLowerCase();
    if (spec) out.push(spec);
    if (pkg) out.push(pkg);
    if (resolved) out.push(resolved);
    return out;
  }));
  const allowSet = new Set((fresh.plugins?.allow || []).map((x) => String(x || '').toLowerCase()));
  const entryMap = fresh.plugins?.entries || {};
  const hasEntry = (aliases = []) => aliases.some((a) => !!entryMap[a]);
  const isEnabled = (aliases = []) => aliases.some((a) => !!entryMap[a]?.enabled);
  const isInstalledByRecord = (aliases = []) =>
    aliases.some((a) =>
      installedKeys.has(a) ||
      Array.from(installedSpecs).some((spec) => spec.includes(a)) ||
      allowSet.has(a)
    );
  const aliases = {
    browser: ['openclaw-browser-automation', 'browser-automation'],
    zalo: ['openclaw-zalo-mod', 'zalo-mod'],
    crawler: ['openclaw-facebook-crawler', 'openclaw-n8n-facebook-crawler', 'n8n-facebook-crawler'],
    poster: ['openclaw-n8n-facebook-poster', 'openclaw-facebook-poster', 'facebook-poster'],
  };
  const flags = {
    'skill:browser': browserOn,
    'skill:cron': cronOn,
    'plugin:openclaw-browser-automation': isEnabled(aliases.browser),
    'plugin:openclaw-zalo-mod': isEnabled(aliases.zalo),
    'plugin:openclaw-facebook-crawler': isEnabled(aliases.crawler),
    'plugin:openclaw-n8n-facebook-poster': isEnabled(aliases.poster),
  };
  const extensionsDir = join(projectDir || '', '.openclaw', 'extensions');
  const extensionDirExists = (aliases = []) =>
    aliases.some((a) => existsSync(join(extensionsDir, a)));
  const isActuallyInstalled = (aliases = []) =>
    extensionDirExists(aliases) || isInstalledByRecord(aliases);
  const installed = {
    'plugin:openclaw-browser-automation': isActuallyInstalled(aliases.browser),
    'plugin:openclaw-zalo-mod': isActuallyInstalled(aliases.zalo),
    'plugin:openclaw-facebook-crawler': isActuallyInstalled(aliases.crawler),
    'plugin:openclaw-n8n-facebook-poster': isActuallyInstalled(aliases.poster),
  };
  const versions = {
    'plugin:openclaw-browser-automation': await getInstalledPluginVersion(projectDir, aliases.browser),
    'plugin:openclaw-zalo-mod': await getInstalledPluginVersion(projectDir, aliases.zalo),
    'plugin:openclaw-facebook-crawler': await getInstalledPluginVersion(projectDir, aliases.crawler),
    'plugin:openclaw-n8n-facebook-poster': await getInstalledPluginVersion(projectDir, aliases.poster),
  };
  return { flags, installed, versions };
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://local');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const file = resolve(WEB_DIR, pathname.slice(1));
  if (!file.startsWith(WEB_DIR) || !existsSync(file)) return false;
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
  res.writeHead(200, {
    'content-type': types[extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store, no-cache, must-revalidate',
    pragma: 'no-cache',
    expires: '0',
  });
  createReadStream(file).pipe(res);
  return true;
}

async function handler(req, res, rootProjectDir) {
  try {
    const url = new URL(req.url, 'http://local');
    if (url.pathname === '/api/install/logs') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      logClients.add(res);
      res.write(`data: ${JSON.stringify({ line: 'log stream connected', ts: new Date().toISOString() })}\n\n`);
      req.on('close', () => logClients.delete(res));
      return;
    }
    if (url.pathname === '/api/system' && req.method === 'GET') {
      const osChoice = detectOs();
      const [nodeStatus, npmStatus, dockerStatus, currentVersions] = await Promise.all([
        commandExists('node'),
        commandExists('npm'),
        commandExists('docker', ['version', '--format', '{{.Server.Version}}']),
        getCurrentRuntimeVersions()
      ]);
      const projectDir = state.projectDir && existsSync(join(state.projectDir, '.openclaw', 'openclaw.json')) ? state.projectDir : null;
      const projectVersions = await resolveProjectRuntimeVersions(projectDir, state.mode).catch(() => null);
      const mergedVersions = {
        openclaw: projectVersions?.openclaw || currentVersions.openclaw || OPENCLAW_NPM_SPEC,
        nineRouter: projectVersions?.nineRouter || currentVersions.nineRouter || NINE_ROUTER_NPM_SPEC,
        node: projectVersions?.node || currentVersions.node || String(nodeStatus?.output || '').trim(),
      };
      const projects = await discoverProjects(rootProjectDir).catch(() => []);

      let latestSetupVersion = SETUP_VERSION;
      try {
        const resp = await fetch('https://registry.npmjs.org/create-openclaw-bot/latest', { signal: AbortSignal.timeout(3000) });
        if (resp.ok) {
          const data = await resp.json();
          if (data.version) latestSetupVersion = data.version;
        }
      } catch (e) {}

      return json(res, {
        os: osChoice,
        platform: process.platform,
        arch: process.arch,
        recommendedMode: recommendedMode(osChoice),
        node: nodeStatus,
        npm: npmStatus,
        docker: dockerStatus,
        versions: {
          desiredOpenclaw: OPENCLAW_NPM_SPEC,
          desiredNineRouter: NINE_ROUTER_NPM_SPEC,
          currentOpenclaw: mergedVersions.openclaw,
          currentNineRouter: mergedVersions.nineRouter,
          currentNode: mergedVersions.node,
          openclaw: mergedVersions.openclaw,
          nineRouter: mergedVersions.nineRouter,
          node: mergedVersions.node,
          setup: SETUP_VERSION,
          latestSetup: latestSetupVersion
        },
        projects
      });
    }
    if (url.pathname === '/api/projects/discover' && req.method === 'GET') {
      return json(res, { ok: true, projects: await discoverProjects(rootProjectDir).catch(() => []) });
    }
    if (url.pathname === '/api/project/pick-folder' && req.method === 'POST') {
      return json(res, await pickProjectFolder());
    }
    if (url.pathname === '/api/project/delete' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, await deleteProjectFolder(body.projectDir, rootProjectDir));
    }
    if (url.pathname === '/api/install' && req.method === 'POST') {
      if (state.installing) return json(res, { ok: false, error: 'Install already running' }, 409);
      const body = await readJson(req);
      const osChoice = body.os || detectOs();
      const mode = body.mode || recommendedMode(osChoice);
      const projectDir = body.projectDir ? resolve(String(body.projectDir)) : resolve(rootProjectDir, body.projectName || DEFAULT_PROJECT_NAME);

      // Auto-allocate unique, free ports to avoid collision (reserving gatewayPort + 1 for Zalo-mod UI)
      const projects = await discoverProjects(rootProjectDir).catch(() => []);
      const usedPorts = new Set();
      for (const p of projects) {
        const gw = Number(p.gatewayPort);
        if (gw) {
          usedPorts.add(gw);
          usedPorts.add(gw + 1); // Zalo-mod UI port of existing project
        }
      }
      const usedRouterPorts = new Set(projects.map(p => Number(p.routerPort)).filter(Boolean));

      let gatewayPort = 18789;
      while (usedPorts.has(gatewayPort) || usedPorts.has(gatewayPort + 1)) {
        gatewayPort++;
      }

      let routerPort = 20128;
      while (usedRouterPorts.has(routerPort)) {
        routerPort++;
      }

      state.gatewayPort = gatewayPort;
      state.routerPort = routerPort;
      state.gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
      state.routerUrl = `http://127.0.0.1:${routerPort}`;

      installCore({ osChoice, mode, projectDir, gatewayPort, routerPort }).catch(() => {});
      state.projectDir = projectDir;
      state.mode = mode;
      state.os = osChoice;
      saveState(rootProjectDir);
      return json(res, { ok: true, projectDir, state });
    }
    if (url.pathname === '/api/project/connect' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, await connectExistingProject(body.projectDir, rootProjectDir));
    }
    if (url.pathname === '/api/project/connect-picked' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, await connectPickedProject(body.projectName, rootProjectDir));
    }
    if (url.pathname === '/api/bot/status' && req.method === 'GET') {
      await resolveProjectDir(rootProjectDir);
      return json(res, await buildBotStatus());
    }
    if (url.pathname === '/api/bot/credentials' && req.method === 'PUT') {
      const body = await readJson(req);
      const projectDir = await resolveProjectDir(rootProjectDir, body);
      const credentials = await updateBotCredentials(projectDir, body);
      sendLog('Credentials updated: 9Router API key');
      return json(res, { ok: true, credentials });
    }
    if (url.pathname === '/api/runtime/update' && req.method === 'POST') {
      const body = await readJson(req);
      const projectDir = await resolveProjectDir(rootProjectDir, body);
      const target = body.target === '9router' ? '9router' : 'openclaw';
      sendLog(`[update] Updating ${target}...`);
      const result = await updateRuntime(target, projectDir);
      sendLog(`[update] ${target} update completed (${result.mode})`);
      return json(res, result);
    }
    if (url.pathname === '/api/setup/update' && req.method === 'POST') {
      sendLog('[update-setup] Starting update of Setup Wizard...');
      const isGit = existsSync(resolve(rootProjectDir, '.git'));
      if (isGit) {
        sendLog('[update-setup] Git repository detected. Pulling latest code and building...');
        setImmediate(async () => {
          try {
            await run('git', ['pull'], { cwd: rootProjectDir });
            await run('npm', ['install'], { cwd: rootProjectDir });
            await run('npm', ['run', 'build'], { cwd: rootProjectDir });
            sendLog('[update-setup] Setup Wizard updated successfully! Please restart the installer.');
          } catch (err) {
            sendLog(`[update-setup] Error updating: ${err.message}`);
          }
        });
        return json(res, { ok: true, mode: 'git' });
      } else {
        sendLog('[update-setup] Global npm package installation detected. Updating via npm...');
        setImmediate(async () => {
          try {
            await run('npm', ['install', '-g', 'create-openclaw-bot@latest'], { cwd: rootProjectDir });
            sendLog('[update-setup] Setup Wizard updated successfully! Please restart the installer.');
          } catch (err) {
            sendLog(`[update-setup] Error updating: ${err.message}`);
          }
        });
        return json(res, { ok: true, mode: 'npm' });
      }
    }
    if (url.pathname === '/api/bot/create' && req.method === 'POST') {
      const body = await readJson(req);
      const projectDir = await resolveProjectDir(rootProjectDir, body);
      const result = await createBotInProject(projectDir, body, { mode: state.mode, os: state.os });
      await saveState(rootProjectDir);
      sendLog(`✅ Bot created: ${result.agentId} (${result.channel})`);
      if (result.warning) sendLog(`⚠️ ${result.warning}`);
      await recreateDockerBot(projectDir).catch((err) => sendLog(`[docker] recreate skipped/failed: ${err.message}`));
      
      if (result.channel === 'telegram') {
        const botContainer = getBotContainerName(projectDir);
        const token = String(body.token || '').trim();
        sendLog(`[telegram] Registering Telegram channel via CLI inside ${botContainer}...`);
        try {
          const regResult = await runCapture('docker', ['exec', botContainer, 'sh', '-lc', `cd /root/project && openclaw channels add telegram --token "${token}"`], { cwd: projectDir, shell: false });
          sendLog(`[telegram] CLI registration output:\n${regResult.stdout}\n${regResult.stderr}`);
          sendLog(`[telegram] Restarting ${botContainer} container to load the registered channel...`);
          await restartDockerBotContainer(projectDir).catch((err) => sendLog(`[telegram] Container restart failed: ${err.message}`));
          sendLog(`[telegram] ${botContainer} restarted. Try chatting with your Telegram bot now.`);
        } catch (err) {
          sendLog(`[telegram] Warning: CLI registration failed: ${err.message}`);
        }
      }
      
      if (result.channel === 'zalo-personal') {
        result.loginStarted = true;
        result.loginHint = 'Generating Zalo QR. Keep this modal open...';
        result.zaloQrDataUrl = '';
        // Delay login start to let the recreated container fully boot gateway + plugins
        setTimeout(async () => {
          try {
            const login = await startZaloUserLogin(projectDir, state.mode);
            if (login?.qrDataUrl) sendLog(`[zalouser:qr] ${login.qrDataUrl}`);
            if (login?.message) sendLog(`[zalouser] ${login.message}`);
          } catch (err) {
            sendLog(`[zalouser] Login failed: ${err.message}`);
          }
        }, 5000);
      }
      return json(res, result);
    }
    if (url.pathname.startsWith('/api/bot/') && req.method === 'PUT' && !url.pathname.startsWith('/api/bot/files/')) {
      const agentId = decodeURIComponent(url.pathname.split('/').pop() || '');
      const body = await readJson(req);
      const projectDir = await resolveProjectDir(rootProjectDir, body);
      const result = await updateBotInProject(projectDir, agentId, body, { mode: state.mode, os: state.os });
      await saveState(rootProjectDir);
      await recreateDockerBot(projectDir).catch((err) => sendLog(`[docker] recreate skipped/failed: ${err.message}`));
      return json(res, result);
    }
    if (url.pathname === '/api/zalo/login' && req.method === 'POST') {
      const projectDir = await resolveProjectDir(rootProjectDir);
      setImmediate(async () => {
        try {
          const login = await startZaloUserLogin(projectDir, state.mode);
          if (login?.qrDataUrl) sendLog(`[zalouser:qr] ${login.qrDataUrl}`);
          if (login?.message) sendLog(`[zalouser] ${login.message}`);
        } catch (err) {
          sendLog(`[zalouser] Login failed: ${err.message}`);
        }
      });
      return json(res, { ok: true, message: 'Zalo login initiated. QR will appear in UI.' });
    }
    if (url.pathname.startsWith('/api/bot/') && req.method === 'DELETE' && !url.pathname.startsWith('/api/bot/files/')) {
      const agentId = decodeURIComponent(url.pathname.replace('/api/bot/', ''));
      const projectDir = await resolveProjectDir(rootProjectDir);
      const result = await deleteBotInProject(projectDir, agentId);
      sendLog(`? Bot deleted: ${agentId}`);
      await recreateDockerBot(projectDir).catch((err) => sendLog(`[docker] recreate skipped/failed: ${err.message}`));
      return json(res, result);
    }
    if (url.pathname === '/api/bot/files' && req.method === 'GET') {
      await resolveProjectDir(rootProjectDir);
      return json(res, { files: state.projectDir ? await listMarkdownFiles(state.projectDir, url.searchParams.get('agentId') || '') : [] });
    }
    if (url.pathname.startsWith('/api/bot/files/') && state.projectDir) {
      const name = decodeURIComponent(url.pathname.replace('/api/bot/files/', ''));
      const file = safeJoin(state.projectDir, name);
      if (req.method === 'GET') return json(res, { name, content: await fsp.readFile(file, 'utf8') });
      if (req.method === 'PUT') {
        if (!name.endsWith('.md')) throw httpError(400, 'Only markdown files (.md) can be modified');
        const body = await readJson(req);
        await fsp.writeFile(file, String(body.content || ''), 'utf8');
        return json(res, { ok: true });
      }
    }
    if (url.pathname === '/api/catalog' && req.method === 'GET') return json(res, {
      skills: [
        { name: 'Browser', slug: 'browser' },
        { name: 'Cron', slug: 'cron' },
      ],
      plugins: [
        { name: 'openclaw-browser-automation', package: 'openclaw-browser-automation' },
        { name: 'openclaw-zalo-mod', package: 'openclaw-zalo-mod' },
        { name: 'openclaw-facebook-crawler', package: 'openclaw-facebook-crawler' },
        { name: 'openclaw-n8n-facebook-poster', package: 'openclaw-n8n-facebook-poster' },
      ]
    });
    if (url.pathname === '/api/features' && req.method === 'GET') {
      const projectDir = await resolveProjectDir(rootProjectDir);
      return json(res, await getFeatureFlags(projectDir, url.searchParams.get('agentId') || ''));
    }
    if (url.pathname === '/api/features/toggle' && req.method === 'POST') {
      const body = await readJson(req);
      const projectDir = await resolveProjectDir(rootProjectDir);
      return json(res, await applyFeatureToggle(projectDir, body.agentId || '', body.kind, body.id, !!body.enabled));
    }
    if (url.pathname === '/api/features/install' && req.method === 'POST') {
      const body = await readJson(req);
      const projectDir = await resolveProjectDir(rootProjectDir);
      return json(res, await installFeature(projectDir, body.agentId || '', body.kind, body.id));
    }
    if (await serveStatic(req, res)) return;
    json(res, { error: 'Not found' }, 404);
  } catch (err) {
    json(res, { error: err.message }, err.status || 500);
  }
}

function findPort(host, preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(findPort(host, preferredPort + 1)));
    server.listen(preferredPort, host, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function openUrl(url) {
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', shell: false, windowsHide: true });
  child.unref();
}

export async function startLocalInstaller({ host = '127.0.0.1', preferredPort = 51789, openBrowser = true, projectDir = process.cwd() } = {}) {
  const port = await findPort(host, preferredPort);
  const server = http.createServer((req, res) => handler(req, res, projectDir));
  await new Promise((resolve) => server.listen(port, host, resolve));
  const url = `http://${host}:${port}`;
  console.log(`OpenClaw Setup UI: ${url}`);
  console.log('Legacy CLI: create-openclaw-bot legacy');
  if (openBrowser) openUrl(url);
}

export { createBotInProject, deleteBotInProject, validateOpenclawConfig, startZaloUserLogin, readBotCredentials, resolveProject9RouterApiKey };



