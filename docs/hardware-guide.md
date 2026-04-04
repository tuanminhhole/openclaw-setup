# Hardware & RAM Configuration Guide (Gemma 4 / Ollama)

When running **Local AI Models** (like Google's Gemma 4 via Ollama), your server or machine's hardware determines the speed and capability of the bot. 

OpenClaw supports running local models **without an API Key**. This guide helps you choose the right hardware based on the model tier and deployment mode.

---

## 💻 1. Gemma 4 Variant Matrix

Gemma 4 is available in four variants to accommodate different hardware classes. All variants are automatically pulled if you select "Ollama + Gemma" during the Setup Wizard.

| Gemma 4 Variant | Target Device / VPS | Min RAM (Native) | Min RAM (Docker) | Use Case |
|---|---|---|---|---|
| `gemma4:e2b` | Raspberry Pi, Budget VPS | ~ 4 GB | ~ 5 GB | Lightweight tasks, slow generation |
| `gemma4:e4b` | Standard Laptop, VPS | ~ 8 GB | ~ 9 GB | Good balance for standard chat bots |
| `gemma4` (Base) | Solid Workstation / Gaming PC | ~ 16 GB | ~ 18 GB | **Recommended.** High quality text |
| `gemma4:26b` / `31b` | High-End GPU Server | ~ 32 GB+ | ~ 34 GB+ | Enterprise-grade local processing |

> [!TIP]
> **Docker Overhead:** Running Ollama inside Docker (Docker Mode) consumes about **10-15% more RAM** compared to running it natively on the host OS. If you are on a strict 8GB VPS constraint, consider using **Native Install Mode**.

---

## ⚡ 2. Docker vs Native RAM Trade-offs

### If using **Docker Mode**:
- **Pros:** Perfect isolation. Ollama sidecar is automatically configured and networked (`http://ollama:11434`) without cluttering your host system. 
- **Cons:** Memory penalty. Docker's virtualization layer reserves RAM. 
- **Config:** OpenClaw's generated `docker-compose.yml` automatically sets:
  - `OLLAMA_NUM_PARALLEL=1` to prevent Ollama from exhausting RAM with concurrent inputs.
  - `OLLAMA_KEEP_ALIVE=24h` to keep the model loaded in RAM, preventing long startup times for subsequent chats.

### If using **Native Mode**:
- **Pros:** Direct access to host hardware. Maximum RAM efficiency and GPU passthrough (if you have an Nvidia/AMD GPU).
- **Cons:** You must install Ollama manually on your OS.
- **Config:** OpenClaw reads from `http://localhost:11434`.

---

## 🛠️ 3. How to optimize your VPS

If setting up on an Ubuntu VPS, you **must enable Swap Space** if your RAM barely meets the minimum.

**Enable 8GB Swap on Ubuntu (Run as root):**
```bash
fallocate -l 8G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

> [!WARNING]
> Swap space uses your Hard Drive/SSD as slow RAM. While it prevents crashes (Out of Memory errors), generation speed will be **drastically slower** if the model drops into swap memory. Always prioritize physical RAM or VRAM when possible.
