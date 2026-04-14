# OpenClaw - Kien truc thu muc va secrets hien tai

Tai lieu nay mo ta dung behavior code hien tai cua wizard sau khi da dong bo lai native/docker va logic `.env`.

## Pham vi ho tro hien tai

- Native: `win`, `macos`, `linux-desktop`, `vps`
- Docker: cung mot cau truc file cho moi OS, chi khac launcher script tai ve
- Channel ho tro:
  - `telegram`
  - `zalo-bot`
  - `zalo-personal`
- Multi-bot: chi ap dung cho `telegram`
- Combo `telegram + zalo-*`: hien khong duoc wizard UI mo ra

## Nguyen tac chung

- `OPENCLAW_HOME = {projectDir}/.openclaw`
- `OPENCLAW_STATE_DIR = {projectDir}/.openclaw`
- `DATA_DIR = {projectDir}/.9router`
- `agents.list[].agentDir` la duong dan relative theo `OPENCLAW_HOME`
- `agents.list[].workspace` cung la duong dan relative theo `OPENCLAW_HOME`
- Workspace luon dung format `workspace-{slug}`, ke ca single bot

## Secrets va .env

### Native

Native setup hien tai tao `{projectDir}/.env` va cac script native deu load file nay truoc khi chay `openclaw gateway run`.

`.env` trong native dung de luu:

- API key cua direct provider, vd `OPENAI_API_KEY`, `GEMINI_API_KEY`, ...
- channel token khi can:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_BOT_TOKEN_1..N` cho telegram multi-bot
  - `ZALO_BOT_TOKEN` cho `zalo-bot`
- `TELEGRAM_GROUP_ID` neu user nhap group id
- env vars cua skills da chon

Luu y:

- `9router` khong can AI API key trong `.env`
- nhung neu channel la `telegram` hoac `zalo-bot` thi `.env` van co token channel
- `zalo-personal` khong dung bot token; login bang `openclaw channels login --channel zalouser --verbose`

### Docker

Docker setup hien tai tao ca hai file:

- `{projectDir}/.env`
- `{projectDir}/docker/openclaw/.env`

Trong do:

- root `.env` la ban ghi secrets tai project root de user de theo doi/chinh sua
- `docker/openclaw/.env` la file duoc `docker compose` nap vao container

## Provider auth

- Direct provider va provider local van co `.openclaw/auth-profiles.json`
- Per-agent `auth-profiles.json` duoc tao trong `.openclaw/agents/{slug}/agent/` khi khong dung `9router`
- Khi dung `9router`, khong tao root/per-agent `auth-profiles.json`
- Khi dung `9router`, provider endpoint duoc khai bao trong `.openclaw/openclaw.json -> models.providers.9router`

## Cau truc chuan theo case

### Case 1: Single bot

Ap dung cho:

- `telegram` single bot
- `zalo-bot`
- `zalo-personal`

```text
{projectDir}/
|-- .env                              # native secrets; docker cung co ban root nay
|-- .openclaw/
|   |-- openclaw.json
|   |-- exec-approvals.json
|   |-- auth-profiles.json            # chi khi khong dung 9router
|   |-- agents/
|   |   |-- {slug}.yaml
|   |   `-- {slug}/agent/
|   |       `-- auth-profiles.json    # chi khi khong dung 9router
|   `-- workspace-{slug}/
|       |-- IDENTITY.md
|       |-- SOUL.md
|       |-- AGENTS.md
|       |-- USER.md
|       |-- TOOLS.md
|       |-- MEMORY.md
|       |-- browser-tool.js           # neu bat browser
|       `-- BROWSER.md                # neu bat browser
|-- .9router/
|   `-- 9router-smart-route-sync.js   # chi khi provider = 9router
|-- start-bot.bat / start-bot.sh      # chi native
|-- start-chrome-debug.bat/sh         # neu bat browser va native
|-- uninstall-openclaw-*.bat/sh
`-- docker/
    `-- openclaw/
        |-- Dockerfile                # chi docker mode
        |-- docker-compose.yml        # chi docker mode
        `-- .env                      # chi docker mode
```

### Case 2: Telegram multi-bot

```text
{projectDir}/
|-- .env
|-- .openclaw/
|   |-- openclaw.json
|   |-- exec-approvals.json
|   |-- auth-profiles.json            # chi khi khong dung 9router
|   |-- agents/
|   |   |-- {bot1}.yaml
|   |   |-- {bot2}.yaml
|   |   |-- {bot1}/agent/auth-profiles.json   # chi khi khong dung 9router
|   |   `-- {bot2}/agent/auth-profiles.json   # chi khi khong dung 9router
|   |-- workspace-{bot1}/
|   |   |-- IDENTITY.md
|   |   |-- SOUL.md
|   |   |-- AGENTS.md
|   |   |-- USER.md
|   |   |-- TOOLS.md
|   |   |-- MEMORY.md
|   |   |-- browser-tool.js           # neu bat browser
|   |   `-- BROWSER.md                # neu bat browser
|   `-- workspace-{bot2}/
|       |-- IDENTITY.md
|       |-- SOUL.md
|       |-- AGENTS.md
|       |-- USER.md
|       |-- TOOLS.md
|       |-- MEMORY.md
|       |-- browser-tool.js           # neu bat browser
|       `-- BROWSER.md                # neu bat browser
|-- TELEGRAM-POST-INSTALL.md
|-- .9router/
|   `-- 9router-smart-route-sync.js   # chi khi provider = 9router
|-- start-bot.bat / start-bot.sh      # chi native
|-- uninstall-openclaw-*.bat/sh
`-- docker/
    `-- openclaw/
        |-- Dockerfile                # chi docker mode
        |-- docker-compose.yml        # chi docker mode
        `-- .env                      # chi docker mode
```

Ghi chu multi-bot:

- `openclaw.json` co `channels.telegram.accounts` cho tung bot
- moi workspace co `AGENTS.md` mo ta handoff/routing
- wizard hien khong tao file rieng `TEAM.md` hay `RELAY.md`
- noi dung team coordination da duoc nhap vao `AGENTS.md`
- noi dung security da duoc nhap vao `AGENTS.md`
- noi dung relay da duoc nhap vao `TOOLS.md`

## Hanh vi theo channel

### Telegram single

- co `TELEGRAM_BOT_TOKEN` trong `.env`
- native script load `.env` roi chay gateway
- docker dung `docker/openclaw/.env`

### Telegram multi-bot

- co `TELEGRAM_BOT_TOKEN_1..N` va co the co `TELEGRAM_GROUP_ID` trong `.env`
- `openclaw.json` van co `channels.telegram.accounts` cho tung bot
- relay plugin `openclaw-telegram-multibot-relay` duoc bat

### Zalo Bot API

- co `ZALO_BOT_TOKEN` trong `.env`
- code hien cung de san `ZALO_APP_ID` va `ZALO_APP_SECRET` placeholder
- native va docker deu can secrets nay

### Zalo Personal

- khong co bot token trong `.env`
- native: script tu dong mo flow login `zalouser`
- docker: user chay lenh login sau khi container da len

## Danh sach file khong nen tao

- khong tao `agents/` o project root
- khong tao `.openclaw/workspace` chung kieu cu
- khong tao `models.json` trong agent dir khi dung `9router`
- khong tao Docker artifacts trong native mode
- khong tao root/per-agent `auth-profiles.json` khi dung `9router`
- khong tao file rieng `TEAM.md` / `RELAY.md` trong wizard hien tai

## Ket luan thuc te hien tai

Sau khi chinh code:

- logic tao thu muc `.openclaw`, `workspace-{slug}`, `auth-profiles.json` da dong bo hon giua native va docker
- native va docker deu co `.env` de ghi nhan secrets theo provider/channel
- 4 OS native deu load project `.env` truoc khi start gateway
- tai lieu nay mo ta code thuc te hien tai, khong mo ta combo modes dang tam ngung trong UI
