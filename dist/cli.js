#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runCmd = (cmd, cmdArgs, opts = {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { 
      shell: true, 
      stdio: 'inherit',
      ...opts 
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    child.on('error', reject);
  });
};

function isLocalRepo() {
  const pathsToTry = [
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '../..')
  ];
  for (const rootDir of pathsToTry) {
    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'create-openclaw-bot' && fs.existsSync(path.join(rootDir, 'src', 'cli', 'cli.src.js'))) {
          return true;
        }
      } catch {}
    }
  }
  return false;
}

// True when the full server code is bundled next to this CLI (dist build, npm/global
// install, or `npx github:...`). In that case run it directly instead of bootstrapping
// the published package — works even though `files` ships only `dist/` (no `src/`).
function hasBundledServer() {
  return [
    path.join(__dirname, 'server', 'local-server.js'),
    path.join(__dirname, '..', 'server', 'local-server.js'),
  ].some((p) => fs.existsSync(p));
}

const LOGO = `
╭────────────────────────────────────────╮
│          🦞 OpenClaw Setup 🦞          │
│             by tuanminhhole            │
╰────────────────────────────────────────╯
`;
console.log(LOGO);

const args = process.argv.slice(2);

const noOpen = args.includes('--no-open');
const hostArg = args.find((arg) => arg.startsWith('--host='));
const portArg = args.find((arg) => arg.startsWith('--port='));
const projectDirArg = args.find((arg) => arg.startsWith('--project-dir='));

const fallbackDir = path.join(os.homedir(), 'openclaw-setup');
const defaultProjectDir = process.platform === 'win32'
  ? ((!fs.existsSync('C:\\openclaw-setup') && fs.existsSync(fallbackDir)) ? fallbackDir : 'C:\\openclaw-setup')
  : fallbackDir;

let projectDir = projectDirArg ? projectDirArg.slice('--project-dir='.length) : defaultProjectDir;

if (!fs.existsSync(projectDir)) {
  try {
    fs.mkdirSync(projectDir, { recursive: true });
    console.log(`Folder setup được tạo tại: ${projectDir}`);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
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

if (process.env.OPENCLAW_SETUP_WIZARD === 'true' || isLocalRepo() || hasBundledServer()) {
  const { startLocalInstaller } = await import('./server/local-server.js');

  await startLocalInstaller({
    openBrowser: !noOpen,
    host: hostArg ? hostArg.slice('--host='.length) : '127.0.0.1',
    preferredPort: portArg ? Number(portArg.slice('--port='.length)) : 51789,
    projectDir: projectDir,
  });
} else {
  const targetDirName = '.openclaw-setup';
  const targetPath = path.join(os.homedir(), targetDirName);
  const cliPath = path.join(targetPath, 'node_modules', 'create-openclaw-bot', 'dist', 'cli.js');
  const shouldUpdate = args.includes('--update');

  try {
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    const pkgPath = path.join(targetPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      fs.writeFileSync(pkgPath, JSON.stringify({ name: 'openclaw-setup-container', version: '1.0.0', private: true, dependencies: {} }, null, 2), 'utf8');
    }

    let needsInstall = !fs.existsSync(cliPath) || shouldUpdate;
    let installSpec = 'create-openclaw-bot@latest';

    try {
      const runningPkgPath = path.join(__dirname, '..', 'package.json');
      if (fs.existsSync(runningPkgPath)) {
        const runningPkg = JSON.parse(fs.readFileSync(runningPkgPath, 'utf8'));
        if (runningPkg.version) {
          installSpec = `create-openclaw-bot@${runningPkg.version}`;

          const installedPkgPath = path.join(targetPath, 'node_modules', 'create-openclaw-bot', 'package.json');
          if (fs.existsSync(installedPkgPath)) {
            const installedPkg = JSON.parse(fs.readFileSync(installedPkgPath, 'utf8'));
            if (runningPkg.version !== installedPkg.version) {
              console.log(`Version mismatch: Launcher is v${runningPkg.version}, but cached installation is v${installedPkg.version}.`);
              needsInstall = true;
            }
          } else {
            needsInstall = true;
          }
        }
      }
    } catch (err) {}

    if (needsInstall) {
      console.log(`Checking/Installing Setup Wizard package (${installSpec}) in: ${targetPath}...`);
      await runCmd('npm', ['install', installSpec, '--no-audit', '--no-fund'], { cwd: targetPath });
    }

    console.log('\nStarting Setup Wizard...');
    const cleanArgs = args.filter((arg) => arg !== '--update');
    
    const child = spawn(process.argv[0], [cliPath, ...cleanArgs, `--project-dir=${projectDir}`], {
      cwd: targetPath,
      shell: false,
      stdio: 'inherit',
      env: {
        ...process.env,
        OPENCLAW_SETUP_WIZARD: 'true'
      }
    });
    child.on('close', (code) => {
      process.exit(code);
    });
  } catch (error) {
    console.error('\n❌ Lỗi khi khởi động Setup Wizard:', error.message);
    process.exit(1);
  }
}


