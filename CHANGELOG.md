# Changelog

All notable changes to this project will be documented in this file.

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
