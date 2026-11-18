#!/usr/bin/env node
/**
 * optimize-images.mjs — make responsive WebP variants of a source photo.
 *
 *   npm run images -- <source> <output-prefix> [widths] [quality]
 *
 *   npm run images -- "_local/source-assets/services/films.jpg" website/public/services/films
 *     → website/public/services/films-640.webp, films-960.webp, films-1400.webp
 *
 * widths  comma list, default 640,960,1400 (never upscales past the source)
 * quality WebP quality, default 76
 *
 * Use the variants with srcset, e.g.
 *   <img src="/services/films-960.webp"
 *        srcset="/services/films-640.webp 640w, /services/films-960.webp 960w, /services/films-1400.webp 1400w"
 *        sizes="(max-width: 768px) 100vw, 50vw" loading="lazy" decoding="async" width="1400" height="1400" alt="…">
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const [src, prefix, widthsArg = '640,960,1400', qualityArg = '76'] = process.argv.slice(2);
if (!src || !prefix) {
  console.error('usage: node scripts/optimize-images.mjs <source> <output-prefix> [widths] [quality]');
  process.exit(1);
}

const quality = Number(qualityArg);
const meta = await sharp(src).metadata();
const widths = [...new Set(widthsArg.split(',').map(Number).map((w) => Math.min(w, meta.width)))];
fs.mkdirSync(path.dirname(prefix), { recursive: true });

for (const w of widths) {
  const out = `${prefix}-${w}.webp`;
  const info = await sharp(src)
    .resize({ width: w, withoutEnlargement: true })
    .webp({ quality, effort: 6, smartSubsample: true })
    .toFile(out);
  console.log(`${out}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}
