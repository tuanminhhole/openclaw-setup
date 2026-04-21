// @ts-nocheck
// install-gen.js — Build install/runtime artifacts (Chrome debug, uninstall, skill catalog)
// Workspace .md files are in workspace-gen.js (single source of truth).
(function (root) {
  function buildSkillCatalogMarkdown(options = {}) {
    const {
      isVi = true,
      selectedSkillIds = [],
      skillsCatalog = [],
      detail = 'full',
    } = options;

    const lines = selectedSkillIds.map((sid) => {
      const skill = skillsCatalog.find((entry) => entry && (entry.id === sid || entry.value === sid));
      if (!skill) return null;
      const skillSlug = skill.slug ? ` (${skill.slug})` : '';
      if (detail === 'compact') {
        return `- **${skill.name}**${skillSlug}`;
      }
      return `- **${skill.name}**${skillSlug}: ${skill.desc || (isVi ? 'Skill da cai dat' : 'Installed skill')}`;
    }).filter(Boolean);

    if (lines.length > 0) return lines.join('\n');
    return detail === 'compact'
      ? (isVi ? '- _(Chua co skill nao)_' : '- _(No skills installed)_')
      : (isVi ? '- _(Chua co skill nao duoc cai)_' : '- _(No skills installed yet)_');
  }

  function buildChromeDebugBat() {
    return `@echo off
echo ====== OpenClaw - Chrome Debug Mode ======
echo.
echo Dang tat Chrome cu (neu co)...
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 3 /nobreak >nul
echo Dang mo Chrome voi Debug Mode...
start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --remote-allow-origins=* ^
  --user-data-dir="%TEMP%\\chrome-debug"
timeout /t 4 /nobreak >nul
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:9222/json/version' -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host 'OK! Chrome Debug Mode dang chay.' -ForegroundColor Green } catch { Write-Host 'LOI: Port 9222 chua mo.' -ForegroundColor Red }"
echo.
pause
`;
  }

  function buildChromeDebugSh() {
    return `#!/usr/bin/env bash
# ====== OpenClaw - Chrome Debug Mode (Mac/Linux) ======
set -e
echo "====== OpenClaw - Chrome Debug Mode ======"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
  CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  [ ! -f "$CHROME_BIN" ] && CHROME_BIN="/Applications/Chromium.app/Contents/MacOS/Chromium"
  [ ! -f "$CHROME_BIN" ] && CHROME_BIN="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
else
  CHROME_BIN="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium-browser || command -v chromium || echo '')"
fi
[ -n "$CHROME_DEBUG_BIN" ] && CHROME_BIN="$CHROME_DEBUG_BIN"

if [ -z "$CHROME_BIN" ] || { [ ! -f "$CHROME_BIN" ] && [ ! -x "$CHROME_BIN" ]; }; then
  echo -e "\\033[31mERROR: Chrome/Chromium not found.\\033[0m"
  echo "Install Chrome or: export CHROME_DEBUG_BIN=/path/to/chrome"
  exit 1
fi

echo "Using: $CHROME_BIN"
echo "Killing existing Chrome debug instances..."
pkill -f -- "--remote-debugging-port=9222" 2>/dev/null || true
sleep 2

TMP_DIR="\${TMPDIR:-/tmp}/chrome-debug-openclaw"
mkdir -p "$TMP_DIR"

echo "Starting Chrome in Debug Mode (port 9222)..."
"$CHROME_BIN" \\
  --remote-debugging-port=9222 \\
  --remote-allow-origins=* \\
  --user-data-dir="$TMP_DIR" &

sleep 4
if curl -s http://localhost:9222/json/version > /dev/null 2>&1; then
  echo -e "\\033[32mOK! Chrome Debug Mode is running on port 9222.\\033[0m"
else
  echo -e "\\033[31mERROR: Port 9222 not responding.\\033[0m"
  exit 1
fi
`;
  }

  function buildUninstallArtifact(options = {}) {
    const {
      os = 'win',
      isDocker = false,
      projectDir = '.',
      botName = 'openclaw',
    } = options;

    const absWin = String(projectDir).replace(/\//g, '\\');
    const absUnix = String(projectDir).replace(/\\/g, '/');
    const appName = String(botName || 'openclaw').toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (os === 'win' && !isDocker) {
      return { name: 'uninstall-openclaw-win.bat', content: `@echo off\nsetlocal EnableExtensions\nchcp 65001 >nul\necho.\necho ============================================================\necho   OpenClaw Uninstaller - Windows Native\necho   Project: ${absWin}\necho ============================================================\necho.\necho [WARNING] This will:\necho   1. Kill openclaw and 9router background processes\necho   2. Uninstall global npm packages (openclaw, 9router)\necho   3. Delete the project folder and all its data\necho.\nset /p CONFIRM=Nhap YES de xac nhan xoa toan bo: \nif /i not "%CONFIRM%"=="YES" (\n  echo Huy bo. Khong xoa gi ca.\n  pause\n  exit /b 0\n)\necho.\necho [1/4] Dang dung cac tien trinh openclaw va 9router...\nwmic process where "Name='node.exe' and CommandLine like '%%9router%%'" delete >nul 2>&1\nwmic process where "Name='cmd.exe' and CommandLine like '%%9router%%'" delete >nul 2>&1\nwmic process where "Name='node.exe' and CommandLine like '%%openclaw.mjs%%'" delete >nul 2>&1\ntimeout /t 2 /nobreak >nul\necho    OK: Tien trinh da dung.\necho.\necho [2/4] Dang go cai npm packages toan cau...\nset "PATH=%APPDATA%\\\\npm;%PATH%"\ncall npm uninstall -g openclaw 9router grammy @grammyjs/runner @grammyjs/transformer-throttler @buape/carbon @larksuiteoapi/node-sdk @slack/web-api 2>nul\necho    OK: npm packages da duoc go cai.\necho.\necho [3/4] Xoa thu muc project...\nset "TARGET=${absWin}"\nif exist "%TARGET%" (\n  rd /s /q "%TARGET%"\n  echo    OK: Da xoa %TARGET%\n) else (\n  echo    INFO: Thu muc khong ton tai: %TARGET%\n)\necho.\necho [4/4] Xoa thu muc .9router trong Home (neu co)...\nif exist "%USERPROFILE%\\\\.9router" (\n  set /p CLEAN_HOME=Xoa ca %USERPROFILE%\\\\.9router? [YES/no]: \n  if /i "%CLEAN_HOME%"=="YES" rd /s /q "%USERPROFILE%\\\\.9router" >nul 2>&1\n)\necho.\necho ============================================================\necho   Go cai hoan tat!\necho   De cai lai: chay lai file setup hoac npx create-openclaw-bot\necho ============================================================\npause\nendlocal\n` };
    }

    if (os === 'win' && isDocker) {
      return { name: 'uninstall-openclaw-docker.bat', content: `@echo off\nsetlocal EnableExtensions\nchcp 65001 >nul\necho.\necho ============================================================\necho   OpenClaw Uninstaller - Docker (Windows)\necho   Project: ${absWin}\necho ============================================================\necho.\necho [WARNING] This will stop Docker containers and delete the project folder.\necho.\nset /p CONFIRM=Nhap YES de xac nhan xoa toan bo: \nif /i not "%CONFIRM%"=="YES" (\n  echo Huy bo. Khong xoa gi ca.\n  pause\n  exit /b 0\n)\necho.\necho [1/2] Dang dung Docker containers...\ncd /d "${absWin}\\\\docker\\\\openclaw" 2>nul && (\n  docker compose down --volumes --remove-orphans 2>nul || docker-compose down --volumes --remove-orphans 2>nul\n  echo    OK: Containers da dung.\n) || echo    INFO: Khong tim thay docker compose.\necho.\necho [2/2] Xoa thu muc project...\ncd /d "%USERPROFILE%"\nif exist "${absWin}" (\n  rd /s /q "${absWin}"\n  echo    OK: Da xoa ${absWin}\n)\necho.\necho ============================================================\necho   Go cai hoan tat! De cai lai: npx create-openclaw-bot@latest\necho ============================================================\npause\nendlocal\n` };
    }

    if (isDocker) {
      return { name: 'uninstall-openclaw-docker.sh', content: `#!/usr/bin/env bash\nset -e\nPROJECT_DIR="${absUnix}"\nDOCKER_DIR="$PROJECT_DIR/docker/openclaw"\necho ""\necho "============================================================"\necho "  OpenClaw Uninstaller - Docker"\necho "  Project: $PROJECT_DIR"\necho "============================================================"\necho ""\nread -rp "Type YES to confirm full removal: " CONFIRM\nif [ "$CONFIRM" != "YES" ]; then echo "Cancelled."; exit 0; fi\necho "[1/3] Stopping Docker containers and removing volumes..."\nif [ -d "$DOCKER_DIR" ] && command -v docker &>/dev/null; then\n  cd "$DOCKER_DIR"\n  docker compose down --volumes --remove-orphans 2>/dev/null || docker-compose down --volumes --remove-orphans 2>/dev/null || true\nfi\necho "[2/3] Removing project directory..."\n[ -d "$PROJECT_DIR" ] && rm -rf "$PROJECT_DIR" && echo "   OK: Deleted $PROJECT_DIR" || echo "   INFO: Not found."\necho "[3/3] Checking home-level .openclaw..."\nif [ -d "$HOME/.openclaw" ]; then\n  read -rp "Delete $HOME/.openclaw? [YES/no]: " CLEAN\n  [ "$CLEAN" = "YES" ] && rm -rf "$HOME/.openclaw" && echo "   OK." || echo "   Kept."\nfi\n` };
    }

    if (os === 'vps') {
      return { name: 'uninstall-openclaw-vps.sh', content: `#!/usr/bin/env bash\nset -e\nPROJECT_DIR="${absUnix}"\nAPP_NAME="${appName}"\necho ""\necho "============================================================"\necho "  OpenClaw Uninstaller - VPS / Ubuntu Server"\necho "  Project: $PROJECT_DIR"\necho "  PM2 app: $APP_NAME"\necho "============================================================"\necho ""\nread -rp "Type YES to confirm full removal: " CONFIRM\nif [ "$CONFIRM" != "YES" ]; then echo "Cancelled."; exit 0; fi\necho "[1/5] Stopping PM2 processes..."\nif command -v pm2 &>/dev/null; then\n  pm2 delete "$APP_NAME" "$APP_NAME-9router" "$APP_NAME-9router-sync" openclaw openclaw-multibot 2>/dev/null || true\n  pm2 save --force 2>/dev/null || true\nfi\necho "[2/5] Killing leftover processes on ports 18791 / 20128..."\nfor port in 18791 20128; do\n  pid=$(lsof -ti tcp:$port 2>/dev/null || true)\n  [ -n "$pid" ] && kill -9 $pid 2>/dev/null || true\ndone\necho "[3/5] Uninstalling npm packages..."\nnpm uninstall -g openclaw 9router pm2 grammy @grammyjs/runner @grammyjs/transformer-throttler @buape/carbon @larksuiteoapi/node-sdk @slack/web-api 2>/dev/null || true\necho "[4/5] Removing project directory..."\n[ -d "$PROJECT_DIR" ] && rm -rf "$PROJECT_DIR" && echo "   OK: Deleted $PROJECT_DIR" || echo "   INFO: Not found."\necho "[5/5] Checking home-level .9router / .openclaw..."\nfor dir in "$HOME/.9router" "$HOME/.openclaw"; do\n  if [ -d "$dir" ]; then\n    read -rp "Delete $dir ? [YES/no]: " CLEAN\n    [ "$CLEAN" = "YES" ] && rm -rf "$dir" && echo "   OK: Deleted $dir" || echo "   Kept: $dir"\n  fi\ndone\n` };
    }

    if (os === 'linux' || os === 'linux-desktop' || os === 'macos') {
      const label = os === 'macos' ? 'macOS' : 'Linux Desktop';
      return { name: 'uninstall-openclaw.sh', content: `#!/usr/bin/env bash\nset -e\nPROJECT_DIR="${absUnix}"\necho ""\necho "============================================================"\necho "  OpenClaw Uninstaller - ${label} Native"\necho "  Project: $PROJECT_DIR"\necho "============================================================"\necho ""\nread -rp "Type YES to confirm full removal: " CONFIRM\nif [ "$CONFIRM" != "YES" ]; then echo "Cancelled."; exit 0; fi\necho "[1/4] Stopping openclaw and 9router processes..."\npkill -f "openclaw gateway run" 2>/dev/null || true\npkill -f "9router.*20128" 2>/dev/null || true\npkill -f "9router-smart-route" 2>/dev/null || true\npkill -f "$PROJECT_DIR" 2>/dev/null || true\nfor port in 18791 20128; do\n  pid=$(lsof -ti tcp:$port 2>/dev/null || true)\n  [ -n "$pid" ] && kill -9 $pid 2>/dev/null || true\ndone\necho "[2/4] Uninstalling npm packages..."\nnpm uninstall -g openclaw 9router grammy @grammyjs/runner @grammyjs/transformer-throttler @buape/carbon @larksuiteoapi/node-sdk @slack/web-api 2>/dev/null || true\nsudo npm uninstall -g openclaw 9router 2>/dev/null || true\necho "[3/4] Removing project directory..."\n[ -d "$PROJECT_DIR" ] && rm -rf "$PROJECT_DIR" && echo "   OK: Deleted $PROJECT_DIR" || echo "   INFO: Not found."\necho "[4/4] Checking home-level .9router / .openclaw..."\nfor dir in "$HOME/.9router" "$HOME/.openclaw"; do\n  if [ -d "$dir" ]; then\n    read -rp "Delete $dir ? [YES/no]: " CLEAN\n    [ "$CLEAN" = "YES" ] && rm -rf "$dir" && echo "   OK: Deleted $dir" || echo "   Kept: $dir"\n  fi\ndone\n` };
    }

    return null;
  }

  function buildCliUninstallArtifacts(options = {}) {
    const { deployMode = 'native', osChoice = 'windows', projectDir = '.', botName = 'openclaw' } = options;
    if (deployMode === 'docker') {
      return [
        buildUninstallArtifact({ os: 'linux', isDocker: true, projectDir, botName }),
        buildUninstallArtifact({ os: 'win', isDocker: true, projectDir, botName }),
      ].filter(Boolean);
    }
    if (osChoice === 'windows') return [buildUninstallArtifact({ os: 'win', projectDir, botName })].filter(Boolean);
    if (osChoice === 'vps') return [buildUninstallArtifact({ os: 'vps', projectDir, botName })].filter(Boolean);
    if (osChoice === 'macos') return [buildUninstallArtifact({ os: 'macos', projectDir, botName })].filter(Boolean);
    return [buildUninstallArtifact({ os: 'linux', projectDir, botName })].filter(Boolean);
  }

  function buildCliChromeDebugArtifacts() {
    return [
      { name: 'start-chrome-debug.bat', content: buildChromeDebugBat() },
      { name: 'start-chrome-debug.sh', content: buildChromeDebugSh(), executable: true },
    ];
  }

  function buildStartBotBat(opts = {}) {
    const { projectDir = '.', openclawHome = '.openclaw', is9Router = false, isVi = true } = opts;
    const L = [];
    L.push('@echo off');
    L.push('setlocal EnableExtensions');
    L.push('chcp 65001 >nul');
    L.push(`set "PROJECT_DIR=${projectDir}"`);
    L.push(`set "OPENCLAW_HOME=${openclawHome}"`);
    L.push(`set "DATA_DIR=${projectDir}\\.9router"`);
    L.push('set "PATH=%APPDATA%\\npm;%PATH%"');
    L.push('powershell -NoProfile -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force" >nul 2>&1');
    L.push('echo.');
    L.push(isVi ? 'echo ====== OpenClaw - Khoi dong lai bot ======' : 'echo ====== OpenClaw - Restart Bot ======');
    L.push('echo.');
    L.push(isVi ? 'echo [1] Dung process openclaw cu (neu co)...' : 'echo [1] Stopping existing openclaw process (if any)...');
    L.push('call openclaw gateway stop >nul 2>&1');
    L.push('timeout /t 2 /nobreak >nul');
    if (is9Router) {
      L.push('');
      L.push(isVi ? 'echo [2] Dung 9Router cu va khoi dong lai...' : 'echo [2] Stopping old 9Router and restarting...');
      L.push("wmic process where \"Name='node.exe' and CommandLine like '%%9router%%'\" delete >nul 2>&1");
      L.push("wmic process where \"Name='cmd.exe' and CommandLine like '%%9router%%'\" delete >nul 2>&1");
      L.push('timeout /t 2 /nobreak >nul');
      L.push("echo $env:DATA_DIR = '%DATA_DIR%' > \"%TEMP%\\oc-start9r.ps1\"");
      L.push("echo $b = Join-Path $env:APPDATA 'npm\\9router.cmd' >> \"%TEMP%\\oc-start9r.ps1\"");
      L.push("echo if ^(-not ^(Test-Path $b^)^) { $b = Join-Path $env:APPDATA 'npm\\9router' } >> \"%TEMP%\\oc-start9r.ps1\"");
      L.push(`echo $patch = Join-Path '${projectDir}' '.openclaw\\patch-9router.js' >> "%TEMP%\\oc-start9r.ps1"`);
      L.push("echo if ^(Test-Path $patch^) { ^& node $patch ^| Out-Null } >> \"%TEMP%\\oc-start9r.ps1\"");
      L.push(`echo Start-Process 'cmd.exe' -WindowStyle Hidden -WorkingDirectory '${projectDir}' -ArgumentList ^('/c "' + $b + '" -n -H 0.0.0.0 -p 20128 --skip-update'^) >> "%TEMP%\\oc-start9r.ps1"`);
      L.push('powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\\oc-start9r.ps1"');
      L.push('del "%TEMP%\\oc-start9r.ps1" >nul 2>&1');
      L.push('timeout /t 5 /nobreak >nul');
      L.push(isVi ? 'echo [OK] 9Router da khoi dong.' : 'echo [OK] 9Router started.');
      L.push('');
      L.push(isVi ? 'echo [2b] Khoi dong sync smart-route...' : 'echo [2b] Starting smart-route sync...');
      L.push(`echo $env:DATA_DIR = '%DATA_DIR%' > "%TEMP%\\oc-syncsmart.ps1"`);
      L.push(`echo $sync = Join-Path '${projectDir}' '.openclaw\\9router-smart-route-sync.js' >> "%TEMP%\\oc-syncsmart.ps1"`);
      L.push(`echo if ^(Test-Path $sync^) { Start-Process 'node' -WindowStyle Hidden -ArgumentList $sync } >> "%TEMP%\\oc-syncsmart.ps1"`);
      L.push('powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\\oc-syncsmart.ps1"');
      L.push('del "%TEMP%\\oc-syncsmart.ps1" >nul 2>&1');
    }
    L.push('');
    L.push(isVi ? 'echo [3] Khoi dong OpenClaw Gateway...' : 'echo [3] Starting OpenClaw Gateway...');
    L.push('set "GW_LAUNCHER=%TEMP%\\openclaw-gateway-start.bat"');
    L.push('> "%GW_LAUNCHER%" echo @echo off');
    L.push('>> "%GW_LAUNCHER%" echo title openclaw-gateway');
    L.push('>> "%GW_LAUNCHER%" echo setlocal EnableExtensions');
    L.push('>> "%GW_LAUNCHER%" echo chcp 65001 ^>nul');
    L.push('>> "%GW_LAUNCHER%" echo cd /d "%PROJECT_DIR%"');
    L.push('>> "%GW_LAUNCHER%" echo set "PROJECT_DIR=%PROJECT_DIR%"');
    L.push('>> "%GW_LAUNCHER%" echo set "OPENCLAW_HOME=%OPENCLAW_HOME%"');
    L.push('>> "%GW_LAUNCHER%" echo set "OPENCLAW_STATE_DIR=%OPENCLAW_HOME%"');
    L.push('>> "%GW_LAUNCHER%" echo set "DATA_DIR=%DATA_DIR%"');
    L.push('>> "%GW_LAUNCHER%" echo set "PATH=%APPDATA%\\npm;%%PATH%%"');
    L.push('>> "%GW_LAUNCHER%" echo if exist ".env" for /f "usebackq eol=# tokens=1,* delims==" %%%%A in ^(".env"^) do set "%%%%A=%%%%B"');
    L.push('>> "%GW_LAUNCHER%" echo echo ===== OpenClaw Gateway =====');
    L.push('>> "%GW_LAUNCHER%" echo echo Project: %%PROJECT_DIR%%');
    L.push('>> "%GW_LAUNCHER%" echo echo.');
    L.push('>> "%GW_LAUNCHER%" echo if exist "%%APPDATA%%\\npm\\openclaw.cmd" ^(call "%%APPDATA%%\\npm\\openclaw.cmd" gateway run^) else ^(openclaw gateway run^)');
    L.push('>> "%GW_LAUNCHER%" echo echo.');
    L.push(isVi
      ? '>> "%GW_LAUNCHER%" echo echo OpenClaw Gateway da dung voi ma loi %%ERRORLEVEL%%.'
      : '>> "%GW_LAUNCHER%" echo echo OpenClaw Gateway exited with code %%ERRORLEVEL%%.');
    L.push('>> "%GW_LAUNCHER%" echo pause');
    L.push('start "openclaw-gateway" cmd /k call "%GW_LAUNCHER%"');
    L.push('timeout /t 3 /nobreak >nul');
    L.push('echo.');
    L.push(isVi ? 'echo [OK] OpenClaw Gateway da khoi dong trong cua so moi!' : 'echo [OK] OpenClaw Gateway started in a new window!');
    L.push('echo.');
    L.push('echo OpenClaw Dashboard:  http://127.0.0.1:18791');
    if (is9Router) L.push('echo 9Router Dashboard:  http://127.0.0.1:20128/dashboard');
    L.push('echo.');
    L.push(isVi ? 'echo Ban co the dong cua so nay.' : 'echo You may close this window.');
    L.push('pause');
    L.push('endlocal');
    return L.join('\r\n');
  }

  function buildStartBotSh(opts = {}) {
    const {
      projectDir = '.',
      is9Router = false,
      isVi = true,
      osChoice = 'linux',
      isMultiBot = false,
      appName = 'openclaw',
      logFile9r = '/tmp/9router.log',
      logFileGw = '/tmp/openclaw-gw.log',
    } = opts;
    if (osChoice === 'vps') {
      const L = [];
      L.push('#!/bin/bash');
      L.push('set -euo pipefail');
      L.push(`PROJECT_DIR="${projectDir}"`);
      L.push('cd "$PROJECT_DIR"');
      L.push('export OPENCLAW_HOME="$PROJECT_DIR/.openclaw"');
      L.push('export OPENCLAW_STATE_DIR="$PROJECT_DIR/.openclaw"');
      L.push('export DATA_DIR="$PROJECT_DIR/.9router"');
      L.push('if [ -f ".env" ]; then set -a; . ./.env; set +a; fi');
      L.push(`APP_NAME="${appName}"`);
      L.push('');
      L.push('if ! command -v pm2 >/dev/null 2>&1; then');
      L.push(isVi ? '  echo "ERROR: Khong tim thay PM2. Chay: npm install -g pm2"' : '  echo "ERROR: PM2 not found. Run: npm install -g pm2"');
      L.push('  exit 1');
      L.push('fi');
      L.push('');
      L.push(isVi ? 'echo "====== OpenClaw - Khoi dong lai bot qua PM2 ======"' : 'echo "====== OpenClaw - Restart Bot via PM2 ======"');
      L.push('echo ""');
      if (is9Router) {
        L.push(isVi ? 'echo "[1] Khoi dong lai 9Router qua PM2..."' : 'echo "[1] Restarting 9Router via PM2..."');
        L.push('NINE_ROUTER_BIN="$(command -v 9router 2>/dev/null || true)"');
        L.push('NODE_BIN="$(command -v node 2>/dev/null || true)"');
        L.push('if [ -z "$NINE_ROUTER_BIN" ] || [ -z "$NODE_BIN" ]; then');
        L.push(isVi ? '  echo "ERROR: Thieu node hoac 9router. Chay: npm install -g 9router"' : '  echo "ERROR: Missing node or 9router. Run: npm install -g 9router"');
        L.push('  exit 1');
        L.push('fi');
        L.push('pm2 delete "$APP_NAME-9router" "$APP_NAME-9router-sync" >/dev/null 2>&1 || true');
        L.push('if [ -f "$PROJECT_DIR/.openclaw/patch-9router.js" ]; then');
        L.push('  "$NODE_BIN" "$PROJECT_DIR/.openclaw/patch-9router.js" >/dev/null 2>&1 || true');
        L.push('fi');
        L.push('PORT=20128 HOSTNAME=0.0.0.0 DATA_DIR="$DATA_DIR" pm2 start "$NINE_ROUTER_BIN" --name "$APP_NAME-9router" --interpreter "$NODE_BIN" -- -n -H 0.0.0.0 -p 20128 --skip-update');
        L.push('if [ -f "$PROJECT_DIR/.openclaw/9router-smart-route-sync.js" ]; then');
        L.push('  pm2 start "$NODE_BIN" --name "$APP_NAME-9router-sync" -- "$PROJECT_DIR/.openclaw/9router-smart-route-sync.js"');
        L.push('fi');
      } else {
        L.push(isVi ? 'echo "[1] Khong dung 9Router cho project nay."' : 'echo "[1] This project does not use 9Router."');
      }
      L.push('');
      if (isMultiBot) {
        L.push(isVi ? 'echo "[2] Khoi dong lai multi-bot gateway qua PM2..."' : 'echo "[2] Restarting multi-bot gateway via PM2..."');
        L.push('pm2 delete "$APP_NAME" >/dev/null 2>&1 || true');
        L.push('pm2 start ecosystem.config.js');
      } else {
        L.push(isVi ? 'echo "[2] Khoi dong lai OpenClaw gateway qua PM2..."' : 'echo "[2] Restarting OpenClaw gateway via PM2..."');
        L.push('pm2 delete "$APP_NAME" >/dev/null 2>&1 || true');
        L.push('OPENCLAW_HOME="$PROJECT_DIR/.openclaw" OPENCLAW_STATE_DIR="$PROJECT_DIR/.openclaw" pm2 start --name "$APP_NAME" --cwd "$PROJECT_DIR" -- sh -c "export OPENCLAW_HOME=$PROJECT_DIR/.openclaw OPENCLAW_STATE_DIR=$PROJECT_DIR/.openclaw && openclaw gateway run"');
      }
      L.push('pm2 save >/dev/null 2>&1 || true');
      L.push('echo ""');
      L.push('echo "OpenClaw Dashboard: http://127.0.0.1:18791"');
      if (is9Router) L.push('echo "9Router Dashboard:  http://127.0.0.1:20128/dashboard"');
      L.push('echo ""');
      L.push(isVi ? 'echo "Log gateway: pm2 logs $APP_NAME"' : 'echo "Gateway logs: pm2 logs $APP_NAME"');
      if (is9Router) L.push(isVi ? 'echo "Log 9Router: pm2 logs $APP_NAME-9router"' : 'echo "9Router logs: pm2 logs $APP_NAME-9router"');
      return L.join('\n');
    }
    const L = [];
    L.push('#!/bin/bash');
    L.push('set -euo pipefail');
    L.push(`cd "${projectDir}"`);
    L.push('export OPENCLAW_HOME="$PWD/.openclaw"');
    L.push('export OPENCLAW_STATE_DIR="$PWD/.openclaw"');
    L.push('export DATA_DIR="$PWD/.9router"');
    L.push('if [ -f ".env" ]; then set -a; . ./.env; set +a; fi');
    L.push('');
    L.push(isVi ? 'echo "====== OpenClaw - Khoi dong lai bot ======"' : 'echo "====== OpenClaw - Restart Bot ======"');
    L.push('');
    L.push(isVi ? 'echo "[1] Dung openclaw gateway cu (neu co)..."' : 'echo "[1] Stopping existing openclaw gateway (if any)..."');
    L.push('openclaw gateway stop 2>/dev/null || true');
    L.push('sleep 1');
    if (is9Router) {
      L.push('');
      L.push(isVi ? 'echo "[2] Dung 9Router cu va khoi dong lai..."' : 'echo "[2] Stopping 9Router and restarting..."');
      L.push('pkill -f "9router" 2>/dev/null || true');
      L.push('sleep 1');
      L.push('NINE_ROUTER_BIN="$(command -v 9router 2>/dev/null || true)"');
      L.push('if [ -z "$NINE_ROUTER_BIN" ]; then');
      L.push(isVi ? '  echo "ERROR: Khong tim thay 9router! Chay: npm install -g 9router"' : '  echo "ERROR: 9router not found! Run: npm install -g 9router"');
      L.push('  exit 1');
      L.push('fi');
      L.push('if [ -f "$PROJECT_DIR/.openclaw/patch-9router.js" ]; then');
      L.push('  node "$PROJECT_DIR/.openclaw/patch-9router.js" >/dev/null 2>&1 || true');
      L.push('fi');
      L.push(`nohup env PORT=20128 HOSTNAME=0.0.0.0 DATA_DIR="$DATA_DIR" "$NINE_ROUTER_BIN" -n -H 0.0.0.0 -p 20128 --skip-update > "${logFile9r}" 2>&1 &`);
      L.push('sleep 3');
      L.push(isVi ? `echo "[OK] 9Router da khoi dong. Log: ${logFile9r}"` : `echo "[OK] 9Router started. Log: ${logFile9r}"`);
      L.push('');
      L.push(isVi ? 'echo "[2b] Khoi dong sync smart-route..."' : 'echo "[2b] Starting smart-route sync..."');
      L.push('if [ -f "$PROJECT_DIR/.openclaw/9router-smart-route-sync.js" ]; then');
      L.push('  nohup env DATA_DIR="$DATA_DIR" node "$PROJECT_DIR/.openclaw/9router-smart-route-sync.js" > /tmp/9router-sync.log 2>&1 &');
      L.push('fi');
    }
    L.push('');
    L.push(isVi ? 'echo "[3] Khoi dong OpenClaw Gateway..."' : 'echo "[3] Starting OpenClaw Gateway..."');
    L.push(`nohup openclaw gateway run > "${logFileGw}" 2>&1 &`);
    L.push('GW_PID=$!');
    L.push('sleep 2');
    L.push(isVi ? `echo "[OK] Gateway khoi dong (PID $GW_PID). Log: ${logFileGw}"` : `echo "[OK] Gateway started (PID $GW_PID). Log: ${logFileGw}"`);
    L.push('');
    L.push('echo ""');
    L.push('echo "OpenClaw Dashboard: http://127.0.0.1:18791"');
    if (is9Router) L.push('echo "9Router Dashboard:  http://127.0.0.1:20128/dashboard"');
    L.push('echo ""');
    L.push(isVi ? 'echo "Bot dang chay background. Dung: openclaw gateway stop"' : 'echo "Bot running in background. Stop: openclaw gateway stop"');
    return L.join('\n');
  }

  function buildCliStartBotArtifacts(options = {}) {
    return [
      {
        name: 'start-bot.bat',
        content: buildStartBotBat(options),
      },
      {
        name: 'start-bot.sh',
        content: buildStartBotSh(options),
        executable: true,
      },
    ];
  }

  
  function buildUpgradePs1() {
  return [
    "# OpenClaw Upgrade Script — Windows (PowerShell)",
    "# Cach dung:",
    "#   Nhan dup upgrade.ps1 hoac: .\\upgrade.ps1",
    "#   irm https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/upgrade.ps1 | iex",
    "# Chi danh cho Windows. Linux/macOS/Ubuntu: dung upgrade.sh",
    "",
    "$ErrorActionPreference = \"Stop\"",
    "",
    "# ── Version ──────────────────────────────────────────────────────────────────",
    "$VER_STR = \"\"",
    "try {",
    "    if (Test-Path \"package.json\") {",
    "        $pkg = Get-Content \"package.json\" -Raw | ConvertFrom-Json",
    "        if ($pkg.version) { $VER_STR = \" v$($pkg.version)\" }",
    "    }",
    "} catch {}",
    "",
    "# ── Banner: LOGO + BOX ───────────────────────────────────────────────────────",
    "Write-Host \"\"",
    "$logo = @(",
    "    '████████╗██╗   ██╗ █████╗ ███╗   ██╗███╗   ███╗██╗███╗   ██╗██╗  ██╗██╗  ██╗ ██████╗ ██╗     ███████╗',",
    "    '╚══██╔══╝██║   ██║██╔══██╗████╗  ██║████╗ ████║██║████╗  ██║██║  ██║██║  ██║██╔═══██╗██║     ██╔════╝',",
    "    '   ██║   ██║   ██║███████║██╔██╗ ██║██╔████╔██║██║██╔██╗ ██║███████║███████║██║   ██║██║     █████╗  ',",
    "    '   ██║   ██║   ██║██╔══██║██║╚██╗██║██║╚██╔╝██║██║██║╚██╗██║██╔══██║██╔══██║██║   ██║██║     ██╔══╝  ',",
    "    '   ██║   ╚██████╔╝██║  ██║██║ ╚████║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║██║  ██║╚██████╔╝███████╗███████╗',",
    "    '   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝'",
    ")",
    "foreach ($l in $logo) { Write-Host $l -ForegroundColor Red }",
    "Write-Host \"\"",
    "",
    "# Box — node render (handles emoji visual width correctly on all terminals)",
    "$env:L1 = \"  🦞 OpenClaw Setup$VER_STR | Upgrade Script\"",
    "$env:L2 = \"  Windows (PowerShell)\"",
    "node -e @\"\nconst RED='\\x1b[0;31m',NC='\\x1b[0m';\nfunction vw(s){let w=0;for(const c of[...s]){const cp=c.codePointAt(0);w+=(cp>=0x1F000&&cp<=0x1FFFF?2:1);}return w;}\nconst L1=process.env.L1,L2=process.env.L2;\nconst INNER=Math.max(vw(L1),vw(L2))+2;\nconst D='─'.repeat(INNER);const pad=s=>' '.repeat(Math.max(0,INNER-vw(s)));\nconsole.log(RED+'╭'+D+'╮'+NC);\nconsole.log(RED+'│'+NC+L1+pad(L1)+RED+'│'+NC);\nconsole.log(RED+'│'+NC+L2+pad(L2)+RED+'│'+NC);\nconsole.log(RED+'╰'+D+'╯'+NC);\n\"@",
    "Write-Host \"\"",
    "",
    "# ── 1. Kiem tra Node.js ──────────────────────────────────────────────────────",
    "if (-not (Get-Command node -ErrorAction SilentlyContinue)) {",
    "    Write-Host \"  ❌ Khong tim thay Node.js.\" -ForegroundColor Red",
    "    Write-Host \"     Tai LTS: https://nodejs.org/\" -ForegroundColor Yellow",
    "    Read-Host \"Nhan Enter de dong\"; exit 1",
    "}",
    "$nodeVer = node -e \"process.stdout.write(process.version)\"",
    "Write-Host \"  ✅ Node.js $nodeVer\" -ForegroundColor Green",
    "",
    "# ── 2. Xac dinh thu muc project ──────────────────────────────────────────────",
    "$ScriptDir = $PSScriptRoot",
    "if (-not $ScriptDir -or $ScriptDir -eq \"\") {",
    "    $ProjectDir = (Get-Location).Path",
    "} elseif ((Test-Path (Join-Path $ScriptDir \".openclaw\")) -or (Test-Path (Join-Path $ScriptDir \"docker\"))) {",
    "    $ProjectDir = $ScriptDir",
    "} else {",
    "    $ProjectDir = (Get-Location).Path",
    "}",
    "Write-Host \"  📁 Project: $ProjectDir\" -ForegroundColor DarkGray",
    "Write-Host \"\"",
    "Set-Location $ProjectDir",
    "",
    "# ── 3. Chay upgrade ──────────────────────────────────────────────────────────",
    "Write-Host \"  🔄 Dang lay CLI moi nhat va chay upgrade...\" -ForegroundColor Cyan",
    "Write-Host \"     npx luon tai create-openclaw-bot@latest — khong can cap nhat tay\" -ForegroundColor DarkGray",
    "Write-Host \"\"",
    "",
    "try {",
    "    & npx create-openclaw-bot@latest upgrade",
    "    $exitCode = $LASTEXITCODE",
    "} catch {",
    "    Write-Host \"  ❌ Loi: $_\" -ForegroundColor Red",
    "    Read-Host \"Nhan Enter de dong\"; exit 1",
    "}",
    "",
    "Write-Host \"\"",
    "if ($exitCode -eq 0) {",
    "    Write-Host \"  🎉 Upgrade hoan tat!\" -ForegroundColor Green",
    "    Write-Host \"     Dashboard: http://localhost:18791\" -ForegroundColor Cyan",
    "} else {",
    "    Write-Host \"  ⚠️  Ma loi: $exitCode — xem log o tren.\" -ForegroundColor Yellow",
    "}",
    "Write-Host \"\"",
    "Read-Host \"Nhan Enter de dong\"",
    ""
  ].join('\r\n');
}
  function buildUpgradeSh() {
  return [
    "#!/bin/bash",
    "# OpenClaw Upgrade Script — Linux / macOS / Ubuntu",
    "# Cach dung:",
    "#   bash upgrade.sh",
    "#   curl -fsSL https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/upgrade.sh | bash",
    "#   wget -qO- https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/upgrade.sh | bash",
    "",
    "set -e",
    "",
    "RED='\\033[0;31m'",
    "GREEN='\\033[0;32m'",
    "CYAN='\\033[0;36m'",
    "YELLOW='\\033[1;33m'",
    "GRAY='\\033[0;90m'",
    "NC='\\033[0m'",
    "",
    "# ── Version ──────────────────────────────────────────────────────────────────",
    "VER=\"\"",
    "if [ -f \"package.json\" ] && command -v node &>/dev/null; then",
    "    VER=$(node -p \"try{JSON.parse(require('fs').readFileSync('package.json','utf8')).version}catch(e){''}\" 2>/dev/null || true)",
    "fi",
    "[ -n \"$VER\" ] && VER_STR=\" v${VER}\" || VER_STR=\"\"",
    "",
    "# ── Banner: LOGO + BOX ───────────────────────────────────────────────────────",
    "echo -e \"${RED}\"",
    "echo '████████╗██╗   ██╗ █████╗ ███╗   ██╗███╗   ███╗██╗███╗   ██╗██╗  ██╗██╗  ██╗ ██████╗ ██╗     ███████╗'",
    "echo '╚══██╔══╝██║   ██║██╔══██╗████╗  ██║████╗ ████║██║████╗  ██║██║  ██║██║  ██║██╔═══██╗██║     ██╔════╝'",
    "echo '   ██║   ██║   ██║███████║██╔██╗ ██║██╔████╔██║██║██╔██╗ ██║███████║███████║██║   ██║██║     █████╗  '",
    "echo '   ██║   ██║   ██║██╔══██║██║╚██╗██║██║╚██╔╝██║██║██║╚██╗██║██╔══██║██╔══██║██║   ██║██║     ██╔══╝  '",
    "echo '   ██║   ╚██████╔╝██║  ██║██║ ╚████║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║██║  ██║╚██████╔╝███████╗███████╗'",
    "echo '   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝'",
    "echo -e \"${NC}\"",
    "",
    "# Box — node render (handles emoji visual width correctly on all terminals)",
    "L1=\"  🦞 OpenClaw Setup${VER_STR} | Upgrade Script\"",
    "L2=\"  Linux / macOS / Ubuntu\"",
    "L1=\"$L1\" L2=\"$L2\" node -e \"\nconst RED='\\x1b[0;31m',NC='\\x1b[0m';\nfunction vw(s){let w=0;for(const c of[...s]){const cp=c.codePointAt(0);w+=(cp>=0x1F000&&cp<=0x1FFFF?2:1);}return w;}\nconst L1=process.env.L1,L2=process.env.L2;\nconst INNER=Math.max(vw(L1),vw(L2))+2;\nconst D='─'.repeat(INNER);const pad=s=>' '.repeat(Math.max(0,INNER-vw(s)));\nconsole.log(RED+'╭'+D+'╮'+NC);\nconsole.log(RED+'│'+NC+L1+pad(L1)+RED+'│'+NC);\nconsole.log(RED+'│'+NC+L2+pad(L2)+RED+'│'+NC);\nconsole.log(RED+'╰'+D+'╯'+NC);\n\"",
    "echo \"\"",
    "",
    "# ── 1. Kiem tra Node.js ──────────────────────────────────────────────────────",
    "if ! command -v node &> /dev/null; then",
    "    echo -e \"${RED}  ❌ Khong tim thay Node.js.${NC}\"",
    "    echo -e \"${YELLOW}     Cai dat: https://nodejs.org/${NC}\"",
    "    echo \"\"",
    "    echo -e \"${GRAY}     Ubuntu/Debian:${NC}\"",
    "    echo -e \"${GRAY}     curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -${NC}\"",
    "    echo -e \"${GRAY}     sudo apt-get install -y nodejs${NC}\"",
    "    exit 1",
    "fi",
    "NODE_VER=$(node -e \"process.stdout.write(process.version)\")",
    "echo -e \"${GREEN}  ✅ Node.js ${NODE_VER}${NC}\"",
    "",
    "# ── 2. Xac dinh thu muc project ──────────────────────────────────────────────",
    "if [[ \"${BASH_SOURCE[0]}\" == \"$0\" ]]; then",
    "    SCRIPT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")\" && pwd)\"",
    "    if [ -d \"$SCRIPT_DIR/.openclaw\" ] || [ -d \"$SCRIPT_DIR/docker\" ]; then",
    "        PROJECT_DIR=\"$SCRIPT_DIR\"",
    "    else",
    "        PROJECT_DIR=\"$PWD\"",
    "    fi",
    "else",
    "    PROJECT_DIR=\"$PWD\"",
    "fi",
    "echo -e \"${GRAY}  📁 Project: $PROJECT_DIR${NC}\"",
    "echo \"\"",
    "cd \"$PROJECT_DIR\"",
    "",
    "# ── 3. Chay upgrade ──────────────────────────────────────────────────────────",
    "echo -e \"${CYAN}  🔄 Dang lay CLI moi nhat va chay upgrade...${NC}\"",
    "echo -e \"${GRAY}     npx luon tai create-openclaw-bot@latest — khong can cap nhat tay${NC}\"",
    "echo \"\"",
    "",
    "npx create-openclaw-bot@latest upgrade",
    "EXIT_CODE=$?",
    "",
    "echo \"\"",
    "if [ $EXIT_CODE -eq 0 ]; then",
    "    echo -e \"${GREEN}  🎉 Upgrade hoan tat!${NC}\"",
    "    echo -e \"${CYAN}     Dashboard: http://localhost:18791${NC}\"",
    "else",
    "    echo -e \"${YELLOW}  ⚠️  Ma loi: $EXIT_CODE — xem log o tren.${NC}\"",
    "fi",
    "echo \"\"",
    ""
  ].join('\n');
}

  function buildCliUpgradeArtifacts() {
    return [
      { name: 'upgrade.ps1', content: buildUpgradePs1() },
      { name: 'upgrade.sh', content: buildUpgradeSh(), executable: true },
    ];
  }

  root.__openclawInstall = {
    buildSkillCatalogMarkdown,
    buildChromeDebugBat,
    buildChromeDebugSh,
    buildCliChromeDebugArtifacts,
    buildUninstallArtifact,
    buildCliUninstallArtifacts,
    buildStartBotBat,
    buildStartBotSh,
    buildCliStartBotArtifacts,
    buildUpgradePs1,
    buildUpgradeSh,
    buildCliUpgradeArtifacts,
  };

})(typeof globalThis !== 'undefined' ? globalThis : {});
if (typeof exports !== 'undefined' && typeof globalThis !== 'undefined' && globalThis.__openclawInstall) {
  Object.assign(exports, globalThis.__openclawInstall);
}
