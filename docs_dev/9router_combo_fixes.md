# 9Router Fixes for OpenClaw Setup

Tài liệu này ghi chú toàn bộ các lỗi liên quan đến 9Router (v0.4.59) và giải pháp để áp dụng vào repository `openclaw-setup`.

## 1. Vấn đề với Combo UI bị ẩn (The `kind` issue)
- **Bug:** Code Frontend của 9Router lọc các combo hiển thị ở Dashboard bằng hàm `filter(c => !c.kind)`. Nếu tạo Combo thông qua API mà truyền thêm field `kind: 'combo'`, UI sẽ không bao giờ hiển thị Combo đó.
- **Fix:** Khi POST lên `/api/combos`, **TUYỆT ĐỐI KHÔNG** truyền field `kind`. API sẽ tự động lưu và UI sẽ hiển thị chính xác.

## 2. Vấn đề Lỗi 401 Unauthorized khi Sync Models
- **Bug:** Script `sync.js` chạy bên trong container cố gọi các REST API (`/api/combos`, `/api/providers`) trên cổng `21128`. Tuy nhiên, 9Router có cơ chế bảo vệ `requireLogin: true` (bật mặc định), khiến mọi API call không có session token đều bị HTTP 401.
- **Fix:** Phải có một hàm khởi tạo (thường đặt luôn trong `sync.js` hoặc file chạy ngay lúc boot) tác động trực tiếp vào Database SQLite để tắt `requireLogin`.
```javascript
const Database = require('better-sqlite3');
const db = Database('/root/.9router/db/data.sqlite');
const existing = db.prepare("SELECT * FROM settings WHERE id = 1").get();
if (!existing) {
  db.prepare("INSERT INTO settings (id, data) VALUES (1, ?)").run(JSON.stringify({ requireLogin: false }));
} else {
  const data = JSON.parse(existing.data || '{}');
  if (data.requireLogin !== false) {
    data.requireLogin = false;
    db.prepare("UPDATE settings SET data = ? WHERE id = 1").run(JSON.stringify(data));
  }
}
db.close();
```

## 3. Dynamic Model Syncing & No Overwriting
- **Bug:** `sync.js` cũ sử dụng `/v1/models` (chỉ trả về 5 models đang bật trong pool/combo) hoặc hardcode model list, làm thiếu sót các models mới của provider. Nó cũng liên tục đè dữ liệu mỗi 30 giây làm mất đi thao tác sắp xếp ưu tiên của User trên UI.
- **Fix:**
  1. Chỉ khởi tạo Combo `smart-route` duy nhất **LẦN ĐẦU TIÊN**. Nếu đã có, script phải return ngay lập tức.
  2. Lấy Full Danh Sách bằng cách:
     - Dùng `/api/providers` để lấy list provider IDs đang `isActive: true`.
     - Dùng `/api/models` (trả về full list toàn hệ thống). Lọc ra các model thuộc provider đang active, loại trừ các models phi-ngôn-ngữ (embedding, image, tts, stt).
     - Gom tất cả model tìm được nhét vào Combo `smart-route`.

## Về môi trường Williams
Môi trường `Williams` hiện tại **KHÔNG CẦN** áp dụng fix này ngay lập tức. Lý do:
1. `williams` đang dùng một custom docker image là `williams-brain-9router`, bên trong không chạy 9Router bản chuẩn qua npm mà là bản mod riêng có kiến trúc khác biệt.
2. DB của Williams là một file JSON (`db.json`) chứ không phải SQLite (`data.sqlite` của bản gốc 9router).
3. Bản thân `sync.js` trong Williams đã được fix theo format JSON đặc thù của nó và đang hoạt động tốt.

Tuy nhiên, nếu sau này bạn muốn cập nhật `williams` để đồng bộ hoàn toàn với `mkt-ai` (bỏ custom image và chạy bằng `node:22-slim` + `npm install -g 9router@latest`), thì **khi đó bạn sẽ phải áp dụng document này cho nó**.

---
### Source Tham Khảo Cho `sync.js` Mới Nhất
Hãy cập nhật script tạo file `sync.js` trong bash/docker script của `openclaw-setup` với logic bên dưới:

```javascript
const fs = require('fs');
const INTERVAL = 30000;
const DB_PATH = '/root/.9router/db/data.sqlite';
const PORT = process.env.PORT || 21128;
const COMBO_NAME = 'smart-route';
const API_BASE = `http://localhost:${PORT}`;

function ensureSettings() {
  try {
    let Database;
    try { Database = require('/usr/local/lib/node_modules/better-sqlite3'); } catch {
      try { Database = require('better-sqlite3'); } catch { return; }
    }
    const db = Database(DB_PATH);
    const existing = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    if (!existing) {
      db.prepare("INSERT INTO settings (id, data) VALUES (1, ?)").run(JSON.stringify({ requireLogin: false }));
    } else {
      try {
        const data = JSON.parse(existing.data || '{}');
        if (data.requireLogin !== false) {
          data.requireLogin = false;
          db.prepare("UPDATE settings SET data = ? WHERE id = 1").run(JSON.stringify(data));
        }
      } catch {}
    }
    db.close();
  } catch (e) {}
}

const sync = async () => {
  try {
    if (!fs.existsSync(DB_PATH)) return;

    let existingCombo = null;
    try {
      const resp = await fetch(`${API_BASE}/api/combos`);
      if (resp.status === 401) {
        ensureSettings();
        return;
      }
      const data = await resp.json();
      if (data.combos) {
        existingCombo = data.combos.find(c => c.name === COMBO_NAME);
      }
    } catch (e) { return; }

    if (existingCombo) return; // Do not overwrite user UI choices

    let activeProviders = [];
    try {
      const resp = await fetch(`${API_BASE}/api/providers`);
      const data = await resp.json();
      const conns = data.connections || data.providerConnections || [];
      activeProviders = [...new Set(
        conns.filter(c => c && c.provider && c.isActive !== false && !c.disabled).map(c => c.provider)
      )];
    } catch (e) { return; }

    if (!activeProviders.length) return;

    let models = [];
    try {
      const resp = await fetch(`${API_BASE}/api/models`);
      const data = await resp.json();
      if (data.models && Array.isArray(data.models)) {
        models = data.models
          .filter(m => activeProviders.includes(m.provider))
          .filter(m => !/(embedding|image|tts|stt|audio|vision)/i.test(m.model))
          .map(m => m.fullModel);
      }
      models = [...new Set(models)];
    } catch (e) { return; }

    if (!models.length) return;

    try {
      await fetch(`${API_BASE}/api/combos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: COMBO_NAME, models }) // Notice: No "kind" field!
      });
    } catch (e) {}
  } catch (e) {}
};

if (fs.existsSync(DB_PATH)) ensureSettings();
setTimeout(sync, 10000);
setInterval(sync, INTERVAL);
```

---

## 4. Tối ưu hóa Dockerfile (Loại bỏ Chromium/Playwright)
**Vấn đề:** 
Dockerfile cũ chứa lệnh tải Chromium và các thư viện hệ thống (`libnss3`, `libatk...`, `xvfb`) khiến Docker Image rất nặng (thêm hàng trăm MB), tốn RAM và build lâu.

**Giải pháp cho Local Machine (Máy cá nhân chạy Windows/Mac):**
Vì trên máy cá nhân bạn đã mở sẵn Chrome thật với chế độ debug port (`--remote-debugging-port=9222`), bot OpenClaw trong container chỉ cần "nói chuyện" với Chrome này qua địa chỉ `ws://host.docker.internal:9222`. Bạn **không cần** cài Chromium ngầm trong Docker nữa.

**Đã sửa Dockerfile:**
Thay vì tải toàn bộ trình duyệt, ta chặn tải browser bằng biến môi trường `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` và bỏ cài các thư viện đồ họa (`xvfb`):
```dockerfile
# Xóa xvfb, socat khỏi apt-get
RUN apt-get update && apt-get install -y git curl python3 && rm -rf /var/lib/apt/lists/*

# Chỉ cài thư viện NPM của playwright, KHÔNG tải Chromium binaries
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install -g agent-browser playwright
```
Và trong code của Plugin (ví dụ `openclaw-facebook-crawler`), thay vì dùng `chromium.launch()`, bạn gọi:
```javascript
const browser = await chromium.connectOverCDP({
  wsEndpoint: 'ws://host.docker.internal:9222'
});
```

### Vậy User khác dùng VPS (Không có giao diện UI) thì sao?
Trên VPS Linux thường không có giao diện đồ họa Desktop để mở Chrome thật. Lúc đó có **3 cách** để chạy:

1. **Cách 1: Dùng Container chuyên dụng (Khuyên Dùng)**
   Trong `docker-compose.yml`, thêm một service chạy Browser chuyên biệt như `browserless/chrome` hoặc `selenium/standalone-chrome`.
   ```yaml
   services:
     browser:
       image: browserless/chrome:latest
       ports:
         - "3000:3000"
   ```
   Lúc này, con bot OpenClaw siêu nhẹ ở service kia chỉ việc trỏ CDP về container này: `wsEndpoint: 'ws://browser:3000'`. Cách này sạch sẽ, chuyên nghiệp, bot tách biệt hoàn toàn với trình duyệt.

2. **Cách 2: Quay lại Dockerfile cũ (Headless Chrome)**
   Nếu user muốn bot tự chạy browser ngầm luôn trong 1 container, họ sẽ phải rollback lại Dockerfile như cũ (cài `xvfb` và `playwright install chromium --with-deps`) và chạy `chromium.launch({ headless: true })`.

3. **Cách 3: Dùng dịch vụ Cloud Browser**
   Thuê dịch vụ cung cấp Chrome có sẵn (như Browserless.io cloud). Bot chỉ cần kết nối qua 1 đường link WS có chứa API key của họ. Nhẹ server tuyệt đối.

