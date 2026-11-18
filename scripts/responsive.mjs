import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join(process.env.TEMP || '.', 'dyf-responsive');
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.BASE_URL || 'http://localhost:8787';
const browser = await chromium.launch({ headless: process.env.HEADLESS !== '0' });
const errors = [];

async function check(name, width, height, touch = false) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: touch ? 2 : 1,
    isMobile: touch,
    hasTouch: touch,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${name}: ${message.text()}`);
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.onboarding-card, .draw-fab', { timeout: 20000 });
  if (await page.locator('.onboarding-card').isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Lihat dulu' }).click();
  }
  await page.waitForSelector('.draw-fab');
  await page.waitForTimeout(900);
  const home = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    dock: document.querySelector('.dock')?.getBoundingClientRect().toJSON(),
  }));
  await page.screenshot({ path: path.join(outDir, `${name}-home.png`) });
  await page.locator('.draw-fab').click();
  await page.waitForSelector('.studio-panel');
  await page.waitForTimeout(500);
  const studio = await page.evaluate(() => {
    const panel = document.querySelector('.studio-panel');
    const canvas = document.querySelector('.canvas-stage');
    const footer = document.querySelector('.studio-mobile-footer');
    return {
      panel: panel?.getBoundingClientRect().toJSON(),
      canvas: canvas?.getBoundingClientRect().toJSON(),
      footerVisible: footer ? getComputedStyle(footer).display !== 'none' : false,
      finishTopVisible: getComputedStyle(document.querySelector('.finish-top')).display !== 'none',
    };
  });
  await page.screenshot({ path: path.join(outDir, `${name}-studio.png`) });
  console.log(name, JSON.stringify({ home, studio }));
  await context.close();
}

await check('ipad-landscape', 1024, 768, true);
await check('ipad-portrait', 820, 1180, true);
await check('phone-small', 320, 700, true);
await check('phone-landscape', 844, 390, true);
console.log('ERRORS', JSON.stringify(errors));
console.log('SHOTS', outDir);
await browser.close();
