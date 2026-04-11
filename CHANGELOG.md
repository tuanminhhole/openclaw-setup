# Changelog (English)


## [5.3.3] — 2026-04-11

### 🧹 Automated Uninstall Scripts

- **Wizard UI Generation**: The HTML setup wizard now generates a matching `uninstall-openclaw-*.bat/sh` script when downloading the configuration for Native or Docker deployments.
- **Complete Cleanup**: The generated scripts cleanly kill 9Router/OpenClaw background processes, uninstall global npm packages, and safely remove the project and `.9router` data directories, allowing for a fresh start whenever needed.



## [5.3.2] — 2026-04-11

### 🐛 Windows Native — 9Router Launch Stability

- **Fix: Remove `-l` (stdin listen) flag from native 9Router launch** — `resolveNative9RouterDesktopLaunch()` previously passed `-l` which puts 9Router into interactive REPL mode. When spawned as a background process (no TTY), this caused the process to hang waiting for stdin input. Removed the flag; 9Router now starts reliably in the background on Windows, macOS desktop, and any non-VPS native flow.
- **Fix: Pre-seed `DATA_DIR/.9router/db.json` with `requireLogin: false` before 9Router starts** — If `db.json` does not exist when 9Router boots, it uses its own default path (`~/.9router`) and defaults `requireLogin` to `true`, causing the dashboard login wall. The CLI wizard now creates the `.9router` directory and writes a minimal `db.json` (with `requireLogin: false`) **before** spawning 9Router, matching the behavior of the fixed `setup-openclaw-win.bat` batch file.
- **No change to PM2/VPS flow** — The fix applies only to the desktop/background spawn path (`osChoice !== 'vps'`). VPS users still use the existing PM2-managed `startNative9RouterPm2` flow which is unaffected.

## [5.3.1] — 2026-04-10

### 🌟 Zalo Personal DM Policy

- **Open Zalo Inboxes**: The default `dmPolicy` for Zalo Personal deployments has been changed from `pairing` to `open`. This allows any user on the Zalo network to interact with the AI assistant immediately without requiring explicit device pairing approvals natively.


## [5.3.0] — 2026-04-11

### 🆕 Multi-Channel: Telegram + Zalo Personal Simultaneously

- **Combo channel option** — New `telegram+zalo-personal` option in both CLI wizard (`select`) and web wizard (channel card). Selecting it configures a single bot to receive messages from both Telegram and Zalo Personal at the same time.
- **Auto-inject `plugins.entries.zalouser`** — When any Zalo Personal channel is selected, `openclaw.json` now automatically includes `plugins.entries.zalouser: { enabled: true }`, fixing the root cause of the "not configured" error on Zalo startup.
- **Docker cold-start fix in Dockerfile CMD** — A background `(sleep 45 && node -e '...touch historyLimit...')` script is now baked into the generated `Dockerfile` CMD. Triggers chokidar → gateway hot-reload → `restartChannel('zalouser')` after Docker network warms up. No more manual `lastTouchedAt` workarounds.
- **Helper predicates** — Added `hasTelegram(ck)` and `hasZaloPersonal(ck)` functions replacing all literal `channelKey === 'telegram/zalo-personal'` comparisons throughout `cli.js` for cleaner extensibility.
- **Smoke tests updated** — `tests/smoke-cli-logic.mjs` updated to match the new predicate-based assertions (78 checks passing).

## [5.2.4] — 2026-04-10

### 🐛 Bug Fixes & Developer Tooling

- **Fix: `docker compose build --no-cache` during upgrade** — Removed the `--no-cache` flag from the upgrade flow. Without it, Docker correctly reuses cached layers (including Playwright/Chromium ~300MB) and only rebuilds the `openclaw` layer that changed, making upgrades significantly faster.
- **UX: Upgrade CLI banner now matches upgrade.ps1/sh style** — `runUpgrade()` in `cli.js` now renders the same ╭╮╰╯ box using visual-width calculation (`vw()`) instead of plain `===` separators.
- **New: GitHub Actions workflow to auto-detect openclaw updates** — `.github/workflows/check-openclaw-update.yml` runs daily, compares the pinned `OPENCLAW_NPM_SPEC` in `cli.js` with the latest version on npm, and automatically creates a GitHub Issue with upgrade instructions if a new version is available.

## [5.2.3] — 2026-04-10

### 🐛 Bug Fixes & Encoding Improvements

- **Fix: `ReferenceError: projectDir is not defined`** — Crash when clicking "Generate Configs" in multi-bot mode. `nativeProjectOpenClawRoot` in `buildTelegramPostInstallChecklist()` referenced an undefined `projectDir` variable and was dead code (unused in return value). Removed.
- **Fix: Step 3 "Next" button validation** — `state._activeBotTab` was a typo of `state.activeBotIndex`, causing multi-bot validation to always read the wrong tab index.
- **Fix: `saveFormData()` always saved bot tab name to `bots[0]`** — In multi-bot mode, the active bot name was always written to `bots[0]` regardless of which tab was active. Now correctly saves to `bots[state.activeBotIndex]`.
- **UX: Inline hint for disabled "Generate Configs" button** — When the button is blocked, a warning now appears showing exactly which fields are still missing (e.g. "Missing: GOOGLE_API_KEY").
- **Fix: Vietnamese diacritics in generated `.bat` and `.sh` scripts** — All Vietnamese echo/Write-Host strings in the generated Windows setup script and Linux/macOS bash script have been converted to ASCII (no diacritics) to prevent encoding errors on systems with non-UTF-8 codepages.

## [5.2.2] — 2026-04-10


### 🐛 Docker & Native PM2 Bug Fixes

- **Fix Docker crash loop (socat port conflict)**: `socat TCP-LISTEN:18791` was binding `0.0.0.0:18791` before `openclaw gateway run` started, causing `EADDRINUSE` on `127.0.0.1:18791`. Removed the broken gateway bridge from the generated Dockerfile CMD in both `cli.js` and `setup.js`.
- **Fix Docker dashboard not accessible from host**: Gateway `bind` was set to `'loopback'` — Docker port mapping cannot route to container loopback. Restored the v5.0.9 working pattern: `bind:'custom', customBindHost:'0.0.0.0'`.
- **Fix `delete c.gateway.customBindHost`**: A stray `delete` statement was erasing the `customBindHost` key right after setting it. Removed.
- **Fix Docker build re-downloading npm packages on every rebuild**: `ARG CACHEBUST=<epoch>` was cache-busting the `npm install -g openclaw` layer on every build (even config-only changes). Replaced with a version-stable `ARG OPENCLAW_VER` so Docker layer cache is reused between rebuilds.
- **Fix native PM2 double `.openclaw` nesting**: `ecosystem.config.js` was setting `OPENCLAW_HOME: projectDir/.openclaw`, causing OpenClaw to resolve workspace as `projectDir/.openclaw/.openclaw/workspace`. Removed `OPENCLAW_HOME` from PM2 env; OpenClaw discovers config via `cwd` (matching v5.0.9 behavior).

## [5.2.1] — 2026-04-09

### 🐛 Native Ubuntu/VPS Bug Fixes

- **Fix `Bot-9router errored` (PM2)**: `resolveNative9RouterDesktopLaunch` was trying to locate `9router/app/server.js` inside npm global dirs — a path that doesn't exist after standard `npm install -g 9router`. Now uses the `9router` CLI binary directly with proper args (`-n -l -H 0.0.0.0 -p 20128 --skip-update`), preventing the `↺ 15` restart loop.
- **Fix double `.openclaw` workspace path**: `workspace` and `agentDir` in generated `openclaw.json` were set as absolute paths (e.g. `/home/user/bot/.openclaw/workspace`). OpenClaw resolves these relative to `OPENCLAW_HOME`, causing a double-prefix (`/home/user/bot/.openclaw/.openclaw/workspace`). Changed to relative paths (`workspace`, `agents/<id>/agent`) matching Docker behavior.
- **Fix missing runtime packages on native install**: `grammy`, `@grammyjs/runner`, `@grammyjs/transformer-throttler`, `@buape/carbon`, `@larksuiteoapi/node-sdk`, `@slack/web-api` were installed in Docker (Dockerfile) but skipped on native. `installLatestOpenClaw` now installs all `OPENCLAW_RUNTIME_PACKAGES` after the main binary.
- **Fix `openclaw: command not found` after install**: Post-setup Zalo login instructions now include a `source ~/.bashrc && source ~/.profile` hint for new terminal sessions on Linux.
- **Fix Zalo session stored in wrong directory**: Manual login hint now includes `OPENCLAW_HOME` and `OPENCLAW_STATE_DIR` env vars so sessions are saved to `<projectDir>/.openclaw/credentials/zalouser/` — the same path the PM2 gateway reads from.
- **Fix relative project path**: `projectDir` input is now normalized with `path.resolve()` so typing `home/ubuntu/bot` (without leading `/`) correctly resolves to `/home/ubuntu/bot`.


## [5.2.0] — 2026-04-09

### One-Command Upgrade (No Wizard Required)

- Added `upgrade` subcommand to the CLI: `npx create-openclaw-bot@latest upgrade`. Detects Docker vs Native mode automatically and updates OpenClaw without re-running the setup wizard.
- Added `upgrade.ps1` for Windows users — double-click in the bot folder to trigger an upgrade. No terminal knowledge required.
- Added `upgrade.sh` for Linux / macOS / Ubuntu — run `bash upgrade.sh` locally or pipe via `curl` or `wget` directly from GitHub without cloning the repo.
- All user data is preserved during upgrade: `.env`, `.openclaw/memory/`, sessions, credentials, and 9Router OAuth tokens are never modified.
- Docker mode: patching `Dockerfile` (`OPENCLAW_NPM_SPEC` + `CACHEBUST` refresh) then `docker compose build --no-cache` + `docker compose up -d`.
- Native / PM2 mode: reinstalls `openclaw` + `9router` globals then runs `pm2 restart all`.


## [5.1.15] â€” 2026-04-08

### Native Setup Parity & Windows Wizard Fixes

- Fixed the Windows native HTML wizard so downloaded `.bat` files always regenerate from the latest UI state before download.
- Fixed Windows native runtime paths to stay project-local: `.env`, `.openclaw`, and `.9router` now resolve from the user-selected project directory instead of home/AppData fallbacks.
- Added `OPENCLAW_STATE_DIR` to native runtime environments so OpenClaw loads the generated config from the project runtime directory.
- Replaced legacy `gateway.bind: "0.0.0.0"` output with the current `bind: "custom"` plus `customBindHost: "0.0.0.0"` format.
- Fixed Windows native single-bot generation so selected provider, model, API key, and Telegram bot token are correctly synced into generated `.env` and `openclaw.json`.
- Fixed native Windows 9Router launch path resolution and updated the embedded smart-route sync helper to use the live `9Router` API provider list, matching Docker behavior.
- Added native Windows skill/runtime parity improvements: selected skills now install automatically, browser automation installs its required runtime packages, and skill config entries now use the correct slugs.
- Updated macOS, Linux Desktop, and Ubuntu/VPS native scripts to launch from the chosen `PROJECT_DIR` and export project-local `OPENCLAW_HOME`, `OPENCLAW_STATE_DIR`, and `DATA_DIR`.
- Expanded smoke coverage for the native runtime path, 9Router sync, provider/token sync, browser install, and Unix project-local startup flows.

## [5.1.14] â€” 2026-04-08

### OpenClaw stability and Docker fixes

- Pinned OpenClaw back to `openclaw@2026.4.5` because the update published on `April 8, 2026` is currently broken.
- Fixed Dockerfile generation for Windows Docker setups to avoid startup failures caused by bad command escaping and invalid `allowedOrigins`.
- Added guidance to use `Node.js 20` through `24`, and to avoid `Node.js 25` for now for better OpenClaw stability.

## [5.1.13] â€” 2026-04-08

### ðŸ› macOS Install Fixes & Wizard Stability

- **Fix macOS `mkdir: : No such file or directory`**: `generateSetupScript` was using `\${dir}` / `\${path}` (escaped), which created empty bash variables â€” now JS-interpolated so actual file paths are written correctly.
- **Fix macOS Docker script**: Added `docker info` daemon check before `docker compose up`; Docker mode now correctly calls `docker compose up` instead of `openclaw gateway run`.
- **Fix macOS Native npm prefix**: Removed `npm config set prefix` which breaks Homebrew-managed Node.js. Now uses `export npm_config_prefix` (per-session env var) + `sudo npm install -g` fallback.
- **Fix `window.__saveBotTabPersona is not a function`**: Added the missing `__saveBotTabPersona` function that HTML was calling but was never defined in `setup.js`.
- **Fix Step 3 Next button in 1-bot mode**: `bindFormEvents` now syncs `cfg-name` input directly to `state.config.botName` and `state.bots[0].name` on every keystroke, then calls `updateNavButtons()` â€” Next button reacts instantly without requiring navigation.
- **Fix persona per-bot isolation**: `saveBotTabMeta` and `syncBotTabMeta` now save/restore the `cfg-bot-tab-persona` field per-bot. Switching tabs correctly shows/hides each bot's persona; the value is persisted in `state.bots[i].persona` and used correctly in generated `.md` files.
- **Fix cli.js macOS global npm**: `ensureUserWritableGlobalNpm` skips `npm config set prefix` on darwin; `installGlobalPackage` adds `sudo npm install -g` as macOS fallback.

## [5.1.12] â€” 2026-04-07

### ðŸ§  Expanded Skills & Auto-Select Multi-Bot Relay Plugin

- **3-Column Skill Grid**: Skill cards now display 3 per row instead of 4 â€” wider cards, better readability.
- **7 New ClawHub Skills**: Added `Web Search`, `Notion`, `Slack` â€” covering the most common productivity workflows available on the OpenClaw dashboard.
- **Telegram Multi-Bot Relay Auto-Select**: When multiple Telegram bots are selected (botCount â‰¥ 2), the `telegram-multibot-relay` plugin is automatically checked and written to `openclaw.json â†’ plugins.entries`. Switching back to 1 bot deselects it.
- **Plugin Selections â†’ openclaw.json**: All plugins selected by the user (Voice Call, Matrix, MS Teams, Nostr...) are now injected into `plugins.entries` so the OpenClaw Dashboard receives the correct `enabled` state. Unselected = disabled.
- **Fix Step 3 "Next" disabled**: Removed mandatory `cfg-user-info` requirement (it's optional), fixed multi-bot validation to use `cfg-bot-tab-name`.
- **Fix Step 4 multi-bot token validation**: Now validates `key-bot-token-0` instead of `key-bot-token` in Telegram multi-bot mode.
- **Fix native multi-bot AGENTS.md missing security rules**: Security rules are now appended to each bot's AGENTS.md during native multi-bot deployment.

## [5.1.11] â€” 2026-04-07

### ðŸŒŸ Zalo Personal DM Policy

- **Open Zalo Inboxes**: The default `dmPolicy` for Zalo Personal deployments has been changed from `pairing` to `open`. This allows any user on the Zalo network to interact with the AI assistant immediately without requiring explicit device pairing approvals natively.

## [5.1.10] â€” 2026-04-07

### ðŸŒŸ Native UI Auto-Approve Bypasser

- **Native PM2 Auto-Approve Loop**: The strict `pairing required` security feature mandates that all users manually execute an approval command in their terminal for new web dashboard authentications. While Docker deployments already included an automated bypass, the Native setup did not. This release introduces a dedicated `auto-approve` PM2 background daemon that infinitely polls and accepts new device keys, delivering a frictionless, zero-touch login experience identical to Docker deployments.

## [5.1.9] â€” 2026-04-07

### ðŸŒŸ Strict Schema Fix & WebCrypto UX Improvement

- **Revert Unrecognized Config Key**: OpenClaw v2026.x.x enforces strict Zod schema validation. The previously injected `requireDeviceIdentity` flag caused an immediate startup crash (`Config invalid`). This version surgically removes the offending flag, ensuring the gateway boots successfully.
- **Dynamic SSH Tunnel Helper**: Since WebCrypto strictly demands a secure context (HTTPS/localhost), accessing the dashboard via raw VPS IP triggers a `1008` error natively. The CLI now dynamically generates and prints the exact `ssh -L 18791:localhost:18791 ...` Port Forwarding command right in the terminal, guaranteeing a flawless, secure login experience for remote server operators without needing SSL.

## [5.1.8] â€” 2026-04-07

### ðŸŒŸ Dashboard VPS Connectivity & Token Login Fix

- **Fix `requireDeviceIdentity` Error on VPS**: OpenClaw's WebCrypto E2E identity check inherently demands a secure browser context (HTTPS or localhost). For raw IPv4 VPS deployments, the `crypto.subtle` browser limitation causes WebSocket `code=1008` rejection upon token login. The setup tool now seamlessly injects `requireDeviceIdentity: false` into the `gateway.controlUi` configuration, granting you flawless remote login capabilities over standard HTTP networks.
- **Dynamic Terminal URLs**: The programmatic CLI will now intelligently scan and log your external, reachable IPv4 addresses in the console output alongside the local endpoints. This eliminates confusion and guarantees that the automatically generated tokenized dashboard links are ready for immediate copy-pasting.

## [5.1.7] â€” 2026-04-07

### ðŸŒŸ Fix Control UI CORS & Native 9Router Path Resolution

- **Fix Control UI CORS Rejections**: OpenClaw v2026.3.x strict CORS policies blocked remote dashboard access. The setup configuration and Docker patching scripts now automatically resolve all active IPv4 interfaces (`os.networkInterfaces()`) alongside localhost to pre-populate the `gateway.controlUi.allowedOrigins` array. This ensures the Web UI works flawlessly out-of-the-box on remote VPS instances.
- **Improved Native PM2 Path Resolution**: To prevent PM2 `$PATH` lookup failures with `nvm` on Linux, the script now bypasses the OS `9router` binary wrapper entirely. Instead, it computes the exact explicit path using `$(npm root -g)/9router/app/server.js` and executes it directly via the NodeJS interpreter.

## [5.1.6] â€” 2026-04-07

### ðŸž Fix PM2 SIGKILL on Native VPS Installs

- **Fix `PM2 SIGKILL` Error**: Removed the `-t` (interactive TTY) flag from all background `9router` launches. This terminal-dependent flag could cause PM2 to hang and aggressively SIGKILL the spawned process on headless VPS environments.
- **Robust PM2 Sync Helper**: Added a two-stage fallback for the 9Router smart-route sync script. If PM2 encounters `SIGKILL` or memory limits while spawning the sync helper, the setup gracefully falls back to a background `nohup node ... &` process instead of throwing a hard exception. If both fail, it logs a warning but allows the overall OpenClaw setup to finish successfully.

## [5.1.5] â€” 2026-04-06

### ðŸž Fix Native PM2 9Router Startup

- **Fix**: Replaced shell string execution (`execSync`) with strict array arguments (`execFileSync`) when starting 9Router and its background sync script via PM2 on native systems. This guarantees reliable process spawning across both Linux (VPS) and Windows environments without PM2 shell-parsing errors on quotes or path spaces.
- **Improved**: PM2 now explicitly runs the global `9router` binary via `--interpreter none` and the sync script via the current NodeJS runtime using `--interpreter process.execPath`.

## [5.1.4] â€” 2026-04-06

### ðŸž Fix CLI Startup BOM Error & Improve Docker Timeout Patch

- **Fix CLI BOM**: Removed the unexpected byte order mark (BOM) `\uFEFF` at the beginning of `cli.js` which could cause the shebang `#!/usr/bin/env node` to fail resolving or cause SyntaxErrors in certain environments
- **Improve Docker Timeout Patching**: The backend timeout override injection (`300s`) during Docker build now defensively scans all `.js` files in the `openclaw/dist` directory rather than trying to fuzzy-find a specific `gateway-cli-*` hash. This ensures the patch succeeds across different OpenClaw backend builds without noisy console warnings

## [5.1.3] â€” 2026-04-06

### ðŸœ Fix Docker Compose Variable Interpolation Leak

The previous base64 fix introduced a regression where the template literal `${Buffer.from(...)}` was mistakenly escaped in the composition script, causing the literal string to leak into `docker-compose.yml` instead of the actual base64 computed value.

- **Fix**: Precompute the base64 string completely in JavaScript (`const syncScriptBase64 = encodeBase64Utf8(syncScript)`) before injecting it into the compose template
- This guarantees the generated compose file receives the raw base64 string without any template interpolator conflicts
- Also cleans up testing logic validating these fixes

## [5.1.2] â€” 2026-04-06

### ðŸ› Fix Shell Injection: Sync Script Now Uses Base64 Encoding

The `node -e "...JSON.stringify(script)..."` approach caused `/bin/sh: Syntax error: "(" unexpected` because `JSON.stringify` produces a double-quoted string that breaks out of the surrounding `node -e "..."` shell argument.

- **Fix**: sync script content is now **base64-encoded at compose-generation time** using `Buffer.from(script).toString('base64')`
- The generated entrypoint becomes: `node -e "require('fs').writeFileSync('/tmp/sync.js',Buffer.from('<b64>','base64').toString())"`
- Base64 output contains only `[A-Za-z0-9+/=]` â€” zero shell quoting issues, works in YAML `|` blocks without escaping
- Applies to all compose generation paths: Docker web wizard (`setup.js` Ã— 2) and Docker CLI (`cli.js` Ã— 2)

## [5.1.1] â€” 2026-04-06

### ðŸ”§ 9Router Smart-Route Sync â€” Stable via API

Fixed a critical bug where the sync script could not detect active providers, causing all requests to fall back to `openai` (resulting in `404 No active credentials`).

- **Root cause**: sync script read `db.providerConnections` from `db.json`, but this field does not exist in 9Router v0.3.79+ â€” connections are only available via the REST API
- **Fix**: sync script now calls `fetch('http://localhost:20128/api/providers')` â†’ `d.connections[]` to detect active providers dynamically
- **Fix**: replaced fragile `cat << 'CLAWEOF'` heredoc injection (which caused `const p=undefined`) with `node -e require('fs').writeFileSync(...)` â€” zero quoting issues in YAML+shell
- **Fix**: `build9RouterSmartRouteSyncScript()` in CLI docker flow now correctly passes `'/root/.9router/db.json'` as the db path
- Applies to all three sync script locations: Docker web wizard (`setup.js`), Docker CLI (`cli.js`), and native (`cli.js`)

### ðŸ“± Zalo Pairing â€” Auto-Approve During Gateway Run

- Previously, auto-approve only ran during the initial login flow; new pairing requests while the gateway was already running were silently ignored
- **Fix**: `openclaw gateway run` for Zalo Personal now pipes stdout/stderr and auto-calls `openclaw pairing approve zalouser <code>` whenever a new pairing code is detected

### ðŸ§¹ Cleaner Docker CLI Output

- Removed redundant post-setup instructions (`docker compose build`, `openclaw gateway`, PM2 commands) that appeared after Docker auto-build; Docker mode is self-contained and needs no manual follow-up steps

## [5.1.0] â€” 2026-04-07

### ðŸ¤– Zalo Personal Login Improvements

- Zalo Personal now uses the direct `zalouser` login flow on both native and Docker.
- Setup prints the QR path plus exact login/copy commands, so users can get in fast without `openclaw onboard`.
- Docker QR login now targets the generated `ai-bot` compose service instead of brittle container names.

## [5.0.9] â€” 2026-04-06

### ðŸš€ Native Install Mode â€” No Docker Required

OpenClaw now supports **native (non-Docker) installation** on Windows, Linux, macOS, VPS, and shared hosting. Users who prefer not to use Docker can deploy the bot directly on their machine.

- **CLI native mode** â€” new deployment mode selector: `docker` (default) or `native`
- **OS-specific startup scripts** auto-generated:
  - ðŸªŸ **Windows** â†’ `setup-openclaw-win.bat` (double-click install)
  - ðŸ§ **Linux / macOS** â†’ `setup-openclaw-linux.sh`
  - ðŸ–¥ï¸ **VPS / Ubuntu** â†’ `setup-openclaw-vps.sh` (PM2 background process)
  - ðŸ  **Shared Hosting / cPanel** â†’ `setup-openclaw-hosting.sh` + `ecosystem.config.cjs`
- **Web Wizard updated** â€” Deploy Mode toggle (Docker / Native) with OS sub-selection cards
- **Dynamic host URLs** â€” Ollama and 9Router URLs switch automatically:
  - Docker mode: `http://ollama:11434` / `http://9router:20128/v1`
  - Native mode: `http://localhost:11434` / `http://localhost:20128/v1`
- **Node.js 18+ gate** â€” Native mode enforces minimum Node.js version at setup time
- **Test scripts** â€” `test-native-install.bat` (Windows) and `test-native-install.sh` (Linux/macOS)

### ðŸ¤– Gemma 4 Model Updates

- **4 Gemma 4 variants** available via Ollama: `gemma4:e2b` (~4-6 GB), `gemma4:e4b` (~8-10 GB), `gemma4:26b` (~18-24 GB), `gemma4:31b` (~24+ GB)
- Auto-pull selected Gemma 4 variant on first `docker compose up` (container timeout extended to 15 min)
- Raised Ollama timeout to **300 seconds** to handle large model inference
- Added `OLLAMA_NUM_PARALLEL=1` and `OLLAMA_KEEP_ALIVE=24h` to Docker sidecar

### ðŸ¤– Multi-Bot Deployment (up to 5 Telegram bots per workspace)

OpenClaw now supports deploying **multiple independent Telegram bots** from a single setupâ€”each with its own identity, slash command, AI personality, and isolated workspace directory.

- **Deploy 1â€“5 bots in one go** â€” Web Wizard and CLI both support multi-bot configuration
- **Isolated workspaces** â€” each bot gets its own `botN/` directory with a separate `.env` and `.openclaw/` config, preventing any token or configuration collision
- **Port auto-assignment** â€” ports start at `18791` and increment per bot (`18791`, `18792`, ...) to avoid host binding conflicts
- **Multi-service Docker Compose** â€” automatically generates a `docker-compose.yml` with one service per bot, plus a shared provider container (9Router or Ollama)
- **Department Room Model** â€” when bots share a Telegram group they operate like a professional team:
  - ðŸ¤« **Silent by default** â€” bots react with emoji (ðŸ‘ â¤ï¸) to casual messages but never spam replies
  - ðŸ“£ **@mention or /slash triggers** â€” only the addressed bot responds, like calling a colleague by name in a meeting room
  - ðŸ—ƒï¸ **Shared workspace** â€” all bots read from a common workspace folder and can collaborate on tasks, files, and reports
- **botGroup config** injected into each bot's `openclaw.json` so they are aware of each other's names and slash commands at runtime

### ðŸ”— Telegram Group ID Helper

Getting the Telegram Group ID is now frictionless:

- **Web Wizard**: "ÄÃ£ cÃ³ group" card now shows an inline `Láº¥y Group ID` button that opens **@userinfobot** directly, with step-by-step instructions (forward a group message â†’ bot replies with Chat ID)
- **CLI**: selecting "existing group" prints an interactive guide with numbered steps and a direct link to `https://t.me/userinfobot`

### ðŸŽ¨ UI Refinements

- **Group option selector** with **two interactive cards** with icon, description, hover glow, and animated selection checkmark
- Card active state: green tint + border for "create later", indigo tint + border for "existing group"
- Group ID input row includes inline helper button â€” no more hunting for documentation

## [5.0.0] â€” 2026-04-04

### ðŸš€ Gemma 4 Support â€” Google's Newest Open Model

OpenClaw v5.0.0 adds **support for Gemma 4**, Google DeepMind's brand-new open-weights model family released April 2, 2026.

- **Gemma 4 available in 3 sizes via Ollama** â€” `gemma4:4b` (~6 GB RAM), `gemma4` default (~10 GB), `gemma4:27b` (~18 GB)
- **Zero manual install** â€” When you select Local Ollama + a Gemma 4 model, the setup now **auto-generates an `ollama` sidecar service** in `docker-compose.yml`. Docker pulls the model automatically on first `docker compose up`. No separate Ollama installation needed.
- **OLLAMA_HOST auto-configured** â€” Points to the Docker sidecar (`http://ollama:11434`) instead of the host machine.
- **Full model list updated** â€” Added `gemma4`, `gemma4:27b`, `gemma4:4b` to the Ollama provider in both CLI and Web Wizard.

### ðŸ“‹ Hardware Requirements for Gemma 4

| Model              | Min RAM/VRAM (4-bit) | Recommended                   |
| ------------------ | -------------------- | ----------------------------- |
| `gemma4:4b`        | ~6 GB                | Laptop, Mac M1/M2             |
| `gemma4` (default) | ~10 GB               | PC 16 GB RAM                  |
| `gemma4:27b`       | ~18 GB               | Workstation 32 GB / GPU 24 GB |

> Gemma 4 is **free, open-weights, Apache 2.0**. No API key required â€” runs 100% locally via Docker.

## [4.1.4] â€” 2026-04-03

### âœ¨ Improvements

- CLI/Wizard parity: synchronized all skills (Browser Automation, Memory, RAG, Code Interpreter, etc.)
- Browser Automation: added Desktop (Host Chrome) vs Server (Headless Chromium) mode selection for Linux/Ubuntu
- Fixed Dockerfile WORKDIR issue causing build failures on Linux
- Skills now install at container **runtime** (not build-time) to avoid ClawHub auth issues
- Dynamic TOOLS.md: auto-generated listing all installed skills with hints
- Added `browser-tool.js` (Desktop mode) and `BROWSER.md` for both modes
- Skills registration in `openclaw.json â†’ skills.entries` at setup time
- Email SMTP config prompts and `.env` injection
- Single-source versioning via `bump-version.mjs` â€” one command to update all files

## [4.1.3] â€” 2026-04-02

### âœ¨ Improvements

- CLI/Wizard parity: synchronized all skills (Browser Automation, Memory, RAG, Code Interpreter, etc.)
- Browser Automation: added Desktop (Host Chrome) vs Server (Headless Chromium) mode selection
- Fixed Dockerfile WORKDIR issue on Linux builds
- Dynamic TOOLS.md: auto-generated based on selected skills
- Added browser-tool.js for Desktop mode, BROWSER.md for both modes
- Skills registration in `openclaw.json â†’ skills.entries` at setup time
- Email SMTP config prompts and env var injection

All notable changes to this project will be documented in this file.

## [4.1.2] â€” 2026-04-01

### Fixed

- **CLI setup**: Fixed `docker-compose.yml` generation syntax error for 9Router (`yaml: while scanning a simple key` issue) by using bash heredoc block scalars instead of single-line escaping for the `syncComboScript`.

## [4.1.0] â€” 2026-04-01

### ðŸš€ Stable 9Router Smart Routing

- **Clean Database Initialize**: 9Router default combos are now 100% clean (`smart-route` only). Removed legacy injection of GPT-4o/Claude/Gemini to favor pure dynamic routing.
- **Headless UI Toggling**: The setup wizard and CLI no longer display verbose model lists for 9Router; they now cleanly default to Auto Route (`smart-route`) and let the dynamic `PREF` algorithm handle failovers.

## [4.0.9] â€” 2026-04-01

### ðŸ”„ Dynamic Smart Route (Real-time Provider Sync)

- **Zero-Waste Routing**: The `smart-route` combo is no longer a static list of 100+ models. A background sync loop now queries 9Router's `/api/providers` every 30 seconds and dynamically builds the combo from **only connected + enabled providers**. This eliminates `404 No active credentials` errors entirely.
- **Instant Provider Toggle**: Toggle providers on/off in the 9Router Dashboard â€” the combo updates automatically within 30s. No restart required.
- **Smart Mapping**: Full provider-to-model mapping covering 25+ providers (Codex, Claude Code, GitHub Copilot, Cursor, Kilo, Cline, Gemini CLI, iFlow, Qwen, Kiro, Ollama, GLM, MiniMax, DeepSeek, xAI, Mistral, Groq, etc.).

### ðŸ³ Docker Auto-Install

- **Zero-Prerequisite Setup**: `npx create-openclaw-bot` now detects if Docker is installed. If missing, it offers to install automatically via `winget` (Windows), `brew` (macOS), or the official Docker install script (Linux).
- **Guided Recovery**: Clear instructions and download links if automatic installation fails.

## [4.0.8] â€” 2026-03-31

### âœ¨ 9Router Stability & Ollama Cloud

- **Stable 9Router Integration (Zero Config)**: The 9Router proxy is now fully stabilized and runs securely within the Docker network via `sk-no-key`. External configuration (API keys, manual routing) is removed from `.env` and elegantly managed via the [9Router Dashboard](http://localhost:20128/dashboard).
- **Expanded Model Connectivity**: Added comprehensive support for Ollama Cloud models (_Qwen 3.5, GLM-5, MiniMax, GPT-OSS_), Kiro Haiku, Qwen Flash, and extended iFlow free tiers.
- **Smart Routing Injection**: The configuration dynamically injects the `smart-route` combination to balance logic workload across Codex, Claude Code, Gemini, and iFlow.

### ðŸ§¹ Clean Workspace & Cross-Platform Auto-Setup

- **Zero-Clutter Generation**: Eliminated all redundant `.env.example` and static `docker-compose` sample templates. The `.bat` / CLI wizard now dynamically constructs the precise Docker environment necessary.
- **Cross-Platform Auto Browser**: Added a native macOS/Linux `start-chrome-debug.sh` boot script alongside the Windows `.bat`, providing instant 1-click Chrome Debug Mode initialization.
- **CLI Feature Parity**: `npx create-openclaw-bot` now prompts for User Identity and Bot Persona, matching the GUI Web UI capabilities exactly.

## [4.0.1] â€” 2026-03-31

### âœ¨ Automation (Auto-create install dir) & NPM CLI

- **One-Command Install (npx)**: The `create-openclaw-bot` CLI package is now published to NPM. Windows, Linux, and Mac users can simply run `npx create-openclaw-bot` to setup everything via an interactive terminal flow.
- **Auto Setup & Docker Start**: The deployment script (`.bat` / CLI) is completely overhauled. Once configured, Docker compose automatically builds and spins up the Bot instance seamlessly.
- **Improved UI Setup**: Cleaned up the Step 4 file previews. Revamped the Zalo Bot API channel UI card to use the official vector SVG (popping blue colors over the frosted glass background).
- **Safety First**: Removed Antigravity (AG) models from the 9router Proxy Models option to prevent permanent Google AI Ultra abuse bans. Added bright red warnings on the Setup GUI. Updated crediting for thesvg.org.

## [4.0.0] â€” 2026-03-30

### âœ¨ New Features & Updates

- **Full English Localization** â€” Completed all English translations for the Setup Wizard (Buttons, Labels, Step 4 Output).
- **Language Toggle Relocation** â€” Moved the language toggle (VI/EN) to a more visible and accessible location.
- **Setup UI/UX Fixes** â€” Improved the Setup Wizard UI for Browser Automation and resolved display issues (such as the undefined model badge).
- **Reference Error Fixes** â€” Fixed several Reference Errors during the setup execution.

## [3.0.2] â€” 2026-03-29

### âœ¨ 9Router Smart Proxy Expansion

- **9Router db.json Stability** â€” Updated the `db.json` injection logic for 9Router via entrypoint to prevent "No such file or directory, lstat db.json" errors.
- **Flagship Fallback Proxy** â€” Configured "Smart Proxy" with a rotating list of the most powerful flagship LLMs from Codex, Antigravity, Claude Code, and Github Copilot.
- **Setup Wizard Customization** â€” The wizard now displays a complete list of providers/models, setting the Smart Proxy as the preferred default to automatically resolve "404 No Active Credentials" errors.

## [3.0.1] â€” 2026-03-29

### âœ¨ New Features

- **Wizard UI Redesign (Step 2)** â€” Brought AI Provider/Model selection to the top, followed by Identity, Personality, Security Rules, and Extensions.
- **User Info Textarea** â€” Users can input information about themselves â†’ injected into `USER.md` for bot personalization.
- **Editable Security Rules** â€” Displays default security rules, users can edit them â†’ injected into `AGENTS.md`.
- **Section Dividers** â€” Added icon dividers between config groups (ðŸ¤– ðŸ” ðŸ§©).

### ðŸ› Bug Fixes

- **Skills Auto-enable** â€” Selecting a skill now automatically registers it in `openclaw.json` â†’ `skills.entries` (enabled: true). Previously, it only set up the Dockerfile without registering, making the bot ignore the skill.
- **Skills Env Injection** â€” Skills requiring API keys (Tavily, SMTPâ€¦) now automatically inject env vars into `skills.entries`.

### ðŸŽ¨ UI/UX

- Identity grid changed to 3 columns (Name, Role, Emoji) â€” removed Vibe (merged into System Prompt).
- Emoji input fix: assigned `form-input--emoji` class, matching the height of other inputs.
- System Prompt label changed to "Personality, Vibe & Response Rules".
- Responsive mobile: Name is full width, Role + Emoji are side-by-side.
- Security textarea is readonly by default, equipped with a "âœï¸ Edit" / "ðŸ”’ Lock" toggle button.

### ðŸ”§ Technical

- `state.config.userInfo` â€” new field, saved from the `cfg-user-info` textarea.
- `state.config.securityRules` â€” editable, defaults per language (vi/en).
- `DEFAULT_SECURITY_RULES` constant established with vi/en templates.
- `clawConfig.skills.entries` generated dynamically from selected skills.
- Language toggle now updates both the system prompt and security rules dynamically.

---

## [3.0.0] â€” 2026-03-28

### âœ¨ New Features

- **9Router Integration** â€” AI proxy, no API key required, multi-container Docker (`docker-compose.yml` 2 services).
- **Skills System (ClawHub)** â€” 8 agent capabilities: Web Search, Browser Automation, Memory, RAG, Image Gen, Bot Scheduler, Code Interpreter, Email Assistant.
- **Plugins System (npm)** â€” 4 runtime extensions: Voice Call, Matrix, MS Teams, Nostr.
- **Browser Automation** â€” Full Chrome Debug Mode support (socat proxy, agent-browser, Playwright engine).
- **Task Scheduler** â€” Windows Scheduled Task auto-starts Chrome Debug mode on logon (10s delay).
- **Skill-aware .env** â€” `.env` template automatically includes env vars for skills requiring API keys (Tavily, SMTP, Flux...).
- **Post-setup Management** â€” Added guide for adding/removing skills/plugins post-setup via `docker exec`.

### ðŸŽ¨ UI/UX

- Separated Skills (4-column grid) from Plugins â€” clearer interface layout.
- Skill cards now show notes (âš™ï¸) for skills that require extra setup.
- Added Browser Automation notice card in Step 4 featuring `.bat` + `.ps1` scripts.
- Management guide card (ðŸ”§) featuring `docker exec` commands.

### ðŸ“š Documentation

- `docs/browser-automation-guide.md` â€” Included Browser Automation usage guide for users.
- `docs/skills-plugins-guide.md` â€” Synthesized all skills/plugins + setup steps + list of required env vars.
- README.md / README.vi.md â€” Updated with 9Router, Skills/Plugins, and new FAQs.

### ðŸ”§ Technical

- `state.config.skills[]` + `state.config.plugins[]` are managed independently.
- `openclaw.json` dynamically injects `browser` config when Browser skill is selected.
- Dockerfile conditional logic: socat, agent-browser included only when necessary.
- docker-compose: added `extra_hosts` block for both 9Router and non-9Router setups.

---

## [2.0.0] â€” 2026-03-27

### âœ¨ New Features

- **Setup Wizard UI** â€” Interactive web wizard (`index.html`) to configure OpenClaw bots visually.
- **Multi-Channel Support** â€” Added support for Telegram, Zalo Bot API, and Zalo Personal channels.
- **Multi-Provider AI** â€” Support for Google Gemini, Anthropic Claude, OpenAI/Codex, OpenRouter, and Ollama (local).
- **Plugin System** â€” Modular plugin grid supporting Browser Automation, Scheduler, Memory, Web Search, RAG, and Image Gen.
- **Config Generation** â€” Automatically generates `openclaw.json`, `agent.yaml`, `Dockerfile`, and `docker-compose.yml`.
- **Language Toggle** â€” VI/EN toggle switch utilizing SVG flag icons.
- **Brand Logos** â€” Implemented high-quality SVG logos from [thesvg.org](https://thesvg.org) for all providers and channels.

### ðŸŽ¨ Design

- Dark-themed glassmorphism UI overlaid with animated multi-layer gradients.
- Provider cards designed with unique colored icon backgrounds (Gemini purple, Claude orange, OpenAI green, OpenRouter violet, Ollama cyan).
- Auto-expanding System Prompt textarea without internal scroll.
- Developed a shimmer animation on the title and glow effects on selected cards.

### ðŸ“š Documentation

- `README.md` / `README.vi.md` â€” Authored full bilingual docs, including a multi-provider comparison table.
- `SETUP.md` / `SETUP.vi.md` â€” Provided a technical setup guide specifically intended for AI agents.
- Security directive notice: Clarified that System Prompt determines personality only, while the framework enforces security rules.

### ðŸ”’ Security

- Enforced a No-credentials-in-UI policy â€” instructing users to create `.env` files locally.
- Dynamic credential instructions presented conditionally per provider and channel.
- OpenClaw framework automatically enforces default system security rules.

---

## [1.0.0] â€” 2026-03-26

### Initial Release

- Published basic OpenClaw setup guide.
- Configured Telegram-only support.
- Configured Google Gemini single provider support.
- Included manual configuration file setup instructions.


