# OpenClaw Browser Automation — Hướng dẫn sử dụng

## Tổng quan

Browser Automation cho phép bot AI điều khiển Chrome thật trên máy bạn. Bot có thể:
- 🌐 Mở website, duyệt web
- 📝 Điền form tự động
- 🖱️ Click, navigate, cuộn trang
- 🔐 Dùng luôn session login sẵn (Facebook, Gmail...)

> ⚠️ **Lưu ý:** Bot cần kết nối tới Chrome qua Debug Mode. Chrome debug dùng **profile riêng** — bạn cần login lại Facebook/Gmail 1 lần.

---

## Cách hoạt động

```
Máy bạn (Windows)                    Docker Container
┌─────────────────────┐              ┌─────────────────────┐
│ Chrome Debug Mode   │◄────────────►│ socat proxy         │
│ Port 9222           │   TCP raw    │ (9222 → host:9222)  │
│                     │              │                     │
│ Dùng profile riêng  │              │ OpenClaw Gateway    │
│ chrome-debug        │              │ → gọi browser tool  │
└─────────────────────┘              └─────────────────────┘
```

1. Chrome chạy trên máy bạn ở **Debug Mode** (port 9222)
2. Docker container dùng **socat** để kết nối từ container → Chrome trên host
3. OpenClaw gọi browser tool → điều khiển Chrome thông qua Chrome DevTools Protocol (CDP)

---

## Bước 1: Lưu script bật Chrome Debug

Lưu file `start-chrome-debug.bat` vào thư mục `C:\Users\<TEN_BAN>\`:

```batch
@echo off
echo ====== OpenClaw - Chrome Debug Mode ======
echo.
echo Dang tat Chrome cu (neu co)...
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 3 /nobreak >nul
echo Dang mo Chrome voi Debug Mode...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --remote-allow-origins=* ^
  --user-data-dir="%TEMP%\chrome-debug"
timeout /t 4 /nobreak >nul
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:9222/json/version' -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host 'OK! Chrome Debug Mode dang chay.' -ForegroundColor Green } catch { Write-Host 'LOI: Port 9222 chua mo.' -ForegroundColor Red }"
echo.
pause
```

> Chạy file này **trước khi** khởi động Docker.

---

## Bước 2: Tự động bật Chrome khi mở máy (Task Scheduler)

Chạy script PowerShell bên dưới **1 lần** với **Run as Administrator**:

```powershell
# Đường dẫn tới file .bat
$batPath = "$env:USERPROFILE\start-chrome-debug.bat"

# Kiểm tra file tồn tại
if (-not (Test-Path $batPath)) {
  Write-Host "LOI: Không tìm thấy $batPath" -ForegroundColor Red
  exit 1
}

# Tạo Scheduled Task
$action   = New-ScheduledTaskAction -Execute $batPath
$trigger  = New-ScheduledTaskTrigger -AtLogOn
$trigger.Delay = "PT10S"   # Delay 10 giây sau khi logon
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

## Bước 3: Sử dụng

Khi gửi tin nhắn cho bot, nói rõ **"dùng browser"** hoặc **"mở trình duyệt"**:

- ✅ "Dùng browser mở facebook.com rồi lấy bài post mới nhất"
- ✅ "Mở trình duyệt vào shopee.com tìm sản phẩm X"
- ❌ "Tìm kiếm X trên web" → Bot sẽ dùng web_search thay vì browser

> **Tip:** AI mặc định ưu tiên web_search (nhanh hơn). Phải nói rõ "browser" hoặc "trình duyệt" nếu cần điều khiển Chrome thực sự.

---

## Lưu ý quan trọng

| # | Lưu ý |
|---|-------|
| 1 | Chrome debug dùng **profile riêng** → phải login lại các trang web 1 lần |
| 2 | **Tắt Chrome thường** trước khi bật debug mode (script làm tự động) |
| 3 | Port 9222 chỉ bind localhost → **an toàn** trên mạng nội bộ |
| 4 | Container Docker thêm **~500MB** do cài Playwright engine |
| 5 | Chỉ hỗ trợ **Chrome/Chromium** (không Firefox/Safari) |

---

## Xóa Task Scheduler (nếu cần)

```powershell
Unregister-ScheduledTask -TaskName "OpenClaw-ChromeDebug" -Confirm:$false
```
