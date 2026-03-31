#!/usr/bin/env bash
# ====== OpenClaw - Chrome Debug Mode (Mac/Linux) ======
# Equivalent of start-chrome-debug.bat for Mac/Linux users
# Required for Browser Automation skill — opens Chrome with DevTools Protocol
set -e

echo "====== OpenClaw - Chrome Debug Mode ======"
echo ""

# ── Detect Chrome/Chromium path ──
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS: check standard paths
  CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [ ! -f "$CHROME_BIN" ]; then
    CHROME_BIN="/Applications/Chromium.app/Contents/MacOS/Chromium"
  fi
  if [ ! -f "$CHROME_BIN" ]; then
    CHROME_BIN="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
  fi
else
  # Linux: try common binary names
  CHROME_BIN="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium-browser || command -v chromium || echo '')"
fi

# Allow override via env var
if [ -n "$CHROME_DEBUG_BIN" ]; then
  CHROME_BIN="$CHROME_DEBUG_BIN"
fi

if [ -z "$CHROME_BIN" ] || { [ ! -f "$CHROME_BIN" ] && [ ! -x "$CHROME_BIN" ]; }; then
  echo -e "\033[31mERROR: Chrome/Chromium not found.\033[0m"
  echo "Install Google Chrome or set CHROME_DEBUG_BIN environment variable."
  echo ""
  echo "  macOS:   brew install --cask google-chrome"
  echo "  Ubuntu:  sudo apt install google-chrome-stable"
  echo "  Manual:  export CHROME_DEBUG_BIN=/path/to/chrome"
  exit 1
fi

echo "Using: $CHROME_BIN"

# ── Kill existing debug sessions ──
echo "Killing existing Chrome debug instances (port 9222)..."
pkill -f -- "--remote-debugging-port=9222" 2>/dev/null || true
sleep 2

# ── Prepare user-data directory ──
TMP_DIR="${TMPDIR:-/tmp}/chrome-debug-openclaw"
mkdir -p "$TMP_DIR"

# ── Launch Chrome ──
echo "Starting Chrome in Debug Mode (port 9222)..."
"$CHROME_BIN" \
  --remote-debugging-port=9222 \
  --remote-allow-origins=* \
  --user-data-dir="$TMP_DIR" &

CHROME_PID=$!
sleep 4

# ── Verify ──
if curl -s http://localhost:9222/json/version > /dev/null 2>&1; then
  echo -e "\033[32m✅ OK! Chrome Debug Mode is running on port 9222.\033[0m"
  echo "   PID: $CHROME_PID"
  echo ""
  echo "   Docker container will connect via socat → host.docker.internal:9222"
else
  echo -e "\033[31m❌ ERROR: Port 9222 not responding. Check if Chrome launched correctly.\033[0m"
  exit 1
fi
