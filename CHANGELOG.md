# Changelog (English)


## [5.1.14] — 2026-04-08

### OpenClaw stability and Docker fixes

- Pinned OpenClaw back to `openclaw@2026.4.5` because the update published on `April 8, 2026` is currently broken.
- Fixed Dockerfile generation for Windows Docker setups to avoid startup failures caused by bad command escaping and invalid `allowedOrigins`.
- Added guidance to use `Node.js 20` through `24`, and to avoid `Node.js 25` for now for better OpenClaw stability.

## [5.1.13] — 2026-04-08

### 🐛 macOS Install Fixes & Wizard Stability

- **Fix macOS `mkdir: : No such file or directory`**: `generateSetupScript` was using `\${dir}` / `\${path}` (escaped), which created empty bash variables — now JS-interpolated so actual file paths are written correctly.
- **Fix macOS Docker script**: Added `docker info` daemon check before `docker compose up`; Docker mode now correctly calls `docker compose up` instead of `openclaw gateway run`.
- **Fix macOS Native npm prefix**: Removed `npm config set prefix` which breaks Homebrew-managed Node.js. Now uses `export npm_config_prefix` (per-session env var) + `sudo npm install -g` fallback.
- **Fix `window.__saveBotTabPersona is not a function`**: Added the missing `__saveBotTabPersona` function that HTML was calling but was never defined in `setup.js`.
- **Fix Step 3 Next button in 1-bot mode**: `bindFormEvents` now syncs `cfg-name` input directly to `state.config.botName` and `state.bots[0].name` on every keystroke, then calls `updateNavButtons()` — Next button reacts instantly without requiring navigation.
- **Fix persona per-bot isolation**: `saveBotTabMeta` and `syncBotTabMeta` now save/restore the `cfg-bot-tab-persona` field per-bot. Switching tabs correctly shows/hides each bot's persona; the value is persisted in `state.bots[i].persona` and used correctly in generated `.md` files.
- **Fix cli.js macOS global npm**: `ensureUserWritableGlobalNpm` skips `npm config set prefix` on darwin; `installGlobalPackage` adds `sudo npm install -g` as macOS fallback.

## [5.1.12] — 2026-04-07

### 🧠 Expanded Skills & Auto-Select Multi-Bot Relay Plugin

- **3-Column Skill Grid**: Skill cards now display 3 per row instead of 4 — wider cards, better readability.
- **7 New ClawHub Skills**: Added `Web Search`, `Notion`, `Slack` — covering the most common productivity workflows available on the OpenClaw dashboard.
- **Telegram Multi-Bot Relay Auto-Select**: When multiple Telegram bots are selected (botCount ≥ 2), the `telegram-multibot-relay` plugin is automatically checked and written to `openclaw.json → plugins.entries`. Switching back to 1 bot deselects it.
- **Plugin Selections → openclaw.json**: All plugins selected by the user (Voice Call, Matrix, MS Teams, Nostr...) are now injected into `plugins.entries` so the OpenClaw Dashboard receives the correct `enabled` state. Unselected = disabled.
- **Fix Step 3 "Next" disabled**: Removed mandatory `cfg-user-info` requirement (it's optional), fixed multi-bot validation to use `cfg-bot-tab-name`.
- **Fix Step 4 multi-bot token validation**: Now validates `key-bot-token-0` instead of `key-bot-token` in Telegram multi-bot mode.
- **Fix native multi-bot AGENTS.md missing security rules**: Security rules are now appended to each bot's AGENTS.md during native multi-bot deployment.

## [5.1.11] — 2026-04-07

### 🌟 Zalo Personal DM Policy

- **Open Zalo Inboxes**: The default `dmPolicy` for Zalo Personal deployments has been changed from `pairing` to `open`. This allows any user on the Zalo network to interact with the AI assistant immediately without requiring explicit device pairing approvals natively.

## [5.1.10] — 2026-04-07

### 🌟 Native UI Auto-Approve Bypasser

- **Native PM2 Auto-Approve Loop**: The strict `pairing required` security feature mandates that all users manually execute an approval command in their terminal for new web dashboard authentications. While Docker deployments already included an automated bypass, the Native setup did not. This release introduces a dedicated `auto-approve` PM2 background daemon that infinitely polls and accepts new device keys, delivering a frictionless, zero-touch login experience identical to Docker deployments.

## [5.1.9] — 2026-04-07

### 🌟 Strict Schema Fix & WebCrypto UX Improvement

- **Revert Unrecognized Config Key**: OpenClaw v2026.x.x enforces strict Zod schema validation. The previously injected `requireDeviceIdentity` flag caused an immediate startup crash (`Config invalid`). This version surgically removes the offending flag, ensuring the gateway boots successfully.
- **Dynamic SSH Tunnel Helper**: Since WebCrypto strictly demands a secure context (HTTPS/localhost), accessing the dashboard via raw VPS IP triggers a `1008` error natively. The CLI now dynamically generates and prints the exact `ssh -L 18791:localhost:18791 ...` Port Forwarding command right in the terminal, guaranteeing a flawless, secure login experience for remote server operators without needing SSL.

## [5.1.8] — 2026-04-07

### 🌟 Dashboard VPS Connectivity & Token Login Fix

- **Fix `requireDeviceIdentity` Error on VPS**: OpenClaw's WebCrypto E2E identity check inherently demands a secure browser context (HTTPS or localhost). For raw IPv4 VPS deployments, the `crypto.subtle` browser limitation causes WebSocket `code=1008` rejection upon token login. The setup tool now seamlessly injects `requireDeviceIdentity: false` into the `gateway.controlUi` configuration, granting you flawless remote login capabilities over standard HTTP networks.
- **Dynamic Terminal URLs**: The programmatic CLI will now intelligently scan and log your external, reachable IPv4 addresses in the console output alongside the local endpoints. This eliminates confusion and guarantees that the automatically generated tokenized dashboard links are ready for immediate copy-pasting.

## [5.1.7] — 2026-04-07

### 🌟 Fix Control UI CORS & Native 9Router Path Resolution

- **Fix Control UI CORS Rejections**: OpenClaw v2026.3.x strict CORS policies blocked remote dashboard access. The setup configuration and Docker patching scripts now automatically resolve all active IPv4 interfaces (`os.networkInterfaces()`) alongside localhost to pre-populate the `gateway.controlUi.allowedOrigins` array. This ensures the Web UI works flawlessly out-of-the-box on remote VPS instances.
- **Improved Native PM2 Path Resolution**: To prevent PM2 `$PATH` lookup failures with `nvm` on Linux, the script now bypasses the OS `9router` binary wrapper entirely. Instead, it computes the exact explicit path using `$(npm root -g)/9router/app/server.js` and executes it directly via the NodeJS interpreter.

## [5.1.6] — 2026-04-07

### 🐞 Fix PM2 SIGKILL on Native VPS Installs

- **Fix `PM2 SIGKILL` Error**: Removed the `-t` (interactive TTY) flag from all background `9router` launches. This terminal-dependent flag could cause PM2 to hang and aggressively SIGKILL the spawned process on headless VPS environments.
- **Robust PM2 Sync Helper**: Added a two-stage fallback for the 9Router smart-route sync script. If PM2 encounters `SIGKILL` or memory limits while spawning the sync helper, the setup gracefully falls back to a background `nohup node ... &` process instead of throwing a hard exception. If both fail, it logs a warning but allows the overall OpenClaw setup to finish successfully.

## [5.1.5] — 2026-04-06

### 🐞 Fix Native PM2 9Router Startup

- **Fix**: Replaced shell string execution (`execSync`) with strict array arguments (`execFileSync`) when starting 9Router and its background sync script via PM2 on native systems. This guarantees reliable process spawning across both Linux (VPS) and Windows environments without PM2 shell-parsing errors on quotes or path spaces.
- **Improved**: PM2 now explicitly runs the global `9router` binary via `--interpreter none` and the sync script via the current NodeJS runtime using `--interpreter process.execPath`.

## [5.1.4] — 2026-04-06

### 🐞 Fix CLI Startup BOM Error & Improve Docker Timeout Patch

- **Fix CLI BOM**: Removed the unexpected byte order mark (BOM) `\uFEFF` at the beginning of `cli.js` which could cause the shebang `#!/usr/bin/env node` to fail resolving or cause SyntaxErrors in certain environments
- **Improve Docker Timeout Patching**: The backend timeout override injection (`300s`) during Docker build now defensively scans all `.js` files in the `openclaw/dist` directory rather than trying to fuzzy-find a specific `gateway-cli-*` hash. This ensures the patch succeeds across different OpenClaw backend builds without noisy console warnings

## [5.1.3] — 2026-04-06

### 🐜 Fix Docker Compose Variable Interpolation Leak

The previous base64 fix introduced a regression where the template literal `${Buffer.from(...)}` was mistakenly escaped in the composition script, causing the literal string to leak into `docker-compose.yml` instead of the actual base64 computed value.

- **Fix**: Precompute the base64 string completely in JavaScript (`const syncScriptBase64 = encodeBase64Utf8(syncScript)`) before injecting it into the compose template
- This guarantees the generated compose file receives the raw base64 string without any template interpolator conflicts
- Also cleans up testing logic validating these fixes

## [5.1.2] — 2026-04-06

### 🐛 Fix Shell Injection: Sync Script Now Uses Base64 Encoding

The `node -e "...JSON.stringify(script)..."` approach caused `/bin/sh: Syntax error: "(" unexpected` because `JSON.stringify` produces a double-quoted string that breaks out of the surrounding `node -e "..."` shell argument.

- **Fix**: sync script content is now **base64-encoded at compose-generation time** using `Buffer.from(script).toString('base64')`
- The generated entrypoint becomes: `node -e "require('fs').writeFileSync('/tmp/sync.js',Buffer.from('<b64>','base64').toString())"`
- Base64 output contains only `[A-Za-z0-9+/=]` — zero shell quoting issues, works in YAML `|` blocks without escaping
- Applies to all compose generation paths: Docker web wizard (`setup.js` × 2) and Docker CLI (`cli.js` × 2)

## [5.1.1] — 2026-04-06

### 🔧 9Router Smart-Route Sync — Stable via API

Fixed a critical bug where the sync script could not detect active providers, causing all requests to fall back to `openai` (resulting in `404 No active credentials`).

- **Root cause**: sync script read `db.providerConnections` from `db.json`, but this field does not exist in 9Router v0.3.79+ — connections are only available via the REST API
- **Fix**: sync script now calls `fetch('http://localhost:20128/api/providers')` → `d.connections[]` to detect active providers dynamically
- **Fix**: replaced fragile `cat << 'CLAWEOF'` heredoc injection (which caused `const p=undefined`) with `node -e require('fs').writeFileSync(...)` — zero quoting issues in YAML+shell
- **Fix**: `build9RouterSmartRouteSyncScript()` in CLI docker flow now correctly passes `'/root/.9router/db.json'` as the db path
- Applies to all three sync script locations: Docker web wizard (`setup.js`), Docker CLI (`cli.js`), and native (`cli.js`)

### 📱 Zalo Pairing — Auto-Approve During Gateway Run

- Previously, auto-approve only ran during the initial login flow; new pairing requests while the gateway was already running were silently ignored
- **Fix**: `openclaw gateway run` for Zalo Personal now pipes stdout/stderr and auto-calls `openclaw pairing approve zalouser <code>` whenever a new pairing code is detected

### 🧹 Cleaner Docker CLI Output

- Removed redundant post-setup instructions (`docker compose build`, `openclaw gateway`, PM2 commands) that appeared after Docker auto-build; Docker mode is self-contained and needs no manual follow-up steps

## [5.1.0] — 2026-04-07

### 🤖 Zalo Personal Login Improvements

- Zalo Personal now uses the direct `zalouser` login flow on both native and Docker.
- Setup prints the QR path plus exact login/copy commands, so users can get in fast without `openclaw onboard`.
- Docker QR login now targets the generated `ai-bot` compose service instead of brittle container names.

## [5.0.9] — 2026-04-06

### 🚀 Native Install Mode — No Docker Required

OpenClaw now supports **native (non-Docker) installation** on Windows, Linux, macOS, VPS, and shared hosting. Users who prefer not to use Docker can deploy the bot directly on their machine.

- **CLI native mode** — new deployment mode selector: `docker` (default) or `native`
- **OS-specific startup scripts** auto-generated:
  - 🪟 **Windows** → `setup-openclaw-win.bat` (double-click install)
  - 🐧 **Linux / macOS** → `setup-openclaw-linux.sh`
  - 🖥️ **VPS / Ubuntu** → `setup-openclaw-vps.sh` (PM2 background process)
  - 🏠 **Shared Hosting / cPanel** → `setup-openclaw-hosting.sh` + `ecosystem.config.cjs`
- **Web Wizard updated** — Deploy Mode toggle (Docker / Native) with OS sub-selection cards
- **Dynamic host URLs** — Ollama and 9Router URLs switch automatically:
  - Docker mode: `http://ollama:11434` / `http://9router:20128/v1`
  - Native mode: `http://localhost:11434` / `http://localhost:20128/v1`
- **Node.js 18+ gate** — Native mode enforces minimum Node.js version at setup time
- **Test scripts** — `test-native-install.bat` (Windows) and `test-native-install.sh` (Linux/macOS)

### 🤖 Gemma 4 Model Updates

- **4 Gemma 4 variants** available via Ollama: `gemma4:e2b` (~4-6 GB), `gemma4:e4b` (~8-10 GB), `gemma4:26b` (~18-24 GB), `gemma4:31b` (~24+ GB)
- Auto-pull selected Gemma 4 variant on first `docker compose up` (container timeout extended to 15 min)
- Raised Ollama timeout to **300 seconds** to handle large model inference
- Added `OLLAMA_NUM_PARALLEL=1` and `OLLAMA_KEEP_ALIVE=24h` to Docker sidecar

### 🤖 Multi-Bot Deployment (up to 5 Telegram bots per workspace)

OpenClaw now supports deploying **multiple independent Telegram bots** from a single setup—each with its own identity, slash command, AI personality, and isolated workspace directory.

- **Deploy 1–5 bots in one go** — Web Wizard and CLI both support multi-bot configuration
- **Isolated workspaces** — each bot gets its own `botN/` directory with a separate `.env` and `.openclaw/` config, preventing any token or configuration collision
- **Port auto-assignment** — ports start at `18791` and increment per bot (`18791`, `18792`, ...) to avoid host binding conflicts
- **Multi-service Docker Compose** — automatically generates a `docker-compose.yml` with one service per bot, plus a shared provider container (9Router or Ollama)
- **Department Room Model** — when bots share a Telegram group they operate like a professional team:
  - 🤫 **Silent by default** — bots react with emoji (👍 ❤️) to casual messages but never spam replies
  - 📣 **@mention or /slash triggers** — only the addressed bot responds, like calling a colleague by name in a meeting room
  - 🗃️ **Shared workspace** — all bots read from a common workspace folder and can collaborate on tasks, files, and reports
- **botGroup config** injected into each bot's `openclaw.json` so they are aware of each other's names and slash commands at runtime

### 🔗 Telegram Group ID Helper

Getting the Telegram Group ID is now frictionless:

- **Web Wizard**: "Đã có group" card now shows an inline `Lấy Group ID` button that opens **@userinfobot** directly, with step-by-step instructions (forward a group message → bot replies with Chat ID)
- **CLI**: selecting "existing group" prints an interactive guide with numbered steps and a direct link to `https://t.me/userinfobot`

### 🎨 UI Refinements

- **Group option selector** with **two interactive cards** with icon, description, hover glow, and animated selection checkmark
- Card active state: green tint + border for "create later", indigo tint + border for "existing group"
- Group ID input row includes inline helper button — no more hunting for documentation

## [5.0.0] — 2026-04-04

### 🚀 Gemma 4 Support — Google's Newest Open Model

OpenClaw v5.0.0 adds **support for Gemma 4**, Google DeepMind's brand-new open-weights model family released April 2, 2026.

- **Gemma 4 available in 3 sizes via Ollama** — `gemma4:4b` (~6 GB RAM), `gemma4` default (~10 GB), `gemma4:27b` (~18 GB)
- **Zero manual install** — When you select Local Ollama + a Gemma 4 model, the setup now **auto-generates an `ollama` sidecar service** in `docker-compose.yml`. Docker pulls the model automatically on first `docker compose up`. No separate Ollama installation needed.
- **OLLAMA_HOST auto-configured** — Points to the Docker sidecar (`http://ollama:11434`) instead of the host machine.
- **Full model list updated** — Added `gemma4`, `gemma4:27b`, `gemma4:4b` to the Ollama provider in both CLI and Web Wizard.

### 📋 Hardware Requirements for Gemma 4

| Model              | Min RAM/VRAM (4-bit) | Recommended                   |
| ------------------ | -------------------- | ----------------------------- |
| `gemma4:4b`        | ~6 GB                | Laptop, Mac M1/M2             |
| `gemma4` (default) | ~10 GB               | PC 16 GB RAM                  |
| `gemma4:27b`       | ~18 GB               | Workstation 32 GB / GPU 24 GB |

> Gemma 4 is **free, open-weights, Apache 2.0**. No API key required — runs 100% locally via Docker.

## [4.1.4] — 2026-04-03

### ✨ Improvements

- CLI/Wizard parity: synchronized all skills (Browser Automation, Memory, RAG, Code Interpreter, etc.)
- Browser Automation: added Desktop (Host Chrome) vs Server (Headless Chromium) mode selection for Linux/Ubuntu
- Fixed Dockerfile WORKDIR issue causing build failures on Linux
- Skills now install at container **runtime** (not build-time) to avoid ClawHub auth issues
- Dynamic TOOLS.md: auto-generated listing all installed skills with hints
- Added `browser-tool.js` (Desktop mode) and `BROWSER.md` for both modes
- Skills registration in `openclaw.json → skills.entries` at setup time
- Email SMTP config prompts and `.env` injection
- Single-source versioning via `bump-version.mjs` — one command to update all files

## [4.1.3] — 2026-04-02

### ✨ Improvements

- CLI/Wizard parity: synchronized all skills (Browser Automation, Memory, RAG, Code Interpreter, etc.)
- Browser Automation: added Desktop (Host Chrome) vs Server (Headless Chromium) mode selection
- Fixed Dockerfile WORKDIR issue on Linux builds
- Dynamic TOOLS.md: auto-generated based on selected skills
- Added browser-tool.js for Desktop mode, BROWSER.md for both modes
- Skills registration in `openclaw.json → skills.entries` at setup time
- Email SMTP config prompts and env var injection

All notable changes to this project will be documented in this file.

## [4.1.2] — 2026-04-01

### Fixed

- **CLI setup**: Fixed `docker-compose.yml` generation syntax error for 9Router (`yaml: while scanning a simple key` issue) by using bash heredoc block scalars instead of single-line escaping for the `syncComboScript`.

## [4.1.0] — 2026-04-01

### 🚀 Stable 9Router Smart Routing

- **Clean Database Initialize**: 9Router default combos are now 100% clean (`smart-route` only). Removed legacy injection of GPT-4o/Claude/Gemini to favor pure dynamic routing.
- **Headless UI Toggling**: The setup wizard and CLI no longer display verbose model lists for 9Router; they now cleanly default to Auto Route (`smart-route`) and let the dynamic `PREF` algorithm handle failovers.

## [4.0.9] — 2026-04-01

### 🔄 Dynamic Smart Route (Real-time Provider Sync)

- **Zero-Waste Routing**: The `smart-route` combo is no longer a static list of 100+ models. A background sync loop now queries 9Router's `/api/providers` every 30 seconds and dynamically builds the combo from **only connected + enabled providers**. This eliminates `404 No active credentials` errors entirely.
- **Instant Provider Toggle**: Toggle providers on/off in the 9Router Dashboard — the combo updates automatically within 30s. No restart required.
- **Smart Mapping**: Full provider-to-model mapping covering 25+ providers (Codex, Claude Code, GitHub Copilot, Cursor, Kilo, Cline, Gemini CLI, iFlow, Qwen, Kiro, Ollama, GLM, MiniMax, DeepSeek, xAI, Mistral, Groq, etc.).

### 🐳 Docker Auto-Install

- **Zero-Prerequisite Setup**: `npx create-openclaw-bot` now detects if Docker is installed. If missing, it offers to install automatically via `winget` (Windows), `brew` (macOS), or the official Docker install script (Linux).
- **Guided Recovery**: Clear instructions and download links if automatic installation fails.

## [4.0.8] — 2026-03-31

### ✨ 9Router Stability & Ollama Cloud

- **Stable 9Router Integration (Zero Config)**: The 9Router proxy is now fully stabilized and runs securely within the Docker network via `sk-no-key`. External configuration (API keys, manual routing) is removed from `.env` and elegantly managed via the [9Router Dashboard](http://localhost:20128/dashboard).
- **Expanded Model Connectivity**: Added comprehensive support for Ollama Cloud models (_Qwen 3.5, GLM-5, MiniMax, GPT-OSS_), Kiro Haiku, Qwen Flash, and extended iFlow free tiers.
- **Smart Routing Injection**: The configuration dynamically injects the `smart-route` combination to balance logic workload across Codex, Claude Code, Gemini, and iFlow.

### 🧹 Clean Workspace & Cross-Platform Auto-Setup

- **Zero-Clutter Generation**: Eliminated all redundant `.env.example` and static `docker-compose` sample templates. The `.bat` / CLI wizard now dynamically constructs the precise Docker environment necessary.
- **Cross-Platform Auto Browser**: Added a native macOS/Linux `start-chrome-debug.sh` boot script alongside the Windows `.bat`, providing instant 1-click Chrome Debug Mode initialization.
- **CLI Feature Parity**: `npx create-openclaw-bot` now prompts for User Identity and Bot Persona, matching the GUI Web UI capabilities exactly.

## [4.0.1] — 2026-03-31

### ✨ Automation (Auto-create install dir) & NPM CLI

- **One-Command Install (npx)**: The `create-openclaw-bot` CLI package is now published to NPM. Windows, Linux, and Mac users can simply run `npx create-openclaw-bot` to setup everything via an interactive terminal flow.
- **Auto Setup & Docker Start**: The deployment script (`.bat` / CLI) is completely overhauled. Once configured, Docker compose automatically builds and spins up the Bot instance seamlessly.
- **Improved UI Setup**: Cleaned up the Step 4 file previews. Revamped the Zalo Bot API channel UI card to use the official vector SVG (popping blue colors over the frosted glass background).
- **Safety First**: Removed Antigravity (AG) models from the 9router Proxy Models option to prevent permanent Google AI Ultra abuse bans. Added bright red warnings on the Setup GUI. Updated crediting for thesvg.org.

## [4.0.0] — 2026-03-30

### ✨ New Features & Updates

- **Full English Localization** — Completed all English translations for the Setup Wizard (Buttons, Labels, Step 4 Output).
- **Language Toggle Relocation** — Moved the language toggle (VI/EN) to a more visible and accessible location.
- **Setup UI/UX Fixes** — Improved the Setup Wizard UI for Browser Automation and resolved display issues (such as the undefined model badge).
- **Reference Error Fixes** — Fixed several Reference Errors during the setup execution.

## [3.0.2] — 2026-03-29

### ✨ 9Router Smart Proxy Expansion

- **9Router db.json Stability** — Updated the `db.json` injection logic for 9Router via entrypoint to prevent "No such file or directory, lstat db.json" errors.
- **Flagship Fallback Proxy** — Configured "Smart Proxy" with a rotating list of the most powerful flagship LLMs from Codex, Antigravity, Claude Code, and Github Copilot.
- **Setup Wizard Customization** — The wizard now displays a complete list of providers/models, setting the Smart Proxy as the preferred default to automatically resolve "404 No Active Credentials" errors.

## [3.0.1] — 2026-03-29

### ✨ New Features

- **Wizard UI Redesign (Step 2)** — Brought AI Provider/Model selection to the top, followed by Identity, Personality, Security Rules, and Extensions.
- **User Info Textarea** — Users can input information about themselves → injected into `USER.md` for bot personalization.
- **Editable Security Rules** — Displays default security rules, users can edit them → injected into `AGENTS.md`.
- **Section Dividers** — Added icon dividers between config groups (🤖 🔐 🧩).

### 🐛 Bug Fixes

- **Skills Auto-enable** — Selecting a skill now automatically registers it in `openclaw.json` → `skills.entries` (enabled: true). Previously, it only set up the Dockerfile without registering, making the bot ignore the skill.
- **Skills Env Injection** — Skills requiring API keys (Tavily, SMTP…) now automatically inject env vars into `skills.entries`.

### 🎨 UI/UX

- Identity grid changed to 3 columns (Name, Role, Emoji) — removed Vibe (merged into System Prompt).
- Emoji input fix: assigned `form-input--emoji` class, matching the height of other inputs.
- System Prompt label changed to "Personality, Vibe & Response Rules".
- Responsive mobile: Name is full width, Role + Emoji are side-by-side.
- Security textarea is readonly by default, equipped with a "✏️ Edit" / "🔒 Lock" toggle button.

### 🔧 Technical

- `state.config.userInfo` — new field, saved from the `cfg-user-info` textarea.
- `state.config.securityRules` — editable, defaults per language (vi/en).
- `DEFAULT_SECURITY_RULES` constant established with vi/en templates.
- `clawConfig.skills.entries` generated dynamically from selected skills.
- Language toggle now updates both the system prompt and security rules dynamically.

---

## [3.0.0] — 2026-03-28

### ✨ New Features

- **9Router Integration** — AI proxy, no API key required, multi-container Docker (`docker-compose.yml` 2 services).
- **Skills System (ClawHub)** — 8 agent capabilities: Web Search, Browser Automation, Memory, RAG, Image Gen, Bot Scheduler, Code Interpreter, Email Assistant.
- **Plugins System (npm)** — 4 runtime extensions: Voice Call, Matrix, MS Teams, Nostr.
- **Browser Automation** — Full Chrome Debug Mode support (socat proxy, agent-browser, Playwright engine).
- **Task Scheduler** — Windows Scheduled Task auto-starts Chrome Debug mode on logon (10s delay).
- **Skill-aware .env** — `.env` template automatically includes env vars for skills requiring API keys (Tavily, SMTP, Flux...).
- **Post-setup Management** — Added guide for adding/removing skills/plugins post-setup via `docker exec`.

### 🎨 UI/UX

- Separated Skills (4-column grid) from Plugins — clearer interface layout.
- Skill cards now show notes (⚙️) for skills that require extra setup.
- Added Browser Automation notice card in Step 4 featuring `.bat` + `.ps1` scripts.
- Management guide card (🔧) featuring `docker exec` commands.

### 📚 Documentation

- `docs/browser-automation-guide.md` — Included Browser Automation usage guide for users.
- `docs/skills-plugins-guide.md` — Synthesized all skills/plugins + setup steps + list of required env vars.
- README.md / README.vi.md — Updated with 9Router, Skills/Plugins, and new FAQs.

### 🔧 Technical

- `state.config.skills[]` + `state.config.plugins[]` are managed independently.
- `openclaw.json` dynamically injects `browser` config when Browser skill is selected.
- Dockerfile conditional logic: socat, agent-browser included only when necessary.
- docker-compose: added `extra_hosts` block for both 9Router and non-9Router setups.

---

## [2.0.0] — 2026-03-27

### ✨ New Features

- **Setup Wizard UI** — Interactive web wizard (`index.html`) to configure OpenClaw bots visually.
- **Multi-Channel Support** — Added support for Telegram, Zalo Bot API, and Zalo Personal channels.
- **Multi-Provider AI** — Support for Google Gemini, Anthropic Claude, OpenAI/Codex, OpenRouter, and Ollama (local).
- **Plugin System** — Modular plugin grid supporting Browser Automation, Scheduler, Memory, Web Search, RAG, and Image Gen.
- **Config Generation** — Automatically generates `openclaw.json`, `agent.yaml`, `Dockerfile`, and `docker-compose.yml`.
- **Language Toggle** — VI/EN toggle switch utilizing SVG flag icons.
- **Brand Logos** — Implemented high-quality SVG logos from [thesvg.org](https://thesvg.org) for all providers and channels.

### 🎨 Design

- Dark-themed glassmorphism UI overlaid with animated multi-layer gradients.
- Provider cards designed with unique colored icon backgrounds (Gemini purple, Claude orange, OpenAI green, OpenRouter violet, Ollama cyan).
- Auto-expanding System Prompt textarea without internal scroll.
- Developed a shimmer animation on the title and glow effects on selected cards.

### 📚 Documentation

- `README.md` / `README.vi.md` — Authored full bilingual docs, including a multi-provider comparison table.
- `SETUP.md` / `SETUP.vi.md` — Provided a technical setup guide specifically intended for AI agents.
- Security directive notice: Clarified that System Prompt determines personality only, while the framework enforces security rules.

### 🔒 Security

- Enforced a No-credentials-in-UI policy — instructing users to create `.env` files locally.
- Dynamic credential instructions presented conditionally per provider and channel.
- OpenClaw framework automatically enforces default system security rules.

---

## [1.0.0] — 2026-03-26

### Initial Release

- Published basic OpenClaw setup guide.
- Configured Telegram-only support.
- Configured Google Gemini single provider support.
- Included manual configuration file setup instructions.

