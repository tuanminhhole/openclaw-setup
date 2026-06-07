#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);

const { startLocalInstaller } = await import('./server/local-server.js');

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

