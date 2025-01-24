const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

const outputScriptPath = path.resolve(__dirname, `../${packageJson.main}`);
const bannerPath = path.resolve(__dirname, '../src/banner.js');

if (!fs.existsSync(bannerPath)) {
  throw new Error(`Banner file not found: ${bannerPath}`);
}

const repoUrl = packageJson.repository.url.replace(/\.git$/, '');
const installUrl = `${repoUrl}/releases/latest/download/${path.basename(packageJson.main)}`;

const bannerContent = fs.readFileSync(bannerPath, 'utf8')
  .replace('{{name}}', packageJson.monkeyScript.displayName)
  .replace('{{version}}', packageJson.version)
  .replace('{{description}}', packageJson.description)
  .replace(/{{install_url}}/g, installUrl)
  .replace('{{author}}', packageJson.author);

const scriptContent = fs.readFileSync(outputScriptPath, 'utf8');
fs.writeFileSync(outputScriptPath, bannerContent + '\n\n' + scriptContent);