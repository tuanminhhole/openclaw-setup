<div align="center">

# 🦞 OpenClaw Setup

**Tạo AI Bot miễn phí trên Telegram hoặc Zalo chỉ trong vài phút.**

[![Version](https://img.shields.io/badge/Phi%C3%AAn%20b%E1%BA%A3n-3.0.2-FF6B35?style=for-the-badge)](CHANGELOG.md)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Gateway-FF6B35?style=for-the-badge&logo=npm)](https://openclaw.ai)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/BotFather)
[![Zalo](https://img.shields.io/badge/Zalo-Bot-0068FF?style=for-the-badge)](#kênh-hỗ-trợ)

<img src="https://flagcdn.com/24x18/vn.png" alt="Tiếng Việt" width="24" height="18"> **Tiếng Việt** · <img src="https://flagcdn.com/24x18/gb.png" alt="English" width="24" height="18"> [English](README.md)

</div>

---

## ✨ Tính năng

- 🤖 **Đa kênh** — Telegram, Zalo Bot API, hoặc Zalo Cá nhân
- 🧠 **Đa model AI** — Google Gemini, Claude, GPT-4o, Ollama, OpenRouter, 9Router
- 🧩 **Skills** — Web Search, Browser Automation, Memory, RAG, Code Interpreter, Image Gen...
- 🔌 **Plugins** — Voice Call, Matrix, MS Teams, Nostr
- 🔀 **9Router Proxy** — Không cần API key! Đăng nhập OAuth qua dashboard
- 🧙 **Setup Wizard** — Giao diện web đẹp, cấu hình mọi thứ trong 4 bước
- 🆓 **100% Miễn phí** — Google Gemini API free tier + Docker
- 🔒 **An toàn** — API key lưu trên máy bạn, không bao giờ bị lộ

---

## 📋 Chuẩn bị

Bạn cần **3 thứ** (miễn phí hết):

| # | Cần gì | Cách lấy |
|---|--------|----------|
| 1 | **Docker Desktop** | Tải tại [docker.com](https://www.docker.com/products/docker-desktop/) |
| 2 | **API Key AI** | Tùy model — xem [Nhà cung cấp AI](#-nhà-cung-cấp-ai) bên dưới |
| 3 | **Bot Token** | Xem [Kênh hỗ trợ](#-kênh-hỗ-trợ) bên dưới |

---

## 🧠 Nhà cung cấp AI

| Nhà cung cấp | Models | Giá | Cách lấy API Key |
|--------------|--------|-----|-------------------|
| **Google Gemini** | Gemini 2.5 Flash/Pro, 3.0 Flash | 🆓 Miễn phí | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Anthropic Claude** | Claude Sonnet 4, Opus 4, Haiku 3.5 | 💰 Trả phí | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **OpenAI / Codex** | GPT-4o, o3, Codex Mini | 💰 Trả phí (cần Plus/Pro) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **OpenRouter** | Rất nhiều model miễn phí & trả phí | 🆓/💰 | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Ollama** | Qwen 3, DeepSeek, Llama, Gemma... | 🏠 Local (miễn phí) | Cài [ollama.com](https://ollama.com) |
| **9Router** | Tự động route tới provider tốt nhất | 🔀 Proxy | Không cần API key — [github.com/decolua/9router](https://github.com/decolua/9router) |

> 🔀 **9Router** chạy cùng OpenClaw trong Docker. Sau khi `docker compose up`, mở `localhost:20128/dashboard` để đăng nhập OAuth. Không cần API key!

---

## 🔌 Kênh hỗ trợ

| Kênh | Loại | Cách lấy token |
|------|------|----------------|
| **Telegram** | ✅ Bot API chính thức | Mở Telegram → Tìm **@BotFather** → `/newbot` → Copy token |
| **Zalo Bot API** | ✅ Bot API chính thức | Vào [developers.zalo.me](https://developers.zalo.me) → Tạo bot → Copy token |
| **Zalo Cá nhân** | ⚠️ Unofficial | Login bằng QR code sau khi setup (không cần token) |

> ⚠️ **Zalo Cá nhân** dùng unofficial API. Tài khoản Zalo có thể bị hạn chế. Chỉ nên dùng tài khoản phụ.

---

## 🚀 Bắt đầu nhanh

### Cách A — Setup Wizard (Khuyến nghị)

1. **Clone repo:**
   ```bash
   git clone https://github.com/tuanminhhole/openclaw-setup.git
   cd openclaw-setup
   ```

2. **Mở `index.html`** trên trình duyệt — Setup Wizard sẽ hướng dẫn bạn:
   - Chọn kênh (Telegram / Zalo)
   - Chọn AI model và plugins
   - Cấu hình tên bot, tính cách
   - Lấy hướng dẫn tạo API key
   - Tự động generate tất cả config files

3. **Tạo file `.env`** (làm theo hướng dẫn trong wizard)

4. **Build & Chạy:**
   ```bash
   cd docker/openclaw
   docker compose build
   docker compose up -d
   ```

5. **Test bot** — gửi tin nhắn trên Telegram hoặc Zalo! 🎉

### Cách B — Dùng AI Agent (Antigravity)

1. Mở [Antigravity IDE](https://antigravity.dev/)
2. Mở repo này làm workspace
3. Tạo `docker/openclaw/.env` với API key của bạn
4. Paste vào chat:
   ```
   Read SETUP.md in this repo and set up OpenClaw for me.
   I already created the .env file with my API key and Bot token.
   My project folder: <THƯ_MỤC_CỦA_BẠN>
   ```

---

## 📁 Cấu trúc repo

```
index.html       ← Setup Wizard UI
style.css        ← Giao diện wizard
setup.js         ← Logic wizard
CHANGELOG.md     ← Lịch sử phiên bản
README.md        ← Hướng dẫn (English)
README.vi.md     ← Hướng dẫn (Tiếng Việt) — Bạn đang đọc file này
SETUP.md         ← Hướng dẫn kỹ thuật cho AI Agent
SETUP.vi.md      ← Hướng dẫn kỹ thuật cho AI Agent (Tiếng Việt)
```

---

## ❓ Câu hỏi thường gặp

<details>
<summary><b>Thật sự miễn phí?</b></summary>
Đúng. Docker, Google Gemini API (free tier), và Telegram/Zalo bot đều miễn phí. Nếu bạn muốn dùng Claude hoặc GPT-4o thì cần trả phí riêng cho nhà cung cấp AI đó.
</details>

<details>
<summary><b>Bot chạy ở đâu?</b></summary>
Trên máy tính của bạn trong Docker container. Khi tắt máy, bot cũng tắt.
</details>

<details>
<summary><b>Làm sao tắt/khởi động lại?</b></summary>

```bash
docker compose down      # Tắt
docker compose up -d     # Bật
```
</details>

<details>
<summary><b>Có thể đổi model AI sau không?</b></summary>
Có! Chỉ cần sửa <code>.openclaw/openclaw.json</code> → đổi trường <code>model.primary</code> → <code>docker compose restart</code>.
</details>

<details>
<summary><b>Có thể đổi kênh chat sau không?</b></summary>
Có! Chạy lại Setup Wizard hoặc sửa <code>.openclaw/openclaw.json</code> → phần <code>channels</code>.
</details>

<details>
<summary><b>An toàn không?</b></summary>
API key chỉ lưu trên máy bạn. SETUP.md có các quy tắc bảo mật nghiêm ngặt mà AI Agent phải tuân thủ (không xóa file, không truy cập thư mục nhạy cảm, không lộ key...).
</details>

<details>
<summary><b>9Router là gì?</b></summary>
9Router là AI proxy mã nguồn mở chạy cùng Docker với bot. Thay vì dùng API key, bạn đăng nhập OAuth trên dashboard 9Router (<code>localhost:20128</code>). Nó tự động route request tới AI provider tốt nhất.
</details>

<details>
<summary><b>Skills và Plugins khác nhau thế nào?</b></summary>
<strong>Skills</strong> thêm kỹ năng cho bot (Web Search, Browser, Memory...) — cài qua <code>openclaw skills install</code> từ ClawHub.<br>
<strong>Plugins</strong> thêm kênh chat hoặc tính năng runtime (Voice Call, Matrix...) — cài qua <code>openclaw plugins install</code> từ npm.
</details>

---

## 🔗 Link hữu ích

- [OpenClaw Docs](https://openclaw.ai/docs)
- [Google AI Studio](https://aistudio.google.com/)
- [Telegram BotFather](https://t.me/BotFather)
- [Zalo Bot Platform](https://developers.zalo.me)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Ollama](https://ollama.com)
- [OpenRouter](https://openrouter.ai)
- [9Router](https://github.com/decolua/9router)
- [ClawHub (Skills)](https://clawhub.com)

---

## 📈 Lịch sử Star

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=tuanminhhole/openclaw-setup&type=Date)](https://star-history.com/#tuanminhhole/openclaw-setup&Date)

</div>

---

## 🙏 Ghi công

- [OpenClaw](https://openclaw.ai) — AI Gateway framework
- [9Router](https://github.com/decolua/9router) — AI proxy mã nguồn mở (OAuth, không cần API key)
- [Playwright](https://playwright.dev) — Engine trình duyệt tự động
- [ClawHub](https://clawhub.com) — Skills registry

---

<div align="center">

Made with 🦞 by [Kent](https://github.com/tuanminhhole)

</div>
