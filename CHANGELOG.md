# Changelog (English)


## [5.11.1] — 2026-07-15

### Added
- **Workspace defaults rebuilt on OpenClaw's canonical files.** New bots now get all 7 upstream OpenClaw default workspace files (`AGENTS` / `BOOTSTRAP` / `HEARTBEAT` / `IDENTITY` / `SOUL` / `TOOLS` / `USER.md`) as the base skeleton, with this project's extra rules (security, file-sending, relay aliases, DM reactions…) appended as clearly-marked add-on sections. Vietnamese + English, all bot variants (single/relay/zalo/telegram). Applies to newly created bots only.

### Fixed
- **SQLite "disk I/O error" on Docker Desktop (macOS / Windows).** The generated `docker-compose.yml` now stores `.openclaw/state` in a named volume (`openclaw-state`) instead of a bind mount — SQLite WAL locking doesn't survive virtiofs/gRPC-FUSE file sharing. Linux/VPS keeps the plain bind mount.
- **npm package catch-up.** The `5.11.0` tarball on npm was published before the final GitHub amend, so it missed the workspace defaults, the SQLite fix and the last Chrome-debug/file-editor fixes — `5.11.1` is the complete package.


## [5.11.0] — 2026-07-09

### Added
- **Facebook Messenger — 1-click plugin install.** The `fb-messenger` plugin is now public on ClawHub and installable straight from the dashboard: create a Messenger bot, open **Bot → Plugins**, and hit **Install** on the `openclaw-fb-messenger` card (webhook + Graph API, auto User→Page token, HMAC signature verify). The old "plugin is private — contact to receive" gate is gone.

### Changed
- **Docker-only.** Dropped the native (non-Docker) install path to concentrate on the Docker flow, which runs flawlessly and stably across Windows / macOS / Linux / VPS (with cross-OS Docker auto-install).

### Fixed
- **Chrome-debug button on headless VPS.** The browser-automation Chrome-debug relay now works on a headless VPS (bridge-IP-scoped, auto-opens ufw).
- **Bot file editor** now saves non-`.md` text files (and the workspace path displays correctly).


## [5.10.1] — 2026-07-04

### Fixed
- **Plugin update no longer drops the zalo-mod dashboard port.** Regenerating `docker-compose.yml` (on plugin update/rebuild) now re-publishes the zalo-mod UI port (gateway port + 1) — the old match failed on `127.0.0.1:`-prefixed port lines, so the port silently disappeared.
- **Granted disk/folder mounts survive a rebuild.** User-added `/mnt/*` mounts are carried over when the compose is regenerated, so bots keep access after an update. Mounting a whole Windows drive (e.g. `D:\`) now produces a valid bind (`D:/` instead of an invalid bare `D:`).


## [5.10.0] — 2026-07-02

### Added
- **Native process supervision (auto-restart):** native installs now register the gateway and 9router as OS services (macOS launchd, Linux systemd, Windows detached) that restart on crash/reboot — mirroring Docker's `restart: always`. Best-effort with fallback to a plain detached process.
- **Dashboard UI polish:** Bot/Setup hero shortcut buttons, plugin version badges, cleaner feature-toggle layout, responsive/mobile fixes, and removal of the duplicate page title on the dashboard tab.

### Fixed
- **9router first-install auto-sync:** the generated `sync.js` no longer permanently disables "Require login". It logs in with 9router's default password `123456`, creates the `smart-route` combo from active providers' models **once**, then stops (no perpetual loop, no forcing login off). Require login stays ON with the default password (users change it later). `/v1` model calls are unaffected (API-key auth, separate from dashboard login).
- **Native workspace path:** agent `workspace` is now a relative path, so persona/memory/skills resolve correctly on native installs (was a container-absolute path pointing nowhere on the host).
- **Config `meta` block:** no longer seeded by the generator (OpenClaw owns it) — prevents config parse failures from a version-range `lastTouchedVersion`.

## [5.9.0] — 2026-06-28

### 🚀 New: run straight from GitHub
- Launch the wizard with one command, no npm publish required (works on macOS, Linux & Windows; Node.js ≥ 22):
  ```bash
  npx github:tuanminhhole/openclaw-setup
  ```
  The CLI detects its bundled server (`dist/`) and runs the local dashboard directly.

### 🔧 Fixes
- **zalo-mod can reach the Zalo API again (Sync Account / group admin works).** The entrypoint now exposes zalouser's `globalThis.__zcaApiByProfile` map **before the gateway imports zalouser**, so `openclaw-zalo-mod` sees the live API. Previously zalo-mod patched the file only at plugin-load time — after zalouser was already imported — so the shared map was never set on the running module and the dashboard failed with "ZCA API unavailable".
- **Don't reinstall zalouser when it already exists (no more duplicate plugin).** Both the container entrypoint and the QR-login flow now treat an existing `extensions/zalouser` as installed, so they won't `npm install @openclaw/zalouser` on top of it. A duplicate zalouser (two copies/versions) breaks the shared ZCA API map that `zalo-mod` relies on (Sync Account → "ZCA API unavailable").
- **Telegram DM reactions target the latest message.** The generated TOOLS.md now tells Telegram bots to react WITHOUT passing `messageId` (Telegram auto-reacts to the user's current inbound message) instead of guessing an id and hitting an older message. Zalo (which needs an explicit message id) is unchanged.
- **Never clobber a customized `docker-compose.yml`.** The infra auto-sync used to fully regenerate the compose on a version bump, wiping any hand-added reverse-proxy/Traefik labels, external networks, or extra published ports (this could silently break a live webhook). It now detects a customized compose (Traefik labels / external network / a `# openclaw-setup: custom` marker) and leaves your infra untouched. The zalo-mod "Open" button targets the dashboard at `:18790/dashboard`.
- **Easy remote access for VPS/headless installs.** On a server with no browser, the CLI now prints a ready **SSH-tunnel command** (auto-filled with the server's public IP + the dashboard/OpenClaw/9Router/zalo-mod ports), and the dashboard shows a matching **"Open from another machine"** panel (one-click copy) — so any user can reach the web UIs from their own computer without knowing how to set up tunnels. The **"Open" buttons now follow the host you're viewing the dashboard from** (no more pointing at your local machine's localhost when browsing from elsewhere), and the **zalo-mod plugin card got its own "Open" button**.
- **Multi-account Zalo (zalouser) routing fixed.** Adding a 2nd+ Zalo bot now registers its own `channels.zalouser.accounts.<id>` entry and an account-specific binding (`match.accountId`) with its own login profile — so it no longer shows up under Telegram in the UI, and its QR login saves to its own profile instead of overwriting the first bot's. Legacy catch-all zalouser bindings are auto-upgraded to be account-specific.
- **Auto-detects the project with running bots.** On any machine/OS, a fresh run now finds the project whose bot is live in Docker (instead of defaulting to an empty `~/openclaw-setup`) — so `npx` on a server already running bots targets the right folder, and Restart/Update act on the real bot.
- **"Update" button no longer freezes the UI.** Clicking **Update** applies the new version and **auto-restarts the dashboard on the same port** — the browser tab reconnects on its own. It adapts to how you run it: service-managed installs (systemd) exit so the supervisor relaunches; `npx`/GitHub installs re-fetch the latest on relaunch; git clones `git pull` and reuse the committed `dist/`.
- **Version-aware Update button**: reads the latest from **GitHub** (the real distribution source, not the stale npm registry) and only shows when a strictly newer semver exists — no more "Update available" while already on the latest.
- **Removed the broken self-update path** that tried `npm install create-openclaw-bot@latest` (unpublished → `ETARGET`).

### 🔒 Security
- **Gateway & 9Router host ports now bind to `127.0.0.1`** instead of `0.0.0.0`. The control plane stays off the public internet; reverse proxies still reach containers over the Docker network. This also fixes the dashboard showing a false **OFFLINE** status when the bot runs behind a proxy.

### 🧠 New: TencentDB Agent Memory — one click in the UI
- **New memory plugin**: Install **TencentDB Agent Memory** straight from the Skills & Plugins panel. A 4-tier (L0–L3) layered-memory pipeline with context compression that keeps long sessions coherent and cuts token usage by up to ~61%. Runs fully local (SQLite + sqlite-vec) — no API key, works inside Docker.

### ⚡ New: Token-lean defaults for every new bot
- **Smarter context budget out of the box**: New bots now ship with `contextPruning: { mode: "cache-ttl", ttl: "5m" }` + `compaction: safeguard`. The stable system prompt stays cached while stale tool results are trimmed before the cache window expires — cheaper and sharper long conversations, with zero tuning.

### 🎯 Improved: Per-bot & per-channel Skills/Plugins
- **Per-bot skills**: Installing/enabling/disabling a skill now applies to **that bot only** (workspace-scoped) instead of leaking across every bot in the project.
- **Channel-aware panel**: The Skills & Plugins UI only shows what fits the bot's channel — Zalo helpers on Zalo, Facebook plugins on Messenger, and so on.

### 📤 Improved: Reliable file sending on Zalo & Telegram
- **Outbound file guide baked into AGENTS.md**: Generated bots now follow the correct ritual — export the file, copy it into `.openclaw/media/outbound/`, then send via the `message` tool — fixing "the file won't send" on Zalo's sandbox.
- **Format guard**: Bots are instructed to use modern formats (`.xlsx`, `.pdf`, `.png`) and avoid legacy `.xls`, which OpenClaw blocks because its content type can't be buffer-verified.

### 🐳 New: One-click Docker controls — no terminal needed
- **Restart & Rebuild buttons** in the Bot tab: restart the bot container, or rebuild + recreate it (`docker compose up -d --build --force-recreate`), straight from the dashboard — no command line.
- **Grant disk access button**: point the bot at any host folder/drive; it mounts into the container at `/mnt/<name>` (cross-OS, including Windows `C:/…` via long-form bind), the container auto-recreates to apply, and each bot's AGENTS.md is updated so the agent knows it may use the path. Project-scoped by default (all bots share it).

### ✨ Improved: Bot tab UX & faster page loads
- **Probe once, reuse everywhere**: The slow runtime/version detection and Docker-infra sync (multiple `docker exec` + `openclaw` CLI calls) now run **once** and are cached, instead of re-running on every Dashboard and Bot page load. First load warms the cache; subsequent loads are near-instant (bot status ~4s → ~3ms in local testing). The cache is automatically invalidated on update, rebuild, restart, and plugin/skill install so versions never go stale.
- Project switching now renders the new project's bots immediately (optimistic render) instead of waiting on background runtime-version probing.
- The channel tab strip keeps its scroll position after picking an off-screen channel (no more jumping back to the start).

### 🔧 Fixes
- **Correct plugin version display**: Plugin versions (e.g. `zalo-mod`) are read from the container's extensions volume, so the real version shows instead of a generic fallback.
- **Extensions now sync to host**: On macOS/Linux, `.openclaw/extensions` stays on the host bind-mount (Windows keeps the named volume for file permissions), so ClawHub-installed plugins are visible and editable on the host again.
- **`bot-meta.json` hygiene**: `appId` is written only for Facebook Messenger bots, no longer polluting Zalo/Telegram bots.
- **No more boot crash from `meta.lastTouchedVersion`**: Generated configs no longer seed an invalid `lastTouchedVersion` (an npm range / `latest`, not a real version) that could crash the container on first boot — OpenClaw stamps the correct `{ lastTouchedVersion, lastTouchedAt }` itself.
- **Longer agent-turn timeout**: Default `timeoutSeconds` raised from 120 → 900s so multi-step turns (OCR, file generation, long tool chains) aren't cut off prematurely.
- **Sturdier file sending & cleaner SOUL.md**: the AGENTS.md outbound-file rule now `mkdir -p`s `media/outbound` before copying (fixes intermittent "copy failed"); SOUL.md no longer hard-caps replies at 200 chars or carries the Zalo silent-mode block.


## [5.8.24] — 2026-06-24

### 🔧 Fixes: Auto-update Launcher Version

- **Fix: Cached Launcher Out-of-Sync**: Automatically detects if the running launcher (e.g. downloaded via `npx`) has a newer/different version than the cached installation inside `~/.openclaw-setup`, and automatically triggers an upgrade to match.


## [5.8.23] — 2026-06-24

### 🚀 New Features: Deep Integration of Autonomous Learning & Long-Term Memory (learning-memory) Skill

- **New: Long-Term Memory & Skill Auto-Evolution (learning-memory)**: Pre-integrates the autonomous memory and learning skill from ClawHub.
  - Automatically records newly learned facts, instructions, and user preferences into `MEMORY.md` in real-time.
  - Enables agents to self-package and compile newly acquired behaviors and workflows into reusable `.js` and `SKILL.md` files directly within the `./skills/` folder, allowing the bot to organically evolve its capabilities.
  - Implements OS-agnostic post-install triggers on all platforms (Docker, Windows, macOS, Linux) without requiring manual setup.
- **New: UI Skill Toggle**: Added the "Siêu Trí Nhớ Dài Hạn" (learning-memory) toggle option directly to the Setup Wizard interface with full installation logic support.

## [5.8.22] — 2026-06-16

- Improve browser-automation
- Improve installation for VPS

## [5.8.17] — 2026-06-08

### 🚀 Bug Fixes & Refinements: Docker Workspace Path Resolution, Clean NPM Installer, and UI Auto-Update

- **Fix: Docker Workspace Home Resolution**: Configured the `HOME` environment variable for the `ai-bot` container, aligning it with the project mount point to resolve path parsing issues (like `~`) for relative workspace paths on Windows/macOS.
- **New: Direct NPM Installer Execution**: Refactored the CLI launcher to run directly from the published npm package files instead of performing a full git clone, drastically reducing setup size and skipping git dependencies for end-users.
- **New: Automatic Setup Wizard Update**: Rewrote the updater to seamlessly install the package locally inside `~/.openclaw-setup` and automatically restart the Setup Wizard from the web UI when running via npm.
- **Aesthetic: Monospace CLI Logo Alignment**: Centered and balanced the rounded-border lobster logo displayed at startup.

## [5.8.15] — 2026-06-07

### 🚀 Bug Fixes & Refinements: Docker Workspace Path Resolution, Clean NPM Installer, and UI Auto-Update

- **Fix: Docker Workspace Home Resolution**: Configured the `HOME` environment variable for the `ai-bot` container, aligning it with the project mount point to resolve path parsing issues (like `~`) for relative workspace paths on Windows/macOS.
- **New: Direct NPM Installer Execution**: Refactored the CLI launcher to run directly from the published npm package files instead of performing a full git clone, drastically reducing setup size and skipping git dependencies for end-users.
- **New: Automatic Setup Wizard Update**: Rewrote the updater to seamlessly install the package locally inside `~/.openclaw-setup` and automatically restart the Setup Wizard from the web UI when running via npm.
- **Aesthetic: Monospace CLI Logo Alignment**: Centered and balanced the rounded-border lobster logo displayed at startup.

## [5.8.14] — 2026-06-07

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

## [5.8.13] — 2026-06-07

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

## [5.8.12] — 2026-06-07

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

## [5.8.11] — 2026-06-07

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

## [5.8.10] — 2026-06-07

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

## [5.8.9] — 2026-06-07

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

## [5.8.8] — 2026-06-04

### 🔧 Fixes: Safe 9Router Spawning and Crash Prevention under Sudo/NVM

- **Fix: Process crash on spawn error**: Added an error handler on the detached child processes (like 9Router and OpenClaw gateway) spawned by the installer. If a command is missing or not in the PATH, the setup wizard will report a warning in the logs instead of crashing the entire Node.js server with an unhandled 'error' exception.
- **Fix: Binary path resolution on NVM/Sudo environments**: Automatically searches for the binary files (like `9router` and `openclaw`) inside the active Node.js executable directory and local node_modules bin folders. This resolves the `ENOENT` issue when running with sudo in environments using NVM, where user path custom binary symlinks are not in the sudo secure path.

## [5.8.7] — 2026-06-04

### 🔧 Fixes: Linux/WSL Project Discovery under Sudo

- **Fix: Project scanning under sudo**: Automatically resolves the real invoking user's home directory (e.g., `/home/username`) instead of fallback `/root` when running the Setup Wizard with sudo on Linux/WSL.
- **Fix: Linux system directory blacklist & restricted walking**: Added Linux/WSL system and virtual folders (such as `/usr`, `/var`, `/proc`, `/sys`, `/dev`, etc.) to the walking blacklist, and restricted the `/home` directory walk strictly to the active user's real home directory to prevent hangs, timeouts, or permission exceptions.

## [5.8.6] — 2026-06-04

### 🔧 Fixes: Version Hanging & Windows C-Drive Scanning

- **Fix: Setup Version Hanging (v...)**: Refactored the NPM registry fetch in `/api/system` into a non-blocking background task. The Setup Wizard now starts instantly without blocking on network requests.
- **Fix: Safe C-Drive Scanning & Users Folder Discovery**: Optimized project discovery to skip scanning restricted Windows system folders and other users' directories (`C:\Users\*`). Directly adds the current user's homedir and Documents folders to the scanning roots, enabling instant project detection on the C: drive without permission hangs.

## [5.8.5] — 2026-06-04

### 🔧 Fixes: Version Hanging & Windows C-Drive Scanning

- **Fix: Setup Version Hanging (v...)**: Refactored the NPM registry fetch in `/api/system` into a non-blocking background task. The Setup Wizard now starts instantly without blocking on network requests.
- **Fix: Safe C-Drive Scanning & Users Folder Discovery**: Optimized project discovery to skip scanning restricted Windows system folders and other users' directories (`C:\Users\*`). Directly adds the current user's homedir and Documents folders to the scanning roots, enabling instant project detection on the C: drive without permission hangs.

## [5.8.4] — 2026-06-04

### 🚀 Advanced Skills, Dynamic Model Selection & Setup Wizard Auto-Restart

- **New: Infographic Image Generator Skill**: Generates high-quality infographics and posters with Vietnamese text support. Features a dynamic `image-generator.js` script that resolves API credentials and automatically prioritizes the best active model (Recraft v3, Flux, DALL-E 3, Grok, Minimax, Gemini, etc.) from 9router.
- **New: Free Web Search Skill**: Zero-token stealth search on Google, Bing, and DuckDuckGo for all AI agents without requiring external API keys.
- **New: Setup Wizard Auto-Restart & Reload**: Clicking the Update button now automatically pulls, rebuilds, and restarts the backend process, while the frontend UI polls and reloads in real-time to apply the new version.
- **Improve: Chrome Browser Automation**: Advanced CDP integration with Chrome Debug Mode for Cloudflare bypass, cookie inheritance, and automated library dependency checks.
- **Improve: Cron / Scheduled Tasks**: Hardened scheduling behavior with timezone support, isolated session control, and proper group chat targeting (requiring `g:` prefix for Zalo channels).
- **Improve: Setup UI/UX**: Enhanced visual feedback, terminal log stream handling, and layout stability.

## [5.8.3] — 2026-06-02

### 🔍 Full-Drive Project Discovery & Sidebar Version Fix

- **Full-Drive Scanning**: Project discovery now scans ALL available drive letters (A-Z) instead of only hardcoded D:\ and E:\. Projects on C:\ or any other drive are now properly detected.
- **System Directory Blacklist**: Added a blacklist of 17+ Windows system directories (Windows, Program Files, $Recycle.Bin, ProgramData, etc.) to prevent slow or permission-error scans when walking drive roots.
- **Dynamic Sidebar Version**: Fixed the sidebar version display which was stuck on a hardcoded fallback value. The version now updates dynamically after the system API responds, showing the real running version.

## [5.8.2] — 2026-05-31

### 🚀 Smart Repository Update & Restructured Test Suite

- **New: Header Update Button**: Added a dedicated, beautifully styled **Update** button on the Topbar Header, next to the language switcher.
- **New: Dynamic Version Detection**: The button automatically queries the public npm registry (`create-openclaw-bot/latest`) asynchronously and is only displayed when a newer setup wizard version is available.
- **New: Live Log-Streaming Upgrade Protocol**: Implemented `/api/setup/update` to support live upgrades: automatically pulls code and builds for local git clones (`git pull && npm install && npm run build`), and upgrades globally via npm for standard installations. The upgrade logs are dynamically streamed in real-time straight to the setup dashboard's terminal widget while auto-focusing the **Logs** tab.

## [5.8.1] — 2026-05-30

### 🚀 Deep Integration of Smart Search & Dynamic Browser Automation

- **New: Deep integration of Smart Search & Browser Automation (v1.1.7)**: Pre-integrates the next-generation stealth web search and browser automation plugin for all AI agents.
- **New: Zero-Token Web Search**: Enables AI agents to search Google, Bing, and DuckDuckGo completely for free and without rate limits, eliminating the need for expensive third-party search API keys (Tavily/Google Search).
- **New: Real-time Browser Automation (CDP Controller)**: Empowers AI agents to interact directly with web pages using Chrome DevTools Protocol (CDP), reusing the host's real Google Chrome instance to browse and retrieve deeply nested web contents.
- **New: Seamless Cloudflare & CAPTCHA Bypass**: Interacts directly with Chrome Debug Mode to inherit cookies, sessions, and authentic browser fingerprints, sliding past strict security firewalls undetected.
- **New: Self-Guided & Self-Healing Environment**: Automatically sets up virtual Xvfb displays in Docker environments; and dynamically diagnoses missing OS-level library dependencies on VPS/Ubuntu native host machines, returning copy-pasteable commands for immediate fixes.
- **Improve: Absolute Data Isolation & Safety**: Migrates the local installer UI codebase to a hidden home directory (`~/.openclaw-setup`), ensuring absolute isolation and zero risk of overwriting or deleting any of the user's existing bot projects or credentials.

## [5.8.0] — 2026-05-28

### 🚀 Next-Generation Process Management Web UI Setup

- **New: Modern Web UI Setup**: Migrated the installation and onboarding workflow from legacy static HTML files (`index.html`) to a local Web Application (SPA). Automatically launches and guides users through the setup steps.
- **New: Container & Process Controller**: Integrated interactive **Start / Stop / Recreate** buttons on the dashboard to control bot runtime container states without typing docker commands.
- **New: Live Logs Streamer**: Added real-time log streaming (stdout) from your running bot container/process directly to the setup dashboard.
- **New: Integrated File Editor**: Allows developers to view, edit, and save bot configurations and workspace markdown files (`openclaw.json`, `SOUL.md`, `AGENTS.md`, `TOOLS.md`) directly within the browser.
- **New: Native Zalo QR Login**: Exposed QR authorization images on the dashboard for quick Zalo Personal account logins.
- **Improve: Smart Port Allocation**: Automatically checks for unused ports and dynamically allocates `routerPort` to prevent network collisions in multi-bot setups.
- **Improve: Windows NTFS Permission Fix**: Implemented a named Docker volume (`openclaw-plugins`) for dependencies to resolve NTFS file locks (`EACCES`) on Windows host machines.
- **Cleanup**: Deprecated and deleted all old static wizard files (`index.html`, `style.css`) and legacy documentation files under `docs/`.

## [5.7.10] — 2026-05-06

### 🚀 Features & Documentation Updates

- **Browser Automation v2**: Replaced legacy browser documentation with the updated `BROWSER.md` covering the full suite of v2 Chrome CDP commands (`get_posts`, `screenshot_full`, `pdf`, etc.).
- **Agent Workspace Standardization**: Updated `AGENTS.md` generator to correctly reference all generated `.md` files (`BROWSER.md`, `BOOT.md`, `SOUL.md`, `DREAMS.md`, `HEARTBEAT.md`, `USER.md`).
- **Tools Guide Cleanup**: Removed obsolete Zalo Group Slash Commands section from `TOOLS.md` generation as it is no longer necessary.

## [5.7.9] — 2026-05-05

### 🔧 Chore: Rename Zalo Plugin Reference

- **Fix: Rename `zalo-mod` to `openclaw-zalo-mod`** — Updated internal string references in `workspace-gen.js`, `bot-config-gen.js`, and test suites to align with the new NPM package identity of the Zalo plugin (`openclaw-zalo-mod`).

## [5.7.8] — 2026-05-05

### 🧹 Cleanup: Remove Zalo Mod Auto-Install

- **Fix: Remove `zalo-mod` auto-inject from Zalo Personal config** — `plugins.entries['zalo-mod']` is no longer pre-populated by `bot-config-gen.js`, `output.js`, or `native-helpers-gen.js`. The plugin caused persistent installation loops and permission conflicts in Docker. Users should install `openclaw-zalo-mod` manually via ClawHub after setup.
- **Fix: Remove `zalo-mod` from Docker runtime install commands** — Removed `ensure_plugin zalo-mod openclaw-zalo-mod` from the generated Docker entrypoint `runtimeCommandParts`. The bundled OpenClaw version handles the channel natively.
- **Fix: Remove `openclaw-zalo-mod` from Docker build allPlugins list** — Prevents the plugin from being baked into the Docker image during `docker build`, which was redundant and caused conflicts.
- **Chore: Update smoke tests and test-matrix** — Updated assertions to verify `zalo-mod` is NOT auto-injected into generated configs and NOT present in Docker runtime install commands.
- **Chore: Sync ARCHITECTURE.md** — Documented that `zalo-mod` must be installed manually via ClawHub; `hasZaloMod` in workspace-gen only affects workspace docs, not config generation.
- **Chore: Add `.agent/workflows/update.md`** — Standardized release workflow document for this repo.

## [5.7.7] — 2026-05-03

### 🛠️ Infrastructure & Zalo Bot Stabilization

- **Version Strategy**: Automatically runs with `openclaw@latest` across all deployment scripts to ensure Zalo integration stability.
- **Docker Optimization**: Replaced full project bind-mounts with isolated `.openclaw` mounts to resolve I/O bottlenecks.
- **Gateway Deadlock Fix**: Implemented `tmpfs` for `plugin-runtime-deps` directly within the Compose environment block.
- **9Router Sync**: Automated dynamic synchronization of `smart-route` combos based on active provider models during gateway startup.
- **Zalo Config Compliance**: Unified the bot config generation pipeline to ensure Zalo channels strictly output compliant schemas.

## [5.7.6] — 2026-05-03

### Fix: Docker Bind-Mount State Directory

- **Fix: `OPENCLAW_STATE_DIR` now collocated with project bind-mount** — Changed `OPENCLAW_STATE_DIR` from `/var/lib/openclaw-state` (an isolated anonymous volume) to `/root/project/.openclaw`, matching the bind-mounted project directory. This ensures state (sessions, memory, plugins) persists across container restarts without a separate named volume.
- **Fix: CLI volume mount now binds the full project directory** — Changed `volumeMount` from `../../.openclaw:/root/project/.openclaw` to `../..:/root/project`, so the container sees the full host project tree (not just `.openclaw`). This resolves path mismatch errors where the bot could not locate config files adjacent to `.openclaw`.
- **Fix: Remove orphaned `openclaw-state` named volume** — Removed the `openclaw-state:/var/lib/openclaw-state` volume injection logic from `docker-gen.js`. The state directory is now handled entirely through the project bind-mount.
- **Chore: Update smoke tests** — Added assertions to verify the new bind-mount strategy (`../..:/root/project`, `OPENCLAW_STATE_DIR=/root/project/.openclaw`) and that the old `openclaw-state` named volume is absent from generated compose output.
- **Chore: Update `lastTouchedVersion` in docs** — `SETUP.md` and `SETUP.vi.md` example configs now show `"lastTouchedVersion": "latest"` instead of a pinned version string.

## [5.7.5] — 2026-05-03

### Hotfix: CLI Crash & Vietnamese Encoding Fix

- **Fix: `ReferenceError: channelKey is not defined` in `writeWorkspaceFiles()`** — Added `channelKey` as an explicit parameter (default `'telegram'`) and passed it from both call sites (single-bot and multi-bot relay). This crash affected every platform (Telegram, Zalo) during workspace file generation.
- **Fix: UTF-8 encoding integrity in `cli.src.js`** — Restored proper UTF-8 source encoding by using Python-safe I/O for all file modifications, preventing double-encoding of Vietnamese characters introduced by Windows PowerShell string operations.

## [5.7.4] — 2026-05-02

### Hotfix: CLI crash on all setups — `channelKey is not defined`

- **Fix: `ReferenceError: channelKey is not defined` in `writeWorkspaceFiles()`** — The function referenced the outer `channelKey` variable from `main()` but it was never declared in its own parameter list. Added `channelKey = 'telegram'` as a parameter with a safe default, and passed the value explicitly from both call sites (single-bot and multi-bot relay). This crash affected every platform (Telegram, Zalo) during workspace file generation.

## [5.7.3] — 2026-04-29

### Docker Gateway Stability & Zalo Login Flow

- **Fix: Gateway crash loop due to missing `gateway.mode`** — Docker entrypoint config injection now explicitly sets `gateway.mode` (defaults to `local`), preventing the `Gateway start blocked: existing config is missing gateway.mode` error that caused infinite restart loops on OpenClaw 2026.4.26+.
- **Fix: ClawHub zalouser plugin overriding bundled version** — The entrypoint was downloading `@openclaw/zalouser@2026.3.22` from ClawHub, which does not support `channels login`. Removed runtime plugin install from generated entrypoints; the bundled version in OpenClaw is now used directly.
- **Fix: Correct `openclaw-zalo-mod` npm package name** — Updated `output.js` and `native-helpers-gen.js` to use `openclaw-zalo-mod` for plugin installation commands, matching the actual npm registry package name.
- **Improve: Login flow stops gateway before Zalo QR** — Download scripts (Windows/macOS) now stop the gateway service before initiating the Zalo login, preventing WebSocket contention during channel authentication.

## [5.7.2] — 2026-04-28

### Zalo Plugin Name & Build Output Fixes

- **Fix: Zalo-mod plugin installation name** — Corrected the plugin installation command in the CLI to use `zalo-mod` instead of `openclaw-zalo-mod` to match the package name published on ClawHub, resolving the "plugin not found" startup warning.
- **Fix: Zalo-mod Docker installation** — Added `zalo-mod` to the `allPlugins` array during Docker generation when Zalo Personal channel is selected, ensuring the plugin is downloaded during the image build process.
- **Fix: Unbuilt Setup Wizard UI** — Re-ran the build script (`build.mjs`) to properly package recent fixes into `dist/setup.js`, resolving an issue where downloaded `.bat` and `.sh` files from the Web Wizard were missing the newly added Zalo QR Login instructions.

## [5.7.1] — 2026-04-28

### Zalo QR Login Standardization & Workspace Integration

- **Improve: Standardize Zalo QR login across all platforms** — All deployment targets (Docker, Windows, macOS, Linux, VPS) now use a unified file-based QR login flow: the QR image is saved to `/tmp/openclaw/openclaw-zalouser-qr-default.png` and users retrieve it manually (Docker Desktop Files tab, `docker cp`, `scp`, or local file browser). Replaced the old terminal-based QR scanning guidance with step-by-step instructions per platform.
- **Improve: Docker login uses `docker exec` instead of `docker compose exec`** — CLI post-install instructions and download scripts now use `docker exec -it <container>` and `docker cp` directly, which is more reliable across Docker Compose versions.
- **Improve: Wizard download scripts auto-trigger Zalo login** — Both Windows (PowerShell) and Unix (bash) download scripts generated by the Wizard now automatically wait for the container to start and trigger the Zalo login command, eliminating the need for manual post-install steps.
- **Improve: VPS setup injects Zalo login before gateway start** — VPS installation scripts now include the Zalo login flow (via `generateZaloLoginSh()`) before PM2 starts the gateway, ensuring session is established on first deploy.
- **Improve: Workspace docs inject zalo-mod context** — `TOOLS.md` and `SOUL.md` now include Zalo mod plugin documentation (slash commands `/rules`, `/noi-quy`, `/menu`, `/groupid`, `/report` and media handling behavior) when `hasZaloMod` is true.
- **Fix: Windows BAT path escaping** — Fixed backslash escaping issues in `win-bat.js` that caused broken paths for `PROJECT_DIR`, `OPENCLAW_HOME`, `DATA_DIR`, and PowerShell gateway start scripts.
- **Fix: Zalo login script on VPS/Linux** — `zalo-login-gen.js` now directly runs the login command and provides file-based QR retrieval instructions instead of asking user to run a separate terminal command.
- **Chore: Sync ARCHITECTURE.md** — Added `bot-config-gen.js` documentation, `test-matrix.mjs`, updated `npm test` command, documented `hasZaloMod` workspace parameter, and Zalo QR Login Protocol section.

## [5.7.0] — 2026-04-27

### Centralized Config Architecture & Test Matrix

- **Refactor: Centralized bot-config-gen.js** — Migrated all `openclaw.json`, `.env`, and `exec-approvals.json` generation logic into a single shared module (`src/setup/shared/bot-config-gen.js`). Both the Web Wizard (IIFE) and CLI (CJS) now consume the same builder, eliminating configuration drift between the two surfaces.
- **Refactor: Rolling `@latest` versioning** — All installation scripts (Windows BAT, macOS/Linux/VPS SH) and configuration generators now use `openclaw@latest` instead of pinned version strings (e.g., `openclaw@2026.4.14`). The `lastTouchedVersion` field uses the `OPENCLAW_NPM_SPEC` constant for dynamic resolution.
- **Fix: Remove `autoReply` from Zalo Personal** — The `autoReply: true` field that caused gateway startup crashes has been permanently removed from all generators (`config-gen.js`, `cli.src.js`, `bot-config-gen.js`).
- **Fix: Standardize Zalo Personal config** — The `zalouser` channel now generates production-matching configuration with `groups`, `groupPolicy: 'allowlist'`, `historyLimit: 50`, proper `bindings`, and `zalo-mod` plugin pre-registration.
- **Fix: Gateway token generation** — All environments (Wizard + CLI) now use `crypto.randomUUID()` for gateway auth tokens, replacing the previous dummy token in CLI.
- **New: Comprehensive test matrix** — Added `test-matrix.mjs` with 422 tests covering all OS × Deploy Mode × Channel × Bot Count combinations, plus exec-approvals, .env generation, Wizard IIFE sandbox evaluation, CLI structural validation, and cross-channel production config integrity checks.
- **Chore: Cleaned up legacy test files** — Removed the standalone `test-vps-install.mjs` E2E test, now superseded by the matrix test suite.

## [5.6.14] — 2026-04-25

### Zalo Plugin Integration Cleanup

- **Improve: Zalo plugin config consistency** — Plugin registration in `config-gen.js` and `output.js` continues to pre-populate `plugins.entries['zalo-mod']` for Zalo Personal channels, ensuring seamless integration without requiring post-install patching.

## [5.6.13] — 2026-04-22

### Stabilize VPS/Native PM2 Deployment

- **Fix: Native environment variable initialization** — The Native PM2 startup process was refactored to use a dedicated bash wrapper (`start-gateway.sh`) instead of fragile inline `sh -c` commands. This ensures that critical environment variables like `OPENCLAW_HOME` and `OPENCLAW_STATE_DIR` are reliably available when the gateway boots, resolving silent failures and file-system pathing mismatches across shell restarts.
- **Fix: 9Router start scripts injection flaws** — Cleaned up PM2 commands to consistently use explicit script and binary executable flags (`--interpreter`) in multi-bot architectures to mitigate POSIX shell-injection issues.
- **Improve: Remote dashboard access** — The Gateway custom binding interface has been extended to default to `0.0.0.0` when deployed in `VPS/Ubuntu` scenarios. Dashboard configuration and proxy interfaces can now correctly handle WAN/SSH-tunnel connectivity without exposing desktop-native instances to LAN by default.

## [5.6.12] — 2026-04-22

### Hotfix: PM2 gateway process missing OPENCLAW_HOME environment

- **Fix: PM2 env forwarding** — VPS/Ubuntu PM2 gateway processes were silently failing because `OPENCLAW_HOME` and `OPENCLAW_STATE_DIR` were not forwarded to the child process. All PM2 gateway start commands (`vps-sh.js`, `install-gen.js` restart script) now use `sh -c "export OPENCLAW_HOME=... && openclaw gateway run"` to ensure the environment is correctly inherited.

## [5.6.11] — 2026-04-21

### Hotfix: Fix CLI crash on single-bot Telegram setup

- **Fix: `loopBotToken is not defined`** — The single-bot Telegram setup path was missing the `loopBotToken` variable declaration, causing `ReferenceError` immediately after config generation. Added the missing variable alongside `loopBotName`, `loopBotDesc`, and `loopBotPersona`.

## [5.6.10] — 2026-04-21

### Hotfix: 9Router Smart-Route Runtime Stability

- **Fix: smart-route null crash** — Reverted 9Router provider API from `openai-responses` back to `openai-completions`. When `smart-route` routes through non-Codex providers (Gemini, Claude, etc.), the Responses format conversion produces null output items, causing `Cannot read properties of null (reading 'type')` crashes. The completions format is universally supported across all providers.
- **Fix: smart-route sync missing from restart scripts** — The `start-bot.bat` and `start-bot.sh` restart scripts were not launching the `9router-smart-route-sync.js` background process. This meant that any provider enabled in the 9Router dashboard after initial setup (e.g., Gemini) would never be added to the `smart-route` combo. The sync script is now launched alongside 9Router on every restart.

## [5.6.9] - 2026-04-21

### Fix: OpenAI Codex Provider Compatibility & Zalo Personal Config

- **Fix: OpenAI Codex model list** — Updated Codex provider model registry to match OpenAI's current API. Removed deprecated models (`gpt-5.3-codex-high`, `gpt-5.2-codex`, `gpt-5.1-codex-max`, `gpt-5.1-codex`, `gpt-5.1`, `gpt-5-codex`) and retained the 4 active models: `gpt-5.4`, `gpt-5.3-codex`, `gpt-5.2`, `gpt-5.4-mini`.
- **Fix: 9Router API mode** — Switched 9Router provider config from `openai-completions` to `openai-responses` to align with OpenAI's current Responses API.
- **New: 9Router auto-patch script** — Added `patch-9router.js` that automatically patches 9Router source files (providerModels, codex executor, self-test) to stay compatible with OpenAI Codex API changes. The patch runs on setup, upgrade, and before every 9Router launch.
- **Fix: Codex model exposure** — 9Router config now exposes individual Codex models (`cx/gpt-5.4`, `cx/gpt-5.3-codex`, `cx/gpt-5.2`, `cx/gpt-5.4-mini`) alongside `smart-route` so users can target specific Codex models directly.
- **Improve: Zalo Personal channel config** — Added `defaultAccount`, `groupAllowFrom`, `historyLimit`, `groups` wildcard config and `autoReply` to the generated Zalo Personal channel configuration for more robust group handling out of the box.

## [5.6.8] - 2026-04-17

### Fix: 9Router Sync & Ubuntu Native Config

- **Fix: DATA_DIR mismatch on native Linux/Mac** — `resolveNative9RouterDesktopLaunch()` now passes `DATA_DIR: getNative9RouterDataDir()` to the PM2 process, ensuring 9router stores its database in `~/.9router/` (Linux) / `%APPDATA%/9router` (Windows), exactly where the sync script writes.
- **Fix: sync script dbPath** — `writeNative9RouterSyncScript()` now uses `getNative9RouterDataDir()` instead of `getProject9RouterDataDir()`, eliminating the mismatch where sync wrote to `projectDir/.9router/db.json` while 9router read from `~/.9router/db.json`.
- **Fix: openclaw.json home dir** — On native deploy, the CLI now also writes `openclaw.json` and `auth-profiles.json` to `~/.openclaw/` (home directory), because the openclaw binary on Linux reads from there, not from the project directory.
- **Fix: ecosystem.config.js OPENCLAW_HOME** — Added `OPENCLAW_HOME` and `OPENCLAW_STATE_DIR` env vars to the PM2 ecosystem config so multi-bot native setups correctly locate the project config.
- **Fix: MODEL_PRIORITY provider map** — Synced the PM2 sync script's `MODEL_PRIORITY` with the full map from `native-helpers-gen.js`, adding all 20+ providers (`codex`, `github`, `cursor`, `claude-code`, `iflow`, `kiro`, `kilo`, `gemini-cli`, `ollama`, etc.) that were missing.

## [5.6.6] - 2026-04-17

- Fix: PM2 sync script crash (SIGKILL) khi khoi dong 9router tren Ubuntu/VPS. Boc trong try-catch, them --no-autorestart.

## [5.6.4] - 2026-04-16

- NPM registry sync and version bump hotfix.

## [5.6.3] - 2026-04-16

- Updated post-installation guide prompt to clarify Telegram group setup instructions (continued).

## [5.6.2] - 2026-04-16

- Updated post-installation guide prompt to clarify Telegram group setup instructions.

## [5.6.1] - 2026-04-16

- Hotfix: Resolved ReferenceError modelsPrimary is not defined during CLI template generation.

## [5.6.0] � 2026-04-16

- Enabled `memory` and `memory-core` dreaming by default, added `DREAMS.md`, and improved Telegram relay UX/docs.
- Refined relay behavior in `TOOLS.md` and `TEAMS.md`, including explicit reaction-first guidance.
- Fixed Vietnamese workspace document generation to keep UTF-8 output stable.

## [5.5.0] � 2026-04-15

- Unified workspace document generation across Wizard and CLI through shared scaffold builders.
- Standardized generated docs around `AGENTS.md`, `TOOLS.md`, `MEMORY.md`, `TEAMS.md`, and browser docs.
- Updated the bundled OpenClaw target to `2026.4.14` and removed legacy `.yaml` agent output.

## [5.4.2] � 2026-04-14

- Fixed duplicate relay plugin installation in generated native setup scripts.

## [5.4.1] � 2026-04-14

- Restored Docker browser runtime support and fixed Docker control UI CORS handling.
- Added generated uninstall scripts for Docker and native setups.

## [5.4.0] � 2026-04-14

- Removed the `telegram+zalo-personal` combo channel from Wizard and CLI.
- Simplified multi-bot handling around a single `isMultiBot` flow and cleaned config generation.
- Standardized relative agent/workspace paths and strengthened cross-workspace rules in `AGENTS.md`.

## [5.3.5] � 2026-04-12

- Fixed workspace doc generation issues around `MEMORY.md`.
- Wrote uninstall scripts directly into generated project folders.

## [5.3.4] � 2026-04-12

- Improved Windows native gateway startup stability and per-agent workspace naming.
- Expanded generated `TOOLS.md` / `AGENTS.md` coverage for Zalo and Telegram workspaces.

## [5.3.3] � 2026-04-11

- Added generated uninstall scripts to the Wizard download flow.

## [5.3.2] � 2026-04-11

- Stabilized native 9Router startup for desktop installs and pre-seeded project-local 9Router data.

## [5.3.1] � 2026-04-10

- Switched Zalo Personal direct-message policy to `open` by default.

## [5.3.0] � 2026-04-11

- Added the first Telegram + Zalo Personal combo-channel flow.
- Auto-enabled the Zalo Personal plugin and improved Docker cold-start behavior.

## [5.2.4] � 2026-04-10

- Improved upgrade speed by reusing Docker cache where possible.
- Added tooling to watch for upstream OpenClaw updates.

## [5.2.3] � 2026-04-10

- Fixed multi-bot wizard validation/state bugs.
- Improved blocked-button feedback and script encoding safety.

## [5.2.2] � 2026-04-10

- Fixed Docker gateway binding/CORS issues and reduced unnecessary Docker rebuilds.
- Corrected native PM2 path handling for project-local `.openclaw`.

## [5.2.1] � 2026-04-09

- Fixed native Ubuntu/VPS installation issues for PM2, 9Router, runtime packages, and project-local paths.
- Improved Zalo Personal login guidance and credential directory handling.

## [5.2.0] � 2026-04-09

- Added one-command upgrade flows through CLI, `upgrade.ps1`, and `upgrade.sh`.
- Preserved user data while refreshing OpenClaw and helper artifacts.

## [5.1.15] � 2026-04-08

- Brought Windows/native generation closer to Docker behavior.
- Fixed project-local runtime paths, provider sync, browser install flow, and related smoke coverage.

## [5.1.14] � 2026-04-08

- Pinned OpenClaw back to a stable release and fixed Windows Docker generation issues.
- Added Node.js version guidance for better compatibility.

## [5.1.13] � 2026-04-08

- Fixed macOS setup script generation, Docker startup flow, and native npm install behavior.
- Resolved Wizard state bugs affecting persona editing and step navigation.

## [5.1.12] � 2026-04-07

- Expanded the built-in skill catalog and improved relay plugin auto-selection in multi-bot mode.
- Updated Zalo Personal defaults and several Wizard validation gaps.

## [5.1.11] � 2026-04-07

- Updated Zalo Personal DM behavior and related onboarding defaults.

## [5.1.10] � 2026-04-07

- Added native auto-approve support for Zalo device/login flows on VPS.

## [5.1.9] � 2026-04-07

- Restored stricter schema handling and improved WebCrypto-related UX.

## [5.1.8] � 2026-04-07

- Fixed VPS dashboard connectivity and token login issues.

## [5.1.7] � 2026-04-07

- Fixed Control UI CORS handling and native 9Router path resolution.

## [5.1.6] � 2026-04-07

- Fixed PM2 `SIGKILL` failures during native VPS setup.

## [5.1.5] � 2026-04-06

- Fixed native PM2 startup for 9Router.

## [5.1.4] � 2026-04-06

- Fixed CLI BOM startup issues and improved Docker timeout patching.

## [5.1.3] � 2026-04-06

- Fixed Docker Compose variable interpolation leaks.

## [5.1.2] � 2026-04-06

- Hardened the sync script against shell-injection issues by switching to Base64 transport.

## [5.1.1] � 2026-04-06

- Stabilized 9Router smart-route sync through the provider API.
- Added Zalo pairing auto-approve and cleaner Docker CLI output.

## [5.1.0] � 2026-04-07

- Improved the Zalo Personal login flow and QR handling.

## [5.0.9] � 2026-04-06

- Introduced native install mode without requiring Docker.
- Added Gemma 4 updates, Telegram multi-bot deployment, and UI/setup refinements.

## [5.0.0] � 2026-04-04

- Added Gemma 4 support and documented hardware expectations.

## [4.1.4] � 2026-04-03

- General stability and usability improvements.

## [4.1.3] � 2026-04-02

- General stability and usability improvements.

## [4.1.2] � 2026-04-01

- Fixed issues in the v4.1 line.

## [4.1.0] � 2026-04-01

- Stabilized 9Router smart routing.

## [4.0.9] � 2026-04-01

- Added dynamic smart-route syncing and Docker auto-install flow.

## [4.0.8] � 2026-03-31

- Improved 9Router stability, Ollama cloud support, and cross-platform setup cleanup.

## [4.0.1] � 2026-03-31

- Improved automation around install directory creation and npm CLI flow.

## [4.0.0] � 2026-03-30

- Shipped the main v4 feature and setup refresh.

## [3.0.2] � 2026-03-29

- Expanded 9Router smart proxy support.

## [3.0.1] � 2026-03-29

- Delivered follow-up feature, bug-fix, UI, and technical updates for v3.

## [3.0.0] � 2026-03-28

- Introduced the v3 generation flow, UI refresh, documentation update, and technical cleanup.

## [2.0.0] � 2026-03-27

- Introduced the v2 setup experience with design, documentation, and security improvements.

## [1.0.0] � 2026-03-26

- Initial release.
