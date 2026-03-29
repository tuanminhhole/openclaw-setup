# OpenClaw Browser Automation — Hướng dẫn sử dụng

## Tổng quan

Browser Automation cho phép bot AI **điều khiển Chrome thật trên màn hình** máy bạn theo thời gian thực. Bot có thể:
- 🌐 Mở website, duyệt web ngay trên màn hình bạn
- 📝 Điền form tự động
- 🖱️ Click, gõ phím, cuộn trang
- 📸 Chụp ảnh màn hình và gửi về chat
- 🔐 Dùng luôn session login sẵn (Facebook, Gmail...)

> ⚠️ **Lưu ý:** Chrome debug dùng **profile riêng** (`%TEMP%\chrome-debug`). Bạn cần login lại Facebook/Gmail 1 lần trong profile này.

---

## Cách hoạt động

```
Máy bạn (Windows)                    Docker Container
┌─────────────────────┐              ┌──────────────────────────┐
│ Chrome Debug Mode   │◄────────────►│ socat proxy              │
│ Port 9222 (visible) │   TCP/CDP    │ (9222 → host.docker:9222)│
│                     │              │                          │
│ Bạn thấy bot thao   │              │ browser-tool.js          │
│ tác TRỰC TIẾP!      │              │ → Playwright CDP client  │
└─────────────────────┘              └──────────────────────────┘
```

1. Chrome chạy trên máy bạn ở **Debug Mode** (port 9222) — **có giao diện, bạn nhìn thấy được**
2. Docker container dùng **socat** để bridge cổng: `container:9222 → Windows host:9222`
3. **`browser-tool.js`** dùng Playwright CDP client kết nối vào Chrome thật đó
4. Bot thao tác → bạn thấy Chrome di chuyển ngay trên màn hình

---

## Bước 1: Bật Chrome Debug Mode

File **`start-chrome-debug.bat`** đã có sẵn trong thư mục dự án. Mỗi khi cần bot duyệt web:

1. Mở thư mục dự án (ví dụ: `D:\openclaw-setup`)
2. **Click đúp vào `start-chrome-debug.bat`**
3. Đợi Chrome mở ra và thấy dòng `OK! Chrome Debug Mode dang chay.` màu xanh
4. **Để cửa sổ này mở** trong suốt quá trình bot làm việc

> **Quan trọng:** Phải bật Chrome Debug **trước khi** khởi động Docker. Nếu bot báo lỗi "chưa bật Chrome", hãy click đúp file này rồi thử lại.

<details>
<summary>Nội dung file bat (tham khảo)</summary>

```batch
@echo off
echo ====== OpenClaw - Chrome Debug Mode ======
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 3 /nobreak >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --remote-allow-origins=* ^
  --user-data-dir="%TEMP%\chrome-debug"
timeout /t 4 /nobreak >nul
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:9222/json/version' -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host 'OK! Chrome Debug Mode dang chay.' -ForegroundColor Green } catch { Write-Host 'LOI: Port 9222 chua mo.' -ForegroundColor Red }"
pause
```

</details>

---

## Bước 2: Tự động bật Chrome khi mở máy (Task Scheduler)

Chạy script PowerShell bên dưới **1 lần** với **Run as Administrator**:

```powershell
$batPath = "$env:USERPROFILE\start-chrome-debug.bat"

if (-not (Test-Path $batPath)) {
  Write-Host "LOI: Không tìm thấy $batPath" -ForegroundColor Red
  exit 1
}

$action   = New-ScheduledTaskAction -Execute $batPath
$trigger  = New-ScheduledTaskTrigger -AtLogOn
$trigger.Delay = "PT10S"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask `
  -TaskName "OpenClaw-ChromeDebug" `
  -Description "Tu dong bat Chrome Debug Mode cho OpenClaw" `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Force

Write-Host "DONE! Chrome sẽ tự bật Debug Mode mỗi khi đăng nhập Windows." -ForegroundColor Green
```

---

## Bước 3: Cách bot thao tác trình duyệt

Bot dùng script nội bộ **`browser-tool.js`** (tự động có trong container) để điều khiển Chrome:

```bash
# Kiểm tra kết nối (chạy trong container)
node /root/.openclaw/workspace/browser-tool.js status

# Mở trang web
node /root/.openclaw/workspace/browser-tool.js open "https://google.com"

# Đọc nội dung trang
node /root/.openclaw/workspace/browser-tool.js get_text

# Click vào phần tử (CSS Selector)
node /root/.openclaw/workspace/browser-tool.js click "input[name='q']"

# Gõ văn bản
node /root/.openclaw/workspace/browser-tool.js fill "input[name='q']" "bàn phím cơ"

# Nhấn phím
node /root/.openclaw/workspace/browser-tool.js press "Enter"
```

Bot tự động dùng các lệnh này khi bạn nhắn **"mở trình duyệt"** hoặc **"dùng browser"**.

---

## Cách ra lệnh cho bot

| Lệnh | Bot làm gì |
|------|-----------|
| `"Mở google.com và tìm bàn phím cơ"` | Mở Chrome → search → chụp ảnh → báo cáo |
| `"Dùng browser vào shopee tìm iPhone"` | Mở Shopee → tìm → tổng hợp kết quả |
| `"Mở facebook và đọc tin mới nhất"` | Vào Facebook (đã login sẵn) → đọc feed |
| `"Tìm trên web..."` | ❌ Dùng web_search thay vì browser — hãy nói rõ "browser" |

> **Tip:** Bot sẽ trả lời ngay khi nhận lệnh, rồi thực hiện và báo cáo kết quả + ảnh chụp màn hình.

---

## Cấu hình `openclaw.json`

Phần `browser` trong config **phải có**:

```json
"browser": {
  "enabled": true,
  "noSandbox": true,
  "defaultProfile": "host-chrome",
  "profiles": {
    "host-chrome": {
      "cdpUrl": "http://127.0.0.1:9222",
      "color": "#4285F4"
    }
  }
}
```

---

## Cấu hình Dockerfile

Container cần **2 thứ** để browser automation hoạt động:

```dockerfile
# 1. Cài socat (bridge cổng từ container ra host Windows)
RUN apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*

# 2. Cài Playwright + tạo symlink Google Chrome
RUN npm install -g playwright && npx playwright install chromium --with-deps \
    && ln -f -s /root/.cache/ms-playwright/chromium-*/chrome-linux*/chrome /usr/bin/google-chrome

# 3. Khởi động socat kèm gateway (trong CMD)
CMD sh -c "socat TCP-LISTEN:9222,fork,reuseaddr TCP:host.docker.internal:9222 & openclaw gateway run"
```

---

## Lưu ý quan trọng

| # | Lưu ý |
|---|-------|
| 1 | **Bật `start-chrome-debug.bat` trước** khi Docker chạy |
| 2 | Chrome debug dùng **profile riêng** → phải login lại các trang 1 lần |
| 3 | Port 9222 chỉ bind localhost → **an toàn** |
| 4 | Container thêm **~500MB** do Playwright Chromium |
| 5 | Chỉ hỗ trợ **Chrome/Chromium** |
| 6 | Nếu bot báo "Chrome đang tắt" → chạy lại `start-chrome-debug.bat` |

---

## Gỡ lỗi thường gặp

**Bot nói "không kết nối được Chrome":**
→ Chạy lại `start-chrome-debug.bat`.

**Bot phản hồi chậm:**
→ Bình thường — bot cần thời gian tải trang. Phần thao tác browser (~5-15s) chậm hơn web_search.

**Bot không dùng browser dù đã nói "mở trình duyệt":**
→ Kiểm tra file `AGENTS.md` trong `.openclaw/workspace/` có hướng dẫn dùng `browser-tool.js` chưa.

---

## Xóa Task Scheduler (nếu cần)

```powershell
Unregister-ScheduledTask -TaskName "OpenClaw-ChromeDebug" -Confirm:$false
```
