# OpenClaw Web UI Setup Guide (New)

> Welcome to the intuitive OpenClaw installer. From this version onwards, the complex manual configuration process has been fully automated through a user-friendly Web UI. Simply follow the straightforward steps below.

---

## 🚀 Running the Installer

You can launch the installer using either of the following methods:

### Method 1: Using the NPX Command (Recommended)
You do not need to download the source code beforehand. Simply open your terminal and run:
```bash
npx create-openclaw-bot
```
The system will start a local server and automatically open the setup interface in your default browser (defaulting to `http://127.0.0.1:51789`).

### Method 2: Manual Setup
If you have cloned or downloaded the repository manually:
```bash
npm install
npm start
```

---

## 🛠️ Step-by-Step Configuration on the Web UI

### Step 1: Select Operating System & Runtime Mode
On the **Setup** tab:
1. **Choose operating system**: Select your host OS (**Windows**, **macOS**, **Linux Desktop**, or **Linux VPS**). The setup tool will auto-detect and highlight your current operating system.
2. **Choose runtime mode**: Select your deployment environment:
   * **Docker (Recommended)**: Runs the bot inside isolated Docker containers, preventing NTFS permission issues and keeping your host clean.
   * **Native**: Installs and runs dependencies directly on the host machine.

### Step 2: Choose Project Directory & Install
1. Click the red **Install OpenClaw** button at the bottom.
2. A popup modal titled **"Pick project folder then install"** will appear.
3. Input the absolute path where you want to create your new bot project (e.g., `E:\openclaw-bot`).
4. Click **Install**. The setup tool will clone the core repository, configure environments, and download all dependencies.
5. You can monitor the installation progress in real-time under the **Live Logs** console on the right side. Wait for the setup to report success and redirect you to the management Dashboard.

### Step 3: Connect to AI Providers via 9Router
1. Once installation completes, the Dashboard will show the connection state and link for **9Router** (the built-in smart AI Proxy).
2. Open the 9Router interface via the link or sign in using OAuth to connect your preferred AI providers (such as Google Gemini, OpenAI, Claude...) and sync your preferred AI models.

### Step 4: Define & Configure Your Bot
After configuring the AI proxy, switch to the **Bot** tab on the Setup UI:
1. **Choose Chat Channel**: Select the channel you want your bot to run on (Telegram, Zalo Personal, or Zalo Bot API).
2. **Input Bot Credentials**:
   * For Telegram: Input your Bot Token obtained from `@BotFather`.
   * For Zalo Personal: You can authenticate by scanning the Zalo QR code displayed directly on the Dashboard once the bot starts.
3. **Input Owner Information**: Enter your administrator account details to authorize control commands.
4. Click **Apply/Save** to write the config schemas.

---

## 📊 Dashboard Process Management

Once configured, you have total control over the bot lifecycle via the Web UI:

1. **Process Controller**:
   * Use the **Start / Stop / Recreate** buttons to turn your bot instances on, off, or restart containers/processes with a single click.
2. **Live Logs Streamer**:
   * Stream bot stdout outputs directly on the dashboard for instant debugging.
3. **File Tree Editor**:
   * Edit bot personality (`SOUL.md`), agent groups (`AGENTS.md`), or settings (`openclaw.json`) directly in your browser without opening any external IDE or editor.
