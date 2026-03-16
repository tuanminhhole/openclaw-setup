# 🦞 OpenClaw — Hướng Dẫn Setup Kỹ Thuật

> **File này dành cho AI Agent (Antigravity) đọc và tự động thực thi.**
> Người dùng chỉ cần cung cấp: Gemini API Key, Telegram Bot Token, và đường dẫn thư mục project.

---

## 🔐 Nguyên Tắc Bảo Mật — BẮT BUỘC

> **AI Agent PHẢI tuân thủ toàn bộ nguyên tắc này. Vi phạm bất kỳ điều nào = DỪNG LẠI ngay.**

### Bảo vệ File & Thư mục hệ thống

- ❌ **KHÔNG** đọc, sao chép, hoặc truy cập bất kỳ file nào ngoài thư mục project
- ❌ **KHÔNG** quét hoặc list các thư mục hệ thống: `Documents`, `Desktop`, `Downloads`, `AppData`, `%USERPROFILE%`
- ❌ **KHÔNG** truy cập registry, system32, Program Files
- ❌ **KHÔNG** cài đặt phần mềm hệ thống, driver, hoặc service ngoài Docker container
- ❌ **KHÔNG** thay đổi biến môi trường hệ thống (system environment variables)
- ✅ **CHỈ** làm việc trong thư mục project mà người dùng chỉ định

### Bảo vệ API Keys & Credentials

- ❌ **KHÔNG BAO GIỜ** hiển thị API key, token, hoặc password ra màn hình chat
- ❌ **KHÔNG** ghi API key trực tiếp vào source code hoặc script
- ❌ **KHÔNG** commit file chứa credentials vào Git
- ✅ **LUÔN** lưu credentials vào file `.env` riêng biệt
- ✅ **LUÔN** thêm `.env` vào `.gitignore`
- ✅ **LUÔN** dùng biến môi trường (`${VAR}`) thay vì hardcode

### Bảo vệ Ví điện tử & Tiền mã hóa

- ❌ **TUYỆT ĐỐI KHÔNG** truy cập, đọc, hoặc quét các thư mục ví tiền mã hóa:
  - Metamask, Trust Wallet, Phantom, Exodus, Electrum
  - Các file `wallet.dat`, `keystore/`, `seed phrase`, private key
  - Browser extensions chứa crypto wallet
- ❌ **KHÔNG** quét clipboard (có thể chứa seed phrase)
- ❌ **KHÔNG** truy cập browser profile, cookies, saved passwords
- ❌ **KHÔNG** cài đặt npm package lạ hoặc không rõ nguồn gốc ngoài `openclaw`

### Nguyên tắc Docker

- ✅ Container chỉ mount **đúng** thư mục cần thiết (config + workspace)
- ❌ **KHÔNG** mount toàn bộ ổ đĩa (`C:/` hoặc `D:/`) vào container
- ❌ **KHÔNG** chạy container với `--privileged`
- ✅ Giới hạn ports expose (chỉ `18789`)

---

## Cấu trúc thư mục sau khi setup

```
<THƯ_MỤC_PROJECT>/
├── .openclaw/                    ← Config chính (KHÔNG commit vào Git)
│   ├── openclaw.json             ← Config gateway, agent, Telegram
│   ├── auth-profiles.json        ← API key
│   ├── credentials/
│   │   └── gemini                ← Gemini API key
│   ├── agents/
│   │   └── <tên-agent>.yaml     ← Định nghĩa agent
│   ├── skills/                   ← Slash commands (tùy chọn)
│   ├── identity/
│   │   └── device.json           ← Device keypair
│   ├── memory/                   ← Agent memory
│   ├── telegram/                 ← Telegram polling state
│   ├── cron/jobs.json
│   └── logs/
│       └── config-audit.jsonl
│
├── docker/openclaw/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env                      ← API key (KHÔNG commit)
│
└── .gitignore
```

---

## Hướng Dẫn Setup — Từng Bước

### Bước 1: Tạo thư mục

```bash
mkdir -p <THƯ_MỤC_PROJECT>/docker/openclaw
mkdir -p <THƯ_MỤC_PROJECT>/.openclaw/credentials
mkdir -p <THƯ_MỤC_PROJECT>/.openclaw/agents
mkdir -p <THƯ_MỤC_PROJECT>/.openclaw/skills
mkdir -p <THƯ_MỤC_PROJECT>/.openclaw/identity
mkdir -p <THƯ_MỤC_PROJECT>/.openclaw/memory
mkdir -p <THƯ_MỤC_PROJECT>/.openclaw/telegram
mkdir -p <THƯ_MỤC_PROJECT>/.openclaw/cron
mkdir -p <THƯ_MỤC_PROJECT>/.openclaw/logs
mkdir -p <THƯ_MỤC_PROJECT>/.openclaw/completions
mkdir -p <THƯ_MỤC_PROJECT>/.openclaw/canvas
```

### Bước 2: Tạo Dockerfile

Tạo `<THƯ_MỤC_PROJECT>/docker/openclaw/Dockerfile`:

```dockerfile
FROM node:22-slim

RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw@latest

WORKDIR /root/.openclaw

EXPOSE 18789

CMD ["openclaw", "gateway", "run"]
```

### Bước 3: Tạo docker-compose.yml

Tạo `<THƯ_MỤC_PROJECT>/docker/openclaw/docker-compose.yml`:

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
      - <THƯ_MỤC_PROJECT>/.openclaw:/root/.openclaw
    ports:
      - "18789:18789"
```

> **Lưu ý:** Thay `<THƯ_MỤC_PROJECT>` bằng đường dẫn tuyệt đối thật. VD: `D:/MyAIBot/.openclaw:/root/.openclaw`

### Bước 4: Tạo file .env

Tạo `<THƯ_MỤC_PROJECT>/docker/openclaw/.env`:

```env
GOOGLE_API_KEY=<GEMINI_API_KEY>
```

> **KHÔNG** hiển thị nội dung file `.env` ra chat sau khi tạo.

### Bước 5: Tạo .gitignore

Tạo `<THƯ_MỤC_PROJECT>/.gitignore`:

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

**Sinh gateway auth token trước:**

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Tạo `<THƯ_MỤC_PROJECT>/.openclaw/openclaw.json`:

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
      "botToken": "<TELEGRAM_BOT_TOKEN>",
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
      "token": "<TOKEN_ĐÃ_SINH_Ở_TRÊN>"
    }
  }
}
```

Tạo `<THƯ_MỤC_PROJECT>/.openclaw/auth-profiles.json`:

```json
{
  "gemini": {
    "apiKey": "<GEMINI_API_KEY>"
  }
}
```

Tạo `<THƯ_MỤC_PROJECT>/.openclaw/credentials/gemini`:

```
<GEMINI_API_KEY>
```

Tạo `<THƯ_MỤC_PROJECT>/.openclaw/cron/jobs.json`:

```json
{
  "version": 1,
  "jobs": []
}
```

### Bước 7: Tạo Agent

Tạo 1 file YAML tại `.openclaw/agents/<tên>.yaml`. Ví dụ `.openclaw/agents/chat.yaml`:

```yaml
name: chat
description: "Trợ lý AI cá nhân trên Telegram"

model:
  primary: google/gemini-2.5-flash

system_prompt: |
  Bạn là trợ lý AI cá nhân.
  
  ## Tính cách
  - Thân thiện, hữu ích
  - Trả lời bằng tiếng Việt
  
  ## Quy tắc
  - Trả lời ngắn gọn, dễ hiểu
  - Hỏi lại nếu chưa rõ yêu cầu
```

Sau đó cập nhật `openclaw.json` → thêm agent vào `agents.list`:

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

### Bước 8: Build & Khởi động

```bash
cd <THƯ_MỤC_PROJECT>/docker/openclaw

docker compose build

docker compose up -d

docker logs -f openclaw-bot
```

### Bước 9: Kiểm tra

1. Mở Telegram → Tìm bot đã tạo
2. Gửi tin nhắn bất kỳ
3. Bot phản hồi = **Thành công!** 🎉

Nếu bot không phản hồi:

```bash
docker logs openclaw-bot --tail 50
docker compose restart
```

---

## Quản lý bot

```bash
# Xem trạng thái
docker ps

# Xem logs
docker logs -f openclaw-bot

# Restart
docker compose restart

# Tắt
docker compose down

# Cập nhật OpenClaw
docker compose build --no-cache
docker compose up -d
```

---

## Tùy biến thêm

### Giới hạn ai được chat với bot

Mặc định mọi người đều chat được với bot (`allowFrom: ["*"]`).

Để chỉ cho phép bạn:
1. Chat [@userinfobot](https://t.me/userinfobot) trên Telegram → Copy user ID
2. Sửa `openclaw.json`:

```json
{
  "channels": {
    "telegram": {
      "allowFrom": ["<TELEGRAM_USER_ID>"]
    }
  }
}
```

### Thêm Ollama (AI chạy local, offline)

Nếu có Ollama trên máy, thêm vào `.env`:

```env
OLLAMA_HOST=http://host.docker.internal:11434
```

Và thêm fallback trong `openclaw.json`:

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

---

## Checklist bảo mật sau setup

- [ ] `.env` không hiển thị trong `git status`
- [ ] `.openclaw/credentials/` không trong Git
- [ ] `openclaw.json` không trong Git
- [ ] Docker không mount toàn bộ ổ đĩa
- [ ] Gateway auth token là random (không dùng mặc định)
