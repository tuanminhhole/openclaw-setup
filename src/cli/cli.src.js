#!/usr/bin/env node

import { input, select, checkbox, confirm } from '@inquirer/prompts';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { spawn, execSync, execFileSync } from 'child_process';
import { createRequire } from 'module';

// ─── Shared generators (dual-mode IIFE + CJS) ────────────────────────────────
// These modules export via module.exports when required from Node.js
const _require = createRequire(import.meta.url);

function loadSharedModule(modulePath, globalName) {
  const loaded = _require(modulePath);
  if (loaded && Object.keys(loaded).length > 0) {
    return loaded;
  }
  return globalThis[globalName] || loaded || {};
}

const {
  OPENCLAW_NPM_SPEC,
  OPENCLAW_RUNTIME_PACKAGES,
  NINE_ROUTER_PROXY_API_KEY,
  NINE_ROUTER_API_BASE_URL,
  SMART_ROUTE_PROVIDER_MODELS,
  SMART_ROUTE_PROVIDER_ORDER,
  TELEGRAM_RELAY_PLUGIN_SPEC,
  TELEGRAM_SETUP_GUIDE_FILENAME,
  buildRelayPluginInstallCommand,
  buildTelegramPostInstallChecklist,
  get9RouterBaseUrl,
  build9RouterProviderConfig,
} = loadSharedModule('../setup/shared/common-gen.js', '__openclawCommon');

const {
  buildDockerArtifacts,
  build9RouterPatchScript,
} = loadSharedModule('../setup/shared/docker-gen.js', '__openclawDockerGen');

const {
  buildWorkspaceFileMap,
} = loadSharedModule('../setup/shared/workspace-gen.js', '__openclawWorkspace');

const dataExport = loadSharedModule('../setup/data/index.js', '__openclawData');

const {
  PROVIDERS: _PROVIDERS,
  SKILLS: _SKILLS,
  CHANNELS: _CHANNELS,
  OLLAMA_MODELS,
} = dataExport;

const {
  buildCliChromeDebugArtifacts,
  buildCliUninstallArtifacts,
  buildCliUpgradeArtifacts,
  buildCliStartBotArtifacts,
} = loadSharedModule('../setup/shared/install-gen.js', '__openclawInstall');

function installRelayPluginForProject(projectDir, isVi) {
  try {
    execSync(`openclaw plugins install ${TELEGRAM_RELAY_PLUGIN_SPEC}`, { cwd: projectDir, stdio: 'ignore' });
    return true;
  } catch {
    // silent fallback
  }
  console.log(chalk.yellow(isVi
    ? `\n⚠️  Chua the tu dong cai plugin. Sau khi bot chay, chay thu cong:\n   openclaw plugins install ${TELEGRAM_RELAY_PLUGIN_SPEC}`
    : `\n⚠️  Could not auto-install plugin. After the bot starts, run manually:\n   openclaw plugins install ${TELEGRAM_RELAY_PLUGIN_SPEC}`));
  return false;
}

function isOpenClawInstalled() {
  try {
    execSync('openclaw --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isPm2Installed() {
  try {
    execSync('pm2 --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function is9RouterInstalled() {
  try {
    execSync('9router --help', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function shouldReuseInstalledGlobals() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.OPENCLAW_SETUP_REUSE_GLOBALS || '').trim().toLowerCase());
}

function getUserNpmPrefixInfo() {
  if (process.platform === 'win32') {
    return null;
  }

  const prefixDir = path.join(os.homedir(), '.local');
  return {
    prefixDir,
    binDir: path.join(prefixDir, 'bin')
  };
}

function ensureBinDirOnPath(binDir) {
  const delimiter = path.delimiter;
  const pathParts = String(process.env.PATH || '').split(delimiter).filter(Boolean);
  if (!pathParts.includes(binDir)) {
    process.env.PATH = [binDir, ...pathParts].join(delimiter);
  }
}

function quoteWindowsCmdArg(arg) {
  const value = String(arg);
  if (!/[\s"]/u.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function quotePowerShellSingle(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function resolveWindowsCommand(command) {
  try {
    const output = execSync(`where.exe ${command}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      shell: true,
      env: process.env
    });
    const firstMatch = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return firstMatch || command;
  } catch {
    return command;
  }
}

function spawnBackgroundProcess(command, args, options = {}) {
  const { cwd, env = {} } = options;
  const mergedEnv = { ...process.env, ...env };

  if (process.platform === 'win32') {
    const resolvedCommand = resolveWindowsCommand(command);
    const argList = args.map((arg) => quotePowerShellSingle(arg)).join(', ');
    const startProcessScript = [
      `$filePath = ${quotePowerShellSingle(resolvedCommand)}`,
      `$workingDir = ${quotePowerShellSingle(cwd || process.cwd())}`,
      `$argList = @(${argList})`,
      "Start-Process -WindowStyle Hidden -FilePath $filePath -WorkingDirectory $workingDir -ArgumentList $argList"
    ].join('; ');

    return spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', startProcessScript], {
      cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: mergedEnv
    });
  }

  return spawn(command, args, {
    cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: mergedEnv
  });
}

function resolveNative9RouterDesktopLaunch() {
  const routerBin = resolveCommandOnPath('9router');
  return {
    command: routerBin,
    args: ['-n', '-H', '0.0.0.0', '-p', '20128', '--skip-update'],
    env: {
      PORT: '20128',
      HOSTNAME: '0.0.0.0',
      // Ensures 9router stores data in the user home dir, matching where sync script writes db.json
      DATA_DIR: getNative9RouterDataDir(),
    }
  };
}

function build9RouterSmartRouteSyncScript(dbPath) {
  const safeDbPath = JSON.stringify(dbPath);
  const safeRouterBaseUrl = JSON.stringify(NINE_ROUTER_API_BASE_URL);
  const safeModelPriority = JSON.stringify(SMART_ROUTE_PROVIDER_MODELS);
  const safeProviderOrder = JSON.stringify(SMART_ROUTE_PROVIDER_ORDER);
  return `function bootstrap() {
  const fs = require('fs');
  const path = require('path');
  const dbPath = ${safeDbPath};
  const ROUTER=${safeRouterBaseUrl};
  const MODEL_PRIORITY=${safeModelPriority};
  const PREF=${safeProviderOrder};
  const sync = async () => {
    try {
      const response = await fetch(ROUTER + '/api/providers');
      if (!response.ok) return;
      const payload = await response.json();
      const rawConnections = Array.isArray(payload.connections)
        ? payload.connections
        : Array.isArray(payload.providerConnections)
          ? payload.providerConnections
          : [];
      const a = [...new Set(rawConnections
        .filter((item) => item && item.provider && item.isActive !== false && !item.disabled)
        .map((item) => item.provider))];
      let db = {};
      try {
        db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      } catch {}
      if (!db.combos) db.combos = [];
      const removeSmartRoute = () => {
        const next = db.combos.filter((combo) => combo.id !== 'smart-route');
        if (next.length !== db.combos.length) {
          db.combos = next;
          fs.mkdirSync(path.dirname(dbPath), { recursive: true });
          fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
          console.log('Removed smart-route (no active providers)');
        }
      };
      if (!a.length) {
        removeSmartRoute();
        return;
      }
      a.sort((x, y) => (PREF.indexOf(x) === -1 ? 99 : PREF.indexOf(x)) - (PREF.indexOf(y) === -1 ? 99 : PREF.indexOf(y)));
      const m = a.flatMap((provider) => MODEL_PRIORITY[provider] || []);
      if (!m.length) {
        removeSmartRoute();
        return;
      }
      const nextCombos = db.combos.filter((combo) => combo.id !== 'smart-route');
      nextCombos.push({ id: 'smart-route', name: 'smart-route', alias: 'smart-route', models: m });
      db.combos = nextCombos;
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    } catch {}
  };
  setTimeout(sync, 5000);
  setInterval(sync, 30000);
}
bootstrap();
`;
}

function getProjectOpenClawHome(projectDir) {
  return path.join(projectDir, '.openclaw');
}

function getProject9RouterDataDir(projectDir) {
  return path.join(projectDir, '.9router');
}

function getProjectRuntimeEnv(projectDir, extraEnv = {}) {
  return {
    ...process.env,
    OPENCLAW_HOME: getProjectOpenClawHome(projectDir),
    OPENCLAW_STATE_DIR: getProjectOpenClawHome(projectDir),
    DATA_DIR: getProject9RouterDataDir(projectDir),
    ...extraEnv,
  };
}

function hasZaloPersonal(channelKey) {
  return channelKey === 'zalo-personal';
}

function getNative9RouterDataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '9router');
  }

  return path.join(os.homedir(), '.9router');
}

async function waitFor9RouterApiReady({ port = 20128, timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const candidates = [
    `http://127.0.0.1:${port}/api/settings/require-login`,
    `http://127.0.0.1:${port}/api/version`
  ];

  while (Date.now() < deadline) {
    for (const url of candidates) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
        if (response.ok) {
          return { ok: true, url };
        }
      } catch {
        // keep polling until timeout
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  return { ok: false, url: candidates[0] };
}

function appendLineIfMissing(filePath, line) {
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8');
  }

  if (!content.includes(line)) {
    const prefix = content && !content.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(filePath, `${prefix}${line}\n`);
  }
}

function ensureUserWritableGlobalNpm({ isVi, osChoice }) {
  if (process.platform === 'win32') {
    return true;
  }

  const npmInfo = getUserNpmPrefixInfo();
  if (!npmInfo) {
    return true;
  }

  try {
    fs.ensureDirSync(npmInfo.binDir);
    process.env.npm_config_prefix = npmInfo.prefixDir;
    ensureBinDirOnPath(npmInfo.binDir);

    execSync(`npm config set prefix "${npmInfo.prefixDir.replace(/"/g, '\\"')}"`, {
      stdio: 'ignore',
      shell: true,
      env: process.env
    });

    appendLineIfMissing(path.join(os.homedir(), '.profile'), 'export PATH="$HOME/.local/bin:$PATH"');
    appendLineIfMissing(
      path.join(os.homedir(), osChoice === 'macos' ? '.zshrc' : '.bashrc'),
      'export PATH="$HOME/.local/bin:$PATH"'
    );
    return true;
  } catch {
    console.log(chalk.yellow(isVi
      ? '⚠️  Không thể cấu hình npm global prefix trong ~/.local. Tiếp tục thử cài đặt trực tiếp.'
      : '⚠️  Could not configure npm global prefix in ~/.local. Falling back to direct install.'));
    return false;
  }
}

const userNpmInfo = getUserNpmPrefixInfo();
if (userNpmInfo) {
  ensureBinDirOnPath(userNpmInfo.binDir);
}

function installGlobalPackage(pkg, { isVi, osChoice, displayName }) {
  const installCommands = [];

  if (osChoice === 'windows') {
    installCommands.push(`npm install -g ${pkg}`);
  } else {
    ensureUserWritableGlobalNpm({ isVi, osChoice });
    installCommands.push(`npm install -g ${pkg}`);
    const npmInfo = getUserNpmPrefixInfo();
    if (npmInfo) {
      installCommands.push(`npm install -g --prefix "${npmInfo.prefixDir.replace(/"/g, '\\"')}" ${pkg}`);
    }
  }

  for (const cmd of installCommands) {
    try {
      execSync(cmd, { stdio: 'inherit', shell: true, env: process.env });
      return true;
    } catch {
      // try next candidate
    }
  }

  console.log(chalk.yellow(isVi
    ? `⚠️  Không thể tự cài ${displayName}. Chạy thủ công: ${osChoice === 'windows' ? `npm install -g ${pkg}` : `npm config set prefix ~/.local && npm install -g ${pkg}`}`
    : `⚠️  Could not auto-install ${displayName}. Run manually: ${osChoice === 'windows' ? `npm install -g ${pkg}` : `npm config set prefix ~/.local && npm install -g ${pkg}`}`));
  return false;
}

function installLatestOpenClaw({ isVi, osChoice }) {
  if (shouldReuseInstalledGlobals() && isOpenClawInstalled()) {
    console.log(chalk.green(isVi
      ? '\n♻️ Dang dung lai openclaw da cai san de test nhanh.'
      : '\n♻️ Reusing the installed openclaw for a faster test run.'));
    return;
  }

  console.log(chalk.cyan(isVi
    ? `\n📦 Dang cai/cap nhat ${OPENCLAW_NPM_SPEC}...`
    : `\n📦 Installing/updating ${OPENCLAW_NPM_SPEC}...`));

  if (!installGlobalPackage(OPENCLAW_NPM_SPEC, { isVi, osChoice, displayName: 'openclaw' })) {
    process.exit(1);
  }

  console.log(chalk.green(isVi
    ? `✅ openclaw da duoc ghim dung ban ${OPENCLAW_NPM_SPEC}!`
    : `✅ openclaw is now pinned to ${OPENCLAW_NPM_SPEC}!`));
}

// ─── Shared from docker-gen.js ──────────────────────────────────────────────
// build9RouterSmartRouteSyncScript, indentBlock, build9RouterComposeEntrypointScript
// are imported from setup/shared/docker-gen.js — do NOT re-define here.

function resolveCommandOnPath(command) {
  if (process.platform === 'win32') {
    return resolveWindowsCommand(command);
  }

  try {
    return execSync(`command -v ${command}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      shell: true,
      env: process.env
    }).trim() || command;
  } catch {
    return command;
  }
}

async function writeNative9RouterSyncScript(projectDir) {
  const syncScriptPath = path.join(projectDir, '.openclaw', '9router-smart-route-sync.js');
  await fs.ensureDir(path.dirname(syncScriptPath));
  // Use native home data dir so sync script writes to same place 9router binary reads from
  const nativeDataDir = getNative9RouterDataDir();
  await fs.ensureDir(nativeDataDir);
  await fs.writeFile(syncScriptPath, build9RouterSmartRouteSyncScript(path.join(nativeDataDir, 'db.json')));
  return syncScriptPath;
}

async function writeNative9RouterPatchScript(projectDir) {
  const patchScriptPath = path.join(projectDir, '.openclaw', 'patch-9router.js');
  await fs.ensureDir(path.dirname(patchScriptPath));
  await fs.writeFile(patchScriptPath, build9RouterPatchScript());
  return patchScriptPath;
}

async function patchProject9RouterOpenClawConfig(projectDir) {
  const configPath = path.join(projectDir, '.openclaw', 'openclaw.json');
  if (!await fs.pathExists(configPath)) return false;
  const config = await fs.readJson(configPath);
  const provider = config?.models?.providers?.['9router'];
  if (!provider) return false;
  provider.baseUrl = get9RouterBaseUrl(detectProjectDeployMode(projectDir));
  provider.apiKey = NINE_ROUTER_PROXY_API_KEY;
  provider.api = 'openai-completions';
  provider.models = build9RouterProviderConfig(provider.baseUrl).models;
  await fs.writeJson(configPath, config, { spaces: 2 });
  return true;
}

async function patchProjectDocker9Router(projectDir) {
  const dockerDir = path.join(projectDir, 'docker', 'openclaw');
  const composePath = path.join(dockerDir, 'docker-compose.yml');
  if (!await fs.pathExists(composePath)) return false;

  await fs.ensureDir(dockerDir);
  await fs.writeFile(path.join(dockerDir, 'sync.js'), build9RouterSmartRouteSyncScript('/root/.9router/db.json'));
  await fs.writeFile(path.join(dockerDir, 'patch-9router.js'), build9RouterPatchScript());
  let compose = await fs.readFile(composePath, 'utf8');
  compose = compose.replace(
    /node -e "require\('fs'\)\.writeFileSync\('\/tmp\/sync\.js',Buffer\.from\('[^']*','base64'\)\.toString\(\)\)"/,
    "cp /opt/sync.js /tmp/sync.js"
  );
  compose = compose.replace(
    /(npm install -g [^\n]+\n)/,
    `$1        cp /opt/patch-9router.js /tmp/patch-9router.js\n`
  );
  if (!compose.includes('node /tmp/patch-9router.js || true')) {
    compose = compose.replace(
      /(\s*node \/tmp\/sync\.js > \/tmp\/sync\.log 2>&1 &\n)/,
      `        node /tmp/patch-9router.js || true\n$1`
    );
  }
  if (!compose.includes('./sync.js:/opt/sync.js:ro')) {
    compose = compose.replace(
      /(\s*-\s*9router-data:\/root\/\.9router\s*\n)/,
      `$1      - ./sync.js:/opt/sync.js:ro\n      - ./patch-9router.js:/opt/patch-9router.js:ro\n`
    );
  }
  await fs.writeFile(composePath, compose, 'utf8');
  return true;
}

function getGatewayAllowedOrigins(port) {
  const normalizedPort = Number(port) || 18791;
  const origins = new Set([
    `http://localhost:${normalizedPort}`,
    `http://127.0.0.1:${normalizedPort}`,
    `http://0.0.0.0:${normalizedPort}`,
  ]);
  Object.values(os.networkInterfaces() || {}).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.internal || entry.family !== 'IPv4' || !entry.address) return;
      origins.add(`http://${entry.address}:${normalizedPort}`);
    });
  });
  return Array.from(origins);
}

function getReachableDashboardHosts(port) {
  const normalizedPort = Number(port) || 18791;
  const hosts = [];
  const seen = new Set();
  const pushHost = (host) => {
    if (!host || seen.has(host)) return;
    seen.add(host);
    hosts.push(`http://${host}:${normalizedPort}`);
  };
  pushHost('127.0.0.1');
  pushHost('localhost');
  Object.values(os.networkInterfaces() || {}).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.internal || entry.family !== 'IPv4' || !entry.address) return;
      pushHost(entry.address);
    });
  });
  return hosts;
}

function rewriteDashboardUrlHost(urlText, fallbackPort, targetBaseUrl) {
  try {
    const parsed = new URL(urlText || `http://127.0.0.1:${fallbackPort}`);
    const target = new URL(targetBaseUrl);
    parsed.protocol = target.protocol;
    parsed.host = target.host;
    if (!parsed.pathname || parsed.pathname === '/') {
      parsed.pathname = target.pathname;
    }
    return parsed.toString();
  } catch {
    return urlText || targetBaseUrl;
  }
}

function extractFirstHttpUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s"'`]+/);
  return match ? match[0] : null;
}

function getTokenizedDashboardUrl(projectDir) {
  try {
    const output = execSync('openclaw dashboard', {
      cwd: projectDir,
      env: process.env,
      encoding: 'utf8',
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000
    });
    return extractFirstHttpUrl(output);
  } catch (error) {
    const combined = `${error?.stdout || ''}\n${error?.stderr || ''}`;
    return extractFirstHttpUrl(combined);
  }
}

function printNativeDashboardAccessInfo({ isVi, providerKey, projectDir, gatewayPort = 18791 }) {
  const tokenizedUrl = getTokenizedDashboardUrl(projectDir);
  const gatewayUrls = getReachableDashboardHosts(gatewayPort);
  const dashboardUrl = gatewayUrls[0] || `http://127.0.0.1:${gatewayPort}`;

  console.log(chalk.yellow(`\nDashboard OpenClaw: ${dashboardUrl}`));

  if (tokenizedUrl) {
    const rewrittenTokenUrl = rewriteDashboardUrlHost(tokenizedUrl, gatewayPort, dashboardUrl);
    console.log(chalk.green(isVi
      ? `   Link da kem token: ${rewrittenTokenUrl}`
      : `   Tokenized link: ${rewrittenTokenUrl}`));
  } else {
    console.log(chalk.gray(isVi
      ? '   Neu dashboard doi Gateway Token, chay: openclaw dashboard'
      : '   If the dashboard asks for a Gateway Token, run: openclaw dashboard'));
  }
  console.log(chalk.gray(`   Other reachable URLs: ${gatewayUrls.join(', ')}`));

  if (providerKey === '9router') {
    const routerUrls = getReachableDashboardHosts(20128).map((baseUrl) => `${baseUrl}/dashboard`);
    console.log(chalk.yellow(`\n9Router Dashboard: ${routerUrls[0] || 'http://127.0.0.1:20128/dashboard'}`));
    console.log(chalk.gray(`   Other reachable URLs: ${routerUrls.join(', ')}`));
  }
}

function printZaloPersonalLoginInfo({ isVi, deployMode, projectDir }) {
  const nativeCmd = 'openclaw channels login --channel zalouser --verbose';
  const dockerCmd = 'docker compose exec -it ai-bot openclaw channels login --channel zalouser --verbose';
  const cmd = deployMode === 'native' ? nativeCmd : dockerCmd;
  const qrPath = deployMode === 'native'
    ? path.join(os.tmpdir(), 'openclaw', 'openclaw-zalouser-qr-default.png')
    : '/tmp/openclaw/openclaw-zalouser-qr-default.png';
  const projectQrPath = path.join(projectDir, 'zalo-login-qr.png');
  const copyCmd = deployMode === 'native'
    ? (process.platform === 'win32'
      ? `Copy-Item "${qrPath}" "${projectQrPath}"`
      : `cp "${qrPath}" "${projectQrPath}"`)
    : `docker compose cp ai-bot:${qrPath} ./zalo-login-qr.png`;

  console.log(chalk.yellow(`\n📱 ${isVi ? 'Đăng nhập Zalo Personal (1 lần):' : 'Zalo Personal login (one time):'}`));
  console.log(chalk.white(`   cd ${projectDir}${deployMode === 'native' ? '' : '/docker/openclaw'} ${process.platform === 'win32' ? ';' : '&&'} ${cmd}`));
  console.log(chalk.gray(isVi
    ? `   → OpenClaw sẽ tạo file QR tại: ${qrPath}`
    : `   → OpenClaw will generate a QR image at: ${qrPath}`));
  console.log(chalk.gray(isVi
    ? `   → Nếu cần copy QR ra thư mục project, dùng: ${copyCmd}`
    : `   → If needed, copy the QR into the project folder with: ${copyCmd}`));
}

async function waitForFile(filePath, timeoutMs = 15000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fs.pathExists(filePath)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return fs.pathExists(filePath);
}

async function writeGeneratedArtifacts(targetDir, artifacts = []) {
  for (const artifact of artifacts.filter(Boolean)) {
    const artifactPath = path.join(targetDir, artifact.name);
    await fs.writeFile(artifactPath, artifact.content, 'utf8');
    if (artifact.executable || artifact.name.endsWith('.sh')) {
      try { await fs.chmod(artifactPath, 0o755); } catch (_) {}
    }
  }
}

function extractZaloPairingCode(text) {
  const value = String(text || '');
  const explicitCommandMatch = value.match(/openclaw pairing approve zalouser\s+([A-Z0-9-]+)/i);
  if (explicitCommandMatch) {
    return explicitCommandMatch[1].trim();
  }

  const pairingBlockMatch = value.match(/Pairing code:\s*`{0,3}\s*([A-Z0-9-]{6,})/i);
  if (pairingBlockMatch) {
    return pairingBlockMatch[1].trim();
  }

  return null;
}

function approveZaloPairingCode({ pairingCode, projectDir, isVi }) {
  try {
    execSync(`openclaw pairing approve zalouser ${pairingCode}`, {
      cwd: projectDir,
      stdio: 'inherit',
      shell: true,
      env: process.env
    });
    console.log(chalk.green(isVi
      ? `✅ Da tu dong approve pairing code Zalo: ${pairingCode}`
      : `✅ Automatically approved the Zalo pairing code: ${pairingCode}`));
    return true;
  } catch {
    console.log(chalk.yellow(isVi
      ? `⚠️  Khong the tu dong approve pairing code ${pairingCode}. Ban co the chay thu cong: openclaw pairing approve zalouser ${pairingCode}`
      : `⚠️  Could not auto-approve pairing code ${pairingCode}. You can run it manually: openclaw pairing approve zalouser ${pairingCode}`));
    return false;
  }
}

async function runNativeZaloPersonalLoginFlow({ isVi, projectDir }) {
  const qrSourcePath = path.join(os.tmpdir(), 'openclaw', 'openclaw-zalouser-qr-default.png');
  const qrProjectPath = path.join(projectDir, 'zalo-login-qr.png');
  console.log(chalk.yellow(`\n📱 ${isVi ? 'Đang tạo QR đăng nhập Zalo Personal...' : 'Generating the Zalo Personal login QR...'}`));
  const loginStartedAt = Date.now();

  try {
    await fs.remove(qrSourcePath);
  } catch {
    // ignore stale tmp QR cleanup failures
  }

  try {
    await fs.remove(qrProjectPath);
  } catch {
    // ignore stale project QR cleanup failures
  }

  const child = spawn('openclaw', ['channels', 'login', '--channel', 'zalouser', '--verbose'], {
    cwd: projectDir,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  });

  let loginSucceeded = false;
  let approvedPairingCode = null;
  let outputBuffer = '';
  const successPattern = /login successful|logged in successfully|channel login successful/i;
  const forwardChunk = (chunk, target) => {
    const text = chunk.toString();
    outputBuffer = `${outputBuffer}${text}`.slice(-8000);
    if (successPattern.test(text)) {
      loginSucceeded = true;
    }
    const pairingCode = extractZaloPairingCode(outputBuffer);
    if (pairingCode && pairingCode !== approvedPairingCode) {
      if (approveZaloPairingCode({ pairingCode, projectDir, isVi })) {
        approvedPairingCode = pairingCode;
      }
    }
    target.write(text);
  };

  child.stdout?.on('data', (chunk) => forwardChunk(chunk, process.stdout));
  child.stderr?.on('data', (chunk) => forwardChunk(chunk, process.stderr));

  let qrCopied = false;
  const copyQrIfReady = async () => {
    if (qrCopied) return;
    if (await waitForFile(qrSourcePath, 500, 250)) {
      const qrStats = await fs.stat(qrSourcePath).catch(() => null);
      if (!qrStats || qrStats.mtimeMs < loginStartedAt) {
        return;
      }
      await fs.copy(qrSourcePath, qrProjectPath, { overwrite: true });
      qrCopied = true;
      console.log(chalk.green(isVi
        ? `✅ QR đã được copy vào: ${qrProjectPath}`
        : `✅ QR copied to: ${qrProjectPath}`));
    }
  };

  const watcher = setInterval(() => {
    copyQrIfReady().catch(() => {});
  }, 750);

  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
  clearInterval(watcher);
  await copyQrIfReady();

  if (exitCode !== 0 && !loginSucceeded) {
    console.log(chalk.yellow(isVi
      ? '⚠️  Chưa hoàn tất đăng nhập Zalo trong lúc setup. Bạn có thể chạy lại lệnh login thủ công sau.'
      : '⚠️  Zalo login was not completed during setup. You can run the login command manually afterwards.'));
    printZaloPersonalLoginInfo({ isVi, deployMode: 'native', projectDir });
  } else if (loginSucceeded && exitCode !== 0) {
    console.log(chalk.green(isVi
      ? '✅ Đăng nhập Zalo đã thành công dù CLI trả về trạng thái không chuẩn.'
      : '✅ Zalo login succeeded even though the CLI returned a non-standard exit status.'));
  }
}

function runPm2Save({ projectDir, isVi }) {
  try {
    execSync('pm2 save', {
      cwd: projectDir,
      stdio: 'inherit',
      shell: true,
      env: process.env
    });
  } catch {
    console.log(chalk.yellow(isVi
      ? '⚠️  PM2 save khong hoan tat. Bot van co the dang chay, nhung hay thu chay lai `pm2 save` sau.'
      : '⚠️  PM2 save did not complete. The app may still be running, but try `pm2 save` again afterwards.'));
  }
}

function getDetectedOsChoice() {
  const detectedPlatform = process.platform;
  return detectedPlatform === 'win32' ? 'windows'
    : detectedPlatform === 'darwin' ? 'macos'
    : 'vps';
}

function getCliSubcommand() {
  return String(process.argv[2] || '').trim().toLowerCase();
}

function findProjectDir(startDir = process.cwd()) {
  let currentDir = path.resolve(startDir);

  while (true) {
    if (
      fs.existsSync(path.join(currentDir, '.openclaw'))
      || fs.existsSync(path.join(currentDir, 'docker', 'openclaw'))
    ) {
      return currentDir;
    }

    const isDockerOpenClawDir =
      path.basename(currentDir).toLowerCase() === 'openclaw'
      && path.basename(path.dirname(currentDir)).toLowerCase() === 'docker';
    if (isDockerOpenClawDir) {
      const projectDir = path.dirname(path.dirname(currentDir));
      if (
        fs.existsSync(path.join(projectDir, '.openclaw'))
        || fs.existsSync(path.join(currentDir, 'docker-compose.yml'))
      ) {
        return projectDir;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

function detectProjectDeployMode(projectDir) {
  const dockerDir = path.join(projectDir, 'docker', 'openclaw');
  if (
    fs.existsSync(path.join(dockerDir, 'docker-compose.yml'))
    || fs.existsSync(path.join(dockerDir, '.env'))
  ) {
    return 'docker';
  }
  return 'native';
}

function detectProjectBotName(projectDir) {
  try {
    const configPath = path.join(projectDir, '.openclaw', 'openclaw.json');
    if (fs.existsSync(configPath)) {
      const config = fs.readJsonSync(configPath);
      const firstAgentId = config?.agents?.list?.[0]?.id;
      if (firstAgentId) {
        return firstAgentId;
      }
    }
  } catch {
    // fallback below
  }
  return path.basename(projectDir);
}

function detectProjectUses9Router(projectDir) {
  try {
    const configPath = path.join(projectDir, '.openclaw', 'openclaw.json');
    if (fs.existsSync(configPath)) {
      const config = fs.readJsonSync(configPath);
      if (config?.models?.providers?.['9router']) {
        return true;
      }
    }
  } catch {
    // fallback below
  }
  return fs.existsSync(path.join(projectDir, '.9router'));
}

function detectProjectIsMultiBot(projectDir) {
  try {
    const configPath = path.join(projectDir, '.openclaw', 'openclaw.json');
    if (fs.existsSync(configPath)) {
      const config = fs.readJsonSync(configPath);
      return (config?.agents?.list?.length || 0) > 1;
    }
  } catch {
    // fallback below
  }
  return false;
}

function getNativePm2AppName(isMultiBot = false) {
  return isMultiBot ? 'openclaw-multibot' : 'openclaw';
}

async function runUpgradeCommand() {
  const projectDir = findProjectDir();
  if (!projectDir) {
    console.error(chalk.red('Error: no OpenClaw project found in the current directory tree.'));
    console.error(chalk.yellow('Run this inside the bot project folder that contains .openclaw or docker/openclaw.'));
    process.exit(1);
  }

  const deployMode = detectProjectDeployMode(projectDir);
  const osChoice = getDetectedOsChoice();
  const botName = detectProjectBotName(projectDir);
  const is9Router = detectProjectUses9Router(projectDir);
  const isMultiBot = detectProjectIsMultiBot(projectDir);

  console.log(chalk.cyan('\nRefreshing generated OpenClaw project artifacts...'));
  console.log(chalk.gray(`   Project: ${projectDir}`));
  console.log(chalk.gray(`   Mode: ${deployMode}`));

  await writeGeneratedArtifacts(projectDir, buildCliChromeDebugArtifacts());
  await writeGeneratedArtifacts(projectDir, buildCliUninstallArtifacts({
    deployMode,
    osChoice,
    projectDir,
    botName: (deployMode !== 'docker' && osChoice === 'vps')
      ? getNativePm2AppName(isMultiBot)
      : botName,
  }));
  await writeGeneratedArtifacts(projectDir, buildCliUpgradeArtifacts());

  if (deployMode !== 'docker') {
    await writeGeneratedArtifacts(projectDir, buildCliStartBotArtifacts({
      projectDir,
      openclawHome: path.join(projectDir, '.openclaw'),
      is9Router,
      osChoice,
      isMultiBot,
      appName: getNativePm2AppName(isMultiBot),
      isVi: false,
    }));
  }

  if (is9Router) {
    await writeNative9RouterPatchScript(projectDir);
    await patchProject9RouterOpenClawConfig(projectDir);
    if (deployMode === 'docker') {
      await patchProjectDocker9Router(projectDir);
    } else {
      await writeNative9RouterSyncScript(projectDir);
      try {
        execFileSync(process.execPath, [path.join(projectDir, '.openclaw', 'patch-9router.js')], {
          cwd: projectDir,
          stdio: 'ignore',
        });
      } catch {
        // Best effort: start scripts also retry the patch before launch.
      }
    }
  }

  console.log(chalk.green('\nUpgrade artifacts refreshed successfully.'));
  if (deployMode === 'docker') {
    console.log(chalk.white(`   Next: cd ${path.join(projectDir, 'docker', 'openclaw')} && docker compose up -d --build`));
  } else {
    console.log(chalk.white(`   Next: run ${process.platform === 'win32' ? '.\\start-bot.bat' : './start-bot.sh'} from ${projectDir}`));
  }
}

function startNative9RouterPm2({ isVi, projectDir, appName, syncScriptPath }) {
  const routerAppName = `${appName}-9router`;
  const syncAppName = `${appName}-9router-sync`;
  const routerLaunch = resolveNative9RouterDesktopLaunch();
  const normalizedProjectDir = projectDir.replace(/\\/g, '/');
  const normalizedSyncScriptPath = syncScriptPath ? syncScriptPath.replace(/\\/g, '/') : '';
  try {
    execSync(`pm2 delete ${routerAppName}`, {
      cwd: projectDir,
      stdio: 'ignore',
      shell: true
    });
  } catch {
    // ignore missing app
  }
  execFileSync('pm2', [
    'start',
    routerLaunch.command,
    '--name',
    routerAppName,
    '--cwd',
    normalizedProjectDir,
    '--interpreter',
    'none',
    '--',
    ...routerLaunch.args
  ], {
    cwd: projectDir,
    stdio: 'inherit',
    env: { ...process.env, ...routerLaunch.env }
  });
  if (syncScriptPath) {
    try {
      execSync(`pm2 delete ${syncAppName}`, {
        cwd: projectDir,
        stdio: 'ignore',
        shell: true
      });
    } catch {
      // ignore missing app
    }
    try {
      execFileSync('pm2', [
        'start',
        normalizedSyncScriptPath,
        '--name',
        syncAppName,
        '--cwd',
        normalizedProjectDir,
        '--interpreter',
        process.execPath,
        '--no-autorestart',
      ], {
        cwd: projectDir,
        stdio: 'inherit',
        env: process.env
      });
    } catch (syncErr) {
      console.log(chalk.yellow(isVi
        ? `\n⚠️  Khong the tu dong khoi dong sync script qua PM2.`
        : `\n⚠️  Could not auto-start 9router sync script via PM2.`));
    }
  }
  runPm2Save({ projectDir, isVi });
  console.log(chalk.green(`\n✅ ${isVi ? '9Router da duoc khoi dong qua PM2.' : '9Router is running via PM2.'}`));
  console.log(chalk.gray(isVi ? `   Xem log: pm2 logs ${routerAppName}` : `   View logs: pm2 logs ${routerAppName}`));
}

async function ensureProjectRuntimeDirs(projectDir, isVi) {
  await fs.ensureDir(path.join(projectDir, '.openclaw'));
  await fs.ensureDir(getProject9RouterDataDir(projectDir));
  console.log(chalk.green(`\n✅ ${isVi
    ? 'Da chuan bi runtime directories local trong project.'
    : 'Prepared project-local runtime directories.'}`));
}

// buildTelegramPostInstallChecklist is imported from setup/shared/common-gen.js

// ─── Docker Auto-Detection ───────────────────────────────────────────────────
function isDockerInstalled() {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch { return false; }
}



const LOGO = `
████████╗██╗   ██╗ █████╗ ███╗   ██╗███╗   ███╗██╗███╗   ██╗██╗  ██╗██╗  ██╗ ██████╗ ██╗     ███████╗
╚══██╔══╝██║   ██║██╔══██╗████╗  ██║████╗ ████║██║████╗  ██║██║  ██║██║  ██║██╔═══██╗██║     ██╔════╝
   ██║   ██║   ██║███████║██╔██╗ ██║██╔████╔██║██║██╔██╗ ██║███████║███████║██║   ██║██║     █████╗  
   ██║   ██║   ██║██╔══██║██║╚██╗██║██║╚██╔╝██║██║██║╚██╗██║██╔══██║██╔══██║██║   ██║██║     ██╔══╝  
   ██║   ╚██████╔╝██║  ██║██║ ╚████║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║██║  ██║╚██████╔╝███████╗███████╗
   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝
`;

// ── Data constants from setup/data/index.js (single source of truth) ──────────
const CHANNELS = _CHANNELS;
const PROVIDERS = _PROVIDERS;
const SKILLS = _SKILLS;

function providerSupportsMemoryEmbeddings(providerKey) {
  const providerCapabilities = {
    '9router': { supportsEmbeddings: true },
    openai: { supportsEmbeddings: true },
    anthropic: { supportsEmbeddings: false },
    ollama: { supportsEmbeddings: false },
    google: { supportsEmbeddings: true },
    gemini: { supportsEmbeddings: true },
  };
  if (providerCapabilities[providerKey]) {
    return providerCapabilities[providerKey].supportsEmbeddings;
  }
  return !!PROVIDERS[providerKey]?.supportsEmbeddings;
}

function getCliSkillChoices({ providerKey, isVi }) {
  const memoryRecommended = providerSupportsMemoryEmbeddings(providerKey);
  return SKILLS
    .filter((skill) => skill.value !== 'memory' || providerSupportsMemoryEmbeddings(providerKey) || skill.id === 'memory')
    .map((skill) => {
      const value = skill.value || skill.id;
      let name = `${skill.icon || ''} ${isVi ? (skill.nameVi || skill.name) : (skill.nameEn || skill.name)}`.trim();
      if (value === 'memory') {
        name = isVi
          ? (memoryRecommended ? '🧠 Long-term Memory ⭐(Khuyên dùng)' : '🧠 Long-term Memory')
          : (memoryRecommended ? '🧠 Long-term Memory ⭐(Recommended)' : '🧠 Long-term Memory');
      }
      return {
        name,
        value,
        checked: value === 'browser' || value === 'scheduler' || (value === 'memory' && memoryRecommended),
      };
    });
}

const CLI_BACK = '__openclaw_cli_back__';

function getBackChoice(isVi) {
  return {
    name: isVi ? '← Quay lại' : '← Back',
    value: CLI_BACK,
  };
}

function withBackHint(message, isVi) {
  return `${message} ${isVi ? '(gõ "back" để quay lại)' : '(type "back" to go back)'}`;
}

async function selectWithBack({ message, choices, defaultValue, allowBack = false, isVi = true }) {
  const finalChoices = allowBack ? [...choices, getBackChoice(isVi)] : choices;
  return select({
    message,
    choices: finalChoices,
    ...(defaultValue ? { default: defaultValue } : {}),
  });
}

async function inputWithBack({ message, defaultValue = '', required = false, allowBack = false, isVi = true }) {
  const value = await input({
    message: allowBack ? withBackHint(message, isVi) : message,
    default: defaultValue,
    required,
  });
  if (allowBack && String(value || '').trim().toLowerCase() === 'back') {
    return CLI_BACK;
  }
  return value;
}

async function checkboxWithBack({ message, choices, isVi = true, allowBack = false }) {
  const finalChoices = allowBack ? [...choices, getBackChoice(isVi)] : choices;
  const value = await checkbox({
    message,
    choices: finalChoices,
  });
  return allowBack && value.includes(CLI_BACK) ? CLI_BACK : value;
}

async function collectBotSetupStep({
  isVi,
  channelKey,
  channel,
  existingBots = [],
  existingBotCount = 1,
  existingGroupId = '',
}) {
  let botCount = channelKey === 'telegram' ? existingBotCount : 1;
  let groupId = existingGroupId;
  const bots = [];

  if (channelKey === 'telegram') {
    const botCountValue = await selectWithBack({
      message: isVi ? 'Bạn muốn cài bao nhiêu Telegram bot?' : 'How many Telegram bots do you want to deploy?',
      choices: [
        { name: '1 bot (single)', value: '1' },
        { name: '2 bots (Department Room)', value: '2' },
        { name: '3 bots', value: '3' },
        { name: '4 bots', value: '4' },
        { name: '5 bots', value: '5' },
      ],
      defaultValue: String(existingBotCount || 1),
      allowBack: true,
      isVi,
    });
    if (botCountValue === CLI_BACK) {
      return { back: true };
    }
    botCount = parseInt(botCountValue, 10);

    if (botCount > 1) {
      const groupOption = await selectWithBack({
        message: isVi ? 'Bạn có sẵn Telegram Group chưa?' : 'Do you already have a Telegram Group?',
        choices: [
          { name: isVi ? '✨  Tôi sẽ tạo sau (nhập Group ID vào .env sau khi setup)' : '✨  I\'ll create later (add Group ID to .env after setup)', value: 'create' },
          { name: isVi ? '🔗  Đã có group — nhập Group ID ngay' : '🔗  Already have a group — enter Group ID now', value: 'existing' }
        ],
        defaultValue: groupId ? 'existing' : 'create',
        allowBack: true,
        isVi,
      });
      if (groupOption === CLI_BACK) {
        return { back: true };
      }

      if (groupOption === 'existing') {
        console.log(chalk.dim(isVi
          ? '\n  📌 Cách lấy Group ID:\n     1. Mở Telegram → tìm @userinfobot\n     2. Bấm Start để bắt đầu → chọn nút "Group" trên màn hình → chọn Group bạn muốn thêm bot vào\n     3. Bot sẽ trả về "Chat ID" — đó là Group ID (bắt đầu bằng -100)\n     👉 https://t.me/userinfobot\n'
          : '\n  📌 How to get Group ID:\n     1. Open Telegram → find @userinfobot\n     2. Click Start → select "Group" button on the screen → select the group you want to add the bot to\n     3. The bot replies with "Chat ID" — that is your Group ID (starts with -100)\n     👉 https://t.me/userinfobot\n'));
        const nextGroupId = await inputWithBack({
          message: isVi ? 'Telegram Group ID (VD: -1001234567890):' : 'Telegram Group ID (e.g. -1001234567890):',
          defaultValue: groupId,
          allowBack: true,
          isVi,
        });
        if (nextGroupId === CLI_BACK) {
          return { back: true };
        }
        groupId = nextGroupId;
      } else {
        groupId = '';
      }
    } else {
      groupId = '';
    }

    for (let i = 0; i < botCount; i++) {
      console.log(chalk.bold(`\n${isVi ? `─── Bot ${i + 1} / ${botCount} ───` : `─── Bot ${i + 1} / ${botCount} ───`}`));
      const defaults = existingBots[i] || {};
      const fields = [
        {
          key: 'name',
          message: isVi ? `Tên Bot ${i + 1}:` : `Bot ${i + 1} name:`,
          defaultValue: defaults.name || `Bot ${i + 1}`,
          required: true,
        },
        {
          key: 'slashCmd',
          message: isVi ? `Slash command (VD: /bot${i + 1}):` : `Slash command (e.g. /bot${i + 1}):`,
          defaultValue: defaults.slashCmd || `/bot${i + 1}`,
          required: true,
        },
        {
          key: 'desc',
          message: isVi ? `Mô tả Bot ${i + 1} (VD: Trợ lý AI cá nhân):` : `Bot ${i + 1} description (e.g. Personal AI assistant):`,
          defaultValue: defaults.desc || (isVi ? 'Trợ lý AI cá nhân' : 'Personal AI assistant'),
          required: true,
        },
        {
          key: 'persona',
          message: isVi ? `Tính cách & quy tắc Bot ${i + 1} (VD: siêu thân thiện, nhiều emoji):` : `Bot ${i + 1} persona & rules (e.g. friendly, uses emojis):`,
          defaultValue: defaults.persona || '',
          required: false,
        },
        {
          key: 'token',
          message: isVi ? 'Bot Token (từ @BotFather):' : 'Bot Token (from @BotFather):',
          defaultValue: defaults.token || '',
          required: true,
        },
      ];

      const draft = { ...defaults };
      let fieldIndex = 0;
      while (fieldIndex < fields.length) {
        const field = fields[fieldIndex];
        const value = await inputWithBack({
          message: field.message,
          defaultValue: draft[field.key] || field.defaultValue,
          required: field.required,
          allowBack: true,
          isVi,
        });
        if (value === CLI_BACK) {
          if (fieldIndex > 0) {
            fieldIndex--;
            continue;
          }
          return { back: true };
        }
        draft[field.key] = value;
        fieldIndex++;
      }
      bots.push(draft);
    }
  } else if (channelKey !== 'zalo-personal') {
    const defaults = existingBots[0] || {};
    const fields = [
      {
        key: 'name',
        message: isVi ? 'Tên Bot:' : 'Bot Name:',
        defaultValue: defaults.name || 'Chat Bot',
        required: true,
      },
      {
        key: 'desc',
        message: isVi ? 'Mô tả Bot:' : 'Bot Description:',
        defaultValue: defaults.desc || (isVi ? 'Trợ lý AI cá nhân' : 'Personal AI assistant'),
        required: true,
      },
      {
        key: 'persona',
        message: isVi ? 'Tính cách & quy tắc (VD: gọn gàng, thân thiện):' : 'Persona & rules (e.g. concise, friendly):',
        defaultValue: defaults.persona || '',
        required: false,
      },
      {
        key: 'token',
        message: isVi ? `Nhập ${channel.name} Token:` : `Enter ${channel.name} Token:`,
        defaultValue: defaults.token || '',
        required: true,
      },
    ];
    const draft = { ...defaults, slashCmd: '' };
    let fieldIndex = 0;
    while (fieldIndex < fields.length) {
      const field = fields[fieldIndex];
      const value = await inputWithBack({
        message: field.message,
        defaultValue: draft[field.key] || field.defaultValue,
        required: field.required,
        allowBack: true,
        isVi,
      });
      if (value === CLI_BACK) {
        if (fieldIndex > 0) {
          fieldIndex--;
          continue;
        }
        return { back: true };
      }
      draft[field.key] = value;
      fieldIndex++;
    }
    bots.push(draft);
  } else {
    bots.push({ name: 'Bot', slashCmd: '', desc: '', persona: '', token: '' });
  }

  return {
    back: false,
    botCount,
    groupId,
    bots,
    botToken: bots[0]?.token || '',
  };
}

async function collectBotSetupStepWithGroupBack(options) {
  const {
    isVi,
    channelKey,
    channel,
    existingBots = [],
    existingBotCount = 1,
    existingGroupId = '',
  } = options;

  let botCount = channelKey === 'telegram' ? existingBotCount : 1;
  let groupId = existingGroupId;
  const bots = [];

  if (channelKey === 'telegram') {
    const botCountValue = await selectWithBack({
      message: isVi ? 'Bạn muốn cài bao nhiêu Telegram bot?' : 'How many Telegram bots do you want to deploy?',
      choices: [
        { name: '1 bot (single)', value: '1' },
        { name: '2 bots (Department Room)', value: '2' },
        { name: '3 bots', value: '3' },
        { name: '4 bots', value: '4' },
        { name: '5 bots', value: '5' },
      ],
      defaultValue: String(existingBotCount || 1),
      allowBack: true,
      isVi,
    });
    if (botCountValue === CLI_BACK) {
      return { back: true };
    }
    botCount = parseInt(botCountValue, 10);

    if (botCount > 1) {
      while (true) {
        const groupOption = await selectWithBack({
          message: isVi ? 'Bạn có sẵn Telegram Group chưa?' : 'Do you already have a Telegram Group?',
          choices: [
            { name: isVi ? '✨  Tôi sẽ tạo sau (nhập Group ID vào .env sau khi setup)' : '✨  I\'ll create later (add Group ID to .env after setup)', value: 'create' },
            { name: isVi ? '🔗  Đã có group — nhập Group ID ngay' : '🔗  Already have a group — enter Group ID now', value: 'existing' }
          ],
          defaultValue: groupId ? 'existing' : 'create',
          allowBack: true,
          isVi,
        });
        if (groupOption === CLI_BACK) {
          return { back: true };
        }

        if (groupOption === 'existing') {
          console.log(chalk.dim(isVi
            ? '\n  📌 Cách lấy Group ID:\n     1. Mở Telegram → tìm @userinfobot\n     2. Bấm Start để bắt đầu → chọn nút "Group" trên màn hình → chọn Group bạn muốn thêm bot vào\n     3. Bot sẽ trả về "Chat ID" — đó là Group ID (bắt đầu bằng -100)\n     👉 https://t.me/userinfobot\n'
            : '\n  📌 How to get Group ID:\n     1. Open Telegram → find @userinfobot\n     2. Click Start → select "Group" button on the screen → select the group you want to add the bot to\n     3. The bot replies with "Chat ID" — that is your Group ID (starts with -100)\n     👉 https://t.me/userinfobot\n'));
          const nextGroupId = await inputWithBack({
            message: isVi ? 'Telegram Group ID (VD: -1001234567890):' : 'Telegram Group ID (e.g. -1001234567890):',
            defaultValue: groupId,
            allowBack: true,
            isVi,
          });
          if (nextGroupId === CLI_BACK) {
            continue;
          }
          groupId = nextGroupId;
          break;
        }

        groupId = '';
        break;
      }
    } else {
      groupId = '';
    }

    for (let i = 0; i < botCount; i++) {
      console.log(chalk.bold(`\n${isVi ? `─── Bot ${i + 1} / ${botCount} ───` : `─── Bot ${i + 1} / ${botCount} ───`}`));
      const defaults = existingBots[i] || {};
      const fields = [
        {
          key: 'name',
          message: isVi ? `Tên Bot ${i + 1}:` : `Bot ${i + 1} name:`,
          defaultValue: defaults.name || `Bot ${i + 1}`,
          required: true,
        },
        {
          key: 'slashCmd',
          message: isVi ? `Slash command (VD: /bot${i + 1}):` : `Slash command (e.g. /bot${i + 1}):`,
          defaultValue: defaults.slashCmd || `/bot${i + 1}`,
          required: true,
        },
        {
          key: 'desc',
          message: isVi ? `Mô tả Bot ${i + 1} (VD: Trợ lý AI cá nhân):` : `Bot ${i + 1} description (e.g. Personal AI assistant):`,
          defaultValue: defaults.desc || (isVi ? 'Trợ lý AI cá nhân' : 'Personal AI assistant'),
          required: true,
        },
        {
          key: 'persona',
          message: isVi ? `Tính cách & quy tắc Bot ${i + 1} (VD: siêu thân thiện, nhiều emoji):` : `Bot ${i + 1} persona & rules (e.g. friendly, uses emojis):`,
          defaultValue: defaults.persona || '',
          required: false,
        },
        {
          key: 'token',
          message: isVi ? 'Bot Token (từ @BotFather):' : 'Bot Token (from @BotFather):',
          defaultValue: defaults.token || '',
          required: true,
        },
      ];

      const draft = { ...defaults };
      let fieldIndex = 0;
      while (fieldIndex < fields.length) {
        const field = fields[fieldIndex];
        const value = await inputWithBack({
          message: field.message,
          defaultValue: draft[field.key] || field.defaultValue,
          required: field.required,
          allowBack: true,
          isVi,
        });
        if (value === CLI_BACK) {
          if (fieldIndex > 0) {
            fieldIndex--;
            continue;
          }
          return { back: true };
        }
        draft[field.key] = value;
        fieldIndex++;
      }
      bots.push(draft);
    }
  } else if (channelKey !== 'zalo-personal') {
    const defaults = existingBots[0] || {};
    const fields = [
      {
        key: 'name',
        message: isVi ? 'Tên Bot:' : 'Bot Name:',
        defaultValue: defaults.name || 'Chat Bot',
        required: true,
      },
      {
        key: 'desc',
        message: isVi ? 'Mô tả Bot:' : 'Bot Description:',
        defaultValue: defaults.desc || (isVi ? 'Trợ lý AI cá nhân' : 'Personal AI assistant'),
        required: true,
      },
      {
        key: 'persona',
        message: isVi ? 'Tính cách & quy tắc (VD: gọn gàng, thân thiện):' : 'Persona & rules (e.g. concise, friendly):',
        defaultValue: defaults.persona || '',
        required: false,
      },
      {
        key: 'token',
        message: isVi ? `Nhập ${channel.name} Token:` : `Enter ${channel.name} Token:`,
        defaultValue: defaults.token || '',
        required: true,
      },
    ];
    const draft = { ...defaults, slashCmd: '' };
    let fieldIndex = 0;
    while (fieldIndex < fields.length) {
      const field = fields[fieldIndex];
      const value = await inputWithBack({
        message: field.message,
        defaultValue: draft[field.key] || field.defaultValue,
        required: field.required,
        allowBack: true,
        isVi,
      });
      if (value === CLI_BACK) {
        if (fieldIndex > 0) {
          fieldIndex--;
          continue;
        }
        return { back: true };
      }
      draft[field.key] = value;
      fieldIndex++;
    }
    bots.push(draft);
  } else {
    bots.push({ name: 'Bot', slashCmd: '', desc: '', persona: '', token: '' });
  }

  return {
    back: false,
    botCount,
    groupId,
    bots,
    botToken: bots[0]?.token || '',
  };
}

async function collectProviderStep({
  isVi,
  existingProviderKey = '',
  existingProviderKeyVal = '',
  existingOllamaModel = 'gemma4:e2b',
}) {
  const providerKey = await selectWithBack({
    message: isVi ? 'Chọn AI Provider:' : 'Select AI Provider:',
    choices: Object.entries(PROVIDERS).map(([k, v]) => ({ name: `${v.icon} ${v.name}`, value: k })),
    defaultValue: existingProviderKey || undefined,
    allowBack: true,
    isVi,
  });
  if (providerKey === CLI_BACK) {
    return { back: true };
  }
  const provider = PROVIDERS[providerKey];

  let providerKeyVal = existingProviderKey === providerKey ? existingProviderKeyVal : '';
  if (!provider.isProxy && !provider.isLocal) {
    const keyValue = await inputWithBack({
      message: isVi ? `Nhập ${provider.envKey}:` : `Enter ${provider.envKey}:`,
      defaultValue: providerKeyVal,
      required: true,
      allowBack: true,
      isVi,
    });
    if (keyValue === CLI_BACK) {
      return { back: true };
    }
    providerKeyVal = keyValue;
  }

  let selectedOllamaModel = existingProviderKey === 'ollama' ? existingOllamaModel : 'gemma4:e2b';
  if (providerKey === 'ollama') {
    console.log(chalk.yellow(isVi
      ? '\n💡 Gemma 4 (02/04/2026) — chọn kích thước phù hợp với RAM máy bạn:'
      : '\n💡 Gemma 4 (April 2, 2026) — pick a size that fits your RAM:'));
    const modelValue = await selectWithBack({
      message: isVi ? 'Chọn model Ollama:' : 'Select Ollama model:',
      choices: [
        {
          name: isVi
            ? '🟢 gemma4:e2b  — Nhẹ nhất (~4-6 GB RAM) — Laptop / test nhanh ★ Khuyên dùng'
            : '🟢 gemma4:e2b  — Lightest (~4-6 GB RAM) — Laptop / fastest test ★ Recommended',
          value: 'gemma4:e2b'
        },
        {
          name: isVi
            ? '🟡 gemma4:e4b  — Cân bằng (~8-10 GB RAM) — Dùng hằng ngày'
            : '🟡 gemma4:e4b  — Balanced (~8-10 GB RAM) — Daily use',
          value: 'gemma4:e4b'
        },
        {
          name: isVi
            ? '🟠 gemma4:26b  — Mạnh (~18-24 GB RAM/VRAM) — Máy mạnh'
            : '🟠 gemma4:26b  — Powerful (~18-24 GB RAM/VRAM) — High-end machine',
          value: 'gemma4:26b'
        },
        {
          name: isVi
            ? '🔴 gemma4:31b  — Mạnh nhất (~24+ GB RAM/VRAM) — GPU workstation'
            : '🔴 gemma4:31b  — Most powerful (~24+ GB RAM/VRAM) — GPU workstation',
          value: 'gemma4:31b'
        },
      ],
      defaultValue: selectedOllamaModel,
      allowBack: true,
      isVi,
    });
    if (modelValue === CLI_BACK) {
      return { back: true };
    }
    selectedOllamaModel = modelValue;
  }

  return {
    back: false,
    providerKey,
    provider,
    providerKeyVal,
    selectedOllamaModel,
  };
}

async function collectSkillsStep({
  isVi,
  providerKey,
  existingSelectedSkills = [],
  existingBrowserMode = 'server',
  existingTtsOpenaiKey = '',
  existingTtsElevenKey = '',
  existingSmtpHost = 'smtp.gmail.com',
  existingSmtpPort = '587',
  existingSmtpUser = '',
  existingSmtpPass = '',
}) {
  const selectedSkills = await checkboxWithBack({
    message: isVi ? 'Bật tính năng bổ sung (Space để chọn):' : 'Enable extra skills (Space to select):',
    choices: getCliSkillChoices({ providerKey, isVi }).map((choice) => ({
      ...choice,
      checked: existingSelectedSkills.includes(choice.value),
    })),
    allowBack: true,
    isVi,
  });
  if (selectedSkills === CLI_BACK) {
    return { back: true };
  }

  let browserMode = existingBrowserMode;
  if (selectedSkills.includes('browser')) {
    const isLinux = process.platform === 'linux';
    const browserValue = await selectWithBack({
      message: isVi ? 'Chế độ Browser Automation:' : 'Browser Automation mode:',
      choices: [
        {
          name: isVi
            ? '🖥️  Dùng Chrome trên máy tính (Windows/Mac — Bypass Cloudflare tốt hơn)'
            : '🖥️  Use Host Chrome (Windows/Mac — Better Cloudflare bypass)',
          value: 'desktop'
        },
        {
          name: isVi
            ? '🐳 Headless Chromium trong Docker (Ubuntu Server / VPS — không cần GUI)'
            : '🐳 Headless Chromium inside Docker (Ubuntu Server / VPS — No GUI)',
          value: 'server'
        }
      ],
      defaultValue: browserMode || (isLinux ? 'server' : 'desktop'),
      allowBack: true,
      isVi,
    });
    if (browserValue === CLI_BACK) {
      return { back: true };
    }
    browserMode = browserValue;
  } else {
    browserMode = 'server';
  }

  let ttsOpenaiKey = existingTtsOpenaiKey;
  let ttsElevenKey = existingTtsElevenKey;
  if (selectedSkills.includes('tts')) {
    const openaiKey = await inputWithBack({
      message: isVi ? 'Nhập OPENAI_API_KEY (cho TTS, bỏ trống nếu dùng ElevenLabs):' : 'Enter OPENAI_API_KEY (for TTS, leave empty for ElevenLabs):',
      defaultValue: ttsOpenaiKey,
      allowBack: true,
      isVi,
    });
    if (openaiKey === CLI_BACK) {
      return { back: true };
    }
    ttsOpenaiKey = openaiKey;

    const elevenKey = await inputWithBack({
      message: isVi ? 'Nhập ELEVENLABS_API_KEY (hoặc bỏ trống):' : 'Enter ELEVENLABS_API_KEY (or leave empty):',
      defaultValue: ttsElevenKey,
      allowBack: true,
      isVi,
    });
    if (elevenKey === CLI_BACK) {
      return { back: true };
    }
    ttsElevenKey = elevenKey;
  } else {
    ttsOpenaiKey = '';
    ttsElevenKey = '';
  }

  let smtpHost = existingSmtpHost;
  let smtpPort = existingSmtpPort;
  let smtpUser = existingSmtpUser;
  let smtpPass = existingSmtpPass;
  if (selectedSkills.includes('email')) {
    const smtpHostValue = await inputWithBack({
      message: isVi ? 'SMTP Host (VD: smtp.gmail.com):' : 'SMTP Host (e.g. smtp.gmail.com):',
      defaultValue: smtpHost,
      required: true,
      allowBack: true,
      isVi,
    });
    if (smtpHostValue === CLI_BACK) {
      return { back: true };
    }
    smtpHost = smtpHostValue;

    const smtpPortValue = await inputWithBack({
      message: 'SMTP Port:',
      defaultValue: smtpPort,
      required: true,
      allowBack: true,
      isVi,
    });
    if (smtpPortValue === CLI_BACK) {
      return { back: true };
    }
    smtpPort = smtpPortValue;

    const smtpUserValue = await inputWithBack({
      message: isVi ? 'SMTP Email:' : 'SMTP Email:',
      defaultValue: smtpUser,
      required: true,
      allowBack: true,
      isVi,
    });
    if (smtpUserValue === CLI_BACK) {
      return { back: true };
    }
    smtpUser = smtpUserValue;

    const smtpPassValue = await inputWithBack({
      message: isVi ? 'SMTP App Password:' : 'SMTP App Password:',
      defaultValue: smtpPass,
      required: true,
      allowBack: true,
      isVi,
    });
    if (smtpPassValue === CLI_BACK) {
      return { back: true };
    }
    smtpPass = smtpPassValue;
  } else {
    smtpHost = 'smtp.gmail.com';
    smtpPort = '587';
    smtpUser = '';
    smtpPass = '';
  }

  return {
    back: false,
    selectedSkills,
    browserMode,
    ttsOpenaiKey,
    ttsElevenKey,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
  };
}


// ─── Shared workspace file writer ─────────────────────────────────────────────
// Used by both native and docker flows to write .md + browser files consistently.
async function writeWorkspaceFiles({
  workspaceDir,   // absolute path to the workspace dir
  isVi,
  botName,
  botDesc,
  persona = '',
  selectedSkills = [],
  deployMode = 'native',  // 'native' | 'docker'
  isServer = false,       // true = headless Docker server mode
  isDesktop = false,      // true = desktop/host Chrome mode
  isMultiBot = false,
  ownAliases = [],
  otherAgents = [],       // [{ name, agentId }]
  teamRoster = [],
  userInfo = '',
  agentWorkspaceDir = 'workspace',
  isRelayBot = false,
  replyToDirectMessages = true,
}) {
  const skillListStr = SKILLS
    .filter((s) => selectedSkills.includes(s.value))
    .map((s) => {
      const label = s.name.replace(/^[^ ]+ /, '');
      return isRelayBot
        ? `- ${label}${s.slug ? ` (${s.slug})` : ' (native)'}`
        : `- **${label}**${s.slug ? ` (${s.slug})` : ' (native)'}`;
    })
    .join('\n') || (isVi ? '- _(Chưa có skill nào)_' : '- _(No skills installed)_');

  const workspacePath = `.openclaw/${agentWorkspaceDir}/`;
  const teamRosterFormatted = teamRoster
    .map((peer, idx) => {
      const agentId = peer.agentId || String(peer.name || `Bot ${idx + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const desc = peer.desc || (isVi ? 'Tro ly AI ca nhan' : 'Personal AI assistant');
      const accountId = peer.accountId ? `, accountId: ${peer.accountId}` : '';
      const slashCmd = peer.slashCmd ? `, slash: ${peer.slashCmd}` : '';
      return `- \`${agentId}\`: ${peer.name || `Bot ${idx + 1}`} - ${desc}${accountId}${slashCmd}`;
    })
    .join('\n');

  const files = buildWorkspaceFileMap({
    isVi,
    variant: isRelayBot ? 'relay' : 'single',
    botName,
    botDesc,
    ownAliases,
    otherAgents,
    replyToDirectMessages,
    skillListStr,
    workspacePath,
    agentWorkspaceDir,
    persona,
    userInfo,
    hasBrowser: isDesktop || isServer,
    soulVariant: isRelayBot ? 'cli-simple' : 'cli-rich',
    userVariant: isRelayBot ? 'cli-multi' : 'cli-single',
    memoryVariant: isRelayBot ? 'cli-multi' : 'cli-single',
    browserDocVariant: isServer ? 'cli-server' : 'cli-desktop',
    browserToolVariant: 'cli',
    includeBrowserTool: isDesktop,
    teamRosterFormatted,
    hasScheduler: selectedSkills.includes('scheduler'),
  });

  await fs.ensureDir(workspaceDir);
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(workspaceDir, name), content, 'utf8');
  }
}


async function main() {
  const cliSubcommand = getCliSubcommand();
  if (cliSubcommand === 'upgrade') {
    await runUpgradeCommand();
    return;
  }

  console.log(chalk.red('\n=================================='));
  console.log(chalk.redBright(LOGO));
  console.log(chalk.greenBright('     OpenClaw Auto Setup CLI     '));
  console.log(chalk.red('==================================\n'));

  let lang = 'vi';
  let isVi = true;
  const detectedPlatform = process.platform;
  const detectedOS = detectedPlatform === 'win32' ? 'windows'
    : detectedPlatform === 'darwin' ? 'macos'
    : 'linux';
  let osChoice = detectedOS === 'linux' ? 'vps' : detectedOS;
  let deployMode = 'docker';
  let channelKey = 'telegram';
  let channel = CHANNELS[channelKey];
  let botToken = '';
  let botCount = 1;
  let bots = [];
  let groupId = '';
  let userInfo = '';
  let providerKey = '9router';
  let provider = PROVIDERS[providerKey];
  let providerKeyVal = '';
  let selectedOllamaModel = 'gemma4:e2b';
  let selectedSkills = [];
  let tavilyKey = '';
  let browserMode = 'server';
  let ttsOpenaiKey = '';
  let ttsElevenKey = '';
  let smtpHost = 'smtp.gmail.com', smtpPort = '587', smtpUser = '', smtpPass = '';
  let defaultDir = process.cwd();
  if (!defaultDir.endsWith('openclaw-setup') && !defaultDir.endsWith('openclaw')) {
    defaultDir = path.join(defaultDir, 'openclaw-setup');
  }
  let projectDir = defaultDir;

  let setupStep = 'language';
  while (true) {
    if (setupStep === 'language') {
      lang = await select({
        message: 'Select language / Chọn ngôn ngữ:',
        choices: [
          { name: 'Tiếng Việt', value: 'vi' },
          { name: 'English', value: 'en' }
        ],
        default: lang
      });
      isVi = lang === 'vi';
      setupStep = 'os';
      continue;
    }

    if (setupStep === 'os') {
      const nextOsChoice = await selectWithBack({
        message: isVi ? 'Bạn đang chạy trên hệ điều hành nào?' : 'What OS are you running on?',
        choices: [
          { name: isVi ? '🪟 Windows' : '🪟 Windows', value: 'windows' },
          { name: isVi ? '🍎 macOS' : '🍎 macOS', value: 'macos' },
          { name: isVi ? '🐧 Ubuntu Desktop' : '🐧 Ubuntu Desktop', value: 'ubuntu' },
          { name: isVi ? '🖥️  VPS / Ubuntu Server' : '🖥️  VPS / Ubuntu Server', value: 'vps' },
        ],
        defaultValue: osChoice,
        allowBack: true,
        isVi,
      });
      if (nextOsChoice === CLI_BACK) {
        setupStep = 'language';
        continue;
      }
      osChoice = nextOsChoice;
      setupStep = 'deploy';
      continue;
    }

    if (setupStep === 'deploy') {
      const deployModeDefault = (osChoice === 'ubuntu' || osChoice === 'vps') ? 'native' : 'docker';
      const nextDeployMode = await selectWithBack({
        message: isVi ? 'Chọn cách chạy bot:' : 'How do you want to run the bot?',
        choices: [
          { name: isVi ? '🐳 Docker (Khuyên dùng cho Windows / macOS — dễ cài, chạy ngay)' : '🐳 Docker (Recommended for Windows / macOS — easy setup, runs immediately)', value: 'docker' },
          { name: isVi ? '⚡ Native / PM2 (Khuyên dùng cho Ubuntu / VPS — ít RAM, ổn định hơn)' : '⚡ Native / PM2 (Recommended for Ubuntu / VPS — less RAM, more stable)', value: 'native' }
        ],
        defaultValue: deployMode || deployModeDefault,
        allowBack: true,
        isVi,
      });
      if (nextDeployMode === CLI_BACK) {
        setupStep = 'os';
        continue;
      }
      deployMode = nextDeployMode;
      if (deployMode === 'docker' && !isDockerInstalled()) {
        console.log(chalk.cyan(isVi ? '\n🐳 Docker chưa được cài — đang tự động cài Docker Engine + Compose plugin...' : '\n🐳 Docker not found — auto-installing Docker Engine + Compose plugin...'));
        try {
          const platform = process.platform;
          if (platform === 'win32') {
            execSync('winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements', { stdio: 'inherit' });
            console.log(chalk.green(isVi ? '✅ Docker Desktop đã cài xong. Vui lòng mở Docker Desktop, đợi khởi động (icon tray chuyển xanh) rồi chạy lại lệnh này.' : '✅ Docker Desktop installed. Open Docker Desktop, wait for it to start (tray icon turns green), then re-run this command.'));
            process.exit(0);
          } else if (platform === 'darwin') {
            execSync('brew install --cask docker', { stdio: 'inherit' });
            console.log(chalk.green(isVi ? '✅ Docker Desktop cài xong qua Homebrew. Mở Docker Desktop, đợi khởi động rồi chạy lại lệnh này.' : '✅ Docker Desktop installed via Homebrew. Open Docker Desktop, wait for it to start, then re-run this command.'));
            process.exit(0);
          } else {
            execSync('curl -fsSL https://get.docker.com | sh', { stdio: 'inherit', shell: true });
            try { execSync('apt-get install -y docker-compose-plugin', { stdio: 'ignore', shell: true }); } catch {}
            console.log(chalk.green(isVi ? '✅ Docker Engine + Compose plugin đã cài xong.' : '✅ Docker Engine + Compose plugin installed.'));
          }
        } catch {
          console.log(chalk.red(isVi ? '❌ Không thể tự cài Docker. Tải thủ công: https://www.docker.com/products/docker-desktop/' : '❌ Could not auto-install Docker. Download manually: https://www.docker.com/products/docker-desktop/'));
          process.exit(1);
        }
      }
      setupStep = 'channel';
      continue;
    }

    if (setupStep === 'channel') {
      const nextChannelKey = await selectWithBack({
        message: isVi ? 'Chọn nền tảng bot:' : 'Select bot platform:',
        choices: Object.entries(CHANNELS).map(([k, v]) => ({ name: v.icon + ' ' + v.name, value: k })),
        defaultValue: channelKey,
        allowBack: true,
        isVi,
      });
      if (nextChannelKey === CLI_BACK) {
        setupStep = 'deploy';
        continue;
      }
      channelKey = nextChannelKey;
      channel = CHANNELS[channelKey];
      if (channelKey === 'zalo-bot') {
        console.log(chalk.yellow('\n⚠️  ' + (isVi ? 'LƯU Ý: Zalo OA Bot yêu cầu phải thiết lập Webhook Public (qua VPS/ngrok có HTTPS). Hãy dùng Zalo Personal nếu bạn chưa có Webhook.' : 'NOTE: Zalo OA requires a Public Webhook (via VPS/ngrok with HTTPS). Use Zalo Personal if you do not have one.')));
      }
      setupStep = 'botSetup';
      continue;
    }

    if (setupStep === 'botSetup') {
      const botSetup = await collectBotSetupStepWithGroupBack({ isVi, channelKey, channel, existingBots: bots, existingBotCount: botCount, existingGroupId: groupId });
      if (botSetup.back) {
        setupStep = 'channel';
        continue;
      }
      botCount = botSetup.botCount;
      groupId = botSetup.groupId;
      bots = botSetup.bots;
      botToken = botSetup.botToken;
      setupStep = 'userInfo';
      continue;
    }

    if (setupStep === 'userInfo') {
      console.log(chalk.bold('\n' + (isVi ? '👤 Thông tin của bạn 👤' : '👤 About You 👤')));
      const nextUserInfo = await inputWithBack({ message: isVi ? '👤 Thông tin về bạn (tên bạn, ngôn ngữ, múi giờ, sở thích...):' : '👤 About you (your name, language, timezone, interests...):', defaultValue: userInfo, required: true, allowBack: true, isVi });
      if (nextUserInfo === CLI_BACK) {
        setupStep = 'botSetup';
        continue;
      }
      userInfo = nextUserInfo;
      setupStep = 'provider';
      continue;
    }

    if (setupStep === 'provider') {
      const providerSetup = await collectProviderStep({ isVi, existingProviderKey: providerKey, existingProviderKeyVal: providerKeyVal, existingOllamaModel: selectedOllamaModel });
      if (providerSetup.back) {
        setupStep = 'userInfo';
        continue;
      }
      providerKey = providerSetup.providerKey;
      provider = providerSetup.provider;
      providerKeyVal = providerSetup.providerKeyVal;
      selectedOllamaModel = providerSetup.selectedOllamaModel;
      setupStep = 'skills';
      continue;
    }

    if (setupStep === 'skills') {
      const skillSetup = await collectSkillsStep({ isVi, providerKey, existingSelectedSkills: selectedSkills, existingBrowserMode: browserMode, existingTtsOpenaiKey: ttsOpenaiKey, existingTtsElevenKey: ttsElevenKey, existingSmtpHost: smtpHost, existingSmtpPort: smtpPort, existingSmtpUser: smtpUser, existingSmtpPass: smtpPass });
      if (skillSetup.back) {
        setupStep = 'provider';
        continue;
      }
      selectedSkills = skillSetup.selectedSkills;
      browserMode = skillSetup.browserMode;
      ttsOpenaiKey = skillSetup.ttsOpenaiKey;
      ttsElevenKey = skillSetup.ttsElevenKey;
      smtpHost = skillSetup.smtpHost;
      smtpPort = skillSetup.smtpPort;
      smtpUser = skillSetup.smtpUser;
      smtpPass = skillSetup.smtpPass;
      setupStep = 'projectDir';
      continue;
    }

    if (setupStep === 'projectDir') {
      const nextProjectDir = await inputWithBack({ message: isVi ? 'Thư mục cài đặt project:' : 'Project install directory:', defaultValue: projectDir, allowBack: true, isVi });
      if (nextProjectDir === CLI_BACK) {
        setupStep = 'skills';
        continue;
      }
      projectDir = nextProjectDir;
      break;
    }
  }

  const isMultiBot = botCount > 1 && channelKey === 'telegram';
  const botName = bots[0].name;
  const botDesc = bots[0].desc;
  const botPersona = bots[0].persona;
  const agentId = String(botName || 'chat').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'chat';
  const modelsPrimary = providerKey === 'ollama' ? selectedOllamaModel : providerKey === '9router' ? 'smart-route' : provider.models?.[0]?.id || 'gpt-4o-mini';
  const hasBrowserDesktop = selectedSkills.includes('browser') && browserMode === 'desktop';
  const hasBrowserServer  = selectedSkills.includes('browser') && browserMode === 'server';
  console.log(chalk.cyan(`\n🚀 ${isVi ? 'Đang tạo thư mục và file cấu hình...' : 'Generating directories and configurations...'}`));
  
  await fs.ensureDir(projectDir);


  // ─── Helper: build .env content per bot ──────────────────────────────────

  function buildEnvContent(botIndex) {
    let env = '';
    if (provider.isLocal) {
      env += `OLLAMA_HOST=${ollamaHost}\n`;
      env += 'OLLAMA_API_KEY=ollama-local\n';
    } else if (!provider.isProxy) {
      env += `${provider.envKey}=${providerKeyVal}\n`;
    }
    const tok = bots[botIndex]?.token || botToken;
    if (channelKey === 'telegram') {
      env += `TELEGRAM_BOT_TOKEN=${tok}\n`;
      if (isMultiBot && groupId) env += `TELEGRAM_GROUP_ID=${groupId}\n`;
    } else if (channelKey === 'zalo-bot') {
      env += `ZALO_APP_ID=\nZALO_APP_SECRET=\nZALO_BOT_TOKEN=${tok}\n`;
    }
    if (selectedSkills.includes('tts')) {
      env += `\n# --- Text-To-Speech ---\n`;
      if (ttsOpenaiKey) env += `OPENAI_API_KEY=${ttsOpenaiKey}\n`;
      if (ttsElevenKey) env += `ELEVENLABS_API_KEY=${ttsElevenKey}\n`;
    }
    if (selectedSkills.includes('email')) {
      env += `\n# --- Email ---\nSMTP_HOST=${smtpHost}\nSMTP_PORT=${smtpPort}\nSMTP_USER=${smtpUser}\nSMTP_PASS=${smtpPass}\n`;
    }
    return env;
  }

  function buildSharedEnvContent() {
    let env = '';
    if (provider.isLocal) {
      env += `OLLAMA_HOST=${ollamaHost}\n`;
      env += 'OLLAMA_API_KEY=ollama-local\n';
    } else if (!provider.isProxy) {
      env += `${provider.envKey}=${providerKeyVal}\n`;
    }
    if (selectedSkills.includes('tts')) {
      env += `\n# --- Text-To-Speech ---\n`;
      if (ttsOpenaiKey) env += `OPENAI_API_KEY=${ttsOpenaiKey}\n`;
      if (ttsElevenKey) env += `ELEVENLABS_API_KEY=${ttsElevenKey}\n`;
    }
    if (selectedSkills.includes('email')) {
      env += `\n# --- Email ---\nSMTP_HOST=${smtpHost}\nSMTP_PORT=${smtpPort}\nSMTP_USER=${smtpUser}\nSMTP_PASS=${smtpPass}\n`;
    }
    return env;
  }

  // ─── Create directories and write .env files ─────────────────────────────
  if (isMultiBot) {
    await fs.ensureDir(path.join(projectDir, '.openclaw'));
    if (deployMode === 'docker') {
      await fs.ensureDir(path.join(projectDir, 'docker', 'openclaw'));
      await fs.writeFile(path.join(projectDir, 'docker', 'openclaw', '.env'), buildSharedEnvContent());
    } else {
      await fs.writeFile(path.join(projectDir, '.env'), buildSharedEnvContent());
    }
  } else {
    await fs.ensureDir(path.join(projectDir, '.openclaw'));
    await fs.ensureDir(path.join(projectDir, 'docker', 'openclaw'));
    const envFilePath = deployMode === 'docker'
      ? path.join(projectDir, 'docker', 'openclaw', '.env')
      : path.join(projectDir, '.env');
    await fs.writeFile(envFilePath, buildEnvContent(0));
  }
  
  
  // ── Docker artifacts: Dockerfile + docker-compose via shared buildDockerArtifacts() ──────
  const skillSlugs = SKILLS
    .filter(s => selectedSkills.includes(s.value) && s.slug)
    .map(s => s.slug);
  const skillInstallCmd = skillSlugs.length > 0
    ? skillSlugs.map(s => `openclaw skills install ${s} 2>/dev/null || true`).join(' && ')
    : '';
  const relayInstallCmd = (isMultiBot && channelKey === 'telegram')
    ? buildRelayPluginInstallCommand('openclaw')
    : '';
  const socatBridge = hasBrowserDesktop ? 'socat TCP-LISTEN:9222,fork,reuseaddr TCP:host.docker.internal:9222 &' : '';
  const deviceApproveLoop = 'while true; do sleep 5; openclaw devices approve --latest 2>/dev/null || true; done >/dev/null 2>&1 &';

  // buildDockerArtifacts joins runtimeCommandParts with spaces, then appends 'openclaw gateway run'
  // Each part should be a standalone command fragment (no trailing &&)
  const { dockerfile, compose } = buildDockerArtifacts({
    openClawNpmSpec: OPENCLAW_NPM_SPEC,
    openClawRuntimePackages: OPENCLAW_RUNTIME_PACKAGES,
    is9Router: providerKey === '9router',
    isLocal: provider.isLocal,
    isMultiBot,
    hasBrowser: hasBrowserDesktop || hasBrowserServer,
    selectedModel: modelsPrimary,
    agentId,
    runtimeCommandParts: [
      skillInstallCmd ? skillInstallCmd + ' &&' : '',
      relayInstallCmd ? relayInstallCmd + ' &&' : '',
      socatBridge,
      deviceApproveLoop,
    ].filter(Boolean),
    volumeMount: '../../.openclaw:/root/project/.openclaw',
    singleComposeName: `oc-${agentId}`,
    multiComposeName: 'oc-multibot',
    singleAppContainerName: `openclaw-${agentId}`,
    multiAppContainerName: 'openclaw-multibot',
    singleRouterContainerName: `9router-${agentId}`,
    multiRouterContainerName: '9router-multibot',
    singleOllamaContainerName: `ollama-${agentId}`,
    multiOllamaContainerName: 'ollama-multibot',
    plainSingleExtraHosts: hasBrowserDesktop,
    multiOllamaNumParallel: 2,
    singleOllamaNumParallel: 1,
    emitBrowserInstall: hasBrowserServer || hasBrowserDesktop,

  });

  const dockerDir = path.join(projectDir, 'docker', 'openclaw');
  await fs.ensureDir(dockerDir);
  await fs.writeFile(path.join(dockerDir, 'Dockerfile'), dockerfile);
  await fs.ensureDir(dockerDir);
  await fs.writeFile(path.join(dockerDir, 'docker-compose.yml'), compose);

  let authProfilesJson = {};
  if (provider.isLocal) {
    // Ollama: must register provider with any non-empty API key
    authProfilesJson = {
      version: 1,
      profiles: {
        'ollama:default': {
          provider: 'ollama',
          type: 'api_key',
          key: 'ollama-local',
          url: 'http://ollama:11434',
        },
      },
      order: { ollama: ['ollama:default'] },
    };
  } else if (providerKey && providerKey !== '9router') {
    const authProviderName = 'openai';
    const authProfileId = `${authProviderName}:default`;
    const authKeyValue = providerKeyVal;

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

    if (providerKey !== 'openai' && provider.baseURL) {
      authProfilesJson.profiles[authProfileId].url = provider.baseURL;
    }
  } else if (providerKey === '9router') {
    authProfilesJson = {
      version: 1,
        profiles: {
          '9router-proxy': {
            provider: '9router',
            type: 'api_key',
            key: NINE_ROUTER_PROXY_API_KEY,
          },
        },
      order: { '9router': ['9router-proxy'] },
    };
  }

  // modelsPrimary already declared above


  if (isMultiBot) {
    const rootClawDir = path.join(projectDir, '.openclaw');
    const teamRoster = bots.slice(0, botCount).map((peer, idx) => ({
      idx,
      name: peer?.name || `Bot ${idx + 1}`,
      desc: peer?.desc || (isVi ? 'Tro ly AI ca nhan' : 'Personal AI assistant'),
      persona: peer?.persona || '',
      slashCmd: peer?.slashCmd || '',
      token: peer?.token || '',
    }));
    const agentMetas = teamRoster.map((peer) => {
      const agentSlug = peer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `bot${peer.idx + 1}`;
      return {
        ...peer,
        agentId: agentSlug,
        accountId: peer.idx === 0 ? 'default' : agentSlug,
        workspaceDir: `workspace-${agentSlug}`,
      };
    });
    const telegramAccounts = Object.fromEntries(agentMetas.map((meta) => [meta.accountId, {
      botToken: meta.token,
    }]));
    const telegramChannelConfig = {
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
    };
    const skillEntries = {};
    SKILLS.forEach((s) => {
      if (!selectedSkills.includes(s.value)) return;
      if (!s.slug) return;
      skillEntries[s.slug] = { enabled: true };
    });

    const sharedConfig = {
      meta: { lastTouchedVersion: '2026.3.24' },
      agents: {
        defaults: {
          model: { primary: modelsPrimary, fallbacks: [] },
          compaction: { mode: 'safeguard' },
          timeoutSeconds: provider.isLocal ? 900 : 120,
          ...(provider.isLocal ? { llm: { idleTimeoutSeconds: 300 } } : {}),
        },
        list: agentMetas.map((meta) => ({
          id: meta.agentId,
          name: meta.name,
          workspace: `.openclaw/${meta.workspaceDir}`,
          agentDir: `agents/${meta.agentId}/agent`,
          model: { primary: modelsPrimary, fallbacks: [] },
        })),
      },
      ...(providerKey === '9router' ? {
        models: {
          mode: 'merge',
          providers: {
            '9router': build9RouterProviderConfig(get9RouterBaseUrl(deployMode)),
          },
        },
      } : provider.isLocal ? {
        models: {
          mode: 'merge',
          providers: {
            ollama: {
              baseUrl: 'http://ollama:11434',
              api: 'ollama',
              apiKey: 'ollama-local',
              models: OLLAMA_MODELS,
            },
          },
        },
      } : {}),
      commands: { native: 'auto', nativeSkills: 'auto', restart: true, ownerDisplay: 'raw' },
      bindings: agentMetas.map((meta) => ({
        agentId: meta.agentId,
        match: { channel: 'telegram', accountId: meta.accountId },
      })),
      channels: {
        telegram: telegramChannelConfig,
      },
      tools: {
        profile: 'full',
        exec: { host: 'gateway', security: 'full', ask: 'off' },
        agentToAgent: {
          enabled: true,
          allow: agentMetas.map((meta) => meta.agentId),
        },
      },
      gateway: {
        port: 18791,
        mode: 'local',
        bind: 'custom',
        customBindHost: '0.0.0.0',
        controlUi: {
          allowedOrigins: getGatewayAllowedOrigins(18791),
        },
        auth: { mode: 'token', token: 'cli-dummy-token-xyz123' },
      },
    };
    sharedConfig.plugins = { entries: {} };

    if (hasBrowserDesktop) {
      sharedConfig.browser = {
        enabled: true,
        defaultProfile: 'host-chrome',
        profiles: { 'host-chrome': { cdpUrl: 'http://127.0.0.1:9222', color: '#4285F4' } },
      };
    } else if (hasBrowserServer) {
      sharedConfig.browser = { enabled: true };
    }
    if (Object.keys(skillEntries).length > 0) {
      sharedConfig.skills = { entries: skillEntries };
    }

    await fs.writeJson(path.join(rootClawDir, 'openclaw.json'), sharedConfig, { spaces: 2 });
    await fs.writeFile(
      path.join(projectDir, TELEGRAM_SETUP_GUIDE_FILENAME),
      buildTelegramPostInstallChecklist({ isVi, bots, groupId }),
      'utf8',
    );
    // Generate ecosystem.config.js for PM2 native multi-bot
    if (deployMode === 'native') {
      // Also write config to ~/.openclaw/ — openclaw binary on Linux/Mac reads from home dir
      const homeClawDir = path.join(os.homedir(), '.openclaw');
      await fs.ensureDir(homeClawDir);
      const homeConfig = JSON.parse(JSON.stringify(sharedConfig));
      for (const agent of (homeConfig.agents && homeConfig.agents.list || [])) {
        // workspace is relative to projectDir (.openclaw/workspace-X); agentDir is relative to rootClawDir (agents/X/agent)
        if (agent.workspace && !path.isAbsolute(agent.workspace)) agent.workspace = path.join(projectDir, agent.workspace);
        if (agent.agentDir && !path.isAbsolute(agent.agentDir)) agent.agentDir = path.join(rootClawDir, agent.agentDir);
      }
      await fs.writeJson(path.join(homeClawDir, 'openclaw.json'), homeConfig, { spaces: 2 });
      if (Object.keys(authProfilesJson).length > 0) {
        await fs.writeJson(path.join(homeClawDir, 'auth-profiles.json'), authProfilesJson, { spaces: 2 });
      }
      const safeRootClawDir = rootClawDir.replace(/\\/g, '/');
      const pm2Apps = [
        '    {',
        `      name: 'openclaw-multibot',`,
        `      script: 'openclaw',`,
        `      args: 'gateway run',`,
        `      cwd: '${projectDir.replace(/\\/g, '/')}',`,
        `      interpreter: 'none',`,
        `      autorestart: true,`,
        `      watch: false,`,
        `      env: {`,
        `        NODE_ENV: 'production',`,
        `        OPENCLAW_HOME: '\',`,
        `        OPENCLAW_STATE_DIR: '\',`,
        `      }`,
        '    }',
      ].join('\n');
      const ecosystemContent = [
        '// PM2 ecosystem — run: pm2 start ecosystem.config.js',
        'module.exports = {',
        '  apps: [',
        pm2Apps,
        '  ]',
        '};',
        '',
      ].join('\n');
      await fs.writeFile(path.join(projectDir, 'ecosystem.config.js'), ecosystemContent);
    }
    if (Object.keys(authProfilesJson).length > 0) {
      await fs.writeJson(path.join(rootClawDir, 'auth-profiles.json'), authProfilesJson, { spaces: 2 });
    }

    const execApprovalsConfig = {
      version: 1,
      defaults: { security: 'full', ask: 'off', askFallback: 'full' },
      agents: Object.fromEntries([
        ['main', { security: 'full', ask: 'off', askFallback: 'full', autoAllowSkills: true }],
        ...agentMetas.map((meta) => [meta.agentId, { security: 'full', ask: 'off', askFallback: 'full', autoAllowSkills: true }]),
      ]),
    };
    await fs.writeJson(path.join(rootClawDir, 'exec-approvals.json'), execApprovalsConfig, { spaces: 2 });

    const teamMdRoster = agentMetas.map((meta) => ({
      name: meta.name, desc: meta.desc, agentId: meta.agentId,
      accountId: meta.accountId, slashCmd: meta.slashCmd, persona: meta.persona,
    }));

    for (const meta of agentMetas) {
      const workspaceDir = path.join(rootClawDir, meta.workspaceDir);
      await fs.ensureDir(path.join(rootClawDir, 'agents', meta.agentId, 'agent'));
      const ownAliases = [meta.name, meta.slashCmd, `bot ${meta.idx + 1}`].filter(Boolean);
      const otherAgents = agentMetas
        .filter((peer) => peer.agentId !== meta.agentId)
        .map((peer) => ({ name: peer.name, agentId: peer.agentId }));

      // agentYaml & auth still needed, keep non-workspace writes here
      // .yaml removed — OpenClaw reads config exclusively from openclaw.json
      if (Object.keys(authProfilesJson).length > 0) {
        await fs.writeJson(path.join(rootClawDir, 'agents', meta.agentId, 'agent', 'auth-profiles.json'), authProfilesJson, { spaces: 2 });
      }

      // ── Workspace files via shared helper ────────────────────────────────
      await writeWorkspaceFiles({
        workspaceDir,
        isVi, botName: meta.name, botDesc: meta.desc, persona: meta.persona,
        selectedSkills, deployMode,
        isDesktop: hasBrowserDesktop, isServer: hasBrowserServer,
        isMultiBot: true, ownAliases, otherAgents,
        teamRoster: teamMdRoster, userInfo,
        agentWorkspaceDir: meta.workspaceDir,
        isRelayBot: true,
        replyToDirectMessages: true,
      });
    }
  } else {
  const numBotsToConfigure = 1;
  for (let bIndex = 0; bIndex < numBotsToConfigure; bIndex++) {
    const loopBotName = isMultiBot ? (bots[bIndex]?.name || `Bot ${bIndex+1}`) : botName;
    const loopBotDesc = isMultiBot ? (bots[bIndex]?.desc || '') : botDesc;
    const loopBotPersona = isMultiBot ? (bots[bIndex]?.persona || '') : botPersona;
    const loopBotToken = isMultiBot ? (bots[bIndex]?.token || '') : botToken;
    const teamRoster = bots.slice(0, numBotsToConfigure).map((peer, idx) => ({
      idx,
      name: peer?.name || `Bot ${idx + 1}`,
      desc: peer?.desc || (isVi ? 'Tro ly AI ca nhan' : 'Personal AI assistant'),
      persona: peer?.persona || '',
      slashCmd: peer?.slashCmd || '',
    }));
    const ownAliases = [loopBotName, bots[bIndex]?.slashCmd || '', `bot ${bIndex + 1}`].filter(Boolean);
    const otherBotNames = teamRoster.filter((peer) => peer.idx !== bIndex).map((peer) => peer.name);
    const loopAgentId = loopBotName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `bot${bIndex + 1}`;
    const loopWorkspaceDir = `workspace-${loopAgentId}`;
    const loopBotDir = isMultiBot ? path.join(projectDir, `bot${bIndex+1}`) : projectDir;
    
    await fs.ensureDir(path.join(loopBotDir, '.openclaw', 'agents', loopAgentId, 'agent'));
    if (Object.keys(authProfilesJson).length > 0) {
      await fs.writeJson(path.join(loopBotDir, '.openclaw', 'auth-profiles.json'), authProfilesJson, { spaces: 2 });
      await fs.writeJson(path.join(loopBotDir, '.openclaw', 'agents', loopAgentId, 'agent', 'auth-profiles.json'), authProfilesJson, { spaces: 2 });
    }


    const botConfig = {
      meta: { lastTouchedVersion: '2026.3.24' },
      agents: {
        defaults: {
          model: { primary: modelsPrimary, fallbacks: [] },
          compaction: { mode: 'safeguard' },
          timeoutSeconds: provider.isLocal ? 900 : 120,
          ...(provider.isLocal ? { llm: { idleTimeoutSeconds: 300 } } : {}),
        },
        list: [{
          id: loopAgentId,
          workspace: `.openclaw/${loopWorkspaceDir}`,
          agentDir: `agents/${loopAgentId}/agent`,
          model: { primary: modelsPrimary, fallbacks: [] }
        }]
      },
      ...(providerKey === '9router' ? {
        models: {
          mode: 'merge',
          providers: {
            '9router': build9RouterProviderConfig(get9RouterBaseUrl(deployMode))
          }
        }
      } : provider.isLocal ? {
        models: {
          mode: 'merge',
          providers: {
            ollama: {
              baseUrl: 'http://ollama:11434',
              api: 'ollama',
              apiKey: 'ollama-local',
              models: OLLAMA_MODELS
            }
          }
        }
      } : {}),
      commands: { native: 'auto', nativeSkills: 'auto', restart: true, ownerDisplay: 'raw' },
      channels: {},
      tools: { profile: 'full', exec: { host: 'gateway', security: 'full', ask: 'off' } },
      gateway: {
        port: 18791 + (isMultiBot ? bIndex : 0), mode: 'local', bind: 'custom', customBindHost: '0.0.0.0',
        controlUi: {
          allowedOrigins: getGatewayAllowedOrigins(18791 + (isMultiBot ? bIndex : 0)),
        },
        auth: { mode: 'token', token: 'cli-dummy-token-xyz123' }
      }
    };

    if (hasBrowserDesktop) {
      botConfig.browser = {
        enabled: true,
        defaultProfile: 'host-chrome',
        profiles: { 'host-chrome': { cdpUrl: 'http://127.0.0.1:9222', color: '#4285F4' } }
      };
    } else if (hasBrowserServer) {
      botConfig.browser = { enabled: true };
    }

    const skillEntries = {};
    SKILLS.forEach(s => {
      if (!selectedSkills.includes(s.value)) return;
      if (!s.slug) return;
      skillEntries[s.slug] = { enabled: true };
    });
    if (Object.keys(skillEntries).length > 0) {
      botConfig.skills = { entries: skillEntries };
    }

    if (channelKey === 'telegram') {
      const telegramConfig = {
        enabled: true,
        dmPolicy: 'open',
        allowFrom: ['*'],
        defaultAccount: 'default',
        replyToMode: 'first',
        reactionLevel: 'minimal',
        actions: {
          sendMessage: true,
          reactions: true,
        },
        accounts: {
          default: {
            botToken: loopBotToken || '<your_bot_token>',
          },
        },
      };
      if (isMultiBot) {
        telegramConfig.groupPolicy = groupId ? 'allowlist' : 'open';
        telegramConfig.groupAllowFrom = ['*'];
        telegramConfig.groups = {
          [groupId || '*']: { enabled: true, requireMention: false }
        };
      }
      botConfig.channels['telegram'] = telegramConfig;
    } else if (hasZaloPersonal(channelKey)) {
      botConfig.channels['zalouser'] = {
        enabled: true,
        defaultAccount: 'default',
        dmPolicy: 'open',
        allowFrom: ['*'],
        groupPolicy: 'allowlist',
        groupAllowFrom: ['*'],
        historyLimit: 50,
        autoReply: true,
      };
      // zalo-mod plugin — pre-integrated for Zalo Personal moderation
      botConfig.plugins = botConfig.plugins || {};
      botConfig.plugins.entries = botConfig.plugins.entries || {};
      botConfig.plugins.entries['zalo-mod'] = { enabled: true, config: {} };
    } else if (channelKey === 'zalo-bot') {
      botConfig.channels['zalo'] = { enabled: true, provider: 'official_account' };
    }

    await fs.writeJson(path.join(loopBotDir, '.openclaw', 'openclaw.json'), botConfig, { spaces: 2 });

    // ── Workspace files: use shared writeWorkspaceFiles() ──────────────────────
    const dockerWorkspaceDir = path.join(loopBotDir, '.openclaw', loopWorkspaceDir);
    const dockerOwnAliases = [loopBotName, bots[bIndex]?.slashCmd || '', `bot ${bIndex + 1}`].filter(Boolean);
    const dockerOtherAgents = teamRoster
      .filter((peer) => peer.idx !== bIndex)
      .map((peer) => ({ name: peer.name, agentId: peer.name.replace(/\s+/g, '-').toLowerCase() }));

    await writeWorkspaceFiles({
      workspaceDir: dockerWorkspaceDir,
      isVi,
      botName: loopBotName,
      botDesc: loopBotDesc,
      persona: loopBotPersona,
      selectedSkills,
      deployMode,
      isDesktop: hasBrowserDesktop,
      isServer: hasBrowserServer,
      isMultiBot,
      ownAliases: dockerOwnAliases,
      otherAgents: dockerOtherAgents,
      teamRoster,
      userInfo,
      agentWorkspaceDir: loopWorkspaceDir,
      isRelayBot: isMultiBot,
      replyToDirectMessages: true,
    });

    if (isMultiBot) {
      // Append per-bot reply rules to AGENTS.md
      const otherBotNames = teamRoster.filter((p) => p.idx !== bIndex).map((p) => p.name);
      const extraAgentsMd = isVi
        ? `\n\n## Khi nao nen tra loi\n- Neu metadata khong noi ro day la group/supergroup, mac dinh xem la chat rieng/DM va tra loi binh thuong.\n- Trong group, chi tra loi khi tin nhan co alias cua ban: ${dockerOwnAliases.map((a) => `\`${a}\``).join(', ')} hoac username Telegram cua ban.\n- Quy tac im lang khi tin nhan khong goi ban chi ap dung cho group chat, khong ap dung cho DM/chat rieng.\n- Neu group message chi goi ro bot khac ${otherBotNames.length ? otherBotNames.map((n) => `\`${n}\``).join(', ') : '`bot khac`'} thi khong cuop loi.\n- Trước MỖI phản hồi Telegram nhìn thấy bởi user, nếu turn hiện tại có tool/action reaction native thì ưu tiên dùng nó để thả \`👍\` trước, trừ khi \`👍\` đã có sẵn.\n- Khong duoc noi la minh da tha like neu turn hien tai chua goi duoc tool reaction hoac reaction khong hien that tren chat.\n- Khi can phoi hop noi bo, dung dung agent id ky thuat trong \`AGENTS.md\`, khong dung ten hien thi.\n- Khi hoi ve vai tro cac bot, dung \`AGENTS.md\` lam nguon su that.`
        : `\n\n## When To Reply\n- If metadata does not clearly say this is a group/supergroup, treat it as a private DM and reply normally.\n- In group chats, only reply when the message contains one of your aliases: ${dockerOwnAliases.map((a) => `\`${a}\``).join(', ')} or your Telegram username.\n- The stay-silent rule for messages not addressed to you applies only to group chats, never to DMs/private chats.\n- If a group message is clearly calling another bot such as ${otherBotNames.length ? otherBotNames.map((n) => `\`${n}\``).join(', ') : '`another bot`'}, do not hijack it.\n- Before EVERY user-visible Telegram reply, if the current turn exposes a native reaction tool/action, use it to add \`👍\` first unless \`👍\` is already present.\n- Never claim that you already reacted unless the current turn actually executed the reaction and it is visible on the chat.\n- When you need internal coordination, use the exact technical agent id from \`AGENTS.md\`, not the display name.\n- Use \`AGENTS.md\` as the source of truth for team roles.`;
      await fs.appendFile(path.join(dockerWorkspaceDir, 'AGENTS.md'), extraAgentsMd);
    }
  } // END FOR LOOP
  }

  // ── Chrome Debug scripts — via shared builder (same content as wizard ZIP) ─
  await writeGeneratedArtifacts(projectDir, buildCliChromeDebugArtifacts());

  // ── Uninstall scripts ───────────────────────────────────────────────────────
  await writeGeneratedArtifacts(projectDir, buildCliUninstallArtifacts({
    deployMode,
    osChoice: detectedOS,
    projectDir,
    botName: (deployMode !== 'docker' && detectedOS === 'vps')
      ? getNativePm2AppName(isMultiBot)
      : botName,
  }));

  // ── Upgrade scripts ─────────────────────────────────────────────────────────
  await writeGeneratedArtifacts(projectDir, buildCliUpgradeArtifacts());

  // ── start-bot.bat / start-bot.sh — one-click restart scripts ─────────────
  // Generated for native deployments only (docker has docker compose up)
  if (deployMode !== 'docker') {
    await writeGeneratedArtifacts(projectDir, buildCliStartBotArtifacts({
      projectDir,
      openclawHome: path.join(projectDir, '.openclaw'),
      is9Router: providerKey === '9router',
      osChoice,
      isMultiBot,
      appName: getNativePm2AppName(isMultiBot),
      isVi,
    }));

    console.log(chalk.cyan(
      process.platform === 'win32'
        ? (isVi
          ? `\n🚀 start-bot.bat / start-bot.sh đã tạo — double-click để restart bot.`
          : `\n🚀 start-bot.bat / start-bot.sh created — double-click to restart the bot.`)
        : (isVi
          ? `\n🚀 start-bot.sh đã tạo — chạy ./start-bot.sh để restart bot.`
          : `\n🚀 start-bot.sh created — run ./start-bot.sh to restart the bot.`)
    ));
  }

  console.log(chalk.green(`✅ ${isVi ? 'Tạo cấu hình thành công!' : 'Configs created successfully!'}`));

  installLatestOpenClaw({ isVi, osChoice });
  
  // 7. Auto Run
  const autoRun = deployMode === 'docker' ? await confirm({
    message: isVi ? 'Bạn có muốn tự động build Docker và khởi động Bot luôn không?' : 'Do you want to run Docker compose and start the bot now?',
    default: true
  }) : false;

  if (deployMode === 'docker' && autoRun) {
    console.log(chalk.yellow(`\n🐳 ${isVi ? 'Đang khởi động Docker (có thể mất vài phút)...' : 'Starting Docker (might take a few minutes)...'}`));
    const dockerPath = path.join(projectDir, 'docker', 'openclaw');
    
    // Auto-detect Docker Compose V2 (plugin) vs V1 (standalone docker-compose).
    // On Ubuntu 24.04 installed via `apt install docker.io`, the Compose V2 plugin
    // is NOT included — `docker compose` subcommand may not exist or may be broken.
    // We test both and use whichever actually works.
    let composeCmd, composeArgs;
    const detectCompose = () => {
      // Test V2 plugin: 'docker compose up --help' exits 0 if plugin works
      try {
        execSync('docker compose up --help', { stdio: 'ignore' });
        return { cmd: 'docker', args: ['compose', 'up', '--detach', '--build'] };
      } catch { /* V2 not available or broken */ }
      // Test V1 standalone: 'docker-compose up --help'
      try {
        execSync('docker-compose up --help', { stdio: 'ignore' });
        return { cmd: 'docker-compose', args: ['up', '--detach', '--build'] };
      } catch { /* V1 also not available */ }
      return null;
    };
    const detected = detectCompose();
    if (!detected) {
      console.log(chalk.red(isVi
        ? '\n❌ Không tìm thấy Docker Compose!\n   Cài bằng lệnh: sudo apt-get install docker-compose-plugin'
        : '\n❌ Docker Compose not found!\n   Install: sudo apt-get install docker-compose-plugin'));
      process.exit(1);
    }
    composeCmd = detected.cmd;
    composeArgs = detected.args;

    const child = spawn(composeCmd, composeArgs, {
      cwd: dockerPath,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`\n🎉 ${isVi ? 'Setup hoàn tất! Bot đang chạy.' : 'Setup complete! Bot is running.'}`));
        
        if (providerKey === '9router') {
          console.log(chalk.yellow(`\n🔀 ${isVi
            ? '9Router Dashboard: http://localhost:20128/dashboard'
            : '9Router Dashboard: http://localhost:20128/dashboard'}`));
          console.log(chalk.gray(isVi
            ? '   → Mở dashboard → đăng nhập OAuth để kết nối các Provider (iFlow, Gemini CLI, Claude Code...)'
            : '   → Open dashboard → OAuth login to connect Providers (iFlow, Gemini CLI, Claude Code...)'));
          console.log(chalk.gray(isVi
            ? '   → Sau khi kết nối provider, bot sẽ tự động hoạt động qua combo "smart-route"'
            : '   → After connecting providers, bot works automatically via "smart-route" combo'));
        }
        
        if (channelKey === 'telegram') {
          console.log(chalk.cyan(`\n💬 ${isVi
            ? 'Nhắn tin cho bot trên Telegram là dùng được ngay!'
            : 'Just message your bot on Telegram to start chatting!'}`));
          if (isMultiBot) {
            console.log(chalk.yellow(`\n${isVi ? '📋 Đọc hướng dẫn setup bot trong Group:' : '📋 Read setup guide in Group:'} ${TELEGRAM_SETUP_GUIDE_FILENAME}`));
            console.log(chalk.gray(isVi
              ? '   → Chạy scripts/telegram-post-install-check.mjs để lấy link thật, kiểm tra group/privacy, rồi mới add bot và Disable privacy mode.'
              : '   → Run scripts/telegram-post-install-check.mjs to get the real links, verify group/privacy, then add the bots and disable privacy mode.'));
          }
        } else if (channelKey === 'zalo-personal') {
          printZaloPersonalLoginInfo({ isVi, deployMode: 'docker', projectDir });
        }
      } else {
        console.log(chalk.red(`\n❌ Docker exited with code ${code}`));
        console.log(chalk.yellow(isVi
          ? `\n💡 Nếu lỗi "unknown shorthand flag", chạy: sudo apt-get install docker-compose-plugin\n   Rồi thử lại: cd ${dockerPath} && docker compose up -d --build`
          : `\n💡 If "unknown shorthand flag" error, run: sudo apt-get install docker-compose-plugin\n   Then retry: cd ${dockerPath} && docker compose up -d --build`));
      }
    });

  }
  if (deployMode === 'docker') {

    // ── Auto-install openclaw binary if not present ──────────────────────────
    const isOpenClawInstalled = () => { try { execSync('openclaw --version', { stdio: 'ignore' }); return true; } catch { return false; } };
    if (!isOpenClawInstalled()) {
      console.log(chalk.cyan(isVi
        ? `\n📦 Đang cài openclaw binary (${OPENCLAW_NPM_SPEC})...`
        : `\n📦 Installing openclaw binary (${OPENCLAW_NPM_SPEC})...`));
      try {
        execSync(`npm install -g ${OPENCLAW_NPM_SPEC}`, { stdio: 'inherit' });
        console.log(chalk.green(isVi ? '✅ openclaw đã cài xong!' : '✅ openclaw installed!'));
      } catch {
        console.log(chalk.yellow(isVi
          ? `⚠️  Không tự cài được. Chạy thủ công: sudo npm install -g ${OPENCLAW_NPM_SPEC}`
          : `⚠️  Could not auto-install. Run manually: sudo npm install -g ${OPENCLAW_NPM_SPEC}`));
      }
    }

    if (isMultiBot && channelKey === 'telegram') {
      console.log(chalk.yellow(`\n${isVi ? '📋 Xem hướng dẫn sau cài:' : '📋 Read post-install guide:'} ${path.join(projectDir, TELEGRAM_SETUP_GUIDE_FILENAME)}`));
    }
  } else {
    if (!isOpenClawInstalled()) {
      console.log(chalk.cyan(isVi
        ? `\n📦 Dang cai openclaw binary (${OPENCLAW_NPM_SPEC})...`
        : `\n📦 Installing openclaw binary (${OPENCLAW_NPM_SPEC})...`));
      if (!installGlobalPackage(OPENCLAW_NPM_SPEC, { isVi, osChoice, displayName: 'openclaw' })) {
        process.exit(1);
      }
      console.log(chalk.green(isVi ? '✅ openclaw da cai xong!' : '✅ openclaw installed!'));
    }

    if (providerKey === '9router') {
      if (shouldReuseInstalledGlobals() && is9RouterInstalled()) {
        console.log(chalk.green(isVi
          ? '\n♻️ Dang dung lai 9Router da cai san de test nhanh.'
          : '\n♻️ Reusing the installed 9Router for a faster test run.'));
      } else if (!is9RouterInstalled()) {
        console.log(chalk.cyan(isVi
          ? '\n📦 Dang cai 9Router binary (npm install -g 9router)...'
          : '\n📦 Installing 9Router binary (npm install -g 9router)...'));
        if (!installGlobalPackage('9router@latest', { isVi, osChoice, displayName: '9Router' })) {
          process.exit(1);
        }
        console.log(chalk.green(isVi ? '✅ 9Router da cai xong!' : '✅ 9Router installed!'));
      }
    }

    let native9RouterSyncScriptPath = null;
    if (providerKey === '9router') {
      await writeNative9RouterPatchScript(projectDir);
      native9RouterSyncScriptPath = await writeNative9RouterSyncScript(projectDir);
      try {
        execFileSync(process.execPath, [path.join(projectDir, '.openclaw', 'patch-9router.js')], {
          cwd: projectDir,
          stdio: 'ignore',
        });
      } catch {
        // Start scripts retry this patch before launching 9router.
      }
    }

    await ensureProjectRuntimeDirs(projectDir, isVi);

    if (isMultiBot && channelKey === 'telegram') {
      installRelayPluginForProject(projectDir, isVi);
    }

    if (osChoice === 'vps') {
      if (!isPm2Installed()) {
        console.log(chalk.cyan(isVi ? '\n📦 Dang cai PM2...' : '\n📦 Installing PM2...'));
        if (!installGlobalPackage('pm2@latest', { isVi, osChoice, displayName: 'PM2' })) {
          process.exit(1);
        }
      }

      if (isMultiBot && channelKey === 'telegram') {
        if (providerKey === '9router') {
          startNative9RouterPm2({ isVi, projectDir, appName: getNativePm2AppName(true), syncScriptPath: native9RouterSyncScriptPath });
        }
        execSync('pm2 start ecosystem.config.js && pm2 save', {
          cwd: projectDir,
          stdio: 'inherit',
          shell: true
        });
        console.log(chalk.green(`\n🎉 ${isVi ? 'Setup hoan tat! Multi-bot native dang chay qua PM2.' : 'Setup complete! Native multi-bot is running via PM2.'}`));
        console.log(chalk.gray(isVi ? `   Xem log: pm2 logs ${getNativePm2AppName(true)}` : `   View logs: pm2 logs ${getNativePm2AppName(true)}`));
        printNativeDashboardAccessInfo({ isVi, providerKey, projectDir });
        if (channelKey === 'zalo-personal') {
          printZaloPersonalLoginInfo({ isVi, deployMode: 'native', projectDir });
        }
      } else {
        const appName = getNativePm2AppName(false);
        if (providerKey === '9router') {
          startNative9RouterPm2({ isVi, projectDir, appName, syncScriptPath: native9RouterSyncScriptPath });
        }
        if (channelKey === 'zalo-personal') {
          await runNativeZaloPersonalLoginFlow({ isVi, projectDir });
        }
        execFileSync('pm2', [
          'start',
          'openclaw',
          '--name',
          appName,
          '--cwd',
          projectDir.replace(/\\/g, '/'),
          '--',
          'gateway',
          'run'
        ], {
          cwd: projectDir,
          stdio: 'inherit',
          env: getProjectRuntimeEnv(projectDir)
        });
        runPm2Save({ projectDir, isVi });
        console.log(chalk.green(`\n🎉 ${isVi ? 'Setup hoan tat! Bot native dang chay qua PM2.' : 'Setup complete! Native bot is running via PM2.'}`));
        console.log(chalk.gray(isVi ? `   Xem log: pm2 logs ${appName}` : `   View logs: pm2 logs ${appName}`));
        printNativeDashboardAccessInfo({ isVi, providerKey, projectDir });
        if (channelKey === 'zalo-personal') {
          printZaloPersonalLoginInfo({ isVi, deployMode: 'native', projectDir });
        }
      }
    } else {
      if (providerKey === '9router') {
        console.log(chalk.yellow(`\n${isVi ? 'Khoi dong 9Router native (background)...' : 'Starting native 9Router (background)...'}`));
        const native9RouterLaunch = resolveNative9RouterDesktopLaunch();
        spawnBackgroundProcess(native9RouterLaunch.command, native9RouterLaunch.args, {
          cwd: projectDir,
          env: getProjectRuntimeEnv(projectDir, native9RouterLaunch.env)
        }).unref();
        const routerHealth = await waitFor9RouterApiReady();
        if (native9RouterSyncScriptPath) {
          spawnBackgroundProcess(process.execPath, [native9RouterSyncScriptPath], {
            cwd: projectDir
          }).unref();
        }
        console.log(chalk.gray(isVi
          ? '   9Router dashboard: http://localhost:20128/dashboard'
          : '   9Router dashboard: http://localhost:20128/dashboard'));
        if (!routerHealth.ok) {
          console.log(chalk.yellow(isVi
            ? `   ⚠️  9Router da mo cong 20128 nhung admin API chua san sang. Kiem tra them: ${routerHealth.url}`
            : `   ⚠️  9Router opened port 20128 but the admin API is not ready yet. Check: ${routerHealth.url}`));
        }
      }
      if (hasZaloPersonal(channelKey)) {
        await runNativeZaloPersonalLoginFlow({ isVi, projectDir });
      }
      console.log(chalk.yellow(`\n${isVi ? 'Khoi dong native bot (foreground)...' : 'Starting native bot (foreground)...'}`));
      const isZaloPersonal = hasZaloPersonal(channelKey);
      const child = spawn('openclaw', ['gateway', 'run'], {
        cwd: projectDir,
        stdio: isZaloPersonal ? ['inherit', 'pipe', 'pipe'] : 'inherit',
        shell: process.platform === 'win32'
      });
      if (isZaloPersonal) {
        let approvedPairingCode = null;
        const onGatewayChunk = (chunk, target) => {
          const text = chunk.toString();
          target.write(text);
          const pairingCode = extractZaloPairingCode(text);
          if (pairingCode && pairingCode !== approvedPairingCode) {
            if (approveZaloPairingCode({ pairingCode, projectDir, isVi })) {
              approvedPairingCode = pairingCode;
            }
          }
        };
        child.stdout?.on('data', (chunk) => onGatewayChunk(chunk, process.stdout));
        child.stderr?.on('data', (chunk) => onGatewayChunk(chunk, process.stderr));
      }
      child.on('close', (code) => process.exit(code ?? 0));
      return;
    }

    console.log(chalk.cyan(`\n👉 ${isVi ? 'Native runtime da duoc cai san va khoi dong.' : 'Native runtime is installed and started.'}`));
    if (isMultiBot && channelKey === 'telegram') {
      console.log(chalk.yellow(`\n📋 ${isVi ? 'Xem huong dan sau cai:' : 'Read post-install guide:'} ${path.join(projectDir, TELEGRAM_SETUP_GUIDE_FILENAME)}`));
    }
  }
}



main().catch(err => {
  console.error(chalk.red('Error:'), err);
  process.exit(1);
});

