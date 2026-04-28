// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * Download / uninstall / docker setup script helpers.
 * Do NOT add import/export statements. Edit, then run: node build.mjs
 */

function generateUninstallScript() {
  const os = state.nativeOs || 'win';
  const isDocker = state.deployMode === 'docker';
  const projectDirRaw = document.getElementById('cfg-project-path')?.value?.trim() || '.';
  const projectDir = projectDirRaw;
  const botName = (state.bots[0]?.name || 'openclaw').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return globalThis.__openclawInstall.buildUninstallArtifact({
    os,
    isDocker,
    projectDir,
    botName,
  });
}

function _triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

window.downloadNativeScript = function() {
  generateOutput();
  const script = window._nativeScript;
  if (!script) return;
  _triggerDownload(script.name, script.content, 'text/plain;charset=utf-8');
  // uninstall script is created in the project dir by the installer itself — no separate download needed
};

function generateAutoSetupBat() {
  const files = state._generatedFiles;
  if (!files) return '';
  const projectDir = document.getElementById('cfg-project-path')?.value?.trim() || 'D:\\openclaw-setup';
  const lang = document.getElementById('cfg-language')?.value || 'vi';
  const isVi = lang === 'vi';

  // Helper: escape content for PowerShell single-quoted here-string (@'...'@)
  // The ONLY thing that can break a here-string is a line starting with '@
  function escapeHereString(content) {
    return String(content).replace(/\r\n/g, '\n').replace(/^'@/mg, "'`@");
  }

  // Helper: detect whether content needs variable-based write (complex files)
  // Files with backticks, triple-backticks, or deeply nested quotes should use variable approach
  function isComplexContent(content) {
    return /[`]/.test(content) || /\)\s*;\s*$/.test(content) || /^CMD /m.test(content);
  }

  let ps = `$ErrorActionPreference = "Stop"
$projectDir = "${projectDir.replace(/\\/g, '\\\\')}"
$utf8 = [System.Text.UTF8Encoding]::new($false)
Write-Host ""
Write-Host "  OpenClaw Auto Setup" -ForegroundColor Cyan
Write-Host "  Project: $projectDir" -ForegroundColor White
Write-Host ""
try {
Write-Host "[1/4] ${isVi ? 'Tao thu muc...' : 'Creating directories...'}" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "$projectDir" | Out-Null
`;
  const dirs = new Set();
  Object.keys(files).forEach(path => {
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) dirs.add(dir);
  });
  Array.from(dirs).sort().forEach(dir => {
    ps += `New-Item -ItemType Directory -Force -Path "$projectDir\\${dir.replace(/\//g, '\\')}" | Out-Null\n`;
  });
  ps += `Write-Host "[2/4] ${isVi ? 'Ghi config files...' : 'Writing config files...'}" -ForegroundColor Yellow\n`;

  let varCounter = 0;
  Object.entries(files).forEach(([path, content]) => {
    const safeContent = escapeHereString(content);
    const winPath = path.replace(/\//g, '\\');
    if (isComplexContent(content)) {
      // Complex files: assign to variable first, then write — avoids inline here-string parse issues
      const varName = `$_f${varCounter++}`;
      ps += `\n${varName} = @'\n${safeContent}\n'@\n[IO.File]::WriteAllText("$projectDir\\${winPath}", ${varName}, $utf8)\n`;
    } else {
      ps += `\n[IO.File]::WriteAllText("$projectDir\\${winPath}", @'\n${safeContent}\n'@, $utf8)\n`;
    }
  });
  ps += `Write-Host "[3/4] ${isVi ? 'Build Docker image...' : 'Building Docker image...'}" -ForegroundColor Yellow\n`;
  ps += `Set-Location "$projectDir\\docker\\openclaw"\n$cacheBust = (Get-Date -Format 'yyyyMMddHHmmss')\n& docker compose build --build-arg CACHE_BUST=$cacheBust\n`;
  ps += `Write-Host "[4/4] ${isVi ? 'Khoi dong bot...' : 'Starting bot...'}" -ForegroundColor Yellow\n& docker compose up -d\n`;

  if (state.channel === 'zalo-personal') {
    const botName = (state.bots[0]?.name || 'openclaw').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const containerName = `openclaw-${botName}`;
    const qrPath = '/tmp/openclaw/openclaw-zalouser-qr-default.png';
    ps += `\nWrite-Host "" -ForegroundColor White\n`;
    ps += `Write-Host "${isVi ? '=== DANG NHAP ZALO ===' : '=== ZALO LOGIN ==='}" -ForegroundColor Cyan\n`;
    ps += `Write-Host "${isVi ? 'Doi container khoi dong 10 giay...' : 'Waiting 10s for container to start...'}" -ForegroundColor Yellow\n`;
    ps += `Start-Sleep -Seconds 10\n`;
    ps += `Write-Host "" -ForegroundColor White\n`;
    ps += `Write-Host "${isVi ? 'Huong dan dang nhap Zalo:' : 'Zalo login instructions:'}" -ForegroundColor White\n`;
    ps += `Write-Host "  ${isVi ? '1. cd docker\\\\openclaw' : '1. cd docker\\\\openclaw'}" -ForegroundColor White\n`;
    ps += `Write-Host "  ${isVi ? '2. docker exec -it ${containerName} openclaw channels login --channel zalouser --verbose' : '2. docker exec -it ${containerName} openclaw channels login --channel zalouser --verbose'}" -ForegroundColor White\n`;
    ps += `Write-Host "  ${isVi ? '3. Mo Docker Desktop > container ${containerName} > tab Files > tim file: ${qrPath}' : '3. Open Docker Desktop > container ${containerName} > Files tab > find: ${qrPath}'}" -ForegroundColor White\n`;
    ps += `Write-Host "  ${isVi ? '   Hoac chay:  docker cp ${containerName}:${qrPath} ./zalo-qr.png' : '   Or run:  docker cp ${containerName}:${qrPath} ./zalo-qr.png'}" -ForegroundColor White\n`;
    ps += `Write-Host "  ${isVi ? '4. Mo app Zalo > Quet QR > quet ma trong file QR' : '4. Open Zalo app > Scan QR > scan the QR image'}" -ForegroundColor White\n`;
    ps += `Write-Host "  ${isVi ? '5. Doi thay chu Login successful trong terminal' : '5. Wait for Login successful in terminal'}" -ForegroundColor White\n`;
    ps += `Write-Host "  ${isVi ? '6. Restart container:  docker compose restart' : '6. Restart container:  docker compose restart'}" -ForegroundColor White\n`;
    ps += `Write-Host "" -ForegroundColor White\n`;
    ps += `Write-Host "${isVi ? 'Dang chay lenh login...' : 'Running login command...'}" -ForegroundColor Yellow\n`;
    ps += `& docker exec -it ${containerName} openclaw channels login --channel zalouser --verbose\n`;
    ps += `Write-Host "" -ForegroundColor White\n`;
    ps += `Write-Host "${isVi ? 'Restart container de ap dung...' : 'Restarting container to apply...'}" -ForegroundColor Green\n`;
    ps += `& docker compose restart\n`;
  }

  ps += `} catch { Write-Host $_.Exception.Message -ForegroundColor Red }\nRead-Host "${isVi ? 'Nhan Enter de thoat' : 'Press Enter to exit'}"\n`;
  return `@echo off
chcp 65001>nul
set "OPENCLAW_SELF=%~f0"
set "OPENCLAW_TMP=%TEMP%\\openclaw_%RANDOM%.ps1"
powershell -ep bypass -nop -c "$l=(Select-String -Path $env:OPENCLAW_SELF -Pattern '^\\s*:PS_BEGIN\\s*$').LineNumber;$a=[io.file]::ReadAllLines($env:OPENCLAW_SELF,[text.encoding]::UTF8);[io.file]::WriteAllText($env:OPENCLAW_TMP,($a[$l..($a.Length-1)] -join \\"\`n\\"),[text.encoding]::UTF8)"
powershell -ep bypass -nop -File "%OPENCLAW_TMP%"
if %errorlevel% neq 0 pause
del "%OPENCLAW_TMP%" 2>nul
exit /b
:PS_BEGIN
${ps}`;
}

function generateSetupScript(files) {
  if (!files) return '# No files generated';
  const lang = document.getElementById('cfg-language')?.value || 'vi';
  const isVi = lang === 'vi';
  const isMultiBot = state.botCount > 1 && state.channel === 'telegram';
  let script = `#!/bin/bash
set -e
echo "OpenClaw Setup${isMultiBot ? ` (${state.botCount} bots)` : ''}..."
echo ""
`;
  const dirs = new Set();
  Object.keys(files).forEach(path => {
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) dirs.add(dir);
  });
  Array.from(dirs).sort().forEach(dir => {
    script += `mkdir -p "${dir}"\n`;
  });
  script += '\n';
  Object.entries(files).forEach(([path, content]) => {
    script += `cat > "${path}" << 'CLAWEOF'\n${String(content)}${String(content).endsWith('\n') ? '' : '\n'}CLAWEOF\n\n`;
  });
  script += `echo "${isVi ? 'Files created' : 'Files created'}"\ncd "docker/openclaw"\ndocker compose build --build-arg CACHE_BUST=$(date +%s)\ndocker compose up --detach\n`;

  if (state.channel === 'zalo-personal') {
    const botName = (state.bots[0]?.name || 'openclaw').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const containerName = `openclaw-${botName}`;
    const qrPath = '/tmp/openclaw/openclaw-zalouser-qr-default.png';
    script += `\necho ""\necho "${isVi ? '=== DANG NHAP ZALO ===' : '=== ZALO LOGIN ==='}"\necho "${isVi ? 'Doi container khoi dong 10 giay...' : 'Waiting 10s for container to start...'}"\nsleep 10\n`;
    script += `echo "${isVi ? 'Huong dan dang nhap Zalo:' : 'Zalo login instructions:'}"\necho "  ${isVi ? '1. cd docker/openclaw' : '1. cd docker/openclaw'}"\necho "  ${isVi ? '2. docker exec -it ${containerName} openclaw channels login --channel zalouser --verbose' : '2. docker exec -it ${containerName} openclaw channels login --channel zalouser --verbose'}"\necho "  ${isVi ? '3. Tim file QR trong container: ${qrPath}' : '3. Find QR image in container: ${qrPath}'}"\necho "  ${isVi ? '   Hoac chay:  docker cp ${containerName}:${qrPath} ./zalo-qr.png' : '   Or run:  docker cp ${containerName}:${qrPath} ./zalo-qr.png'}"\necho "  ${isVi ? '4. Mo app Zalo > Quet QR > quet ma' : '4. Open Zalo app > Scan QR > scan'}"\necho "  ${isVi ? '5. Doi thay Login successful' : '5. Wait for Login successful'}"\necho "  ${isVi ? '6. Restart:  docker compose restart' : '6. Restart:  docker compose restart'}"\necho ""\n`;
    script += `docker exec -it ${containerName} openclaw channels login --channel zalouser --verbose\n`;
    script += `echo "${isVi ? 'Restart container...' : 'Restarting container...'}"\ndocker compose restart\n`;
  }

  return script;
}

function downloadAutoSetupBat() {
  generateOutput();
  const os = state.nativeOs || 'win';
  const isWindows = os === 'win';
  let filename;
  let blob;
  if (isWindows) {
    const content = generateAutoSetupBat();
    filename = 'setup-openclaw-docker-win.bat';
    blob = new Blob([content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')], { type: 'application/x-bat;charset=utf-8' });
  } else {
    const osLabel = os === 'linux' ? 'macos' : (os === 'vps' ? 'vps' : os);
    filename = `setup-openclaw-docker-${osLabel}.sh`;
    blob = new Blob([generateSetupScript(state._generatedFiles)], { type: 'text/x-shellscript;charset=utf-8' });
  }
  const dlLabel = document.getElementById('docker-dl-filename');
  if (dlLabel) dlLabel.textContent = filename;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
window.downloadAutoSetupBat = downloadAutoSetupBat;

function updateDockerDlLabel() {
  const os = state.nativeOs || 'win';
  const isWindows = os === 'win';
  const lbl = document.getElementById('docker-dl-filename');
  const icon = document.getElementById('docker-dl-icon');
  const title = document.getElementById('docker-dl-title');
  const desc = document.getElementById('docker-dl-desc');
  const winNote = document.getElementById('docker-dl-win-note');
  const shNote = document.getElementById('docker-dl-sh-note');
  const shCmd = document.getElementById('docker-dl-sh-cmd');
  if (isWindows) {
    if (lbl) lbl.textContent = 'setup-openclaw-docker-win.bat';
    if (icon) icon.textContent = '🪟';
    if (title) title.textContent = 'Cách 1: Windows — Download & Double-click';
    if (desc) desc.textContent = 'Tải file .bat → double-click → tự động cài Docker, pull model và khởi động bot.';
    if (winNote) winNote.style.display = 'block';
    if (shNote) shNote.style.display = 'none';
  } else {
    const osLabel = os === 'linux' ? 'macos' : (os === 'vps' ? 'vps' : os);
    const fn = `setup-openclaw-docker-${osLabel}.sh`;
    if (lbl) lbl.textContent = fn;
    if (icon) icon.textContent = '💻';
    if (title) title.textContent = `Cách 1: ${osLabel === 'macos' ? 'macOS/Linux' : 'VPS'} — Tải Bash Script`;
    if (desc) desc.textContent = 'Tải file .sh về và chạy lệnh trong Terminal để cài đặt hệ thống.';
    if (winNote) winNote.style.display = 'none';
    if (shNote) {
      shNote.style.display = 'block';
      if (shCmd) shCmd.innerHTML = `chmod +x <span class="docker-dl-fn-copy">${fn}</span> && ./<span class="docker-dl-fn-copy">${fn}</span>`;
    }
  }
}

window.__downloadGen = {
  generateUninstallScript,
  generateAutoSetupBat,
  generateSetupScript,
  downloadAutoSetupBat,
  updateDockerDlLabel,
};
