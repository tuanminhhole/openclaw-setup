// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * @fileoverview Part of the OpenClaw Setup Wizard IIFE bundle.
 * This file is concatenated (not imported) - globals are shared via setup.js IIFE scope.
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
        { textVi: 'Vào <a href="https://bot.zaloplatforms.com" target="_blank">bot.zaloplatforms.com</a> → <strong>Bot → Add Bot</strong> → copy Bot Token (dạng <code>&lt;id&gt;:&lt;secret&gt;</code>).', textEn: 'Go to <a href="https://bot.zaloplatforms.com" target="_blank">bot.zaloplatforms.com</a> → <strong>Bot → Add Bot</strong> → copy the Bot Token (format <code>&lt;id&gt;:&lt;secret&gt;</code>).' },
        { textVi: 'Kiểm token còn sống: <code>curl https://bot-api.zaloplatforms.com/bot&lt;token&gt;/getMe</code>. Kết quả có <code>can_join_groups</code> cho biết bot được phép vào nhóm hay không.', textEn: 'Verify the token: <code>curl https://bot-api.zaloplatforms.com/bot&lt;token&gt;/getMe</code>. The <code>can_join_groups</code> field tells you whether this bot may join groups.' },
        { textVi: 'Kênh này chạy <strong>long-polling, KHÔNG cần webhook public</strong>. Đây là bot chính chủ của Zalo, khác Zalo cá nhân (zca-js) và khác Zalo OA đời cũ.', textEn: 'This channel runs <strong>long-polling, no public webhook needed</strong>. It is Zalo\'s own bot platform, different from personal Zalo (zca-js) and from the legacy Zalo OA.' },
        { textVi: 'Thêm bot vào nhóm: mở mini app <strong>Zalo Bot Creator</strong> → chọn bot → mục <strong>"Mời Bot vào nhóm"</strong> → gửi link vào nhóm → <strong>trưởng nhóm</strong> bấm link và Xác nhận. Tìm tên bot trong danh sách thành viên sẽ không ra.', textEn: 'Add the bot to a group: open the <strong>Zalo Bot Creator</strong> mini app → pick the bot → <strong>"Invite Bot to group"</strong> → send the link into the group → the <strong>group owner</strong> taps it and confirms. Searching the member list for the bot will never find it.' },
        { textVi: 'Trong nhóm bot chỉ nghe khi được <strong>@mention</strong> hoặc khi có người <strong>Trả lời</strong> tin của bot - luật của Zalo lẫn OpenClaw, không tắt được.', textEn: 'In groups the bot only reacts to an <strong>@mention</strong> or a <strong>reply</strong> to one of its messages - enforced by both Zalo and OpenClaw, not configurable.' },
      ],
      channelConfig: {
        zalo: {
          enabled: true,
        },
      },
      pluginInstall: '',
    },
    // 'telegram+zalo-personal' - Combo mode tạm ngưng, nghiên cứu thêm.
    'zalo-personal': {
      name: 'Zalo cá nhân - OpenClaw Zalo Connect',
      hasZaloPersonal: true,
      envKeys: [],
      envExtra: '',
      credSteps: [
        { textVi: '⚠️ Zalo cá nhân chạy qua <strong>OpenClaw Zalo Connect (unofficial, zca-js)</strong> - tự động hoá tài khoản cá nhân có thể vi phạm điều khoản Zalo và khiến tài khoản bị hạn chế. <strong>Chỉ nên dùng tài khoản phụ.</strong>', textEn: '⚠️ Personal Zalo runs on <strong>OpenClaw Zalo Connect (unofficial, zca-js)</strong> - automating a personal account may violate Zalo terms and can get the account restricted. <strong>Use a secondary account.</strong>' },
        { textVi: 'Sau khi tạo bot, bấm <strong>Đăng nhập Zalo</strong> để quét QR ngay trong giao diện. Nếu cần chạy thủ công: <code>openclaw channels login --channel zalo-connect --account default</code>.', textEn: 'After creating the bot, click <strong>Zalo Login</strong> to scan the QR right in the UI. Manual fallback: <code>openclaw channels login --channel zalo-connect --account default</code>.' },
        { textVi: 'Sau khi quét QR, bot nhận được tin nhắn xác nhận Owner ngay; bạn có thể siết lại DM/nhóm sau trong cấu hình.', textEn: 'After QR login, the bot can receive the initial Owner confirmation immediately; you can tighten DM/group access later in config.' },
      ],
      // Mirrors buildZaloConnectChannelConfig() in bot-config-gen.js - keys validated
      // against OpenClaw Zalo Connect 3.0.1's strict channel schema.
      channelConfig: {
        'zalo-connect': {
          enabled: true,
          defaultAccount: 'default',
          accounts: {
            default: { enabled: true },
          },
          dmPolicy: 'open',
          allowFrom: ['*'],
          groupPolicy: 'allowlist',
          groups: {
            '*': { enabled: true, requireMention: false },
          },
        },
      },
      pluginInstall: '',
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
    vi: `## 🔐 Quy Tắc Bảo Mật - BẮT BUỘC

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
    en: `## 🔐 Security Rules - MANDATORY

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
