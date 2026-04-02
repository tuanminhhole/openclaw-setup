# Changelog (English)

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
