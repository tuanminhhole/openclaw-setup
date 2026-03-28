# OpenClaw Skills & Plugins — Hướng dẫn sử dụng

## Tổng quan

OpenClaw có 2 hệ thống mở rộng:

| | Skills 🧠 | Plugins 🔌 |
|---|---|---|
| **Là gì** | Kỹ năng cho bot AI | Kênh chat / runtime extension |
| **Registry** | ClawHub | npm |
| **Cài bằng** | `openclaw skills install <slug>` | `openclaw plugins install @openclaw/<pkg>` |
| **Ví dụ** | Web Search, Browser, Memory | Voice Call, Matrix, MS Teams |

---

## Skills có sẵn

### 🔍 Web Search
- **Chức năng:** Bot tìm kiếm web và trả kết quả realtime
- **Cần:** API key Tavily (miễn phí 1000 queries/tháng)
- **Setup:** Thêm vào `.env`:
  ```
  TAVILY_API_KEY=tvly-xxxxxxxxxxxxxx
  ```
- **Lấy key:** [app.tavily.com](https://app.tavily.com/) → Create API Key

### 🌐 Browser Automation
- **Chức năng:** Bot điều khiển Chrome thật trên máy bạn
- **Cần:** Chrome Debug Mode bật trên máy host
- **Setup:** Xem [browser-automation-guide.md](browser-automation-guide.md)
- **Không cần API key** — dùng Chrome có sẵn

### 🧠 Long-term Memory
- **Chức năng:** Bot nhớ hội thoại xuyên phiên, context dài hạn
- **Cần:** Không cần cấu hình thêm ✅
- **Tự động:** Lưu trữ trong `.openclaw/memory/`

### 📚 RAG / Knowledge Base
- **Chức năng:** Chat với tài liệu, file PDF, codebase
- **Cần:** Đặt file vào thư mục `.openclaw/docs/`
- **Setup:** Copy file PDF/TXT/MD vào folder sau rồi restart:
  ```
  .openclaw/docs/
  ├── tai-lieu-1.pdf
  ├── huong-dan.md
  └── data.csv
  ```

### 🎨 Image Generation
- **Chức năng:** Bot tạo ảnh bằng AI (DALL·E, Flux)
- **Cần:** API key (dùng chung OPENAI_API_KEY hoặc thêm FLUX_API_KEY)
- **Setup:** Nếu đã chọn OpenAI provider → không cần thêm gì. Nếu dùng Flux:
  ```
  FLUX_API_KEY=flx-xxxxxxxxxxxxxx
  ```

### ⏰ Bot Scheduler
- **Chức năng:** Bot tự nhắc nhở, lên lịch gửi tin nhắn
- **Cần:** Không cần cấu hình thêm ✅
- **Ví dụ:** "Nhắc tôi lúc 5h chiều mỗi ngày uống nước"

### 💻 Code Interpreter
- **Chức năng:** Chạy code Python/JS trong sandbox an toàn
- **Cần:** Không cần cấu hình thêm ✅
- **Ví dụ:** "Viết script Python tính toán chi phí tháng này"

### 📧 Email Assistant
- **Chức năng:** Quản lý, soạn, tóm tắt email
- **Cần:** Cấu hình SMTP trong `.env`:
  ```
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your.email@gmail.com
  SMTP_PASS=your_app_password
  ```
- **Lưu ý:** Gmail cần tạo [App Password](https://myaccount.google.com/apppasswords)

---

## Plugins có sẵn

### 📞 Voice Call
- **Chức năng:** Gọi thoại AI qua điện thoại
- **Package:** `@openclaw/voice-call`

### 💬 Matrix Chat
- **Chức năng:** Kết nối kênh Matrix/Element
- **Package:** `@openclaw/matrix`

### 🏢 MS Teams
- **Chức năng:** Kết nối Microsoft Teams
- **Package:** `@openclaw/msteams`

### 🟣 Nostr
- **Chức năng:** Kết nối mạng xã hội Nostr
- **Package:** `@openclaw/nostr`

---

## Thêm / Bỏ sau khi setup

Không cần chạy lại wizard. Dùng lệnh trực tiếp:

```bash
# Vào container
docker exec -it openclaw-bot sh

# Thêm skill
openclaw skills install memory
openclaw skills install web-search

# Xóa skill
openclaw skills uninstall web-search

# Thêm plugin
openclaw plugins install @openclaw/voice-call

# Xóa plugin
openclaw plugins uninstall @openclaw/voice-call

# Thoát và restart
exit
docker restart openclaw-bot
```

> 💡 **Persist qua rebuild:** Nếu muốn thay đổi lâu dài, sửa `Dockerfile` → `docker compose build && docker compose up -d`.
