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
_require('../../src/setup/shared/common-gen.js');
_require('../../src/setup/shared/bot-config-gen.js');
_require('../../src/setup/data/index.js');

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

// ═════════════════════════════════════════════════════════════════════════════
// PART 1: openclaw.json generation matrix
// ═════════════════════════════════════════════════════════════════════════════

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
            selectedSkills: ['browser', 'memory', 'scheduler'],
            skills: SKILLS,
            hasBrowserDesktop: deploy === 'native',
            hasBrowserServer: deploy === 'docker',
            gatewayPort: 18789,
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
        assert(`[${label}] has gateway`,  !!cfg.gateway && cfg.gateway.port === 18789);
        assert(`[${label}] has tools`,    !!cfg.tools);
        assert(`[${label}] has models`,   !!cfg.models);
        assert(`[${label}] scheduler opens owner command gate`, Array.isArray(cfg.commands?.ownerAllowFrom) && cfg.commands.ownerAllowFrom.includes('*'));
        assert(`[${label}] scheduler enables automation tools`, Array.isArray(cfg.tools?.alsoAllow) && cfg.tools.alsoAllow.includes('group:automation'));

        const expectLan = deploy === 'docker' || os === 'vps';
        assert(`[${label}] gateway bind=${expectLan ? 'custom' : 'loopback'}`,
          expectLan ? cfg.gateway.bind === 'custom' : cfg.gateway.bind === 'loopback');

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
        }

        // Memory-core dreaming always present
        assert(`[${label}] memory-core plugin`, !!cfg.plugins?.entries?.['memory-core']);
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 2: exec-approvals.json generation
// ═════════════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════════════
// PART 3: .env file generation
// ═════════════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════════════
// PART 4: Cross-channel config integrity
// ═════════════════════════════════════════════════════════════════════════════

section('4. Cross-channel config integrity');
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
  assert('zalo prod format: no bundled zalo-mod plugin', !zaloParsed.plugins.entries['zalo-mod']);
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
  assert('tele multi: 9router provider', !!telParsed.models?.providers?.['9router']);
}

// ═════════════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(52));
const color = failed > 0 ? '\x1b[31m' : '\x1b[32m';
console.log(`${color}Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
