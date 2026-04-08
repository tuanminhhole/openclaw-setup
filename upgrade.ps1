# OpenClaw Upgrade Script — Windows (PowerShell)
# Cach dung:
#   Nhan dup upgrade.ps1 hoac: .\upgrade.ps1
#   irm https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/upgrade.ps1 | iex
# Chi danh cho Windows. Linux/macOS/Ubuntu: dung upgrade.sh

$ErrorActionPreference = "Stop"

# ── Version ──────────────────────────────────────────────────────────────────
$VER_STR = ""
try {
    if (Test-Path "package.json") {
        $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
        if ($pkg.version) { $VER_STR = " v$($pkg.version)" }
    }
} catch {}

# ── Banner: LOGO + BOX ───────────────────────────────────────────────────────
Write-Host ""
$logo = @(
    '████████╗██╗   ██╗ █████╗ ███╗   ██╗███╗   ███╗██╗███╗   ██╗██╗  ██╗██╗  ██╗ ██████╗ ██╗     ███████╗',
    '╚══██╔══╝██║   ██║██╔══██╗████╗  ██║████╗ ████║██║████╗  ██║██║  ██║██║  ██║██╔═══██╗██║     ██╔════╝',
    '   ██║   ██║   ██║███████║██╔██╗ ██║██╔████╔██║██║██╔██╗ ██║███████║███████║██║   ██║██║     █████╗  ',
    '   ██║   ██║   ██║██╔══██║██║╚██╗██║██║╚██╔╝██║██║██║╚██╗██║██╔══██║██╔══██║██║   ██║██║     ██╔══╝  ',
    '   ██║   ╚██████╔╝██║  ██║██║ ╚████║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║██║  ██║╚██████╔╝███████╗███████╗',
    '   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝'
)
foreach ($l in $logo) { Write-Host $l -ForegroundColor Red }
Write-Host ""

# Box — node render (handles emoji visual width correctly on all terminals)
$env:L1 = "  🦞 OpenClaw Setup${VER_STR} | Upgrade Script"
$env:L2 = "  Windows (PowerShell)"
node -e @"
const RED='`u{1b}[0;31m',NC='`u{1b}[0m';
function vw(s){let w=0;for(const c of[...s]){const cp=c.codePointAt(0);w+=(cp>=0x1F000&&cp<=0x1FFFF?2:1);}return w;}
const L1=process.env.L1,L2=process.env.L2;
const INNER=Math.max(vw(L1),vw(L2))+2;
const D='─'.repeat(INNER);const pad=s=>' '.repeat(Math.max(0,INNER-vw(s)));
console.log(RED+'╭'+D+'╮'+NC);
console.log(RED+'│'+NC+L1+pad(L1)+RED+'│'+NC);
console.log(RED+'│'+NC+L2+pad(L2)+RED+'│'+NC);
console.log(RED+'╰'+D+'╯'+NC);
"@
Write-Host ""

# ── 1. Kiem tra Node.js ──────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  ❌ Khong tim thay Node.js." -ForegroundColor Red
    Write-Host "     Tai LTS: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Nhan Enter de dong"; exit 1
}
$nodeVer = node -e "process.stdout.write(process.version)"
Write-Host "  ✅ Node.js $nodeVer" -ForegroundColor Green

# ── 2. Xac dinh thu muc project ──────────────────────────────────────────────
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir -or $ScriptDir -eq "") {
    $ProjectDir = (Get-Location).Path
} elseif ((Test-Path (Join-Path $ScriptDir ".openclaw")) -or (Test-Path (Join-Path $ScriptDir "docker"))) {
    $ProjectDir = $ScriptDir
} else {
    $ProjectDir = (Get-Location).Path
}
Write-Host "  📁 Project: $ProjectDir" -ForegroundColor DarkGray
Write-Host ""
Set-Location $ProjectDir

# ── 3. Chay upgrade ──────────────────────────────────────────────────────────
Write-Host "  🔄 Dang lay CLI moi nhat va chay upgrade..." -ForegroundColor Cyan
Write-Host "     npx luon tai create-openclaw-bot@latest — khong can cap nhat tay" -ForegroundColor DarkGray
Write-Host ""

try {
    & npx create-openclaw-bot@latest upgrade
    $exitCode = $LASTEXITCODE
} catch {
    Write-Host "  ❌ Loi: $_" -ForegroundColor Red
    Read-Host "Nhan Enter de dong"; exit 1
}

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "  🎉 Upgrade hoan tat!" -ForegroundColor Green
    Write-Host "     Dashboard: http://localhost:18791" -ForegroundColor Cyan
} else {
    Write-Host "  ⚠️  Ma loi: $exitCode — xem log o tren." -ForegroundColor Yellow
}
Write-Host ""
Read-Host "Nhan Enter de dong"
