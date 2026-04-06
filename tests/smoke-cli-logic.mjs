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
  /baseUrl: deployMode === 'native' \? 'http:\/\/localhost:20128\/v1' : 'http:\/\/9router:20128\/v1'/,
  'Native 9Router config must target localhost instead of the Docker hostname'
));

checks.push(() => expectMatch(
  cli,
  /function startNative9RouterPm2\(\{ isVi, projectDir, appName \}\) \{[\s\S]*9router -n -t -l -H 0\.0\.0\.0 -p 20128 --skip-update[\s\S]*pm2 save/s,
  'VPS native 9Router flow must start a standalone 9Router dashboard on port 20128 via PM2'
));

checks.push(() => expectMatch(
  cli,
  /const child = spawn\('openclaw', \['gateway', 'run'\], \{/,
  'Native desktop flows must start openclaw in foreground'
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

for (const check of checks) {
  check();
}

console.log(`Smoke checks passed: ${checks.length}`);
