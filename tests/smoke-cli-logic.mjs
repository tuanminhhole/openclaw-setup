import fs from 'fs';
import path from 'path';

const root = process.cwd();
const cli = fs.readFileSync(path.join(root, 'cli.js'), 'utf8');
const setup = fs.readFileSync(path.join(root, 'setup.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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

checks.push(() => expectMatch(
  cli,
  /if \(deployMode === 'docker' && !isDockerInstalled\(\)\)/,
  'Docker branch must still auto-install Docker when missing'
));

checks.push(() => expectMatch(
  cli,
  /if \(!isOpenClawInstalled\(\)\) \{[\s\S]*installGlobalPackage\('openclaw@latest', \{ isVi, osChoice, displayName: 'openclaw' \}\)/,
  'Native branch must auto-install openclaw'
));

checks.push(() => expectMatch(
  cli,
  /if \(osChoice === 'vps'\) \{[\s\S]*installGlobalPackage\('pm2@latest', \{ isVi, osChoice, displayName: 'PM2' \}\)/,
  'VPS native branch must auto-install PM2'
));

checks.push(() => expectMatch(
  cli,
  /if \(providerKey === '9router' && !is9RouterInstalled\(\)\) \{[\s\S]*installGlobalPackage\('9router@latest', \{ isVi, osChoice, displayName: '9Router' \}\)/,
  'Native 9Router flow must auto-install 9Router'
));

checks.push(() => expectMatch(
  cli,
  /async function writeNative9RouterSyncScript\(projectDir\) \{[\s\S]*9router-smart-route-sync\.js[\s\S]*providerConnections[\s\S]*smart-route/s,
  'Native 9Router flow must write a smart-route sync script based on ~/.9router/db.json'
));

checks.push(() => expectMatch(
  cli,
  /Removed smart-route \(no active providers\)[\s\S]*if \(!a\.length\) \{[\s\S]*removeSmartRoute\(\)[\s\S]*if \(!m\.length\) \{[\s\S]*removeSmartRoute\(\)/s,
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
  /execSync\(`pm2 start "openclaw gateway run" --name "\$\{appName\}" --cwd "\$\{projectDir\.replace\(\/\\\\\/g, '\/'\)\}" && pm2 save`/,
  'Native single-bot VPS must start gateway through PM2'
));

checks.push(() => expectMatch(
  cli,
  /function printNativeDashboardAccessInfo\(\{ isVi, providerKey, projectDir, gatewayPort = 18791 \}\) \{[\s\S]*openclaw dashboard[\s\S]*9Router Dashboard:[\s\S]*localhost:20128\/dashboard/s,
  'Native PM2 flow must expose dashboard access info and the tokenized dashboard command'
));

checks.push(() => expectMatch(
  cli,
  /function printZaloPersonalLoginInfo\(\{ isVi, deployMode, projectDir \}\) \{[\s\S]*docker compose exec -it ai-bot openclaw channels login --channel zalouser --verbose[\s\S]*openclaw-zalouser-qr-default\.png[\s\S]*Copy-Item[\s\S]*docker compose cp ai-bot:\$\{qrPath\} \.\/zalo-login-qr\.png/s,
  'CLI must print the dedicated Docker/native Zalo Personal login commands and QR copy path instead of onboarding'
));

checks.push(() => expectMatch(
  cli,
  /async function runNativeZaloPersonalLoginFlow\(\{ isVi, projectDir \}\) \{[\s\S]*spawn\('openclaw', \['channels', 'login', '--channel', 'zalouser', '--verbose'\]/s,
  'Native Zalo flow must run the zalouser login command'
));

checks.push(() => expectMatch(
  cli,
  /async function runNativeZaloPersonalLoginFlow\(\{ isVi, projectDir \}\) \{[\s\S]*path\.join\(projectDir, 'zalo-login-qr\.png'\)[\s\S]*fs\.copy\(qrSourcePath, qrProjectPath, \{ overwrite: true \}\)/s,
  'Native Zalo flow must copy the generated QR into the project folder'
));

checks.push(() => expectMatch(
  cli,
  /baseUrl: deployMode === 'native' \? 'http:\/\/localhost:20128\/v1' : 'http:\/\/9router:20128\/v1'/,
  'Native 9Router config must target localhost instead of the Docker hostname'
));

checks.push(() => expectMatch(
  cli,
  /channelKey === 'zalo-personal'\) \{\s*botConfig\.channels\['zalouser'\] = \{\s*enabled: true,\s*dmPolicy: 'pairing',\s*autoReply: true/s,
  'CLI must configure Zalo Personal under channels.zalouser'
));

checks.push(() => expectMatch(
  cli,
  /function startNative9RouterPm2\(\{ isVi, projectDir, appName, syncScriptPath \}\) \{[\s\S]*9router -n -t -l -H 0\.0\.0\.0 -p 20128 --skip-update[\s\S]*9router-sync[\s\S]*runPm2Save\(\{ projectDir, isVi \}\)/s,
  'VPS native 9Router flow must start a standalone 9Router dashboard on port 20128 via PM2'
));

checks.push(() => expectMatch(
  cli,
  /function runPm2Save\(\{ projectDir, isVi \}\) \{[\s\S]*execSync\('pm2 save'[\s\S]*PM2 save did not complete/s,
  'Native PM2 save should be handled as a separate recoverable step'
));

checks.push(() => expectMatch(
  cli,
  /if \(channelKey === 'zalo-personal'\) \{\s*await runNativeZaloPersonalLoginFlow\(\{ isVi, projectDir \}\);\s*\}[\s\S]*const child = spawn\('openclaw', \['gateway', 'run'\], \{/s,
  'Native desktop flows must finish the Zalo login flow before starting openclaw in foreground'
));

checks.push(() => expectOrder(
  cli,
  "await syncLocalConfigToHome(projectDir, isVi);",
  "installRelayPluginForProject(projectDir, isVi);",
  'Relay plugin install must happen after config sync in native flow'
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
  /if \(state\.nativeOs === 'win'\) \{[\s\S]*scriptName = isDocker \? 'setup-openclaw-docker-win\.bat' : 'setup-openclaw-win\.bat';[\s\S]*npm install -g openclaw@latest[\s\S]*openclaw gateway run/s,
  'Windows native/docker script generation must use the correct file name and start command'
));

checks.push(() => expectMatch(
  setup,
  /else if \(state\.nativeOs === 'linux'\) \{[\s\S]*scriptName = isDocker \? 'setup-openclaw-docker-macos\.sh' : 'setup-openclaw-macos\.sh';[\s\S]*npm config set prefix "\$HOME\/\.local"[\s\S]*npm install -g openclaw@latest[\s\S]*openclaw gateway run/s,
  'macOS script generation must use the correct file name and start command'
));

checks.push(() => expectMatch(
  setup,
  /else if \(state\.nativeOs === 'vps'\) \{[\s\S]*scriptName = 'setup-openclaw-vps\.sh';[\s\S]*npm config set prefix "\$HOME\/\.local"[\s\S]*npm install -g openclaw@latest pm2@latest[\s\S]*pm2 save && pm2 startup/s,
  'VPS native script generation must install openclaw+pm2 and persist PM2 startup'
));

checks.push(() => expectMatch(
  setup,
  /function providerLines\(arr, shell\) \{[\s\S]*npm install -g 9router[\s\S]*9router -n -t -l -H 0\.0\.0\.0 -p 20128 --skip-update/s,
  'Native script generation must install and start a standalone 9Router dashboard on port 20128'
));

checks.push(() => expectMatch(
  setup,
  /function native9RouterSyncScriptContent\(\) \{[\s\S]*providerConnections[\s\S]*smart-route/s,
  'Native script generation must embed a 9Router smart-route sync script'
));

checks.push(() => expectMatch(
  setup,
  /Removed smart-route \(no active providers\)[\s\S]*if \(!a\.length\) \{[\s\S]*removeSmartRoute\(\)[\s\S]*if \(!m\.length\) \{[\s\S]*removeSmartRoute\(\)/s,
  '9Router sync logic in setup.js must remove stale smart-route combos when providers are disabled'
));

checks.push(() => expectMatch(
  setup,
  /\.openclaw\/9router-smart-route-sync\.js[\s\S]*pm2 start --name openclaw-9router-sync/s,
  'VPS native script generation must write and run the 9Router smart-route sync loop'
));

checks.push(() => expectMatch(
  cli,
  /readdirSync\(dir\)\.find\(n=>\/\^gateway-cli-.*\\\\\.js\$\/\.test\(n\)\)[\s\S]*skipping timeout patch/,
  'Dockerfile patching in CLI must resolve gateway-cli dist files dynamically instead of hardcoding one hash'
));

checks.push(() => expectMatch(
  setup,
  /readdirSync\(dir\)\.find\(n=>\/\^gateway-cli-.*\\\\\.js\$\/\.test\(n\)\)[\s\S]*skipping timeout patch/,
  'Dockerfile patching in setup.js must resolve gateway-cli dist files dynamically instead of hardcoding one hash'
));

checks.push(() => expectMatch(
  setup,
  /else if \(state\.nativeOs === 'vps'\) \{[\s\S]*pm2 start --name openclaw-multibot -- sh -c "openclaw gateway run"[\s\S]*pm2 logs openclaw-multibot/s,
  'VPS multi-bot native script must start the shared gateway via PM2'
));

checks.push(() => expectMatch(
  setup,
  /else if \(state\.nativeOs === 'vps'\) \{[\s\S]*pm2 start --name openclaw -- sh -c "openclaw gateway run"[\s\S]*pm2 logs openclaw/s,
  'VPS single-bot native script must start one bot via PM2'
));

checks.push(() => expectMatch(
  setup,
  /else if \(state\.nativeOs === 'linux-desktop'\) \{[\s\S]*scriptName = 'setup-openclaw-linux\.sh';[\s\S]*npm config set prefix "\$HOME\/\.local"[\s\S]*npm install -g openclaw@latest[\s\S]*openclaw gateway run/s,
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

for (const check of checks) {
  check();
}

console.log(`Smoke checks passed: ${checks.length}`);
