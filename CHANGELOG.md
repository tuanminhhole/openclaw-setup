# Changelog (English)

All notable changes to this project will be documented in this file.

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
