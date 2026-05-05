// @ts-nocheck
(function (root) {
  const OPENCLAW_NPM_SPEC = 'openclaw@2026.5.4';
  const OPENCLAW_RUNTIME_PACKAGES = 'grammy @grammyjs/runner @grammyjs/transformer-throttler @buape/carbon @larksuiteoapi/node-sdk @slack/web-api';
  const NINE_ROUTER_NPM_SPEC = '9router@latest';
  const NINE_ROUTER_PORT = 20128;
  const NINE_ROUTER_PROXY_API_KEY = 'sk-no-key';
  const NINE_ROUTER_API_BASE_URL = `http://localhost:${NINE_ROUTER_PORT}`;
  const NINE_ROUTER_DOCKER_API_BASE_URL = `http://9router:${NINE_ROUTER_PORT}`;
  const SUPPORTED_CODEX_MODELS = ['cx/gpt-5.4', 'cx/gpt-5.3-codex', 'cx/gpt-5.2', 'cx/gpt-5.4-mini'];
  const SMART_ROUTE_PROVIDER_MODELS = {
    codex: SUPPORTED_CODEX_MODELS,
    'claude-code': ['cc/claude-opus-4-7', 'cc/claude-opus-4-6', 'cc/claude-sonnet-4-6', 'cc/claude-opus-4-5-20251101', 'cc/claude-sonnet-4-5-20250929', 'cc/claude-haiku-4-5-20251001'],
    github: ['gh/gpt-5.4', 'gh/gpt-5.3-codex', 'gh/gpt-5.2-codex', 'gh/gpt-5.2', 'gh/gpt-5.1-codex-max', 'gh/gpt-5.1-codex', 'gh/gpt-5.1-codex-mini', 'gh/gpt-5.1', 'gh/gpt-5-codex', 'gh/gpt-5', 'gh/gpt-4.1', 'gh/gpt-4o', 'gh/claude-opus-4.6', 'gh/claude-sonnet-4.6', 'gh/claude-sonnet-4.5', 'gh/claude-opus-4.5', 'gh/claude-haiku-4.5', 'gh/gemini-3-pro-preview', 'gh/gemini-3-flash-preview', 'gh/gemini-2.5-pro', 'gh/grok-code-fast-1'],
    cursor: ['cu/default', 'cu/claude-4.6-opus-max', 'cu/claude-4.6-sonnet-medium-thinking', 'cu/claude-4.5-opus-high-thinking', 'cu/claude-4.5-opus-high', 'cu/claude-4.5-sonnet-thinking', 'cu/claude-4.5-sonnet', 'cu/claude-4.5-haiku', 'cu/claude-4.5-opus', 'cu/gpt-5.3-codex', 'cu/gpt-5.2-codex', 'cu/gpt-5.2', 'cu/kimi-k2.5', 'cu/gemini-3-flash-preview'],
    kilo: ['kc/anthropic/claude-sonnet-4-20250514', 'kc/anthropic/claude-opus-4-20250514', 'kc/google/gemini-2.5-pro', 'kc/google/gemini-2.5-flash', 'kc/openai/gpt-4.1', 'kc/openai/o3', 'kc/deepseek/deepseek-chat', 'kc/deepseek/deepseek-reasoner'],
    cline: ['cl/anthropic/claude-opus-4.7', 'cl/anthropic/claude-sonnet-4.6', 'cl/anthropic/claude-opus-4.6', 'cl/openai/gpt-5.4', 'cl/openai/gpt-5.3-codex', 'cl/google/gemini-3.1-pro-preview', 'cl/google/gemini-3.1-flash-lite-preview', 'cl/kwaipilot/kat-coder-pro'],
    'gemini-cli': ['gc/gemini-3-flash-preview', 'gc/gemini-3-pro-preview'],
    kiro: ['kr/claude-sonnet-4.5', 'kr/claude-haiku-4.5', 'kr/deepseek-3.2', 'kr/deepseek-3.1', 'kr/qwen3-coder-next', 'kr/glm-5', 'kr/MiniMax-M2.5'],
    'kimi-coding': ['kmc/kimi-k2.5', 'kmc/kimi-k2.5-thinking', 'kmc/kimi-latest'],
    openai: ['openai/gpt-5.4', 'openai/gpt-5.4-mini', 'openai/gpt-5.2', 'openai/gpt-5.1', 'openai/gpt-5', 'openai/gpt-4o', 'openai/gpt-4.1', 'openai/o3', 'openai/o4-mini'],
    anthropic: ['anthropic/claude-sonnet-4-20250514', 'anthropic/claude-opus-4-20250514', 'anthropic/claude-3-5-sonnet-20241022'],
    gemini: ['gemini/gemini-3.1-pro-preview', 'gemini/gemini-3-flash-preview', 'gemini/gemini-2.5-pro', 'gemini/gemini-2.5-flash', 'gemini/gemini-2.5-flash-lite'],
    deepseek: ['deepseek/deepseek-chat', 'deepseek/deepseek-reasoner'],
    xai: ['xai/grok-4', 'xai/grok-4-fast-reasoning', 'xai/grok-code-fast-1', 'xai/grok-3'],
    mistral: ['mistral/mistral-large-latest', 'mistral/codestral-latest', 'mistral/mistral-medium-latest'],
    iflow: ['if/qwen3-coder-plus', 'if/qwen3-max', 'if/qwen3-vl-plus', 'if/qwen3-max-preview', 'if/qwen3-235b', 'if/qwen3-32b', 'if/kimi-k2', 'if/deepseek-v3.2', 'if/deepseek-v3.1', 'if/deepseek-v3', 'if/deepseek-r1', 'if/glm-4.7', 'if/iflow-rome-30ba3b'],
    qwen: ['qw/qwen3-coder-plus', 'qw/qwen3-coder-flash', 'qw/vision-model', 'qw/coder-model'],
    alicode: ['alicode/qwen3.5-plus', 'alicode/kimi-k2.5', 'alicode/glm-5', 'alicode/qwen3-coder-next', 'alicode/qwen3-coder-plus', 'alicode/glm-4.7'],
    groq: ['groq/llama-3.3-70b-versatile', 'groq/openai/gpt-oss-120b', 'groq/qwen/qwen3-32b'],
    cerebras: ['cerebras/gpt-oss-120b', 'cerebras/zai-glm-4.7', 'cerebras/qwen-3-32b'],
    glm: ['glm/glm-5.1', 'glm/glm-5', 'glm/glm-4.7'],
    'glm-cn': ['glm-cn/glm-5.1', 'glm-cn/glm-5', 'glm-cn/glm-4.7', 'glm-cn/glm-4.6'],
    minimax: ['minimax/MiniMax-M2.7', 'minimax/MiniMax-M2.5', 'minimax/MiniMax-M2.1'],
    kimi: ['kimi/kimi-k2.5', 'kimi/kimi-k2.5-thinking', 'kimi/kimi-latest'],
    ollama: ['ollama/qwen3.5', 'ollama/kimi-k2.5', 'ollama/glm-5', 'ollama/minimax-m2.5', 'ollama/glm-4.7-flash', 'ollama/gpt-oss:120b'],
  };
  const SMART_ROUTE_PROVIDER_ORDER = ['openai', 'anthropic', 'claude-code', 'codex', 'cursor', 'github', 'cline', 'kimi', 'minimax', 'deepseek', 'glm', 'alicode', 'xai', 'mistral', 'kilo', 'kiro', 'iflow', 'qwen', 'gemini-cli', 'gemini', 'ollama'];
  const TELEGRAM_RELAY_PLUGIN_SPEC = 'openclaw-telegram-multibot-relay';
  const TELEGRAM_RELAY_PLUGIN_ID = 'telegram-multibot-relay';
  const TELEGRAM_SETUP_GUIDE_FILENAME = 'TELEGRAM-GROUP-SETUP.md';

  function buildRelayPluginInstallCommand(prefix = 'openclaw') {
    return `if [ ! -d "$OPENCLAW_STATE_DIR/extensions/${TELEGRAM_RELAY_PLUGIN_ID}" ]; then ${prefix} plugins install ${TELEGRAM_RELAY_PLUGIN_SPEC} 2>/dev/null || true; fi`;
  }

  function buildRelayPluginInstallCommandWin(prefix = 'openclaw') {
    return `if not exist ".openclaw\\extensions\\${TELEGRAM_RELAY_PLUGIN_ID}\\" ${prefix} plugins install ${TELEGRAM_RELAY_PLUGIN_SPEC} || exit /b 0`;
  }

  function buildTelegramPostInstallChecklist(options = {}) {
    const {
      isVi = true,
      bots = [],
      groupId = '',
      relayPluginSpec = TELEGRAM_RELAY_PLUGIN_SPEC,
      includeTokenPreview = false,
    } = options;
    const botList = bots.map((bot, idx) => {
      const name = bot?.name || `Bot ${idx + 1}`;
      if (includeTokenPreview) {
        return `- **${name}** — token: ${String(bot?.token || '').slice(0, 10)}...`;
      }
      return `- **${name}**`;
    }).join('\n');

    if (isVi) {
      return `# Telegram Group Setup Guide

Bot da duoc cai dat. Thuc hien cac buoc sau de hoat dong trong group.

## Group ID
- ${groupId ? `Group ID: ${groupId}` : 'Chua nhap Group ID - bot se hoat dong o moi group.'}

## Danh sach bot
${botList}

---

## Buoc 1 -- Tat Privacy Mode tren BotFather (bat buoc, lam truoc)

Mac dinh bot chi doc tin nhan bat dau bang /. Phai tat Privacy Mode thi bot moi doc duoc tat ca tin nhan trong group.

Lam lan luot cho TUNG BOT:
1. Mo Telegram, tim @BotFather
2. Gui: /mybots
3. Chon bot can sua
4. Chon: Bot Settings
5. Chon: Group Privacy
6. Chon: Turn off
7. BotFather se bao: "Privacy mode is disabled for ..."

!!! QUAN TRONG: Phai lam buoc nay TRUOC khi add bot vao group. Neu bot da o trong group roi thi phai Remove bot ra, sau do Add lai.

## Buoc 2 -- Add bot vao group

Sau khi tat Privacy Mode cho ALL bot:
1. Mo group Telegram cua ban
2. Vao Settings -> Members -> Add Members
3. Tim ten tung bot theo username (VD: @TenCuaBot) va add vao
4. Sau khi add, vao Settings -> Administrators
5. Promote tung bot len Admin (can quyen phan hoi, co the de mac dinh)

Lay username that cua bot: vao @BotFather -> /mybots -> chon bot -> username la chu sau @.

## Buoc 3 -- Lay Group ID (neu chua co)

1. Them @userinfobot vao group nhu admin
2. Go /start hoac forward bat ky tin nhan trong group cho @userinfobot
3. Bot tra ve Chat ID bat dau bang -100...
4. Dat gia tri do vao TELEGRAM_GROUP_ID trong file .env

## Buoc 4 -- Cai plugin (neu chua cai duoc tu dong)

Neu trong qua trinh setup bao loi cai plugin, sau khi bot dang chay hay chay:

  openclaw plugins install ${relayPluginSpec}

## Buoc 5 -- Test

1. Gui tin nhan trong group, mention bot: @TenCuaBot xin chao
2. Bot se phan hoi
3. Neu khong phan hoi: kiem tra lai Buoc 1 (Privacy Mode) va Buoc 2 (add lai sau khi tat privacy)

---
*Generated by OpenClaw Setup*
`;
    }

    return `# Telegram Group Setup Guide

Bots are installed. Complete the steps below to activate them in a group.

## Group ID
- ${groupId ? `Group ID: ${groupId}` : 'No Group ID - bots will respond in any group.'}

## Bot list
${botList}

---

## Step 1 -- Disable Privacy Mode on BotFather (required, do this first)

By default bots only read messages starting with /. You must disable Privacy Mode so bots can read all group messages.

Do this for EACH BOT:
1. Open Telegram, find @BotFather
2. Send: /mybots
3. Select the bot
4. Choose: Bot Settings
5. Choose: Group Privacy
6. Choose: Turn off
7. BotFather confirms: "Privacy mode is disabled for ..."

!!! IMPORTANT: Do this BEFORE adding the bot to the group. If the bot is already in the group, remove it first then re-add it.

## Step 2 -- Add bots to the group

After disabling Privacy Mode for ALL bots:
1. Open your Telegram group
2. Go to Settings -> Members -> Add Members
3. Search each bot by username (e.g. @YourBotUsername) and add it
4. Go to Settings -> Administrators
5. Promote each bot to Admin

To get each bot's real username: open @BotFather -> /mybots -> select bot -> username after @.

## Step 3 -- Get Group ID (if not already set)

1. Add @userinfobot to the group as admin
2. Send /start or forward any group message to @userinfobot
3. It returns a Chat ID starting with -100...
4. Set that value as TELEGRAM_GROUP_ID in your .env file

## Step 4 -- Install plugin (if auto-install failed)

If setup reported a plugin install error, run this after the bot is running:

  openclaw plugins install ${relayPluginSpec}

## Step 5 -- Test

1. Send a message in the group mentioning the bot: @YourBotUsername hello
2. The bot should respond
3. No response? Re-check Step 1 (Privacy Mode) and Step 2 (re-add bot after disabling privacy)

---
*Generated by OpenClaw Setup*
`;
  }

  function buildAuthProfilesJson(options = {}) {
    const {
      providerKey = '',
      provider = {},
      apiKey = '',
      isProxy = false,
      isLocal = false,
      localUrl = 'http://ollama:11434',
      proxyKey = 'sk-no-key',
    } = options;

    if (isLocal) {
      return {
        version: 1,
        profiles: {
          'ollama:default': {
            provider: 'ollama',
            type: 'api_key',
            key: 'ollama-local',
            url: localUrl,
          },
        },
        order: { ollama: ['ollama:default'] },
      };
    }

    const authProviderName = isProxy ? '9router' : providerKey;
    const authProfileId = isProxy ? '9router-proxy' : `${authProviderName}:default`;
    const authKeyValue = isProxy
      ? proxyKey
      : (apiKey || `<your_${(provider.envKey || 'API_KEY').toLowerCase()}>`);
    const json = {
      version: 1,
      profiles: {
        [authProfileId]: {
          provider: authProviderName,
          type: 'api_key',
          key: authKeyValue,
        },
      },
      order: { [authProviderName]: [authProfileId] },
    };

    if (!isProxy && providerKey !== 'openai' && provider.baseURL) {
      json.profiles[authProfileId].url = provider.baseURL;
    }
    return json;
  }

  function buildAuthProfilesString(options = {}) {
    return JSON.stringify(buildAuthProfilesJson(options), null, 2);
  }

  function get9RouterBaseUrl(deployMode = 'native') {
    return deployMode === 'docker' ? `${NINE_ROUTER_DOCKER_API_BASE_URL}/v1` : `${NINE_ROUTER_API_BASE_URL}/v1`;
  }

  function build9RouterProviderConfig(baseUrl = `${NINE_ROUTER_API_BASE_URL}/v1`) {
    return {
      baseUrl,
      apiKey: NINE_ROUTER_PROXY_API_KEY,
      api: 'openai-completions',
      models: [
        {
          id: 'smart-route',
          name: 'Smart Proxy (Auto Route)',
          contextWindow: 200000,
          maxTokens: 8192,
        },
        ...SUPPORTED_CODEX_MODELS.map((id) => ({
          id,
          name: `Codex ${id.slice(3).replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}`,
          contextWindow: 200000,
          maxTokens: 8192,
        })),
      ],
    };
  }

  function buildGatewayConfig(port = 18791, deployMode = 'native', allowedOrigins = [], osChoice = '') {
    const normalizedPort = Number(port) || 18791;
    const cfg = {
      port: normalizedPort,
      mode: 'local',
      controlUi: { allowedOrigins },
      auth: { mode: 'token', token: crypto.randomUUID().replace(/-/g, '') },
    };
    if (deployMode === 'docker' || osChoice === 'vps') {
      cfg.bind = 'custom';
      cfg.customBindHost = '0.0.0.0';
    } else {
      cfg.bind = 'loopback';
    }
    return cfg;
  }

  root.__openclawCommon = {
    OPENCLAW_NPM_SPEC,
    OPENCLAW_RUNTIME_PACKAGES,
    NINE_ROUTER_NPM_SPEC,
    NINE_ROUTER_PORT,
    NINE_ROUTER_PROXY_API_KEY,
    NINE_ROUTER_API_BASE_URL,
    NINE_ROUTER_DOCKER_API_BASE_URL,
    SUPPORTED_CODEX_MODELS,
    SMART_ROUTE_PROVIDER_MODELS,
    SMART_ROUTE_PROVIDER_ORDER,
    TELEGRAM_RELAY_PLUGIN_SPEC,
    TELEGRAM_RELAY_PLUGIN_ID,
    TELEGRAM_SETUP_GUIDE_FILENAME,
    buildRelayPluginInstallCommand,
    buildRelayPluginInstallCommandWin,
    buildTelegramPostInstallChecklist,
    buildAuthProfilesJson,
    buildAuthProfilesString,
    get9RouterBaseUrl,
    build9RouterProviderConfig,
    buildGatewayConfig,
  };

})(typeof globalThis !== 'undefined' ? globalThis : {});
if (typeof exports !== 'undefined' && typeof globalThis !== 'undefined' && globalThis.__openclawCommon) {
  Object.assign(exports, globalThis.__openclawCommon);
}
