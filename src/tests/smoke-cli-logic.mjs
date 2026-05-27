import fs from 'fs';
import path from 'path';

const root = process.cwd();
const launcherCli = fs.readFileSync(path.join(root, 'dist', 'cli.js'), 'utf8');
const legacyCli = fs.readFileSync(path.join(root, 'dist', 'legacy-cli.js'), 'utf8');
const setup = fs.readFileSync(path.join(root, 'dist', 'setup.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'dist', 'server', 'local-server.js'), 'utf8');
const web = fs.readFileSync(path.join(root, 'dist', 'web', 'app.js'), 'utf8');
const cliBytes = fs.readFileSync(path.join(root, 'dist', 'cli.js'));

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(!(cliBytes[0] === 0xef && cliBytes[1] === 0xbb && cliBytes[2] === 0xbf), 'CLI entrypoint must not include a UTF-8 BOM before the shebang');
expect(launcherCli.includes('startLocalInstaller'), 'Default CLI must launch local web installer');
expect(launcherCli.includes('legacy-cli.js'), 'Default CLI must expose legacy fallback');
expect(legacyCli.includes('@inquirer/prompts') && legacyCli.includes('Interactive'), 'Legacy CLI artifact must preserve terminal wizard code');
expect(server.includes('/api/system') && server.includes('/api/install') && server.includes('text/event-stream'), 'Local server must expose system/install/log APIs');
expect(server.includes('openclaw@latest') || server.includes('OPENCLAW_NPM_SPEC'), 'Local server must use latest OpenClaw spec');
expect(web.includes('OpenClaw') && web.includes('Setup') && web.includes('Files') && web.includes('Skills'), 'Local web UI must expose setup/bot/files/skills surfaces');
expect(setup.includes('__openclawCommon'), 'Legacy browser wizard bundle must still build');

console.log('smoke-cli-logic passed');
