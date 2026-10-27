'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

function prepare(directory) {
  const root = path.resolve(directory);
  const files = [];
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, {withFileTypes: true})) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name !== 'site-version.json') files.push(path.relative(root, full));
    }
  }
  walk(root);
  files.sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(file).update('\0').update(fs.readFileSync(path.join(root, file))).update('\0');
  const version = hash.digest('hex');
  const marker = /(<meta name="sarai-version" content=")[^"]*(">)/;
  if (!marker.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8'))) throw new Error('Missing site version marker');
  for (const file of files.filter(file => file.endsWith('.html'))) {
    const full = path.join(root, file);
    let html = fs.readFileSync(full, 'utf8').replace(marker, (match, before, after) => before + version + after);
    html = html.replace(/\b(src|href)="([^"?#]+\.(?:js|css|png))(?:\?[^"#]*)?(#[^"]*)?"/g, (match, attribute, asset, fragment = '') => {
      if (/^(?:[a-z]+:|\/\/|\/)/i.test(asset)) return match;
      const assetPath = path.resolve(path.dirname(full), asset);
      if (!assetPath.startsWith(root + path.sep) || !fs.existsSync(assetPath)) throw new Error('Missing local asset: ' + asset);
      const digest = createHash('sha256').update(fs.readFileSync(assetPath)).digest('hex').slice(0, 16);
      return attribute + '="' + asset + '?v=' + digest + fragment + '"';
    });
    fs.writeFileSync(full, html);
  }
  fs.writeFileSync(path.join(root, 'site-version.json'), JSON.stringify({version}) + '\n');
  return version;
}

if (require.main === module) console.log('Prepared site version ' + prepare(process.argv[2] || '_site'));
module.exports = prepare;
