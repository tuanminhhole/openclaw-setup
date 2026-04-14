<div align="center">

# 🦞 OpenClaw Setup

<p align="center">
  <a href="https://github.com/tuanminhhole/openclaw-setup/releases"><img src="https://img.shields.io/badge/RELEASE-v5.4.0-0EA5E9?style=for-the-badge" alt="Version 5.4.0" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup?tab=MIT-1-ov-file"><img src="https://img.shields.io/badge/LICENSE-MIT-success?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/create-openclaw-bot"><img src="https://img.shields.io/npm/v/create-openclaw-bot?style=for-the-badge&label=CLI&color=2563EB&logo=npm&logoColor=white" alt="NPM Version" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup/stargazers"><img src="https://img.shields.io/github/stars/tuanminhhole/openclaw-setup?style=for-the-badge&color=eab308&logo=github&logoColor=white" alt="GitHub Stars" /></a>
</p>

<p style="margin-top: 16px;">
  <img src="https://flagcdn.com/24x18/vn.png" alt="Tiếng Việt" width="24" height="18" style="vertical-align: sub;"> <strong>Tiếng Việt</strong> ·
  <img src="https://flagcdn.com/24x18/gb.png" alt="English" width="24" height="18" style="vertical-align: sub;"> <a href="README.md">English</a>
</p>

Công cụ **CLI tương tác** và **Setup Wizard** để tự triển khai Bot AI miễn phí trên Telegram hoặc Zalo chỉ trong vài phút — hỗ trợ **Windows, macOS, Ubuntu, VPS**.

<a href="https://github.com/tuanminhhole/openclaw-setup">
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/preview.png" alt="OpenClaw Setup Hero Image" width="100%" style="border-radius: 8px; margin: 16px 0; border: 1px solid #333;" />
</a>

</div>

---

## 🆕 Có gì mới trong v5.4.0

- 🏗️ **Tái cấu trúc kiến trúc multi-bot** — Các flag `isTelegramMultiBot`, `isSharedMultiBot`, `isMultiBotWizard` được gộp thành một biến `isMultiBot` duy nhất. Đường dẫn `agentDir` trong `openclaw.json` được tạo ra nay đúng chuẩn `.openclaw/agents/{slug}/agent` (tương đối với `OPENCLAW_HOME`).
- 🗑️ **Xóa hoàn toàn kênh combo Telegram + Zalo** — Combo mode đã được gỡ bỏ khỏi cả Web Wizard lẫn CLI. Sẽ được thiết kế lại trong bản phát hành sau.
- 🤝 **Quy tắc cross-workspace trong `AGENTS.md`** — Ở chế độ multi-bot, `AGENTS.md` của mỗi bot có thêm mục liệt kê đường dẫn workspace của các bot anh em và quy tắc phối hợp.
- 🧹 **Config sạch hơn** — Không còn tạo `auth-profiles.json` per-agent cho 9Router; không còn tạo `.env` cho native scripts; không còn tạo `models.json` per-agent cho Ollama.

<details>
<summary><b>Trước đó: Có gì mới ở v5.3.5</b></summary>

- 🐛 **Fix: Lỗi Syntax MEMORY.md trong Workspace Zalo** — Patch TOOLS.md trước đó được chèn sai vị trí, gây `SyntaxError` trên `setup.js`. Đã sửa.
- 🐟 **Cải tiến: Script gỡ cài đặt nằm trong thư mục project** — Tất cả 4 OS native + Docker ZIP đều có `uninstall-*.{bat,sh}` ngay trong thư mục project sau khi setup xong.
- 🐛 **Fix: Windows Docker script crashes với "docker not recognized"** — File `.ps1` được tạo giờ dùng `Get-Command` để tìm Docker, kiểm tra Docker Desktop đang chạy, và gọi lệnh qua toán tử `&` — hoạt động kể cả khi Docker không có trong PATH mặc định của PowerShell.
- 🐛 **Fix: Thiếu hướng dẫn login Zalo QR cho combo trong script Windows** — Phần hướng dẫn sau cài đặt giờ hiển thị lệnh `docker compose exec` login khi chọn combo channel.

</details>

---

## ✨ Tính năng

- 🤖 **Đa kênh** — Telegram (1 bot hoặc nhiều bot), Zalo Bot API, hoặc Zalo Cá nhân
- 🧑‍🤝‍🧑 **Đội bot** — Chạy tối đa 5 Telegram bot đồng thời. Các bot dùng chung workspace, phối hợp xử lý tác vụ và điều phối với nhau trong group chat theo Chế độ Phòng Ban
- 🧠 **Đa provider AI** — Google Gemini, Claude, GPT-4o, OpenRouter, Ollama (local), 9Router
- 🧩 **Skills** — Web Search, Browser Automation, Memory, RAG, Code Interpreter, Image Gen
- 🔌 **Plugins** — Voice Call, Matrix, MS Teams, Nostr
- 🔀 **9Router** — AI proxy miễn phí với đăng nhập OAuth. Không cần API key. Hỗ trợ Claude Code, Codex, Gemini CLI.
- 🧙 **Setup Wizard** — 5 bước trực quan trên trình duyệt (`index.html`). Không cần terminal.
- 💻 **CLI tương tác** — `npx create-openclaw-bot` — phù hợp cho Ubuntu, VPS, kỹ sư.
- 🆓 **Miễn phí hoàn toàn để bắt đầu** — 9Router + Gemini free tier không tốn đồng nào
- 🔒 **Riêng tư** — API key chỉ lưu trên máy bạn, không gửi đi đâu
- ⚡ **Nhanh** — Từ zero đến bot chạy được trong dưới 5 phút

---

## 🗺️ Chọn cách triển khai

> **Không biết nên dùng cách nào?** Bảng dưới đây sẽ giúp bạn:

| Bạn là ai | Môi trường | Cách được đề xuất |
| --- | --- | --- |
| Không quen terminal | Windows / macOS | **Web Wizard** (`index.html`) |
| Không quen terminal | Ubuntu Desktop | **Web Wizard** → chọn Native |
| Quen terminal | Ubuntu / VPS | **CLI** (`npx create-openclaw-bot`) |
| Muốn tự động hóa hoàn toàn | Bất kỳ | **AI Agent** (Antigravity + SETUP.md) |

### 1️⃣ Tùy chọn A — Web Wizard (không cần terminal)

Phù hợp nhất cho **Windows và macOS**. Không cần dòng lệnh.

1. [Tải ZIP](https://github.com/tuanminhhole/openclaw-setup/archive/refs/heads/main.zip) hoặc clone repo này.
2. Mở `index.html` trong trình duyệt.
3. Làm theo **wizard 5 bước**:
   - **Bước 1:** Chọn OS (Windows / macOS / Ubuntu / VPS)
   - **Bước 2:** Chọn kênh bot (Telegram / Zalo)
   - **Bước 3:** Chọn AI provider và model
   - **Bước 4:** Nhập bot token và cấu hình
   - **Bước 5:** Tải script và chạy — xong!
4. Script tải về sẽ tự cài đặt mọi thứ cần thiết (9Router, Ollama, Docker, v.v.) dựa trên lựa chọn của bạn.

> **Docker hay không Docker?**
>
> - **Windows / macOS** → Dùng **Docker** (cô lập hoàn toàn, dễ quản lý)
> - **Ubuntu / VPS** → Dùng **Native (không Docker)** (ít RAM hơn, ổn định hơn)

### 2️⃣ Tùy chọn B — CLI tương tác (`npx`)

Phù hợp nhất cho **kỹ sư, Ubuntu Desktop, VPS**. Nhanh và mạnh nhất.

```bash
npx create-openclaw-bot
```

Chạy trong terminal → làm theo hướng dẫn → script khởi động được tạo tự động.

> Yêu cầu: **Node.js 20/22/24**. Kiểm tra: `node -v`
>
> Lưu ý: **tránh Node.js 25 hiện tại**. Có báo cáo OpenClaw gặp lỗi trên Node 25.

<details>
<summary><b>3️⃣ Tùy chọn C — AI Agent (Antigravity)</b></summary>
<br>

1. Mở [Antigravity IDE](https://antigravity.dev/)
2. Mở repo này làm workspace
3. Paste vào chat:
   ```
   Đọc SETUP.md và cài đặt OpenClaw v5.4.0 cho tôi.
   Bot token của tôi là X. Dùng 9Router (không cần API key).
   Thư mục project: <ĐƯỜNG_DẪN_CỦA_BẠN>
   ```

</details>

---

## 📋 Yêu cầu

### Không dùng Docker (Native — khuyến nghị cho Ubuntu/VPS)

| Yêu cầu | Ghi chú |
| --- | --- |
| **Node.js 20/22/24** | [Tải](https://nodejs.org/) · Kiểm tra: `node -v` · Tránh Node 25 hiện tại |
| **AI provider** | 9Router (miễn phí) hoặc Gemini/Claude/GPT-4o |
| **Bot Token** | Từ Telegram BotFather hoặc Zalo Developer |
| **Ollama** _(tùy chọn)_ | Chỉ cần nếu muốn chạy Gemma 4 locally · [Tải](https://ollama.com/) |

### Dùng Docker (khuyến nghị cho Windows/macOS)

| Yêu cầu | Ghi chú |
| --- | --- |
| **Node.js 20/22/24** | [Tải](https://nodejs.org/) · Kiểm tra: `node -v` · Tránh Node 25 hiện tại |
| **Docker Desktop + Compose V2** | [Tải](https://www.docker.com/products/docker-desktop/) · Kiểm tra: `docker compose version` |
| **AI provider** | 9Router chạy như container sidecar — không cần cài riêng |
| **Bot Token** | Từ Telegram BotFather hoặc Zalo Developer |

---

## 🧠 Các Provider AI được hỗ trợ

| Provider | Chi phí | API Key | Ghi chú |
| --- | --- | --- | --- |
| **9Router** | 🆓 Miễn phí | ❌ OAuth | Khuyến nghị cho người mới. Tự route đến model tốt nhất. Hỗ trợ Claude CLI, Codex, Gemini. |
| **Google Gemini** | 🆓 Free tier | ✅ Có | Chất lượng cao. Free tier rất rộng rãi. |
| **Ollama / Gemma 4** | 🏠 Miễn phí | ❌ Không | Chạy 100% offline. Tự pull model khi khởi động lần đầu. |
| **Anthropic Claude** | 💰 Trả phí | ✅ Có | Chất lượng suy luận và viết tốt nhất. |
| **OpenAI / Codex** | 💰 Trả phí | ✅ Có | GPT-4o, Codex Mini. |
| **OpenRouter** | 🆓/💰 Hỗn hợp | ✅ Có | Nhiều model chung một key. Một số miễn phí. |

> 🔀 **9Router v0.3.75+** hỗ trợ passthrough cho Claude Code, Codex, Gemini CLI, và Antigravity. Xem [docs/ai-providers.md](docs/ai-providers.md) để biết chi tiết.

---

## 🔌 Các kênh được hỗ trợ

- **Telegram** (✅ Chính thức) — Tìm **@BotFather** → `/newbot` → Copy token.
- **Zalo Bot API** (✅ Chính thức) — Vào [developers.zalo.me](https://developers.zalo.me) → Tạo bot → Copy token.
- **Zalo Cá nhân** (⚠️ Không chính thức) — Quét QR sau khi cài (không cần token). Dùng tài khoản phụ.

> ⚠️ **Zalo Cá nhân** dùng API không chính thức. Tài khoản có thể bị hạn chế. Chỉ dùng tài khoản phụ.

---

## 📁 Cấu trúc Repo

```
index.html           ← Wizard UI (mở trên trình duyệt)
style.css            ← Giao diện Wizard
setup.js             ← Logic Wizard
cli.js               ← CLI tương tác (npx create-openclaw-bot)
CHANGELOG.md/.vi.md  ← Lịch sử phiên bản
README.md            ← Tiếng Anh
README.vi.md         ← Bạn đang đọc (Tiếng Việt)
SETUP.md/.vi.md      ← Hướng dẫn kỹ thuật cho AI Agent
docs/
  install-docker.md/.vi.md     ← Cài Docker theo OS
  install-native.md/.vi.md     ← Cài Native/PM2 theo OS
  ai-providers.md/.vi.md       ← Cấu hình AI provider
  hardware-guide.md/.vi.md     ← Yêu cầu RAM cho Ollama/Gemma 4
  faq.md/.vi.md                ← Câu hỏi thường gặp
```

> **Lưu ý:** Script khởi động (`.bat`, `.sh`) **không có trong repo** — chúng được tạo bởi Web Wizard hoặc CLI dựa trên cấu hình của bạn.

---

## ❓ Câu hỏi thường gặp

<details>
<summary><b>Có thực sự miễn phí không?</b></summary>

Có. Docker, Google Gemini API (free tier), và token bot Telegram/Zalo đều miễn phí. Bạn chỉ trả tiền nếu chọn AI provider trả phí như Claude hoặc GPT-4o.

</details>

<details>
<summary><b>Bot chạy ở đâu?</b></summary>

Trên máy tính hoặc server của bạn. Với Docker thì chạy trong container; với Native thì chạy như tiến trình PM2. Nếu máy tắt thì bot cũng tắt. Dùng VPS để bot chạy 24/7.

</details>

<details>
<summary><b>Tôi có cần Docker không?</b></summary>

Không bắt buộc. Docker chỉ là một tùy chọn. Người dùng Windows/macOS nên dùng Docker để cô lập sạch sẽ. Người dùng Ubuntu/VPS nên cài native với PM2 — ít tốn RAM hơn và OpenClaw đã bảo mật sẵn.

</details>

<details>
<summary><b>Làm sao dừng/khởi động lại bot?</b></summary>

**Docker:**

```bash
docker compose down      # Dừng
docker compose up -d     # Chạy
docker compose restart   # Khởi động lại
```

**PM2 (native):**

```bash
pm2 stop openclaw-bot
pm2 start openclaw-bot
pm2 restart openclaw-bot
```

</details>

<details>
<summary><b>Tôi có thể đổi AI model sau không?</b></summary>

Có. Chạy lại `npx create-openclaw-bot` trong thư mục bot, hoặc sửa trực tiếp `.openclaw/openclaw.json` và restart bot.

</details>

<details>
<summary><b>Có an toàn không?</b></summary>

API key của bạn chỉ được lưu trên máy trong file `.env` cục bộ. OpenClaw không gửi chúng đi đâu. Khi dùng Ollama, toàn bộ AI chạy hoàn toàn offline.

</details>

<details>
<summary><b>9Router là gì?</b></summary>

9Router là AI proxy mã nguồn mở. Thay vì quản lý API key từ nhiều provider, bạn đăng nhập một lần qua OAuth tại `localhost:20128/dashboard`. Nó tự route request đến model AI tốt nhất hiện có. Từ v0.3.75, hỗ trợ passthrough cho Claude Code, Codex, Gemini CLI, và Antigravity.

</details>

<details>
<summary><b>Skills và Plugins khác nhau thế nào?</b></summary>

**Skills** thêm khả năng cho agent (Web Search, Browser Automation, Memory, RAG, Code Interpreter...) — cài qua `openclaw skills install` từ ClawHub.

**Plugins** thêm kênh hoặc extension runtime (Voice Call, Matrix, MS Teams...) — cài qua `openclaw plugins install` từ npm.

</details>

<details>
<summary><b>Cần bao nhiêu RAM cho Gemma 4?</b></summary>

| Model | RAM tối thiểu (Native) | RAM tối thiểu (Docker) |
| --- | --- | --- |
| `gemma4:e2b` | ~4 GB | ~5 GB |
| `gemma4:e4b` | ~8 GB | ~9 GB |
| `gemma4:26b` | ~18 GB | ~20 GB |
| `gemma4:31b` | ~24 GB | ~26 GB |

Xem [docs/hardware-guide.md](docs/hardware-guide.md) để biết thêm chi tiết kể cả cách cấu hình swap cho VPS.

</details>

---

## 🔗 Liên kết

- [OpenClaw Docs](https://openclaw.ai/docs)
- [9Router](https://github.com/decolua/9router)
- [Google AI Studio](https://aistudio.google.com/)
- [Telegram BotFather](https://t.me/BotFather)
- [Zalo Developer Platform](https://developers.zalo.me)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Ollama](https://ollama.com)
- [OpenRouter](https://openrouter.ai)
- [ClawHub (Skills)](https://clawhub.com)

---

## 📈 Star History

<div align="center">

[![Star History Chart](https://starchart.cc/tuanminhhole/openclaw-setup.svg?variant=adaptive)](https://starchart.cc/tuanminhhole/openclaw-setup)

</div>

---

## 🙏 Lời cảm ơn

- [OpenClaw](https://openclaw.ai) — AI Gateway framework
- [9Router](https://github.com/decolua/9router) — Open-source AI proxy (OAuth-based, no API keys)
- [Playwright](https://playwright.dev) — Browser automation engine
- [ClawHub](https://clawhub.com) — Skills registry
- [TheSVG](https://thesvg.org) — High-quality SVG brand icons

---

<div align="center">

Made with 🦞 by [Kent](https://github.com/tuanminhhole)

</div>
