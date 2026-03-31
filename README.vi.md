<div align="center">

# 🦞 OpenClaw Setup

<p align="center">
  <a href="https://github.com/tuanminhhole/openclaw-setup/releases"><img src="https://img.shields.io/badge/RELEASE-v4.0.7-0EA5E9?style=for-the-badge" alt="Version 4.0.7" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup?tab=MIT-1-ov-file"><img src="https://img.shields.io/badge/LICENSE-MIT-success?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/create-openclaw-bot"><img src="https://img.shields.io/npm/v/create-openclaw-bot?style=for-the-badge&label=CLI&color=2563EB&logo=npm&logoColor=white" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/create-openclaw-bot"><img src="https://img.shields.io/npm/dm/create-openclaw-bot?style=for-the-badge&color=22c55e" alt="NPM Downloads" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup/stargazers"><img src="https://img.shields.io/github/stars/tuanminhhole/openclaw-setup?style=for-the-badge&color=eab308&logo=github&logoColor=white" alt="GitHub Stars" /></a>
</p>

Một công cụ trực quan <strong>Setup Wizard (UI)</strong> & <strong>CLI</strong> để tự tay build Bot AI trên Telegram và Zalo chỉ trong vài phút.

<a href="https://github.com/tuanminhhole/openclaw-setup">
  <img src="docs/preview.png" alt="OpenClaw Setup Hero Image" width="100%" style="border-radius: 8px; margin: 16px 0; border: 1px solid #333;" />
</a>

<p style="margin-top: 16px;">
  <img src="https://flagcdn.com/24x18/vn.png" alt="Tiếng Việt" width="24" height="18" style="vertical-align: sub;"> <strong>Tiếng Việt</strong> · 
  <img src="https://flagcdn.com/24x18/gb.png" alt="English" width="24" height="18" style="vertical-align: sub;"> <a href="README.md">English</a>
</p>

</div>

---

## 🆕 Có gì mới ở bản 4.0.7
- 🔐 **Bảo mật 9Router Tự động**: Tích hợp nút gạt tạo API Key Hex 32-ký tự tự động cho proxy 9Router. Không lo lộ port trên VPS!
- 🪄 **Giao diện 3 Phần Trực quan**: Bước 3 trên Web UI được thiết kế lại thành 3 khu vực rõ rệt (AI Provider, Kênh chat, Skills) kèm nút gạt iOS-style cực đẹp.
- ⚡ **Cài đặt 1 lệnh (`npx create-openclaw-bot`)**: Cực kỳ tiện lợi cho ae cài qua VPS/SSH — script sẽ tự hỏi Persona, Identity của người dùng và kích hoạt `docker compose up -d` ngay lập tức.
- 🌐 **Hỗ trợ Đa nền tảng Auto Browser**: Tự động sinh cả file `.bat` (cho Windows) và `.sh` (cho macOS/Linux) để bật Chrome Debug Mode mượt mà.
---

## ✨ Tính năng

- 🤖 **Đa kênh** — Telegram, Zalo Bot API, hoặc Zalo Cá nhân
- 🧠 **Đa model AI** — Google Gemini, Claude, GPT-4o, Ollama, OpenRouter, 9Router
- 🧩 **Skills** — Web Search, Browser Automation, Memory, RAG, Code Interpreter, Image Gen...
- 🔌 **Plugins** — Voice Call, Matrix, MS Teams, Nostr
- 🔀 **9Router Proxy** — Hệ thống Auto-route điều phối Bot tuyệt vời.
- 🧙 **Setup Wizard** — Chạy thẳng qua Terminal CLI hoặc giao diện web Web UI 4 bước
- 🆓 **100% Miễn phí** — Google Gemini API free tier + Docker
- 🔒 **An toàn** — API key không bao giờ bị lộ ra ngoài
- ⚡ **Siêu tốc** — Build thành công trong 3 phút

---

## 📋 Chuẩn bị

Bạn cần **3 thứ** (miễn phí hết):

1. **Docker Desktop** — [Tải tại đây](https://www.docker.com/products/docker-desktop/)
2. **API Key AI** — Tùy model, xem [Nhà cung cấp AI](#-nhà-cung-cấp-ai) (Gemini miễn phí!)
3. **Bot Token** — Xem [Kênh hỗ trợ](#-kênh-hỗ-trợ) bên dưới

---

## 🧠 Nhà cung cấp AI

- **Google Gemini** (Gemini 2.5 Flash/Pro, 3.0 Flash) — 🆓 Miễn phí — [Lấy Key](https://aistudio.google.com/apikey)
- **Anthropic Claude** (Sonnet 4, Opus 4, Haiku 3.5) — 💰 Trả phí — [Lấy Key](https://console.anthropic.com/settings/keys)
- **OpenAI / Codex** (GPT-4o, o3, Codex Mini) — 💰 Trả phí — [Lấy Key](https://platform.openai.com/api-keys)
- **OpenRouter** (Nhiều model free & paid) — 🆓/💰 — [Lấy Key](https://openrouter.ai/keys)
- **Ollama** (Qwen 3, DeepSeek, Llama...) — 🏠 Local (Free) — [Cài đặt](https://ollama.com)
- **9Router** (Tự động Proxy) — 🔀 Proxy — [Hướng dẫn](https://github.com/decolua/9router)

> 🔀 **9Router** chạy cùng OpenClaw trong Docker. Sau khi `docker compose up`, mở `localhost:20128/dashboard` để đăng nhập OAuth. Không cần API key!

---

## 🔌 Kênh hỗ trợ

- **Telegram** (✅ Bot API chính thức) — Mở Telegram $\rightarrow$ Tìm **@BotFather** $\rightarrow$ `/newbot` $\rightarrow$ Copy token.
- **Zalo Bot API** (✅ Bot API chính thức) — Vào [developers.zalo.me](https://developers.zalo.me) $\rightarrow$ Tạo bot $\rightarrow$ Copy token.
- **Zalo Cá nhân** (⚠️ Unofficial) — Login bằng QR code sau khi setup Docker (không cần token).

> ⚠️ **Zalo Cá nhân** dùng unofficial API. Tài khoản Zalo có thể bị hạn chế. Chỉ nên dùng tài khoản phụ.

---

## 🚀 Bắt đầu nhanh

### 1️⃣ Cách A — Cài đặt bằng Terminal CLI (`npx`) [Tốt nhất]

Dùng NPX là cách cài chuẩn nhất:

1. **Mở Terminal (hoặc Command Prompt).**
2. **Gõ lệnh sau:**
   ```bash
   npx create-openclaw-bot
   ```
3. **Làm theo các bước gợi ý trên Terminal** để đặt tên cho bot, setup tokens và nơi chứa file thư mục của bot.

<details>
<summary><b>2️⃣ Cách B — Cài đặt bằng Giao diện Setup Web (Web UI)</b></summary>
<br>

1. **Clone repo:**
   ```bash
   git clone https://github.com/tuanminhhole/openclaw-setup.git
   cd openclaw-setup
   ```

2. **Mở `index.html`** trên trình duyệt — Setup Wizard sẽ hướng dẫn bạn:
   - Chọn kênh (Telegram / Zalo)
   - Chọn AI model và plugins
   - Cấu hình tên bot, tính cách
   - Tự động generate tất cả config files về file `setup-openclaw.bat`

</details>


### 3️⃣ Cách C — Dùng AI Agent (Antigravity)

1. Mở [Antigravity IDE](https://antigravity.dev/)
2. Mở repo này làm workspace
3. Paste vào chat:
   ```text
   Read SETUP.md and install OpenClaw 4.0.7 for me.
   My bot token is X, my 9Router proxy doesn't need a key.
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
- [TheSVG](https://thesvg.org) — Bộ icon SVG vector chất lượng cao (miễn phí)

---

<div align="center">

Made with 🦞 by [Kent](https://github.com/tuanminhhole)

</div>
