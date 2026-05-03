# Changelog (Tiếng Việt)


## [5.7.7] — 2026-05-03

### 🛠️ Ổn Định Infrastructure & Zalo Bot

- **Ghim Phiên Bản**: Tự động ghim `openclaw@2026.4.15` trên tất cả script cài đặt để đảm bảo ổn định cho Zalo bot.
- **Tối Ưu Docker**: Thay thế việc mount toàn bộ dự án bằng mount độc lập thư mục `.openclaw` để tránh nghẽn I/O.
- **Sửa Lỗi Deadlock Gateway**: Thêm `tmpfs` cho thư mục `plugin-runtime-deps` ngay trong cấu hình Compose environment.
- **Đồng Bộ 9Router**: Tự động lấy danh sách model từ các provider đang kết nối và đồng bộ vào combo `smart-route` mỗi khi gateway khởi động.
- **Chuẩn Hoá Cấu Hình Zalo**: Hợp nhất logic sinh cấu hình để đảm bảo plugin `zalo-mod` luôn xuất ra schema chuẩn xác nhất.

## [5.7.6] — 2026-05-03

### Sửa lỗi: Docker Bind-Mount State Directory

- **Sửa: `OPENCLAW_STATE_DIR` giờ nằm trong thư mục bind-mount của project** — Thay đổi `OPENCLAW_STATE_DIR` từ `/var/lib/openclaw-state` (volume độc lập) sang `/root/project/.openclaw`, khớp với thư mục project đã bind-mount. Đảm bảo state (sessions, memory, plugins) tồn tại qua các lần restart container mà không cần named volume riêng.
- **Sửa: CLI volume mount giờ bind toàn bộ thư mục project** — Đổi `volumeMount` từ `../../.openclaw:/root/project/.openclaw` thành `../..:/root/project`, giúp container thấy toàn bộ cây thư mục project trên host. Khắc phục lỗi path mismatch khi bot không tìm được file config nằm bên cạnh `.openclaw`.
- **Sửa: Xóa named volume `openclaw-state` lỗi thời** — Loại bỏ logic inject `openclaw-state:/var/lib/openclaw-state` khỏi `docker-gen.js`. State directory giờ được quản lý hoàn toàn qua bind-mount của project.
- **Chore: Cập nhật smoke tests** — Bổ sung assertions kiểm tra strategy bind-mount mới (`../..:/root/project`, `OPENCLAW_STATE_DIR=/root/project/.openclaw`) và xác nhận named volume `openclaw-state` vắng mặt trong compose output được generate.
- **Chore: Cập nhật `lastTouchedVersion` trong docs** — Ví dụ config trong `SETUP.md` và `SETUP.vi.md` giờ hiển thị `"lastTouchedVersion": "latest"` thay vì version cụ thể.

## [5.7.5] — 2026-05-03

### Hotfix: Sửa CLI Crash & Lỗi Encoding Tiếng Việt

- **Sửa: `ReferenceError: channelKey is not defined` trong `writeWorkspaceFiles()`** — Thêm `channelKey` làm tham số tường minh (mặc định `'telegram'`) và truyền từ cả 2 call site (single-bot và multi-bot relay). Lỗi này ảnh hưởng mọi nền tảng (Telegram, Zalo) ngay khi bắt đầu ghi workspace files.
- **Sửa: Tính toàn vẹn UTF-8 trong `cli.src.js`** — Khôi phục encoding UTF-8 đúng bằng cách dùng Python I/O cho mọi thao tác file, ngăn double-encoding ký tự tiếng Việt do PowerShell Windows gây ra.

## [5.7.4] — 2026-05-02

### Hotfix: CLI crash trên mọi cấu hình — `channelKey is not defined`

- **Sửa: `ReferenceError: channelKey is not defined` trong `writeWorkspaceFiles()`** — Hàm này tham chiếu biến `channelKey` từ scope ngoài (`main()`) nhưng không khai báo trong danh sách tham số của chính nó. Đã thêm `channelKey = 'telegram'` làm tham số với giá trị mặc định an toàn, đồng thời truyền tường minh từ cả 2 call site (single-bot và multi-bot relay). Lỗi này ảnh hưởng mọi nền tảng (Telegram, Zalo) ngay khi bắt đầu ghi workspace files.

## [5.7.3] — 2026-04-29

### Ổn định Gateway Docker & Luồng đăng nhập Zalo

- **Fix: Gateway crash loop do thiếu `gateway.mode`** — Entrypoint config trong Docker giờ tự set `gateway.mode` (mặc định `local`), ngăn lỗi `Gateway start blocked: existing config is missing gateway.mode` gây restart vô hạn trên OpenClaw 2026.4.26+.
- **Fix: Plugin zalouser từ ClawHub ghi đè bản bundled** — Entrypoint tải `@openclaw/zalouser@2026.3.22` từ ClawHub (không hỗ trợ `channels login`). Đã bỏ install plugin runtime trong entrypoint, dùng trực tiếp bản bundled trong OpenClaw.
- **Fix: Đúng tên npm package `openclaw-zalo-mod`** — Cập nhật `output.js` và `native-helpers-gen.js` dùng `openclaw-zalo-mod` cho lệnh cài plugin, khớp tên package thực trên npm registry.
- **Improve: Dừng gateway trước khi đăng nhập Zalo** — Script tải (Windows/macOS) giờ dừng gateway trước khi chạy login Zalo, tránh xung đột WebSocket khi xác thực channel.


## [5.7.2] — 2026-04-28

### Sửa lỗi cài đặt Plugin Zalo và Rebuild UI

- **Fix: Tên cài đặt plugin zalo-mod** — Cập nhật lệnh cài đặt plugin trong CLI từ `openclaw-zalo-mod` thành `zalo-mod` để khớp với tên package trên ClawHub, sửa lỗi cảnh báo "plugin not found" khi khởi động.
- **Fix: Cài đặt zalo-mod trong Docker** — Đưa `zalo-mod` vào danh sách `allPlugins` khi chọn kênh Zalo Personal ở chế độ Docker, giúp quá trình build image tải đúng plugin về.
- **Fix: Rebuild Setup Wizard UI** — Chạy lại script build (`build.mjs`) để đóng gói các bản sửa lỗi gần đây vào file `dist/setup.js`. Khắc phục lỗi file `.bat` và `.sh` tải về từ giao diện Web Wizard không có dòng hướng dẫn đăng nhập Zalo đã được thêm trước đó.

## [5.7.1] — 2026-04-28

### Chuẩn hóa Đăng nhập Zalo QR & Tích hợp Workspace

- **Cải thiện: Chuẩn hóa đăng nhập Zalo QR trên mọi nền tảng** — Tất cả mục tiêu triển khai (Docker, Windows, macOS, Linux, VPS) đều dùng chung luồng đăng nhập dựa trên file QR: ảnh QR được lưu tại `/tmp/openclaw/openclaw-zalouser-qr-default.png`, người dùng tự lấy file QR (qua Docker Desktop tab Files, `docker cp`, `scp`, hoặc mở trực tiếp). Thay thế hướng dẫn quét QR qua terminal bằng hướng dẫn từng bước cho mỗi nền tảng.
- **Cải thiện: Docker login dùng `docker exec` thay vì `docker compose exec`** — Hướng dẫn sau cài đặt và download scripts giờ dùng `docker exec -it <container>` và `docker cp` trực tiếp, ổn định hơn trên các phiên bản Docker Compose.
- **Cải thiện: Download scripts Wizard tự động chạy Zalo login** — Cả Windows (PowerShell) và Unix (bash) download scripts do Wizard tạo giờ tự đợi container khởi động và chạy lệnh đăng nhập Zalo, bỏ bước thủ công sau cài đặt.
- **Cải thiện: VPS setup chèn Zalo login trước khi start gateway** — Script cài VPS giờ chèn luồng đăng nhập Zalo (qua `generateZaloLoginSh()`) trước khi PM2 khởi động gateway, đảm bảo session được thiết lập ngay lần deploy đầu.
- **Cải thiện: Workspace docs tích hợp zalo-mod** — `TOOLS.md` và `SOUL.md` giờ bao gồm tài liệu plugin zalo-mod (slash commands `/rules`, `/noi-quy`, `/menu`, `/groupid`, `/report` và hành vi xử lý media) khi `hasZaloMod = true`.
- **Sửa: Escape đường dẫn Windows BAT** — Sửa lỗi escape backslash trong `win-bat.js` gây hỏng đường dẫn `PROJECT_DIR`, `OPENCLAW_HOME`, `DATA_DIR` và script khởi động gateway PowerShell.
- **Sửa: Script đăng nhập Zalo trên VPS/Linux** — `zalo-login-gen.js` giờ chạy trực tiếp lệnh login và hướng dẫn lấy QR qua file thay vì yêu cầu user mở terminal riêng.
- **Chore: Đồng bộ ARCHITECTURE.md** — Bổ sung tài liệu `bot-config-gen.js`, `test-matrix.mjs`, cập nhật lệnh `npm test`, ghi chú tham số `hasZaloMod` và mục Zalo QR Login Protocol.

## [5.7.0] — 2026-04-27

### Kiến trúc Config Tập trung & Bộ Test Ma trận

- **Refactor: Tập trung bot-config-gen.js** — Dồn toàn bộ logic tạo `openclaw.json`, `.env`, và `exec-approvals.json` vào module duy nhất (`src/setup/shared/bot-config-gen.js`). Cả Web Wizard (IIFE) và CLI (CJS) đều dùng chung cùng một builder, loại bỏ triệt để sai lệch config giữa 2 bề mặt.
- **Refactor: Phiên bản rolling `@latest`** — Tất cả script cài đặt (Windows BAT, macOS/Linux/VPS SH) và trình tạo config giờ dùng `openclaw@latest` thay vì version cố định (ví dụ `openclaw@2026.4.14`). Trường `lastTouchedVersion` dùng hằng `OPENCLAW_NPM_SPEC` để phân giải động.
- **Sửa: Xóa `autoReply` khỏi Zalo Personal** — Trường `autoReply: true` gây crash gateway khi khởi động đã bị loại bỏ vĩnh viễn khỏi mọi generator (`config-gen.js`, `cli.src.js`, `bot-config-gen.js`).
- **Sửa: Chuẩn hóa config Zalo Personal** — Kênh `zalouser` giờ tạo ra config khớp production với `groups`, `groupPolicy: 'allowlist'`, `historyLimit: 50`, `bindings` đúng chuẩn, và `zalo-mod` plugin đã đăng ký sẵn.
- **Sửa: Tạo gateway token** — Tất cả môi trường (Wizard + CLI) giờ dùng `crypto.randomUUID()` cho auth token gateway, thay thế dummy token cũ trong CLI.
- **Mới: Bộ test ma trận toàn diện** — Thêm `test-matrix.mjs` với 422 test phủ tất cả tổ hợp OS × Deploy Mode × Channel × Số bot, kèm exec-approvals, tạo .env, sandbox Wizard IIFE, kiểm tra cấu trúc CLI, và kiểm tra tính toàn vẹn config production đa kênh.
- **Dọn dẹp: Xóa file test cũ** — Loại bỏ `test-vps-install.mjs` E2E test, đã được thay thế bởi bộ test ma trận.

## [5.6.14] — 2026-04-25

### Dọn dẹp Tích hợp Plugin Zalo

- **Cải thiện: Đồng nhất config plugin Zalo** — Đăng ký plugin trong `config-gen.js` và `output.js` vẫn tự điền `plugins.entries['zalo-mod']` cho kênh Zalo Personal, đảm bảo tích hợp liền mạch không cần patch sau cài đặt.


## [5.6.13] — 2026-04-22

### Ổn định luồng Deploy Native/PM2 trên VPS

- **Sửa: Khởi tạo biến môi trường trên Native** — Quy trình khởi động PM2 cho cài đặt Native đã được viết lại sử dụng một bash wrapper chuyên dụng (`start-gateway.sh`) thay vì lệnh `sh -c` trực tiếp lỏng lẻo. Thay đổi này đảm bảo các biến môi trường quan trọng như `OPENCLAW_HOME` và `OPENCLAW_STATE_DIR` luôn được nạp đầy đủ khi gateway khởi chạy, khắc phục triệt để lỗi gateway ngừng hoạt động ngầm (silent failures) và sai lệch đường dẫn sau khi khởi động lại shell.
- **Sửa: Lỗi shell injection trong script** — Dọn dẹp lại lệnh PM2 để sử dụng đồng nhất tham số `--interpreter` khi chạy các tiến trình phụ, tránh lỗi shell-injection chuẩn POSIX trong kiến trúc đa bot (multi-bot).
- **Cải thiện: Truy cập dashboard từ xa** — Giao diện cấu hình binding cho Gateway nay đã được tối ưu để lưu IPv4 `0.0.0.0` ngay lập tức nếu được triển khai trên môi trường `VPS/Ubuntu`. Cấu hình dashboard và proxy nay đã hỗ trợ kết nối mạng ngoài / WAN / SSH-tunnel an toàn mà không làm rò rỉ dữ liệu của bản cài đặt dạng Desktop-Native vào mạng LAN nội bộ nội bộ (local area network).

## [5.6.12] — 2026-04-22

### Hotfix: PM2 gateway process thiếu biến môi trường OPENCLAW_HOME

- **Sửa: PM2 env forwarding** — Process gateway PM2 trên VPS/Ubuntu bị fail im lặng do `OPENCLAW_HOME` và `OPENCLAW_STATE_DIR` không được chuyển tiếp đến child process. Tất cả lệnh PM2 khởi động gateway (`vps-sh.js`, script restart `install-gen.js`) giờ dùng `sh -c "export OPENCLAW_HOME=... && openclaw gateway run"` để đảm bảo môi trường được kế thừa đúng.

## [5.6.11] — 2026-04-21

### Hotfix: Sửa lỗi CLI crash khi setup Telegram 1 bot

- **Sửa: `loopBotToken is not defined`** — Luồng setup Telegram 1 bot thiếu khai báo biến `loopBotToken`, gây `ReferenceError` ngay sau khi tạo cấu hình. Đã bổ sung biến bị thiếu cùng với `loopBotName`, `loopBotDesc`, và `loopBotPersona`.

## [5.6.10] — 2026-04-21

### Hotfix: Ổn định Smart-Route 9Router

- **Sửa: smart-route crash null** — Đổi API provider 9Router từ `openai-responses` về lại `openai-completions`. Khi `smart-route` route qua provider non-Codex (Gemini, Claude, v.v.), việc convert sang Responses format tạo ra null output items, gây crash `Cannot read properties of null (reading 'type')`. Format completions hoạt động ổn định với mọi provider.
- **Sửa: thiếu sync smart-route trong script restart** — `start-bot.bat` và `start-bot.sh` không khởi động tiến trình `9router-smart-route-sync.js` khi restart. Điều này khiến provider được bật trong 9Router dashboard sau lần setup đầu (ví dụ Gemini) không được thêm vào combo `smart-route`. Sync script nay được chạy cùng 9Router mỗi lần restart.

## [5.6.9] - 2026-04-21

### Sửa lỗi: Tương thích Provider OpenAI Codex & Config Zalo Personal

- **Sửa: Danh sách model Codex** — Cập nhật registry model Codex cho phù hợp với API hiện tại của OpenAI. Loại bỏ các model đã bị dừng (`gpt-5.3-codex-high`, `gpt-5.2-codex`, `gpt-5.1-codex-max`, `gpt-5.1-codex`, `gpt-5.1`, `gpt-5-codex`), giữ lại 4 model đang hoạt động: `gpt-5.4`, `gpt-5.3-codex`, `gpt-5.2`, `gpt-5.4-mini`.
- **Sửa: Chế độ API 9Router** — Chuyển config provider 9Router từ `openai-completions` sang `openai-responses` cho khớp với Responses API mới của OpenAI.
- **Mới: Script tự động patch 9Router** — Thêm `patch-9router.js` tự động vá source files 9Router (providerModels, codex executor, self-test) để tương thích với thay đổi API Codex. Patch chạy tự động khi setup, upgrade và trước mỗi lần khởi động 9Router.
- **Sửa: Hiển thị model Codex** — Config 9Router nay hiển thị từng model Codex riêng (`cx/gpt-5.4`, `cx/gpt-5.3-codex`, `cx/gpt-5.2`, `cx/gpt-5.4-mini`) bên cạnh `smart-route` để người dùng có thể chọn model cụ thể.
- **Cải thiện: Config kênh Zalo Personal** — Bổ sung `defaultAccount`, `groupAllowFrom`, `historyLimit`, config wildcard cho groups và `autoReply` vào cấu hình Zalo Personal được generate, giúp xử lý nhóm tốt hơn ngay từ đầu.

## [5.6.8] - 2026-04-17

### Sửa lỗi: 9Router Sync & Config Ubuntu Native

- **Sửa: DATA_DIR mismatch trên native Linux/Mac** — `resolveNative9RouterDesktopLaunch()` nay truyền `DATA_DIR: getNative9RouterDataDir()` vào PM2, đảm bảo 9router lưu dữ liệu đúng vào `~/.9router/` (Linux) / `%APPDATA%/9router` (Windows).
- **Sửa: dbPath sync script** — `writeNative9RouterSyncScript()` nay dùng `getNative9RouterDataDir()` thay vì `getProject9RouterDataDir()`, xóa hoàn toàn xung đột khi sync ghi vào `projectDir/.9router/` còn 9router lại đọc từ `~/.9router/`.
- **Sửa: openclaw.json home dir** — Khi cài native, CLI nay cũng ghi `openclaw.json` và `auth-profiles.json` vào `~/.openclaw/` vì binary openclaw trên Linux đọc từ đó, không đọc từ thư mục project.
- **Sửa: OPENCLAW_HOME trong ecosystem.config.js** — Thêm `OPENCLAW_HOME` và `OPENCLAW_STATE_DIR` vào env PM2 để multi-bot native tìm đúng config.
- **Sửa: Bảng MODEL_PRIORITY thiếu provider** — Đồng bộ bảng mapping provider → model của sync script PM2 với `native-helpers-gen.js`, bổ sung 20+ provider còn thiếu: `codex`, `github`, `cursor`, `claude-code`, `iflow`, `kiro`, `kilo`, `gemini-cli`, `ollama`, v.v.

## [5.6.6] - 2026-04-17
- Fix: Script sync 9router bi SIGKILL khi khoi dong qua PM2 tren Ubuntu/VPS. Xu ly loi nha bang try-catch, them --no-autorestart.

## [5.6.4] - 2026-04-16
- Đồng bộ NPM registry và bump version.

## [5.6.3] - 2026-04-16
- Cập nhật thông báo hướng dẫn cài đặt bot vào group trên Telegram cho rõ nghĩa hơn (tiếp tục).

## [5.6.2] - 2026-04-16
- Cập nhật thông báo hướng dẫn cài đặt bot vào group trên Telegram cho rõ nghĩa hơn.

## [5.6.1] - 2026-04-16
- Hotfix: Sửa lỗi ReferenceError modelsPrimary is not defined khi chạy CLI lúc tạo bot.

## [5.6.0] — 2026-04-16
- Bật sẵn `memory`, `memory-core` dreaming và thêm `DREAMS.md` cho workspace mới.
- Cải thiện UX relay Telegram và cập nhật hướng dẫn trong `TOOLS.md`, `TEAMS.md`.
- Sửa luồng sinh tài liệu tiếng Việt để giữ UTF-8 ổn định.

## [5.5.0] — 2026-04-15
- Đồng bộ luồng sinh workspace docs giữa Wizard và CLI qua shared scaffold builders.
- Chuẩn hóa bộ tài liệu tạo ra quanh `AGENTS.md`, `TOOLS.md`, `MEMORY.md`, `TEAMS.md` và tài liệu browser.
- Nâng mốc OpenClaw lên `2026.4.14` và bỏ hẳn file agent `.yaml` cũ.

## [5.4.2] — 2026-04-14
- Sửa lỗi cài relay plugin bị lặp trong script native được generate.

## [5.4.1] — 2026-04-14
- Khôi phục hỗ trợ browser trong Docker và sửa CORS cho control UI Docker.
- Bổ sung script gỡ cài đặt cho cả Docker và native.

## [5.4.0] — 2026-04-14
- Gỡ kênh `telegram+zalo-personal` khỏi Wizard và CLI.
- Đơn giản hóa luồng multi-bot về một cờ `isMultiBot` và dọn phần generate config.
- Chuẩn hóa đường dẫn agent/workspace tương đối và siết quy tắc cross-workspace trong `AGENTS.md`.

## [5.3.5] — 2026-04-12
- Sửa lỗi sinh tài liệu workspace liên quan đến `MEMORY.md`.
- Ghi sẵn script uninstall ngay trong thư mục project được tạo.

## [5.3.4] — 2026-04-12
- Tăng độ ổn định cho gateway Windows native và đặt tên workspace theo từng agent.
- Mở rộng `TOOLS.md` / `AGENTS.md` cho cả workspace Zalo và Telegram.

## [5.3.3] — 2026-04-11
- Thêm script uninstall vào luồng tải file từ Wizard.

## [5.3.2] — 2026-04-11
- Ổn định quá trình khởi động 9Router native trên desktop và pre-seed dữ liệu 9Router theo project.

## [5.3.1] — 2026-04-10
- Chuyển mặc định DM của Zalo Personal sang `open`.

## [5.3.0] — 2026-04-11
- Thêm luồng combo Telegram + Zalo Personal đầu tiên.
- Tự bật plugin Zalo Personal và cải thiện cold-start Docker.

## [5.2.4] — 2026-04-10
- Tăng tốc luồng upgrade bằng cách tận dụng cache Docker tốt hơn.
- Thêm tooling theo dõi bản cập nhật OpenClaw mới.

## [5.2.3] — 2026-04-10
- Sửa các lỗi state/validation của wizard multi-bot.
- Cải thiện thông báo khi thiếu dữ liệu và an toàn encoding cho script.

## [5.2.2] — 2026-04-10
- Sửa bind/CORS gateway trong Docker và giảm rebuild Docker không cần thiết.
- Sửa đường dẫn PM2 native để bám theo `.openclaw` trong project.

## [5.2.1] — 2026-04-09
- Sửa nhiều lỗi cài native Ubuntu/VPS liên quan PM2, 9Router, runtime packages và đường dẫn project-local.
- Cải thiện hướng dẫn đăng nhập Zalo Personal và thư mục credentials.

## [5.2.0] — 2026-04-09
- Thêm luồng upgrade 1 lệnh qua CLI, `upgrade.ps1` và `upgrade.sh`.
- Giữ nguyên dữ liệu người dùng khi cập nhật OpenClaw và artifact phụ trợ.

## [5.1.15] — 2026-04-08
- Đồng bộ native Windows với hành vi Docker tốt hơn.
- Sửa runtime path theo project, sync provider và luồng browser install.

## [5.1.14] — 2026-04-08
- Pin OpenClaw về bản ổn định hơn và sửa lỗi generate Docker trên Windows.
- Bổ sung khuyến nghị version Node.js tương thích.

## [5.1.13] — 2026-04-08
- Sửa generate script cài đặt trên macOS, luồng Docker startup và cài npm global native.
- Sửa lỗi state Wizard liên quan persona và điều hướng step.

## [5.1.12] — 2026-04-07
- Mở rộng danh sách skills tích hợp và cải thiện auto-select relay plugin cho multi-bot.
- Cập nhật mặc định Zalo Personal và sửa một số điểm validate trong Wizard.

## [5.1.11] — 2026-04-07
- Cập nhật hành vi DM và onboarding mặc định cho Zalo Personal.

## [5.1.10] — 2026-04-07
- Thêm auto-approve cho luồng đăng nhập/ghép thiết bị Zalo trên native VPS.

## [5.1.9] — 2026-04-07
- Khôi phục schema chặt hơn và cải thiện UX liên quan WebCrypto.

## [5.1.8] — 2026-04-07
- Sửa lỗi kết nối dashboard trên VPS và đăng nhập bằng token.

## [5.1.7] — 2026-04-07
- Sửa CORS của Control UI và đường dẫn 9Router native.

## [5.1.6] — 2026-04-07
- Khắc phục lỗi `SIGKILL` của PM2 khi cài native trên VPS.

## [5.1.5] — 2026-04-06
- Sửa lỗi PM2 khởi động 9Router trên native.

## [5.1.4] — 2026-04-06
- Sửa lỗi BOM làm CLI không khởi động và cải thiện patch timeout cho Docker.

## [5.1.3] — 2026-04-06
- Sửa lỗi rò biến nội suy trong Docker Compose.

## [5.1.2] — 2026-04-06
- Gia cố script sync trước lỗi shell injection bằng cách chuyển sang Base64.

## [5.1.1] — 2026-04-06
- Ổn định đồng bộ smart-route của 9Router qua provider API.
- Thêm auto-approve Zalo pairing và làm output Docker CLI gọn hơn.

## [5.1.0] — 2026-04-07
- Cải thiện luồng đăng nhập Zalo Personal và xử lý QR.

## [5.0.9] — 2026-04-06
- Bổ sung chế độ cài native không cần Docker.
- Cập nhật Gemma 4, multi-bot Telegram và tinh chỉnh UI/setup.

## [5.0.0] — 2026-04-04
- Thêm hỗ trợ Gemma 4 và tài liệu yêu cầu phần cứng.

## [4.1.4] — 2026-04-03
- Cải thiện chung về độ ổn định và trải nghiệm.

## [4.1.3] — 2026-04-02
- Cải thiện chung về độ ổn định và trải nghiệm.

## [4.1.2] — 2026-04-01
- Sửa lỗi trong nhánh v4.1.

## [4.1.0] — 2026-04-01
- Ổn định smart routing của 9Router.

## [4.0.9] — 2026-04-01
- Thêm đồng bộ smart-route theo thời gian thực và luồng tự cài Docker.

## [4.0.8] — 2026-03-31
- Cải thiện độ ổn định 9Router, hỗ trợ Ollama cloud và dọn luồng setup đa nền tảng.

## [4.0.1] — 2026-03-31
- Tăng mức tự động hóa khi tạo thư mục cài đặt và dùng npm CLI.

## [4.0.0] — 2026-03-30
- Phát hành đợt nâng cấp lớn của nhánh v4.

## [3.0.2] — 2026-03-29
- Mở rộng hỗ trợ smart proxy của 9Router.

## [3.0.1] — 2026-03-29
- Bổ sung đợt cập nhật nối tiếp cho tính năng, sửa lỗi, UI và phần kỹ thuật của v3.

## [3.0.0] — 2026-03-28
- Giới thiệu luồng generate mới của v3, làm mới UI, tài liệu và phần kỹ thuật.

## [2.0.0] — 2026-03-27
- Giới thiệu trải nghiệm setup v2 với cải thiện về giao diện, tài liệu và bảo mật.

## [1.0.0] — 2026-03-26
- Bản phát hành đầu tiên.
