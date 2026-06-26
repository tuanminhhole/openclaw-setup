<div align="center">

# 🦞 OpenClaw Setup

### Một **giao diện Web** để tạo, triển khai & vận hành trợ lý AI đa bot miễn phí — không cần gõ terminal

*Chạy một lệnh → mở dashboard → bot lên sóng. Windows · macOS · Linux · VPS, chạy Docker hoặc native.*

<p align="center">
  <a href="https://github.com/tuanminhhole/openclaw-setup/releases"><img src="https://img.shields.io/badge/RELEASE-v5.9.0-0EA5E9?style=for-the-badge" alt="Version 5.9.0" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup?tab=MIT-1-ov-file"><img src="https://img.shields.io/badge/LICENSE-MIT-success?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/create-openclaw-bot"><img src="https://img.shields.io/npm/v/create-openclaw-bot?style=for-the-badge&label=CLI&color=2563EB&logo=npm&logoColor=white" alt="NPM Version" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup/stargazers"><img src="https://img.shields.io/github/stars/tuanminhhole/openclaw-setup?style=for-the-badge&color=eab308&logo=github&logoColor=white" alt="GitHub Stars" /></a>
</p>

![Tiếng Việt](https://flagcdn.com/20x15/vn.png) **Tiếng Việt** · [![English](https://flagcdn.com/20x15/gb.png) English](README.md)

> 🇻🇳 Mã nguồn mở & miễn phí. Dashboard tự động hóa 100% việc tạo dự án, triển khai và quản lý bot AI trên **Telegram · Zalo · Facebook Messenger** (Discord & Lark sắp ra mắt) — cài trong vài phút, không cần biết code.

<p align="center" style="margin: 24px 0;">
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/openclaw-setup-vi.png" alt="OpenClaw Setup" width="90%" style="border-radius: 8px; border: 1px solid #333; margin-bottom: 16px;" />
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/dashboard-vi.png" alt="OpenClaw Dashboard" width="90%" style="border-radius: 8px; border: 1px solid #333; margin-bottom: 16px;" />
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/bot.png" alt="OpenClaw Bot in Action" width="90%" style="border-radius: 8px; border: 1px solid #333;" />
</p>

</div>

---

## 🆕 Có gì mới trong v5.9.0

- 🧠 **TencentDB Agent Memory — cài 1 chạm**: Plugin bộ nhớ mới ngay trên UI. Bộ nhớ phân tầng 4 lớp (L0–L3) + nén ngữ cảnh, giữ session dài mạch lạc và **tiết kiệm tới ~61% token**. Chạy local hoàn toàn (SQLite), không cần API key, sẵn sàng cho Docker.
- ⚡ **Cấu hình tiết kiệm token mặc định cho mọi bot mới**: Tự có context pruning (cache-TTL) + compaction `safeguard` — **hội thoại dài rẻ hơn & sắc nét hơn**, không cần chỉnh tay.
- 🎯 **Skills/Plugins theo từng bot & từng kênh**: Cài/bật/tắt skill chỉ cho **đúng 1 bot** (không lan sang bot khác); bảng chỉ hiện thứ phù hợp với kênh (Zalo / Telegram / Messenger).
- 📤 **Gửi file ổn định trên Zalo & Telegram**: Bot đã biết quy trình gửi đúng (`media/outbound` + tool `message`) và dùng định dạng hiện đại như `.xlsx` — hết cảnh "không gửi được file".
- 🐳 **Nút điều khiển Docker 1 chạm**: Restart / Rebuild container bot và cấp quyền ổ đĩa (mount thư mục host bất kỳ vào `/mnt/<tên>`, đa OS) ngay trên dashboard — khởi động lại bot mà không cần gõ lệnh.
- ⚡ **Trang Dashboard & Bot load nhanh hơn**: Việc dò runtime/version giờ chỉ chạy **một lần** rồi cache thay vì lặp lại mỗi lần tải trang — bot status giảm từ ~4s xuống ~3ms ở các lần tải sau. Cache tự xoá khi update/rebuild/restart/cài đặt.

<details>
<summary><b>Trước đó: Có gì mới trong v5.8.24 (Tự động cập nhật Launcher)</b></summary>

- **Sửa lỗi: Lệch phiên bản cache Launcher**: Tự động phát hiện nếu launcher đang chạy (tải qua `npx`) có phiên bản mới hơn hoặc khác với bản đang cache trong `~/.openclaw-setup` và tự nâng cấp tương ứng.

</details>

<details>
<summary><b>Trước đó: Có gì mới trong v5.8.23 (Tích hợp Skill Siêu Trí Nhớ)</b></summary>

- **Mới: Siêu Trí Nhớ Dài Hạn & Tự Đóng Gói Kỹ Năng (learning-memory)**: Tích hợp sẵn skill tự học và tự tiến hóa kỹ năng mới cho Agent.
  - Tự động ghi nhận thông tin, kiến thức và chỉ dẫn mới từ người dùng vào file `MEMORY.md` để ghi nhớ lâu dài.
  - Cho phép Agent tự đóng gói các quy trình làm việc hoặc logic mới học được thành mã nguồn `.js` và file hướng dẫn `SKILL.md` trực tiếp vào thư mục `./skills/`, giúp bot tự phát triển kỹ năng mà không cần lập trình viên can thiệp.
  - Hỗ trợ chạy tự động script cài đặt (postinstall) mượt mà trên mọi nền tảng (Docker, Windows, macOS, Linux) ngay sau khi cài từ ClawHub.
- **Mới: Quản lý Skill trên UI**: Thêm nút bật/tắt và quản lý cài đặt skill "Siêu Trí Nhớ Dài Hạn" trực tiếp trên giao diện quản trị Web UI Setup.

</details>

<details>
<summary><b>Trước đó: Có gì mới trong v5.8.22</b></summary>

- **Hỗ trợ Skill Tạo ảnh Infographic chuyên nghiệp**: Tích hợp hoàn toàn công cụ tạo ảnh infographic, poster tự động thông qua API của 9Router. Tự động sinh mã nguồn script `image-generator.js` đồng bộ API credentials từ `openclaw.json` và hướng dẫn `SKILL.md` cụ thể giúp Agent nắm vững cấu trúc prompt, font chữ tiếng Việt, layout và quy tắc thiết kế ảnh.
- **Hỗ trợ Skill Sticker & Auto-Tag (Zalo)**:
  - Tự động tag tên người gửi tin nhắn gần nhất trong group chat Zalo (Agent không cần tự điền `@Tên` ở đầu câu trả lời nữa, hệ thống sẽ tự làm).
  - Cho phép Agent gửi kèm Sticker Zalo trực tiếp trong câu trả lời thông qua thẻ `[Sticker: <từ_khóa>]` đặt ở cuối tin nhắn.
  - Tích hợp bộ giải nghĩa từ khóa cảm xúc thông minh (như `love`, `haha`, `ca khia`, `angry`, `thank you`,...) để tự động map sang sticker Zalo phù hợp.
  - Tự động sinh script vá logic `mentions.js` và tài liệu hướng dẫn `SKILL.md` trong workspace.
- **Tối ưu hóa: Đơn giản hóa sinh file TOOLS.md**: Điều chỉnh generator của `TOOLS.md` để sinh ra nội dung tĩnh gọn gàng, tập trung định hướng Agent đọc chi tiết các tài liệu hướng dẫn skill tương ứng.
- **Tối ưu hóa: Chuẩn hóa danh sách Tài liệu tham chiếu trong AGENTS.md**: Cập nhật danh sách tài liệu tham chiếu được tạo trong file `AGENTS.md` (cho cả 2 chế độ single/relay và cả tiếng Việt/tiếng Anh) để khớp chính xác cấu trúc mới gồm đúng 9 tài liệu cốt lõi, loại bỏ các file không còn phù hợp (`TEAMS.md` cho single-bot, `BROWSER.md`) và chuẩn hóa phần mô tả.

</details>

---

## ✨ Tính năng nổi bật

- 🤖 **Đa kênh** — Telegram (1 hoặc nhiều bot), Zalo Bot API, Zalo Personal (Cá nhân), và Facebook Messenger (Discord & Lark sắp ra mắt).
- 🧑‍🤝‍🧑 **Đội bot (Multi-bot Team)** — Chạy đồng thời nhiều bot Telegram/Zalo, tự động đồng bộ hóa tài liệu và phối hợp làm việc theo nhóm.
- 🧠 **Đa nhà cung cấp AI qua 9Router** — Dễ dàng định tuyến đến Google Gemini, Claude, GPT-4o, OpenRouter, Ollama (chạy local offline).
- 🧩 **Kỹ năng (Skills)** — Web Search, Browser Automation (Chrome CDP thực tế), Cron/Scheduler lập lịch.
- 🔌 **Plugin tích hợp** — Cài đặt nhanh các plugin nâng cao (`openclaw-zalo-mod`, Facebook Crawler...) chỉ bằng 1 nút nhấn trên UI.
- 🔀 **9Router tích hợp** — Cầu nối AI proxy miễn phí không cần API key thông qua đăng nhập OAuth.
- 🔒 **An toàn & Riêng tư** — Toàn bộ cấu hình và API key chỉ lưu trên thiết bị của bạn.

---

## 🗺️ Cách cài đặt nhanh nhất

### 1️⃣ Cách 1 — Cài nhanh (Khuyên dùng)

Mở terminal và chạy đúng một lệnh (chạy trên macOS, Linux & Windows — cần Node.js ≥ 22):

```bash
npx github:tuanminhhole/openclaw-setup
```

Lệnh này tự tải wizard, chạy server và **mở giao diện Setup** trên trình duyệt tại **http://127.0.0.1:51789**.

### 2️⃣ Cách 2 — Clone thủ công (dành cho developer)

Dành cho người muốn lấy full source. Chạy lần lượt từng dòng:

```bash
git clone https://github.com/tuanminhhole/openclaw-setup.git
cd openclaw-setup
npm install
npm start
```

Sau đó mở **http://127.0.0.1:51789** nếu trình duyệt không tự bật.

> ⚠️ `npm install` / `npm start` **chỉ chạy được KHI bạn đang ở trong thư mục `openclaw-setup` đã clone**. Nếu bạn dùng Cách 1 (npx) thì **chưa hề clone repo** — hãy dùng lệnh mở lại bên dưới, đừng chạy `npm install`/`npm start` (sẽ báo lỗi thiếu `package.json`).

### 🔁 Mở lại giao diện sau này

**Lần chạy đầu tiên sẽ tự tạo lệnh ngắn `openclaw-ui`** đúng theo OS của bạn (zsh/bash trên macOS & Linux, PowerShell trên Windows). Lần sau chỉ cần mở terminal **mới** và gõ:

```bash
openclaw-ui
```

<details>
<summary>Lệnh thủ công (dự phòng — cũng không tải lại)</summary>

```bash
# macOS / Linux
OPENCLAW_SETUP_WIZARD=true node ~/.openclaw-setup/node_modules/create-openclaw-bot/dist/cli.js
```

```powershell
# Windows (PowerShell)
$env:OPENCLAW_SETUP_WIZARD="true"; node "$env:USERPROFILE\.openclaw-setup\node_modules\create-openclaw-bot\dist\cli.js"
```

</details>

### ⬆️ Cập nhật lên phiên bản mới

Bấm **Cập nhật** ngay trong dashboard — nó tự kéo bản mới và **tự khởi động lại UI** (tab tự kết nối lại). Hoặc chạy lại lệnh trong terminal — luôn lấy bản mới nhất từ GitHub:

```bash
npx github:tuanminhhole/openclaw-setup
```

---

## 📋 Yêu cầu hệ thống

- **Node.js 24 LTS** (bắt buộc) — wizard Setup chạy bằng Node, nên cần cho **cả** chế độ Docker lẫn Native. [Tải Node.js](https://nodejs.org/).
- **Git**: Đã cài đặt và có trong biến môi trường PATH.
- **Docker Desktop** (khuyên dùng, để chạy bot): hỗ trợ Docker Compose V2. [Tải Docker](https://www.docker.com/products/docker-desktop/).

---

## 🚀 Hướng dẫn cài đặt từng bước

> Lần đầu dùng? Làm lần lượt theo thứ tự — không cần gõ terminal ngoài bước mở giao diện.

**1. Mở giao diện Setup** — chạy lệnh cài ở trên, dashboard sẽ mở trên trình duyệt.

**2. Chọn Hệ điều hành & Chế độ chạy** — cài [Node.js 24 LTS](https://nodejs.org/) trước (wizard chạy bằng Node — cần cho **cả 2** chế độ). Rồi vào tab **Cài đặt**, chọn hệ điều hành và chế độ chạy:
- **Docker** (khuyên dùng) — chạy cách ly và **tạo được nhiều project/bot**. Cài thêm [Docker Desktop](https://www.docker.com/products/docker-desktop/).
- **Native** — nhẹ hơn, chạy bot thẳng trên máy (không cần Docker).

**3. Nhập đường dẫn & tên project** — nhập đường dẫn thư mục và tên project (ví dụ tên: `bot`), rồi bấm **Cài đặt**. Ví dụ đường dẫn:
- Windows: `D:\bot`
- macOS: `/Users/<tên-bạn>/bot`
- Linux: `/home/<tên-bạn>/bot`

**4. Đăng nhập 9Router** — bấm nút **Mở website 9Router**, đăng nhập bằng mật khẩu mặc định **`123456`**.

**5. Tạo API key (9Router)** — vào mục **Endpoints**, tạo một API key mới. Sau đó mở thư mục project → file `openclaw.json` → kéo xuống mục **`models`** → dán key vào ô `apiKey` còn trống rồi lưu.

**6. Kết nối Provider (9Router)** — vào mục **Providers**, chọn provider bạn muốn; hệ thống tự kết nối.

**7. Tạo Combo định tuyến (9Router)** — vào mục **Combos**, tạo combo đặt tên **đúng** là **`smart-route`** và thêm các models cần dùng.

**8. Tạo bot** — quay lại giao diện Setup, chọn kênh, nhập thông tin bot + thông tin cá nhân, rồi bấm **Tạo bot**.

**9. Restart & test** — khởi động lại container bot, rồi nhắn tin cho bot để kiểm tra. 🎉

---

## 🧠 Các Provider AI được hỗ trợ (Thông qua 9Router)

- [9Router GitHub](https://github.com/decolua/9router)

---

## 🔌 Kênh trò chuyện hỗ trợ

- **Telegram**: Lấy token bot chính thức từ `@BotFather`.
- **Zalo Bot API**: Lấy thông tin kết nối chính thức từ [developers.zalo.me](https://developers.zalo.me).
- **Zalo Cá nhân (Zalo Personal)**: Kích hoạt cực nhanh bằng cách quét mã QR hiển thị ngay trên Dashboard OpenClaw.
- **Facebook Messenger**: Qua plugin riêng `fb-messenger` (liên hệ **tuanminhhole** để nhận) — chỉ cần dùng Page token.
- **Discord**: _Sắp ra mắt._
- **Lark**: _Sắp ra mắt._

---

## 📁 Cấu trúc thư mục dự án

```text
openclaw-setup/
|-- README.md                ← Tài liệu tiếng Anh
|-- README.vi.md             ← Hướng dẫn tiếng Việt (Bạn đang đọc)
|-- package.json             ← Điểm cấu hình NPM và scripts khởi chạy
|-- dist/                    ← Mã nguồn đã biên dịch của Web UI và CLI
`-- src/                     ← Mã nguồn gốc (giao diện, máy chủ cục bộ API, script build)
```

---

## ❓ Câu hỏi thường gặp

<details>
<summary><b>Làm thế nào để dừng hoặc chạy lại bot?</b></summary>
Giờ đây bạn không cần gõ lệnh nữa! Chỉ cần mở Web UI Setup lên, truy cập tab <b>Bot</b> và sử dụng nút bấm <b>Start / Stop / Recreate</b> để quản lý trực quan tiến trình hoạt động của Bot.
</details>

<details>
<summary><b>Sửa tính cách bot và danh sách tác vụ ở đâu?</b></summary>
Bạn có thể sửa trực tiếp ngay trên trình duyệt bằng cách truy cập tab <b>Bot</b>, cuộn xuống phần <b>Bot file tree</b> và click chọn file cần sửa (ví dụ: `SOUL.md`, `AGENTS.md`). Sau khi sửa xong nhấn <b>Save</b> là cấu hình sẽ được cập nhật ngay lập tức.
</details>

<details>
<summary><b>Tôi có thể đổi model AI sau khi cài không?</b></summary>
Hoàn toàn được. Bạn có thể sửa trực tiếp file `openclaw.json` ở giao diện web của setup, hoặc chạy lại lệnh cài đặt trỏ vào thư mục cũ để cập nhật nhanh cấu hình.
</details>

---

## 🔗 Liên kết hữu ích

- [OpenClaw Docs](https://openclaw.ai/docs)
- [9Router GitHub](https://github.com/decolua/9router)
- [Google AI Studio](https://aistudio.google.com/)
- [Telegram BotFather](https://t.me/BotFather)
- [Zalo Developer Platform](https://developers.zalo.me)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
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
- [ClawHub](https://clawhub.com) — Kho đăng ký các kỹ năng của bot
- [TheSVG](https://thesvg.org) — Kho biểu tượng nhãn hiệu SVG chất lượng cao

---

## 🙌 Tác giả & Đóng góp

Làm bởi **[tuanminhhole (Kent)](https://github.com/tuanminhhole)** như một món quà mở cho cộng đồng.
Mọi góp ý / PR cải tiến đều được hoan nghênh. Nếu thấy hữu ích, hãy ⭐ repo để nhiều người biết tới nhé!

---

## 🦞 Hệ sinh thái OpenClaw (cùng tác giả)

Các repo đi kèm để bạn dựng một trợ lý AI "tự vận hành" hoàn chỉnh:

**🚀 Cài đặt & khung nền**
- [openclaw-setup](https://github.com/tuanminhhole/openclaw-setup) — *(repo này)* Setup bot AI miễn phí bằng OpenClaw + 9Router (Telegram/Zalo/Messenger, Docker)
- [vietbrain](https://github.com/tuanminhhole/vietbrain) — Bộ khung "Bộ Não Thứ Hai" tiếng Việt cho Obsidian (sẵn sàng AI)

**🔌 Plugin (runtime)**
- `openclaw-fb-messenger` — Kênh Facebook Messenger *(riêng tư — liên hệ để nhận)*
- [openclaw-telegram-multibot-relay](https://github.com/tuanminhhole/openclaw-telegram-multibot-relay) — Multibot Telegram relay, delegation & cron nhắc lịch native
- [openclaw-zalo-mod](https://github.com/tuanminhhole/openclaw-zalo-mod) — Quản lý nhóm Zalo zero-token (slash command, anti-spam, warn, memory)
- [openclaw-browser-automation](https://github.com/tuanminhhole/openclaw-browser-automation) — Smart Search & Browser Automation
- [openclaw-facebook-crawler](https://github.com/tuanminhhole/openclaw-facebook-crawler) — Crawl dữ liệu Facebook
- [openclaw-n8n-facebook-poster](https://github.com/tuanminhhole/openclaw-n8n-facebook-poster) — Tự động đăng Facebook qua n8n

**🧩 Skill**
- [openclaw-skill-super-memory](https://github.com/tuanminhhole/openclaw-skill-super-memory) — Bộ nhớ nâng cao cho agent
- [openclaw-skill-infographic](https://github.com/tuanminhhole/openclaw-skill-infographic) — Tạo infographic
- [openclaw-skill-zalo-sticker-mention](https://github.com/tuanminhhole/openclaw-skill-zalo-sticker-mention) — Sticker & mention trên Zalo

---

<div align="center">
<sub>🦞 <b>openclaw-setup</b> · một phần của hệ sinh thái <a href="https://github.com/tuanminhhole">tuanminhhole (Kent)</a> · MIT License</sub>
</div>
