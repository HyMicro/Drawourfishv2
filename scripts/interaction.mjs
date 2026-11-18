import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const outDir = path.join(process.env.TEMP || '.', 'dyf-interact');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: process.env.HEADLESS !== '0' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.goto(process.env.BASE_URL || 'http://localhost:8787/', { waitUntil: 'networkidle' });
await page.waitForSelector('.onboarding-card, .draw-fab');
if (await page.locator('.onboarding-card').isVisible().catch(() => false)) {
  await page.getByRole('button', { name: 'Lihat dulu' }).click();
}
await page.waitForSelector('.draw-fab');
await page.waitForTimeout(2200);

async function findOrangeFish() {
  const buffer = await page.screenshot();
  const png = PNG.sync.read(buffer);
  const points = [];
  for (let y = 120; y < 660; y += 2) {
    for (let x = 120; x < png.width - 120; x += 2) {
      const index = (png.width * y + x) * 4;
      const r = png.data[index];
      const g = png.data[index + 1];
      const b = png.data[index + 2];
      if (r > 185 && r > g + 10 && g > 100 && b < 140) points.push([x, y]);
    }
  }
  if (points.length < 40) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  return { x: sx / points.length, y: sy / points.length, count: points.length };
}

let opened = false;
for (let attempt = 0; attempt < 4 && !opened; attempt++) {
  const target = await findOrangeFish();
  if (!target) {
    await page.waitForTimeout(800);
    continue;
  }
  console.log('TAP_TARGET', target);
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(500);
  opened = await page.locator('.emote-menu').isVisible().catch(() => false);
  if (!opened) await page.waitForTimeout(600);
}
console.log('EMOTE_MENU_OPENED', opened);
if (opened) {
  await page.screenshot({ path: path.join(outDir, '01-emote-menu.png') });
  await page.getByRole('button', { name: /Hati/ }).click();
  await page.waitForTimeout(500);
  console.log('EMOTE_MENU_CLOSED', !(await page.locator('.emote-menu').isVisible().catch(() => false)));
}

// Long-press on another fish should open the same curated menu with hide.
let hideMenu = false;
for (let attempt = 0; attempt < 4 && !hideMenu; attempt++) {
  const target = await findOrangeFish();
  if (!target) {
    await page.waitForTimeout(800);
    continue;
  }
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.waitForTimeout(2100);
  hideMenu = await page.locator('.emote-menu').isVisible().catch(() => false);
  await page.mouse.up();
  if (!hideMenu) await page.waitForTimeout(500);
}
console.log('LONG_PRESS_MENU', hideMenu);
if (hideMenu) {
  await page.screenshot({ path: path.join(outDir, '02-longpress-menu.png') });
  const hide = page.locator('.emote-hide');
  if (await hide.isVisible().catch(() => false)) {
    await hide.click();
    await page.waitForTimeout(400);
    console.log('HIDE_ACTION_OK', !(await page.locator('.emote-menu').isVisible().catch(() => false)));
  }
}

await page.screenshot({ path: path.join(outDir, '03-after.png') });
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
