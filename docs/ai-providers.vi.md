# Hướng dẫn Cấu hình AI Provider

Tài liệu này tổng hợp toàn bộ AI provider được hỗ trợ trong OpenClaw. Sử dụng để lựa chọn provider phù hợp với ngân sách, yêu cầu kỹ thuật và nhu cầu bảo mật của bạn.

---

## 📊 So sánh các Provider

| Provider | Chi phí | Cần API Key | Dữ liệu | Phù hợp nhất |
| --- | --- | --- | --- | --- |
| **9Router** | 🆓 Miễn phí | ❌ Đăng nhập OAuth | Cloud | Người mới bắt đầu. Không cần cấu hình. |
| **Google Gemini** | 🆓 Free tier | ✅ Có | Cloud | Chất lượng cao. Giới hạn miễn phí rộng rãi. |
| **Anthropic Claude** | 💰 Trả phí | ✅ Có | Cloud | Lý luận và viết văn tốt nhất. |
| **OpenAI / Codex** | 💰 Trả phí | ✅ Có | Cloud | Sinh code, hệ sinh thái rộng. |
| **OpenRouter** | 🆓/💰 Hỗn hợp | ✅ Có | Cloud | Truy cập nhiều provider bằng một key duy nhất. |
| **Ollama (Local)** | 🏠 Miễn phí | ❌ Không cần | **Cục bộ** | Bảo mật tuyệt đối. Chạy offline được. |

---

## 🔀 9Router — Khuyên dùng cho người mới

9Router là một **AI proxy mã nguồn mở** chạy trên máy của bạn và tự động định tuyến yêu cầu AI đến model miễn phí tốt nhất. Thay vì quản lý API key, bạn chỉ cần đăng nhập một lần qua OAuth.

**Lý do chọn 9Router:**
- Không cần API key — chỉ cần đăng nhập OAuth một lần (GitHub, Google, ...)
- Tự động định tuyến đến model miễn phí (iFlow, Qwen, Gemini) với fallback thông minh
- Hỗ trợ 40+ provider và 100+ model
- Hoạt động trên **mọi nền tảng: Windows, macOS, Linux, VPS**
- Miễn phí hoàn toàn — mã nguồn mở

**Tùy chọn A — Cài native (hoạt động trên mọi OS kể cả Windows):**
```bash
npm install -g 9router
9router
```
Dashboard 9Router mở tại `http://localhost:20128`. Đăng nhập và kết nối một provider miễn phí.

**Tùy chọn B — Docker sidecar (tự động khi dùng Docker mode của OpenClaw):**
Khi bạn chọn 9Router trong Setup Wizard với Docker mode, file `docker-compose.yml` được tạo ra tự động bao gồm 9Router như một container sidecar. Không cần cài riêng.

**Dùng 9Router với OpenClaw:**
Dù bạn cài 9Router native hay qua Docker, cấu hình OpenClaw để dùng nó:
- API endpoint: `http://localhost:20128/v1`
- API key: sao chép từ dashboard 9Router
- Model: chọn bất kỳ model nào hiển thị là available trong dashboard

> [!TIP]
> Bắt đầu với combo miễn phí: Gemini CLI (180K free/tháng) + iFlow models (miễn phí không giới hạn) = $0/tháng.

---

## 🧠 Google Gemini

Google Gemini cung cấp free tier hào phóng nhất hiện có, là lựa chọn tốt nhất nếu bạn muốn dùng API key mà không mất tiền.

**Các model hỗ trợ:** Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 3.0 Flash

**Cách lấy API key:**
1. Truy cập [Google AI Studio](https://aistudio.google.com/apikey)
2. Đăng nhập bằng tài khoản Google
3. Nhấn **Create API Key**
4. Sao chép key và dán vào Setup Wizard khi được hỏi

**Giới hạn free tier:** ~15 yêu cầu/phút, ~1 triệu token/ngày (tính đến 2025). Đủ cho nhu cầu cá nhân.

---

## 🤖 Anthropic Claude

Claude được đánh giá là model hàng đầu về lý luận phức tạp, viết nội dung dài và tuân thủ hướng dẫn.

**Các model hỗ trợ:** Claude Sonnet 4, Claude Opus 4, Claude Haiku 3.5

**Cách lấy API key:**
1. Truy cập [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Tạo tài khoản và thêm thông tin thanh toán
3. Tạo API key và dán vào Setup Wizard

> [!WARNING]
> Anthropic Claude yêu cầu tài khoản trả phí để lấy API key. Không có free tier vĩnh viễn.

---

## 🤖 OpenAI / Codex

Phù hợp nếu bạn cần GPT-4o cho các tác vụ đa dạng hoặc Codex Mini cho quy trình làm việc nặng về code.

**Các model hỗ trợ:** GPT-4o, GPT-4o Mini, o3, Codex Mini

**Cách lấy API key:**
1. Truy cập [OpenAI Platform](https://platform.openai.com/api-keys)
2. Tạo tài khoản và nạp tối thiểu $5
3. Tạo API key và dán vào Setup Wizard

---

## 🌐 OpenRouter

OpenRouter tổng hợp hàng trăm model (bao gồm cả model miễn phí) dưới một API key duy nhất. Hữu ích khi muốn chuyển đổi provider mà không cần chạy lại Setup Wizard.

**Cách lấy API key:**
1. Truy cập [OpenRouter.ai](https://openrouter.ai/keys)
2. Tạo tài khoản (miễn phí)
3. Tạo API key. Một số model trên OpenRouter có giới hạn sử dụng miễn phí.
4. Dán key vào Setup Wizard

> [!TIP]
> OpenRouter bao gồm quyền truy cập miễn phí vào nhiều model mã nguồn mở. Lọc theo `Price: Free` trên trang web của họ để xem danh sách.

---

## 🏠 Ollama — AI Cục bộ (Không cần API Key)

Ollama chạy model AI trực tiếp trên máy tính hoặc máy chủ của bạn. Dữ liệu không rời khỏi hạ tầng của bạn. Lý tưởng cho các triển khai cần bảo mật cao.

**Các model local được hỗ trợ:** Gemma 4, Llama 3, Qwen 2.5, Phi-3, Mistral và nhiều hơn nữa.

### Docker Mode (Khuyên dùng)
Khi chạy OpenClaw với Docker và chọn Ollama, Setup Wizard tự động:
- Thêm service `ollama` vào `docker-compose.yml`
- Cấu hình URL nội bộ là `http://ollama:11434`
- Đặt `OLLAMA_KEEP_ALIVE=24h` để giữ model trong RAM
- Pull model đã chọn khi `docker compose up` lần đầu

Bạn **không cần** cài Ollama riêng.

### Native Mode
Nếu không dùng Docker, bạn phải cài Ollama thủ công:
1. Truy cập [ollama.com](https://ollama.com) và tải installer cho OS của bạn
2. Sau khi cài xong, pull model muốn dùng:
   ```bash
   ollama pull gemma4
   ```
3. Đảm bảo Ollama đang chạy trước khi khởi động bot. OpenClaw sẽ kết nối đến `http://localhost:11434`.

### Chọn phiên bản Gemma 4 phù hợp
Xem [Hướng dẫn RAM & Phần cứng](hardware-guide.vi.md) để biết chi tiết.

| Model | RAM tối thiểu | Phù hợp |
| --- | --- | --- |
| `gemma4:e2b` | 4 GB | Rất nhẹ. VPS giá rẻ. |
| `gemma4:e4b` | 8 GB | Laptop và VPS phổ thông. |
| `gemma4` (Base) | 16 GB | Khuyên dùng. Chất lượng output tốt. |
| `gemma4:26b` | 32 GB+ | Máy chủ cao cấp có GPU. |
