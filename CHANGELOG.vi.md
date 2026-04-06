# Changelog (Tiếng Việt)


## [5.1.4] — 2026-04-06

### 🐞 Sửa lỗi BOM khởi động CLI & Tối ưu luồng vá Timeout trên Docker

- **Sửa file CLI (BOM)**: Xóa tự động chèn BOM (`\uFEFF`) ở đầu file `cli.js`. Ký tự thừa này vốn làm hỏng shebang `#!/usr/bin/env node` và gây `SyntaxError: Unexpected token` trong nhiều môi trường khi chạy npx
- **Cải thiện Docker Timeout Patch**: Quá trình can thiệp timeout (`300s`) trong lúc build Docker giờ chuyển sang scan quét toàn bộ các file `.js` trong thư mục `openclaw/dist` thay vì cố tìm file trùng hash `gateway-cli-*`. Giúp bản vá luôn áp dụng thành công trên các phiên bản backend khác biệt mà không in ra warning rác trên console


## [5.1.3] — 2026-04-06

### 🐜 Lỗi lọt biến nội suy vào giao diện Docker Compose

Bản vá lỗi base64 trước đó đã gây ra lỗi mới (regression) do dùng ngoặc `${Buffer.from(...)}` bên trong chuỗi string sinh ra docker-compose. Điều này làm lọt nguyên đoạn text nội suy vào `docker-compose.yml` thay vì sinh ra chuỗi base64 thật.

- **Fix**: Thực hiện tạo mã base64 hoàn chỉnh qua JavaScript (`const syncScriptBase64 = encodeBase64Utf8(syncScript)`) ngay từ ban đầu trước khi ghép chuỗi vào file compose
- Đảm bảo file compose tạo thành nhận chính xác mã base64 thuần túy mà không bị lọt biến môi trường
- Dọn dẹp lại script test tương ứng


## [5.1.2] — 2026-04-06

### 🐛 Fix Shell Injection: Sync Script Dùng Base64

Approach node -e JSON.stringify gây lỗi /bin/sh: Syntax error "(" unexpected vì JSON.stringify sinh chuỗi double-quoted phá vỡ shell argument.

- **Fix**: nội dung sync script nay được **base64-encode tại thời điểm gen compose** bằng Buffer.from(script).toString base64
- Entrypoint sinh ra dạng: node -e writeFileSync Buffer.from b64 base64 toString
- Base64 chỉ chứa [A-Za-z0-9+/=] — không có ký tự đặc biệt, hoạt động đúng trong YAML block
- Áp dụng cho tất cả luồng gen compose: Docker web wizard (setup.js x2) và Docker CLI (cli.js x2)


## [5.1.1] — 2026-04-06

### 🔧 9Router Smart-Route Sync — Ổn định qua API

Sửa lỗi nghiêm trọng khiến sync script không nhận ra provider đang active, làm tất cả request fallback về `openai` (lỗi `404 No active credentials`).

- **Nguyên nhân**: script đọc `db.providerConnections` từ `db.json` nhưng field này không tồn tại trong 9Router v0.3.79+ — connections chỉ có qua REST API
- **Fix**: script giờ gọi `fetch('http://localhost:20128/api/providers')` → `d.connections[]` để detect provider đang active
- **Fix**: thay heredoc `cat << 'CLAWEOF'` (gây ra `const p=undefined`) bằng `node -e require('fs').writeFileSync(...)` — không còn lỗi escaping trong YAML+shell
- **Fix**: `build9RouterSmartRouteSyncScript()` trong CLI docker flow giờ truyền đúng `'/root/.9router/db.json'` làm db path
- Áp dụng cho cả 3 vị trí: Docker web wizard (`setup.js`), Docker CLI (`cli.js`), và native (`cli.js`)

### 📱 Zalo Pairing — Tự Động Approve Khi Gateway Đang Chạy

- Trước đây, auto-approve chỉ chạy trong login flow ban đầu; pairing request mới khi gateway đang chạy bị bỏ qua
- **Fix**: `openclaw gateway run` với Zalo Personal giờ pipe stdout/stderr và tự gọi `openclaw pairing approve zalouser <code>` khi phát hiện pairing code mới

### 🧹 Output Docker CLI Gọn Hơn

- Xóa các hướng dẫn thừa sau khi Docker build xong (`docker compose build`, `openclaw gateway`, PM2) — Docker mode tự chạy hoàn toàn, không cần thao tác thủ công thêm

## [5.1.0] — 2026-04-07

### 🤖 Zalo Personal Login Improvements

- Zalo Personal giờ sử dụng luồng đăng nhập `zalouser` trực tiếp trên cả native và Docker.
- Setup in ra đường dẫn QR cùng các lệnh login/copy chính xác, giúp người dùng đăng nhập nhanh mà không cần `openclaw onboard`.
- QR login Docker giờ nhắm vào service compose `ai-bot` đã sinh ra thay vì các tên container cũ dễ hỏng.

## [5.0.9] — 2026-04-06

### 🚀 Chế độ Native Install — Không cần Docker

OpenClaw giờ hỗ trợ **cài đặt native (không dùng Docker)** trên Windows, Linux, macOS, VPS và shared hosting.

- **CLI native mode** — thêm chọn chế độ: `docker` (mặc định) hoặc `native`
- **Script khởi động sinh tự động theo OS:**
  - 🪟 **Windows** → `setup-openclaw-win.bat` (double-click cài ngay)
  - 🐧 **Linux / macOS** → `setup-openclaw-linux.sh`
  - 🖥️ **VPS / Ubuntu** → `setup-openclaw-vps.sh` (PM2 chạy nền)
  - 🏠 **Shared Hosting / cPanel** → `setup-openclaw-hosting.sh` + `ecosystem.config.cjs`
- **Web Wizard cập nhật** — Thêm toggle Deploy Mode (Docker / Native) + chọn OS
- **URL host động** — Ollama và 9Router URL tự chuyển:
  - Docker: `http://ollama:11434` / `http://9router:20128/v1`
  - Native: `http://localhost:11434` / `http://localhost:20128/v1`
- **Kiểm tra Node.js 18+** — Native mode yêu cầu Node.js 18+ trước khi chạy
- **Test scripts** — `test-native-install.bat` (Windows) và `test-native-install.sh` (Linux/macOS)

### 🤖 Cập nhật Gemma 4

- **4 biến thể Gemma 4** qua Ollama: `gemma4:e2b` (~4-6 GB), `gemma4:e4b` (~8-10 GB), `gemma4:26b` (~18-24 GB), `gemma4:31b` (~24+ GB)
- Tự pull model Gemma 4 khi `docker compose up` lần đầu (timeout container tăng lên 15 phút)
- Nâng timeout Ollama lên **300 giây** để xử lý model lớn
- Thêm `OLLAMA_NUM_PARALLEL=1` và `OLLAMA_KEEP_ALIVE=24h` vào Docker sidecar

### 🤖 Multi-Bot Deployment (tối đa 5 bot Telegram trên mỗi workspace)

OpenClaw giờ hỗ trợ triển khai **nhiều bot Telegram độc lập** từ một setup duy nhất — mỗi bot có identity, slash command, AI personality và thư mục workspace riêng biệt.

- **Triển khai 1–5 bot cùng lúc** — Web Wizard và CLI đều hỗ trợ cấu hình multi-bot
- **Workspace riêng biệt** — mỗi bot có thư mục `botN/` riêng với `.env` và cấu hình `.openclaw/` riêng, không gây xung đột token hay cấu hình
- **Tự động gán cổng** — cổng bắt đầu từ `18791` và tăng dần cho mỗi bot (`18791`, `18792`, ...) để tránh xung đột binding host
- **Docker Compose đa-service** — tự động sinh `docker-compose.yml` với một service cho mỗi bot, cộng thêm một container provider chung (9Router hoặc Ollama)
- **Department Room Model** — khi các bot chia sẻ chung một nhóm Telegram, chúng hoạt động như một đội ngũ chuyên nghiệp:
  - 🤫 **Mặc định im lặng** — bot phản hồi bằng emoji (👍 ❤️) với tin nhắn thông thường nhưng không bao giờ spam reply
  - 📣 **Trigger bằng @mention hoặc /slash** — chỉ bot được nhắc tên hoặc được gọi lệnh mới phản hồi, giống như gọi tên đồng nghiệp trong phòng họp
  - 🗃️ **Workspace chung** — tất cả bot đọc từ một thư mục workspace chung và có thể cộng tác trên các tác vụ, tệp và báo cáo
- **Cấu hình botGroup** được inject vào `openclaw.json` của mỗi bot để chúng biết tên và lệnh slash của nhau khi runtime

### 🔗 Trợ giúp lấy Telegram Group ID

Lấy Group ID giờ trở nên cực kỳ đơn giản:

- **Web Wizard**: card "Đã có group" giờ hiển thị nút inline `Lấy Group ID` mở thẳng **@userinfobot**, kèm hướng dẫn từng bước (forward tin nhắn nhóm → bot trả về Chat ID)
- **CLI**: chọn "existing group" sẽ in ra hướng dẫn tương tác với các bước đánh số và link trực tiếp đến `https://t.me/userinfobot`

### 🎨 Tinh chỉnh UI

- **Bộ chọn tùy chọn nhóm** được thiết kế dạng **hai thẻ tương tác** với icon, mô tả, hiệu ứng hover glow và dấu tick chọn động
- Trạng thái active của thẻ: màu xanh lá + viền cho "tạo sau", màu xanh chàm + viền cho "nhóm đã có"
- Hàng nhập Group ID bao gồm nút trợ giúp inline — không cần tìm kiếm tài liệu nữa

## [5.0.0] — 2026-04-04

### 🚀 Hỗ trợ Gemma 4 — Model mới nhất của Google

OpenClaw v5.0.0 cập nhật **Gemma 4** — dòng model open-weights mới của Google DeepMind, ra mắt 02/04/2026.

- **Gemma 4 có sẵn 3 size qua Ollama** — `gemma4:4b` (~6 GB RAM), `gemma4` mặc định (~10 GB), `gemma4:27b` (~18 GB)
- **Không cần cài Ollama thủ công** — Khi chọn Local Ollama + Gemma 4, setup tự động sinh **service `ollama` sát cạnh trong `docker-compose.yml`**. Docker tự pull model khi `docker compose up`. Không cần cài Ollama trước.
- **OLLAMA_HOST tự cấu hình** — Trỏ thẳng vào sidecar container (`http://ollama:11434`).
- **Cập nhật danh sách model** — Thêm `gemma4`, `gemma4:27b`, `gemma4:4b` vào Ollama provider trên cả CLI và Web Wizard.

### 💻 Yêu cầu phần cứng cho Gemma 4

| Model               | RAM/VRAM tối thiểu (4-bit) | Phù hợp                        |
| ------------------- | -------------------------- | ------------------------------ |
| `gemma4:4b`         | ~6 GB                      | Laptop thông thường, Mac M1/M2 |
| `gemma4` (mặc định) | ~10 GB                     | PC 16 GB RAM                   |
| `gemma4:27b`        | ~18 GB                     | Workstation 32 GB / GPU 24 GB  |

> Gemma 4 **miễn phí, open-weights, giấy phép Apache 2.0**. Không cần API key — chạy 100% local qua Docker.

## [4.1.4] — 2026-04-03

### ✨ Cải tiến

- CLI/Wizard đồng bộ đầy đủ skills (Browser Automation, Memory, RAG, Code Interpreter, v.v.)
- Browser Automation: chọn chế độ Desktop (Host Chrome) hoặc Server (Headless Chromium) cho Linux/Ubuntu
- Sửa lỗi Dockerfile WORKDIR gây lỗi build trên Linux
- Skills install tại **runtime** container (không phải lúc build) để tránh lỗi ClawHub auth
- TOOLS.md động: tự sinh theo danh sách skills đã chọn
- Tự tạo `browser-tool.js` (Desktop mode) và `BROWSER.md`
- Tự đăng ký skills vào `openclaw.json → skills.entries`
- Bổ sung prompt cấu hình Email SMTP và inject vào `.env`
- Single-source version qua `bump-version.mjs` — 1 lệnh cập nhật tất cả file

## [4.1.3] — 2026-04-02

### ✨ Cải tiến

- CLI/Wizard đồng bộ đầy đủ skills (Browser Automation, Memory, RAG, Code Interpreter, v.v.)
- Browser Automation: chọn chế độ Desktop (Host Chrome) hoặc Server (Headless Chromium)
- Sửa lỗi Dockerfile WORKDIR trên Linux
- TOOLS.md động: tự sinh theo skills đã chọn
- Tự tạo browser-tool.js (Desktop mode) và BROWSER.md
- Tự đăng ký skills vào `openclaw.json → skills.entries`
- Bổ sung prompt cấu hình Email SMTP

Tất cả những thay đổi nổi bật của dự án sẽ được ghi chép trong file này.

## [4.1.2] — 2026-04-01

### Khắc phục

- **CLI setup**: Khắc phục lỗi sinh file `docker-compose.yml` định dạng sai khi dùng 9Router (lỗi báo `yaml: while scanning a simple key`) bằng cách đổi cách escape string `syncComboScript` sang kiểu heredoc block scalars của bash để tránh xung đột nháy kép/nháy đơn trong YAML.

## [4.1.0] — 2026-04-01

### 🚀 Stable 9Router Smart Routing

- **Khởi tạo Database tinh gọn**: Combo mặc định của 9Router hiện tại sạch 100% (chỉ lưu `smart-route`). Đã loại bỏ việc tự động tiêm GPT-4o/Claude/Gemini như các rác hệ thống để ưu tiên 100% sức mạnh định tuyến động.
- **Tối giản Giao diện Toggling**: Cả web Setup Wizard và CLI đều được tinh giản, không còn liệt kê mảng models dư thừa khi chọn 9Router. Hệ thống mặc định chốt cứng Auto Route (`smart-route`) và giao hoàn toàn phán quyết chuyển đổi cho thuật toán `PREF`.

## [4.0.9] — 2026-04-01

### 🔄 Dynamic Smart Route (Đồng bộ Provider Realtime)

- **Routing Thông Minh**: Combo `smart-route` không còn là danh sách cứng 100+ model. Script đồng bộ chạy ngầm mỗi 30 giây sẽ tự động quét `/api/providers` của 9Router và chỉ đưa vào combo **những provider đã kết nối VÀ đang bật**. Triệt tiêu hoàn toàn lỗi `404 No active credentials`.
- **Bật/Tắt Tức Thì**: Bật hoặc tắt provider trên Dashboard 9Router — combo tự cập nhật trong vòng 30 giây, không cần restart container.
- **Mapping Đầy Đủ**: Hỗ trợ 25+ provider (Codex, Claude Code, GitHub Copilot, Cursor, Kilo, Cline, Gemini CLI, iFlow, Qwen, Kiro, Ollama, GLM, MiniMax, DeepSeek, xAI, Mistral, Groq...).

### 🐳 Tự Động Cài Docker

- **Zero-Prerequisite**: `npx create-openclaw-bot` tự phát hiện Docker chưa cài → tự tải + cài qua `winget` (Windows), `brew` (macOS), hoặc script chính thức Docker (Linux).
- **Hướng Dẫn Rõ Ràng**: Nếu cài tự động thất bại, hiển thị link tải trực tiếp kèm hướng dẫn chi tiết.

## [4.0.8] — 2026-03-31

### ✨ Tối ưu 9Router & Mở rộng Ollama Cloud

- **Tích hợp 9Router cực kỳ Ổn định (Zero Config)**: Proxy 9Router hiện được tự động kích hoạt bảo mật bên trong mạng Docker network qua cổng `sk-no-key`. Toàn bộ thiết đặt API keys thủ công và định tuyến models được gỡ bỏ khỏi `.env` để nhường chỗ cho hệ thống quản lý tập trung và thông minh hơn qua [9Router Dashboard](http://localhost:20128/dashboard).
- **Mở Rộng Kết Nối Models**: Đưa vào danh sách hỗ trợ trọn bộ hệ sinh thái Ollama Cloud (_Qwen 3.5, GLM-5, MiniMax, GPT-OSS_), Kiro Haiku, Qwen Flash, cùng toàn bộ iFlow models hoàn toàn miễn phí.
- **Tự động Inject Smart Routing**: Cấu hình tự động gài sẵn combo luân chuyển linh hoạt `smart-route` giúp cân bằng tải công việc qua lại mượt mà giữa Codex, Claude Code, Gemini, và iFlow.

### 🧹 Clean Workspace & Auto-Setup Đa Nền Tảng

- **Zero-Clutter Generation**: Dọn sạch hoàn toàn các template làm mẫu như `.env.example` hay các file cấu hình `docker-compose` tĩnh dư thừa. Script setup sẽ tự khởi tạo linh động các file thực thụ ngay lúc chạy cho một workspace gọn gàng nhất.
- **Auto Browser Đa Nền Tảng**: Bổ sung `start-chrome-debug.sh` mới đét cho macOS/Linux đồng bộ hoàn hảo với file `.bat` thiết lập chạy Automation trên Windows, mở ra kỷ nguyên Auto-Browser tiện lợi.
- **Auto Prompt CLI**: `npx create-openclaw-bot` hiện đã hoàn chỉnh về feature-parity với Web UI, hỗ trợ tra vấn thông tin thiết lập User Identity và Persona của Bot trực tiếp ở bảng console.

## [4.0.1] — 2026-03-31

### ✨ Tự Động Hoá (Tự tạo thư mục cài đặt gốc) & NPM CLI

- **One-Command Install (npx)**: Gói CLI `create-openclaw-bot` được tải lên NPM. Người dùng Windows, Linux, Mac chỉ cần mở Terminal gõ lệnh `npx create-openclaw-bot` để setup tự động từ A-Z qua giao diện tương tác.
- **Tự động Setup & Khởi động Docker**: Quy trình tạo `.bat`/CLI được viết lại, thiết lập xong sẽ mở Docker compose tự động tải và kích hoạt Bot ngay.
- **Improved UI Setup**: Gọn gàng hoá file preview, đổi layout UI cho Zalo Bot API để dùng official vector SVG, nổi màu xanh chủ đạo Zalo thay vì logo trong suốt.
- **Safety First**: Lược bỏ tuỳ chọn mô hình Antigravity (AG) khỏi 9router Proxy Models và thêm cảnh báo đỏ trên UI để tránh rủi ro người dùng bị khoá account Google AI Ultra do lạm dụng quá mức. Cập nhật icon credit cho thesvg.org.

## [4.0.0] — 2026-03-30

### ✨ New Features & Updates

- **Full English Localization** — Đã hoàn thiện toàn bộ bản dịch tiếng Anh cho Setup Wizard (Button, Label, Step 4 Output).
- **Language Toggle Relocation** — Di chuyển công tắc ngôn ngữ (VI/EN) sang vị trí dễ nhìn và thao tác hơn.
- **Setup UI/UX fixes** — Cải thiện giao diện Setup Wizard cho Browser Automation và sửa các lỗi hiển thị (như undefined model badge).
- **Reference Error Fixes** — Khắc phục một số lỗi Reference Error trong quá trình chạy setup.

## [3.0.2] — 2026-03-29

### ✨ 9Router Smart Proxy Expansion

- **9Router db.json Stability** — Cập nhật logic inject db.json của 9router qua entrypoint để tránh lỗi báo mất file "No such file or directory, lstat db.json".
- **Flagship Fallback Proxy** — Cấu hình "Smart Proxy" để có danh sách luân chuyển các LLMs Flagship mạnh mẽ nhất hiện tại của Codex, Antigravity, Claude Code, và Github Copilot.
- **Tùy chỉnh Setup Wizard** — Khi cài đặt hiện tại sẽ thấy danh sách provider/model hoàn chỉnh, và Smart Proxy được đặt làm chuẩn ưu tiên để tự fix lỗi "404 No Active Credentials".

## [3.0.1] — 2026-03-29

### ✨ New Features

- **Wizard UI Redesign (Step 2)** — AI Provider/Model lên đầu, sau đó Identity, Personality, Security Rules, Extensions
- **User Info textarea** — User tự nhập thông tin về mình → sinh vào `USER.md` để bot cá nhân hóa
- **Editable Security Rules** — Hiển thị quy tắc bảo mật mặc định, user có thể sửa → inject vào `AGENTS.md`
- **Section dividers** — Icon dividers giữa các nhóm config (🤖 🔐 🧩)

### 🐛 Bug Fixes

- **Skills auto-enable** — Khi chọn skill, giờ tự động khai báo trong `openclaw.json` → `skills.entries` (enabled: true). Trước đây chỉ cài Dockerfile nhưng không register → bot không nhận skill
- **Skills env injection** — Skills cần API key (Tavily, SMTP…) tự động inject env vars vào `skills.entries`

### 🎨 UI/UX

- Identity grid 3 cột (Tên, Vai trò, Emoji) — bỏ Vibe (gộp vào System Prompt)
- Emoji input fix: `form-input--emoji` class, cùng height với input khác
- Label System Prompt → "Tính cách, Vibe & Quy tắc trả lời"
- Responsive mobile: Name full width, Role + Emoji side-by-side
- Security textarea readonly mặc định, nút "✏️ Sửa" / "🔒 Khóa" toggle

### 🔧 Technical

- `state.config.userInfo` — new field, saved from `cfg-user-info` textarea
- `state.config.securityRules` — editable, defaults per language (vi/en)
- `DEFAULT_SECURITY_RULES` constant with vi/en templates
- `clawConfig.skills.entries` generated from selected skills
- Language toggle updates both prompt and security rules

---

## [3.0.0] — 2026-03-28

### ✨ New Features

- **9Router Integration** — AI proxy, không cần API key, multi-container Docker (`docker-compose.yml` 2 service)
- **Skills System (ClawHub)** — 8 agent capabilities: Web Search, Browser Automation, Memory, RAG, Image Gen, Bot Scheduler, Code Interpreter, Email Assistant
- **Plugins System (npm)** — 4 runtime extensions: Voice Call, Matrix, MS Teams, Nostr
- **Browser Automation** — Full Chrome Debug Mode support (socat proxy, agent-browser, Playwright engine)
- **Task Scheduler** — Windows Scheduled Task auto-starts Chrome Debug khi logon (delay 10s)
- **Skill-aware .env** — `.env` template tự động thêm env vars cho skills cần API key (Tavily, SMTP, Flux...)
- **Post-setup Management** — Hướng dẫn thêm/bỏ skills/plugins sau khi setup qua `docker exec`

### 🎨 UI/UX

- Tách Skills (4-column grid) và Plugins (riêng biệt) — rõ ràng hơn
- Skill cards hiện notes (⚙️) cho skills cần setup thêm
- Browser Automation notice card ở Step 4 với `.bat` + `.ps1` scripts
- Management guide card (🔧) với `docker exec` commands

### 📚 Documentation

- `docs/browser-automation-guide.md` — Hướng dẫn sử dụng Browser Automation cho user
- `docs/skills-plugins-guide.md` — Tổng hợp toàn bộ skills/plugins + setup + env vars
- README.md / README.vi.md — Thêm 9Router, Skills/Plugins, FAQs mới

### 🔧 Technical

- `state.config.skills[]` + `state.config.plugins[]` quản lý độc lập
- `openclaw.json` inject `browser` config khi Browser skill selected
- Dockerfile conditional: socat, agent-browser chỉ khi cần
- docker-compose: `extra_hosts` cho cả 9Router lẫn non-9Router

---

## [2.0.0] — 2026-03-27

### ✨ New Features

- **Setup Wizard UI** — Interactive web wizard (`index.html`) to configure OpenClaw bots visually
- **Multi-Channel Support** — Telegram, Zalo Bot API, Zalo Personal channel selection
- **Multi-Provider AI** — Google Gemini, Anthropic Claude, OpenAI/Codex, OpenRouter, Ollama (local)
- **Plugin System** — Modular plugin grid: Browser Automation, Scheduler, Memory, Web Search, RAG, Image Gen
- **Config Generation** — Auto-generates `openclaw.json`, `agent.yaml`, `Dockerfile`, `docker-compose.yml`
- **Language Toggle** — VI/EN toggle switch with SVG flag icons
- **Brand Logos** — Real SVG logos from [thesvg.org](https://thesvg.org) for all providers and channels

### 🎨 Design

- Dark-themed glassmorphism UI with animated multi-layer gradients
- Provider cards with unique colored icon backgrounds (Gemini purple, Claude orange, OpenAI green, OpenRouter violet, Ollama cyan)
- Auto-expanding System Prompt textarea (no internal scroll)
- Shimmer animation on title, glow effects on selected cards

### 📚 Documentation

- `README.md` / `README.vi.md` — Full bilingual docs with multi-provider table
- `SETUP.md` / `SETUP.vi.md` — Technical setup guide for AI agents
- Security notice: System Prompt = personality only, framework enforces security rules

---

## [1.0.0] — 2026-03-26

### Initial Release

- Basic OpenClaw setup guide
- Telegram-only configuration
- Google Gemini single provider support
- Manual config file instructions
