// SVG templates for the 1080x1080 promo cards. Every template returns an SVG string that
// scripts/social-render.mjs turns into public/promo/<id>.png. Colors follow src/constants/palette.ts.

export const SIZE = 1080;
const MARGIN = 96;
const CONTENT_WIDTH = SIZE - MARGIN * 2;
const FONT = 'Noto Sans CJK JP';

export const colors = {
  ink: '#19312D',
  muted: '#60726E',
  cream: '#F6F3EC',
  white: '#FFFFFF',
  mint: '#DDF4EA',
  green: '#187A64',
  greenDark: '#0F5E4D',
  coral: '#F06C55',
  line: '#DCE6E2',
};

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Approximate advance width in em: CJK and full-width glyphs are 1em, Latin about 0.55em. */
function charWidth(ch) {
  const code = ch.codePointAt(0);
  if (code < 0x2000) return ch === ' ' ? 0.3 : 0.55;
  return 1;
}

export function measure(text, fontSize) {
  let width = 0;
  for (const ch of text) width += charWidth(ch);
  return width * fontSize;
}

/** Greedy wrap by estimated width. Avoids starting a line with closing punctuation. */
export function wrap(text, fontSize, maxWidth) {
  const chars = [...text];
  const lines = [];
  let line = '';
  for (const ch of chars) {
    const candidate = line + ch;
    if (measure(candidate, fontSize) > maxWidth && line !== '') {
      if ('、。」）!?！？'.includes(ch)) {
        lines.push(candidate);
        line = '';
        continue;
      }
      lines.push(line);
      line = ch;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textBlock(lines, { x, y, fontSize, weight, fill, lineHeight = 1.4, anchor = 'start' }) {
  const step = fontSize * lineHeight;
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * step}" font-family="${FONT}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(line)}</text>`
    )
    .join('\n');
}

function background() {
  return `
<rect width="${SIZE}" height="${SIZE}" fill="${colors.cream}"/>
<circle cx="${SIZE - 40}" cy="60" r="260" fill="${colors.mint}"/>
<rect x="0" y="${SIZE - 14}" width="${SIZE}" height="14" fill="${colors.green}"/>`;
}

function eyebrow(text) {
  return `
<rect x="${MARGIN}" y="${MARGIN}" width="10" height="44" rx="5" fill="${colors.coral}"/>
${textBlock([text], { x: MARGIN + 30, y: MARGIN + 34, fontSize: 30, weight: 700, fill: colors.green })}`;
}

function footer(brand) {
  const y = SIZE - MARGIN - 10;
  const right = brand.instagramHandle
    ? brand.instagramHandle.startsWith('@')
      ? brand.instagramHandle
      : `@${brand.instagramHandle}`
    : brand.company;
  return `
<circle cx="${MARGIN + 22}" cy="${y - 12}" r="22" fill="${colors.green}"/>
<circle cx="${MARGIN + 22}" cy="${y - 12}" r="9" fill="${colors.cream}"/>
${textBlock([brand.name], { x: MARGIN + 60, y, fontSize: 32, weight: 700, fill: colors.ink })}
${textBlock([right], { x: SIZE - MARGIN, y, fontSize: 26, weight: 400, fill: colors.muted, anchor: 'end' })}`;
}

function frame(inner, brand, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<title>${escapeXml(label)}</title>
${background()}
${inner}
${footer(brand)}
</svg>`;
}

/** Big statement: eyebrow, 2-4 headline lines, one sub line. */
export function statement(spec, brand) {
  const headlineSize = spec.headline.length >= 4 ? 66 : 76;
  const headlineLines = spec.headline.flatMap((line) => wrap(line, headlineSize, CONTENT_WIDTH));
  const subLines = spec.sub ? wrap(spec.sub, 36, CONTENT_WIDTH) : [];
  const headlineHeight = headlineLines.length * headlineSize * 1.35;
  const subHeight = subLines.length * 36 * 1.5;
  const blockHeight = headlineHeight + (subLines.length ? 40 + subHeight : 0);
  const top = (SIZE - blockHeight) / 2 + headlineSize * 0.85;
  return frame(
    `${eyebrow(spec.eyebrow ?? brand.name)}
${textBlock(headlineLines, { x: MARGIN, y: top, fontSize: headlineSize, weight: 700, fill: colors.ink, lineHeight: 1.35 })}
${textBlock(subLines, { x: MARGIN, y: top + headlineHeight + 40, fontSize: 36, weight: 400, fill: colors.muted, lineHeight: 1.5 })}`,
    brand,
    spec.headline.join('')
  );
}

/** One practice sentence inside a card, with a tip below. */
export function drill(spec, brand) {
  const padding = 56;
  const sentenceSize = 54;
  const sentenceLines = wrap(spec.sentence, sentenceSize, CONTENT_WIDTH - padding * 2 - 20);
  const cardHeight = padding * 2 + sentenceLines.length * sentenceSize * 1.5 - sentenceSize * 0.5;
  const instructionLines = wrap(
    '楽な速さで1回。次に、はっきり聞こえる範囲で最速で1回。',
    30,
    CONTENT_WIDTH
  );
  const instructionHeight = instructionLines.length * 30 * 1.5;
  const tipLines = spec.tip ? wrap(spec.tip, 34, CONTENT_WIDTH) : [];
  const tipHeight = tipLines.length * 34 * 1.5;
  const blockHeight = cardHeight + 48 + instructionHeight + (tipLines.length ? 36 + tipHeight : 0);
  const cardTop = Math.max(230, (SIZE - blockHeight) / 2 - 20);
  const instructionTop = cardTop + cardHeight + 48;
  const tipTop = instructionTop + instructionHeight + 36;
  return frame(
    `${eyebrow(spec.eyebrow ?? '今日の1文')}
<rect x="${MARGIN}" y="${cardTop}" width="${CONTENT_WIDTH}" height="${cardHeight}" rx="28" fill="${colors.white}" stroke="${colors.line}" stroke-width="2"/>
<rect x="${MARGIN}" y="${cardTop + 36}" width="10" height="${cardHeight - 72}" rx="5" fill="${colors.coral}"/>
${textBlock(sentenceLines, { x: MARGIN + padding, y: cardTop + padding + sentenceSize * 0.85, fontSize: sentenceSize, weight: 700, fill: colors.ink, lineHeight: 1.5 })}
${textBlock(instructionLines, { x: MARGIN, y: instructionTop + 30 * 0.85, fontSize: 30, weight: 700, fill: colors.green, lineHeight: 1.5 })}
${textBlock(tipLines, { x: MARGIN, y: tipTop + 34 * 0.85, fontSize: 34, weight: 400, fill: colors.muted, lineHeight: 1.5 })}`,
    brand,
    spec.sentence
  );
}

/** Title plus three numbered steps. */
export function steps(spec, brand) {
  const titleSize = 60;
  const circle = 64;
  const textSize = 38;
  const gap = 44;
  const titleLines = wrap(spec.title, titleSize, CONTENT_WIDTH);
  const textX = MARGIN + circle + 32;
  const textWidth = CONTENT_WIDTH - circle - 32;
  const rows = spec.steps.map((step) => {
    const lines = wrap(step, textSize, textWidth);
    return { lines, height: Math.max(circle, lines.length * textSize * 1.45) };
  });
  const titleHeight = titleLines.length * titleSize * 1.35;
  const listHeight = rows.reduce((sum, row) => sum + row.height, 0) + gap * (rows.length - 1);
  const blockHeight = titleHeight + 48 + listHeight;
  const titleTop = Math.max(230, (SIZE - blockHeight) / 2 - 20);
  let y = titleTop + titleHeight + 48;
  const list = rows.map((row, index) => {
    const svg = `
<circle cx="${MARGIN + circle / 2}" cy="${y + circle / 2}" r="${circle / 2}" fill="${colors.green}"/>
${textBlock([String(index + 1)], { x: MARGIN + circle / 2, y: y + circle / 2 + 12, fontSize: 34, weight: 700, fill: colors.white, anchor: 'middle' })}
${textBlock(row.lines, { x: textX, y: y + textSize * 0.95 + (circle - textSize * 1.2) / 2, fontSize: textSize, weight: 400, fill: colors.ink, lineHeight: 1.45 })}`;
    y += row.height + gap;
    return svg;
  });
  return frame(
    `${eyebrow(spec.eyebrow ?? brand.name)}
${textBlock(titleLines, { x: MARGIN, y: titleTop + titleSize * 0.85, fontSize: titleSize, weight: 700, fill: colors.ink, lineHeight: 1.35 })}
${list.join('\n')}`,
    brand,
    spec.title
  );
}

export const templates = { statement, drill, steps };
