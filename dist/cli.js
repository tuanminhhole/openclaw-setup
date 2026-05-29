#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const args = process.argv.slice(2);

if (isLocalRepo()) {
  const { startLocalInstaller } = await import('./server/local-server.js');
  
  if (args[0] === 'legacy' || args.includes('--legacy')) {
    await import('./legacy-cli.js');
  } else {
    const noOpen = args.includes('--no-open');
    const hostArg = args.find((arg) => arg.startsWith('--host='));
    const portArg = args.find((arg) => arg.startsWith('--port='));
    const projectDirArg = args.find((arg) => arg.startsWith('--project-dir='));
    
    await startLocalInstaller({
      openBrowser: !noOpen,
      host: hostArg ? hostArg.slice('--host='.length) : '127.0.0.1',
      preferredPort: portArg ? Number(portArg.slice('--port='.length)) : 51789,
      projectDir: projectDirArg ? projectDirArg.slice('--project-dir='.length) : process.cwd(),
    });
  }
} else {
  console.log('\n============================================================');
  console.log('   🦞 OpenClaw Setup — Auto-downloader & Installer');
  console.log('============================================================\n');

  const targetDirName = '.openclaw-setup';
  const targetPath = path.join(os.homedir(), targetDirName);

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

  try {
    // Check if git is installed
    try {
      await new Promise((resolve, reject) => {
        const child = spawn('git', ['--version'], { shell: true, stdio: 'ignore' });
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error());
        });
        child.on('error', reject);
      });
    } catch {
      throw new Error('Git is not installed or not found in PATH. Please install Git and try again.');
    }

    const isGitRepo = fs.existsSync(path.join(targetPath, '.git'));
    const hasPackageJson = fs.existsSync(path.join(targetPath, 'package.json'));

    if (!fs.existsSync(targetPath) || !isGitRepo || !hasPackageJson) {
      if (fs.existsSync(targetPath)) {
        console.log(`⚠️  Thư mục cài đặt UI tồn tại ở ${targetPath} nhưng bị lỗi hoặc thiếu tệp (.git / package.json).`);
        console.log('   Đang dọn dẹp thư mục UI ẩn để tiến hành tải mới hoàn toàn...');
        try {
          fs.rmSync(targetPath, { recursive: true, force: true });
        } catch (rmErr) {
          console.warn('   Cảnh báo: Không thể xóa thư mục, sẽ thử tải đè:', rmErr.message);
        }
      }
      console.log(`[1/3] Cloning OpenClaw setup repository to: ${targetPath}...`);
      await runCmd('git', ['clone', 'https://github.com/tuanminhhole/openclaw-setup.git', targetPath]);
    } else {
      console.log(`[1/3] OpenClaw setup folder already exists at: ${targetPath}`);
      console.log('      Updating repository to latest version...');
      try {
        await runCmd('git', ['pull'], { cwd: targetPath });
      } catch (err) {
        console.warn('      Warning: Failed to git pull (continuing anyway):', err.message);
      }
    }

    console.log('\n[2/3] Installing dependencies...');
    await runCmd('npm', ['install'], { cwd: targetPath });

    console.log('\n[3/3] Starting OpenClaw Setup UI...');
    const originalCwd = process.cwd();
    const cliPath = path.join('dist', 'cli.js');
    await runCmd('node', [cliPath, ...args, `--project-dir=${originalCwd}`], { cwd: targetPath });

  } catch (error) {
    console.error('\n❌ Error during setup:', error.message);
    process.exit(1);
  }
}
