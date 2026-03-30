# 🦞 OpenClaw — Hướng Dẫn Kỹ Thuật (cho AI Agent)

> **File này dành cho AI Agent (Antigravity) đọc và thực thi tự động.**
> Người dùng đã tạo sẵn file `.env` chứa API key và Bot token. AI **TUYỆT ĐỐI KHÔNG** được yêu cầu hoặc nhận credentials qua chat.

[English](SETUP.md) · [Tiếng Việt](#-quy-tắc-bảo-mật--bắt-buộc)

---

## 🔐 Quy Tắc Bảo Mật — BẮT BUỘC

> **AI Agent BẮT BUỘC tuân thủ TẤT CẢ quy tắc bên dưới. Vi phạm = DỪNG ngay.**

### File & thư mục hệ thống

- ❌ **KHÔNG** đọc, sao chép, hoặc truy cập bất kỳ file nào ngoài thư mục project
- ❌ **KHÔNG** quét hoặc liệt kê các thư mục hệ thống: `Documents`, `Desktop`, `Downloads`, `AppData`, `%USERPROFILE%`
- ❌ **KHÔNG** truy cập registry, system32, hoặc Program Files
- ❌ **KHÔNG** cài đặt phần mềm, driver, hoặc service ngoài Docker
- ❌ **KHÔNG** sửa đổi biến môi trường hệ thống
- ✅ **CHỈ** làm việc trong thư mục project do người dùng chỉ định

### API key & credentials

- ❌ **KHÔNG BAO GIỜ** hiển thị API key, token, hoặc mật khẩu trong chat
- ❌ **KHÔNG** viết API key trực tiếp vào mã nguồn
- ❌ **KHÔNG** commit file credentials lên Git
- ✅ **LUÔN** lưu credentials trong file `.env` riêng
- ✅ **LUÔN** thêm `.env` vào `.gitignore`
- ✅ **LUÔN** dùng biến môi trường (`${VAR}`) thay vì hardcode

### Ví crypto & tài sản số

- ❌ **TUYỆT ĐỐI KHÔNG** truy cập, đọc, hoặc quét các thư mục ví crypto:
  - Metamask, Trust Wallet, Phantom, Exodus, Electrum
  - File: `wallet.dat`, `keystore/`, seed phrases, private keys
  - Extension trình duyệt chứa ví crypto
- ❌ **KHÔNG** quét clipboard (có thể chứa seed phrases)
- ❌ **KHÔNG** truy cập browser profile, cookie, hoặc mật khẩu đã lưu
- ❌ **KHÔNG** cài đặt npm package lạ (chỉ `openclaw` và plugin chính thức)

### Docker

- ✅ Chỉ mount **đúng** thư mục cần thiết (config + workspace)
- ❌ **KHÔNG** mount nguyên ổ đĩa (`C:/` hoặc `D:/`)
- ❌ **KHÔNG** chạy container với `--privileged`
- ✅ Giới hạn port expose (chỉ `18789`)

---

## 📂 Cấu Trúc Thư Mục Sau Setup

```
<PROJECT_DIR>/
├── .openclaw/                    ← Config chính (KHÔNG commit)
│   ├── openclaw.json             ← Gateway, agent, channel config
│   ├── auth-profiles.json        ← API key profile
│   ├── credentials/
│   │   └── <provider>            ← API key của nhà cung cấp AI
│   ├── agents/
│   │   └── <agent-name>.yaml    ← Định nghĩa agent (chỉ name + model)
│   ├── workspace/                ← ⭐ Persona & hành vi bot
│   │   ├── IDENTITY.md           ← Tên bot, emoji, vibe
│   │   ├── SOUL.md               ← Tính cách, ranh giới
│   │   ├── AGENTS.md             ← Quy tắc vận hành
│   │   ├── USER.md               ← Thông tin người dùng
│   │   ├── TOOLS.md              ← Hướng dẫn dùng tools
│   │   └── MEMORY.md             ← Bộ nhớ dài hạn
│   ├── skills/                   ← Slash commands (tùy chọn)
│   ├── identity/
│   │   └── device.json           ← Device keypair
│   ├── memory/                   ← Bộ nhớ agent (SQLite)
│   ├── cron/jobs.json
│   └── logs/
│       └── config-audit.jsonl
│
├── docker/openclaw/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env                      ← API keys (KHÔNG commit)
│
└── .gitignore
```

---

## 🔌 Kênh & Model Hỗ Trợ

### Kênh chat

| Kênh | Key trong .env | Plugin cần cài |
|------|---------------|----------------|
| **Telegram** | `TELEGRAM_BOT_TOKEN` | Không (built-in) |
| **Zalo Bot API** | `ZALO_BOT_TOKEN` | `@openclaw/zalo` |
| **Zalo Cá nhân** | Không cần | `@openclaw/zalouser` |

### Nhà cung cấp AI

| Nhà cung cấp | Key trong .env | Model ID format |
|--------------|---------------|-----------------|
| **Google Gemini** | `GOOGLE_API_KEY` | `google/gemini-2.5-flash` |
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | `anthropic/claude-sonnet-4` |
| **OpenAI** | `OPENAI_API_KEY` | `openai/gpt-4o` |
| **OpenRouter** | `OPENROUTER_API_KEY` | `openrouter/model-name` |
| **Ollama** | `OLLAMA_HOST` | `ollama/qwen3:8b` |

### Logic phát hiện kênh:

```
NẾU .env chứa TELEGRAM_BOT_TOKEN → Kênh = Telegram
NẾU .env chứa ZALO_BOT_TOKEN → Kênh = Zalo Bot API
NGƯỢC LẠI → Kênh = Zalo Cá nhân (hoặc hỏi người dùng)
```

### Logic phát hiện AI provider:

```
NẾU .env chứa GOOGLE_API_KEY → Provider = Google Gemini
NẾU .env chứa ANTHROPIC_API_KEY → Provider = Anthropic
NẾU .env chứa OPENAI_API_KEY → Provider = OpenAI
NẾU .env chứa OPENROUTER_API_KEY → Provider = OpenRouter
NẾU .env chứa OLLAMA_HOST → Provider = Ollama
```

---

## ⚙️ Các Bước Setup

### Bước 1: Tạo thư mục

```bash
mkdir -p <PROJECT_DIR>/docker/openclaw
mkdir -p <PROJECT_DIR>/.openclaw/credentials
mkdir -p <PROJECT_DIR>/.openclaw/agents
mkdir -p <PROJECT_DIR>/.openclaw/skills
mkdir -p <PROJECT_DIR>/.openclaw/identity
mkdir -p <PROJECT_DIR>/.openclaw/memory
mkdir -p <PROJECT_DIR>/.openclaw/cron
mkdir -p <PROJECT_DIR>/.openclaw/logs
mkdir -p <PROJECT_DIR>/.openclaw/completions
mkdir -p <PROJECT_DIR>/.openclaw/canvas
```

### Bước 2: Tạo Dockerfile

Tạo `<PROJECT_DIR>/docker/openclaw/Dockerfile`:

#### Telegram (không cần plugin):

```dockerfile
FROM node:22-slim
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g openclaw@latest
WORKDIR /root/.openclaw
EXPOSE 18789
CMD ["openclaw", "gateway", "run"]
```

#### Zalo Bot API:

```dockerfile
FROM node:22-slim
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g openclaw@latest
RUN openclaw plugins install @openclaw/zalo
WORKDIR /root/.openclaw
EXPOSE 18789
CMD ["openclaw", "gateway", "run"]
```

#### Zalo Cá nhân:

```dockerfile
FROM node:22-slim
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g openclaw@latest
RUN openclaw plugins install @openclaw/zalouser
WORKDIR /root/.openclaw
EXPOSE 18789
CMD ["openclaw", "gateway", "run"]
```

#### Có thêm plugin (ví dụ Browser + Memory):

```dockerfile
FROM node:22-slim
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g openclaw@latest
# Cài plugin kênh chat + plugin mở rộng
RUN openclaw plugins install @openclaw/zalo @openclaw/browser @openclaw/memory
WORKDIR /root/.openclaw
EXPOSE 18789
CMD ["openclaw", "gateway", "run"]
```

### Bước 3: Tạo docker-compose.yml

Tạo `<PROJECT_DIR>/docker/openclaw/docker-compose.yml`:

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

> Thay `<PROJECT_DIR>` bằng đường dẫn tuyệt đối thực tế. Ví dụ: `D:/MyAIBot/.openclaw:/root/.openclaw`

### Bước 4: Kiểm tra file .env (do người dùng đã tạo)

File `.env` đã được người dùng tạo tại `<PROJECT_DIR>/docker/openclaw/.env`.

**AI Agent PHẢI kiểm tra:**
1. File `.env` **tồn tại** tại `<PROJECT_DIR>/docker/openclaw/.env`
2. File chứa ít nhất 1 API key hợp lệ
3. **KHÔNG** đọc hoặc hiển thị giá trị key trong chat

Nếu file không tồn tại → **DỪNG** và yêu cầu người dùng tạo theo hướng dẫn trong README.

> **KHÔNG BAO GIỜ** tạo file `.env` thay người dùng. **KHÔNG BAO GIỜ** yêu cầu credentials qua chat.

### Bước 5: Tạo .gitignore

Tạo `<PROJECT_DIR>/.gitignore`:

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

### Bước 6: Tạo cấu hình OpenClaw

**AI Agent thực hiện:**

1. Đọc API key (và channel token nếu có) từ `.env`
2. Phát hiện kênh chat và AI provider theo logic ở trên
3. Generate random gateway auth token
4. Ghi giá trị vào các file config bên dưới
5. **KHÔNG** hiển thị key/token trong chat

**Generate gateway auth token:**

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

#### Config cho Telegram + Google Gemini (ví dụ):

**Tạo `<PROJECT_DIR>/.openclaw/openclaw.json`:**

```json
{
  "meta": { "lastTouchedVersion": "2026.3.27" },
  "agents": {
    "defaults": {
      "model": { "primary": "google/gemini-2.5-flash", "fallbacks": [] },
      "compaction": { "mode": "safeguard" }
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
      "botToken": "<BOT_TOKEN_TỪ_.ENV>",
      "allowFrom": ["*"],
      "groupPolicy": "allowlist",
      "streaming": "partial"
    }
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "auth": { "mode": "token", "token": "<GATEWAY_TOKEN_ĐÃ_GENERATE>" }
  }
}
```

#### Config kênh Zalo Bot API:

Thay phần `channels` bằng:

```json
{ "channels": { "zalo": { "enabled": true, "botToken": "<ZALO_BOT_TOKEN_TỪ_.ENV>" } } }
```

#### Config kênh Zalo Cá nhân:

Thay phần `channels` bằng:

```json
{ "channels": { "zalouser": { "enabled": true } } }
```

> **Lưu ý:** Zalo Cá nhân cần quét QR code sau khi container chạy. Xem QR trong logs: `docker logs openclaw-bot`

---

**Tạo `<PROJECT_DIR>/.openclaw/auth-profiles.json`** — dùng API key tương ứng:

```json
{ "gemini": { "apiKey": "<GOOGLE_API_KEY_TỪ_.ENV>" } }
```

_(Đổi `gemini` thành `anthropic`, `openai`, `openrouter` tùy provider)_

**Tạo `<PROJECT_DIR>/.openclaw/credentials/<provider>`** — ghi API key (1 dòng, không xuống dòng).

**Tạo `<PROJECT_DIR>/.openclaw/cron/jobs.json`:**

```json
{ "version": 1, "jobs": [] }
```

### Bước 7: Tạo Agent & Workspace Files

#### 7a. Agent YAML (chỉ metadata, KHÔNG chứa system_prompt)

Tạo file YAML tại `.openclaw/agents/<tên>.yaml`. Ví dụ — `.openclaw/agents/chat.yaml`:

```yaml
name: chat
description: "Trợ lý AI cá nhân"

model:
  primary: google/gemini-2.5-flash
```

> **Lưu ý:** File YAML chỉ khai báo `name`, `description`, `model`. Tính cách bot nằm ở workspace files bên dưới.

#### 7b. Workspace Markdown Files (⭐ Bot nhận diện từ đây)

OpenClaw **tự động inject** tất cả file `.md` trong `.openclaw/workspace/` vào context đầu mỗi session. Đây là cách bot "biết" tên mình, tính cách, và quy tắc.

| File | Mục đích | Bắt buộc |
|------|----------|----------|
| `IDENTITY.md` | Tên bot, emoji, cách xưng hô | ✅ |
| `SOUL.md` | Tính cách, phong cách, ranh giới | ✅ |
| `AGENTS.md` | Quy tắc vận hành, cách trả lời | ✅ |
| `USER.md` | Thông tin về user (ngôn ngữ, sở thích) | Nên có |
| `TOOLS.md` | Hướng dẫn dùng tool/skill | Nên có |
| `MEMORY.md` | Bộ nhớ dài hạn (bot tự cập nhật) | Tùy chọn |

> **Thứ tự ưu tiên:** Per-agent files (`.openclaw/agents/<id>/`) → Global workspace files (`.openclaw/workspace/`) → Config defaults.

> **Bảo mật hệ thống** (không xóa file, không truy cập thư mục nhạy cảm, không lộ API key...) được OpenClaw **tự động áp dụng** — không cần viết vào workspace files.

#### 7c. Cập nhật `openclaw.json`

Thêm agent vào `agents.list`:

```json
{
  "agents": {
    "list": [
      { "id": "chat", "model": { "primary": "google/gemini-2.5-flash", "fallbacks": [] } }
    ]
  }
}
```

### Bước 8: Build & Chạy

```bash
cd <PROJECT_DIR>/docker/openclaw
docker compose build
docker compose up -d
docker logs -f openclaw-bot
```

### Bước 9: Kiểm tra

**Telegram:**
1. Mở Telegram → Tìm bot của bạn
2. Gửi tin nhắn bất kỳ
3. Bot trả lời = **Thành công!** 🎉

**Zalo Bot API:**
1. Mở Zalo → Tìm bot
2. Gửi tin nhắn
3. Bot trả lời = **Thành công!** 🎉

**Zalo Cá nhân:**
1. Xem `docker logs openclaw-bot` để lấy QR code
2. Quét QR bằng app Zalo
3. Gửi tin nhắn từ tài khoản Zalo khác
4. Bot trả lời = **Thành công!** 🎉

Nếu bot không phản hồi:

```bash
docker logs openclaw-bot --tail 50
docker compose restart
```

Nếu bot **không tạo được cron job** (lỗi "pairing required"):

```bash
docker exec -i openclaw-bot openclaw devices approve --latest
```

> **Lưu ý:** Từ OpenClaw v2026.3.x, gateway yêu cầu device pairing cho CLI connections. Dockerfile đã tự động approve khi khởi động, nhưng nếu lỗi vẫn xảy ra, chạy lệnh trên 1 lần.

---

## ✅ Checklist Bảo Mật Sau Setup

- [ ] `.env` **không** xuất hiện trong `git status`
- [ ] `.openclaw/credentials/` **không** bị Git track
- [ ] `openclaw.json` **không** bị Git track
- [ ] Docker **không** mount nguyên ổ đĩa
- [ ] Gateway auth token được generate ngẫu nhiên
- [ ] Zalo Cá nhân: đang dùng tài khoản **phụ** (nếu có)
