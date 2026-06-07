<div align="center">

# 🦞 OpenClaw Setup

<p align="center">
  <a href="https://github.com/tuanminhhole/openclaw-setup/releases"><img src="https://img.shields.io/badge/RELEASE-v5.8.11-0EA5E9?style=for-the-badge" alt="Version 5.8.11" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup?tab=MIT-1-ov-file"><img src="https://img.shields.io/badge/LICENSE-MIT-success?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/create-openclaw-bot"><img src="https://img.shields.io/npm/v/create-openclaw-bot?style=for-the-badge&label=CLI&color=2563EB&logo=npm&logoColor=white" alt="NPM Version" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup/stargazers"><img src="https://img.shields.io/github/stars/tuanminhhole/openclaw-setup?style=for-the-badge&color=eab308&logo=github&logoColor=white" alt="GitHub Stars" /></a>
</p>

[![Tiếng Việt](https://flagcdn.com/20x15/vn.png) Tiếng Việt](README.vi.md) · ![English](https://flagcdn.com/20x15/gb.png) **English**

A next-generation **Web UI Setup** and management dashboard that automates 100% of the project scaffolding, deployment, and control of free multi-bot AI assistants on Telegram or Zalo — supports **Windows, macOS, Ubuntu, and VPS**.

<p align="center" style="margin: 24px 0;">
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/openclaw-setup.png" alt="OpenClaw Setup" width="90%" style="border-radius: 8px; border: 1px solid #333; margin-bottom: 16px;" />
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/dashboard.png" alt="OpenClaw Dashboard" width="90%" style="border-radius: 8px; border: 1px solid #333; margin-bottom: 16px;" />
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/bot.png" alt="OpenClaw Bot in Action" width="90%" style="border-radius: 8px; border: 1px solid #333;" />
</p>

</div>

---

## 🆕 What's New in v5.8.11

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

<details>
<summary><b>Previous: What's new in v5.8.0 (Major Release)</b></summary>

- 🎨 **Modern Web UI Dashboard**: Completely replaces the legacy `index.html` static wizard and terminal-based manual setups with a highly intuitive, premium dark red/black themed web dashboard to install and manage bots.
- 🔀 **Centralized AI Proxy via 9Router**: The installer now relies exclusively on **9Router** as the unified AI gateway. Through 9Router's OAuth sign-in flow, you can easily route requests to free models (like Google Gemini free tier, Ollama local offline models) as well as premium paid models.
- 📊 **Process Controller**: Directly Start, Stop, or Recreate bot containers and processes via user-friendly dashboard buttons.
- 📑 **Real-Time Live Logs**: View real-time streaming console logs of your bot processes directly on the Web UI.
- 📁 **File Tree Editor**: Read, modify, and save configuration files (`openclaw.json`, `SOUL.md`, `AGENTS.md`) directly in the browser.
- 🔑 **Zalo QR Authorization**: Authorize Zalo Personal bots in seconds by scanning the Zalo login QR code rendered directly on the management dashboard.
- 🔄 **Smart Port Conflict Resolution**: Automatically scans and dynamically assigns unique network ports (`routerPort`) to avoid conflicts when launching multiple bot instances.

</details>

---

## ✨ Features

- 🤖 **Multi-Channel** — Telegram (single or multi-bot relay), Zalo Bot API, or Zalo Personal.
- 🧑‍🤝‍🧑 **Multi-Bot Team** — Run multiple Telegram/Zalo bots simultaneously with synchronized workspaces and teamwork.
- 🧠 **Unified AI Routing via 9Router** — Easily route messages to Google Gemini, Claude, GPT-4o, OpenRouter, and Ollama (local offline models).
- 🧩 **Built-in Skills** — Web Search, Browser Automation (Chrome CDP), and Cron/Scheduler tasks.
- 🔌 **Integrated Marketplace** — Install advanced plugins (like `openclaw-zalo-mod`, Facebook Crawler...) with a single click.
- 🔀 **9Router Integration** — Open-source OAuth-based AI proxy that gets you up and running for free without individual API keys.
- 🔒 **Safe & Private** — All configurations and API keys are stored locally on your own machine.

---

## 🗺️ Quick Start

### 1️⃣ Method 1: Using NPX (Recommended)

Open your terminal and run this single command:

```bash
npx create-openclaw-bot
```

_The bootstrapper will automatically download package files, launch the local backend server, and open the Setup UI in your browser._

### 2️⃣ Method 2: Manual Clone

If you downloaded or cloned the repository files locally:

```bash
npm install
npm start
```

---

## 📋 System Prerequisites

- **Node.js**: Version 20, 22, or 24 (Avoid Node 25 due to runtime library deprecations).
- **Git**: Installed and available in your environment PATH.
- **Docker Desktop** (If deploying via Docker): Support for Docker Compose V2.

---

## 🧠 Supported AI Providers (via 9Router)

- [9Router GitHub](https://github.com/decolua/9router)

---

## 🔌 Supported Channels

- **Telegram**: Acquire your official Bot Token from `@BotFather`.
- **Zalo Bot API**: Obtain credentials from [developers.zalo.me](https://developers.zalo.me).
- **Zalo Personal**: Scan the QR authorization image displayed on the OpenClaw Dashboard.

---

## 📁 Repository Structure

```text
openclaw-setup/
|-- README.md                ← English documentation (You are here)
|-- README.vi.md             ← Vietnamese documentation
|-- package.json             ← NPM entry and runner scripts
|-- dist/                    ← Compiled Web UI and CLI bundles
`-- src/                     ← Source code (UI, local API backend, build tools)
```

---

## ❓ FAQ

<details>
<summary><b>How do I start or stop the bot?</b></summary>
You no longer need to type terminal commands! Simply access the Setup Web UI, navigate to the <b>Bot</b> tab, and use the interactive <b>Start / Stop / Recreate</b> buttons to manage your bot lifecycle.
</details>

<details>
<summary><b>Where do I edit the bot's persona and instructions?</b></summary>
You can edit them directly in your browser. Go to the <b>Bot</b> tab, scroll down to the <b>Bot file tree</b> section, and select the file you want to edit (e.g., `SOUL.md` or `AGENTS.md`). Click <b>Save</b> to apply changes instantly.
</details>

<details>
<summary><b>Can I change the AI model configuration later?</b></summary>
Yes. You can edit the config JSON directly via the integrated File Editor in the Web UI, or re-run the setup script pointing to your existing project folder.
</details>

---

## 🔗 Useful Links

- [OpenClaw Docs](https://openclaw.ai/docs)
- [9Router GitHub](https://github.com/decolua/9router)
- [Google AI Studio](https://aistudio.google.com/)
- [Telegram BotFather](https://t.me/BotFather)
- [Zalo Developer Platform](https://developers.zalo.me)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [ClawHub (Skills)](https://clawhub.com)

---

## 📈 Star History

<div align="center">

[![Star History Chart](https://starchart.cc/tuanminhhole/openclaw-setup.svg?variant=adaptive)](https://starchart.cc/tuanminhhole/openclaw-setup)

</div>

---

## 🙏 Acknowledgments

- [OpenClaw](https://openclaw.ai) — Core AI Gateway framework
- [9Router](https://github.com/decolua/9router) — Open-source AI proxy (OAuth-based, no API keys)
- [ClawHub](https://clawhub.com) — Bot skills registry
- [TheSVG](https://thesvg.org) — High-quality SVG brand icons

---

<div align="center">

Made with 🦞 by [Kent](https://github.com/tuanminhhole)

</div>
