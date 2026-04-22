#!/usr/bin/env node
/**
 * E2E Test: OpenClaw CLI on VPS/Ubuntu
 * Discovered prompt sequence:
 *   0: Language (Vi=default) → ENTER
 *   1: OS (VPS=pre-selected on Linux) → ENTER  
 *   2: Deploy mode (Docker=1st, Native=2nd) → DOWN + ENTER
 *   3: Channel (Telegram=1st) → ENTER
 *   4: Provider (9Router=1st) → ENTER
 *   5: Bot Count (1=1st) → ENTER
 *   6: Bot Name → "TestBot" + ENTER
 *   7: Slash cmd → ENTER (default)
 *   8: Bot Desc → "Test VPS Bot" + ENTER
 *   9: Persona → ENTER (skip)
 *  10: Token → token + ENTER
 *  11: Skills → ENTER (defaults)
 *  12: User info → ENTER (skip)
 *  13: Project Dir → path + ENTER
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, 'dist', 'cli.js');
const BOT_TOKEN = '8400228172:AAG4qa15POsmqMm9WpddW_VwV5pChD4gF64';
const PROJECT_DIR = path.join(process.env.HOME || '/root', 'openclaw-test');
const ENTER = '\r';
const DOWN = '\x1B[B';

try { fs.rmSync(PROJECT_DIR, { recursive: true, force: true }); } catch {}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== OpenClaw CLI E2E Test (VPS) ===');
  console.log('CLI:', CLI_PATH);
  console.log('Target:', PROJECT_DIR, '\n');

  const child = spawn('node', [CLI_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', NODE_NO_WARNINGS: '1' },
  });

  let allOutput = '';
  let lastOutputTime = Date.now();
  let stepsDone = 0;

  const answers = [
    [['language', 'ngôn ngữ', 'ngon ngu'], [ENTER], 'Language=Vi'],
    [['hệ điều hành', 'he dieu hanh', 'vps / ubuntu server', 'operating system'], [ENTER], 'OS=VPS'],
    [['cách chạy', 'cach chay', 'deploy', 'docker'], [DOWN, ENTER], 'Deploy=Native'],
    [['nền tảng', 'nen tang', 'kênh', 'telegram'], [ENTER], 'Platform=Telegram'],
    [['bao nhiêu', 'bao nhieu', 'how many'], [ENTER], 'BotCount=1'],
    [['tên bot', 'ten bot', 'bot.*name', 'bot 1 name', 'tên bot 1'], ['TestBot', ENTER], 'BotName'],
    [['slash command'], [ENTER], 'SlashCmd'],
    [['mô tả', 'mo ta', 'description'], ['Test VPS Bot', ENTER], 'BotDesc'],
    [['tính cách', 'tinh cach', 'persona'], [ENTER], 'Persona'],
    [['token', 'bot token', 'botfather'], [BOT_TOKEN, ENTER], 'BotToken'],
    [['thông tin', 'thong tin', 'info', 'user info'], ['williams_dev', ENTER], 'UserInfo'],
    [['provider', 'chọn ai provider', 'ai provider'], [ENTER], 'Provider'],
    [['bổ sung', 'bo sung', 'features', 'plugins', 'space'], [ENTER], 'ExtraFeatures'],
    [['thư mục', 'thu muc', 'directory', 'folder', 'project dir'], [PROJECT_DIR, ENTER], 'ProjectDir'],
  ];

  async function tryAnswer() {
    if (stepsDone >= answers.length) return;
    const [patterns, keys, name] = answers[stepsDone];
    const chunk = allOutput.slice(-2000).toLowerCase();
    const matched = patterns.some(p => chunk.includes(p));
    if (!matched) return;
    if (!chunk.includes('?') && !chunk.includes('>')) return;

    console.log('\n>>> [' + stepsDone + '] ' + name);
    stepsDone++;
    await sleep(500);
    for (const key of keys) {
      child.stdin.write(key);
      await sleep(100);
    }
    allOutput = allOutput.slice(-300);
  }

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    allOutput += text;
    lastOutputTime = Date.now();
    tryAnswer();
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);
    allOutput += text;
    lastOutputTime = Date.now();
    tryAnswer();
  });

  const monitor = setInterval(async () => {
    const lower = allOutput.toLowerCase();
    if (lower.includes('pm2 logs') || lower.includes('dashboard') || lower.includes('bot dang chay') || lower.includes('native runtime')) {
      console.log('\n\n=== Install complete! ===');
      console.log('Steps: ' + stepsDone + '/' + answers.length);
      await sleep(10000);

      // Health check
      try {
        const resp = await fetch('http://127.0.0.1:18791', { signal: AbortSignal.timeout(5000) });
        console.log('Gateway HTTP ' + resp.status + ' - UP!');
      } catch (e) {
        console.log('Gateway not responding: ' + e.message);
        try {
          const { execSync } = await import('child_process');
          console.log(execSync('pm2 jlist 2>/dev/null || echo "pm2 not found"', { encoding: 'utf8' }).slice(0, 500));
        } catch {}
      }

      // File check
      const ocDir = path.join(PROJECT_DIR, '.openclaw');
      console.log('\n--- Files ---');
      for (const f of ['openclaw.json', 'start-gateway.sh']) {
        console.log((fs.existsSync(path.join(ocDir, f)) ? 'OK' : 'MISSING') + ' ' + f);
      }

      clearInterval(monitor);
      clearTimeout(timeout);
      child.kill('SIGTERM');
      process.exit(0);
    }
    if (Date.now() - lastOutputTime > 8000 && stepsDone < answers.length) {
      tryAnswer();
    }
  }, 3000);

  const timeout = setTimeout(() => {
    console.log('\n=== TIMEOUT 600s ===');
    console.log('Steps: ' + stepsDone + '/' + answers.length);
    console.log('Last:\n' + allOutput.slice(-500));
    clearInterval(monitor);
    child.kill('SIGTERM');
    process.exit(1);
  }, 600000);

  child.on('close', (code) => {
    clearTimeout(timeout);
    clearInterval(monitor);
    console.log('\nCLI exit: ' + code);
    process.exit(code || 0);
  });
}

main().catch(console.error);
