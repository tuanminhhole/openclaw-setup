'use strict';

/**
 * Double-click launchers for a NATIVE bot on Windows.
 *
 * Why these exist instead of a Scheduled Task: `openclaw daemon install` creates a task with
 * `LogonType: Interactive`, which means the gateway is tied to whoever's login session started
 * it. Two consequences measured on win_kha (10/09/2026):
 *   • anything started over SSH dies the moment the session closes (LastTaskResult 0xC000013A);
 *   • a task set to run at boot is refused outright, because "at startup" and "only while
 *     someone is logged in" contradict each other (0x800710E0).
 * Making it run without a login needs the account password stored in the task — Task Scheduler
 * rejected that too ("The user account is unknown, the password is incorrect"). So the owner
 * drives it by hand, exactly like the .command files on macOS.
 *
 * Every trap below cost a round trip with a customer waiting, so they are encoded here:
 *
 *  1. `.cmd` MUST be CRLF. LF-only files break on Windows.
 *  2. Never name a launcher after the command it calls. `9router.cmd` in the project dir plus
 *     `cd /d <project>` makes `call 9router` re-enter the same file — BATCH RECURSION, and the
 *     process dies before doing anything.
 *  3. Never append to a fixed log file. 9router holds its log open for its whole lifetime, so
 *     the SECOND run cannot open it and exits with "The process cannot access the file because
 *     it is being used by another process" — invisible on the first run, which is why it is easy
 *     to ship broken.
 *  4. 9router shows a `Choose Interface` menu when its stdout looks like a real console. Started
 *     hidden, nobody can answer it, so it hangs and never opens its port. `> NUL` is what tells
 *     it to run unattended. Symptom without it: works when run by hand, silently dead in the
 *     background — same command.
 *  5. `Start-Process -WindowStyle Hidden` does NOT hide a console a .cmd opens for itself. Only
 *     WScript.Shell.Run(..., 0, False) truly hides it. Leaving a visible window is not cosmetic:
 *     it IS the bot, and closing it kills the bot.
 *  6. Anchor the working directory. Agents may carry relative workspace paths, which resolve
 *     against the launcher's cwd — move the files into a folder and those bots die with
 *     WORKSPACE_VANISHED while the others keep working.
 */

const CRLF = (s) => s.replace(/\r?\n/g, '\r\n');

/** Hidden-launch helper. WScript is the only reliable way to start a .cmd with no window. */
function buildRunHiddenVbs() {
  return CRLF(
    'Set sh = CreateObject("WScript.Shell")\n' +
    'sh.Run "cmd /c """ & WScript.Arguments(0) & """", 0, False\n',
  );
}

/** Starts 9router. Named start-9router.cmd on purpose — see trap 2. */
function build9RouterCmd({ projectDir, routerPort }) {
  return CRLF(
    '@echo off\n' +
    'rem Ten tep KHONG duoc la "9router.cmd": trung ten thi lenh ben duoi goi lai chinh no.\n' +
    'rem "> NUL" la bat buoc: neu dau ra la man hinh that, 9router bay menu "Choose Interface"\n' +
    'rem roi cho nguoi chon va khong bao gio mo cong.\n' +
    `cd /d ${projectDir}\n` +
    `set "DATA_DIR=${projectDir}\\.9router"\n` +
    `call 9router -n -l -H 127.0.0.1 -p ${routerPort} --skip-update > NUL 2>&1\n`,
  );
}

/**
 * The node host that gives the bot screen control.
 *
 * Two things here are not obvious and both cost a day:
 *  - It runs against `<project>\.openclaw-node`, NOT the bot's state dir. Pointed at the bot's, it
 *    loads the bot's plugins too, and zalo-mod's dashboard port is already held by the gateway, so
 *    the node dies on `listen EADDRINUSE 127.0.0.1:18790` before publishing computer.act.
 *  - It is launched as a .cmd through wscript like everything else on Windows. Spawning the
 *    `openclaw.cmd` shim from Node with detached+shell fails outright with `spawn EINVAL`.
 */
function buildNodeHostCmd({ projectDir, gatewayPort, gatewayToken }) {
  return CRLF(
    '@echo off\n' +
    'rem Node host cho tinh nang dieu khien may (tool computer/screen cua OpenClaw).\n' +
    `cd /d ${projectDir}\n` +
    'set "HOME=%USERPROFILE%"\n' +
    `set "OPENCLAW_HOME=${projectDir}\\.openclaw-node"\n` +
    `set "OPENCLAW_STATE_DIR=${projectDir}\\.openclaw-node"\n` +
    (gatewayToken ? `set "OPENCLAW_GATEWAY_TOKEN=${gatewayToken}"\n` : '') +
    '"%ProgramFiles%\\nodejs\\node.exe" ' +
    '"%APPDATA%\\npm\\node_modules\\openclaw\\dist\\index.js" ' +
    `node run --host 127.0.0.1 --port ${gatewayPort} --no-tls\n`,
  );
}

/** Starts the gateway. Calls node directly - see the --task-supervisor note below. */
function buildGatewayCmd({ projectDir, gatewayPort }) {
  return CRLF(
    '@echo off\n' +
    'rem Goi thang node, KHONG qua gateway.cmd cua openclaw: tep do chay kem --task-supervisor,\n' +
    'rem no di tim Scheduled Task de ban giao; khong co task thi no de them tien trinh + cua so.\n' +
    'rem Khong redirect ra tep co dinh (xem trap 3) — openclaw tu ghi nhat ky trong %TEMP%\\openclaw.\n' +
    `cd /d ${projectDir}\n` +
    'set "HOME=%USERPROFILE%"\n' +
    `set "OPENCLAW_GATEWAY_PORT=${gatewayPort}"\n` +
    `set "OPENCLAW_PORT=${gatewayPort}"\n` +
    '"%ProgramFiles%\\nodejs\\node.exe" --max-old-space-size=8192 ' +
    `"%APPDATA%\\npm\\node_modules\\openclaw\\dist\\index.js" gateway --port ${gatewayPort}\n`,
  );
}

function buildSetupUiCmd({ projectDir, setupPort }) {
  return CRLF(
    '@echo off\n' +
    'rem Ten tep nhat ky kem gio, de lan chay sau khong dung vao tep dang bi giu (trap 3).\n' +
    `cd /d ${projectDir}\n` +
    'for /f "tokens=1-4 delims=/: " %%a in ("%TIME%") do set "T=%%a%%b%%c"\n' +
    `call npx create-openclaw-bot --host=127.0.0.1 --port=${setupPort} --no-open --project-dir=${projectDir}` +
    ` > "${projectDir}\\setup-ui-%T%.log" 2>&1\n`,
  );
}

function buildStartBotCmd({ projectDir, gatewayPort, routerPort }) {
  const dashPort = gatewayPort + 1;
  return CRLF(
    '@echo off\n' +
    'title Khoi dong bot OpenClaw\n' +
    'color 0A\n' +
    `cd /d ${projectDir}\n` +
    'echo.\n' +
    'echo   ============================================\n' +
    `echo      KHOI DONG BOT  --  ${projectDir}\n` +
    'echo   ============================================\n' +
    'echo.\n' +
    'echo   Dang bat 9Router...\n' +
    `powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort ${routerPort} -State Listen -EA SilentlyContinue)) { Start-Process wscript -ArgumentList '${projectDir}\\run-hidden.vbs','${projectDir}\\start-9router.cmd' -WindowStyle Hidden }" >nul 2>&1\n` +
    'echo   Cho 9Router san sang...\n' +
    `powershell -NoProfile -Command "for($i=0;$i -lt 20;$i++){ try{ Invoke-WebRequest 'http://127.0.0.1:${routerPort}/' -UseBasicParsing -TimeoutSec 3 | Out-Null; break } catch { Start-Sleep -Seconds 2 } }"\n` +
    'echo   Dang bat bot (gateway)...\n' +
    `powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort ${gatewayPort} -State Listen -EA SilentlyContinue)) { Start-Process wscript -ArgumentList '${projectDir}\\run-hidden.vbs','${projectDir}\\gateway-start.cmd' -WindowStyle Hidden }" >nul 2>&1\n` +
    'echo   Cho bot san sang (co the mat 30-60 giay)...\n' +
    'echo.\n' +
    `powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 40;$i++){ try{ Invoke-WebRequest 'http://127.0.0.1:${gatewayPort}/health' -UseBasicParsing -TimeoutSec 3 | Out-Null; $ok=$true; break } catch { Start-Sleep -Seconds 3 } }; if($ok){ Write-Host '   [OK] Bot da chay.' -ForegroundColor Green } else { Write-Host '   [LOI] Bot chua len.' -ForegroundColor Red }"\n` +
    'echo.\n' +
    'echo   --- Trang thai ---\n' +
    `powershell -NoProfile -Command "foreach($x in @(@('Bot (gateway)','http://127.0.0.1:${gatewayPort}/health'),@('9Router','http://127.0.0.1:${routerPort}/'),@('Bang dieu khien Zalo','http://127.0.0.1:${dashPort}/dashboard'))){ try{ (Invoke-WebRequest $x[1] -UseBasicParsing -TimeoutSec 6) | Out-Null; Write-Host ('   {0,-22} DANG CHAY' -f $x[0]) -ForegroundColor Green } catch { Write-Host ('   {0,-22} TAT' -f $x[0]) -ForegroundColor Red } }"\n` +
    'echo.\n' +
    'echo   Bot chay AN, khong co cua so nao de lo tay dong.\n' +
    'echo   Bot chi tat khi ban DANG XUAT / TAT may, hoac bam "3 - DUNG BOT".\n' +
    'echo.\n' +
    'timeout /t 12 >nul\n',
  );
}

function buildOpenUiCmd({ projectDir, setupPort }) {
  return CRLF(
    '@echo off\n' +
    'title Mo giao dien bot\n' +
    'color 0B\n' +
    `cd /d ${projectDir}\n` +
    'echo.\n' +
    'echo   ============================================\n' +
    'echo      MO GIAO DIEN QUAN TRI BOT\n' +
    'echo   ============================================\n' +
    'echo.\n' +
    `powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort ${setupPort} -State Listen -EA SilentlyContinue)) { Write-Host '   Dang bat giao dien...'; Start-Process wscript -ArgumentList '${projectDir}\\run-hidden.vbs','${projectDir}\\setup-ui.cmd' -WindowStyle Hidden } else { Write-Host '   Giao dien dang chay san.' }"\n` +
    'echo   Cho giao dien san sang...\n' +
    `powershell -NoProfile -Command "for($i=0;$i -lt 30;$i++){ try{ Invoke-WebRequest 'http://127.0.0.1:${setupPort}/' -UseBasicParsing -TimeoutSec 3 | Out-Null; break } catch { Start-Sleep -Seconds 2 } }"\n` +
    `start "" http://127.0.0.1:${setupPort}\n` +
    'echo.\n' +
    'echo   Da mo trinh duyet. Dong cua so nay duoc roi.\n' +
    'timeout /t 8 >nul\n',
  );
}

function buildStopBotCmd({ gatewayPort, routerPort }) {
  return CRLF(
    '@echo off\n' +
    'title Dung bot OpenClaw\n' +
    'color 0C\n' +
    'echo.\n' +
    'echo   Dang dung bot va 9Router...\n' +
    'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Where-Object { $_.CommandLine -like \'*openclaw*gateway*\' -or $_.CommandLine -like \'*9router*\' } | ForEach-Object { Write-Host (\'   dung PID \' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }"\n' +
    'echo.\n' +
    `powershell -NoProfile -Command "Start-Sleep -Seconds 3; foreach($x in @(@('Bot',${gatewayPort}),@('9Router',${routerPort}))){ $c=Get-NetTCPConnection -LocalPort $x[1] -State Listen -EA SilentlyContinue; if($c){ Write-Host ('   {0,-10} VAN CHAY' -f $x[0]) -ForegroundColor Yellow } else { Write-Host ('   {0,-10} da tat' -f $x[0]) -ForegroundColor Green } }"\n` +
    'echo.\n' +
    'pause\n',
  );
}

function buildReadme({ projectDir, gatewayPort, routerPort, setupPort }) {
  return CRLF(
    'BOT OPENCLAW TREN MAY NAY - HUONG DAN NHANH\n' +
    '===========================================\n\n' +
    'Ba tep .cmd, bam dup la chay. Khong can go lenh.\n\n' +
    '  1 - KHOI DONG BOT.cmd     Bat bot len. Bam sau moi lan khoi dong may.\n' +
    '  2 - MO GIAO DIEN.cmd      Mo trang quan tri bot trong trinh duyet.\n' +
    '  3 - DUNG BOT.cmd          Tat bot (chi dung khi can).\n\n' +
    'QUAN TRONG\n' +
    '----------\n' +
    '- Bot chay AN hoan toan: khong co cua so den nao nam tren man hinh.\n' +
    '- Bot KHONG tu chay khi bat may. Sau moi lan khoi dong lai may,\n' +
    '  bam "1 - KHOI DONG BOT" mot lan la xong.\n' +
    '- Bot se tat khi ban DANG XUAT hoac TAT may.\n' +
    '- Dat cac tep nay o dau cung duoc, chung deu neo ve ' + projectDir + '.\n\n' +
    'Cong dang dung:\n' +
    `  ${gatewayPort}  bot (gateway)\n` +
    `  ${gatewayPort + 1}  bang dieu khien Zalo\n` +
    `  ${routerPort}  9Router\n` +
    `  ${setupPort}  giao dien quan tri\n`,
  );
}

/** All launcher files for a native Windows project, as { relativeName: content }. */
function buildWindowsLaunchers({ projectDir, gatewayPort = 18789, routerPort = 20128, setupPort = 51789, gatewayToken = '' }) {
  const opts = { projectDir, gatewayPort, routerPort, setupPort, gatewayToken };
  return {
    'run-hidden.vbs': buildRunHiddenVbs(),
    'start-9router.cmd': build9RouterCmd(opts),
    'gateway-start.cmd': buildGatewayCmd(opts),
    'node-host.cmd': buildNodeHostCmd(opts),
    'setup-ui.cmd': buildSetupUiCmd(opts),
    '0 - DOC TRUOC.txt': buildReadme(opts),
    '1 - KHOI DONG BOT.cmd': buildStartBotCmd(opts),
    '2 - MO GIAO DIEN.cmd': buildOpenUiCmd(opts),
    '3 - DUNG BOT.cmd': buildStopBotCmd(opts),
  };
}

/** Which of the generated files belong on the Desktop rather than in the project folder. */
const WINDOWS_DESKTOP_LAUNCHERS = ['0 - DOC TRUOC.txt', '1 - KHOI DONG BOT.cmd', '2 - MO GIAO DIEN.cmd', '3 - DUNG BOT.cmd'];

const api = { buildWindowsLaunchers, WINDOWS_DESKTOP_LAUNCHERS };
if (typeof globalThis !== 'undefined') globalThis.__openclawWindowsLaunchers = api;
if (typeof exports !== 'undefined') Object.assign(exports, api);
