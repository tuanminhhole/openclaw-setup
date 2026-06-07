#!/usr/bin/env node
/**
 * build.mjs — OpenClaw Setup Build Script
 *
 * Synchronizes source files to dist/ and deploys cli.js.
 * Usage:
 *   node build.mjs          # one-shot build
 *   node build.mjs --watch  # watch mode (rebuild on change)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, watch } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir   = join(__dirname, '../../src');
const DIST_DIR = join(__dirname, '../../dist');

function build() {
  const start = Date.now();
  mkdirSync(DIST_DIR, { recursive: true });

  // Sync runtime modules used by CLI + local-server
  cpSync(join(srcDir, 'setup/data'), join(DIST_DIR, 'setup/data'), { recursive: true });
  cpSync(join(srcDir, 'setup/shared'), join(DIST_DIR, 'setup/shared'), { recursive: true });
  cpSync(join(srcDir, 'server'), join(DIST_DIR, 'server'), { recursive: true });
  cpSync(join(srcDir, 'web'), join(DIST_DIR, 'web'), { recursive: true });

  // Deploy cli/cli.src.js → dist/cli.js with corrected import paths
  const cliSrcPath = join(srcDir, 'cli', 'cli.src.js');
  const cliOutPath = join(DIST_DIR, 'cli.js');
  if (existsSync(cliSrcPath)) {
    let cliContent = readFileSync(cliSrcPath, 'utf8');
    cliContent = cliContent
      .replaceAll("'../setup/", "'./setup/")
      .replaceAll('"../setup/', '"./setup/')
      .replaceAll("'../server/", "'./server/")
      .replaceAll('"../server/', '"./server/');
    writeFileSync(cliOutPath, cliContent, 'utf8');
    const cliKb = (cliContent.length / 1024).toFixed(1);
    console.log(`[build] Deployed cli/cli.src.js -> dist/cli.js (${cliKb}KB)`);
  }

  const elapsed = Date.now() - start;
  console.log(`[build] ✅ dist/ CLI, local-server, and Web UI rebuilt (${elapsed}ms)`);
}

const isWatch = process.argv.includes('--watch');

if (isWatch) {
  console.log('[build] 👀 Watching src/ for changes...');
  build();
  try {
    watch(srcDir, { recursive: true }, (eventType, filename) => {
      if (filename) {
        if (filename.includes('node_modules') || filename.startsWith('.')) return;
        console.log(`[build] 🔄 ${filename} changed, rebuilding...`);
        try {
          build();
        } catch (e) {
          console.error('[build] Rebuild failed:', e.message);
        }
      }
    });
  } catch (err) {
    console.warn('[build] Recursive watch not supported on this platform. Falling back to single build:', err.message);
  }
} else {
  build();
}
