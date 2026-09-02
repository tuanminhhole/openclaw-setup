# Changelog (English)


## [5.16.4] — 2026-09-02

### 🔧 Fix: the "Update setup" button now works on npm-global installs

- New-host template installs create-openclaw-bot globally and runs the UI as a systemd user service. The self-update endpoint only handled git clones and `npx github:` installs, so on these hosts the button restarted the OLD version and reported success. It now detects a global npm install (excluding the npx cache), runs `npm i -g create-openclaw-bot@latest` in place, and lets the service manager relaunch onto the new dist.
- In plain words: **from this version on, clicking Update in the UI really updates the setup** — on standard server installs the button used to just restart the old version while reporting success.


## [5.16.3] — 2026-09-02

### 🚑 The big OpenClaw 2026.8.1 catch-up — the old setup had gone stale, this release heals everything in one pass

OpenClaw (the platform the bots run on) shipped a major 2026.8.1 upgrade and changed the rules:
config files are now strictly checked (one unknown entry and it refuses to start), data moved to
a new home, several install commands were renamed, and bot lists are managed differently. With
the old setup that meant: fresh installs could stall halfway, running bots suddenly went
**silent**, the admin screen showed **0 bots** while the bot was alive, and a phantom "root"
project appeared out of nowhere. All of it was caught on two real customer machines and fixed in
one pass:

- **Fresh installs run smoothly on OpenClaw 2026.8.1** — Docker and native, Windows/macOS/Linux.
- **Existing machines heal themselves on upgrade**: stale config is cleaned up, data is moved to
  its new home, and the old file that could mute the bot entirely is retired automatically.
- **The admin screen shows your bots again** — no more 0-bot display, no more phantom "root" tab.
- **The bot stops claiming "I can't see the file"**: files sent through chat now come with clear
  directions for the AI — even weaker models find them.
- **9Router (the AI model router) comes back on its own** after a server reboot or UI maintenance
  — previously it could die silently and the bot lost its brain.
- **One setup build manages both generations** (2026.7 and 2026.8) — renamed commands are tried
  the new way first with an automatic fallback, so nobody is forced to upgrade overnight.

## [5.16.2] — 2026-08-31

### 🔧 Fixes: the remaining OpenClaw 2026.8.x upgrade edges, all in one pass

Completes what 5.16.1 started. 5.16.1 fixed the upgrade-bricking mechanics (version pin, config re-infection, doctor-on-upgrade); this release closes the three remaining cases measured on a real recovery, so a fresh install — with or without web search — and an upgraded multi-agent project all come up on their own:

- **Web-search bots boot on OpenClaw ≥ 2026.8.** The generated config declares the `duckduckgo` provider, but 2026.8 unbundled it into an external plugin with capability consent — so the gateway refused to become ready. The entrypoint now installs `@openclaw/duckduckgo-plugin` (with consent) before starting the gateway whenever the config asks for it; an install failure only costs the search tool, never the boot.
- **Multi-agent projects get `agents.ownership: "explicit"` automatically** on 2026.8+, which that version requires before it will boot a roster with more than one agent.
- **Legacy per-agent session stores are parked automatically.** 2026.8 replaces `agents/*/sessions/sessions.json` and refuses to start while one exists, but `doctor --fix` defers the migration back to itself in a loop. The migration script now renames the file to `.bak-legacy-<ts>` (recoverable; it only holds open-session pointers) — on 2026.8+ only, since on 2026.7 that file is the live store.
- **No-version safety fixed:** when `openclaw --version` cannot be read, the migration now changes nothing at all — the first cut of the 5.16.1 gate could still delete `toolResultMaxChars` in that state.

All three migrations run from the shared config-migration script, so Docker (entrypoint, every boot) and native (every gateway restart) get identical behavior.


## [5.16.1] — 2026-08-31

### 🔧 Fixes: an openclaw upgrade no longer bricks the bot

- **Pinned the OpenClaw version in the generated Dockerfile** (was `openclaw@latest`). A routine image rebuild could silently jump a whole OpenClaw generation — new strict config schema + new state-DB migrations — and the gateway then refused to boot. Seen live: a customer bot went down for 26 hours with 66 restarts after one rebuild pulled 2026.8.1 under a 2026.7-era config. Upgrading OpenClaw is now an explicit act shipped with a setup release.
- **The entrypoint no longer re-infects the config with `toolResultMaxChars`.** OpenClaw ≥ 2026.8 dropped that key from the schema and refuses to boot when it is present — but the old entrypoint re-added it on every container start, so deleting it by hand could never stick. The backfill is now gated on the actual `openclaw --version` inside the container: older runtimes keep the backfill, 2026.8+ gets the key removed (self-healing already-infected projects), and an unreadable version changes nothing.
- **Doctor-on-upgrade:** the entrypoint remembers the last OpenClaw version it booted (`.openclaw-last-version`) and, when it changes, runs `openclaw doctor --fix` twice before starting the gateway — exactly the stopped-writer window doctor needs for config + state-DB migrations.
- **Native gateway startup no longer dies to systemd's start limit.** First boot runs OpenClaw's state migrations under a ~5-minute lease; a colliding start exits instantly, and five of those in 30s made systemd abandon the unit for good while the installer waited on a port that would never answer. The installed unit now gets a drop-in lifting the start limit, a parked "failed" unit is reset before starting, health waits outlast the lease (420s), and a stalled wait explains itself — including calling out an `ssh -L` self-loop squatting on the gateway port.
- **`spawn openclaw ENOENT` fixed for skill/plugin installs from the Setup UI.** When the UI runs under the system Node while openclaw lives in an nvm prefix, the CLI was invisible. Bare commands are now resolved through PATH → nvm per-version bins (newest first) → global npm prefixes, and the resolved binary's own directory is prepended to the child PATH so its `#!/usr/bin/env node` picks the right runtime — applied to all five spawn sites.

### ⚙️ Change: smart-route context window 131072 → 1,048,576

- The 9router `smart-route` model entry now declares a 1M context window (owner decision, 2026-09-01), and existing projects are migrated on the next container start / native restart — only the exact setup-written values 200000/131072 are rewritten, custom tuning stays. Trade-off: if a combo still routes to a 128k upstream, long sessions can overflow there again — fix the combo, not the window.


## [5.16.0] — 2026-08-03

### ✨ New: Live bot status

- **Connection/login badges now update by themselves.** While Zalo bot cards are on screen, the dashboard re-reads the health snapshot every ~10 seconds (the server caches the probe, so this stays cheap) and patches the badges in place — no full re-render, so nothing steals focus from a form you are typing in. Login/restart events in the live log refresh the badges within ~2 seconds. "Refresh" still exists; you should rarely need it.

### 🔧 Fixes

- **A dead Zalo session no longer shows a green "Connected".** Two halves: openclaw-zalo-connect (≥ 3.1.1) now reports listener failures to the gateway instead of retrying silently, and the dashboard lets a reported error outrank `running` — a bot stuck on "Đăng nhập thất bại" shows "Disconnected", and its login badge reads "Session expired" instead of "Logged in".
- **Editing a bot no longer pops the Zalo QR modal.** The QR login flow belongs to bot creation only; saving a rename opened the modal for no reason — the edit endpoint never starts a login.
- **Full sessions no longer deadlock on smart-route.** The generated provider entry declared a 200k context window, but smart-route fans out across free upstreams and the smallest window in the pool is the real ceiling. A session that grew past it could not even run the compaction summarize call — every turn failed with "auto-compaction could not recover this turn" until `/new`. New projects declare 131072 (reply length is untouched — that is `maxTokens`); existing projects migrate on the next container rebuild, and only the exact default 200000 is rewritten so custom tuning survives.


## [5.15.6] — 2026-07-30

### 🔧 Fixes: Abandoned plugin staging dirs

- **Fix: an interrupted plugin install no longer shadows the real plugin.** `openclaw plugins install` unpacks into `extensions/.openclaw-install-stage-XXXXXX` and removes it on success. An install cut short leaves that copy behind — and it still carries a plugin manifest, so the gateway logs `duplicate plugin id detected` on every boot while a stale build competes for the same id. Found on a production host: a zalo-connect **3.0.7** staging dir sitting next to 3.0.17 for a week. Nothing is installing at entrypoint time, so any staging dir found there is abandoned by definition and is now removed — by the container entrypoint for Docker, and by the plugin bootstrap for native, which has no entrypoint.


## [5.15.5] — 2026-07-28

### 🔧 Fixes: The bot could not read files sent to it

- **Fix: the service now carries `OPENCLAW_HOME`**: `openclaw daemon install` propagates only an allow-list of variables into the service it generates — `OPENCLAW_STATE_DIR` survives, `OPENCLAW_HOME` does not (verified on a real systemd unit *and* a real launchd env-wrapper). Everything resolving paths from it fell back to `~/.openclaw` and wrote **outside the project**: zalo-connect staged inbound files where the agent's workspace could not reach them (a PDF sent to the bot came back as "I could not extract the content"), and kept its Zalo session in a different home from the config describing it. The generated service is now completed with every variable the project promises, on both systemd and launchd.
- **Fix: files written to the wrong home are adopted back**: media and Zalo credentials found in `~/.openclaw` are copied into the project before the corrected `OPENCLAW_HOME` takes effect — without that ordering, a fixed install would look for its session in the project, find nothing, and demand a fresh QR scan. The stray sqlite state is deliberately left alone: two databases cannot be merged by copying.
- Both repairs also run on every restart, so a project created before this release fixes itself.
- **Fix: the tunnel command forwards the Zalo Mod dashboard**: the remote-access panel hardcoded port 18790 instead of deriving gateway+1, so any project whose gateway was not on 18789 got a command missing its dashboard port — and the dashboard then failed to load with nothing in the logs to explain it.


## [5.15.4] — 2026-07-28

### 🔧 Fixes: Native mode on a Linux VPS

- **Fix: native installs now install their own plugins**: a container reinstalls missing plugins on every boot (`ensure_plugin`), but native mode had no counterpart, so `zalo-connect` and `learning-memory` were never put on disk even though the generated config declared both. Zalo login failed with `Unsupported channel "zalo-connect"` and the bot silently ran with no memory context engine.
- **Fix: channel readiness no longer misreads config warnings**: OpenClaw prints a "Config warnings" banner on every CLI call, quoting the offending keys — so a project whose plugin was missing had `zalo-connect` in the output of any command, and the readiness probe passed exactly when the plugin was absent. Warnings are stripped before matching, and the plugin folder is checked directly.
- **Fix: restart no longer collides with the first-boot migration lease**: restarting right after creating a bot exited 1 (`startup migrations are already running`) and could trip systemd's start limit. The reload now waits for `/health` first, and honours the retry deadline the CLI reports.
- **Fix: the bot survives logout and reboot on a VPS**: `daemon install` writes a systemd *user* unit, which is torn down when the user's last session ends — invisible on a desktop, fatal over SSH. Native Linux installs now enable `loginctl` linger.
- **Fix: headless Linux is detected as a VPS**: the previous check had two identical branches, so a server always looked like a desktop.
- **Security: a native gateway never binds `0.0.0.0`**: Docker needs it inside the container and publishes only `127.0.0.1`, but a native gateway has no such mapping — it would put a plain-HTTP control plane on the VPS's public interface. Native stays on loopback; reach it over an SSH tunnel.
- **Fix: native uses the default ports**: gateway `18789` and 9Router `20128`, stepping to the next free pair only when the host already has them taken. Native used to jump a hundred above unconditionally, so even an empty machine landed on `18889`/`20228`.


## [5.15.3] — 2026-07-28

### Added

- **The bot can work your screen, not just open apps.** PC control gains a desktop-action endpoint with the same JSON on every OS: screenshot, screen size, pointer move, click (left/right/middle, double), drag, scroll, type text, key combos (`ctrl+c`, `alt+tab`, …), clipboard read/write, list windows and focus one. No native modules and nothing to install: Windows uses a generated PowerShell helper (user32 + SendKeys + System.Drawing), macOS uses `screencapture` and System Events, Linux uses `xdotool` with `scrot`/`gnome-screenshot`/`import` — and when a Linux box is missing those, the reply names the package instead of failing silently. Screenshots are written inside the project, so a containerised bot gets a path it can actually open and can send the image straight into chat. Actions are an allow-list, every call is logged, and they only answer after you press "Điều khiển máy" (which now also writes `ui: true`).

### Fixed

- **An allow-listed CLI on Windows actually runs now.** `where claude` lists the extensionless npm shim first — a shell script Windows cannot spawn — so the bot got `spawn …\npm\claude ENOENT` for a tool that was installed and allowed. Detection now prefers a real executable, and a `.cmd`/`.bat` shim is read and resolved to what it wraps (an `.exe`, or node plus its `cli.js`), so commands still run without a shell.

## [5.15.2] — 2026-07-28

### Fixed

- **The dashboard is no longer slow.** Opening a bot page or switching project used to sit there for seconds: `/api/system` spent ~4s on *every* call just to read the 9Router version (running `9router --version` boots its whole CLI) plus ~6s the first time while it scanned projects one after another, and the Zalo status call cost ~3s each time. Versions are now read from the installed `package.json`, the project scan runs in parallel behind a short cache, expensive probes are de-duplicated so simultaneous requests share one round-trip, and everything is warmed while the browser is still opening. Measured on the same machine: `/api/system` 4.0s → 0.09s, project list 30ms → 2ms, Zalo status 3.0s → 2ms, project switch 22ms.
- **A native project no longer waits on Docker.** Reading the Zalo Connect version fell back to `docker exec` even when the project has no container, so every status call paid for a command that could not succeed.

### Changed

- **The Chrome the bot drives no longer starts as a copy of your own profile.** It opens an empty automation profile and you sign in once in the window that appears; nothing of yours is duplicated and your open Chrome windows are left alone. Run the starter with `OPENCLAW_CHROME_SEED_PROFILE=1` (or set it before pressing the button) if you would rather reuse the logins you already have — that copies cookies, logins, history and extensions, and has to close Chrome to do it, so it now says so first.
- **The debug port stays on loopback.** The wildcard `--remote-allow-origins=*` is gone: a CDP client written in Node sends no Origin header, so the wildcard bought nothing and only widened who could drive that browser.
- **Installing the browser plugin from the dashboard turns its opt-ins on.** The plugin ships with Docker patching, page JavaScript and file upload switched off; a dashboard install writes `patchDocker`, `allowPageScripting` and `allowFileUpload` into the project config, so browsing works right after the one-click install and the switches stay visible for anyone who wants them off.


## [5.15.1] — 2026-07-28

### Fixed

- **"Open Chrome" now really reaches every project.** Some Docker projects keep `.openclaw/extensions` in a named volume, so the plugin's files exist only inside the container. The Chrome starter was only ever rewritten on host paths, which silently found nothing there: the bot kept getting the old script — the one Chrome 136+ refuses to open a debug port for — no matter how many times you updated. The starter delivered to each workspace is now written directly, and the plugin's own copy is pushed into the container.

### Changed

- **The button on the browser card is now "Open Chrome for bot".** It used to say "Open Chrome debug", which read as something only a developer would press. It also tells you what actually happens: the new window runs a copy of your Chrome profile, so it is already signed in, and your own Chrome is left open. The copy-paste commands for a headless VPS use the same dedicated profile directory as the button and the scripts.


## [5.15.0] — 2026-07-27

### Added

- **New "Native" install mode — run the bot on this machine, without Docker.** Pick Native when creating a project and OpenClaw + 9Router run directly on your computer as a managed service (launchd on macOS, systemd on Linux, a Scheduled Task on Windows) that starts at login and restarts itself if it dies. No Docker to install, the bot can already reach your files, and it is the only mode where the bot can drive apps on your desktop. Native projects use their own ports (gateway 18889, 9Router 20228) so they can sit next to a Docker project — or an SSH tunnel to a remote bot — without a clash, and each project gets its own service so several can run at once. Docker stays the default and is unchanged.
- **"Control PC" — let the bot open Chrome and apps on your machine.** A toggle on each bot card (next to "Grant disk"): turn it on and the bot can open Chrome or an allow-listed app (TeamViewer, Zalo, …) on the computer running the bot. Off by default, token-gated, and limited to the apps you list. Desktop only — a headless server has nothing to open, so it stays off there.
- **The bot can run an allow-listed CLI on your machine (e.g. Claude Code) and read back the result.** A host-control endpoint lets the bot run a command you've allow-listed — like `claude -p "..."` — on the computer running it and get the output, so you can hand a task to Claude Code straight from chat. Token-gated, allow-list only (the executable is fixed), no shell (args can't inject a command), 180s timeout and capped output. Add tools under `commands` in `.openclaw/host-control.json`; Claude Code is auto-detected when `claude` is on PATH. Desktop only. (Antigravity and other GUI apps stay open-only — they have no headless CLI to delegate to.)
- **Native projects are detected automatically.** The launcher now finds a native install by its `.openclaw/native.json` marker and lists it beside your Docker projects — just like a running Docker bot is surfaced — so you no longer have to point the launcher at the folder before it shows up.

### Changed

- **Browsing now works out of the box on every OS.** On a desktop the bot drives your real Chrome (with your normal logged-in profile, not a throwaway one, so sites don't flag it); on a server it starts its own headless Chromium. No more "no browser available" when Chrome simply wasn't started — and the bot uses the crawl-capable browser tool that can actually read a page's text and links.
- **Buttons match the runtime.** On a native project the container-only actions are gone: "Rebuild" (there is no image — use Update, which reinstalls the package and restarts the service) and "Grant disk" (the bot already sees your filesystem).

### Fixed

- **"Control PC" now provisions the bot you actually selected.** Enabling host-control used to always write the token and instructions to the installer's launch project, so a bot living in a different (connected) project never received them — the switch showed "on" but the bot couldn't act. It now targets the selected project and re-points the running service without a restart.
- **Restarting a native gateway on Windows.** Windows cannot deliver the signal the plain restart uses, so the old process survived and freshly installed plugins never loaded, with no visible error. Native restarts now stop and start the service on Windows instead.
- **Zalo QR login works in Native mode.** Logging in a Zalo account no longer required a running Docker container ("Zalo login needs a Docker project"). On a native project the QR is generated by the host gateway, read straight off disk into the modal, and the service reloads after a successful login — the same flow as Docker, with no container.
- **Installing plugins and skills works in Native mode.** Skill installs, the Zalo Connect plugin install, and the post-install reload now run against the host service instead of assuming a container, so adding a plugin or skill to a native bot applies cleanly instead of failing on a missing container.
- **Native bots load their persona instead of a blank default.** A native agent's workspace was stored as a container path (`/home/node/project/…`), so on the host the bot failed every turn (`mkdir /home/node`) or, once relative, resolved to a doubled empty folder — it answered as a nameless first-boot assistant. Workspace paths are now normalized to an absolute project path, so the bot reads its IDENTITY/SOUL/AGENTS files from the first message.
- **The Zalo bot card shows the real connection status in Native mode.** Status was read only through Docker, so a healthy native bot always displayed "Connecting / Not logged in". It now probes the host gateway and reads channel status directly.
- **"Open" buttons follow the selected project.** The Zalo Mod dashboard button opened a hardcoded default port instead of the selected project's gateway port + 1 (so it missed a native project's 18890). It now derives the port from the active project.
- **"Control PC" works for native bots.** A native bot runs on the host with `exec`, so it now opens apps directly (macOS `open -a`, Linux `xdg-open`, Windows `start`) instead of being told to call the Docker-only host bridge (`host.docker.internal:18795`) it can't reach. Full mouse/keyboard/screen control is still available through OpenClaw's Codex Computer Use (install Codex.app + enable `computerUse.autoInstall`).
- **Deleting the last bot on a channel removes that channel.** Previously an enabled channel (e.g. Telegram) could be left behind with no account, showing a broken "not configured" entry in status.

## [5.14.1] — 2026-07-25

### Added

- **Zalo bots acknowledge your message with a reaction.** A 🦞 lands on an incoming message right away, so you can see the bot picked it up while the answer is still being written. It happens in the channel layer — the AI is never asked, so it costs nothing. On by default for new Zalo bots, and existing ones pick it up on update; change or turn it off with `messages.ackReaction` in `openclaw.json` (empty disables). Needs Zalo Connect 3.0.15 or newer.

### Changed

- **Zalo bots no longer react by hand in DMs.** With the automatic acknowledgment above, the instruction telling the bot to add its own reaction is gone from `TOOLS.md` — it spent tokens on something the channel now does for free. Other channels are unchanged.


## [5.14.0] — 2026-07-25

### Added

- **Bots can now build their own skills.** Ask your bot for a reusable capability ("make me a skill for X") and it writes the skill and puts it to work in the same reply — no approval step, no config editing. The skill is saved to `skills/<name>/SKILL.md` in the bot's workspace and loads itself. Existing bots pick this up automatically on update.


## [5.13.9] — 2026-07-24

### Added

- **Always-on memory for every bot (learning-memory).** A new context-engine plugin injects a curated `MEMORY.md` + `USER.md` into **every** turn — including group chats, which OpenClaw's default recall skips. Bots stop forgetting context and rules over time: no more chiming in unprompted or re-asking things you already told them. Installed and enabled automatically for new bots, and shown as a 1-click card in the dashboard.

### Changed

- **Retired the TencentDB Agent Memory plugin**, superseded by the always-on learning-memory engine above (no external service or SQLite tier needed). Existing bots are **auto-migrated on update**: the deprecated learning-memory *skill* and the TencentDB plugin are removed automatically.


## [5.13.8] — 2026-07-22

### Fixed

- **Duplicate/double replies in Zalo groups.** The agent could send its answer twice — once via the `message` send tool and again via the native reply, leaking an internal "done" status line (`NO_REPLY`). AGENTS.md now tells the agent to reply with plain text only (delivered exactly once, with mention/quote) and never to self-send to reply or emit status/`NO_REPLY` lines.
- **Multiple Zalo accounts per project.** Adding a second (or more) Zalo bot to a project now works — each extra Zalo bot gets its own account (keyed by agent id) with its own QR login, instead of being blocked. zalo-connect (fork ≥3.0) is genuinely multi-account.
- **Cached launcher out-of-sync**: auto-detects when the running launcher (e.g. via `npx`) differs from the cached install in `~/.openclaw-setup` and upgrades to match.


## [5.13.4] — 2026-07-22

### Added
- **Settings page in the dashboard.** A new "Settings" section (sidebar + mobile nav) to pick the theme (light/dark toggle), language (VI/EN) and timezone. The chosen timezone is applied to newly created bots.

### Fixed
- **Schedules & cron now run in the correct local time.** New bots carry an explicit `userTimezone`, so the agent resolves "today / tonight / tomorrow" in local time instead of UTC. Previously, scheduling around midnight could land a day off (in the past) and silently fail. The scheduling skill was also hardened: local time + timezone (never manual UTC), delivery must set channel + recipient explicitly, and group recipients use the raw thread id (no prefix).


## [5.13.3] — 2026-07-21

### 🔧 Fixes: Auto-update Launcher Version

- **Fix: Cached Launcher Out-of-Sync**: Automatically detects if the running launcher (e.g. downloaded via `npx`) has a newer/different version than the cached installation inside `~/.openclaw-setup`, and automatically triggers an upgrade to match.


## [5.13.0] — 2026-07-19

### Added
- **Per-bot Zalo health at a glance.** Every personal Zalo bot card now shows its own connection and login state, plus a compact ready badge.

### Improved
- **Reliable multi-account visibility.** The dashboard reads Zalo Connect runtime state per account and presents shared plugin versions in the main status column.
- **Cleaner Zalo controls.** Refresh and Login Again are grouped above the bot list, leaving each card focused on the status that belongs to that bot.


## [5.12.0] — 2026-07-17

### Added
- **OpenClaw Zalo Connect is now the default personal-Zalo experience.** Creating a Zalo bot or opening Zalo Login from the dashboard automatically prepares the channel when needed, then shows the QR flow in the same UI.
- **Smarter one-time setup.** Existing Zalo Connect installations are reused, making reconnects and restarts faster and avoiding duplicate downloads.

### Improved
- **A cleaner, more reliable Zalo stack.** Native group mentions, reactions and moderation now share one maintained Zalo runtime, while the retired Zalo helper paths and Sticker add-on have been removed from Setup.


## [5.11.1] — 2026-07-15

### Added
- **Workspace defaults rebuilt on OpenClaw's canonical files.** New bots now get all 7 upstream OpenClaw default workspace files (`AGENTS` / `BOOTSTRAP` / `HEARTBEAT` / `IDENTITY` / `SOUL` / `TOOLS` / `USER.md`) as the base skeleton, with this project's extra rules (security, file-sending, relay aliases, DM reactions…) appended as clearly-marked add-on sections. Vietnamese + English, all bot variants (single/relay/zalo/telegram). Applies to newly created bots only.

### Fixed
- **SQLite "disk I/O error" on Docker Desktop (macOS / Windows).** The generated `docker-compose.yml` now stores `.openclaw/state` in a named volume (`openclaw-state`) instead of a bind mount — SQLite WAL locking doesn't survive virtiofs/gRPC-FUSE file sharing. Linux/VPS keeps the plain bind mount.
- **npm package catch-up.** The `5.11.0` tarball on npm was published before the final GitHub amend, so it missed the workspace defaults, the SQLite fix and the last Chrome-debug/file-editor fixes — `5.11.1` is the complete package.


## [5.11.0] — 2026-07-09

### Added
- **Facebook Messenger — 1-click plugin install.** The `fb-messenger` plugin is now public on ClawHub and installable straight from the dashboard: create a Messenger bot, open **Bot → Plugins**, and hit **Install** on the `openclaw-fb-messenger` card (webhook + Graph API, auto User→Page token, HMAC signature verify). The old "plugin is private — contact to receive" gate is gone.

### Changed
- **Docker-only.** Dropped the native (non-Docker) install path to concentrate on the Docker flow, which runs flawlessly and stably across Windows / macOS / Linux / VPS (with cross-OS Docker auto-install).

### Fixed
- **Chrome-debug button on headless VPS.** The browser-automation Chrome-debug relay now works on a headless VPS (bridge-IP-scoped, auto-opens ufw).
- **Bot file editor** now saves non-`.md` text files (and the workspace path displays correctly).


## [5.10.1] — 2026-07-04

### Fixed
- **Plugin update no longer drops the zalo-mod dashboard port.** Regenerating `docker-compose.yml` (on plugin update/rebuild) now re-publishes the zalo-mod UI port (gateway port + 1) — the old match failed on `127.0.0.1:`-prefixed port lines, so the port silently disappeared.
- **Granted disk/folder mounts survive a rebuild.** User-added `/mnt/*` mounts are carried over when the compose is regenerated, so bots keep access after an update. Mounting a whole Windows drive (e.g. `D:\`) now produces a valid bind (`D:/` instead of an invalid bare `D:`).


## [5.10.0] — 2026-07-02

### Added
- **Native process supervision (auto-restart):** native installs now register the gateway and 9router as OS services (macOS launchd, Linux systemd, Windows detached) that restart on crash/reboot — mirroring Docker's `restart: always`. Best-effort with fallback to a plain detached process.
- **Dashboard UI polish:** Bot/Setup hero shortcut buttons, plugin version badges, cleaner feature-toggle layout, responsive/mobile fixes, and removal of the duplicate page title on the dashboard tab.

### Fixed
- **9router first-install auto-sync:** the generated `sync.js` no longer permanently disables "Require login". It logs in with 9router's default password `123456`, creates the `smart-route` combo from active providers' models **once**, then stops (no perpetual loop, no forcing login off). Require login stays ON with the default password (users change it later). `/v1` model calls are unaffected (API-key auth, separate from dashboard login).
- **Native workspace path:** agent `workspace` is now a relative path, so persona/memory/skills resolve correctly on native installs (was a container-absolute path pointing nowhere on the host).
- **Config `meta` block:** no longer seeded by the generator (OpenClaw owns it) — prevents config parse failures from a version-range `lastTouchedVersion`.

## [5.9.0] — 2026-06-28

### 🚀 New: run straight from GitHub
- Launch the wizard with one command, no npm publish required (works on macOS, Linux & Windows; Node.js ≥ 22):
  ```bash
  npx github:tuanminhhole/openclaw-setup
  ```
  The CLI detects its bundled server (`dist/`) and runs the local dashboard directly.

### 🔧 Fixes
- **zalo-mod can reach the Zalo API again (Sync Account / group admin works).** The entrypoint now exposes zalouser's `globalThis.__zcaApiByProfile` map **before the gateway imports zalouser**, so `openclaw-zalo-mod` sees the live API. Previously zalo-mod patched the file only at plugin-load time — after zalouser was already imported — so the shared map was never set on the running module and the dashboard failed with "ZCA API unavailable".
- **Don't reinstall zalouser when it already exists (no more duplicate plugin).** Both the container entrypoint and the QR-login flow now treat an existing `extensions/zalouser` as installed, so they won't `npm install @openclaw/zalouser` on top of it. A duplicate zalouser (two copies/versions) breaks the shared ZCA API map that `zalo-mod` relies on (Sync Account → "ZCA API unavailable").
- **Telegram DM reactions target the latest message.** The generated TOOLS.md now tells Telegram bots to react WITHOUT passing `messageId` (Telegram auto-reacts to the user's current inbound message) instead of guessing an id and hitting an older message. Zalo (which needs an explicit message id) is unchanged.
- **Never clobber a customized `docker-compose.yml`.** The infra auto-sync used to fully regenerate the compose on a version bump, wiping any hand-added reverse-proxy/Traefik labels, external networks, or extra published ports (this could silently break a live webhook). It now detects a customized compose (Traefik labels / external network / a `# openclaw-setup: custom` marker) and leaves your infra untouched. The zalo-mod "Open" button targets the dashboard at `:18790/dashboard`.
- **Easy remote access for VPS/headless installs.** On a server with no browser, the CLI now prints a ready **SSH-tunnel command** (auto-filled with the server's public IP + the dashboard/OpenClaw/9Router/zalo-mod ports), and the dashboard shows a matching **"Open from another machine"** panel (one-click copy) — so any user can reach the web UIs from their own computer without knowing how to set up tunnels. The **"Open" buttons now follow the host you're viewing the dashboard from** (no more pointing at your local machine's localhost when browsing from elsewhere), and the **zalo-mod plugin card got its own "Open" button**.
- **Multi-account Zalo (zalouser) routing fixed.** Adding a 2nd+ Zalo bot now registers its own `channels.zalouser.accounts.<id>` entry and an account-specific binding (`match.accountId`) with its own login profile — so it no longer shows up under Telegram in the UI, and its QR login saves to its own profile instead of overwriting the first bot's. Legacy catch-all zalouser bindings are auto-upgraded to be account-specific.
- **Auto-detects the project with running bots.** On any machine/OS, a fresh run now finds the project whose bot is live in Docker (instead of defaulting to an empty `~/openclaw-setup`) — so `npx` on a server already running bots targets the right folder, and Restart/Update act on the real bot.
- **"Update" button no longer freezes the UI.** Clicking **Update** applies the new version and **auto-restarts the dashboard on the same port** — the browser tab reconnects on its own. It adapts to how you run it: service-managed installs (systemd) exit so the supervisor relaunches; `npx`/GitHub installs re-fetch the latest on relaunch; git clones `git pull` and reuse the committed `dist/`.
- **Version-aware Update button**: reads the latest from **GitHub** (the real distribution source, not the stale npm registry) and only shows when a strictly newer semver exists — no more "Update available" while already on the latest.
- **Removed the broken self-update path** that tried `npm install create-openclaw-bot@latest` (unpublished → `ETARGET`).

### 🔒 Security
- **Gateway & 9Router host ports now bind to `127.0.0.1`** instead of `0.0.0.0`. The control plane stays off the public internet; reverse proxies still reach containers over the Docker network. This also fixes the dashboard showing a false **OFFLINE** status when the bot runs behind a proxy.

### 🧠 New: TencentDB Agent Memory — one click in the UI
- **New memory plugin**: Install **TencentDB Agent Memory** straight from the Skills & Plugins panel. A 4-tier (L0–L3) layered-memory pipeline with context compression that keeps long sessions coherent and cuts token usage by up to ~61%. Runs fully local (SQLite + sqlite-vec) — no API key, works inside Docker.

### ⚡ New: Token-lean defaults for every new bot
- **Smarter context budget out of the box**: New bots now ship with `contextPruning: { mode: "cache-ttl", ttl: "5m" }` + `compaction: safeguard`. The stable system prompt stays cached while stale tool results are trimmed before the cache window expires — cheaper and sharper long conversations, with zero tuning.

### 🎯 Improved: Per-bot & per-channel Skills/Plugins
- **Per-bot skills**: Installing/enabling/disabling a skill now applies to **that bot only** (workspace-scoped) instead of leaking across every bot in the project.
- **Channel-aware panel**: The Skills & Plugins UI only shows what fits the bot's channel — Zalo helpers on Zalo, Facebook plugins on Messenger, and so on.

### 📤 Improved: Reliable file sending on Zalo & Telegram
- **Outbound file guide baked into AGENTS.md**: Generated bots now follow the correct ritual — export the file, copy it into `.openclaw/media/outbound/`, then send via the `message` tool — fixing "the file won't send" on Zalo's sandbox.
- **Format guard**: Bots are instructed to use modern formats (`.xlsx`, `.pdf`, `.png`) and avoid legacy `.xls`, which OpenClaw blocks because its content type can't be buffer-verified.

### 🐳 New: One-click Docker controls — no terminal needed
- **Restart & Rebuild buttons** in the Bot tab: restart the bot container, or rebuild + recreate it (`docker compose up -d --build --force-recreate`), straight from the dashboard — no command line.
- **Grant disk access button**: point the bot at any host folder/drive; it mounts into the container at `/mnt/<name>` (cross-OS, including Windows `C:/…` via long-form bind), the container auto-recreates to apply, and each bot's AGENTS.md is updated so the agent knows it may use the path. Project-scoped by default (all bots share it).

### ✨ Improved: Bot tab UX & faster page loads
- **Probe once, reuse everywhere**: The slow runtime/version detection and Docker-infra sync (multiple `docker exec` + `openclaw` CLI calls) now run **once** and are cached, instead of re-running on every Dashboard and Bot page load. First load warms the cache; subsequent loads are near-instant (bot status ~4s → ~3ms in local testing). The cache is automatically invalidated on update, rebuild, restart, and plugin/skill install so versions never go stale.
- Project switching now renders the new project's bots immediately (optimistic render) instead of waiting on background runtime-version probing.
- The channel tab strip keeps its scroll position after picking an off-screen channel (no more jumping back to the start).

### 🔧 Fixes
- **Correct plugin version display**: Plugin versions (e.g. `zalo-mod`) are read from the container's extensions volume, so the real version shows instead of a generic fallback.
- **Extensions now sync to host**: On macOS/Linux, `.openclaw/extensions` stays on the host bind-mount (Windows keeps the named volume for file permissions), so ClawHub-installed plugins are visible and editable on the host again.
- **`bot-meta.json` hygiene**: `appId` is written only for Facebook Messenger bots, no longer polluting Zalo/Telegram bots.
- **No more boot crash from `meta.lastTouchedVersion`**: Generated configs no longer seed an invalid `lastTouchedVersion` (an npm range / `latest`, not a real version) that could crash the container on first boot — OpenClaw stamps the correct `{ lastTouchedVersion, lastTouchedAt }` itself.
- **Longer agent-turn timeout**: Default `timeoutSeconds` raised from 120 → 900s so multi-step turns (OCR, file generation, long tool chains) aren't cut off prematurely.
- **Sturdier file sending & cleaner SOUL.md**: the AGENTS.md outbound-file rule now `mkdir -p`s `media/outbound` before copying (fixes intermittent "copy failed"); SOUL.md no longer hard-caps replies at 200 chars or carries the Zalo silent-mode block.


## [5.8.24] — 2026-06-24

### 🔧 Fixes: Auto-update Launcher Version

- **Fix: Cached Launcher Out-of-Sync**: Automatically detects if the running launcher (e.g. downloaded via `npx`) has a newer/different version than the cached installation inside `~/.openclaw-setup`, and automatically triggers an upgrade to match.


## [5.8.23] — 2026-06-24

### 🚀 New Features: Deep Integration of Autonomous Learning & Long-Term Memory (learning-memory) Skill

- **New: Long-Term Memory & Skill Auto-Evolution (learning-memory)**: Pre-integrates the autonomous memory and learning skill from ClawHub.
  - Automatically records newly learned facts, instructions, and user preferences into `MEMORY.md` in real-time.
  - Enables agents to self-package and compile newly acquired behaviors and workflows into reusable `.js` and `SKILL.md` files directly within the `./skills/` folder, allowing the bot to organically evolve its capabilities.
  - Implements OS-agnostic post-install triggers on all platforms (Docker, Windows, macOS, Linux) without requiring manual setup.
- **New: UI Skill Toggle**: Added the "Siêu Trí Nhớ Dài Hạn" (learning-memory) toggle option directly to the Setup Wizard interface with full installation logic support.

## [5.8.22] — 2026-06-16

- Improve browser-automation
- Improve installation for VPS

## [5.8.17] — 2026-06-08

### 🚀 Bug Fixes & Refinements: Docker Workspace Path Resolution, Clean NPM Installer, and UI Auto-Update

- **Fix: Docker Workspace Home Resolution**: Configured the `HOME` environment variable for the `ai-bot` container, aligning it with the project mount point to resolve path parsing issues (like `~`) for relative workspace paths on Windows/macOS.
- **New: Direct NPM Installer Execution**: Refactored the CLI launcher to run directly from the published npm package files instead of performing a full git clone, drastically reducing setup size and skipping git dependencies for end-users.
- **New: Automatic Setup Wizard Update**: Rewrote the updater to seamlessly install the package locally inside `~/.openclaw-setup` and automatically restart the Setup Wizard from the web UI when running via npm.
- **Aesthetic: Monospace CLI Logo Alignment**: Centered and balanced the rounded-border lobster logo displayed at startup.

## [5.8.15] — 2026-06-07

### 🚀 Bug Fixes & Refinements: Docker Workspace Path Resolution, Clean NPM Installer, and UI Auto-Update

- **Fix: Docker Workspace Home Resolution**: Configured the `HOME` environment variable for the `ai-bot` container, aligning it with the project mount point to resolve path parsing issues (like `~`) for relative workspace paths on Windows/macOS.
- **New: Direct NPM Installer Execution**: Refactored the CLI launcher to run directly from the published npm package files instead of performing a full git clone, drastically reducing setup size and skipping git dependencies for end-users.
- **New: Automatic Setup Wizard Update**: Rewrote the updater to seamlessly install the package locally inside `~/.openclaw-setup` and automatically restart the Setup Wizard from the web UI when running via npm.
- **Aesthetic: Monospace CLI Logo Alignment**: Centered and balanced the rounded-border lobster logo displayed at startup.

## [5.8.14] — 2026-06-07

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

## [5.8.13] — 2026-06-07

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

## [5.8.12] — 2026-06-07

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

## [5.8.11] — 2026-06-07

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

## [5.8.10] — 2026-06-07

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

## [5.8.9] — 2026-06-07

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script `image-generator.js` (synchronizing API credentials from `openclaw.json`) and a comprehensive `SKILL.md` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**:
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with `@Name` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending `[Sticker: <keyword>]` at the end of their text responses.
  - Automatically maps emotional keywords (such as `love`, `haha`, `ca khia`, `angry`, `thank you`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script `mentions.js` and a dedicated `SKILL.md` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the `TOOLS.md` generator to output a concise, static guide focusing on general principles and referencing the `./skills/` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated `AGENTS.md` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (`TEAMS.md` for single-bot, `BROWSER.md`) and standardizing descriptions to keep exactly 9 core documents.

## [5.8.8] — 2026-06-04

### 🔧 Fixes: Safe 9Router Spawning and Crash Prevention under Sudo/NVM

- **Fix: Process crash on spawn error**: Added an error handler on the detached child processes (like 9Router and OpenClaw gateway) spawned by the installer. If a command is missing or not in the PATH, the setup wizard will report a warning in the logs instead of crashing the entire Node.js server with an unhandled 'error' exception.
- **Fix: Binary path resolution on NVM/Sudo environments**: Automatically searches for the binary files (like `9router` and `openclaw`) inside the active Node.js executable directory and local node_modules bin folders. This resolves the `ENOENT` issue when running with sudo in environments using NVM, where user path custom binary symlinks are not in the sudo secure path.

## [5.8.7] — 2026-06-04

### 🔧 Fixes: Linux/WSL Project Discovery under Sudo

- **Fix: Project scanning under sudo**: Automatically resolves the real invoking user's home directory (e.g., `/home/username`) instead of fallback `/root` when running the Setup Wizard with sudo on Linux/WSL.
- **Fix: Linux system directory blacklist & restricted walking**: Added Linux/WSL system and virtual folders (such as `/usr`, `/var`, `/proc`, `/sys`, `/dev`, etc.) to the walking blacklist, and restricted the `/home` directory walk strictly to the active user's real home directory to prevent hangs, timeouts, or permission exceptions.

## [5.8.6] — 2026-06-04

### 🔧 Fixes: Version Hanging & Windows C-Drive Scanning

- **Fix: Setup Version Hanging (v...)**: Refactored the NPM registry fetch in `/api/system` into a non-blocking background task. The Setup Wizard now starts instantly without blocking on network requests.
- **Fix: Safe C-Drive Scanning & Users Folder Discovery**: Optimized project discovery to skip scanning restricted Windows system folders and other users' directories (`C:\Users\*`). Directly adds the current user's homedir and Documents folders to the scanning roots, enabling instant project detection on the C: drive without permission hangs.

## [5.8.5] — 2026-06-04

### 🔧 Fixes: Version Hanging & Windows C-Drive Scanning

- **Fix: Setup Version Hanging (v...)**: Refactored the NPM registry fetch in `/api/system` into a non-blocking background task. The Setup Wizard now starts instantly without blocking on network requests.
- **Fix: Safe C-Drive Scanning & Users Folder Discovery**: Optimized project discovery to skip scanning restricted Windows system folders and other users' directories (`C:\Users\*`). Directly adds the current user's homedir and Documents folders to the scanning roots, enabling instant project detection on the C: drive without permission hangs.

## [5.8.4] — 2026-06-04

### 🚀 Advanced Skills, Dynamic Model Selection & Setup Wizard Auto-Restart

- **New: Infographic Image Generator Skill**: Generates high-quality infographics and posters with Vietnamese text support. Features a dynamic `image-generator.js` script that resolves API credentials and automatically prioritizes the best active model (Recraft v3, Flux, DALL-E 3, Grok, Minimax, Gemini, etc.) from 9router.
- **New: Free Web Search Skill**: Zero-token stealth search on Google, Bing, and DuckDuckGo for all AI agents without requiring external API keys.
- **New: Setup Wizard Auto-Restart & Reload**: Clicking the Update button now automatically pulls, rebuilds, and restarts the backend process, while the frontend UI polls and reloads in real-time to apply the new version.
- **Improve: Chrome Browser Automation**: Advanced CDP integration with Chrome Debug Mode for Cloudflare bypass, cookie inheritance, and automated library dependency checks.
- **Improve: Cron / Scheduled Tasks**: Hardened scheduling behavior with timezone support, isolated session control, and proper group chat targeting (requiring `g:` prefix for Zalo channels).
- **Improve: Setup UI/UX**: Enhanced visual feedback, terminal log stream handling, and layout stability.

## [5.8.3] — 2026-06-02

### 🔍 Full-Drive Project Discovery & Sidebar Version Fix

- **Full-Drive Scanning**: Project discovery now scans ALL available drive letters (A-Z) instead of only hardcoded D:\ and E:\. Projects on C:\ or any other drive are now properly detected.
- **System Directory Blacklist**: Added a blacklist of 17+ Windows system directories (Windows, Program Files, $Recycle.Bin, ProgramData, etc.) to prevent slow or permission-error scans when walking drive roots.
- **Dynamic Sidebar Version**: Fixed the sidebar version display which was stuck on a hardcoded fallback value. The version now updates dynamically after the system API responds, showing the real running version.

## [5.8.2] — 2026-05-31

### 🚀 Smart Repository Update & Restructured Test Suite

- **New: Header Update Button**: Added a dedicated, beautifully styled **Update** button on the Topbar Header, next to the language switcher.
- **New: Dynamic Version Detection**: The button automatically queries the public npm registry (`create-openclaw-bot/latest`) asynchronously and is only displayed when a newer setup wizard version is available.
- **New: Live Log-Streaming Upgrade Protocol**: Implemented `/api/setup/update` to support live upgrades: automatically pulls code and builds for local git clones (`git pull && npm install && npm run build`), and upgrades globally via npm for standard installations. The upgrade logs are dynamically streamed in real-time straight to the setup dashboard's terminal widget while auto-focusing the **Logs** tab.

## [5.8.1] — 2026-05-30

### 🚀 Deep Integration of Smart Search & Dynamic Browser Automation

- **New: Deep integration of Smart Search & Browser Automation (v1.1.7)**: Pre-integrates the next-generation stealth web search and browser automation plugin for all AI agents.
- **New: Zero-Token Web Search**: Enables AI agents to search Google, Bing, and DuckDuckGo completely for free and without rate limits, eliminating the need for expensive third-party search API keys (Tavily/Google Search).
- **New: Real-time Browser Automation (CDP Controller)**: Empowers AI agents to interact directly with web pages using Chrome DevTools Protocol (CDP), reusing the host's real Google Chrome instance to browse and retrieve deeply nested web contents.
- **New: Seamless Cloudflare & CAPTCHA Bypass**: Interacts directly with Chrome Debug Mode to inherit cookies, sessions, and authentic browser fingerprints, sliding past strict security firewalls undetected.
- **New: Self-Guided & Self-Healing Environment**: Automatically sets up virtual Xvfb displays in Docker environments; and dynamically diagnoses missing OS-level library dependencies on VPS/Ubuntu native host machines, returning copy-pasteable commands for immediate fixes.
- **Improve: Absolute Data Isolation & Safety**: Migrates the local installer UI codebase to a hidden home directory (`~/.openclaw-setup`), ensuring absolute isolation and zero risk of overwriting or deleting any of the user's existing bot projects or credentials.

## [5.8.0] — 2026-05-28

### 🚀 Next-Generation Process Management Web UI Setup

- **New: Modern Web UI Setup**: Migrated the installation and onboarding workflow from legacy static HTML files (`index.html`) to a local Web Application (SPA). Automatically launches and guides users through the setup steps.
- **New: Container & Process Controller**: Integrated interactive **Start / Stop / Recreate** buttons on the dashboard to control bot runtime container states without typing docker commands.
- **New: Live Logs Streamer**: Added real-time log streaming (stdout) from your running bot container/process directly to the setup dashboard.
- **New: Integrated File Editor**: Allows developers to view, edit, and save bot configurations and workspace markdown files (`openclaw.json`, `SOUL.md`, `AGENTS.md`, `TOOLS.md`) directly within the browser.
- **New: Native Zalo QR Login**: Exposed QR authorization images on the dashboard for quick Zalo Personal account logins.
- **Improve: Smart Port Allocation**: Automatically checks for unused ports and dynamically allocates `routerPort` to prevent network collisions in multi-bot setups.
- **Improve: Windows NTFS Permission Fix**: Implemented a named Docker volume (`openclaw-plugins`) for dependencies to resolve NTFS file locks (`EACCES`) on Windows host machines.
- **Cleanup**: Deprecated and deleted all old static wizard files (`index.html`, `style.css`) and legacy documentation files under `docs/`.

## [5.7.10] — 2026-05-06

### 🚀 Features & Documentation Updates

- **Browser Automation v2**: Replaced legacy browser documentation with the updated `BROWSER.md` covering the full suite of v2 Chrome CDP commands (`get_posts`, `screenshot_full`, `pdf`, etc.).
- **Agent Workspace Standardization**: Updated `AGENTS.md` generator to correctly reference all generated `.md` files (`BROWSER.md`, `BOOT.md`, `SOUL.md`, `DREAMS.md`, `HEARTBEAT.md`, `USER.md`).
- **Tools Guide Cleanup**: Removed obsolete Zalo Group Slash Commands section from `TOOLS.md` generation as it is no longer necessary.

## [5.7.9] — 2026-05-05

### 🔧 Chore: Rename Zalo Plugin Reference

- **Fix: Rename `zalo-mod` to `openclaw-zalo-mod`** — Updated internal string references in `workspace-gen.js`, `bot-config-gen.js`, and test suites to align with the new NPM package identity of the Zalo plugin (`openclaw-zalo-mod`).

## [5.7.8] — 2026-05-05

### 🧹 Cleanup: Remove Zalo Mod Auto-Install

- **Fix: Remove `zalo-mod` auto-inject from Zalo Personal config** — `plugins.entries['zalo-mod']` is no longer pre-populated by `bot-config-gen.js`, `output.js`, or `native-helpers-gen.js`. The plugin caused persistent installation loops and permission conflicts in Docker. Users should install `openclaw-zalo-mod` manually via ClawHub after setup.
- **Fix: Remove `zalo-mod` from Docker runtime install commands** — Removed `ensure_plugin zalo-mod openclaw-zalo-mod` from the generated Docker entrypoint `runtimeCommandParts`. The bundled OpenClaw version handles the channel natively.
- **Fix: Remove `openclaw-zalo-mod` from Docker build allPlugins list** — Prevents the plugin from being baked into the Docker image during `docker build`, which was redundant and caused conflicts.
- **Chore: Update smoke tests and test-matrix** — Updated assertions to verify `zalo-mod` is NOT auto-injected into generated configs and NOT present in Docker runtime install commands.
- **Chore: Sync ARCHITECTURE.md** — Documented that `zalo-mod` must be installed manually via ClawHub; `hasZaloMod` in workspace-gen only affects workspace docs, not config generation.
- **Chore: Add `.agent/workflows/update.md`** — Standardized release workflow document for this repo.

## [5.7.7] — 2026-05-03

### 🛠️ Infrastructure & Zalo Bot Stabilization

- **Version Strategy**: Automatically runs with `openclaw@latest` across all deployment scripts to ensure Zalo integration stability.
- **Docker Optimization**: Replaced full project bind-mounts with isolated `.openclaw` mounts to resolve I/O bottlenecks.
- **Gateway Deadlock Fix**: Implemented `tmpfs` for `plugin-runtime-deps` directly within the Compose environment block.
- **9Router Sync**: Automated dynamic synchronization of `smart-route` combos based on active provider models during gateway startup.
- **Zalo Config Compliance**: Unified the bot config generation pipeline to ensure Zalo channels strictly output compliant schemas.

## [5.7.6] — 2026-05-03

### Fix: Docker Bind-Mount State Directory

- **Fix: `OPENCLAW_STATE_DIR` now collocated with project bind-mount** — Changed `OPENCLAW_STATE_DIR` from `/var/lib/openclaw-state` (an isolated anonymous volume) to `/root/project/.openclaw`, matching the bind-mounted project directory. This ensures state (sessions, memory, plugins) persists across container restarts without a separate named volume.
- **Fix: CLI volume mount now binds the full project directory** — Changed `volumeMount` from `../../.openclaw:/root/project/.openclaw` to `../..:/root/project`, so the container sees the full host project tree (not just `.openclaw`). This resolves path mismatch errors where the bot could not locate config files adjacent to `.openclaw`.
- **Fix: Remove orphaned `openclaw-state` named volume** — Removed the `openclaw-state:/var/lib/openclaw-state` volume injection logic from `docker-gen.js`. The state directory is now handled entirely through the project bind-mount.
- **Chore: Update smoke tests** — Added assertions to verify the new bind-mount strategy (`../..:/root/project`, `OPENCLAW_STATE_DIR=/root/project/.openclaw`) and that the old `openclaw-state` named volume is absent from generated compose output.
- **Chore: Update `lastTouchedVersion` in docs** — `SETUP.md` and `SETUP.vi.md` example configs now show `"lastTouchedVersion": "latest"` instead of a pinned version string.

## [5.7.5] — 2026-05-03

### Hotfix: CLI Crash & Vietnamese Encoding Fix

- **Fix: `ReferenceError: channelKey is not defined` in `writeWorkspaceFiles()`** — Added `channelKey` as an explicit parameter (default `'telegram'`) and passed it from both call sites (single-bot and multi-bot relay). This crash affected every platform (Telegram, Zalo) during workspace file generation.
- **Fix: UTF-8 encoding integrity in `cli.src.js`** — Restored proper UTF-8 source encoding by using Python-safe I/O for all file modifications, preventing double-encoding of Vietnamese characters introduced by Windows PowerShell string operations.

## [5.7.4] — 2026-05-02

### Hotfix: CLI crash on all setups — `channelKey is not defined`

- **Fix: `ReferenceError: channelKey is not defined` in `writeWorkspaceFiles()`** — The function referenced the outer `channelKey` variable from `main()` but it was never declared in its own parameter list. Added `channelKey = 'telegram'` as a parameter with a safe default, and passed the value explicitly from both call sites (single-bot and multi-bot relay). This crash affected every platform (Telegram, Zalo) during workspace file generation.

## [5.7.3] — 2026-04-29

### Docker Gateway Stability & Zalo Login Flow

- **Fix: Gateway crash loop due to missing `gateway.mode`** — Docker entrypoint config injection now explicitly sets `gateway.mode` (defaults to `local`), preventing the `Gateway start blocked: existing config is missing gateway.mode` error that caused infinite restart loops on OpenClaw 2026.4.26+.
- **Fix: ClawHub zalouser plugin overriding bundled version** — The entrypoint was downloading `@openclaw/zalouser@2026.3.22` from ClawHub, which does not support `channels login`. Removed runtime plugin install from generated entrypoints; the bundled version in OpenClaw is now used directly.
- **Fix: Correct `openclaw-zalo-mod` npm package name** — Updated `output.js` and `native-helpers-gen.js` to use `openclaw-zalo-mod` for plugin installation commands, matching the actual npm registry package name.
- **Improve: Login flow stops gateway before Zalo QR** — Download scripts (Windows/macOS) now stop the gateway service before initiating the Zalo login, preventing WebSocket contention during channel authentication.

## [5.7.2] — 2026-04-28

### Zalo Plugin Name & Build Output Fixes

- **Fix: Zalo-mod plugin installation name** — Corrected the plugin installation command in the CLI to use `zalo-mod` instead of `openclaw-zalo-mod` to match the package name published on ClawHub, resolving the "plugin not found" startup warning.
- **Fix: Zalo-mod Docker installation** — Added `zalo-mod` to the `allPlugins` array during Docker generation when Zalo Personal channel is selected, ensuring the plugin is downloaded during the image build process.
- **Fix: Unbuilt Setup Wizard UI** — Re-ran the build script (`build.mjs`) to properly package recent fixes into `dist/setup.js`, resolving an issue where downloaded `.bat` and `.sh` files from the Web Wizard were missing the newly added Zalo QR Login instructions.

## [5.7.1] — 2026-04-28

### Zalo QR Login Standardization & Workspace Integration

- **Improve: Standardize Zalo QR login across all platforms** — All deployment targets (Docker, Windows, macOS, Linux, VPS) now use a unified file-based QR login flow: the QR image is saved to `/tmp/openclaw/openclaw-zalouser-qr-default.png` and users retrieve it manually (Docker Desktop Files tab, `docker cp`, `scp`, or local file browser). Replaced the old terminal-based QR scanning guidance with step-by-step instructions per platform.
- **Improve: Docker login uses `docker exec` instead of `docker compose exec`** — CLI post-install instructions and download scripts now use `docker exec -it <container>` and `docker cp` directly, which is more reliable across Docker Compose versions.
- **Improve: Wizard download scripts auto-trigger Zalo login** — Both Windows (PowerShell) and Unix (bash) download scripts generated by the Wizard now automatically wait for the container to start and trigger the Zalo login command, eliminating the need for manual post-install steps.
- **Improve: VPS setup injects Zalo login before gateway start** — VPS installation scripts now include the Zalo login flow (via `generateZaloLoginSh()`) before PM2 starts the gateway, ensuring session is established on first deploy.
- **Improve: Workspace docs inject zalo-mod context** — `TOOLS.md` and `SOUL.md` now include Zalo mod plugin documentation (slash commands `/rules`, `/noi-quy`, `/menu`, `/groupid`, `/report` and media handling behavior) when `hasZaloMod` is true.
- **Fix: Windows BAT path escaping** — Fixed backslash escaping issues in `win-bat.js` that caused broken paths for `PROJECT_DIR`, `OPENCLAW_HOME`, `DATA_DIR`, and PowerShell gateway start scripts.
- **Fix: Zalo login script on VPS/Linux** — `zalo-login-gen.js` now directly runs the login command and provides file-based QR retrieval instructions instead of asking user to run a separate terminal command.
- **Chore: Sync ARCHITECTURE.md** — Added `bot-config-gen.js` documentation, `test-matrix.mjs`, updated `npm test` command, documented `hasZaloMod` workspace parameter, and Zalo QR Login Protocol section.

## [5.7.0] — 2026-04-27

### Centralized Config Architecture & Test Matrix

- **Refactor: Centralized bot-config-gen.js** — Migrated all `openclaw.json`, `.env`, and `exec-approvals.json` generation logic into a single shared module (`src/setup/shared/bot-config-gen.js`). Both the Web Wizard (IIFE) and CLI (CJS) now consume the same builder, eliminating configuration drift between the two surfaces.
- **Refactor: Rolling `@latest` versioning** — All installation scripts (Windows BAT, macOS/Linux/VPS SH) and configuration generators now use `openclaw@latest` instead of pinned version strings (e.g., `openclaw@2026.4.14`). The `lastTouchedVersion` field uses the `OPENCLAW_NPM_SPEC` constant for dynamic resolution.
- **Fix: Remove `autoReply` from Zalo Personal** — The `autoReply: true` field that caused gateway startup crashes has been permanently removed from all generators (`config-gen.js`, `cli.src.js`, `bot-config-gen.js`).
- **Fix: Standardize Zalo Personal config** — The `zalouser` channel now generates production-matching configuration with `groups`, `groupPolicy: 'allowlist'`, `historyLimit: 50`, proper `bindings`, and `zalo-mod` plugin pre-registration.
- **Fix: Gateway token generation** — All environments (Wizard + CLI) now use `crypto.randomUUID()` for gateway auth tokens, replacing the previous dummy token in CLI.
- **New: Comprehensive test matrix** — Added `test-matrix.mjs` with 422 tests covering all OS × Deploy Mode × Channel × Bot Count combinations, plus exec-approvals, .env generation, Wizard IIFE sandbox evaluation, CLI structural validation, and cross-channel production config integrity checks.
- **Chore: Cleaned up legacy test files** — Removed the standalone `test-vps-install.mjs` E2E test, now superseded by the matrix test suite.

## [5.6.14] — 2026-04-25

### Zalo Plugin Integration Cleanup

- **Improve: Zalo plugin config consistency** — Plugin registration in `config-gen.js` and `output.js` continues to pre-populate `plugins.entries['zalo-mod']` for Zalo Personal channels, ensuring seamless integration without requiring post-install patching.

## [5.6.13] — 2026-04-22

### Stabilize VPS/Native PM2 Deployment

- **Fix: Native environment variable initialization** — The Native PM2 startup process was refactored to use a dedicated bash wrapper (`start-gateway.sh`) instead of fragile inline `sh -c` commands. This ensures that critical environment variables like `OPENCLAW_HOME` and `OPENCLAW_STATE_DIR` are reliably available when the gateway boots, resolving silent failures and file-system pathing mismatches across shell restarts.
- **Fix: 9Router start scripts injection flaws** — Cleaned up PM2 commands to consistently use explicit script and binary executable flags (`--interpreter`) in multi-bot architectures to mitigate POSIX shell-injection issues.
- **Improve: Remote dashboard access** — The Gateway custom binding interface has been extended to default to `0.0.0.0` when deployed in `VPS/Ubuntu` scenarios. Dashboard configuration and proxy interfaces can now correctly handle WAN/SSH-tunnel connectivity without exposing desktop-native instances to LAN by default.

## [5.6.12] — 2026-04-22

### Hotfix: PM2 gateway process missing OPENCLAW_HOME environment

- **Fix: PM2 env forwarding** — VPS/Ubuntu PM2 gateway processes were silently failing because `OPENCLAW_HOME` and `OPENCLAW_STATE_DIR` were not forwarded to the child process. All PM2 gateway start commands (`vps-sh.js`, `install-gen.js` restart script) now use `sh -c "export OPENCLAW_HOME=... && openclaw gateway run"` to ensure the environment is correctly inherited.

## [5.6.11] — 2026-04-21

### Hotfix: Fix CLI crash on single-bot Telegram setup

- **Fix: `loopBotToken is not defined`** — The single-bot Telegram setup path was missing the `loopBotToken` variable declaration, causing `ReferenceError` immediately after config generation. Added the missing variable alongside `loopBotName`, `loopBotDesc`, and `loopBotPersona`.

## [5.6.10] — 2026-04-21

### Hotfix: 9Router Smart-Route Runtime Stability

- **Fix: smart-route null crash** — Reverted 9Router provider API from `openai-responses` back to `openai-completions`. When `smart-route` routes through non-Codex providers (Gemini, Claude, etc.), the Responses format conversion produces null output items, causing `Cannot read properties of null (reading 'type')` crashes. The completions format is universally supported across all providers.
- **Fix: smart-route sync missing from restart scripts** — The `start-bot.bat` and `start-bot.sh` restart scripts were not launching the `9router-smart-route-sync.js` background process. This meant that any provider enabled in the 9Router dashboard after initial setup (e.g., Gemini) would never be added to the `smart-route` combo. The sync script is now launched alongside 9Router on every restart.

## [5.6.9] - 2026-04-21

### Fix: OpenAI Codex Provider Compatibility & Zalo Personal Config

- **Fix: OpenAI Codex model list** — Updated Codex provider model registry to match OpenAI's current API. Removed deprecated models (`gpt-5.3-codex-high`, `gpt-5.2-codex`, `gpt-5.1-codex-max`, `gpt-5.1-codex`, `gpt-5.1`, `gpt-5-codex`) and retained the 4 active models: `gpt-5.4`, `gpt-5.3-codex`, `gpt-5.2`, `gpt-5.4-mini`.
- **Fix: 9Router API mode** — Switched 9Router provider config from `openai-completions` to `openai-responses` to align with OpenAI's current Responses API.
- **New: 9Router auto-patch script** — Added `patch-9router.js` that automatically patches 9Router source files (providerModels, codex executor, self-test) to stay compatible with OpenAI Codex API changes. The patch runs on setup, upgrade, and before every 9Router launch.
- **Fix: Codex model exposure** — 9Router config now exposes individual Codex models (`cx/gpt-5.4`, `cx/gpt-5.3-codex`, `cx/gpt-5.2`, `cx/gpt-5.4-mini`) alongside `smart-route` so users can target specific Codex models directly.
- **Improve: Zalo Personal channel config** — Added `defaultAccount`, `groupAllowFrom`, `historyLimit`, `groups` wildcard config and `autoReply` to the generated Zalo Personal channel configuration for more robust group handling out of the box.

## [5.6.8] - 2026-04-17

### Fix: 9Router Sync & Ubuntu Native Config

- **Fix: DATA_DIR mismatch on native Linux/Mac** — `resolveNative9RouterDesktopLaunch()` now passes `DATA_DIR: getNative9RouterDataDir()` to the PM2 process, ensuring 9router stores its database in `~/.9router/` (Linux) / `%APPDATA%/9router` (Windows), exactly where the sync script writes.
- **Fix: sync script dbPath** — `writeNative9RouterSyncScript()` now uses `getNative9RouterDataDir()` instead of `getProject9RouterDataDir()`, eliminating the mismatch where sync wrote to `projectDir/.9router/db.json` while 9router read from `~/.9router/db.json`.
- **Fix: openclaw.json home dir** — On native deploy, the CLI now also writes `openclaw.json` and `auth-profiles.json` to `~/.openclaw/` (home directory), because the openclaw binary on Linux reads from there, not from the project directory.
- **Fix: ecosystem.config.js OPENCLAW_HOME** — Added `OPENCLAW_HOME` and `OPENCLAW_STATE_DIR` env vars to the PM2 ecosystem config so multi-bot native setups correctly locate the project config.
- **Fix: MODEL_PRIORITY provider map** — Synced the PM2 sync script's `MODEL_PRIORITY` with the full map from `native-helpers-gen.js`, adding all 20+ providers (`codex`, `github`, `cursor`, `claude-code`, `iflow`, `kiro`, `kilo`, `gemini-cli`, `ollama`, etc.) that were missing.

## [5.6.6] - 2026-04-17

- Fix: PM2 sync script crash (SIGKILL) khi khoi dong 9router tren Ubuntu/VPS. Boc trong try-catch, them --no-autorestart.

## [5.6.4] - 2026-04-16

- NPM registry sync and version bump hotfix.

## [5.6.3] - 2026-04-16

- Updated post-installation guide prompt to clarify Telegram group setup instructions (continued).

## [5.6.2] - 2026-04-16

- Updated post-installation guide prompt to clarify Telegram group setup instructions.

## [5.6.1] - 2026-04-16

- Hotfix: Resolved ReferenceError modelsPrimary is not defined during CLI template generation.

## [5.6.0] � 2026-04-16

- Enabled `memory` and `memory-core` dreaming by default, added `DREAMS.md`, and improved Telegram relay UX/docs.
- Refined relay behavior in `TOOLS.md` and `TEAMS.md`, including explicit reaction-first guidance.
- Fixed Vietnamese workspace document generation to keep UTF-8 output stable.

## [5.5.0] � 2026-04-15

- Unified workspace document generation across Wizard and CLI through shared scaffold builders.
- Standardized generated docs around `AGENTS.md`, `TOOLS.md`, `MEMORY.md`, `TEAMS.md`, and browser docs.
- Updated the bundled OpenClaw target to `2026.4.14` and removed legacy `.yaml` agent output.

## [5.4.2] � 2026-04-14

- Fixed duplicate relay plugin installation in generated native setup scripts.

## [5.4.1] � 2026-04-14

- Restored Docker browser runtime support and fixed Docker control UI CORS handling.
- Added generated uninstall scripts for Docker and native setups.

## [5.4.0] � 2026-04-14

- Removed the `telegram+zalo-personal` combo channel from Wizard and CLI.
- Simplified multi-bot handling around a single `isMultiBot` flow and cleaned config generation.
- Standardized relative agent/workspace paths and strengthened cross-workspace rules in `AGENTS.md`.

## [5.3.5] � 2026-04-12

- Fixed workspace doc generation issues around `MEMORY.md`.
- Wrote uninstall scripts directly into generated project folders.

## [5.3.4] � 2026-04-12

- Improved Windows native gateway startup stability and per-agent workspace naming.
- Expanded generated `TOOLS.md` / `AGENTS.md` coverage for Zalo and Telegram workspaces.

## [5.3.3] � 2026-04-11

- Added generated uninstall scripts to the Wizard download flow.

## [5.3.2] � 2026-04-11

- Stabilized native 9Router startup for desktop installs and pre-seeded project-local 9Router data.

## [5.3.1] � 2026-04-10

- Switched Zalo Personal direct-message policy to `open` by default.

## [5.3.0] � 2026-04-11

- Added the first Telegram + Zalo Personal combo-channel flow.
- Auto-enabled the Zalo Personal plugin and improved Docker cold-start behavior.

## [5.2.4] � 2026-04-10

- Improved upgrade speed by reusing Docker cache where possible.
- Added tooling to watch for upstream OpenClaw updates.

## [5.2.3] � 2026-04-10

- Fixed multi-bot wizard validation/state bugs.
- Improved blocked-button feedback and script encoding safety.

## [5.2.2] � 2026-04-10

- Fixed Docker gateway binding/CORS issues and reduced unnecessary Docker rebuilds.
- Corrected native PM2 path handling for project-local `.openclaw`.

## [5.2.1] � 2026-04-09

- Fixed native Ubuntu/VPS installation issues for PM2, 9Router, runtime packages, and project-local paths.
- Improved Zalo Personal login guidance and credential directory handling.

## [5.2.0] � 2026-04-09

- Added one-command upgrade flows through CLI, `upgrade.ps1`, and `upgrade.sh`.
- Preserved user data while refreshing OpenClaw and helper artifacts.

## [5.1.15] � 2026-04-08

- Brought Windows/native generation closer to Docker behavior.
- Fixed project-local runtime paths, provider sync, browser install flow, and related smoke coverage.

## [5.1.14] � 2026-04-08

- Pinned OpenClaw back to a stable release and fixed Windows Docker generation issues.
- Added Node.js version guidance for better compatibility.

## [5.1.13] � 2026-04-08

- Fixed macOS setup script generation, Docker startup flow, and native npm install behavior.
- Resolved Wizard state bugs affecting persona editing and step navigation.

## [5.1.12] � 2026-04-07

- Expanded the built-in skill catalog and improved relay plugin auto-selection in multi-bot mode.
- Updated Zalo Personal defaults and several Wizard validation gaps.

## [5.1.11] � 2026-04-07

- Updated Zalo Personal DM behavior and related onboarding defaults.

## [5.1.10] � 2026-04-07

- Added native auto-approve support for Zalo device/login flows on VPS.

## [5.1.9] � 2026-04-07

- Restored stricter schema handling and improved WebCrypto-related UX.

## [5.1.8] � 2026-04-07

- Fixed VPS dashboard connectivity and token login issues.

## [5.1.7] � 2026-04-07

- Fixed Control UI CORS handling and native 9Router path resolution.

## [5.1.6] � 2026-04-07

- Fixed PM2 `SIGKILL` failures during native VPS setup.

## [5.1.5] � 2026-04-06

- Fixed native PM2 startup for 9Router.

## [5.1.4] � 2026-04-06

- Fixed CLI BOM startup issues and improved Docker timeout patching.

## [5.1.3] � 2026-04-06

- Fixed Docker Compose variable interpolation leaks.

## [5.1.2] � 2026-04-06

- Hardened the sync script against shell-injection issues by switching to Base64 transport.

## [5.1.1] � 2026-04-06

- Stabilized 9Router smart-route sync through the provider API.
- Added Zalo pairing auto-approve and cleaner Docker CLI output.

## [5.1.0] � 2026-04-07

- Improved the Zalo Personal login flow and QR handling.

## [5.0.9] � 2026-04-06

- Introduced native install mode without requiring Docker.
- Added Gemma 4 updates, Telegram multi-bot deployment, and UI/setup refinements.

## [5.0.0] � 2026-04-04

- Added Gemma 4 support and documented hardware expectations.

## [4.1.4] � 2026-04-03

- General stability and usability improvements.

## [4.1.3] � 2026-04-02

- General stability and usability improvements.

## [4.1.2] � 2026-04-01

- Fixed issues in the v4.1 line.

## [4.1.0] � 2026-04-01

- Stabilized 9Router smart routing.

## [4.0.9] � 2026-04-01

- Added dynamic smart-route syncing and Docker auto-install flow.

## [4.0.8] � 2026-03-31

- Improved 9Router stability, Ollama cloud support, and cross-platform setup cleanup.

## [4.0.1] � 2026-03-31

- Improved automation around install directory creation and npm CLI flow.

## [4.0.0] � 2026-03-30

- Shipped the main v4 feature and setup refresh.

## [3.0.2] � 2026-03-29

- Expanded 9Router smart proxy support.

## [3.0.1] � 2026-03-29

- Delivered follow-up feature, bug-fix, UI, and technical updates for v3.

## [3.0.0] � 2026-03-28

- Introduced the v3 generation flow, UI refresh, documentation update, and technical cleanup.

## [2.0.0] � 2026-03-27

- Introduced the v2 setup experience with design, documentation, and security improvements.

## [1.0.0] � 2026-03-26

- Initial release.
