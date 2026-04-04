# Các Câu Hỏi Thường Gặp (FAQ)

<details>
<summary><b>1. OpenClaw có miễn phí không?</b></summary>
<br>
Có, toàn bộ mã nguồn của OpenClaw hoàn toàn miễn phí (MIT License). Bạn không phải trả bất kỳ khoản phí nào cho OpenClaw. Tuy nhiên, chi phí sẽ phát sinh nếu bạn sử dụng các AI Provider trả phí (như GPT-4o, Claude 3.5 Sonnet). Để sử dụng miễn phí 100%, hãy chọn **9Router** (được cung cấp sẵn) hoặc **Google Gemini** (Free tier), hoặc chạy **Ollama** cục bộ.
</details>

<details>
<summary><b>2. 9Router là gì và tại sao lại được khuyến nghị?</b></summary>
<br>
9Router là một hệ thống AI Proxy mã nguồn mở miễn phí. Thay vì phải chật vật đăng ký và quản lý API Key từ nhiều nền tảng, 9Router cho phép bạn xác thực bằng 1 lần đăng nhập (OAuth). Nó sẽ tự động định tuyến các câu hỏi của bot sang các model AI miễn phí tốt nhất hiện có. Nó hoạt động hoàn hảo cả trên môi trường Native và Docker. 
</details>

<details>
<summary><b>3. Khi nào tôi NÊN và KHÔNG NÊN dùng Docker?</b></summary>
<br>

*   **NÊN dùng Docker (Windows/macOS):** Cung cấp sự cách ly hoàn hảo. Rất lý tưởng nếu bạn không rành về dòng lệnh và muốn mọi thứ được đóng gói tự động chuẩn xác bằng Docker Desktop.
*   **KHÔNG NÊN dùng Docker (Ubuntu/VPS):** Nếu bạn thuê VPS giá rẻ (RAM 1GB - 2GB) hoặc cài trên Ubuntu cá nhân, cài thẳng (Native mode) với `PM2` là phương pháp tốt nhất. Nó giúp tiết kiệm tới 15% RAM so với việc bị chạy ảo hóa qua Docker. Bản thân OpenClaw đã rất bảo mật nên không cần bọc thêm Docker trên VPS.

</details>

<details>
<summary><b>4. Bot của tôi không phản hồi, tôi phải làm sao?</b></summary>
<br>
Cách xử lý phụ thuộc vào môi trường bạn cài đặt:

**Trường hợp dùng Docker:**
1. Mở Terminal/PowerShell tại thư mục cài đặt bot.
2. Kiểm tra container: `docker compose ps`
3. Đọc log để xem lỗi: `docker compose logs -f`
4. Khởi động lại: `docker compose restart`

**Trường hợp dùng Native (PM2):**
1. Kiểm tra tiến trình: `pm2 status`
2. Đọc log để xem lỗi: `pm2 logs openclaw-bot`
3. Khởi động lại: `pm2 restart openclaw-bot`

*Mẹo: Nếu bạn dùng 9Router, hãy chắc chắn rằng bạn đã mở http://localhost:20128/dashboard và đăng nhập thành công.*
</details>

<details>
<summary><b>5. Bot có tự động chạy 24/7 không?</b></summary>
<br>
Cả hai chế độ cài đặt đều được cấu hình để tự động hóa:
*   **Với Docker:** Có cờ `restart: unless-stopped`. Bot sẽ tự chạy lại nếu máy khởi động.
*   **Với Native (PM2):** Lệnh CLI tạo ra đã bao gồm `pm2 save` để tự chạy lại sau khi reboot cục bộ trên Linux/VPS. (Đừng quên chạy lệnh `pm2 startup` nếu được yêu cầu trên Linux).
*Lưu ý: Nếu bạn cài đặt trên laptop cá nhân, tắt máy thì bot sẽ offline. Để online 24/7, hãy cài đặt lên VPS.*
</details>

<details>
<summary><b>6. Nếu muốn đổi AI Model sau khi cài, tôi phải làm thế nào?</b></summary>
<br>
Chỉ cần chạy lại lệnh `npx create-openclaw-bot` trong chính thư mục chứa bot của bạn. Trình setup sẽ hỏi lại các tùy chọn và tự động ghi đè an toàn file cấu hình mà không làm mất kỹ năng/lịch sử lưu trữ của bot.
</details>

<details>
<summary><b>7. Cài đặt Docker báo lỗi thiếu Plugin, tôi phải làm gì?</b></summary>
<br>
Nếu bạn dùng Linux (Ubuntu/Debian) và gặp lỗi liên quan đến thuật ngữ `unknown shorthand flag`, nghĩa là server của bạn chỉ có Docker V1 cũ. OpenClaw yêu cầu Docker Compose V2.
Để khắc phục, hãy chạy lệnh: `sudo apt-get install docker-compose-plugin`
</details>
