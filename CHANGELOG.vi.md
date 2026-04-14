# Changelog (Tiếng Việt)


## [5.4.1] — 2026-04-14

### 🐛 Sửa Lỗi Build Dockerfile

- **Phục hồi hỗ trợ Trình duyệt**: Đưa trở lại gói lệnh cài đặt `xvfb` APT và việc thực thi Xvfb quay trong nền (`Xvfb :99 -screen...`) vào Dockerfile `CMD`. Nó giúp các bot chạy Playwright có giao diện headful khởi động mà không bị crash vì thiếu khung màn hình.
- **Sửa lỗi REST API CORS**: Khôi phục script tiêm dải IP nội bộ lúc runtime. Script này tự động lấy các bridge IP nội bộ của Docker (`172...`) để cấp phép vào mục `allowedOrigins` cho `openclaw.json` ngay lúc container khởi động, sửa hoàn toàn lỗi bị block CORS 403 không vào được Web UI.

### 🧹 Tự Động Tạo Script Gỡ Cài Đặt

- **Tính Năng Wizard UI**: Giao diện HTML wizard giờ đây sẽ tự động tải thêm một file script dọn dẹp hệ thống (`uninstall-openclaw-*.bat/sh`) mỗi khi tải file cài đặt cho Native hoặc Docker.
- **Dọn Dẹp Triệt Để**: Các script này giúp dừng sạch sẽ các tiến trình nền của 9Router/OpenClaw, gỡ cài đặt các gói npm toàn cầu và xoá an toàn thư mục project cũng như data `.9router`, giúp bạn làm sạch máy để cài đặt lại dễ dàng.


## [5.4.0] — 2026-04-14

### 🗑️ Xóa: Kênh Combo Telegram + Zalo

- **Tạm ngưng và xóa chế độ `telegram+zalo-personal` khỏi cả Web Wizard lẫn CLI.** Card kênh bị ẩn trong `index.html`, xóa khỏi `channels.js` và `data/index.js`, toàn bộ logic điều kiện liên quan đã được dọn sạch khỏi `controller.js`, `output.js`, `steps.js`, `multi-bot.js`, `win-bat.js`, `macos-sh.js`, `linux-sh.js`, `vps-sh.js`, `native-helpers-gen.js` và `cli.src.js`. Combo mode sẽ được thiết kế lại trong bản phát hành tương lai.

### 🏗️ Tái cấu trúc: Kiến Trúc Multi-Bot

- **Gộp flag multi-bot** — `isTelegramMultiBot`, `isSharedMultiBot` và `isMultiBotWizard` đã được hợp nhất thành một biến `isMultiBot` duy nhất xuyên suốt codebase. Giảm độ phức tạp và loại bỏ các nhánh code phân kỳ.
- **Sửa đường dẫn `agentDir`** — `agentDir` trong `openclaw.json` được tạo ra nay được đặt đúng là `.openclaw/agents/{slug}/agent` (tương đối với `OPENCLAW_HOME`). Trước đây dùng đường dẫn sai ở root project gây lỗi double-prefix khi runtime.
- **Xóa thư mục `agents/` thừa ở gốc project** — OS scripts không còn cố tạo `mkdir agents/` ở root; toàn bộ file agent được tạo trong `.openclaw/agents/`.

### 🧹 Dọn Dẹp Config Generation

- **Xóa `auth-profiles.json` per-agent khi dùng 9Router/proxy** — Khi provider là proxy, không còn sinh per-agent `auth-profiles.json` nữa. File này chỉ được tạo cho các provider API trực tiếp khi cần xác thực riêng từng agent.
- **Xóa `.env` trong native deployment** — Token bot và API key cho native mode giờ được quản lý qua `openclaw channels login` / 9Router dashboard. Không còn tự sinh `.env` trong native scripts để tránh rò rỉ credentials.
- **Xóa `models.json` per-agent cho Ollama (CLI)** — Config model Ollama đã khai báo trong `openclaw.json → agents.defaults.model`. File `models.json` thừa trong `agents/{id}/agent/` không còn được sinh nữa.

### 🤝 Quy Tắc Cross-Workspace trong AGENTS.md

- **`AGENTS.md` multi-bot có thêm mục "Workspace Chéo"** — Ở chế độ multi-bot (relay), `AGENTS.md` của mỗi bot có thêm mục `🤝 Workspace Chéo (Multi-Agent)` liệt kê đường dẫn workspace của các bot anh em. Quy tắc: bot được phép đọc `IDENTITY`, `SOUL`, `MEMORY` của bot khác để hiểu ngữ cảnh chung; không được xóa hoặc ghi đè file workspace của bot khác trừ khi user yêu cầu rõ ràng.

### 🔧 Tái Cấu Trúc win-bat.js

- **Tách `appendGatewayStart()` và `appendDashboardInfo()` thành helper riêng** — Các đoạn code khởi động gateway PowerShell và in URL dashboard được lặp đi lặp lại đã được đóng gói vào 2 hàm helper cục bộ trong `generateWinBat`, giảm khoảng 50 dòng code.


## [5.3.5] — 2026-04-12

### 🐛 Sửa: Lỗi Syntax MEMORY.md trong Workspace Zalo

- **Sửa: `SyntaxError: Unexpected token ':'` trong `setup.js`** — Patch TOOLS.md trước đó được chèn sau nhánh `vi` của ternary MEMORY.md, khiến nhánh `: en-value` bị bỏ lơ phía dưới. VS Code hiển thị badge đỏ số "7" trên `setup.js`. Đã fix; hai nhánh MEMORY.md nay liền kề nhau, TOOLS.md theo sau như property riêng biệt.

### 🐟 Cải Tiến: Script Gỡ Cài Đặt Nằm Trong Thư Mục Project

- **Tất cả 4 luồng native OS + Docker ZIP** giờ đều có sẵn file `uninstall-*.{bat,sh}` **trong thư mục project** ngay sau khi setup chạy xong. Trước đây uninstall chỉ có thể tải riêng từ trình duyệt. Pattern giống `start-chrome-debug.bat` / `.sh`:
  - Windows native: `uninstall-openclaw-win.bat` viết qua `appendBatWriteCommands`
  - macOS native: `uninstall-openclaw.sh` viết qua `appendShWriteCommands`
  - VPS/Ubuntu: `uninstall-openclaw-vps.sh` viết qua `appendShWriteCommands`
  - Linux Desktop: `uninstall-openclaw.sh` viết qua `appendShWriteCommands`
  - Docker (mọi OS): uninstall script có trong ZIP generatedFiles


## [5.3.4] — 2026-04-12

### 🐛 Windows Native — Ổn Định Gateway & Workspace

- **Sửa: Terminal tự đóng sau khi khởi động gateway** — `call openclaw gateway run` chặn terminal vô thời hạn; đóng cửa sổ khiến gateway chết theo. Gateway giờ được mở trong **cửa sổ CMD riêng biệt** qua PS1 launcher (giống 9Router), setup terminal đóng gọn mà gateway vẫn chạy độc lập.
- **Sửa: Thiếu `call` trước `openclaw gateway stop`** — Lệnh dừng gateway trước khi khởi động lại thiếu từ khóa `call`, có thể khiến bat script không trả quyền điều hành sau khi stop. Đã thêm `call openclaw gateway stop 2>nul` cho tất cả luồng.
- **Sửa: Tên workspace** — Single-bot deployment trước đây dùng chung `.openclaw/workspace`. Giờ tất cả agent đều có thư mục riêng theo tên agent ID: `.openclaw/workspace-{agentId}` (ví dụ `workspace-williams`, `workspace-luna`). Tránh xung đột và đồng bộ với cấu trúc `agents/{agentId}`.
- **Cải tiến: TOOLS.md đầy đủ hơn cho mọi bot** — File `TOOLS.md` được tạo ra giờ bao gồm cả mục danh sách skills + quy ước VÀ section "Ghi chú thiết lập của bạn" theo chuẩn OpenClaw, giúp người dùng có điểm xuất phát rõ ràng để ghi lại cấu hình môi trường riêng.
- **Cải tiến: AGENTS.md cho Zalo bot bổ sung quy tắc bảo mật** — `AGENTS.md` sinh ra cho bot Zalo Personal (kiểu Luna) giờ có thêm block `🔐 Quy Tắc Bảo Mật — BẮT BUỘC` giống hệt bot Telegram (giới hạn file-system, bảo vệ credentials, ví crypto, mount Docker).
- **Cải tiến: Thêm TOOLS.md cho Zalo bot** — Workspace của bot Zalo giờ cũng có file `TOOLS.md` cùng cấu trúc với bot Telegram.


## [5.3.3] — 2026-04-11

### 🧹 Tự Động Tạo Script Gỡ Cài Đặt

- **Tính Năng Wizard UI**: Giao diện HTML wizard giờ đây sẽ tự động tải thêm một file script dọn dẹp hệ thống (`uninstall-openclaw-*.bat/sh`) mỗi khi tải file cài đặt cho Native hoặc Docker.
- **Dọn Dẹp Triệt Để**: Các script này giúp dừng sạch sẽ các tiến trình nền của 9Router/OpenClaw, gỡ cài đặt các gói npm toàn cầu và xoá an toàn thư mục project cũng như data `.9router`, giúp bạn làm sạch máy để cài đặt lại dễ dàng.



## [5.3.2] — 2026-04-11

### 🐛 Windows Native — Sửa Lỗi Khởi Động 9Router

- **Sửa: Bỏ flag `-l` (chế độ đọc stdin) khỏi lệnh launch 9Router** — `resolveNative9RouterDesktopLaunch()` trước đây truyền `-l` khiến 9Router chạy ở chế độ REPL tương tác. Khi chạy ẩn (không có TTY), tiến trình bị treo chờ stdin mà không bao giờ nhận được. Đã bỏ flag; 9Router giờ khởi động ổn định ở nền trên Windows, macOS desktop và mọi luồng native không phải VPS.
- **Sửa: Pre-seed `DATA_DIR/.9router/db.json` với `requireLogin: false` trước khi 9Router khởi động** — Nếu `db.json` chưa tồn tại khi 9Router khởi chạy, nó dùng đường dẫn mặc định của riêng mình (`~/.9router`) và đặt `requireLogin` là `true`, gây ra màn hình login khi mở dashboard. CLI wizard giờ tạo thư mục `.9router` và ghi sẵn `db.json` (với `requireLogin: false`) **trước** khi spawn 9Router, khớp với hành vi của file `setup-openclaw-win.bat` đã được sửa.
- **Không thay đổi luồng PM2/VPS** — Fix chỉ áp dụng cho path spawn nền của desktop (`osChoice !== 'vps'`). Người dùng VPS vẫn dùng luồng PM2 `startNative9RouterPm2` hiện tại, không bị ảnh hưởng.

## [5.3.1] — 2026-04-10

### 🌟 Đổi Chính Sách Bảo Mật Zalo Personal

- **Thả Ga Inbox Zalo Cầm Tay**: Lược bỏ rào cản duyệt bảo mật của Zalo Personal. Thông số `dmPolicy` trên cài đặt Zalo cá nhân đã được chuyển mặc định từ `pairing` sang `open`. Bây giờ bất cứ ai trên mạng lưới Zalo nhắn tin vào tài khoản của Bot đều sẽ được AI tự động tiếp đón ngay lập tức thay vì bị chặn lại chờ bạn duyệt lệnh kết nối E2E!


## [5.3.0] — 2026-04-11

### 🆕 Đa Kênh: Telegram + Zalo Personal Cùng Lúc

- **Tuỳ chọn kênh combo** — Thêm `telegram+zalo-personal` vào CLI wizard (menu `select`) và web wizard (channel card). Chọn option này để cấu hình 1 bot nhận tin nhắn từ cả Telegram **và** Zalo Personal cùng lúc trong 1 config duy nhất.
- **Tự inject `plugins.entries.zalouser`** — Khi chọn bất kỳ kênh Zalo Personal nào, `openclaw.json` giờ tự thêm `plugins.entries.zalouser: { enabled: true }`, xử lý nguyên nhân gốc rễ của lỗi "not configured" khi Zalo khởi động.
- **Fix cold-start Docker tích hợp sẵn** — Script nền `(sleep 45 && node -e '...touch historyLimit...')` giờ được baked thẳng vào Dockerfile CMD được generate. Kích hoạt chokidar → hot-reload gateway → `restartChannel('zalouser')` sau khi Docker network ổn định. Không cần hack `lastTouchedAt` thủ công nữa.
- **Helper predicates** — Thêm `hasTelegram(ck)` và `hasZaloPersonal(ck)` thay thế tất cả so sánh literal `channelKey === 'telegram/zalo-personal'` trong `cli.js` để dễ mở rộng sau này.
- **Cập nhật smoke tests** — `tests/smoke-cli-logic.mjs` cập nhật để match logic predicate mới (78 checks passing).

## [5.2.3] — 2026-04-10

### 🐛 Sửa lỗi & Cải thiện encoding

- **Fix: `ReferenceError: projectDir is not defined`** — Crash khi bấm "Generate Configs" ở chế độ multi-bot. Biến `projectDir` không được khai báo trong `buildTelegramPostInstallChecklist()` và là dead code (không dùng trong return). Đã xoá.
- **Fix: Nút "Tiếp theo" ở Bước 3 bị validate sai** — `state._activeBotTab` là typo của `state.activeBotIndex`, khiến validation multi-bot luôn đọc sai tab index.
- **Fix: `saveFormData()` luôn lưu tên bot vào `bots[0]`** — Trong multi-bot mode, tên bot đang active bị ghi đè cố định vào `bots[0]` thay vì `bots[state.activeBotIndex]`. Đã sửa.
- **UX: Hiển thị gợi ý khi nút "Generate Configs" bị khoá** — Khi nút bị disable, một cảnh báo xuất hiện ngay bên dưới cho biết trường nào còn thiếu (ví dụ: "Còn thiếu: GOOGLE_API_KEY").
- **Fix: Tiếng Việt có dấu trong file `.bat` và `.sh` được tạo ra** — Toàn bộ chuỗi echo/Write-Host tiếng Việt có dấu trong script cài đặt cho Windows và Linux/macOS đã được chuyển về dạng không dấu (ASCII thuần) để tránh lỗi encoding trên các máy không dùng UTF-8.

## [5.2.2] — 2026-04-10


### 🐛 Sửa lỗi Docker & Native PM2

- **Sửa crash loop Docker (xung đột port socat)**: `socat TCP-LISTEN:18791` chiếm port `0.0.0.0:18791` trước khi `openclaw gateway run` khởi động, gây `EADDRINUSE`. Đã xóa gateway bridge khỏi Dockerfile CMD trong `cli.js` và `setup.js`.
- **Sửa Dashboard Docker không vào được từ host**: Gateway `bind` đặt là `'loopback'` — Docker port mapping không reach được loopback bên trong container. Khôi phục pattern đúng từ v5.0.9: `bind:'custom', customBindHost:'0.0.0.0'`.
- **Sửa `delete c.gateway.customBindHost`**: Một lệnh `delete` thừa đang xóa key `customBindHost` ngay sau khi set. Đã xóa dòng đó.
- **Sửa Docker tải lại npm mỗi lần build**: `ARG CACHEBUST=<timestamp>` bust cache layer `npm install -g openclaw` mỗi lần build dù chỉ đổi config. Thay bằng `ARG OPENCLAW_VER` ổn định theo version — Docker tái sử dụng cache giữa các lần rebuild.
- **Sửa lồng đôi `.openclaw` trong native PM2**: `ecosystem.config.js` đang đặt `OPENCLAW_HOME: projectDir/.openclaw`, khiến OpenClaw resolve workspace thành `projectDir/.openclaw/.openclaw/workspace`. Đã xóa `OPENCLAW_HOME` khỏi PM2 env; OpenClaw tự tìm config qua `cwd` (khớp với v5.0.9).


## [5.2.1] — 2026-04-09

### 🐛 Sửa Lỗi Ubuntu/VPS Native

- **Sửa `Bot-9router errored` (PM2 ↺ 15)**: `resolveNative9RouterDesktopLaunch` cố tìm file `9router/app/server.js` trong thư mục npm global — đường dẫn này không tồn tại sau `npm install -g 9router`. Giờ dùng trực tiếp binary `9router` CLI với các tham số đúng (`-n -l -H 0.0.0.0 -p 20128 --skip-update`), loại bỏ hoàn toàn vòng lặp restart.
- **Sửa đường dẫn workspace bị double `.openclaw`**: `workspace` và `agentDir` trong `openclaw.json` được sinh ra dưới dạng đường dẫn tuyệt đối (ví dụ `/home/user/bot/.openclaw/workspace`). OpenClaw giải quyết các path này tương đối với `OPENCLAW_HOME`, gây ra double-prefix (`/home/user/bot/.openclaw/.openclaw/workspace`). Đã chuyển sang path tương đối (`workspace`, `agents/<id>/agent`) giống Docker mode.
- **Sửa thiếu runtime packages khi cài native**: `grammy`, `@grammyjs/runner`, `@grammyjs/transformer-throttler`, `@buape/carbon`, `@larksuiteoapi/node-sdk`, `@slack/web-api` được cài trong Docker (Dockerfile) nhưng bỏ qua ở native. `installLatestOpenClaw` giờ cài toàn bộ `OPENCLAW_RUNTIME_PACKAGES` sau binary chính.
- **Sửa `openclaw: command not found` sau khi cài**: Hướng dẫn login Zalo sau setup giờ có thêm gợi ý `source ~/.bashrc && source ~/.profile` cho terminal mới trên Linux.
- **Sửa Zalo session lưu sai thư mục**: Lệnh login thủ công giờ bao gồm env vars `OPENCLAW_HOME` và `OPENCLAW_STATE_DIR` để session được lưu vào `<projectDir>/.openclaw/credentials/zalouser/` — đúng chỗ gateway PM2 đọc.
- **Sửa đường dẫn project tương đối**: Input `projectDir` giờ được chuẩn hóa bằng `path.resolve()` để gõ `home/ubuntu/bot` (thiếu `/` đầu) tự động thành `/home/ubuntu/bot`.


## [5.2.0] — 2026-04-09

### Upgrade 1 Lệnh (Không Cần Chạy Lại Wizard)

- Thêm subcommand `upgrade` vào CLI: `npx create-openclaw-bot@latest upgrade`. Tự nhận diện Docker hay Native/PM2 và cập nhật OpenClaw mà không cần chạy lại wizard.
- Thêm `upgrade.ps1` cho Windows — nhấp đúp trong thư mục bot là tự động upgrade. Không cần biết terminal.
- Thêm `upgrade.sh` cho Linux / macOS / Ubuntu — `bash upgrade.sh` hoặc pipe trực tiếp qua `curl`/`wget` từ GitHub.
- Toàn bộ dữ liệu người dùng giữ nguyên: `.env`, `.openclaw/memory/`, sessions, credentials, OAuth token 9Router không bao giờ bị xoá.
- Docker mode: vá `Dockerfile` (cập nhật `OPENCLAW_NPM_SPEC` + `CACHEBUST`) → `docker compose build --no-cache` + `docker compose up -d`.
- Native/PM2 mode: cài lại `openclaw` + `9router` global → `pm2 restart all`.


## [5.1.15] â€” 2026-04-08

### Dong Bo Native Setup & Sua Loi Wizard Windows

- Sua wizard HTML tren Windows native de file `.bat` tai ve luon duoc regenerate theo state moi nhat truoc khi download.
- Sua toan bo runtime path tren Windows native theo project dir nguoi dung nhap: `.env`, `.openclaw` va `.9router` khong con roi ve home/AppData.
- Them `OPENCLAW_STATE_DIR` vao native runtime env de OpenClaw doc dung config duoc sinh trong thu muc project.
- Chong format config legacy `gateway.bind: "0.0.0.0"` va chuyen sang `bind: "custom"` + `customBindHost: "0.0.0.0"`.
- Sua luong single-bot tren Windows native de provider, model, API key va Telegram bot token tu wizard duoc sync dung vao `.env` va `openclaw.json`.
- Sua native Windows 9Router path resolution va doi helper sync `smart-route` sang lay active providers tu API song cua `9Router`, khop voi logic Docker.
- Bu native parity cho skill/runtime tren Windows: skill duoc cai tu dong, browser automation tu cai runtime can thiet, va `skills.entries` dung dung `slug`.
- Cap nhat native script cho macOS, Linux Desktop va Ubuntu/VPS de chay tu `PROJECT_DIR` duoc chon va export `OPENCLAW_HOME`, `OPENCLAW_STATE_DIR`, `DATA_DIR` theo project-local.
- Mo rong smoke test cho runtime path native, 9Router sync, provider/token sync, browser install va luong startup project-local tren Unix.

## [5.1.14] â€” 2026-04-08

### Sá»­a lá»—i á»•n Ä‘á»‹nh OpenClaw vÃ  Docker

- Pin láº¡i OpenClaw vá» `openclaw@2026.4.5` vÃ¬ báº£n cáº­p nháº­t ngÃ y `08/04/2026` Ä‘ang lá»—i.
- Sá»­a Dockerfile cho cÃ¡c case Docker trÃªn Windows Ä‘á»ƒ trÃ¡nh lá»—i startup do escape command sai vÃ  lá»—i `allowedOrigins`.
- ThÃªm ghi chÃº khuyÃªn dÃ¹ng `Node.js 20` Ä‘áº¿n `24`, táº¡m trÃ¡nh `Node.js 25` Ä‘á»ƒ á»•n Ä‘á»‹nh hÆ¡n vá»›i OpenClaw.

## [5.1.13] â€” 2026-04-08

### ðŸ› Sá»­a lá»—i cÃ i macOS & á»•n Ä‘á»‹nh Wizard

- **Sá»­a lá»—i `mkdir: : No such file or directory` trÃªn macOS**: `generateSetupScript` dÃ¹ng `\${dir}` / `\${path}` (escaped) táº¡o ra biáº¿n bash rá»—ng â€” giá» dÃ¹ng JS interpolation Ä‘ÃºÌng nÃªn Ä‘Æ°á»ng dáº«n thá»±c táº¿ Ä‘Æ°á»£c ghi vÃ o script.
- **Sá»­a script Docker macOS**: ThÃªm kiá»ƒm tra Docker daemon `docker info` trÆ°á»›c khi cháº¡y `docker compose up`; cháº¿ Ä‘á»™ Docker giá» gá»i Ä‘ÃºÌng `docker compose up` thay vÃ¬ `openclaw gateway run`.
- **Sá»­a npm prefix macOS Native**: Bá» `npm config set prefix` gÃ¢y xung Ä‘á»™t vá»›i Homebrew Node.js. Giá» dÃ¹ng `export npm_config_prefix` (env var cho session hiá»‡n táº¡i) vÃ  fallback `sudo npm install -g`.
- **Sá»­a `window.__saveBotTabPersona is not a function`**: ThÃªm hÃ m `__saveBotTabPersona` bá»‹ thiáº¿u â€” HTML gá»i nhÆ°ng JS chÆ°a Ä‘á»‹nh nghÄ©a.
- **Sá»­a nÃºt Tiáº¿p theo Step 3 cháº¿ Ä‘á»™ 1 bot**: `bindFormEvents` giá» sync `cfg-name` vÃ o `state.config.botName` vÃ  `state.bots[0].name` ngay khi gÃµ, rá»“i gá»i `updateNavButtons()` â€” nÃºt Tiáº¿p pháº£n há»“i ngay khÃ´ng cáº§n chuyá»ƒn bÆ°á»›c.
- **Sá»­a persona riÃªng tá»«ng bot**: `saveBotTabMeta` vÃ  `syncBotTabMeta` giá» save/restore field `cfg-bot-tab-persona` cho tá»«ng bot. Chuyá»ƒn tab hiá»ƒn thá»‹ Ä‘ÃºÌng ná»™i dung persona tÆ°Æ¡ng á»©ng; giÃ¡ trá»‹ lÆ°u vÃ o `state.bots[i].persona` vÃ  Ä‘Æ°á»£c dÃ¹ng chÃ­nh xÃ¡c khi táº¡o file `.md`.
- **Sá»­a cli.js npm macOS**: `ensureUserWritableGlobalNpm` bá» `npm config set prefix` trÃªn darwin; `installGlobalPackage` thÃªm `sudo npm install -g` lÃ m fallback.

## [5.1.12] â€” 2026-04-07

### ðŸ§  ThÃªm Skills & Tá»± Ä‘á»™ng chá»n Plugin Relay

- **Grid Skills 3 cá»™t**: Layout má»›i 3 card/hÃ ng thay vÃ¬ 4, card rá»™ng rÃ£i hÆ¡n, dá»… Ä‘á»c hÆ¡n.
- **7 Skills má»›i tá»« ClawHub**: Bá»• sung Ä‘áº§y Ä‘á»§ `Web Search`, `GitHub`, `Notion`, `Slack` â€” phá»§ kháº¯p cÃ¡c tÃ¡c vá»¥ nÄƒng suáº¥t phá»• biáº¿n nháº¥t trÃªn OpenClaw dashboard.
- **Plugin Telegram Multi-Bot Relay tá»± Ä‘á»™ng**: Khi chá»n nhiá»u bot Telegram (botCount â‰¥ 2), plugin `telegram-multibot-relay` Ä‘Æ°á»£c tá»± Ä‘á»™ng tick chá»n vÃ  ghi vÃ o `openclaw.json â†’ plugins.entries`. Khi quay vá» 1 bot, plugin bá»‹ bá» chá»n.
- **Plugin selections â†’ openclaw.json**: Táº¥t cáº£ plugin Ä‘Æ°á»£c user chá»n (Voice Call, Matrix, MS Teams, Nostr...) Ä‘á»u Ä‘Æ°á»£c inject vÃ o `plugins.entries` Ä‘á»ƒ Dashboard OpenClaw nháº­n tráº¡ng thÃ¡i `enabled` Ä‘Ãºng. KhÃ´ng chá»n = khÃ´ng báº­t.
- **Fix Step 3 "Tiáº¿p theo" bá»‹ disabled**: Bá» yÃªu cáº§u báº¯t buá»™c `cfg-user-info` (optional), sá»­a multi-bot check dÃ¹ng `cfg-bot-tab-name`.
- **Fix Step 4 multi-bot token**: Validate `key-bot-token-0` thay vÃ¬ `key-bot-token` khi multi-bot Telegram.
- **Fix AGENTS.md native multi-bot thiáº¿u quy táº¯c báº£o máº­t**: Inject `securityRules` vÃ o cuá»‘i AGENTS.md cá»§a tá»«ng bot trong native multi-bot deployment.

### ðŸŒŸ Äá»•i ChÃ­nh SÃ¡ch Báº£o Máº­t Zalo Personal

- **Tháº£ Ga Inbox Zalo Cáº§m Tay**: LÆ°á»£c bá» rÃ o cáº£n duyá»‡t báº£o máº­t cá»§a Zalo Personal. ThÃ´ng sá»‘ `dmPolicy` trÃªn cÃ i Ä‘áº·t Zalo cÃ¡ nhÃ¢n Ä‘Ã£ Ä‘Æ°á»£c chuyá»ƒn máº·c Ä‘á»‹nh tá»« `pairing` sang `open`. BÃ¢y giá» báº¥t cá»© ai trÃªn máº¡ng lÆ°á»›i Zalo nháº¯n tin vÃ o tÃ i khoáº£n cá»§a Bot Ä‘á»u sáº½ Ä‘Æ°á»£c AI tá»± Ä‘á»™ng tiáº¿p Ä‘Ã³n ngay láº­p tá»©c thay vÃ¬ bá»‹ cháº·n láº¡i chá» báº¡n duyá»‡t lá»‡nh káº¿t ná»‘i E2E!

## [5.1.10] â€” 2026-04-07

### ðŸŒŸ Tá»± Ä‘á»™ng Auto-Approve Thiáº¿t Bá»‹ cho Native VPS

- **Bá» Nháº­p Lá»‡nh Thá»§ CÃ´ng Tráº£i Nghiá»‡m PM2**: Cáº£nh bÃ¡o `pairing required` (chá» duyá»‡t thiáº¿t bá»‹ ghÃ©p ná»‘i E2E) trÃªn giao diá»‡n Web buá»™c ngÆ°á»i dÃ¹ng pháº£i gÃµ lá»‡nh Ä‘á»“ng Ã½ dÆ°á»›i Terminal. á»ž luá»“ng Docker, tÃ­nh nÄƒng nÃ y Ä‘Ã£ Ä‘Æ°á»£c vÃ´ hiá»‡u hÃ³a báº±ng má»™t Ä‘oáº¡n script cháº¡y ngáº§m tá»± gáº­t Ä‘áº§u. NhÆ°ng á»Ÿ Native thÃ¬ chÆ°a! PhiÃªn báº£n nÃ y chÃ­nh thá»©c nhÃºng thÃªm 1 tiáº¿n trÃ¬nh PM2 `auto-approve` siÃªu nháº¹ cháº¡y káº¹p vá»›i cÃ¡c lá»‡nh chÃ­nh, giÃºp tá»± Ä‘á»™ng gáº­t Ä‘áº§u phÃª duyá»‡t káº¿t ná»‘i web má»—i 5 giÃ¢y. Äáº£m báº£o tráº£i nghiá»‡m "Click lÃ  vÃ o" trÃªn Native VPS mÆ°á»£t mÃ  y há»‡t Docker!

## [5.1.9] â€” 2026-04-07

### ðŸŒŸ Tráº£ láº¡i Schema Chuáº©n & Cáº£i thiá»‡n UX WebCrypto

- **Sá»­a lá»—i sáº­p Gateway do sai láº§m Config**: OpenClaw báº£n má»›i nháº¥t dÃ¹ng Zod Ä‘á»ƒ khÃ³a cháº·t Schema cáº¥u hÃ¬nh. Cá» `requireDeviceIdentity` chÃªm vÃ o báº£n 5.1.8 Ä‘Ã£ bá»‹ Backend tá»« chá»‘i tháº³ng thá»«ng (`Unrecognized key`), dáº«n Ä‘áº¿n server khÃ´ng thá»ƒ khá»Ÿi Ä‘á»™ng vÃ²ng láº·p. Báº£n 5.1.9 Ä‘Ã£ gá»¡ sáº¡ch cá» nÃ y, tráº£ láº¡i mÃ´i trÆ°á»ng sáº¡ch Ä‘á»ƒ PM2 hoáº¡t Ä‘á»™ng 100%.
- **Trá»£ lÃ½ SSH Tunnel Tá»± Äá»™ng**: BÃ¹ láº¡i sá»± kháº¯t khe cá»§a WebCrypto khi dÃ¹ng VPS/IP ngoÃ i, Console giá» Ä‘Ã¢y sáº½ tá»± Ä‘á»™ng in sáºµn tháº§n chÃº lá»‡nh báº» khÃ³a `ssh -L ...` y há»‡t IP vÃ  Username tháº­t cá»§a báº¡n. Báº¡n chá»‰ cáº§n copy-paste Ä‘á»ƒ thÃ´ng luá»“ng má»™t cÃ¡ch ngáº§u lÃ²i, báº£o máº­t tuyá»‡t Ä‘á»‘i mÃ  khÃ´ng cáº§n mua TÃªn miá»n HTTPS.

## [5.1.8] â€” 2026-04-07

### ðŸŒŸ Sá»­a lá»—i ÄÄƒng nháº­p Token (1008) & Cáº£i tiáº¿n IP hiá»ƒn thá»‹ trÃªn VPS

- **Táº¯t `requireDeviceIdentity` Ä‘á»ƒ vÆ°á»£t tÆ°á»ng WebCrypto**: Do cÆ¡ cháº¿ báº£o máº­t má»›i cá»§a Control UI báº¯t buá»™c trÃ¬nh duyá»‡t pháº£i dÃ¹ng mÃ´i trÆ°á»ng HTTPS (hoáº·c localhost) thÃ¬ má»›i cáº¥p quyá»n khá»Ÿi táº¡o key mÃ£ hÃ³a thiáº¿t bá»‹ E2E. Náº¿u dÃ¹ng IP thÆ°á»ng (HTTP) thÃ¬ Dashboard sáº½ bÃ¡o lá»—i Ä‘á» `code=1008`. Báº£n setup má»›i nháº¥t Ä‘Ã£ tá»± Ä‘á»™ng chÃ­ch cá» `requireDeviceIdentity: false` Ä‘á»ƒ táº¯t cÆ¡ cháº¿ Ã©p buá»™c nÃ y Ä‘i, giÃºp báº¡n vÃ o tháº³ng Dashboard báº±ng IP cá»§a VPS.
- **Hiá»ƒn thá»‹ Link Public á»Ÿ Terminal**: Cáº¥u trÃºc bÃ¡o cÃ¡o cá»§a PM2 Ä‘Ã£ Ä‘Æ°á»£c viáº¿t láº¡i Ä‘á»ƒ tá»± Ä‘á»™ng tÃ¬m vÃ  sinh ra cÃ¡c Ä‘Æ°á»ng dáº«n kÃ¨m IPv4 Public (thay vÃ¬ chá»‰ in má»—i `localhost`). Giá» Ä‘Ã¢y báº¡n chá»‰ viá»‡c soi console vÃ  báº¥m/copy tháº³ng link vÃ o trÃ¬nh duyá»‡t mÃ  khÃ´ng cáº§n pháº£i tá»± cháº¿ ná»¯a.

## [5.1.7] â€” 2026-04-07

### ðŸŒŸ Sá»­a lá»—i CORS Control UI & ÄÆ°á»ng dáº«n 9Router Native

- **Sá»­a lá»—i dá»™i ngÆ°á»£c CORS khi vÃ o Control UI**: OpenClaw v2026.3.x siáº¿t cháº·t policy CORS khiáº¿n viá»‡c truy cáº­p dashboard tá»« IP ngoÃ i bá»‹ block. CÃ¡c script táº¡o config vÃ  vÃ¡ Docker giá» Ä‘Ã£ tá»± Ä‘á»™ng quÃ©t toÃ n bá»™ IPv4 hiá»‡n cÃ³ cá»§a server (`os.networkInterfaces()`) Ä‘á»ƒ nhÃºng vÃ o máº£ng `gateway.controlUi.allowedOrigins`. Äáº£m báº£o ngÆ°á»i dÃ¹ng VPS vÃ o Ä‘Æ°á»£c tháº³ng Control UI mÃ  khÃ´ng bá»‹ lá»—i máº¡ng.
- **Tá»‘i Æ°u Ä‘Æ°á»ng dáº«n PM2 Native**: Äá»ƒ trÃ¡nh trÆ°á»ng há»£p tÃ­nh nÄƒng PM2 khÃ´ng nháº­n diá»‡n Ä‘Ãºng mÃ´i trÆ°á»ng (lá»—i `\$PATH` khi dÃ¹ng `nvm`), bá»™ cÃ i giá» bá» qua file thá»±c thi `9router` cá»§a HÄH. Thay vÃ o Ä‘Ã³, bá»™ cÃ i tá»± tÃ­nh toÃ¡n Ä‘Æ°á»ng dáº«n tuyá»‡t Ä‘á»‘i `\$(npm root -g)/9router/app/server.js` vÃ  truyá»n tháº³ng vÃ o trÃ¬nh thÃ´ng dá»‹ch Node, Ä‘áº£m báº£o PM2 100% tÃ¬m tháº¥y file khá»Ÿi cháº¡y 9Router.

## [5.1.6] â€” 2026-04-07

### ðŸž Kháº¯c phá»¥c lá»—i PM2 ngáº¯t cÃ i Ä‘áº·t (SIGKILL) trÃªn VPS

- **Sá»­a lá»—i `PM2 SIGKILL`**: Loáº¡i bá» cá» `-t` (cháº¿ Ä‘á»™ giao diá»‡n terminal) khá»i táº¥t cáº£ cÃ¡c lá»‡nh gá»i `9router` cháº¡y ngáº§m. TrÃªn cÃ¡c VPS khÃ´ng giao diá»‡n (headless), cá» nÃ y cÃ³ thá»ƒ khiáº¿n PM2 bá»‹ treo vÃ  nÃ©m ra lá»—i SIGKILL lÃ m cháº¿t toÃ n bá»™ quÃ¡ trÃ¬nh cÃ i Ä‘áº·t.
- **Tá»‘i Æ°u Sync Helper cháº¡y ngáº§m**: Bá»• sung cÆ¡ cháº¿ dá»± phÃ²ng 2 lá»›p cho script tá»± Ä‘á»™ng Ä‘á»“ng bá»™ (sync helper). Náº¿u PM2 bá»‹ giá»›i háº¡n RAM hoáº·c quÃ¡ táº£i gÃ¢y lá»—i SIGKILL, script sáº½ khÃ´ng vÄƒng lá»—i sáº­p Setup ná»¯a mÃ  tá»± Ä‘á»™ng fallback xuá»‘ng cháº¡y áº©n báº±ng `nohup node ... &`. Trong trÆ°á»ng há»£p xáº¥u nháº¥t, bá»™ cÃ i chá»‰ bÃ¡o cáº£nh bÃ¡o vÃ ng vÃ  ráº½ nhÃ¡nh cho phÃ©p tiáº¿n trÃ¬nh Setup tiáº¿p tá»¥c tá»›i bÆ°á»›c cuá»‘i cÃ¹ng thÃ nh cÃ´ng.

## [5.1.5] â€” 2026-04-06

### ðŸž Sá»­a lá»—i PM2 khá»Ÿi Ä‘á»™ng 9Router trÃªn Native

- **Fix**: Chuyá»ƒn tá»« viá»‡c cháº¡y chuá»—i bash (`execSync`) sang truyá»n máº£ng tham sá»‘ rÃµ rÃ ng (`execFileSync`) khi khá»Ÿi Ä‘á»™ng 9Router vÃ  script Ä‘á»“ng bá»™ (sync) qua PM2. Äáº£m báº£o PM2 luÃ´n cháº¡y Ä‘Æ°á»£c á»©ng dá»¥ng á»•n Ä‘á»‹nh trÃªn cáº£ Linux (VPS) vÃ  Windows mÃ  khÃ´ng bá»‹ vÆ°á»›ng lá»—i phÃ¢n tÃ­ch cÃº phÃ¡p dáº¥u ngoáº·c kÃ©p hay khoáº£ng tráº¯ng trong Ä‘Æ°á»ng dáº«n.
- **Tá»‘i Æ°u**: PM2 giá» Ä‘Ã¢y sáº½ phÃ¢n tÃ¡ch ráº¡ch rÃ²i báº±ng cÃ¡ch gá»i file thá»±c thi `9router` vá»›i tham sá»‘ `--interpreter none`, vÃ  luÃ´n cháº¡y sync script báº±ng Ä‘Ãºng phiÃªn báº£n NodeJS ná»™i táº¡i thÃ´ng qua `--interpreter process.execPath`.

## [5.1.4] â€” 2026-04-06

### ðŸž Sá»­a lá»—i BOM khá»Ÿi Ä‘á»™ng CLI & Tá»‘i Æ°u luá»“ng vÃ¡ Timeout trÃªn Docker

- **Sá»­a file CLI (BOM)**: XÃ³a tá»± Ä‘á»™ng chÃ¨n BOM (`\uFEFF`) á»Ÿ Ä‘áº§u file `cli.js`. KÃ½ tá»± thá»«a nÃ y vá»‘n lÃ m há»ng shebang `#!/usr/bin/env node` vÃ  gÃ¢y `SyntaxError: Unexpected token` trong nhiá»u mÃ´i trÆ°á»ng khi cháº¡y npx
- **Cáº£i thiá»‡n Docker Timeout Patch**: QuÃ¡ trÃ¬nh can thiá»‡p timeout (`300s`) trong lÃºc build Docker giá» chuyá»ƒn sang scan quÃ©t toÃ n bá»™ cÃ¡c file `.js` trong thÆ° má»¥c `openclaw/dist` thay vÃ¬ cá»‘ tÃ¬m file trÃ¹ng hash `gateway-cli-*`. GiÃºp báº£n vÃ¡ luÃ´n Ã¡p dá»¥ng thÃ nh cÃ´ng trÃªn cÃ¡c phiÃªn báº£n backend khÃ¡c biá»‡t mÃ  khÃ´ng in ra warning rÃ¡c trÃªn console

## [5.1.3] â€” 2026-04-06

### ðŸœ Lá»—i lá»t biáº¿n ná»™i suy vÃ o giao diá»‡n Docker Compose

Báº£n vÃ¡ lá»—i base64 trÆ°á»›c Ä‘Ã³ Ä‘Ã£ gÃ¢y ra lá»—i má»›i (regression) do dÃ¹ng ngoáº·c `${Buffer.from(...)}` bÃªn trong chuá»—i string sinh ra docker-compose. Äiá»u nÃ y lÃ m lá»t nguyÃªn Ä‘oáº¡n text ná»™i suy vÃ o `docker-compose.yml` thay vÃ¬ sinh ra chuá»—i base64 tháº­t.

- **Fix**: Thá»±c hiá»‡n táº¡o mÃ£ base64 hoÃ n chá»‰nh qua JavaScript (`const syncScriptBase64 = encodeBase64Utf8(syncScript)`) ngay tá»« ban Ä‘áº§u trÆ°á»›c khi ghÃ©p chuá»—i vÃ o file compose
- Äáº£m báº£o file compose táº¡o thÃ nh nháº­n chÃ­nh xÃ¡c mÃ£ base64 thuáº§n tÃºy mÃ  khÃ´ng bá»‹ lá»t biáº¿n mÃ´i trÆ°á»ng
- Dá»n dáº¹p láº¡i script test tÆ°Æ¡ng á»©ng

## [5.1.2] â€” 2026-04-06

### ðŸ› Fix Shell Injection: Sync Script DÃ¹ng Base64

Approach node -e JSON.stringify gÃ¢y lá»—i /bin/sh: Syntax error "(" unexpected vÃ¬ JSON.stringify sinh chuá»—i double-quoted phÃ¡ vá»¡ shell argument.

- **Fix**: ná»™i dung sync script nay Ä‘Æ°á»£c **base64-encode táº¡i thá»i Ä‘iá»ƒm gen compose** báº±ng Buffer.from(script).toString base64
- Entrypoint sinh ra dáº¡ng: node -e writeFileSync Buffer.from b64 base64 toString
- Base64 chá»‰ chá»©a [A-Za-z0-9+/=] â€” khÃ´ng cÃ³ kÃ½ tá»± Ä‘áº·c biá»‡t, hoáº¡t Ä‘á»™ng Ä‘Ãºng trong YAML block
- Ãp dá»¥ng cho táº¥t cáº£ luá»“ng gen compose: Docker web wizard (setup.js x2) vÃ  Docker CLI (cli.js x2)

## [5.1.1] â€” 2026-04-06

### ðŸ”§ 9Router Smart-Route Sync â€” á»”n Ä‘á»‹nh qua API

Sá»­a lá»—i nghiÃªm trá»ng khiáº¿n sync script khÃ´ng nháº­n ra provider Ä‘ang active, lÃ m táº¥t cáº£ request fallback vá» `openai` (lá»—i `404 No active credentials`).

- **NguyÃªn nhÃ¢n**: script Ä‘á»c `db.providerConnections` tá»« `db.json` nhÆ°ng field nÃ y khÃ´ng tá»“n táº¡i trong 9Router v0.3.79+ â€” connections chá»‰ cÃ³ qua REST API
- **Fix**: script giá» gá»i `fetch('http://localhost:20128/api/providers')` â†’ `d.connections[]` Ä‘á»ƒ detect provider Ä‘ang active
- **Fix**: thay heredoc `cat << 'CLAWEOF'` (gÃ¢y ra `const p=undefined`) báº±ng `node -e require('fs').writeFileSync(...)` â€” khÃ´ng cÃ²n lá»—i escaping trong YAML+shell
- **Fix**: `build9RouterSmartRouteSyncScript()` trong CLI docker flow giá» truyá»n Ä‘Ãºng `'/root/.9router/db.json'` lÃ m db path
- Ãp dá»¥ng cho cáº£ 3 vá»‹ trÃ­: Docker web wizard (`setup.js`), Docker CLI (`cli.js`), vÃ  native (`cli.js`)

### ðŸ“± Zalo Pairing â€” Tá»± Äá»™ng Approve Khi Gateway Äang Cháº¡y

- TrÆ°á»›c Ä‘Ã¢y, auto-approve chá»‰ cháº¡y trong login flow ban Ä‘áº§u; pairing request má»›i khi gateway Ä‘ang cháº¡y bá»‹ bá» qua
- **Fix**: `openclaw gateway run` vá»›i Zalo Personal giá» pipe stdout/stderr vÃ  tá»± gá»i `openclaw pairing approve zalouser <code>` khi phÃ¡t hiá»‡n pairing code má»›i

### ðŸ§¹ Output Docker CLI Gá»n HÆ¡n

- XÃ³a cÃ¡c hÆ°á»›ng dáº«n thá»«a sau khi Docker build xong (`docker compose build`, `openclaw gateway`, PM2) â€” Docker mode tá»± cháº¡y hoÃ n toÃ n, khÃ´ng cáº§n thao tÃ¡c thá»§ cÃ´ng thÃªm

## [5.1.0] â€” 2026-04-07

### ðŸ¤– Zalo Personal Login Improvements

- Zalo Personal giá» sá»­ dá»¥ng luá»“ng Ä‘Äƒng nháº­p `zalouser` trá»±c tiáº¿p trÃªn cáº£ native vÃ  Docker.
- Setup in ra Ä‘Æ°á»ng dáº«n QR cÃ¹ng cÃ¡c lá»‡nh login/copy chÃ­nh xÃ¡c, giÃºp ngÆ°á»i dÃ¹ng Ä‘Äƒng nháº­p nhanh mÃ  khÃ´ng cáº§n `openclaw onboard`.
- QR login Docker giá» nháº¯m vÃ o service compose `ai-bot` Ä‘Ã£ sinh ra thay vÃ¬ cÃ¡c tÃªn container cÅ© dá»… há»ng.

## [5.0.9] â€” 2026-04-06

### ðŸš€ Cháº¿ Ä‘á»™ Native Install â€” KhÃ´ng cáº§n Docker

OpenClaw giá» há»— trá»£ **cÃ i Ä‘áº·t native (khÃ´ng dÃ¹ng Docker)** trÃªn Windows, Linux, macOS, VPS vÃ  shared hosting.

- **CLI native mode** â€” thÃªm chá»n cháº¿ Ä‘á»™: `docker` (máº·c Ä‘á»‹nh) hoáº·c `native`
- **Script khá»Ÿi Ä‘á»™ng sinh tá»± Ä‘á»™ng theo OS:**
  - ðŸªŸ **Windows** â†’ `setup-openclaw-win.bat` (double-click cÃ i ngay)
  - ðŸ§ **Linux / macOS** â†’ `setup-openclaw-linux.sh`
  - ðŸ–¥ï¸ **VPS / Ubuntu** â†’ `setup-openclaw-vps.sh` (PM2 cháº¡y ná»n)
  - ðŸ  **Shared Hosting / cPanel** â†’ `setup-openclaw-hosting.sh` + `ecosystem.config.cjs`
- **Web Wizard cáº­p nháº­t** â€” ThÃªm toggle Deploy Mode (Docker / Native) + chá»n OS
- **URL host Ä‘á»™ng** â€” Ollama vÃ  9Router URL tá»± chuyá»ƒn:
  - Docker: `http://ollama:11434` / `http://9router:20128/v1`
  - Native: `http://localhost:11434` / `http://localhost:20128/v1`
- **Kiá»ƒm tra Node.js 18+** â€” Native mode yÃªu cáº§u Node.js 18+ trÆ°á»›c khi cháº¡y
- **Test scripts** â€” `test-native-install.bat` (Windows) vÃ  `test-native-install.sh` (Linux/macOS)

### ðŸ¤– Cáº­p nháº­t Gemma 4

- **4 biáº¿n thá»ƒ Gemma 4** qua Ollama: `gemma4:e2b` (~4-6 GB), `gemma4:e4b` (~8-10 GB), `gemma4:26b` (~18-24 GB), `gemma4:31b` (~24+ GB)
- Tá»± pull model Gemma 4 khi `docker compose up` láº§n Ä‘áº§u (timeout container tÄƒng lÃªn 15 phÃºt)
- NÃ¢ng timeout Ollama lÃªn **300 giÃ¢y** Ä‘á»ƒ xá»­ lÃ½ model lá»›n
- ThÃªm `OLLAMA_NUM_PARALLEL=1` vÃ  `OLLAMA_KEEP_ALIVE=24h` vÃ o Docker sidecar

### ðŸ¤– Multi-Bot Deployment (tá»‘i Ä‘a 5 bot Telegram trÃªn má»—i workspace)

OpenClaw giá» há»— trá»£ triá»ƒn khai **nhiá»u bot Telegram Ä‘á»™c láº­p** tá»« má»™t setup duy nháº¥t â€” má»—i bot cÃ³ identity, slash command, AI personality vÃ  thÆ° má»¥c workspace riÃªng biá»‡t.

- **Triá»ƒn khai 1â€“5 bot cÃ¹ng lÃºc** â€” Web Wizard vÃ  CLI Ä‘á»u há»— trá»£ cáº¥u hÃ¬nh multi-bot
- **Workspace riÃªng biá»‡t** â€” má»—i bot cÃ³ thÆ° má»¥c `botN/` riÃªng vá»›i `.env` vÃ  cáº¥u hÃ¬nh `.openclaw/` riÃªng, khÃ´ng gÃ¢y xung Ä‘á»™t token hay cáº¥u hÃ¬nh
- **Tá»± Ä‘á»™ng gÃ¡n cá»•ng** â€” cá»•ng báº¯t Ä‘áº§u tá»« `18791` vÃ  tÄƒng dáº§n cho má»—i bot (`18791`, `18792`, ...) Ä‘á»ƒ trÃ¡nh xung Ä‘á»™t binding host
- **Docker Compose Ä‘a-service** â€” tá»± Ä‘á»™ng sinh `docker-compose.yml` vá»›i má»™t service cho má»—i bot, cá»™ng thÃªm má»™t container provider chung (9Router hoáº·c Ollama)
- **Department Room Model** â€” khi cÃ¡c bot chia sáº» chung má»™t nhÃ³m Telegram, chÃºng hoáº¡t Ä‘á»™ng nhÆ° má»™t Ä‘á»™i ngÅ© chuyÃªn nghiá»‡p:
  - ðŸ¤« **Máº·c Ä‘á»‹nh im láº·ng** â€” bot pháº£n há»“i báº±ng emoji (ðŸ‘ â¤ï¸) vá»›i tin nháº¯n thÃ´ng thÆ°á»ng nhÆ°ng khÃ´ng bao giá» spam reply
  - ðŸ“£ **Trigger báº±ng @mention hoáº·c /slash** â€” chá»‰ bot Ä‘Æ°á»£c nháº¯c tÃªn hoáº·c Ä‘Æ°á»£c gá»i lá»‡nh má»›i pháº£n há»“i, giá»‘ng nhÆ° gá»i tÃªn Ä‘á»“ng nghiá»‡p trong phÃ²ng há»p
  - ðŸ—ƒï¸ **Workspace chung** â€” táº¥t cáº£ bot Ä‘á»c tá»« má»™t thÆ° má»¥c workspace chung vÃ  cÃ³ thá»ƒ cá»™ng tÃ¡c trÃªn cÃ¡c tÃ¡c vá»¥, tá»‡p vÃ  bÃ¡o cÃ¡o
- **Cáº¥u hÃ¬nh botGroup** Ä‘Æ°á»£c inject vÃ o `openclaw.json` cá»§a má»—i bot Ä‘á»ƒ chÃºng biáº¿t tÃªn vÃ  lá»‡nh slash cá»§a nhau khi runtime

### ðŸ”— Trá»£ giÃºp láº¥y Telegram Group ID

Láº¥y Group ID giá» trá»Ÿ nÃªn cá»±c ká»³ Ä‘Æ¡n giáº£n:

- **Web Wizard**: card "ÄÃ£ cÃ³ group" giá» hiá»ƒn thá»‹ nÃºt inline `Láº¥y Group ID` má»Ÿ tháº³ng **@userinfobot**, kÃ¨m hÆ°á»›ng dáº«n tá»«ng bÆ°á»›c (forward tin nháº¯n nhÃ³m â†’ bot tráº£ vá» Chat ID)
- **CLI**: chá»n "existing group" sáº½ in ra hÆ°á»›ng dáº«n tÆ°Æ¡ng tÃ¡c vá»›i cÃ¡c bÆ°á»›c Ä‘Ã¡nh sá»‘ vÃ  link trá»±c tiáº¿p Ä‘áº¿n `https://t.me/userinfobot`

### ðŸŽ¨ Tinh chá»‰nh UI

- **Bá»™ chá»n tÃ¹y chá»n nhÃ³m** Ä‘Æ°á»£c thiáº¿t káº¿ dáº¡ng **hai tháº» tÆ°Æ¡ng tÃ¡c** vá»›i icon, mÃ´ táº£, hiá»‡u á»©ng hover glow vÃ  dáº¥u tick chá»n Ä‘á»™ng
- Tráº¡ng thÃ¡i active cá»§a tháº»: mÃ u xanh lÃ¡ + viá»n cho "táº¡o sau", mÃ u xanh chÃ m + viá»n cho "nhÃ³m Ä‘Ã£ cÃ³"
- HÃ ng nháº­p Group ID bao gá»“m nÃºt trá»£ giÃºp inline â€” khÃ´ng cáº§n tÃ¬m kiáº¿m tÃ i liá»‡u ná»¯a

## [5.0.0] â€” 2026-04-04

### ðŸš€ Há»— trá»£ Gemma 4 â€” Model má»›i nháº¥t cá»§a Google

OpenClaw v5.0.0 cáº­p nháº­t **Gemma 4** â€” dÃ²ng model open-weights má»›i cá»§a Google DeepMind, ra máº¯t 02/04/2026.

- **Gemma 4 cÃ³ sáºµn 3 size qua Ollama** â€” `gemma4:4b` (~6 GB RAM), `gemma4` máº·c Ä‘á»‹nh (~10 GB), `gemma4:27b` (~18 GB)
- **KhÃ´ng cáº§n cÃ i Ollama thá»§ cÃ´ng** â€” Khi chá»n Local Ollama + Gemma 4, setup tá»± Ä‘á»™ng sinh **service `ollama` sÃ¡t cáº¡nh trong `docker-compose.yml`**. Docker tá»± pull model khi `docker compose up`. KhÃ´ng cáº§n cÃ i Ollama trÆ°á»›c.
- **OLLAMA_HOST tá»± cáº¥u hÃ¬nh** â€” Trá» tháº³ng vÃ o sidecar container (`http://ollama:11434`).
- **Cáº­p nháº­t danh sÃ¡ch model** â€” ThÃªm `gemma4`, `gemma4:27b`, `gemma4:4b` vÃ o Ollama provider trÃªn cáº£ CLI vÃ  Web Wizard.

### ðŸ’» YÃªu cáº§u pháº§n cá»©ng cho Gemma 4

| Model               | RAM/VRAM tá»‘i thiá»ƒu (4-bit) | PhÃ¹ há»£p                        |
| ------------------- | -------------------------- | ------------------------------ |
| `gemma4:4b`         | ~6 GB                      | Laptop thÃ´ng thÆ°á»ng, Mac M1/M2 |
| `gemma4` (máº·c Ä‘á»‹nh) | ~10 GB                     | PC 16 GB RAM                   |
| `gemma4:27b`        | ~18 GB                     | Workstation 32 GB / GPU 24 GB  |

> Gemma 4 **miá»…n phÃ­, open-weights, giáº¥y phÃ©p Apache 2.0**. KhÃ´ng cáº§n API key â€” cháº¡y 100% local qua Docker.

## [4.1.4] â€” 2026-04-03

### âœ¨ Cáº£i tiáº¿n

- CLI/Wizard Ä‘á»“ng bá»™ Ä‘áº§y Ä‘á»§ skills (Browser Automation, Memory, RAG, Code Interpreter, v.v.)
- Browser Automation: chá»n cháº¿ Ä‘á»™ Desktop (Host Chrome) hoáº·c Server (Headless Chromium) cho Linux/Ubuntu
- Sá»­a lá»—i Dockerfile WORKDIR gÃ¢y lá»—i build trÃªn Linux
- Skills install táº¡i **runtime** container (khÃ´ng pháº£i lÃºc build) Ä‘á»ƒ trÃ¡nh lá»—i ClawHub auth
- TOOLS.md Ä‘á»™ng: tá»± sinh theo danh sÃ¡ch skills Ä‘Ã£ chá»n
- Tá»± táº¡o `browser-tool.js` (Desktop mode) vÃ  `BROWSER.md`
- Tá»± Ä‘Äƒng kÃ½ skills vÃ o `openclaw.json â†’ skills.entries`
- Bá»• sung prompt cáº¥u hÃ¬nh Email SMTP vÃ  inject vÃ o `.env`
- Single-source version qua `bump-version.mjs` â€” 1 lá»‡nh cáº­p nháº­t táº¥t cáº£ file

## [4.1.3] â€” 2026-04-02

### âœ¨ Cáº£i tiáº¿n

- CLI/Wizard Ä‘á»“ng bá»™ Ä‘áº§y Ä‘á»§ skills (Browser Automation, Memory, RAG, Code Interpreter, v.v.)
- Browser Automation: chá»n cháº¿ Ä‘á»™ Desktop (Host Chrome) hoáº·c Server (Headless Chromium)
- Sá»­a lá»—i Dockerfile WORKDIR trÃªn Linux
- TOOLS.md Ä‘á»™ng: tá»± sinh theo skills Ä‘Ã£ chá»n
- Tá»± táº¡o browser-tool.js (Desktop mode) vÃ  BROWSER.md
- Tá»± Ä‘Äƒng kÃ½ skills vÃ o `openclaw.json â†’ skills.entries`
- Bá»• sung prompt cáº¥u hÃ¬nh Email SMTP

Táº¥t cáº£ nhá»¯ng thay Ä‘á»•i ná»•i báº­t cá»§a dá»± Ã¡n sáº½ Ä‘Æ°á»£c ghi chÃ©p trong file nÃ y.

## [4.1.2] â€” 2026-04-01

### Kháº¯c phá»¥c

- **CLI setup**: Kháº¯c phá»¥c lá»—i sinh file `docker-compose.yml` Ä‘á»‹nh dáº¡ng sai khi dÃ¹ng 9Router (lá»—i bÃ¡o `yaml: while scanning a simple key`) báº±ng cÃ¡ch Ä‘á»•i cÃ¡ch escape string `syncComboScript` sang kiá»ƒu heredoc block scalars cá»§a bash Ä‘á»ƒ trÃ¡nh xung Ä‘á»™t nhÃ¡y kÃ©p/nhÃ¡y Ä‘Æ¡n trong YAML.

## [4.1.0] â€” 2026-04-01

### ðŸš€ Stable 9Router Smart Routing

- **Khá»Ÿi táº¡o Database tinh gá»n**: Combo máº·c Ä‘á»‹nh cá»§a 9Router hiá»‡n táº¡i sáº¡ch 100% (chá»‰ lÆ°u `smart-route`). ÄÃ£ loáº¡i bá» viá»‡c tá»± Ä‘á»™ng tiÃªm GPT-4o/Claude/Gemini nhÆ° cÃ¡c rÃ¡c há»‡ thá»‘ng Ä‘á»ƒ Æ°u tiÃªn 100% sá»©c máº¡nh Ä‘á»‹nh tuyáº¿n Ä‘á»™ng.
- **Tá»‘i giáº£n Giao diá»‡n Toggling**: Cáº£ web Setup Wizard vÃ  CLI Ä‘á»u Ä‘Æ°á»£c tinh giáº£n, khÃ´ng cÃ²n liá»‡t kÃª máº£ng models dÆ° thá»«a khi chá»n 9Router. Há»‡ thá»‘ng máº·c Ä‘á»‹nh chá»‘t cá»©ng Auto Route (`smart-route`) vÃ  giao hoÃ n toÃ n phÃ¡n quyáº¿t chuyá»ƒn Ä‘á»•i cho thuáº­t toÃ¡n `PREF`.

## [4.0.9] â€” 2026-04-01

### ðŸ”„ Dynamic Smart Route (Äá»“ng bá»™ Provider Realtime)

- **Routing ThÃ´ng Minh**: Combo `smart-route` khÃ´ng cÃ²n lÃ  danh sÃ¡ch cá»©ng 100+ model. Script Ä‘á»“ng bá»™ cháº¡y ngáº§m má»—i 30 giÃ¢y sáº½ tá»± Ä‘á»™ng quÃ©t `/api/providers` cá»§a 9Router vÃ  chá»‰ Ä‘Æ°a vÃ o combo **nhá»¯ng provider Ä‘Ã£ káº¿t ná»‘i VÃ€ Ä‘ang báº­t**. Triá»‡t tiÃªu hoÃ n toÃ n lá»—i `404 No active credentials`.
- **Báº­t/Táº¯t Tá»©c ThÃ¬**: Báº­t hoáº·c táº¯t provider trÃªn Dashboard 9Router â€” combo tá»± cáº­p nháº­t trong vÃ²ng 30 giÃ¢y, khÃ´ng cáº§n restart container.
- **Mapping Äáº§y Äá»§**: Há»— trá»£ 25+ provider (Codex, Claude Code, GitHub Copilot, Cursor, Kilo, Cline, Gemini CLI, iFlow, Qwen, Kiro, Ollama, GLM, MiniMax, DeepSeek, xAI, Mistral, Groq...).

### ðŸ³ Tá»± Äá»™ng CÃ i Docker

- **Zero-Prerequisite**: `npx create-openclaw-bot` tá»± phÃ¡t hiá»‡n Docker chÆ°a cÃ i â†’ tá»± táº£i + cÃ i qua `winget` (Windows), `brew` (macOS), hoáº·c script chÃ­nh thá»©c Docker (Linux).
- **HÆ°á»›ng Dáº«n RÃµ RÃ ng**: Náº¿u cÃ i tá»± Ä‘á»™ng tháº¥t báº¡i, hiá»ƒn thá»‹ link táº£i trá»±c tiáº¿p kÃ¨m hÆ°á»›ng dáº«n chi tiáº¿t.

## [4.0.8] â€” 2026-03-31

### âœ¨ Tá»‘i Æ°u 9Router & Má»Ÿ rá»™ng Ollama Cloud

- **TÃ­ch há»£p 9Router cá»±c ká»³ á»”n Ä‘á»‹nh (Zero Config)**: Proxy 9Router hiá»‡n Ä‘Æ°á»£c tá»± Ä‘á»™ng kÃ­ch hoáº¡t báº£o máº­t bÃªn trong máº¡ng Docker network qua cá»•ng `sk-no-key`. ToÃ n bá»™ thiáº¿t Ä‘áº·t API keys thá»§ cÃ´ng vÃ  Ä‘á»‹nh tuyáº¿n models Ä‘Æ°á»£c gá»¡ bá» khá»i `.env` Ä‘á»ƒ nhÆ°á»ng chá»— cho há»‡ thá»‘ng quáº£n lÃ½ táº­p trung vÃ  thÃ´ng minh hÆ¡n qua [9Router Dashboard](http://localhost:20128/dashboard).
- **Má»Ÿ Rá»™ng Káº¿t Ná»‘i Models**: ÄÆ°a vÃ o danh sÃ¡ch há»— trá»£ trá»n bá»™ há»‡ sinh thÃ¡i Ollama Cloud (_Qwen 3.5, GLM-5, MiniMax, GPT-OSS_), Kiro Haiku, Qwen Flash, cÃ¹ng toÃ n bá»™ iFlow models hoÃ n toÃ n miá»…n phÃ­.
- **Tá»± Ä‘á»™ng Inject Smart Routing**: Cáº¥u hÃ¬nh tá»± Ä‘á»™ng gÃ i sáºµn combo luÃ¢n chuyá»ƒn linh hoáº¡t `smart-route` giÃºp cÃ¢n báº±ng táº£i cÃ´ng viá»‡c qua láº¡i mÆ°á»£t mÃ  giá»¯a Codex, Claude Code, Gemini, vÃ  iFlow.

### ðŸ§¹ Clean Workspace & Auto-Setup Äa Ná»n Táº£ng

- **Zero-Clutter Generation**: Dá»n sáº¡ch hoÃ n toÃ n cÃ¡c template lÃ m máº«u nhÆ° `.env.example` hay cÃ¡c file cáº¥u hÃ¬nh `docker-compose` tÄ©nh dÆ° thá»«a. Script setup sáº½ tá»± khá»Ÿi táº¡o linh Ä‘á»™ng cÃ¡c file thá»±c thá»¥ ngay lÃºc cháº¡y cho má»™t workspace gá»n gÃ ng nháº¥t.
- **Auto Browser Äa Ná»n Táº£ng**: Bá»• sung `start-chrome-debug.sh` má»›i Ä‘Ã©t cho macOS/Linux Ä‘á»“ng bá»™ hoÃ n háº£o vá»›i file `.bat` thiáº¿t láº­p cháº¡y Automation trÃªn Windows, má»Ÿ ra ká»· nguyÃªn Auto-Browser tiá»‡n lá»£i.
- **Auto Prompt CLI**: `npx create-openclaw-bot` hiá»‡n Ä‘Ã£ hoÃ n chá»‰nh vá» feature-parity vá»›i Web UI, há»— trá»£ tra váº¥n thÃ´ng tin thiáº¿t láº­p User Identity vÃ  Persona cá»§a Bot trá»±c tiáº¿p á»Ÿ báº£ng console.

## [4.0.1] â€” 2026-03-31

### âœ¨ Tá»± Äá»™ng HoÃ¡ (Tá»± táº¡o thÆ° má»¥c cÃ i Ä‘áº·t gá»‘c) & NPM CLI

- **One-Command Install (npx)**: GÃ³i CLI `create-openclaw-bot` Ä‘Æ°á»£c táº£i lÃªn NPM. NgÆ°á»i dÃ¹ng Windows, Linux, Mac chá»‰ cáº§n má»Ÿ Terminal gÃµ lá»‡nh `npx create-openclaw-bot` Ä‘á»ƒ setup tá»± Ä‘á»™ng tá»« A-Z qua giao diá»‡n tÆ°Æ¡ng tÃ¡c.
- **Tá»± Ä‘á»™ng Setup & Khá»Ÿi Ä‘á»™ng Docker**: Quy trÃ¬nh táº¡o `.bat`/CLI Ä‘Æ°á»£c viáº¿t láº¡i, thiáº¿t láº­p xong sáº½ má»Ÿ Docker compose tá»± Ä‘á»™ng táº£i vÃ  kÃ­ch hoáº¡t Bot ngay.
- **Improved UI Setup**: Gá»n gÃ ng hoÃ¡ file preview, Ä‘á»•i layout UI cho Zalo Bot API Ä‘á»ƒ dÃ¹ng official vector SVG, ná»•i mÃ u xanh chá»§ Ä‘áº¡o Zalo thay vÃ¬ logo trong suá»‘t.
- **Safety First**: LÆ°á»£c bá» tuá»³ chá»n mÃ´ hÃ¬nh Antigravity (AG) khá»i 9router Proxy Models vÃ  thÃªm cáº£nh bÃ¡o Ä‘á» trÃªn UI Ä‘á»ƒ trÃ¡nh rá»§i ro ngÆ°á»i dÃ¹ng bá»‹ khoÃ¡ account Google AI Ultra do láº¡m dá»¥ng quÃ¡ má»©c. Cáº­p nháº­t icon credit cho thesvg.org.

## [4.0.0] â€” 2026-03-30

### âœ¨ New Features & Updates

- **Full English Localization** â€” ÄÃ£ hoÃ n thiá»‡n toÃ n bá»™ báº£n dá»‹ch tiáº¿ng Anh cho Setup Wizard (Button, Label, Step 4 Output).
- **Language Toggle Relocation** â€” Di chuyá»ƒn cÃ´ng táº¯c ngÃ´n ngá»¯ (VI/EN) sang vá»‹ trÃ­ dá»… nhÃ¬n vÃ  thao tÃ¡c hÆ¡n.
- **Setup UI/UX fixes** â€” Cáº£i thiá»‡n giao diá»‡n Setup Wizard cho Browser Automation vÃ  sá»­a cÃ¡c lá»—i hiá»ƒn thá»‹ (nhÆ° undefined model badge).
- **Reference Error Fixes** â€” Kháº¯c phá»¥c má»™t sá»‘ lá»—i Reference Error trong quÃ¡ trÃ¬nh cháº¡y setup.

## [3.0.2] â€” 2026-03-29

### âœ¨ 9Router Smart Proxy Expansion

- **9Router db.json Stability** â€” Cáº­p nháº­t logic inject db.json cá»§a 9router qua entrypoint Ä‘á»ƒ trÃ¡nh lá»—i bÃ¡o máº¥t file "No such file or directory, lstat db.json".
- **Flagship Fallback Proxy** â€” Cáº¥u hÃ¬nh "Smart Proxy" Ä‘á»ƒ cÃ³ danh sÃ¡ch luÃ¢n chuyá»ƒn cÃ¡c LLMs Flagship máº¡nh máº½ nháº¥t hiá»‡n táº¡i cá»§a Codex, Antigravity, Claude Code, vÃ  Github Copilot.
- **TÃ¹y chá»‰nh Setup Wizard** â€” Khi cÃ i Ä‘áº·t hiá»‡n táº¡i sáº½ tháº¥y danh sÃ¡ch provider/model hoÃ n chá»‰nh, vÃ  Smart Proxy Ä‘Æ°á»£c Ä‘áº·t lÃ m chuáº©n Æ°u tiÃªn Ä‘á»ƒ tá»± fix lá»—i "404 No Active Credentials".

## [3.0.1] â€” 2026-03-29

### âœ¨ New Features

- **Wizard UI Redesign (Step 2)** â€” AI Provider/Model lÃªn Ä‘áº§u, sau Ä‘Ã³ Identity, Personality, Security Rules, Extensions
- **User Info textarea** â€” User tá»± nháº­p thÃ´ng tin vá» mÃ¬nh â†’ sinh vÃ o `USER.md` Ä‘á»ƒ bot cÃ¡ nhÃ¢n hÃ³a
- **Editable Security Rules** â€” Hiá»ƒn thá»‹ quy táº¯c báº£o máº­t máº·c Ä‘á»‹nh, user cÃ³ thá»ƒ sá»­a â†’ inject vÃ o `AGENTS.md`
- **Section dividers** â€” Icon dividers giá»¯a cÃ¡c nhÃ³m config (ðŸ¤– ðŸ” ðŸ§©)

### ðŸ› Bug Fixes

- **Skills auto-enable** â€” Khi chá»n skill, giá» tá»± Ä‘á»™ng khai bÃ¡o trong `openclaw.json` â†’ `skills.entries` (enabled: true). TrÆ°á»›c Ä‘Ã¢y chá»‰ cÃ i Dockerfile nhÆ°ng khÃ´ng register â†’ bot khÃ´ng nháº­n skill
- **Skills env injection** â€” Skills cáº§n API key (Tavily, SMTPâ€¦) tá»± Ä‘á»™ng inject env vars vÃ o `skills.entries`

### ðŸŽ¨ UI/UX

- Identity grid 3 cá»™t (TÃªn, Vai trÃ², Emoji) â€” bá» Vibe (gá»™p vÃ o System Prompt)
- Emoji input fix: `form-input--emoji` class, cÃ¹ng height vá»›i input khÃ¡c
- Label System Prompt â†’ "TÃ­nh cÃ¡ch, Vibe & Quy táº¯c tráº£ lá»i"
- Responsive mobile: Name full width, Role + Emoji side-by-side
- Security textarea readonly máº·c Ä‘á»‹nh, nÃºt "âœï¸ Sá»­a" / "ðŸ”’ KhÃ³a" toggle

### ðŸ”§ Technical

- `state.config.userInfo` â€” new field, saved from `cfg-user-info` textarea
- `state.config.securityRules` â€” editable, defaults per language (vi/en)
- `DEFAULT_SECURITY_RULES` constant with vi/en templates
- `clawConfig.skills.entries` generated from selected skills
- Language toggle updates both prompt and security rules

---

## [3.0.0] â€” 2026-03-28

### âœ¨ New Features

- **9Router Integration** â€” AI proxy, khÃ´ng cáº§n API key, multi-container Docker (`docker-compose.yml` 2 service)
- **Skills System (ClawHub)** â€” 8 agent capabilities: Web Search, Browser Automation, Memory, RAG, Image Gen, Bot Scheduler, Code Interpreter, Email Assistant
- **Plugins System (npm)** â€” 4 runtime extensions: Voice Call, Matrix, MS Teams, Nostr
- **Browser Automation** â€” Full Chrome Debug Mode support (socat proxy, agent-browser, Playwright engine)
- **Task Scheduler** â€” Windows Scheduled Task auto-starts Chrome Debug khi logon (delay 10s)
- **Skill-aware .env** â€” `.env` template tá»± Ä‘á»™ng thÃªm env vars cho skills cáº§n API key (Tavily, SMTP, Flux...)
- **Post-setup Management** â€” HÆ°á»›ng dáº«n thÃªm/bá» skills/plugins sau khi setup qua `docker exec`

### ðŸŽ¨ UI/UX

- TÃ¡ch Skills (4-column grid) vÃ  Plugins (riÃªng biá»‡t) â€” rÃµ rÃ ng hÆ¡n
- Skill cards hiá»‡n notes (âš™ï¸) cho skills cáº§n setup thÃªm
- Browser Automation notice card á»Ÿ Step 4 vá»›i `.bat` + `.ps1` scripts
- Management guide card (ðŸ”§) vá»›i `docker exec` commands

### ðŸ“š Documentation

- `docs/browser-automation-guide.md` â€” HÆ°á»›ng dáº«n sá»­ dá»¥ng Browser Automation cho user
- `docs/skills-plugins-guide.md` â€” Tá»•ng há»£p toÃ n bá»™ skills/plugins + setup + env vars
- README.md / README.vi.md â€” ThÃªm 9Router, Skills/Plugins, FAQs má»›i

### ðŸ”§ Technical

- `state.config.skills[]` + `state.config.plugins[]` quáº£n lÃ½ Ä‘á»™c láº­p
- `openclaw.json` inject `browser` config khi Browser skill selected
- Dockerfile conditional: socat, agent-browser chá»‰ khi cáº§n
- docker-compose: `extra_hosts` cho cáº£ 9Router láº«n non-9Router

---

## [2.0.0] â€” 2026-03-27

### âœ¨ New Features

- **Setup Wizard UI** â€” Interactive web wizard (`index.html`) to configure OpenClaw bots visually
- **Multi-Channel Support** â€” Telegram, Zalo Bot API, Zalo Personal channel selection
- **Multi-Provider AI** â€” Google Gemini, Anthropic Claude, OpenAI/Codex, OpenRouter, Ollama (local)
- **Plugin System** â€” Modular plugin grid: Browser Automation, Scheduler, Memory, Web Search, RAG, Image Gen
- **Config Generation** â€” Auto-generates `openclaw.json`, `agent.yaml`, `Dockerfile`, `docker-compose.yml`
- **Language Toggle** â€” VI/EN toggle switch with SVG flag icons
- **Brand Logos** â€” Real SVG logos from [thesvg.org](https://thesvg.org) for all providers and channels

### ðŸŽ¨ Design

- Dark-themed glassmorphism UI with animated multi-layer gradients
- Provider cards with unique colored icon backgrounds (Gemini purple, Claude orange, OpenAI green, OpenRouter violet, Ollama cyan)
- Auto-expanding System Prompt textarea (no internal scroll)
- Shimmer animation on title, glow effects on selected cards

### ðŸ“š Documentation

- `README.md` / `README.vi.md` â€” Full bilingual docs with multi-provider table
- `SETUP.md` / `SETUP.vi.md` â€” Technical setup guide for AI agents
- Security notice: System Prompt = personality only, framework enforces security rules

---

## [1.0.0] â€” 2026-03-26

### Initial Release

- Basic OpenClaw setup guide
- Telegram-only configuration
- Google Gemini single provider support
- Manual config file instructions


