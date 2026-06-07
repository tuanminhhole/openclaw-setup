/**
 * OpenClaw v5.5.x - Shared Generator Integration Tests
 *
 * This test calls the shared builders directly instead of driving the
 * interactive CLI or browser wizard. It protects the single-source generation
 * contracts used by both surfaces:
 *
 * - workspace-gen.js: markdown/browser workspace files
 * - install-gen.js: chrome debug, start-bot, uninstall, upgrade artifacts
 * - docker-gen.js: Dockerfile and docker-compose artifacts
 * - common-gen.js: shared package constants and relay helpers
 */
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

_require('../../src/setup/shared/workspace-gen.js');
_require('../../src/setup/shared/docker-gen.js');
_require('../../src/setup/shared/common-gen.js');
_require('../../src/setup/data/index.js');

const workspace = globalThis.__openclawWorkspace || {};
const docker = globalThis.__openclawDockerGen || {};
const common = globalThis.__openclawCommon || {};
const data = globalThis.__openclawData || {};

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, detail = '') {
  if (condition) {
    process.stdout.write(`  \x1b[32mOK\x1b[0m ${label}\n`);
    passed++;
  } else {
    process.stdout.write(`  \x1b[31mFAIL\x1b[0m ${label}${detail ? ` - ${detail}` : ''}\n`);
    failed++;
    failures.push(label);
  }
}

function assertIncludes(label, text, needle) {
  assert(label, String(text).includes(needle), `missing: ${needle}`);
}

function assertNotIncludes(label, text, needle) {
  assert(label, !String(text).includes(needle), `unexpected: ${needle}`);
}

function section(title) {
  console.log(`\n${title}`);
}

console.log('\nOpenClaw shared generator integration tests');
console.log('='.repeat(48));

section('1. Export surfaces');
{
  [
    'buildWorkspaceFileMap',
    'buildIdentityDoc',
    'buildAgentsDoc',
    'buildToolsDoc',
    'buildTeamsDoc',
  ].forEach((name) => assert(`workspace-gen exports ${name}`, typeof workspace[name] === 'function'));

  assert('docker-gen exports buildDockerArtifacts', typeof docker.buildDockerArtifacts === 'function');
  assert('docker-gen exports build9RouterPatchScript', typeof docker.build9RouterPatchScript === 'function');
  assert('common-gen exposes latest OpenClaw spec', typeof common.OPENCLAW_NPM_SPEC === 'string' && common.OPENCLAW_NPM_SPEC.length > 0);
  assert('data exports providers and skills', !!data.PROVIDERS && Array.isArray(data.SKILLS));
}

section('2. Workspace file map - single bot');
{
  const files = workspace.buildWorkspaceFileMap({
    isVi: false,
    variant: 'single',
    botName: 'Williams',
    botDesc: 'Personal AI assistant',
    ownAliases: ['Williams', '/will'],
    skillListStr: '- **Browser Automation** (browser-automation)\n- **Cron Scheduler** (cron-scheduler)',
    workspacePath: '.openclaw/workspace-williams/',
    agentWorkspaceDir: 'workspace-williams',
    persona: 'Direct and practical.',
    userInfo: 'Prefers Vietnamese.',
    hasBrowser: true,
    soulVariant: 'cli-rich',
    userVariant: 'cli-single',
    memoryVariant: 'cli-single',
    browserDocVariant: 'cli-desktop',
    browserToolVariant: 'cli',
    includeBrowserTool: true,
    hasScheduler: false,
  });

  ['IDENTITY.md', 'SOUL.md', 'AGENTS.md', 'USER.md', 'TOOLS.md', 'MEMORY.md', 'HEARTBEAT.md', 'BOOTSTRAP.md', 'DREAMS.md']
    .forEach((name) => assert(`single workspace includes ${name}`, typeof files[name] === 'string' && files[name].length > 20));

  assert('single workspace does not create TEAMS.md', !files['TEAMS.md']);
  assertIncludes('AGENTS.md contains bot identity', files['AGENTS.md'], 'Williams');
  assertIncludes('AGENTS.md includes security rules', files['AGENTS.md'], 'Security Rules');
  assertIncludes('TOOLS.md points to relative workspace', files['TOOLS.md'], '.openclaw/workspace-williams/');
  assertIncludes('BOOTSTRAP.md reinforces bot identity', files['BOOTSTRAP.md'], 'highest-priority source of truth');
  assertIncludes('HEARTBEAT.md points to empty heartbeat settings', files['HEARTBEAT.md'], 'skip heartbeat API calls');
  assertNotIncludes('workspace docs exclude removed combo channel', JSON.stringify(files), 'telegram+zalo-personal');
  assertNotIncludes('workspace docs exclude old combo flag', JSON.stringify(files), 'isComboChannel');


}

section('3. Workspace file map - relay multi-bot');
{
  const files = workspace.buildWorkspaceFileMap({
    isVi: false,
    variant: 'relay',
    botName: 'Luna',
    botDesc: 'Research assistant',
    ownAliases: ['Luna', '/luna'],
    otherAgents: [
      { name: 'Williams', agentId: 'williams', desc: 'Technical assistant' },
      { name: 'Mia', agentId: 'mia', desc: 'Marketing assistant' },
    ],
    skillListStr: '- **Browser Automation** (browser-automation)',
    workspacePath: '.openclaw/workspace-luna/',
    agentWorkspaceDir: 'workspace-luna',
    persona: 'Calm researcher.',
    userInfo: 'Team test user.',
    hasBrowser: true,
    soulVariant: 'cli-simple',
    userVariant: 'cli-multi',
    memoryVariant: 'cli-multi',
    browserDocVariant: 'cli-server',
    includeBrowserTool: false,
    teamRosterFormatted: [
      '- `luna`: Luna - Research assistant',
      '- `williams`: Williams - Technical assistant',
      '- `mia`: Mia - Marketing assistant',
    ].join('\n'),
    hasScheduler: true,
  });

  assert('relay workspace includes TEAMS.md', typeof files['TEAMS.md'] === 'string' && files['TEAMS.md'].length > 50);
  assert('relay workspace includes HEARTBEAT.md', typeof files['HEARTBEAT.md'] === 'string' && files['HEARTBEAT.md'].length > 20);
  assert('relay workspace includes BOOTSTRAP.md', typeof files['BOOTSTRAP.md'] === 'string' && files['BOOTSTRAP.md'].length > 20);
  assertNotIncludes('relay AGENTS does not reference TEAMS.md', files['AGENTS.md'], 'TEAMS.md');
  assertIncludes('relay TOOLS contains Telegram section', files['TOOLS.md'], 'Telegram');
  assert('relay workspace includes cronjob SKILL.md when selected', typeof files['skills/cronjob/SKILL.md'] === 'string' && files['skills/cronjob/SKILL.md'].length > 50);
  assertIncludes('TEAMS.md contains roster agent id', files['TEAMS.md'], '`williams`');
  assertNotIncludes('relay file map does not create RELAY.md', Object.keys(files).join(','), 'RELAY.md');
  assertNotIncludes('relay file map does not create TEAM.md', Object.keys(files).join(','), 'TEAM.md');


}

section('3.5 Zalo workspace reactions test');
{
  const files = workspace.buildWorkspaceFileMap({
    isVi: true,
    variant: 'single',
    botName: 'ZaloBot',
    hasZaloMod: true,
  });
  assertIncludes('Zalo TOOLS.md has Zalo reaction', files['TOOLS.md'], 'Zalo reaction');
  assertNotIncludes('Zalo TOOLS.md does not have Telegram reaction', files['TOOLS.md'], 'Telegram reaction');
}

section('4. Docker artifacts');
{
  const single = docker.buildDockerArtifacts({
    openClawNpmSpec: common.OPENCLAW_NPM_SPEC,
    openClawRuntimePackages: common.OPENCLAW_RUNTIME_PACKAGES,
    is9Router: true,
    isLocal: false,
    isMultiBot: false,
    hasBrowser: true,
    selectedModel: 'smart-route',
    agentId: 'williams',
    runtimeCommandParts: [
      'openclaw skills install browser-automation 2>/dev/null || true &&',
      'socat TCP-LISTEN:9222,fork,reuseaddr TCP:host.docker.internal:9222 &',
    ],
    volumeMount: '../..:/home/node/project',
    singleComposeName: 'oc-williams',
    singleAppContainerName: 'openclaw-williams',
    singleRouterContainerName: '9router-williams',
    plainSingleExtraHosts: true,
    emitBrowserInstall: true,
  });

  assert('single Dockerfile generated', single.dockerfile.length > 500);
  assert('single compose generated', single.compose.length > 500);
  assertIncludes('Dockerfile installs OpenClaw spec', single.dockerfile, common.OPENCLAW_NPM_SPEC);
  assertIncludes('Dockerfile uses CACHE_BUST on npm install layer', single.dockerfile, 'echo "CACHE_BUST=$CACHE_BUST" && npm install -g');
  assertIncludes('Dockerfile includes browser dependencies when requested', single.dockerfile, 'playwright install chromium');
  assertIncludes('Dockerfile writes a dedicated entrypoint script', single.dockerfile, '/usr/local/bin/openclaw-entrypoint.sh');
  assertIncludes('Dockerfile copies external entrypoint script', single.dockerfile, 'COPY entrypoint.sh /usr/local/bin/openclaw-entrypoint.sh');
  assertIncludes('Dockerfile uses JSON-array CMD for entrypoint', single.dockerfile, 'CMD ["/bin/sh", "/usr/local/bin/openclaw-entrypoint.sh"]');
  assertIncludes('entrypoint patches 9Router private network request', single.entrypointScript, 'allowPrivateNetwork:true');
  assertIncludes('entrypoint grants paired device admin scope', single.entrypointScript, 'operator.admin');
  assertIncludes('compose includes 9Router sidecar when requested', single.compose, '9router-williams');
  assertIncludes('compose mounts full project into container workspace', single.compose, '../..:/home/node/project');
  assertIncludes('compose sets project-local OPENCLAW_HOME', single.compose, 'OPENCLAW_HOME=/home/node/project/.openclaw');
  assertIncludes('compose sets bind-mounted OPENCLAW_STATE_DIR', single.compose, 'OPENCLAW_STATE_DIR=/home/node/project/.openclaw');
  assertIncludes('compose allows Docker-published private websocket bind', single.compose, 'OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1');
  assertNotIncludes('compose does not hide runtime state in a named volume', single.compose, 'openclaw-state:/var/lib/openclaw-state');
  assertIncludes('compose includes host gateway for desktop browser', single.compose, 'host.docker.internal');
  assertNotIncludes('compose does not leak old interpolation bug', single.compose, "Buffer.from('${Buffer.from");
  assertNotIncludes('Docker output excludes removed combo channel', JSON.stringify(single), 'telegram+zalo-personal');

  const multi = docker.buildDockerArtifacts({
    openClawNpmSpec: common.OPENCLAW_NPM_SPEC,
    openClawRuntimePackages: common.OPENCLAW_RUNTIME_PACKAGES,
    is9Router: false,
    isLocal: true,
    isMultiBot: true,
    hasBrowser: false,
    selectedModel: 'llama3.1',
    runtimeCommandParts: [common.buildRelayPluginInstallCommand('openclaw') + ' &&'],
    volumeMount: '../..:/home/node/project',
    multiComposeName: 'oc-multibot',
    multiAppContainerName: 'openclaw-multibot',
    multiOllamaContainerName: 'ollama-multibot',
    multiOllamaNumParallel: 2,
  });

  assertIncludes('multi compose includes app container', multi.compose, 'openclaw-multibot');
  assertIncludes('multi compose includes Ollama service for local provider', multi.compose, 'ollama-multibot');
  assertIncludes('multi Dockerfile also uses dedicated entrypoint script', multi.dockerfile, '/usr/local/bin/openclaw-entrypoint.sh');
  assertIncludes('multi artifact includes external entrypoint content', multi.entrypointScript, '#!/bin/sh');
  assertIncludes('relay plugin runtime install helper is idempotent', common.buildRelayPluginInstallCommand('openclaw'), 'extensions/telegram-multibot-relay');

  const patchScript = docker.build9RouterPatchScript();
  assertIncludes('9Router patch script strips max_output_tokens', patchScript, 'max_output_tokens');
  assertIncludes('9Router patch script scans bundled Next.js chunks', patchScript, "app','.next','server','chunks");
  assertIncludes('9Router patch script still supports legacy codex executor path', patchScript, "open-sse','executors','codex.js");
  assertIncludes('9Router patch script guards null output items in bundled responses parser', patchScript, 'a=>a&&"output_text"===a.type');
  assertIncludes('9Router patch script guards null OpenAI responses input items in bundled converters', patchScript, 'let b=a&&(a.type||(a.role?"message":null));');
  assertIncludes('9Router patch script guards null message items in bundled converters', patchScript, 'for(let a of b.messages||[])if(a){if("system"===a.role){');
  assertIncludes('9Router patch script guards null response content items in bundled converters', patchScript, 'a.content.map(a=>a&&("input_text"===a.type||"output_text"===a.type)');
  assertIncludes('9Router patch script guards null request content items in bundled converters', patchScript, 'a.content.map(a=>{if(!a)return null;');
  assertIncludes('9Router patch script guards null tool definitions in bundled converters', patchScript, 'b.tools.map(a=>{if(!a)return null;if(a.function)return a;');
  assertIncludes('9Router patch script guards null OpenAI tool definitions on reverse conversion', patchScript, 'b.tools.map(a=>a&&"function"===a.type?');
  assertIncludes('9Router patch script guards null function_call items in bundled responses parser', patchScript, 'a=>a&&"function_call"===a.type');
  assertIncludes('9Router patch script guards null text items in bundled converters', patchScript, 'a=>a&&"text"===a.type');
  assertIncludes('9Router patch script guards null Claude message_start items', patchScript, 'a=>a&&"message_start"===a.type');
}

section('5. Data and deprecated names');
{
  assert('CHANNELS exists and combo channel is removed', !!data.CHANNELS && !Object.keys(data.CHANNELS).includes('telegram+zalo-personal'));
  assert('SKILLS list contains scheduler or browser entries', data.SKILLS.some((skill) => ['scheduler', 'browser'].includes(skill.id || skill.value)));
  assert('PROVIDERS includes 9router', !!data.PROVIDERS['9router']);

  const allOutput = [
    JSON.stringify(data.CHANNELS),
    JSON.stringify(data.SKILLS),
    workspace.buildAgentsDoc({ isVi: false, botName: 'Test', variant: 'single' }),
    workspace.buildToolsDoc({ isVi: false }),
  ].join('\n');

  assertNotIncludes('shared outputs do not mention removed combo channel', allOutput, 'telegram+zalo-personal');
  assertNotIncludes('shared outputs do not mention old combo flag', allOutput, 'isComboChannel');
}

console.log('\n' + '='.repeat(48));
const color = failed > 0 ? '\x1b[31m' : '\x1b[32m';
console.log(`${color}Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach((failure) => console.log(`  - ${failure}`));
  process.exit(1);
}
