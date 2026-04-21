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
    `npm install -g openclaw@2026.4.14 ${openClawRuntimePackages} pm2@latest`,
  ];
  providerLines(vps, 'sh');
  if (pluginCmd) vps.push(pluginCmd);
  vps.push('if [ -f ".env" ]; then set -a; . ./.env; set +a; fi');

  if (isMultiBot) {
    vps.push('echo "--- Creating shared multi-agent runtime ---"');
    appendShWriteCommands(vps, sharedNativeFileMap());
    const _uninstallVpsMulti = generateUninstallScript();
    if (_uninstallVpsMulti) appendShWriteCommands(vps, { [_uninstallVpsMulti.name]: _uninstallVpsMulti.content });
    vps.push('echo "--- Starting shared gateway via PM2 ---"');
    if (is9Router) {
      vps.push(`NINE_ROUTER_ENTRY="$(${native9RouterServerEntryLookup()})"`);
      vps.push('PORT=20128 HOSTNAME=0.0.0.0 pm2 start "$NINE_ROUTER_ENTRY" --name openclaw-multibot-9router --interpreter "$(command -v node)"');
      vps.push('pm2 start --name openclaw-multibot-9router-sync -- sh -c "node ./.9router/9router-smart-route-sync.js"');
    }
    vps.push('OPENCLAW_HOME="$OPENCLAW_HOME" OPENCLAW_STATE_DIR="$OPENCLAW_STATE_DIR" pm2 start --name openclaw-multibot -- sh -c "export OPENCLAW_HOME=$OPENCLAW_HOME OPENCLAW_STATE_DIR=$OPENCLAW_STATE_DIR && openclaw gateway run"');
    vps.push('pm2 save && pm2 startup');
    vps.push(`echo ""`);
    vps.push(`echo "=== ✅ Shared multi-bot gateway running via PM2 ==="`);
    vps.push(`echo "Commands:"`);
    vps.push(`echo "  pm2 status            # Status gateway"`);
    vps.push(`echo "  pm2 logs openclaw-multibot"`);
  } else {
    appendShWriteCommands(vps, botFiles(0));
    const _uninstallVps = generateUninstallScript();
    if (_uninstallVps) appendShWriteCommands(vps, { [_uninstallVps.name]: _uninstallVps.content });
    if (is9Router) {
      vps.push(`NINE_ROUTER_ENTRY="$(${native9RouterServerEntryLookup()})"`);
      vps.push('PORT=20128 HOSTNAME=0.0.0.0 pm2 start "$NINE_ROUTER_ENTRY" --name openclaw-9router --interpreter "$(command -v node)"');
      vps.push('pm2 start --name openclaw-9router-sync -- sh -c "node ./.9router/9router-smart-route-sync.js"');
    }
    vps.push('OPENCLAW_HOME="$OPENCLAW_HOME" OPENCLAW_STATE_DIR="$OPENCLAW_STATE_DIR" pm2 start --name openclaw -- sh -c "export OPENCLAW_HOME=$OPENCLAW_HOME OPENCLAW_STATE_DIR=$OPENCLAW_STATE_DIR && openclaw gateway run"');
    vps.push('pm2 save && pm2 startup');
    vps.push('echo "Bot dang chay! Xem log: pm2 logs openclaw"');
  }
  scriptContent = vps.filter(Boolean).join('\n');

  return { scriptName, scriptContent };
}
