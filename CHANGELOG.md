# Changelog (English)


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
