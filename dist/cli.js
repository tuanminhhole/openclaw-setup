#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO = `
╭────────────────────────────────────────╮
│            🦞 OpenClaw Setup           │
│             by tuanminhhole            │
╰────────────────────────────────────────╯
`;
console.log(LOGO);

const args = process.argv.slice(2);

const { startLocalInstaller } = await import('./server/local-server.js');

const noOpen = args.includes('--no-open');
const hostArg = args.find((arg) => arg.startsWith('--host='));
const portArg = args.find((arg) => arg.startsWith('--port='));
const projectDirArg = args.find((arg) => arg.startsWith('--project-dir='));

const defaultProjectDir = process.platform === 'win32'
  ? 'C:\\openclaw-setup'
  : path.join(os.homedir(), 'openclaw-setup');

let projectDir = projectDirArg ? projectDirArg.slice('--project-dir='.length) : defaultProjectDir;

if (!fs.existsSync(projectDir)) {
  try {
    fs.mkdirSync(projectDir, { recursive: true });
    console.log(`Folder setup được tạo tại: ${projectDir}`);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      const fallbackDir = path.join(os.homedir(), 'openclaw-setup');
      console.warn(`⚠️  Không có quyền tạo thư mục tại: ${projectDir}`);
      console.log(`👉 Đang chuyển sang thư mục mặc định trong User Profile: ${fallbackDir}`);
      try {
        fs.mkdirSync(fallbackDir, { recursive: true });
        projectDir = fallbackDir;
        console.log(`Folder setup được tạo tại: ${projectDir}`);
      } catch (fallbackErr) {
        console.error(`Không thể tự động tạo thư mục project tại ${fallbackDir}:`, fallbackErr.message);
      }
    } else {
      console.error(`Không thể tự động tạo thư mục project tại ${projectDir}:`, err.message);
    }
  }
}

await startLocalInstaller({
  openBrowser: !noOpen,
  host: hostArg ? hostArg.slice('--host='.length) : '127.0.0.1',
  preferredPort: portArg ? Number(portArg.slice('--port='.length)) : 51789,
  projectDir: projectDir,
});


