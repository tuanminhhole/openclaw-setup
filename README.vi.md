<div align="center">

# 🦞 OpenClaw Setup

<p align="center">
  <a href="https://github.com/tuanminhhole/openclaw-setup/releases"><img src="https://img.shields.io/badge/RELEASE-v5.1.1-0EA5E9?style=for-the-badge" alt="Version 5.1.1" /></a>
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

## 🆕 Có gì mới trong v5.1.1

- 💻 **OS-First Setup** — Bước đầu tiên bây giờ là chọn hệ điều hành của bạn (Windows, macOS, Ubuntu, VPS). Toàn bộ script, cấu hình và hướng dẫn được tạo ra phù hợp với lựa chọn đó.
- 🧠 **Gemma 4 — 4 kích thước** — `gemma4:e2b` (~4 GB), `gemma4:e4b` (~8 GB), `gemma4:26b` (~18 GB), `gemma4:31b` (~24 GB). Tự pull về khi bot khởi động lần đầu.
- 📄 **Tên script nhất quán** — Script sinh ra theo đúng OS đã chọn: `setup-openclaw-docker-win.bat`, `setup-openclaw-docker-macos.sh`, `setup-openclaw-vps.sh`... Không còn nhầm lẫn môi trường.
- 🌐 **Native Install cho Ubuntu/VPS** — Không cần Docker. CLI và Web Wizard đều hỗ trợ chạy trực tiếp với PM2 — tiết kiệm RAM, ổn định 24/7.
- 🤖 **Triển khai nhiều Bot** — Setup tới **5 Telegram bot độc lập** chỉ trong một lần cài. Mỗi bot sống trong thư mục riêng (`bot1/`, `bot2/`...) với token, tên, slash command và cá tính AI riêng biệt.
- 💬 **Chế độ Phòng Ban** — Thêm tất cả bot vào một Telegram group, chúng sẽ hoạt động như một đội nhân viên chuyên nghiệp. Bot im lặng theo mặc định — chỉ phản hồi khi được @tag hoặc gọi đúng lệnh slash, không spam, không ồn ào.
- 🔗 **Nút lấy Group ID tự động** — Nút "Lấy Group ID" ngay trong Web Wizard + hướng dẫn từng bước trong CLI. Mở @userinfobot thẳng luôn — không cần mò docs.
- 🔐 **Zalo Personal QR Login** — Zalo Personal giờ dùng flow login `zalouser` trực tiếp cho cả native lẫn Docker. Setup in sẵn lệnh login, lệnh copy QR và đường dẫn file QR, không cần vòng qua `openclaw onboard`.

<details>
<summary><b>Trước đó: Có gì mới ở v5.0.0</b></summary>

- 🤖 **Gemma 4 (Google, Open-weights)** — Model mới nhất của Google DeepMind. Miễn phí, mạnh mẽ, Apache 2.0.
- 🐳 **Ollama Sidecar tự động** — Không cần cài Ollama thủ công. Setup tự sinh `docker-compose.yml` có Ollama container tự tải model khi chạy lần đầu.
- 🆓 **Hoàn toàn miễn phí, không API key** — Gemma 4 chạy 100% local trong Docker.

</details>

---

## ✨ Tính năng

- 🤖 **Đa kênh** — Telegram (1 bot hoặc nhiều bot), Zalo Bot API, hoặc Zalo Cá nhân
- 🧑‍🤝‍🧑 **Đội bot** — Chạy tối đa 5 Telegram bot đồng thời. Các bot dùng chung workspace, phối hợp xử lý tác vụ và điều phối với nhau trong group chat theo Chế độ Phòng Ban
- 🧠 **Đa provider AI** — Google Gemini, Claude, GPT-4o, OpenRouter, Ollama (local), 9Router
- 🧩 **Skills** — Web Search, Browser Automation, Memory, RAG, Code Interpreter, Image Gen
- 🔌 **Plugins** — Voice Call, Matrix, MS Teams, Nostr
- 🔀 **9Router** — AI proxy miễn phí với đăng nhập OAuth. Không cần API key. Hỗ trợ Claude Code, Codex, Gemini CLI.
- 🧙 **Setup Wizard** — Giao diện web 5 bước (`index.html`). Không cần terminal.
- 💻 **CLI tương tác** — `npx create-openclaw-bot` — phù hợp cho Ubuntu, VPS, kỹ sư.
- 🆓 **100% Miễn phí** — 9Router + Gemini free tier đủ để bắt đầu
- 🔒 **Riêng tư** — API key lưu local, không bao giờ bị lộ ra ngoài
- ⚡ **Nhanh** — Từ zero đến bot hoạt động trong dưới 5 phút

---

## 🗺️ Chọn lộ trình phù hợp với bạn

> **Không biết nên chọn cách nào?** Đọc bảng dưới đây:

| Bạn là ai           | Môi trường      | Lộ trình khuyên dùng                  |
| ------------------- | --------------- | ------------------------------------- |
| Không quen terminal | Windows / macOS | **Web Wizard** (`index.html`)         |
| Không quen terminal | Ubuntu Desktop  | **Web Wizard** → chọn Native          |
| Quen terminal       | Ubuntu / VPS    | **CLI** (`npx create-openclaw-bot`)   |
| Muốn tự động hóa    | Bất kỳ          | **AI Agent** (Antigravity + SETUP.md) |

### 1️⃣ Cách A — Web Wizard (Không cần terminal)

Dành cho **Windows và macOS**. Không gõ lệnh gì cả.

1. [Tải về ZIP](https://github.com/tuanminhhole/openclaw-setup/archive/refs/heads/main.zip) hoặc clone repo này.
2. Mở `index.html` trong trình duyệt.
3. Làm theo **5 bước** trong wizard:
   - **Bước 1:** Chọn hệ điều hành (Windows / macOS / Ubuntu / VPS)
   - **Bước 2:** Chọn kênh bot (Telegram / Zalo)
   - **Bước 3:** Chọn AI provider và model
   - **Bước 4:** Nhập Bot Token và cấu hình bot
   - **Bước 5:** Tải script và chạy — xong!
4. Script được tạo ra sẽ tự động cài đặt các thứ cần thiết (9Router, Ollama, Docker v.v.) theo lựa chọn của bạn.

> **Nên chọn Docker hay không?**
>
> - **Windows / macOS** → Nên dùng **Docker** (cô lập hoàn toàn, dễ quản lý)
> - **Ubuntu / VPS** → Nên chọn **Không dùng Docker** (tiết kiệm RAM, ổn định hơn)

### 2️⃣ Cách B — CLI tương tác (`npx`)

Dành cho **kỹ sư, Ubuntu Desktop, VPS**. Nhanh và mạnh nhất.

```bash
npx create-openclaw-bot
```

Chạy lệnh trên trong Terminal → làm theo các prompt tương tác → script khởi động được tạo tự động.

> Yêu cầu: **Node.js 20 LTS** trở lên. Kiểm tra: `node -v`

<details>
<summary><b>3️⃣ Cách C — AI Agent (Antigravity)</b></summary>
<br>

1. Mở [Antigravity IDE](https://antigravity.dev/)
2. Mở repo này làm workspace
3. Paste vào chat:
   ```
   Read SETUP.md and set up OpenClaw v5.1.1 for me.
   My bot token is X. Use 9Router (no API key).
   My project folder: <THƯ_MỤC_CỦA_BẠN>
   ```

</details>

---

## 📋 Yêu cầu chuẩn bị

### Không dùng Docker (Native — khuyên dùng cho Ubuntu/VPS)

| Yêu cầu                 | Ghi chú                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| **Node.js 20 LTS**      | [Tải về](https://nodejs.org/) · Kiểm tra: `node -v`                 |
| **Một AI provider**     | 9Router (miễn phí) hoặc Gemini/Claude/GPT-4o                        |
| **Bot Token**           | Từ Telegram BotFather hoặc Zalo Developer                           |
| **Ollama** _(tuỳ chọn)_ | Chỉ cần nếu muốn chạy Gemma 4 local · [Tải về](https://ollama.com/) |

### Dùng Docker (khuyên dùng cho Windows/macOS)

| Yêu cầu                         | Ghi chú                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Node.js 20 LTS**              | [Tải về](https://nodejs.org/) · Kiểm tra: `node -v`                                            |
| **Docker Desktop + Compose V2** | [Tải về](https://www.docker.com/products/docker-desktop/) · Kiểm tra: `docker compose version` |
| **Một AI provider**             | 9Router chạy như sidecar container — không cần cài riêng                                       |
| **Bot Token**                   | Từ Telegram BotFather hoặc Zalo Developer                                                      |

---

## 🧠 AI Provider được hỗ trợ

| Provider             | Chi phí       | API Key      | Ghi chú                                                                                   |
| -------------------- | ------------- | ------------ | ----------------------------------------------------------------------------------------- |
| **9Router**          | 🆓 Miễn phí   | ❌ OAuth     | Khuyên dùng cho người mới. Tự route đến model tốt nhất. Hỗ trợ Claude CLI, Codex, Gemini. |
| **Google Gemini**    | 🆓 Free tier  | ✅ Có        | Chất lượng cao. Free tier rất rộng rãi.                                                   |
| **Ollama / Gemma 4** | 🏠 Miễn phí   | ❌ Không cần | Chạy 100% offline. Tự pull model khi khởi động.                                           |
| **Anthropic Claude** | 💰 Trả phí    | ✅ Có        | Lý luận và viết tốt nhất.                                                                 |
| **OpenAI / Codex**   | 💰 Trả phí    | ✅ Có        | GPT-4o, Codex Mini.                                                                       |
| **OpenRouter**       | 🆓/💰 Hỗn hợp | ✅ Có        | Nhiều model dưới một key. Một số miễn phí.                                                |

> 🔀 **9Router v0.3.75+** hỗ trợ lossless passthrough cho Claude Code, Codex, Gemini CLI, Antigravity — tức là các AI tool ngoài đều có thể dùng 9Router làm endpoint mà không mất thông tin. Xem [docs/ai-providers.vi.md](docs/ai-providers.vi.md) để biết cách cấu hình.

---

## 🔌 Kênh chat được hỗ trợ

- **Telegram** (✅ API chính thức) — Tìm **@BotFather** → `/newbot` → Copy token.
- **Zalo Bot API** (✅ API chính thức) — [developers.zalo.me](https://developers.zalo.me) → Tạo bot → Copy token.
- **Zalo Cá nhân** (⚠️ Unofficial) — Quét QR sau khi setup (không cần token). Dùng tài khoản phụ.

> ⚠️ **Zalo Cá nhân** dùng unofficial API. Tài khoản Zalo có thể bị hạn chế. Chỉ nên dùng tài khoản phụ.

---

## 📁 Cấu trúc repo

```
index.html           ← Setup Wizard UI (mở bằng trình duyệt)
style.css            ← Giao diện wizard
setup.js             ← Logic wizard
cli.js               ← CLI tương tác (npx create-openclaw-bot)
CHANGELOG.md/.vi.md  ← Lịch sử phiên bản
README.md            ← Hướng dẫn (English)
README.vi.md         ← Hướng dẫn (Tiếng Việt) — Bạn đang đọc
SETUP.md/.vi.md      ← Hướng dẫn kỹ thuật cho AI Agent
docs/
  install-docker.md/.vi.md     ← Cài Docker theo từng OS
  install-native.md/.vi.md     ← Cài Native/PM2 theo từng OS
  ai-providers.md/.vi.md       ← Cấu hình từng AI provider
  hardware-guide.md/.vi.md     ← Chọn RAM cho Ollama/Gemma 4
  faq.md/.vi.md                ← Câu hỏi thường gặp
```

> **Lưu ý:** Các script khởi động (`.bat`, `.sh`) **không có sẵn** trong repo — chúng được tạo ra bởi Web Wizard hoặc CLI dựa trên cấu hình bạn chọn.

---

## ❓ Câu hỏi thường gặp

<details>
<summary><b>Thật sự miễn phí?</b></summary>

Đúng. Docker, Google Gemini free tier, và bot token Telegram/Zalo đều miễn phí. Chỉ tốn tiền nếu bạn chọn provider trả phí như Claude hoặc GPT-4o.

</details>

<details>
<summary><b>Bot chạy ở đâu?</b></summary>

Trên máy hoặc server của bạn. Nếu dùng Docker thì trong container. Nếu dùng Native thì là một process được PM2 quản lý. Tắt máy thì bot tắt — muốn 24/7 thì cần VPS.

</details>

<details>
<summary><b>Cần Docker không?</b></summary>

Không bắt buộc. Windows/macOS khuyên dùng Docker vì cô lập tốt. Ubuntu/VPS khuyên dùng Native với PM2 — ít overhead hơn và OpenClaw đã bảo mật sẵn.

</details>

<details>
<summary><b>Làm sao tắt/khởi động lại?</b></summary>

**Docker:**

```bash
docker compose down      # Tắt
docker compose up -d     # Bật
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
<summary><b>Có thể đổi AI model sau không?</b></summary>

Có. Chạy lại `npx create-openclaw-bot` trong thư mục bot, hoặc sửa trực tiếp `.openclaw/openclaw.json` → khởi động lại bot.

</details>

<details>
<summary><b>An toàn không?</b></summary>

API key chỉ lưu trên máy bạn trong file `.env`. OpenClaw không bao giờ truyền key ra ngoài. Khi dùng Ollama, toàn bộ AI inference chạy offline hoàn toàn.

</details>

<details>
<summary><b>9Router là gì?</b></summary>

9Router là AI proxy mã nguồn mở. Thay vì quản lý nhiều API key, bạn đăng nhập một lần qua OAuth tại `localhost:20128/dashboard`. Nó tự route request đến model tốt nhất. Bản v0.3.75+ còn hỗ trợ lossless passthrough cho Claude Code, Codex, Gemini CLI và Antigravity.

</details>

<details>
<summary><b>Skills và Plugins khác nhau thế nào?</b></summary>

**Skills** thêm kỹ năng cho bot (Web Search, Browser Automation, Memory, RAG, Code Interpreter...) — cài qua `openclaw skills install` từ ClawHub.

**Plugins** thêm kênh hoặc tính năng runtime (Voice Call, Matrix, MS Teams) — cài qua `openclaw plugins install` từ npm.

</details>

<details>
<summary><b>Cần bao nhiêu RAM để chạy Gemma 4?</b></summary>

| Model        | RAM tối thiểu (Native) | RAM tối thiểu (Docker) |
| ------------ | ---------------------- | ---------------------- |
| `gemma4:e2b` | ~4 GB                  | ~5 GB                  |
| `gemma4:e4b` | ~8 GB                  | ~9 GB                  |
| `gemma4:26b` | ~18 GB                 | ~20 GB                 |
| `gemma4:31b` | ~24 GB                 | ~26 GB                 |

Xem chi tiết tại [docs/hardware-guide.vi.md](docs/hardware-guide.vi.md).

</details>

---

## 🔗 Links hữu ích

- [OpenClaw Docs](https://openclaw.ai/docs)
- [9Router](https://github.com/decolua/9router)
- [Google AI Studio (Gemini Key)](https://aistudio.google.com/)
- [Telegram BotFather](https://t.me/BotFather)
- [Zalo Developer Platform](https://developers.zalo.me)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Ollama](https://ollama.com)
- [OpenRouter](https://openrouter.ai)
- [ClawHub (Skills Registry)](https://clawhub.com)

---

## 📈 Lịch sử Star

<div align="center">

[![Star History Chart](https://starchart.cc/tuanminhhole/openclaw-setup.svg?variant=adaptive)](https://starchart.cc/tuanminhhole/openclaw-setup)

</div>

---

## 🙏 Ghi công

- [OpenClaw](https://openclaw.ai) — AI Gateway framework
- [9Router](https://github.com/decolua/9router) — AI proxy mã nguồn mở (OAuth, không cần API key)
- [Playwright](https://playwright.dev) — Engine trình duyệt tự động
- [ClawHub](https://clawhub.com) — Skills registry
- [TheSVG](https://thesvg.org) — Bộ icon SVG vector chất lượng cao

---

<div align="center">

Made with 🦞 by [Kent](https://github.com/tuanminhhole)

</div>
