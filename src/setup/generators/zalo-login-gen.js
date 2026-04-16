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
// ── setup/generators/zalo-login-gen.js ──────────────────────────────────────
// Shared Zalo Personal login block generator.
// Replaces 3 separate OS-specific implementations in the monolithic setup.js.
//
// Usage:
//   const lines = generateZaloLoginBat({ homeVar, projectDirVar, label });
//   const sh    = generateZaloLoginSh({ homeVar, projectDirVar, label });

/**
 * Generate Windows .bat Zalo login block with idempotency check.
 *
 * @param {object} opts
 * @param {string} opts.homeVar        - BAT var for OPENCLAW_HOME  e.g. '%OPENCLAW_HOME%'
 * @param {string} opts.projectDirVar  - BAT var for project dir    e.g. '%PROJECT_DIR%'
 * @param {string} opts.label          - Unique BAT label suffix (avoid duplicate labels)
 *                                       e.g. 'win', 'multi', 'combo'
 * @param {boolean} [opts.useInstance] - Use --instance default flag (for multi-bot flows)
 * @returns {string[]} Lines to push into the bat script
 */
function generateZaloLoginBat(opts) {
  const { homeVar, projectDirVar, label = 'default', useInstance = false } = opts;
  const credPath = `${homeVar}\\credentials\\zalouser\\credentials.json`;
  const loginCmd = useInstance
    ? 'openclaw channels login --channel zalouser --instance default --verbose'
    : 'openclaw channels login --channel zalouser --verbose';
  const contLabel = `:zalo_continue_${label}`;
  const retryLabel = `:retry_zalo_${label}`;

  return [
    `echo [Zalo] Kiem tra session da luu...`,
    `if exist "${credPath}" (`,
    `  echo [OK] Session Zalo da ton tai. Bo qua buoc dang nhap.`,
    `  goto ${contLabel}`,
    `)`,
    `echo [Zalo] Chua co session. Bat dau dang nhap...`,
    retryLabel,
    `call ${loginCmd}`,
    `echo.`,
    `set "ZALO_QR_TMP=%TEMP%\\openclaw\\openclaw-zalouser-qr${useInstance ? '-default' : ''}.png"`,
    `if exist "%ZALO_QR_TMP%" (`,
    `  copy /y "%ZALO_QR_TMP%" "${projectDirVar}\\zalo-login-qr.png" >nul`,
    `  echo ===================================================`,
    `  echo Ma QR Zalo da duoc luu tai:`,
    `  echo   ${projectDirVar}\\zalo-login-qr.png`,
    `  echo Mo file anh tren r dung Zalo quet de dang nhap!`,
    `  echo ===================================================`,
    `  start "" "${projectDirVar}\\zalo-login-qr.png"`,
    `) else (`,
    `  echo Khong tim thay file QR.`,
    `)`,
    `echo.`,
    `set /p "ZALO_RETRY=[Zalo] Nhap R de quet lai QR, hoac phim bat ky de tiep tuc: "`,
    `if /i "%ZALO_RETRY%"=="R" goto ${retryLabel}`,
    contLabel,
  ];
}

/**
 * Generate bash (.sh) Zalo login guidance block with idempotency check.
 * On Linux/macOS native, the login must be run manually (no auto-open PNG).
 *
 * @param {object} opts
 * @param {string} opts.homeVar       - Shell var for OPENCLAW_HOME  e.g. '$OPENCLAW_HOME'
 * @param {string} opts.projectDirVar - Shell var for project dir    e.g. '$PROJECT_DIR'
 * @param {boolean} [opts.useInstance] - Use --instance default flag
 * @returns {string[]} Lines to push into the sh script
 */
function generateZaloLoginSh(opts) {
  const { homeVar, projectDirVar, useInstance = false } = opts;
  const credPath = `${homeVar}/credentials/zalouser/credentials.json`;
  const loginCmd = useInstance
    ? 'openclaw channels login --channel zalouser --instance default --verbose'
    : 'openclaw channels login --channel zalouser --verbose';

  return [
    `# ── Zalo Personal Login (idempotent) ─────────────────────────────────`,
    `if [ -f "${credPath}" ]; then`,
    `  echo "[OK] Session Zalo da ton tai. Bo qua buoc dang nhap."`,
    `else`,
    `  echo "[Zalo] Chua co session. Chay lenh sau trong terminal khac:"`,
    `  echo "  ${loginCmd}"`,
    `  echo ""`,
    `  echo "  QR code se xuat hien trong terminal do."`,
    `  echo "  Sau khi quet QR thanh cong, nhay Enter de tiep tuc."`,
    `  read -p "Nhan Enter sau khi dang nhap Zalo thanh cong... "`,
    `fi`,
  ];
}
