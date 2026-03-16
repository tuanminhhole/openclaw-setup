<div align="center">

# 🦞 OpenClaw Setup

**Tạo AI Bot Telegram cá nhân miễn phí trong 3 phút.**

[![OpenClaw](https://img.shields.io/badge/OpenClaw-Gateway-FF6B35?style=for-the-badge&logo=npm)](https://openclaw.ai)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-Free-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/BotFather)

[English](README.md) · [Tiếng Việt](#-bắt-đầu-nhanh)

</div>

---

## 📋 Chuẩn Bị

Bạn cần **4 thứ** (tất cả miễn phí):

| # | Cần gì | Cách lấy |
|---|--------|----------|
| 1 | **Docker Desktop** | Tải tại 👉 [docker.com](https://www.docker.com/products/docker-desktop/) |
| 2 | **Antigravity IDE** | Tải tại 👉 [antigravity.dev](https://antigravity.dev/) |
| 3 | **Google AI API Key** | Vào [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API Key** → Copy |
| 4 | **Telegram Bot Token** | Mở Telegram → Tìm **@BotFather** → Gửi `/newbot` → Đặt tên → Copy token |

---

## 🚀 Bắt Đầu Nhanh

### Bước 1 — Mở Docker

Đảm bảo Docker Desktop đang **chạy** (icon màu xanh ở taskbar).

### Bước 2 — Mở Antigravity

Mở Antigravity IDE → Tạo thư mục mới (VD: `D:\MyAIBot`) → Mở nó trong Antigravity.

### Bước 3 — Tự tạo file `.env`

> ⚠️ **KHÔNG BAO GIỜ** gửi API key hay Bot Token vào chat. Luôn tự tay điền vào file.

1. Trong thư mục project, tạo thư mục `docker/openclaw/`
2. Tạo file `docker/openclaw/.env` với nội dung:

```env
GOOGLE_API_KEY=<paste_api_key_của_bạn>
TELEGRAM_BOT_TOKEN=<paste_token_bot_của_bạn>
```

3. Thay `<...>` bằng key/token thật
4. Lưu file

### Bước 4 — Nhờ AI setup

Mở chat Antigravity (`Ctrl + L`) rồi dán:

```
Đọc file SETUP.vi.md trong repo này và setup OpenClaw cho tôi.
Tôi đã tự tạo file .env với API key và Bot token rồi.
Thư mục project: <ĐƯỜNG_DẪN — VD: D:\MyAIBot>
```

AI sẽ **KHÔNG** hỏi API key — chỉ tạo config files, build Docker, và khởi động bot.

### Bước 5 — Test bot 🎉

1. Mở Telegram → Tìm bot bạn vừa tạo
2. Gửi tin nhắn bất kỳ
3. Bot phản hồi = **Thành công!**

---

## 📁 Cấu Trúc Repo

```
README.md        ← Hướng dẫn tiếng Anh
README.vi.md     ← Bạn đang đọc (Tiếng Việt)
SETUP.md         ← File kỹ thuật cho AI (English)
SETUP.vi.md      ← File kỹ thuật cho AI (Tiếng Việt)
```

---

## ❓ Câu Hỏi Thường Gặp

<details>
<summary><b>Có mất tiền không?</b></summary>
Không. Docker, Antigravity, Google Gemini API (free tier), Telegram bot — tất cả đều miễn phí.
</details>

<details>
<summary><b>Bot chạy ở đâu?</b></summary>
Trên máy tính của bạn (trong Docker container). Máy tắt thì bot tắt.
</details>

<details>
<summary><b>Muốn tắt/mở lại bot?</b></summary>

```bash
docker compose down      # Tắt
docker compose up -d     # Mở
```
</details>

<details>
<summary><b>Có tùy chỉnh bot được không?</b></summary>
Được! Xem phần "Tạo Agent" trong SETUP.vi.md để đặt tên, tính cách, ngôn ngữ cho bot.
</details>

<details>
<summary><b>An toàn không?</b></summary>
An toàn. API key chỉ lưu trên máy bạn. File SETUP.vi.md có quy tắc bảo mật chi tiết mà AI phải tuân thủ.
</details>

---

## 🔗 Liên Kết

- [OpenClaw Docs](https://openclaw.ai/docs)
- [Google AI Studio](https://aistudio.google.com/)
- [Telegram BotFather](https://t.me/BotFather)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

<div align="center">

Made with 🦞 by [Kent](https://github.com/tuanminhhole)

</div>
