const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

fs.rmSync(path.resolve(__dirname, '../dist/fs-army-knife.user.js.LICENSE.txt'), {
  force: true,
});

const outputScriptPath = path.resolve(__dirname, '../dist/fs-army-knife.user.js');
const bannerPath = path.resolve(__dirname, '../src/banner.js');

if (!fs.existsSync(bannerPath)) {
  throw new Error(`Banner file not found: ${bannerPath}`);
}

const bannerContent = fs.readFileSync(bannerPath, 'utf8')
  .replace('{{version}}', packageJson.version);
const scriptContent = fs.readFileSync(outputScriptPath, 'utf8');
fs.writeFileSync(outputScriptPath, bannerContent + '\n\n' + scriptContent);