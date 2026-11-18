/**
 * build-hero-frames.mjs — homepage hero 3D-model frames
 *
 * Source: the 120 rendered PNGs (white background), kept out of git in
 *         _local/source-assets/3d model/0001.png … 0120.png
 * Output: website/public/frames/frame-0001.webp … (white keyed to transparent)
 *
 *   npm run frames
 *
 * hero-canvas.js loads these 4-digit names; quality 82 is visually identical
 * to 92 on these smooth renders and ~20% lighter.
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT    = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, '_local', 'source-assets', '3d model');
const OUT_DIR = path.join(ROOT, 'website', 'public', 'frames');

fs.mkdirSync(OUT_DIR, { recursive: true });

const srcFiles = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.png')).sort();
console.log(`Processing ${srcFiles.length} model frames (white bg → transparent)…\n`);

let done = 0;
const BATCH = 4;
// Threshold: pixels brighter than HARD on all channels → fully transparent
// Pixels between SOFT and HARD → smooth alpha fade (anti-aliased edge)
const HARD = 248, SOFT = 215;

async function processFrame(srcName, frameNum) {
  const outPath = path.join(OUT_DIR, `frame-${String(frameNum).padStart(4,'0')}.webp`);
  const { data, info } = await sharp(path.join(SRC_DIR, srcName))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const w = Math.min(data[i], data[i+1], data[i+2]); // "whiteness" = min channel
    if (w >= HARD)      data[i+3] = 0;
    else if (w >= SOFT) data[i+3] = Math.round(255 * (1 - (w - SOFT) / (HARD - SOFT)));
  }

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 82, effort: 6, smartSubsample: true }).toFile(outPath);

  done++;
  process.stdout.write(`\r  ${done}/${srcFiles.length}`);
}

for (let i = 0; i < srcFiles.length; i += BATCH) {
  await Promise.all(srcFiles.slice(i, i + BATCH).map((f, j) => processFrame(f, i + j + 1)));
}
console.log(`\n\n✅  ${done} model frames with transparent bg`);
