# Hướng dẫn Cài đặt Native (Không dùng Docker)

Chế độ Native được thiết kế dành cho những ai không thể hoặc không muốn cài Docker. Chế độ này thường tối ưu cho Shared Hosting (cPanel), các gói VPS cấu hình rất thấp, hoặc cài trực tiếp trên máy Window để chạy cá nhân.

OpenClaw v5.0.1+ tự động sinh sẵn các script cài đặt dành riêng cho Windows, Linux, VPS và Hosting.

---

## 🛑 Yêu cầu bắt buộc cho Native Mode

Khác với Docker (tự cấu hình mọi thứ), ở Native Mode, bạn phải tự chuẩn bị sẵn môi trường:

1. **Node.js (Bản v18.0 trở lên)**
   - Tải về từ [nodejs.org](https://nodejs.org/).
   - Kiểm tra bằng lệnh `node -v` trong Terminal/PowerShell.
2. **Ollama (Tùy chọn)**
   - Chỉ cần thiết nếu bạn muốn chạy các Model AI Local (như Gemma 4).
   - Tải và cài đặt thủ công tại [ollama.com](https://ollama.com/).
3. **PM2**
   - Rất cần thiết để chạy ngầm bot trên VPS và Hosting. Các script của OpenClaw sẽ tự động cài PM2 cho bạn.

---

## 🪟 1. Máy tính cá nhân Window (Desktop)

Hoàn hảo cho việc chạy test local mà không bị cắn RAM của Docker hay WSL2.

1. **Sinh file cấu hình OpenClaw:**
   ```powershell
   npx create-openclaw-bot
   ```
   *Tại bước `Select Deployment Mode`, hãy chọn `Native`, sau đó chọn tiếp `Windows`.*

2. **Chạy Bot:**
   - Wizard sẽ sinh cho bạn một file tên là `setup-openclaw-win.bat`.
   - Chỉ cần double-click (nhấn đúp) vào file này. Nó sẽ tự động `npm install` và chạy bot hiển thị log trực tiếp ra cửa sổ đen của CMD/PowerShell.

---

## 🖥️ 2. Môi trường VPS / Ubuntu / Linux Server

Cách này sử dụng PM2 để chạy bot ngầm tĩnh lặng ở background, và đặc biệt là tự động chạy lại bot mỗi khi VPS bị sập nguồn (reboot).

1. **Sinh file cấu hình OpenClaw:**
   ```bash
   npx create-openclaw-bot
   ```
   *Tại bước `Select Deployment Mode`, chọn `Native`, sau đó chọn tiếp `VPS / Ubuntu`.*

2. **Chạy Bot:**
   - Wizard sẽ đẻ ra một file tên là `setup-openclaw-vps.sh`.
   - Chạy lệnh sau trong thư mục:
     ```bash
     chmod +x setup-openclaw-vps.sh
     ./setup-openclaw-vps.sh
     ```
   - Script này sẽ cài PM2 nếu thiếu, update thư viện, và nhét bot vào danh sách chạy ngầm của PM2.

3. **Quản lý Bot bằng lệnh PM2:**
   - Xem bot đang sống hay chết: `pm2 status`
   - Xem log của bot: `pm2 logs openclaw`
   - Dừng bot: `pm2 stop openclaw`
   - Khởi động lại: `pm2 restart openclaw`

---

## 🏠 3. Shared Hosting (cPanel)

Shared Hosting rất gắt gao vì bạn không có quyền `sudo` (Admin), và các port mạng thường bị khóa. OpenClaw hỗ trợ chạy thẳng trên cPanel bằng PM2 trong local user space của bạn.

1. **Mở App Node.js trên cPanel:**
   - Tìm ứng dụng **Setup Node.js App** trên bảng điều khiển cPanel.
   - Bấm Create Application (Chọn Node.js bản 18 trở lên).
   - Đặt đường dẫn Application root (vidụ: `bot_folder`).
   - Bấm **Start App** để đảm bảo môi trường Node hoạt động.

2. **Truy cập Terminal:**
   - Dùng tính năng **Terminal** có sẵn trên cPanel.
   - Gõ lệnh đi vào thư mục vừa điền: `cd bot_folder`

3. **Sinh file cấu hình OpenClaw:**
   ```bash
   npx create-openclaw-bot
   ```
   *Chọn `Native`, và chọn OS là `Shared Hosting`.*

4. **Chạy Bot:**
   - Bạn sẽ nhận được file `setup-openclaw-hosting.sh` VÀ một file `ecosystem.config.cjs` chuyên trị các giới hạn của Hosting.
   - Chạy lệnh cài:
     ```bash
     chmod +x setup-openclaw-hosting.sh
     ./setup-openclaw-hosting.sh
     ```

> [!WARNING]
> Shared Hosting thường có cấu hình CPU/RAM cực kỳ thấp nên **KHÔNG đủ sức** để chạy Local Ollama hay các kỹ năng duyệ web nặng (Browser Automation). Bắt buộc phải dùng API ngoài (Gemini/Claude/9Router) nếu cài bot trên Shared Hosting.
