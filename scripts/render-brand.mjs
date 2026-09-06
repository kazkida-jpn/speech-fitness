// Renders the SVG sources in assets/brand into every PNG the app and the web site need.
// Re-run after editing an SVG:  node scripts/render-brand.mjs
// Needs @resvg/resvg-js, which is not a project dependency: run it from a folder where it is
// installed (npm i @resvg/resvg-js) or via  pnpm dlx --package=@resvg/resvg-js node scripts/render-brand.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(
  process.env.RESVG_DIR ? path.join(process.env.RESVG_DIR, '/') : import.meta.url
);
const { Resvg } = require('@resvg/resvg-js');

const root = process.cwd();
const brand = (name) => fs.readFileSync(path.join(root, 'assets', 'brand', name), 'utf8');
const MARK = brand('mark.svg');
const MARK_WHITE = brand('mark-white.svg');
const ICON = brand('icon.svg');

const CREAM = '#F6F3EC';
const GREEN_DARK = '#0F5E4D';

function markPaths(svg) {
  // Everything between the outer <svg> tags, so a mark can be dropped into another canvas.
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

/** Wraps mark paths in a new square canvas, scaled to `ratio` of the canvas and centred. */
function framed(inner, { size = 1024, ratio = 1, background = null } = {}) {
  const scale = ratio;
  const offset = (size - 1024 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''}
  <g transform="translate(${offset} ${offset}) scale(${scale})">${inner}</g>
</svg>`;
}

function render(svg, outFile, width) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
  const png = resvg.render().asPng();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, png);
  console.log(`${path.relative(root, outFile)}  ${width}px`);
}

const images = path.join(root, 'assets', 'images');
const pub = path.join(root, 'public');
const mark = markPaths(MARK);
const markWhite = markPaths(MARK_WHITE);

// App icon (iOS/Android legacy/Expo Go): full-bleed cream tile.
render(ICON, path.join(images, 'icon.png'), 1024);
// Android adaptive icon: the mark sits inside the 66% safe zone of the foreground layer.
render(framed(mark, { ratio: 0.58 }), path.join(images, 'android-icon-foreground.png'), 1024);
render(framed('', { background: CREAM }), path.join(images, 'android-icon-background.png'), 1024);
render(framed(markWhite, { ratio: 0.58 }), path.join(images, 'android-icon-monochrome.png'), 1024);
// Splash: transparent mark, tinted by the cream splash background from app.json.
render(framed(mark, { ratio: 0.9 }), path.join(images, 'splash-icon.png'), 1024);
// Favicon source for Expo (it derives favicon.ico from this).
render(framed(mark, { ratio: 1 }), path.join(images, 'favicon.png'), 64);
// Web extras served from /public.
render(framed(mark, { ratio: 1 }), path.join(pub, 'favicon-32.png'), 32);
render(framed(mark, { ratio: 1 }), path.join(pub, 'favicon-192.png'), 192);
render(ICON, path.join(pub, 'apple-touch-icon.png'), 180);
render(ICON, path.join(pub, 'icon-512.png'), 512);
render(
  framed(mark, { ratio: 0.72, background: GREEN_DARK }).replace(mark, markWhite),
  path.join(pub, 'icon-512-maskable.png'),
  512
);

// Open Graph image, 1200x630.
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="${CREAM}"/>
  <rect x="0" y="0" width="1200" height="14" fill="${GREEN_DARK}"/>
  <g transform="translate(90 165) scale(0.29)">${mark}</g>
  <text x="440" y="235" fill="#187A64" font-family="'Helvetica Neue', Arial, sans-serif" font-size="26" font-weight="800" letter-spacing="7">SPEECH FITNESS</text>
  <text x="438" y="325" fill="#19312D" font-family="'Yu Gothic', 'Meiryo', 'Hiragino Sans', 'Noto Sans JP', sans-serif" font-size="84" font-weight="800">発話フィットネス</text>
  <text x="440" y="400" fill="#60726E" font-family="'Yu Gothic', 'Meiryo', 'Hiragino Sans', 'Noto Sans JP', sans-serif" font-size="34">毎日数分で、伝わる話し方を保つ</text>
  <text x="440" y="455" fill="#60726E" font-family="'Yu Gothic', 'Meiryo', 'Hiragino Sans', 'Noto Sans JP', sans-serif" font-size="34">測る・鍛える・見える化する 発話トレーニング</text>
  <text x="90" y="575" fill="#60726E" font-family="'Helvetica Neue', Arial, sans-serif" font-size="24">speech-fitness.learn-k.net</text>
</svg>`;
render(og, path.join(pub, 'og-image.png'), 1200);
