import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join(process.env.TEMP || '.', 'dyf-shots');
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.BASE_URL || 'http://localhost:8787';

const browser = await chromium.launch({
  headless: process.env.HEADLESS === '1',
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});

async function desktop() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`PAGEERROR: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`CONSOLE: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    if (!request.url().includes('/ws')) errors.push(`REQFAIL: ${request.url()} ${request.failure()?.errorText}`);
  });

  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.create-fab', { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '01-onboarding.png') });

  await page.getByRole('button', { name: 'Lihat akuarium dulu' }).click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(outDir, '02-aquarium.png') });

  await page.locator('.create-fab').click();
  await page.waitForSelector('.studio-panel');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '03-studio.png') });

  const canvas = page.locator('.drawing-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas bounding box');

  await page.locator('.swatch').nth(2).click();
  await page.mouse.move(box.x + box.width * 0.34, box.y + box.height * 0.4);
  await page.mouse.down();
  for (let i = 0; i <= 16; i++) {
    await page.mouse.move(
      box.x + box.width * (0.34 + i * 0.02),
      box.y + box.height * (0.4 + Math.sin(i / 2) * 0.08),
      { steps: 2 },
    );
  }
  await page.mouse.up();

  await page.locator('.swatch').nth(6).click();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.35);
  await page.mouse.down();
  for (let i = 0; i <= 10; i++) {
    await page.mouse.move(box.x + box.width * (0.7 - i * 0.02), box.y + box.height * (0.35 + i * 0.02), { steps: 2 });
  }
  await page.mouse.up();
  await page.waitForTimeout(300);

  // Flood fill centre of the fish.
  await page.locator('.tool-button').filter({ hasText: 'Ember' }).click();
  await page.locator('.palette-grid').scrollIntoViewIfNeeded();
  const swatch = page.locator('.swatch').nth(5);
  await swatch.click();
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
  await page.waitForTimeout(400);

  await page.screenshot({ path: path.join(outDir, '04-studio-painted.png') });

  // Undo test.
  await page.locator('.tool-button').filter({ hasText: 'Undo' }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, '05-studio-undo.png') });

  const nameInput = page.locator('.name-pill input');
  await nameInput.fill('Mochi Uji');
  await page.locator('.finish-top').click();
  await page.waitForSelector('.studio-panel', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(outDir, '06-aquarium-new-fish.png') });

  await page.locator('.dock-item').filter({ hasText: 'Ikanku' }).click();
  await page.waitForSelector('.collection-panel');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '07-collection.png') });
  await page.locator('.collection-panel .sheet-header .icon-btn').click();

  await page.locator('.dock-item').filter({ hasText: 'Ruang' }).click();
  await page.waitForSelector('.room-panel');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '08-room.png') });
  await page.locator('.room-panel .sheet-header .icon-btn').click();

  await page.locator('.dock-item').filter({ hasText: 'Foto' }).click();
  await page.waitForSelector('.photo-preview-frame img', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '09-photo.png') });
  await page.locator('.photo-topbar .icon-btn').click();
  await page.waitForTimeout(500);

  // Textures and scene sanity check.
  const sanity = await page.evaluate(() => {
    const canvas = document.querySelector('.aquarium-root canvas');
    return {
      canvas: Boolean(canvas),
      canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
      buttons: document.querySelectorAll('button').length,
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  });

  console.log('DESKTOP_SANITY', JSON.stringify(sanity));
  console.log('DESKTOP_ERRORS', JSON.stringify(errors, null, 2));
  await context.close();
  return errors;
}

async function mobile() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`PAGEERROR: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`CONSOLE: ${message.text()}`);
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.create-fab', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '10-mobile-onboarding.png') });
  await page.getByRole('button', { name: 'Lihat akuarium dulu' }).click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(outDir, '11-mobile-aquarium.png') });

  await page.locator('.create-fab').click();
  await page.waitForSelector('.studio-panel');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, '12-mobile-studio.png') });

  const finished = await page.locator('.studio-mobile-footer .glass-btn').isVisible();
  console.log('MOBILE_FINISH_VISIBLE', finished);
  console.log('MOBILE_ERRORS', JSON.stringify(errors, null, 2));
  await context.close();
  return errors;
}

const desktopErrors = await desktop();
const mobileErrors = await mobile();
console.log('SHOTS_DIR', outDir);
console.log('TOTAL_ERRORS', desktopErrors.length + mobileErrors.length);
await browser.close();
