import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const src = 'source-assets/template-background.png';
const out = path.resolve('public');
const bgOut = path.join(out, 'underwater-bg.png');
const base = await sharp(src)
  .extract({ left: 0, top: 0, width: 1672, height: 729 })
  .resize(1920, 1080, { fit: 'cover', position: 'centre' })
  .png()
  .toBuffer();

// Remove the last baked-in fish (bottom-right) by painting blurred water back
// over it. The small silhouettes are extracted separately for parallax.
const blurred = await sharp(base).blur(22).toBuffer();
const mask = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">' +
    '<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%">' +
    '<feGaussianBlur stdDeviation="22"/></filter></defs>' +
    '<ellipse cx="1396" cy="777" rx="58" ry="34" fill="white" filter="url(#b)"/>' +
    '</svg>',
);
const patch = await sharp(blurred).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
const background = await sharp(base).composite([{ input: patch }]).png().toBuffer();
const optimizedPng = await sharp(background)
  .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
  .toBuffer();
fs.writeFileSync(bgOut, optimizedPng);
fs.writeFileSync(path.join(out, 'underwater-bg.webp'), await sharp(background).webp({ quality: 86, effort: 5 }).toBuffer());
console.log(
  'background',
  (await sharp(background).metadata()).width,
  (await sharp(background).metadata()).height,
  `${Math.round(optimizedPng.length / 1024)}KB png`,
);

// Silhouette group boxes in the strip (x, y, w, h), in coordinates of the
// original sheet. Groups are intentionally padded and kept separate.
const silhouettes = [
  { id: 'school-far', box: { x: 820, y: 750, w: 260, h: 150 }, size: 0.55 },
  { id: 'school-mid', box: { x: 1110, y: 750, w: 270, h: 150 }, size: 0.72 },
  { id: 'school-near', box: { x: 1390, y: 750, w: 270, h: 150 }, size: 0.9 },
  { id: 'fish-a', box: { x: 55, y: 755, w: 125, h: 70 }, size: 0.8 },
  { id: 'fish-b', box: { x: 205, y: 755, w: 110, h: 70 }, size: 0.7 },
  { id: 'fish-c', box: { x: 350, y: 745, w: 100, h: 95 }, size: 0.9 },
  { id: 'fish-d', box: { x: 495, y: 755, w: 105, h: 70 }, size: 0.75 },
  { id: 'fish-e', box: { x: 630, y: 750, w: 125, h: 70 }, size: 0.85 },
];
fs.mkdirSync(path.join(out, 'silhouettes'), { recursive: true });

const sheet = sharp(src);
const raw = await sheet.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = raw.info.width;
const H = raw.info.height;
const data = raw.data;

for (const item of silhouettes) {
  const { x, y, w, h } = item.box;
  const crop = await sharp(src).extract({ left: x, top: y, width: w, height: h }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cw = crop.info.width;
  const ch = crop.info.height;
  const rgba = Buffer.alloc(cw * ch * 4);
  let minX = cw, minY = ch, maxX = 0, maxY = 0;
  for (let yy = 0; yy < ch; yy++) {
    for (let xx = 0; xx < cw; xx++) {
      const si = (yy * cw + xx) * 4;
      const di = si;
      const r = crop.data[si];
      const g = crop.data[si + 1];
      const b = crop.data[si + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const isDark = lum < 135 && crop.data[si + 3] > 30;
      if (isDark) {
        // Normalise to deep navy while preserving the original shape.
        rgba[di] = 18;
        rgba[di + 1] = 55;
        rgba[di + 2] = 79;
        rgba[di + 3] = 255;
        minX = Math.min(minX, xx);
        minY = Math.min(minY, yy);
        maxX = Math.max(maxX, xx);
        maxY = Math.max(maxY, yy);
      }
    }
  }
  if (maxX < minX) continue;
  const pad = 4;
  const bx = Math.max(0, minX - pad);
  const by = Math.max(0, minY - pad);
  const bw = Math.min(cw - bx, maxX - minX + 1 + pad * 2);
  const bh = Math.min(ch - by, maxY - minY + 1 + pad * 2);
  const cropped = await sharp(rgba, { raw: { width: cw, height: ch, channels: 4 } }).extract({ left: bx, top: by, width: bw, height: bh }).png().toFile(path.join(out, 'silhouettes', `${item.id}.png`));
  console.log(item.id, bw, bh);
}
fs.writeFileSync(path.join(out, 'silhouettes', 'index.json'), JSON.stringify(silhouettes, null, 2));
