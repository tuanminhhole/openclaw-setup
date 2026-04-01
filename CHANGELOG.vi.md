# Changelog (Tiếng Việt)

Tất cả những thay đổi nổi bật của dự án sẽ được ghi chép trong file này.

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
- **Mở Rộng Kết Nối Models**: Đưa vào danh sách hỗ trợ trọn bộ hệ sinh thái Ollama Cloud (*Qwen 3.5, GLM-5, MiniMax, GPT-OSS*), Kiro Haiku, Qwen Flash, cùng toàn bộ iFlow models hoàn toàn miễn phí.
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
