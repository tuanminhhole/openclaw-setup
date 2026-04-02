<div align="center">

# 🦞 OpenClaw Setup

<p align="center">
  <a href="https://github.com/tuanminhhole/openclaw-setup/releases"><img src="https://img.shields.io/badge/RELEASE-v4.1.2-0EA5E9?style=for-the-badge" alt="Version 4.1.2" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup?tab=MIT-1-ov-file"><img src="https://img.shields.io/badge/LICENSE-MIT-success?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/create-openclaw-bot"><img src="https://img.shields.io/npm/v/create-openclaw-bot?style=for-the-badge&label=CLI&color=2563EB&logo=npm&logoColor=white" alt="NPM Version" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup/stargazers"><img src="https://img.shields.io/github/stars/tuanminhhole/openclaw-setup?style=for-the-badge&color=eab308&logo=github&logoColor=white" alt="GitHub Stars" /></a>
</p>

<p style="margin-top: 16px;">
  <img src="https://flagcdn.com/24x18/gb.png" alt="English" width="24" height="18" style="vertical-align: sub;"> <strong>English</strong> · 
  <img src="https://flagcdn.com/24x18/vn.png" alt="Tiếng Việt" width="24" height="18" style="vertical-align: sub;"> <a href="README.vi.md">Tiếng Việt</a>
</p>

An interactive <strong>CLI tool</strong> and <strong>Setup Wizard</strong> to deploy your own free AI Bot on Telegram or Zalo in minutes.

<a href="https://github.com/tuanminhhole/openclaw-setup">
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/preview.png" alt="OpenClaw Setup Hero Image" width="100%" style="border-radius: 8px; margin: 16px 0; border: 1px solid #333;" />
</a>

</div>

---

## 🆕 What's new in OpenClaw v4

> **A massive leap in automation, stability, and provider connectivity!**

- 🚀 **Zero-Config `npx` Deployment**: Say goodbye to manually extracting `.zip` files and confusing `.env` configurations. We've introduced a fully interactive CLI `npx create-openclaw-bot` and Web Wizard that builds the entire Docker workspace dynamically!
- 🔀 **Simplified 9Router Smart Routing**: We've optimized the AI routing to default to a single `smart-route` option. OpenClaw now flawlessly load-balances across top-tier models from Anthropic, OpenAI Codex, Gemini, and Qwen, managing fallback automatically without needing you to input individual API keys.
- 🌐 **Instant Browser Automation**: Deploying Web Search and automated Browser skills is now fully handled during setup. We added built-in support for both Windows (`.bat` files) and macOS/Linux (`.sh` files) to instantly attach your local Chrome instances.
- 🧹 **Zero-Clutter Repository**: Eliminated dummy `.env.example` templates and static docker-compose files. The setup now generates precisely what you need, minimizing security risks and permission errors on native OS setups.

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

1. **Docker Desktop** — [Download here](https://www.docker.com/products/docker-desktop/)
2. **AI API Key** — See [Supported Providers](#-supported-providers) (Gemini is free!)
3. **Bot Token** — See [Supported Channels](#-supported-channels)

---

## 🧠 Supported Providers

- **Google Gemini** (Gemini 2.5 Flash/Pro, 3.0 Flash) — 🆓 Free — [Get Key](https://aistudio.google.com/apikey)
- **Anthropic Claude** (Sonnet 4, Opus 4, Haiku 3.5) — 💰 Paid — [Get Key](https://console.anthropic.com/settings/keys)
- **OpenAI / Codex** (GPT-4o, o3, Codex Mini) — 💰 Paid — [Get Key](https://platform.openai.com/api-keys)
- **OpenRouter** (Many free & paid models) — 🆓/💰 — [Get Key](https://openrouter.ai/keys)
- **Ollama** (Qwen 3, DeepSeek, Llama...) — 🏠 Local — [Install](https://ollama.com)
- **9Router** (Auto-routes to best provider) — 🔀 Proxy — [Docs](https://github.com/decolua/9router)

> 🔀 **9Router** runs alongside OpenClaw in Docker. After `docker compose up`, open `localhost:20128/dashboard` to login via OAuth. No API keys needed!

---

## 🔌 Supported Channels

- **Telegram** (✅ Official) — Search **@BotFather** on Telegram → `/newbot` → Copy token.
- **Zalo Bot API** (✅ Official) — Go to [developers.zalo.me](https://developers.zalo.me) → Create bot → Copy token.
- **Zalo Personal** (⚠️ Unofficial) — Scan QR code after Docker setup (no token needed).

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
3. Paste into chat:
   ```text
   Read SETUP.md and set up OpenClaw v4.1.2 for me.
   My bot token is X, my 9Router proxy doesn't need a key.
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
