# Docker Installation Guide

Docker is the recommended deployment method for OpenClaw. It encapsulates all dependencies — Node.js, Chromium, and Ollama — into isolated containers that are reproducible and easy to manage.

---

## ⚡ Before you start: Is Docker the right choice for you?

Docker works well, but it has a learning curve. Review this table before proceeding:

| Your situation | Recommendation |
| --- | --- |
| **Ubuntu on your own machine (no critical data)** | ✅ Run OpenClaw directly without Docker. Simpler setup, better performance. See [Native Guide](install-native.md). |
| **Ubuntu VPS or cloud server** | ✅ Docker is the best choice. Easy to update and manage. |
| **Windows or macOS desktop** | ✅ Docker Desktop works well. WSL2 required on Windows. |
| **Not comfortable with the terminal** | ⚠️ Docker may be frustrating. Consider using the Web Wizard with the Native option instead. |
| **Shared hosting (cPanel)** | ❌ Docker is not available. Use [Native Mode](install-native.md). |

---

## 🔧 System Requirements

Before installing Docker, ensure the following:

- **Node.js 20 LTS** or newer: [nodejs.org](https://nodejs.org/)
  - Node.js 20 LTS is the minimum recommended version as of 2025. Node.js 22 LTS is also fully supported.
  - Verify: `node -v`
- **Docker Engine with Compose v2 plugin**: Instructions below.
  - Verify Compose v2: `docker compose version` (Note: `docker compose`, not `docker-compose`)

> [!IMPORTANT]
> OpenClaw requires **Docker Compose V2** (the `docker compose` plugin), not the legacy standalone `docker-compose` command. The installation instructions below install the correct version.

---

## 🐧 Ubuntu / Linux Server

Ubuntu is the preferred environment for production deployments.

### Step 1 — Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # Confirm: v20.x.x or newer
```

### Step 2 — Install Docker Engine with Compose V2 Plugin

```bash
# Install prerequisites
sudo apt-get update
sudo apt-get install -y ca-certificates curl

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add Docker's package repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify Compose V2
docker compose version
```

### Step 3 — Run Docker without sudo (Recommended)

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Step 4 — Install and run OpenClaw

```bash
npx create-openclaw-bot
# Select "Docker" when prompted for Deploy Mode
# Follow all other prompts

cd your-bot-folder
docker compose up -d
```

---

## 🪟 Windows Desktop

### Step 1 — Install Node.js 20 LTS

Download the installer from [nodejs.org/en/download](https://nodejs.org/en/download/). Select **LTS** and run the installer.

Verify in PowerShell: `node -v`

### Step 2 — Install Docker Desktop

1. Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. Run the installer. Select **Use WSL 2 instead of Hyper-V** when prompted.
3. After installation, open PowerShell as Administrator and install WSL2:
   ```powershell
   wsl --install
   ```
4. Restart your computer when prompted.
5. Start Docker Desktop and wait for it to show **Running** status.

### Step 3 — Install and run OpenClaw

```powershell
npx create-openclaw-bot
# Select "Docker" when prompted

cd your-bot-folder
docker compose up -d
```

---

## 🍏 macOS

### Step 1 — Install Node.js 20 LTS

Download from [nodejs.org](https://nodejs.org/) or use Homebrew:
```bash
brew install node@20
```

### Step 2 — Install Docker Desktop

Download for [Apple Silicon (M1/M2/M3)](https://www.docker.com/products/docker-desktop/) or Intel and run the `.dmg` installer.

### Step 3 — Install and run OpenClaw

```bash
npx create-openclaw-bot
cd your-bot-folder
docker compose up -d
```

---

## 🔧 Managing your containers

| Task | Command |
| --- | --- |
| Start the bot | `docker compose up -d` |
| Stop the bot | `docker compose down` |
| Restart the bot | `docker compose restart` |
| View live logs | `docker compose logs -f` |
| Rebuild after code changes | `docker compose up --build -d` |
| Check container status | `docker compose ps` |

> [!TIP]
> When using Ollama, the first `docker compose up -d` may take several minutes while the model is downloaded. Run `docker compose logs -f ollama` to monitor download progress.
