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

### 🚀 Bug Fixes & Refinements: Docker Workspace Path Resolution, Clean NPM Installer, and UI Auto-Update

- **Fix: Docker Workspace Home Resolution**: Configured the \`HOME\` environment variable for the \`ai-bot\` container, aligning it with the project mount point to resolve path parsing issues (like \`~\`) for relative workspace paths on Windows/macOS.
- **New: Direct NPM Installer Execution**: Refactored the CLI launcher to run directly from the published npm package files instead of performing a full git clone, drastically reducing setup size and skipping git dependencies for end-users.
- **New: Automatic Setup Wizard Update**: Rewrote the updater to seamlessly install the package locally inside \`~/.openclaw-setup\` and automatically restart the Setup Wizard from the web UI when running via npm.
- **Aesthetic: Monospace CLI Logo Alignment**: Centered and balanced the rounded-border lobster logo displayed at startup.

`;


const changelogEntryVi =
`## [${newVersion}] — ${today}

### 🚀 Sửa lỗi & Tối ưu hóa: Phân giải đường dẫn Docker Workspace, Bộ cài NPM rút gọn và Tự động Cập nhật trên UI

- **Sửa lỗi: Phân giải thư mục Docker Workspace**: Thiết lập biến môi trường \`HOME\` cho container \`ai-bot\` trùng với thư mục mount dự án, giúp sửa lỗi phân giải ký tự dấu ngã \`~\` khi định vị workspace bot trên Windows/macOS.
- **Mới: Khởi chạy trực tiếp từ gói NPM**: Tối ưu bộ khởi chạy CLI chạy trực tiếp các file đóng gói trên npm, loại bỏ cơ chế \`git clone\` toàn bộ repository giúp giảm dung lượng cài đặt và không yêu cầu cài đặt sẵn Git.
- **Mới: Tự động cập nhật Setup Wizard từ UI**: Cải tiến cơ chế cập nhật, tự động cài đặt phiên bản mới nhất vào thư mục \`~/.openclaw-setup\` và khởi động lại cổng Setup Wizard mượt mà ngay trên giao diện web.
- **Thẩm mỹ: Căn chỉnh Logo CLI**: Thiết kế lại và cân đối khung Logo góc tròn kèm hai emoji tôm hùm 🦞 đối xứng thẳng hàng ở terminal.

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
