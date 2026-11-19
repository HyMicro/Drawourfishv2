import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join(process.env.TEMP || '.', 'dyf-multi');
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.BASE_URL || 'http://localhost:8787';

const browser = await chromium.launch({ headless: process.env.HEADLESS !== '0' });
const contextA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const contextB = await browser.newContext({ viewport: { width: 1100, height: 760 } });
const pageA = await contextA.newPage();
const pageB = await contextB.newPage();
const errors = [];
for (const [label, page] of [['A', pageA], ['B', pageB]]) {
  page.on('pageerror', (error) => errors.push(`${label} PAGEERROR ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${label} CONSOLE ${message.text()}`);
  });
}

async function enter(page) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.onboarding-card, .draw-fab', { timeout: 20000 });
  if (await page.locator('.onboarding-card').isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Lihat dulu' }).click();
  }
  await page.waitForSelector('.draw-fab');
  await page.waitForTimeout(1200);
}

await enter(pageA);
await enter(pageB);

// A draws and releases a fish into the global ocean.
await pageA.locator('.draw-fab').click();
await pageA.waitForSelector('.studio-panel');
const box = await pageA.locator('.drawing-canvas').boundingBox();
await pageA.locator('.swatch').nth(0).click();
await pageA.locator('.tool-chip').filter({ hasText: 'Ember' }).click();
await pageA.locator('.swatch').nth(4).click();
await pageA.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
await pageA.waitForTimeout(350);
await pageA.locator('.name-pill input').fill('Global Gupi');
await pageA.locator('.finish-top').click();
await pageA.waitForSelector('.studio-panel', { state: 'detached' });
await pageA.waitForTimeout(1600);

// B must receive the fish without any room code or room UI.
await pageB.waitForFunction(
  () => Number(document.querySelector('.fish-count')?.textContent || 0) >= 3,
  null,
  { timeout: 15000 },
);
await pageB.waitForTimeout(700);
const countA = await pageA.locator('.fish-count').innerText();
const countB = await pageB.locator('.fish-count').innerText();
const statusA = await pageA.locator('.ocean-label').innerText();
const statusB = await pageB.locator('.ocean-label').innerText();
console.log('GLOBAL_SYNC', JSON.stringify({ statusA, statusB, countA, countB }));

await pageA.screenshot({ path: path.join(outDir, '01-global-a.png') });
await pageB.screenshot({ path: path.join(outDir, '02-global-b.png') });

// Feed from A while B watches.
await pageA.locator('.dock-item').filter({ hasText: 'Pakan' }).click();
await pageA.waitForTimeout(500);
await pageA.mouse.click(700, 300);
await pageA.waitForTimeout(800);
await pageA.screenshot({ path: path.join(outDir, '03-feed-a.png') });
await pageB.screenshot({ path: path.join(outDir, '04-feed-b.png') });

// B's local collection stays private.
await pageB.locator('.dock-item').filter({ hasText: 'Ikanku' }).click();
await pageB.waitForSelector('.collection-panel');
const bCollectionCount = await pageB.locator('.fish-card').count();
console.log('B_COLLECTION_COUNT', bCollectionCount);
await pageB.locator('.collection-panel .sheet-header .icon-btn').click();

// Remove the test fish from backend storage.
await pageA.locator('.dock-item').filter({ hasText: 'Ikanku' }).click();
await pageA.waitForSelector('.collection-panel');
await pageA.waitForTimeout(400);
const aCard = pageA.locator('.fish-card').filter({ hasText: 'Global Gupi' }).first();
if (await aCard.count()) {
  await aCard.locator('.glass-btn.danger').click();
  await aCard.locator('.delete-confirm .mini-btn.danger').click();
  await pageA.waitForTimeout(500);
}
await pageA.locator('.collection-panel .sheet-header .icon-btn').click();

console.log('MULTI_ERRORS', JSON.stringify(errors, null, 2));
console.log('SHOTS', outDir);
await browser.close();
