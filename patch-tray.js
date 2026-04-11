const fs = require('fs');
let b = fs.readFileSync('C:/Users/Admin/Downloads/setup-openclaw-win.bat', 'utf8');
const before = '9router -n -H 0.0.0.0 -p 20128 --skip-update"';
const after = '9router -n -H 0.0.0.0 -p 20128 --skip-update --tray"';
b = b.split(before).join(after);
fs.writeFileSync('C:/Users/Admin/Downloads/setup-openclaw-win.bat', b);
console.log('Fixed! Has --tray:', b.includes('--tray'));
