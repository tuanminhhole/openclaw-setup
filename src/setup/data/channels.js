// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * @fileoverview Part of the OpenClaw Setup Wizard IIFE bundle.
 * This file is concatenated (not imported) — globals are shared via setup.js IIFE scope.
 * Do NOT add import/export statements. Edit, then run: node build.mjs
 *
 * @global {object}  state       - Wizard UI state
 * @global {object}  PROVIDERS   - AI provider registry
 * @global {Array}   SKILLS      - Available skills
 * @global {Array}   PLUGINS     - Available plugins
 * @global {object}  CHANNELS    - Channel definitions
 * @global {boolean} isVi        - Vietnamese language mode
 * @global {object}  provider    - Current primary provider config
 * @global {boolean} isMultiBot  - Multi-bot mode flag
 * @global {boolean} hasBrowser  - Browser plugin selected
 * @global {boolean} is9Router   - 9Router proxy mode
 * @global {string}  projectDir  - Output project directory path
 * @global {Function} getGatewayAllowedOrigins
 */
  // ========== Channel definitions ==========
  const CHANNELS = {
    telegram: {
      name: 'Telegram',
      envKeys: [],
      envExtra: 'TELEGRAM_BOT_TOKEN=<your_bot_token>',
      credSteps: [
        { textVi: 'Mở Telegram → tìm <a href="https://t.me/BotFather" target="_blank">@BotFather</a> → gửi <code>/newbot</code> → đặt tên bot → copy token', textEn: 'Open Telegram → find <a href="https://t.me/BotFather" target="_blank">@BotFather</a> → send <code>/newbot</code> → name bot → copy token' },
      ],
      channelConfig: {
        telegram: {
          enabled: true,
          dmPolicy: 'open',
          allowFrom: ['*'],
          groupPolicy: 'allowlist',
          streaming: 'partial',
        },
      },
      pluginInstall: '',
    },
    'zalo-bot': {
      name: 'Zalo Bot API',
      envKeys: [],
      envExtra: 'ZALO_BOT_TOKEN=<your_zalo_bot_token>',
      credSteps: [
        { textVi: '<span style="color: #fbbf24; font-weight: 500;">⚠️ LƯU Ý: Bot OA Zalo đòi hỏi bạn phải thiết lập Webhook Public (qua VPS/ngrok có HTTPS). Hãy cân nhắc dùng Zalo Personal nếu bạn chưa có Webhook.</span>', textEn: '<span style="color: #fbbf24; font-weight: 500;">⚠️ NOTE: Zalo OA Bot requires setting up a Public Webhook (using VPS/ngrok with HTTPS). Consider using Zalo Personal if you do not have a webhook.</span>' },
        { textVi: 'Vào <a href="https://developers.zalo.me" target="_blank">Zalo Bot Platform</a> → Tạo bot mới → copy Bot Token', textEn: 'Go to <a href="https://developers.zalo.me" target="_blank">Zalo Bot Platform</a> → Create new bot → copy Bot Token' },
      ],
      channelConfig: {
        zalo: {
          enabled: true,
        },
      },
      pluginInstall: '',
    },
    // 'telegram+zalo-personal' — Combo mode tạm ngưng, nghiên cứu thêm.
    'zalo-personal': {
      name: 'Zalo Personal',
      hasZaloPersonal: true,
      envKeys: [],
      envExtra: '',
      credSteps: [
        { textVi: '⚠️ Zalo Personal dùng <strong>unofficial API (zca-js)</strong> — chỉ nên dùng tài khoản phụ', textEn: '⚠️ Zalo Personal uses <strong>unofficial API (zca-js)</strong> — use an alternate account' },
        { textVi: 'Native setup sẽ tự chạy login và copy QR về thư mục project. Nếu cần chạy lại thủ công, dùng <code>openclaw channels login --channel zalouser --verbose</code>.', textEn: 'Native setup now auto-runs the login flow and copies the QR into the project folder. If needed, rerun it manually with <code>openclaw channels login --channel zalouser --verbose</code>.' },
      ],
      channelConfig: {
        zalouser: {
          enabled: true,
          defaultAccount: 'default',
          accounts: {
            default: {
              dmPolicy: 'open',
              allowFrom: ['*'],
              groupPolicy: 'allowlist',
              groupAllowFrom: ['*'],
            },
          },
          dmPolicy: 'open',
          allowFrom: ['*'],
          groupPolicy: 'allowlist',
          groupAllowFrom: ['*'],
          historyLimit: 50,
        },
      },
      pluginInstall: '@openclaw/zalouser',
    },
  };

  // ========== Default system prompts ==========
  const DEFAULT_PROMPTS = {
    vi: `Bạn là {BOT_NAME}, {BOT_DESC}.

## Tính cách
- Thân thiện, hữu ích
- Trả lời bằng tiếng Việt
- Giọng văn tự nhiên, gần gũi

## Quy tắc
- Trả lời ngắn gọn, súc tích
- Hỏi lại khi chưa rõ yêu cầu`,
    en: `You are {BOT_NAME}, {BOT_DESC}.

## Personality
- Friendly and helpful
- Reply in English
- Natural, conversational tone

## Rules
- Keep answers concise
- Ask for clarification when needed`,
  };

  // ========== Default Security Rules ==========
  const DEFAULT_SECURITY_RULES = {
    vi: `## 🔐 Quy Tắc Bảo Mật — BẮT BUỘC

### File & thư mục hệ thống
- ❌ KHÔNG đọc, sao chép, hoặc truy cập bất kỳ file nào ngoài thư mục project
- ❌ KHÔNG quét hoặc liệt kê các thư mục hệ thống: Documents, Desktop, Downloads, AppData
- ❌ KHÔNG truy cập registry, system32, hoặc Program Files
- ❌ KHÔNG cài đặt phần mềm, driver, hoặc service ngoài Docker
- ✅ CHỈ làm việc trong thư mục project

### API key & credentials
- ❌ KHÔNG BAO GIỜ hiển thị API key, token, hoặc mật khẩu trong chat
- ❌ KHÔNG viết API key trực tiếp vào mã nguồn
- ❌ KHÔNG commit file credentials lên Git
- ✅ LUÔN lưu credentials trong file .env riêng
- ✅ LUÔN dùng biến môi trường thay vì hardcode

### Ví crypto & tài sản số
- ❌ TUYỆT ĐỐI KHÔNG truy cập, đọc, hoặc quét các thư mục ví crypto
- ❌ KHÔNG quét clipboard (có thể chứa seed phrases)
- ❌ KHÔNG truy cập browser profile, cookie, hoặc mật khẩu đã lưu
- ❌ KHÔNG cài đặt npm package lạ (chỉ openclaw và plugin chính thức)

### Docker
- ✅ Chỉ mount đúng thư mục cần thiết (config + workspace)
- ❌ KHÔNG mount nguyên ổ đĩa (C:/ hoặc D:/)
- ❌ KHÔNG chạy container với --privileged
- ✅ Giới hạn port expose (chỉ 38789)`,
    en: `## 🔐 Security Rules — MANDATORY

### System files & directories
- ❌ DO NOT read, copy, or access any file outside the project folder
- ❌ DO NOT scan or list system directories: Documents, Desktop, Downloads, AppData
- ❌ DO NOT access the registry, system32, or Program Files
- ❌ DO NOT install software, drivers, or services outside Docker
- ✅ ONLY work within the project folder

### API keys & credentials
- ❌ NEVER display API keys, tokens, or passwords in chat
- ❌ DO NOT write API keys directly into source code
- ❌ DO NOT commit credential files to Git
- ✅ ALWAYS store credentials in a separate .env file
- ✅ ALWAYS use environment variables instead of hardcoding

### Crypto wallets & digital assets
- ❌ ABSOLUTELY DO NOT access, read, or scan crypto wallet directories
- ❌ DO NOT scan the clipboard (may contain seed phrases)
- ❌ DO NOT access browser profiles, cookies, or saved passwords
- ❌ DO NOT install unknown npm packages (only openclaw and official plugins)

### Docker
- ✅ Only mount required directories (config + workspace)
- ❌ DO NOT mount entire drives (C:/ or D:/)
- ❌ DO NOT run containers with --privileged
- ✅ Limit exposed ports (only 38789)`,
  };
