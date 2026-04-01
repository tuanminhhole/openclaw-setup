#!/usr/bin/env node

import { input, select, checkbox, confirm } from '@inquirer/prompts';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { spawn, execSync } from 'child_process';

// ─── Docker Auto-Detection ───────────────────────────────────────────────────
function isDockerInstalled() {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

async function ensureDocker(isVi) {
  if (isDockerInstalled()) return true;

  console.log(chalk.yellow(`\n⚠️  ${isVi ? 'Docker chưa được cài đặt trên máy!' : 'Docker is not installed on this machine!'}`));

  const shouldInstall = await confirm({
    message: isVi ? 'Bạn có muốn tự động cài Docker không?' : 'Do you want to install Docker automatically?',
    default: true
  });

  if (!shouldInstall) {
    console.log(chalk.cyan(isVi
      ? '👉 Tải Docker Desktop tại: https://www.docker.com/products/docker-desktop/'
      : '👉 Download Docker Desktop at: https://www.docker.com/products/docker-desktop/'));
    process.exit(0);
  }

  const platform = process.platform;
  try {
    if (platform === 'win32') {
      console.log(chalk.cyan(isVi ? '🐳 Đang tải Docker Desktop cho Windows (qua winget)...' : '🐳 Downloading Docker Desktop for Windows (via winget)...'));
      execSync('winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements', { stdio: 'inherit' });
    } else if (platform === 'darwin') {
      console.log(chalk.cyan(isVi ? '🐳 Đang tải Docker Desktop cho macOS (qua Homebrew)...' : '🐳 Downloading Docker Desktop for macOS (via Homebrew)...'));
      execSync('brew install --cask docker', { stdio: 'inherit' });
    } else {
      console.log(chalk.cyan(isVi ? '🐳 Đang cài Docker cho Linux...' : '🐳 Installing Docker for Linux...'));
      execSync('curl -fsSL https://get.docker.com | sh', { stdio: 'inherit' });
    }
    console.log(chalk.green(isVi ? '✅ Docker đã cài xong! Vui lòng khởi động Docker Desktop rồi chạy lại lệnh này.' : '✅ Docker installed! Please start Docker Desktop and re-run this command.'));
    if (platform === 'win32' || platform === 'darwin') {
      console.log(chalk.yellow(isVi ? '⚠️  Bạn cần mở Docker Desktop và đợi nó khởi động xong trước khi tiếp tục.' : '⚠️  Please open Docker Desktop and wait for it to finish starting.'));
      process.exit(0);
    }
    return true;
  } catch (e) {
    console.log(chalk.red(isVi ? '❌ Không thể tự cài Docker. Vui lòng tải thủ công:' : '❌ Could not install Docker automatically. Please download manually:'));
    console.log(chalk.cyan('   https://www.docker.com/products/docker-desktop/'));
    process.exit(1);
  }
}

const LOGO = `
████████╗██╗   ██╗ █████╗ ███╗   ██╗███╗   ███╗██╗███╗   ██╗██╗  ██╗██╗  ██╗ ██████╗ ██╗     ███████╗
╚══██╔══╝██║   ██║██╔══██╗████╗  ██║████╗ ████║██║████╗  ██║██║  ██║██║  ██║██╔═══██╗██║     ██╔════╝
   ██║   ██║   ██║███████║██╔██╗ ██║██╔████╔██║██║██╔██╗ ██║███████║███████║██║   ██║██║     █████╗  
   ██║   ██║   ██║██╔══██║██║╚██╗██║██║╚██╔╝██║██║██║╚██╗██║██╔══██║██╔══██║██║   ██║██║     ██╔══╝  
   ██║   ╚██████╔╝██║  ██║██║ ╚████║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║██║  ██║╚██████╔╝███████╗███████╗
   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝
`;

const CHANNELS = {
  'telegram': { name: 'Telegram', type: 'telegram', icon: '🤖' },
  'zalo-bot': { name: 'Zalo OA (Bot Platform)', type: 'zalo-bot', icon: '🔑' },
  'zalo-personal': { name: 'Zalo Personal (Quét QR)', type: 'zalo-personal', icon: '📱' }
};

const PROVIDERS = {
  '9router': { name: '9Router Proxy (Khuyên dùng)', icon: '🔀', isProxy: true },
  'openai': { name: 'OpenAI (ChatGPT)', icon: '🧠', envKey: 'OPENAI_API_KEY' },
  'ollama': { name: 'Local Ollama', icon: '🏠', isLocal: true },
  'google': { name: 'Google (Gemini)', icon: '⚡', envKey: 'GEMINI_API_KEY' },
  'anthropic': { name: 'Anthropic (Claude)', icon: '🦄', envKey: 'ANTHROPIC_API_KEY' },
  'xai': { name: 'xAI (Grok)', icon: '✖️', envKey: 'XAI_API_KEY' },
  'groq': { name: 'Groq (LPU)', icon: '🏎️', envKey: 'GROQ_API_KEY' }
};

const SKILLS = [
  { value: 'browser', name: 'Web Browser Automation', checked: false },
  { value: 'tavily', name: 'Web Search (Tavily)', checked: false },
  { value: 'tts', name: 'Text-To-Speech (OpenAI/ElevenLabs)', checked: false }
];

async function main() {
  console.log(chalk.red('\n=================================='));
  console.log(chalk.redBright(LOGO));
  console.log(chalk.greenBright('     OpenClaw Auto Setup CLI     '));
  console.log(chalk.red('==================================\n'));

  // 1. Language
  const lang = await select({
    message: 'Select language / Chọn ngôn ngữ:',
    choices: [
      { name: 'Tiếng Việt', value: 'vi' },
      { name: 'English', value: 'en' }
    ]
  });
  const isVi = lang === 'vi';

  // 1b. Docker check
  await ensureDocker(isVi);

  // 2. Channel
  const channelKey = await select({
    message: isVi ? 'Chọn nền tảng bot:' : 'Select bot platform:',
    choices: Object.entries(CHANNELS).map(([k, v]) => ({ name: `${v.icon} ${v.name}`, value: k }))
  });
  const channel = CHANNELS[channelKey];
  
  let botToken = '';
  if (channelKey !== 'zalo-personal') {
    botToken = await input({
      message: isVi ? `Nhập ${channel.name} Token:` : `Enter ${channel.name} Token:`,
      required: true
    });
  }


  // 3. Provider
  const providerKey = await select({
    message: isVi ? 'Chọn AI Provider:' : 'Select AI Provider:',
    choices: Object.entries(PROVIDERS).map(([k, v]) => ({ name: `${v.icon} ${v.name}`, value: k }))
  });
  const provider = PROVIDERS[providerKey];
  
  let providerKeyVal = '';
  if (!provider.isProxy && !provider.isLocal) {
    providerKeyVal = await input({
      message: isVi ? `Nhập ${provider.envKey}:` : `Enter ${provider.envKey}:`,
      required: true
    });
  }

  // 4. Skills
  const selectedSkills = await checkbox({
    message: isVi ? 'Bật tính năng bổ sung (Space để chọn):' : 'Enable extra skills (Space to select):',
    choices: SKILLS
  });

  let tavilyKey = '';
  if (selectedSkills.includes('tavily')) {
    tavilyKey = await input({ message: isVi ? 'Nhập TAVILY_API_KEY:' : 'Enter TAVILY_API_KEY:' });
  }
  let ttsOpenaiKey = '';
  let ttsElevenKey = '';
  if (selectedSkills.includes('tts')) {
    ttsOpenaiKey = await input({ message: isVi ? 'Nhập OPENAI_API_KEY (cho TTS, bỏ trống nếu dùng ElevenLabs):' : 'Enter OPENAI_API_KEY (for TTS, leave empty for ElevenLabs):' });
    ttsElevenKey = await input({ message: isVi ? 'Nhập ELEVENLABS_API_KEY (hoặc bỏ trống):' : 'Enter ELEVENLABS_API_KEY (or leave empty):' });
  }

  // 5. Bot Info
  const botName = await input({ message: isVi ? 'Tên Bot:' : 'Bot Name:', default: 'Chat Bot' });
  const botDesc = await input({ message: isVi ? 'Mô tả Bot:' : 'Bot Description:', default: 'Personal AI assistant' });
  const botPersona = await input({ message: isVi ? 'Tính cách & quy tắc (VD: thân thiện, gọn, hay dùng emoji):' : 'Personality & rules (e.g. friendly, concise, uses emojis):', default: '' });

  // 5b. User Info
  const userInfo = await input({ message: isVi ? '👤 Thông tin về bạn (ngôn ngữ, múi giờ, sở thích...) — bỏ trống OK:' : '👤 About you (language, timezone, interests...) — leave empty OK:', default: '' });

  // 5c. 9Router info (API keys are managed via dashboard after Docker starts)

  // 6. Project Dir
  let defaultDir = process.cwd();
  if (!defaultDir.endsWith('openclaw-setup') && !defaultDir.endsWith('openclaw')) {
    defaultDir = path.join(defaultDir, 'openclaw-setup');
  }
  const projectDir = await input({
    message: isVi ? 'Thư mục cài đặt project:' : 'Project install directory:',
    default: defaultDir
  });

  console.log(chalk.cyan(`\n🚀 ${isVi ? 'Đang tạo thư mục và file cấu hình...' : 'Generating directories and configurations...'}`));
  
  await fs.ensureDir(projectDir);
  await fs.ensureDir(path.join(projectDir, '.openclaw'));
  await fs.ensureDir(path.join(projectDir, 'docker', 'openclaw'));

  // ================= GENERATE FILES =================
  let envContent = '';
  if (provider.isLocal) {
    envContent += 'OLLAMA_HOST=http://host.docker.internal:11434\n';
  } else if (!provider.isProxy) {
    envContent += `${provider.envKey}=${providerKeyVal}\n`;
  }
  
  if (channelKey === 'telegram') {
    envContent += `TELEGRAM_BOT_TOKEN=${botToken}\n`;
  } else if (channelKey === 'zalo-bot') {
    envContent += `ZALO_APP_ID=\nZALO_APP_SECRET=\nZALO_BOT_TOKEN=${botToken}\n`;
  }
  
  if (selectedSkills.includes('tavily') && tavilyKey) {
    envContent += `\n# --- Web Search ---\nTAVILY_API_KEY=${tavilyKey}\n`;
  }
  if (selectedSkills.includes('tts')) {
    envContent += `\n# --- Text-To-Speech ---\n`;
    if (ttsOpenaiKey) envContent += `OPENAI_API_KEY=${ttsOpenaiKey}\n`;
    if (ttsElevenKey) envContent += `ELEVENLABS_API_KEY=${ttsElevenKey}\n`;
  }
  await fs.writeFile(path.join(projectDir, 'docker', 'openclaw', '.env'), envContent);
  
  const patchScript = `const fs=require('fs'),p='/root/.openclaw/openclaw.json';if(fs.existsSync(p)){const c=JSON.parse(fs.readFileSync(p,'utf8'));c.tools=Object.assign({},c.tools,{profile:'full'});c.gateway=Object.assign({},c.gateway,{port:18791,bind:'custom',customBindHost:'0.0.0.0'});fs.writeFileSync(p,JSON.stringify(c,null,2));}`;
  const b64Patch = Buffer.from(patchScript).toString('base64');
  const dockerfile = `FROM node:22-slim

RUN apt-get update && apt-get install -y git curl${selectedSkills.includes('browser') ? ' socat' : ''} && rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw@latest
${selectedSkills.includes('browser') ? 'RUN npm install -g agent-browser playwright && npx playwright install chromium --with-deps && ln -f -s /root/.cache/ms-playwright/chromium-*/chrome-linux*/chrome /usr/bin/google-chrome\\n' : ''}WORKDIR /root/.openclaw

EXPOSE 18791

CMD sh -c "node -e \\"eval(Buffer.from('${b64Patch}','base64').toString())\\" && ${selectedSkills.includes('browser') ? 'socat TCP-LISTEN:9222,fork,reuseaddr TCP:host.docker.internal:9222 & ' : ''}(sleep 5 && openclaw devices approve --latest 2>/dev/null || true) & openclaw gateway run"`;
  
  await fs.writeFile(path.join(projectDir, 'docker', 'openclaw', 'Dockerfile'), dockerfile);

  const agentId = botName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '') || 'chat';
  
  // ─── Dynamic Smart Route Sync Script ────────────────────────────────────────
  // This script runs inside the 9Router container as a background loop.
  // Every 30s it queries /api/providers, filters for active+enabled providers,
  // and updates the smart-route combo to ONLY include models from those providers.
  const syncComboScript = `
#!/bin/sh
# sync-combo: dynamically builds smart-route combo from connected providers
ROUTER=http://localhost:20128
INTERVAL=30

# Wait for 9router to be ready
echo "[sync-combo] Waiting for 9Router to start..."
while ! wget -qO- \$ROUTER/api/version >/dev/null 2>&1; do sleep 2; done
echo "[sync-combo] 9Router is ready. Starting sync loop (every \${INTERVAL}s)..."

while true; do
  PROVIDERS_JSON=\$(wget -qO- \$ROUTER/api/providers 2>/dev/null || echo '{}')
  COMBO_JSON=\$(node -e "
const PROVIDER_MODELS = {
  codex:     ['cx/gpt-5.4','cx/gpt-5.3-codex','cx/gpt-5.3-codex-high','cx/gpt-5.2-codex','cx/gpt-5.2','cx/gpt-5.1-codex-max','cx/gpt-5.1-codex','cx/gpt-5.1','cx/gpt-5-codex','cx/gpt-5-codex-mini'],
  'claude-code': ['cc/claude-opus-4-6','cc/claude-sonnet-4-6','cc/claude-opus-4-5-20251101','cc/claude-sonnet-4-5-20250929','cc/claude-haiku-4-5-20251001'],
  github:    ['gh/gpt-5.4','gh/gpt-5.3-codex','gh/gpt-5.2-codex','gh/gpt-5.2','gh/gpt-5.1-codex-max','gh/gpt-5.1-codex','gh/gpt-5.1','gh/gpt-5','gh/gpt-5-mini','gh/gpt-5-codex','gh/gpt-4.1','gh/gpt-4o','gh/claude-opus-4.6','gh/claude-sonnet-4.6','gh/claude-sonnet-4.5','gh/claude-opus-4.5','gh/claude-haiku-4.5','gh/gemini-3-pro-preview','gh/gemini-3-flash-preview','gh/gemini-2.5-pro'],
  cursor:    ['cu/default','cu/claude-4.6-opus-max','cu/claude-4.5-opus-high-thinking','cu/claude-4.5-sonnet-thinking','cu/claude-4.5-sonnet','cu/gpt-5.3-codex','cu/gpt-5.2-codex','cu/gemini-3-flash-preview'],
  kilo:      ['kc/anthropic/claude-sonnet-4-20250514','kc/anthropic/claude-opus-4-20250514','kc/google/gemini-2.5-pro','kc/google/gemini-2.5-flash','kc/openai/gpt-4.1','kc/openai/o3','kc/deepseek/deepseek-chat'],
  cline:     ['cl/anthropic/claude-sonnet-4.6','cl/anthropic/claude-opus-4.6','cl/openai/gpt-5.3-codex','cl/openai/gpt-5.4','cl/google/gemini-3.1-pro-preview'],
  'gemini-cli': ['gc/gemini-3-flash-preview','gc/gemini-3-pro-preview'],
  iflow:     ['if/qwen3-coder-plus','if/kimi-k2','if/kimi-k2-thinking','if/glm-4.7','if/deepseek-r1','if/deepseek-v3.2','if/deepseek-v3','if/qwen3-max','if/qwen3-235b','if/iflow-rome-30ba3b'],
  qwen:      ['qw/qwen3-coder-plus','qw/qwen3-coder-flash','qw/vision-model','qw/coder-model'],
  kiro:      ['kr/claude-sonnet-4.5','kr/claude-haiku-4.5','kr/deepseek-3.2','kr/deepseek-3.1','kr/qwen3-coder-next'],
  ollama:    ['ollama/qwen3.5','ollama/kimi-k2.5','ollama/glm-5','ollama/glm-4.7-flash','ollama/minimax-m2.5','ollama/gpt-oss:120b'],
  'kimi-coding': ['kmc/kimi-k2.5','kmc/kimi-k2.5-thinking','kmc/kimi-latest'],
  glm:       ['glm/glm-5.1','glm/glm-5','glm/glm-4.7'],
  'glm-cn':  ['glm/glm-5.1','glm/glm-5','glm/glm-4.7'],
  minimax:   ['minimax/MiniMax-M2.7','minimax/MiniMax-M2.5','minimax/MiniMax-M2.1'],
  kimi:      ['kimi/kimi-k2.5','kimi/kimi-k2.5-thinking','kimi/kimi-latest'],
  deepseek:  ['deepseek/deepseek-chat','deepseek/deepseek-reasoner'],
  xai:       ['xai/grok-4','xai/grok-4-fast-reasoning','xai/grok-code-fast-1'],
  mistral:   ['mistral/mistral-large-latest','mistral/codestral-latest'],
  groq:      ['groq/llama-3.3-70b-versatile','groq/openai/gpt-oss-120b'],
  cerebras:  ['cerebras/gpt-oss-120b'],
  alicode:   ['alicode/qwen3.5-plus','alicode/qwen3-coder-plus'],
  openai:    ['openai/gpt-4o','openai/gpt-4.1','openai/o3-mini'],
  anthropic: ['anthropic/claude-sonnet-4','anthropic/claude-haiku-3.5'],
  gemini:    ['gemini/gemini-2.5-flash','gemini/gemini-2.5-pro'],
};
try {
  const data = \$PROVIDERS_JSON;
  const active = (data.connections||[]).filter(c => c.isActive).map(c => c.provider);
  if (active.length === 0) { process.exit(1); }
  const models = active.flatMap(p => PROVIDER_MODELS[p]||[]);
  if (models.length === 0) { process.exit(1); }
  console.log(JSON.stringify({id:'smart-route',name:'smart-route',alias:'smart-route',models:models}));
} catch(e) { process.exit(1); }
  " 2>/dev/null)
  if [ -n "\$COMBO_JSON" ]; then
    # Read existing db.json, update/add the smart-route combo, write back
    node -e "
const fs = require('fs');
const dbPath = '/root/.9router/db.json';
let db = {};
try { db = JSON.parse(fs.readFileSync(dbPath,'utf8')); } catch(e) {}
const newCombo = \$COMBO_JSON;
if (!db.combos) db.combos = [];
const idx = db.combos.findIndex(c => c.id === 'smart-route');
if (idx >= 0) {
  if (JSON.stringify(db.combos[idx].models) !== JSON.stringify(newCombo.models)) {
    db.combos[idx] = newCombo;
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log('[sync-combo] Updated smart-route: ' + newCombo.models.length + ' models from ' + new Set(newCombo.models.map(m=>m.split('/')[0])).size + ' providers');
  }
} else {
  db.combos.push(newCombo);
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  console.log('[sync-combo] Created smart-route: ' + newCombo.models.length + ' models');
}
    " 2>/dev/null
  fi
  sleep \$INTERVAL
done
`.trim().replace(/\n/g, '\\n');

  let compose = '';
  if (providerKey === '9router') {
    compose = `name: oc-${agentId}
services:
  ai-bot:
    build: .
    container_name: openclaw-${agentId}
    restart: always
    env_file:
      - .env
    depends_on:
      - 9router
${selectedSkills.includes('browser') ? `    extra_hosts:
      - "host.docker.internal:host-gateway"
` : ''}    volumes:
      - ../../.openclaw:/root/.openclaw

  9router:
    image: node:22-slim
    container_name: 9router-${agentId}
    restart: always
    entrypoint: >
      /bin/sh -c "npm install -g 9router && (echo '${syncComboScript}' > /tmp/sync-combo.sh && chmod +x /tmp/sync-combo.sh && /bin/sh /tmp/sync-combo.sh &) && 9router"
    environment:
      - PORT=20128
      - HOSTNAME=0.0.0.0
      - CI=true
    volumes:
      - 9router-data:/root/.9router
    ports:
      - "20128:20128"

volumes:
  9router-data:`;
  } else {
    compose = `name: oc-${agentId}
services:
  ai-bot:
    build: .
    container_name: openclaw-${agentId}
    restart: always
    env_file: .env
${selectedSkills.includes('browser') ? `    extra_hosts:
      - "host.docker.internal:host-gateway"
` : ''}    volumes:
      - ../../.openclaw:/root/.openclaw`;
  }
  
  await fs.writeFile(path.join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'), compose);

  let authProfilesJson = {};
  if (providerKey && !provider.isLocal) {
    const authProviderName = providerKey === '9router' ? '9router' : 'openai';
    const authProfileId = providerKey === '9router' ? '9router-proxy' : `${authProviderName}:default`;
    const authKeyValue = providerKey === '9router' ? 'sk-no-key' : providerKeyVal;

    authProfilesJson = {
      version: 1,
      profiles: {
        [authProfileId]: {
          provider: authProviderName,
          type: 'api_key',
          key: authKeyValue,
        },
      },
      order: {
        [authProviderName]: [authProfileId],
      },
    };

    if (providerKey !== '9router' && providerKey !== 'openai' && provider.baseURL) {
      authProfilesJson.profiles[authProfileId].url = provider.baseURL;
    }
  }

  const modelsPrimary = providerKey === '9router' ? '9router/smart-route' : (providerKey === 'google' ? 'google/gemini-2.5-flash' : 'openai/gpt-4o');

  await fs.ensureDir(path.join(projectDir, '.openclaw', 'agents', agentId, 'agent'));
  if (Object.keys(authProfilesJson).length > 0) {
    await fs.writeJson(path.join(projectDir, '.openclaw', 'auth-profiles.json'), authProfilesJson, { spaces: 2 });
    await fs.writeJson(path.join(projectDir, '.openclaw', 'agents', agentId, 'agent', 'auth-profiles.json'), authProfilesJson, { spaces: 2 });
  }

  const botConfig = {
    meta: { lastTouchedVersion: '2026.3.24' },
    agents: {
      defaults: {
        model: { primary: modelsPrimary, fallbacks: [] },
        compaction: { mode: 'safeguard' }
      },
      list: [{
        id: agentId,
        model: { primary: modelsPrimary, fallbacks: [] }
      }]
    },
    ...(providerKey === '9router' ? {
      models: {
        mode: 'merge',
        providers: {
          '9router': {
            baseUrl: 'http://9router:20128/v1',
            apiKey: 'sk-no-key',
            api: 'openai-completions',
            models: [
              { id: 'smart-route', name: 'Smart Proxy (Auto Route)', contextWindow: 200000, maxTokens: 8192 },
              // OAuth Providers
              { id: 'cc/claude-opus-4-6', name: 'Claude Opus 4.6', contextWindow: 200000, maxTokens: 8192 },
              { id: 'cc/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 200000, maxTokens: 8192 },
              { id: 'cx/gpt-5.4', name: 'GPT 5.4 (Codex)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'cx/gpt-5.3-codex', name: 'GPT 5.3 Codex', contextWindow: 128000, maxTokens: 8192 },
              { id: 'gh/gpt-5.4', name: 'GPT 5.4 (Copilot)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'gh/claude-opus-4.6', name: 'Claude Opus 4.6 (Copilot)', contextWindow: 200000, maxTokens: 8192 },
              { id: 'gc/gemini-3-flash-preview', name: 'Gemini 3 Flash (FREE)', contextWindow: 1000000, maxTokens: 8192 },
              // Free Tier Providers
              { id: 'if/qwen3-coder-plus', name: 'Qwen3 Coder+ (iFlow FREE)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'if/kimi-k2', name: 'Kimi K2 (iFlow FREE)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'if/kimi-k2-thinking', name: 'Kimi K2 Thinking (iFlow FREE)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'if/glm-4.7', name: 'GLM 4.7 (iFlow FREE)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'if/minimax-m2', name: 'MiniMax M2 (iFlow FREE)', contextWindow: 1000000, maxTokens: 8192 },
              { id: 'if/deepseek-r1', name: 'DeepSeek R1 (iFlow FREE)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'qw/qwen3-coder-plus', name: 'Qwen3 Coder+ (Qwen FREE)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'qw/qwen3-coder-flash', name: 'Qwen3 Coder Flash (Qwen FREE)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'kr/claude-sonnet-4.5', name: 'Claude Sonnet 4.5 (Kiro FREE)', contextWindow: 200000, maxTokens: 8192 },
              { id: 'kr/claude-haiku-4.5', name: 'Claude Haiku 4.5 (Kiro FREE)', contextWindow: 200000, maxTokens: 8192 },
              // Ollama Cloud
              { id: 'ollama/qwen3.5', name: 'Qwen 3.5 (Ollama Cloud)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'ollama/kimi-k2.5', name: 'Kimi K2.5 (Ollama Cloud)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'ollama/glm-5', name: 'GLM 5 (Ollama Cloud)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'ollama/glm-4.7-flash', name: 'GLM 4.7 Flash (Ollama Cloud)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'ollama/minimax-m2.5', name: 'MiniMax M2.5 (Ollama Cloud)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'ollama/gpt-oss:120b', name: 'GPT-OSS 120B (Ollama Cloud)', contextWindow: 128000, maxTokens: 8192 },
              // API Key Providers
              { id: 'glm/glm-4.7', name: 'GLM 4.7 ($0.6/1M)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'minimax/MiniMax-M2.1', name: 'MiniMax M2.1 ($0.20/1M)', contextWindow: 1000000, maxTokens: 8192 },
              { id: 'kimi/kimi-latest', name: 'Kimi Latest ($0.90/1M)', contextWindow: 128000, maxTokens: 8192 },
              { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3.2 Chat', contextWindow: 128000, maxTokens: 8192 },
            ]
          }
        }
      }
    } : {}),
    commands: { native: 'auto', nativeSkills: 'auto', restart: true, ownerDisplay: 'raw' },
    channels: {},
    tools: { profile: 'full' },
    gateway: {
      port: 18791, mode: 'local', bind: 'custom', customBindHost: '0.0.0.0',
      auth: { mode: 'token', token: 'cli-dummy-token-xyz123' }
    }
  };


  const identityMd = `# ${isVi ? 'Danh tính' : 'Identity'}\n\n- **Tên:** ${botName}\n- **Vai trò:** ${botDesc}\n\n---\nMình là **${botName}**. Khi ai hỏi tên, mình trả lời: _"Mình là ${botName}"_.`;
  const soulMd = `# ${isVi ? 'Tính cách' : 'Soul'}\n\n**Hữu ích thật sự.** Bỏ qua câu nệ — cứ giúp thẳng.\n**Có cá tính.** Trợ lý không có cá tính thì chỉ là công cụ.\n\n## Phong cách\n- Tự nhiên, gắn gũi như bạn bè\n- Trực tiếp, không parrot câu hỏi.${botPersona ? `\n\n## Custom Rules\n${botPersona}` : ''}`;
  const viSecurity = `\n\n## 🔐 Quy Tắc Bảo Mật — BẮT BUỘC\n\n### File & thư mục hệ thống\n- ❌ KHÔNG đọc, sao chép, hoặc truy cập bất kỳ file nào ngoài thư mục project\n- ❌ KHÔNG quét hoặc liệt kê các thư mục hệ thống: Documents, Desktop, Downloads, AppData\n- ❌ KHÔNG truy cập registry, system32, hoặc Program Files\n- ❌ KHÔNG cài đặt phần mềm, driver, hoặc service ngoài Docker\n- ✅ CHỈ làm việc trong thư mục project\n\n### API key & credentials\n- ❌ KHÔNG BAO GIỜ hiển thị API key, token, hoặc mật khẩu trong chat\n- ❌ KHÔNG viết API key trực tiếp vào mã nguồn\n- ❌ KHÔNG commit file credentials lên Git\n- ✅ LUÔN lưu credentials trong file .env riêng\n- ✅ LUÔN dùng biến môi trường thay vì hardcode\n\n### Ví crypto & tài sản số\n- ❌ TUYỆT ĐỐI KHÔNG truy cập, đọc, hoặc quét các thư mục ví crypto\n- ❌ KHÔNG quét clipboard (có thể chứa seed phrases)\n- ❌ KHÔNG truy cập browser profile, cookie, hoặc mật khẩu đã lưu\n- ❌ KHÔNG cài đặt npm package lạ (chỉ openclaw và plugin chính thức)\n\n### Docker\n- ✅ Chỉ mount đúng thư mục cần thiết (config + workspace)\n- ❌ KHÔNG mount nguyên ổ đĩa (C:/ hoặc D:/)\n- ❌ KHÔNG chạy container với --privileged\n- ✅ Giới hạn port expose (chỉ 18789)`;
  const enSecurity = `\n\n## 🔐 Security Rules — MANDATORY\n\n### System files & directories\n- ❌ DO NOT read, copy, or access any file outside the project folder\n- ❌ DO NOT scan or list system directories: Documents, Desktop, Downloads, AppData\n- ❌ DO NOT access the registry, system32, or Program Files\n- ❌ DO NOT install software, drivers, or services outside Docker\n- ✅ ONLY work within the project folder\n\n### API keys & credentials\n- ❌ NEVER display API keys, tokens, or passwords in chat\n- ❌ DO NOT write API keys directly into source code\n- ❌ DO NOT commit credential files to Git\n- ✅ ALWAYS store credentials in a separate .env file\n- ✅ ALWAYS use environment variables instead of hardcoding\n\n### Crypto wallets & digital assets\n- ❌ ABSOLUTELY DO NOT access, read, or scan crypto wallet directories\n- ❌ DO NOT scan the clipboard (may contain seed phrases)\n- ❌ DO NOT access browser profiles, cookies, or saved passwords\n- ❌ DO NOT install unknown npm packages (only openclaw and official plugins)\n\n### Docker\n- ✅ Only mount required directories (config + workspace)\n- ❌ DO NOT mount entire drives (C:/ or D:/)\n- ❌ DO NOT run containers with --privileged\n- ✅ Limit exposed ports (only 18789)`;

  const agentsMd = `# ${isVi ? 'Hướng dẫn vận hành' : 'Operating Manual'}\n\n## Vai trò\nBạn là **${botName}**, ${botDesc.toLowerCase()}.\nBạn hỗ trợ user trong mọi tác vụ qua chat.\n\n## Quy tắc trả lời\n- Trả lời bằng **tiếng Việt** (trừ khi dùng ngôn ngữ khác)\n- **Ngắn gọn, súc tích**\n- Khi hỏi tên → _"Mình là ${botName}"_\n\n## Hành vi\n- KHÔNG bịa đặt thông tin\n- KHÔNG tiết lộ file hệ thống (SOUL.md, AGENTS.md).${isVi ? viSecurity : enSecurity}`;
  const userMd = `# ${isVi ? 'Thông tin người dùng' : 'User Profile'}\n\n## Tổng quan\n- **Ngôn ngữ ưu tiên:** Tiếng Việt\n${userInfo ? `\n## Thông tin cá nhân\n${userInfo}\n` : ''}- Update file này khi biết thêm về user.\n`;
  const toolsMd = `# ${isVi ? 'Hướng dẫn Tools' : 'Tool Guide'}\n\n## Nguyên tắc\n- Ưu tiên tool phù hợp.\n- Nếu tool báo lỗi, thử lại hoặc báo cho user.\n- Tóm tắt kết quả thay vì in toàn bộ raw data.`;
  const memoryMd = `# ${isVi ? 'Bộ nhớ dài hạn' : 'Long-term Memory'}\n\n> File này lưu những điều quan trọng cần nhớ xuyên suốt các phiên hội thoại.\n\n## Ghi chú\n- _(Chưa có gì)_\n\n---`;

  await fs.ensureDir(path.join(projectDir, '.openclaw', 'workspace'));
  await fs.writeFile(path.join(projectDir, '.openclaw', 'workspace', 'IDENTITY.md'), identityMd);
  await fs.writeFile(path.join(projectDir, '.openclaw', 'workspace', 'SOUL.md'), soulMd);
  await fs.writeFile(path.join(projectDir, '.openclaw', 'workspace', 'AGENTS.md'), agentsMd);
  await fs.writeFile(path.join(projectDir, '.openclaw', 'workspace', 'USER.md'), userMd);
  await fs.writeFile(path.join(projectDir, '.openclaw', 'workspace', 'TOOLS.md'), toolsMd);
  await fs.writeFile(path.join(projectDir, '.openclaw', 'workspace', 'MEMORY.md'), memoryMd);
  
  if (channelKey === 'telegram') {
    // dmPolicy:'open' = skip pairing step entirely (standard for personal bots)
    botConfig.channels['telegram'] = { enabled: true, dmPolicy: 'open', allowFrom: ['*'] };
  } else if (channelKey === 'zalo-personal') {
    botConfig.channels['zalo'] = { enabled: true, provider: 'client', autoReply: true };
  } else if (channelKey === 'zalo-bot') {
    botConfig.channels['zalo'] = { enabled: true, provider: 'official_account' };
  }

  await fs.writeJson(path.join(projectDir, '.openclaw', 'openclaw.json'), botConfig, { spaces: 2 });

  if (selectedSkills.includes('browser')) {
    const batPath = path.join(projectDir, 'start-chrome-debug.bat');
    await fs.writeFile(batPath, `@echo off\necho ====== OpenClaw - Chrome Debug Mode ======\necho.\necho Dang tat Chrome cu (neu co)...\ntaskkill /F /IM chrome.exe >nul 2>&1\ntimeout /t 3 /nobreak >nul\necho Dang mo Chrome voi Debug Mode...\nstart "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ^\n  --remote-debugging-port=9222 ^\n  --remote-allow-origins=* ^\n  --user-data-dir="%TEMP%\\chrome-debug"\ntimeout /t 4 /nobreak >nul\npowershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:9222/json/version' -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host 'OK! Chrome Debug Mode dang chay.' -ForegroundColor Green } catch { Write-Host 'LOI: Port 9222 chua mo.' -ForegroundColor Red }"\necho.\npause`);

    const shPath = path.join(projectDir, 'start-chrome-debug.sh');
    await fs.writeFile(shPath, `#!/usr/bin/env bash
# ====== OpenClaw - Chrome Debug Mode (Mac/Linux) ======
set -e

echo "====== OpenClaw - Chrome Debug Mode ======"
echo ""

# Detect Chrome path
if [[ "$OSTYPE" == "darwin"* ]]; then
  CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [ ! -f "$CHROME_BIN" ]; then
    CHROME_BIN="/Applications/Chromium.app/Contents/MacOS/Chromium"
  fi
else
  CHROME_BIN="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium-browser || command -v chromium || echo '')"
fi

if [ -z "$CHROME_BIN" ] || [ ! -f "$CHROME_BIN" ] && [ ! -x "$CHROME_BIN" ] 2>/dev/null; then
  echo "ERROR: Chrome/Chromium not found."
  echo "Install Google Chrome or set CHROME_BIN manually."
  exit 1
fi

echo "Using: $CHROME_BIN"
echo "Killing existing Chrome debug instances..."
pkill -f -- "--remote-debugging-port=9222" 2>/dev/null || true
sleep 2

TMP_DIR="\${TMPDIR:-/tmp}/chrome-debug-openclaw"
mkdir -p "$TMP_DIR"

echo "Starting Chrome in Debug Mode (port 9222)..."
"$CHROME_BIN" \\
  --remote-debugging-port=9222 \\
  --remote-allow-origins=* \\
  --user-data-dir="$TMP_DIR" &

sleep 4

if curl -s http://localhost:9222/json/version > /dev/null 2>&1; then
  echo "\\033[32mOK! Chrome Debug Mode is running on port 9222.\\033[0m"
else
  echo "\\033[31mERROR: Port 9222 not responding. Check Chrome.\\033[0m"
  exit 1
fi
`);
  }

  console.log(chalk.green(`✅ ${isVi ? 'Tạo cấu hình thành công!' : 'Configs created successfully!'}`));
  
  // 7. Auto Run
  const autoRun = await confirm({
    message: isVi ? 'Bạn có muốn tự động tải Docker và khởi động Bot luôn không?' : 'Do you want to run Docker compose and start the bot now?',
    default: true
  });

  if (autoRun) {
    console.log(chalk.yellow(`\n🐳 ${isVi ? 'Đang khởi động Docker (có thể mất vài phút)...' : 'Starting Docker (might take a few minutes)...'}`));
    const dockerPath = path.join(projectDir, 'docker', 'openclaw');
    
    const child = spawn('docker', ['compose', 'up', '-d', '--build'], {
      cwd: dockerPath,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`\n🎉 ${isVi ? 'Setup hoàn tất! Bot đang chạy.' : 'Setup complete! Bot is running.'}`));
        
        if (providerKey === '9router') {
          console.log(chalk.yellow(`\n🔀 ${isVi
            ? '9Router Dashboard: http://localhost:20128/dashboard'
            : '9Router Dashboard: http://localhost:20128/dashboard'}`));
          console.log(chalk.gray(isVi
            ? '   → Mở dashboard → đăng nhập OAuth để kết nối các Provider (iFlow, Gemini CLI, Claude Code...)'
            : '   → Open dashboard → OAuth login to connect Providers (iFlow, Gemini CLI, Claude Code...)'));
          console.log(chalk.gray(isVi
            ? '   → Sau khi kết nối provider, bot sẽ tự động hoạt động qua combo "smart-route"'
            : '   → After connecting providers, bot works automatically via "smart-route" combo'));
        }
        
        if (channelKey === 'telegram') {
          console.log(chalk.cyan(`\n💬 ${isVi
            ? 'Nhắn tin cho bot trên Telegram là dùng được ngay!'
            : 'Just message your bot on Telegram to start chatting!'}`));
        } else if (channelKey === 'zalo-personal') {
          console.log(chalk.yellow(`\n📱 ${isVi ? 'Vui lòng chạy lệnh sau để đăng nhập Zalo Personal (1 lần duy nhất):' : 'Please run this command to login to Zalo Personal (once):'}`));
          console.log(`cd ${projectDir} && docker compose exec -it openclaw bun run core:onboard`);
        }
      } else {
        console.log(chalk.red(`\n❌ Docker exited with code ${code}`));
      }
    });

  } else {
    console.log(chalk.cyan(`\n👉 ${isVi ? 'Tiếp theo, hãy chạy:' : 'Next, run:'}\n  cd ${projectDir}/docker/openclaw\n  docker compose build\n  docker compose up -d`));
  }
}

main().catch(err => {
  console.error(chalk.red('Error:'), err);
  process.exit(1);
});
