<div align="center">

# 🦞 OpenClaw Setup

<p align="center">
  <a href="https://github.com/tuanminhhole/openclaw-setup/releases"><img src="https://img.shields.io/badge/RELEASE-v4.0.1-0EA5E9?style=for-the-badge" alt="Version 4.0.1" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup?tab=MIT-1-ov-file"><img src="https://img.shields.io/badge/LICENSE-MIT-success?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/create-openclaw-bot"><img src="https://img.shields.io/npm/v/create-openclaw-bot?style=for-the-badge&label=CLI&color=2563EB&logo=npm&logoColor=white" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/create-openclaw-bot"><img src="https://img.shields.io/npm/dm/create-openclaw-bot?style=for-the-badge&color=22c55e" alt="NPM Downloads" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup/stargazers"><img src="https://img.shields.io/github/stars/tuanminhhole/openclaw-setup?style=for-the-badge&color=eab308&logo=github&logoColor=white" alt="GitHub Stars" /></a>
</p>

An interactive <strong>CLI tool</strong> and <strong>Setup Wizard</strong> to deploy your own free AI Bot on Telegram or Zalo in minutes.

<a href="https://github.com/tuanminhhole/openclaw-setup">
  <img src="docs/preview.png" alt="OpenClaw Setup Hero Image" width="100%" style="border-radius: 8px; margin: 16px 0; border: 1px solid #333;" />
</a>

<p style="margin-top: 16px;">
  <img src="https://flagcdn.com/24x18/gb.png" alt="English" width="24" height="18" style="vertical-align: sub;"> <strong>English</strong> · 
  <img src="https://flagcdn.com/24x18/vn.png" alt="Tiếng Việt" width="24" height="18" style="vertical-align: sub;"> <a href="README.vi.md">Tiếng Việt</a>
</p>

</div>

---

## 🆕 What's new in v4.0.1
- 🪄 **Fully Automated Setup**: Say goodbye to downloading ZIP files and manually copying configs. Everything is now fully automated with a single action.
- ⚡ **One-Command Install (`npx create-openclaw-bot`)**: Extremely convenient for VPS/SSH users — the script automatically creates the project directory, sets up the environment, and triggers `docker compose up -d` instantly.
- 🚀 **Zero-Restart Deployment**: Details like API Keys and Bot Tokens (which you input during setup) are automatically injected into `.env` before the bot boots for the first time. No restarts required!
- 🌐 **Browser Automation Setup**: Updated Windows Task Scheduler and Debug Mode scripts for smoother interaction with Web Apps.

---

## ✨ Features

- 🤖 **Multi-channel** — Telegram, Zalo Bot API, or Zalo Personal
- 🧠 **Multi-provider AI** — Google Gemini, Claude, GPT-4o/Codex, OpenRouter, Ollama, 9Router
- 🧩 **Skills** — Web Search, Browser Automation, Memory, RAG, Code Interpreter, Image Gen...
- 🔌 **Plugins** — Voice Call, Matrix, MS Teams, Nostr
- 🔀 **9Router Proxy** — Auto-route your bot's traffic effectively!
- 🧙 **Setup Wizard** — Beautiful interactive shell (CLI) or dark-themed Web UI
- 🆓 **100% Free** — Google Gemini API free tier + Docker
- 🔒 **Secure** — API keys stay on your machine, never exposed
- ⚡ **3 minutes** — From zero to working AI bot

---

## 📋 Prerequisites

You need **3 things** (all free):

| # | What | How to get |
|---|------|------------|
| 1 | **Docker Desktop** | Download → [docker.com](https://www.docker.com/products/docker-desktop/) |
| 2 | **AI API Key** | See [Supported Providers](#-supported-providers) — Gemini is free! |
| 3 | **Bot Token** | See [Supported Channels](#-supported-channels) below |

---

## 🧠 Supported Providers

| Provider | Models | Price | Get API Key |
|----------|--------|-------|-------------|
| **Google Gemini** | Gemini 2.5 Flash/Pro, 3.0 Flash | 🆓 Free | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Anthropic Claude** | Claude Sonnet 4, Opus 4, Haiku 3.5 | 💰 Paid | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **OpenAI / Codex** | GPT-4o, o3, Codex Mini | 💰 Paid | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **OpenRouter** | Many free & paid models | 🆓/💰 | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Ollama** | Qwen 3, DeepSeek, Llama, Gemma... | 🏠 Local | Install [ollama.com](https://ollama.com) |
| **9Router** | Auto-route to best provider | 🔀 Proxy | No API key — [github.com/decolua/9router](https://github.com/decolua/9router) |

> 🔀 **9Router** runs alongside OpenClaw in Docker. After `docker compose up`, open `localhost:20128/dashboard` to login via OAuth. No API keys needed!

---

## 🔌 Supported Channels

| Channel | Type | How to get token |
|---------|------|-----------------|
| **Telegram** | ✅ Official Bot API | Open Telegram → Search **@BotFather** → `/newbot` → Copy token |
| **Zalo Bot API** | ✅ Official Bot API | Go to [developers.zalo.me](https://developers.zalo.me) → Create bot → Copy token |
| **Zalo Personal** | ⚠️ Unofficial | Login via QR code after setup (no token needed) |

> ⚠️ **Zalo Personal** uses an unofficial API. Your account may be restricted. Use a secondary account.

---

## 🚀 Quick Start

### 1️⃣ Option A — Interactive CLI (`npx`) [Recommended]

The fastest way to install OpenClaw is using the interactive NPM package.

1. **Open your Terminal (or Command Prompt).**
2. **Run the command:**
   ```bash
   npx create-openclaw-bot
   ```
3. **Follow the interactive prompts** to configure your bot, keys, and paths!

<details>
<summary><b>2️⃣ Option B — GUI Setup Wizard (Web UI)</b></summary>
<br>

1. **Clone this repo:**
   ```bash
   git clone https://github.com/tuanminhhole/openclaw-setup.git
   cd openclaw-setup
   ```

2. **Open `index.html`** in your browser — the Setup Wizard will guide you through:
   - Choose your channel (Telegram / Zalo)
   - Configure bot name, personality, AI model
   - Generate all config files and `setup-openclaw.bat`

</details>

### 3️⃣ Option C — AI Agent (Antigravity)

1. Open [Antigravity IDE](https://antigravity.dev/)
2. Open this repo as workspace
3. Create `docker/openclaw/.env` with your keys
4. Paste into chat:
   ```
   Read SETUP.md in this repo and set up OpenClaw for me.
   I already created the .env file with my API key and Bot token.
   My project folder: <YOUR_PATH>
   ```

---

## 📁 Repo Structure

```
index.html       ← Setup Wizard UI
style.css        ← Wizard styles
setup.js         ← Wizard logic
CHANGELOG.md     ← Version history
README.md        ← You're here (English)
README.vi.md     ← Hướng dẫn tiếng Việt
SETUP.md         ← Technical guide for AI (English)
SETUP.vi.md      ← Hướng dẫn kỹ thuật cho AI (Tiếng Việt)
```

---

## ❓ FAQ

<details>
<summary><b>Is it really free?</b></summary>
Yes. Docker, Google Gemini API (free tier), and Telegram/Zalo bots are all free.
</details>

<details>
<summary><b>Where does the bot run?</b></summary>
On your computer inside a Docker container. When your PC is off, the bot is off.
</details>

<details>
<summary><b>How do I stop/restart?</b></summary>

```bash
docker compose down      # Stop
docker compose up -d     # Start
```
</details>

<details>
<summary><b>Can I customize the bot?</b></summary>
Yes! Use the Setup Wizard to configure name, personality, and language. Or edit the YAML files directly.
</details>

<details>
<summary><b>Is it safe?</b></summary>
Your API keys stay on your machine only. SETUP.md includes strict security rules that the AI must follow.
</details>

<details>
<summary><b>Can I switch channels later?</b></summary>
Yes! Re-run the Setup Wizard or manually edit <code>.openclaw/openclaw.json</code> to change the channel config.
</details>

<details>
<summary><b>What is 9Router?</b></summary>
9Router is a community open-source AI proxy that runs in Docker alongside your bot. Instead of API keys, you login via OAuth on the 9Router dashboard (<code>localhost:20128</code>). It auto-routes requests to the best available AI provider.
</details>

<details>
<summary><b>What's the difference between Skills and Plugins?</b></summary>
<strong>Skills</strong> add agent capabilities (Web Search, Browser, Memory, etc.) — installed via <code>openclaw skills install</code> from ClawHub.<br>
<strong>Plugins</strong> add channels or runtime extensions (Voice Call, Matrix, etc.) — installed via <code>openclaw plugins install</code> from npm.
</details>

---

## 🔗 Links

- [OpenClaw Docs](https://openclaw.ai/docs)
- [Google AI Studio](https://aistudio.google.com/)
- [Telegram BotFather](https://t.me/BotFather)
- [Zalo Bot Platform](https://developers.zalo.me)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

## 📈 Star History

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=tuanminhhole/openclaw-setup&type=Date)](https://star-history.com/#tuanminhhole/openclaw-setup&Date)

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
