// Recolors the PNG app icons from the old school blue (#16478E) to the theme royal (#0A4598).
// Only the blue (and its anti-aliased edges) shifts; logo art, size and layout stay the same.
// Safe to re-run: pixels already nearer the new blue are left alone.
// Usage: node scripts/make-icons.mjs
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

const OLD = [0x16, 0x47, 0x8e];
const NEW = [0x0a, 0x45, 0x98];
const RADIUS = 130; // sky blue (#6CA9DC) is ~150 away, so it stays untouched
const FILES = ['apple-touch-icon', 'favicon-48', 'icon-192', 'icon-512'];
const dist = (p, c) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);

for (const name of FILES) {
  const path = new URL(`../public/brand/${name}.png`, import.meta.url);
  const { data, info } = await sharp(await readFile(path)).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels) {
    if (info.channels === 4 && data[i + 3] === 0) continue;
    const px = [data[i], data[i + 1], data[i + 2]];
    const d = dist(px, OLD);
    if (dist(px, NEW) < d) continue;
    const w = Math.max(0, 1 - d / RADIUS);
    for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.max(0, Math.round(px[c] + (NEW[c] - OLD[c]) * w)));
  }
  await writeFile(path, await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toBuffer());
  console.log('wrote', name, info.width + 'x' + info.height);
}
