# OpenClaw Setup - Technical Architecture

> Internal reference for the current code in `openclaw-setup`.
> Source of truth is `src/`; `dist/` is generated output.

## Overview

`openclaw-setup` generates project scaffolding, runtime config, and helper workspace docs for OpenClaw.
It exposes a single unified interface:

| Surface | Entry | Role |
| --- | --- | --- |
| Local Web Installer / Dashboard | `src/cli/cli.src.js` -> `dist/cli.js` + `src/server/` + `src/web/` | Default `npx` flow: starts localhost UI, runs install/config APIs, syncs workspaces, and displays dynamic system dashboards |

All actions consume metadata from `src/setup/data/` and reusable configuration/workspace generators from `src/setup/shared/`.

## Support Matrix

| Area | Supported values |
| --- | --- |
| Deploy mode | `docker`, `native` |
| Native OS | `win`, `macos`, `linux-desktop`, `vps` |
| Channel | `telegram`, `zalo-bot`, `zalo-personal` |
| Multi-bot | Telegram and Zalo Personal (multi-profile) |
| Local provider | `ollama` |
| Proxy provider | `9router` |
| Browser automation | Managed as a plugin, dynamically toggled via dashboard |
| Scheduler / cron | Native tool path, selected via `scheduler` skill card (generates `skills/cronjob/SKILL.md`) |
| Image Generation | Selected via `image-gen` skill card (generates `skills/infographic-generator/`) |
| Web Search | Selected via `web-search` skill card (enables `duckduckgo` plugin) |

Important notes:
- `scheduler` is not in `skills.entries`; it unlocks native tool permissions and writes custom workspace guide files.
- `browser` is also treated as a native capability instead of an external skill slug (delegated to the separate `browser-automation` plugin).
- Generated Docker gateway port is standardized to `18789`.
- Generated OpenClaw package spec is `openclaw@latest`.

## Repository Layout

```text
openclaw-setup/
|-- README.md
|-- README.vi.md
|-- package.json
|-- docs_dev/
|   |-- ARCHITECTURE.md
|   |-- DESIGN.md
|   `-- tests/
|       |-- build.mjs
|       |-- smoke-cli-logic.mjs
|       |-- test-generation.mjs
|       `-- test-matrix.mjs
|-- dist/
|   |-- cli.js
|   |-- server/
|   |-- web/
|   `-- setup/
|       |-- data/
|       `-- shared/
`-- src/
    |-- cli/
    |   `-- cli.src.js
    |-- server/
    |   `-- local-server.js
    |-- web/
    |   |-- index.html
    |   |-- styles.css
    |   `-- app.js
    `-- setup/
        |-- data/
        `-- shared/
```

## Build Pipeline

`docs_dev/tests/build.mjs` owns the build flow. It does not perform IIFE bundling anymore.

### Build Actions
- Copies `src/setup/data/` and `src/setup/shared/` into `dist/setup/`.
- Copies `src/server/` and `src/web/` into `dist/`.
- Copies `src/cli/cli.src.js` to `dist/cli.js` as the default local web launcher.
- Rewrites shared-module import paths in `dist/cli.js` for distribution runtime.

### Commands
- `npm run build` -> builds and deploys `dist/` artifacts
- `npm run dev` -> build/watch mode (rebuilds when files in `src/` change)
- `npm test` -> smoke-cli-logic + test-generation + test-matrix suites

## Shared Module Pattern

Files in `src/setup/shared/` are ES modules imported directly by the CLI launcher and local server via Node `createRequire` and runtime shims.

Key shared modules:
- `common-gen.js`: Shared runtime constants, version specs (`OPENCLAW_NPM_SPEC = openclaw@latest`), and 9Router proxy configurations.
- `bot-config-gen.js`: Builds `openclaw.json`, `.env`, and `exec-approvals.json`.
- `workspace-gen.js`: Builds markdown workspace files (`IDENTITY.md`, `SOUL.md`, `AGENTS.md`, `USER.md`, `TOOLS.md`, `MEMORY.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `DREAMS.md`, `TEAMS.md`) and custom skill files.
- `docker-gen.js`: Generates Dockerfiles, compose specs, and container entrypoint scripts.

## Data Registries

### `src/setup/data/providers.js`
Defines provider metadata used by the dashboard:
- `9router`, `openai`, `google`, `anthropic`, `openrouter`, `ollama`, `xai`, `groq`

### `src/setup/data/channels.js`
Defines channel templates for:
- `telegram`
- `zalo-bot`
- `zalo-personal`

### `src/setup/data/skills.js`
Defines capability cards:
- `scheduler` (native cron tool helper)
- `memory` (dreaming consolidation)
- `image-gen` (infographic generator)
- `web-search` (DuckDuckGo search)
- `rag`, `code-interpreter`, `email`, `tts`

### `src/setup/data/plugins.js`
Defines core system plugins.

## Core Generators Detail

### `src/setup/shared/bot-config-gen.js`
Primary config generator:
- `commands.native = 'auto'`, `commands.nativeSkills = 'auto'`, `commands.restart = true`
- `tools.profile = 'full'`, `tools.exec = { host: 'gateway', security: 'full', ask: 'off' }`
- If `scheduler` is selected:
  - `commands.ownerAllowFrom = ['*']`
  - `tools.alsoAllow = ['group:automation']`
- If `web-search` is selected:
  - configures `"duckduckgo": { "enabled": true }` in `plugins.entries`
  - appends `"duckduckgo"` to `plugins.allow`
- If Zalo Personal channel is configured:
  - adds `bindings` to map agent IDs to `zalouser` channel accounts
  - handles multiple profile bindings cleanly

### `src/setup/shared/workspace-gen.js`
Generates workspace files:
- `TOOLS.md` is kept extremely concise, delegating details to the `./skills/` directory.
- If `hasScheduler` is true, generates `skills/cronjob/SKILL.md`.
- If `hasImageGen` is true, generates `skills/infographic-generator/SKILL.md` (prompts, style guides, font rules, footer requirements) and `skills/infographic-generator/image-generator.js` (9Router image generation API script).

### `src/setup/shared/docker-gen.js`
Generates Docker configurations:
- Custom entrypoint.sh script handles runtime patch syncs, auto-enabling `allowPrivateNetwork` on 9Router, and upgrading paired-device scopes.

## Local Installer & Dashboard Architecture

Main files: `src/cli/cli.src.js`, `src/server/local-server.js`, `src/web/`

- **Port Strategy**: Dynamic port assignment starting from `51789`.
- **System APIs**: Handles workspace syncing, bot creation/deletion, logs streaming via SSE, and dynamic feature toggles.
- **Docker Path Resolution**: Automatically rewrites `/root/project` to `/home/node/project` when executing commands inside Linux Docker environments to ensure correct permissions and file locations.
- **Zalo Personal Multi-Account**:
  - Toggles profile names for multiple logged-in accounts.
  - Isolates credentials by naming files `credentials-<profile>.json` (default profile uses `credentials.json`).
  - Implements login QR code generation and polling via `openclaw channels login --channel zalouser --account <profile>`.

## Testing

- **`smoke-cli-logic.mjs`**: Asserts compiled CLI and server file integrity.
- **`test-generation.mjs`**: Integration tests verifying workspace file mapping, Dockerfile/compose parameters, and 9Router proxy response patching scripts.
- **`test-matrix.mjs`**: Comprehensive configuration matrix tests validating combination options of OS, deploy mode, channel, and bot-count.

## Release & Update Workflow

When updating/releasing a new version, follow these steps:
1. Update any relevant code under `src/`.
2. Update technical architecture docs (`docs_dev/ARCHITECTURE.md`, `README.md`, `README.vi.md`) if necessary to match the actual code implementation.
3. Edit `docs_dev/tests/bump-version.mjs` to customize the `changelogEntryEn` and `changelogEntryVi` variables with the exact details of the changes in this version.
4. Run `npm run bump <new-version>` (e.g., `npm run bump 5.8.9`). This script will:
   - Read current version from `package.json`.
   - Update `package.json` to the new version.
   - Sync `package-lock.json`.
   - Replace version string in all `README.md` and `README.vi.md` files.
   - Prepend the custom changelog entries to `CHANGELOG.md` and `CHANGELOG.vi.md`.
5. Verify changes, then run `npm test` to make sure all tests pass.
6. Commit changes with message pattern: `chore: bump to v<new-version> & <short description of changes>`.
7. Push to remote: `git push && git push --tags` (make sure to tag: `git tag v<new-version>`).
8. Create a GitHub Release using the version and changelog content of the latest version.
9. Remind the user to run `npm publish` themselves when they are ready.
