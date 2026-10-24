const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// כל קובץ שהדף טוען חייב להיות במטמון, אחרת האפליקציה לא תעבוד בלי אינטרנט
test('service worker precaches every local file the page loads', () => {
  const sw = read('sw.js');
  const html = read('index.html');
  const local = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => !/^https?:|^#/.test(u));
  assert.ok(local.length > 10);
  for (const f of local) assert.ok(sw.includes(`'${f}'`), `missing in sw.js: ${f}`);
});

test('service worker never caches AI or Google API calls', () => {
  const sw = read('sw.js');
  for (const host of ['api.anthropic.com', 'generativelanguage.googleapis.com', 'www.googleapis.com', 'accounts.google.com']) {
    assert.ok(sw.includes(host), `sw.js should explicitly bypass ${host}`);
  }
});

test('manifest is Hebrew, RTL, standalone, with icons that exist', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.equal(m.lang, 'he');
  assert.equal(m.dir, 'rtl');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.equal(m.theme_color, '#1F3B33');
  const sizes = m.icons.map(i => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(m.icons.some(i => i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(ROOT, i.src)), `missing icon ${i.src}`);
});
