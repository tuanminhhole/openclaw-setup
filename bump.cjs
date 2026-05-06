const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('d:/openclaw-zalo-mod/package.json', 'utf8'));
pkg.version = '2.4.17';
fs.writeFileSync('d:/openclaw-zalo-mod/package.json', JSON.stringify(pkg, null, 2) + '\n');
const cl = fs.readFileSync('d:/openclaw-zalo-mod/CHANGELOG.md', 'utf8');
const newCl = '## [2.4.17] - 2026-05-06\n\n### Fixed\n- Fix `fs.existsSync` error in ZCA initialization by using `require(\'fs\').existsSync`.\n- Prevent Zalo websocket conflict by explicitly stopping listener after REST API initialization.\n\n' + cl;
fs.writeFileSync('d:/openclaw-zalo-mod/CHANGELOG.md', newCl);
