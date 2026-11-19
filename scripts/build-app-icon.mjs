import fs from 'node:fs';
import sharp from 'sharp';

const fishPng = await sharp('public/icons/goldfish.webp')
  .resize(720, null, { kernel: 'lanczos3' })
  .png()
  .toBuffer();
const fishMeta = await sharp(fishPng).metadata();
const fishAspect = (fishMeta.height || 1) / (fishMeta.width || 1);
const fishHref = '/icons/goldfish.webp';

function art(maskable, withFish) {
  const radius = maskable ? 0 : 118;
  const scale = maskable ? 0.7 : 0.84;
  const fw = 720 * scale;
  const fh = fw * fishAspect;
  const fx = Math.round((1024 - fw) / 2);
  const fy = Math.round((1024 - fh) / 2) + 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fffaf0"/>
      <stop offset="0.52" stop-color="#ffe9c9"/>
      <stop offset="1" stop-color="#bfe8e3"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffd36e"/>
      <stop offset="1" stop-color="#f4a259"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" rx="${radius}" fill="url(#bg)"/>
  <circle cx="790" cy="214" r="86" fill="url(#sun)" opacity="0.9"/>
  <circle cx="790" cy="214" r="112" fill="none" stroke="#f4a259" stroke-width="7" opacity="0.5"/>
  <g fill="none" stroke="#7fc9c4" stroke-width="9" opacity="0.65">
    <circle cx="212" cy="210" r="30"/>
    <circle cx="150" cy="330" r="15"/>
    <circle cx="800" cy="720" r="26"/>
  </g>
  <path d="M0 790 C150 742 322 812 512 838 C700 864 868 812 1024 776 L1024 1024 L0 1024 Z" fill="#f2d0a4" opacity="0.88"/>
  <ellipse cx="512" cy="748" rx="250" ry="34" fill="#c18c5c" opacity="0.16"/>
  ${withFish ? `<image href="${fishHref}" x="${fx}" y="${fy}" width="${fw}" height="${fh}"/>` : ''}
</svg>`;
}

const iconSvg = art(false, true);
const maskableSvg = art(true, true);
fs.writeFileSync('public/icon.svg', iconSvg);
fs.writeFileSync('public/icon-maskable.svg', maskableSvg);

async function png(maskable, size, out) {
  const bg = await sharp(Buffer.from(art(maskable, false))).png().toBuffer();
  const scale = maskable ? 0.7 : 0.84;
  const fw = Math.round(720 * scale);
  const fh = Math.round(fw * fishAspect);
  const fx = Math.round((1024 - fw) / 2);
  const fy = Math.round((1024 - fh) / 2) + 24;
  const fish = await sharp(fishPng).resize(fw, fh).png().toBuffer();
  const composed = await sharp(bg)
    .composite([{ input: fish, left: fx, top: fy }])
    .png()
    .toBuffer();
  const outBuf = await sharp(composed).resize(size, size).png().toBuffer();
  fs.writeFileSync(out, outBuf);
  console.log(out, `${Math.round(outBuf.length / 1024)}KB`);
}

await png(false, 512, 'public/icon-512.png');
await png(false, 192, 'public/icon-192.png');
await png(false, 180, 'public/apple-touch-icon.png');
await png(true, 512, 'public/icon-maskable-512.png');
console.log('app icon rebuilt from supplied goldfish art');
