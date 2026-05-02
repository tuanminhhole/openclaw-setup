<div align="center">

# 🦞 OpenClaw Setup

<p align="center">
  <a href="https://github.com/tuanminhhole/openclaw-setup/releases"><img src="https://img.shields.io/badge/RELEASE-v5.7.5-0EA5E9?style=for-the-badge" alt="Version 5.7.5" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup?tab=MIT-1-ov-file"><img src="https://img.shields.io/badge/LICENSE-MIT-success?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/create-openclaw-bot"><img src="https://img.shields.io/npm/v/create-openclaw-bot?style=for-the-badge&label=CLI&color=2563EB&logo=npm&logoColor=white" alt="NPM Version" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup/stargazers"><img src="https://img.shields.io/github/stars/tuanminhhole/openclaw-setup?style=for-the-badge&color=eab308&logo=github&logoColor=white" alt="GitHub Stars" /></a>
</p>

<p style="margin-top: 16px;">
  <img src="https://flagcdn.com/24x18/gb.png" alt="English" width="24" height="18" style="vertical-align: sub;"> <strong>English</strong> ·
  <img src="https://flagcdn.com/24x18/vn.png" alt="Tiếng Việt" width="24" height="18" style="vertical-align: sub;"> <a href="README.vi.md">Tiếng Việt</a>
</p>

An interactive **CLI tool** and **Setup Wizard** to deploy your own free AI Bot on Telegram or Zalo in minutes — supports **Windows, macOS, Ubuntu, and VPS**.

<a href="https://github.com/tuanminhhole/openclaw-setup">
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/preview.png" alt="OpenClaw Setup Hero Image" width="100%" style="border-radius: 8px; margin: 16px 0; border: 1px solid #333;" />
</a>

</div>

---

## 🆕 What's new in v5.7.5

- 🐛 **Hotfix: CLI crash on all platforms** — Fixed `ReferenceError: channelKey is not defined` that caused the CLI to crash immediately after completing the setup wizard on every platform (Telegram, Zalo). The `writeWorkspaceFiles()` function now correctly receives `channelKey` as an explicit parameter.
- 🔤 **Fix: Vietnamese text encoding** — Restored proper UTF-8 encoding integrity in `cli.src.js` to prevent double-encoding of Vietnamese characters from Windows tools.

<details>
<summary><b>Previous: What's new in v5.7.2</b></summary>

- 🏗️ **Centralized config architecture** — All `openclaw.json`, `.env`, and `exec-approvals.json` generation now flows through a single `bot-config-gen.js` module. Both the Web Wizard and CLI share the same builder, eliminating config drift between surfaces.
- 🔄 **Rolling `@latest` versioning** — Installation scripts now use `openclaw@latest` instead of pinned versions, ensuring users always get the newest release without waiting for a setup update.
- 🧪 **Comprehensive test matrix** — Added 422 new matrix tests covering all OS × Deploy × Channel × Bot Count combinations, plus Wizard IIFE sandbox evaluation and CLI structural validation.
- 🐛 **Removed `autoReply` bug** — The `autoReply: true` field that caused gateway startup crashes on Zalo Personal has been permanently removed from all generators.
- 💬 **Standardized Zalo Personal config** — Zalo Personal (`zalouser`) channel now uses production-matching config with `groups`, `groupPolicy`, `historyLimit`, and proper `bindings`.

</details>
---

## ✨ Features

- 🤖 **Multi-channel** — Telegram (single or multi-bot), Zalo Bot API, or Zalo Personal
- 🧑‍🤝‍🧑 **Multi-bot team** — Run up to 5 Telegram bots simultaneously. Bots share a workspace, collaborate on tasks, and coordinate in a group chat using the Department Room Model
- 🧠 **Multi-provider AI** — Google Gemini, Claude, GPT-4o, OpenRouter, Ollama (local), 9Router
- 🧩 **Skills** — Web Search, Browser Automation, Memory, RAG, Code Interpreter, Image Gen
- 🔌 **Plugins** — Voice Call, Matrix, MS Teams, Nostr
- 🔀 **9Router** — Free AI proxy. OAuth login, no API keys. Supports Claude Code, Codex, Gemini CLI.
- 🧙 **Setup Wizard** — 5-step visual web UI (`index.html`). No terminal required.
- 💻 **Interactive CLI** — `npx create-openclaw-bot` — best for Ubuntu, VPS, engineers.
- 🆓 **100% Free to start** — 9Router + Gemini free tier requires zero spending
- 🔒 **Private** — API keys stay on your machine, never sent anywhere
- ⚡ **Fast** — From zero to working bot in under 5 minutes

---

## 🗺️ Choose your path

> **Not sure which method to use?** The table below has you covered:

| Who you are                | Environment     | Recommended path                      |
| -------------------------- | --------------- | ------------------------------------- |
| Not familiar with terminal | Windows / macOS | **Web Wizard** (`index.html`)         |
| Not familiar with terminal | Ubuntu Desktop  | **Web Wizard** → choose Native        |
| Comfortable with terminal  | Ubuntu / VPS    | **CLI** (`npx create-openclaw-bot`)   |
| Want full automation       | Anywhere        | **AI Agent** (Antigravity + SETUP.md) |

### 1️⃣ Option A — Web Wizard (No terminal required)

Best for **Windows and macOS**. No command line at all.

1. [Download ZIP](https://github.com/tuanminhhole/openclaw-setup/archive/refs/heads/main.zip) or clone this repo.
2. Open `index.html` in your browser.
3. Follow the **5-step wizard**:
   - **Step 1:** Choose your OS (Windows / macOS / Ubuntu / VPS)
   - **Step 2:** Choose your bot channel (Telegram / Zalo)
   - **Step 3:** Choose your AI provider and model
   - **Step 4:** Enter bot token and configure settings
   - **Step 5:** Download your script and run it — done!
4. The downloaded script automatically installs everything needed (9Router, Ollama, Docker, etc.) based on your choices.

> **Docker or no Docker?**
>
> - **Windows / macOS** → Use **Docker** (fully isolated, easy to manage)
> - **Ubuntu / VPS** → Use **Native (no Docker)** (less RAM, more stable)

### 2️⃣ Option B — Interactive CLI (`npx`)

Best for **engineers, Ubuntu Desktop, VPS**. Fastest and most powerful.

```bash
npx create-openclaw-bot
```

Run in your terminal → follow the interactive prompts → startup script is generated automatically.

> Requires: **Node.js 20/22/24**. Check: `node -v`
>
> Note: **avoid Node.js 25 for now**. There are reports of OpenClaw failing on Node 25.

<details>
<summary><b>3️⃣ Option C — AI Agent (Antigravity)</b></summary>
<br>

1. Open [Antigravity IDE](https://antigravity.dev/)
2. Open this repo as your workspace
3. Paste into chat:
   ```
   Read SETUP.md and set up OpenClaw v5.3.1 for me.
   My bot token is X. Use 9Router (no API key).
   My project folder: <YOUR_PATH>
   ```

</details>

---

## 📋 Prerequisites

### Without Docker (Native — recommended for Ubuntu/VPS)

| Requirement             | Notes                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| **Node.js 20/22/24**    | [Download](https://nodejs.org/) · Check: `node -v` · Avoid Node 25 for now |
| **An AI provider**      | 9Router (free) or Gemini/Claude/GPT-4o                                     |
| **Bot Token**           | From Telegram BotFather or Zalo Developer                                  |
| **Ollama** _(optional)_ | Only if you want to run Gemma 4 locally · [Download](https://ollama.com/)  |

### With Docker (recommended for Windows/macOS)

| Requirement                     | Notes                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| **Node.js 20/22/24**            | [Download](https://nodejs.org/) · Check: `node -v` · Avoid Node 25 for now                    |
| **Docker Desktop + Compose V2** | [Download](https://www.docker.com/products/docker-desktop/) · Check: `docker compose version` |
| **An AI provider**              | 9Router runs as a sidecar container — no separate install needed                              |
| **Bot Token**                   | From Telegram BotFather or Zalo Developer                                                     |

---

## 🧠 Supported Providers

| Provider             | Cost         | API Key  | Notes                                                                                     |
| -------------------- | ------------ | -------- | ----------------------------------------------------------------------------------------- |
| **9Router**          | 🆓 Free      | ❌ OAuth | Recommended for beginners. Auto-routes to best model. Supports Claude CLI, Codex, Gemini. |
| **Google Gemini**    | 🆓 Free tier | ✅ Yes   | High quality. Very generous free tier.                                                    |
| **Ollama / Gemma 4** | 🏠 Free      | ❌ No    | Runs 100% offline. Auto-pulls model on first start.                                       |
| **Anthropic Claude** | 💰 Paid      | ✅ Yes   | Best reasoning and writing quality.                                                       |
| **OpenAI / Codex**   | 💰 Paid      | ✅ Yes   | GPT-4o, Codex Mini.                                                                       |
| **OpenRouter**       | 🆓/💰 Mixed  | ✅ Yes   | Many models under one key. Some are free.                                                 |

> 🔀 **9Router v0.3.75+** adds lossless passthrough for Claude Code, Codex, Gemini CLI, and Antigravity — meaning these AI tools can use 9Router as their endpoint without any data loss. See [docs/ai-providers.md](docs/ai-providers.md) for setup details.

---

## 🔌 Supported Channels

- **Telegram** (✅ Official) — Search **@BotFather** → `/newbot` → Copy token.
- **Zalo Bot API** (✅ Official) — Go to [developers.zalo.me](https://developers.zalo.me) → Create bot → Copy token.
- **Zalo Personal** (⚠️ Unofficial) — Scan QR after setup (no token needed). Use a secondary account.

> ⚠️ **Zalo Personal** uses an unofficial API. Your account may be restricted. Use a secondary account only.

---

## 📁 Repo Structure

```
index.html           ← Setup Wizard UI (open in browser)
style.css            ← Wizard styles
setup.js             ← Wizard logic
cli.js               ← Interactive CLI (npx create-openclaw-bot)
CHANGELOG.md/.vi.md  ← Version history
README.md            ← You're here (English)
README.vi.md         ← Hướng dẫn tiếng Việt
SETUP.md/.vi.md      ← Technical guide for AI Agent
docs/
  install-docker.md/.vi.md     ← Docker setup per OS
  install-native.md/.vi.md     ← Native/PM2 install per OS
  ai-providers.md/.vi.md       ← AI provider configuration
  hardware-guide.md/.vi.md     ← RAM planning for Ollama/Gemma 4
  faq.md/.vi.md                ← Frequently asked questions
```

> **Note:** Startup scripts (`.bat`, `.sh`) are **not included** in the repo — they are generated by the Web Wizard or CLI based on your specific configuration.

---

## ❓ FAQ

<details>
<summary><b>Is it really free?</b></summary>

Yes. Docker, Google Gemini API (free tier), and Telegram/Zalo bot tokens are all free. You only pay if you choose a paid AI provider like Claude or GPT-4o.

</details>

<details>
<summary><b>Where does the bot run?</b></summary>

On your computer or server. With Docker it runs in a container; with Native mode it runs as a PM2-managed process. If the machine is off, the bot is off. Use a VPS for 24/7 uptime.

</details>

<details>
<summary><b>Do I need Docker?</b></summary>

No. Docker is optional. Windows/macOS users should use Docker for clean isolation. Ubuntu/VPS users should install natively with PM2 — less overhead and OpenClaw is already secure by design.

</details>

<details>
<summary><b>How do I stop/restart the bot?</b></summary>

**Docker:**

```bash
docker compose down      # Stop
docker compose up -d     # Start
docker compose restart   # Restart
```

**PM2 (native):**

```bash
pm2 stop openclaw-bot
pm2 start openclaw-bot
pm2 restart openclaw-bot
```

</details>

<details>
<summary><b>Can I switch AI models later?</b></summary>

Yes. Re-run `npx create-openclaw-bot` in your bot folder, or edit `.openclaw/openclaw.json` directly and restart the bot.

</details>

<details>
<summary><b>Is it safe?</b></summary>

Your API keys are stored only on your machine in a local `.env` file. OpenClaw never transmits them anywhere. When using Ollama, all AI inference runs completely offline.

</details>

<details>
<summary><b>What is 9Router?</b></summary>

9Router is an open-source AI proxy. Instead of managing API keys from multiple providers, you log in once via OAuth at `localhost:20128/dashboard`. It auto-routes requests to the best available AI model. Starting v0.3.75, it also supports lossless passthrough for Claude Code, Codex, Gemini CLI, and Antigravity.

</details>

<details>
<summary><b>What's the difference between Skills and Plugins?</b></summary>

**Skills** add agent capabilities (Web Search, Browser Automation, Memory, RAG, Code Interpreter...) — install via `openclaw skills install` from ClawHub.

**Plugins** add channels or runtime extensions (Voice Call, Matrix, MS Teams...) — install via `openclaw plugins install` from npm.

</details>

<details>
<summary><b>How much RAM do I need for Gemma 4?</b></summary>

| Model        | Min RAM (Native) | Min RAM (Docker) |
| ------------ | ---------------- | ---------------- |
| `gemma4:e2b` | ~4 GB            | ~5 GB            |
| `gemma4:e4b` | ~8 GB            | ~9 GB            |
| `gemma4:26b` | ~18 GB           | ~20 GB           |
| `gemma4:31b` | ~24 GB           | ~26 GB           |

See [docs/hardware-guide.md](docs/hardware-guide.md) for full details including VPS swap setup.

</details>

---

## 🔗 Links

- [OpenClaw Docs](https://openclaw.ai/docs)
- [9Router](https://github.com/decolua/9router)
- [Google AI Studio](https://aistudio.google.com/)
- [Telegram BotFather](https://t.me/BotFather)
- [Zalo Developer Platform](https://developers.zalo.me)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Ollama](https://ollama.com)
- [OpenRouter](https://openrouter.ai)
- [ClawHub (Skills)](https://clawhub.com)

---

## 📈 Star History

<div align="center">

[![Star History Chart](https://starchart.cc/tuanminhhole/openclaw-setup.svg?variant=adaptive)](https://starchart.cc/tuanminhhole/openclaw-setup)

</div>

---

## 🙏 Acknowledgments

- [OpenClaw](https://openclaw.ai) — AI Gateway framework
- [9Router](https://github.com/decolua/9router) — Open-source AI proxy (OAuth-based, no API keys)
- [Playwright](https://playwright.dev) — Browser automation engine
- [ClawHub](https://clawhub.com) — Skills registry
- [TheSVG](https://thesvg.org) — High-quality SVG brand icons

---

<div align="center">

Made with 🦞 by [Kent](https://github.com/tuanminhhole)

</div>
