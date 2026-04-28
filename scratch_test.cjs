const fs = require('fs');
const s = fs.readFileSync('dist/setup.js', 'utf8');
const lines = s.split('\n');
for (const line of lines) {
  if (line.includes('OPENCLAW_HOME') && line.includes('PROJECT_DIR')) {
    console.log(line);
    console.log('LENGTH:', line.length);
    console.log('EXACT MATCH?', line.includes("set \"OPENCLAW_HOME=%PROJECT_DIR%\\\\.openclaw\""));
  }
}
