import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createBotInProject, deleteBotInProject, readBotCredentials } from '../../src/server/local-server.js';

const server = readFileSync(new URL('../../src/server/local-server.js', import.meta.url), 'utf8');

assert.match(server, /GET \/api\/system|\/api\/system/, 'server exposes system endpoint');
assert.match(server, /POST|\/api\/install/, 'server exposes install endpoint');
assert.match(server, /text\/event-stream/, 'server supports SSE logs');
assert.match(server, /safeJoin/, 'server has file path guard');
assert.match(server, /\.endsWith\('\.md'\)/, 'server restricts bot file writes to markdown');
assert.match(server, /openclaw@latest|OPENCLAW_NPM_SPEC/, 'server installs latest OpenClaw spec');
assert.match(server, /9router@latest|NINE_ROUTER_NPM_SPEC/, 'server installs latest 9Router spec');
assert.match(server, /\/api\/bot\/create/, 'server exposes bot create endpoint');
assert.match(server, /✅ Install completed/, 'server logs success emoji');
assert.match(server, /copyFile\(cfgPath, `\$\{cfgPath\}\.bak`/, 'server backs up openclaw config');

const root = mkdtempSync(join(tmpdir(), 'openclaw-local-server-'));
try {
  const tele = join(root, 'tele');
  await createBotInProject(tele, { channel: 'telegram', botName: 'Williams', role: 'Sales', emoji: '🧠', personality: 'Direct', userName: 'Tuan', userDescription: 'Founder', token: 'tok1' });
  await createBotInProject(tele, { channel: 'telegram', botName: 'Williams', role: 'Support', token: 'tok2' });
  const teleCfg = JSON.parse(await readFile(join(tele, '.openclaw', 'openclaw.json'), 'utf8'));
  assert.equal(teleCfg.agents.defaults.model.primary, 'smart-route', 'default model uses smart-route');
  assert.equal(teleCfg.agents.list[0].model.primary, 'smart-route', 'agent model uses smart-route');
  assert.equal(teleCfg.agents.list.length, 2, 'telegram creates 2 agents');
  assert.ok(teleCfg.channels.telegram.accounts.default.botToken === 'tok1', 'telegram first token uses default account');
  assert.ok(teleCfg.channels.telegram.accounts['williams-2'].botToken === 'tok2', 'telegram duplicate slug gets suffixed account');
  assert.ok(teleCfg.bindings.some((b) => b.agentId === 'williams-2' && b.match.accountId === 'williams-2'), 'telegram second binding present');
  assert.match(await readFile(join(tele, '.openclaw', 'workspace-williams', 'IDENTITY.md'), 'utf8'), /Williams/, 'telegram markdown identity written');
  assert.match(await readFile(join(tele, '.openclaw', 'workspace-williams', 'USER.md'), 'utf8'), /Founder/, 'telegram user markdown written');
  await deleteBotInProject(tele, 'williams');
  const afterDeleteCfg = JSON.parse(await readFile(join(tele, '.openclaw', 'openclaw.json'), 'utf8'));
  assert.ok(!afterDeleteCfg.agents.list.some((a) => a.id === 'williams'), 'delete removes agent config');
  assert.ok(!afterDeleteCfg.bindings.some((b) => b.agentId === 'williams'), 'delete removes binding config');
  assert.ok(!existsSync(join(tele, '.openclaw', 'workspace-williams')), 'delete removes workspace');
  await createBotInProject(tele, { channel: 'telegram', botName: 'Williams', role: 'New token', token: 'tok3' });
  const afterRecreateCfg = JSON.parse(await readFile(join(tele, '.openclaw', 'openclaw.json'), 'utf8'));
  assert.equal(afterRecreateCfg.channels.telegram.accounts.williams.botToken, 'tok3', 'recreated bot uses modal token');
  assert.match(await readFile(join(tele, '.env'), 'utf8'), /TELEGRAM_BOT_TOKEN_WILLIAMS=tok3/, 'recreated bot writes env token');

  // Test custom agentId creation
  await createBotInProject(tele, { agentId: 'luna-bot', channel: 'telegram', botName: 'Luna', role: 'Marketing', token: 'tok-luna' });
  const customIdCfg = JSON.parse(await readFile(join(tele, '.openclaw', 'openclaw.json'), 'utf8'));
  assert.ok(customIdCfg.agents.list.some((a) => a.id === 'luna-bot'), 'custom agentId is created in config');
  assert.ok(existsSync(join(tele, '.openclaw', 'workspace-luna-bot')), 'custom agent workspace dir is created');
  assert.ok(customIdCfg.agents.list.find((a) => a.id === 'luna-bot').workspace.endsWith('workspace-luna-bot'), 'custom agent workspace matches in openclaw.json');

  // Test custom agentId duplicate validation
  await assert.rejects(
    createBotInProject(tele, { agentId: 'luna-bot', channel: 'telegram', botName: 'Luna 2', role: 'Support', token: 'tok-luna2' }),
    { status: 400 },
    'duplicate agentId is rejected'
  );

  const zu = join(root, 'zuser');
  await createBotInProject(zu, { channel: 'zalo-personal', botName: 'Zalo User Bot', role: 'CRM' });
  const zuCfg = JSON.parse(await readFile(join(zu, '.openclaw', 'openclaw.json'), 'utf8'));
  assert.ok(zuCfg.channels.zalouser.enabled, 'zalo user channel enabled');
  assert.ok(zuCfg.bindings.some((b) => b.match.channel === 'zalouser'), 'zalo user binding present');
  assert.ok(zuCfg.plugins.allow.includes('zalouser'), 'zalo user plugin allowed');

  const za = join(root, 'zapi');
  await createBotInProject(za, { channel: 'zalo-bot', botName: 'Zalo API Bot', role: 'OA', token: 'zalo-token' });
  const zaCfg = JSON.parse(await readFile(join(za, '.openclaw', 'openclaw.json'), 'utf8'));
  assert.equal(zaCfg.channels.zalo.provider, 'official_account', 'zalo api provider set');
  assert.equal(zaCfg.channels.zalo.botToken, 'zalo-token', 'zalo api token stored');

  const cred = join(root, 'cred');
  mkdirSync(join(cred, '.openclaw'), { recursive: true });
  mkdirSync(join(cred, '.9router', 'db'), { recursive: true });
  writeFileSync(join(cred, '.openclaw', 'openclaw.json'), JSON.stringify({
    gateway: { auth: { token: 'gw-token' } },
    models: { providers: { '9router': { baseUrl: 'http://127.0.0.1:20128/v1', apiKey: 'sk-no-key' } } },
    agents: { defaults: { model: { primary: 'smart-route', fallbacks: [] } }, list: [] },
    channels: {},
    bindings: [],
    plugins: { entries: {}, allow: [] },
    tools: { profile: 'full', exec: { host: 'gateway', security: 'full', ask: 'off' } },
  }, null, 2));
  const db = new DatabaseSync(join(cred, '.9router', 'db', 'data.sqlite'));
  db.exec(`
    CREATE TABLE providerConnections (
      id TEXT PRIMARY KEY,
      provider TEXT,
      authType TEXT,
      name TEXT,
      email TEXT,
      priority INTEGER,
      isActive INTEGER,
      data TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE TABLE apiKeys (
      id TEXT PRIMARY KEY,
      name TEXT,
      key TEXT,
      isActive INTEGER,
      createdAt TEXT
    );
  `);
  db.prepare(`
    INSERT INTO providerConnections
    (id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('1', 'openai', 'apikey', 'main', null, 1, 1, JSON.stringify({ apiKey: 'sk-other-key' }), '2026-05-22T00:00:00.000Z', '2026-05-22T00:00:00.000Z');
  db.prepare(`
    INSERT INTO apiKeys (id, name, key, isActive, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run('1', 'openclaw', 'sk-real-9router-key', 1, '2026-05-22T00:00:00.000Z');
  db.close();
  const creds = await readBotCredentials(cred);
  assert.equal(creds.openclawToken, 'gw-token', 'gateway token still read from config');
  assert.equal(creds.nineRouterApiKey, 'sk-real-9router-key', '9router api key resolved from project sqlite, not proxy placeholder');
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log('server-local-web tests passed');
