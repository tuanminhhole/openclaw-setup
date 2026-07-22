<div align="center">

# 🦞 OpenClaw Setup

### One **Web UI** to scaffold, deploy & run free multi-bot AI assistants — zero terminal required

*Run one command → open the dashboard → your bot is live. Windows · macOS · Linux · VPS — Docker-powered, auto-installed for you.*

<p align="center">
  <a href="https://github.com/tuanminhhole/openclaw-setup/releases"><img src="https://img.shields.io/badge/RELEASE-v5.13.6-0EA5E9?style=for-the-badge" alt="Version 5.13.6" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup?tab=MIT-1-ov-file"><img src="https://img.shields.io/badge/LICENSE-MIT-success?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/create-openclaw-bot"><img src="https://img.shields.io/npm/v/create-openclaw-bot?style=for-the-badge&label=CLI&color=2563EB&logo=npm&logoColor=white" alt="NPM Version" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup/stargazers"><img src="https://img.shields.io/github/stars/tuanminhhole/openclaw-setup?style=for-the-badge&color=eab308&logo=github&logoColor=white" alt="GitHub Stars" /></a>
</p>

[![Tiếng Việt](https://flagcdn.com/20x15/vn.png) Tiếng Việt](README.vi.md) · ![English](https://flagcdn.com/20x15/gb.png) **English**

> 💡 Open-source & free. A management dashboard that automates 100% of project scaffolding, deployment, and control for AI bots on **Telegram · Zalo · Facebook Messenger** (Discord & Lark soon) — set up in minutes, no coding needed.

<p align="center" style="margin: 24px 0;">
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/openclaw-setup.png" alt="OpenClaw Setup" width="90%" style="border-radius: 8px; border: 1px solid #333; margin-bottom: 16px;" />
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/dashboard.png" alt="OpenClaw Dashboard" width="90%" style="border-radius: 8px; border: 1px solid #333; margin-bottom: 16px;" />
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/bot.png" alt="OpenClaw Bot in Action" width="90%" style="border-radius: 8px; border: 1px solid #333;" />
</p>

</div>

---

<div align="center">
  <a href="https://www.youtube.com/watch?v=hPusYX-5Pmw">
    <img src="https://img.youtube.com/vi/hPusYX-5Pmw/maxresdefault.jpg" alt="Watch the OpenClaw setup video" width="820" />
  </a>
  <br />
  <strong>▶ Watch the OpenClaw + Zalo setup video on YouTube</strong>
</div>

---

## 🆕 What's New in v5.13.6

- ⚙️ **New Settings page**: pick your theme (light/dark toggle), language (VI/EN) and timezone right from the dashboard — available in both the sidebar and the mobile nav bar.
- 🕒 **Schedules & cron run in the correct local time**: newly created bots carry an explicit timezone, so reminders/cron no longer drift a day off around midnight (a UTC-vs-local bug that could schedule into the past). Scheduling guidance was hardened end-to-end (local time + timezone, explicit delivery target, raw group id).

<details>
<summary><b>Previous: What's new in v5.13.0</b></summary>

- 🟢 **Live Zalo status on every bot card**: each personal Zalo bot now shows its own connection and login state, with a compact green badge when it is ready.
- 👥 **Accurate multi-account visibility**: Setup reads the real Zalo Connect runtime per account, so projects with several Zalo bots no longer collapse into an ambiguous shared status.
- ✨ **A cleaner Zalo control area**: Refresh and Login Again sit together above the bot list, while shared Zalo Connect and Zalo Mod versions move into the main status column.

</details>

<details>
<summary><b>Previous: What's new in v5.12.0</b></summary>

- 💬 **OpenClaw Zalo Connect, ready in one click**: create a personal Zalo bot or press **Zalo Login** and Setup prepares the channel automatically, then opens the QR flow in the dashboard.
- ⚡ **Install once, reconnect faster**: an existing Zalo Connect installation is reused instead of being downloaded again on every login or restart.
- ✨ **Cleaner native Zalo experience**: group mentions, reactions and moderation now run through one maintained Zalo runtime; the retired integration and Sticker add-on are gone from Setup.

</details>

<details>
<summary><b>Previous: What's new in v5.11.1</b></summary>

- 📄 **Workspace defaults, rebuilt on OpenClaw's canonical files**: new bots get all 7 upstream default workspace files (`AGENTS`/`BOOTSTRAP`/`HEARTBEAT`/`IDENTITY`/`SOUL`/`TOOLS`/`USER.md`) as the base, with this project's extra rules appended as clearly-marked add-ons — VI + EN, every bot variant.
- 🗄️ **SQLite "disk I/O error" on Docker Desktop — fixed**: `.openclaw/state` now lives in a named volume on macOS/Windows (WAL locking doesn't survive virtiofs); Linux/VPS keeps the bind mount.

</details>

<details>
<summary><b>Previous: What's new in v5.11.0</b></summary>

- 🚀 **Facebook Messenger, 1-click**: the `fb-messenger` plugin is now **public on ClawHub** and installs straight from the dashboard — create a Messenger bot, open **Bot → Plugins**, and hit **Install** on the `openclaw-fb-messenger` card. Webhook + Graph API, auto User→Page token, HMAC verify.
- 🐳 **Docker-only, rock-solid**: dropped the native (non-Docker) install path to focus on the Docker flow that runs flawlessly and stably across Windows / macOS / Linux / VPS, with cross-OS Docker auto-install.
- 🖥️ **Chrome-debug on headless VPS**: the browser-automation Chrome-debug relay now works on a headless VPS (bridge-IP-scoped, auto-opens ufw); the bot file editor also saves non-`.md` text files.

</details>

<details>
<summary><b>Previous: What's new in v5.10.1</b></summary>

- 🔧 **Docker fixes**: plugin updates keep the zalo-mod dashboard port, and granted disk/folder mounts (including whole Windows drives like `D:\`) now survive a rebuild instead of being dropped.
- 🔄 **Native auto-restart (process supervision)**: native installs now register the gateway + 9router as OS services (macOS launchd, Linux systemd, Windows detached) that restart on crash/reboot — mirroring Docker's `restart: always`. Best-effort, falls back to a plain detached process.
- 🔐 **9router first-install sync — fixed**: no longer permanently disables "Require login". The generated `sync.js` logs in with 9router's default password `123456`, builds the `smart-route` combo from active providers **once**, then stops. Require login stays ON (change the password later); `/v1` model calls are unaffected.
- 📁 **Native workspace path — fixed**: agent `workspace` is now relative, so persona/memory/skills resolve correctly on native installs (previously a container-absolute path pointing nowhere on the host).
- 🧩 **Config `meta` no longer clobbered**: the generator stops seeding `meta`, so OpenClaw owns it — prevents config parse failures from a version-range `lastTouchedVersion`.
- 💅 **Dashboard UI polish**: Bot/Setup hero shortcuts, plugin version badges, cleaner feature-toggle layout, responsive/mobile fixes, and no more duplicate page title on the dashboard tab.

</details>

<details>
<summary><b>Previous: What's new in v5.9.0</b></summary>

- 🧠 **TencentDB Agent Memory — 1-click install**: New memory plugin in the UI. A 4-tier (L0–L3) layered-memory + context-compression engine that keeps long sessions coherent and **cuts token usage by up to ~61%**. Fully local (SQLite), no API key, Docker-ready.
- ⚡ **Token-lean defaults for every new bot**: Ships with context pruning (cache-TTL) + `safeguard` compaction — **cheaper & sharper long conversations** with zero tuning.
- 🎯 **Per-bot & per-channel Skills/Plugins**: Install/enable/disable a skill for **one bot only** (no more leaking across bots); the panel shows only what fits each channel (Zalo / Telegram / Messenger).
- 📤 **Reliable file sending on Zalo & Telegram**: Bots now know the correct outbound ritual (`media/outbound` + `message` tool) and to use modern formats like `.xlsx` — no more "the file won't send".
- 🐳 **One-click Docker controls**: Restart / Rebuild the bot container and grant it disk access (mount any host folder at `/mnt/<name>`, cross-OS) right from the dashboard — restart your bot without touching the command line.
- ⚡ **Faster Dashboard & Bot pages**: Runtime/version detection now probes **once** and is cached instead of re-running on every page load — bot status dropped from ~4s to ~3ms on repeat loads. Cache auto-invalidates on update/rebuild/restart/install.

</details>

<details>
<summary><b>Previous: What's new in v5.8.24 (Launcher Auto-Update)</b></summary>

- **Fix: Cached Launcher Out-of-Sync**: Automatically detects if the running launcher (e.g. downloaded via `npx`) has a newer/different version than the cached installation inside `~/.openclaw-setup`, and automatically triggers an upgrade to match.

</details>

<details>
<summary><b>Previous: What's new in v5.8.23 (Memory Skill Integration)</b></summary>

- **New: Long-Term Memory & Skill Auto-Evolution (learning-memory)**: Pre-integrates the autonomous memory and learning skill from ClawHub.
  - Automatically records newly learned facts, instructions, and user preferences into `MEMORY.md` in real-time.
  - Enables agents to self-package and compile newly acquired behaviors and workflows into reusable `.js` and `SKILL.md` files directly within the `./skills/` folder, allowing the bot to organically evolve its capabilities.
  - Implements OS-agnostic post-install triggers on all platforms (Docker, Windows, macOS, Linux) without requiring manual setup.
- **New: UI Skill Toggle**: Added the "Siêu Trí Nhớ Dài Hạn" (learning-memory) toggle option directly to the Setup Wizard interface with full installation logic support.

</details>

<details>
<summary><b>Previous: What's new in v5.8.22</b></summary>

- **Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

</details>

---

## ✨ Features

- 🤖 **Multi-Channel** — Telegram (single or multi-bot relay), Zalo Bot API, Zalo Personal, and Facebook Messenger (Discord & Lark coming soon).
- 🧑‍🤝‍🧑 **Multi-Bot Team** — Run multiple Telegram/Zalo bots simultaneously with synchronized workspaces and teamwork.
- 🧠 **Unified AI Routing via 9Router** — Easily route messages to Google Gemini, Claude, GPT-4o, OpenRouter, and Ollama (local offline models).
- 🧩 **Built-in Skills** — Web Search, Browser Automation (Chrome CDP), and Cron/Scheduler tasks.
- 🔌 **Integrated Marketplace** — Install advanced plugins (like `openclaw-zalo-mod`, Facebook Crawler...) with a single click.
- 🔀 **9Router Integration** — Open-source OAuth-based AI proxy that gets you up and running for free without individual API keys.
- 🔒 **Safe & Private** — All configurations and API keys are stored locally on your own machine.

---

## 🗺️ Quick Start

### 1️⃣ Method 1 — Quick install (Recommended)

Open your terminal and run this single command (works on macOS, Linux & Windows — needs Node.js 24 LTS):

```bash
npx create-openclaw-bot
```

It downloads the wizard, starts the local server, and opens the Setup UI in your browser at **http://127.0.0.1:51789**.

### 2️⃣ Method 2 — Run the newest GitHub source

Use this if you specifically want the newest code directly from GitHub:

```bash
npx github:tuanminhhole/openclaw-setup
```

> **Git is required for this method.** Install [Git](https://git-scm.com/downloads) and make sure the `git` command works in your terminal first; otherwise npm cannot download the GitHub repository.

### 3️⃣ Method 3 — Manual clone (for developers)

For contributors who want the full source. Run each line in order:

```bash
git clone https://github.com/tuanminhhole/openclaw-setup.git
cd openclaw-setup
npm install
npm start
```

Then open **http://127.0.0.1:51789** if the browser doesn't open by itself.

> ⚠️ `npm install` / `npm start` only work **inside the cloned `openclaw-setup` folder**. If you used either npx method, simply run the same npx command again when you want to reopen Setup.

### 🔁 Reopen the UI later

Run the recommended command again. Setup detects and reopens your existing project:

```bash
npx create-openclaw-bot
```

### ⬆️ Update to the newest version

Click **Update** in the **top-right corner of the Setup interface**. It downloads the newest version and restarts the UI automatically; the current browser tab reconnects on its own.

---

## 📋 System Prerequisites

- **Node.js 24 LTS** (required) — the Setup wizard itself runs on Node, so it's needed for **both** Docker and Native modes. [Download Node.js](https://nodejs.org/).
- **Git**: Installed and available in your environment PATH.
- **Docker Desktop** (recommended, for the bot runtime): Docker Compose V2. [Download Docker](https://www.docker.com/products/docker-desktop/).

---

## 🚀 Step-by-step Setup Guide

> First time? Follow these in order — no terminal needed beyond opening the UI.

**1. Open the Setup UI** — run the install command above; the dashboard opens in your browser.

**2. Pick OS & run mode** — first make sure [Node.js 24 LTS](https://nodejs.org/) is installed (the wizard runs on Node — needed for **both** modes). Then open the **Setup** tab, choose your OS and the run mode:
- **Docker** (recommended) — isolated, and lets you create **multiple projects/bots**. Also install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
- **Native** — lighter, runs the bot directly on the host (no Docker needed).

**3. Project path & name** — enter a folder path and a project name (example name: `bot`), then click **Install**. Example paths:
- Windows: `D:\bot`
- macOS: `/Users/<you>/bot`
- Linux: `/home/<you>/bot`

**4. Log in to 9Router** — click **Open 9Router website**, then log in with the default password **`123456`**.

**5. Create an API key (9Router)** — in **Endpoints**, create a new API key. Then open your project folder → `openclaw.json` → scroll to the **`models`** section → paste the key into the empty `apiKey` field and save.

**6. Connect a provider (9Router)** — go to **Providers**, pick the provider you want; it connects automatically.

**7. Create the routing combo (9Router)** — go to **Combos**, create a combo named exactly **`smart-route`** and add the models it should route to.

**8. Create your bot** — back in the Setup UI, choose a channel, fill in the bot info + your personal info, then click **Create bot**.

**9. Restart & test** — restart the bot container, then message your bot to test it. 🎉

---

## 🧠 Supported AI Providers (via 9Router)

- [9Router GitHub](https://github.com/decolua/9router)

---

## 🔌 Supported Channels

- **Telegram**: Acquire your official Bot Token from `@BotFather`.
- **Zalo Bot API**: Obtain credentials from [developers.zalo.me](https://developers.zalo.me).
- **Zalo Personal**: Scan the QR authorization image displayed on the OpenClaw Dashboard.
- **Facebook Messenger**: Via the `fb-messenger` plugin (public on ClawHub, installable from the Setup UI) — just provide a Page token.
- **Discord**: _Coming soon._
- **Lark**: _Coming soon._

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

## ⭐ Repository Stars

<div align="center">

<a href="https://github.com/tuanminhhole/openclaw-setup/stargazers"><img src="https://img.shields.io/github/stars/tuanminhhole/openclaw-setup?style=for-the-badge&logo=github&color=eab308" alt="GitHub Stars" /></a>
<a href="https://github.com/tuanminhhole/openclaw-setup/forks"><img src="https://img.shields.io/github/forks/tuanminhhole/openclaw-setup?style=for-the-badge&logo=github&color=0ea5e9" alt="GitHub Forks" /></a>

</div>

---

## 🙏 Acknowledgments

- [OpenClaw](https://openclaw.ai) — Core AI Gateway framework
- [9Router](https://github.com/decolua/9router) — Open-source AI proxy (OAuth-based, no API keys)
- [ClawHub](https://clawhub.com) — Bot skills registry
- [TheSVG](https://thesvg.org) — High-quality SVG brand icons

---

## 🙌 Author & Contributing

Built by **[tuanminhhole (Kent)](https://github.com/tuanminhhole)** as an open gift for the community.
Suggestions and PRs are always welcome. If this saved you time, please ⭐ the repo so more people can find it!

---

## 🦞 OpenClaw Ecosystem (same author)

Companion repos to build a complete, self-running AI assistant:

**🚀 Setup & framework**
- [openclaw-setup](https://github.com/tuanminhhole/openclaw-setup) — *(this repo)* Set up free AI bots with OpenClaw + 9Router (Telegram/Zalo/Messenger, Docker)
- [vietbrain](https://github.com/tuanminhhole/vietbrain) — Vietnamese "Second Brain" framework for Obsidian (AI-ready)

**🔌 Plugins (runtime)**
- [openclaw-fb-messenger](https://github.com/tuanminhhole/openclaw-fb-messenger) — Facebook Messenger channel (webhook + Graph API), installable from the Setup UI
- [openclaw-telegram-multibot-relay](https://github.com/tuanminhhole/openclaw-telegram-multibot-relay) — Multibot Telegram relay, delegation & native cron reminders
- [openclaw-zalo-connect](https://github.com/tuanminhhole/openclaw-zalo-connect) — Personal Zalo channel/runtime with QR login, native mentions and group actions
- [openclaw-zalo-mod](https://github.com/tuanminhhole/openclaw-zalo-mod) — Zero-token Zalo group management (slash commands, anti-spam, warn, memory)
- [openclaw-browser-automation](https://github.com/tuanminhhole/openclaw-browser-automation) — Smart Search & Browser Automation
- [openclaw-facebook-crawler](https://github.com/tuanminhhole/openclaw-facebook-crawler) — Facebook data crawler
- [openclaw-n8n-facebook-poster](https://github.com/tuanminhhole/openclaw-n8n-facebook-poster) — Auto-post to Facebook via n8n

**🧩 Skills**
- [openclaw-skill-learning-memory](https://github.com/tuanminhhole/openclaw-skill-learning-memory) — Self-evolving long-term memory for agents
- [openclaw-skill-infographic](https://github.com/tuanminhhole/openclaw-skill-infographic) — Infographic generation

---

<div align="center">
<sub>🦞 <b>openclaw-setup</b> · part of the <a href="https://github.com/tuanminhhole">tuanminhhole (Kent)</a> ecosystem · MIT License</sub>
</div>
