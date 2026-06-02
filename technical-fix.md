# Tài liệu Kiến trúc Kỹ thuật: Hệ thống Đa Bot Zalo (Zalo Personal Multi-Account)

Tài liệu này trình bày chi tiết kiến trúc kỹ thuật, quy trình xử lý, và các thay đổi mã nguồn đã thực hiện để hỗ trợ nhiều bot Zalo cá nhân (`zalouser`) độc lập chạy trên nền tảng Linux và Docker trong hệ sinh thái OpenClaw.

---

## 1. Bản đồ Kiến trúc Môi trường Linux & Docker

Trong môi trường này, dự án chạy trong một Docker Container (`openclaw-bot`) với các thư mục được mount từ host Linux vào container như sau:

| Thư mục trên Host Linux               | Thư mục trong Container        | Vai trò                                           |
| :------------------------------------ | :----------------------------- | :------------------------------------------------ |
| `/home/lilly-ubuntu-hp/bot`           | `/mnt/project`                 | Thư mục mã nguồn dự án                            |
| `/home/lilly-ubuntu-hp/bot/.openclaw` | `/home/node/project/.openclaw` | Thư mục dữ liệu cấu hình, plugins, và credentials |

### 1.1 Khác biệt Đường dẫn Docker: Linux (/home/node/project) vs. Windows/Root (/root/project)

Có sự khác biệt rất lớn về cách phân bổ thư mục và quyền chạy container giữa Docker trên Windows (mặc định chạy quyền root) và Docker trên Linux (thường chạy quyền user `node` để tăng tính bảo mật):

- **Môi trường Windows (Docker với quyền `root`)**:
  - Thư mục Home của container là `/root`.
  - Các đường dẫn cấu hình và plugin ban đầu của `openclaw-setup` mặc định trỏ vào `/root/project/.openclaw/...`.
- **Môi trường Linux (Docker với quyền `node`)**:
  - Thư mục Home của container là `/home/node` do container được cấu hình chạy dưới user `node`.
  - Dự án được mount vào `/home/node/project/`.
- **Vấn đề phát sinh**:
  - Nếu giữ nguyên đường dẫn mặc định `/root/project/...`, khi chạy các lệnh `docker exec` (như kiểm tra plugin registry, dọn dẹp credentials cũ, chạy lệnh login QR, cài đặt plugin mới), container sẽ báo lỗi do không tìm thấy tệp hoặc lỗi phân quyền vì user `node` không có quyền truy cập vào `/root/project/...`.
- **Giải pháp khắc phục**:
  - Toàn bộ mã nguồn phía backend setup CLI (`local-server.js`) đã được điều chỉnh để thay thế tất cả đường dẫn `/root/project` thành `/home/node/project` khi thao tác trong container.

> [!IMPORTANT]
> Toàn bộ logic giải quyết đường dẫn tuyệt đối ở phía setup CLI (chạy ngoài container) phải phân biệt rõ ràng giữa đường dẫn trên host `/home/lilly-ubuntu-hp/...` để ghi file cấu hình, và đường dẫn nội bộ container `/home/node/project/...` để container Docker có thể thực thi chính xác.

---

## 2. Quy trình Cấu hình & Phân lập Workspace

Khi người dùng tạo một bot mới (ví dụ ID: `zuli-bot-si`), Setup UI sẽ gửi thông tin tới Setup Backend (`local-server.js`), thực hiện cấu hình phân lập.

### Cấu hình `openclaw.json`

Mỗi bot cần một profile độc lập trong channel `zalouser` để tránh xung đột cấu hình. Các thay đổi trong `openclaw.json` bao gồm:

1. **`agents.list`**: Tạo một agent riêng biệt với `workspace` trỏ tới `/home/node/project/.openclaw/workspace-<agentId>`.
2. **`channels.zalouser.accounts`**: Đăng ký account tương ứng với `profile` trùng tên với `agentId` (trừ bot đầu tiên dùng `default` để tương thích ngược).
3. **`bindings`**: Ánh xạ chính xác giữa `agentId` với account của kênh `zalouser`.

```json
{
  "agents": {
    "list": [
      {
        "id": "zuli-bot-le",
        "name": "Zuli_bot_le",
        "workspace": "/home/node/project/.openclaw/workspace-zuli-bot-le",
        "agentDir": "agents/zuli-bot-le/agent"
      },
      {
        "id": "zuli-bot-si",
        "name": "Zuli_bot_si",
        "workspace": "/home/node/project/.openclaw/workspace-zuli-bot-si",
        "agentDir": "agents/zuli-bot-si/agent"
      }
    ]
  },
  "channels": {
    "zalouser": {
      "enabled": true,
      "defaultAccount": "default",
      "accounts": {
        "default": {
          "enabled": true,
          "profile": "default"
        },
        "zuli-bot-si": {
          "enabled": true,
          "profile": "zuli-bot-si"
        }
      }
    }
  },
  "bindings": [
    {
      "agentId": "zuli-bot-le",
      "match": {
        "channel": "zalouser",
        "accountId": "default"
      }
    },
    {
      "agentId": "zuli-bot-si",
      "match": {
        "channel": "zalouser",
        "accountId": "zuli-bot-si"
      }
    }
  ]
}
```

### Tạo Workspace Thư mục

Backend tự động sao chép các file mẫu (như `IDENTITY.md`, `rules.md`, `skills/`...) vào thư mục workspace vật lý trên host Linux tại `/home/lilly-ubuntu-hp/bot/.openclaw/workspace-<agentId>`, tương đương với đường dẫn `/home/node/project/.openclaw/workspace-<agentId>` bên trong container.

---

## 3. Cơ chế Lưu trữ & Cô lập Dữ liệu Phiên làm việc (Credentials Isolation)

Mỗi tài khoản Zalo khi đăng nhập thành công sẽ lưu trữ session (cookie, userAgent, imei...) trên đĩa cứng tại thư mục:
`/home/node/project/.openclaw/credentials/zalouser/` (đối ứng trên host: `/home/lilly-ubuntu-hp/bot/.openclaw/credentials/zalouser/`).

Để hỗ trợ nhiều tài khoản, tên file session được lưu trữ theo quy tắc:

- Account mặc định (`default`): `credentials.json`
- Account bổ sung (`<profile>`): `credentials-<profile>.json` (ví dụ: `credentials-zuli-bot-si.json`)

---

## 4. Quy trình Đăng nhập QR Zalo Đa Tài khoản

```mermaid
sequenceDiagram
    participant UI as Setup UI (Browser)
    participant Server as Setup CLI (Host /home/...)
    participant Docker as Container (Docker exec /home/node/...)
    participant Zalo as Máy chủ Zalo

    UI->>Server: POST /api/zalo/login { agentId: "zuli-bot-si" }
    Note over Server: Phân giải accountId & profile từ agentId<br/>profile = "zuli-bot-si"
    Server->>Docker: Xóa cred cũ: credentials-zuli-bot-si.json và QR code cũ
    Server->>Docker: Chạy login: openclaw channels login --channel zalouser --account zuli-bot-si
    Docker->>Zalo: Yêu cầu sinh mã QR đăng nhập
    Zalo-->>Docker: Trả về QR dạng base64
    Note over Docker: Ghi file QR tại:<br/>/tmp/openclaw-1000/openclaw-zalouser-qr-zuli-bot-si.png

    par Truy vấn QR liên tục (Polling)
        Server->>Docker: Chạy snippet Node đọc và encode base64 QR file
        Docker-->>Server: Trả về chuỗi base64 của ảnh QR
        Server-->>UI: Trả về log [zalouser:qr] data:image/png;base64,...
        UI->>UI: Hiển thị QR lên modal cho người dùng quét
    end

    Note over UI: Người dùng dùng app Zalo quét mã QR
    Docker->>Zalo: Hoàn tất xác thực đăng nhập
    Zalo-->>Docker: Lưu thông tin session đăng nhập thành công
    Note over Docker: Ghi file credentials-zuli-bot-si.json
    Docker-->>Server: Tiến trình login kết thúc (exit 0)
    Server->>Docker: Khởi động lại container (docker restart openclaw-bot)
    Server-->>UI: Báo cáo thành công
```

---

## 5. Đồng bộ hóa Nhóm & Khắc phục Lỗi Kỹ thuật

Khi đồng bộ hóa nhóm trên Dashboard (`zalo-mod` extension), hai thách thức kỹ thuật lớn đã được giải quyết:

### A. Tự động Khôi phục Phiên làm việc Zalo (On-Demand Session Restoration)

**Vấn đề**: OpenClaw gateway kiểm tra trạng thái đăng nhập qua heartbeat. Nếu có lỗi mạng hoặc kiểm tra heartbeat bị timeout, hệ thống sẽ gọi `invalidateApi()` và xoá thực thể ZCA API của bot lẻ/sỉ khỏi bản đồ bộ nhớ `globalThis.__zcaApiByProfile`. Lần đồng bộ kế tiếp sẽ báo lỗi: `No active Zalo API instance found for profile: zuli-bot-si`.

**Giải pháp**: Trong wrapper `getSafeZaloApi()` tại [index.js](file:///home/lilly-ubuntu-hp/bot/.openclaw/extensions/zalo-mod/index.js), nếu không tìm thấy thực thể API của profile trong map, hệ thống sẽ gọi hàm `getZaloUserInfo(profile)` từ module `test-api.js` của `zalouser` để kích hoạt kết nối lại phiên dựa trên cookie lưu trên đĩa và tái cấu trúc API trong RAM trước khi thực hiện hành động.

```javascript
// Trích đoạn mã nguồn getSafeZaloApi() cập nhật
async function getSafeZaloApi() {
  if (!globalThis.__zcaApiByProfile) {
    logger.info("[openclaw-zalo-mod] ZCA API map not exposed by zalouser yet");
    return null;
  }
  return async function withZaloApiShim(profile, operation) {
    const targetProfile = profile || "default";
    let activeApi = globalThis.__zcaApiByProfile.get(targetProfile);
    if (!activeApi) {
      try {
        const apiModule = await loadZaloApi();
        if (apiModule && typeof apiModule.getZaloUserInfo === "function") {
          logger.info(
            `[openclaw-zalo-mod] Profile ${targetProfile} not active in memory, attempting to restore session via getZaloUserInfo...`,
          );
          await apiModule.getZaloUserInfo(targetProfile);
          activeApi = globalThis.__zcaApiByProfile.get(targetProfile);
        }
      } catch (e) {
        logger.warn(
          `[openclaw-zalo-mod] On-demand session restore failed for profile ${targetProfile}: ${e.message}`,
        );
      }
    }
    // ... (phần còn lại của hàm)
    return await operation(activeApi);
  };
}
```

### B. Phân đoạn Lấy Thông tin Nhóm Hàng loạt (Batch Request Chunking)

**Vấn đề**: Hàm `api.getGroupInfo(ids)` của Zalo giới hạn số lượng nhóm trong một truy vấn. Đối với Wholesale Bot (`zuli-bot-si`) tham gia **103 nhóm**, việc truyền toàn bộ mảng ID vào hàm này khiến máy chủ Zalo trả về lỗi `Tham số không hợp lệ` (Invalid parameters) và làm thất bại toàn bộ tiến trình đồng bộ.

**Giải pháp**: Xây dựng hàm helper `getGroupInfoInBatches` để chia nhỏ danh sách ID thành các gói tối đa **30 nhóm**, thực hiện truy vấn tuần tự với độ trễ 1 giây để tránh bị giới hạn tần suất (rate limiting) từ Zalo, sau đó gộp kết quả trả về.

```javascript
// Hàm helper chia nhỏ yêu cầu getGroupInfo
async function getGroupInfoInBatches(zaloApi, ids) {
  const infoMap = {};
  if (!Array.isArray(ids) || !ids.length) return infoMap;
  const chunkSize = 30;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const infoResult = await zaloApi.getGroupInfo(chunk);
      if (infoResult?.gridInfoMap) {
        Object.assign(infoMap, infoResult.gridInfoMap);
      }
    } catch (err) {
      logger.warn(
        `[openclaw-zalo-mod] getGroupInfo batch failed for ${chunk.length} groups: ${err.message}`,
      );
    }
    if (ids.length > chunkSize && i + chunkSize < ids.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return infoMap;
}
```

Hàm này được áp dụng thành công tại hai điểm chính trong [index.js](file:///home/lilly-ubuntu-hp/bot/.openclaw/extensions/zalo-mod/index.js):

1. **Đồng bộ nhóm của Dashboard**: Trong hành động `sync-groups`.
2. **Thêm hàng loạt nhóm**: Trong hành động `processGroupidAddAll`.

---

## 6. Logic Xử lý Giao diện Đa Bot (UI & CSS)

### Dashboard Zalo Mod

1. **Huy hiệu Bot (Bot Badges)**: Cạnh mỗi nhóm trong giao diện, hệ thống hiển thị một pill badge (huy hiệu dạng viên thuốc) tương ứng với tên Bot (ví dụ: `zuli-bot-le` nền xanh biển, `zuli-bot-si` nền xanh lá cây) dựa trên thuộc tính `profile` được backend trả về.
2. **Bộ lọc Nhóm & Thành viên (Dynamic Filters)**:
   - Thêm dropdown bộ lọc ở phía trên danh sách nhóm và thành viên: "Tất cả Bot", "zuli-bot-le", "zuli-bot-si".
   - Khi chọn một bot cụ thể, bảng hiển thị nhóm và danh sách thành viên tương ứng sẽ lập tức lọc động ở phía Client-side.
   - Thư mục styling [dashboard.css](file:///home/lilly-ubuntu-hp/bot/.openclaw/extensions/zalo-mod/dashboard.css) định nghĩa giao diện kính mờ (glassmorphism), pill badges màu sắc tương phản dịu và nút chọn phân đoạn (segmented control) cao cấp.

---

## 7. Tổng kết các tệp tin cấu hình và mã nguồn cần cập nhật trong Repository

Để đồng bộ các thay đổi này sang kho lưu trữ (repository) chính thức:

### A. Repository `openclaw-setup`

- **`src/server/local-server.js`** & **`dist/server/local-server.js`**:
  - **Sửa đổi đường dẫn Docker**: Thay thế toàn bộ các tham chiếu đường dẫn cứng từ `/root/project/...` thành `/home/node/project/...` trong tất cả các đoạn mã thực thi lệnh `docker exec` (như kiểm tra cài đặt plugin, dọn dẹp file, cài đặt/gỡ cài đặt plugin, khởi chạy lệnh login Zalo).
  - Hàm `createBotInProject` & `updateBotInProject`: Tạo workspace phân lập riêng dạng `workspace-<agentId>` thay vì dùng chung thư mục mặc định.
  - Hàm `startZaloUserLogin`: Cô lập tên file QR code (`openclaw-zalouser-qr-<profile>.png`) và file credential (`credentials-<profile>.json`), thực thi dọn dẹp và chạy login theo tham số `--account <accountId>` cụ thể.
- **`src/web/app.js`** & **`dist/web/app.js`**:
  - Đảm bảo POST payload tới `/api/zalo/login` đính kèm thuộc tính `agentId`.

### B. Repository Plugin `zalo-mod`

- **`index.js`**:
  - Cập nhật `getSafeZaloApi` để khôi phục phiên kết nối tự động bằng cách gọi `getZaloUserInfo`.
  - Thêm helper `getGroupInfoInBatches` và thay thế toàn bộ lệnh gọi `api.getGroupInfo(ids)` có tính chất gom nhóm hàng loạt.
  - Trong hành động `sync-groups`, chỉ thực hiện xóa các nhóm của các profile đã đồng bộ thành công (`successfulProfiles`) để tránh mất mát dữ liệu chéo.
  - Cập nhật `buildDashboardState()` để đính kèm thuộc tính `profile` trong từng đối tượng nhóm và trả về sơ đồ phân loại cấu hình bot (`bots`).
- **`index.html`** & **`dashboard.js`**:
  - Xây dựng HTML container cho bộ lọc nhóm `#groupBotFilters` và thành viên `#memberBotFilters`.
  - Xây dựng logic render badges dựa trên `profile` của nhóm và gắn event listeners cho các bộ lọc bot.
- **`dashboard.css`**:
  - Bổ sung class `.bot-badge`, `.badge-le`, `.badge-si` và `.bot-filters` kèm hiệu ứng hover động mượt mà.
