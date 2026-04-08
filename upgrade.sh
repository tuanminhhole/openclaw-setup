#!/bin/bash
# OpenClaw Upgrade Script — Linux / macOS / Ubuntu
# Cach dung:
#   bash upgrade.sh
#   curl -fsSL https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/upgrade.sh | bash
#   wget -qO- https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/upgrade.sh | bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GRAY='\033[0;90m'
NC='\033[0m'

# ── Version ──────────────────────────────────────────────────────────────────
VER=""
if [ -f "package.json" ] && command -v node &>/dev/null; then
    VER=$(node -p "try{JSON.parse(require('fs').readFileSync('package.json','utf8')).version}catch(e){''}" 2>/dev/null || true)
fi
[ -n "$VER" ] && VER_STR=" v${VER}" || VER_STR=""

# ── Banner: LOGO + BOX ───────────────────────────────────────────────────────
echo -e "${RED}"
echo '████████╗██╗   ██╗ █████╗ ███╗   ██╗███╗   ███╗██╗███╗   ██╗██╗  ██╗██╗  ██╗ ██████╗ ██╗     ███████╗'
echo '╚══██╔══╝██║   ██║██╔══██╗████╗  ██║████╗ ████║██║████╗  ██║██║  ██║██║  ██║██╔═══██╗██║     ██╔════╝'
echo '   ██║   ██║   ██║███████║██╔██╗ ██║██╔████╔██║██║██╔██╗ ██║███████║███████║██║   ██║██║     █████╗  '
echo '   ██║   ██║   ██║██╔══██║██║╚██╗██║██║╚██╔╝██║██║██║╚██╗██║██╔══██║██╔══██║██║   ██║██║     ██╔══╝  '
echo '   ██║   ╚██████╔╝██║  ██║██║ ╚████║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║██║  ██║╚██████╔╝███████╗███████╗'
echo '   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝'
echo -e "${NC}"

# Box — node render (handles emoji visual width correctly on all terminals)
L1="  🦞 OpenClaw Setup${VER_STR} | Upgrade Script"
L2="  Linux / macOS / Ubuntu"
L1="$L1" L2="$L2" node -e "
const RED='\x1b[0;31m',NC='\x1b[0m';
function vw(s){let w=0;for(const c of[...s]){const cp=c.codePointAt(0);w+=(cp>=0x1F000&&cp<=0x1FFFF?2:1);}return w;}
const L1=process.env.L1,L2=process.env.L2;
const INNER=Math.max(vw(L1),vw(L2))+2;
const D='─'.repeat(INNER);const pad=s=>' '.repeat(Math.max(0,INNER-vw(s)));
console.log(RED+'╭'+D+'╮'+NC);
console.log(RED+'│'+NC+L1+pad(L1)+RED+'│'+NC);
console.log(RED+'│'+NC+L2+pad(L2)+RED+'│'+NC);
console.log(RED+'╰'+D+'╯'+NC);
"
echo ""

# ── 1. Kiem tra Node.js ──────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
    echo -e "${RED}  ❌ Khong tim thay Node.js.${NC}"
    echo -e "${YELLOW}     Cai dat: https://nodejs.org/${NC}"
    echo ""
    echo -e "${GRAY}     Ubuntu/Debian:${NC}"
    echo -e "${GRAY}     curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -${NC}"
    echo -e "${GRAY}     sudo apt-get install -y nodejs${NC}"
    exit 1
fi
NODE_VER=$(node -e "process.stdout.write(process.version)")
echo -e "${GREEN}  ✅ Node.js ${NODE_VER}${NC}"

# ── 2. Xac dinh thu muc project ──────────────────────────────────────────────
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -d "$SCRIPT_DIR/.openclaw" ] || [ -d "$SCRIPT_DIR/docker" ]; then
        PROJECT_DIR="$SCRIPT_DIR"
    else
        PROJECT_DIR="$PWD"
    fi
else
    PROJECT_DIR="$PWD"
fi
echo -e "${GRAY}  📁 Project: $PROJECT_DIR${NC}"
echo ""
cd "$PROJECT_DIR"

# ── 3. Chay upgrade ──────────────────────────────────────────────────────────
echo -e "${CYAN}  🔄 Dang lay CLI moi nhat va chay upgrade...${NC}"
echo -e "${GRAY}     npx luon tai create-openclaw-bot@latest — khong can cap nhat tay${NC}"
echo ""

npx create-openclaw-bot@latest upgrade
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}  🎉 Upgrade hoan tat!${NC}"
    echo -e "${CYAN}     Dashboard: http://localhost:18791${NC}"
else
    echo -e "${YELLOW}  ⚠️  Ma loi: $EXIT_CODE — xem log o tren.${NC}"
fi
echo ""
