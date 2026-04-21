# Changelog (English)

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
