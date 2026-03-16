# 🦞 OpenClaw Setup — Tạo AI Bot Telegram Miễn Phí

Hướng dẫn setup **AI bot Telegram cá nhân** bằng OpenClaw + Google Gemini — hoàn toàn miễn phí.

Bot sẽ chạy trên máy tính của bạn thông qua Docker. Bạn chat với bot qua Telegram như chat với ChatGPT.

---

## ✅ Cần chuẩn bị (4 thứ, tất cả miễn phí)

| # | Cần gì | Cách lấy |
|---|--------|----------|
| 1 | **Docker Desktop** | Tải tại 👉 [docker.com/download](https://www.docker.com/products/docker-desktop/) → Cài đặt → Mở lên |
| 2 | **Antigravity** (IDE có AI) | Tải tại 👉 [antigravity.dev](https://antigravity.dev/) → Cài đặt → Đăng nhập bằng tài khoản Google |
| 3 | **Google AI API Key** | Vào 👉 [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → Bấm **Create API Key** → Copy lại |
| 4 | **Telegram Bot Token** | Mở app Telegram → Tìm **@BotFather** → Gửi `/newbot` → Đặt tên bot → Copy token |

---

## 🚀 Cách setup (3 phút)

### Bước 1: Mở Docker Desktop
- Đảm bảo icon Docker **màu xanh** ở taskbar (góc dưới phải màn hình)

### Bước 2: Mở Antigravity
- Mở Antigravity IDE
- Tạo 1 thư mục mới bất kỳ (VD: `D:\MyAIBot`) và mở nó trong Antigravity

### Bước 3: Tự tạo file chứa API Key (⚠️ BẮT BUỘC LÀM TRƯỚC)

> **KHÔNG BAO GIỜ** gửi API key hay Bot Token vào chat. Luôn tự tay điền vào file.

1. Trong thư mục project, tạo thư mục `docker/openclaw/`
2. Tạo file `docker/openclaw/.env` với nội dung sau:

```env
GOOGLE_API_KEY=<paste_api_key_của_bạn_vào_đây>
TELEGRAM_BOT_TOKEN=<paste_token_bot_của_bạn_vào_đây>
```

3. **Thay thế** 2 giá trị `<...>` bằng key/token thật bạn đã chuẩn bị ở trên
4. **Lưu file** lại

### Bước 4: Nhờ AI setup phần còn lại
- Mở chat trong Antigravity (Ctrl + L hoặc bấm icon chat)
- Copy-paste đoạn sau vào chat:

```
Đọc file SETUP.md trong repo này và setup OpenClaw cho tôi.
Tôi đã tự tạo file .env với API key và Bot token rồi.
Thư mục project của tôi: <ĐƯỜNG_DẪN_THƯ_MỤC — VD: D:\MyAIBot>
```

- AI sẽ **KHÔNG** hỏi API key — nó chỉ tạo Dockerfile, docker-compose, config OpenClaw, rồi build Docker

### Bước 5: Đợi AI cài đặt
- AI tự động tạo các files cấu hình
- Tự build Docker container
- Tự khởi động bot

### Bước 6: Test bot 🎉
- Mở Telegram → Tìm bot bạn vừa tạo
- Gửi tin nhắn bất kỳ
- Bot phản hồi = **Thành công!**

---

## 📁 File trong repo này

| File | Dùng cho ai |
|------|------------|
| `README.md` | Bạn đang đọc — hướng dẫn nhanh |
| `SETUP.md` | Cho AI đọc — hướng dẫn kỹ thuật chi tiết |

---

## ❓ Câu hỏi thường gặp

**Q: Có mất tiền không?**
A: Không. Docker, Antigravity, Google Gemini API (free tier), Telegram bot — tất cả đều miễn phí.

**Q: Bot chạy ở đâu?**
A: Trên máy tính của bạn (trong Docker container). Máy tắt thì bot tắt.

**Q: Muốn bot tắt/mở lại thì sao?**
A: Mở Terminal, gõ `docker compose down` (tắt) hoặc `docker compose up -d` (mở).

**Q: Có thể tùy chỉnh bot không?**
A: Có! Xem phần "Tạo Agent" trong `SETUP.md` để đặt tên, tính cách, ngôn ngữ cho bot.

**Q: An toàn không?**
A: An toàn. API key chỉ lưu trên máy bạn, không gửi đi đâu. File `SETUP.md` có quy tắc bảo mật chi tiết.

---

## 🔗 Liên kết

- [OpenClaw Docs](https://openclaw.ai/docs)
- [Google AI Studio](https://aistudio.google.com/)
- [Telegram BotFather](https://t.me/BotFather)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

_Made with 🦞 by Kent_
