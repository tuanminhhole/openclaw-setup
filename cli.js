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
const {
  OPENCLAW_NPM_SPEC,
  OPENCLAW_RUNTIME_PACKAGES,
  TELEGRAM_RELAY_PLUGIN_SPEC,
  buildRelayPluginInstallCommand,
  buildRelayPluginInstallCommandWin,
  buildTelegramPostInstallChecklist,
  buildAuthProfilesString,
  buildAuthProfilesJson,
} = _require('./setup/shared/common-gen.js');

const {
  build9RouterSmartRouteSyncScript: build9RouterSmartRouteSyncScriptShared,
  build9RouterComposeEntrypointScript,
  buildGatewayPatchCmd,
  indentBlock,
  buildDockerArtifacts,
  encodeBase64Utf8,
} = _require('./setup/shared/docker-gen.js');

const {
  buildIdentityDoc,
  buildSoulDoc,
  buildTeamDoc,
  buildUserDoc,
  buildMemoryDoc,
  buildBrowserToolJs,
  buildBrowserDoc,
  buildSecurityRules,
  buildAgentsDoc,
  buildToolsDoc,
  buildRelayDoc,
} = _require('./setup/shared/scaffold-gen.js');

const {
  PROVIDERS: _PROVIDERS,
  SKILLS: _SKILLS,
  CHANNELS: _CHANNELS,
  OLLAMA_MODELS,
} = _require('../setup/data/index.js');

const {
  buildChromeDebugBat,
  buildChromeDebugSh,
} = _require('./setup/shared/runtime-gen.js');

/**
 * Pure uninstall script generator for CLI (no DOM dependency).
 * @param {{os:'win'|'linux'|'linux-desktop', projectDir:string, botName:string, isDocker?:boolean}} opts
 * @returns {{name:string, content:string}|null}
 */
function buildCLIUninstallScript({ os, projectDir, botName = 'openclaw', isDocker = false }) {
  const absWin = projectDir.replace(/\//g, '\\');
  const absUnix = projectDir.replace(/\\/g, '/');
  if (os === 'win' && !isDocker) {
    return {
      name: 'uninstall-openclaw-win.bat',
      content: `@echo off\r\nsetlocal EnableExtensions\r\nchcp 65001 >nul\r\necho.\r\necho ============================================================\r\necho   OpenClaw Uninstaller - Windows Native\r\necho   Project: ${absWin}\r\necho ============================================================\r\necho.\r\necho [WARNING] This will:\r\necho   1. Kill openclaw and 9router background processes\r\necho   2. Uninstall global npm packages (openclaw, 9router)\r\necho   3. Delete the project folder and all its data\r\necho.\r\nset /p CONFIRM=Nhap YES de xac nhan xoa toan bo: \r\nif /i not "%CONFIRM%"=="YES" (\r\n  echo Huy bo. Khong xoa gi ca.\r\n  pause\r\n  exit /b 0\r\n)\r\necho.\r\necho [1/4] Dang dung cac tien trinh openclaw va 9router...\r\nwmic process where "Name='node.exe' and CommandLine like '%%9router%%'" delete >nul 2>&1\r\nwmic process where "Name='cmd.exe' and CommandLine like '%%9router%%'" delete >nul 2>&1\r\nwmic process where "Name='node.exe' and CommandLine like '%%openclaw.mjs%%'" delete >nul 2>&1\r\ntimeout /t 2 /nobreak >nul\r\necho    OK: Tien trinh da dung.\r\necho.\r\necho [2/4] Dang go cai npm packages toan cau...\r\nset "PATH=%APPDATA%\\npm;%PATH%"\r\ncall npm uninstall -g openclaw 9router grammy @grammyjs/runner @grammyjs/transformer-throttler @buape/carbon @larksuiteoapi/node-sdk @slack/web-api 2>nul\r\necho    OK: npm packages da duoc go cai.\r\necho.\r\necho [3/4] Xoa thu muc project...\r\nset "TARGET=${absWin}"\r\nif exist "%TARGET%" (\r\n  rd /s /q "%TARGET%"\r\n  echo    OK: Da xoa %TARGET%\r\n) else (\r\n  echo    INFO: Thu muc khong ton tai: %TARGET%\r\n)\r\necho.\r\necho [4/4] Xoa thu muc .9router trong Home (neu co)...\r\nif exist "%USERPROFILE%\\.9router" (\r\n  set /p CLEAN_HOME=Xoa ca %USERPROFILE%\\.9router? [YES/no]: \r\n  if /i "%CLEAN_HOME%"=="YES" rd /s /q "%USERPROFILE%\\.9router" >nul 2>&1\r\n)\r\necho.\r\necho ============================================================\r\necho   Go cai hoan tat!\r\necho   De cai lai: chay lai file setup hoac npx create-openclaw-bot\r\necho ============================================================\r\npause\r\nendlocal\r\n`,
    };
  }
  if (os === 'win' && isDocker) {
    return {
      name: 'uninstall-openclaw-docker.bat',
      content: `@echo off\r\nsetlocal EnableExtensions\r\nchcp 65001 >nul\r\necho.\r\necho ============================================================\r\necho   OpenClaw Uninstaller - Docker (Windows)\r\necho   Project: ${absWin}\r\necho ============================================================\r\necho.\r\nset /p CONFIRM=Nhap YES de xac nhan xoa toan bo: \r\nif /i not "%CONFIRM%"=="YES" ( echo Huy bo. & pause & exit /b 0 )\r\necho.\r\necho [1/2] Dang dung Docker containers...\r\ncd /d "${absWin}\\docker\\openclaw" 2>nul && ( docker compose down --volumes --remove-orphans 2>nul || docker-compose down --volumes --remove-orphans 2>nul )\r\necho [2/2] Xoa thu muc project...\r\ncd /d "%USERPROFILE%"\r\nif exist "${absWin}" rd /s /q "${absWin}"\r\necho.\r\necho Go cai hoan tat! De cai lai: npx create-openclaw-bot@latest\r\npause\r\nendlocal\r\n`,
    };
  }
  // macOS / Linux
  const label = os === 'linux' ? 'macOS' : 'Linux Desktop';
  const scriptName = isDocker ? 'uninstall-openclaw-docker.sh' : 'uninstall-openclaw.sh';
  if (!isDocker) {
    return {
      name: scriptName,
      content: `#!/usr/bin/env bash\n# ====== OpenClaw Uninstaller — ${label} (Native) ======\nset -e\nPROJECT_DIR="${absUnix}"\necho ""\necho "============================================================"\necho "  OpenClaw Uninstaller — ${label} Native"\necho "  Project: $PROJECT_DIR"\necho "============================================================"\necho ""\nread -rp "Type YES to confirm full removal: " CONFIRM\nif [ "$CONFIRM" != "YES" ]; then echo "Cancelled."; exit 0; fi\necho "[1/4] Stopping openclaw and 9router..."\nopenclaw gateway stop 2>/dev/null || true\npkill -f "9router" 2>/dev/null || true\nfor port in 18791 20128; do\n  pid=$(lsof -ti tcp:$port 2>/dev/null || true)\n  [ -n "$pid" ] && kill -9 $pid 2>/dev/null || true\ndone\necho "[2/4] Uninstalling npm packages..."\nnpm uninstall -g openclaw 9router grammy @grammyjs/runner @grammyjs/transformer-throttler @buape/carbon @larksuiteoapi/node-sdk @slack/web-api 2>/dev/null || true\nsudo npm uninstall -g openclaw 9router 2>/dev/null || true\necho "[3/4] Removing project directory..."\n[ -d "$PROJECT_DIR" ] && rm -rf "$PROJECT_DIR" && echo "   OK: Deleted $PROJECT_DIR" || echo "   INFO: Not found."\necho "[4/4] Checking home-level dirs..."\nfor dir in "$HOME/.9router" "$HOME/.openclaw"; do\n  if [ -d "$dir" ]; then\n    read -rp "Delete $dir? [YES/no]: " CLEAN\n    [ "$CLEAN" = "YES" ] && rm -rf "$dir" && echo "   OK." || echo "   Kept."\n  fi\ndone\necho ""\necho "============================================================"\necho "  Uninstall complete! Re-install: run setup or npx create-openclaw-bot"\necho "============================================================"\n`,
    };
  }
  return {
    name: scriptName,
    content: `#!/usr/bin/env bash\n# ====== OpenClaw Uninstaller — Docker ======\nset -e\nPROJECT_DIR="${absUnix}"\nread -rp "Type YES to confirm: " CONFIRM\n[ "$CONFIRM" = "YES" ] || exit 0\ncd "$PROJECT_DIR/docker/openclaw" 2>/dev/null && docker compose down --volumes --remove-orphans 2>/dev/null || true\nrm -rf "$PROJECT_DIR"\necho "Uninstall complete!"\n`,
  };
}

// TELEGRAM_RELAY_PLUGIN_SPEC đã được import từ common-gen
const TELEGRAM_RELAY_PLUGIN_ID = TELEGRAM_RELAY_PLUGIN_SPEC;

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
      HOSTNAME: '0.0.0.0'
    }
  };
}

function build9RouterSmartRouteSyncScript(dbPath) {
  const safeDbPath = JSON.stringify(dbPath);
  return `function bootstrap() {
  const fs = require('fs');
  const path = require('path');
  const safeDbPath = JSON.stringify(dbPath);
  const dbPath = ${safeDbPath};
  const ROUTER='http://localhost:20128';
  const MODEL_PRIORITY = {
    openai: ['openai/gpt-4o', 'openai/gpt-4.1'],
    anthropic: ['anthropic/claude-sonnet-4', 'anthropic/claude-haiku-3.5'],
    gemini: ['gemini/gemini-2.5-flash', 'gemini/gemini-2.5-pro'],
  };
  const sync = async () => {
    try {
      const response = await fetch(ROUTER + '/api/providers');
      if (!response.ok) return;
      const payload = await response.json();
      const a = (payload.connections || [])
        .filter((item) => item && item.provider && item.isActive !== false && !item.disabled)
        .map((item) => item.provider);
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
    ? '\n📦 Dang cai/cap nhat openclaw@latest...'
    : '\n📦 Installing/updating openclaw@latest...'));

  if (!installGlobalPackage(OPENCLAW_NPM_SPEC, { isVi, osChoice, displayName: 'openclaw' })) {
    process.exit(1);
  }

  console.log(chalk.green(isVi
    ? '✅ openclaw da duoc cap nhat ban moi nhat!'
    : '✅ openclaw is now on the latest version!'));
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
  await fs.ensureDir(getProject9RouterDataDir(projectDir));
  await fs.writeFile(syncScriptPath, build9RouterSmartRouteSyncScript(path.join(getProject9RouterDataDir(projectDir), 'db.json')));
  return syncScriptPath;
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

function startNative9RouterPm2({ isVi, projectDir, appName, syncScriptPath }) {
  const routerAppName = `${appName}-9router`;
  const routerLaunch = resolveNative9RouterDesktopLaunch();
  const normalizedProjectDir = projectDir.replace(/\\/g, '/');
  const normalizedSyncScriptPath = syncScriptPath ? syncScriptPath.replace(/\\/g, '/') : '';
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
    const syncAppName = `${appName}-9router-sync`;
    execFileSync('pm2', [
      'start',
      'sh',
      '--name',
      syncAppName,
      '--cwd',
      normalizedProjectDir,
      '--',
      '-c',
      `nohup "${process.execPath}" "${normalizedSyncScriptPath}" >/tmp/${syncAppName}.log 2>&1 &`
    ], {
      cwd: projectDir,
      stdio: 'inherit',
      env: process.env
    });
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

  const workspacePath = `/root/.openclaw/${agentWorkspaceDir}/`;

  const identityMd = buildIdentityDoc({ isVi, name: botName, desc: botDesc, richAiNote: false });
  const soulMd = buildSoulDoc({ isVi, persona, variant: isRelayBot ? 'cli-simple' : 'cli-rich' });
  const userMd = buildUserDoc({ isVi, userInfo, variant: isRelayBot ? 'cli-multi' : 'cli-single' });
  const memoryMd = buildMemoryDoc({ isVi, variant: isRelayBot ? 'cli-multi' : 'cli-single' });
  const agentsMd = buildAgentsDoc({
    isVi, botName, botDesc, ownAliases, otherAgents,
    workspacePath,
    variant: isRelayBot ? 'relay' : 'single',
    includeSecurity: !isRelayBot,
  });
  const toolsMd = buildToolsDoc({
    isVi, skillListStr, workspacePath,
    variant: isRelayBot ? 'relay' : 'single',
    agentWorkspaceDir,
  });
  const teamSection = teamRoster.length > 0
    ? `\n\n${buildTeamDoc({
      isVi,
      teamRoster,
      includeAgentIds: isRelayBot,
      includeAccountIds: isRelayBot && teamRoster.some((p) => p.accountId),
      relayMode: isRelayBot && otherAgents.length > 0,
    })}`
    : '';
  const relaySection = isRelayBot
    ? `\n\n${buildRelayDoc(isVi)}`
    : '';

  await fs.ensureDir(workspaceDir);
  await fs.writeFile(path.join(workspaceDir, 'IDENTITY.md'), identityMd);
  await fs.writeFile(path.join(workspaceDir, 'SOUL.md'), soulMd);
  await fs.writeFile(path.join(workspaceDir, 'AGENTS.md'), `${agentsMd}${teamSection}`);
  await fs.writeFile(path.join(workspaceDir, 'USER.md'), userMd);
  await fs.writeFile(path.join(workspaceDir, 'TOOLS.md'), `${toolsMd}${relaySection}`);
  await fs.writeFile(path.join(workspaceDir, 'MEMORY.md'), memoryMd);

  // Browser files
  if (isDesktop) {
    await fs.writeFile(path.join(workspaceDir, 'browser-tool.js'), buildBrowserToolJs('cli'));
    await fs.writeFile(path.join(workspaceDir, 'BROWSER.md'), buildBrowserDoc({ isVi, variant: 'cli-desktop', workspaceRoot: '/root/.openclaw' }));
  } else if (isServer) {
    await fs.writeFile(path.join(workspaceDir, 'BROWSER.md'), buildBrowserDoc({ isVi, variant: 'cli-server' }));
  }
}


async function main() {
  console.log(chalk.red('\n=================================='));
  console.log(chalk.redBright(LOGO));
  console.log(chalk.greenBright('     OpenClaw Auto Setup CLI     '));
  console.log(chalk.red('==================================\n'));

  // 1. Language
  const lang = await select({
    message: 'Select language / Chọn ngôn ngữ:',
    choices: [
      { name: 'Tiếng Việt', value: 'vi' },
      { name: 'English', value: 'en' }
    ]
  });
  const isVi = lang === 'vi';

  // 1b. OS Selection
  const detectedPlatform = process.platform; // 'win32' | 'darwin' | 'linux'
  const detectedOS = detectedPlatform === 'win32' ? 'windows'
    : detectedPlatform === 'darwin' ? 'macos'
    : 'linux';

  const osChoice = await select({
    message: isVi ? 'Bạn đang chạy trên hệ điều hành nào?' : 'What OS are you running on?',
    choices: [
      { name: isVi ? '🪟 Windows'                    : '🪟 Windows',                    value: 'windows' },
      { name: isVi ? '🍎 macOS'                      : '🍎 macOS',                      value: 'macos' },
      { name: isVi ? '🐧 Ubuntu Desktop'             : '🐧 Ubuntu Desktop',             value: 'ubuntu' },
      { name: isVi ? '🖥️  VPS / Ubuntu Server'       : '🖥️  VPS / Ubuntu Server',       value: 'vps' },
    ],
    default: detectedOS === 'linux' ? 'vps' : detectedOS
  });

  // 1c. Deploy mode — Ubuntu/VPS default native, Windows/macOS default docker
  // User always gets to choose; if they pick Docker and it's missing we auto-install
  const deployModeDefault = (osChoice === 'ubuntu' || osChoice === 'vps') ? 'native' : 'docker';
  let deployMode = await select({
    message: isVi ? 'Chọn cách chạy bot:' : 'How do you want to run the bot?',
    choices: [
      {
        name: isVi
          ? '🐳 Docker (Khuyên dùng cho Windows / macOS — dễ cài, chạy ngay)'
          : '🐳 Docker (Recommended for Windows / macOS — easy setup, runs immediately)',
        value: 'docker'
      },
      {
        name: isVi
          ? '⚡ Native / PM2 (Khuyên dùng cho Ubuntu / VPS — ít RAM, ổn định hơn)'
          : '⚡ Native / PM2 (Recommended for Ubuntu / VPS — less RAM, more stable)',
        value: 'native'
      }
    ],
    default: deployModeDefault
  });

  // 1d. Docker selected → auto-install Engine + Compose v2 plugin if not present (no extra prompts)
  if (deployMode === 'docker' && !isDockerInstalled()) {
    console.log(chalk.cyan(isVi
      ? '\n🐳 Docker chưa được cài — đang tự động cài Docker Engine + Compose plugin...'
      : '\n🐳 Docker not found — auto-installing Docker Engine + Compose plugin...'));
    try {
      const platform = process.platform;
      if (platform === 'win32') {
        execSync('winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements', { stdio: 'inherit' });
        console.log(chalk.green(isVi
          ? '✅ Docker Desktop đã cài xong. Vui lòng mở Docker Desktop, đợi khởi động (icon tray chuyển xanh) rồi chạy lại lệnh này.'
          : '✅ Docker Desktop installed. Open Docker Desktop, wait for it to start (tray icon turns green), then re-run this command.'));
        process.exit(0);
      } else if (platform === 'darwin') {
        execSync('brew install --cask docker', { stdio: 'inherit' });
        console.log(chalk.green(isVi
          ? '✅ Docker Desktop cài xong qua Homebrew. Mở Docker Desktop, đợi khởi động rồi chạy lại lệnh này.'
          : '✅ Docker Desktop installed via Homebrew. Open Docker Desktop, wait for it to start, then re-run this command.'));
        process.exit(0);
      } else {
        // Linux — Docker Engine + Compose v2 plugin
        execSync('curl -fsSL https://get.docker.com | sh', { stdio: 'inherit', shell: true });
        try { execSync('apt-get install -y docker-compose-plugin', { stdio: 'ignore', shell: true }); } catch { /* best-effort */ }
        console.log(chalk.green(isVi
          ? '✅ Docker Engine + Compose plugin đã cài xong.'
          : '✅ Docker Engine + Compose plugin installed.'));
      }
    } catch {
      console.log(chalk.red(isVi
        ? '❌ Không thể tự cài Docker. Tải thủ công: https://www.docker.com/products/docker-desktop/'
        : '❌ Could not auto-install Docker. Download manually: https://www.docker.com/products/docker-desktop/'));
      process.exit(1);
    }
  }


  // 2. Channel
  const channelKey = await select({
    message: isVi ? 'Chọn nền tảng bot:' : 'Select bot platform:',
    choices: Object.entries(CHANNELS).map(([k, v]) => ({ name: `${v.icon} ${v.name}`, value: k }))
  });
  const channel = CHANNELS[channelKey];
  
  if (channelKey === 'zalo-bot') {
    console.log(chalk.yellow(`\n⚠️  ${isVi ? 'LƯU Ý: Zalo OA Bot yêu cầu phải thiết lập Webhook Public (qua VPS/ngrok có HTTPS). Hãy dùng Zalo Personal nếu bạn chưa có Webhook.' : 'NOTE: Zalo OA requires a Public Webhook (via VPS/ngrok with HTTPS). Use Zalo Personal if you do not have one.'}`));
  }

  // ── Multi-bot: only Telegram supports multiple bots for now ──────────────
  let botToken = '';        // single-bot compat
  let botCount = 1;         // total bots
  let bots = [];            // [{name, slashCmd, token}]
  let groupId = '';

  if (channelKey === 'telegram') {
    botCount = parseInt(await select({
      message: isVi ? 'Bạn muốn cài bao nhiêu Telegram bot?' : 'How many Telegram bots do you want to deploy?',
      choices: [
        { name: '1 bot (single)', value: '1' },
        { name: '2 bots (Department Room)', value: '2' },
        { name: '3 bots', value: '3' },
        { name: '4 bots', value: '4' },
        { name: '5 bots', value: '5' },
      ],
      default: '1'
    }), 10);

    if (botCount > 1) {
      // Ask if user already has a group or will create later
      const groupOption = await select({
        message: isVi ? 'Bạn có sẵn Telegram Group chưa?' : 'Do you already have a Telegram Group?',
        choices: [
          { name: isVi ? '✨  Tôi sẽ tạo sau (nhập Group ID vào .env sau khi setup)' : '✨  I\'ll create later (add Group ID to .env after setup)', value: 'create' },
          { name: isVi ? '🔗  Đã có group — nhập Group ID ngay' : '🔗  Already have a group — enter Group ID now', value: 'existing' }
        ],
        default: 'create'
      });

      if (groupOption === 'existing') {
        console.log(chalk.dim(isVi
          ? '\n  📌 Cách lấy Group ID:\n     1. Mở Telegram → tìm @userinfobot\n     2. Bấm Start để bắt đầu → chọn nút "Group" trên màn hình → chọn Group bạn muốn thêm bot vào\n     3. Bot sẽ trả về "Chat ID" — đó là Group ID (bắt đầu bằng -100)\n     👉 https://t.me/userinfobot\n'
          : '\n  📌 How to get Group ID:\n     1. Open Telegram → find @userinfobot\n     2. Click Start → select "Group" button on the screen → select the group you want to add the bot to\n     3. The bot replies with "Chat ID" — that is your Group ID (starts with -100)\n     👉 https://t.me/userinfobot\n'));
        groupId = await input({
          message: isVi ? 'Telegram Group ID (VD: -1001234567890):' : 'Telegram Group ID (e.g. -1001234567890):',
          default: ''
        });
      }
    }


    for (let i = 0; i < botCount; i++) {
      console.log(chalk.bold(`\n${isVi ? `─── Bot ${i + 1} / ${botCount} ───` : `─── Bot ${i + 1} / ${botCount} ───`}`))
      const bName = await input({
        message: isVi ? `Tên Bot ${i + 1}:` : `Bot ${i + 1} name:`,
        default: `Bot ${i + 1}`
      });
      const bSlash = await input({
        message: isVi ? `Slash command (VD: /bot${i+1}):` : `Slash command (e.g. /bot${i+1}):`,
        default: `/bot${i + 1}`
      });
      const bDesc = await input({
        message: isVi ? `Mô tả Bot ${i + 1} (VD: Trợ lý AI cá nhân):` : `Bot ${i + 1} description (e.g. Personal AI assistant):`,
        default: isVi ? 'Trợ lý AI cá nhân' : 'Personal AI assistant'
      });
      const bPersona = await input({
        message: isVi ? `Tính cách & quy tắc Bot ${i + 1} (VD: siêu thân thiện, nhiều emoji):` : `Bot ${i + 1} persona & rules (e.g. friendly, uses emojis):`,
        default: ''
      });
      const bToken = await input({
        message: isVi ? `Bot Token (từ @BotFather):` : `Bot Token (from @BotFather):`,
        required: true
      });
      bots.push({ name: bName, slashCmd: bSlash, desc: bDesc, persona: bPersona, token: bToken });
    }
    botToken = bots[0].token;

  } else if (channelKey !== 'zalo-personal') {
    const bName = await input({ message: isVi ? 'Tên Bot:' : 'Bot Name:', default: 'Chat Bot' });
    const bDesc = await input({ message: isVi ? 'Mô tả Bot:' : 'Bot Description:', default: isVi ? 'Trợ lý AI cá nhân' : 'Personal AI assistant' });
    const bPersona = await input({ message: isVi ? 'Tính cách & quy tắc (VD: gọn gàng, thân thiện):' : 'Persona & rules (e.g. concise, friendly):', default: '' });
    botToken = await input({
      message: isVi ? `Nhập ${channel.name} Token:` : `Enter ${channel.name} Token:`,
      required: true
    });
    bots.push({ name: bName, slashCmd: '', desc: bDesc, persona: bPersona, token: botToken });
  } else {
    bots.push({ name: 'Bot', slashCmd: '', desc: '', persona: '', token: '' });
  }

  const isMultiBot = botCount > 1 && channelKey === 'telegram';

  // 3. User Info
  console.log(chalk.bold(`\n${isVi ? '─── Thông tin của bạn ───' : '─── About You ───'}`));
  const userInfo = await input({
    message: isVi ? '👤 Thông tin về bạn (tên bạn, ngôn ngữ, múi giờ, sở thích...):' : '👤 About you (your name,  language, timezone, interests...):',
    default: '',
    required: true
  });
  
  const botName = bots[0].name;
  const botDesc = bots[0].desc;
  const botPersona = bots[0].persona;


  // 3. Provider
  const providerKey = await select({
    message: isVi ? 'Chọn AI Provider:' : 'Select AI Provider:',
    choices: Object.entries(PROVIDERS).map(([k, v]) => ({ name: `${v.icon} ${v.name}`, value: k }))
  });
  const provider = PROVIDERS[providerKey];
  
  let providerKeyVal = '';
  if (!provider.isProxy && !provider.isLocal) {
    providerKeyVal = await input({
      message: isVi ? `Nhập ${provider.envKey}:` : `Enter ${provider.envKey}:`,
      required: true
    });
  }

  // 3b. Ollama model — help user pick the right size for their hardware
  let selectedOllamaModel = 'gemma4:e2b';
  if (providerKey === 'ollama') {
    console.log(chalk.yellow(isVi
      ? '\n💡 Gemma 4 (02/04/2026) — chọn kích thước phù hợp với RAM máy bạn:'
      : '\n💡 Gemma 4 (April 2, 2026) — pick a size that fits your RAM:'));
    selectedOllamaModel = await select({
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
      default: 'gemma4:e2b'
    });
  }

  // 4. Skills
  const selectedSkills = await checkbox({
    message: isVi ? 'Bật tính năng bổ sung (Space để chọn):' : 'Enable extra skills (Space to select):',
    choices: getCliSkillChoices({ providerKey, isVi })
  });

  let tavilyKey = '';
  // (web-search removed — native search built-in)

  // Browser mode: Desktop (host Chrome via CDP) vs Server (headless Chromium inside Docker)
  let browserMode = 'server';
  if (selectedSkills.includes('browser')) {
    const isLinux = process.platform === 'linux';
    browserMode = await select({
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
      default: isLinux ? 'server' : 'desktop'
    });
  }
  const hasBrowserDesktop = selectedSkills.includes('browser') && browserMode === 'desktop';
  const hasBrowserServer  = selectedSkills.includes('browser') && browserMode === 'server';

  let ttsOpenaiKey = '';
  let ttsElevenKey = '';
  if (selectedSkills.includes('tts')) {
    ttsOpenaiKey = await input({ message: isVi ? 'Nhập OPENAI_API_KEY (cho TTS, bỏ trống nếu dùng ElevenLabs):' : 'Enter OPENAI_API_KEY (for TTS, leave empty for ElevenLabs):' });
    ttsElevenKey = await input({ message: isVi ? 'Nhập ELEVENLABS_API_KEY (hoặc bỏ trống):' : 'Enter ELEVENLABS_API_KEY (or leave empty):', default: '' });
  }

  let smtpHost = 'smtp.gmail.com', smtpPort = '587', smtpUser = '', smtpPass = '';
  if (selectedSkills.includes('email')) {
    smtpHost = await input({ message: isVi ? 'SMTP Host (VD: smtp.gmail.com):' : 'SMTP Host (e.g. smtp.gmail.com):', default: 'smtp.gmail.com' });
    smtpPort = await input({ message: 'SMTP Port:', default: '587' });
    smtpUser = await input({ message: isVi ? 'SMTP Email:' : 'SMTP Email:' });
    smtpPass = await input({ message: isVi ? 'SMTP App Password:' : 'SMTP App Password:' });
  }




  // 6. Project Dir
  let defaultDir = process.cwd();
  if (!defaultDir.endsWith('openclaw-setup') && !defaultDir.endsWith('openclaw')) {
    defaultDir = path.join(defaultDir, 'openclaw-setup');
  }
  const projectDir = await input({
    message: isVi ? 'Thư mục cài đặt project:' : 'Project install directory:',
    default: defaultDir
  });

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
  const deviceApproveLoop = '(while true; do sleep 5; openclaw devices approve --latest 2>/dev/null || true; done) &';

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
    volumeMount: '../../.openclaw:/root/.openclaw',
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
          key: 'sk-no-key',
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
      ackReaction: '👍',
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
      reactionLevel: 'ack',
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
          workspace: `/root/.openclaw/${meta.workspaceDir}`,
          agentDir: `/root/.openclaw/agents/${meta.agentId}/agent`,
          model: { primary: modelsPrimary, fallbacks: [] },
        })),
      },
      ...(providerKey === '9router' ? {
        models: {
          mode: 'merge',
          providers: {
            '9router': {
              baseUrl: deployMode === 'native' ? 'http://localhost:20128/v1' : 'http://9router:20128/v1',
              apiKey: 'sk-no-key',
              api: 'openai-completions',
              models: [
                { id: 'smart-route', name: 'Smart Proxy (Auto Route)', contextWindow: 200000, maxTokens: 8192 },
              ],
            },
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
    sharedConfig.plugins = {
      entries: {
        [TELEGRAM_RELAY_PLUGIN_ID]: { enabled: true },
      },
    };

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
      path.join(projectDir, 'TELEGRAM-POST-INSTALL.md'),
      buildTelegramPostInstallChecklist({ isVi, bots, groupId }),
      'utf8',
    );
    // Generate ecosystem.config.js for PM2 native multi-bot
    if (deployMode === 'native') {
      const pm2Apps = [
        '    {',
        `      name: '${botName || 'openclaw-multibot'}',`,
        `      script: 'openclaw',`,
        `      args: 'gateway run',`,
        `      cwd: '${projectDir.replace(/\\/g, '/')}',`,
        `      interpreter: 'none',`,
        `      autorestart: true,`,
        `      watch: false,`,
        `      env: { NODE_ENV: 'production' }`,
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
      const agentYaml = `name: ${meta.agentId}\ndescription: "${meta.desc}"\n\nmodel:\n  primary: ${modelsPrimary}`;
      await fs.writeFile(path.join(rootClawDir, 'agents', `${meta.agentId}.yaml`), agentYaml);
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
      });
    }
  } else {
  const numBotsToConfigure = 1;
  for (let bIndex = 0; bIndex < numBotsToConfigure; bIndex++) {
    const loopBotName = isMultiBot ? (bots[bIndex]?.name || `Bot ${bIndex+1}`) : botName;
    const loopBotDesc = isMultiBot ? (bots[bIndex]?.desc || '') : botDesc;
    const loopBotPersona = isMultiBot ? (bots[bIndex]?.persona || '') : botPersona;
    const teamRoster = bots.slice(0, numBotsToConfigure).map((peer, idx) => ({
      idx,
      name: peer?.name || `Bot ${idx + 1}`,
      desc: peer?.desc || (isVi ? 'Tro ly AI ca nhan' : 'Personal AI assistant'),
      persona: peer?.persona || '',
      slashCmd: peer?.slashCmd || '',
    }));
    const ownAliases = [loopBotName, bots[bIndex]?.slashCmd || '', `bot ${bIndex + 1}`].filter(Boolean);
    const otherBotNames = teamRoster.filter((peer) => peer.idx !== bIndex).map((peer) => peer.name);
    const loopAgentId = loopBotName.replace(/\s+/g, '-').toLowerCase();
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
          model: { primary: modelsPrimary, fallbacks: [] }
        }]
      },
      ...(providerKey === '9router' ? {
        models: {
          mode: 'merge',
          providers: {
            '9router': {
              baseUrl: deployMode === 'native' ? 'http://localhost:20128/v1' : 'http://9router:20128/v1',
              apiKey: 'sk-no-key',
              api: 'openai-completions',
              models: [
                { id: 'smart-route', name: 'Smart Proxy (Auto Route)', contextWindow: 200000, maxTokens: 8192 }
              ]
            }
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
      const telegramConfig = { enabled: true, dmPolicy: 'open', allowFrom: ['*'] };
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
        dmPolicy: 'open',
        allowFrom: ['*']
      };
    } else if (channelKey === 'zalo-bot') {
      botConfig.channels['zalo'] = { enabled: true, provider: 'official_account' };
    }

    await fs.writeJson(path.join(loopBotDir, '.openclaw', 'openclaw.json'), botConfig, { spaces: 2 });
    
    // ── Workspace files: use shared writeWorkspaceFiles() ──────────────────────
    const dockerWorkspaceDir = path.join(loopBotDir, '.openclaw', 'workspace');
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
      agentWorkspaceDir: 'workspace',
      isRelayBot: isMultiBot,
    });

    if (isMultiBot) {
      // Append per-bot reply rules to AGENTS.md
      const otherBotNames = teamRoster.filter((p) => p.idx !== bIndex).map((p) => p.name);
      const extraAgentsMd = isVi
        ? `\n\n## Khi nao nen tra loi\n- Trong group, chi tra loi khi tin nhan co alias cua ban: ${dockerOwnAliases.map((a) => `\`${a}\``).join(', ')} hoac username Telegram cua ban.\n- Neu tin nhan khong goi ban, hay im lang hoan toan.\n- Neu tin nhan chi goi ro bot khac ${otherBotNames.length ? otherBotNames.map((n) => `\`${n}\``).join(', ') : '`bot khac`'} thi khong cuop loi.\n- Khi da biet user dang goi ban, hay tha reaction co dinh \`👍\` truoc roi moi tra loi bang text. Khong dung emoji khac.\n- Khi can phoi hop noi bo, dung dung agent id ky thuat trong \`AGENTS.md\`, khong dung ten hien thi.\n- Khi hoi ve vai tro cac bot, dung \`AGENTS.md\` lam nguon su that.`
        : `\n\n## When To Reply\n- In group chats, only reply when the message contains one of your aliases: ${dockerOwnAliases.map((a) => `\`${a}\``).join(', ')} or your Telegram username.\n- If the message is not calling you, stay completely silent.\n- If the message is clearly calling another bot such as ${otherBotNames.length ? otherBotNames.map((n) => `\`${n}\``).join(', ') : '`another bot`'}, do not hijack it.\n- Once you know the user is calling you, add the fixed reaction \`👍\` first, then send the text reply. Do not use any other reaction emoji.\n- When you need internal coordination, use the exact technical agent id from \`AGENTS.md\`, not the display name.\n- Use \`AGENTS.md\` as the source of truth for team roles.`;
      await fs.appendFile(path.join(dockerWorkspaceDir, 'AGENTS.md'), extraAgentsMd);
    }
  } // END FOR LOOP
  }

  // ── Chrome Debug scripts — via shared builder (same content as wizard ZIP) ─
  const batPath = path.join(projectDir, 'start-chrome-debug.bat');
  await fs.writeFile(batPath, buildChromeDebugBat(), 'utf8');
  const shPath = path.join(projectDir, 'start-chrome-debug.sh');
  await fs.writeFile(shPath, buildChromeDebugSh(), 'utf8');
  try { await fs.chmod(shPath, 0o755); } catch (_) {}

  // ── Uninstall script — write to project dir (native only) ─────────────────
  if (deployMode !== 'docker') {
    const _nativeOs = process.platform === 'win32' ? 'win'
      : process.platform === 'darwin' ? 'linux'
      : 'linux-desktop';
    const _uninstallScript = buildCLIUninstallScript({
      os: _nativeOs, projectDir, botName, isDocker: false,
    });
    if (_uninstallScript) {
      await fs.writeFile(path.join(projectDir, _uninstallScript.name), _uninstallScript.content, 'utf8');
      if (_uninstallScript.name.endsWith('.sh')) {
        try { await fs.chmod(path.join(projectDir, _uninstallScript.name), 0o755); } catch (_) {}
      }
    }
  }

  // ── start-bot.bat / start-bot.sh — one-click restart scripts ─────────────
  // Generated for native deployments only (docker has docker compose up)
  if (deployMode !== 'docker') {
    const { generateStartBotBat, generateStartBotSh } = _require('../setup/generators/gateway-start-gen.js');

    // Windows: start-bot.bat
    const startBotBatPath = path.join(projectDir, 'start-bot.bat');
    const startBotBatContent = generateStartBotBat({
      projectDir,
      openclawHome: path.join(projectDir, '.openclaw'),
      is9Router: providerKey === '9router',
      isVi,
    });
    await fs.writeFile(startBotBatPath, startBotBatContent, 'utf8');

    // macOS/Linux: start-bot.sh
    const startBotShPath = path.join(projectDir, 'start-bot.sh');
    const startBotShContent = generateStartBotSh({
      projectDir,
      is9Router: providerKey === '9router',
      isVi,
    });
    await fs.writeFile(startBotShPath, startBotShContent, 'utf8');
    try { await fs.chmod(startBotShPath, 0o755); } catch (_) {}

    console.log(chalk.cyan(
      isVi
        ? `\n🚀 start-bot.bat / start-bot.sh đã tạo — double-click để restart bot.`
        : `\n🚀 start-bot.bat / start-bot.sh created — double-click to restart the bot.`
    ));
  }

  console.log(chalk.green(`✅ ${isVi ? 'Tạo cấu hình thành công!' : 'Configs created successfully!'}`));
  
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
            console.log(chalk.yellow(`\n${isVi ? '📋 Bắt buộc:' : '📋 Required:'} TELEGRAM-POST-INSTALL.md`));
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

  installLatestOpenClaw({ isVi, osChoice });

  if (deployMode === 'docker') {

    if (isMultiBot && channelKey === 'telegram') {
      console.log(chalk.yellow(`\n${isVi ? '📋 Xem hướng dẫn sau cài:' : '📋 Read post-install guide:'} ${path.join(projectDir, 'TELEGRAM-POST-INSTALL.md')}`));
    }
    // ── Auto-install openclaw binary if not present ──────────────────────────
    const isOpenClawInstalled = () => { try { execSync('openclaw --version', { stdio: 'ignore' }); return true; } catch { return false; } };
    if (!isOpenClawInstalled()) {
      console.log(chalk.cyan(isVi
        ? '\n📦 Đang cài openclaw binary (npm install -g openclaw)...'
        : '\n📦 Installing openclaw binary (npm install -g openclaw)...'));
      try {
        execSync('npm install -g openclaw', { stdio: 'inherit' });
        console.log(chalk.green(isVi ? '✅ openclaw đã cài xong!' : '✅ openclaw installed!'));
      } catch {
        console.log(chalk.yellow(isVi
          ? '⚠️  Không tự cài được. Chạy thủ công: sudo npm install -g openclaw'
          : '⚠️  Could not auto-install. Run manually: sudo npm install -g openclaw'));
      }
    }

    if (isMultiBot && channelKey === 'telegram') {
      console.log(chalk.yellow(`\n${isVi ? '📋 Xem hướng dẫn sau cài:' : '📋 Read post-install guide:'} ${path.join(projectDir, 'TELEGRAM-POST-INSTALL.md')}`));
    }
  } else {
    if (!isOpenClawInstalled()) {
      console.log(chalk.cyan(isVi
        ? '\n📦 Dang cai openclaw binary (npm install -g openclaw)...'
        : '\n📦 Installing openclaw binary (npm install -g openclaw)...'));
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
      native9RouterSyncScriptPath = await writeNative9RouterSyncScript(projectDir);
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
          startNative9RouterPm2({ isVi, projectDir, appName: botName || 'openclaw-multibot', syncScriptPath: native9RouterSyncScriptPath });
        }
        execSync('pm2 start ecosystem.config.js && pm2 save', {
          cwd: projectDir,
          stdio: 'inherit',
          shell: true
        });
        console.log(chalk.green(`\n🎉 ${isVi ? 'Setup hoan tat! Multi-bot native dang chay qua PM2.' : 'Setup complete! Native multi-bot is running via PM2.'}`));
        console.log(chalk.gray(isVi ? `   Xem log: pm2 logs ${botName || 'openclaw-multibot'}` : `   View logs: pm2 logs ${botName || 'openclaw-multibot'}`));
        printNativeDashboardAccessInfo({ isVi, providerKey, projectDir });
        if (channelKey === 'zalo-personal') {
          printZaloPersonalLoginInfo({ isVi, deployMode: 'native', projectDir });
        }
      } else {
        const appName = botName || 'openclaw';
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
      console.log(chalk.yellow(`\n📋 ${isVi ? 'Xem huong dan sau cai:' : 'Read post-install guide:'} ${path.join(projectDir, 'TELEGRAM-POST-INSTALL.md')}`));
    }
  }
}

main().catch(err => {
  console.error(chalk.red('Error:'), err);
  process.exit(1);
});

