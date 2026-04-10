import fs from 'fs';
import path from 'path';

const root = process.cwd();
const cli = fs.readFileSync(path.join(root, 'cli.js'), 'utf8');
const setup = fs.readFileSync(path.join(root, 'setup.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cliBytes = fs.readFileSync(path.join(root, 'cli.js'));

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectMatch(source, regex, message) {
  expect(regex.test(source), message);
}

function expectOrder(source, before, after, message) {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);
  expect(beforeIndex !== -1, `${message} (missing first marker)`);
  expect(afterIndex !== -1, `${message} (missing second marker)`);
  expect(beforeIndex < afterIndex, message);
}

const checks = [];

checks.push(() => expectMatch(
  cli,
  /const deployModeDefault = \(osChoice === 'ubuntu' \|\| osChoice === 'vps'\) \? 'native' : 'docker';/,
  'Ubuntu/VPS must default to native deploy mode'
));

checks.push(() => expect(
  !(cliBytes[0] === 0xef && cliBytes[1] === 0xbb && cliBytes[2] === 0xbf),
  'CLI entrypoint must not include a UTF-8 BOM before the shebang'
));

checks.push(() => expectMatch(
  cli,
  /if \(deployMode === 'docker' && !isDockerInstalled\(\)\)/,
  'Docker branch must still auto-install Docker when missing'
));

checks.push(() => expectMatch(
  cli,
  /function shouldReuseInstalledGlobals\(\) \{[\s\S]*OPENCLAW_SETUP_REUSE_GLOBALS[\s\S]*trim\(\)\.toLowerCase\(\)/,
  'CLI must expose an env-flag helper for fast test runs that reuse installed global packages'
));

checks.push(() => expectMatch(
  cli,
  /function installLatestOpenClaw\(\{ isVi, osChoice \}\) \{[\s\S]*installGlobalPackage\(OPENCLAW_NPM_SPEC, \{ isVi, osChoice, displayName: 'openclaw' \}\)[\s\S]*process\.exit\(1\)/,
  'CLI must provide a shared helper that always installs or upgrades the pinned openclaw version'
));

checks.push(() => expectMatch(
  cli,
  /function installLatestOpenClaw\(\{ isVi, osChoice \}\) \{[\s\S]*shouldReuseInstalledGlobals\(\) && isOpenClawInstalled\(\)[\s\S]*Reusing the installed openclaw/s,
  'CLI fast-test mode must be able to reuse an existing openclaw install'
));

checks.push(() => expectMatch(
  cli,
  /installLatestOpenClaw\(\{ isVi, osChoice \}\);\s*if \(deployMode === 'docker'\) \{/,
  'CLI must install or upgrade openclaw before entering the Docker/native branches'
));

checks.push(() => expectMatch(
  cli,
  /if \(!isOpenClawInstalled\(\)\) \{[\s\S]*installGlobalPackage\(OPENCLAW_NPM_SPEC, \{ isVi, osChoice, displayName: 'openclaw' \}\)/,
  'Native branch must auto-install openclaw'
));

checks.push(() => expectMatch(
  cli,
  /if \(osChoice === 'vps'\) \{[\s\S]*installGlobalPackage\('pm2@latest', \{ isVi, osChoice, displayName: 'PM2' \}\)/,
  'VPS native branch must auto-install PM2'
));

checks.push(() => expectMatch(
  cli,
  /if \(providerKey === '9router'\) \{[\s\S]*else if \(!is9RouterInstalled\(\)\) \{[\s\S]*installGlobalPackage\('9router@latest', \{ isVi, osChoice, displayName: '9Router' \}\)/,
  'Native 9Router flow must auto-install 9Router'
));

checks.push(() => expect(
  cli.includes('function providerSupportsMemoryEmbeddings(providerKey) {')
    && cli.includes("supportsEmbeddings: true")
    && cli.includes("supportsEmbeddings: false")
    && cli.includes("function getCliSkillChoices({ providerKey, isVi }) {")
    && cli.includes("skill.value !== 'memory'")
    && cli.includes("providerSupportsMemoryEmbeddings(providerKey)"),
  'CLI skill labels must compute memory recommendations from provider embedding capability instead of hardcoding them'
));

checks.push(() => expectMatch(
  cli,
  /if \(providerKey === '9router'\) \{[\s\S]*shouldReuseInstalledGlobals\(\) && is9RouterInstalled\(\)[\s\S]*Reusing the installed 9Router[\s\S]*else if \(!is9RouterInstalled\(\)\)/s,
  'CLI fast-test mode must be able to reuse an existing 9Router install'
));

checks.push(() => expect(
  cli.includes('function build9RouterSmartRouteSyncScript(dbPath) {')
    && cli.includes('const safeDbPath = JSON.stringify(dbPath);')
    && cli.includes("const ROUTER='http://localhost:20128';")
    && cli.includes("fetch(ROUTER + '/api/providers')")
    && cli.includes("build9RouterSmartRouteSyncScript(path.join(getProject9RouterDataDir(projectDir), 'db.json'))"),
  'Native 9Router flow must write a smart-route sync script into the project-controlled 9Router data directory'
));

checks.push(() => expectMatch(
  cli,
  /function getProjectRuntimeEnv\(projectDir, extraEnv = \{\}\) \{[\s\S]*OPENCLAW_HOME: getProjectOpenClawHome\(projectDir\)[\s\S]*OPENCLAW_STATE_DIR: getProjectOpenClawHome\(projectDir\)[\s\S]*DATA_DIR: getProject9RouterDataDir\(projectDir\)/s,
  'CLI native runtime must derive OPENCLAW_HOME, OPENCLAW_STATE_DIR, and DATA_DIR from the chosen project directory'
));

checks.push(() => expect(
  cli.includes('function getGatewayAllowedOrigins(port) {')
    && cli.includes('Object.values(os.networkInterfaces() || {})')
    && cli.includes('`http://localhost:${normalizedPort}`')
    && cli.includes('`http://127.0.0.1:${normalizedPort}`')
    && cli.includes('`http://0.0.0.0:${normalizedPort}`'),
  'CLI must derive control UI allowed origins from localhost plus non-internal IPv4 interfaces'
));

checks.push(() => expect(
  cli.includes('function getReachableDashboardHosts(port) {')
    && cli.includes('pushHost(\'127.0.0.1\')')
    && cli.includes('pushHost(\'localhost\')')
    && cli.includes('function rewriteDashboardUrlHost(urlText, fallbackPort, targetBaseUrl) {'),
  'CLI must derive reachable dashboard hosts and rewrite tokenized dashboard URLs for WSL/LAN access'
));

checks.push(() => expect(
  cli.includes("Removed smart-route (no active providers)")
    && cli.includes("if (!a.length) {")
    && cli.includes("if (!m.length) {")
    && cli.includes("removeSmartRoute();"),
  '9Router sync logic in CLI must remove stale smart-route combos when providers are disabled'
));

checks.push(() => expectMatch(
  cli,
  /function ensureUserWritableGlobalNpm\(\{ isVi, osChoice \}\) \{[\s\S]*process\.env\.npm_config_prefix = npmInfo\.prefixDir[\s\S]*npm config set prefix "\$\{npmInfo\.prefixDir\.replace/s,
  'Native CLI must configure a user-writable npm global prefix for non-Windows installs'
));

checks.push(() => expectMatch(
  cli,
  /execSync\('pm2 start ecosystem\.config\.js && pm2 save'/,
  'Native Telegram multi-bot must start through PM2 ecosystem'
));

checks.push(() => expectMatch(
  cli,
  /execFileSync\('pm2', \[[\s\S]*'openclaw'[\s\S]*'gateway'[\s\S]*'run'[\s\S]*getProjectRuntimeEnv\(projectDir\)/s,
  'Native single-bot VPS must start gateway through PM2 with the project runtime environment'
));

checks.push(() => expectMatch(
  cli,
  /function printNativeDashboardAccessInfo\(\{ isVi, providerKey, projectDir, gatewayPort = 18791 \}\) \{[\s\S]*getReachableDashboardHosts\(gatewayPort\)[\s\S]*rewriteDashboardUrlHost[\s\S]*Other reachable URLs[\s\S]*getReachableDashboardHosts\(20128\)/s,
  'Native PM2 flow must expose dashboard access info and the tokenized dashboard command'
));

checks.push(() => expectMatch(
  cli,
  /function printZaloPersonalLoginInfo\(\{ isVi, deployMode, projectDir \}\) \{[\s\S]*docker compose exec -it ai-bot openclaw channels login --channel zalouser --verbose[\s\S]*openclaw-zalouser-qr-default\.png[\s\S]*Copy-Item[\s\S]*docker compose cp ai-bot:\$\{qrPath\} \.\/zalo-login-qr\.png/s,
  'CLI must print the dedicated Docker/native Zalo Personal login commands and QR copy path instead of onboarding'
));

checks.push(() => expectMatch(
  cli,
  /function extractZaloPairingCode\(text\) \{[\s\S]*openclaw pairing approve zalouser[\s\S]*Pairing code:/s,
  'CLI must be able to extract a Zalo pairing code from the login output'
));

checks.push(() => expectMatch(
  cli,
  /function approveZaloPairingCode\(\{ pairingCode, projectDir, isVi \}\) \{[\s\S]*openclaw pairing approve zalouser \$\{pairingCode\}/s,
  'CLI must be able to auto-approve a detected Zalo pairing code'
));

checks.push(() => expectMatch(
  cli,
  /async function runNativeZaloPersonalLoginFlow\(\{ isVi, projectDir \}\) \{[\s\S]*spawn\('openclaw', \['channels', 'login', '--channel', 'zalouser', '--verbose'\]/s,
  'Native Zalo flow must run the zalouser login command'
));

checks.push(() => expectMatch(
  cli,
  /async function runNativeZaloPersonalLoginFlow\(\{ isVi, projectDir \}\) \{[\s\S]*fs\.remove\(qrSourcePath\)[\s\S]*fs\.remove\(qrProjectPath\)[\s\S]*fs\.copy\(qrSourcePath, qrProjectPath, \{ overwrite: true \}\)/s,
  'Native Zalo flow must clear stale QR files and copy the fresh QR into the project folder'
));

checks.push(() => expectMatch(
  cli,
  /async function runNativeZaloPersonalLoginFlow\(\{ isVi, projectDir \}\) \{[\s\S]*outputBuffer[\s\S]*extractZaloPairingCode\(outputBuffer\)[\s\S]*approveZaloPairingCode\(\{ pairingCode, projectDir, isVi \}\)/s,
  'Native Zalo flow must auto-approve pairing when the login command emits a pairing code'
));

checks.push(() => expectMatch(
  cli,
  /async function runNativeZaloPersonalLoginFlow\(\{ isVi, projectDir \}\) \{[\s\S]*let loginSucceeded = false[\s\S]*successPattern[\s\S]*if \(exitCode !== 0 && !loginSucceeded\)[\s\S]*else if \(loginSucceeded && exitCode !== 0\)/s,
  'Native Zalo flow must tolerate non-standard exit codes when the login output already reports success'
));

checks.push(() => expectMatch(
  cli,
  /baseUrl: deployMode === 'native' \? 'http:\/\/localhost:20128\/v1' : 'http:\/\/9router:20128\/v1'/,
  'Native 9Router config must target localhost instead of the Docker hostname'
));

checks.push(() => expectMatch(
  cli,
  /controlUi:\s*\{\s*allowedOrigins: getGatewayAllowedOrigins\(18791\)/s,
  'Native shared gateway config must seed control UI allowed origins'
));

checks.push(() => expectMatch(
  cli,
  /controlUi:\s*\{\s*allowedOrigins: getGatewayAllowedOrigins\(18791 \+ \(isMultiBot \? bIndex : 0\)\)/s,
  'Native per-bot gateway config must seed control UI allowed origins for each port'
));

checks.push(() => expectMatch(
  cli,
  /const dockerDir = path\.join\(projectDir, 'docker', 'openclaw'\);\s*await fs\.ensureDir\(dockerDir\);\s*await fs\.writeFile\(path\.join\(dockerDir, 'Dockerfile'\), dockerfile\);[\s\S]*await fs\.ensureDir\(dockerDir\);\s*await fs\.writeFile\(path\.join\(dockerDir, 'docker-compose\.yml'\), compose\);/s,
  'Docker CLI flow must ensure docker/openclaw exists immediately before writing Dockerfile and docker-compose.yml'
));

checks.push(() => expectMatch(
  cli,
  /RUN npm install -g \$\{OPENCLAW_NPM_SPEC\} \$\{OPENCLAW_RUNTIME_PACKAGES\}/,
  'Docker CLI image must install the full OpenClaw runtime package set alongside openclaw'
));

checks.push(() => expect(
  cli.includes("a.add('http://' + entry.address + ':18791')")
    && cli.includes('allowedOrigins:Array.from(a).filter(Boolean)')
    && cli.includes("bind:'custom',customBindHost:'0.0.0.0'")
    && !cli.includes("bind:'loopback'")
    && !cli.includes("delete c.gateway.customBindHost;")
    && !cli.includes("const gatewayBridge = 'socat TCP-LISTEN:18791")
    && !cli.includes("a.add(`http://${entry.address}:18791`)"),
  'Docker CLI patch script must use bind:custom+customBindHost:0.0.0.0, skip socat gateway bridge, and avoid shell-expanding ${entry.address}'
));

checks.push(() => expectMatch(
  cli,
  /hasZaloPersonal\(channelKey\)\) \{[\s\S]*botConfig\.channels\['zalouser'\] = \{\s*enabled: true,\s*dmPolicy: 'open',\s*allowFrom: \['\*'\]/s,
  'CLI must configure Zalo Personal under channels.zalouser'
));

checks.push(() => expectMatch(
  cli,
  /function startNative9RouterPm2\(\{ isVi, projectDir, appName, syncScriptPath \}\) \{[\s\S]*resolveNative9RouterDesktopLaunch\(\)[\s\S]*execFileSync\('pm2'[\s\S]*routerLaunch\.command[\s\S]*--interpreter'?,?[\s\S]*none[\s\S]*routerLaunch\.args[\s\S]*routerLaunch\.env[\s\S]*nohup "\$\{process\.execPath\}" "\$\{normalizedSyncScriptPath\}" >\/tmp\/\$\{syncAppName\}\.log 2>&1 &[\s\S]*runPm2Save\(\{ projectDir, isVi \}\)/s,
  'VPS native 9Router flow must start a standalone 9Router dashboard on port 20128 via PM2'
));

checks.push(() => expectMatch(
  cli,
  /function spawnBackgroundProcess\(command, args, options = \{\}\) \{[\s\S]*if \(process\.platform === 'win32'\)[\s\S]*resolveWindowsCommand[\s\S]*Start-Process -WindowStyle Hidden[\s\S]*powershell\.exe/s,
  'Native desktop background helpers must use hidden Start-Process launches on Windows'
));

checks.push(() => expectMatch(
  cli,
  /function resolveNative9RouterDesktopLaunch\(\) \{[\s\S]*resolveCommandOnPath\('9router'\)[\s\S]*command: routerBin[\s\S]*args: \['-n', '-l', '-H', '0\.0\.0\.0', '-p', '20128', '--skip-update'\][\s\S]*PORT: '20128'[\s\S]*HOSTNAME: '0\.0\.0\.0'/s,
  'Native desktop 9Router launch must use the 9router CLI binary directly with server args to bypass the interactive menu'
));

checks.push(() => expectMatch(
  cli,
  /const native9RouterLaunch = resolveNative9RouterDesktopLaunch\(\);[\s\S]*spawnBackgroundProcess\(native9RouterLaunch\.command, native9RouterLaunch\.args, \{[\s\S]*getProjectRuntimeEnv\(projectDir, native9RouterLaunch\.env\)/s,
  'Native desktop 9Router flow must launch through the background helper with the resolved launch spec'
));

checks.push(() => expectMatch(
  cli,
  /const routerHealth = await waitFor9RouterApiReady\(\);[\s\S]*admin API chua san sang[\s\S]*admin API is not ready yet/s,
  'Native desktop 9Router flow must warn when the dashboard port opens but the admin API never becomes ready'
));

checks.push(() => expectMatch(
  cli,
  /spawnBackgroundProcess\(process\.execPath, \[native9RouterSyncScriptPath\]/,
  'Native desktop 9Router sync loop must launch through the background helper'
));

checks.push(() => expectMatch(
  cli,
  /function runPm2Save\(\{ projectDir, isVi \}\) \{[\s\S]*execSync\('pm2 save'[\s\S]*PM2 save did not complete/s,
  'Native PM2 save should be handled as a separate recoverable step'
));

checks.push(() => expectMatch(
  cli,
  /if \(hasZaloPersonal\(channelKey\)\) \{\s*await runNativeZaloPersonalLoginFlow\(\{ isVi, projectDir \}\);\s*\}[\s\S]*const child = spawn\('openclaw', \['gateway', 'run'\], \{/s,
  'Native desktop flows must finish the Zalo login flow before starting openclaw in foreground'
));

checks.push(() => expectOrder(
  cli,
  "await ensureProjectRuntimeDirs(projectDir, isVi);",
  "installRelayPluginForProject(projectDir, isVi);",
  'Relay plugin install must happen after preparing the project runtime directories in native flow'
));

checks.push(() => expect(
  !cli.includes('Config synced to ~/.openclaw/')
    && !cli.includes('Config đã được sync vào ~/.openclaw/')
    && !cli.includes("cp -rn ${localClawDir}/. ${globalClawDir}/"),
  'CLI native flow must no longer sync project config into the global ~/.openclaw directory'
));

checks.push(() => expectMatch(
  cli,
  /const pm2Apps = \[[\s\S]*args: 'gateway run'/,
  'Native multi-bot ecosystem must run one gateway process'
));

checks.push(() => expectMatch(
  setup,
  /Linux Desktop[^]*Script tự cài Node\.js 20 LTS nếu chưa có, cài OpenClaw CLI[^]*khởi động bot ngay/s,
  'Web wizard Linux Desktop advisory must mention auto-install OpenClaw and immediate start'
));

checks.push(() => expectMatch(
  setup,
  /Ubuntu \/ VPS[^]*Script tự cài Node\.js 20 LTS, OpenClaw CLI, PM2[^]*giữ bot chạy liên tục sau reboot/s,
  'Web wizard VPS advisory must mention OpenClaw CLI and PM2'
));

checks.push(() => expectMatch(
  indexHtml,
  /Tải file → chạy để cài OpenClaw trực tiếp trên máy/,
  'Native download card copy must mention OpenClaw direct install'
));

checks.push(() => expectMatch(
  setup,
  /if \(state\.nativeOs === 'win'\) \{[\s\S]*scriptName = isDocker \? 'setup-openclaw-docker-win\.bat' : 'setup-openclaw-win\.bat';[\s\S]*npm install -g openclaw@2026\.4\.5[\s\S]*openclaw gateway run/s,
  'Windows native/docker script generation must use the correct file name and start command'
));

checks.push(() => expectMatch(
  setup,
  /else if \(state\.nativeOs === 'linux'\) \{[\s\S]*scriptName = isDocker \? 'setup-openclaw-docker-macos\.sh' : 'setup-openclaw-macos\.sh';[\s\S]*npm config set prefix "\$HOME\/\.local"[\s\S]*npm install -g openclaw@2026\.4\.5[\s\S]*openclaw gateway run/s,
  'macOS script generation must use the correct file name and start command'
));

checks.push(() => expectMatch(
  setup,
  /RUN npm install -g openclaw@2026\.4\.5 \$\{openClawRuntimePackages\}/,
  'Wizard Dockerfile generation must install the full OpenClaw runtime package set alongside openclaw'
));

checks.push(() => expect(
  setup.includes("a.add('http://' + entry.address + ':18791')")
    && setup.includes('allowedOrigins:Array.from(a).filter(Boolean)')
    && setup.includes("bind:'custom',customBindHost:'0.0.0.0'")
    && !setup.includes("bind:'loopback'")
    && !setup.includes("delete c.gateway.customBindHost;")
    && !setup.includes("const gatewayBridgePrefix = 'socat TCP-LISTEN:18791")
    && !setup.includes("a.add(\\`http://\\${entry.address}:18791\\`)"),
  'Wizard Docker patch command must use bind:custom+customBindHost:0.0.0.0, skip socat gateway bridge, and avoid shell-expanding ${entry.address}'
));

checks.push(() => expectMatch(
  setup,
  /else if \(state\.nativeOs === 'vps'\) \{[\s\S]*scriptName = 'setup-openclaw-vps\.sh';[\s\S]*npm config set prefix "\$HOME\/\.local"[\s\S]*PROJECT_DIR="[\s\S]*export OPENCLAW_HOME="\$PROJECT_DIR\/\.openclaw"[\s\S]*export OPENCLAW_STATE_DIR="\$PROJECT_DIR\/\.openclaw"[\s\S]*export DATA_DIR="\$PROJECT_DIR\/\.9router"[\s\S]*npm install -g openclaw@2026\.4\.5[\s\S]*pm2@latest[\s\S]*pm2 save && pm2 startup/s,
  'VPS native script generation must keep runtime files project-local, install openclaw+pm2, and persist PM2 startup'
));

checks.push(() => expect(
  setup.includes('scriptName = isDocker ? \'setup-openclaw-docker-macos.sh\' : \'setup-openclaw-macos.sh\';')
    && setup.includes('scriptName = \'setup-openclaw-linux.sh\';')
    && setup.includes('cd "$PROJECT_DIR"')
    && setup.includes('export OPENCLAW_HOME="$PROJECT_DIR/.openclaw"')
    && setup.includes('export OPENCLAW_STATE_DIR="$PROJECT_DIR/.openclaw"')
    && setup.includes('export DATA_DIR="$PROJECT_DIR/.9router"'),
  'Unix native script generation must use project-local runtime directories and launch from PROJECT_DIR'
));

checks.push(() => expect(
  setup.includes("arr.push('call npm install -g 9router || goto :fail');")
    && setup.includes('function native9RouterServerEntryLookup() {')
    && setup.includes('return "node -e ')
    && !setup.includes('return "node -p ')
    && setup.includes('function windowsHiddenNodeLaunch(targetPath, extraEnv = {}) {')
    && setup.includes('NINE_ROUTER_ENTRY=%%I')
    && setup.includes("windowsHiddenNodeLaunch('%NINE_ROUTER_ENTRY%', { PORT: '20128', HOSTNAME: '0.0.0.0', DATA_DIR: '%DATA_DIR%' })")
    && setup.includes('NINE_ROUTER_ENTRY="$(${native9RouterServerEntryLookup()})"')
    && setup.includes("const p=path.join(process.env.DATA_DIR||'.9router','db.json');")
    && setup.includes('nohup env PORT=20128 HOSTNAME=0.0.0.0 DATA_DIR="$PWD/.9router" node "$NINE_ROUTER_ENTRY" >/tmp/9router.log 2>&1 &')
    && setup.includes('nohup env DATA_DIR="$PWD/.9router" node ./.openclaw/9router-smart-route-sync.js >/tmp/9router-sync.log 2>&1 &')
    && setup.includes('set "PROJECT_DIR=')
    && setup.includes('set "OPENCLAW_HOME=%PROJECT_DIR%\\\\.openclaw"')
    && setup.includes('set "OPENCLAW_STATE_DIR=%PROJECT_DIR%\\\\.openclaw"')
    && setup.includes('set "DATA_DIR=%PROJECT_DIR%\\\\.9router"'),
  'Native script generation must install and start a standalone 9Router dashboard on port 20128'
));

checks.push(() => expect(
  setup.includes("echo OpenClaw Dashboard: http://127.0.0.1:18791")
    && setup.includes("echo Other reachable URLs: http://localhost:18791")
    && setup.includes("echo If the dashboard asks for a Gateway Token, run: openclaw dashboard")
    && setup.includes("echo 9Router Dashboard: http://127.0.0.1:20128/dashboard")
    && !setup.includes('set "HOME=%PROJECT_DIR%"')
    && !setup.includes('set "USERPROFILE=%PROJECT_DIR%"'),
  'Windows native script generation must print OpenClaw and 9Router dashboard URLs'
));

checks.push(() => expect(
  setup.includes("bind: 'loopback'")
    && !setup.includes("bind: 'custom'")
    && !setup.includes("customBindHost: '0.0.0.0'")
    && setup.includes("state.bots[state.activeBotIndex].provider = key;")
    && setup.includes("state.bots[state.activeBotIndex].model = p.models[0].id;")
    && setup.includes("state.bots[state.activeBotIndex].provider = state.config.provider;")
    && setup.includes("state.bots[state.activeBotIndex].model = state.config.model;")
    && setup.includes("if (state.botCount <= 1 && state.bots[state.activeBotIndex]) {")
    && setup.includes("state.bots[state.activeBotIndex].token = botTokenEl.value;")
    && setup.includes("state.bots[state.activeBotIndex].apiKey = apiKeyEl.value;")
    && setup.includes("const authProviderName = provider.isProxy ? '9router' : state.config.provider;")
    && setup.includes("const authProviderName = botProvider.isProxy ? '9router' : (bot.provider || state.config.provider);")
    && setup.includes("const nativeSkillConfigs = state.config.skills")
    && setup.includes("const nativeSkillInstallCmds = nativeSkillConfigs.map((skill) => `call openclaw skills install ${skill.slug} || echo Warning: Failed to install skill ${skill.slug}`);")
    && setup.includes("lines.push('call npm install -g agent-browser playwright || goto :fail');")
    && setup.includes("lines.push('call npx playwright install chromium || goto :fail');")
    && setup.includes("lines.push('echo Cai skills...');")
    && setup.includes("const openClawRuntimePackages = 'grammy @grammyjs/runner @grammyjs/transformer-throttler @buape/carbon @larksuiteoapi/node-sdk @slack/web-api';")
    && setup.includes("memory: 'none'")
    && setup.includes("workspace: 'workspace'")
    && setup.includes("workspace: meta.workspaceDir")
    && !setup.includes("const authProviderName = provider.isProxy ? '9router' : provider.id;")
    && !setup.includes("const authProviderName = botProvider.isProxy ? '9router' : botProvider.id;"),
  'Wizard native config generation must keep gateway loopback-local, preserve concrete auth provider ids, disable memory search by default, and sync single-bot provider/model selections into bot state'
));

checks.push(() => expectMatch(
  setup,
  /window\.downloadNativeScript = function\(\) \{[\s\S]*generateOutput\(\);[\s\S]*const script = window\._nativeScript;/,
  'Native script download must regenerate the latest wizard output before reading the cached script'
));

checks.push(() => expectMatch(
  setup,
  /} else if \(is9Router\) \{[\s\S]*container_name: openclaw-bot[\s\S]*depends_on:[\s\S]*- 9router[\s\S]*container_name: 9router[\s\S]*PORT=20128[\s\S]*HOSTNAME=0\.0\.0\.0[\s\S]*9router-data:/s,
  'Wizard single-bot Docker compose must include the 9Router sidecar service and named volume when provider is 9Router'
));

checks.push(() => expectMatch(
  setup,
  /function native9RouterSyncScriptContent\(\) \{[\s\S]*const p=path\.join\(process\.env\.DATA_DIR\|\|'\.9router','db\.json'\);[\s\S]*const ROUTER='http:\/\/localhost:20128';[\s\S]*fetch\(ROUTER\+'\/api\/providers'\)[\s\S]*d\.connections[\s\S]*smart-route/s,
  'Native script generation must keep the 9Router sync script project-local via DATA_DIR and sync active providers from the 9Router API'
));

checks.push(() => expect(
  setup.includes("Removed smart-route (no active providers)")
    && setup.includes("if (!a.length) {")
    && setup.includes("if (!m.length) {")
    && setup.includes("removeSmartRoute();"),
  '9Router sync logic in setup.js must remove stale smart-route combos when providers are disabled'
));

checks.push(() => expect(
  setup.includes('function providerSupportsMemoryEmbeddings(providerKey) {')
    && setup.includes('function getSkillDisplayName(skill, providerKey, lang) {')
    && setup.includes('function getSkillExtraNote(skill, providerKey, lang) {')
    && setup.includes('renderPluginGrid();')
    && setup.includes("supportsEmbeddings: true")
    && setup.includes("supportsEmbeddings: false"),
  'Wizard skill cards must recompute memory recommendation labels from provider embedding capability when the provider changes'
));

checks.push(() => expectMatch(
  setup,
  /\.openclaw\/9router-smart-route-sync\.js[\s\S]*pm2 start --name openclaw-9router-sync/s,
  'VPS native script generation must write and run the 9Router smart-route sync loop'
));

checks.push(() => expectMatch(
  cli,
  /const files=fs\.readdirSync\(dir\)\.filter\(n=>\/\\\\\.js\$\/\.test\(n\)\)[\s\S]*let patched=0[\s\S]*if\(!patched\)\{process\.exit\(0\);\}/,
  'Dockerfile patching in CLI must scan all OpenClaw dist JS files and silently skip when no timeout patch anchor exists'
));

checks.push(() => expect(
  !cli.includes("Buffer.from('\\${Buffer.from(syncComboScript).toString('base64')}','base64')"),
  'CLI must precompute the 9Router sync script base64 instead of leaking Docker Compose interpolation markers'
));

checks.push(() => expectMatch(
  setup,
  /const files=fs\.readdirSync\(dir\)\.filter\(n=>\/\\\\\.js\$\/\.test\(n\)\)[\s\S]*let patched=0[\s\S]*if\(!patched\)\{process\.exit\(0\);\}/,
  'Dockerfile patching in setup.js must scan all OpenClaw dist JS files and silently skip when no timeout patch anchor exists'
));

checks.push(() => expect(
  !setup.includes("Buffer.from('\\${Buffer.from(syncScript).toString('base64')}','base64')"),
  'Wizard compose generation must precompute the 9Router sync script base64 instead of leaking Docker Compose interpolation markers'
));

checks.push(() => expectMatch(
  setup,
  /else if \(state\.nativeOs === 'vps'\) \{[\s\S]*NINE_ROUTER_ENTRY="\$\([\s\S]*PORT=20128 HOSTNAME=0\.0\.0\.0 pm2 start "\$NINE_ROUTER_ENTRY" --name openclaw-multibot-9router --interpreter "\$\(command -v node\)"[\s\S]*pm2 start --name openclaw-multibot -- sh -c "openclaw gateway run"[\s\S]*pm2 logs openclaw-multibot/s,
  'VPS multi-bot native script must start the shared gateway via PM2'
));

checks.push(() => expectMatch(
  setup,
  /else if \(state\.nativeOs === 'vps'\) \{[\s\S]*NINE_ROUTER_ENTRY="\$\([\s\S]*PORT=20128 HOSTNAME=0\.0\.0\.0 pm2 start "\$NINE_ROUTER_ENTRY" --name openclaw-9router --interpreter "\$\(command -v node\)"[\s\S]*pm2 start --name openclaw -- sh -c "openclaw gateway run"[\s\S]*pm2 logs openclaw/s,
  'VPS single-bot native script must start one bot via PM2'
));

checks.push(() => expectMatch(
  setup,
  /else if \(state\.nativeOs === 'linux-desktop'\) \{[\s\S]*scriptName = 'setup-openclaw-linux\.sh';[\s\S]*npm config set prefix "\$HOME\/\.local"[\s\S]*npm install -g openclaw@2026\.4\.5[\s\S]*openclaw gateway run/s,
  'Linux Desktop native script generation must install openclaw and run the gateway'
));

checks.push(() => expectMatch(
  setup,
  /instrEl\.innerHTML = state\.nativeOs === 'win'[\s\S]*double-click[\s\S]*chmod \+x \$\{scriptName\} && \.\/\$\{scriptName\}/s,
  'Native instructions must show double-click for Windows and chmod for shell scripts'
));

checks.push(() => expectMatch(
  setup,
  /steps\.push\(isVi \? '.*Cài OpenClaw CLI.*' : '.*Install OpenClaw CLI.*'\);/s,
  'Auto-steps summary must mention OpenClaw CLI installation'
));

checks.push(() => expectMatch(
  setup,
  /Native setup now auto-runs the login flow and copies the QR into the project folder[\s\S]*docker compose exec -it ai-bot openclaw channels login --channel zalouser --verbose[\s\S]*docker compose cp ai-bot:\/tmp\/openclaw\/openclaw-zalouser-qr-default\.png \.\/zalo-login-qr\.png/s,
  'Wizard copy must mention native auto-login and still show the dedicated Docker QR login command'
));

checks.push(() => expect(
  setup.includes('function getGatewayAllowedOrigins(port) {')
    && setup.includes('window.location')
    && setup.includes('`http://localhost:${normalizedPort}`')
    && setup.includes('`http://127.0.0.1:${normalizedPort}`'),
  'Web wizard must expose a helper that seeds likely control UI origins'
));

checks.push(() => expectMatch(
  setup,
  /controlUi:\s*\{\s*allowedOrigins: getGatewayAllowedOrigins\(18791\)/s,
  'Web wizard single-bot gateway config must seed control UI allowed origins'
));

checks.push(() => expectMatch(
  setup,
  /controlUi:\s*\{\s*allowedOrigins: getGatewayAllowedOrigins\(basePort\)/s,
  'Web wizard per-bot gateway config must seed control UI allowed origins'
));

checks.push(() => expectMatch(
  setup,
  /const patchCmd = `node -e \\\\"const fs=require\('fs'\),os=require\('os'\),p='\/root\/\.openclaw\/openclaw\.json';if\(fs\.existsSync\(p\)\)\{[\s\S]*allowedOrigins:Array\.from\(a\)/s,
  'Web wizard Docker patch command must add interface-based control UI allowed origins'
));

for (const check of checks) {
  check();
}

console.log(`Smoke checks passed: ${checks.length}`);
