<div align="center">

# 🦞 OpenClaw Setup

<p align="center">
  <a href="https://github.com/tuanminhhole/openclaw-setup/releases"><img src="https://img.shields.io/badge/RELEASE-v5.8.3-0EA5E9?style=for-the-badge" alt="Version 5.8.3" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup?tab=MIT-1-ov-file"><img src="https://img.shields.io/badge/LICENSE-MIT-success?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/create-openclaw-bot"><img src="https://img.shields.io/npm/v/create-openclaw-bot?style=for-the-badge&label=CLI&color=2563EB&logo=npm&logoColor=white" alt="NPM Version" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-setup/stargazers"><img src="https://img.shields.io/github/stars/tuanminhhole/openclaw-setup?style=for-the-badge&color=eab308&logo=github&logoColor=white" alt="GitHub Stars" /></a>
</p>

![Tiếng Việt](https://flagcdn.com/20x15/vn.png) **Tiếng Việt** · [![English](https://flagcdn.com/20x15/gb.png) English](README.md)

Trình cài đặt và quản trị **Web UI Setup** thế hệ mới giúp tự động hóa 100% quá trình tạo dự án, triển khai và quản lý đa bot AI miễn phí trên Telegram hoặc Zalo — hỗ trợ **Windows, macOS, Ubuntu, VPS**.

<p align="center" style="margin: 24px 0;">
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/openclaw-setup-vi.png" alt="OpenClaw Setup" width="90%" style="border-radius: 8px; border: 1px solid #333; margin-bottom: 16px;" />
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/dashboard-vi.png" alt="OpenClaw Dashboard" width="90%" style="border-radius: 8px; border: 1px solid #333; margin-bottom: 16px;" />
  <img src="https://raw.githubusercontent.com/tuanminhhole/openclaw-setup/main/docs/bot.png" alt="OpenClaw Bot in Action" width="90%" style="border-radius: 8px; border: 1px solid #333;" />
</p>

</div>

---

## 🆕 Có gì mới trong v5.8.3

- 🔄 **Nút cập nhật Header thông minh**: Nâng cấp trực tiếp setup wizard từ giao diện! Nút cập nhật tự truy vấn npm registry và chỉ hiển thị khi có phiên bản mới hơn.
- 📡 **Nâng cấp Stream Log trực tiếp**: Khởi chạy cập nhật sẽ tự động nâng cấp (chạy `git pull && npm install && npm run build` cho bản Git, hoặc `npm install -g create-openclaw-bot` cho bản NPM) và đẩy dòng log theo thời gian thực về tab Logs.
- 🧹 **Tái cấu trúc thư mục Dev/Test**: Di chuyển các file script build (`build.mjs`, `bump-version.mjs`) và thư mục `tests` vào đường dẫn ẩn `.gitignore` là `docs_dev/tests/` giúp bản build gọn gàng hơn.
- ⚙️ **Tối ưu hóa Rollback lỗi & Docker**: Gia cố xử lý rollback khi cài đặt thất bại thông qua kiểm tra exit code của command, đồng thời sửa lỗi đóng gói thư viện browser trong Dockerfile.

<details>
<summary><b>Trước đó: Có gì mới trong v5.8.0 (Bản nâng cấp lớn)</b></summary>

- 🎨 **Giao diện Quản trị Web UI Mới**: Thay thế hoàn toàn các file tĩnh `index.html` và kịch bản dòng lệnh thủ công bằng một Dashboard cài đặt và quản lý bot cực kỳ trực quan với tone màu Dark Red/Black cao cấp.
- 🔀 **Hợp nhất Cấu hình AI qua 9Router**: Sử dụng duy nhất **9Router** làm Gateway AI Proxy trung tâm. Người dùng không cần cấu hình API key phức tạp hay thủ công cho từng provider nữa. Thông qua 9Router, bạn có thể dễ dàng quản lý và kết nối mọi nhà cung cấp AI từ miễn phí (Gemini free, Ollama offline) đến các mô hình trả phí (GPT-4o, Claude...) qua OAuth nhanh chóng.
- 📊 **Bảng điều khiển Tiến trình (Process Controller)**: Dễ dàng Bật (`Start`), Tắt (`Stop`), hoặc Tạo lại (`Recreate`) các bot container ngay trên giao diện Web.
- 📑 **Xem Log thời gian thực (Live Logs)**: Tích hợp trình xem nhật ký hoạt động trực tiếp (streaming logs) từ bot lên giao diện.
- 📁 **Trình quản lý File trực quan (File Tree Editor)**: Cho phép xem và chỉnh sửa trực tiếp các file cấu hình quan trọng như `openclaw.json`, `SOUL.md`, `AGENTS.md` ngay từ trình duyệt web.
- 🔑 **Đăng nhập Zalo QR trực tiếp**: Tích hợp luồng kích hoạt Zalo Personal bằng cách quét mã QR hiển thị ngay trên giao diện quản trị.
- 🔄 **Phân bổ Cổng Mạng thông minh**: Cơ chế tự động phát hiện cổng rảnh và gán cổng động (`routerPort`) giúp loại bỏ hoàn toàn xung đột mạng khi chạy nhiều bot trên cùng một máy.

</details>

---

## ✨ Tính năng nổi bật

- 🤖 **Đa kênh** — Telegram (1 hoặc nhiều bot), Zalo Bot API, hoặc Zalo Personal (Cá nhân).
- 🧑‍🤝‍🧑 **Đội bot (Multi-bot Team)** — Chạy đồng thời nhiều bot Telegram/Zalo, tự động đồng bộ hóa tài liệu và phối hợp làm việc theo nhóm.
- 🧠 **Đa nhà cung cấp AI qua 9Router** — Dễ dàng định tuyến đến Google Gemini, Claude, GPT-4o, OpenRouter, Ollama (chạy local offline).
- 🧩 **Kỹ năng (Skills)** — Web Search, Browser Automation (Chrome CDP thực tế), Cron/Scheduler lập lịch.
- 🔌 **Plugin tích hợp** — Cài đặt nhanh các plugin nâng cao (`openclaw-zalo-mod`, Facebook Crawler...) chỉ bằng 1 nút nhấn trên UI.
- 🔀 **9Router tích hợp** — Cầu nối AI proxy miễn phí không cần API key thông qua đăng nhập OAuth.
- 🔒 **An toàn & Riêng tư** — Toàn bộ cấu hình và API key chỉ lưu trên thiết bị của bạn.

---

## 🗺️ Cách cài đặt nhanh nhất

### 1️⃣ Cách 1: Sử dụng NPX (Không cần tải code trước)

Mở terminal trên máy của bạn và chạy lệnh duy nhất:

```bash
npx create-openclaw-bot
```

_Hệ thống sẽ tự động tạo thư mục, cài đặt môi trường và mở giao diện Web Setup trên trình duyệt._

### 2️⃣ Cách 2: Clone thủ công

Nếu bạn tải mã nguồn từ GitHub về máy:

```bash
npm install
npm start
```

---

## 📋 Yêu cầu hệ thống

- **Node.js**: Phiên bản 20, 22 hoặc 24 (Tránh dùng bản Node.js 25 do xung đột runtime).
- **Git**: Đã cài đặt và có trong biến môi trường PATH.
- **Docker Desktop** (Nếu chọn cài đặt qua Docker): Hỗ trợ Docker Compose V2.

---

## 🧠 Các Provider AI được hỗ trợ (Thông qua 9Router)

- [9Router GitHub](https://github.com/decolua/9router)

---

## 🔌 Kênh trò chuyện hỗ trợ

- **Telegram**: Lấy token bot chính thức từ `@BotFather`.
- **Zalo Bot API**: Lấy thông tin kết nối chính thức từ [developers.zalo.me](https://developers.zalo.me).
- **Zalo Cá nhân (Zalo Personal)**: Kích hoạt cực nhanh bằng cách quét mã QR hiển thị ngay trên Dashboard OpenClaw.

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

<div align="center">

Made with 🦞 by [Kent](https://github.com/tuanminhhole)

</div>
