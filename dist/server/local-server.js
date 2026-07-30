import http from 'http';
import fs, { createReadStream, existsSync, readFileSync, promises as fsp } from 'fs';
import { createRequire } from 'module';
import { basename, dirname, extname, join, normalize, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execFile, execFileSync } from 'child_process';
import os from 'os';
import net from 'net';
import { DatabaseSync } from 'node:sqlite';
const _require = createRequire(import.meta.url);
function loadSharedModule(modulePath, globalName) {
  const loaded = _require(modulePath);
  if (loaded && Object.keys(loaded).length > 0) return loaded;
  return globalThis[globalName] || loaded || {};
}
const { buildWorkspaceFileMap, buildCronjobSkillMd, buildInfographicGeneratorSkillMd, buildInfographicGeneratorJs } = loadSharedModule('../setup/shared/workspace-gen.js', '__openclawWorkspace');
const { buildOpenclawJson, buildEnvFileContent, buildExecApprovalsJson, buildZaloConnectChannelConfig } = loadSharedModule('../setup/shared/bot-config-gen.js', '__openclawBotConfig');
const { buildDockerArtifacts } = loadSharedModule('../setup/shared/docker-gen.js', '__openclawDockerGen');
const { HOST_UI_PS1, HOST_UI_PS1_VERSION } = loadSharedModule('../setup/shared/host-ui-ps1.js', '__openclawHostUiPs1');
const { OPENCLAW_NPM_SPEC, NINE_ROUTER_NPM_SPEC, ZALO_CHANNEL_ID, ZALO_PLUGIN_ID, ZALO_CONNECT_VERSION, ZALO_CONNECT_PLUGIN_SPEC, build9RouterProviderConfig, get9RouterBaseUrl } = loadSharedModule('../setup/shared/common-gen.js', '__openclawCommon');
const dataExport = loadSharedModule('../setup/data/index.js', '__openclawData');

// Chrome 136+ ignores --remote-debugging-port when --user-data-dir is the default profile
// directory, so every launch path here (the dashboard button and the generated start-chrome
// scripts) runs a dedicated profile seeded from the operator's real one. Kept outside Chrome's
// own folders: the block is an exact match on the default directory, and a sibling of it is a
// needless bet on that staying true.
const CHROME_SCRIPT_MARKER = 'OPENCLAW_CHROME_PROFILE_V3';
const CHROME_DEBUG_PROFILE_LEAF_WIN = 'OpenClaw\\chrome-profile';
const CHROME_DEBUG_PROFILE_LEAF_MAC = 'Library/Application Support/OpenClaw/chrome-profile';
const CHROME_DEBUG_PROFILE_LEAF_LINUX = '.config/openclaw/chrome-profile';
// Bulk that a fresh profile rebuilds on its own; skipping it turns a multi-GB copy into a
// few hundred MB.
const CHROME_PROFILE_CACHE_DIRS = [
  'Cache', 'Code Cache', 'GPUCache', 'GrShaderCache', 'ShaderCache', 'DawnCache',
  'DawnGraphiteCache', 'DawnWebGPUCache', 'Service Worker', 'component_crx_cache',
  'extensions_crx_cache', 'optimization_guide_model_store', 'blob_storage',
];

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

/**
 * Write files into the bot container's plugin folder. Needed when `.openclaw/extensions` is a
 * Docker named volume: the host sees an empty directory, so there is nothing on disk to patch.
 * Best-effort — a stopped container or a project without Docker just yields 0.
 */
async function pushBrowserScriptsIntoContainer(projectDir, aliases, files, sendLog = () => {}) {
  if (isNativeProject(projectDir)) return 0;
  const container = getBotContainerName(projectDir);
  if (!container) return 0;
  const running = await runCapture('docker', ['inspect', '-f', '{{.State.Running}}', container], { shell: false, timeout: 8000 }).catch(() => null);
  if (String(running?.stdout || '').trim() !== 'true') return 0;

  const homeOut = await runCapture('docker', ['exec', container, 'sh', '-c', 'echo "${OPENCLAW_HOME:-/home/node/project/.openclaw}"'], { shell: false, timeout: 8000 }).catch(() => null);
  const openclawHome = String(homeOut?.stdout || '').trim() || '/home/node/project/.openclaw';

  let pushed = 0;
  for (const alias of aliases) {
    const dir = `${openclawHome}/extensions/${alias}`;
    const check = await runCapture('docker', ['exec', container, 'sh', '-c', `[ -d "${dir}" ] && echo yes || echo no`], { shell: false, timeout: 8000 }).catch(() => null);
    if (String(check?.stdout || '').trim() !== 'yes') continue;
    for (const [name, content, mode] of files) {
      const tmp = join(os.tmpdir(), `openclaw-${Date.now()}-${name}`);
      try {
        await fsp.writeFile(tmp, content, 'utf8');
        // runCapture, not run: run() forces a shell on Windows, and the temp path goes through
        // a home directory that usually has a space in it ("VT 2025") — cmd then splits it and
        // docker cp fails with a usage error.
        const cp = await runCapture('docker', ['cp', tmp, `${container}:${dir}/${name}`], { shell: false, timeout: 20000 });
        if (cp.code !== 0) throw new Error(String(cp.stderr || cp.stdout || 'docker cp failed').trim());
        // A world-writable file makes OpenClaw refuse to load the plugin, and a copy landing
        // from a Windows host is exactly that.
        await runCapture('docker', ['exec', container, 'sh', '-c', `chmod ${mode} "${dir}/${name}"`], { shell: false, timeout: 20000 });
        pushed += 1;
      } catch (err) {
        sendLog(`[browser] Could not push ${name} into ${container}: ${err.message}`);
      } finally {
        await fsp.rm(tmp, { force: true }).catch(() => {});
      }
    }
  }
  return pushed;
}

/**
 * The browser-automation plugin defaults every high-impact behaviour to off (ClawHub's review reads
 * broad defaults as "rogue agent", fairly). A dashboard install is an explicit, informed action, so
 * the flags are turned on here — and stay visible in openclaw.json for anyone who wants them off.
 */
function browserAutomationOptIns() {
  return { patchDocker: true, allowPageScripting: true, allowFileUpload: true };
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

  // The shipped script is replaced outright rather than tweaked: it launches Chrome against a
  // throwaway profile under %TEMP%, which is the single clearest bot signal a site can read —
  // no cookies, no logins, no history, no extensions, brand new on every run.
  //
  // The obvious fix, pointing --user-data-dir at the operator's real profile, is what earlier
  // versions did and it stopped working: since Chrome 136 the browser silently refuses
  // --remote-debugging-port when --user-data-dir IS the default profile directory. Chrome
  // still opens, port 9222 never comes up, and the bot reports "Chrome debug not connected"
  // no matter how many times the operator restarts it.
  //
  // So: a dedicated profile directory, seeded once from the real one. Cookies, logins,
  // history and extensions come along (that was the point of using the real profile), the
  // debug port is allowed because the directory is not the default one, and the operator's
  // own Chrome can keep running next to it. Set OPENCLAW_CHROME_PROFILE_DIR to override —
  // anything except the default profile directory works.
  const chromeProfileCacheJunk = CHROME_PROFILE_CACHE_DIRS;

  const startChromeBat = [
    '@echo off',
    `REM ${CHROME_SCRIPT_MARKER}`,
    'echo ====== OpenClaw - Chrome ======',
    'echo.',
    '',
    'set "REAL_PROFILE=%LOCALAPPDATA%\\Google\\Chrome\\User Data"',
    'REM Chrome 136+ tu choi --remote-debugging-port khi user-data-dir la profile mac dinh,',
    'REM nen dung mot thu muc rieng (chep tu profile that o lan chay dau).',
    `if "%OPENCLAW_CHROME_PROFILE_DIR%"=="" set "OPENCLAW_CHROME_PROFILE_DIR=%LOCALAPPDATA%\\${CHROME_DEBUG_PROFILE_LEAF_WIN}"`,
    '',
    'set "CHROME_BIN=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"',
    'if not exist "%CHROME_BIN%" set "CHROME_BIN=C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"',
    'if not exist "%CHROME_BIN%" set "CHROME_BIN=%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe"',
    'if not exist "%CHROME_BIN%" (',
    '  echo LOI: Khong tim thay Google Chrome. Hay cai Chrome roi chay lai.',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'REM Chi dong ban Chrome dieu khien cu neu co - Chrome thuong cua ban van chay binh thuong,',
    'REM vi ban dieu khien dung profile rieng.',
    'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq \'chrome.exe\' -and $_.CommandLine -like \'*--remote-debugging-port=9222*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1',
    // `timeout` dies with "Input redirection is not supported" whenever stdin is not a
    // console — which is every run from the dashboard, a scheduled task or SSH. ping waits
    // the same way and does not care.
    'ping -n 3 127.0.0.1 >nul',
    '',
    // Copying the real profile duplicates cookies, logins, history and extensions into a second
    // directory and has to close every Chrome window to do it. That is the operator's call, not
    // a silent default: without OPENCLAW_CHROME_SEED_PROFILE=1 this starts a clean profile and
    // they sign in once, in the window that opens.
    'if not exist "%OPENCLAW_CHROME_PROFILE_DIR%\\Default" (',
    // No parentheses in text inside an if-block: cmd closes the block on the first ")".
    '  echo Chua co profile dieu khien - se tao MOI va ban dang nhap 1 lan trong cua so vua mo.',
    '  echo Muon dung san dang nhap cua Chrome thuong thi dat OPENCLAW_CHROME_SEED_PROFILE=1 roi chay lai.',
    '  echo Luu y: viec do CHEP cookie, dang nhap, lich su, extension sang profile dieu khien',
    '  echo va phai DONG het cua so Chrome dang mo de chep.',
    ')',
    '',
    'if not exist "%OPENCLAW_CHROME_PROFILE_DIR%\\Default" if "%OPENCLAW_CHROME_SEED_PROFILE%"=="1" (',
    '  echo Dang dong Chrome de chep profile theo yeu cau cua ban...',
    '  taskkill /F /IM chrome.exe >nul 2>&1',
    '  ping -n 4 127.0.0.1 >nul',
    '  echo Dang chep profile Chrome that sang "%OPENCLAW_CHROME_PROFILE_DIR%" ...',
    '  robocopy "%REAL_PROFILE%\\Default" "%OPENCLAW_CHROME_PROFILE_DIR%\\Default" /E /R:0 /W:0 /NFL /NDL /NJH /NJS /NP ^',
    `    /XD ${chromeProfileCacheJunk.map((n) => (n.includes(' ') ? `"${n}"` : n)).join(' ')} >nul`,
    '  copy /Y "%REAL_PROFILE%\\Local State" "%OPENCLAW_CHROME_PROFILE_DIR%\\Local State" >nul',
    ')',
    '',
    'echo Dang mo Chrome - profile: %OPENCLAW_CHROME_PROFILE_DIR%',
    'start "" "%CHROME_BIN%" ^',
    '  --remote-debugging-port=9222 ^',
    // Loopback only, and no --remote-allow-origins=*: a CDP client written in Node sends no
    // Origin header, so the wildcard bought nothing and only widened who could drive Chrome.
    '  --remote-debugging-address=127.0.0.1 ^',
    '  --user-data-dir="%OPENCLAW_CHROME_PROFILE_DIR%" ^',
    '  --profile-directory=Default ^',
    '  --no-first-run ^',
    '  --no-default-browser-check',
    'ping -n 6 127.0.0.1 >nul',
    'powershell -NoProfile -Command "try { Invoke-WebRequest -Uri \'http://localhost:9222/json/version\' -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host \'OK! Chrome dang mo cong dieu khien 9222 - bot dung duoc.\' -ForegroundColor Green } catch { Write-Host \'LOI: Cong 9222 chua mo. Dong het cua so Chrome roi chay lai file nay.\' -ForegroundColor Red }"',
    'echo.',
    'pause',
    '',
  ].join('\r\n');

  const startChromeSh = [
    '#!/usr/bin/env bash',
    `# ${CHROME_SCRIPT_MARKER}`,
    '# ====== OpenClaw - Chrome (Mac/Linux) ======',
    'set -e',
    'echo "====== OpenClaw - Chrome ======"',
    'echo ""',
    '',
    'if [[ "$OSTYPE" == "darwin"* ]]; then',
    '  CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"',
    '  [ ! -f "$CHROME_BIN" ] && CHROME_BIN="/Applications/Chromium.app/Contents/MacOS/Chromium"',
    '  [ ! -f "$CHROME_BIN" ] && CHROME_BIN="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"',
    '  REAL_PROFILE="$HOME/Library/Application Support/Google/Chrome"',
    `  DEFAULT_DEBUG_PROFILE="$HOME/${CHROME_DEBUG_PROFILE_LEAF_MAC}"`,
    'else',
    "  CHROME_BIN=\"$(command -v google-chrome || command -v google-chrome-stable || command -v chromium-browser || command -v chromium || echo '')\"",
    '  REAL_PROFILE="$HOME/.config/google-chrome"',
    `  DEFAULT_DEBUG_PROFILE="$HOME/${CHROME_DEBUG_PROFILE_LEAF_LINUX}"`,
    'fi',
    '[ -n "$CHROME_DEBUG_BIN" ] && CHROME_BIN="$CHROME_DEBUG_BIN"',
    '',
    'if [ -z "$CHROME_BIN" ] || { [ ! -f "$CHROME_BIN" ] && [ ! -x "$CHROME_BIN" ]; }; then',
    '  echo -e "\\033[31mERROR: Chrome/Chromium not found.\\033[0m"',
    '  echo "Install Chrome or: export CHROME_DEBUG_BIN=/path/to/chrome"',
    '  exit 1',
    'fi',
    '',
    '# Chrome 136+ refuses --remote-debugging-port on the default profile directory, so run a',
    '# dedicated one. It starts empty: copying the real profile duplicates cookies and logins,',
    '# so it only happens when the operator asks with OPENCLAW_CHROME_SEED_PROFILE=1.',
    ': "${OPENCLAW_CHROME_PROFILE_DIR:=$DEFAULT_DEBUG_PROFILE}"',
    '',
    'echo "Using: $CHROME_BIN"',
    'echo "Killing existing Chrome debug instances..."',
    'pkill -f -- "--remote-debugging-port=9222" 2>/dev/null || true',
    'sleep 2',
    '',
    'if [ ! -d "$OPENCLAW_CHROME_PROFILE_DIR/Default" ]; then',
    '  if [ "$OPENCLAW_CHROME_SEED_PROFILE" = "1" ] && [ -d "$REAL_PROFILE/Default" ]; then',
    '    echo "Copying your real Chrome profile into $OPENCLAW_CHROME_PROFILE_DIR as requested"',
    '    echo "(cookies, logins, history and extensions are duplicated into that directory)."',
    '    mkdir -p "$OPENCLAW_CHROME_PROFILE_DIR/Default"',
    '    cp -R "$REAL_PROFILE/Default/." "$OPENCLAW_CHROME_PROFILE_DIR/Default/" 2>/dev/null || true',
    '    cp -f "$REAL_PROFILE/Local State" "$OPENCLAW_CHROME_PROFILE_DIR/Local State" 2>/dev/null || true',
    `    for junk in ${chromeProfileCacheJunk.map((n) => `"${n}"`).join(' ')}; do`,
    '      rm -rf "$OPENCLAW_CHROME_PROFILE_DIR/Default/$junk"',
    '    done',
    '  else',
    '    echo "Starting a clean automation profile - sign in once in the window that opens."',
    '    echo "To reuse your existing logins instead: OPENCLAW_CHROME_SEED_PROFILE=1 $0"',
    '    echo "(that copies cookies, logins, history and extensions into the automation profile)."',
    '  fi',
    'fi',
    'mkdir -p "$OPENCLAW_CHROME_PROFILE_DIR"',
    '',
    'echo "Starting Chrome (profile: $OPENCLAW_CHROME_PROFILE_DIR)..."',
    '"$CHROME_BIN" \\',
    '  --remote-debugging-port=9222 \\',
    '  --remote-debugging-address=127.0.0.1 \\',
    '  --user-data-dir="$OPENCLAW_CHROME_PROFILE_DIR" \\',
    '  --profile-directory=Default \\',
    '  --no-first-run \\',
    '  --no-default-browser-check &',
    '',
    'sleep 4',
    'if curl -s http://localhost:9222/json/version > /dev/null 2>&1; then',
    '  echo -e "\\033[32mOK! Chrome is listening on port 9222.\\033[0m"',
    'else',
    '  echo -e "\\033[31mERROR: Port 9222 not responding. Quit every Chrome window and run this again.\\033[0m"',
    '  exit 1',
    'fi',
    '',
  ].join('\n');

  // Scripts from before the dedicated-profile fix carry OPENCLAW_CHROME_PROFILE_DIR but point
  // it at the default profile, so they are dead on Chrome 136+. The marker — not the variable
  // name — decides whether a script is current; anything older is replaced.
  const patchChromeDebugScript = (content, isBat) => (
    content.includes(CHROME_SCRIPT_MARKER) ? content : (isBat ? startChromeBat : startChromeSh)
  );

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
        const workspacePath = workspaceRel.startsWith('/')
          ? (resolve(workspaceRel).startsWith(resolve(projectDir)) ? workspaceRel : join(projectDir, workspaceRel.replace(/^\/home\/node\/project\/?/, '').replace(/^\/root\/project\/?/, '')))
          : join(projectDir, workspaceRel);
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

  // Patch the plugin's own copies too: the plugin re-syncs its skill folder into every
  // workspace on startup, so an unpatched source would undo the profile change below.
  const sourceScriptNames = ['start-chrome-debug.bat', 'start-chrome-debug.sh'];
  let scriptsPatched = 0;
  for (const dir of extensionDirs) {
    for (const name of sourceScriptNames) {
      const file = join(dir, name);
      if (!existsSync(file)) continue;
      const content = await fsp.readFile(file, 'utf8');
      const next = patchChromeDebugScript(content, name.endsWith('.bat'));
      if (next !== content) {
        await fsp.writeFile(file, next, 'utf8');
        scriptsPatched += 1;
      }
    }
  }
  if (scriptsPatched > 0) {
    sendLog(`[browser] Patched ${scriptsPatched} start-chrome script(s) to use a dedicated Chrome profile seeded from yours (set OPENCLAW_CHROME_PROFILE_DIR to override).`);
  }

  // Some Docker projects mount `.openclaw/extensions` as a named volume, so the plugin's own
  // files exist only inside the container. Every host path above then quietly finds nothing,
  // the plugin re-syncs its stale script into the workspaces on each boot, and the operator
  // keeps running the version that cannot open the debug port. Push the script in through the
  // container instead.
  if (!extensionDirs.some((dir) => existsSync(join(dir, sourceScriptNames[0])) || existsSync(join(dir, sourceScriptNames[1])))) {
    const pushed = await pushBrowserScriptsIntoContainer(projectDir, aliases, [
      ['start-chrome-debug.bat', startChromeBat, '644'],
      ['start-chrome-debug.sh', startChromeSh, '755'],
    ], sendLog);
    if (pushed > 0) {
      sendLog(`[browser] Extensions live in a Docker volume — pushed ${pushed} start-chrome script(s) into the container so the plugin delivers the current one.`);
    }
  }

  const browserMd = `# Browser Automation

This plugin skill owns browser automation only. For normal web search, use OpenClaw's built-in \`web_search\` capability.

Run commands from this folder or pass the full path from the workspace root:

- \`cd plugin-skills/browser-automation && node browser-tool.js status\`
- \`node plugin-skills/browser-automation/browser-tool.js status\`

## Chrome Debug Mode

On a desktop machine, start real Chrome in debug mode before asking the bot to browse:

- Windows: run \`start-chrome.bat\`
- macOS/Linux: run \`./start-chrome.sh\`

Chrome launches with a profile copied from the operator's own on first run, so pages see a normal browser with its usual cookies, logins and history. (Chrome 136+ refuses the debug port on the default profile directory itself, hence the copy.) Set \`OPENCLAW_CHROME_PROFILE_DIR\` before running the script to use a different profile.

The tool connects to whichever Chrome answers first: the operator's Chrome on the host, then a local one on \`127.0.0.1:9222\`. On a server with no desktop Chrome, the container starts its own headless Chromium there at boot, so the same commands work everywhere.

**Use these commands, not OpenClaw's built-in \`browser\` tool** — that tool is switched off here because it cannot read page text or links, which is the whole reason this skill exists. If a command reports it cannot connect, the operator's Chrome is not running: ask them to run the debug script above. Do not conclude that the environment has no browser.

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
  // Shipped as start-chrome-debug.* by the plugin; delivered to the workspace as
  // start-chrome.* — it launches Chrome with the debug port open, so "debug" in the name only
  // ever made people think it was a developer-only thing.
  const scriptToKeep = shouldKeepBat ? 'start-chrome.bat' : 'start-chrome.sh';
  const legacyScripts = ['start-chrome-debug.bat', 'start-chrome-debug.sh', shouldKeepBat ? 'start-chrome.sh' : 'start-chrome.bat'];
  const sourceBrowserTool = extensionDirs.map((dir) => join(dir, 'browser-tool.js')).find((file) => existsSync(file));

  let sanitized = 0;
  for (const workspacePath of workspaceDirs) {
    if (!existsSync(workspacePath)) continue;
    const pluginSkillPath = join(workspacePath, 'plugin-skills', 'browser-automation');
    await fsp.mkdir(pluginSkillPath, { recursive: true }).catch(() => {});
    await fsp.rm(join(workspacePath, 'search-tool.js'), { force: true }).catch(() => {});
    await fsp.rm(join(workspacePath, 'browser-tool.js'), { force: true }).catch(() => {});
    await fsp.rm(join(workspacePath, 'BROWSER.md'), { force: true }).catch(() => {});
    for (const legacy of legacyScripts) {
      await fsp.rm(join(workspacePath, legacy), { force: true }).catch(() => {});
      await fsp.rm(join(pluginSkillPath, legacy), { force: true }).catch(() => {});
    }
    await fsp.rm(join(workspacePath, scriptToKeep), { force: true }).catch(() => {});
    if (sourceBrowserTool) {
      const targetBrowserTool = join(pluginSkillPath, 'browser-tool.js');
      await fsp.copyFile(sourceBrowserTool, targetBrowserTool).catch(() => {});
      if (existsSync(targetBrowserTool)) {
        const content = await fsp.readFile(targetBrowserTool, 'utf8');
        const next = content.includes('connectPreferredChrome') ? content : patchContent(content);
        if (next !== content) await fsp.writeFile(targetBrowserTool, next, 'utf8');
      }
    }
    // Written from the generator, not copied from the plugin: on a project whose extensions
    // folder is a Docker volume there is no host copy to read, and the workspace would be left
    // without a starter at all.
    const targetScript = join(pluginSkillPath, scriptToKeep);
    await fsp.writeFile(targetScript, scriptToKeep.endsWith('.bat') ? startChromeBat : startChromeSh, 'utf8');
    if (scriptToKeep.endsWith('.sh')) await fsp.chmod(targetScript, 0o755).catch(() => {});
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
let zaloLoginChild = null; // active `openclaw channels login` process (for cancel)
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
  if (platform === 'linux') {
    // WSL always has a Windows desktop behind it, so it counts as a desktop. Otherwise a session
    // with no display server is a headless server, and the distinction is not cosmetic: 'vps' is
    // what opens the gateway bind past loopback (bot-config-gen) — pick 'linux-desktop' on a VPS
    // and the dashboard is only reachable through an SSH tunnel, while the browser tooling is set
    // up as though a local Chrome existed.
    if (os.release().toLowerCase().includes('microsoft')) return 'linux-desktop';
    const sessionType = String(process.env.XDG_SESSION_TYPE || '').toLowerCase();
    const hasDisplay = !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY || process.env.XDG_CURRENT_DESKTOP)
      || sessionType === 'x11' || sessionType === 'wayland';
    return hasDisplay ? 'linux-desktop' : 'vps';
  }
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

// Where npm puts global packages, derived from the running node binary so we never pay for
// `npm root -g` (~100ms) just to find a version string.
function globalNodeModulesDirs() {
  const dirs = [];
  const nodeDir = dirname(process.execPath);
  dirs.push(join(nodeDir, '..', 'lib', 'node_modules'));      // unix prefix layout
  dirs.push(join(nodeDir, 'node_modules'));                   // windows npm prefix
  if (process.env.APPDATA) dirs.push(join(process.env.APPDATA, 'npm', 'node_modules'));
  dirs.push('/usr/local/lib/node_modules', '/usr/lib/node_modules', '/opt/homebrew/lib/node_modules');
  return dirs;
}

// `9router --version` boots the whole CLI and takes ~4 SECONDS on a normal machine. /api/system
// used to pay that on every single call — and the UI calls it after every action, so the whole
// dashboard felt slow for one version string. The version is right there in package.json.
function readGlobalPackageVersion(name) {
  for (const dir of globalNodeModulesDirs()) {
    const pkg = join(dir, name, 'package.json');
    try {
      if (!existsSync(pkg)) continue;
      const version = String(JSON.parse(readFileSync(pkg, 'utf8')).version || '').trim();
      if (version) return version;
    } catch {}
  }
  return '';
}

async function getCurrentRuntimeVersions() {
  const ck = 'hostver:runtimes';
  const cached = probeCacheGet(ck);
  if (cached) return cached;

  const fromDisk = {
    openclaw: readGlobalPackageVersion('openclaw'),
    nineRouter: readGlobalPackageVersion('9router'),
    node: process.version || '',
  };
  // Only shell out for what disk did not answer — a global install in a prefix we do not know
  // about, mostly. Still cached, so an odd layout costs the slow probe once, not every request.
  const needCli = !fromDisk.openclaw || !fromDisk.nineRouter;
  if (needCli) {
    const [openclaw, nineRouter] = await Promise.all([
      fromDisk.openclaw ? null : commandExists('openclaw', ['--version']),
      fromDisk.nineRouter ? null : commandExists('9router', ['--version']),
    ]);
    if (openclaw?.ok) fromDisk.openclaw = (openclaw.output.split(/\r?\n/)[0] || '').trim();
    if (nineRouter?.ok) fromDisk.nineRouter = (nineRouter.output.split(/\r?\n/)[0] || '').trim();
  }
  // Versions only change on an install/update, and those paths already call probeCacheClear().
  // The TTL is just a backstop for a package installed behind this server's back.
  probeCacheSet(ck, fromDisk, 10 * 60 * 1000);
  return fromDisk;
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
  if (!prefix) { _probeCache.clear(); _probeInflight.clear(); return; }
  for (const k of [..._probeCache.keys()]) if (k.startsWith(prefix)) _probeCache.delete(k);
  for (const k of [..._probeInflight.keys()]) if (k.startsWith(prefix)) _probeInflight.delete(k);
}

// One probe per key at a time. The dashboard fires several requests at once and the startup
// prefetch runs alongside them, so without this the same docker/CLI round-trip ran two or three
// times over and every caller waited for the slowest copy. Serves a warm value immediately and
// refreshes in the background once it is half-stale, so a click never waits on a probe.
const _probeInflight = new Map();
function sharedProbe(key, ttlMs, compute) {
  const cached = probeCacheGet(key);
  if (cached) {
    if (Date.now() - cached.at > ttlMs / 2 && !_probeInflight.has(key)) {
      const bg = compute()
        .then((value) => { probeCacheSet(key, { value, at: Date.now() }, ttlMs); return value; })
        .finally(() => _probeInflight.delete(key));
      _probeInflight.set(key, bg);
      bg.catch(() => {});
    }
    return Promise.resolve(cached.value);
  }
  const existing = _probeInflight.get(key);
  if (existing) return existing;
  const run = compute()
    .then((value) => { probeCacheSet(key, { value, at: Date.now() }, ttlMs); return value; })
    .finally(() => _probeInflight.delete(key));
  _probeInflight.set(key, run);
  return run;
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
    // Some callers need to feed stdin (pbcopy/xclip take the clipboard text that way).
    if (opts.input != null) {
      try { child.stdin.write(String(opts.input)); } catch (_) {}
      try { child.stdin.end(); } catch (_) {}
    }
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
  // New OpenClaw builds may create this directory during probing even when no
  // attestation exists. Remove only the empty directory so it does not clutter
  // the project tree; never touch a real `.attested` file.
  await removeEmptyWorkspaceAttestations(projectDir).catch(() => {});
  const firstSync = full || !_runtimeSynced.has(projectDir);
  if (firstSync) {
    if (isNativeProject(projectDir)) {
      // Native has no container: rewrite any Docker/legacy container path
      // (/home/node/project, /root/project) to project-relative, or the gateway tries to
      // mkdir '/home/node' on the host and fails every turn (bot never replies).
      await migrateNativePaths(projectDir).catch(() => {});
    } else {
      // Auto-migrate legacy /root/project paths → /home/node/project in openclaw.json
      await migrateContainerPaths(projectDir).catch(() => {});
    }
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

async function removeEmptyWorkspaceAttestations(projectDir) {
  const attestDir = join(projectDir, '.openclaw', 'workspace-attestations');
  if (!existsSync(attestDir)) return false;
  const entries = await fsp.readdir(attestDir);
  if (entries.length > 0) return false;
  await fsp.rmdir(attestDir);
  return true;
}

/**
 * Native counterpart of migrateContainerPaths. A native bot runs on the host with cwd = the
 * project dir, so any Docker/legacy container path baked into openclaw.json (e.g. an agent
 * `workspace` of "/home/node/project/.openclaw/workspace-x", left over from a bot created by an
 * older build or carried over from Docker) points at a directory that does not exist on the host —
 * the gateway then fails every turn with `ENOENT: mkdir '/home/node'` and the bot never replies.
 * Strip the container prefix so the path becomes project-relative (what bot-config-gen now emits).
 */
async function migrateNativePaths(projectDir) {
  const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
  if (!existsSync(cfgPath)) return;
  let cfg;
  try { cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8')); } catch { return; }
  // The native gateway runs with cwd = OPENCLAW_HOME (projectDir/.openclaw), while the setup
  // writes the workspace under projectDir/.openclaw/<name>. A relative value can't satisfy both:
  //   ".openclaw/workspace-x"  → runtime doubles it to .openclaw/.openclaw/workspace-x (blank persona)
  //   "workspace-x"            → setup's own resolver looks in projectDir/workspace-x
  // Only an ABSOLUTE host path is correct for both — the direct parallel of Docker's absolute
  // "/home/node/project/.openclaw/workspace-x". Normalise every agent's workspace to it.
  const wsRoot = join(projectDir, '.openclaw');
  let changed = false;
  const fix = (obj) => {
    if (!obj || typeof obj.workspace !== 'string' || !obj.workspace) return;
    const base = basename(obj.workspace.replace(/[\\/]+$/, ''));
    if (!base || base === '.' || base === '.openclaw') return;
    const abs = join(wsRoot, base);
    if (obj.workspace !== abs) { obj.workspace = abs; changed = true; }
  };
  for (const a of (cfg.agents?.list || [])) fix(a);
  fix(cfg.agents?.defaults);
  if (changed) {
    await fsp.copyFile(cfgPath, `${cfgPath}.bak`).catch(() => {});
    await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
    sendLog('[migrate] Native: normalized agent workspace paths → absolute project paths (fixes doubled/container paths).');
  }
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
  // Preserve plugins.allow — needed for external plugins such as Zalo Connect.
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

function zaloBackendForConfig(cfg) {
  return cfg?.channels?.['zalo-connect']?.enabled ? 'zalo-connect' : '';
}

function ensureZaloConnectChannel(cfg) {
  // Secure defaults — DM pairing, no groups enabled
  // until the owner picks them. Existing zalo-connect config is preserved as-is.
  cfg.channels['zalo-connect'] = cfg.channels['zalo-connect'] || buildZaloConnectChannelConfig();
  cfg.channels['zalo-connect'].enabled = true;
  cfg.plugins.entries = cfg.plugins.entries || {};
  cfg.plugins.entries['zalo-connect'] = cfg.plugins.entries['zalo-connect'] || { enabled: true };
  cfg.plugins.allow = cfg.plugins.allow || [];
  if (!cfg.plugins.allow.includes('zalo-connect')) cfg.plugins.allow.push('zalo-connect');
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
  // Seed the default bot's identity under bots.default (per-bot shape). zalo-mod
  // treats bots.<profile> as the canonical source — do NOT write legacy top-level
  // botName/zaloDisplayNames (they get stripped by the plugin's normalizer anyway).
  const firstAgentName = cfg.agents?.list?.[0]?.name;
  if (firstAgentName) {
    entry.config.bots = entry.config.bots || {};
    const def = entry.config.bots.default = entry.config.bots.default || {};
    if (!def.botName) def.botName = firstAgentName;
    if (!Array.isArray(def.zaloDisplayNames) || def.zaloDisplayNames.length === 0) def.zaloDisplayNames = [firstAgentName];
    if (!def.slashPrefix) def.slashPrefix = String(firstAgentName).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'bot';
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
  if (ch === 'zalo-connect') return 'zalo-personal';
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
    .map((b) => b.match?.channel === 'zalo-connect' ? 'zalo-personal' : b.match?.channel === 'zalo' ? 'zalo-bot' : b.match?.channel)
    .filter((ch) => ['telegram', 'zalo-personal', 'zalo-bot', 'fb-messenger'].includes(ch));
  if (channels.length) return Array.from(new Set(channels));
  const enabled = [];
  if (cfg.channels?.telegram?.enabled) enabled.push('telegram');
  if (cfg.channels?.['zalo-connect']?.enabled) enabled.push('zalo-personal');
  if (cfg.channels?.zalo?.enabled) enabled.push('zalo-bot');
  if (cfg.channels?.['fb-messenger']?.enabled) enabled.push('fb-messenger');
  return enabled.length === 1 ? enabled : [mapAgentChannel(agent, cfg)];
}

function bindingChannelId(channel = '') {
  if (channel === 'zalo-personal') return 'zalo-connect';
  if (channel === 'zalo-bot') return 'zalo';
  return channel;
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
    return mapAgentChannels(agent, cfg).map((channel) => {
      const binding = (cfg.bindings || []).find((b) => b.agentId === agent.id && b.match?.channel === bindingChannelId(channel));
      return ({
      id: agent.id,
      name: (hasOwnWorkspace ? identityName : agent.name) || agent.name || identityName || agent.id,
      role: identity.role || meta.role || agent.role || agent.desc || agent.description || '',
      channel,
      accountId: binding?.match?.accountId || 'default',
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
      });
    });
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

  // Drop any channel orphaned by this deletion — no binding references it and it has no accounts
  // (e.g. a Telegram channel whose only bot was just removed). An enabled channel with no account
  // keeps erroring in `channels status` ("not configured") and shows a broken card.
  const stillReferenced = new Set((cfg.bindings || []).map((b) => b.match?.channel).filter(Boolean));
  for (const ch of new Set(removedBindings.map((b) => b.match?.channel).filter(Boolean))) {
    const chCfg = cfg.channels?.[ch];
    if (chCfg && !stillReferenced.has(ch) && Object.keys(chCfg.accounts || {}).length === 0) {
      delete cfg.channels[ch];
    }
  }

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

/**
 * First port at or after `start` that nothing on this host is listening on.
 *
 * The install-time allocator only knows about setup-managed projects, so it cannot see a docker
 * project from another install, an SSH tunnel forwarding a remote bot's ports, or any other
 * listener. Docker tolerates that (compose publishes into loopback and fails loudly on a clash);
 * native binds the host directly, so it has to ask the host.
 *
 * `reserveNext` also requires port+1 to be free — that is where the zalo-mod dashboard lands.
 */
async function findFreeHostPort(start, { reserveNext = false, limit = 100 } = {}) {
  for (let port = start; port < start + limit; port++) {
    if ((await portStatus(port)) === 'online') continue;
    if (reserveNext && (await portStatus(port + 1)) === 'online') continue;
    return port;
  }
  return start;
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

  // Resolved per project, not from the installer-wide state.mode: the operator can switch between
  // a docker project and a native one, and the UI hides/shows container-only actions on this.
  const deployMode = projectDeployMode(state.projectDir);
  return { ...state, deployMode, gatewayStatus, routerStatus, bots, credentials, runtimeVersions, activeModel, activeProvider };
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

  // Múi giờ người dùng chọn ở UI Cài đặt (mặc định VN). Với project đã có sẵn, ưu tiên tz đã lưu
  // trong config để bot mới đồng bộ với các bot cũ.
  const bodyTz = String(body.userTimezone || '').trim() || 'Asia/Ho_Chi_Minh';

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
    userTimezone: bodyTz,
  }));
  const userTimezone = cfg.agents?.defaults?.userTimezone || bodyTz;

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
    ensureZaloConnectChannel(cfg);
    // zalo-connect (fork ≥3.0) is genuinely multi-account: API clients, stored
    // credentials and QR login are all keyed by accountId. So multiple Zalo
    // numbers can coexist in one project (mirrors Telegram): the first Zalo bot
    // uses 'default', each additional one gets its own account keyed by agentId.
    // Each new account still needs its own QR login (startZaloLogin reads the
    // accountId from this binding).
    const existingZaloConnectBindings = cfg.bindings.filter((b) => b.match?.channel === 'zalo-connect').length;
    accountId = existingZaloConnectBindings === 0 ? 'default' : agentId;
    const zc = cfg.channels['zalo-connect'];
    zc.accounts = zc.accounts || {};
    zc.accounts[accountId] = zc.accounts[accountId] || { enabled: true };
    zc.defaultAccount = zc.defaultAccount || 'default';
    cfg.bindings.push({ agentId, match: { channel: 'zalo-connect', accountId } });
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
  // Native gateway resolves a relative workspace against OPENCLAW_HOME (=projectDir/.openclaw),
  // so the generator's ".openclaw/workspace-x" would double. Rewrite to an absolute path now so
  // the bot reads its persona on the very first turn (not only after the next runtime sync).
  if (isNativeProject(projectDir)) await migrateNativePaths(projectDir).catch(() => {});
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
    zaloBackend: zaloBackendForConfig(cfg),
    hasScheduler,
    hasImageGen,
    userTimezone,
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
  // PC control is granted per PROJECT, so a bot added afterwards must get the same instructions —
  // its TOOLS.md was just written fresh and would otherwise have no host-control block at all.
  const hostCfg = await readHostControlConfig(projectDir).catch(() => null);
  if (hostCfg?.enabled) await writeHostControlAccess(projectDir, hostCfg).catch(() => {});

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
    ensureZaloConnectChannel(cfg);
    cfg.bindings.push({ agentId, match: { channel: 'zalo-connect', accountId: 'default' } });
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
    zaloBackend: zaloBackendForConfig(cfg),
    hasScheduler,
    hasImageGen,
    userTimezone: cfg.agents?.defaults?.userTimezone || 'Asia/Ho_Chi_Minh',
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

/**
 * Drop OpenClaw's boxed "Config warnings" banner (and any stray warning line) from CLI output.
 *
 * The banner prints on EVERY invocation and quotes the offending config keys verbatim, so a project
 * whose zalo-connect plugin is missing has `channels.zalo-connect: unknown channel id: zalo-connect`
 * in the output of *any* command. A readiness check that greps stdout for a channel id therefore
 * reports "channel loaded" precisely when the plugin is absent — the check inverts itself. Strip the
 * warnings before matching so only real command output counts.
 */
function stripCliWarnings(text = '') {
  const kept = [];
  let inBanner = false;
  for (const line of String(text).split(/\r?\n/)) {
    if (/◇\s*Config warnings/.test(line)) { inBanner = true; continue; }
    // The banner is drawn as a box; its bottom edge is the only line starting with ├ or └.
    if (inBanner) {
      if (/^\s*[├└]/.test(line)) inBanner = false;
      continue;
    }
    if (/unknown channel id|plugin not found|stale config|no channel plugin is installed/i.test(line)) continue;
    kept.push(line);
  }
  return kept.join('\n');
}

// Both keywords are load-bearing, and callers must not narrow them to the id alone: `channels
// status` lists a loaded channel by its DISPLAY NAME ("OpenClaw Zalo Connect default: enabled, …"),
// so the hyphenated id shows up only in the stale-config warnings stripCliWarnings now removes.
// Match on the id alone and the check can never pass once the plugin is actually installed.
async function waitForGatewayZaloReady(botContainer, projectDir, timeoutMs = 90000, channelKeywords = ['zalo-connect', 'openclaw zalo connect']) {
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
        const output = stripCliWarnings((pluginCheck.stdout || '') + '\n' + (pluginCheck.stderr || '')).toLowerCase();
        if (channelKeywords.some((kw) => output.includes(kw))) {
          ready = true;
          break;
        }
        if (attempts > 2) sendLog('[zalo-connect] Gateway healthy but Zalo Connect is not loaded yet (' + Math.round((Date.now() - started) / 1000) + 's)...');
      } else {
        if (attempts > 2 && attempts % 3 === 0) sendLog('[zalo-connect] Waiting for gateway... (' + Math.round((Date.now() - started) / 1000) + 's)');
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (!ready) {
    sendLog('[zalo-connect] Gateway readiness timeout after ' + Math.round(timeoutMs / 1000) + 's — proceeding anyway.');
  }
  return ready;
}

// Native equivalent of waitForGatewayZaloReady: no container to exec into, so probe the
// gateway's /health over loopback and read `channels status` through the host CLI (ocCapture).
async function waitForNativeGatewayZaloReady(projectDir, timeoutMs = 90000, channelKeywords = ['zalo-connect', 'openclaw zalo connect']) {
  const started = Date.now();
  const meta = readNativeMeta(projectDir) || {};
  const port = String(meta.gatewayPort || state.gatewayPort || NATIVE_DEFAULT_GATEWAY_PORT);
  const extDir = join(projectDir, '.openclaw', 'extensions', 'zalo-connect');
  let ready = false;
  let attempts = 0;
  while (Date.now() - started < timeoutMs) {
    attempts++;
    // Decisive, free, and immune to the warning-banner trap above: with no plugin folder the channel
    // cannot possibly be loaded, so return right away and let the caller install it instead of
    // burning the whole timeout waiting for something that will never appear.
    if (!existsSync(extDir)) {
      sendLog('[zalo-connect] Plugin folder .openclaw/extensions/zalo-connect is absent — not waiting.');
      return false;
    }
    if (await probeHttpOk(`http://127.0.0.1:${port}/health`, 2500)) {
      const st = await ocCapture(projectDir, ['channels', 'status']).catch(() => ({ stdout: '', stderr: '' }));
      const output = stripCliWarnings((st.stdout || '') + '\n' + (st.stderr || '')).toLowerCase();
      if (channelKeywords.some((kw) => output.includes(kw))) { ready = true; break; }
      if (attempts > 2) sendLog('[zalo-connect] Gateway healthy but Zalo Connect is not loaded yet (' + Math.round((Date.now() - started) / 1000) + 's)...');
    } else if (attempts > 2 && attempts % 3 === 0) {
      sendLog('[zalo-connect] Waiting for native gateway... (' + Math.round((Date.now() - started) / 1000) + 's)');
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (!ready) sendLog('[zalo-connect] Native gateway readiness timeout after ' + Math.round(timeoutMs / 1000) + 's — proceeding anyway.');
  return ready;
}

async function startZaloLogin(projectDir, agentId = "") {
  // A fresh login changes what channels status reports; do not serve the cached "not connected".
  probeCacheClear(`zalohealth:${projectDir || ''}`);
  const cfgPath = join(projectDir, ".openclaw", "openclaw.json");
  if (!existsSync(cfgPath)) throw httpError(404, "openclaw.json not found");
  const cfg = JSON.parse(await fsp.readFile(cfgPath, "utf8"));
  const binding = (cfg.bindings || []).find((b) =>
    (!agentId || b.agentId === agentId) && b.match?.channel === "zalo-connect"
  );
  return startZaloConnectLogin(projectDir, binding?.match?.accountId || "default");
}

// ── OpenClaw Zalo Connect QR login (new projects) ────────────────────────────────────────────
// zalo-connect prints the QR two ways: ASCII art on stdout and a PNG written to the
// container's tmpdir, announced with "QR image saved at: /tmp/zalo-connect-qr-<id>.png".
// We watch stdout for that line, read the PNG out of the container, and push it to
// the UI modal as a data URL ([zalo-connect:qr] log tag). Reconnect NEVER reinstalls the
// plugin — install runs only when extensions/zalo-connect is absent, and always with the
// pinned spec (never `latest`).
async function startZaloConnectLogin(projectDir, accountId = 'default') {
  if (zaloLoginInFlight) {
    return { message: 'Zalo login is already running. Keep this modal open...' };
  }
  const native = isNativeProject(projectDir);
  if (!native) {
    const composeFile = join(projectDir, 'docker', 'openclaw', 'docker-compose.yml');
    if (!existsSync(composeFile)) {
      throw httpError(400, 'Zalo login cần project Docker đang chạy (không tìm thấy docker-compose.yml).');
    }
  }
  zaloLoginInFlight = true;
  const botContainer = native ? '' : getBotContainerName(projectDir);
  sendLog(`[zalo-connect] Preparing QR login for account [${accountId}]...`);
  try {
    if (native) {
      // No container: the gateway runs as a managed service on the host. Wait for it to
      // report the zalo-connect channel; if it never does and the plugin folder is absent,
      // install it on the host (into this project's .openclaw/extensions) and reload.
      const gatewayReady = await waitForNativeGatewayZaloReady(projectDir, 180000);
      if (!gatewayReady) {
        // ensureNativePlugins is the single place that knows what a native project owes itself, and
        // it skips whatever is already on disk — so this covers learning-memory too, and reconnects
        // on a healthy project cost nothing.
        const installed = await ensureNativePlugins(projectDir);
        if (installed.includes(ZALO_PLUGIN_ID)) {
          await restartNativeRuntime(projectDir).catch((err) => sendLog(`[native] restart skipped/failed: ${err.message}`));
          await waitForNativeGatewayZaloReady(projectDir, 180000);
        } else if (!existsSync(join(projectDir, '.openclaw', 'extensions', 'zalo-connect'))) {
          sendLog('[zalo-connect] Cài plugin không thành công — thử lại bằng nút "Đăng nhập Zalo".');
        }
      }
    } else {
      // NEVER poke the container while it is still booting: OpenClaw runs first-boot
      // migrations under a state lease, and a docker exec/restart mid-migration wedges
      // the lease and crash-loops the gateway. Wait for the container, then for the
      // gateway to report the zalo-connect channel (the entrypoint installs the pinned
      // plugin itself on first boot), and only fall back to an exec-install when the
      // gateway is up but the plugin is genuinely absent (projects created before the
      // backend-aware entrypoint existed).
      const containerUp = await waitForDockerContainer(botContainer, 90000);
      if (!containerUp) sendLog(`[zalo-connect] ${botContainer} chưa chạy sau 90s — vẫn thử tiếp...`);
      const gatewayReady = await waitForGatewayZaloReady(botContainer, projectDir, 180000);
      if (!gatewayReady) {
        const check = await runCapture('docker', ['exec', botContainer, 'sh', '-lc', '[ -d "${OPENCLAW_HOME:-/home/node/project/.openclaw}/extensions/zalo-connect" ] && echo OK || echo MISSING'], { cwd: projectDir, shell: false }).catch(() => ({ stdout: 'ERR' }));
        if (String(check.stdout || '').trim() === 'MISSING') {
          sendLog(`[zalo-connect] Plugin missing — installing ${ZALO_CONNECT_PLUGIN_SPEC}...`);
          const installCmd = `cd /home/node/project && openclaw plugins install ${ZALO_CONNECT_PLUGIN_SPEC} --force --acknowledge-clawhub-risk 2>&1`;
          const inst = await runCapture('docker', ['exec', botContainer, 'sh', '-lc', installCmd], { cwd: projectDir, shell: false });
          const instOut = `${inst.stdout}\n${inst.stderr}`;
          for (const line of instOut.split(/\r?\n/).filter(Boolean)) sendLog(`[zalo-connect] ${line}`);
          if (/installed plugin/i.test(instOut)) {
            // Gateway must reload to pick the plugin up — safe here: the gateway is past
            // its boot (we only reach this branch when it answered the exec above).
            await restartDockerBotContainer(projectDir).catch((err) => sendLog(`[docker] restart skipped/failed: ${err.message}`));
            await waitForGatewayZaloReady(botContainer, projectDir, 180000);
          } else {
            sendLog('[zalo-connect] Cài plugin không thành công — thử lại bằng nút "Đăng nhập Zalo" sau khi container ổn định.');
          }
        }
      }
    }
  } catch (err) {
    zaloLoginInFlight = false;
    throw err;
  }

  sendLog('[zalo-connect] Generating Zalo QR. The image will appear automatically.');
  const loginCmd = `cd /home/node/project && openclaw channels login --channel zalo-connect --account ${accountId} --verbose`;
  let qrSent = false;
  let loginDone = false;

  const pushQr = async (pngPath) => {
    let b64 = '';
    if (native) {
      // The CLI ran on the host, so the QR PNG is a real host path — read it directly.
      try {
        const st = await fsp.stat(pngPath);
        if (st.size > 100) b64 = (await fsp.readFile(pngPath)).toString('base64');
      } catch {}
    } else {
      const js = `const fs=require('fs');const p=${JSON.stringify(pngPath)};try{if(fs.existsSync(p)&&fs.statSync(p).size>100){process.stdout.write(fs.readFileSync(p).toString('base64'));}}catch{}`;
      const out = await runCapture('docker', ['exec', botContainer, 'node', '-e', js], { cwd: projectDir, shell: false }).catch(() => ({ stdout: '' }));
      b64 = extractCompletePngBase64(out.stdout);
    }
    if (b64.length > 100) {
      qrSent = true;
      sendLog(`[zalo-connect:qr] data:image/png;base64,${b64}`);
      sendLog('[zalo-connect] Scan this QR with the Zalo app.');
    }
  };

  const isQrAsciiArt = (line) => /^[\s▀▄█▌▐░▒▓]+$/.test(line);
  const handleLine = (line) => {
    const qrFile = line.match(/QR image saved at:\s*(\S+\.png)/i);
    if (qrFile) {
      pushQr(qrFile[1]).catch(() => {});
      return;
    }
    if (isQrAsciiArt(line)) return; // don't flood the UI modal with terminal QR art
    sendLog(`[zalo-connect] ${line}`);
    if (/login successful|login completed|logged in/i.test(line)) loginDone = true;
  };
  // Retry loop: right after a boot the gateway may still refuse `channels login`
  // ("container is restarting", "still preparing"), so give it a few spaced attempts.
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS = [0, 10000, 20000];
  let attempt = 0;
  const runAttempt = () => {
    attempt++;
    if (attempt > 1) sendLog(`[zalo-connect] Retry ${attempt}/${MAX_ATTEMPTS}...`);
    const child = native
      ? spawn(resolveBinPath('openclaw'), ['channels', 'login', '--channel', 'zalo-connect', '--account', accountId, '--verbose'], { cwd: projectDir, shell: false, windowsHide: true, env: { ...process.env, ...nativeEnv(projectDir) } })
      : spawn('docker', ['exec', botContainer, 'sh', '-lc', loginCmd], { cwd: projectDir, shell: false, windowsHide: true });
    zaloLoginChild = child;
    child.stdout.on('data', (d) => String(d).split(/\r?\n/).filter(Boolean).forEach(handleLine));
    child.stderr.on('data', (d) => String(d).split(/\r?\n/).filter(Boolean).forEach(handleLine));
    child.on('error', (err) => sendLog(`[zalo-connect] Login process failed: ${err.message}`));
    child.on('close', async (code) => {
      const wasCancelled = child.killed && zaloLoginChild === null;
      if (zaloLoginChild === child) zaloLoginChild = null;
      sendLog(`[zalo-connect] Login process exited ${code}`);
      if (loginDone) {
        if (native) {
          sendLog('[zalo-connect] Login saved. Restarting native gateway so the Zalo channel connects...');
          await restartNativeRuntime(projectDir).catch((err) => sendLog(`[zalo-connect] Gateway restart failed: ${err.message}`));
          sendLog('[zalo-connect] Gateway restarted. Try sending a Zalo message now.');
        } else {
          sendLog(`[zalo-connect] Login saved. Restarting ${botContainer} so the Zalo channel connects...`);
          await restartDockerBotContainer(projectDir).catch((err) => sendLog(`[zalo-connect] Container restart failed: ${err.message}`));
          sendLog(`[zalo-connect] ${botContainer} restarted. Try sending a Zalo message now.`);
        }
        zaloLoginInFlight = false;
      } else if (code !== 0 && !qrSent && !wasCancelled && attempt < MAX_ATTEMPTS) {
        const delay = RETRY_DELAYS[attempt] || 15000;
        sendLog(`[zalo-connect] QR chưa sẵn sàng — thử lại sau ${delay / 1000}s...`);
        setTimeout(runAttempt, delay);
      } else {
        if (!qrSent && !wasCancelled) sendLog('[zalo-connect] Login ended without a QR. Click "Đăng nhập Zalo" to retry.');
        zaloLoginInFlight = false;
      }
    });
  };
  runAttempt();

  return { message: 'Generating Zalo QR. The image will appear automatically.' };
}

// Cancel an in-flight Zalo QR login (modal closed). Kills the CLI login process so
// no orphaned login keeps polling Zalo; safe to call when nothing is running.
function cancelZaloLogin() {
  const child = zaloLoginChild;
  if (child) {
    try { child.kill('SIGTERM'); } catch {}
    zaloLoginChild = null;
    zaloLoginInFlight = false;
    sendLog('[zalo-connect] Login cancelled.');
    return { ok: true, cancelled: true };
  }
  return { ok: true, cancelled: false };
}

function buildZaloHealthSnapshot(cfg = {}, statusJson = null, credentialNames = null, options = {}) {
  const containerRunning = options.containerRunning !== false;
  const textStatus = String(options.textStatus || '');
  const agents = new Map((cfg.agents?.list || []).map((agent) => [String(agent.id), agent]));
  const bindings = (cfg.bindings || []).filter((binding) => binding.match?.channel === 'zalo-connect');
  const runtimeAccounts = Array.isArray(statusJson?.channelAccounts?.['zalo-connect'])
    ? statusJson.channelAccounts['zalo-connect']
    : [];
  const expected = [];
  const seen = new Set();
  for (const binding of bindings) {
    const accountId = String(binding.match?.accountId || 'default');
    if (seen.has(accountId)) continue;
    seen.add(accountId);
    expected.push({ accountId, agentId: String(binding.agentId || '') });
  }
  for (const runtime of runtimeAccounts) {
    const accountId = String(runtime?.accountId || 'default');
    if (seen.has(accountId)) continue;
    seen.add(accountId);
    expected.push({ accountId, agentId: '' });
  }

  const credentialSet = Array.isArray(credentialNames)
    ? new Set(credentialNames.map((name) => String(name || '').toLowerCase()))
    : null;
  const fallbackLines = textStatus.split(/\r?\n/).filter((line) => /zalo[- ]connect/i.test(line));
  const accounts = expected.map(({ accountId, agentId }) => {
    const runtime = runtimeAccounts.find((item) => String(item?.accountId || 'default') === accountId) || null;
    const line = fallbackLines.find((item) => accountId === 'default'
      ? /\bdefault\b/i.test(item) || fallbackLines.length === 1
      : item.toLowerCase().includes(accountId.toLowerCase())) || '';
    const fallbackRunning = /running|connected|ready|\bok\b/i.test(line);
    const fallbackFailed = /stopped|disconnected|error|failed/i.test(line);
    const configured = runtime ? runtime.configured === true : !!line && !fallbackFailed;
    const running = runtime ? runtime.running === true : fallbackRunning;
    const lastError = runtime?.lastError || (fallbackFailed ? line.trim() : null);
    const credentialFile = accountId === 'default'
      ? 'zalo-connect-credentials.json'
      : `zalo-connect-credentials-${accountId}.json`;
    const fileSaved = credentialSet ? credentialSet.has(credentialFile.toLowerCase()) : false;
    const agent = agents.get(agentId);
    return {
      accountId,
      agentId,
      name: agent?.name || agentId || accountId,
      configured,
      running,
      lastError,
      sessionSaved: fileSaved || runtime?.configured === true,
    };
  });

  const total = accounts.length;
  const running = accounts.filter((account) => account.running).length;
  const configured = accounts.filter((account) => account.configured).length;
  const failed = accounts.filter((account) => account.lastError || (!account.running && account.configured)).length;
  let channelStatus = 'unknown';
  if (!containerRunning) channelStatus = 'container-stopped';
  else if (total > 0 && running === total) channelStatus = 'connected';
  else if (running > 0) channelStatus = 'partial';
  else if (total > 0 && (failed > 0 || configured > 0)) channelStatus = 'disconnected';
  else if (statusJson || fallbackLines.length) channelStatus = 'starting';

  return {
    backend: cfg.channels?.['zalo-connect']?.enabled ? 'zalo-connect' : '',
    containerRunning,
    channelStatus,
    channelStatusLine: fallbackLines.join(' | '),
    summary: { total, running, configured, failed },
    accounts,
  };
}

// ── Zalo health snapshot for the dashboard ──────────────────────────────────────
// Runtime JSON is authoritative and account-aware. Text parsing remains only as a
// compatibility fallback for older OpenClaw builds.
// `openclaw channels status` is a CLI round-trip (docker exec on a container, or the host
// gateway) and costs ~3 seconds. The dashboard asks for this on every page load and after every
// action, so it is cached for a few seconds and refreshed in the background: a second visit is
// instant, and the number on screen is never more than a few seconds stale. Login/restart paths
// clear it (probeCacheClear) so a state change shows up immediately.
const ZALO_HEALTH_TTL_MS = 4000;
function getZaloHealth(projectDir) {
  return sharedProbe(`zalohealth:${projectDir || ''}`, ZALO_HEALTH_TTL_MS, () => computeZaloHealth(projectDir));
}

async function computeZaloHealth(projectDir) {
  const meta = {
    supportedVersion: ZALO_CONNECT_VERSION,
    installedVersion: null,
    zaloModInstalled: false,
    zaloModVersion: null,
  };
  if (!projectDir) return { ...buildZaloHealthSnapshot({}, null, null, { containerRunning: false }), ...meta };
  let cfg = null;
  try { cfg = JSON.parse(await fsp.readFile(join(projectDir, '.openclaw', 'openclaw.json'), 'utf8')); } catch {}
  if (!cfg) return { ...buildZaloHealthSnapshot({}, null, null, { containerRunning: false }), ...meta };
  meta.zaloModInstalled = !!(cfg.plugins?.entries?.['zalo-mod'] || cfg.plugins?.entries?.['openclaw-zalo-mod'])
    || existsSync(join(projectDir, '.openclaw', 'extensions', 'zalo-mod'));
  meta.zaloModVersion = await getInstalledPluginVersion(projectDir, ['zalo-mod', 'openclaw-zalo-mod']) || null;
  if (meta.zaloModVersion) meta.zaloModInstalled = true;

  const botContainer = getBotContainerName(projectDir);
  const native = isNativeProject(projectDir);
  if (cfg.channels?.['zalo-connect']?.enabled) {
    const manifestHost = join(projectDir, '.openclaw', 'extensions', 'zalo-connect', 'openclaw.plugin.json');
    try {
      meta.installedVersion = JSON.parse(await fsp.readFile(manifestHost, 'utf8')).version || null;
    } catch {
      // Only Docker projects keep the manifest inside a container. A native project has no
      // container at all, and this fallback used to shell into one anyway — seconds of waiting on
      // a `docker exec` that could never succeed, on a request the dashboard makes constantly.
      if (!native) {
        try {
          const r = await runCapture('docker', ['exec', botContainer, 'sh', '-lc', 'cat "${OPENCLAW_HOME:-/home/node/project/.openclaw}/extensions/zalo-connect/openclaw.plugin.json" 2>/dev/null'], { cwd: projectDir, shell: false, timeout: 8000 });
          meta.installedVersion = JSON.parse(String(r.stdout || '{}')).version || null;
        } catch {}
      }
    }
  }

  let containerRunning = false;
  let statusJson = null;
  let textStatus = '';
  let credentialNames = null;
  if (native) {
    // "containerRunning" here means "runtime up": for native, probe the managed gateway's
    // /health over loopback, then read channel status + credentials directly on the host.
    const nmeta = readNativeMeta(projectDir) || {};
    const port = String(nmeta.gatewayPort || state.gatewayPort || NATIVE_DEFAULT_GATEWAY_PORT);
    // Loopback: a live gateway answers in milliseconds. The old 2.5s budget was pure waiting
    // whenever the runtime was down, on a request the dashboard makes on every page load.
    containerRunning = await probeHttpOk(`http://127.0.0.1:${port}/health`, 900);
    if (containerRunning) {
      try {
        const r = await ocCapture(projectDir, ['channels', 'status', '--json'], { timeout: 20000 });
        statusJson = parseJsonText(String(r.stdout || '').trim(), null);
      } catch {}
      if (!statusJson) {
        try {
          const r = await ocCapture(projectDir, ['channels', 'status'], { timeout: 20000 });
          textStatus = `${r.stdout || ''}\n${r.stderr || ''}`;
        } catch {}
      }
      // zalo-connect writes credentials under the project's .openclaw (OPENCLAW_HOME); fall
      // back to the real home dir in case the plugin used os.homedir() instead.
      const credRe = /^zalo-connect-credentials(?:-[^.]+)?\.json$/i;
      for (const dir of [join(projectDir, '.openclaw'), join(os.homedir(), '.openclaw')]) {
        try {
          const names = (await fsp.readdir(dir)).filter((n) => credRe.test(n));
          if (names.length) { credentialNames = names; break; }
        } catch {}
      }
    }
  } else {
    try {
      const r = await runCapture('docker', ['inspect', '-f', '{{.State.Running}}', botContainer], { shell: false, timeout: 8000 });
      containerRunning = String(r.stdout || '').trim() === 'true';
    } catch {}
    if (containerRunning) {
      try {
        const r = await runCapture('docker', ['exec', botContainer, 'openclaw', 'channels', 'status', '--json'], { cwd: projectDir, shell: false, timeout: 20000 });
        statusJson = parseJsonText(String(r.stdout || '').trim(), null);
      } catch {}
      if (!statusJson) {
        try {
          const r = await runCapture('docker', ['exec', botContainer, 'sh', '-lc', 'openclaw channels status 2>&1 || true'], { cwd: projectDir, shell: false, timeout: 20000 });
          textStatus = String(r.stdout || '');
        } catch {}
      }
      try {
        const script = "const fs=require('fs'),path=require('path'),os=require('os');const d=path.join(os.homedir(),'.openclaw');let a=[];try{a=fs.readdirSync(d).filter(n=>/^zalo-connect-credentials(?:-[^.]+)?\\.json$/i.test(n))}catch{}process.stdout.write(JSON.stringify(a))";
        const r = await runCapture('docker', ['exec', botContainer, 'node', '-e', script], { cwd: projectDir, shell: false, timeout: 8000 });
        credentialNames = parseJsonText(String(r.stdout || '[]').trim(), []);
      } catch {}
      try {
        const versions = await getContainerExtensionVersions(projectDir);
        const zaloModVersion = versions['zalo-mod'] || versions['openclaw-zalo-mod'] || '';
        if (zaloModVersion) {
          meta.zaloModInstalled = true;
          meta.zaloModVersion = zaloModVersion;
        }
      } catch {}
    }
  }
  return { ...buildZaloHealthSnapshot(cfg, statusJson, credentialNames, { containerRunning, textStatus }), ...meta };
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

// ═══════════════════════════════════════════════════════════════════════════════
// Native runtime — openclaw + 9router straight on the host, no Docker
// ═══════════════════════════════════════════════════════════════════════════════
// Two things replace the container:
//   1. `docker exec <container> openclaw …`  →  `openclaw …` carrying the project env.
//      Without that env the CLI silently reads ~/.openclaw instead of the project, so every
//      native invocation MUST go through ocRun/ocCapture rather than calling openclaw directly.
//   2. container lifecycle  →  `openclaw daemon …` (launchd on macOS, systemd on Linux,
//      schtasks on Windows). The generated service keeps the project env via its own
//      env-wrapper and sets KeepAlive, which is the native equivalent of `restart: always`.
// Service identity is per project (OPENCLAW_LAUNCHD_LABEL/…): the CLI's default label is a
// single fixed one, so without this a second native project would take over the first's service.

const NATIVE_MARKER = 'native.json';
// Native uses the same ports as everything else: openclaw's 18789 and 9router's 20128. It used to
// jump a hundred above them unconditionally so it could sit next to a docker project, but that fired
// even on a machine with nothing running at all — a fresh VPS still landed on 18889/20228, so every
// tunnel command, bookmark and doc pointed at a port the user never chose. findFreeHostPort() now
// handles coexistence by asking the host what is actually taken, which the fixed offset never did.
const NATIVE_DEFAULT_GATEWAY_PORT = 18789;
const NATIVE_DEFAULT_ROUTER_PORT = 20128;

function nativeMarkerPath(projectDir) {
  return join(projectDir || state.projectDir || '', '.openclaw', NATIVE_MARKER);
}

function readNativeMeta(projectDir) {
  try { return JSON.parse(fs.readFileSync(nativeMarkerPath(projectDir), 'utf8')); } catch (e) { return null; }
}

/** Per-project deploy mode. The marker file wins; a compose file means docker; else fall back. */
function projectDeployMode(projectDir) {
  const dir = projectDir || state.projectDir || '';
  if (!dir) return state.mode || 'docker';
  if (existsSync(nativeMarkerPath(dir))) return 'native';
  if (existsSync(join(dir, 'docker', 'openclaw', 'docker-compose.yml'))) return 'docker';
  return state.mode || 'docker';
}

function isNativeProject(projectDir) {
  return projectDeployMode(projectDir) === 'native';
}

/** launchd label / systemd unit / scheduled-task name — unique per project so installs coexist. */
function nativeServiceLabel(projectDir) {
  const meta = readNativeMeta(projectDir);
  if (meta && meta.label) return meta.label;
  const id = slugify(basename(projectDir || 'openclaw'), 'bot');
  return `ai.openclaw.gateway.${id}`;
}

/** The env every native CLI call needs (mirrors the docker runtime env in docker-gen.js). */
function nativeEnv(projectDir, extra = {}) {
  const dir = projectDir || state.projectDir || '';
  const home = join(dir, '.openclaw');
  const meta = readNativeMeta(dir) || {};
  const gatewayPort = String(meta.gatewayPort || state.gatewayPort || NATIVE_DEFAULT_GATEWAY_PORT);
  const label = nativeServiceLabel(dir);
  return {
    OPENCLAW_HOME: home,
    OPENCLAW_STATE_DIR: home,
    DATA_DIR: join(dir, '.9router'),
    OPENCLAW_GATEWAY_PORT: gatewayPort,
    OPENCLAW_PORT: gatewayPort,
    OPENCLAW_ALLOW_INSECURE_PRIVATE_WS: '1',
    OPENCLAW_SETUP_OS: meta.osChoice || state.os || '',
    OPENCLAW_BROWSER_HOST_OS: meta.osChoice || state.os || '',
    OPENCLAW_LAUNCHD_LABEL: label,
    OPENCLAW_SYSTEMD_UNIT: `${label}.service`,
    OPENCLAW_WINDOWS_TASK_NAME: label,
    ...extra,
  };
}

/** Resolve `openclaw <args>` for whichever runtime this project uses. */
function ocArgv(projectDir, args) {
  if (isNativeProject(projectDir)) {
    return { cmd: 'openclaw', args, opts: { cwd: projectDir, env: nativeEnv(projectDir) } };
  }
  return { cmd: 'docker', args: ['exec', getBotContainerName(projectDir), 'openclaw', ...args], opts: { cwd: projectDir } };
}

function ocRun(projectDir, args, opts = {}) {
  const a = ocArgv(projectDir, args);
  return run(a.cmd, a.args, { ...a.opts, ...opts });
}

function ocCapture(projectDir, args, opts = {}) {
  const a = ocArgv(projectDir, args);
  return runCapture(a.cmd, a.args, { shell: false, ...a.opts, ...opts, env: { ...(a.opts.env || {}), ...(opts.env || {}) } });
}

/** Probe the managed gateway's own /health until it answers. */
async function waitForNativeGatewayHealthy(projectDir, timeoutMs = 120000) {
  const meta = readNativeMeta(projectDir) || {};
  const port = String(meta.gatewayPort || state.gatewayPort || NATIVE_DEFAULT_GATEWAY_PORT);
  const started = Date.now();
  let attempts = 0;
  while (Date.now() - started < timeoutMs) {
    if (await probeHttpOk(`http://127.0.0.1:${port}/health`, 2500)) return true;
    attempts++;
    if (attempts % 5 === 0) sendLog(`[native] Waiting for gateway on ${port}... (${Math.round((Date.now() - started) / 1000)}s)`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  sendLog(`[native] Gateway did not answer /health on ${port} within ${Math.round(timeoutMs / 1000)}s.`);
  return false;
}

/**
 * The first gateway boot runs OpenClaw's startup migrations under a state-directory lease, and a
 * second gateway that tries to start meanwhile exits 1 with this message rather than waiting. The
 * docker path sidesteps it by never poking a booting container (see startZaloConnectLogin); when we
 * do hit it natively, the message carries the exact instant the lease frees — so wait that out
 * instead of retrying blind into systemd's StartLimitBurst (5 per 60s, after which the unit is
 * abandoned for good).
 */
function migrationLeaseDeadline(text = '') {
  const m = String(text).match(/migrations are already running[\s\S]*?after\s+(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/i);
  if (!m) return 0;
  const t = Date.parse(m[1]);
  return Number.isFinite(t) ? t : 0;
}

/** `openclaw daemon <verb>` for a native project: streams output to the UI log AND returns it. */
async function ocDaemon(projectDir, verb, extraArgs = []) {
  const args = ['daemon', verb, ...extraArgs];
  sendLog(`$ openclaw ${args.join(' ')}`);
  const out = await runCapture('openclaw', args, { cwd: projectDir, env: nativeEnv(projectDir), shell: false, timeout: 120000 });
  const text = `${out.stdout || ''}\n${out.stderr || ''}`;
  for (const line of text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean)) sendLog(line);
  return { ...out, text };
}

/**
 * Restart the native gateway service.
 *
 * `daemon restart` is the obvious call, but on Windows it dies with
 * `ERR_UNKNOWN_SIGNAL: Unknown signal: SIGUSR1` (verified on a real box: the old pid survives and
 * newly installed plugins never load, silently). stop+start is what actually works there, and it
 * works everywhere else too, so Windows takes that path and other systems keep `restart` with
 * stop+start as a fallback.
 *
 * Health is confirmed over /health at the end rather than trusted from the CLI's exit code: the
 * CLI gives up verifying after ~13s while the generated unit allows 30s to start, so a slow but
 * perfectly healthy gateway reports "restart failed" — which used to send callers down a pointless
 * stop+start that raced the migration lease all over again.
 */
async function restartNativeRuntime(projectDir) {
  // Every restart is a chance to repair a project installed before these two fixes existed — both
  // calls are no-ops once the service env is complete and the stray files have been adopted.
  await adoptStrayNativeHome(projectDir).catch(() => {});
  await syncNativeServiceEnv(projectDir).catch(() => {});
  const stopStart = async () => {
    await ocDaemon(projectDir, 'stop');
    return ocDaemon(projectDir, 'start');
  };
  let res;
  if (process.platform === 'win32') {
    res = await stopStart();
  } else {
    res = await ocDaemon(projectDir, 'restart');
    // A lease collision is a "come back in a moment", not a broken service: stop+start would only
    // collide again, so fall through to the wait below instead.
    if (res.code !== 0 && !migrationLeaseDeadline(res.text)) {
      sendLog(`[native] daemon restart exited ${res.code}; falling back to stop+start`);
      res = await stopStart();
    }
  }
  const deadline = migrationLeaseDeadline(res.text);
  if (deadline) {
    const waitMs = Math.max(0, Math.min(deadline - Date.now(), 300000)) + 3000;
    sendLog(`[native] Startup migrations hold the state lease — waiting ${Math.ceil(waitMs / 1000)}s before retrying.`);
    await new Promise((r) => setTimeout(r, waitMs));
    res = await ocDaemon(projectDir, 'restart');
    if (res.code !== 0) res = await stopStart();
  }
  // systemd keeps restarting a crash-looping unit every RestartSec, so a gateway blocked by a lease
  // we never saw still comes up on its own — give it room before calling the restart a failure.
  if (!(await waitForNativeGatewayHealthy(projectDir, 180000))) {
    throw new Error('gateway did not answer /health after restart');
  }
  return true;
}

/**
 * Make the generated service carry everything nativeEnv() promises.
 *
 * `openclaw daemon install` propagates only a fixed allow-list into the service it writes:
 * OPENCLAW_STATE_DIR survives, but OPENCLAW_HOME does NOT — verified on both a systemd user unit and
 * a launchd env-wrapper. Anything resolving paths from OPENCLAW_HOME then falls back to `~/.openclaw`
 * and writes OUTSIDE the project. zalo-connect is the visible casualty: it stages inbound files and
 * its Zalo session credentials under the wrong home, so a PDF sent to the bot lands somewhere the
 * agent's workspace cannot reach ("em chưa trích xuất được nội dung từ PDF") and the session sits in
 * a different home from the config that describes it.
 *
 * Idempotent: keys already present are left alone, so this is safe to run on every restart and it
 * self-heals projects created before the fix.
 */
async function syncNativeServiceEnv(projectDir) {
  if (!isNativeProject(projectDir)) return [];
  const want = nativeEnv(projectDir);
  const label = nativeServiceLabel(projectDir);

  if (process.platform === 'linux') {
    const unit = `${label}.service`;
    const shown = await runCapture('systemctl', ['--user', 'show', '-p', 'FragmentPath', '--value', unit], { shell: false, timeout: 10000 });
    const path = String(shown.stdout || '').trim() || join(os.homedir(), '.config', 'systemd', 'user', unit);
    if (!existsSync(path)) return [];
    const lines = (await fsp.readFile(path, 'utf8')).split('\n');
    const have = new Set();
    for (const line of lines) {
      const m = line.trim().match(/^Environment="?([A-Z_0-9]+)=/);
      if (m) have.add(m[1]);
    }
    const missing = Object.entries(want).filter(([k, v]) => !have.has(k) && v !== '');
    if (!missing.length) return [];
    // Insert after the last existing Environment= line so the additions stay inside [Service].
    let at = -1;
    lines.forEach((line, i) => { if (line.startsWith('Environment=')) at = i; });
    if (at < 0) at = lines.findIndex((line) => line.trim() === '[Service]');
    if (at < 0) return [];
    lines.splice(at + 1, 0, ...missing.map(([k, v]) => `Environment=${k}=${v}`));
    await fsp.copyFile(path, `${path}.bak`).catch(() => {});
    await fsp.writeFile(path, lines.join('\n'), 'utf8');
    await run('systemctl', ['--user', 'daemon-reload'], {}).catch(() => {});
    sendLog(`[native] service env completed: ${missing.map(([k]) => k).join(', ')}`);
    return missing.map(([k]) => k);
  }

  if (process.platform === 'darwin') {
    // launchd runs the gateway through an env-wrapper that sources this file, so patching it is the
    // launchd equivalent of adding Environment= lines to a unit.
    const envFile = join(projectDir, '.openclaw', 'service-env', `${label}.env`);
    if (!existsSync(envFile)) return [];
    const body = await fsp.readFile(envFile, 'utf8');
    const have = new Set([...body.matchAll(/^\s*export\s+([A-Z_0-9]+)=/gm)].map((m) => m[1]));
    const missing = Object.entries(want).filter(([k, v]) => !have.has(k) && v !== '');
    if (!missing.length) return [];
    const added = missing.map(([k, v]) => `export ${k}='${String(v).replace(/'/g, "'\\''")}'`).join('\n');
    await fsp.copyFile(envFile, `${envFile}.bak`).catch(() => {});
    await fsp.writeFile(envFile, `${body.replace(/\n*$/, '')}\n${added}\n`, 'utf8');
    sendLog(`[native] service env completed: ${missing.map(([k]) => k).join(', ')}`);
    return missing.map(([k]) => k);
  }

  return [];
}

/**
 * Reunite a native project with the files an unset OPENCLAW_HOME scattered into `~/.openclaw`.
 *
 * This MUST run before syncNativeServiceEnv takes effect: once OPENCLAW_HOME is finally correct, the
 * plugin looks for its Zalo session inside the project — and if the credentials are still sitting in
 * the home directory it finds nothing and demands a fresh QR login. Copy (never move) so a failed
 * run leaves the working original in place; skip anything the project already has.
 */
async function adoptStrayNativeHome(projectDir) {
  if (!isNativeProject(projectDir)) return [];
  const projectHome = join(projectDir, '.openclaw');
  const strayHome = join(os.homedir(), '.openclaw');
  if (resolve(strayHome) === resolve(projectHome) || !existsSync(strayHome)) return [];
  const moved = [];
  const entries = await fsp.readdir(strayHome, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    // `state` is deliberately excluded: the project has its own live database and merging two
    // sqlite files is not something a copy can do correctly.
    const isCreds = /^zalo-connect-credentials.*\.json$/.test(entry.name);
    if (!isCreds && entry.name !== 'media') continue;
    const from = join(strayHome, entry.name);
    const to = join(projectHome, entry.name);
    if (existsSync(to)) continue;
    await fsp.cp(from, to, { recursive: true }).catch(() => {});
    if (existsSync(to)) moved.push(entry.name);
  }
  if (moved.length) {
    sendLog(`[migrate] Native: adopted ${moved.join(', ')} from ${strayHome} (written there while OPENCLAW_HOME was unset).`);
  }
  return moved;
}

/**
 * `openclaw daemon install` has no `--system` flag, so on Linux the gateway becomes a systemd USER
 * unit — and a user manager without linger is torn down when that user's last session exits. On a
 * desktop the graphical session holds it open, which is why this never showed up on macOS or a
 * Linux desktop; on a VPS the bot dies the moment the operator closes SSH and never comes back
 * after a reboot. Linger is what makes a user unit behave like the `restart: always` container it
 * replaces. Best-effort: a box without loginctl just keeps the old behaviour, loudly.
 */
async function ensureSystemdLinger() {
  if (process.platform !== 'linux') return false;
  let user = '';
  try { user = process.env.SUDO_USER || os.userInfo().username; } catch { return false; }
  if (!user) return false;
  const cur = await runCapture('loginctl', ['show-user', user, '-p', 'Linger'], { shell: false, timeout: 10000 });
  if (/Linger=yes/i.test(cur.stdout || '')) return true;
  const out = await runCapture('loginctl', ['enable-linger', user], { shell: false, timeout: 20000 });
  if (out.code === 0) {
    sendLog(`[native] systemd linger enabled for "${user}" — the gateway now survives logout and reboot.`);
    return true;
  }
  sendLog(`[native] WARNING: could not enable systemd linger for "${user}" (${(out.stderr || out.stdout || '').trim() || `exit ${out.code}`}).`);
  sendLog(`[native] The gateway will stop when this user's last session ends. Fix it with: sudo loginctl enable-linger ${user}`);
  return false;
}

/**
 * Native counterpart of the docker entrypoint's `ensure_plugin` (docker-gen.js).
 *
 * A container reinstalls its missing plugins on every boot; a native project has no entrypoint, so
 * nothing ever put zalo-connect or learning-memory on disk. The generated config declares both
 * anyway (bot-config-gen writes plugins.entries + allow + slots.contextEngine), so without this the
 * gateway boots with "plugin not found" warnings, `channels.zalo-connect` has no owner — Zalo login
 * fails with `Unsupported channel "zalo-connect"` — and the bot silently runs with no context
 * engine at all. Same set and same skip-if-present cheapness as ensure_plugin.
 */
async function ensureNativePlugins(projectDir, { restart = false } = {}) {
  if (!isNativeProject(projectDir)) return [];
  // Same cleanup the container entrypoint does (docker-gen.js): an interrupted `plugins install`
  // leaves extensions/.openclaw-install-stage-XXXXXX behind, and it still carries a plugin manifest —
  // so the gateway logs "duplicate plugin id detected" every boot and a stale build competes with the
  // real one for the same id. Native has no entrypoint, so it has to happen here.
  const extRoot = join(projectDir, '.openclaw', 'extensions');
  for (const entry of await fsp.readdir(extRoot, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory() || !entry.name.startsWith('.openclaw-install-stage-')) continue;
    await fsp.rm(join(extRoot, entry.name), { recursive: true, force: true }).catch(() => {});
    sendLog(`[native] removed abandoned plugin staging dir ${entry.name}`);
  }
  let cfg = {};
  try { cfg = JSON.parse(await fsp.readFile(join(projectDir, '.openclaw', 'openclaw.json'), 'utf8')); } catch {}
  // learning-memory backs plugins.slots.contextEngine for every bot; zalo-connect only when a bot
  // actually declares the channel (mirrors docker-gen's `if (zaloBackend === 'zalo-connect')`).
  const wanted = new Set(['learning-memory']);
  if (cfg?.channels?.[ZALO_CHANNEL_ID] || cfg?.plugins?.entries?.[ZALO_PLUGIN_ID]) wanted.add(ZALO_PLUGIN_ID);
  const installed = [];
  for (const id of wanted) {
    const dir = join(projectDir, '.openclaw', 'extensions', id);
    if (existsSync(dir)) continue;
    const spec = id === ZALO_PLUGIN_ID ? ZALO_CONNECT_PLUGIN_SPEC : pluginInstallSpec(id);
    sendLog(`[native] plugin ${id} missing; installing ${spec}`);
    const out = await ocCapture(projectDir, ['plugins', 'install', spec, '--force', '--acknowledge-clawhub-risk'], { timeout: 300000 });
    const text = `${out.stdout || ''}\n${out.stderr || ''}`;
    for (const line of text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean)) sendLog(`[native] ${line}`);
    if (existsSync(dir) || /installed plugin/i.test(text)) installed.push(id);
    else sendLog(`[native] WARNING: could not install plugin ${id} — the bot will run without it.`);
  }
  if (installed.length && restart) {
    sendLog(`[native] Restarting gateway to load: ${installed.join(', ')}`);
    await restartNativeRuntime(projectDir).catch((e) => sendLog(`[native] restart after plugin install: ${e.message}`));
  }
  return installed;
}

/** Fire-and-forget background process (9router has no service wrapper of its own). */
function startDetached(cmd, args, opts = {}) {
  sendLog(`$ ${cmd} ${args.join(' ')} &`);
  const shell = process.platform === 'win32';
  const rawBin = resolveBinPath(cmd);
  const bin = shell && rawBin.includes(' ') && !rawBin.startsWith('"') ? `"${rawBin}"` : rawBin;
  const child = spawn(bin, args, {
    cwd: opts.cwd,
    shell,
    detached: true,
    stdio: 'ignore',
    windowsHide: opts.windowsHide ?? true,
    env: { ...process.env, ...(opts.env || {}) },
  });
  child.on('error', (err) => sendLog(`[native] Failed to start "${cmd}": ${err.message}`));
  child.unref();
  return child.pid;
}

/** Kill whatever is listening on a port. `pkill` does not exist on Windows, so resolve pid → kill. */
async function killListenerOnPort(port) {
  if (process.platform === 'win32') {
    const out = await runCapture('powershell', ['-NoProfile', '-Command', `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess`], { shell: false, timeout: 15000 });
    const pid = String(out.stdout || '').trim();
    if (/^\d+$/.test(pid)) await run('taskkill', ['/F', '/PID', pid], { shell: false }).catch(() => {});
    return;
  }
  const out = await runCapture('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { shell: false, timeout: 10000 });
  const pid = String(out.stdout || '').trim().split(/\s+/)[0];
  if (/^\d+$/.test(pid)) await run('kill', [pid], { shell: false }).catch(() => {});
}

async function probeHttpOk(url, timeoutMs = 2000) {
  const r = await runCapture('curl', ['-s', '-m', String(Math.ceil(timeoutMs / 1000)), '-o', '/dev/null', '-w', '%{http_code}', url], { shell: false, timeout: timeoutMs + 2000 });
  return /^[23]/.test((r.stdout || '').trim());
}

/**
 * Start 9router for a native project. Bound to loopback on purpose: openclaw talks to it over
 * localhost (see get9RouterBaseUrl), so exposing the LLM proxy on 0.0.0.0 would only create an
 * open relay — on a VPS that is a real risk. Data lives in the project so projects stay separate.
 */
async function startNative9Router(projectDir, { restart = false } = {}) {
  const meta = readNativeMeta(projectDir) || {};
  const routerPort = meta.routerPort || state.routerPort || NATIVE_DEFAULT_ROUTER_PORT;
  const dataDir = join(projectDir, '.9router');
  await fsp.mkdir(dataDir, { recursive: true }).catch(() => {});
  if (restart) {
    // No service wrapper for 9router: stop the old listener before rebinding the same port.
    await killListenerOnPort(routerPort);
  } else if (await probeHttpOk(`http://127.0.0.1:${routerPort}/`)) {
    sendLog(`[native] 9router already listening on ${routerPort}`);
    return routerPort;
  }
  startDetached('9router', ['-n', '-l', '-H', '127.0.0.1', '-p', String(routerPort), '--skip-update'], {
    cwd: projectDir,
    env: nativeEnv(projectDir, { DATA_DIR: dataDir }),
  });
  return routerPort;
}

/**
 * Bring a native project up end to end: 9router → smart-route sync → resolve its API key into
 * openclaw.json → install the gateway as a managed service. Order matters: the gateway must boot
 * after 9router is reachable and after the key is on disk, or its first turn has no model.
 */
async function startNativeRuntime({ projectDir, osChoice = '', gatewayPort, routerPort }) {
  const gwPort = gatewayPort || NATIVE_DEFAULT_GATEWAY_PORT;
  const rtPort = routerPort || NATIVE_DEFAULT_ROUTER_PORT;
  const label = nativeServiceLabel(projectDir);
  // Marker first: nativeEnv()/isNativeProject() read it, and everything below depends on them.
  await fsp.mkdir(join(projectDir, '.openclaw'), { recursive: true });
  await fsp.writeFile(
    nativeMarkerPath(projectDir),
    JSON.stringify({ mode: 'native', gatewayPort: gwPort, routerPort: rtPort, osChoice, label }, null, 2),
    'utf8',
  );

  await startNative9Router(projectDir);

  // Same smart-route sync the docker sidecar runs, pointed at the native DB path. Without it
  // 9router keeps its login gate and the default `smart-route` combo has no backing models.
  try {
    const artifacts = buildDockerArtifacts({ is9Router: true, osChoice, openClawNpmSpec: OPENCLAW_NPM_SPEC, gatewayPort: gwPort, routerPort: rtPort });
    if (artifacts && artifacts.syncScript) {
      const dataDir = join(projectDir, '.9router');
      const syncPath = join(dataDir, 'sync.js');
      await fsp.writeFile(syncPath, artifacts.syncScript, 'utf8');
      startDetached(process.execPath, [syncPath], {
        cwd: dataDir,
        env: nativeEnv(projectDir, { NINEROUTER_DB_PATH: join(dataDir, 'db', 'data.sqlite'), PORT: String(rtPort) }),
      });
      sendLog('[native] 9router smart-route sync started');
    }
  } catch (e) {
    sendLog(`[native] smart-route sync skipped: ${e.message}`);
  }

  await new Promise((r) => setTimeout(r, 8000));
  await applyResolved9RouterApiKey(projectDir).catch(() => {});

  // Plugins BEFORE the gateway's first boot — the container entrypoint installs them ahead of the
  // gateway for the same reason: a gateway that boots with its plugins already on disk loads them
  // straight away, needs no follow-up restart, and prints no "plugin not found" warnings.
  await ensureNativePlugins(projectDir).catch((e) => sendLog(`[native] plugin bootstrap skipped: ${e.message}`));

  // Managed service = auto-restart (KeepAlive/Restart=always) and start-at-login, the native
  // equivalent of docker's `restart: always`. --force so re-running install updates the port.
  const env = nativeEnv(projectDir);
  await ensureSystemdLinger();
  await run('openclaw', ['daemon', 'install', '--force', '--port', String(gwPort)], { cwd: projectDir, env });
  // Order is load-bearing: adopt the stray files FIRST, then complete the service env. The other way
  // round, the gateway boots with a corrected OPENCLAW_HOME, finds no Zalo session there, and asks
  // for a new QR scan even though a perfectly good session exists in the home directory.
  await adoptStrayNativeHome(projectDir).catch((e) => sendLog(`[migrate] stray home skipped: ${e.message}`));
  await syncNativeServiceEnv(projectDir).catch((e) => sendLog(`[native] service env sync skipped: ${e.message}`));
  await run('openclaw', ['daemon', 'start'], { cwd: projectDir, env });
  // Let the first boot finish its state migrations here, while nothing else is competing for the
  // lease. Every later action (create bot, install plugin) then restarts a settled gateway.
  await waitForNativeGatewayHealthy(projectDir, 180000);
  sendLog(`[native] gateway service "${label}" running on 127.0.0.1:${gwPort}, 9router on 127.0.0.1:${rtPort}`);
  return { gatewayPort: gwPort, routerPort: rtPort, label };
}

/** Tear down a native project's service (used when deleting the project). */
async function removeNativeRuntime(projectDir) {
  if (!isNativeProject(projectDir)) return false;
  const env = nativeEnv(projectDir);
  await run('openclaw', ['daemon', 'uninstall'], { cwd: projectDir, env }).catch((e) => sendLog(`[native] daemon uninstall: ${e.message}`));
  const routerPort = (readNativeMeta(projectDir) || {}).routerPort || NATIVE_DEFAULT_ROUTER_PORT;
  await killListenerOnPort(routerPort);
  return true;
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

  // Detect the single supported personal-Zalo backend from openclaw.json.
  const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
  let zaloBackend = '';
  try {
    const cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
    if (cfg.channels?.['zalo-connect']?.enabled) zaloBackend = 'zalo-connect';
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
    zaloBackend,
    runtimeCommandParts: [
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
  // Native: there is no image to rebuild — the gateway reads openclaw.json from disk on boot, so
  // reloading config after a bot/plugin change is just a service restart. Callers stay unchanged.
  if (isNativeProject(projectDir)) {
    // Never restart a gateway that is still on its first boot: OpenClaw runs startup migrations
    // under a state lease, a restart mid-migration exits 1, and systemd's start limit can then
    // abandon the unit. This is the same trap the docker path avoids by waiting for the container
    // before touching it (see startZaloConnectLogin) — wait for /health first.
    await waitForNativeGatewayHealthy(projectDir, 180000);
    // The bot that was just created/edited may have added the Zalo channel or the context engine to
    // openclaw.json; put those plugins on disk now so this one reload loads them too.
    await ensureNativePlugins(projectDir).catch((e) => sendLog(`[native] plugin ensure skipped: ${e.message}`));
    sendLog('[native] Reloading gateway to pick up openclaw.json changes...');
    await restartNativeRuntime(projectDir).catch((e) => sendLog(`[native] restart failed: ${e.message}`));
    probeCacheClear();
    return true;
  }
  const composeFile = join(projectDir, 'docker', 'openclaw', 'docker-compose.yml');
  if (!existsSync(composeFile)) return false;
  const depDir = join(projectDir, '.openclaw', 'plugin-runtime-deps');
  await fsp.mkdir(depDir, { recursive: true }).catch(() => {});
  const serviceName = getBotServiceName(projectDir);
  const containerName = getBotContainerName(projectDir);
  sendLog(`[docker] Recreating ${serviceName} to reload openclaw.json/.env...`);
  await run('docker', ['compose', '-f', composeFile, 'up', '-d', '--build', '--force-recreate', serviceName], { cwd: projectDir });
  await waitForDockerContainer(containerName);

  // Container was rebuilt/recreated: runtime, versions and extension versions may all have changed.
  probeCacheClear();
  return true;
}

async function updateRuntime(target, projectDir) {
  const isRouter = target === '9router';
  const spec = isRouter ? NINE_ROUTER_NPM_SPEC : OPENCLAW_NPM_SPEC;
  // Native: the runtime is a global npm package, not an image. Reinstall it, then restart the
  // service so the new binary is the one actually serving. This is what replaces "Rebuild".
  if (isNativeProject(projectDir)) {
    sendLog(`[native] Updating ${target} → ${spec}`);
    await run('npm', ['install', '-g', spec]);
    if (isRouter) await startNative9Router(projectDir, { restart: true }).catch((e) => sendLog(`[native] 9router restart: ${e.message}`));
    else await restartNativeRuntime(projectDir);
    await syncRuntimeState(projectDir, { full: true }).catch(() => {});
    probeCacheClear();
    return { ok: true, target, spec, mode: 'native' };
  }
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
  // Native projects have no container: the gateway runs as a managed service, so restarting it
  // is `openclaw daemon restart` (which also clears any stale gateway process holding the port).
  if (isNativeProject(projectDir)) {
    sendLog('[native] Restarting gateway service...');
    await restartNativeRuntime(projectDir);
    probeCacheClear(`runtime:${projectDir}`);
    return true;
  }
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

async function writeCoreProject({ projectDir, osChoice, mode, gatewayPort = 18789, routerPort = 20128, userTimezone = 'Asia/Ho_Chi_Minh' }) {
  await fsp.mkdir(projectDir, { recursive: true });
  const openclawHome = join(projectDir, '.openclaw');
  await fsp.mkdir(openclawHome, { recursive: true });
  await fsp.mkdir(join(openclawHome, 'plugin-runtime-deps'), { recursive: true });

  const selectedSkills = ['memory', 'web-search', 'scheduler'];
  const agentMetas = [];
  const common = { channelKey: 'telegram', providerKey: '9router', model: DEFAULT_MODEL, deployMode: mode, osChoice, selectedSkills, skills: dataExport.SKILLS || [], agentMetas, gatewayPort, routerPort, userTimezone };
  const cfg = buildOpenclawJson(common);
  // A core project has no channel account yet. Keep its environment shared/credential-free;
  // writing the literal <your_bot_token> placeholder makes OpenClaw auto-detect Telegram and
  // emit a misleading "plugin not enabled" warning before the user has created any bot.
  const env = buildEnvFileContent({ ...common, apiKey: '', botToken: '', isSharedEnv: true });
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
// ── Host control ────────────────────────────────────────────────────────────────
// The bot runs inside a container: it has no view of the host desktop and cannot start a
// program there, which is why asking it to open TeamViewer gets a refusal. The installer,
// though, already runs ON the host and already spawns processes (it launches Chrome). This
// exposes that ability to the bot over a small HTTP service.
//
// Reachability: the dashboard itself binds to 127.0.0.1, which a container cannot reach, so
// this listens on the Docker bridge address as well — the same approach the Chrome relay
// uses, private to this machine and not routable from outside.
//
// Everything is gated: the service only starts when hostControl.enabled is true, every
// request needs the per-project token, and `open` accepts a key from the operator's own app
// list rather than an arbitrary command line. Opening apps on the host is a real capability,
// so it stays opt-in and enumerable instead of a general shell.
const HOST_CONTROL_PORT = 18795;
let _hostControlServer = null;
// The project the running host-control service serves. Tracked separately from the server
// singleton so enabling from a different (connected) project re-points the service without a
// restart — the request handler reads config from THIS dir, not a value captured at first-start.
let _hostControlProjectDir = null;

function hostControlConfigPath(projectDir) {
  return join(projectDir, '.openclaw', 'host-control.json');
}

/** Common install locations, so the app list is useful before anyone edits it. */
function detectHostApps() {
  const apps = {};
  const add = (key, candidates) => {
    for (const candidate of candidates) {
      if (candidate && existsSync(candidate)) {
        apps[key] = candidate;
        return;
      }
    }
  };
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || join(os.homedir(), 'AppData', 'Local');
    add('teamviewer', [join(pf, 'TeamViewer', 'TeamViewer.exe'), join(pf86, 'TeamViewer', 'TeamViewer.exe')]);
    add('chrome', [join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'), join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe')]);
    add('zalo', [join(local, 'Programs', 'Zalo', 'Zalo.exe'), join(local, 'Zalo', 'Zalo.exe')]);
    add('explorer', ['C:\\Windows\\explorer.exe']);
    add('notepad', ['C:\\Windows\\System32\\notepad.exe']);
  } else if (process.platform === 'darwin') {
    add('teamviewer', ['/Applications/TeamViewer.app']);
    add('chrome', ['/Applications/Google Chrome.app']);
    add('zalo', ['/Applications/Zalo.app']);
    add('finder', ['/System/Library/CoreServices/Finder.app']);
  }
  return apps;
}

/** Resolve an executable on PATH synchronously (returns absolute path or ''). */
function whichSync(name) {
  try {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    const out = execFileSync(finder, [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const hits = String(out).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (process.platform !== 'win32') return hits[0] || '';
    // `where claude` lists the extensionless npm shim FIRST — a shell script Windows cannot spawn
    // ("spawn ...\\npm\\claude ENOENT"), which is how an allow-listed CLI ended up unusable for the
    // bot. Prefer something Windows can actually execute.
    const rank = (f) => {
      const ext = extname(f).toLowerCase();
      const order = ['.exe', '.cmd', '.bat', '.com', '.ps1'];
      const idx = order.indexOf(ext);
      return idx === -1 ? order.length : idx;
    };
    return [...hits].sort((a, b) => rank(a) - rank(b))[0] || '';
  } catch (_) {
    return '';
  }
}

/**
 * What to actually spawn for an allow-listed command. Windows needs the indirection:
 *  - the path may be the extensionless npm shim (a shell script) — try the real siblings;
 *  - a `.cmd`/`.bat` shim cannot be spawned without a shell on current Node, so read it and run
 *    what it points at (`…\pkg\bin\x.exe`, or node + a cli.js) directly.
 * Keeping shell:false matters: the bot supplies the arguments, and a shell would let one of them
 * become a second command.
 */
function resolveHostExecutable(bin) {
  if (process.platform !== 'win32') return { file: bin, prefixArgs: [] };
  let target = bin;
  if (!extname(target)) {
    const candidate = ['.exe', '.cmd', '.bat'].map((ext) => target + ext).find((f) => existsSync(f));
    if (candidate) target = candidate;
  }
  const ext = extname(target).toLowerCase();
  if (ext !== '.cmd' && ext !== '.bat') return { file: target, prefixArgs: [] };
  try {
    const shim = readFileSync(target, 'utf8');
    const dir = dirname(target);
    const expand = (p) => resolve(dir, p.replace(/%~?dp0%\\?/gi, '').replace(/^\\+/, ''));
    const exeRef = shim.match(/"([^"\n]*?\.exe)"/i);
    if (exeRef) {
      const exe = expand(exeRef[1]);
      if (existsSync(exe)) return { file: exe, prefixArgs: [] };
    }
    const jsRef = shim.match(/"([^"\n]*?\.js)"/i);
    if (jsRef) {
      const js = expand(jsRef[1]);
      if (existsSync(js)) return { file: process.execPath, prefixArgs: [js] };
    }
  } catch (_) {}
  return { file: target, prefixArgs: [] };
}

/**
 * CLI tools the bot may RUN (not just open) via /api/host/exec — output is captured and
 * returned. Kept as a name→path allow-list, mirroring detectHostApps: the executable is fixed,
 * only allow-listed names run. Auto-detects Claude Code CLI; add more by editing
 * `.openclaw/host-control.json` → `commands`.
 */
function detectHostCommands() {
  const commands = {};
  const claude = whichSync('claude');
  if (claude) commands.claude = claude;
  return commands;
}

/**
 * Extra capabilities the operator grants together with PC control: seeing the screen
 * (screenshot / screen recording) and running scripts through node or the Codex CLI.
 *
 * Kept out of detectHostCommands() on purpose. That one is the default list every project gets
 * as soon as the dashboard reads host-control state; these are only merged in when the operator
 * actually flips PC control on, so nothing is granted before they ask for it. `node` in
 * particular runs arbitrary code, which is why it takes an explicit act.
 */
function detectHostCapabilityCommands() {
  const commands = {};
  // The installer is itself node, so this path is guaranteed to exist and to be the same
  // interpreter the native bot runs under (the one macOS will attach the screen permission to).
  commands.node = process.execPath;
  for (const name of ['npx', 'codex', 'claude', 'ffmpeg']) {
    const bin = whichSync(name);
    if (bin) commands[name] = bin; // ffmpeg = screen recording on Linux/macOS
  }
  // The Codex CLI usually is not on PATH — it ships inside the desktop app. With it allow-listed
  // the bot can hand a job to Codex headlessly (`codex exec "…"`) and read the answer back.
  if (!commands.codex) {
    const bundledCodex = resolveCodexCli(detectCodexApp());
    if (bundledCodex) commands.codex = bundledCodex;
  }
  if (process.platform === 'darwin') {
    // Both a screenshot (`-x`) and a screen recording (`-v -V <secs>`) tool.
    if (existsSync('/usr/sbin/screencapture')) commands.screencapture = '/usr/sbin/screencapture';
  } else if (process.platform === 'linux') {
    for (const name of ['gnome-screenshot', 'spectacle', 'scrot', 'import']) {
      const bin = whichSync(name);
      if (bin) { commands.screenshot = bin; break; }
    }
  }
  return commands;
}

/**
 * Merge the capability commands into the project's allow-list, and report what was added so the
 * dashboard can name it. Existing entries are left alone: an operator who pointed `node` at a
 * specific interpreter keeps that path.
 */
function grantHostCapabilities(cfg) {
  const detected = detectHostCapabilityCommands();
  const added = [];
  cfg.commands = cfg.commands || {};
  for (const [name, bin] of Object.entries(detected)) {
    if (!cfg.commands[name]) {
      cfg.commands[name] = bin;
      added.push(name);
    }
  }
  // Desktop actions (/api/host/ui) come with the same grant: screenshot, pointer, keyboard,
  // clipboard, windows. Built in, so they work on a machine with no Codex and no extra tools —
  // on Linux they lean on xdotool/scrot, which the endpoint reports if missing.
  if (cfg.ui !== true) {
    cfg.ui = true;
    added.push('desktop actions (screenshot/click/type)');
  }
  return added;
}

// Mouse/keyboard/screen control comes from the Codex desktop app's own `computer-use` plugin.
// The bot reaches it by running `codex exec "<task>"`, which is a normal allow-listed command —
// no OpenClaw-side harness, no second agent, no gateway restart. All this code has to do is make
// sure the desktop app itself has computer-use installed and wired.
//
/** Where the desktop app that ships the Codex CLI + computer-use bundle lives. */
function detectCodexApp() {
  const candidates = process.platform === 'darwin'
    ? [
      { app: '/Applications/Codex.app', bundle: '/Applications/Codex.app/Contents/Resources/plugins/openai-bundled' },
      { app: '/Applications/ChatGPT.app', bundle: '/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled' },
    ]
    : process.platform === 'win32'
      ? [
        { app: join(process.env.LOCALAPPDATA || join(os.homedir(), 'AppData', 'Local'), 'Programs', 'Codex'), bundle: '' },
        { app: join(process.env.LOCALAPPDATA || join(os.homedir(), 'AppData', 'Local'), 'Programs', 'ChatGPT'), bundle: '' },
      ]
      : [];
  for (const candidate of candidates) {
    if (existsSync(candidate.app)) {
      return { present: true, app: candidate.app, bundle: candidate.bundle && existsSync(candidate.bundle) ? candidate.bundle : '' };
    }
  }
  return { present: false, app: '', bundle: '' };
}

/**
 * Find a marketplace the Codex app-server has ALREADY registered that carries the computer-use
 * plugin, by reading its own `~/.codex/config.toml`.
 *
 * This matters because auto-install refuses to add new sources: pointing the plugin at a
 * marketplace directory it has not discovered fails with "auto-install only uses marketplaces
 * Codex app-server has already discovered … run /codex computer-use install". Naming a discovered
 * marketplace instead keeps provisioning fully automatic.
 */
function detectCodexMarketplace() {
  const codexHome = process.env.CODEX_HOME || join(getRealHomedir(), '.codex');
  const configPath = join(codexHome, 'config.toml');
  if (!existsSync(configPath)) return null;
  let toml = '';
  try {
    toml = fs.readFileSync(configPath, 'utf8');
  } catch (_) {
    return null;
  }
  // Minimal line-based TOML read: [marketplaces.<name>] headers and their `source = "..."`. A full
  // TOML parser is not worth pulling in for two fields of someone else's config.
  let name = '';
  for (const rawLine of toml.split(/\r?\n/)) {
    const line = rawLine.trim();
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      const section = header[1];
      name = section.startsWith('marketplaces.') ? section.slice('marketplaces.'.length).replace(/^["']|["']$/g, '') : '';
      continue;
    }
    if (!name) continue;
    const source = (line.match(/^source\s*=\s*"([^"]+)"$/) || [])[1];
    if (source && existsSync(join(source, 'plugins', 'computer-use'))) return { name, source };
  }
  return null;
}

/** The Codex CLI that ships inside the desktop app (or one on PATH). */
function resolveCodexCli(app) {
  const bundled = app && app.app ? join(app.app, 'Contents', 'Resources', 'codex') : '';
  if (bundled && existsSync(bundled)) return bundled;
  return whichSync('codex');
}

/**
 * Last mile on the Codex side: the OpenClaw plugin can only USE computer-use, it cannot install it
 * into the desktop app. Two things have to be true there, and both are fixable with the app's own
 * CLI (verified on a real machine):
 *  - the `computer-use` plugin is installed from a discovered marketplace, and
 *  - the `computer-use` MCP server points at that installed plugin. A stale global entry (left by
 *    an earlier manual attempt) shadows the plugin's own and exposes zero tools, which surfaces as
 *    the confusing "Computer Use is ready" with nothing behind it.
 */
async function ensureCodexComputerUsePlugin(app, marketplace) {
  const result = { cli: resolveCodexCli(app), pluginInstalled: false, installedNow: false, mcpRepaired: false };
  if (!result.cli || !marketplace) return result;
  const list = await runCapture(result.cli, ['plugin', 'list'], { shell: false }).catch(() => null);
  if (!list) return result;
  const ref = `computer-use@${marketplace.name}`;
  const row = `${list.stdout || ''}\n${list.stderr || ''}`.split(/\r?\n/).find((line) => line.trim().startsWith(ref));
  if (!row) return result;
  result.pluginInstalled = /\binstalled\b/.test(row) && !/not installed/.test(row);
  if (!result.pluginInstalled) {
    sendLog(`[computer-use] Cài plugin ${ref} vào app Codex…`);
    const add = await runCapture(result.cli, ['plugin', 'add', ref], { shell: false }).catch((err) => ({ code: 1, stderr: err.message }));
    result.installedNow = add.code === 0;
    if (!result.installedNow) result.error = (add.stderr || add.stdout || '').trim().split(/\r?\n/).slice(-2).join(' ');
    else result.pluginInstalled = true;
  }
  // Repair the MCP registration only when it clearly is NOT the plugin's own (its cwd lives under
  // the plugin cache). Removing the global entry lets the plugin-provided server take over.
  const mcp = await runCapture(result.cli, ['mcp', 'get', 'computer-use'], { shell: false }).catch(() => null);
  const mcpText = mcp ? `${mcp.stdout || ''}${mcp.stderr || ''}` : '';
  if (mcpText && !/plugins\/cache\//.test(mcpText)) {
    sendLog('[computer-use] Gỡ khai báo MCP computer-use cũ (trỏ sai chỗ) để dùng bản của plugin…');
    const removed = await runCapture(result.cli, ['mcp', 'remove', 'computer-use'], { shell: false }).catch(() => ({ code: 1 }));
    result.mcpRepaired = removed.code === 0;
  }
  return result;
}

/**
 * Drop a tiny wrapper next to each workspace so GUI hand-off is one fixed command.
 *
 * Relying on the model to remember `--sandbox danger-full-access` does not work: a running session
 * still holds the TOOLS.md it loaded at session start, so a bot mid-conversation keeps calling
 * plain `codex exec`, gets "Computer Use was not approved to use <app>", and then invents a reason
 * (observed twice: it told the operator to grant Screen Recording, which was already granted).
 * With the wrapper the flags live on disk instead of in the prompt.
 */
async function writeCodexTaskScript(projectDir, cliPath) {
  const openclawDir = join(projectDir, '.openclaw');
  if (!existsSync(openclawDir) || !cliPath) return '';
  const body = [
    '#!/bin/sh',
    '# Managed by create-openclaw-bot — hand a desktop/GUI job to Codex and print its answer.',
    '# Usage: pc-task.sh "mở TeamViewer và đọc ID trên màn hình"',
    '# The sandbox flag is REQUIRED: the default read-only sandbox makes Codex refuse computer-use',
    '# with "Computer Use was not approved to use <app>".',
    'if [ $# -eq 0 ]; then echo "usage: pc-task.sh \\"việc cần làm\\"" >&2; exit 2; fi',
    `exec ${JSON.stringify(cliPath)} exec --skip-git-repo-check --sandbox danger-full-access "$@"`,
    '',
  ].join('\n');
  let written = '';
  for (const entry of await fsp.readdir(openclawDir).catch(() => [])) {
    if (!entry.startsWith('workspace')) continue;
    const binDir = join(openclawDir, entry, 'bin');
    await fsp.mkdir(binDir, { recursive: true }).catch(() => {});
    const path = join(binDir, 'pc-task.sh');
    await fsp.writeFile(path, body, 'utf8').catch(() => {});
    await fsp.chmod(path, 0o755).catch(() => {});
    written = path;
  }
  return written;
}

/**
 * macOS/Windows privacy panes for the permissions PC control needs. The OS never lets an app
 * grant these for you (that is the point of TCC), so the best we can do is take the operator
 * straight to the right pane and — for screen capture — poke the API so the system prompt appears.
 */
function openPrivacyPane(kind) {
  const macPanes = {
    screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    automation: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
    files: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
  };
  const winPanes = {
    screen: 'ms-settings:privacy-general',
    accessibility: 'ms-settings:easeofaccess',
    automation: 'ms-settings:privacy-general',
    files: 'ms-settings:privacy-broadfilesystemaccess',
  };
  if (process.platform === 'darwin') {
    const url = macPanes[kind] || macPanes.screen;
    spawnDetached('open', [url]);
    return { opened: true, pane: url };
  }
  if (process.platform === 'win32') {
    const url = winPanes[kind] || winPanes.screen;
    spawnDetached('cmd', ['/c', 'start', '', url]);
    return { opened: true, pane: url };
  }
  return { opened: false, pane: '', reason: 'unsupported-platform' };
}

/**
 * Ask macOS for a screenshot. First call raises the Screen Recording prompt for THIS node binary
 * (the same one the native bot runs under); afterwards a non-empty file means the permission is
 * granted, and a failure/empty file means it is not.
 */
async function probeScreenPermission() {
  if (process.platform !== 'darwin') return { supported: false, granted: null };
  const shot = join(os.tmpdir(), `openclaw-screen-probe-${Date.now()}.png`);
  try {
    await run('/usr/sbin/screencapture', ['-x', '-t', 'png', shot], { shell: false });
  } catch (_) {
    // non-zero exit → denied (screencapture exits with an error when TCC blocks it)
  }
  let granted = false;
  try {
    granted = existsSync(shot) && (await fsp.stat(shot)).size > 1024;
  } catch (_) {
    granted = false;
  }
  await fsp.unlink(shot).catch(() => {});
  return { supported: true, granted };
}

async function readHostControlConfig(projectDir) {
  const path = hostControlConfigPath(projectDir);
  let cfg = {};
  try {
    if (existsSync(path)) cfg = JSON.parse(await fsp.readFile(path, 'utf8'));
  } catch (_) {
    cfg = {};
  }
  let changed = false;
  if (typeof cfg.enabled !== 'boolean') {
    cfg.enabled = false;
    changed = true;
  }
  if (!cfg.token) {
    cfg.token = _require('crypto').randomBytes(24).toString('hex');
    changed = true;
  }
  if (!cfg.apps || typeof cfg.apps !== 'object') {
    cfg.apps = detectHostApps();
    changed = true;
  }
  if (!cfg.commands || typeof cfg.commands !== 'object') {
    cfg.commands = detectHostCommands();
    changed = true;
  }
  if (changed) {
    await fsp.mkdir(dirname(path), { recursive: true }).catch(() => {});
    await fsp.writeFile(path, JSON.stringify(cfg, null, 2), 'utf8').catch(() => {});
  }
  return cfg;
}

/** Launch a host program detached, so it outlives this request. */
function spawnDetached(command, args) {
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: false });
  child.on('error', (err) => sendLog(`[host-control] Không chạy được "${command}": ${err.message}`));
  child.unref();
}

function openHostApp(target) {
  if (process.platform === 'win32') {
    // `start` needs a shell; the empty "" is the window title cmd expects before the path.
    spawnDetached('cmd', ['/c', 'start', '', target]);
    return;
  }
  if (process.platform === 'darwin') {
    spawnDetached('open', [target]);
    return;
  }
  spawnDetached('xdg-open', [target]);
}

/**
 * Run an allow-listed CLI (e.g. Claude Code) and return its output. Unlike openHostApp this is
 * NOT detached: we wait for it, capture stdout/stderr (capped), and enforce a timeout. No shell
 * (shell:false) so args are literal — no injection; the executable is fixed by the allow-list.
 */
function runHostCommand(res, name, bin, args, input, timeoutMs) {
  const MAX_OUT = 200_000; // ~200 KB cap per stream, so a runaway process can't flood the reply
  return new Promise((resolveP) => {
    let out = '';
    let err = '';
    let settled = false;
    const finish = (payload, status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      json(res, payload, status);
      resolveP();
    };
    let child;
    try {
      const target = resolveHostExecutable(bin);
      child = spawn(target.file, [...target.prefixArgs, ...args], { shell: false, windowsHide: true });
    } catch (e) {
      return finish({ ok: false, error: e.message }, 500);
    }
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_) {}
      finish({ ok: false, error: `timeout after ${timeoutMs}ms`, timedOut: true, stdout: out.slice(0, MAX_OUT), stderr: err.slice(0, MAX_OUT) }, 504);
    }, timeoutMs);
    child.stdout?.on('data', (d) => { if (out.length < MAX_OUT) out += d.toString(); });
    child.stderr?.on('data', (d) => { if (err.length < MAX_OUT) err += d.toString(); });
    child.on('error', (e) => finish({ ok: false, error: e.message }, 500));
    child.on('close', (code) => {
      sendLog(`[host-control] Đã chạy "${name}" (exit ${code}).`);
      finish({ ok: code === 0, command: name, code, stdout: out.slice(0, MAX_OUT), stderr: err.slice(0, MAX_OUT) }, 200);
    });
    if (input != null) { try { child.stdin.write(input); } catch (_) {} }
    try { child.stdin.end(); } catch (_) {}
  });
}

/**
 * Desktop actions for the bot: see the screen, move and click, type, read the clipboard, list and
 * focus windows. The bot runs in a container with no desktop of its own, so the installer — which
 * already runs on the operator's machine and already opens apps for it — performs them.
 *
 * No native modules: the approach follows the dependency-free tools (and Anthropic's own
 * computer-use reference, which drives xdotool + a screenshot binary):
 *   Windows  a version-stamped PowerShell helper (user32 P/Invoke, SendKeys, System.Drawing)
 *   macOS    screencapture + osascript/System Events + pbcopy/pbpaste
 *   Linux    xdotool + scrot|import|gnome-screenshot|spectacle + xclip|wl-copy
 * Whatever the OS, the bot sends the same JSON and gets the same shape back, so its instructions
 * do not fork per platform.
 *
 * Windows note: input injection and screen capture need a real desktop session. When the installer
 * itself was started over SSH there is none, and the capture fails — the error says so instead of
 * leaking a raw Win32Exception.
 */
const HOST_UI_ACTIONS = new Set([
  'screenshot', 'screen_size', 'mouse_move', 'click', 'drag', 'scroll',
  'type', 'key', 'clipboard_get', 'clipboard_set', 'windows', 'focus',
]);

function hostUiScriptPath(projectDir) {
  return join(projectDir, '.openclaw', 'host-ui.ps1');
}

async function ensureHostUiScript(projectDir) {
  const path = hostUiScriptPath(projectDir);
  const stamp = `# OpenClaw host UI helper — version ${HOST_UI_PS1_VERSION}`;
  try {
    if (existsSync(path) && (await fsp.readFile(path, 'utf8')).startsWith(stamp)) return path;
  } catch (_) {}
  await fsp.mkdir(dirname(path), { recursive: true }).catch(() => {});
  await fsp.writeFile(path, HOST_UI_PS1, 'utf8');
  return path;
}

function firstExistingCommand(names) {
  for (const name of names) {
    const bin = whichSync(name);
    if (bin) return { name, bin };
  }
  return null;
}

async function hostUiScreenshotTarget(projectDir) {
  const dir = join(projectDir, '.openclaw', 'media', 'host-ui');
  await fsp.mkdir(dir, { recursive: true }).catch(() => {});
  // Keep the folder from growing forever: the bot takes a lot of these.
  try {
    const files = (await fsp.readdir(dir)).filter((f) => f.endsWith('.png')).sort();
    for (const stale of files.slice(0, Math.max(0, files.length - 20))) {
      await fsp.rm(join(dir, stale), { force: true }).catch(() => {});
    }
  } catch (_) {}
  const name = `shot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  return { hostPath: join(dir, name), containerPath: `/home/node/project/.openclaw/media/host-ui/${name}` };
}

async function runHostUiWindows(projectDir, action, body, shot) {
  const script = await ensureHostUiScript(projectDir);
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Action', action];
  const push = (flag, value) => { if (value !== undefined && value !== null && value !== '') args.push(flag, String(value)); };
  push('-X', body.x);
  push('-Y', body.y);
  push('-ToX', body.toX);
  push('-ToY', body.toY);
  push('-Amount', body.amount);
  push('-Text', body.text);
  push('-Button', body.button);
  push('-Clicks', body.clicks);
  push('-Title', body.title);
  if (shot) push('-Path', shot.hostPath);
  const r = await runCapture('powershell', args, { shell: false, timeout: 30000 });
  const parsed = parseJsonText(String(r.stdout || '').trim(), null);
  if (parsed) return parsed;
  const err = String(r.stderr || r.stdout || '').trim();
  if (/Win32Exception|CopyFromScreen|handle is invalid/i.test(err)) {
    return { ok: false, error: 'no desktop session available. The installer must run in the logged-in desktop session (not over SSH) for screen capture and input to work.' };
  }
  return { ok: false, error: err.split('\n')[0] || `powershell exited ${r.code}` };
}

async function runHostUiMac(action, body, shot) {
  const osa = (script) => runCapture('osascript', ['-e', script], { shell: false, timeout: 20000 });
  const point = () => `{${Number(body.x) || 0}, ${Number(body.y) || 0}}`;
  switch (action) {
    case 'screenshot': {
      const r = await runCapture('screencapture', ['-x', shot.hostPath], { shell: false, timeout: 20000 });
      return r.code === 0 ? { ok: true, path: shot.hostPath } : { ok: false, error: String(r.stderr || 'screencapture failed').trim() };
    }
    case 'screen_size': {
      const r = await osa('tell application "Finder" to get bounds of window of desktop');
      const nums = String(r.stdout || '').trim().split(/\s*,\s*/).map(Number);
      return nums.length === 4 ? { ok: true, width: nums[2], height: nums[3] } : { ok: false, error: 'could not read screen bounds' };
    }
    case 'mouse_move':
    case 'click': {
      // System Events can click at a point; a plain move has no equivalent, so a move is a click
      // target set-up only. Accessibility permission is required (System Settings → Privacy).
      const clicks = Math.max(1, Number(body.clicks) || 1);
      if (action === 'mouse_move') return { ok: true, note: 'macOS has no pointer-move without a click; pass x/y to click instead', x: body.x, y: body.y };
      for (let i = 0; i < clicks; i++) {
        const r = await osa(`tell application "System Events" to click at ${point()}`);
        if (r.code !== 0) return { ok: false, error: String(r.stderr || '').trim() || 'click failed (grant Accessibility permission)' };
      }
      return { ok: true, button: 'left', clicks };
    }
    case 'type': {
      const text = String(body.text || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const r = await osa(`tell application "System Events" to keystroke "${text}"`);
      return r.code === 0 ? { ok: true, typed: String(body.text || '').length } : { ok: false, error: String(r.stderr || '').trim() };
    }
    case 'key': {
      const map = { enter: 'return', esc: 'escape', pageup: 'page up', pagedown: 'page down' };
      for (const combo of String(body.text || '').split(/\s+/).filter(Boolean)) {
        const parts = combo.toLowerCase().split('+').map((p) => p.trim()).filter(Boolean);
        const key = map[parts[parts.length - 1]] || parts[parts.length - 1];
        const mods = parts.slice(0, -1).map((m) => ({ ctrl: 'control down', control: 'control down', cmd: 'command down', meta: 'command down', alt: 'option down', option: 'option down', shift: 'shift down' })[m]).filter(Boolean);
        const using = mods.length ? ` using {${mods.join(', ')}}` : '';
        const named = ['return', 'escape', 'tab', 'space', 'delete', 'up', 'down', 'left', 'right', 'home', 'end', 'page up', 'page down'];
        const script = named.includes(key)
          ? `tell application "System Events" to key code ${{ return: 36, escape: 53, tab: 48, space: 49, delete: 51, up: 126, down: 125, left: 123, right: 124, home: 115, end: 119, 'page up': 116, 'page down': 121 }[key]}${using}`
          : `tell application "System Events" to keystroke "${key}"${using}`;
        const r = await osa(script);
        if (r.code !== 0) return { ok: false, error: String(r.stderr || '').trim() };
      }
      return { ok: true, keys: body.text };
    }
    case 'scroll': {
      const amount = Number(body.amount) || 3;
      const dir = amount < 0 ? 121 : 116; // page down / page up
      for (let i = 0; i < Math.abs(amount); i++) await osa(`tell application "System Events" to key code ${dir}`);
      return { ok: true, amount };
    }
    case 'clipboard_get': {
      const r = await runCapture('pbpaste', [], { shell: false, timeout: 10000 });
      return { ok: true, text: String(r.stdout || '') };
    }
    case 'clipboard_set': {
      const r = await runCapture('sh', ['-c', 'pbcopy'], { shell: false, timeout: 10000, input: String(body.text || '') });
      return r.code === 0 ? { ok: true, length: String(body.text || '').length } : { ok: false, error: 'pbcopy failed' };
    }
    case 'windows': {
      const r = await osa('tell application "System Events" to get name of every process whose background only is false');
      const list = String(r.stdout || '').trim().split(/\s*,\s*/).filter(Boolean).map((title) => ({ title, process: title }));
      return { ok: true, windows: list };
    }
    case 'focus': {
      const title = String(body.title || '').replace(/"/g, '');
      if (!title) return { ok: false, error: 'focus needs a title' };
      const r = await osa(`tell application "${title}" to activate`);
      return r.code === 0 ? { ok: true, focused: title } : { ok: false, error: String(r.stderr || '').trim() || `no app named ${title}` };
    }
    default:
      return { ok: false, error: `unsupported on macOS: ${action}` };
  }
}

async function runHostUiLinux(action, body, shot) {
  const xdo = whichSync('xdotool');
  const need = (bin, hint) => ({ ok: false, error: `${hint} needs ${bin}; install it (e.g. apt install ${bin})` });
  switch (action) {
    case 'screenshot': {
      const tool = firstExistingCommand(['gnome-screenshot', 'scrot', 'spectacle', 'import']);
      if (!tool) return need('scrot', 'screenshot');
      const argv = tool.name === 'gnome-screenshot' ? ['-f', shot.hostPath]
        : tool.name === 'spectacle' ? ['-b', '-n', '-o', shot.hostPath]
          : tool.name === 'import' ? ['-window', 'root', shot.hostPath]
            : [shot.hostPath];
      const r = await runCapture(tool.bin, argv, { shell: false, timeout: 20000 });
      return r.code === 0 ? { ok: true, path: shot.hostPath, tool: tool.name } : { ok: false, error: String(r.stderr || 'capture failed').trim() };
    }
    case 'screen_size': {
      if (!xdo) return need('xdotool', 'screen_size');
      const r = await runCapture(xdo, ['getdisplaygeometry'], { shell: false, timeout: 10000 });
      const [w, h] = String(r.stdout || '').trim().split(/\s+/).map(Number);
      return w && h ? { ok: true, width: w, height: h } : { ok: false, error: 'could not read display geometry' };
    }
    case 'mouse_move':
    case 'click':
    case 'drag':
    case 'scroll':
    case 'type':
    case 'key':
    case 'windows':
    case 'focus': {
      if (!xdo) return need('xdotool', action);
      const button = { left: 1, middle: 2, right: 3 }[String(body.button || 'left')] || 1;
      const argvFor = {
        mouse_move: ['mousemove', String(body.x ?? 0), String(body.y ?? 0)],
        click: ['mousemove', String(body.x ?? 0), String(body.y ?? 0), 'click', '--repeat', String(Math.max(1, Number(body.clicks) || 1)), String(button)],
        drag: ['mousemove', String(body.x ?? 0), String(body.y ?? 0), 'mousedown', '1', 'mousemove', String(body.toX ?? 0), String(body.toY ?? 0), 'mouseup', '1'],
        scroll: ['click', '--repeat', String(Math.max(1, Math.abs(Number(body.amount) || 3))), (Number(body.amount) || 3) < 0 ? '5' : '4'],
        type: ['type', '--delay', '12', '--', String(body.text || '')],
        key: ['key', ...String(body.text || '').split(/\s+/).filter(Boolean)],
        windows: ['search', '--onlyvisible', '--name', '.'],
        focus: ['search', '--onlyvisible', '--name', String(body.title || ''), 'windowactivate'],
      }[action];
      const r = await runCapture(xdo, argvFor, { shell: false, timeout: 20000 });
      if (action === 'windows') {
        const ids = String(r.stdout || '').trim().split(/\s+/).filter(Boolean).slice(0, 40);
        const titles = [];
        for (const id of ids) {
          const t = await runCapture(xdo, ['getwindowname', id], { shell: false, timeout: 5000 });
          const title = String(t.stdout || '').trim();
          if (title) titles.push({ title, id });
        }
        return { ok: true, windows: titles };
      }
      return r.code === 0 ? { ok: true, action } : { ok: false, error: String(r.stderr || '').trim() || `xdotool exited ${r.code}` };
    }
    case 'clipboard_get': {
      const tool = firstExistingCommand(['wl-paste', 'xclip', 'xsel']);
      if (!tool) return need('xclip', 'clipboard_get');
      const argv = tool.name === 'xclip' ? ['-o', '-selection', 'clipboard'] : tool.name === 'xsel' ? ['-b', '-o'] : [];
      const r = await runCapture(tool.bin, argv, { shell: false, timeout: 10000 });
      return { ok: true, text: String(r.stdout || '') };
    }
    case 'clipboard_set': {
      const tool = firstExistingCommand(['wl-copy', 'xclip', 'xsel']);
      if (!tool) return need('xclip', 'clipboard_set');
      const argv = tool.name === 'xclip' ? ['-selection', 'clipboard'] : tool.name === 'xsel' ? ['-b', '-i'] : [];
      const r = await runCapture(tool.bin, argv, { shell: false, timeout: 10000, input: String(body.text || '') });
      return r.code === 0 ? { ok: true, length: String(body.text || '').length } : { ok: false, error: `${tool.name} failed` };
    }
    default:
      return { ok: false, error: `unsupported on Linux: ${action}` };
  }
}

async function runHostUi(projectDir, body = {}) {
  const action = String(body.action || '').trim();
  if (!HOST_UI_ACTIONS.has(action)) {
    return { status: 400, payload: { ok: false, error: `unknown action: ${action || '(none)'}`, actions: [...HOST_UI_ACTIONS] } };
  }
  const shot = action === 'screenshot' ? await hostUiScreenshotTarget(projectDir) : null;
  let result;
  try {
    if (process.platform === 'win32') result = await runHostUiWindows(projectDir, action, body, shot);
    else if (process.platform === 'darwin') result = await runHostUiMac(action, body, shot);
    else result = await runHostUiLinux(action, body, shot);
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  if (shot && result?.ok) {
    // The project folder is bind-mounted into the container, so hand back the path the bot can
    // actually open — otherwise it gets a Windows path it cannot read and reports failure.
    result.path = shot.hostPath;
    result.containerPath = shot.containerPath;
    result.bytes = existsSync(shot.hostPath) ? (await fsp.stat(shot.hostPath)).size : 0;
  }
  sendLog(`[host-control] UI "${action}" → ${result?.ok ? 'ok' : `lỗi: ${result?.error || 'unknown'}`}`);
  return { status: result?.ok ? 200 : 500, payload: result };
}

async function handleHostControl(req, res, projectDir) {
  const cfg = await readHostControlConfig(projectDir);
  const url = new URL(req.url, 'http://localhost');
  const presented = req.headers['x-openclaw-token'] || url.searchParams.get('token') || '';
  if (!cfg.enabled) return json(res, { ok: false, error: 'host control is disabled' }, 403);
  if (presented !== cfg.token) return json(res, { ok: false, error: 'invalid token' }, 401);

  if (url.pathname === '/api/browser/start-chrome' && req.method === 'POST') {
    try {
      return json(res, await startChromeDebug());
    } catch (err) {
      return json(res, { ok: false, error: err.message }, err.status || 500);
    }
  }
  if (url.pathname === '/api/host/apps' && req.method === 'GET') {
    return json(res, { ok: true, apps: Object.keys(cfg.apps || {}), commands: Object.keys(cfg.commands || {}), platform: process.platform });
  }
  if (url.pathname === '/api/host/ui' && req.method === 'POST') {
    // Part of PC control, but its own switch: seeing the screen and moving the pointer is a bigger
    // step than opening an app, so it only answers once the operator has granted capabilities.
    if (cfg.ui !== true) {
      return json(res, { ok: false, error: 'desktop actions are not granted. Ask the operator to press "Điều khiển máy" again in the dashboard (that writes ui:true).' }, 403);
    }
    const body = await readJson(req).catch(() => ({}));
    const { status, payload } = await runHostUi(projectDir, body || {});
    return json(res, payload, status);
  }
  if (url.pathname === '/api/host/exec' && req.method === 'POST') {
    const body = await readJson(req).catch(() => ({}));
    const name = String(body.command || '').trim().toLowerCase();
    if (!name) return json(res, { ok: false, error: 'missing "command"' }, 400);
    const bin = (cfg.commands || {})[name];
    if (!bin) {
      return json(res, {
        ok: false,
        error: `"${name}" is not in this machine's command list`,
        commands: Object.keys(cfg.commands || {}),
      }, 404);
    }
    // Args are passed literally (spawn with shell:false) so nothing in them is re-interpreted
    // by a shell — the executable is fixed to the allow-listed path, callers cannot pick a
    // different binary or inject a second command.
    const args = Array.isArray(body.args) ? body.args.map((a) => String(a)) : [];
    const input = body.input != null ? String(body.input) : null;
    const timeoutMs = Math.min(Math.max(Number(body.timeoutMs) || 180000, 1000), 600000);
    return runHostCommand(res, name, bin, args, input, timeoutMs);
  }
  if (url.pathname === '/api/host/open' && req.method === 'POST') {
    const body = await readJson(req).catch(() => ({}));
    const key = String(body.app || body.target || '').trim();
    if (!key) return json(res, { ok: false, error: 'missing "app"' }, 400);
    const path = (cfg.apps || {})[key.toLowerCase()];
    if (!path) {
      return json(res, {
        ok: false,
        error: `"${key}" is not in this machine's app list`,
        apps: Object.keys(cfg.apps || {}),
      }, 404);
    }
    openHostApp(path);
    sendLog(`[host-control] Đã mở "${key}" trên máy (${path}).`);
    return json(res, { ok: true, app: key, path });
  }
  return json(res, { ok: false, error: 'unknown endpoint' }, 404);
}

/**
 * Teach every bot in the project how to reach the host-control service, and hand it the
 * token. Written into TOOLS.md as a managed block so flipping the switch off removes it
 * again — a bot that still had the instructions would keep trying an endpoint that now
 * refuses. `host.docker.internal` resolves in the container on every OS because the
 * generated compose maps it to host-gateway.
 */
async function writeHostControlAccess(projectDir, cfg) {
  const openclawDir = join(projectDir, '.openclaw');
  if (!existsSync(openclawDir)) return;
  const native = isNativeProject(projectDir);
  // Native bots run on the host itself; host.docker.internal only resolves from inside a container,
  // so a native bot curling it fails ("could not connect"). Use loopback there instead.
  const base = native ? `http://127.0.0.1:${HOST_CONTROL_PORT}` : `http://host.docker.internal:${HOST_CONTROL_PORT}`;
  const apps = Object.keys(cfg.apps || {});
  const commands = Object.keys(cfg.commands || {});
  const execBlock = commands.length ? [
    '',
    'Chạy một CLI trên máy chủ và LẤY KẾT QUẢ về (chỉ lệnh trong danh sách; trả `{ok,code,stdout,stderr}`).',
    'Dùng để giao việc cho công cụ dòng lệnh, ví dụ Claude Code:',
    '',
    '```sh',
    `curl -s -X POST ${base}/api/host/exec -H "x-openclaw-token: ${cfg.token}" \\`,
    '  -H "content-type: application/json" -d \'{"command":"claude","args":["-p","tóm tắt repo hiện tại"]}\'',
    '```',
    '',
    `Lệnh khả dụng: ${commands.map((c) => `\`${c}\``).join(', ')}. Lệnh mặc định timeout 180s, output tối đa ~200KB/luồng.`,
  ] : [];
  // Desktop actions: one endpoint, same JSON on every OS, so the bot does not need per-platform
  // instructions. Screenshots land in the project folder, which the container already sees.
  const uiBlock = cfg.ui === true ? [
    '',
    '### Thao tác trên màn hình chủ',
    '',
    'Một endpoint duy nhất cho mọi hệ điều hành. Cách làm đúng: **chụp màn hình trước, xem toạ độ, rồi mới click** —',
    'đừng đoán vị trí. Toạ độ tính bằng pixel màn hình, gốc ở góc trên-trái.',
    '',
    '```sh',
    `curl -s -X POST ${base}/api/host/ui -H "x-openclaw-token: ${cfg.token}" \\`,
    '  -H "content-type: application/json" -d \'{"action":"screenshot"}\'',
    '```',
    '',
    'Trả về `containerPath` — **đọc/gửi ảnh bằng đường dẫn đó** (nằm trong project nên bạn thấy được),',
    'kèm `width`/`height` để biết màn hình bao lớn.',
    '',
    'Các action khác (cùng dạng `{"action":...}`):',
    '',
    '- `screen_size` — kích thước màn hình',
    '- `mouse_move` + `x`,`y` — di chuột',
    '- `click` + `x`,`y`, tuỳ chọn `button` (`left`/`right`/`middle`) và `clicks` (2 = double-click)',
    '- `drag` + `x`,`y`,`toX`,`toY` — kéo thả',
    '- `scroll` + `amount` (âm = xuống), tuỳ chọn `x`,`y`',
    '- `type` + `text` — gõ chữ vào cửa sổ đang focus',
    '- `key` + `text` — nhấn tổ hợp, ví dụ `"ctrl+c"`, `"enter"`, `"alt+tab"`; nhiều tổ hợp thì cách nhau bằng space',
    '- `clipboard_get` / `clipboard_set` + `text` — đọc/ghi clipboard',
    '- `windows` — liệt kê cửa sổ đang mở; `focus` + `title` — đưa cửa sổ lên trước',
    '',
    'Nếu trả về lỗi "no desktop session available" thì installer đang chạy ngoài phiên desktop —',
    'nói chủ mở lại installer trong máy, đừng thử cách khác.',
    'Trên Linux, thiếu `xdotool`/`scrot` thì endpoint nói rõ cần cài gì — báo lại cho chủ.',
  ] : [];
  // Screen capture / recording — only advertised when the operator granted the matching tool, so
  // the bot never tries a binary that is not on this machine's allow-list.
  // Windows has no capture binary to allow-list (PowerShell does it inline), so the section shows
  // up there too — a native bot runs the command itself, the allow-list only gates the bridge.
  const hasCapture = commands.includes('screencapture') || commands.includes('screenshot') || commands.includes('ffmpeg') || (native && process.platform === 'win32');
  const captureBlock = hasCapture ? [
    '',
    '### Chụp / quay màn hình',
    '',
    ...(commands.includes('screencapture') ? [
      '- Chụp: `screencapture -x /tmp/shot.png` (thêm `-R x,y,w,h` để chụp một vùng, `-l <windowid>` chụp 1 cửa sổ).',
      '- Quay: `screencapture -v -V 10 /tmp/rec.mov` (quay 10 giây rồi tự dừng).',
    ] : []),
    ...(commands.includes('screenshot') ? ['- Chụp: dùng lệnh `screenshot` (công cụ chụp của desktop này) với đường dẫn file đầu ra.'] : []),
    ...(native && process.platform === 'win32' ? [
      '- Chụp (Windows): `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bm=New-Object Drawing.Bitmap $b.Width,$b.Height; [Drawing.Graphics]::FromImage($bm).CopyFromScreen($b.Location,[Drawing.Point]::Empty,$b.Size); $bm.Save(\'C:\\Temp\\shot.png\')"` (tạo sẵn thư mục đích).',
    ] : []),
    ...(commands.includes('ffmpeg') ? ['- Quay bằng `ffmpeg` khi cần định dạng khác (macOS: `-f avfoundation`, Linux: `-f x11grab`, Windows: `-f gdigrab -i desktop`).'] : []),
    '',
    'Chụp xong thì ĐỌC file ảnh bằng tool đọc ảnh để phân tích, rồi xoá file tạm. Lần đầu macOS sẽ hỏi quyền **Screen Recording** cho `node`: nếu ảnh ra đen/rỗng hoặc lệnh lỗi quyền thì nhờ chủ bấm "Cấp quyền chụp/quay màn hình" trong dashboard, đừng thử vòng khác.',
  ] : [];
  const scriptCommands = commands.filter((c) => c === 'node' || c === 'npx' || c === 'codex' || c === 'claude');
  const scriptBlock = scriptCommands.length ? [
    '',
    '### Chạy script & giao việc cho CLI khác',
    '',
    `Chủ đã cho phép: ${scriptCommands.map((c) => `\`${c}\``).join(', ')} — dùng cho việc tự động hoá nhỏ (ví dụ \`node -e "..."\`, \`node script.js\`).`,
    ...(commands.includes('codex') ? [
      '- Giao việc cho **Codex** (chạy ngầm, lấy kết quả text): `codex exec --skip-git-repo-check "việc cần làm"`. Việc cần nhìn/điều khiển màn hình thì thêm `--sandbox danger-full-access` (xem mục dưới). Lượt này tiêu quota gói ChatGPT của chủ, nên chỉ dùng khi chủ yêu cầu và mô tả việc gọn.',
    ] : []),
    ...(commands.includes('claude') ? [
      '- Giao việc cho **Claude Code**: `claude -p "việc cần làm"` (một lượt, trả stdout).',
    ] : []),
    'Đây là quyền chạy mã tuỳ ý trên máy chủ: chỉ chạy khi chủ yêu cầu rõ, không cài thêm gì, không sửa file ngoài phạm vi được yêu cầu.',
  ] : [];
  const startTag = '<!-- OPENCLAW:HOST_CONTROL:START -->';
  const endTag = '<!-- OPENCLAW:HOST_CONTROL:END -->';
  // NATIVE: the bot runs directly on the host with `exec`, so it opens apps with the OS command —
  // no bridge, no host.docker.internal (which doesn't resolve off-container anyway). DOCKER: the
  // bot is in a container and can't see the desktop, so it must call the installer's host service.
  const nativeBlock = [
    startTag,
    '',
    '## 🖥️ Điều khiển máy của chủ (host control — chế độ native)',
    '',
    'Bạn chạy TRỰC TIẾP trên máy của chủ và có quyền `exec`, nên mở ứng dụng bằng lệnh hệ điều hành — KHÔNG cần service/bridge nào (đừng dùng host.docker.internal hay curl cổng 18795):',
    '',
    '- macOS: `open -a "<Tên app>"` — ví dụ `open -a "TeamViewer"`',
    '- Linux: `xdg-open <app|url>` hoặc chạy binary trực tiếp',
    '- Windows: `cmd /c start "" "<app>"`',
    '',
    apps.length ? `App chủ gợi ý: ${apps.map((a) => `\`${a}\``).join(', ')}.` : 'Chủ chưa liệt kê app — mở theo tên app có trên máy.',
    ...captureBlock,
    ...scriptBlock,
    '',
    ...(commands.includes('codex') ? [
      '### Điều khiển chuột/bàn phím & nhìn màn hình',
      '',
      'Bạn KHÔNG có tool điều khiển GUI. Việc đó giao cho **Codex** — nó có sẵn Computer Use. Dùng ĐÚNG script này (đã cài sẵn cờ cần thiết):',
      '',
      '```sh',
      'bin/pc-task.sh "mở TeamViewer, đọc mật khẩu đang hiện trên màn hình rồi in ra"',
      '```',
      '',
      '⚠️ **Đừng gọi `codex exec` trần.** Mặc định nó chạy sandbox read-only và tự từ chối computer-use với lỗi `Computer Use was not approved to use <app>` — KHÔNG phải do thiếu quyền Screen Recording, đừng bảo chủ đi cấp lại quyền. Script trên đã kèm `--sandbox danger-full-access` (mức `workspace-write` không đủ).',
      '',
      'Codex tự nhìn màn hình, click, gõ phím rồi trả kết quả text về cho bạn; bạn thuật lại cho chủ. Lưu ý:',
      '',
      '- Mô tả việc gọn nhưng đủ (mục tiêu + kết quả cần trả). Mỗi lượt tiêu quota gói ChatGPT của chủ, đừng gọi lung tung.',
      '- Việc GUI có thể chạy lâu: đặt timeout rộng, đừng kết luận thất bại sớm.',
      '- Computer Use từ chối vài app vì an toàn (Terminal, chính app ChatGPT/Codex): lỗi ghi rõ `not allowed to use the app ... for safety reasons` — báo chủ tự làm, đừng lách.',
      '- Điều khiển chuột/bàn phím hiện chỉ chạy trên macOS. Trên Windows/Linux bạn vẫn mở app, chụp màn hình và chạy script được.',
      '- Lỗi thật sự do thiếu quyền hệ điều hành sẽ nói về Screen Recording/Accessibility; chỉ khi đó mới nhờ chủ bấm nút cấp quyền trong dashboard. Luôn trích **nguyên văn** lỗi cho chủ thay vì đoán nguyên nhân.',
      '',
    ] : []),
    'Chỉ mở app, chụp/quay màn hình hoặc điều khiển máy khi chủ yêu cầu rõ. Không tự ý chụp màn hình để "xem thử".',
    '',
    endTag,
    '',
  ].join('\n');
  const dockerBlock = [
    startTag,
    '',
    '## 🖥️ Điều khiển máy của chủ (host control)',
    '',
    'Bạn chạy trong container nên không thấy desktop của chủ. Muốn mở Chrome hay một ứng dụng trên máy thật thì gọi service của installer (chạy trên máy chủ) bằng `exec`:',
    '',
    '```sh',
    `curl -s -X POST ${base}/api/browser/start-chrome -H "x-openclaw-token: ${cfg.token}"`,
    '```',
    '',
    'Mở ứng dụng (chỉ những app có trong danh sách của máy):',
    '',
    '```sh',
    `curl -s -X POST ${base}/api/host/open -H "x-openclaw-token: ${cfg.token}" \\`,
    '  -H "content-type: application/json" -d \'{"app":"teamviewer"}\'',
    '```',
    '',
    'Xem danh sách app đang được phép:',
    '',
    '```sh',
    `curl -s ${base}/api/host/apps -H "x-openclaw-token: ${cfg.token}"`,
    '```',
    '',
    apps.length ? `App khả dụng trên máy này: ${apps.map((a) => `\`${a}\``).join(', ')}.` : 'Máy này chưa khai báo app nào — nhờ chủ thêm vào `.openclaw/host-control.json`.',
    ...execBlock,
    ...uiBlock,
    // Docker only: a screenshot taken on the host lands on the HOST filesystem, which this
    // container cannot read — say so instead of letting the bot hunt for a missing file.
    ...(hasCapture ? [
      '',
      'Chụp/quay màn hình chạy trên MÁY CHỦ nên file ảnh nằm ở ổ đĩa của chủ, container này KHÔNG đọc được. Chụp vào một thư mục đã mount cho bot (nếu có) hoặc nhờ chủ gửi ảnh; đừng đoán nội dung màn hình.',
    ] : []),
    '',
    'Nếu trả về `host control is disabled` thì chủ chưa bật quyền này — nói chủ bật trong dashboard,',
    'đừng cố tìm đường khác. Chỉ mở app hoặc chạy lệnh khi chủ yêu cầu rõ.',
    '',
    endTag,
    '',
  ].join('\n');
  const block = native ? nativeBlock : dockerBlock;
  for (const entry of await fsp.readdir(openclawDir).catch(() => [])) {
    if (!entry.startsWith('workspace')) continue;
    const toolsMd = join(openclawDir, entry, 'TOOLS.md');
    if (!existsSync(toolsMd)) continue;
    const current = await fsp.readFile(toolsMd, 'utf8');
    const withoutBlock = removeManagedBlockFrom(current, 'HOST_CONTROL');
    const next = cfg.enabled
      ? `${withoutBlock.trimEnd()}\n\n${block}`
      : withoutBlock;
    if (next !== current) await fsp.writeFile(toolsMd, next, 'utf8');
  }
}

/** Strip a managed block by id; shared with the browser-guide cleanup. */
function removeManagedBlockFrom(content, blockId) {
  const startTag = `<!-- OPENCLAW:${blockId}:START -->`;
  const endTag = `<!-- OPENCLAW:${blockId}:END -->`;
  const startIdx = content.indexOf(startTag);
  const endIdx = content.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return content;
  return `${content.substring(0, startIdx).trimEnd()}\n${content.substring(endIdx + endTag.length).trimStart()}`.trim() + '\n';
}

async function ensureHostControl(projectDir) {
  // Point the service at the project being enabled (re-points a service already running for
  // another project — the handler reads _hostControlProjectDir per request).
  _hostControlProjectDir = projectDir;
  const cfg = await readHostControlConfig(projectDir);
  if (!cfg.enabled) return { ok: false, reason: 'disabled' };
  // Desktop only. Opening TeamViewer or an app needs a GUI, so a headless server has nothing
  // to control — and, more importantly, it is where 0.0.0.0 would be a real exposure (a VPS
  // has a public IP). Refusing here means the service never binds on a headless box, so the
  // public-exposure question does not arise. A rare VPS-with-desktop can override with
  // OPENCLAW_HOST_CONTROL_ALLOW_HEADLESS=1.
  if (isHeadlessServer() && process.env.OPENCLAW_HOST_CONTROL_ALLOW_HEADLESS !== '1') {
    return { ok: false, reason: 'headless server — no desktop to control' };
  }
  if (_hostControlServer) return { ok: true, port: HOST_CONTROL_PORT };
  const bridgeIp = await getDockerBridgeIp().catch(() => null);
  const server = http.createServer((req, res) => {
    // Read the CURRENTLY active project each request, so re-pointing takes effect live.
    handleHostControl(req, res, _hostControlProjectDir || projectDir).catch((err) => json(res, { ok: false, error: err.message }, 500));
  });
  // Bind all interfaces: the container reaches the host by different addresses per platform —
  // docker0 (172.17.0.1) on native Linux, the Docker Desktop gateway (host.docker.internal,
  // e.g. 192.168.65.254) on macOS/Windows — and binding one misses the others. The token is
  // the guard here, not the interface: every request needs it, and the service only exists
  // while the operator has host control switched on.
  const bindOk = await new Promise((resolveP) => {
    server.once('error', () => resolveP(false));
    server.listen(HOST_CONTROL_PORT, '0.0.0.0', () => resolveP(true));
  });
  if (!bindOk) return { ok: false, reason: `port ${HOST_CONTROL_PORT} in use` };
  _hostControlServer = server;
  sendLog(`[host-control] Nghe ở 0.0.0.0:${HOST_CONTROL_PORT} (cần token) — bot có thể mở Chrome/app trên máy này.`);
  if (bridgeIp && process.platform === 'linux') {
    // ufw's default-deny drops container→host traffic silently. Scope the allow rule to the
    // private bridge address only, so opening the port here does not expose it to the LAN.
    run('sh', ['-c', `command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active" && ufw allow in to ${bridgeIp} port ${HOST_CONTROL_PORT} proto tcp comment "openclaw host-control (docker bridge only)" || true`])
      .catch(() => {});
  }
  return { ok: true, port: HOST_CONTROL_PORT, host: '0.0.0.0' };
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
// this request. The debug port stays on loopback and no origin wildcard is passed — a Node CDP
// client sends no Origin header, so the wildcard only widened who could drive the browser.
// On a headless VPS there is no Chrome to open here — instead we start the bridge relay and hand
// back copy-paste commands so the user runs Chrome on THEIR machine + a reverse SSH tunnel.
// Where Chrome keeps the operator's own profile, per OS. Chrome must not already be running
// on it when we attach the debug port, which is why the callers close Chrome first.
function defaultChromeProfileDir() {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || join(os.homedir(), 'AppData', 'Local');
    return join(localAppData, 'Google', 'Chrome', 'User Data');
  }
  if (process.platform === 'darwin') {
    return join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
  }
  return join(os.homedir(), '.config', 'google-chrome');
}

// The profile Chrome is actually launched with. Never the directory above: Chrome 136+ drops
// --remote-debugging-port when it IS the default profile, so pointing there means Chrome opens
// and port 9222 never answers — the failure the bot reports as "Chrome debug not connected".
function debugChromeProfileDir() {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || join(os.homedir(), 'AppData', 'Local');
    return join(localAppData, ...CHROME_DEBUG_PROFILE_LEAF_WIN.split('\\'));
  }
  if (process.platform === 'darwin') return join(os.homedir(), ...CHROME_DEBUG_PROFILE_LEAF_MAC.split('/'));
  return join(os.homedir(), ...CHROME_DEBUG_PROFILE_LEAF_LINUX.split('/'));
}

// Seed it from the real profile once, so the bot inherits the operator's cookies, logins,
// history and extensions instead of browsing as a brand-new profile (the clearest bot signal
// a site can read). Caches are skipped — Chrome rebuilds those, and copying them turns a few
// hundred MB into several GB. Best-effort: a profile that fails to copy still opens, just
// signed out.
async function copyChromeProfileTree(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (CHROME_PROFILE_CACHE_DIRS.includes(entry.name)) continue;
    const from = join(src, entry.name);
    const to = join(dst, entry.name);
    // Per entry, because Chrome holds Windows locks on the profile it is using: one
    // unreadable file must not cost the operator the whole profile.
    try {
      if (entry.isDirectory()) await copyChromeProfileTree(from, to);
      else if (entry.isFile()) await fsp.copyFile(from, to);
    } catch {}
  }
}

async function seedDebugChromeProfile(realDir, debugDir, log = () => {}) {
  // The marker, not the folder: a copy that ran while Chrome had the cookie database locked
  // leaves a signed-out profile behind, and that must be retried rather than kept forever.
  const marker = join(debugDir, '.openclaw-seeded');
  if (existsSync(marker)) return false;
  if (!existsSync(join(realDir, 'Default'))) return false;
  log(`[chrome] Lần đầu: đang chép profile Chrome sang ${debugDir} (bỏ cache)...`);
  try {
    await copyChromeProfileTree(join(realDir, 'Default'), join(debugDir, 'Default'));
    await fsp.copyFile(join(realDir, 'Local State'), join(debugDir, 'Local State')).catch(() => {});
    const cookiesCopied = ['Network/Cookies', 'Cookies']
      .some((rel) => existsSync(join(debugDir, 'Default', ...rel.split('/'))));
    if (!cookiesCopied) {
      log('[chrome] Chrome đang mở nên chưa chép được cookie/đăng nhập. Đóng hết Chrome rồi bấm lại để chép đủ.');
      return false;
    }
    await fsp.writeFile(marker, new Date().toISOString(), 'utf8').catch(() => {});
    return true;
  } catch (e) {
    log(`[chrome] Không chép được profile (${e.message}); Chrome vẫn mở nhưng chưa đăng nhập sẵn.`);
    await fsp.mkdir(join(debugDir, 'Default'), { recursive: true }).catch(() => {});
    return false;
  }
}

async function startChromeDebug() {
  if (isHeadlessServer()) {
    await ensureChromeRelay();
    const ip = (await getPublicIp().catch(() => '')) || '<IP-VPS>';
    const user = sshUserName();
    return {
      ok: true,
      headless: true,
      port: 9222,
      // Same dedicated profile directories the local button and the generated scripts use, so
      // an operator who has already run one of those keeps the session they signed in with.
      chromeCmdMac: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="$HOME/${CHROME_DEBUG_PROFILE_LEAF_MAC}" --profile-directory=Default --remote-debugging-address=127.0.0.1`,
      chromeCmdWin: `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\\${CHROME_DEBUG_PROFILE_LEAF_WIN}" --profile-directory=Default --remote-debugging-address=127.0.0.1`,
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
  // Launch against a dedicated profile seeded from the operator's real one. A throwaway
  // profile is the clearest bot signal a site can read — no cookies, no logins, no history,
  // new on every run — and it also means the bot cannot use pages the operator is already
  // signed in to; the real profile itself cannot be used because Chrome 136+ drops the debug
  // port on it. The port is not what gets flagged: Chrome started this way carries no
  // --enable-automation, so navigator.webdriver stays false and there is no banner.
  // Set OPENCLAW_CHROME_PROFILE_DIR to point somewhere else (anything but the default profile).
  const userDataDir = process.env.OPENCLAW_CHROME_PROFILE_DIR || debugChromeProfileDir();
  // Only when the operator asked for their logins: the copy duplicates cookies and sessions into
  // a second profile directory, which is not something to do on a button press by default.
  if (process.env.OPENCLAW_CHROME_SEED_PROFILE === '1') {
    await seedDebugChromeProfile(defaultChromeProfileDir(), userDataDir, sendLog);
  } else if (!existsSync(join(userDataDir, 'Default'))) {
    sendLog('[chrome] Mở Chrome với profile điều khiển trống — đăng nhập 1 lần trong cửa sổ vừa mở. Muốn dùng sẵn đăng nhập của Chrome thường thì đặt OPENCLAW_CHROME_SEED_PROFILE=1 (sẽ chép cookie/đăng nhập/lịch sử sang profile đó).');
  }
  const args = [
    `--remote-debugging-port=${port}`,
    // Loopback only, and no --remote-allow-origins=*: a Node CDP client sends no Origin header,
    // so the wildcard only widened who could drive this browser.
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${userDataDir}`,
    '--profile-directory=Default',
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

async function installCore({ osChoice, mode, projectDir, gatewayPort = 18789, routerPort = 20128, userTimezone = 'Asia/Ho_Chi_Minh' }) {
  state.installing = true;
  state.installed = false;
  state.lastError = null;
  state.projectDir = projectDir;
  state.mode = mode;
  state.os = osChoice;
  state.startedAt = new Date().toISOString();
  try {
    // Native binds the host directly, so it needs ports nothing else holds — but only when something
    // actually holds them. Ask the host rather than assuming: a fresh machine keeps openclaw's and
    // 9router's real defaults, and a machine that already runs a docker project (or an SSH tunnel to
    // a remote bot) steps to the next free pair instead.
    if (mode === 'native') {
      gatewayPort = await findFreeHostPort(gatewayPort, { reserveNext: true });
      routerPort = await findFreeHostPort(routerPort);
      state.gatewayPort = gatewayPort;
      state.routerPort = routerPort;
      state.gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
      state.routerUrl = `http://127.0.0.1:${routerPort}`;
      sendLog(`[native] ports: gateway ${gatewayPort}, 9router ${routerPort}`);
    }
    sendLog('OpenClaw local installer started');
    sendLog(`Target: OS=${osChoice}, mode=${mode}, project=${projectDir}, gatewayPort=${gatewayPort}, routerPort=${routerPort}`);
    // Make sure Docker is present (auto-install on Linux/VPS) before doing any work — fail fast
    // with a clear message rather than deep inside `docker compose up`. Native mode has no
    // container, so it skips this entirely (that is much of the point of choosing it).
    if (mode !== 'native') await ensureDockerInstalled(osChoice);
    await writeCoreProject({ projectDir, osChoice, mode, gatewayPort, routerPort, userTimezone });
    await run('npm', ['install', '-g', OPENCLAW_NPM_SPEC]);
    await run('npm', ['install', '-g', NINE_ROUTER_NPM_SPEC]);
    if (mode === 'docker') {
      const dockerDir = join(projectDir, 'docker', 'openclaw');
      const rootEnvPath = join(projectDir, '.env');
      const dockerEnvPath = join(dockerDir, '.env');
      await fsp.mkdir(dockerDir, { recursive: true });
      const envContent = existsSync(rootEnvPath)
        ? await fsp.readFile(rootEnvPath, 'utf8')
        : buildEnvFileContent({ channelKey: 'telegram', providerKey: '9router', deployMode: mode, osChoice, selectedSkills: ['memory', 'web-search', 'scheduler'], skills: dataExport.SKILLS || [], agentMetas: [], apiKey: '', botToken: '', isSharedEnv: true });
      await fsp.writeFile(dockerEnvPath, envContent, 'utf8');
      sendLog(`Docker env ready: ${dockerEnvPath}`);
      await run('docker', ['compose', 'up', '-d', '--build'], { cwd: dockerDir });
      await applyResolved9RouterApiKey(projectDir).catch(() => {});
      // The full compose start already created the bot container. Recreating it here used to
      // interrupt OpenClaw's first-boot state migration and leave its five-minute lease behind,
      // making a brand-new project appear to crash-loop until the lease expired. The config is
      // bind-mounted, so the resolved 9Router key does not require an immediate second recreate.
      probeCacheClear();
    } else if (mode === 'native') {
      await startNativeRuntime({ projectDir, osChoice, gatewayPort, routerPort });
      probeCacheClear();
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
  // Selecting, adding or removing a project all end up here, and all of them make the cached
  // project list wrong — drop it so the next request rebuilds instead of showing the old set.
  probeCacheClear('projects:');
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
  const ck = 'dockerroots';
  const cached = probeCacheGet(ck);
  if (cached) return cached;
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
  const unique = [...new Set(roots)];
  probeCacheSet(ck, unique, 15000);
  return unique;
}

// Native installs have no container to inspect, so we can't detect them the way Docker bots are
// found. Instead scan for the `.openclaw/native.json` marker one level under the home dir and the
// launcher's parent — that covers the folders users actually pick (e.g. ~/openclaw-native, D:\bot)
// without a full filesystem walk. Mirrors discoverDockerBotProjectRoots so discoverProjects can
// surface native projects even when this install has no saved state for them.
async function discoverNativeProjectRoots(rootProjectDir) {
  const roots = new Set();
  const bases = new Set();
  try { bases.add(os.homedir()); } catch {}
  if (rootProjectDir) bases.add(resolve(rootProjectDir, '..'));
  for (const base of bases) {
    let entries = [];
    try { entries = await fsp.readdir(base, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
      const dir = join(base, ent.name);
      if (existsSync(nativeMarkerPath(dir)) && existsSync(join(dir, '.openclaw', 'openclaw.json'))) {
        roots.add(resolve(dir));
      }
    }
  }
  if (rootProjectDir && existsSync(nativeMarkerPath(rootProjectDir)) && existsSync(join(rootProjectDir, '.openclaw', 'openclaw.json'))) {
    roots.add(resolve(rootProjectDir));
  }
  return [...roots];
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

// The project list costs docker/native probes per project. It changes when someone creates or
// deletes a project — not between two page loads — so serve it from a short cache and refresh in
// the background: the dashboard opens instantly and is at most a few seconds stale.
const PROJECTS_TTL_MS = 10000;
function discoverProjects(rootProjectDir) {
  return sharedProbe(`projects:${rootProjectDir || ''}`, PROJECTS_TTL_MS, () => computeDiscoverProjects(rootProjectDir));
}

async function computeDiscoverProjects(rootProjectDir) {
  await ensureProjectsLoaded(rootProjectDir);

  // Surface projects whose bot is running in Docker even if this install has no saved
  // state for them (e.g. first `npx github:…` run on a server with bots already up).
  for (const dr of await discoverDockerBotProjectRoots()) {
    if (!state.projects.some(p => resolve(p.projectDir) === resolve(dr))) {
      const meta = await buildProjectMeta(dr).catch(() => null);
      if (meta) state.projects.push(meta);
    }
  }

  // Same idea for native installs — detect by marker since there is no container to inspect.
  for (const dr of await discoverNativeProjectRoots(rootProjectDir)) {
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

  // In parallel: each buildProjectMeta runs runtime detection (docker calls, port probes), so a
  // handful of projects turned into seconds of dashboard load when this was a sequential loop.
  const metas = await Promise.all(
    state.projects
      .filter((p) => existsSync(join(p.projectDir, '.openclaw', 'openclaw.json')))
      .map((p) => buildProjectMeta(p.projectDir).catch(() => null)),
  );
  state.projects = metas.filter(Boolean);
  
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
  // Native: uninstall the managed service before the folder goes, otherwise launchd/systemd keeps
  // relaunching a gateway whose config and workspace no longer exist.
  if (isNativeProject(resolved)) {
    sendLog(`[native] Removing gateway service for ${resolved}...`);
    await removeNativeRuntime(resolved).catch((err) => sendLog(`[native] Warning: ${err.message}`));
    await new Promise((r) => setTimeout(r, 1500));
  }
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

  // zalo-connect is required by any Zalo bot — refuse to disable it while a Zalo binding exists
  // (the UI also locks the toggle; this is the backend guard).
  if (kind === 'plugin' && (id === 'zalo-connect' || id === 'openclaw-zalo-connect') && !enabled) {
    const hasZaloBot = (cfg.bindings || []).some((b) => b?.match?.channel === 'zalo-connect');
    if (hasZaloBot) throw httpError(400, 'Không thể tắt Zalo Connect khi vẫn còn bot Zalo.');
  }

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
        await fsp.writeFile(sf.file, buildCronjobSkillMd(true, 'zalo-connect'), 'utf8');
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

  // Folder-based per-bot skills (image-gen / learning-memory). These load
  // from <workspace>/skills, so each bot's copy is independent. Toggling here affects ONLY the
  // active bot's workspace folder. The global skills.entries[id].enabled flag is kept true
  // while ANY bot still has the folder (openclaw needs it true to load the skill at all).
  if (kind === 'skill' && id === 'image-gen') {
    const slugMap = { 'image-gen': 'infographic-generator' };
    const slug = slugMap[id];
    const rel = workspaceRelForAgent(agent, cfg, projectDir) || `workspace-${agent.id}`;
    const folder = join(projectDir, '.openclaw', rel, 'skills', slug);
    const hasDocker = existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'));

    let installedNow = false;
    if (enabled) {
      // Enable for THIS bot only: ensure its workspace has the skill folder.
      if (!existsSync(folder)) { await installFeature(projectDir, agent.id, 'skill', id); installedNow = true; }
    } else {
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
  // learning-memory ships on ClawHub as `openclaw-learning-memory` (manifest id is
  // `learning-memory`, used as the config key). Install by the full package spec.
  'learning-memory': 'clawhub:openclaw-learning-memory',
};
const pluginInstallSpec = (id) => PLUGIN_NPM_SPEC[id] || `clawhub:${id}`;

async function installFeature(projectDir, agentId, kind, id) {
  if (kind === 'skill') {
    const skillSlugMap = {
      'image-gen': 'infographic-generator',
    };
    const slug = skillSlugMap[id] || id;

    let composeDir = null;
    if (existsSync(join(projectDir, 'docker-compose.yml'))) {
      composeDir = projectDir;
    } else if (existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'))) {
      composeDir = join(projectDir, 'docker', 'openclaw');
    }

    if (isNativeProject(projectDir)) {
      // Native: no container — install on the host with the project env (ocCapture) so the
      // skill lands in this project's workspace, then reload the managed gateway service.
      sendLog(`[skill] Installing/updating clawhub:${slug} natively for agent ${agentId}...`);
      const out = await ocCapture(projectDir, ['skills', 'install', slug, '--agent', agentId, '--force', '--acknowledge-clawhub-risk']);
      for (const line of `${out.stdout}\n${out.stderr}`.split(/\r?\n/).filter(Boolean)) sendLog(line);
      if (out.code !== 0 && !isSkillFolderExists(projectDir, agentId, slug)) {
        throw new Error(out.stderr || out.stdout || `Failed to install skill ${slug}.`);
      }
      sendLog('[skill] Restarting native gateway to apply skill...');
      await restartNativeRuntime(projectDir).catch((err) => sendLog(`[skill] restart skipped: ${err.message}`));
    } else if (composeDir) {
      const botContainer = getBotContainerName(projectDir);
      sendLog(`[skill] Installing/updating clawhub:${slug} inside container ${botContainer} for agent ${agentId}...`);

      const cmd = `cd /home/node/project && openclaw skills install ${slug} --agent ${agentId} --force --acknowledge-clawhub-risk`;
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
      
      await run('openclaw', ['skills', 'install', slug, '--agent', agentId, '--force', '--acknowledge-clawhub-risk'], {
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
    // zalo-connect ships on ClawHub (package `openclaw-zalo-connect`) — install/update via
    // clawhub:latest like other plugins, so the dashboard "Update" button always fetches the newest
    // published version (no tag pin to bump each release).
    if (id === 'zalo-connect' || id === 'openclaw-zalo-connect') {
      const native = isNativeProject(projectDir);
      let composeDir = null;
      if (!native) {
        if (existsSync(join(projectDir, 'docker-compose.yml'))) composeDir = projectDir;
        else if (existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'))) composeDir = join(projectDir, 'docker', 'openclaw');
      }
      if (native) {
        sendLog(`[zalo-connect] Installing/updating ${ZALO_CONNECT_PLUGIN_SPEC} natively...`);
        const out = await ocCapture(projectDir, ['plugins', 'install', ZALO_CONNECT_PLUGIN_SPEC, '--force', '--acknowledge-clawhub-risk']);
        if (out) for (const line of `${out.stdout}\n${out.stderr}`.split(/\r?\n/).filter(Boolean)) sendLog(`[zalo-connect] ${line}`);
        const okDir = existsSync(join(projectDir, '.openclaw', 'extensions', 'zalo-connect'));
        if (out.code !== 0 && !okDir) throw new Error(out.stderr || out.stdout || 'Failed to install zalo-connect.');
      } else if (composeDir) {
        const botContainer = getBotContainerName(projectDir);
        sendLog(`[zalo-connect] Installing/updating ${ZALO_CONNECT_PLUGIN_SPEC} inside ${botContainer}...`);
        const cmd = `cd /home/node/project && openclaw plugins install ${ZALO_CONNECT_PLUGIN_SPEC} --force --acknowledge-clawhub-risk 2>&1`;
        const out = await runCapture('docker', ['exec', botContainer, 'sh', '-lc', cmd], { cwd: projectDir, shell: false });
        if (out) for (const line of `${out.stdout}\n${out.stderr}`.split(/\r?\n/).filter(Boolean)) sendLog(`[zalo-connect] ${line}`);
        const okDir = existsSync(join(projectDir, '.openclaw', 'extensions', 'zalo-connect'));
        if (out.code !== 0 && !okDir) throw new Error(out.stderr || out.stdout || 'Failed to install zalo-connect.');
      }
      const cfgPath = join(projectDir, '.openclaw', 'openclaw.json');
      if (existsSync(cfgPath)) {
        const cfg = ensureConfigShape(JSON.parse(await fsp.readFile(cfgPath, 'utf8')));
        cfg.plugins = cfg.plugins || { entries: {}, allow: [] };
        cfg.plugins.entries = cfg.plugins.entries || {};
        cfg.plugins.entries['zalo-connect'] = cfg.plugins.entries['zalo-connect'] || {};
        cfg.plugins.entries['zalo-connect'].enabled = true;
        cfg.plugins.allow = cfg.plugins.allow || [];
        if (!cfg.plugins.allow.includes('zalo-connect')) cfg.plugins.allow.push('zalo-connect');
        await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
      }
      if (native) {
        sendLog('[zalo-connect] Restarting native gateway to apply...');
        await restartNativeRuntime(projectDir).catch((err) => sendLog(`[zalo-connect] restart failed: ${err.message}`));
      } else if (composeDir) {
        sendLog('[zalo-connect] Restarting container to apply...');
        await run('docker', ['restart', getBotContainerName(projectDir)], { shell: false }).catch(() => {});
      }
      // Drop cached container extension versions so the card reflects the just-installed
      // version immediately (extver cache lives until explicitly cleared, like the
      // general install path below does).
      probeCacheClear(`extver:${projectDir}`);
      probeCacheClear(`runtime:${projectDir}`);
      return { ok: true, id: 'zalo-connect' };
    }
    const installSpec = pluginInstallSpec(id);
    const installArgs = ['plugins', 'install', installSpec, '--force'];
    if (installSpec.startsWith('clawhub:')) installArgs.push('--acknowledge-clawhub-risk');

    let composeDir = null;
    if (isNativeProject(projectDir)) {
      // Native: no container to exec into — same CLI, run on the host with the project env so it
      // installs into this project's .openclaw/extensions instead of the default ~/.openclaw.
      composeDir = null;
    } else if (existsSync(join(projectDir, 'docker-compose.yml'))) {
      composeDir = projectDir;
    } else if (existsSync(join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'))) {
      composeDir = join(projectDir, 'docker', 'openclaw');
    }

    if (composeDir || isNativeProject(projectDir)) {
      let cmdOut;
      if (isNativeProject(projectDir)) {
        sendLog(`[plugin] Installing/updating ${installSpec} natively...`);
        cmdOut = await ocCapture(projectDir, installArgs);
      } else {
        const botContainer = getBotContainerName(projectDir);
        sendLog(`[plugin] Installing/updating ${installSpec} inside container ${botContainer}...`);
        const cmd = `cd /home/node/project && openclaw ${installArgs.join(' ')}`;
        cmdOut = await runCapture('docker', ['exec', botContainer, 'sh', '-lc', cmd], { cwd: projectDir, shell: false });
      }

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
            // The plugin ships these off: editing the Docker build files, running page JavaScript
            // and uploading local files are things it will not do until an operator says so.
            // Installing it from this dashboard IS that operator saying so — otherwise browsing
            // would need a hand-edited config right after a one-click install.
            ...browserAutomationOptIns(),
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
      if (isZaloMod && composeDir) {
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
      if (isNativeProject(projectDir)) {
        // Native: no container — reload the managed gateway service so the plugin loads.
        sendLog('[plugin] Restarting native gateway to apply plugin...');
        await restartNativeRuntime(projectDir).catch((err) => sendLog(`[plugin] restart failed: ${err.message}`));
      } else if (isBrowserPlugin && composeDir) {
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
      sendLog(`[plugin] Installing ${installSpec}...`);

      let installSuccess = true;
      await run('openclaw', installArgs, {
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
            // The plugin ships these off: editing the Docker build files, running page JavaScript
            // and uploading local files are things it will not do until an operator says so.
            // Installing it from this dashboard IS that operator saying so — otherwise browsing
            // would need a hand-edited config right after a one-click install.
            ...browserAutomationOptIns(),
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
  const aliases = {
    browser: ['openclaw-browser-automation', 'browser-automation'],
    zalo: ['openclaw-zalo-mod', 'zalo-mod'],
    crawler: ['openclaw-facebook-crawler', 'openclaw-n8n-facebook-crawler', 'n8n-facebook-crawler'],
    poster: ['openclaw-n8n-facebook-poster', 'openclaw-facebook-poster', 'facebook-poster'],
    fbMessenger: ['openclaw-fb-messenger', 'fb-messenger'],
    learningMemory: ['learning-memory', 'openclaw-learning-memory'],
    zaloConnect: ['zalo-connect', 'openclaw-zalo-connect'],
  };
  const flags = {
    'skill:browser': browserOn,
    'skill:cron': cronOn,
    'skill:image-gen': imageGenOn,
    'skill:web-search': webSearchOn,
    'plugin:openclaw-browser-automation': isEnabled(aliases.browser),
    'plugin:openclaw-zalo-mod': isEnabled(aliases.zalo),
    'plugin:openclaw-facebook-crawler': isEnabled(aliases.crawler),
    'plugin:openclaw-n8n-facebook-poster': isEnabled(aliases.poster),
    'plugin:openclaw-fb-messenger': isEnabled(aliases.fbMessenger),
    'plugin:learning-memory': isEnabled(aliases.learningMemory),
    'plugin:zalo-connect': isEnabled(aliases.zaloConnect),
  };
  const extensionsDir = join(projectDir || '', '.openclaw', 'extensions');
  const extensionDirExists = (aliases = []) =>
    aliases.some((a) => existsSync(join(extensionsDir, a)));
  const isActuallyInstalled = (aliases = []) =>
    extensionDirExists(aliases) || isInstalledByRecord(aliases);
  const installed = {
    'skill:image-gen': isSkillFolderExists(projectDir, aid, 'infographic-generator', cfg),
    'plugin:openclaw-browser-automation': isActuallyInstalled(aliases.browser),
    'plugin:openclaw-zalo-mod': isActuallyInstalled(aliases.zalo),
    'plugin:openclaw-facebook-crawler': isActuallyInstalled(aliases.crawler),
    'plugin:openclaw-n8n-facebook-poster': isActuallyInstalled(aliases.poster),
    // fb-messenger is auto-added to plugins.allow by the wizard, so the allow-list is NOT
    // proof of install — require a real extension dir or an install record instead.
    'plugin:openclaw-fb-messenger': extensionDirExists(aliases.fbMessenger)
      || aliases.fbMessenger.some((a) => installedKeys.has(a) || Array.from(installedSpecs).some((spec) => spec.includes(a))),
    'plugin:learning-memory': isActuallyInstalled(aliases.learningMemory),
    'plugin:zalo-connect': isActuallyInstalled(aliases.zaloConnect),
  };
  const versions = {
    'skill:image-gen': await getInstalledSkillVersion(projectDir, aid, 'infographic-generator', cfg),
    'plugin:openclaw-browser-automation': await getInstalledPluginVersion(projectDir, aliases.browser),
    'plugin:openclaw-zalo-mod': await getInstalledPluginVersion(projectDir, aliases.zalo),
    'plugin:openclaw-facebook-crawler': await getInstalledPluginVersion(projectDir, aliases.crawler),
    'plugin:openclaw-n8n-facebook-poster': await getInstalledPluginVersion(projectDir, aliases.poster),
    'plugin:openclaw-fb-messenger': await getInstalledPluginVersion(projectDir, aliases.fbMessenger),
    'plugin:learning-memory': await getInstalledPluginVersion(projectDir, aliases.learningMemory),
    'plugin:zalo-connect': await getInstalledPluginVersion(projectDir, aliases.zaloConnect),
  };
  // Docker: the container's extensions volume is the SOURCE OF TRUTH for installed
  // plugin versions — clawhub/plugin installs run inside the container, so a host copy
  // (bind-mounted .openclaw or a stale installs.json) can lag behind after an update.
  // When the container reports a version, it OVERRIDES the host value (not just fills
  // empties) so the card shows the actually-installed version, not a stale one. Native
  // installs return {} here, so host values are kept.
  const containerExtVersions = await getContainerExtensionVersions(projectDir);
  if (Object.keys(containerExtVersions).length) {
    const fillVer = (key, names) => { for (const n of names) { if (containerExtVersions[n]) { versions[key] = containerExtVersions[n]; break; } } };
    fillVer('plugin:openclaw-browser-automation', aliases.browser);
    fillVer('plugin:openclaw-zalo-mod', aliases.zalo);
    fillVer('plugin:openclaw-facebook-crawler', aliases.crawler);
    fillVer('plugin:openclaw-n8n-facebook-poster', aliases.poster);
    fillVer('plugin:openclaw-fb-messenger', aliases.fbMessenger);
    fillVer('plugin:learning-memory', aliases.learningMemory);
    fillVer('plugin:zalo-connect', aliases.zaloConnect);
  }
  const zaloBackend = fresh.channels?.['zalo-connect']?.enabled ? 'zalo-connect' : '';
  // zalo-connect is REQUIRED by any Zalo bot → lock its toggle (checked, can't disable)
  // whenever a Zalo binding exists.
  const hasZaloBot = (fresh.bindings || []).some((b) => b?.match?.channel === 'zalo-connect');
  const locked = { 'plugin:zalo-connect': hasZaloBot };
  return { flags, installed, versions, zaloBackend, locked };
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
      const userTimezone = String(body.userTimezone || '').trim() || 'Asia/Ho_Chi_Minh';
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

      installCore({ osChoice, mode, projectDir, gatewayPort, routerPort, userTimezone }).catch(() => {});
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
    if ((url.pathname === '/api/browser/start-chrome' || url.pathname === '/api/browser/start-chrome-debug')
      && req.method === 'POST') {
      // start-chrome-debug is the old path; kept so an already-open dashboard keeps working.
      return json(res, await startChromeDebug());
    }
    // Host control: read/flip the switch and see which apps this machine offers. The bot does
    // not come through here (the dashboard is loopback-only) — it calls the bridge-bound
    // service from ensureHostControl.
    if (url.pathname === '/api/host/control' && req.method === 'GET') {
      // Target the SELECTED project (not the launch root), so host-control provisions the bot
      // the operator is actually looking at — a connected project can differ from rootProjectDir.
      const projectDir = await resolveProjectDir(rootProjectDir, {});
      const cfg = await readHostControlConfig(projectDir);
      return json(res, {
        ok: true,
        enabled: cfg.enabled,
        port: HOST_CONTROL_PORT,
        apps: Object.keys(cfg.apps || {}),
        commands: Object.keys(cfg.commands || {}),
        running: Boolean(_hostControlServer),
        native: isNativeProject(projectDir),
        // What enabling will additionally grant, so the confirm dialog can spell it out.
        grants: Object.keys(detectHostCapabilityCommands()),
        codexApp: detectCodexApp(),
      });
    }
    if (url.pathname === '/api/host/control' && req.method === 'POST') {
      const body = await readJson(req).catch(() => ({}));
      const projectDir = await resolveProjectDir(rootProjectDir, body);
      const cfg = await readHostControlConfig(projectDir);
      if (typeof body.enabled === 'boolean') cfg.enabled = body.enabled;
      if (body.apps && typeof body.apps === 'object') cfg.apps = body.apps;
      if (body.commands && typeof body.commands === 'object') cfg.commands = body.commands;
      // Turning PC control ON is the operator's explicit ask, so it is also where the screen
      // capture / recording and node-script permissions get granted (opt out with grants:false).
      const granted = cfg.enabled && body.grants !== false ? grantHostCapabilities(cfg) : [];
      if (granted.length) sendLog(`[host-control] Đã cấp thêm quyền chạy: ${granted.join(', ')}.`);
      await fsp.writeFile(hostControlConfigPath(projectDir), JSON.stringify(cfg, null, 2), 'utf8');
      let started = { ok: false, reason: 'disabled' };
      if (cfg.enabled) started = await ensureHostControl(projectDir);
      // Always rewrite the workspace guidance: enabling adds the block (with the token),
      // disabling strips it so a bot never keeps instructions for an endpoint now refusing.
      await writeHostControlAccess(projectDir, cfg).catch(() => {});
      sendLog(`[host-control] ${cfg.enabled ? 'Đã BẬT' : 'Đã TẮT'} quyền điều khiển máy cho bot.`);
      // Make sure the Codex desktop app can actually do GUI work, so `codex exec` is enough for
      // the bot: install computer-use into the app and repair its MCP registration. Nothing is
      // installed into the OpenClaw project and the gateway never restarts.
      let codex = null;
      if (cfg.enabled && body.codex !== false && (cfg.commands || {}).codex) {
        const app = detectCodexApp();
        codex = await ensureCodexComputerUsePlugin(app, detectCodexMarketplace())
          .then((r) => ({ ...r, app }))
          .catch((err) => ({ error: err.message, app }));
        // The wrapper carries the sandbox flag, so a bot cannot get the invocation wrong.
        codex.taskScript = await writeCodexTaskScript(projectDir, (cfg.commands || {}).codex).catch(() => '');
      }
      return json(res, {
        ok: true,
        enabled: cfg.enabled,
        started,
        apps: Object.keys(cfg.apps || {}),
        commands: Object.keys(cfg.commands || {}),
        granted,
        native: isNativeProject(projectDir),
        codex,
      });
    }
    // Take the operator to the OS privacy pane PC control needs (screen recording, accessibility).
    // The OS alone can grant these; `probe` additionally triggers the macOS screen-capture prompt
    // for this node binary — the same interpreter the native bot runs under.
    if (url.pathname === '/api/host/permissions' && req.method === 'POST') {
      const body = await readJson(req).catch(() => ({}));
      const kind = String(body.kind || 'screen').toLowerCase();
      const probe = kind === 'screen' && body.probe !== false ? await probeScreenPermission() : { supported: false, granted: null };
      const opened = openPrivacyPane(kind);
      sendLog(`[host-control] Mở cài đặt quyền "${kind}"${probe.supported ? ` (screen recording: ${probe.granted ? 'đã cấp' : 'chưa cấp'})` : ''}.`);
      return json(res, { ok: true, kind, ...opened, screen: probe, platform: process.platform });
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
      // A first Zalo bot changes the project's docker infra needs (the entrypoint must
      // install the pinned zalo-connect plugin BEFORE the gateway starts). Force-resync so
      // the recreate below ships the zaloBackend-aware entrypoint — without this, the
      // login flow has to install mid-boot and restart the container, which can
      // interrupt OpenClaw's first-run migrations and wedge its state lease.
      if (result.channel === 'zalo-personal') {
        await syncDockerInfra(projectDir, true).catch((err) => sendLog(`[sync] infra resync failed: ${err.message}`));
      }
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
            const login = await startZaloLogin(projectDir, result.agentId);
            if (login?.qrDataUrl) sendLog(`[zalo-connect:qr] ${login.qrDataUrl}`);
            if (login?.message) sendLog(`[zalo-connect] ${login.message}`);
          } catch (err) {
            sendLog(`[zalo-connect] Login failed: ${err.message}`);
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
          const login = await startZaloLogin(projectDir, agentId);
          if (login?.qrDataUrl) sendLog(`[zalo-connect:qr] ${login.qrDataUrl}`);
          if (login?.message) sendLog(`[zalo-connect] ${login.message}`);
        } catch (err) {
          sendLog(`[zalo-connect] Login failed: ${err.message}`);
        }
      });
      return json(res, { ok: true, message: 'Zalo login initiated. QR will appear in UI.' });
    }
    if (url.pathname === '/api/zalo/login/cancel' && req.method === 'POST') {
      return json(res, cancelZaloLogin());
    }
    if (url.pathname === '/api/zalo/health' && req.method === 'GET') {
      const projectDir = await resolveProjectDir(rootProjectDir, Object.fromEntries(url.searchParams));
      return json(res, await getZaloHealth(projectDir));
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
// Kiểm tra nhanh 1 port có đang listen trên host không (tránh forward port chết).
function isLocalPortListening(port, host = '127.0.0.1', timeout = 400) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host });
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; try { sock.destroy(); } catch {} resolve(v); } };
    sock.setTimeout(timeout);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false));
  });
}
// On a headless server there's no local browser — print an SSH-tunnel command so the
// operator can reach the dashboard AND the Open-web UIs from their own machine. This is
// the discoverable answer for ANY user on a VPS (no manual ssh-config knowledge needed).
// CHỈ forward những port đang THỰC SỰ listen trên host — gateway (18789) / 9Router (20128)
// thường nằm trong Docker, không bind ra host, nên nếu forward cứng sẽ đẻ ra hàng loạt
// "channel: open failed: connect failed: Connection refused" vô nghĩa ở phía client.
async function printRemoteAccessHint(uiPort) {
  if (!isHeadlessServer()) return;
  const ip = (await getPublicIp()) || '<your-server-ip>';
  // uiPort vừa bind xong nên chắc chắn mở; các port phụ chỉ thêm nếu đang listen.
  const extras = [];
  for (const p of [18789, 20128, 18790]) {
    if (p !== uiPort && await isLocalPortListening(p)) extras.push(p);
  }
  const ports = [uiPort, ...extras];
  const fwd = ports.map((p) => `-L ${p}:127.0.0.1:${p}`).join(' ');
  console.log('');
  console.log('🌐 No local browser detected (server/VPS). Open the UI from YOUR computer:');
  console.log(`   ssh ${fwd} ${sshUserName()}@${ip}`);
  console.log(`   then open:  http://localhost:${uiPort}`);
  console.log(`   (forwards ${ports.length} live port${ports.length > 1 ? 's' : ''}: ${ports.join(', ')})`);
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
  // Bring the host-control service back up when the operator left it enabled, so the bot's
  // saved instructions keep working across installer restarts.
  ensureHostControl(projectDir).catch(() => {});
  // Warm the probes the first page load would otherwise wait on (project list, runtime versions,
  // public IP, Zalo status). They run while the browser is still starting, so the dashboard opens
  // against a warm cache instead of paying for docker and CLI round-trips on first paint.
  Promise.all([
    discoverProjects(projectDir).catch(() => {}),
    getCurrentRuntimeVersions().catch(() => {}),
    getPublicIp().catch(() => {}),
    existsSync(join(projectDir, '.openclaw', 'openclaw.json')) ? getZaloHealth(projectDir).catch(() => {}) : null,
  ]).catch(() => {});
}

export { patchBrowserAutomationHostPreference, debugChromeProfileDir, defaultChromeProfileDir, createBotInProject, updateBotInProject, deleteBotInProject, validateOpenclawConfig, startZaloLogin, readBotCredentials, resolveProject9RouterApiKey, installCore, deleteProjectFolder, buildZaloHealthSnapshot, removeEmptyWorkspaceAttestations, runHostCommand, detectHostCommands, detectHostCapabilityCommands, grantHostCapabilities, detectCodexApp, detectCodexMarketplace, resolveCodexCli, openPrivacyPane, projectDeployMode, isNativeProject, nativeServiceLabel, nativeEnv, ocArgv, migrateNativePaths, discoverNativeProjectRoots, detectOs, stripCliWarnings, migrationLeaseDeadline, ensureNativePlugins, findFreeHostPort, syncNativeServiceEnv, adoptStrayNativeHome };
