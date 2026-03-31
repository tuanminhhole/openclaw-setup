#!/usr/bin/env node

import { input, select, checkbox, confirm } from '@inquirer/prompts';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { spawn } from 'child_process';

const LOGO = `
      \\/      
  /\\O _ O/\\   
  // /_\\ \\\\   
\\//  / \\  \\\\/ 
`;

const CHANNELS = {
  'telegram': { name: 'Telegram', type: 'telegram', icon: '🤖' },
  'zalo-bot': { name: 'Zalo OA (Bot Platform)', type: 'zalo-bot', icon: '🔑' },
  'zalo-personal': { name: 'Zalo Personal (Quét QR)', type: 'zalo-personal', icon: '📱' }
};

const PROVIDERS = {
  'proxy': { name: '9Router Proxy (Khuyên dùng)', icon: '🔀', isProxy: true },
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
  
  const dockerfile = `FROM ghcr.io/williamskyze/openclaw:latest
${selectedSkills.includes('browser') ? 'RUN apt-get update && apt-get install -y chromium xvfb dbus socat' : '# (No browser config needed)'}`;
  await fs.writeFile(path.join(projectDir, 'docker', 'openclaw', 'Dockerfile'), dockerfile);

  const compose = `services:
  openclaw:
    build: .
    restart: always
    env_file: .env
    volumes:
      - ../../.openclaw:/app/.openclaw
      - ../../auth-profiles.json:/app/auth-profiles.json
${selectedSkills.includes('browser') ? `    extra_hosts:
      - "host.docker.internal:host-gateway"
` : ''}`;
  await fs.writeFile(path.join(projectDir, 'docker', 'openclaw', 'docker-compose.yml'), compose);

  await fs.writeFile(path.join(projectDir, 'auth-profiles.json'), '{}');

  const botConfig = {
    meta: { version: '1.0' },
    agents: {
      defaults: {
        model: { primary: providerKey === 'openai' ? 'gpt-4o' : (providerKey === 'google' ? 'google/gemini-2.5-flash' : 'smart-route'), fallbacks: [] },
        identity: {
          name: botName,
          description: botDesc,
          system_prompt: isVi ? "Bạn là một trợ lý AI hữu ích." : "You are a helpful AI assistant."
        },
        skills: selectedSkills
      }
    },
    channels: {}
  };
  
  if (channelKey === 'telegram') {
    botConfig.channels['telegram'] = { enabled: true };
  } else if (channelKey === 'zalo-personal') {
    botConfig.channels['zalo-personal'] = { enabled: true, autoReply: true };
  } else if (channelKey === 'zalo-bot') {
    botConfig.channels['zalo-bot'] = { enabled: true };
  }

  await fs.writeJson(path.join(projectDir, '.openclaw', 'openclaw.json'), botConfig, { spaces: 2 });

  if (selectedSkills.includes('browser')) {
    const batPath = path.join(projectDir, 'start-chrome-debug.bat');
    await fs.writeFile(batPath, `@echo off\necho OpenClaw Chrome Debug\nstart "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir="%TEMP%\\chrome-debug"\npause`);
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
        if (channelKey === 'zalo-personal') {
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
