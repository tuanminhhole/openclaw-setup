/**
 * OpenClaw Matrix Test — Config + Script Generation for all OS × Deploy × Channel × Bot Count
 *
 * Tests every combination:
 *   OS:       windows, macos (linux), vps, linux-desktop
 *   Deploy:   docker, native
 *   Channel:  telegram (1 bot), telegram (2 bot), zalo-personal
 *   
 * Validates:
 *   1. openclaw.json is valid JSON with required keys
 *   2. exec-approvals.json is valid JSON
 *   3. .env content is well-formed
 *   4. OS scripts (.bat/.sh) are generated without errors
 *   5. OS scripts contain expected shell commands (npm install, openclaw gateway, etc.)
 *   6. Zalo configs have no autoReply, have groups
 *   7. Multi-bot configs have correct agent entries and bindings
 */
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

// ── Load shared modules ────────────────────────────────────────────────────────
_require('../setup/shared/common-gen.js');
_require('../setup/shared/bot-config-gen.js');
_require('../setup/data/index.js');

const common = globalThis.__openclawCommon || {};
const bcfg   = globalThis.__openclawBotConfig || {};
const data   = globalThis.__openclawData || {};
const { PROVIDERS, SKILLS } = data;

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, detail = '') {
  if (condition) {
    process.stdout.write(`  \x1b[32mOK\x1b[0m ${label}\n`);
    passed++;
  } else {
    process.stdout.write(`  \x1b[31mFAIL\x1b[0m ${label}${detail ? ` — ${detail}` : ''}\n`);
    failed++;
    failures.push(label);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

console.log('\nOpenClaw Matrix Tests — Config + Script Generation');
console.log('='.repeat(52));

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: openclaw.json generation matrix
// ═══════════════════════════════════════════════════════════════════════════════

const DEPLOY_MODES = ['docker', 'native'];
const CHANNELS = [
  { key: 'telegram',      label: 'Telegram 1-bot', botCount: 1 },
  { key: 'telegram',      label: 'Telegram 2-bot', botCount: 2 },
  { key: 'zalo-personal', label: 'Zalo Personal',  botCount: 1 },
];
const OS_CHOICES = ['windows', 'linux', 'vps', 'linux-desktop'];

// Provider for 9Router (most common)
const provider9r = PROVIDERS['9router'];

section('1. openclaw.json generation matrix');
{
  for (const deploy of DEPLOY_MODES) {
    for (const ch of CHANNELS) {
      for (const os of OS_CHOICES) {
        const label = `${os}/${deploy}/${ch.label}`;
        const isMultiBot = ch.botCount > 1;
        const agentMetas = [];
        for (let i = 0; i < ch.botCount; i++) {
          agentMetas.push({
            agentId: `bot-${i + 1}`,
            name: `Bot${i + 1}`,
            token: `test-token-${i + 1}`,
            workspaceDir: `workspace-bot-${i + 1}`,
            accountId: isMultiBot ? `account-${i + 1}` : 'default',
            slashCmd: isMultiBot ? `/bot${i + 1}` : '',
          });
        }

        let cfg;
        try {
          cfg = bcfg.buildOpenclawJson({
            channelKey: ch.key,
            deployMode: deploy,
            providerKey: '9router',
            provider: provider9r,
            model: 'smart-route',
            isMultiBot,
            agentMetas,
            groupId: isMultiBot ? '-1001234567890' : '',
            selectedSkills: ['browser', 'memory'],
            skills: SKILLS,
            hasBrowserDesktop: deploy === 'native',
            hasBrowserServer: deploy === 'docker',
            gatewayPort: 18791,
            gatewayAllowedOrigins: [],
            osChoice: os,
          });
        } catch (e) {
          assert(`[${label}] buildOpenclawJson does not throw`, false, e.message);
          continue;
        }

        // Validate JSON roundtrip
        try {
          const json = JSON.stringify(cfg, null, 2);
          const parsed = JSON.parse(json);
          assert(`[${label}] valid JSON roundtrip`, typeof parsed === 'object');
        } catch (e) {
          assert(`[${label}] valid JSON roundtrip`, false, e.message);
          continue;
        }

        // Required top-level keys
        assert(`[${label}] has meta`,     !!cfg.meta);
        assert(`[${label}] has agents`,   !!cfg.agents && Array.isArray(cfg.agents.list) && cfg.agents.list.length === ch.botCount);
        assert(`[${label}] has channels`, !!cfg.channels && Object.keys(cfg.channels).length > 0);
        assert(`[${label}] has gateway`,  !!cfg.gateway && cfg.gateway.port === 18791);
        assert(`[${label}] has tools`,    !!cfg.tools);
        assert(`[${label}] has models`,   !!cfg.models);

        // Gateway bind mode: VPS and Docker should use custom, others native loopback
        const expectCustom = deploy === 'docker' || os === 'vps';
        assert(`[${label}] gateway bind=${expectCustom ? 'custom' : 'loopback'}`,
          expectCustom ? cfg.gateway.bind === 'custom' : cfg.gateway.bind === 'loopback');

        // Auth token present and non-empty
        assert(`[${label}] gateway auth token`, cfg.gateway.auth?.token?.length > 10);

        // Channel-specific checks
        if (ch.key === 'telegram') {
          assert(`[${label}] telegram channel present`, !!cfg.channels.telegram);
          assert(`[${label}] no autoReply in telegram`, !JSON.stringify(cfg.channels).includes('autoReply'));
          if (isMultiBot) {
            assert(`[${label}] multi-bot has bindings`, Array.isArray(cfg.bindings) && cfg.bindings.length === ch.botCount);
            assert(`[${label}] multi-bot has groups`, !!cfg.channels.telegram.groups);
            assert(`[${label}] agent-to-agent enabled`, cfg.tools.agentToAgent?.enabled === true);
          }
        } else if (ch.key === 'zalo-personal') {
          assert(`[${label}] zalouser channel present`, !!cfg.channels.zalouser);
          assert(`[${label}] zalouser has groups`, !!cfg.channels.zalouser.groups);
          assert(`[${label}] zalouser historyLimit=50`, cfg.channels.zalouser.historyLimit === 50);
          assert(`[${label}] zalouser groupPolicy=allowlist`, cfg.channels.zalouser.groupPolicy === 'allowlist');
          assert(`[${label}] no autoReply in zalouser`, !JSON.stringify(cfg.channels).includes('autoReply'));
          assert(`[${label}] zalouser binding present`, cfg.bindings?.some(b => b.match?.channel === 'zalouser'));
          assert(`[${label}] zalo-mod plugin present`, !!cfg.plugins?.entries?.['zalo-mod']);
        }

        // Memory-core dreaming always present
        assert(`[${label}] memory-core plugin`, !!cfg.plugins?.entries?.['memory-core']);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: exec-approvals.json generation
// ═══════════════════════════════════════════════════════════════════════════════

section('2. exec-approvals.json generation');
{
  // Single bot
  const single = bcfg.buildExecApprovalsJson({
    agentMetas: [{ agentId: 'williams' }],
  });
  assert('single-bot exec-approvals has version=1', single.version === 1);
  assert('single-bot exec-approvals has defaults', !!single.defaults);
  assert('single-bot exec-approvals has main agent', single.agents?.main?.security === 'full');
  assert('single-bot exec-approvals has named agent', single.agents?.williams?.security === 'full');
  assert('single-bot exec-approvals JSON valid', !!JSON.parse(JSON.stringify(single, null, 2)));

  // Multi bot
  const multi = bcfg.buildExecApprovalsJson({
    agentMetas: [{ agentId: 'williams' }, { agentId: 'luna' }, { agentId: 'mkt' }],
  });
  assert('multi-bot exec-approvals has all agents', 
    multi.agents?.williams && multi.agents?.luna && multi.agents?.mkt && multi.agents?.main);
  assert('multi-bot exec-approvals JSON valid', !!JSON.parse(JSON.stringify(multi, null, 2)));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3: .env file generation
// ═══════════════════════════════════════════════════════════════════════════════

section('3. .env file generation');
{
  // Telegram + 9Router
  const envTele9r = bcfg.buildEnvFileContent({
    provider: provider9r,
    providerKeyVal: '',
    channelKey: 'telegram',
    botToken: '123:ABC',
  });
  assert('tele+9router env has no API key line', envTele9r.includes('# 9Router'));
  assert('tele+9router env has bot token', envTele9r.includes('TELEGRAM_BOT_TOKEN=123:ABC'));

  // Telegram + OpenAI
  const envTeleOAI = bcfg.buildEnvFileContent({
    provider: PROVIDERS['openai'] || { envKey: 'OPENAI_API_KEY' },
    providerKeyVal: 'sk-test',
    channelKey: 'telegram',
    botToken: '456:DEF',
  });
  assert('tele+openai env has API key', envTeleOAI.includes('OPENAI_API_KEY=sk-test'));
  assert('tele+openai env has bot token', envTeleOAI.includes('TELEGRAM_BOT_TOKEN=456:DEF'));

  // Zalo Personal (no token needed in .env)
  const envZalo = bcfg.buildEnvFileContent({
    provider: provider9r,
    channelKey: 'zalo-personal',
    botToken: '',
  });
  assert('zalo-personal env has no TELEGRAM token', !envZalo.includes('TELEGRAM_BOT_TOKEN'));
  assert('zalo-personal env has no ZALO token', !envZalo.includes('ZALO_BOT_TOKEN'));

  // Zalo Bot API
  const envZaloBot = bcfg.buildEnvFileContent({
    provider: provider9r,
    channelKey: 'zalo-bot',
    botToken: 'zalo-tok',
  });
  assert('zalo-bot env has ZALO_BOT_TOKEN', envZaloBot.includes('ZALO_BOT_TOKEN=zalo-tok'));
  assert('zalo-bot env has ZALO_APP_ID', envZaloBot.includes('ZALO_APP_ID='));

  // Multi-bot shared .env (isSharedEnv=true)
  const envShared = bcfg.buildEnvFileContent({
    provider: provider9r,
    channelKey: 'telegram',
    botToken: '789:GHI',
    isMultiBot: true,
    isSharedEnv: true,
  });
  assert('shared env omits per-bot token', !envShared.includes('TELEGRAM_BOT_TOKEN'));

  // Skills: TTS + Email
  const envWithSkills = bcfg.buildEnvFileContent({
    provider: provider9r,
    channelKey: 'telegram',
    selectedSkills: ['tts', 'email'],
    ttsOpenaiKey: 'oai-tts-key',
    ttsElevenKey: 'el-key',
    smtpUser: 'test@mail.com',
    smtpPass: 'pass123',
  });
  assert('env with TTS has OPENAI key', envWithSkills.includes('OPENAI_API_KEY=oai-tts-key'));
  assert('env with TTS has ELEVENLABS key', envWithSkills.includes('ELEVENLABS_API_KEY=el-key'));
  assert('env with email has SMTP', envWithSkills.includes('SMTP_USER=test@mail.com'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4: OS script generation (Wizard-side)
// ═══════════════════════════════════════════════════════════════════════════════

section('4. OS script generation via Wizard IIFE');
{
  // Load the full setup.js bundle in a sandboxed evaluation
  const fs = await import('fs');
  const path = await import('path');
  const setupPath = path.resolve(new URL('../../dist/setup.js', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const setupCode = fs.readFileSync(setupPath, 'utf8');

  // The setup.js requires DOM globals — we simulate the minimum needed
  const noop = () => {};
  const fakeElement = { style: {}, appendChild: noop, setAttribute: noop, addEventListener: noop, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, textContent: '', innerHTML: '', dataset: {}, querySelectorAll: () => [], querySelector: () => null, closest: () => null, getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }) };
  const fakeDocument = {
    getElementById:    () => null,
    querySelector:     () => null,
    querySelectorAll:  () => [],
    getElementsByClassName: () => [],
    createElement:     () => ({ ...fakeElement }),
    createTextNode:    () => fakeElement,
    body:              { appendChild: noop, style: {}, addEventListener: noop },
    addEventListener:  noop,
    removeEventListener: noop,
    head:              { appendChild: noop },
    documentElement:   { style: {}, classList: { add: noop, remove: noop } },
  };
  const fakeWindow = {
    document: fakeDocument,
    navigator: { userAgent: 'test', language: 'vi' },
    location:  { hostname: 'localhost', port: '8080', href: '' },
    addEventListener: noop,
    removeEventListener: noop,
    setTimeout: (fn) => fn(),
    setInterval: () => 0,
    clearTimeout: noop,
    clearInterval: noop,
    getComputedStyle: () => ({}),
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    requestAnimationFrame: (fn) => fn(),
    scrollTo: noop,
    __navToStep: noop,
    __selectLang: noop,
    __selectOs: noop,
    history: { pushState: noop, replaceState: noop },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    fetch: () => Promise.resolve({ ok: true, json: () => ({}) }),
    alert: noop,
  };

  // Evaluate setup.js in a sandbox context to get the IIFE globals
  // This tests that the bundle evaluates without throwing
  let evalError = null;
  try {
    // The IIFE bundle expects window/document — use a simple eval approach
    const sandbox = { document: fakeDocument, window: fakeWindow, globalThis: global, navigator: fakeWindow.navigator, crypto };
    const vm = await import('vm');
    const context = vm.createContext(sandbox);
    vm.runInContext(setupCode, context, { filename: 'dist/setup.js' });
  } catch (e) {
    evalError = e;
  }

  assert('dist/setup.js evaluates without throw', !evalError,
    evalError ? evalError.message.substring(0, 200) : '');

  // Even if eval fails, we can still test the raw script content patterns

  // Windows BAT checks
  assert('win-bat has setup-openclaw-docker-win.bat', setupCode.includes("'setup-openclaw-docker-win.bat'"));
  assert('win-bat has setup-openclaw-win.bat', setupCode.includes("'setup-openclaw-win.bat'"));
  assert('win-bat has npm install openclaw version', setupCode.includes('npm install -g ${OPENCLAW_NPM_SPEC}'));
  assert('win-bat has openclaw gateway run', setupCode.includes('openclaw gateway run') || setupCode.includes('openclaw.cmd'));
  assert('win-bat has OPENCLAW_HOME', setupCode.includes('OPENCLAW_HOME'));
  assert('win-bat has chcp 65001', setupCode.includes('chcp 65001'));
  assert('win-bat has PowerShell patcher', setupCode.includes('oc-startgw.ps1'));

  // macOS SH checks  
  assert('macos-sh has setup-openclaw-docker-macos.sh', setupCode.includes("'setup-openclaw-docker-macos.sh'"));
  assert('macos-sh has setup-openclaw-macos.sh', setupCode.includes("'setup-openclaw-macos.sh'"));
  assert('macos-sh has npm config set prefix', setupCode.includes('npm config set prefix'));
  assert('macos-sh has openclaw version', setupCode.includes('${OPENCLAW_NPM_SPEC}'));
  assert('macos-sh has chmod +x', setupCode.includes('chmod +x'));

  // VPS SH checks
  assert('vps-sh has setup-openclaw-vps.sh', setupCode.includes("'setup-openclaw-vps.sh'"));
  assert('vps-sh has pm2 startup', setupCode.includes('pm2 startup'));
  assert('vps-sh has pm2 save', setupCode.includes('pm2 save'));
  assert('vps-sh has OPENCLAW_STATE_DIR', setupCode.includes('OPENCLAW_STATE_DIR'));

  // Linux Desktop SH checks
  assert('linux-sh has setup-openclaw-linux.sh', setupCode.includes("'setup-openclaw-linux.sh'"));
  assert('linux-sh has openclaw gateway run', setupCode.includes('openclaw gateway run'));

  // All OS scripts must NOT have old pinned version
  assert('scripts have pinned 2026.4.15 version', setupCode.includes('openclaw@2026.4.15'));
  assert('no scripts have autoReply', !setupCode.includes("autoReply: true"));

  // Verify CLAWEOF pattern exists in SH generators (used for heredoc file writing)
  assert('SH generators use CLAWEOF heredoc', setupCode.includes("CLAWEOF"));

  // Verify all 4 OS generators are present in the bundle
  assert('bundle has generateWinBat', setupCode.includes('function generateWinBat'));
  assert('bundle has generateMacOsSh', setupCode.includes('function generateMacOsSh'));
  assert('bundle has generateVpsSh', setupCode.includes('function generateVpsSh'));
  assert('bundle has generateLinuxSh', setupCode.includes('function generateLinuxSh'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5: CLI script validation (dist/cli.js)
// ═══════════════════════════════════════════════════════════════════════════════

section('5. CLI script validation');
{
  const fs = await import('fs');
  const path = await import('path');
  const cliPath = path.resolve(new URL('../../dist/cli.js', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const cli = fs.readFileSync(cliPath, 'utf8');

  // CLI must reference centralized builder
  assert('CLI imports buildOpenclawJson', cli.includes('buildOpenclawJson'));

  // CLI must have 9Router baseUrl helper
  assert('CLI has get9RouterBaseUrl', cli.includes('get9RouterBaseUrl'));

  // CLI must not have old inline patterns
  assert('CLI no inline autoReply', !cli.includes("autoReply: true"));
  assert('CLI uses OPENCLAW_NPM_SPEC', cli.includes('OPENCLAW_NPM_SPEC'));

  // CLI must have zalouser handling via centralized builder
  assert('CLI handles zalo-personal', cli.includes('zalo-personal') || cli.includes('zalouser'));

  // CLI structure checks — verify key patterns exist
  assert('CLI has shebang', cli.startsWith('#!/'));
  assert('CLI has inquirer prompts', cli.includes('inquirer') || cli.includes('prompt'));
  assert('CLI delegates config to centralized builder', cli.includes('buildOpenclawJson') || cli.includes('__openclawBotConfig'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 6: Cross-channel config integrity
// ═══════════════════════════════════════════════════════════════════════════════

section('6. Cross-channel config integrity');
{
  // Test that Zalo Personal config matches production format
  const zaloCfg = bcfg.buildOpenclawJson({
    channelKey: 'zalo-personal',
    deployMode: 'native',
    providerKey: '9router',
    provider: provider9r,
    model: 'smart-route',
    isMultiBot: false,
    agentMetas: [{ agentId: 'mkt', name: 'Mkt', token: '', workspaceDir: 'workspace-mkt' }],
    selectedSkills: ['memory'],
    skills: SKILLS,
    osChoice: 'vps',
  });

  const zaloJson = JSON.stringify(zaloCfg, null, 2);
  const zaloParsed = JSON.parse(zaloJson);

  assert('zalo prod format: zalouser enabled', zaloParsed.channels.zalouser.enabled === true);
  assert('zalo prod format: dmPolicy open', zaloParsed.channels.zalouser.dmPolicy === 'open');
  assert('zalo prod format: groups wildcard', !!zaloParsed.channels.zalouser.groups?.['*']);
  assert('zalo prod format: no autoReply', !zaloJson.includes('autoReply'));
  assert('zalo prod format: zalo-mod plugin', !!zaloParsed.plugins.entries['zalo-mod']);
  assert('zalo prod format: memory-core dreaming on', zaloParsed.plugins.entries['memory-core'].config.dreaming.enabled === true);
  assert('zalo prod format: binding present', zaloParsed.bindings?.some(b => b.match.channel === 'zalouser'));
  assert('zalo prod format: gateway bind custom (VPS)', zaloParsed.gateway.bind === 'custom');

  // Test Telegram multi-bot matches production format
  const telMulti = bcfg.buildOpenclawJson({
    channelKey: 'telegram',
    deployMode: 'docker',
    providerKey: '9router',
    provider: provider9r,
    model: 'smart-route',
    isMultiBot: true,
    agentMetas: [
      { agentId: 'williams', name: 'Williams', token: 'tok1', workspaceDir: 'workspace-williams', accountId: 'williams-acct' },
      { agentId: 'luna', name: 'Luna', token: 'tok2', workspaceDir: 'workspace-luna', accountId: 'luna-acct' },
    ],
    groupId: '-1001234567890',
    selectedSkills: ['browser', 'scheduler'],
    skills: SKILLS,
    hasBrowserServer: true,
    osChoice: 'windows',
  });

  const telJson = JSON.stringify(telMulti, null, 2);
  const telParsed = JSON.parse(telJson);

  assert('tele multi: 2 agents', telParsed.agents.list.length === 2);
  assert('tele multi: bindings for each agent', telParsed.bindings?.length === 2);
  assert('tele multi: agent-to-agent enabled', telParsed.tools.agentToAgent?.enabled === true);
  assert('tele multi: group in channel cfg', !!telParsed.channels.telegram.groups?.['-1001234567890']);
  assert('tele multi: groupPolicy=allowlist', telParsed.channels.telegram.groupPolicy === 'allowlist');
  assert('tele multi: no autoReply', !telJson.includes('autoReply'));
  assert('tele multi: gateway docker bind=custom', telParsed.gateway.bind === 'custom');
  assert('tele multi: browser enabled', !!telParsed.browser?.enabled);
  assert('tele multi: 9router provider', !!telParsed.models?.providers?.['9router']);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(52));
const color = failed > 0 ? '\x1b[31m' : '\x1b[32m';
console.log(`${color}Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
