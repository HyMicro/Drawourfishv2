import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SHEET = 'source-assets/icon-sheet.png';
const OUT = path.resolve('public/icons');
fs.mkdirSync(OUT, { recursive: true });

const source = sharp(SHEET).ensureAlpha();
const meta = await source.metadata();
const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;

const icons = [
  { name: 'ikanku', box: { x: 190, y: 65, w: 128, h: 95 } },
  { name: 'pakan', box: { x: 343, y: 65, w: 128, h: 95 } },
  { name: 'gambar', box: { x: 496, y: 64, w: 126, h: 96 } },
  { name: 'foto', box: { x: 647, y: 64, w: 126, h: 96 } },
  { name: 'tambah', box: { x: 1004, y: 74, w: 108, h: 78 } },
  { name: 'edit', box: { x: 1136, y: 74, w: 100, h: 78 } },
  { name: 'hapus', box: { x: 1270, y: 74, w: 102, h: 78 } },
  { name: 'kembali', box: { x: 1405, y: 74, w: 102, h: 78 } },
  { name: 'kuas', box: { x: 40, y: 270, w: 108, h: 90 } },
  { name: 'ember', box: { x: 170, y: 270, w: 103, h: 90 } },
  { name: 'penghapus', box: { x: 297, y: 270, w: 103, h: 90 } },
  { name: 'undo', box: { x: 430, y: 280, w: 90, h: 78 } },
  { name: 'suara', box: { x: 978, y: 674, w: 70, h: 64 } },
  { name: 'musik', box: { x: 886, y: 674, w: 70, h: 64 } },
  { name: 'unduh', box: { x: 1338, y: 674, w: 76, h: 66 } },
  { name: 'goldfish', box: { x: 172, y: 468, w: 104, h: 90 } },
  { name: 'efek', box: { x: 1173, y: 862, w: 96, h: 80 } },
  { name: 'stiker', box: { x: 797, y: 860, w: 104, h: 80 } },
  { name: 'koleksi', box: { x: 1293, y: 860, w: 96, h: 80 } },
];

function colorDistance(data, i, r, g, b) {
  const dr = data[i] - r;
  const dg = data[i + 1] - g;
  const db = data[i + 2] - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

async function extract(icon) {
  const { x, y, w, h } = icon.box;
  const px = W;
  const rgba = Buffer.alloc(w * h * 4);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const si = ((y + yy) * px + (x + xx)) * 4;
      const di = (yy * w + xx) * 4;
      rgba[di] = data[si];
      rgba[di + 1] = data[si + 1];
      rgba[di + 2] = data[si + 2];
      rgba[di + 3] = 255;
    }
  }

  // Sample the cream tile from the four corners, then flood-fill the tile
  // background (and its soft shadow) to transparency. Closed brown outlines
  // keep the internal cream/white highlights intact.
  const corners = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
    [w >> 1, 2],
    [w >> 1, h - 3],
  ].map(([cx, cy]) => {
    const i = (cy * w + cx) * 4;
    return [rgba[i], rgba[i + 1], rgba[i + 2]];
  });
  const bright = corners.filter(([cr, cg, cb]) => (cr + cg + cb) / 3 > 165);
  const sample = bright.length > 0 ? bright : corners;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [cr, cg, cb] of sample) {
    r += cr;
    g += cg;
    b += cb;
  }
  r /= sample.length;
  g /= sample.length;
  b /= sample.length;

  const threshold = 148;
  const visited = new Uint8Array(w * h);
  const queue = [];
  const enqueue = (xx, yy) => {
    if (xx < 0 || yy < 0 || xx >= w || yy >= h) return;
    const p = yy * w + xx;
    if (visited[p]) return;
    visited[p] = 1;
    const i = p * 4;
    if (colorDistance(rgba, i, r, g, b) > threshold) return;
    rgba[i + 3] = 0;
    queue.push(p);
  };
  for (let xx = 0; xx < w; xx++) {
    enqueue(xx, 0);
    enqueue(xx, h - 1);
  }
  for (let yy = 0; yy < h; yy++) {
    enqueue(0, yy);
    enqueue(w - 1, yy);
  }
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    const xx = p % w;
    const yy = (p / w) | 0;
    enqueue(xx - 1, yy);
    enqueue(xx + 1, yy);
    enqueue(xx, yy - 1);
    enqueue(xx, yy + 1);
  }

  // Drop tiny disconnected label/heading remnants while preserving small
  // bubbles and sparkles that are intentionally separate.
  const seen = new Uint8Array(w * h);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const start = yy * w + xx;
      if (seen[start] || rgba[start * 4 + 3] <= 10) {
        seen[start] = 1;
        continue;
      }
      const pixels = [];
      const stack = [start];
      seen[start] = 1;
      while (stack.length) {
        const p = stack.pop();
        pixels.push(p);
        const px = p % w;
        const py = (p / w) | 0;
        for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = ny * w + nx;
          if (seen[np] || rgba[np * 4 + 3] <= 10) continue;
          seen[np] = 1;
          stack.push(np);
        }
      }
      if (pixels.length < 24) {
        for (const p of pixels) rgba[p * 4 + 3] = 0;
      }
    }
  }

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (rgba[(yy * w + xx) * 4 + 3] <= 10) continue;
      if (xx < minX) minX = xx;
      if (xx > maxX) maxX = xx;
      if (yy < minY) minY = yy;
      if (yy > maxY) maxY = yy;
    }
  }
  if (maxX < minX) return null;
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const cropped = Buffer.alloc(cw * ch * 4);
  for (let yy = 0; yy < ch; yy++) {
    for (let xx = 0; xx < cw; xx++) {
      const si = ((minY + yy) * w + (minX + xx)) * 4;
      const di = (yy * cw + xx) * 4;
      cropped[di] = rgba[si];
      cropped[di + 1] = rgba[si + 1];
      cropped[di + 2] = rgba[si + 2];
      cropped[di + 3] = rgba[si + 3];
    }
  }

  const out = await sharp(cropped, { raw: { width: cw, height: ch, channels: 4 } })
    .resize(192, 192, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'lanczos3',
    })
    .webp({ quality: 92, alphaQuality: 100, effort: 5 })
    .toBuffer();
  const file = path.join(OUT, `${icon.name}.webp`);
  fs.writeFileSync(file, out);
  console.log(icon.name, `${cw}x${ch}`, `${Math.round(out.length / 1024)}KB`);
  return { name: icon.name, file };
}

for (const icon of icons) {
  await extract(icon);
}
console.log('icons', meta.width, meta.height, '→', OUT);
