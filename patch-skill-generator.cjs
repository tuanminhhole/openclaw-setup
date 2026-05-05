/**
 * Patch openclaw-zalo-mod index.js:
 * 1. Bump SKILL.md version from 1.0.0 to 1.2.0
 * 2. Inject slash commands table after the current SKILL.md content
 * 3. Bump package.json version to 2.4.3
 * 4. Bump @version header comment
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.resolve('D:/openclaw-zalo-mod/index.js');
const pkgPath   = path.resolve('D:/openclaw-zalo-mod/package.json');

// ── 1. Patch package.json ─────────────────────────────────────
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVer = pkg.version;
pkg.version = '2.4.3';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`[pkg] ${oldVer} → 2.4.3`);

// ── 2. Patch index.js ─────────────────────────────────────────
let src = fs.readFileSync(indexPath, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';

// 2a. Bump SKILL.md version in generator
src = src.replace("'version: 1.0.0',", "'version: 1.2.0',");
console.log('[index] skill version bumped to 1.2.0');

// 2b. Bump @version comment header
src = src.replace(' * @version 1.2.0', ' * @version 2.4.3');
console.log('[index] @version bumped to 2.4.3');

// 2c. Find the closing of skillContent array and inject commands section before it
const MARKER_START = "'Format: `| YYYY-MM-DD HH:MM | {tên user} | {tóm tắt 1 dòng} |`',";
const MARKER_END   = "          ].join('\\n');";

const si = src.indexOf(MARKER_START);
const ei = src.indexOf(MARKER_END, si);

if (si === -1 || ei === -1) {
  console.error('[ERROR] Could not find skill generator section markers');
  console.error('  MARKER_START found:', si !== -1);
  console.error('  MARKER_END found:', ei !== -1);
  process.exit(1);
}

// Check if commands section already injected
if (src.slice(si, ei).includes('DANH SÁCH SLASH COMMANDS')) {
  console.log('[index] commands section already injected, skipping content injection');
} else {
  // Build the injection lines using the raw string (cmdPrefix will be a JS template literal at runtime)
  const injection = [
    "            '',",
    "            '---',",
    "            '',",
    "            '## 📋 DANH SÁCH SLASH COMMANDS ĐẦY ĐỦ',",
    "            '',",
    "            '> Tất cả commands xử lý bởi plugin `zalo-mod` — bot KHÔNG cần reply.',",
    "            `> Prefix lệnh: \\`${cmdPrefix}\\` (theo tên bot)`,",
    "            '',",
    "            '### 👤 Mọi người (trong group)',",
    "            '',",
    "            '| Command | Mô tả |',",
    "            '|---------|-------|',",
    "            `| \\`${cmdPrefix}noi-quy\\` | Xem nội quy nhóm |`,",
    "            `| \\`${cmdPrefix}menu\\` | Danh sách lệnh |`,",
    "            `| \\`${cmdPrefix}huong-dan\\` | Hướng dẫn sử dụng bot |`,",
    "            '',",
    "            '### 🔧 Admin (trong group)',",
    "            '',",
    "            '| Command | Mô tả |',",
    "            '|---------|-------|',",
    "            `| \\`${cmdPrefix}mute\\` | Tắt bot hoàn toàn |`,",
    "            `| \\`${cmdPrefix}unmute\\` / \\`${cmdPrefix}bat-bot\\` | Bật lại bot |`,",
    "            `| \\`${cmdPrefix}warn @name [lý do]\\` | Cảnh cáo member |`,",
    "            `| \\`${cmdPrefix}note [text]\\` | Ghi chú admin |`,",
    "            `| \\`${cmdPrefix}report\\` | Báo cáo vi phạm + warn |`,",
    "            `| \\`${cmdPrefix}memory [note]\\` | Lưu memory digest |`,",
    "            '',",
    "            '### 👑 Owner — trong group',",
    "            '',",
    "            '| Command | Mô tả |',",
    "            '|---------|-------|',",
    "            `| \\`${cmdPrefix}rules\\` | Xem panel sub-lệnh |`,",
    "            `| \\`${cmdPrefix}rules status\\` | Cấu hình group hiện tại |`,",
    "            `| \\`${cmdPrefix}rules groupid\\` | Thêm group này vào config |`,",
    "            `| \\`${cmdPrefix}rules silent-on\\` | Bật silent (chỉ reply khi @tag) |`,",
    "            `| \\`${cmdPrefix}rules silent-off\\` | Tắt silent mode |`,",
    "            `| \\`${cmdPrefix}rules welcome-on\\` | Bật chào member mới |`,",
    "            `| \\`${cmdPrefix}rules welcome-off\\` | Tắt chào member mới |`,",
    "            `| \\`${cmdPrefix}rules tracking-on\\` | Bật ghi lịch sử chat |`,",
    "            `| \\`${cmdPrefix}rules tracking-off\\` | Tắt ghi lịch sử chat |`,",
    "            '',",
    "            '### 🔐 Owner — qua DM',",
    "            '',",
    "            '| Command | Mô tả |',",
    "            '|---------|-------|',",
    "            `| \\`${cmdPrefix}rules mute-list\\` | Trạng thái mute tất cả groups |`,",
    "            `| \\`${cmdPrefix}rules mute <groupId> on/off\\` | Mute/unmute group cụ thể |`,",
    "            `| \\`${cmdPrefix}rules mute all on/off\\` | Mute/unmute tất cả |`,",
    "            `| \\`${cmdPrefix}rules silent-list\\` | Trạng thái silent tất cả groups |`,",
    "            `| \\`${cmdPrefix}rules silent <groupId> on/off\\` | Silent group cụ thể |`,",
    "            `| \\`${cmdPrefix}rules silent all on/off\\` | Silent tất cả |`,",
    "            `| \\`${cmdPrefix}rules welcome-list\\` | Trạng thái welcome tất cả |`,",
    "            `| \\`${cmdPrefix}rules welcome <groupId> on/off\\` | Welcome group cụ thể |`,",
    "            `| \\`${cmdPrefix}rules welcome all on/off\\` | Welcome tất cả |`,",
    "            `| \\`${cmdPrefix}rules tracking-list\\` | Trạng thái tracking tất cả |`,",
    "            `| \\`${cmdPrefix}rules tracking <groupId> on/off\\` | Tracking group cụ thể |`,",
    "            `| \\`${cmdPrefix}rules tracking all on/off\\` | Tracking tất cả |`,",
    "            `| \\`${cmdPrefix}rules follow-list\\` | Theo dõi memory per-group |`,",
    "            `| \\`${cmdPrefix}rules follow <groupId> on/off\\` | Follow group cụ thể |`,",
    "            `| \\`${cmdPrefix}rules follow all on/off\\` | Follow tất cả |`,",
    "            `| \\`${cmdPrefix}rules dm-list\\` | DM whitelist |`,",
    "            `| \\`${cmdPrefix}rules dm-add <tên>\\` | Thêm vào DM whitelist |`,",
    "            `| \\`${cmdPrefix}rules dm-remove <tên>\\` | Xóa khỏi DM whitelist |`,",
    "            `| \\`${cmdPrefix}rules groupid-list\\` | Danh sách tất cả groups |`,",
    "            `| \\`${cmdPrefix}rules groupid-add <groupId>\\` | Thêm group từ xa |`,",
    "            `| \\`${cmdPrefix}ownerid\\` | Xem/đặt owner ID |`,",
    "            '',",
    "            '---',",
    "            '',",
    "            '## 🔇 Mute vs Silent',",
    "            '',",
    "            '| | Mute | Silent |',",
    "            '|--|------|--------|',",
    "            '| Bot im lặng | Hoàn toàn | Chỉ không tự reply |',",
    "            '| Slash hoạt động | ❌ (chỉ /unmute) | ✅ |',",
    "            '| @mention | ❌ | ✅ |',",
    "            '| Welcome | ❌ | ✅ |',",
  ].join(eol);

  // Insert after MARKER_START
  const insertPoint = si + MARKER_START.length;
  src = src.slice(0, insertPoint) + eol + injection + eol + src.slice(insertPoint);
  console.log('[index] commands section injected');
}

fs.writeFileSync(indexPath, src, 'utf8');
console.log('[index] written OK');
console.log('Done.');
