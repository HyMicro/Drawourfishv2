import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import sharp from 'sharp';

const SHEET = 'source-assets/template-ikan.png';
const OUT = path.resolve('public/fish');
fs.mkdirSync(OUT, { recursive: true });

const src = PNG.sync.read(fs.readFileSync(SHEET));

const cells = [
  { id: 'goldfish', label: 'Goldfish', accent: '#F2A35C', flip: true, box: { x: 160, y: 0, w: 430, h: 282 } },
  { id: 'puffer', label: 'Pufferfish', accent: '#F4C95D', box: { x: 550, y: 0, w: 500, h: 282 } },
  { id: 'bubblefish', label: 'Bubblefish', accent: '#7FCBD8', box: { x: 150, y: 292, w: 405, h: 214 } },
  { id: 'clownfish', label: 'Clownfish', accent: '#EE7D54', flip: true, box: { x: 525, y: 290, w: 520, h: 222 } },
  { id: 'tang', label: 'Blue Tang', accent: '#72A7E8', flip: true, box: { x: 155, y: 525, w: 415, h: 200 } },
  { id: 'shark', label: 'Baby Shark', accent: '#89AFCB', flip: true, box: { x: 505, y: 525, w: 560, h: 220 } },
  { id: 'babyfish', label: 'Baby Fish', accent: '#F3B59E', box: { x: 218, y: 738, w: 320, h: 140 } },
  { id: 'spotfish', label: 'Spotfish', accent: '#A5C97A', flip: true, box: { x: 535, y: 730, w: 480, h: 182 } },
  { id: 'grouper', label: 'Grouper', accent: '#8DC7A3', box: { x: 148, y: 928, w: 445, h: 384 } },
  { id: 'angelfish', label: 'Angelfish', accent: '#A9B9F0', flip: true, box: { x: 525, y: 928, w: 465, h: 384 } },
];

const SQUARE = 640;
const DETAIL_QUALITY = 84;

function cropSheet(box) {
  const x = Math.max(0, Math.min(src.width - 1, box.x));
  const y = Math.max(0, Math.min(src.height - 1, box.y));
  const w = Math.min(src.width - x, box.w);
  const h = Math.min(src.height - y, box.h);
  const out = new PNG({ width: w, height: h });
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const si = ((y + yy) * src.width + (x + xx)) * 4;
      const di = (yy * w + xx) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

/** Keep only the center/largest alpha blob, removing slivers from neighbours. */
function cleanAlpha(image) {
  const w = image.width;
  const h = image.height;
  const n = w * h;

  // Close hairline gaps between fins and the body before selecting the main
  // blob. Without this, a 1px antialiasing gap makes a fin look like a
  // separate component and it gets discarded.
  const solid = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if (image.data[p * 4 + 3] > 20) solid[p] = 1;
  }
  const R = 1;
  const dil = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if (!solid[p]) continue;
    const x = p % w;
    const y = (p / w) | 0;
    for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy++) {
      for (let xx = Math.max(0, x - R); xx <= Math.min(w - 1, x + R); xx++) {
        dil[yy * w + xx] = 1;
      }
    }
  }
  const closed = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if (!dil[p]) continue;
    const x = p % w;
    const y = (p / w) | 0;
    let full = true;
    for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R) && full; yy++) {
      for (let xx = Math.max(0, x - R); xx <= Math.min(w - 1, x + R); xx++) {
        if (!dil[yy * w + xx]) {
          full = false;
          break;
        }
      }
    }
    if (full) closed[p] = 1;
  }

  const seen = new Uint8Array(n);
  let best = null;
  for (let p = 0; p < n; p++) {
    if (seen[p] || !closed[p]) continue;
    const pixels = [];
    const stack = [p];
    seen[p] = 1;
    while (stack.length) {
      const q = stack.pop();
      pixels.push(q);
      const qx = q % w;
      const qy = (q / w) | 0;
      for (const [nx, ny] of [[qx - 1, qy], [qx + 1, qy], [qx, qy - 1], [qx, qy + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nq = ny * w + nx;
        if (seen[nq] || !closed[nq]) continue;
        seen[nq] = 1;
        stack.push(nq);
      }
    }
    if (!best || pixels.length > best.length) best = pixels;
  }
  if (!best) return null;
  const keep = new Uint8Array(n);
  for (const p of best) keep[p] = 1;
  for (let p = 0; p < n; p++) {
    if (!keep[p]) image.data[p * 4 + 3] = 0;
  }
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let p = 0; p < n; p++) {
    if (image.data[p * 4 + 3] <= 20) continue;
    const x = p % w;
    const y = (p / w) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX < minX) return null;
  const pad = 5;
  const bx = Math.max(0, minX - pad);
  const by = Math.max(0, minY - pad);
  const bw = Math.min(w - bx, maxX - minX + 1 + pad * 2);
  const bh = Math.min(h - by, maxY - minY + 1 + pad * 2);
  const trimmed = new PNG({ width: bw, height: bh });
  for (let yy = 0; yy < bh; yy++) {
    for (let xx = 0; xx < bw; xx++) {
      const si = ((by + yy) * w + (bx + xx)) * 4;
      const di = (yy * bw + xx) * 4;
      trimmed.data[di] = image.data[si];
      trimmed.data[di + 1] = image.data[si + 1];
      trimmed.data[di + 2] = image.data[si + 2];
      trimmed.data[di + 3] = image.data[si + 3];
    }
  }
  return trimmed;
}

function isDark(image, x, y) {
  const i = (y * image.width + x) * 4;
  if (image.data[i + 3] < 40) return false;
  const lum = 0.2126 * image.data[i] + 0.7152 * image.data[i + 1] + 0.0722 * image.data[i + 2];
  return lum < 155;
}

function analyzeFish(image) {
  const w = image.width;
  const h = image.height;
  const n = w * h;
  const dark = new Uint8Array(n);
  let alphaCount = 0;
  for (let p = 0; p < n; p++) {
    if (image.data[p * 4 + 3] > 20) alphaCount++;
    if (isDark(image, p % w, (p / w) | 0)) dark[p] = 1;
  }

  // A band K pixels deep from the transparent border becomes the white
  // sticker rim. This is independent of whether an outline has small gaps.
  const K = 6;
  const depth = new Int16Array(n).fill(-1);
  const q = [];
  for (let p = 0; p < n; p++) {
    if (image.data[p * 4 + 3] <= 20) {
      depth[p] = 0;
      q.push(p);
    }
  }
  const band = new Uint8Array(n);
  for (let head = 0; head < q.length; head++) {
    const p = q[head];
    const d = depth[p];
    if (d >= K) continue;
    const x = p % w;
    const y = (p / w) | 0;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (depth[np] !== -1 || image.data[np * 4 + 3] <= 20) continue;
      depth[np] = d + 1;
      band[np] = 1;
      q.push(np);
    }
  }

  // Find small enclosed light areas (eye sclera, white spots) and preserve them.
  const exterior = new Uint8Array(n);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (exterior[p] || dark[p]) return;
    exterior[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p / w) | 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }

  const seen = new Uint8Array(n);
  const smallDetail = new Uint8Array(n);
  const limit = Math.min(420, Math.max(120, alphaCount * 0.008));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (seen[start] || exterior[start] || dark[start]) continue;
      if (image.data[start * 4 + 3] <= 20) continue;
      const pixels = [];
      const st = [start];
      seen[start] = 1;
      while (st.length) {
        const p = st.pop();
        pixels.push(p);
        const px = p % w;
        const py = (p / w) | 0;
        for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = ny * w + nx;
          if (seen[np] || exterior[np] || dark[np] || image.data[np * 4 + 3] <= 20) continue;
          seen[np] = 1;
          st.push(np);
        }
      }
      if (pixels.length < limit) {
        for (const p of pixels) smallDetail[p] = 1;
      }
    }
  }

  const details = new PNG({ width: w, height: h });
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const keep = band[p] || dark[p] || smallDetail[p];
    details.data[i] = image.data[i];
    details.data[i + 1] = image.data[i + 1];
    details.data[i + 2] = image.data[i + 2];
    details.data[i + 3] = keep ? image.data[i + 3] : 0;
  }
  return { details };
}

function colorize(shape, details, accent) {
  const hex = accent.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const out = new PNG({ width: shape.width, height: shape.height });
  for (let p = 0; p < shape.width * shape.height; p++) {
    const i = p * 4;
    const da = details.data[i + 3];
    if (da > 0) {
      out.data[i] = details.data[i];
      out.data[i + 1] = details.data[i + 1];
      out.data[i + 2] = details.data[i + 2];
      out.data[i + 3] = da;
    } else if (shape.data[i + 3] > 0) {
      out.data[i] = r;
      out.data[i + 1] = g;
      out.data[i + 2] = b;
      out.data[i + 3] = shape.data[i + 3];
    }
  }
  return out;
}

async function squarePng(source, size) {
  return sharp(source)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'lanczos3',
    })
    .png()
    .toBuffer();
}

async function writeWebp(file, buffer, options, resize) {
  let pipeline = sharp(buffer);
  if (resize) {
    pipeline = pipeline.resize(resize.width, resize.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'lanczos3',
    });
  }
  const webp = await pipeline.webp(options).toBuffer();
  fs.writeFileSync(file, webp);
  return webp.length;
}

const results = [];
for (const cell of cells) {
  const cropped = cropSheet(cell.box);
  const clean = cleanAlpha(cropped);
  if (!clean) {
    console.log('EMPTY', cell.id);
    continue;
  }
  const { details } = analyzeFish(clean);
  // White alpha silhouette: paint is masked to this shape, then the rim and
  // outline are drawn over the paint.
  const shape = new PNG({ width: clean.width, height: clean.height });
  for (let p = 0; p < clean.width * clean.height; p++) {
    const i = p * 4;
    if (clean.data[i + 3] > 20) {
      shape.data[i] = 255;
      shape.data[i + 1] = 255;
      shape.data[i + 2] = 255;
      shape.data[i + 3] = 255;
    }
  }
  const shapeFlipped = cell.flip
    ? await sharp(PNG.sync.write(shape)).flop().png().toBuffer()
    : PNG.sync.write(shape);
  const detailsFlipped = cell.flip
    ? await sharp(PNG.sync.write(details)).flop().png().toBuffer()
    : PNG.sync.write(details);
  const shapeSquare = await squarePng(shapeFlipped, SQUARE);
  const detailSquare = await squarePng(detailsFlipped, SQUARE);
  const shapeBytes = await writeWebp(path.join(OUT, `${cell.id}-shape.webp`), shapeSquare, {
    lossless: true,
    alphaQuality: 100,
    effort: 4,
  });
  const detailBytes = await writeWebp(path.join(OUT, `${cell.id}-details.webp`), detailSquare, {
    quality: DETAIL_QUALITY,
    alphaQuality: 95,
    effort: 4,
  });

  const flippedShape = PNG.sync.read(shapeFlipped);
  const flippedDetails = PNG.sync.read(detailsFlipped);
  const colored = colorize(flippedShape, flippedDetails, cell.accent);
  const coloredSquare = await squarePng(PNG.sync.write(colored), SQUARE);
  const thumbBytes = await writeWebp(
    path.join(OUT, `${cell.id}-thumb.webp`),
    coloredSquare,
    { quality: 88, alphaQuality: 95, effort: 4 },
    { width: 256, height: 256 },
  );
  const textureBytes = await writeWebp(
    path.join(OUT, `${cell.id}-texture.webp`),
    coloredSquare,
    { quality: 88, alphaQuality: 95, effort: 4 },
    { width: 384, height: 384 },
  );

  const meta = await sharp(detailSquare).metadata();
  results.push({
    id: cell.id,
    label: cell.label,
    accent: cell.accent,
    width: meta.width,
    height: meta.height,
    bytes: {
      shape: shapeBytes,
      details: detailBytes,
      thumb: thumbBytes,
      texture: textureBytes,
    },
  });
  console.log(
    'built',
    cell.id,
    `${clean.width}x${clean.height}`,
    `shape ${Math.round(shapeBytes / 1024)}KB details ${Math.round(detailBytes / 1024)}KB thumb ${Math.round(
      thumbBytes / 1024,
    )}KB texture ${Math.round(textureBytes / 1024)}KB`,
  );
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(results, null, 2));
console.log('Done', results.length);
