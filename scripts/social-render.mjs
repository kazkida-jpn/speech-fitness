// Renders every post in marketing/social/queue.json to public/promo/<id>.png.
//
//   pnpm social:render            # all posts
//   pnpm social:render drill-01   # one post
//
// Fonts (Noto Sans CJK JP, ~33 MB) are downloaded into marketing/social/fonts on first run.
import { Resvg } from '@resvg/resvg-js';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';

import { SIZE, templates } from '../marketing/social/templates.mjs';

const root = process.cwd();
const socialDir = path.join(root, 'marketing', 'social');
const fontDir = path.join(socialDir, 'fonts');
const outDir = path.join(root, 'public', 'promo');

const FONT_FILES = {
  'NotoSansCJKjp-Regular.otf':
    'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf',
  'NotoSansCJKjp-Bold.otf':
    'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansCJKjp-Bold.otf',
};

async function ensureFonts() {
  fs.mkdirSync(fontDir, { recursive: true });
  for (const [name, url] of Object.entries(FONT_FILES)) {
    const target = path.join(fontDir, name);
    if (fs.existsSync(target) && fs.statSync(target).size > 1_000_000) continue;
    console.log(`[social-render] downloading ${name}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`font download failed: ${url} (${response.status})`);
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  }
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(socialDir, name), 'utf8'));
}

async function main() {
  await ensureFonts();
  const brand = readJson('brand.json');
  const { posts } = readJson('queue.json');
  const only = process.argv.slice(2);
  const selected = only.length ? posts.filter((post) => only.includes(post.id)) : posts;
  if (selected.length === 0) {
    throw new Error(`no posts matched: ${only.join(', ')}`);
  }
  fs.mkdirSync(outDir, { recursive: true });

  for (const post of selected) {
    const render = templates[post.image?.template];
    if (!render) throw new Error(`${post.id}: unknown template "${post.image?.template}"`);
    const svg = render(post.image, brand);
    const png = new Resvg(svg, {
      fitTo: { mode: 'width', value: SIZE },
      font: { fontDirs: [fontDir], loadSystemFonts: false, defaultFontFamily: 'Noto Sans CJK JP' },
    })
      .render()
      .asPng();
    const target = path.join(outDir, `${post.id}.png`);
    fs.writeFileSync(target, png);
    console.log(
      `[social-render] ${path.relative(root, target)} (${Math.round(png.length / 1024)} KB)`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
