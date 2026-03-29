# Changelog

All notable changes to this project will be documented in this file.

## [3.0.1] — 2026-03-29

### ✨ New Features
- **Wizard UI Redesign (Step 2)** — AI Provider/Model lên đầu, sau đó Identity, Personality, Security Rules, Extensions
- **User Info textarea** — User tự nhập thông tin về mình → sinh vào `USER.md` để bot cá nhân hóa
- **Editable Security Rules** — Hiển thị quy tắc bảo mật mặc định, user có thể sửa → inject vào `AGENTS.md`
- **Section dividers** — Icon dividers giữa các nhóm config (🤖 🔐 🧩)

### 🐛 Bug Fixes
- **Skills auto-enable** — Khi chọn skill, giờ tự động khai báo trong `openclaw.json` → `skills.entries` (enabled: true). Trước đây chỉ cài Dockerfile nhưng không register → bot không nhận skill
- **Skills env injection** — Skills cần API key (Tavily, SMTP…) tự động inject env vars vào `skills.entries`

### 🎨 UI/UX
- Identity grid 3 cột (Tên, Vai trò, Emoji) — bỏ Vibe (gộp vào System Prompt)
- Emoji input fix: `form-input--emoji` class, cùng height với input khác
- Label System Prompt → "Tính cách, Vibe & Quy tắc trả lời"
- Responsive mobile: Name full width, Role + Emoji side-by-side
- Security textarea readonly mặc định, nút "✏️ Sửa" / "🔒 Khóa" toggle

### 🔧 Technical
- `state.config.userInfo` — new field, saved from `cfg-user-info` textarea
- `state.config.securityRules` — editable, defaults per language (vi/en)
- `DEFAULT_SECURITY_RULES` constant with vi/en templates
- `clawConfig.skills.entries` generated from selected skills
- Language toggle updates both prompt and security rules

---

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
