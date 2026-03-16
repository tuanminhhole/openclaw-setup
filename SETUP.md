# 🦞 OpenClaw — Technical Setup Guide

> **This file is for AI Agents (Antigravity) to read and execute automatically.**
> The user has already created a `.env` file with their API key and Bot token. The AI must **NEVER** ask for or receive credentials through chat.

[English](#-security-rules--mandatory) · [Tiếng Việt](SETUP.vi.md)

---

## 🔐 Security Rules — MANDATORY

> **The AI Agent MUST follow ALL rules below. Any violation = STOP immediately.**

### System files & directories

- ❌ **DO NOT** read, copy, or access any file outside the project folder
- ❌ **DO NOT** scan or list system directories: `Documents`, `Desktop`, `Downloads`, `AppData`, `%USERPROFILE%`
- ❌ **DO NOT** access the registry, system32, or Program Files
- ❌ **DO NOT** install system software, drivers, or services outside Docker
- ❌ **DO NOT** modify system environment variables
- ✅ **ONLY** work within the user-specified project folder

### API keys & credentials

- ❌ **NEVER** display API keys, tokens, or passwords in chat
- ❌ **DO NOT** write API keys directly into source code or scripts
- ❌ **DO NOT** commit credential files to Git
- ✅ **ALWAYS** store credentials in a separate `.env` file
- ✅ **ALWAYS** add `.env` to `.gitignore`
- ✅ **ALWAYS** use environment variables (`${VAR}`) instead of hardcoding

### Crypto wallets & digital assets

- ❌ **ABSOLUTELY DO NOT** access, read, or scan crypto wallet directories:
  - Metamask, Trust Wallet, Phantom, Exodus, Electrum
  - Files: `wallet.dat`, `keystore/`, seed phrases, private keys
  - Browser extensions containing crypto wallets
- ❌ **DO NOT** scan the clipboard (may contain seed phrases)
- ❌ **DO NOT** access browser profiles, cookies, or saved passwords
- ❌ **DO NOT** install unknown npm packages (only `openclaw`)

### Docker isolation

- ✅ Only mount the **required** directories (config + workspace)
- ❌ **DO NOT** mount entire drives (`C:/` or `D:/`)
- ❌ **DO NOT** run containers with `--privileged`
- ✅ Limit exposed ports (only `18789`)

---

## 📂 Directory Structure After Setup

```
<PROJECT_DIR>/
├── .openclaw/                    ← Main config (DO NOT commit)
│   ├── openclaw.json             ← Gateway, agent, Telegram config
│   ├── auth-profiles.json        ← API key profile
│   ├── credentials/
│   │   └── gemini                ← Gemini API key
│   ├── agents/
│   │   └── <agent-name>.yaml    ← Agent definition
│   ├── skills/                   ← Slash commands (optional)
│   ├── identity/
│   │   └── device.json           ← Device keypair
│   ├── memory/                   ← Agent memory (SQLite)
│   ├── telegram/                 ← Telegram polling state
│   ├── cron/jobs.json
│   └── logs/
│       └── config-audit.jsonl
│
├── docker/openclaw/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env                      ← API keys (DO NOT commit)
│
└── .gitignore
```

---

## ⚙️ Setup Steps

### Step 1: Create directories

```bash
mkdir -p <PROJECT_DIR>/docker/openclaw
mkdir -p <PROJECT_DIR>/.openclaw/credentials
mkdir -p <PROJECT_DIR>/.openclaw/agents
mkdir -p <PROJECT_DIR>/.openclaw/skills
mkdir -p <PROJECT_DIR>/.openclaw/identity
mkdir -p <PROJECT_DIR>/.openclaw/memory
mkdir -p <PROJECT_DIR>/.openclaw/telegram
mkdir -p <PROJECT_DIR>/.openclaw/cron
mkdir -p <PROJECT_DIR>/.openclaw/logs
mkdir -p <PROJECT_DIR>/.openclaw/completions
mkdir -p <PROJECT_DIR>/.openclaw/canvas
```

### Step 2: Create Dockerfile

Create `<PROJECT_DIR>/docker/openclaw/Dockerfile`:

```dockerfile
FROM node:22-slim

RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw@latest

WORKDIR /root/.openclaw

EXPOSE 18789

CMD ["openclaw", "gateway", "run"]
```

### Step 3: Create docker-compose.yml

Create `<PROJECT_DIR>/docker/openclaw/docker-compose.yml`:

```yaml
services:
  ai-bot:
    build: .
    container_name: openclaw-bot
    restart: always
    env_file:
      - .env
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - <PROJECT_DIR>/.openclaw:/root/.openclaw
    ports:
      - "18789:18789"
```

> Replace `<PROJECT_DIR>` with the actual absolute path. Example: `D:/MyAIBot/.openclaw:/root/.openclaw`

### Step 4: Verify .env file (created by user)

The `.env` file has already been created by the user at `<PROJECT_DIR>/docker/openclaw/.env`.

**The AI Agent MUST verify:**
1. File `.env` **exists** at `<PROJECT_DIR>/docker/openclaw/.env`
2. File contains `GOOGLE_API_KEY=` and `TELEGRAM_BOT_TOKEN=`
3. **DO NOT** read or display the values in chat

If the file doesn't exist → **STOP** and ask the user to create it per the instructions in README.md.

> **NEVER** create the `.env` for the user. **NEVER** ask for credentials in chat.

### Step 5: Create .gitignore

Create `<PROJECT_DIR>/.gitignore`:

```gitignore
# Credentials
.openclaw/credentials/
.openclaw/auth-profiles.json
.openclaw/openclaw.json
.openclaw/identity/
docker/openclaw/.env

# Runtime data
.openclaw/memory/
.openclaw/logs/
.openclaw/completions/
.openclaw/telegram/
.openclaw/canvas/
```

### Step 6: Create OpenClaw configuration

**AI Agent performs:**

1. Read `GOOGLE_API_KEY` and `TELEGRAM_BOT_TOKEN` from `.env` (created in Step 4)
2. Generate a random gateway auth token
3. Write values into the config files below
4. **DO NOT** display any key/token in chat

**Generate gateway auth token:**

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

**Create `<PROJECT_DIR>/.openclaw/openclaw.json`** — replace `<BOT_TOKEN>` with the value from `.env`, `<GATEWAY_TOKEN>` with the generated token:

```json
{
  "meta": {
    "lastTouchedVersion": "2026.3.16"
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "google/gemini-2.5-flash",
        "fallbacks": []
      },
      "compaction": {
        "mode": "safeguard"
      }
    },
    "list": []
  },
  "commands": {
    "native": "auto",
    "nativeSkills": "auto",
    "restart": true,
    "ownerDisplay": "raw"
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "open",
      "botToken": "<BOT_TOKEN_FROM_.ENV>",
      "allowFrom": ["*"],
      "groupPolicy": "allowlist",
      "streaming": "partial"
    }
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "<GENERATED_GATEWAY_TOKEN>"
    }
  }
}
```

**Create `<PROJECT_DIR>/.openclaw/auth-profiles.json`** — use `GOOGLE_API_KEY` from `.env`:

```json
{
  "gemini": {
    "apiKey": "<GOOGLE_API_KEY_FROM_.ENV>"
  }
}
```

**Create `<PROJECT_DIR>/.openclaw/credentials/gemini`** — write the `GOOGLE_API_KEY` value (single line, no newline).

**Create `<PROJECT_DIR>/.openclaw/cron/jobs.json`:**

```json
{
  "version": 1,
  "jobs": []
}
```

### Step 7: Create an Agent

Create a YAML file at `.openclaw/agents/<name>.yaml`. Example — `.openclaw/agents/chat.yaml`:

```yaml
name: chat
description: "Personal AI assistant on Telegram"

model:
  primary: google/gemini-2.5-flash

system_prompt: |
  You are a personal AI assistant.
  
  ## Personality
  - Friendly and helpful
  - Reply in the user's language
  
  ## Rules
  - Keep answers concise
  - Ask for clarification when needed
```

Then update `openclaw.json` → add the agent to `agents.list`:

```json
{
  "agents": {
    "list": [
      {
        "id": "chat",
        "model": {
          "primary": "google/gemini-2.5-flash",
          "fallbacks": []
        }
      }
    ]
  }
}
```

### Step 8: Build & Start

```bash
cd <PROJECT_DIR>/docker/openclaw

docker compose build

docker compose up -d

docker logs -f openclaw-bot
```

### Step 9: Verify

1. Open Telegram → Find your bot
2. Send any message
3. Bot replies = **Success!** 🎉

If the bot doesn't respond:

```bash
docker logs openclaw-bot --tail 50
docker compose restart
```

---

## 🛠 Bot Management

```bash
docker ps                            # Status
docker logs -f openclaw-bot          # Live logs
docker compose restart               # Restart
docker compose down                  # Stop
docker compose build --no-cache      # Update OpenClaw
docker compose up -d                 # Start after update
```

---

## 🔧 Advanced Configuration

<details>
<summary><b>Restrict who can chat with the bot</b></summary>

By default `allowFrom: ["*"]` lets **everyone** DM the bot. To restrict:

1. Chat [@userinfobot](https://t.me/userinfobot) on Telegram → Copy your user ID
2. Edit `openclaw.json`:

```json
{
  "channels": {
    "telegram": {
      "allowFrom": ["<YOUR_TELEGRAM_USER_ID>"]
    }
  }
}
```
</details>

<details>
<summary><b>Add Ollama (local AI, offline)</b></summary>

If you have Ollama running locally, add to `.env`:

```env
OLLAMA_HOST=http://host.docker.internal:11434
```

And add a fallback in `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "fallbacks": ["ollama/qwen3:8b"]
      }
    }
  }
}
```
</details>

---

## ✅ Post-Setup Security Checklist

- [ ] `.env` is **not** visible in `git status`
- [ ] `.openclaw/credentials/` is **not** tracked by Git
- [ ] `openclaw.json` is **not** tracked by Git
- [ ] Docker does **not** mount entire drives
- [ ] Gateway auth token is randomly generated
