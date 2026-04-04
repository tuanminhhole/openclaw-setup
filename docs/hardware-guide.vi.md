# Hướng dẫn chọn cấu hình RAM & Phần cứng (Gemma 4 / Ollama)

Khi chạy **Model AI Tại Máy (Local)** (như Gemma 4 của Google thông qua Ollama), phần cứng máy tính hoặc VPS của bạn sẽ quyết định tốc độ và độ thông minh của bot.

OpenClaw hỗ trợ chạy các model local **không cần API Key**. Tài liệu này hướng dẫn bạn chọn cấu hình chuẩn dựa trên dung lượng phân khúc model và chế độ cài đặt.

---

## 💻 1. Ma trận Phiên bản Gemma 4

Gemma 4 có sẵn 4 kích thước (variants) phù hợp với đa dạng thiết bị. Khi bạn sử dụng Setup Wizard và chọn "Ollama + Gemma", model tương ứng sẽ được tự động pull về.

| Phiên bản Gemma 4 | Thiết bị mục tiêu / VPS | RAM tối thiểu (Native) | RAM tối thiểu (Docker) | Mục đích sử dụng |
|---|---|---|---|---|
| `gemma4:e2b` | Raspberry Pi, VPS Giá Rẻ | ~ 4 GB | ~ 5 GB | Tác vụ rất nhẹ nhàng, tốc độ phản hồi chậm |
| `gemma4:e4b` | Laptop phổ thông, VPS chuẩn | ~ 8 GB | ~ 9 GB | Cân bằng tốt cho bot chat thông thường |
| `gemma4` (Base) | PC Khỏe / Workstation | ~ 16 GB | ~ 18 GB | **Khuyên dùng.** Năng lực text chất lượng cao |
| `gemma4:26b` / `31b` | Máy chủ chuyên dụng có GPU | ~ 32 GB+ | ~ 34 GB+ | Cấp doanh nghiệp, xử lý logic phức tạp |

> [!TIP]
> **Hao phí của Docker:** Chạy Ollama trong Docker (Docker Mode) tiêu tốn thêm khoảng **10-15% RAM** so với chạy thẳng trên hệ điều hành (Native). Nếu VPS của bạn chỉ có đúng 8GB, hãy cân nhắc sử dụng **Chế độ Native Install**.

---

## ⚡ 2. Được và Mất: Docker vs Native

### Nếu chọn **Docker Mode**:
- **Ưu điểm:** Cách ly siêu sạch. Service Ollama được cấu hình mạng nội bộ tự động (`http://ollama:11434`) mà không làm bẩn hệ điều hành của bạn.
- **Nhược điểm:** Phạt bộ nhớ. Lớp ảo hóa của Docker sẽ cắn bớt một phần RAM.
- **Cấu hình:** File `docker-compose.yml` sinh ra từ OpenClaw đã auto-cấu hình:
  - `OLLAMA_NUM_PARALLEL=1` để chặn Ollama không bị tràn RAM khi có nhiều người chat cùng lúc.
  - `OLLAMA_KEEP_ALIVE=24h` để giữ model luôn nằm trên RAM, tránh tình trạng phản hồi lâu ở các câu hỏi sau.

### Nếu chọn **Native Mode**:
- **Ưu điểm:** Khai thác tối đa 100% phần cứng máy chủ. Tận dụng tối đa sức mạnh Native và GPU Passthrough (nếu bạn có card rời Nvidia/AMD).
- **Nhược điểm:** Bạn phải tự cài ứng dụng Ollama trên môi trường OS của bạn.
- **Cấu hình:** OpenClaw sẽ đọc model từ đường dẫn `http://localhost:11434`.

---

## 🛠️ 3. Mẹo tối ưu cho VPS

Nếu cài đặt trên Ubuntu VPS, bạn **bắt buộc phải tạo Swap Space (RAM ảo)** nếu RAM vật lý chỉ vừa khít hoặc thiếu hụt.

**Lệnh tạo 8GB Swap trên Ubuntu (Mở quyền root):**
```bash
fallocate -l 8G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

> [!WARNING]
> Swap space lấy ổ cứng Hard Drive/SSD làm RAM cực hãm. Dù nó giúp VPS từ chối tử thần (lỗi Out of Memory - sập nguồn), tốc độ sinh chữ (generation) sẽ **chậm như rùa bò** nếu model rơi vào vùng Swap. Luôn ưu tiên dùng RAM thật (DDR) hoặc VRAM của GPU khi có thể.
