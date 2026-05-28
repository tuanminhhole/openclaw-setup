# Hướng dẫn Cài đặt OpenClaw qua Web UI Setup (Mới)

> Chào mừng bạn đến với trình cài đặt trực quan của OpenClaw. Từ phiên bản này, toàn bộ quá trình cài đặt phức tạp trước đây đã được tự động hóa thông qua giao diện Web thân thiện. Bạn chỉ cần thực hiện theo các bước cực kỳ đơn giản dưới đây.

---

## 🚀 Khởi chạy Trình Cài đặt

Bạn có hai cách để bắt đầu:

### Cách 1: Sử dụng lệnh NPX (Khuyên dùng)
Không cần tải trước mã nguồn, chỉ cần mở terminal và chạy lệnh:
```bash
npx create-openclaw-bot
```
Hệ thống sẽ khởi tạo máy chủ cục bộ và tự động mở trình duyệt hiển thị giao diện cài đặt (mặc định tại `http://127.0.0.1:51789`).

### Cách 2: Tải thủ công từ Repository
Nếu bạn đã clone hoặc tải mã nguồn về máy:
```bash
npm install
npm start
```

---

## 🛠️ Các Bước Thiết Lập Trên Giao Diện

### Bước 1: Chọn Hệ Điều Hành & Chế Độ Triển Khai
Tại màn hình tab **Setup**:
1. **Choose operating system**: Chọn hệ điều hành của máy bạn (**Windows**, **macOS**, **Linux Desktop**, hoặc **Linux VPS**). Hệ thống sẽ tự động phát hiện và highlight hệ điều hành hiện tại.
2. **Choose runtime mode**: Chọn chế độ chạy dự án:
   * **Docker (Khuyên dùng)**: Chạy bot trong môi trường container cô lập, sạch sẽ và an toàn.
   * **Native**: Cài đặt trực tiếp lên hệ điều hành của máy.

### Bước 2: Chọn Thư Mục Dự Án & Bắt Đầu Cài Đặt
1. Click nút **Install OpenClaw** màu đỏ ở phía dưới.
2. Một bảng popup hiện lên yêu cầu bạn **chọn thư mục dự án**.
3. Điền đường dẫn thư mục mà bạn muốn khởi tạo Bot (ví dụ: `E:\openclaw-bot`).
4. Bấm nút **Install** để trình cài đặt bắt đầu tải mã nguồn lõi, cấu hình môi trường và cài đặt các phụ thuộc.
5. Theo dõi tiến trình tải và thiết lập trực tiếp ở bảng **Live Logs** bên cạnh. Đợi cho đến khi quá trình cài đặt báo thành công và chuyển sang màn hình Dashboard quản trị.

### Bước 3: Kết Nối AI Provider Qua 9Router
1. Sau khi cài đặt xong, trên Dashboard sẽ hiển thị cổng kết nối của **9Router** (AI Proxy thông minh tích hợp sẵn).
2. Truy cập vào giao diện quản trị 9Router thông qua liên kết hiển thị hoặc đăng nhập OAuth để kết nối với các AI Provider (như Google Gemini, OpenAI, Claude...) và đồng bộ các mô hình AI (Models).

### Bước 4: Tạo & Cấu Hình Bot
Sau khi cấu hình AI xong, hãy chuyển sang tab **Bot** trên giao diện Setup:
1. **Chọn Kênh Tạo Bot (Channel)**: Tích chọn kênh mà bạn muốn chạy bot (Telegram, Zalo Personal, hoặc Zalo Bot API).
2. **Nhập thông tin xác thực của Bot**:
   * Đối với Telegram: Nhập mã Bot Token lấy từ `@BotFather`.
   * Đối với Zalo Personal: Bạn chỉ cần quét mã QR đăng nhập Zalo trực quan hiển thị ngay trên Dashboard sau khi khởi chạy bot.
3. **Nhập thông tin chủ nhân (Owner)**: Điền thông tin định danh của bạn để phân quyền Admin tối cao quản trị bot.
4. Bấm **Apply/Save** để hoàn tất sinh cấu hình cho bot.

---

## 📊 Giao Diện Dashboard Quản Trị Trực Quan

Sau khi hoàn tất, bạn có thể kiểm soát hoàn toàn vòng đời của Bot trực tiếp trên Web UI:

1. **Bảng Điều khiển Tiến trình (Process Controller)**:
   * Sử dụng các nút bấm **Start / Stop / Recreate** để bật, tắt hoặc khởi động lại container/tiến trình của Bot chỉ trong 1 click.
2. **Xem Nhật Ký Hoạt Động (Live Logs)**:
   * Theo dõi logs chạy thực tế của bot trực tiếp trên web setup để dễ dàng gỡ lỗi (debug).
3. **Trình Quản Lý File Tích Hợp (File Tree Editor)**:
   * Chỉnh sửa trực tiếp tính cách bot (`SOUL.md`), danh sách agent (`AGENTS.md`), hoặc tệp cấu hình (`openclaw.json`) ngay trên trình duyệt mà không cần cài đặt thêm IDE hay Notepad.
