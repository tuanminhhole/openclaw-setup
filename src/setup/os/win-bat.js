// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * OS generator � called from generateNativeScript() via ctx dispatch.
 * @param {object} ctx  Built by generateNativeScript() � see buildNativeScriptCtx()
 * @returns {{ scriptName: string, scriptContent: string }}
 */
function generateWinBat(ctx) {
  const {
    ch, isVi, provider, is9Router, isOllama, hasBrowser, selectedModel, isMultiBot, projectDir, todayStamp, allPlugins, pluginCmd, nativeSkillInstallCmds, nativeSkillConfigs, providerLines, sharedNativeFileMap, sharedNativeEnvContent, sharedNativeExecApprovalsContent, sharedNativeConfigContent, native9RouterSyncScriptContent, native9RouterServerEntryLookup, windowsHiddenNodeLaunch, generateUninstallScript,
  } = ctx;
  // state, PROVIDERS, SKILLS, PLUGINS, CHANNELS are IIFE-level globals
  let scriptContent;

  const isDocker = state.deployMode === 'docker';
  const scriptName = isDocker ? 'setup-openclaw-docker-win.bat' : 'setup-openclaw-win.bat';
  const lines = [
    '@echo off',
    'setlocal EnableExtensions',
    'chcp 65001 >nul',
    `set "PROJECT_DIR=${projectDir.replace(/\//g, '\\')}"`,
    'if not exist "%PROJECT_DIR%" mkdir "%PROJECT_DIR%"',
    'cd /d "%PROJECT_DIR%"',
    'set "OPENCLAW_HOME=%PROJECT_DIR%\\.openclaw"',
    'set "OPENCLAW_STATE_DIR=%PROJECT_DIR%\\.openclaw"',
    'set "DATA_DIR=%PROJECT_DIR%\\.9router"',
    'set "PATH=%APPDATA%\\npm;%PATH%"',
    'powershell -NoProfile -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force" >nul 2>&1',
    `echo === OpenClaw Setup - Windows${isDocker ? ' Docker' : ' Native'} ===`,
    'echo.',
    'echo [1/5] Kiem tra Node.js...',
    'where node >nul 2>&1 || (echo ERROR: Node.js chua cai! Tai tai: https://nodejs.org && pause && exit /b 1)',
    'echo [2/5] Cai OpenClaw CLI...',
    `call npm install -g openclaw@2026.4.14 ${openClawRuntimePackages} || goto :fail`,
    'echo [OK] OpenClaw da duoc cai dat thanh cong.',
  ];

  function appendGatewayStart(arr) {
    arr.push('echo $env:OPENCLAW_HOME = \'%OPENCLAW_HOME%\' > "%TEMP%\\oc-startgw.ps1"');
    arr.push('echo $env:OPENCLAW_STATE_DIR = \'%OPENCLAW_HOME%\' >> "%TEMP%\\oc-startgw.ps1"');
    arr.push("echo $envFile = Join-Path '%PROJECT_DIR%' '.env' >> \"%TEMP%\\oc-startgw.ps1\"");
    arr.push("echo if ^(Test-Path $envFile^) { Get-Content $envFile ^| ForEach-Object { if ^($_ -match '^[ ]*#' -or $_ -notmatch '='^) { return }; $parts = $_.Split('=', 2); if ^($parts.Length -eq 2^) { [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1], 'Process') } } } >> \"%TEMP%\\oc-startgw.ps1\"");
    arr.push('echo $b = Join-Path $env:APPDATA \'npm\\openclaw.cmd\' >> "%TEMP%\\oc-startgw.ps1"');
    arr.push('echo if ^(-not ^(Test-Path $b^)^) { $b = Join-Path $env:APPDATA \'npm\\openclaw\' } >> "%TEMP%\\oc-startgw.ps1"');
    arr.push("echo Start-Process 'cmd.exe' -WindowStyle Normal -WorkingDirectory '%PROJECT_DIR%' -ArgumentList ^('/c \"' + $b + '\" gateway run'^) >> \"%TEMP%\\oc-startgw.ps1\"");
    arr.push('powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\\oc-startgw.ps1"');
    arr.push('del "%TEMP%\\oc-startgw.ps1" >nul 2>&1');
  }

  function appendDashboardInfo(arr) {
    arr.push('echo.');
    arr.push('echo OpenClaw Dashboard: http://127.0.0.1:18791');
    arr.push('echo Other reachable URLs: http://localhost:18791');
    arr.push('echo If the dashboard asks for a Gateway Token, run: openclaw dashboard');
    if (is9Router) {
      arr.push('echo.');
      arr.push('echo 9Router Dashboard: http://127.0.0.1:20128/dashboard');
      arr.push('echo Other reachable URLs: http://localhost:20128/dashboard');
    }
  }

  providerLines(lines, 'bat');
  if (hasBrowser) {
    lines.push('echo Cai Browser Automation runtime...');
    lines.push('call npm install -g agent-browser playwright || goto :fail');
    lines.push('call npx playwright install chromium || goto :fail');
  }
  if (nativeSkillInstallCmds.length > 0) {
    lines.push('echo Cai skills...');
    lines.push(...nativeSkillInstallCmds);
  }
  if (pluginCmd) {
    lines.push('echo Cai plugins...');
    lines.push(pluginCmd);
  }
  lines.push('if not exist "%OPENCLAW_HOME%" mkdir "%OPENCLAW_HOME%"');
  if (!is9Router) lines.push('if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"');

  if (isMultiBot) {
    lines.push('echo [4/5] Tao runtime multi-agent dung chung...');
    appendBatWriteCommands(lines, mapWindowsNativeFiles(sharedNativeFileMap()));
    const uninstallWinMulti = generateUninstallScript();
    if (uninstallWinMulti) {
      appendBatWriteCommands(lines, mapWindowsNativeFiles({ [uninstallWinMulti.name]: uninstallWinMulti.content }));
    }
    const startScriptMulti = generateStartScript();
    if (startScriptMulti) {
      appendBatWriteCommands(lines, mapWindowsNativeFiles({ [startScriptMulti.name]: startScriptMulti.content }));
    }
    if (is9Router) {
      lines.push(windowsHiddenNodeLaunch('%DATA_DIR%\\9router-smart-route-sync.js', { DATA_DIR: '%DATA_DIR%' }));
    }
    lines.push('if not exist "%OPENCLAW_HOME%\\openclaw.json" (echo ERROR: Khong tim thay "%OPENCLAW_HOME%\\openclaw.json" && goto :fail)');
    lines.push('echo [5/5] Khoi dong gateway multi-bot...');
    appendGatewayStart(lines);
    lines.push('timeout /t 5 /nobreak >nul');
    lines.push('echo [OK] OpenClaw Gateway dang khoi dong trong cua so moi!');
    appendDashboardInfo(lines);
  } else {
    lines.push('echo [4/5] Tao runtime bot...');
    appendBatWriteCommands(lines, mapWindowsNativeFiles(botFiles(0)));
    const uninstallWin = generateUninstallScript();
    if (uninstallWin) {
      appendBatWriteCommands(lines, mapWindowsNativeFiles({ [uninstallWin.name]: uninstallWin.content }));
    }
    const startScript = generateStartScript();
    if (startScript) {
      appendBatWriteCommands(lines, mapWindowsNativeFiles({ [startScript.name]: startScript.content }));
    }
    if (is9Router) {
      lines.push(windowsHiddenNodeLaunch('%DATA_DIR%\\9router-smart-route-sync.js', { DATA_DIR: '%DATA_DIR%' }));
    }
    lines.push('if not exist "%OPENCLAW_HOME%\\openclaw.json" (echo ERROR: Khong tim thay "%OPENCLAW_HOME%\\openclaw.json" && goto :fail)');

    if (state.channel === 'zalo-personal') {
      lines.push('echo [5/6] Dang nhap Zalo Personal...');
      lines.push('echo.');
      lines.push('echo === HUONG DAN DANG NHAP ZALO ===');
      lines.push('echo Cua so Zalo Login se mo. Hay:');
      lines.push('echo   1. Doi QR hien ra trong cua so Zalo Login');
      lines.push('echo   2. Mo app Zalo, chon Quet QR va quet ma');
      lines.push('echo   3. Doi thay chu "Login successful" trong cua so do');
      lines.push('echo   4. Dong cua so Zalo Login');
      lines.push('echo ================================');
      lines.push('echo.');
      lines.push('start "Zalo Login" cmd /k "cd /d \"%PROJECT_DIR%\" && set OPENCLAW_HOME=%OPENCLAW_HOME% && set OPENCLAW_STATE_DIR=%OPENCLAW_HOME% && openclaw channels login --channel zalouser --verbose"');
      lines.push('echo Nhan phim bat ky sau khi dong cua so Zalo Login...');
      lines.push('pause >nul');
      lines.push('call openclaw gateway stop 2>nul');
      lines.push('timeout /t 2 /nobreak >nul');
      lines.push('echo [6/6] Khoi dong bot...');
    } else {
      lines.push('echo [5/5] Khoi dong bot...');
    }

    appendGatewayStart(lines);
    lines.push('timeout /t 5 /nobreak >nul');
    lines.push('echo [OK] OpenClaw Gateway dang khoi dong trong cua so moi!');
    appendDashboardInfo(lines);
  }

  lines.push('goto :end');
  lines.push(':fail');
  lines.push('echo.');
  lines.push('echo Cai dat that bai. Kiem tra dong loi ngay phia tren.');
  lines.push('pause');
  lines.push('exit /b 1');
  lines.push(':end');
  lines.push('pause');
  lines.push('endlocal');
  scriptContent = lines.filter(Boolean).join('\r\n');

  return { scriptName, scriptContent };
}
