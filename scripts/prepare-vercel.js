// Runs after `expo export -p web`. Vercel serves static files from dist/client, but Expo
// writes the pre-rendered pages to dist/server, so copy every page across. Each page also
// needs a rewrite in vercel.json so that /check serves check.html; warn when one is missing.
const fs = require('fs');
const path = require('path');

const serverDir = path.join(process.cwd(), 'dist', 'server');
const clientDir = path.join(process.cwd(), 'dist', 'client');
const vercelConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'));
const rewrittenPaths = new Set((vercelConfig.rewrites ?? []).map((rule) => rule.source));

const pages = fs.readdirSync(serverDir).filter((name) => name.endsWith('.html'));
for (const name of pages) {
  fs.copyFileSync(path.join(serverDir, name), path.join(clientDir, name));
}

const missingRewrites = pages
  .map((name) => name.replace(/.html$/, ''))
  .filter((page) => !['index', '+not-found', '_sitemap'].includes(page))
  .map((page) => `/${page}`)
  .filter((route) => !rewrittenPaths.has(route));
if (missingRewrites.length > 0) {
  console.warn(
    `[prepare-vercel] vercel.json has no rewrite for: ${missingRewrites.join(', ')}. ` +
      'Add one so the page is served at its clean URL.'
  );
}
console.log(`[prepare-vercel] copied ${pages.length} pages to dist/client`);
