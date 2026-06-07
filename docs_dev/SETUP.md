# OpenClaw Bot — Docker Deployment Guide

> **Cập nhật**: 25/05/2026
> **OpenClaw version**: 2026.5.22
> **Zalouser plugin**: 2026.5.22 (ClawHub official)
> **9Router**: 0.4.59

---

## Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────┐
│  Host: Windows                                          │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────┐           │
│  │  <bot>-ai         │    │  9router-<bot>    │          │
│  │  :18789 (gateway) │───▶│  :20128 (API)     │          │
│  │  OpenClaw + Zalo  │    │  Smart Route      │          │
│  │  + Telegram       │    │                   │          │
│  └──────────────────┘    └──────────────────┘           │
│          │                        │                     │
│          ▼                        ▼                     │
│  <PROJECT>:/root/project     9router-data (volume)      │
│  <TMP>:/tmp/openclaw                                    │
└─────────────────────────────────────────────────────────┘
```

| Container | Image | Port | Vai trò |
|-----------|-------|------|---------|
| `<bot>-ai` | Custom (Dockerfile) | `18789` | OpenClaw Gateway + Zalo + Telegram |
| `9router-<bot>` | `node:22-slim` | `20128` | AI model router (OpenRouter, Gemini, v.v.) |

> Trong hướng dẫn này:
> - `<PROJECT>` = thư mục gốc trên host (VD: `D:\my-bot`)
> - `<bot>` = tên bot tự đặt (VD: `assistant`, `mybot`)
> - `<TMP>` = thư mục tạm (VD: `D:\tmp\openclaw`)

---

## Cấu Trúc Thư Mục

```
<PROJECT>\
├── docker\openclaw\          ← Docker config
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── entrypoint.sh         ← Script khởi động (QUAN TRỌNG)
│   ├── .env                  ← API keys
│   ├── patch_container.js    ← Patch SSRF check
│   ├── patch-9router.js      ← Patch 9router auth
│   └── sync.js               ← Auto-sync smart-route combo
│
├── .openclaw\                ← OpenClaw data (mounted vào container)
│   ├── openclaw.json         ← Config chính
│   ├── workspace\            ← Agent identity files
│   │   ├── AGENTS.md
│   │   ├── IDENTITY.md
│   │   ├── SOUL.md
│   │   ├── TOOLS.md
│   │   └── ...
│   ├── agents\               ← Agent sessions + auth
│   ├── credentials\          ← Login credentials (Zalo, Telegram)
│   ├── extensions\           ← ClawHub plugins
│   ├── npm\                  ← npm-installed plugins
│   ├── plugins\              ← Plugin registry
│   └── plugins-data\         ← Plugin runtime data
│
└── <TMP>\                    ← Log files + QR images
```

---

## 1. Docker Compose

**File**: `docker/openclaw/docker-compose.yml`

```yaml
name: <bot>

services:
  <bot>:
    build: .
    container_name: <bot>-ai
    restart: always
    env_file:
      - .env
    depends_on:
      - 9router
    extra_hosts:
      - "host.docker.internal:host-gateway"   # Để container gọi host services
    volumes:
      - <PROJECT>:/root/project                # Project mount
      - <TMP>:/tmp/openclaw                    # Logs + QR images
    ports:
      - "18789:18789"                          # Gateway UI + API
      - "127.0.0.1:18790:18790"               # Internal
    command: ["/bin/sh", "/root/project/docker/openclaw/entrypoint.sh"]  # ⚠️ QUAN TRỌNG
    environment:
      - OPENCLAW_HOME=/root/project/.openclaw
      - OPENCLAW_STATE_DIR=/root/project/.openclaw
      - LOG_LEVEL=debug
      - OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1
      - OPENCLAW_GATEWAY_PORT=18789
      - OPENCLAW_PORT=18789
      - GEMINI_API_KEY=${GOOGLE_API_KEY}
    tmpfs:
      - /root/project/.openclaw/plugin-runtime-deps

  9router:
    image: node:22-slim
    container_name: 9router-<bot>
    restart: always
    entrypoint:
      - /bin/sh
      - -c
      - |
        rm -rf /usr/local/lib/node_modules/9router /usr/local/lib/node_modules/.9router* || true
        npm install -g 9router@latest better-sqlite3
        node /tmp/patch-9router.js || true
        node /tmp/sync.js > /tmp/sync.log 2>&1 &
        exec 9router -n -l -H 0.0.0.0 -p 20128 --skip-update
    environment:
      - PORT=20128
      - HOSTNAME=0.0.0.0
      - CI=true
      - NINE_ROUTER_DB_PATH=/root/.9router/db/data.sqlite
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - GEMINI_API_KEY=${GOOGLE_API_KEY}
    volumes:
      - 9router-data:/root/.9router
      - ./sync.js:/tmp/sync.js:ro
      - ./patch-9router.js:/tmp/patch-9router.js:ro
    ports:
      - "20128:20128"

volumes:
  9router-data:
```

> ⚠️ **`command:` override là BẮT BUỘC!**
> Dockerfile COPY `entrypoint.sh` vào image lúc build. Nếu sửa entrypoint trên host mà không rebuild image, bản cũ trong image vẫn chạy. Dùng `command:` để force chạy từ volume mount.

---

## 2. Dockerfile

```dockerfile
FROM node:22-slim

RUN apt-get update && apt-get install -y git curl python3 xvfb socat && rm -rf /var/lib/apt/lists/*

RUN npm install -g agent-browser playwright \
    && npx playwright install chromium --with-deps

ARG OPENCLAW_VER="openclaw@latest"
ARG CACHE_BUST=""
RUN echo "CACHE_BUST=$CACHE_BUST" && npm install -g $OPENCLAW_VER

COPY entrypoint.sh /usr/local/bin/openclaw-entrypoint.sh
RUN chmod +x /usr/local/bin/openclaw-entrypoint.sh

WORKDIR /root/project

EXPOSE 18789 18790

CMD ["/bin/sh", "/usr/local/bin/openclaw-entrypoint.sh"]
```

Rebuild khi cần update OpenClaw version:
```powershell
docker compose -f <PROJECT>\docker\openclaw\docker-compose.yml build --no-cache --build-arg CACHE_BUST=$(date +%s) <bot>
```

---

## 3. Entrypoint — Các Patch Quan Trọng

**File**: `docker/openclaw/entrypoint.sh`

Entrypoint chạy khi container khởi động, thực hiện:

| Bước | Mô tả | Tại sao cần |
|------|-------|-------------|
| `patch_container.js` | Disable SSRF platform check | OpenClaw block private network trên win32 |
| Backup config | Copy `openclaw.json` → backup trước khi OpenClaw ghi đè | OpenClaw có thể reset config khi boot |
| Normalize permissions | `chmod 755/644` cho extensions + npm plugins | Windows bind mount = mode 777, OpenClaw reject |
| Patch world-writable | Sửa `modeBits & 2` check | Cùng lý do trên |
| Auto-approve devices | Background loop approve pending devices | Không cần manual approve |
| **Restore config** | Restore agents/channels/gateway từ backup | Giữ config user không bị OpenClaw reset |
| **`bind: "lan"`** | Force gateway bind `0.0.0.0` | ⚠️ Docker cần `0.0.0.0`, `loopback` = chỉ trong container |
| **Workspace path fix** | Replace `/mnt/d/...` → `/root/project/` | ⚠️ Path WSL khác path Docker mount |

### 3 Config Quan Trọng Nhất

```javascript
// Gateway bind — PHẢI là "lan" cho Docker
c.gateway.bind = "lan";

// Workspace path — PHẢI dùng Docker mount path
// Thay /mnt/d/<project-folder>/ bằng regex phù hợp project của bạn
c.agents.defaults.workspace = c.agents.defaults.workspace
  .replace(/^\/mnt\/d\/.*?\//, "/root/project/");
```

> ⛔ `bind: "loopback"` → UI gateway bị lỗi WebSocket 1006 (disconnected), không truy cập được từ browser.
>
> ⛔ Workspace path sai → bot không biết mình là ai, trả lời kiểu "Who am I? Who are you?"

---

## 4. OpenClaw Config — Các Section Quan Trọng

**File**: `.openclaw/openclaw.json`

### 4.1 Agent — Dùng 1 Agent Duy Nhất

```json
{
  "agents": {
    "defaults": {
      "workspace": "/root/project/.openclaw/workspace",
      "model": { "primary": "smart-route" },
      "timeoutSeconds": 300
    },
    "list": [
      {
        "id": "<bot>-chat",
        "name": "<Bot Name>",
        "model": { "primary": "smart-route", "fallbacks": [] }
      }
    ]
  }
}
```

> ⚠️ Chỉ dùng **1 agent duy nhất** — bind cả Zalo + Telegram vào cùng agent.
> Không cần tách agent theo kênh.

> ⚠️ `workspace` PHẢI là `/root/project/.openclaw/workspace` — KHÔNG dùng `/mnt/d/...`

### 4.2 Gateway

```json
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "lan",
    "controlUi": {
      "allowedOrigins": ["http://localhost:18789", "*"]
    },
    "auth": {
      "mode": "token",
      "token": "<gateway-token>"
    }
  }
}
```

> ⚠️ `bind` PHẢI là `"lan"` cho Docker. Không dùng `"loopback"`.

### 4.3 Models — 9Router

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "9router": {
        "baseUrl": "http://host.docker.internal:20128/v1",
        "apiKey": "<9router-api-key>",
        "api": "openai-completions",
        "request": { "allowPrivateNetwork": true },
        "models": [
          { "id": "smart-route", "name": "Smart Route (Auto)", "contextWindow": 200000 },
          { "id": "gemini/gemini-2.5-flash", "name": "Gemini 2.5 Flash", "contextWindow": 1000000 }
        ]
      }
    }
  }
}
```

> ⚠️ `allowPrivateNetwork: true` BẮT BUỘC cho Docker internal network.

### 4.4 Channels — Zalo + Telegram

```json
{
  "channels": {
    "zalouser": {
      "enabled": true,
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["*"],
      "historyLimit": 50,
      "accounts": {
        "default": { "enabled": true, "groupPolicy": "allowlist" }
      },
      "groups": {
        "*": { "enabled": true, "requireMention": false }
      }
    },
    "telegram": {
      "enabled": true,
      "defaultAccount": "default",
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["*"],
      "streaming": { "mode": "partial", "chunkMode": "newline" },
      "actions": { "sendMessage": true, "reactions": true },
      "accounts": {
        "default": { "botToken": "<telegram-bot-token>" }
      }
    }
  }
}
```

### 4.5 Bindings — 1 Agent, 2 Kênh

```json
{
  "bindings": [
    { "agentId": "<bot>-chat", "match": { "channel": "zalouser" } },
    { "agentId": "<bot>-chat", "match": { "channel": "telegram", "accountId": "default" } }
  ]
}
```

> Cả 2 kênh (Zalo + Telegram) đều bind vào **cùng 1 agent**.
> Bot đọc cùng workspace (AGENTS.md, SOUL.md, ...) → tính cách nhất quán trên mọi kênh.

### 4.6 Plugins

```json
{
  "plugins": {
    "allow": ["zalouser", "zalo-mod"],
    "entries": {
      "zalouser": { "enabled": true }
    }
  }
}
```

---

## 5. Zalo Channel — Setup & Login

### 5.1 Cài plugin

**Tự động**: `entrypoint.sh` tự cài zalouser từ npm mỗi lần container start nếu chưa có.
Không cần cài thủ công — plugin sẽ có sẵn sau lần boot đầu tiên.

> ⚠️ **Luôn dùng npm**, không dùng ClawHub (`clawhub:@openclaw/zalouser`).
> Lý do: Bản ClawHub báo `error:not configured` dù credentials đúng.
> `entrypoint.sh` dùng `npm install --prefix` trực tiếp (không qua openclaw CLI)
> để tránh modify `openclaw.json` trong quá trình install.

### 5.2 Login QR — Quy Trình Đầy Đủ

Khi cần login (lần đầu, hoặc session expired), chạy **đúng thứ tự** 4 bước:

```bash
# Bước 1: Xóa credentials cũ + QR image cũ (tránh "Already linked" error)
docker exec <bot>-ai rm -f /root/project/.openclaw/credentials/zalouser/credentials.json
rm -f <TMP>\openclaw-zalouser-qr-default.png

# Bước 2: Tạo QR mới
docker exec <bot>-ai openclaw channels login --channel zalouser

# Bước 3: Mở QR image → scan bằng Zalo app trên điện thoại
# QR lưu tại: <TMP>\openclaw-zalouser-qr-default.png
# ⚠️ QR hết hạn sau ~60 giây — scan nhanh!

# Bước 4: Sau khi "Login successful" → restart gateway
docker restart <bot>-ai
```

> ⛔ **PHẢI restart** sau login — nếu chỉ login mà không restart, channel vẫn ở trạng thái `stopped`.

### 5.3 Kiểm tra trạng thái

Đợi ~90 giây sau restart rồi kiểm tra:

```bash
docker exec <bot>-ai openclaw channels status --probe
```

Kết quả mong đợi:
```
- Zalo Personal default: enabled, configured, running, dm:open, works
```

### 5.4 Các trạng thái lỗi và cách xử lý

| Trạng thái | Nghĩa | Xử lý |
|-----------|-------|-------|
| `running, works` | ✅ Hoạt động bình thường | Không cần làm gì |
| `stopped, error:logged out` | Session hết hạn | Chạy lại quy trình login 4 bước ở 5.2 |
| `stopped, error:not configured` | Credentials thiếu, plugin chưa load, hoặc **`installs.json` thiếu `channels` array** (xem 5.6) | Kiểm tra 5.6 trước, nếu không fix → login lại |
| `health:not-running` | Gateway chưa ready | Đợi thêm 1-2 phút rồi check lại |
| `"Already linked"` khi login | Credentials cũ chưa xóa | Xóa credentials trước (Bước 1 ở 5.2) |

### 5.5 Lưu ý về Credential Persistence

- Credentials Zalo lưu tại: `<PROJECT>/.openclaw/credentials/zalouser/credentials.json`
- File này được **mount từ host** → persist qua restart, nhưng **mất khi recreate container** nếu không giữ volume
- Nếu Zalo bị logout phía server (do login device khác, v.v.) → phải scan QR lại

### 5.6 Bug: `error:not configured` dù credentials đúng

**Triệu chứng**: Login thành công, credentials file tồn tại, `checkZaloAuthenticated()` trả `true`, nhưng channel vẫn `stopped, error:not configured`.

**Root cause**: OpenClaw regenerate `installs.json` mỗi lần boot nhưng **KHÔNG thêm `channels` array** cho npm-installed plugins. Gateway dùng `channels: ["zalouser"]` trong manifest registry để quyết định plugin nào có channel cần start. Thiếu array này → gateway coi zalouser là non-channel plugin → không gọi `startAccount()`.

**Thêm 1 bug liên quan**: OpenClaw cũng **xóa `plugins.allow`** khỏi `openclaw.json` nếu bất kỳ plugin nào trong list chưa cài (VD: `zalo-mod`). Khi mất `plugins.allow`, gateway chỉ load bundled plugins và bỏ qua npm plugins hoàn toàn.

**Fix**: `entrypoint.sh` đã có background watcher tự động:
1. Inject `plugins.allow: ["zalouser"]` vào `openclaw.json` trước boot
2. Inject `channels: ["zalouser"]` vào `installs.json` sau khi gateway refresh registry
3. Lặp lại 3 lần mỗi 15 giây để đảm bảo gateway migration không ghi đè

**Verify fix đang hoạt động**:
```bash
# Check plugins.allow
docker exec <bot>-ai node -e "const c=JSON.parse(require('fs').readFileSync('/root/project/.openclaw/openclaw.json','utf8')); console.log('plugins.allow:', c.plugins?.allow)"

# Check installs.json channels
docker exec <bot>-ai node -e "const j=JSON.parse(require('fs').readFileSync('/root/project/.openclaw/plugins/installs.json','utf8')); const z=j.plugins.find(p=>p.pluginId==='zalouser'); console.log('channels:', z?.channels)"
```

### 5.7 Bug: QR không tạo được khi version OpenClaw ≠ version Zalouser

**Triệu chứng**: `openclaw channels login --channel zalouser` load plugin thành công, hiện "Generating QR login..." nhưng rồi fail với `Still preparing QR. Call wait to continue checking login status.` — QR image không bao giờ được tạo.

**Root cause**: Khi version OpenClaw gateway (VD: `2026.5.18`) khác version zalouser plugin (VD: `2026.5.22`), plugin API contract có thể không khớp. CLI `channels login` tạo một mini-gateway process riêng để handle login, nhưng plugin async QR generation timeout trước khi QR sẵn sàng do incompatibility giữa host contract và plugin version.

**Kiểm tra**:
```bash
# Version OpenClaw
docker exec <bot>-ai openclaw --version

# Version zalouser plugin
docker exec <bot>-ai node -e "const p=require('/root/project/.openclaw/npm/node_modules/@openclaw/zalouser/package.json');console.log(p.version)"
```

**Fix**: Đảm bảo cả 2 cùng version hoặc tương thích:
```bash
# Update OpenClaw gateway lên latest
docker compose -f <PROJECT>\docker\openclaw\docker-compose.yml build --no-cache --build-arg CACHE_BUST=$(date +%s) <bot>
docker compose -f <PROJECT>\docker\openclaw\docker-compose.yml up -d --force-recreate <bot>

# Hoặc pin zalouser plugin cùng version với gateway
openclaw plugins install @openclaw/zalouser@<gateway-version>
```

> ⚠️ Setup UI (`create-openclaw-bot`) dùng phiên bản OpenClaw cố định trong Dockerfile (`openclaw@latest` tại thời điểm build), nhưng `entrypoint.sh` cài zalouser plugin từ npm `@latest` — có thể dẫn đến mismatch nếu plugin phát hành sau.

---

## 6. Telegram Channel — Setup


Telegram là **built-in plugin** trong OpenClaw — không cần cài từ npm/ClawHub.

### 6.1 Tạo Bot Token

1. Mở Telegram, chat với [@BotFather](https://t.me/BotFather)
2. Gửi `/newbot`, đặt tên và username
3. Copy token (dạng `123456789:ABCdef...`)

### 6.2 Thêm channel + Enable plugin

Chạy **đúng thứ tự** 3 bước:

```bash
# Bước 1: Thêm Telegram channel với bot token
docker exec <bot>-ai openclaw channels add --channel telegram --token "<BOT_TOKEN>"

# Bước 2: Enable plugin entry
docker exec <bot>-ai openclaw config set plugins.entries.telegram.enabled true

# Bước 3: Restart gateway
docker restart <bot>-ai
```

> ⚠️ Chỉ config JSON (`channels.telegram.enabled: true` + `botToken`) là **KHÔNG ĐỦ**.
> PHẢI dùng `openclaw channels add` để OpenClaw đăng ký channel đúng cách.

### 6.3 Kiểm tra

```bash
docker exec <bot>-ai openclaw channels status --probe
```

Kết quả mong đợi:
```
- Telegram default: enabled, configured, running, connected, mode:polling, bot:@<bot_username>, works
```

### 6.4 Lưu ý

- Token lưu trong `openclaw.json` → persist qua restart
- Lỗi `REACTION_INVALID` trong log là bình thường (emoji không support) — không ảnh hưởng nhắn tin
- Nếu cần đổi token: sửa `channels.telegram.accounts.default.botToken` trong `openclaw.json` rồi restart

---

## 7. 9Router — Cấu Hình

### 7.1 API Keys

**File**: `docker/openclaw/.env`

```env
GOOGLE_API_KEY=<gemini-key>
OPENROUTER_API_KEY=<openrouter-key>
OPENAI_API_KEY=<9router-internal-key>
```

### 7.2 Smart Route Combo

`sync.js` tự động:
1. Disable `requireLogin` trong SQLite DB
2. Tạo combo `smart-route` từ tất cả active providers
3. Chạy mỗi 30 giây

### 7.3 Auth Patch

`patch-9router.js` bypass remote API auth gate để container OpenClaw gọi 9router mà không cần login.

---

## 8. Troubleshooting — Bảng Lỗi Thường Gặp

### 8.1 UI Gateway

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| **WebSocket 1006 disconnected** | `gateway.bind = "loopback"` | Đổi thành `"lan"` trong cả `openclaw.json` và `entrypoint.sh` |
| **UI không load** | Container chưa ready | Đợi ~90s sau restart, check `docker logs <bot>-ai --tail 5` |
| **"handshake-timeout"** | Gateway đang busy load plugins | Đợi thêm, plugin zalouser load mất 15-90s |

### 8.2 Zalo Bot

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| **Bot không reply trên Zalo** | Channel `stopped` / session expired | Chạy quy trình login 4 bước ở **Section 5.2** |
| **"Something went wrong"** | Model error hoặc session corrupt | Gửi `/new` để tạo session mới |
| **"Already linked" khi login** | Credentials cũ còn tồn tại | Xóa credentials trước khi login (Bước 1 ở 5.2) |
| **Bot reply bằng tiếng Anh / "Who am I?"** | Workspace path sai → không đọc được AGENTS.md | Fix `workspace` = `/root/project/.openclaw/workspace` |
| **`error:not configured` dù config đúng** | Plugin từ ClawHub không tương thích | `entrypoint.sh` tự fix khi restart — hoặc recreate container |

### 8.3 Telegram Bot

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| **Telegram không hiện trong `channels status`** | Chưa chạy `openclaw channels add` | Chạy quy trình 3 bước ở **Section 6.2** |
| **Không có log `[telegram]` khi startup** | Cùng lý do trên, hoặc `plugins.entries.telegram.enabled` = false | Chạy `openclaw config set plugins.entries.telegram.enabled true` + restart |
| **Bot không reply** | `botToken` sai hoặc channel chưa add | Kiểm tra token từ BotFather, chạy lại Section 6.2 |
| **`REACTION_INVALID` trong log** | Emoji reaction không support | Bỏ qua — không ảnh hưởng nhắn tin |
| **Bot reply chậm** | Model timeout hoặc 9router chưa ready | Check `docker logs <bot>-ai --since 2m` |

### 8.4 9Router

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| **Model timeout** | 9Router chưa start xong | Đợi ~30s, check: `docker logs 9router-<bot> --tail 10` |
| **401 Unauthorized** | `requireLogin = true` trong DB | `sync.js` tự fix, hoặc restart 9router |
| **Không có models** | API keys sai | Check `.env` file |

---

## 9. Quick Reference — Commands

### Quản lý container

```powershell
# Restart bot
docker restart <bot>-ai

# Recreate (giữ data)
docker compose -f <PROJECT>\docker\openclaw\docker-compose.yml up -d --force-recreate --no-deps <bot>

# Rebuild image (update OpenClaw version)
docker compose -f <PROJECT>\docker\openclaw\docker-compose.yml build --no-cache <bot>
docker compose -f <PROJECT>\docker\openclaw\docker-compose.yml up -d --force-recreate <bot>

# Xem logs
docker logs <bot>-ai --tail 30
docker logs <bot>-ai --since 5m
```

### Quản lý channels

```powershell
# Status tất cả channels
docker exec <bot>-ai openclaw channels status --probe

# Zalo login
docker exec <bot>-ai openclaw channels login --channel zalouser

# Zalo logout
docker exec <bot>-ai openclaw channels logout --channel zalouser

# Xóa Zalo credentials (force fresh login)
docker exec <bot>-ai rm -f /root/project/.openclaw/credentials/zalouser/credentials.json
```

### Quản lý plugins

```powershell
# Cài plugin từ ClawHub
docker exec <bot>-ai openclaw plugins install clawhub:@openclaw/zalouser

# Check version
docker exec <bot>-ai openclaw --version
```

### Debug nhanh

```powershell
# Check workspace path
docker exec <bot>-ai grep workspace /root/project/.openclaw/openclaw.json

# Check gateway bind
docker exec <bot>-ai grep bind /root/project/.openclaw/openclaw.json

# Check plugin load
docker logs <bot>-ai 2>&1 | findstr "loading zalouser"

# Check channel status
docker exec <bot>-ai openclaw channels status --probe

# Check message activity
docker logs <bot>-ai --since 5m 2>&1 | findstr "message received dispatch Sent"
```

---

## 10. Path Mapping — Cheat Sheet

| Host (Windows) | Container (Linux) | Ghi chú |
|----------------|-------------------|---------|
| `<PROJECT>\` | `/root/project/` | Volume mount chính |
| `<PROJECT>\.openclaw\` | `/root/project/.openclaw/` | OpenClaw data |
| `<PROJECT>\.openclaw\workspace\` | `/root/project/.openclaw/workspace/` | Agent identity files |
| `<TMP>\` | `/tmp/openclaw/` | Logs + QR images |
| ~~`/mnt/d/<folder>/`~~ | ~~WSL path~~ | ❌ **KHÔNG dùng** trong Docker config |

> ⚠️ Trong Docker container, **LUÔN** dùng `/root/project/...` — KHÔNG dùng `/mnt/d/...`
>
> Path `/mnt/d/` có thể tồn tại trong container (Docker Desktop mount) nhưng chứa **bản file cũ/khác** so với volume mount `/root/project/`.

---

## 11. Checklist Sau Mỗi Lần Thay Đổi Config

- [ ] `gateway.bind` = `"lan"` (không phải `"loopback"`)
- [ ] `agents.defaults.workspace` = `"/root/project/.openclaw/workspace"`
- [ ] `agents.list` chỉ có **1 agent duy nhất**
- [ ] `bindings` bind cả `zalouser` + `telegram` vào cùng agent
- [ ] `models.providers.9router.baseUrl` = `"http://host.docker.internal:20128/v1"`
- [ ] `models.providers.9router.request.allowPrivateNetwork` = `true`
- [ ] `channels.zalouser.enabled` = `true`
- [ ] `channels.telegram.enabled` = `true`
- [ ] `channels.telegram.accounts.default.botToken` đã điền
- [ ] `plugins.entries.zalouser.enabled` = `true`
- [ ] `command:` override trong docker-compose.yml trỏ đến volume entrypoint
- [ ] Channel status = `running, works` (chạy `openclaw channels status --probe`)
