#!/usr/bin/env node
/**
 * bump-version.mjs — Single-source versioning for OpenClaw Setup
 *
 * Usage:
 *   node bump-version.mjs 5.0.0
 *   npm run bump 5.0.0
 *
 * What it does:
 *   1. Reads current version from package.json
 *   2. Updates package.json → newVersion
 *   3. Syncs package-lock.json (via npm install --package-lock-only)
 *   4. Replaces ALL occurrences of oldVersion in README.md, README.vi.md
 *   5. Prepends a new section to CHANGELOG.md, CHANGELOG.vi.md
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const newVersion = process.argv[2];
if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('❌ Usage: node bump-version.mjs <new-version>  e.g. node bump-version.mjs 4.1.4');
  process.exit(1);
}

// ── 1. Read current version from package.json ─────────────────────────────────
const pkgPath = path.join(projectRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8').replace(/^\uFEFF/, ''));
const oldVersion = pkg.version;

if (oldVersion === newVersion) {
  console.log(`⚠️  Version is already ${newVersion}. Nothing to do.`);
  process.exit(0);
}

console.log(`\n🔄 Bumping version: ${oldVersion} → ${newVersion}\n`);

// ── 2. Update package.json ────────────────────────────────────────────────────
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`  ✅ package.json → ${newVersion}`);

// ── 2b. Sync package-lock.json ───────────────────────────────────────────────
try {
  execSync('npm install --package-lock-only --ignore-scripts', { stdio: 'pipe', cwd: projectRoot });
  console.log(`  ✅ package-lock.json → synced`);
} catch (e) {
  console.log(`  ⚠️  package-lock.json: could not sync (${e.message.split('\n')[0]}). Run npm install manually.`);
}

// ── 3. Replace version string in README files ─────────────────────────────────
// Matches: v4.1.2 or 4.1.2 (with or without v prefix) — in badge URLs and inline text
const escOld = oldVersion.replace(/\./g, '\\.');
const pattern = new RegExp(`v?${escOld}`, 'g');

const readmeFiles = ['README.md', 'README.vi.md'];
for (const name of readmeFiles) {
  const fp = path.join(projectRoot, name);
  if (!fs.existsSync(fp)) { console.log(`  ⚠️  ${name} not found, skipping`); continue; }
  const before = fs.readFileSync(fp, 'utf8');
  // Replace bare version and v-prefixed version separately to be safe
  const after = before
    .replace(new RegExp(`v${escOld}`, 'g'), `v${newVersion}`)
    .replace(new RegExp(`(?<!v)${escOld}`, 'g'), newVersion);
  if (before === after) {
    console.log(`  ⚠️  ${name}: no occurrence of ${oldVersion} found`);
  } else {
    fs.writeFileSync(fp, after);
    const count = (before.match(pattern) || []).length;
    console.log(`  ✅ ${name}: replaced ${count} occurrence(s)`);
  }
}

// ── 4. Prepend changelog entry ────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);

const changelogEntryEn =
`## [${newVersion}] — ${today}

### 🚀 New Features: Deep Integration of Infographic Image Generator, Zalo Sticker & Auto-Tag Skills, and Workspace Docs Optimization

- **New: Infographic Poster Generator Skill**: Integrates automatic infographic and poster generation via 9Router API. Automatically generates the helper script \`image-generator.js\` (synchronizing API credentials from \`openclaw.json\`) and a comprehensive \`SKILL.md\` guiding agents on styling rules, Vietnamese font support, layouts, and image generation syntax.
- **New: Zalo Sticker & Auto-Tag Skill**: 
  - Automatically mentions the active sender in group chats (Agent doesn't need to manually prefix with \`@Name\` anymore, the system handles it).
  - Enables agents to dynamically send Zalo stickers by appending \`[Sticker: <keyword>]\` at the end of their text responses.
  - Automatically maps emotional keywords (such as \`love\`, \`haha\`, \`ca khia\`, \`angry\`, \`thank you\`, etc.) to actual Zalo sticker IDs.
  - Generates the patch script \`mentions.js\` and a dedicated \`SKILL.md\` inside the agent's workspace.
- **Polish: Simplified TOOLS.md generation**: Streamlined the \`TOOLS.md\` generator to output a concise, static guide focusing on general principles and referencing the \`./skills/\` directory, rather than generating dynamic lists based on installed plugins.
- **Polish: Standardized Reference Docs list in AGENTS.md**: Updated the reference docs list in the generated \`AGENTS.md\` (for both single and relay variants in Vietnamese and English) to match the new structure, removing obsolete files (\`TEAMS.md\` for single-bot, \`BROWSER.md\`) and standardizing descriptions to keep exactly 9 core documents.

`;


const changelogEntryVi =
`## [${newVersion}] — ${today}

### 🚀 Tính năng mới: Tích hợp sâu Skill Tạo ảnh Infographic, Skill Sticker & Auto-Tag (Zalo) cùng Tối ưu hóa Workspace Docs

- **Mới: Hỗ trợ Skill Tạo ảnh Infographic chuyên nghiệp**: Tích hợp hoàn toàn công cụ tạo ảnh infographic, poster tự động thông qua API của 9Router. Tự động sinh mã nguồn script \`image-generator.js\` đồng bộ API credentials từ \`openclaw.json\` và hướng dẫn \`SKILL.md\` cụ thể giúp Agent nắm vững cấu trúc prompt, font chữ tiếng Việt, layout và quy tắc thiết kế ảnh.
- **Mới: Hỗ trợ Skill Sticker & Auto-Tag (Zalo)**: 
  - Tự động tag tên người gửi tin nhắn gần nhất trong group chat Zalo (Agent không cần tự điền \`@Tên\` ở đầu câu trả lời nữa, hệ thống sẽ tự làm).
  - Cho phép Agent gửi kèm Sticker Zalo trực tiếp trong câu trả lời thông qua thẻ \`[Sticker: <từ_khóa>]\` đặt ở cuối tin nhắn.
  - Tích hợp bộ giải nghĩa từ khóa cảm xúc thông minh (như \`love\`, \`haha\`, \`ca khia\`, \`angry\`, \`thank you\`,...) để tự động map sang sticker Zalo phù hợp.
  - Tự động sinh script vá logic \`mentions.js\` và tài liệu hướng dẫn \`SKILL.md\` trong workspace.
- **Tối ưu hóa: Đơn giản hóa sinh file TOOLS.md**: Điều chỉnh generator của \`TOOLS.md\` để sinh ra nội dung tĩnh gọn gàng, tập trung định hướng Agent đọc chi tiết các tài liệu hướng dẫn skill tương ứng nằm trong thư mục \`./skills/\`, loại bỏ các logic sinh danh sách động dựa trên plugin cũ.
- **Tối ưu hóa: Chuẩn hóa danh sách Tài liệu tham chiếu trong AGENTS.md**: Cập nhật danh sách tài liệu tham chiếu được tạo trong file \`AGENTS.md\` (cho cả 2 chế độ single/relay và cả tiếng Việt/tiếng Anh) để khớp chính xác cấu trúc mới gồm đúng 9 tài liệu cốt lõi, loại bỏ các file không còn phù hợp (\`TEAMS.md\` cho single-bot, \`BROWSER.md\`) và chuẩn hóa phần mô tả.

`;



const changelogFiles = [
  ['CHANGELOG.md',    changelogEntryEn],
  ['CHANGELOG.vi.md', changelogEntryVi],
];

for (const [name, entry] of changelogFiles) {
  const fp = path.join(projectRoot, name);
  if (!fs.existsSync(fp)) { console.log(`  ⚠️  ${name} not found, skipping`); continue; }
  let content = fs.readFileSync(fp, 'utf8');

  // Avoid duplicate entry if already bumped
  if (content.includes(`## [${newVersion}]`)) {
    console.log(`  ⚠️  ${name}: v${newVersion} entry already exists, skipping`);
    continue;
  }

  // Insert after the first heading line (# Changelog...)
  const firstNewline = content.indexOf('\n');
  const afterHeading = content.indexOf('\n', firstNewline + 1) + 1;
  content = content.slice(0, afterHeading) + '\n' + entry + content.slice(afterHeading);
  fs.writeFileSync(fp, content);
  console.log(`  ✅ ${name}: prepended v${newVersion} entry`);
}

console.log(`
🎉 Done! Version is now ${newVersion}

Next steps:
  git add -A
  git commit -m "chore: bump to v${newVersion}"
  git tag v${newVersion}
  git push && git push --tags
  npm publish
`);
