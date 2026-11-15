// Derives the site background art from the official 2026 schedule poster.
// Usage: node scripts/make-art.mjs <path-to-poster.jpeg>
// Only crops without any poster text are written (public/art/). Never commit the full poster.
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/make-art.mjs <poster.jpeg>'); process.exit(1); }
const out = new URL('../public/art/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

// Crop boxes in poster pixels (1199x1506). Keep clear of all poster text and the BLAC mark.
const EYES = { left: 0, top: 0, width: 1199, height: 222 };
const STORM = { left: 0, top: 900, width: 1199, height: 520 };
const HELMET = { left: 440, top: 990, width: 400, height: 280 };

async function emit(name, box, widths, q, mask) {
  for (const w of widths) {
    let img = sharp(src).extract(box).resize({ width: w });
    if (mask) {
      const { width, height } = await img.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
      const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0.68" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
      img = sharp(await img.png().toBuffer()).ensureAlpha().composite([{ input: svg, blend: 'dest-in' }]);
    }
    for (const [fmt, opts] of [['avif', { quality: q, effort: 6 }], ['webp', { quality: q + 8, effort: 6 }]]) {
      const file = `${out}${name}-${w}.${fmt}`;
      await img.clone()[fmt](opts).toFile(file);
      console.log(file.replace(out, ''), statSync(file).size);
    }
  }
}

await emit('eyes', EYES, [640, 1200], 55);
await emit('storm', STORM, [640, 1200], 55);
await emit('helmet', HELMET, [160, 340], 60, true);

// Sample theme colors (mean of regions) for reference.
async function mean(label, box) {
  const { channels } = await sharp(await sharp(src).extract(box).png().toBuffer()).stats();
  const hex = '#' + channels.slice(0, 3).map((c) => Math.round(c.mean).toString(16).padStart(2, '0')).join('');
  console.log(label, hex);
}
await mean('navy (page bg between boxes)', { left: 5, top: 800, width: 30, height: 30 });
await mean('navy2 (top corner)', { left: 5, top: 5, width: 40, height: 40 });
await mean('royal (game box fill, Aug 21)', { left: 470, top: 500, width: 20, height: 12 });
await mean('royal2 (Sep 18 box)', { left: 330, top: 570, width: 20, height: 12 });
