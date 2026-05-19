# OpenClaw Update Notes (Version 2026.5.12)

Từ các bản cập nhật gần đây (v2026.5.5 -> v2026.5.12), OpenClaw đã siết chặt các chính sách bảo mật mặc định. Để hệ thống chạy ổn định trên version mới nhất (khi Docker rebuild pull `openclaw@latest`), bạn cần áp dụng các thay đổi cấu hình sau vào repository chính:

## 1. SSRF Protection (Chặn IP nội bộ)

OpenClaw giờ đây đã áp dụng **SSRF guard** cho cả các request gọi LLM (`provider-transport-fetch`). Điều này có nghĩa là bất kỳ request nào gửi đến `localhost`, `127.0.0.1`, hay IP mạng nội bộ của Docker (`172.18.x.x` như trường hợp của `9router`) đều sẽ bị chặn với lỗi `"Blocked: resolves to private/internal/special-use IP address"`.

**Không có cách bypass bằng network level** (dù dùng `network_mode: service`, host.docker.internal, hay tên miền).

**Cách khắc phục:**
Bạn bắt buộc phải thêm option `"allowPrivateNetwork": true` vào block `"request"` của cấu hình provider. Cần cập nhật ở 3 file sau:

- `.openclaw/openclaw.json` (phần cấu hình models)
- `agents/bot/agent/models.json`
- `.openclaw/agents/main/agent/models.json`

_Ví dụ cấu hình cho `9router`:_

```json
"9router": {
  "baseUrl": "http://9router:20128/v1",
  "apiKey": "sk-no-key",
  "api": "openai-completions",
  "request": {
    "allowPrivateNetwork": true
  },
  "models": [ ... ]
}
```

## 2. Quyền Truy Cập (Scope) của Device

Mặc định khi một client/bot (CLI hoặc script) kết nối với Gateway qua token, nó chỉ được cấp scope cơ bản là `operator.pairing`.
Với scope này, bot **không thể** thực hiện các tác vụ quản trị như tạo Cronjob hay chạy lệnh hệ thống (exec). Khi thử chạy, Gateway sẽ chặn và yêu cầu user phải approve lệnh nâng cấp lên scope `operator.admin` (lỗi `device access upgrade requested reason=scope-upgrade`).

**Cách khắc phục:**
Trong file quản lý device đã pair (`.openclaw/devices/paired.json`), phải đảm bảo mảng `scopes` và `approvedScopes` chứa đầy đủ các quyền sau:

```json
"scopes": [
  "operator.admin",
  "operator.pairing",
  "operator.approvals"
]
```

## 3. Quyền đọc tin nhắn của Plugin ngoài (Third-party Plugins)

Các plugin không đi kèm mặc định (non-bundled plugins) như `zalo-mod` hiện bị siết quyền riêng tư. Gateway sẽ chặn không cho plugin sử dụng các hooks như `before_model_resolve` hay `before_agent_reply` để đọc context tin nhắn nếu chưa được cấp phép tường minh.
_(Lỗi: `blocked because non-bundled plugins must set plugins.entries.zalo-mod.hooks.allowConversationAccess=true`)_

**Cách khắc phục:**
Trong file `.openclaw/openclaw.json`, tại phần cấu hình của plugin `zalo-mod`, bạn phải thêm block `"hooks"`:

```json
"plugins": {
  "entries": {
    "zalo-mod": {
      "enabled": true,
      "hooks": {
        "allowConversationAccess": true
      },
      "config": {
        "botName": "sunie",
        ...
      }
    }
  }
}
```

---

**Lưu ý khi update lên Repo chính:**
Hãy đồng bộ cả 3 thay đổi trên vào mã nguồn (hoặc kịch bản bootstrap) để mỗi lần deploy/rebuild môi trường Docker ở các máy tính khác không bị lỗi tương tự.
