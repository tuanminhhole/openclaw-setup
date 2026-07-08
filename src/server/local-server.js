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
const { buildWorkspaceFileMap, buildCronjobSkillMd, buildInfographicGeneratorSkillMd, buildInfographicGeneratorJs, buildStickerMentionSkillMd, buildStickerMentionJs } = loadSharedModule('../setup/shared/workspace-gen.js', '__openclawWorkspace');
const { buildOpenclawJson, buildEnvFileContent, buildExecApprovalsJson } = loadSharedModule('../setup/shared/bot-config-gen.js', '__openclawBotConfig');
const { buildDockerArtifacts } = loadSharedModule('../setup/shared/docker-gen.js', '__openclawDockerGen');
const { OPENCLAW_NPM_SPEC, NINE_ROUTER_NPM_SPEC, build9RouterProviderConfig, get9RouterBaseUrl } = loadSharedModule('../setup/shared/common-gen.js', '__openclawCommon');
const dataExport = loadSharedModule('../setup/data/index.js', '__openclawData');

async function syncExecApprovals(projectDir, cfg) {
  const openclawHome = join(projectDir, '.openclaw');
  const agentMetas = (cfg.agents?.list || []).map((a) => ({ agentId: a.id }));
  const approvals = buildExecApprovalsJson({ agentMetas });

  const path1 = join(openclawHome, 'exec-approvals.json');
  const nestedDir = join(openclawHome, '.openclaw');
  const path2 = join(nestedDir, 'exec-approvals.json');

  await fsp.mkdir(openclawHome, { recursive: true }).catch(() => {});
  await fsp.writeFile(path1, JSON.stringify(approvals, null, 2), 'utf8');

  await fsp.mkdir(nestedDir, { recursive: true }).catch(() => {});
  let existing = {};
  if (existsSync(path2)) {
    try {
      existing = JSON.parse(await fsp.readFile(path2, 'utf8'));
    } catch (e) {}
  }
  if (existing.socket) {
    approvals.socket = existing.socket;
  }
  await fsp.writeFile(path2, JSON.stringify(approvals, null, 2), 'utf8');
}

async function patchBrowserAutomationHostPreference(projectDir, aliases = [], sendLog = () => {}) {
  const preferredCdpBlock = `const dns = require('dns').promises;
const DEFAULT_CDP_URLS = [
    'host-gateway:9222',
    'http://127.0.0.1:9222',
];
const CDP_URLS = (process.env.OPENCLAW_BROWSER_CDP_URLS || DEFAULT_CDP_URLS.join(','))
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

async function normalizeCdpUrl(url) {
    if (url === 'host-gateway:9222') {
        try {
            const resolved = await dns.lookup('host.docker.internal');
            return 'http://' + resolved.address + ':9222';
        } catch (_) {
            return 'http://host.docker.internal:9222';
        }
    }
    return url;
}

async function connectPreferredChrome() {
    let lastError;
    for (const rawUrl of CDP_URLS) {
        const url = await normalizeCdpUrl(rawUrl);
        try {
            const connected = await chromium.connectOverCDP(url, { timeout: 2500 });
            console.error('[Browser] Connected CDP: ' + url);
            return connected;
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error('No Chrome CDP endpoint available');
}`;

  const patchContent = (content) => {
    let next = content;
    next = next.replace(
      "const CDP_URL = 'http://127.0.0.1:9222';",
      preferredCdpBlock
    );
    next = next.replace(
      'browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });',
      'browser = await connectPreferredChrome();'
    );
    return next;
  };

  const browserToolCandidates = new Set();
  const extensionDirs = [];
  for (const alias of aliases) {
    const extensionDir = join(projectDir, '.openclaw', 'extensions', alias);
    extensionDirs.push(extensionDir);
    browserToolCandidates.add(join(extensionDir, 'browser-tool.js'));
  }

  const workspaceDirs = new Set();
  try {
    const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
    if (existsSync(cfgPath)) {
      const cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
      for (const a of cfg.agents?.list || []) {
        const workspaceRel = a.workspace || cfg.agents?.defaults?.workspace;
        if (!workspaceRel) continue;
        const workspacePath = workspaceRel.startsWith('/') ? join(projectDir, workspaceRel.replace(/^\/home\/node\/project\/?/, '')) : join(projectDir, workspaceRel);
        workspaceDirs.add(workspacePath);
        browserToolCandidates.add(join(workspacePath, 'plugin-skills', 'browser-automation', 'browser-tool.js'));
      }
    }
  } catch (err) {
    sendLog(`[browser] Warning: could not scan workspaces for browser-tool.js: ${err.message}`);
  }

  let patched = 0;
  for (const file of browserToolCandidates) {
    if (!existsSync(file)) continue;
    const content = await fsp.readFile(file, 'utf8');
    if (content.includes('connectPreferredChrome')) continue;
    const next = patchContent(content);
    if (next !== content) {
      await fsp.writeFile(file, next, 'utf8');
      patched += 1;
    }
  }
  if (patched > 0) {
    sendLog(`[browser] Patched ${patched} browser-tool.js file(s) to prefer host Chrome debug before headless Chromium.`);
  }

  const browserMd = `# Browser Automation

This plugin skill owns browser automation only. For normal web search, use OpenClaw's built-in \`web_search\` capability.

Run commands from this folder or pass the full path from the workspace root:

- \`cd plugin-skills/browser-automation && node browser-tool.js status\`
- \`node plugin-skills/browser-automation/browser-tool.js status\`

## Chrome Debug Mode

On a desktop machine, start real Chrome in debug mode before asking the bot to browse:

- Windows: run \`start-chrome-debug.bat\`
- macOS/Linux: run \`./start-chrome-debug.sh\`

The tool will try real host Chrome first. If Chrome debug is not available, it falls back to local headless Chromium, which is suitable for VPS/server use.

## Browser Commands

- \`node plugin-skills/browser-automation/browser-tool.js status\`: check the active browser/tab
- \`node plugin-skills/browser-automation/browser-tool.js open <url>\`: open a page
- \`node plugin-skills/browser-automation/browser-tool.js get_text [max_chars]\`: read rendered page text
- \`node plugin-skills/browser-automation/browser-tool.js get_links [filter]\`: list links
- \`node plugin-skills/browser-automation/browser-tool.js click "<selector>"\`: click an element
- \`node plugin-skills/browser-automation/browser-tool.js fill "<selector>" "<text>"\`: fill an input
- \`node plugin-skills/browser-automation/browser-tool.js scroll [px]\`: scroll the page
- \`node plugin-skills/browser-automation/browser-tool.js screenshot [path]\`: capture the viewport
- \`node plugin-skills/browser-automation/browser-tool.js tabs\`: list tabs

Do not call \`search-tool.js\`; browser-automation does not own search. Use \`web_search\` for search and this browser tool only when a rendered browser is needed.
`;

  const removeManagedBlock = (content, blockId) => {
    const startTag = `<!-- OPENCLAW:${blockId}:START -->`;
    const endTag = `<!-- OPENCLAW:${blockId}:END -->`;
    const startIdx = content.indexOf(startTag);
    const endIdx = content.indexOf(endTag);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return content;
    return `${content.substring(0, startIdx).trimEnd()}\n${content.substring(endIdx + endTag.length).trimStart()}`.trim() + '\n';
  };

  const hostOs = normalizeHostOs(await resolveProjectHostOs(projectDir));
  const shouldKeepBat = hostOs === 'win';
  const scriptToKeep = shouldKeepBat ? 'start-chrome-debug.bat' : 'start-chrome-debug.sh';
  const scriptToRemove = shouldKeepBat ? 'start-chrome-debug.sh' : 'start-chrome-debug.bat';
  const sourceScript = extensionDirs.map((dir) => join(dir, scriptToKeep)).find((file) => existsSync(file));
  const sourceBrowserTool = extensionDirs.map((dir) => join(dir, 'browser-tool.js')).find((file) => existsSync(file));

  let sanitized = 0;
  for (const workspacePath of workspaceDirs) {
    if (!existsSync(workspacePath)) continue;
    const pluginSkillPath = join(workspacePath, 'plugin-skills', 'browser-automation');
    await fsp.mkdir(pluginSkillPath, { recursive: true }).catch(() => {});
    await fsp.rm(join(workspacePath, 'search-tool.js'), { force: true }).catch(() => {});
    await fsp.rm(join(workspacePath, 'browser-tool.js'), { force: true }).catch(() => {});
    await fsp.rm(join(workspacePath, 'BROWSER.md'), { force: true }).catch(() => {});
    await fsp.rm(join(workspacePath, scriptToRemove), { force: true }).catch(() => {});
    await fsp.rm(join(workspacePath, scriptToKeep), { force: true }).catch(() => {});
    await fsp.rm(join(pluginSkillPath, scriptToRemove), { force: true }).catch(() => {});
    if (sourceBrowserTool) {
      const targetBrowserTool = join(pluginSkillPath, 'browser-tool.js');
      await fsp.copyFile(sourceBrowserTool, targetBrowserTool).catch(() => {});
      if (existsSync(targetBrowserTool)) {
        const content = await fsp.readFile(targetBrowserTool, 'utf8');
        const next = content.includes('connectPreferredChrome') ? content : patchContent(content);
        if (next !== content) await fsp.writeFile(targetBrowserTool, next, 'utf8');
      }
    }
    if (sourceScript) {
      await fsp.copyFile(sourceScript, join(pluginSkillPath, scriptToKeep)).catch(() => {});
      if (scriptToKeep.endsWith('.sh')) await fsp.chmod(join(pluginSkillPath, scriptToKeep), 0o755).catch(() => {});
    }
    await fsp.writeFile(join(pluginSkillPath, 'BROWSER.md'), browserMd, 'utf8');
    for (const dirName of ['cl-stealth-search', 'openclaw-smart-search']) {
      await fsp.rm(join(workspacePath, 'plugin-skills', dirName), { recursive: true, force: true }).catch(() => {});
    }
    const toolsMdPath = join(workspacePath, 'TOOLS.md');
    if (existsSync(toolsMdPath)) {
      const toolsContent = await fsp.readFile(toolsMdPath, 'utf8');
      const cleaned = removeManagedBlock(toolsContent, 'STEALTH_BROWSER_GUIDE');
      if (cleaned !== toolsContent) await fsp.writeFile(toolsMdPath, cleaned, 'utf8');
    }
    sanitized += 1;
  }
  if (sanitized > 0) {
    sendLog(`[browser] Sanitized ${sanitized} workspace(s): browser assets are in plugin-skills/browser-automation; web_search remains responsible for search.`);
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(__dirname, '../web');
const SETUP_VERSION = (() => { try { return JSON.parse(fs.readFileSync(resolve(__dirname, '../../package.json'), 'utf8')).version || '0.0.0'; } catch { return '0.0.0'; } })();
let latestSetupVersionCache = SETUP_VERSION;
let isFetchingLatestSetup = false;

async function fetchLatestSetupVersionBg() {
  if (isFetchingLatestSetup) return;
  isFetchingLatestSetup = true;
  try {
    // Distribution is GitHub (not npm) — read the version straight from main so the
    // "latest" reflects `npx github:…`, not the stale last-published npm release.
    const resp = await fetch(
      'https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/package.json',
      { signal: AbortSignal.timeout(4000), headers: { 'Cache-Control': 'no-cache' } },
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data.version) {
        latestSetupVersionCache = data.version;
      }
    }
  } catch (e) {
  } finally {
    isFetchingLatestSetup = false;
  }
}
fetchLatestSetupVersionBg().catch(() => {});

const DEFAULT_PROJECT_NAME = 'openclaw-setup';
const STATE_FILE = '.openclaw-setup-state.json';
const DEFAULT_MODEL = 'smart-route';
const logClients = new Set();
let zaloLoginInFlight = false;
let activeServerInstance = null;
// Captured at startup so a self-restart (update button) re-binds the SAME host/port,
// letting the browser tab reconnect to the new UI instead of hanging.
let activeUiHost = '127.0.0.1';
let activeUiPort = 51789;
let activeUiProjectDir = process.cwd();
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
  projects: null,
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

function normalizeHostOs(value = '') {
  const v = String(value || '').trim().toLowerCase();
  if (['win', 'windows', 'win32'].includes(v)) return 'win';
  if (['mac', 'macos', 'darwin'].includes(v)) return 'macos';
  if (['vps', 'server'].includes(v)) return 'vps';
  if (['linux', 'linux-desktop', 'ubuntu', 'debian'].includes(v)) return 'linux-desktop';
  return '';
}

async function resolveProjectHostOs(projectDir = '') {
  try {
    const cfgPath = join(projectDir || '', '.openclaw', 'openclaw.json');
    if (existsSync(cfgPath)) {
      const cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
      const pluginEntries = cfg.plugins?.entries || {};
      const browserEntry = pluginEntries['browser-automation'] || pluginEntries['openclaw-browser-automation'] || {};
      const fromConfig = normalizeHostOs(browserEntry.config?.hostOs || cfg.meta?.osChoice || cfg.meta?.hostOs);
      if (fromConfig) return fromConfig;
    }
  } catch {}
  const fromState = normalizeHostOs(state.os);
  if (fromState) return fromState;
  if (/^[A-Za-z]:[\\/]/.test(String(projectDir || ''))) return 'win';
  return detectOs();
}

function getRealHomedir() {
  const home = os.homedir();
  if (process.platform === 'win32') return home;
  const sudoUser = process.env.SUDO_USER;
  if (sudoUser && (home === '/root' || home.startsWith('/root/'))) {
    const userHome = process.platform === 'darwin' ? `/Users/${sudoUser}` : `/home/${sudoUser}`;
    if (existsSync(userHome)) {
      return userHome;
    }
  }
  return home;
}

function resolveBinPath(cmd) {
  if (!cmd || cmd.includes('/') || cmd.includes('\\')) return cmd;
  const nodeBinDir = dirname(process.argv[0]);
  const localPath = join(nodeBinDir, process.platform === 'win32' ? `${cmd}.cmd` : cmd);
  if (existsSync(localPath)) return localPath;
  const localExe = join(nodeBinDir, process.platform === 'win32' ? `${cmd}.exe` : cmd);
  if (existsSync(localExe)) return localExe;
  const nodeModulesBin = join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? `${cmd}.cmd` : cmd);
  if (existsSync(nodeModulesBin)) return nodeModulesBin;
  return cmd;
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

// Docker is the only supported deploy mode now (native was removed).
function recommendedMode() {
  return 'docker';
}

function commandExists(cmd, args = ['--version']) {
  return new Promise((resolve) => {
    const shell = process.platform === 'win32';
    const rawBin = resolveBinPath(cmd);
    const bin = shell && rawBin.includes(' ') && !rawBin.startsWith('"') ? `"${rawBin}"` : rawBin;
    execFile(bin, args, { windowsHide: true, timeout: 5000, shell }, (err, stdout, stderr) => {
      resolve({ ok: !err, output: String(stdout || stderr || '').trim() });
    });
  });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    sendLog(`$ ${cmd} ${args.join(' ')}`);
    const shell = process.platform === 'win32';
    const rawBin = resolveBinPath(cmd);
    const bin = shell && rawBin.includes(' ') && !rawBin.startsWith('"') ? `"${rawBin}"` : rawBin;
    const child = spawn(bin, args, { cwd: opts.cwd, shell, env: { ...process.env, ...(opts.env || {}) } });
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

// Per-project cache for EXPENSIVE runtime/version probes (docker exec + openclaw CLI). These
// values are effectively static between updates/rebuilds/installs, so caching them avoids
// re-probing on every Dashboard/Bot page load (the main source of slow loads). Entries with
// ttl=0 live until explicitly cleared (see probeCacheClear calls on update/rebuild/restart/install).
const _probeCache = new Map();
function probeCacheGet(key) {
  const e = _probeCache.get(key);
  if (!e) return undefined;
  if (e.exp && e.exp < Date.now()) { _probeCache.delete(key); return undefined; }
  return e.value;
}
function probeCacheSet(key, value, ttlMs = 0) { _probeCache.set(key, { value, exp: ttlMs ? Date.now() + ttlMs : 0 }); }
function probeCacheClear(prefix = '') {
  if (!prefix) { _probeCache.clear(); return; }
  for (const k of [..._probeCache.keys()]) if (k.startsWith(prefix)) _probeCache.delete(k);
}

async function resolveProjectRuntimeVersions(projectDir, mode = state.mode || 'docker') {
  const fallback = {
    openclaw: '',
    nineRouter: '',
    node: process.version || '',
  };
  if (!projectDir) return fallback;
  const ck = `ver:${projectDir}:${mode}`;
  const cached = probeCacheGet(ck);
  if (cached) return cached;
  let result;
  if (mode === 'docker') {
    const compose = await readComposeText(projectDir);
    const botContainer = getBotContainerName(projectDir);
    const routerContainer = parseComposeServiceContainerName(compose, '9router') || '9router';
    const [openclawOut, routerOut, nodeOut] = await Promise.all([
      runCapture('docker', ['exec', botContainer, 'node', '-e', "const fs=require('fs');const p='/usr/local/lib/node_modules/openclaw/package.json';process.stdout.write(fs.existsSync(p)?String(JSON.parse(fs.readFileSync(p,'utf8')).version||''):'')"], { shell: false }),
      runCapture('docker', ['exec', routerContainer, 'node', '-e', "fetch('http://localhost:20128/api/version').then(async r=>{const d=await r.json().catch(()=>({}));process.stdout.write(String(d.currentVersion||''));}).catch(()=>process.stdout.write(''))"], { shell: false }),
      runCapture('docker', ['exec', botContainer, 'node', '--version'], { shell: false }),
    ]);
    result = {
      openclaw: String(openclawOut.stdout || '').trim(),
      nineRouter: String(routerOut.stdout || '').trim(),
      node: String(nodeOut.stdout || '').trim(),
    };
  } else {
    const current = await getCurrentRuntimeVersions();
    result = {
      openclaw: current.openclaw || '',
      nineRouter: current.nineRouter || '',
      node: current.node || process.version || '',
    };
  }
  // Cache only meaningful results (don't pin empties from a container that's mid-restart).
  if (result.openclaw || result.nineRouter || result.node) probeCacheSet(ck, result);
  return result;
}

function runStreamed(cmd, args, opts = {}) {
  sendLog(`$ ${cmd} ${args.join(' ')}`);
  const shell = opts.shell ?? process.platform === 'win32';
  const rawBin = resolveBinPath(cmd);
  const bin = shell && rawBin.includes(' ') && !rawBin.startsWith('"') ? `"${rawBin}"` : rawBin;
  const child = spawn(bin, args, {
    cwd: opts.cwd,
    shell,
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
  const shell = opts.shell ?? process.platform === 'win32';
  const rawBin = resolveBinPath(cmd);
  const bin = shell && rawBin.includes(' ') && !rawBin.startsWith('"') ? `"${rawBin}"` : rawBin;
  const child = spawn(bin, args, {
    cwd: opts.cwd,
    shell,
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
    const shell = opts.shell ?? process.platform === 'win32';
    const rawBin = resolveBinPath(cmd);
    const bin = shell && rawBin.includes(' ') && !rawBin.startsWith('"') ? `"${rawBin}"` : rawBin;
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      shell,
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

function parseJsonText(text, fallback = undefined) {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  if (!clean.trim() && fallback !== undefined) return fallback;
  return JSON.parse(clean);
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
  return text ? parseJsonText(text) : null;
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
  const ck = `runtime:${projectDir}`;
  const cached = probeCacheGet(ck);
  if (cached) return cached;
  const cfgPath = join(projectDir || '', '.openclaw', 'openclaw.json');
  const cfg = existsSync(cfgPath) ? parseJsonText(await fsp.readFile(cfgPath, 'utf8').catch(() => '{}'), {}) : {};
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
  const rt = {
    gatewayPort,
    routerPort,
    gatewayUrl: `http://127.0.0.1:${gatewayPort}`,
    routerUrl: `http://127.0.0.1:${routerPort}`,
    mode: existsSync(join(projectDir || '', 'docker', 'openclaw', 'docker-compose.yml')) ? 'docker' : 'native',
    cliGatewayStatus,
    syncSource,
  };
  // Ports/mode are static; cache briefly so repeated page loads don't re-run the slow openclaw
  // CLI probes. Cleared explicitly on update/rebuild/restart.
  if (projectDir) probeCacheSet(ck, rt, 120000);
  return rt;
}

// Projects whose one-time migration + Docker-infra sync has already run this server lifetime.
// The legacy-path migration, 9router-key resolution and Docker-file regeneration only need to
// happen once per project (or after an explicit update) — not on every status poll. detectRuntime
// (cached) still refreshes ports/mode cheaply on each call so state stays current.
const _runtimeSynced = new Set();
async function syncRuntimeState(projectDir, { full = false } = {}) {
  if (!projectDir || !existsSync(join(projectDir, '.openclaw', 'openclaw.json'))) return;
  const firstSync = full || !_runtimeSynced.has(projectDir);
  if (firstSync) {
    // Auto-migrate legacy /root/project paths → /home/node/project in openclaw.json
    await migrateContainerPaths(projectDir).catch(() => {});
    await applyResolved9RouterApiKey(projectDir).catch(() => {});
  }
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
  // Auto-sync Docker files if outdated — only on first sync (or forced); the version stamp gate
  // inside syncDockerInfra already no-ops on matching versions, but skipping the call entirely
  // avoids the repeated file reads on every page load.
  if (firstSync && rt.mode === 'docker') {
    await syncDockerInfra(projectDir).catch((err) =>
      sendLog(`[sync] Docker infra sync skipped: ${err.message}`)
    );
  }
  _runtimeSynced.add(projectDir);
}

/**
 * Migrate legacy /root/project/ paths to /home/node/project/ in openclaw.json.
 * Old projects may have been created with /root/project/ which doesn't match the
 * Docker volume mount point (/home/node/project/.openclaw).
 * Also clears stale workspace attestation files to prevent WorkspaceVanishedError.
 */
async function migrateContainerPaths(projectDir) {
  const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
  if (!existsSync(cfgPath)) return;
  let raw = await fsp.readFile(cfgPath, 'utf8');
  if (!raw.includes('/root/project/')) return;
  // Replace all /root/project/ references with /home/node/project/
  const updated = raw.replace(/\/root\/project\//g, '/home/node/project/');
  if (updated !== raw) {
    await fsp.writeFile(cfgPath, updated, 'utf8');
    sendLog('[migrate] Fixed legacy /root/project/ paths → /home/node/project/ in openclaw.json');
    // Clear stale workspace attestations to avoid WorkspaceVanishedError
    const attestDir = join(projectDir, '.openclaw', 'workspace-attestations');
    if (existsSync(attestDir)) {
      try {
        const files = await fsp.readdir(attestDir);
        for (const f of files) {
          if (f.endsWith('.attested')) {
            await fsp.unlink(join(attestDir, f)).catch(() => {});
          }
        }
        sendLog('[migrate] Cleared stale workspace attestation files');
      } catch {}
    }
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

// Sidecar storing the RAW editable persona fields (config strips them, markdown
// is lossy). Lets the edit modal prefill exactly what the user entered.
async function writeBotMeta(projectDir, workspaceDir, meta) {
  try {
    const dir = join(projectDir, '.openclaw', workspaceDir);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(join(dir, 'bot-meta.json'), JSON.stringify(meta || {}, null, 2), 'utf8');
  } catch { /* non-fatal */ }
}

async function readBotMeta(projectDir, agent, cfg) {
  try {
    const rel = workspaceRelForAgent(agent, cfg, projectDir);
    if (!rel) return {};
    const file = join(projectDir, '.openclaw', rel, 'bot-meta.json');
    if (!existsSync(file)) return {};
    return JSON.parse(await fsp.readFile(file, 'utf8').catch(() => '{}')) || {};
  } catch { return {}; }
}

async function readProjectEnv(projectDir) {
  try {
    const p = join(projectDir, '.env');
    if (!existsSync(p)) return {};
    const txt = await fsp.readFile(p, 'utf8');
    const out = {};
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch { return {}; }
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
      // Auto-fix legacy /root/project paths → /home/node/project (Docker container path)
      if (agent.workspace && agent.workspace.includes('/root/project/')) {
        agent.workspace = agent.workspace.replace('/root/project/', '/home/node/project/');
      }
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

function ensureFbMessengerChannel(cfg, pageId, appId) {
  cfg.channels['fb-messenger'] = cfg.channels['fb-messenger'] || {
    enabled: true,
    dmPolicy: 'open',
    allowFrom: ['*'],
    historyLimit: 50,
  };
  cfg.channels['fb-messenger'].enabled = true;
  if (pageId) cfg.channels['fb-messenger'].pageId = pageId;
  // Secrets (pageAccessToken/appSecret/verifyToken) live in .env, not openclaw.json.
  // Register the external channel plugin so the gateway loads it.
  cfg.plugins.entries = cfg.plugins.entries || {};
  cfg.plugins.entries['fb-messenger'] = cfg.plugins.entries['fb-messenger'] || { enabled: true };
  cfg.plugins.allow = cfg.plugins.allow || [];
  if (!cfg.plugins.allow.includes('fb-messenger')) cfg.plugins.allow.push('fb-messenger');
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
  const homeApiKey = read9RouterApiKeyFromSqlite(join(getRealHomedir(), '.9router', 'db', 'data.sqlite'));
  if (homeApiKey) return homeApiKey;
  return '';
}

async function applyResolved9RouterApiKey(projectDir, cfg = null) {
  if (!projectDir) return '';
  const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
  if (!existsSync(cfgPath)) return '';
  const current = cfg || ensureConfigShape(parseJsonText(await fsp.readFile(cfgPath, 'utf8')));
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
  const cfg = ensureConfigShape(parseJsonText(await fsp.readFile(found.cfgPath, 'utf8')));
  return {
    openclawToken: cfg.gateway?.auth?.token || '',
    nineRouterApiKey: await resolveProject9RouterApiKey(projectDir, cfg),
  };
}

async function updateBotCredentials(projectDir, body = {}) {
  const found = readProjectConfig(projectDir);
  if (!found) throw httpError(400, 'Install project not found');
  const raw = await fsp.readFile(found.cfgPath, 'utf8');
  const cfg = ensureConfigShape(parseJsonText(raw));
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
  if (agent && typeof agent === 'object' && ['telegram', 'zalo-personal', 'zalo-bot', 'fb-messenger'].includes(agent.channel)) return agent.channel;
  const binding = (cfg.bindings || []).find((b) => b.agentId === agentId);
  const ch = binding?.match?.channel;
  if (ch === 'zalouser') return 'zalo-personal';
  if (ch === 'zalo') return 'zalo-bot';
  if (ch === 'telegram') return 'telegram';
  if (ch === 'fb-messenger') return 'fb-messenger';
  if (cfg.channels?.telegram && agentId) return 'telegram';
  return 'unknown';
}

function mapAgentChannels(agent, cfg) {
  if (agent?.channel && ['telegram', 'zalo-personal', 'zalo-bot', 'fb-messenger'].includes(agent.channel)) return [agent.channel];
  const channels = (cfg.bindings || [])
    .filter((b) => b.agentId === agent?.id)
    .map((b) => b.match?.channel === 'zalouser' ? 'zalo-personal' : b.match?.channel === 'zalo' ? 'zalo-bot' : b.match?.channel)
    .filter((ch) => ['telegram', 'zalo-personal', 'zalo-bot', 'fb-messenger'].includes(ch));
  if (channels.length) return Array.from(new Set(channels));
  const enabled = [];
  if (cfg.channels?.telegram?.enabled) enabled.push('telegram');
  if (cfg.channels?.zalouser?.enabled) enabled.push('zalo-personal');
  if (cfg.channels?.zalo?.enabled) enabled.push('zalo-bot');
  if (cfg.channels?.['fb-messenger']?.enabled) enabled.push('fb-messenger');
  return enabled.length === 1 ? enabled : [mapAgentChannel(agent, cfg)];
}

async function listConfiguredBots(projectDir) {
  const cfgPath = join(projectDir || '', '.openclaw', 'openclaw.json');
  if (!projectDir || !existsSync(cfgPath)) return [];
  const raw = await fsp.readFile(cfgPath, 'utf8');
  const cfg = ensureConfigShape(parseJsonText(raw));
  const normalized = JSON.stringify(cfg, null, 2) + '\n';
  if (normalized !== raw) await fsp.writeFile(cfgPath, normalized, 'utf8');
  const rows = await Promise.all(cfg.agents.list.map(async (agent) => {
    const identity = await readAgentIdentity(projectDir, agent);
    const meta = await readBotMeta(projectDir, agent, cfg);
    const env = await readProjectEnv(projectDir);
    const hasOwnWorkspace = !!agent.workspace;
    const identityName = usableIdentityName(identity.name);
    return mapAgentChannels(agent, cfg).map((channel) => ({
      id: agent.id,
      name: (hasOwnWorkspace ? identityName : agent.name) || agent.name || identityName || agent.id,
      role: identity.role || meta.role || agent.role || agent.desc || agent.description || '',
      channel,
      workspace: agent.workspace || `.openclaw/${workspaceRelForAgent(agent, cfg, projectDir)}`,
      agentDir: agent.agentDir,
      persona: meta.persona || '',
      userName: meta.userName || '',
      userDescription: meta.userDescription || '',
      emoji: meta.emoji || '',
      pageId: channel === 'fb-messenger' ? (cfg.channels?.['fb-messenger']?.pageId || '') : '',
      appId: meta.appId || '',
      pageAccessToken: channel === 'fb-messenger' ? (env.FB_MESSENGER_PAGE_ACCESS_TOKEN || '') : '',
      appSecret: channel === 'fb-messenger' ? (env.FB_MESSENGER_APP_SECRET || '') : '',
      verifyToken: channel === 'fb-messenger' ? (env.FB_MESSENGER_VERIFY_TOKEN || '') : '',
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
  const cfg = ensureConfigShape(parseJsonText(await fsp.readFile(cfgPath, 'utf8')));
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
  await syncExecApprovals(projectDir, cfg);

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
  
  let activeModel = 'smart-route';
  let activeProvider = '9Router';
  if (state.projectDir) {
    const cfgPath = join(state.projectDir, '.openclaw', 'openclaw.json');
    if (existsSync(cfgPath)) {
      try {
        const raw = await fsp.readFile(cfgPath, 'utf8');
        const cfg = JSON.parse(raw);
        const modelStr = cfg.agents?.defaults?.model?.primary || cfg.agents?.list?.[0]?.model?.primary || 'smart-route';
        if (modelStr.includes('/')) {
          const parts = modelStr.split('/');
          activeProvider = parts[0];
          activeModel = parts.slice(1).join('/');
        } else {
          activeModel = modelStr;
          activeProvider = cfg.models?.providers?.openai ? 'openai' : '9router';
        }
      } catch (e) {}
    }
  }

  const cap = (s) => String(s).toLowerCase() === 'openai' ? 'OpenAI' : String(s).toLowerCase() === '9router' ? '9Router' : s;
  activeProvider = cap(activeProvider);

  return { ...state, gatewayStatus, routerStatus, bots, credentials, runtimeVersions, activeModel, activeProvider };
}

async function createBotInProject(projectDir, body = {}, runtime = {}) {
  if (!projectDir) throw httpError(400, 'Install project not found');
  const channel = body.channel || 'telegram';
  if (!['telegram', 'zalo-personal', 'zalo-bot', 'fb-messenger'].includes(channel)) throw httpError(400, 'Unsupported channel');
  const token = String(body.token || '').trim();
  if ((channel === 'telegram' || channel === 'zalo-bot') && !token) throw httpError(400, 'Token is required for this channel');
  const fbPageId = String(body.pageId || '').trim();
  const fbPageToken = String(body.pageAccessToken || '').trim();
  const fbAppSecret = String(body.appSecret || '').trim();
  const fbVerifyToken = String(body.verifyToken || '').trim();
  const fbAppId = String(body.appId || '').trim();
  if (channel === 'fb-messenger' && (!fbPageToken || !fbVerifyToken)) {
    throw httpError(400, 'Page Access Token and Verify Token are required for Facebook Messenger');
  }

  const requestedBotName = String(body.botName || '').trim() || 'OpenClaw Bot';
  const botDesc = String(body.role || body.botDesc || '').trim() || 'Personal OpenClaw assistant';
  const persona = String(body.personality || body.persona || '').trim();
  const emoji = String(body.emoji || '').trim();
  const userName = String(body.userName || '').trim();
  const userDesc = String(body.userDescription || body.userDesc || '').trim();
  const userInfo = [userName ? `- **Tên:** ${userName}` : '', userDesc ? `- **Mô tả:** ${userDesc}` : ''].filter(Boolean).join('\n');

  const openclawHome = join(projectDir, '.openclaw');
  await fsp.mkdir(openclawHome, { recursive: true });
  const cfgPath = join(openclawHome, 'openclaw.json');
  const cfg = ensureConfigShape(existsSync(cfgPath) ? JSON.parse(await fsp.readFile(cfgPath, 'utf8')) : buildOpenclawJson({
    botName: requestedBotName,
    channelKey: channel,
    providerKey: '9router',
    deployMode: runtime.mode || state.mode || 'docker',
    osChoice: runtime.os || state.os || detectOs(),
    selectedSkills: ['memory', 'web-search', 'scheduler'],
    skills: dataExport.SKILLS || [],
    agentMetas: [],
  }));

  const used = new Set(cfg.agents.list.map((a) => a.id));
  const botName = uniqueDisplayName(requestedBotName, new Set(cfg.agents.list.map((a) => a.name || a.id)));
  let agentId = body.agentId ? String(body.agentId).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-') : '';
  if (!agentId) {
    agentId = uniqueSlug(slugify(botName), used);
  } else {
    if (used.has(agentId)) {
      throw httpError(400, `Bot ID "${agentId}" đã tồn tại. Vui lòng chọn ID khác.`);
    }
  }
  const workspaceDir = `workspace-${agentId}`;
  const model = cfg.agents.defaults?.model?.primary || cfg.agents.list[0]?.model?.primary || DEFAULT_MODEL;
  cfg.agents.list.push({
    id: agentId,
    name: botName,
    // Relative workspace path — resolves against the process cwd (project root) in both docker
    // and native. See buildOpenclawJson() for the full rationale.
    workspace: `.openclaw/${workspaceDir}`,
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
    const zu = cfg.channels.zalouser;
    zu.accounts = zu.accounts || {};
    const defAcct = zu.defaultAccount || 'default';
    // Make legacy catch-all zalouser bindings (no accountId) account-specific so a second
    // account isn't swallowed by them. The existing single bot owns the default account.
    for (const b of cfg.bindings) {
      if (b.match?.channel === 'zalouser' && !b.match.accountId) b.match.accountId = defAcct;
    }
    // First Zalo bot → the default account; each subsequent bot gets its own account
    // (keyed by agentId) with a matching login profile — mirrors the Telegram multi-account flow.
    const existingZaloBindings = cfg.bindings.filter((b) => b.match?.channel === 'zalouser').length;
    accountId = existingZaloBindings === 0 ? defAcct : agentId;
    zu.enabled = true;
    zu.accounts[accountId] = zu.accounts[accountId] || { enabled: true, profile: accountId };
    cfg.bindings.push({ agentId, match: { channel: 'zalouser', accountId } });
  } else if (channel === 'fb-messenger') {
    // Token handling (user token → permanent Page token) is done by the fb-messenger
    // plugin itself; here we just persist whatever the user supplied plus the App ID
    // (the plugin needs it to exchange the token).
    ensureFbMessengerChannel(cfg, fbPageId, fbAppId);
    const hasFbBinding = cfg.bindings.some((b) => b.match?.channel === 'fb-messenger');
    if (!hasFbBinding) cfg.bindings.push({ agentId, match: { channel: 'fb-messenger', accountId: 'default' } });
    else warning = 'Facebook Messenger already has a channel binding; new agent created, route manually if needed.';
    await appendEnvValue(projectDir, 'FB_MESSENGER_PAGE_ACCESS_TOKEN', fbPageToken);
    await appendEnvValue(projectDir, 'FB_MESSENGER_APP_SECRET', fbAppSecret);
    await appendEnvValue(projectDir, 'FB_MESSENGER_VERIFY_TOKEN', fbVerifyToken);
    if (fbAppId) await appendEnvValue(projectDir, 'FB_MESSENGER_APP_ID', fbAppId);
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
  await syncExecApprovals(projectDir, cfg);

  const hasScheduler = !!(cfg.tools?.alsoAllow || []).includes('group:automation');
  const hasImageGen = !!(cfg.skills?.entries?.['image-gen']?.enabled);
  const files = buildWorkspaceFileMap({
    isVi: true,
    botName,
    botDesc,
    persona,
    emoji,
    userInfo,
    agentWorkspaceDir: workspaceDir,
    workspacePath: `/home/node/project/.openclaw/${workspaceDir}`,
    channel,
    hasZaloMod: channel === 'zalo-personal',
    hasZaloSticker: false,
    hasScheduler,
    hasImageGen,
  });
  const wsRoot = join(openclawHome, workspaceDir);
  for (const [name, content] of Object.entries(files)) {
    await fsp.mkdir(dirname(join(wsRoot, name)), { recursive: true });
    await fsp.writeFile(join(wsRoot, name), content || '', 'utf8');
  }
  const botMeta = { persona, userName, userDescription: userDesc, emoji, role: botDesc };
  // appId is only meaningful for Facebook Messenger (the plugin needs it to exchange
  // the token); don't pollute other channels' bot-meta.json with an empty appId.
  if (channel === 'fb-messenger') botMeta.appId = fbAppId;
  await writeBotMeta(projectDir, workspaceDir, botMeta);

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
  agent.workspace = `/home/node/project/.openclaw/${workspaceDir}`;
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
  } else if (channel === 'fb-messenger') {
    ensureFbMessengerChannel(cfg, String(body.pageId || '').trim(), String(body.appId || '').trim());
    cfg.bindings.push({ agentId, match: { channel: 'fb-messenger', accountId: 'default' } });
    // Update secrets only when re-supplied (edit form leaves them blank to keep existing).
    const fbPageToken = String(body.pageAccessToken || '').trim();
    const fbAppSecret = String(body.appSecret || '').trim();
    const fbVerifyToken = String(body.verifyToken || '').trim();
    const fbAppIdIn = String(body.appId || '').trim();
    if (fbPageToken) await appendEnvValue(projectDir, 'FB_MESSENGER_PAGE_ACCESS_TOKEN', fbPageToken);
    if (fbAppSecret) await appendEnvValue(projectDir, 'FB_MESSENGER_APP_SECRET', fbAppSecret);
    if (fbVerifyToken) await appendEnvValue(projectDir, 'FB_MESSENGER_VERIFY_TOKEN', fbVerifyToken);
    if (fbAppIdIn) await appendEnvValue(projectDir, 'FB_MESSENGER_APP_ID', fbAppIdIn);
  } else {
    ensureZaloApiChannel(cfg, token || cfg.channels?.zalo?.botToken || '');
    cfg.bindings.push({ agentId, match: { channel: 'zalo' } });
  }

  agent.name = botName;
  agent.role = botDesc;
  validateOpenclawConfig(cfg);
  if (existsSync(cfgPath)) await fsp.copyFile(cfgPath, `${cfgPath}.bak`);
  await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  await syncExecApprovals(projectDir, cfg);

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
  const hasImageGen = !!(cfg.skills?.entries?.['image-gen']?.enabled);
  const files = buildWorkspaceFileMap({
    isVi: true,
    botName,
    botDesc,
    persona,
    emoji,
    userInfo,
    agentWorkspaceDir: workspaceDir,
    workspacePath: `/home/node/project/.openclaw/${workspaceDir}`,
    channel,
    hasZaloMod: channel === 'zalo-personal',
    hasZaloSticker: false,
    hasScheduler,
    hasImageGen,
  });
  const wsRoot = join(projectDir, '.openclaw', workspaceDir);
  for (const [name, content] of Object.entries(files)) {
    await fsp.mkdir(dirname(join(wsRoot, name)), { recursive: true });
    await fsp.writeFile(join(wsRoot, name), content || '', 'utf8');
  }
  const botMeta = { persona, userName, userDescription: userDesc, emoji, role: botDesc };
  if (channel === 'fb-messenger') botMeta.appId = String(body.appId || '').trim();
  await writeBotMeta(projectDir, workspaceDir, botMeta);

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

async function startZaloUserLogin(projectDir, mode = state.mode, agentId = '') {
  let profile = 'default';
  if (agentId) {
    try {
      const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
      if (existsSync(cfgPath)) {
        const cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
        const binding = (cfg.bindings || []).find(b => b.agentId === agentId && b.match?.channel === 'zalouser');
        if (binding?.match?.accountId) {
          profile = binding.match.accountId;
        }
      }
    } catch (e) {
      sendLog(`[zalouser] Warning: Failed to parse openclaw.json: ${e.message}`);
    }
  } else if (state.activeBotId) {
    try {
      const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
      if (existsSync(cfgPath)) {
        const cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
        const binding = (cfg.bindings || []).find(b => b.agentId === state.activeBotId && b.match?.channel === 'zalouser');
        if (binding?.match?.accountId) {
          profile = binding.match.accountId;
        }
      }
    } catch (e) {}
  }

  const qrPaths = [
    `/tmp/openclaw/openclaw-zalouser-qr-${profile}.png`,
    `/tmp/openclaw-1000/openclaw-zalouser-qr-${profile}.png`
  ];
  if (profile === 'default') {
    qrPaths.push(
      '/tmp/openclaw/openclaw-zalouser-qr.png',
      '/tmp/openclaw-1000/openclaw-zalouser-qr.png',
      '/tmp/openclaw/openclaw-zalouser-qr-default.png'
    );
  }

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
  sendLog(`[zalouser] Preparing login for profile [${profile}]. QR will be generated for the UI modal.`);
  const composeFile = join(projectDir, 'docker', 'openclaw', 'docker-compose.yml');
  if ((mode === 'docker' || existsSync(composeFile)) && existsSync(composeFile)) {
    const botContainer = getBotContainerName(projectDir);
    // Verify if zalouser is properly registered in installs.json with channels array.
    // npm install --prefix misses this, which causes error:not configured.
    const checkRegistryScript = `
const fs = require('fs');
try {
  // zalouser may live under npm/ (docker install) OR extensions/ (migrated/native). Treat
  // either as present so we never re-download it on top of an existing copy (that creates a
  // duplicate plugin id and breaks the shared ZCA API map).
  const distNpm = '/home/node/project/.openclaw/npm/node_modules/@openclaw/zalouser/dist/index.js';
  const distExt = '/home/node/project/.openclaw/extensions/zalouser/dist/index.js';
  const inst = '/home/node/project/.openclaw/plugins/installs.json';
  if (!fs.existsSync(distNpm) && !fs.existsSync(distExt)) { console.log('MISSING'); process.exit(0); }
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
const cfg='/home/node/project/.openclaw/openclaw.json';
const bk='/home/node/project/.openclaw/openclaw.json.zalo-backup';
try{if(fs.existsSync(cfg))fs.copyFileSync(cfg,bk);}catch(e){}
// Detect gateway version and pin zalouser plugin to match, preventing createSetupTranslator mismatch
let gatewayVer='';
try{gatewayVer=cp.execSync('openclaw --version 2>/dev/null',{encoding:'utf8'}).trim().replace(/[^0-9.]/g,'');}catch(e){}
const pluginSpec=gatewayVer ? '@openclaw/zalouser@'+gatewayVer : '@openclaw/zalouser';
console.log('Installing plugin via CLI: '+pluginSpec+'...');
try{cp.execSync('cd /home/node/project && openclaw plugins install '+pluginSpec+' --force',{stdio:'inherit'});}catch(e){
  // Fallback: try without version pin if exact version not found on registry
  if(gatewayVer){console.log('Pinned version failed, trying latest...');try{cp.execSync('cd /home/node/project && openclaw plugins install @openclaw/zalouser --force',{stdio:'inherit'});}catch(e2){console.error('Install failed');}}
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
  cp.execSync('ZALO_JS=$(find "/home/node/project/.openclaw" -path "*/zalouser/dist/zalo-js*.js" -type f 2>/dev/null | head -1); if [ -n "$ZALO_JS" ]; then sed -i "s/LISTENER_WATCHDOG_MAX_GAP_MS = 35e3/LISTENER_WATCHDOG_MAX_GAP_MS = 120e3/g" "$ZALO_JS"; echo "Patched watchdog gap to 120s"; fi', {shell:true,stdio:'inherit'});
}catch(e){}
try{
  const ep = '/home/node/project/docker/openclaw/entrypoint.sh';
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
    const credFile = profile === 'default' ? 'credentials.json' : `credentials-${profile}.json`;
    const credPath = `/home/node/project/.openclaw/credentials/zalouser/${credFile}`;
    await runCapture('docker', ['exec', botContainer, 'sh', '-lc', `rm -f ${credPath} ${qrPaths.join(' ')}`], { cwd: projectDir, shell: false }).catch(() => {});
    
    sendLog('[zalouser] Generating Zalo QR. The image will appear automatically.');
    const loginCmd = `cd /home/node/project && openclaw channels login --channel zalouser --account ${profile} --verbose`;
    
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

  throw httpError(400, 'Zalo login cần project Docker đang chạy (không tìm thấy docker-compose.yml).');
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

  // If the compose was hand-customized (reverse-proxy/Traefik labels, an external network
  // like `web`, or an explicit opt-out marker), DO NOT regenerate ANY infra file — a full
  // docker-gen rewrite would wipe that routing (this once silently broke a live webhook).
  // Leave everything untouched; the version stamp stays old but each check just no-ops.
  if (/^\s*traefik\.|external:\s*true|openclaw-setup:\s*custom|openclaw-setup:keep/im.test(compose)) {
    sendLog('[sync] Custom docker-compose.yml detected (Traefik/external network/keep marker) — leaving infra untouched to preserve your routing.');
    return false;
  }

  const botContainer = parseComposeServiceContainerName(compose, 'ai-bot') || `openclaw-${slugify(basename(projectDir))}`;
  const routerContainer = parseComposeServiceContainerName(compose, '9router') || `9router-${slugify(basename(projectDir))}`;
  const composeName = (compose.match(/^name:\s*(\S+)/m) || [])[1] || `oc-${slugify(basename(projectDir))}`;
  const gatewayPort = state.gatewayPort || 18789;
  const routerPort = state.routerPort || 20128;
  const osChoice = await resolveProjectHostOs(projectDir);

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
    osChoice,
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
  // Capture the user's custom disk/folder mounts from the OLD compose before we overwrite it — a
  // full regen only re-emits the default volumes, so without this the bot loses granted drives.
  let carriedMounts = [];
  try {
    const prevCompose = join(dockerDir, 'docker-compose.yml');
    if (existsSync(prevCompose)) carriedMounts = parseComposeMounts(await fsp.readFile(prevCompose, 'utf8'));
  } catch {}
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
        // Match the gateway published-port line whatever the host prefix is — the generated form is
        // "127.0.0.1:<gw>:<gw>", so keying off the container port (":<gw>" before the quote) is the
        // only reliable anchor. The old `(?:\d+:)?` variant never matched the "127.0.0.1:" prefix.
        cc = cc.replace(
          new RegExp(`^(\\s*-\\s*"[^"\\n]*:${gpStr}")\\s*$`, 'm'),
          `$1\n      - "127.0.0.1:${dp}:${dp}"  # zalo-mod dashboard`
        );
        await fsp.writeFile(join(dockerDir, 'docker-compose.yml'), cc, 'utf8');
      }
    }
  } catch {}
  // Re-inject the user's custom mounts carried over from the old compose.
  if (carriedMounts.length) {
    try {
      const cpath = join(dockerDir, 'docker-compose.yml');
      const cur = await fsp.readFile(cpath, 'utf8');
      const merged = injectMountsIntoCompose(cur, carriedMounts);
      if (merged !== cur) {
        await fsp.writeFile(cpath, merged, 'utf8');
        sendLog(`[sync] Preserved ${carriedMounts.length} granted mount(s) across the compose regen`);
      }
    } catch (e) { sendLog(`[sync] Warning: could not re-apply granted mounts: ${e.message}`); }
  }
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

  // Automatically run Zalo sticker-mention patch if skill is enabled and agent is zalo-personal
  try {
    const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
    if (existsSync(cfgPath)) {
      const cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
      const stickerMentionOn = !!cfg.skills?.entries?.['sticker-mention']?.enabled;
      if (stickerMentionOn) {
        for (const a of cfg.agents?.list || []) {
          const binding = (cfg.bindings || []).find((b) => b.agentId === a.id);
          const channel = binding?.match?.channel || 'telegram';
          if (channel === 'zalo-personal' || channel === 'zalouser') {
            const workspaceDir = workspaceRelForAgent(a, cfg, projectDir) || `workspace-${a.id}`;
            let mentionsJsPath = join(projectDir, '.openclaw', workspaceDir, 'skills/zalo-sticker-mention/mentions.js');
            let containerJsPath = `/home/node/project/.openclaw/${workspaceDir}/skills/zalo-sticker-mention/mentions.js`;
            if (!existsSync(mentionsJsPath)) {
              mentionsJsPath = join(projectDir, '.openclaw', workspaceDir, 'skills/sticker-mention/mentions.js');
              containerJsPath = `/home/node/project/.openclaw/${workspaceDir}/skills/sticker-mention/mentions.js`;
            }
            if (existsSync(mentionsJsPath)) {
              sendLog(`[zalo-patch] Automatically running mentions.js inside container ${containerName}...`);
              const patchCmd = await runCapture('docker', ['exec', containerName, 'node', containerJsPath], { cwd: projectDir, shell: false });
              sendLog(`[zalo-patch] Output: ${patchCmd.stdout || ''} ${patchCmd.stderr || ''}`);
            }
          }
        }
      }
    }
  } catch (err) {
    sendLog(`[zalo-patch] Failed to auto-run mentions.js: ${err.message}`);
  }

  // Container was rebuilt/recreated: runtime, versions and extension versions may all have changed.
  probeCacheClear();
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
    await syncRuntimeState(projectDir, { full: true }).catch(() => {});
    probeCacheClear();
    return { ok: true, target, spec, mode: 'docker' };
  }
  throw httpError(400, 'Không có project Docker để cập nhật runtime.');
}

async function restartDockerBotContainer(projectDir = state.projectDir) {
  const containerName = getBotContainerName(projectDir);
  sendLog(`[docker] Restarting ${containerName} container...`);
  await run('docker', ['restart', containerName], { shell: false });
  await waitForDockerContainer(containerName);
  // Restart may apply config/port changes — drop cached runtime/status for this project.
  probeCacheClear(`runtime:${projectDir}`);
  return true;
}

// Parse user-granted disk/folder mounts (/mnt/<name>, excluding the always-present /mnt/project)
// from a docker-compose.yml string. Handles both the long-form bind (type/source/target) and the
// legacy short form `- "<host>:/mnt/<name>"`.
function parseComposeMounts(compose) {
  const mounts = [];
  const lines = String(compose || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const tm = lines[i].match(/^\s*target:\s*['"]?(\/mnt\/[A-Za-z0-9._-]+)['"]?\s*$/);
    if (tm && tm[1] !== '/mnt/project') {
      let host = '';
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const sm = lines[j].match(/^\s*source:\s*['"]?(.+?)['"]?\s*$/);
        if (sm) { host = sm[1].replace(/''/g, "'"); break; }
      }
      if (host) mounts.push({ host, target: tm[1] });
      continue;
    }
    const ssm = lines[i].match(/^\s*-\s*"?([^":\n]+):(\/mnt\/[A-Za-z0-9._-]+)"?\s*$/);
    if (ssm && ssm[2] !== '/mnt/project') mounts.push({ host: ssm[1].trim(), target: ssm[2] });
  }
  return mounts;
}

// Insert long-form bind mounts (idempotent) after the project's .openclaw volume line. Returns the
// original string unchanged if the anchor is missing or a mount is already present.
function injectMountsIntoCompose(compose, mounts) {
  const anchor = /^(\s*-\s*\.\.\/\.\.\/\.openclaw:\/home\/node\/project\/\.openclaw)\s*$/m;
  if (!Array.isArray(mounts) || !mounts.length || !anchor.test(compose)) return compose;
  let out = compose;
  for (const m of mounts) {
    if (!m || !m.host || !m.target) continue;
    if (out.includes(`target: ${m.target}`) || out.includes(`:${m.target}"`) || out.includes(`:${m.target}\n`) || out.includes(m.host)) continue;
    const src = `'${String(m.host).replace(/'/g, "''")}'`;
    const block = `      - type: bind\n        source: ${src}\n        target: ${m.target}`;
    out = out.replace(anchor, `$1\n${block}`);
  }
  return out;
}

// Grant the bot access to a host disk/folder by mounting it into the container at /mnt/<name>.
// Project-scoped: all bots in this project share the container, so all of them can use it.
// Per-bot limits are described in AGENTS.md (not enforced at the mount layer).
async function addBotMount(projectDir, hostPath, mountName = '') {
  // Cross-OS normalize: trim, convert Windows backslashes → forward slashes (Docker accepts
  // forward slashes on every OS, incl. `C:/Users/...`), drop trailing separators. This avoids
  // YAML backslash issues and keeps the path uniform.
  let cleanPath = String(hostPath || '').trim().replace(/\\+/g, '/').replace(/\/+$/, '');
  // A bare Windows drive letter ("D:") is an INVALID Docker bind source — the trailing-slash strip
  // above turns "D:/" into "D:". Restore the slash so mounting a whole drive (e.g. D:\) works.
  if (/^[a-zA-Z]:$/.test(cleanPath)) cleanPath += '/';
  if (!cleanPath) throw httpError(400, 'Đường dẫn ổ đĩa/thư mục đang trống');
  const composeFile = join(projectDir, 'docker', 'openclaw', 'docker-compose.yml');
  if (!existsSync(composeFile)) throw httpError(400, 'Không tìm thấy docker-compose.yml (project có thể không chạy ở chế độ Docker)');
  const base = mountName || cleanPath.split('/').filter(Boolean).pop() || 'data';
  const name = base.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'data';
  const target = `/mnt/${name}`;
  let compose = await fsp.readFile(composeFile, 'utf8');
  if (compose.includes(`target: ${target}`) || compose.includes(`:${target}"`) || compose.includes(`:${target}\n`) || compose.includes(cleanPath)) {
    return { ok: true, target, hostPath: cleanPath, alreadyMounted: true };
  }
  // Long-form bind mount: unambiguous across OSes. Short syntax `host:container` breaks on
  // Windows because the drive-letter colon (C:/...) collides with the host:container separator.
  // Source is single-quoted YAML (literal) so paths with spaces are safe.
  const src = `'${cleanPath.replace(/'/g, "''")}'`;
  const mountBlock = `      - type: bind\n        source: ${src}\n        target: ${target}`;
  const anchor = /^(\s*-\s*\.\.\/\.\.\/\.openclaw:\/home\/node\/project\/\.openclaw)\s*$/m;
  if (!anchor.test(compose)) throw httpError(500, 'Không định vị được block volumes của bot trong docker-compose.yml');
  compose = compose.replace(anchor, `$1\n${mountBlock}`);
  await fsp.writeFile(composeFile, compose, 'utf8');
  sendLog(`[mount] Đã thêm mount ${cleanPath} -> ${target} (long-form bind) vào docker-compose.yml`);
  await updateGrantedMountsInAgents(projectDir).catch((e) => sendLog(`[mount] Cập nhật AGENTS.md bỏ qua: ${e.message}`));
  // Apply immediately: a volume change only takes effect after the container is recreated,
  // otherwise the running container won't have /mnt/<name> even though compose/AGENTS.md list it.
  let applied = false;
  try {
    sendLog('[mount] Recreate container để áp dụng mount mới...');
    await recreateDockerBot(projectDir);
    applied = true;
  } catch (e) {
    sendLog(`[mount] Tự áp dụng thất bại (hãy bấm Rebuild thủ công): ${e.message}`);
  }
  return { ok: true, target, hostPath: cleanPath, applied, needsRebuild: !applied };
}

// Sync a managed "granted mounts" block into every agent's AGENTS.md from the /mnt/* mounts in
// docker-compose.yml (excludes /mnt/project — that's the project root, always mounted).
async function updateGrantedMountsInAgents(projectDir) {
  const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
  const composeFile = join(projectDir, 'docker', 'openclaw', 'docker-compose.yml');
  if (!existsSync(cfgPath) || !existsSync(composeFile)) return;
  const cfg = ensureConfigShape(JSON.parse(await fsp.readFile(cfgPath, 'utf8')));
  const compose = await fsp.readFile(composeFile, 'utf8');
  const mounts = [];
  const lines = compose.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // Long-form bind: `target: /mnt/<name>` with a nearby `source:` line above.
    const tm = lines[i].match(/^\s*target:\s*['"]?(\/mnt\/[A-Za-z0-9._-]+)['"]?\s*$/);
    if (tm && tm[1] !== '/mnt/project') {
      let host = '';
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const sm = lines[j].match(/^\s*source:\s*['"]?(.+?)['"]?\s*$/);
        if (sm) { host = sm[1].replace(/''/g, "'"); break; }
      }
      mounts.push({ host, target: tm[1] });
      continue;
    }
    // Legacy short form: `- "<host>:/mnt/<name>"` (Unix-style host only).
    const ssm = lines[i].match(/^\s*-\s*"?([^":\n]+):(\/mnt\/[A-Za-z0-9._-]+)"?\s*$/);
    if (ssm && ssm[2] !== '/mnt/project') mounts.push({ host: ssm[1].trim(), target: ssm[2] });
  }
  const START = '<!-- granted-mounts:start -->';
  const END = '<!-- granted-mounts:end -->';
  const block = mounts.length
    ? `${START}\n## 💽 Thư mục/ổ đĩa được cấp quyền (toàn project)\n`
      + mounts.map((x) => `- \`${x.target}\` ← host \`${x.host}\` — bot được phép đọc/ghi tại đây.`).join('\n')
      + `\n- Mặc định MỌI bot trong project đều dùng được các thư mục trên. Muốn giới hạn theo từng bot thì ghi rõ ngay dưới mục này.\n${END}`
    : '';
  const blockRe = new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n*`);
  for (const agent of cfg.agents.list) {
    const rel = workspaceRelForAgent(agent, cfg, projectDir);
    if (!rel) continue;
    const file = join(projectDir, '.openclaw', rel, 'AGENTS.md');
    if (!existsSync(file)) continue;
    let doc = await fsp.readFile(file, 'utf8');
    if (blockRe.test(doc)) doc = doc.replace(blockRe, block ? `\n\n${block}\n` : '\n');
    else if (block) doc = doc.replace(/\s*$/, '') + `\n\n${block}\n`;
    await fsp.writeFile(file, doc, 'utf8');
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return parseJsonText(Buffer.concat(chunks).toString('utf8'));
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

  const selectedSkills = ['memory', 'web-search', 'scheduler'];
  const agentMetas = [];
  const common = { channelKey: 'telegram', providerKey: '9router', model: DEFAULT_MODEL, deployMode: mode, osChoice, selectedSkills, skills: dataExport.SKILLS || [], agentMetas, gatewayPort, routerPort };
  const cfg = buildOpenclawJson(common);
  const env = buildEnvFileContent({ ...common, apiKey: '', botToken: '' });
  await fsp.writeFile(join(openclawHome, 'openclaw.json'), JSON.stringify(cfg, null, 2), 'utf8');
  await fsp.writeFile(join(projectDir, '.env'), env, 'utf8');
  await syncExecApprovals(projectDir, cfg);

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

// Locate a real Chrome/Chromium binary on the host (for the "grant Chrome to the bot" button).
async function findChromeBinary() {
  if (process.platform === 'darwin') {
    for (const p of [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ]) if (existsSync(p)) return p;
    return '';
  }
  if (process.platform === 'win32') {
    for (const p of [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]) if (p && existsSync(p)) return p;
    return '';
  }
  for (const c of ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
    const r = await commandExists(c, ['--version']);
    if (r.ok) return c;
  }
  return '';
}

// TCP relay for headless VPS: `ssh -R 9222:...` binds the VPS loopback only (sshd GatewayPorts
// defaults to "no"), which the bot container cannot reach. This relay listens on the docker
// bridge IP (host.docker.internal from inside the container) and pipes to the loopback tunnel.
let _chromeRelayServer = null;
async function getDockerBridgeIp() {
  try {
    const out = await runCapture('sh', ['-c', "ip -4 -o addr show docker0 | awk '{print $4}' | cut -d/ -f1"], { shell: false, timeout: 4000 });
    const ip = String(out.stdout || '').trim();
    if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
  } catch {}
  return '172.17.0.1';
}
async function ensureChromeRelay() {
  if (_chromeRelayServer) return true;
  const bridgeIp = await getDockerBridgeIp();
  return new Promise((resolveP) => {
    const relay = net.createServer((client) => {
      const upstream = net.connect(9222, '127.0.0.1');
      client.pipe(upstream).pipe(client);
      client.on('error', () => upstream.destroy());
      upstream.on('error', () => client.destroy());
    });
    relay.once('error', () => resolveP(false)); // EADDRINUSE etc. → likely already relayed
    relay.listen(9222, bridgeIp, () => {
      _chromeRelayServer = relay;
      sendLog(`[chrome] Relay ${bridgeIp}:9222 → 127.0.0.1:9222 sẵn sàng (chờ SSH tunnel từ máy bạn).`);
      // Ubuntu VPSes usually run ufw with default-deny INPUT, which silently drops container→host
      // traffic to the relay. Open the port scoped to the PRIVATE bridge IP only (not reachable
      // from the internet). Best-effort; `ufw allow` skips duplicates on re-runs.
      run('sh', ['-c', `command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active" && ufw allow in to ${bridgeIp} port 9222 proto tcp comment "openclaw chrome-debug relay (docker bridge only)" || true`])
        .catch(() => sendLog('[chrome] Không thể tự mở firewall cho relay — nếu bot không thấy Chrome, chạy: ufw allow in to ' + bridgeIp + ' port 9222 proto tcp'));
      resolveP(true);
    });
  });
}

// Launch real host Chrome in remote-debugging mode (port 9222) so the browser-automation plugin
// can drive the user's actual Chrome (logged-in profile) instead of headless Chromium. The bot
// reaches it via CDP (host.docker.internal:9222 from the container). Detached: keeps running after
// this request. `--remote-allow-origins=*` is required by modern Chrome for cross-origin CDP.
// On a headless VPS there is no Chrome to open here — instead we start the bridge relay and hand
// back copy-paste commands so the user runs Chrome on THEIR machine + a reverse SSH tunnel.
async function startChromeDebug() {
  if (isHeadlessServer()) {
    await ensureChromeRelay();
    const ip = (await getPublicIp().catch(() => '')) || '<IP-VPS>';
    const user = sshUserName();
    return {
      ok: true,
      headless: true,
      port: 9222,
      chromeCmdMac: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="$HOME/.openclaw-chrome-debug" --remote-allow-origins='*'`,
      chromeCmdWin: `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir=%TEMP%\\openclaw-chrome-debug --remote-allow-origins=*`,
      tunnelCmd: `ssh -N -R 9222:127.0.0.1:9222 ${user}@${ip}`,
    };
  }
  const bin = await findChromeBinary();
  if (!bin) {
    throw httpError(400, process.platform === 'linux'
      ? 'Không tìm thấy Chrome/Chromium trên máy. Cài google-chrome hoặc chromium rồi thử lại (không áp dụng cho VPS không có giao diện).'
      : 'Không tìm thấy Google Chrome. Hãy cài Chrome rồi thử lại.');
  }
  const port = 9222;
  const userDataDir = join(os.tmpdir(), 'openclaw-chrome-debug');
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--remote-allow-origins=*',
    '--no-first-run',
    '--no-default-browser-check',
  ];
  const child = spawn(bin, args, { detached: true, stdio: 'ignore', windowsHide: false });
  child.on('error', (e) => sendLog(`[chrome] Không mở được Chrome debug: ${e.message}`));
  child.unref();
  sendLog(`[chrome] Đã mở Chrome debug ở cổng ${port} (${bin}). Bot sẽ ưu tiên dùng Chrome này.`);
  return { ok: true, port, browser: bin, userDataDir };
}

// Poll until the Docker daemon responds (or timeout). Returns true if ready.
async function waitForDockerDaemon(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ok = await commandExists('docker', ['version', '--format', '{{.Server.Version}}']);
    if (ok.ok) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 3000));
  }
}

// Ensure Docker (engine + compose) is available before a docker-mode install, auto-installing the
// latest version appropriate for the host OS when it is missing:
//   • Linux → Docker's official convenience script (get.docker.com; auto-detects the distro) + start daemon
//   • macOS → Docker Desktop via Homebrew cask, then launch it
//   • Windows → Docker Desktop via winget (fallback Chocolatey), then launch it
// macOS/Windows Docker Desktop needs a GUI/WSL startup (and sometimes a reboot), so we install +
// launch + wait, and give a clear next-step if the daemon still isn't up when we time out.
async function ensureDockerInstalled(osChoice) {
  if (await waitForDockerDaemon(0)) return; // already running
  const cliOk = await commandExists('docker', ['--version']);

  if (process.platform === 'linux') {
    const root = typeof process.getuid === 'function' && process.getuid() === 0;
    const sudo = root ? '' : 'sudo ';
    if (!cliOk.ok) {
      sendLog('[docker] Chưa có Docker — đang tự cài Docker Engine mới nhất qua script chính thức get.docker.com (1–3 phút)...');
      await run('sh', ['-c', `curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && ${sudo}sh /tmp/get-docker.sh`]);
      if (!root) await run('sh', ['-c', 'sudo usermod -aG docker "$USER" || true']).catch(() => {});
    }
    sendLog('[docker] Bật & khởi động Docker daemon...');
    await run('sh', ['-c', `${sudo}systemctl enable --now docker`]).catch(() => {});
    if (!(await waitForDockerDaemon(20000))) {
      throw httpError(500, 'Đã cài Docker nhưng daemon chưa chạy. Hãy chạy `systemctl start docker` (hoặc đăng nhập lại nếu vừa thêm vào nhóm docker) rồi cài lại.');
    }
    sendLog('[docker] Docker đã sẵn sàng.');
    return;
  }

  if (process.platform === 'darwin') {
    if (!cliOk.ok) {
      const brew = await commandExists('brew', ['--version']);
      if (!brew.ok) {
        throw httpError(400, 'macOS: cần Homebrew để tự cài Docker Desktop. Cài Homebrew tại https://brew.sh (hoặc cài Docker Desktop thủ công) rồi cài lại.');
      }
      sendLog('[docker] macOS: đang cài Docker Desktop mới nhất qua Homebrew (brew install --cask docker)...');
      await run('brew', ['install', '--cask', 'docker']);
    }
    sendLog('[docker] Mở Docker Desktop và chờ daemon khởi động...');
    await run('open', ['-a', 'Docker']).catch(() => {});
    if (!(await waitForDockerDaemon(120000))) {
      throw httpError(500, 'Đã cài Docker Desktop — hãy mở Docker Desktop, hoàn tất cấp quyền lần đầu, đợi biểu tượng cá voi báo "running" rồi cài lại.');
    }
    sendLog('[docker] Docker đã sẵn sàng.');
    return;
  }

  if (process.platform === 'win32') {
    if (!cliOk.ok) {
      const winget = await commandExists('winget', ['--version']);
      const choco = await commandExists('choco', ['--version']);
      if (winget.ok) {
        sendLog('[docker] Windows: đang cài Docker Desktop mới nhất qua winget...');
        await run('winget', ['install', '-e', '--id', 'Docker.DockerDesktop', '--accept-source-agreements', '--accept-package-agreements']);
      } else if (choco.ok) {
        sendLog('[docker] Windows: đang cài Docker Desktop qua Chocolatey...');
        await run('choco', ['install', 'docker-desktop', '-y']);
      } else {
        throw httpError(400, 'Windows: cần winget hoặc Chocolatey để tự cài Docker Desktop (hoặc cài thủ công tại https://www.docker.com). Cài xong rồi thử lại.');
      }
    }
    sendLog('[docker] Mở Docker Desktop và chờ daemon khởi động...');
    await run('cmd', ['/c', 'start', '', '%ProgramFiles%\\Docker\\Docker\\Docker Desktop.exe']).catch(() => {});
    if (!(await waitForDockerDaemon(120000))) {
      throw httpError(500, 'Đã cài Docker Desktop — Windows có thể cần bật WSL2 và khởi động lại máy. Hãy mở Docker Desktop, đợi "running" (hoặc reboot nếu được yêu cầu) rồi cài lại.');
    }
    sendLog('[docker] Docker đã sẵn sàng.');
    return;
  }

  throw httpError(400, 'Hệ điều hành không được hỗ trợ tự cài Docker. Hãy cài Docker thủ công rồi thử lại.');
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
    // Make sure Docker is present (auto-install on Linux/VPS) before doing any work — fail fast
    // with a clear message rather than deep inside `docker compose up`.
    await ensureDockerInstalled(osChoice);
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
        : buildEnvFileContent({ channelKey: 'telegram', providerKey: '9router', deployMode: mode, osChoice, selectedSkills: ['memory', 'web-search', 'scheduler'], skills: dataExport.SKILLS || [], agentMetas: [], apiKey: '', botToken: '' });
      await fsp.writeFile(dockerEnvPath, envContent, 'utf8');
      sendLog(`Docker env ready: ${dockerEnvPath}`);
      await run('docker', ['compose', 'up', '-d', '--build'], { cwd: dockerDir });
      await applyResolved9RouterApiKey(projectDir).catch(() => {});
      await recreateDockerBot(projectDir).catch(() => {});
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
    projects: state.projects || [],
  }, null, 2), 'utf8').catch(() => {});
}

async function loadSavedState(rootProjectDir) {
  const file = join(rootProjectDir, STATE_FILE);
  if (!existsSync(file)) return;
  const saved = JSON.parse(await fsp.readFile(file, 'utf8'));
  if (Array.isArray(saved?.projects)) {
    state.projects = saved.projects;
  }
  if (saved?.projectDir && existsSync(join(saved.projectDir, '.openclaw', 'openclaw.json'))) {
    Object.assign(state, saved, { installed: !!saved.installed });
    await syncRuntimeState(state.projectDir);
  }
}

function isRestrictedSystemDir(dirPath) {
  if (!dirPath) return true;
  const lower = resolve(dirPath).toLowerCase();
  
  if (SYSTEM_DIR_BLACKLIST.has(basename(lower))) return true;
  
  const winDir = process.env.SystemRoot ? resolve(process.env.SystemRoot).toLowerCase() : 'c:\\windows';
  const programFiles = process.env.ProgramFiles ? resolve(process.env.ProgramFiles).toLowerCase() : 'c:\\program files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] ? resolve(process.env['ProgramFiles(x86)']).toLowerCase() : 'c:\\program files (x86)';
  
  if (lower.startsWith(winDir) || lower.startsWith(programFiles) || lower.startsWith(programFilesX86)) {
    return true;
  }
  
  if (lower.includes(':\\users\\') || lower.endsWith(':\\users')) {
    const home = resolve(getRealHomedir()).toLowerCase();
    if (lower !== home && !lower.startsWith(home + '\\') && !lower.startsWith(home + '/')) {
      const cwd = resolve(process.cwd()).toLowerCase();
      const match = cwd.match(/^([a-z]:\\users\\[^\\]+)/) || cwd.match(/^(\/mnt\/[a-z]\/users\/[^\/]+)/);
      const cwdHome = match ? match[1] : '';
      if (!cwdHome || (lower !== cwdHome && !lower.startsWith(cwdHome + '\\') && !lower.startsWith(cwdHome + '/'))) {
        return true;
      }
    }
  }

  if (process.platform !== 'win32') {
    const unixBlacklist = new Set([
      'usr', 'var', 'proc', 'sys', 'dev', 'etc', 'sbin', 'bin', 'lib', 'lib64', 'run', 'tmp', 'boot', 'lost+found', 'srv', 'mnt', 'media', 'opt',
      'applications', 'library', 'system', 'volumes', 'private', 'cores', 'network', 'users'
    ]);
    if (unixBlacklist.has(basename(lower))) return true;
    
    if (lower.startsWith('/mnt/') || lower.startsWith('/users/') || lower === '/users') {
      const realHome = resolve(getRealHomedir()).toLowerCase();
      if (lower !== realHome && !lower.startsWith(realHome + '/')) {
        const cwd = resolve(process.cwd()).toLowerCase();
        const match = cwd.match(/^(\/home\/[^\/]+)/) || cwd.match(/^(\/root)/) || cwd.match(/^(\/mnt\/[a-z]\/users\/[^\/]+)/) || cwd.match(/^(\/users\/[^\/]+)/);
        const cwdHome = match ? match[1] : '';
        if (!cwdHome || (lower !== cwdHome && !lower.startsWith(cwdHome + '/'))) {
          return true;
        }
      }
    }
  }

  return false;
}

// Project roots of OpenClaw bot containers currently running under Docker. This is the
// strongest, OS/-environment-agnostic signal that a real project lives on this machine —
// so a fresh `npx github:…` run (e.g. on a VPS where bots are already running) targets the
// live project instead of defaulting to an empty ~/openclaw-setup folder.
async function discoverDockerBotProjectRoots() {
  const roots = [];
  try {
    const r = await runCapture(
      'docker',
      ['ps', '--filter', 'label=com.docker.compose.service=ai-bot',
        '--format', '{{.Label "com.docker.compose.project.working_dir"}}'],
      { shell: false, timeout: 5000 },
    );
    if (r.code === 0) {
      for (const line of String(r.stdout).split('\n')) {
        const wd = line.trim();
        if (!wd) continue;
        // ai-bot's compose dir is "<root>/docker/openclaw" → project root is two levels up.
        const root = resolve(wd, '..', '..');
        if (existsSync(join(root, '.openclaw', 'openclaw.json'))) roots.push(root);
      }
    }
  } catch {}
  return [...new Set(roots)];
}

async function findLatestProject(rootProjectDir) {
  const realHome = getRealHomedir();
  const roots = [
    process.env.OPENCLAW_PROJECT_DIR,
    process.env.OPENCLAW_HOME ? dirname(process.env.OPENCLAW_HOME) : '',
    rootProjectDir,
    join(rootProjectDir, DEFAULT_PROJECT_NAME),
    dirname(rootProjectDir),
    realHome,
    join(realHome, 'Documents'),
  ].filter(Boolean);
  
  const drives = await getAvailableDrives();
  for (const drive of drives) {
    const entries = await fsp.readdir(drive, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('$') && !SYSTEM_DIR_BLACKLIST.has(e.name.toLowerCase())) {
        const fullPath = join(drive, e.name);
        if (!isRestrictedSystemDir(fullPath)) {
          roots.push(fullPath);
        }
      }
    }
  }
  const candidates = [];
  const seen = new Set();
  async function walk(dir, depth = 0) {
    if (!dir || depth > 2 || !existsSync(dir)) return;
    const full = resolve(dir);
    if (isRestrictedSystemDir(full)) return;
    if (seen.has(full)) return;
    seen.add(full);

    if (existsSync(join(full, '.openclaw', 'openclaw.json'))) {
      const st = await fsp.stat(join(full, '.openclaw', 'openclaw.json')).catch(() => null);
      if (st) candidates.push({ dir: full, mtimeMs: st.mtimeMs });
      return;
    }
    const entries = await fsp.readdir(full, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && !SYSTEM_DIR_BLACKLIST.has(e.name.toLowerCase())) {
        await walk(join(full, e.name), depth + 1);
      }
    }
  }
  for (const r of roots) await walk(r);
  // Prefer a project whose bot is actually running (boost above filesystem matches).
  for (const dr of await discoverDockerBotProjectRoots()) {
    const st = await fsp.stat(join(dr, '.openclaw', 'openclaw.json')).catch(() => null);
    candidates.push({ dir: dr, mtimeMs: (st?.mtimeMs || 0) + 1e15 });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.dir || null;
}

async function ensureProjectsLoaded(rootProjectDir) {
  if (state.projects !== null) return;
  state.projects = [];
  const file = join(rootProjectDir, STATE_FILE);
  if (existsSync(file)) {
    try {
      const saved = JSON.parse(await fsp.readFile(file, 'utf8'));
      if (Array.isArray(saved?.projects)) {
        state.projects = saved.projects;
      }
    } catch {}
  }
}

async function discoverProjects(rootProjectDir) {
  await ensureProjectsLoaded(rootProjectDir);

  // Surface projects whose bot is running in Docker even if this install has no saved
  // state for them (e.g. first `npx github:…` run on a server with bots already up).
  for (const dr of await discoverDockerBotProjectRoots()) {
    if (!state.projects.some(p => resolve(p.projectDir) === resolve(dr))) {
      const meta = await buildProjectMeta(dr).catch(() => null);
      if (meta) state.projects.push(meta);
    }
  }

  if (state.projectDir && existsSync(join(state.projectDir, '.openclaw', 'openclaw.json'))) {
    const resolved = resolve(state.projectDir);
    if (!state.projects.some(p => resolve(p.projectDir) === resolved)) {
      const meta = await buildProjectMeta(resolved).catch(() => null);
      if (meta) state.projects.push(meta);
    }
  }

  const updatedProjects = [];
  for (const p of state.projects) {
    if (existsSync(join(p.projectDir, '.openclaw', 'openclaw.json'))) {
      const meta = await buildProjectMeta(p.projectDir).catch(() => null);
      if (meta) {
        updatedProjects.push(meta);
      }
    }
  }
  state.projects = updatedProjects;
  
  state.projects.sort((a, b) => {
    const aActive = state.projectDir && resolve(state.projectDir) === resolve(a.projectDir);
    const bActive = state.projectDir && resolve(state.projectDir) === resolve(b.projectDir);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return (b.botCount - a.botCount) || (b.updatedAt - a.updatedAt);
  });

  await saveState(rootProjectDir).catch(() => {});
  return state.projects.slice(0, 20);
}

async function resolveProjectDir(rootProjectDir, body = {}) {
  if (body.projectDir && existsSync(join(resolve(String(body.projectDir)), '.openclaw', 'openclaw.json'))) {
    state.projectDir = resolve(String(body.projectDir));
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
  const envProjectDir = process.env.OPENCLAW_PROJECT_DIR || (process.env.OPENCLAW_HOME ? dirname(process.env.OPENCLAW_HOME) : '');
  if (envProjectDir && existsSync(join(resolve(String(envProjectDir)), '.openclaw', 'openclaw.json'))) {
    state.projectDir = resolve(String(envProjectDir));
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

async function buildProjectMeta(projectDir) {
  const full = resolve(projectDir);
  const cfgPath = join(full, '.openclaw', 'openclaw.json');
  const st = await fsp.stat(cfgPath).catch(() => null);
  const runtime = await detectRuntime(full).catch(() => ({ mode: 'unknown', gatewayPort: 0, routerPort: 0, syncSource: 'config' }));
  const bots = await listConfiguredBots(full).catch(() => []);
  const uniqueBotCount = new Set(bots.map((b) => b.id)).size;
  const hasDocker = existsSync(join(full, 'docker', 'openclaw', 'docker-compose.yml'));
  return {
    projectDir: full,
    os: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux',
    mode: runtime.mode || 'unknown',
    gatewayPort: runtime.gatewayPort || 0,
    routerPort: runtime.routerPort || 0,
    syncSource: runtime.syncSource || 'config',
    botCount: uniqueBotCount,
    hasDocker,
    updatedAt: st?.mtimeMs || 0,
  };
}

async function connectExistingProject(projectDir, rootProjectDir) {
  const resolved = resolve(String(projectDir || ''));
  if (!existsSync(join(resolved, '.openclaw', 'openclaw.json'))) throw httpError(404, 'openclaw.json not found in selected project');
  // Switch the active project + return its bots FAST (a plain file read). The heavy runtime
  // probing — detectRuntime runs `openclaw gateway status` + `config get` (slow CLI / docker
  // exec) and used to run TWICE here (syncRuntimeState + buildProjectMeta), ~6s total — is
  // deferred to the background so the UI switches instantly. The frontend's loadStatus/loadSystem
  // refresh live status + versions right after.
  state.projectDir = resolved;
  await ensureProjectsLoaded(rootProjectDir);
  const bots = await listConfiguredBots(resolved).catch(() => []);
  setImmediate(async () => {
    try {
      await syncRuntimeState(resolved);
      const meta = await buildProjectMeta(resolved).catch(() => null);
      if (meta) {
        state.projects = state.projects.filter(p => resolve(p.projectDir) !== resolved);
        state.projects.unshift(meta);
      }
      await saveState(rootProjectDir);
    } catch (e) { sendLog(`[connect] background runtime sync failed: ${e.message}`); }
  });
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
  const home = resolve(getRealHomedir());
  const rootHome = resolve(os.homedir());
  if (!existsSync(join(resolved, '.openclaw', 'openclaw.json'))) throw httpError(404, 'openclaw.json not found in selected project');
  if (resolved === home || resolved === rootHome || /^[A-Za-z]:\\?$/.test(resolved)) throw httpError(403, 'Refusing to delete home/root folder');
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
  await ensureProjectsLoaded(rootProjectDir);
  state.projects = state.projects.filter(p => resolve(p.projectDir) !== resolved);
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



  if (kind === 'skill' && id === 'cron') {
    cfg.skills = cfg.skills || { entries: {} };
    cfg.skills.entries = cfg.skills.entries || {};
    delete cfg.skills.entries['cron'];
    cfg.skills.entries['cronjob'] = cfg.skills.entries['cronjob'] || {};
    cfg.skills.entries['cronjob'].enabled = !!enabled;

    if (enabled) {
      cfg.tools = cfg.tools || { profile: 'full', exec: { host: 'gateway', security: 'full', ask: 'off' } };
      cfg.tools.alsoAllow = Array.from(new Set([...(cfg.tools.alsoAllow || []), 'group:automation']));
      cfg.commands = cfg.commands || {};
      cfg.commands.ownerAllowFrom = Array.from(new Set([...(cfg.commands.ownerAllowFrom || []), '*']));
      for (const a of cfg.agents.list) {
        const sf = await readWorkspaceText(projectDir, a, 'skills/cronjob/SKILL.md');
        await fsp.mkdir(dirname(sf.file), { recursive: true });
        await fsp.writeFile(sf.file, buildCronjobSkillMd(true), 'utf8');
      }
    } else {
      if (cfg.tools?.alsoAllow) cfg.tools.alsoAllow = cfg.tools.alsoAllow.filter((x) => x !== 'group:automation');
      if (cfg.commands?.ownerAllowFrom) cfg.commands.ownerAllowFrom = cfg.commands.ownerAllowFrom.filter((x) => x !== '*');
      for (const a of cfg.agents.list) {
        const sf = await readWorkspaceText(projectDir, a, 'skills/cronjob/SKILL.md');
        if (existsSync(sf.file)) await fsp.rm(sf.file, { force: true });
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

  // Folder-based per-bot skills (image-gen / sticker-mention / learning-memory). These load
  // from <workspace>/skills, so each bot's copy is independent. Toggling here affects ONLY the
  // active bot's workspace folder. The global skills.entries[id].enabled flag is kept true
  // while ANY bot still has the folder (openclaw needs it true to load the skill at all).
  if (kind === 'skill' && (id === 'image-gen' || id === 'sticker-mention' || id === 'learning-memory')) {
    const slugMap = { 'image-gen': 'infographic-generator', 'sticker-mention': 'zalo-sticker-mention', 'learning-memory': 'learning-memory' };
    const slug = slugMap[id];
    const rel = workspaceRelForAgent(agent, cfg, projectDir) || `workspace-${agent.id}`;
    const folder = join(projectDir, '.openclaw', rel, 'skills', slug);
    const hasDocker = existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'));

    // Sticker skill needs its outbound patch applied on enable / restored on disable (Zalo personal only).
    const applyStickerPatch = async (restore) => {
      if (id !== 'sticker-mention') return;
      const channel = (cfg.bindings || []).find((b) => b.agentId === agent.id)?.match?.channel || '';
      if (channel !== 'zalo-personal' && channel !== 'zalouser') return;
      let hostJs = join(projectDir, '.openclaw', rel, 'skills/zalo-sticker-mention/mentions.js');
      let contJs = `/home/node/project/.openclaw/${rel}/skills/zalo-sticker-mention/mentions.js`;
      if (!existsSync(hostJs)) {
        hostJs = join(projectDir, '.openclaw', rel, 'skills/sticker-mention/mentions.js');
        contJs = `/home/node/project/.openclaw/${rel}/skills/sticker-mention/mentions.js`;
      }
      if (!existsSync(hostJs)) return;
      const extra = restore ? ['--restore'] : [];
      try {
        if (hasDocker) {
          await runCapture('docker', ['exec', getBotContainerName(projectDir), 'node', contJs, ...extra], { cwd: projectDir, shell: false });
        } else {
          await run('node', [hostJs, ...extra], { cwd: projectDir });
        }
      } catch (e) { sendLog(`[zalo-patch] ${restore ? 'restore' : 'patch'} failed: ${e.message}`); }
    };

    let installedNow = false;
    if (enabled) {
      // Enable for THIS bot only: ensure its workspace has the skill folder.
      if (!existsSync(folder)) { await installFeature(projectDir, agent.id, 'skill', id); installedNow = true; }
      await applyStickerPatch(false);
    } else {
      // Disable for THIS bot only: restore any patch, then remove just this bot's folder.
      await applyStickerPatch(true);
      await fsp.rm(folder, { recursive: true, force: true }).catch(() => {});
    }

    // Global flag stays true while any bot still has the folder; false only when none do.
    const anyAgentHas = cfg.agents.list.some((a) => existsSync(join(projectDir, '.openclaw', workspaceRelForAgent(a, cfg, projectDir) || `workspace-${a.id}`, 'skills', slug)));
    cfg.skills = cfg.skills || { entries: {} };
    cfg.skills.entries = cfg.skills.entries || {};
    cfg.skills.entries[id] = cfg.skills.entries[id] || {};
    cfg.skills.entries[id].enabled = anyAgentHas;
    await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');

    // installFeature already restarted the container; otherwise recreate to apply the change.
    if (hasDocker && !installedNow) {
      sendLog(`[docker] Skill ${id} toggled to ${enabled} for bot ${agent.id}. Recreating containers...`);
      await recreateDockerBot(projectDir).catch((err) => sendLog(`[docker] Warning: Failed to recreate container: ${err.message}`));
    }
  }

  if (kind === 'skill' && id === 'web-search') {
    cfg.plugins = cfg.plugins || { entries: {} };
    cfg.plugins.entries = cfg.plugins.entries || {};
    cfg.plugins.entries['duckduckgo'] = cfg.plugins.entries['duckduckgo'] || {};
    cfg.plugins.entries['duckduckgo'].enabled = !!enabled;
    cfg.plugins.allow = cfg.plugins.allow || [];
    if (enabled) {
      if (!cfg.plugins.allow.includes('duckduckgo')) cfg.plugins.allow.push('duckduckgo');
      cfg.tools = cfg.tools || { profile: 'full', exec: { host: 'gateway', security: 'full', ask: 'off' } };
      cfg.tools.alsoAllow = Array.from(new Set([...(cfg.tools.alsoAllow || []), 'group:web']));
    } else {
      cfg.plugins.allow = cfg.plugins.allow.filter((x) => x !== 'duckduckgo');
      const aliases = ['browser-automation', 'openclaw-browser-automation'];
      const isBrowserEnabled = aliases.some((a) => cfg.plugins?.entries?.[a]?.enabled);
      if (!isBrowserEnabled) {
        if (cfg.tools?.alsoAllow) {
          cfg.tools.alsoAllow = cfg.tools.alsoAllow.filter((x) => x !== 'group:web');
          if (cfg.tools.alsoAllow.length === 0) delete cfg.tools.alsoAllow;
        }
      }
    }

    // Write cfgPath early so recreation reads updated openclaw.json
    await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');

    // Recreate container to apply updated openclaw.json
    const hasDocker = existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'));
    if (hasDocker) {
      sendLog(`[docker] Web Search skill toggled to ${enabled}. Recreating containers...`);
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

    if (enabled) {
      if (existingKey === 'zalo-mod' || existingKey === 'openclaw-zalo-mod') {
        ensureZaloModPluginConfig(cfg.plugins.entries[existingKey], cfg);
      }
      // Only add the canonical config key to allow list (not all aliases)
      cfg.plugins.allow = cfg.plugins.allow || [];
      if (!cfg.plugins.allow.includes(existingKey)) cfg.plugins.allow.push(existingKey);

      // Auto-expose zalo-mod dashboard port in docker-compose.yml when enabling
      if (existingKey === 'zalo-mod' || existingKey === 'openclaw-zalo-mod') {
        const composeFile = join(projectDir, 'docker', 'openclaw', 'docker-compose.yml');
        if (existsSync(composeFile)) {
          try {
            let composeContent = await fsp.readFile(composeFile, 'utf8');
            const dashPort = cfg.plugins.entries[existingKey].config?.dashboardPort;
            if (dashPort && !composeContent.includes(`:${dashPort}`)) {
              const gwPortStr = String(Number(cfg.gateway?.port) || state.gatewayPort || 18789);
              composeContent = composeContent.replace(
                new RegExp(`^(\\s*-\\s*"[^"\\n]*:${gwPortStr}")\\s*$`, 'm'),
                `$1\n      - "127.0.0.1:${dashPort}:${dashPort}"  # zalo-mod dashboard`
              );
              await fsp.writeFile(composeFile, composeContent, 'utf8');
              sendLog(`[plugin] Added dashboard port ${dashPort} to docker-compose.yml`);
            }
          } catch (e) { sendLog(`[plugin] Warning: could not add dashboard port: ${e.message}`); }
        }
      }

      if (existingKey === 'browser-automation' || existingKey === 'openclaw-browser-automation') {
        cfg.tools = cfg.tools || { profile: 'full', exec: { host: 'gateway', security: 'full', ask: 'off' } };
        cfg.tools.alsoAllow = Array.from(new Set([...(cfg.tools.alsoAllow || []), 'group:web']));

        // Force Docker sync and recreate container to include chrome/playwright dependencies
        const hasDocker = existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'));
        if (hasDocker) {
          sendLog(`[docker] Browser plugin enabled. Regenerating Dockerfiles...`);
          await syncDockerInfra(projectDir, true).catch((err) => sendLog(`[docker] Warning: Failed to sync docker infra: ${err.message}`));
          sendLog(`[docker] Rebuilding and recreating containers...`);
          await recreateDockerBot(projectDir).catch((err) => sendLog(`[docker] Warning: Failed to recreate container: ${err.message}`));
        }
      }
    } else {
      if (Array.isArray(cfg.plugins.allow)) {
        cfg.plugins.allow = cfg.plugins.allow.filter((x) => x !== existingKey);
      }
      if (existingKey === 'browser-automation' || existingKey === 'openclaw-browser-automation') {
        const isWebSearchEnabled = !!cfg.plugins?.entries?.['duckduckgo']?.enabled;
        if (!isWebSearchEnabled) {
          if (cfg.tools?.alsoAllow) {
            cfg.tools.alsoAllow = cfg.tools.alsoAllow.filter((x) => x !== 'group:web');
            if (cfg.tools.alsoAllow.length === 0) delete cfg.tools.alsoAllow;
          }
        }
        for (const a of cfg.agents.list) {
          const bf = await readWorkspaceText(projectDir, a, 'BROWSER.md');
          if (existsSync(bf.file)) await fsp.rm(bf.file, { force: true });
          const bt = await readWorkspaceText(projectDir, a, 'browser-tool.js');
          if (existsSync(bt.file)) await fsp.rm(bt.file, { force: true });
          const rel = workspaceRelForAgent(a, cfg, projectDir);
          await fsp.rm(join(projectDir, '.openclaw', rel, 'plugin-skills', 'browser-automation'), { recursive: true, force: true }).catch(() => {});
        }

        // Force Docker sync and recreate container to clean up browser dependencies/ports
        const hasDocker = existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'));
        if (hasDocker) {
          sendLog(`[docker] Browser plugin disabled. Regenerating Dockerfiles...`);
          await syncDockerInfra(projectDir, true).catch((err) => sendLog(`[docker] Warning: Failed to sync docker infra: ${err.message}`));
          sendLog(`[docker] Rebuilding and recreating containers...`);
          await recreateDockerBot(projectDir).catch((err) => sendLog(`[docker] Warning: Failed to recreate container: ${err.message}`));
        }
      }
    }
  }

  await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  return { ok: true };
}

// Most plugins are ClawHub packages (installed as `clawhub:<id>`). A few ship as plain npm
// packages and need their real package spec instead. Map id → install spec here.
const PLUGIN_NPM_SPEC = {
  'memory-tencentdb': '@tencentdb-agent-memory/memory-tencentdb',
};
const pluginInstallSpec = (id) => PLUGIN_NPM_SPEC[id] || `clawhub:${id}`;

async function installFeature(projectDir, agentId, kind, id) {
  if (kind === 'skill') {
    const skillSlugMap = {
      'image-gen': 'infographic-generator',
      'sticker-mention': 'zalo-sticker-mention',
      'learning-memory': 'learning-memory',
    };
    const slug = skillSlugMap[id] || id;

    let composeDir = null;
    if (existsSync(join(projectDir, 'docker-compose.yml'))) {
      composeDir = projectDir;
    } else if (existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'))) {
      composeDir = join(projectDir, 'docker', 'openclaw');
    }

    if (composeDir) {
      const botContainer = getBotContainerName(projectDir);
      sendLog(`[skill] Installing/updating clawhub:${slug} inside container ${botContainer} for agent ${agentId}...`);
      
      const cmd = `cd /home/node/project && openclaw skills install ${slug} --agent ${agentId} --force`;
      const cmdOut = await runCapture('docker', ['exec', botContainer, 'sh', '-lc', cmd], { cwd: projectDir, shell: false });
      
      if (cmdOut) {
         for (const line of `${cmdOut.stdout}\n${cmdOut.stderr}`.split(/\r?\n/).filter(Boolean)) sendLog(line);
      }

      if (cmdOut.code !== 0) {
        const installed = isSkillFolderExists(projectDir, agentId, slug);
        if (installed) {
          sendLog(`[skill] Warning: installation reported errors, but skill folder exists. Proceeding.`);
        } else {
          throw new Error(cmdOut.stderr || cmdOut.stdout || `Failed to install skill ${slug} inside container.`);
        }
      }
      
      sendLog(`[skill] Restarting docker container to apply skill...`);
      await run('docker', ['restart', botContainer], { shell: false });
    } else {
      await run('openclaw', ['doctor', '--fix'], { cwd: projectDir, env: openclawProjectEnv(projectDir) }).catch((err) => sendLog(`[skill] doctor --fix skipped: ${err.message}`));
      sendLog(`[skill] Installing clawhub:${slug} for agent ${agentId}...`);
      
      await run('openclaw', ['skills', 'install', slug, '--agent', agentId, '--force'], {
        cwd: projectDir,
        env: openclawProjectEnv(projectDir)
      });
    }

    // Automatically enable it in config after install
    const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
    if (existsSync(cfgPath)) {
      const cfg = ensureConfigShape(JSON.parse(await fsp.readFile(cfgPath, 'utf8')));
      cfg.skills = cfg.skills || { entries: {} };
      cfg.skills.entries = cfg.skills.entries || {};
      cfg.skills.entries[id] = cfg.skills.entries[id] || {};
      cfg.skills.entries[id].enabled = true;
      await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
    }
  }

  if (kind === 'plugin') {
    let composeDir = null;
    if (existsSync(join(projectDir, 'docker-compose.yml'))) {
      composeDir = projectDir;
    } else if (existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'))) {
      composeDir = join(projectDir, 'docker', 'openclaw');
    }

    if (composeDir) {
      const botContainer = getBotContainerName(projectDir);
      sendLog(`[plugin] Installing/updating ${pluginInstallSpec(id)} inside container ${botContainer}...`);
      
      const cmd = `cd /home/node/project && openclaw plugins install ${pluginInstallSpec(id)} --force`;
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
        if (existingKey === 'browser-automation' || existingKey === 'openclaw-browser-automation') {
          cfg.plugins.entries[existingKey].config = Object.assign({}, cfg.plugins.entries[existingKey].config, {
            hostOs: await resolveProjectHostOs(projectDir),
          });
          cfg.tools = cfg.tools || { profile: 'full', exec: { host: 'gateway', security: 'full', ask: 'off' } };
          cfg.tools.alsoAllow = Array.from(new Set([...(cfg.tools.alsoAllow || []), 'group:web']));
        }
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
              new RegExp(`^(\\s*-\\s*"[^"\\n]*:${gwPortStr}")\\s*$`, 'm'),
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
        await patchBrowserAutomationHostPreference(projectDir, aliases, sendLog);
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
      sendLog(`[plugin] Installing ${pluginInstallSpec(id)}...`);

      let installSuccess = true;
      await run('openclaw', ['plugins', 'install', pluginInstallSpec(id), '--force'], {
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
          'openclaw-browser-automation': ['browser-automation', 'openclaw-browser-automation'],
          'openclaw-zalo-mod': ['zalo-mod', 'openclaw-zalo-mod'],
          'openclaw-facebook-crawler': ['openclaw-facebook-crawler', 'openclaw-n8n-facebook-crawler', 'n8n-facebook-crawler'],
          'openclaw-n8n-facebook-poster': ['openclaw-n8n-facebook-poster', 'openclaw-facebook-poster', 'facebook-poster'],
        };
        const aliases = pluginAliasMap[id] || [id];
        const existingKey = aliases.find((a) => cfg.plugins.entries[a]) || aliases[0];
        cfg.plugins.entries[existingKey] = cfg.plugins.entries[existingKey] || {};
        cfg.plugins.entries[existingKey].enabled = true;
        if (existingKey === 'browser-automation' || existingKey === 'openclaw-browser-automation') {
          cfg.plugins.entries[existingKey].config = Object.assign({}, cfg.plugins.entries[existingKey].config, {
            hostOs: await resolveProjectHostOs(projectDir),
          });
          cfg.tools = cfg.tools || { profile: 'full', exec: { host: 'gateway', security: 'full', ask: 'off' } };
          cfg.tools.alsoAllow = Array.from(new Set([...(cfg.tools.alsoAllow || []), 'group:web']));
        }
        if (existingKey === 'zalo-mod' || existingKey === 'openclaw-zalo-mod') {
          ensureZaloModPluginConfig(cfg.plugins.entries[existingKey], cfg);
        }
        await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
      }

      if (id === 'openclaw-browser-automation' || id === 'browser-automation') {
        const aliases = ['browser-automation', 'openclaw-browser-automation'];
        await patchBrowserAutomationHostPreference(projectDir, aliases, sendLog);
      }
    }
  }
  // A skill/plugin install changes container packages and may restart it — drop cached
  // extension versions and runtime status so the next page load re-probes fresh.
  probeCacheClear(`extver:${projectDir}`);
  probeCacheClear(`runtime:${projectDir}`);
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

// In Docker installs the extensions/ dir is a named volume mounted over the bind-mounted
// .openclaw, so plugin folders (e.g. zalo-mod) live ONLY inside the container, not on the
// host. Read every extension's version in a single `docker exec` and return a
// { dirName: version } map. Returns {} for native installs (host paths handle those).
async function getContainerExtensionVersions(projectDir) {
  if (!projectDir) return {};
  const composeDir = existsSync(join(projectDir, 'docker-compose.yml'))
    ? projectDir
    : existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'))
      ? join(projectDir, 'docker', 'openclaw')
      : null;
  if (!composeDir) return {};
  const ck = `extver:${projectDir}`;
  const cached = probeCacheGet(ck);
  if (cached) return cached;
  try {
    const botContainer = getBotContainerName(projectDir);
    const script = "const fs=require('fs');const d='/home/node/project/.openclaw/extensions';const o={};try{for(const n of fs.readdirSync(d)){try{const p=d+'/'+n+'/package.json';if(fs.existsSync(p))o[n]=JSON.parse(fs.readFileSync(p,'utf8')).version||''}catch(e){}}}catch(e){}process.stdout.write(JSON.stringify(o))";
    const out = await runCapture('docker', ['exec', botContainer, 'node', '-e', script], { cwd: projectDir, shell: false });
    const parsed = JSON.parse(String(out.stdout || '{}')) || {};
    if (Object.keys(parsed).length) probeCacheSet(ck, parsed); // plugin versions change only on install
    return parsed;
  } catch (e) { return {}; }
}

function isSkillFolderExists(projectDir, agentId, skillFolder, cfg = null) {
  if (!projectDir) return false;
  if (!cfg) {
    const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
    if (!existsSync(cfgPath)) return false;
    try {
      cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    } catch (e) {
      return false;
    }
  }
  const agent = cfg?.agents?.list?.find((a) => a.id === agentId) || cfg?.agents?.list?.[0];
  if (!agent) return false;
  const rel = workspaceRelForAgent(agent, cfg, projectDir);
  const skillPath = join(projectDir, '.openclaw', rel, 'skills', skillFolder);
  return existsSync(skillPath);
}

async function getInstalledSkillVersion(projectDir, agentId, skillFolder, cfg = null) {
  if (!projectDir) return '';
  if (!cfg) {
    const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
    if (!existsSync(cfgPath)) return '';
    try {
      cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
    } catch (e) {
      return '';
    }
  }
  const agent = cfg?.agents?.list?.find((a) => a.id === agentId) || cfg?.agents?.list?.[0];
  if (!agent) return '';
  const rel = workspaceRelForAgent(agent, cfg, projectDir);
  const pkgPath = join(projectDir, '.openclaw', rel, 'skills', skillFolder, 'package.json');
  try {
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(await fsp.readFile(pkgPath, 'utf8'));
      return pkg.version || '';
    }
  } catch (e) {}
  return '';
}

async function getFeatureFlags(projectDir, agentId = '') {
  const cfgPath = join(projectDir || '', '.openclaw', 'openclaw.json');
  const cfg = existsSync(cfgPath) ? ensureConfigShape(parseJsonText(await fsp.readFile(cfgPath, 'utf8').catch(() => '{}'), {})) : {};
  const aid = agentId || cfg.agents?.list?.[0]?.id || 'bot';
  const browserOn = !!cfg.browser?.enabled;
  const cronOn = !!cfg.skills?.entries?.['cronjob']?.enabled || !!cfg.skills?.entries?.['cron']?.enabled || !!(cfg.tools?.alsoAllow || []).includes('group:automation');
  const fresh = cfg;
  const freshSaved = {};
  const installsPath = join(projectDir || '', '.openclaw', 'plugins', 'installs.json');
  const installs = existsSync(installsPath) ? parseJsonText(await fsp.readFile(installsPath, 'utf8').catch(() => '{}'), {}) : {};
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
  // Folder-based skills are scoped per bot: their "on" state = the skill folder existing in
  // THIS agent's workspace (not the global skills.entries flag, which would leak across bots).
  const imageGenOn = isSkillFolderExists(projectDir, aid, 'infographic-generator', cfg);
  const webSearchOn = isEnabled(['duckduckgo']);
  const stickerMentionOn = isSkillFolderExists(projectDir, aid, 'zalo-sticker-mention', cfg);
  const learningMemoryOn = isSkillFolderExists(projectDir, aid, 'learning-memory', cfg);
  const aliases = {
    browser: ['openclaw-browser-automation', 'browser-automation'],
    zalo: ['openclaw-zalo-mod', 'zalo-mod'],
    crawler: ['openclaw-facebook-crawler', 'openclaw-n8n-facebook-crawler', 'n8n-facebook-crawler'],
    poster: ['openclaw-n8n-facebook-poster', 'openclaw-facebook-poster', 'facebook-poster'],
    fbMessenger: ['openclaw-fb-messenger', 'fb-messenger'],
    tencentMemory: ['memory-tencentdb'],
  };
  const flags = {
    'skill:browser': browserOn,
    'skill:cron': cronOn,
    'skill:image-gen': imageGenOn,
    'skill:web-search': webSearchOn,
    'skill:sticker-mention': stickerMentionOn,
    'skill:learning-memory': learningMemoryOn,
    'plugin:openclaw-browser-automation': isEnabled(aliases.browser),
    'plugin:openclaw-zalo-mod': isEnabled(aliases.zalo),
    'plugin:openclaw-facebook-crawler': isEnabled(aliases.crawler),
    'plugin:openclaw-n8n-facebook-poster': isEnabled(aliases.poster),
    'plugin:openclaw-fb-messenger': isEnabled(aliases.fbMessenger),
    'plugin:memory-tencentdb': isEnabled(aliases.tencentMemory),
  };
  const extensionsDir = join(projectDir || '', '.openclaw', 'extensions');
  const extensionDirExists = (aliases = []) =>
    aliases.some((a) => existsSync(join(extensionsDir, a)));
  const isActuallyInstalled = (aliases = []) =>
    extensionDirExists(aliases) || isInstalledByRecord(aliases);
  const installed = {
    'skill:image-gen': isSkillFolderExists(projectDir, aid, 'infographic-generator', cfg),
    'skill:sticker-mention': isSkillFolderExists(projectDir, aid, 'zalo-sticker-mention', cfg),
    'skill:learning-memory': isSkillFolderExists(projectDir, aid, 'learning-memory', cfg),
    'plugin:openclaw-browser-automation': isActuallyInstalled(aliases.browser),
    'plugin:openclaw-zalo-mod': isActuallyInstalled(aliases.zalo),
    'plugin:openclaw-facebook-crawler': isActuallyInstalled(aliases.crawler),
    'plugin:openclaw-n8n-facebook-poster': isActuallyInstalled(aliases.poster),
    // fb-messenger is auto-added to plugins.allow by the wizard, so the allow-list is NOT
    // proof of install — require a real extension dir or an install record instead.
    'plugin:openclaw-fb-messenger': extensionDirExists(aliases.fbMessenger)
      || aliases.fbMessenger.some((a) => installedKeys.has(a) || Array.from(installedSpecs).some((spec) => spec.includes(a))),
    'plugin:memory-tencentdb': isActuallyInstalled(aliases.tencentMemory),
  };
  const versions = {
    'skill:image-gen': await getInstalledSkillVersion(projectDir, aid, 'infographic-generator', cfg),
    'skill:sticker-mention': await getInstalledSkillVersion(projectDir, aid, 'zalo-sticker-mention', cfg),
    'skill:learning-memory': await getInstalledSkillVersion(projectDir, aid, 'learning-memory', cfg),
    'plugin:openclaw-browser-automation': await getInstalledPluginVersion(projectDir, aliases.browser),
    'plugin:openclaw-zalo-mod': await getInstalledPluginVersion(projectDir, aliases.zalo),
    'plugin:openclaw-facebook-crawler': await getInstalledPluginVersion(projectDir, aliases.crawler),
    'plugin:openclaw-n8n-facebook-poster': await getInstalledPluginVersion(projectDir, aliases.poster),
    'plugin:openclaw-fb-messenger': await getInstalledPluginVersion(projectDir, aliases.fbMessenger),
    'plugin:memory-tencentdb': await getInstalledPluginVersion(projectDir, aliases.tencentMemory),
  };
  // Docker: fill any plugin version still empty from the container's extensions volume
  // (e.g. bundled/clawhub plugins like zalo-mod that aren't on the host). One docker exec.
  const containerExtVersions = await getContainerExtensionVersions(projectDir);
  if (Object.keys(containerExtVersions).length) {
    const fillVer = (key, names) => { if (!versions[key]) { for (const n of names) { if (containerExtVersions[n]) { versions[key] = containerExtVersions[n]; break; } } } };
    fillVer('plugin:openclaw-browser-automation', aliases.browser);
    fillVer('plugin:openclaw-zalo-mod', aliases.zalo);
    fillVer('plugin:openclaw-facebook-crawler', aliases.crawler);
    fillVer('plugin:openclaw-n8n-facebook-poster', aliases.poster);
    fillVer('plugin:openclaw-fb-messenger', aliases.fbMessenger);
    fillVer('plugin:memory-tencentdb', aliases.tencentMemory);
  }
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

      fetchLatestSetupVersionBg().catch(() => {});
      const latestSetupVersion = latestSetupVersionCache;

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
        remote: {
          headless: isHeadlessServer(),
          host: await getPublicIp().catch(() => null),
          user: sshUserName(),
          uiPort: activeUiPort,
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
      await resolveProjectDir(rootProjectDir, Object.fromEntries(url.searchParams));
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
    if (url.pathname === '/api/bot/restart' && req.method === 'POST') {
      const body = await readJson(req);
      const projectDir = await resolveProjectDir(rootProjectDir, body);
      await restartDockerBotContainer(projectDir);
      return json(res, { ok: true });
    }
    if (url.pathname === '/api/bot/rebuild' && req.method === 'POST') {
      const body = await readJson(req);
      const projectDir = await resolveProjectDir(rootProjectDir, body);
      sendLog('[docker] Rebuild: docker compose up -d --build --force-recreate');
      await recreateDockerBot(projectDir);
      return json(res, { ok: true });
    }
    if (url.pathname === '/api/bot/add-mount' && req.method === 'POST') {
      const body = await readJson(req);
      const projectDir = await resolveProjectDir(rootProjectDir, body);
      return json(res, await addBotMount(projectDir, body.hostPath, body.mountName));
    }
    if (url.pathname === '/api/browser/start-chrome-debug' && req.method === 'POST') {
      return json(res, await startChromeDebug());
    }
    if (url.pathname === '/api/setup/update' && req.method === 'POST') {
      const installerDir = resolve(__dirname, '../..');
      const isGit = existsSync(resolve(installerDir, '.git'));
      const mode = isGit ? 'git' : 'github';
      setImmediate(async () => {
        try {
          if (isGit) {
            // Clone/dev install: pull the latest (committed dist comes with it).
            sendLog('[update-setup] Git install detected — pulling latest from GitHub…');
            await run('git', ['pull', '--ff-only'], { cwd: installerDir });
            await run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: installerDir });
            // docs_dev (build tooling) is gitignored, so clones can't rebuild — and
            // don't need to: dist/ is committed. Only rebuild when tooling is present.
            if (existsSync(resolve(installerDir, 'docs_dev'))) {
              await run('npm', ['run', 'build'], { cwd: installerDir }).catch((e) =>
                sendLog(`[update-setup] build skipped: ${e.message}`));
            }
          } else {
            // Ephemeral `npx github:…` install: nothing to pull in place — the relaunch
            // re-runs `npx github:…`, which fetches the latest from GitHub.
            sendLog('[update-setup] Fetching the latest from GitHub on relaunch…');
          }
          restartInstaller();
        } catch (err) {
          sendLog(`[update-setup] Error updating: ${err.message}`);
        }
      });
      return json(res, { ok: true, mode });
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
          const regResult = await runCapture('docker', ['exec', botContainer, 'sh', '-lc', `cd /home/node/project && openclaw channels add telegram --token "${token}"`], { cwd: projectDir, shell: false });
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
            const login = await startZaloUserLogin(projectDir, state.mode, result.agentId);
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
      const body = await readJson(req).catch(() => ({}));
      const agentId = body.agentId || '';
      const projectDir = await resolveProjectDir(rootProjectDir, body);
      setImmediate(async () => {
        try {
          const login = await startZaloUserLogin(projectDir, state.mode, agentId);
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
      const projectDir = await resolveProjectDir(rootProjectDir, Object.fromEntries(url.searchParams));
      const result = await deleteBotInProject(projectDir, agentId);
      sendLog(`? Bot deleted: ${agentId}`);
      await recreateDockerBot(projectDir).catch((err) => sendLog(`[docker] recreate skipped/failed: ${err.message}`));
      return json(res, result);
    }
    if (url.pathname === '/api/bot/files' && req.method === 'GET') {
      const projectDir = await resolveProjectDir(rootProjectDir, Object.fromEntries(url.searchParams));
      if (!projectDir) return json(res, { files: [] });
      const agentId = url.searchParams.get('agentId') || '';
      return json(res, { files: await listMarkdownFiles(projectDir, agentId).catch(() => []) });
    }
    if (url.pathname.startsWith('/api/bot/files/')) {
      const name = decodeURIComponent(url.pathname.replace('/api/bot/files/', ''));
      if (req.method === 'GET') {
        const projectDir = await resolveProjectDir(rootProjectDir, Object.fromEntries(url.searchParams));
        const file = safeJoin(projectDir, name);
        return json(res, { name, content: await fsp.readFile(file, 'utf8') });
      }
      if (req.method === 'PUT') {
        // Allow the same text types the file tree marks editable (it exposes .json/.js/.yml/…,
        // not just .md — the old .md-only guard made "Save" silently fail on those files).
        const writableExt = new Set(['.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.yml', '.yaml', '.env', '.sh', '.bat', '.ps1', '.html', '.css']);
        if (!writableExt.has(extname(name).toLowerCase())) throw httpError(400, `Loại file này không hỗ trợ sửa từ UI (${extname(name) || 'không có đuôi'})`);
        const body = await readJson(req);
        const projectDir = await resolveProjectDir(rootProjectDir, body);
        const file = safeJoin(projectDir, name);
        const content = String(body.content || '');
        // Don't let a typo brick openclaw.json & friends — reject invalid JSON with a clear error.
        if (extname(name).toLowerCase() === '.json') {
          try { JSON.parse(content); } catch (e) { throw httpError(400, `JSON không hợp lệ: ${e.message}`); }
        }
        await fsp.writeFile(file, content, 'utf8');
        return json(res, { ok: true });
      }
    }
    if (url.pathname === '/api/catalog' && req.method === 'GET') return json(res, {
      skills: [
        { name: 'Browser', slug: 'browser' },
        { name: 'Cron', slug: 'cron' },
        { name: 'Tạo ảnh Infographic', slug: 'image-gen' },
        { name: 'Web Search', slug: 'web-search' },
      ],
      plugins: [
        { name: 'openclaw-browser-automation', package: 'openclaw-browser-automation' },
        { name: 'openclaw-zalo-mod', package: 'openclaw-zalo-mod' },
        { name: 'openclaw-facebook-crawler', package: 'openclaw-facebook-crawler' },
        { name: 'openclaw-n8n-facebook-poster', package: 'openclaw-n8n-facebook-poster' },
      ]
    });
    if (url.pathname === '/api/features' && req.method === 'GET') {
      const projectDir = await resolveProjectDir(rootProjectDir, Object.fromEntries(url.searchParams));
      if (!projectDir) return json(res, { flags: {}, installed: {}, versions: {} });
      return json(res, await getFeatureFlags(projectDir, url.searchParams.get('agentId') || ''));
    }
    if (url.pathname === '/api/features/toggle' && req.method === 'POST') {
      const body = await readJson(req);
      const projectDir = await resolveProjectDir(rootProjectDir, body);
      return json(res, await applyFeatureToggle(projectDir, body.agentId || '', body.kind, body.id, !!body.enabled));
    }
    if (url.pathname === '/api/features/install' && req.method === 'POST') {
      const body = await readJson(req);
      const projectDir = await resolveProjectDir(rootProjectDir, body);
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
  child.on('error', (err) => {
    sendLog(`[openUrl] Warning: Could not open browser automatically (${err.message}). Please navigate to ${url} manually.`);
  });
  child.unref();
}

function restartInstaller() {
  // Emit the phrase the UI watches for (see appendLogLine) BEFORE we tear down the
  // server, so the browser tab starts polling and then reloads onto the new UI once
  // it's back up on the SAME host/port — instead of hanging on a dead server.
  sendLog('[update-setup] Setup Wizard updated successfully! Restarting UI to apply the new version...');

  const underSystemd = !!(process.env.INVOCATION_ID || process.env.JOURNAL_STREAM);
  const isNpx = /[\\/]_npx[\\/]/.test(process.argv[1] || '');

  setTimeout(() => {
    try {
      // Release the listening port first so the replacement can bind the same one.
      if (activeServerInstance) {
        try { activeServerInstance.closeAllConnections?.(); } catch {}
        try { activeServerInstance.close(); } catch {}
      }

      // Under a service manager (systemd, pm2, …) just exit — it relaunches us with
      // the freshly pulled code. Re-spawning ourselves would escape the unit and
      // collide on the port.
      if (underSystemd) {
        sendLog('[update-setup] Service-managed install — exiting so the supervisor relaunches the new version.');
        setTimeout(() => process.exit(0), 400);
        return;
      }

      const uiArgs = [
        `--host=${activeUiHost}`,
        `--port=${activeUiPort}`,
        `--project-dir=${activeUiProjectDir}`,
        '--no-open',
      ];

      let bin, spawnArgs, opts;
      if (isNpx) {
        // Ephemeral `npx github:…` run — re-fetch the latest from GitHub and relaunch.
        const win = process.platform === 'win32';
        bin = win ? 'npx.cmd' : 'npx';
        spawnArgs = ['-y', 'github:tuanminhhole/openclaw-setup', ...uiArgs];
        opts = { detached: true, stdio: 'inherit', shell: win };
      } else {
        // Local clone / file install — re-run this entry (git pull already updated it).
        bin = process.argv[0];
        spawnArgs = [process.argv[1], ...uiArgs];
        opts = { detached: true, stdio: 'inherit', shell: false };
      }

      // Brief delay to let the port fully release before the child binds it.
      setTimeout(() => {
        try {
          const child = spawn(bin, spawnArgs, opts);
          child.unref();
        } catch (err) {
          sendLog(`[update-setup] Failed to relaunch: ${err.message}`);
        }
        process.exit(0);
      }, 800);
    } catch (err) {
      sendLog(`[update-setup] Failed to restart: ${err.message}`);
    }
  }, 1500);
}

/**
 * One-time convenience: drop a short `openclaw-ui` command into the user's shell
 * profile so reopening the wizard later is a single word — no long manual setup.
 * OS/shell-aware, idempotent, and fully best-effort (never throws, never blocks
 * startup). Only runs for npx-installed users (the cache dir must exist).
 */
function ensureReopenShortcut() {
  try {
    const home = os.homedir();
    const cliPath = join(home, '.openclaw-setup', 'node_modules', 'create-openclaw-bot', 'dist', 'cli.js');
    if (!existsSync(cliPath)) return; // running from a cloned repo (dev) — nothing to shortcut
    const MARK = '# >>> openclaw-ui (auto-added by OpenClaw Setup) >>>';
    const END = '# <<< openclaw-ui <<<';

    if (process.platform === 'win32') {
      const candidates = [
        join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'),
        join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
      ];
      const profile = candidates.find((p) => existsSync(dirname(p))) || candidates[1];
      const content = existsSync(profile) ? fs.readFileSync(profile, 'utf8') : '';
      if (content.includes(MARK)) { console.log("💡 Reopen anytime with:  openclaw-ui  (in a new PowerShell)"); return; }
      const block = `\n${MARK}\nfunction openclaw-ui { $env:OPENCLAW_SETUP_WIZARD="true"; node "${cliPath.replace(/\\/g, '\\\\')}" }\n${END}\n`;
      fs.mkdirSync(dirname(profile), { recursive: true });
      fs.appendFileSync(profile, block, 'utf8');
      console.log("✓ Shortcut installed — open a NEW PowerShell and type:  openclaw-ui");
    } else {
      const shell = process.env.SHELL || '';
      const rcName = shell.includes('zsh') ? '.zshrc' : shell.includes('bash') ? '.bashrc' : '.profile';
      const rc = join(home, rcName);
      const content = existsSync(rc) ? fs.readFileSync(rc, 'utf8') : '';
      if (content.includes(MARK)) { console.log("💡 Reopen anytime with:  openclaw-ui"); return; }
      const block = `\n${MARK}\nalias openclaw-ui='OPENCLAW_SETUP_WIZARD=true node "${cliPath}"'\n${END}\n`;
      fs.appendFileSync(rc, block, 'utf8');
      console.log(`✓ Shortcut added to ~/${rcName} — open a NEW terminal (or run 'source ~/${rcName}') and type:  openclaw-ui`);
    }
  } catch { /* best-effort: a shortcut failure must never break startup */ }
}

let publicIpCache = null, publicIpFetched = false;
// Best-effort public IP of this host (for the remote-access SSH-tunnel hint). Cached.
async function getPublicIp() {
  if (publicIpFetched) return publicIpCache;
  publicIpFetched = true;
  for (const u of ['https://api.ipify.org', 'https://ifconfig.me/ip', 'https://icanhazip.com']) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const ip = String(await r.text()).trim();
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) { publicIpCache = ip; return ip; }
      }
    } catch {}
  }
  return null;
}
function sshUserName() { try { return os.userInfo().username || 'root'; } catch { return 'root'; } }
function isHeadlessServer() {
  return process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
}
// On a headless server there's no local browser — print an SSH-tunnel command so the
// operator can reach the dashboard AND the Open-web UIs from their own machine. This is
// the discoverable answer for ANY user on a VPS (no manual ssh-config knowledge needed).
async function printRemoteAccessHint(uiPort) {
  if (!isHeadlessServer()) return;
  const ip = (await getPublicIp()) || '<your-server-ip>';
  const fwd = [uiPort, 18789, 20128, 18790].map((p) => `-L ${p}:127.0.0.1:${p}`).join(' ');
  console.log('');
  console.log('🌐 No local browser detected (server/VPS). Open the UI from YOUR computer:');
  console.log(`   ssh ${fwd} ${sshUserName()}@${ip}`);
  console.log(`   then open:  http://localhost:${uiPort}`);
  console.log('   (forwards the dashboard + OpenClaw gateway + 9Router + zalo-mod web UIs)');
  console.log('');
}

export async function startLocalInstaller({ host = '127.0.0.1', preferredPort = 51789, openBrowser = true, projectDir = process.cwd() } = {}) {
  const port = await findPort(host, preferredPort);
  activeUiHost = host;
  activeUiPort = port;
  activeUiProjectDir = projectDir;
  const server = http.createServer((req, res) => handler(req, res, projectDir));
  activeServerInstance = server;
  await new Promise((resolve) => server.listen(port, host, resolve));
  const url = `http://${host}:${port}`;
  console.log(`OpenClaw Setup UI: ${url}`);
  ensureReopenShortcut();
  if (openBrowser) openUrl(url);
  printRemoteAccessHint(port).catch(() => {});
}

export { createBotInProject, updateBotInProject, deleteBotInProject, validateOpenclawConfig, startZaloUserLogin, readBotCredentials, resolveProject9RouterApiKey, installCore, deleteProjectFolder };



