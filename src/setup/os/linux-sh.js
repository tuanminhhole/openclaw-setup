// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * OS generator — called from generateNativeScript() via ctx dispatch.
 * @param {object} ctx  Built by generateNativeScript() — see buildNativeScriptCtx()
 * @returns {{ scriptName: string, scriptContent: string }}
 */
function generateLinuxSh(ctx) {
  const {
    ch, isVi, provider, is9Router, isOllama, hasBrowser, selectedModel, isMultiBot, projectDir, todayStamp, allPlugins, pluginCmd, nativeSkillInstallCmds, nativeSkillConfigs, providerLines, sharedNativeFileMap, sharedNativeEnvContent, sharedNativeExecApprovalsContent, sharedNativeConfigContent, native9RouterSyncScriptContent, native9RouterServerEntryLookup, windowsHiddenNodeLaunch, generateUninstallScript,
  } = ctx;
  // state, PROVIDERS, SKILLS, PLUGINS, CHANNELS are IIFE-level globals
  let scriptContent;

  const scriptName = 'setup-openclaw-linux.sh';
  const lnx = [
    '#!/usr/bin/env bash', 'set -e',
    `echo "=== OpenClaw Setup — Linux Desktop${isMultiBot ? ' Multi-Bot' : ''} ==="`,
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
    `npm install -g openclaw@latest ${openClawRuntimePackages}`,
  ];
  providerLines(lnx, 'sh');
  if (pluginCmd) lnx.push(pluginCmd);
  lnx.push('if [ -f ".env" ]; then set -a; . ./.env; set +a; fi');

  if (isMultiBot) {
    appendShWriteCommands(lnx, sharedNativeFileMap());
    const _uninstallLnxMulti = generateUninstallScript();
    if (_uninstallLnxMulti) appendShWriteCommands(lnx, { [_uninstallLnxMulti.name]: _uninstallLnxMulti.content });
    lnx.push('echo "Starting shared multi-bot gateway..."');
    lnx.push('openclaw gateway run');
  } else {
    appendShWriteCommands(lnx, botFiles(0));
    const _uninstallLnx = generateUninstallScript();
    if (_uninstallLnx) appendShWriteCommands(lnx, { [_uninstallLnx.name]: _uninstallLnx.content });
    lnx.push('openclaw gateway run');
  }
  scriptContent = lnx.filter(Boolean).join('\n');

  return { scriptName, scriptContent };
}
