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

---

## 🐳 Docker or Native — what actually differs

|  | Docker _(recommended)_ | Native |
|---|---|---|
| The bot runs | in an isolated container | directly on the machine, as an OS service |
| Needs Docker | Yes (Setup can install it on Linux/VPS) | No |
| Restarts after a crash/reboot | `restart: always` | launchd (macOS) / systemd (Linux) / schtasks (Windows) |
| Sees the host filesystem | No (only mounted folders) | Yes |
| Can drive desktop apps | No | Yes |
| Plugins live in | the container; the entrypoint reinstalls them on every boot | `<project>/.openclaw/extensions` on the host |

Native trades the container's isolation for access to the real machine. If the bot does not need to
touch your desktop, Docker remains the safer choice.

---

## 🔌 Port reference

| Port | Service | Notes |
|---|---|---|
| `51789` | Setup UI | the page you are using |
| `18789` | OpenClaw Gateway | the bot's Control UI |
| `18790` | Zalo Mod Dashboard | **always gateway port + 1** |
| `20128` | 9Router | AI model routing |

Docker and Native both use these same defaults. When something already holds a port, Setup **asks the
host** and steps to the next free pair, so a second project coexists with the first. To check which
project sits where, read `gateway.port` in `openclaw.json` or look at the **Status** column on the Bot
tab.

Docker publishes its ports on **`127.0.0.1`**, not `0.0.0.0` — so a container binding `0.0.0.0`
internally is still not exposed to the internet. Native listens on loopback too, even when you pick
**Linux VPS**; see below.

---

## 🐧 Native on Linux / a VPS

A few things behave differently when native runs on a server:

- **The gateway is a systemd _user_ unit.** `openclaw daemon install` has no `--system` flag, so the
  service lands in `~/.config/systemd/user/`. A user manager is torn down when that user's last
  session ends — harmless on a desktop with a graphical session, fatal over SSH: **the bot dies when
  you close the terminal**. Setup enables `loginctl enable-linger` so the service outlives the session
  and comes back after a reboot. If the log says it could not, run it yourself:
  `sudo loginctl enable-linger <user>`.
- **The gateway listens on `127.0.0.1` only.** Picking **Linux VPS** does not open the bind: the
  gateway speaks plain HTTP/WS (the auth token crosses the wire in cleartext) and a fresh VPS usually
  has no firewall, so exposing the control plane would be a badly lopsided trade. Reach it over an SSH
  tunnel instead (next section).
- **Plugins are installed for you.** Native puts `zalo-connect` (when a bot uses the Zalo channel) and
  `learning-memory` into `<project>/.openclaw/extensions` **before** the gateway's first boot — the
  same job the container's entrypoint does. Before v5.15.4 native skipped this, so Zalo login failed
  with `Unsupported channel "zalo-connect"` and the bot ran with no context engine.
- **The service env is completed.** `openclaw daemon install` propagates only some variables into the
  service it generates — `OPENCLAW_STATE_DIR` survives, `OPENCLAW_HOME` does not. Without it, plugins
  write to `~/.openclaw` instead of the project: files sent to the bot land outside the agent's
  workspace so it **cannot read them**, and the Zalo session sits in a different home from its config.
  Since v5.15.5 Setup completes the env (both systemd and launchd) and adopts the misplaced files
  back, including for projects created earlier.

---

## 🌐 Opening the UI when the server has no browser

There is no browser on the server, and every interface listens on `127.0.0.1` only. The way in is an
**SSH tunnel** from your own machine, then `localhost`.

On the Bot tab, open the **🌐 Open from another machine (VPS/server)** panel and hit **Copy** — the
command is pre-filled with the selected project's real ports, including the zalo-mod dashboard at
gateway + 1:

```bash
ssh -L 51789:127.0.0.1:51789 -L 18789:127.0.0.1:18789 \
    -L 18790:127.0.0.1:18790 -L 20128:127.0.0.1:20128 <user>@<server>
```

Keep that terminal tab open while you work, then open `http://localhost:51789`. The **Open** buttons on
the dashboard now work, because they point at the same port numbers on `localhost`.

> **If your own machine already runs another OpenClaw project** (a Docker one especially), those ports
> are **already taken locally** and `ssh -L` fails with `bind: Address already in use`. Stop the local
> project before opening the tunnel — or forward to different local ports
> (`-L 28789:127.0.0.1:18789`), accepting that the "Open" buttons will then point at the wrong port
> because they use the server's numbering.

---

## 🩺 Troubleshooting

| Symptom | Cause & fix |
|---|---|
| `Gateway restart failed after 13s` right after creating a bot | The first boot is running state migrations under a lease; the CLI stops verifying at 13s while the service is allowed 30s to start. Since v5.15.4 Setup waits on `/health` and waits the lease out before retrying, so this is usually a false alarm. |
| Zalo login says `Unsupported channel "zalo-connect"` | The plugin is not on disk. Update Setup to ≥ v5.15.4, or hit **Update** on the `OpenClaw Zalo Connect` card. |
| The bot dies when you close SSH, or never returns after a reboot | The systemd user unit has no linger → `sudo loginctl enable-linger <user>`. |
| The zalo-mod dashboard opens blank or refuses to connect | The tunnel is not forwarding its port. The dashboard is **gateway + 1**, not a fixed number. |
| The bot says it cannot read a file or image you sent | The service is missing `OPENCLAW_HOME`, so the file was staged outside the project. Update Setup to ≥ v5.15.5 and restart the bot — it completes the env and adopts the files. |
| `Config warnings … plugin not found` on every command | The config declares a plugin that is not installed. It is a warning, not a blocker: install the plugin, or run `openclaw doctor --fix` to drop the stale declaration. |
