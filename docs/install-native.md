# Native Installation Guide (No Docker)

Native installation is designed for users who cannot or prefer not to use Docker. This includes deployments on Shared Hosting (cPanel), low-tier VPS environments, or Windows desktops for direct access.

OpenClaw v5.0.8+ natively supports deployment script generation for Windows, Linux, VPS, and Hosting environments.

---

## 🛑 Prerequisites for Native Mode

Unlike Docker mode which bundles everything, Native mode requires you to have the environment prepared beforehand:

1. **Node.js (v18.0 or newer)**
   - Download from [nodejs.org](https://nodejs.org/).
   - Verify by running `node -v` in your terminal.
2. **Ollama (Optional)**
   - Only required if you intend to use Local LLMs (like Gemma 4).
   - Install manually from [ollama.com](https://ollama.com/).
3. **PM2 (Optional, but auto-installed)**
   - Required for background processes on VPS and Hosting. The setup scripts will automatically install PM2 globally via npm.

---

## 🪟 1. Windows Desktop

Perfect for local development without the memory overhead of Docker Desktop/WSL2.

1. **Setup OpenClaw:**
   ```powershell
   npx create-openclaw-bot
   ```
   *At the `Select Deployment Mode` prompt, choose `Native`, then choose `Windows`.*

2. **Run the Bot:**
   - The CLI will generate a file named `setup-openclaw-win.bat`.
   - Double-click this file. It will automatically run `npm install` and start the bot in the terminal window.

---

## 🖥️ 2. VPS / Ubuntu / Linux Server

This method uses PM2 to run the bot stably in the background and ensure it automatically restarts if your server reboots.

1. **Setup OpenClaw:**
   ```bash
   npx create-openclaw-bot
   ```
   *At the `Select Deployment Mode` prompt, choose `Native`, then choose `VPS / Ubuntu`.*

2. **Run the Bot:**
   - The CLI generates a `setup-openclaw-vps.sh` script.
   - Run the script:
     ```bash
     chmod +x setup-openclaw-vps.sh
     ./setup-openclaw-vps.sh
     ```
   - This script will install PM2 globally if missing, install dependencies, and start OpenClaw using PM2.

3. **Manage the Bot with PM2:**
   - Status: `pm2 status`
   - Logs: `pm2 logs openclaw`
   - Stop: `pm2 stop openclaw`
   - Restart: `pm2 restart openclaw`

---

## 🏠 3. Shared Hosting (cPanel)

Shared hosting is restrictive because you do not have `sudo` access, and ports are usually blocked. OpenClaw supports this by running entirely through PM2 in your local user space.

1. **Setup Node.js App in cPanel:**
   - Go to your cPanel -> **Setup Node.js App**.
   - Create an application (Select Node 18+).
   - Enter your application root folder (e.g., `openclaw_app`).
   - Click **Start App** to ensure the environment is active.

2. **Access SSH Terminal:**
   - Open the **Terminal** feature in cPanel.
   - Navigate to your app folder: `cd openclaw_app`

3. **Setup OpenClaw:**
   ```bash
   npx create-openclaw-bot
   ```
   *Choose `Native`, then choose `Shared Hosting`.*

4. **Run the Bot:**
   - The CLI will generate `setup-openclaw-hosting.sh` AND an `ecosystem.config.cjs` file configured for strict hosting limits.
   - Run the script:
     ```bash
     chmod +x setup-openclaw-hosting.sh
     ./setup-openclaw-hosting.sh
     ```

> [!WARNING]
> Shared Hosting is generally not powerful enough to run Local LLMs (Ollama) or Heavy Browser Automation tasks concurrently. We highly recommend using API providers like Gemini, Claude, or 9Router if you are on Shared Hosting.
