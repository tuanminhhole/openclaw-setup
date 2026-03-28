# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] — 2026-03-28

### ✨ New Features
- **9Router Integration** — AI proxy, không cần API key, multi-container Docker (`docker-compose.yml` 2 service)
- **Skills System (ClawHub)** — 8 agent capabilities: Web Search, Browser Automation, Memory, RAG, Image Gen, Bot Scheduler, Code Interpreter, Email Assistant
- **Plugins System (npm)** — 4 runtime extensions: Voice Call, Matrix, MS Teams, Nostr
- **Browser Automation** — Full Chrome Debug Mode support (socat proxy, agent-browser, Playwright engine)
- **Task Scheduler** — Windows Scheduled Task auto-starts Chrome Debug khi logon (delay 10s)
- **Skill-aware .env** — `.env` template tự động thêm env vars cho skills cần API key (Tavily, SMTP, Flux...)
- **Post-setup Management** — Hướng dẫn thêm/bỏ skills/plugins sau khi setup qua `docker exec`

### 🎨 UI/UX
- Tách Skills (4-column grid) và Plugins (riêng biệt) — rõ ràng hơn
- Skill cards hiện notes (⚙️) cho skills cần setup thêm
- Browser Automation notice card ở Step 4 với `.bat` + `.ps1` scripts
- Management guide card (🔧) với `docker exec` commands

### 📚 Documentation
- `docs/browser-automation-guide.md` — Hướng dẫn sử dụng Browser Automation cho user
- `docs/skills-plugins-guide.md` — Tổng hợp toàn bộ skills/plugins + setup + env vars
- README.md / README.vi.md — Thêm 9Router, Skills/Plugins, FAQs mới

### 🔧 Technical
- `state.config.skills[]` + `state.config.plugins[]` quản lý độc lập
- `openclaw.json` inject `browser` config khi Browser skill selected
- Dockerfile conditional: socat, agent-browser chỉ khi cần
- docker-compose: `extra_hosts` cho cả 9Router lẫn non-9Router

---

## [2.0.0] — 2026-03-27

### ✨ New Features
- **Setup Wizard UI** — Interactive web wizard (`index.html`) to configure OpenClaw bots visually
- **Multi-Channel Support** — Telegram, Zalo Bot API, Zalo Personal channel selection
- **Multi-Provider AI** — Google Gemini, Anthropic Claude, OpenAI/Codex, OpenRouter, Ollama (local)
- **Plugin System** — Modular plugin grid: Browser Automation, Scheduler, Memory, Web Search, RAG, Image Gen
- **Config Generation** — Auto-generates `openclaw.json`, `agent.yaml`, `Dockerfile`, `docker-compose.yml`
- **Language Toggle** — VI/EN toggle switch with SVG flag icons
- **Brand Logos** — Real SVG logos from [thesvg.org](https://thesvg.org) for all providers and channels

### 🎨 Design
- Dark-themed glassmorphism UI with animated multi-layer gradients
- Provider cards with unique colored icon backgrounds (Gemini purple, Claude orange, OpenAI green, OpenRouter violet, Ollama cyan)
- Auto-expanding System Prompt textarea (no internal scroll)
- Shimmer animation on title, glow effects on selected cards

### 📚 Documentation
- `README.md` / `README.vi.md` — Full bilingual docs with multi-provider table
- `SETUP.md` / `SETUP.vi.md` — Technical setup guide for AI agents
- Security notice: System Prompt = personality only, framework enforces security rules

### 🔒 Security
- No-credentials-in-UI policy — users create `.env` files locally
- Dynamic credential instructions per provider + channel
- OpenClaw framework auto-enforces system security rules

---

## [1.0.0] — 2026-03-26

### Initial Release
- Basic OpenClaw setup guide
- Telegram-only configuration
- Google Gemini single provider support
- Manual config file instructions
