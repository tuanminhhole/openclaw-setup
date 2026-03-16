<div align="center">

# 🦞 OpenClaw Setup

**Create your own free AI Telegram Bot in 3 minutes.**

[![OpenClaw](https://img.shields.io/badge/OpenClaw-Gateway-FF6B35?style=for-the-badge&logo=npm)](https://openclaw.ai)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-Free-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/BotFather)

[English](#-quick-start) · [Tiếng Việt](README.vi.md)

</div>

---

## 📋 Prerequisites

You need **4 things** (all free):

| # | What | How to get |
|---|------|------------|
| 1 | **Docker Desktop** | Download → [docker.com](https://www.docker.com/products/docker-desktop/) |
| 2 | **Antigravity IDE** | Download → [antigravity.dev](https://antigravity.dev/) |
| 3 | **Google AI API Key** | Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API Key** → Copy |
| 4 | **Telegram Bot Token** | Open Telegram → Search **@BotFather** → Send `/newbot` → Name your bot → Copy token |

---

## 🚀 Quick Start

### Step 1 — Start Docker

Make sure Docker Desktop is **running** (green icon in taskbar).

### Step 2 — Open Antigravity

Open Antigravity IDE → Create a new folder (e.g. `D:\MyAIBot`) → Open it as workspace.

### Step 3 — Create your `.env` file

> ⚠️ **NEVER** paste your API key or Bot Token into the chat. Always write them directly into a file.

1. Inside your project folder, create `docker/openclaw/`
2. Create `docker/openclaw/.env` with:

```env
GOOGLE_API_KEY=<your_api_key_here>
TELEGRAM_BOT_TOKEN=<your_bot_token_here>
```

3. Replace `<...>` with your actual key and token
4. Save the file

### Step 4 — Let AI do the rest

Open the Antigravity chat (`Ctrl + L`) and paste:

```
Read SETUP.md in this repo and set up OpenClaw for me.
I already created the .env file with my API key and Bot token.
My project folder: <YOUR_PATH — e.g. D:\MyAIBot>
```

The AI will **never** ask for your API key — it only creates config files, builds Docker, and starts the bot.

### Step 5 — Test your bot 🎉

1. Open Telegram → Find your bot
2. Send any message
3. Bot replies = **Success!**

---

## 📁 Repo Structure

```
README.md        ← You're here (English)
README.vi.md     ← Hướng dẫn tiếng Việt
SETUP.md         ← Technical guide for AI (English)
SETUP.vi.md      ← Hướng dẫn kỹ thuật cho AI (Tiếng Việt)
```

---

## ❓ FAQ

<details>
<summary><b>Is it really free?</b></summary>
Yes. Docker, Antigravity, Google Gemini API (free tier), and Telegram bots are all free.
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
Yes! See the "Create Agent" section in SETUP.md to set a custom name, personality, and language.
</details>

<details>
<summary><b>Is it safe?</b></summary>
Your API keys stay on your machine only. SETUP.md includes strict security rules that the AI must follow.
</details>

---

## 🔗 Links

- [OpenClaw Docs](https://openclaw.ai/docs)
- [Google AI Studio](https://aistudio.google.com/)
- [Telegram BotFather](https://t.me/BotFather)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

<div align="center">

Made with 🦞 by [Kent](https://github.com/tuanminhhole)

</div>
