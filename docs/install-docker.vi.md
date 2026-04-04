# Hướng dẫn Cài đặt Docker

Docker là phương thức triển khai được khuyên dùng cho OpenClaw. Nó đóng gói toàn bộ các thành phần phụ thuộc — Node.js, Chromium, Ollama — vào các container độc lập, dễ quản lý và tái tạo.

---

## ⚡ Trước khi bắt đầu: Docker có phù hợp với bạn không?

Docker hiệu quả nhưng có yêu cầu kỹ thuật nhất định. Hãy xem bảng này trước:

| Tình huống của bạn | Khuyến nghị |
| --- | --- |
| **Ubuntu trên máy tính riêng (không có dữ liệu quan trọng)** | ✅ Nên chạy OpenClaw trực tiếp, không cần Docker. Setup đơn giản hơn, hiệu năng tốt hơn. Xem [Hướng dẫn Native](install-native.vi.md). |
| **Ubuntu VPS hoặc máy chủ cloud** | ✅ Docker là lựa chọn tốt nhất. Dễ cập nhật và quản lý. |
| **Windows hoặc macOS desktop** | ✅ Docker Desktop hoạt động tốt. Windows yêu cầu WSL2. |
| **Không quen với command line (terminal)** | ⚠️ Docker có thể gây khó chịu. Hãy cân nhắc dùng Web Wizard với tùy chọn Native thay thế. |
| **Shared hosting (cPanel)** | ❌ Docker không khả dụng trên Shared Hosting. Dùng [Native Mode](install-native.vi.md). |

---

## 🔧 Yêu cầu hệ thống

Trước khi cài Docker, hãy đảm bảo có đủ:

- **Node.js 20 LTS** trở lên: [nodejs.org](https://nodejs.org/)
  - Node.js 20 LTS là phiên bản tối thiểu được khuyên dùng từ 2025 trở đi. Node.js 22 LTS cũng được hỗ trợ đầy đủ.
  - Kiểm tra: `node -v`
- **Docker Engine kèm plugin Compose V2**: Hướng dẫn cài bên dưới.
  - Kiểm tra Compose V2: `docker compose version` (Lưu ý: `docker compose`, không phải `docker-compose`)

> [!IMPORTANT]
> OpenClaw yêu cầu **Docker Compose V2** (plugin `docker compose`), không phải lệnh độc lập `docker-compose` cũ. Các hướng dẫn bên dưới sẽ cài đúng phiên bản.

---

## 🐧 Ubuntu / Linux Server

Ubuntu là môi trường tốt nhất cho triển khai thực tế (production).

### Bước 1 — Cài Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # Xác nhận: v20.x.x trở lên
```

### Bước 2 — Cài Docker Engine kèm plugin Compose V2

```bash
# Cài các gói phụ thuộc
sudo apt-get update
sudo apt-get install -y ca-certificates curl

# Thêm GPG key chính thức của Docker
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Thêm kho package của Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Cài Docker Engine và plugin Compose
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Kiểm tra Compose V2
docker compose version
```

### Bước 3 — Chạy Docker không cần sudo (Khuyên làm)

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Bước 4 — Cài và chạy OpenClaw

```bash
npx create-openclaw-bot
# Chọn "Docker" khi được hỏi về Deploy Mode
# Làm theo các bước còn lại

cd thu-muc-bot-cua-ban
docker compose up -d
```

---

## 🪟 Windows Desktop

### Bước 1 — Cài Node.js 20 LTS

Tải installer từ [nodejs.org/en/download](https://nodejs.org/en/download/). Chọn **LTS** và chạy file cài đặt.

Kiểm tra trong PowerShell: `node -v`

### Bước 2 — Cài Docker Desktop

1. Tải [Docker Desktop cho Windows](https://www.docker.com/products/docker-desktop/)
2. Chạy installer. Chọn **Use WSL 2 instead of Hyper-V** khi được hỏi.
3. Sau khi cài xong, mở PowerShell với quyền Administrator và cài WSL2:
   ```powershell
   wsl --install
   ```
4. Khởi động lại máy tính khi được yêu cầu.
5. Khởi động Docker Desktop và chờ đến khi hiển thị trạng thái **Running**.

### Bước 3 — Cài và chạy OpenClaw

```powershell
npx create-openclaw-bot
# Chọn "Docker" khi được hỏi

cd thu-muc-bot-cua-ban
docker compose up -d
```

---

## 🍏 macOS

### Bước 1 — Cài Node.js 20 LTS

Tải từ [nodejs.org](https://nodejs.org/) hoặc dùng Homebrew:
```bash
brew install node@20
```

### Bước 2 — Cài Docker Desktop

Tải bản dành cho [Apple Silicon (M1/M2/M3) hoặc Intel](https://www.docker.com/products/docker-desktop/) và chạy file `.dmg`.

### Bước 3 — Cài và chạy OpenClaw

```bash
npx create-openclaw-bot
cd thu-muc-bot-cua-ban
docker compose up -d
```

---

## 🔧 Quản lý container

| Thao tác | Lệnh |
| --- | --- |
| Khởi động bot | `docker compose up -d` |
| Dừng bot | `docker compose down` |
| Khởi động lại bot | `docker compose restart` |
| Xem log trực tiếp | `docker compose logs -f` |
| Rebuild sau khi thay đổi code | `docker compose up --build -d` |
| Kiểm tra trạng thái container | `docker compose ps` |

> [!TIP]
> Khi dùng Ollama, lần chạy `docker compose up -d` đầu tiên có thể mất vài phút để tải model về. Chạy `docker compose logs -f ollama` để theo dõi tiến trình tải.
