// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * OS generator — called from generateNativeScript() via ctx dispatch.
 * @param {object} ctx  Built by generateNativeScript() — see buildNativeScriptCtx()
 * @returns {{ scriptName: string, scriptContent: string }}
 */
function generateVpsSh(ctx) {
  const {
    ch, isVi, provider, is9Router, isOllama, hasBrowser, selectedModel, isMultiBot, projectDir, todayStamp, allPlugins, pluginCmd, nativeSkillInstallCmds, nativeSkillConfigs, providerLines, sharedNativeFileMap, sharedNativeEnvContent, sharedNativeExecApprovalsContent, sharedNativeConfigContent, native9RouterSyncScriptContent, native9RouterServerEntryLookup, windowsHiddenNodeLaunch, generateUninstallScript,
  } = ctx;
  // state, PROVIDERS, SKILLS, PLUGINS, CHANNELS are IIFE-level globals
  let scriptContent;

  const scriptName = 'setup-openclaw-vps.sh';
  const appName = isMultiBot ? 'openclaw-multibot' : 'openclaw';
  const vps = [
    '#!/usr/bin/env bash', 'set -e',
    `echo "=== OpenClaw Setup — Ubuntu/VPS${isMultiBot ? ` Multi-Bot (${state.botCount} bots)` : ''} ==="`,
    '# Auto-install Node.js 20 LTS if missing',
    'if ! command -v node > /dev/null 2>&1; then',
    '  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -',
    '  sudo apt-get install -y nodejs',
    'fi',
    'mkdir -p "$HOME/.local/bin"',
    'npm config set prefix "$HOME/.local"',
    'export PATH="$HOME/.local/bin:$PATH"',
    `PROJECT_DIR="${projectDir.replace(/"/g, '\\"')}"`,
    'mkdir -p "$PROJECT_DIR"',
    'cd "$PROJECT_DIR"',
    'export OPENCLAW_HOME="$PROJECT_DIR/.openclaw"',
    'export OPENCLAW_STATE_DIR="$PROJECT_DIR/.openclaw"',
    'export DATA_DIR="$PROJECT_DIR/.9router"',
    'grep -Fqx \'export PATH="$HOME/.local/bin:$PATH"\' "$HOME/.bashrc" 2>/dev/null || echo \'export PATH="$HOME/.local/bin:$PATH"\' >> "$HOME/.bashrc"',
    'grep -Fqx \'export PATH="$HOME/.local/bin:$PATH"\' "$HOME/.profile" 2>/dev/null || echo \'export PATH="$HOME/.local/bin:$PATH"\' >> "$HOME/.profile"',
    `npm install -g openclaw@latest ${openClawRuntimePackages} pm2@latest`,
  ];
  providerLines(vps, 'sh');
  if (pluginCmd) vps.push(pluginCmd);
  vps.push('if [ -f ".env" ]; then set -a; . ./.env; set +a; fi');

  // ── Write bot runtime files ──────────────────────────────────────────────
  if (isMultiBot) {
    vps.push('echo "--- Creating shared multi-agent runtime ---"');
    appendShWriteCommands(vps, sharedNativeFileMap());
    const _uninstallVpsMulti = generateUninstallScript();
    if (_uninstallVpsMulti) appendShWriteCommands(vps, { [_uninstallVpsMulti.name]: _uninstallVpsMulti.content });
  } else {
    appendShWriteCommands(vps, botFiles(0));
    const _uninstallVps = generateUninstallScript();
    if (_uninstallVps) appendShWriteCommands(vps, { [_uninstallVps.name]: _uninstallVps.content });
  }

  // ── Create start-bot.sh restart script ─────────────────────────────────
  const startScript = globalThis.__openclawInstall.buildStartBotSh({
    projectDir,
    is9Router,
    isVi,
    osChoice: 'vps',
    isMultiBot,
    appName,
  });
  appendShWriteCommands(vps, { 'start-bot.sh': startScript });
  vps.push('chmod +x start-bot.sh');

  // ── Create PM2 entrypoint wrapper ──────────────────────────────────────
  // PM2 needs a proper script file with env setup to survive restarts.
  // Inline `-- sh -c` loses env vars on pm2 restart/reboot.
  vps.push('echo "--- Creating PM2 entrypoint wrapper ---"');
  vps.push(`cat > "$PROJECT_DIR/.openclaw/start-gateway.sh" << 'GWEOF'
#!/bin/bash
set -e
cd "${projectDir.replace(/"/g, '\\"')}"
export OPENCLAW_HOME="$PWD/.openclaw"
export OPENCLAW_STATE_DIR="$PWD/.openclaw"
export DATA_DIR="$PWD/.9router"
export PATH="$HOME/.local/bin:$PATH"
if [ -f ".env" ]; then set -a; . ./.env; set +a; fi
exec openclaw gateway run
GWEOF`);
  vps.push('chmod +x "$PROJECT_DIR/.openclaw/start-gateway.sh"');

  // ── Start services via PM2 ─────────────────────────────────────────────
  vps.push('echo "--- Starting services via PM2 ---"');
  vps.push('NODE_BIN="$(command -v node)"');

  if (is9Router) {
    vps.push(`NINE_ROUTER_ENTRY="$(${native9RouterServerEntryLookup()})"`);\r
    vps.push(`PORT=20128 HOSTNAME=0.0.0.0 DATA_DIR="$DATA_DIR" pm2 start "$NINE_ROUTER_ENTRY" --name ${appName}-9router --interpreter "$NODE_BIN"`);
    // 9Router sync: start the actual JS file directly with node interpreter
    vps.push(`pm2 start "$PROJECT_DIR/.9router/9router-smart-route-sync.js" --name ${appName}-9router-sync --interpreter "$NODE_BIN" --env DATA_DIR="$DATA_DIR"`);
  }

  // ── Zalo Personal Login (before gateway) ──────────────────────────────
  if (state.channel === 'zalo-personal') {
    vps.push(...generateZaloLoginSh({ homeVar: '$OPENCLAW_HOME', projectDirVar: '$PROJECT_DIR' }));
  }

  // Gateway: start the bash wrapper script (has all env setup baked in)
  vps.push(`pm2 start "$PROJECT_DIR/.openclaw/start-gateway.sh" --name ${appName} --interpreter bash`);
  vps.push('pm2 save && pm2 startup');

  if (isMultiBot) {
    vps.push('echo ""');
    vps.push(`echo "=== ✅ Shared multi-bot gateway running via PM2 ==="`);
    vps.push('echo "Commands:"');
    vps.push(`echo "  pm2 status            # Status gateway"`);
    vps.push(`echo "  pm2 logs ${appName}"`);
  } else {
    vps.push(`echo "Bot dang chay! Xem log: pm2 logs ${appName}"`);
  }

  vps.push('echo ""');
  vps.push('echo "Dashboard: http://127.0.0.1:18791"');
  if (is9Router) vps.push('echo "9Router:   http://127.0.0.1:20128/dashboard"');
  vps.push('echo ""');
  vps.push(`echo "Restart:   bash start-bot.sh"`);
  vps.push(`echo "Logs:      pm2 logs ${appName}"`);

  scriptContent = vps.filter(Boolean).join('\n');

  return { scriptName, scriptContent };
}
