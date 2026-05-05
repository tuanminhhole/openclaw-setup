// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * OS generator — called from generateNativeScript() via ctx dispatch.
 * @param {object} ctx  Built by generateNativeScript() — see buildNativeScriptCtx()
 * @returns {{ scriptName: string, scriptContent: string }}
 */
function generateMacOsSh(ctx) {
  const {
    ch, isVi, provider, is9Router, isOllama, hasBrowser, selectedModel, isMultiBot, projectDir, todayStamp, allPlugins, pluginCmd, nativeSkillInstallCmds, nativeSkillConfigs, providerLines, sharedNativeFileMap, sharedNativeEnvContent, sharedNativeExecApprovalsContent, sharedNativeConfigContent, native9RouterSyncScriptContent, native9RouterServerEntryLookup, windowsHiddenNodeLaunch, generateUninstallScript,
  } = ctx;
  // state, PROVIDERS, SKILLS, PLUGINS, CHANNELS are IIFE-level globals
  let scriptContent;

  const isDocker = state.deployMode === 'docker';
  const scriptName = isDocker ? 'setup-openclaw-docker-macos.sh' : 'setup-openclaw-macos.sh';

  if (isDocker) {
    // ── macOS Docker mode: write files then docker compose up ──────────────
    const sh = [
      '#!/usr/bin/env bash', 'set -e',
      'echo "=== OpenClaw Setup \u2014 macOS Docker ==="',
      '# Check Docker Desktop is running',
      'if ! docker info > /dev/null 2>&1; then',
      '  echo "\u274c Docker Desktop chua chay! Mo Docker Desktop roi chay lai script nay."',
      '  exit 1',
      'fi',
    ];
    appendShWriteCommands(sh, botFiles(0));
    sh.push('echo "Starting bot via Docker Compose..."');
    sh.push('if docker compose version > /dev/null 2>&1; then COMPOSE="docker compose"; else COMPOSE="docker-compose"; fi');
    sh.push('cd docker/openclaw');
    sh.push('$COMPOSE up --detach --build');
    if (state.channel === 'zalo-personal') {
      const containerName = 'openclaw-bot';
      const qrPath = '/tmp/openclaw/openclaw-zalouser-qr-default.png';
      sh.push('echo ""');
      sh.push('echo "=== DANG NHAP ZALO ==="');
      sh.push('echo "Doi container khoi dong 10 giay..."');
      sh.push('sleep 10');
      sh.push('echo "Dung gateway de login..."');
      sh.push(`docker exec ${containerName} openclaw gateway stop 2>/dev/null || true`);
      sh.push('sleep 3');
      sh.push('echo "Huong dan dang nhap Zalo:"');
      sh.push(`echo "  1. cd docker/openclaw"`);
      sh.push(`echo "  2. docker exec -it ${containerName} openclaw channels login --channel zalouser --verbose"`);
      sh.push(`echo "  3. Tim file QR trong container: ${qrPath}"`);
      sh.push(`echo "     Hoac chay: docker cp ${containerName}:${qrPath} ./zalo-qr.png"`);
      sh.push('echo "  4. Mo app Zalo > Quet QR > quet ma"');
      sh.push('echo "  5. Doi thay Login successful"');
      sh.push('echo "  6. Script se restart container de nap session Zalo vua tao"');
      sh.push('echo ""');
      sh.push(`docker exec -it ${containerName} openclaw channels login --channel zalouser --verbose || true`);
      sh.push(`docker restart ${containerName}`);
      sh.push('sleep 25');
      sh.push(`docker exec ${containerName} openclaw channels status || true`);
    }
    sh.push('echo "\u2705 Bot dang chay via Docker. Xem log: docker logs -f openclaw-bot"');
    scriptContent = sh.filter(Boolean).join('\n');
  } else {
    // ── macOS Native mode: same approach as Ubuntu but no PM2, no apt ────────
    // Do NOT use 'npm config set prefix' on macOS — breaks Homebrew Node.
    // Use export npm_config_prefix per-session + sudo fallback.
    const sh = [
      '#!/usr/bin/env bash', 'set -e',
      'echo "=== OpenClaw Setup \u2014 macOS Native ==="',
      'command -v node > /dev/null 2>&1 || { echo "ERROR: Node.js chua cai! https://nodejs.org"; exit 1; }',
      '# User-local npm prefix (Homebrew-safe — no global npmrc mutation)',
    'mkdir -p "$HOME/.local/bin"',
    'export npm_config_prefix="$HOME/.local"',
    'export PATH="$HOME/.local/bin:$PATH"',
    `PROJECT_DIR="${projectDir.replace(/"/g, '\\"')}"`,
    'mkdir -p "$PROJECT_DIR"',
    'cd "$PROJECT_DIR"',
    'export OPENCLAW_HOME="$PROJECT_DIR/.openclaw"',
    'export OPENCLAW_STATE_DIR="$PROJECT_DIR/.openclaw"',
    'export DATA_DIR="$PROJECT_DIR/.9router"',
    'grep -Fqx \'export PATH="$HOME/.local/bin:$PATH"\' "$HOME/.zshrc" 2>/dev/null || echo \'export PATH="$HOME/.local/bin:$PATH"\' >> "$HOME/.zshrc"',
    'grep -Fqx \'export PATH="$HOME/.local/bin:$PATH"\' "$HOME/.profile" 2>/dev/null || echo \'export PATH="$HOME/.local/bin:$PATH"\' >> "$HOME/.profile"',
    '# Install openclaw (user-local first, sudo fallback)',
      `npm install -g ${OPENCLAW_NPM_SPEC} ${openClawRuntimePackages} || sudo npm install -g ${OPENCLAW_NPM_SPEC} ${openClawRuntimePackages}`,
    ];
    providerLines(sh, 'sh');
    if (pluginCmd) sh.push(pluginCmd);
    sh.push('if [ -f ".env" ]; then set -a; . ./.env; set +a; fi');

    if (isMultiBot) {
      appendShWriteCommands(sh, sharedNativeFileMap());
      const _uninstallMacMulti = generateUninstallScript();
      if (_uninstallMacMulti) appendShWriteCommands(sh, { [_uninstallMacMulti.name]: _uninstallMacMulti.content });
    sh.push('echo "Starting shared multi-bot gateway..."');
    if (state.channel === 'zalo-personal') {
      sh.push(...generateZaloLoginSh({ homeVar: '$OPENCLAW_HOME', projectDirVar: '$PROJECT_DIR' }));
    }
    sh.push('openclaw gateway run');
    } else {
      appendShWriteCommands(sh, botFiles(0));
      const _uninstallMac = generateUninstallScript();
      if (_uninstallMac) appendShWriteCommands(sh, { [_uninstallMac.name]: _uninstallMac.content });
    if (state.channel === 'zalo-personal') {
      sh.push(...generateZaloLoginSh({ homeVar: '$OPENCLAW_HOME', projectDirVar: '$PROJECT_DIR' }));
    }
    sh.push('openclaw gateway run');
    }
    scriptContent = sh.filter(Boolean).join('\n');
  }

  return { scriptName, scriptContent };
}
