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

---

## 🐳 Docker hay Native — khác nhau ở đâu

|  | Docker _(khuyên dùng)_ | Native |
|---|---|---|
| Bot chạy ở | container cô lập | thẳng trên máy, dưới dạng service hệ điều hành |
| Cần cài Docker | Có (Setup tự cài được trên Linux/VPS) | Không |
| Tự chạy lại khi crash/reboot | `restart: always` | launchd (macOS) / systemd (Linux) / schtasks (Windows) |
| Thấy filesystem của máy | không (chỉ thư mục được mount) | có |
| Điều khiển app trên desktop | không | có |
| Plugin cài ở | trong container, entrypoint tự cài lại mỗi lần boot | `<project>/.openclaw/extensions` trên máy |

Native đánh đổi sự cô lập của container để lấy quyền truy cập máy thật. Nếu không cần bot thao tác
trên desktop thì Docker vẫn là lựa chọn an toàn hơn.

---

## 🔌 Bảng cổng

| Cổng | Dịch vụ | Ghi chú |
|---|---|---|
| `51789` | Giao diện Setup | chính trang bạn đang dùng |
| `18789` | OpenClaw Gateway | giao diện điều khiển bot (Control UI) |
| `18790` | Zalo Mod Dashboard | **luôn là cổng gateway + 1** |
| `20128` | 9Router | định tuyến model AI |

Cả Docker và Native đều dùng đúng bộ cổng mặc định này. Máy nào đã có gì chiếm cổng thì Setup **hỏi
chính máy** rồi nhảy sang cặp cổng trống kế tiếp — nên project thứ hai trên cùng máy vẫn chạy song
song được. Muốn biết chắc project nào đang ở cổng nào thì xem `gateway.port` trong `openclaw.json`,
hoặc cột **Trạng thái** trên tab Bot.

Docker publish cổng ra **`127.0.0.1`** (không phải `0.0.0.0`), nên container bind `0.0.0.0` bên trong
vẫn không lộ ra internet. Native cũng luôn nghe loopback, kể cả khi bạn chọn **Linux VPS** — xem phần
dưới.

---

## 🐧 Native trên Linux / VPS

Có mấy điểm khác biệt đáng biết khi cài native trên server:

- **Gateway là systemd _user_ unit.** `openclaw daemon install` không có cờ `--system`, nên service
  nằm ở `~/.config/systemd/user/`. User manager bị dẹp khi session cuối của user kết thúc — trên
  desktop không sao vì có session đồ hoạ, còn qua SSH thì **bot chết lúc bạn đóng terminal**. Setup
  tự bật `loginctl enable-linger` để service sống độc lập với session và tự lên lại sau reboot. Nếu
  log báo không bật được, chạy tay: `sudo loginctl enable-linger <user>`.
- **Gateway chỉ nghe `127.0.0.1`.** Chọn **Linux VPS** không mở bind ra ngoài: gateway nói HTTP/WS
  thô (token đi dạng chữ), và một VPS mới thường chưa có firewall — phơi control plane ra internet
  là đánh đổi rất lệch. Muốn xem giao diện thì mở SSH tunnel (phần kế tiếp).
- **Plugin được cài tự động.** Bản native tự đặt `zalo-connect` (khi bot có kênh Zalo) và
  `learning-memory` vào `<project>/.openclaw/extensions` **trước** khi gateway boot lần đầu — đúng
  việc mà entrypoint của container vẫn làm. Trước v5.15.4 native không làm bước này, nên đăng nhập
  Zalo báo `Unsupported channel "zalo-connect"` và bot chạy mà không có context engine.
- **Service được bù đủ biến môi trường.** `openclaw daemon install` chỉ đưa một phần biến vào service
  nó sinh ra — `OPENCLAW_STATE_DIR` thì có, `OPENCLAW_HOME` thì không. Thiếu biến đó, plugin ghi file
  ra `~/.openclaw` thay vì vào project: file gửi cho bot nằm ngoài vùng workspace nên agent **không
  đọc được**, và session Zalo nằm ở home khác với config. Từ v5.15.5 Setup tự bù đủ biến (systemd và
  launchd) và tự nhận lại file đã ghi sai chỗ, kể cả với project cài từ trước.

---

## 🌐 Mở giao diện khi server không có trình duyệt

Server không có browser, mà mọi giao diện chỉ nghe trên `127.0.0.1`. Cách vào là mở **đường hầm SSH**
từ máy bạn rồi truy cập qua `localhost`.

Trong tab Bot, mở khung **🌐 Mở từ máy khác (VPS/server)** và bấm **Copy** — lệnh đã điền sẵn đúng
cổng của project đang chọn (kể cả cổng dashboard zalo-mod, vốn là gateway + 1):

```bash
ssh -L 51789:127.0.0.1:51789 -L 18789:127.0.0.1:18789 \
    -L 18790:127.0.0.1:18790 -L 20128:127.0.0.1:20128 <user>@<server>
```

Giữ tab terminal đó mở suốt lúc dùng, rồi mở `http://localhost:51789`. Sau đó các nút **Mở web** trên
Dashboard chạy được, vì chúng trỏ tới cùng số cổng ở `localhost`.

> **Nếu máy bạn đã có project OpenClaw khác** (nhất là bản Docker) thì các cổng đó **đang bị chiếm ở
> máy bạn**, và `ssh -L` sẽ báo `bind: Address already in use`. Tắt project local đó trước khi mở
> tunnel — hoặc forward sang cổng local khác (`-L 28789:127.0.0.1:18789`), nhưng lúc đó nút "Mở web"
> sẽ trỏ sai vì nó dùng đúng số cổng của server.

---

## 🩺 Lỗi thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
|---|---|
| `Gateway restart failed after 13s` ngay sau khi tạo bot | Boot đầu tiên đang chạy migration và giữ lease state; CLI bỏ verify ở 13s trong khi service được cho 30s để lên. Từ v5.15.4 Setup chờ `/health` và chờ hết lease rồi thử lại, nên phần lớn là báo động giả. |
| Đăng nhập Zalo báo `Unsupported channel "zalo-connect"` | Plugin chưa có trên đĩa. Cập nhật Setup lên ≥ v5.15.4, hoặc bấm **Cập nhật** trên card `OpenClaw Zalo Connect`. |
| Bot chết khi đóng SSH / không lên lại sau reboot | systemd user unit chưa bật linger → `sudo loginctl enable-linger <user>`. |
| Mở dashboard zalo-mod ra trang trắng hoặc không kết nối được | Tunnel chưa forward cổng đó. Dashboard là **gateway + 1**, không phải một cổng cố định. |
| Bot nói không đọc được file/ảnh bạn gửi | Service thiếu `OPENCLAW_HOME` nên file bị lưu ngoài project. Cập nhật Setup lên ≥ v5.15.5 rồi restart bot — Setup tự bù biến và nhận lại file. |
| `Config warnings … plugin not found` in ở mọi lệnh | Config khai plugin chưa được cài. Đây là cảnh báo, không phải lỗi chặn; cài plugin (hoặc `openclaw doctor --fix` để xoá khai báo cũ) là hết. |
