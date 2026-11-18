import fs from 'node:fs';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });

async function make(src, size, out) {
  const svg = fs.readFileSync(src, 'utf8');
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.waitForTimeout(150);
  await page.screenshot({ path: out, omitBackground: true });
  await page.close();
}

await make('public/icon.svg', 512, 'public/icon-512.png');
await make('public/icon.svg', 192, 'public/icon-192.png');
await make('public/icon-maskable.svg', 512, 'public/icon-maskable-512.png');
await make('public/icon.svg', 180, 'public/apple-touch-icon.png');
await browser.close();
console.log('icons rebuilt');
