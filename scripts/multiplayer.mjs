import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join(process.env.TEMP || '.', 'dyf-multi');
fs.mkdirSync(outDir, { recursive: true });
const base = 'http://localhost:8787';

const browser = await chromium.launch({ headless: false });
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
  await page.waitForSelector('.create-fab', { timeout: 20000 });
  if (await page.locator('.onboarding-card').isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Lihat akuarium dulu' }).click();
  }
  await page.waitForTimeout(1200);
}

await enter(pageA);
await enter(pageB);

// Draw and release a fish on A.
await pageA.locator('.create-fab').click();
await pageA.waitForSelector('.studio-panel');
const box = await pageA.locator('.drawing-canvas').boundingBox();
await pageA.locator('.swatch').nth(9).click();
await pageA.locator('.tool-button').filter({ hasText: 'Ember' }).click();
await pageA.locator('.swatch').nth(5).click();
await pageA.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
await pageA.waitForTimeout(350);
await pageA.locator('.name-pill input').fill('Coral Multi');
await pageA.locator('.finish-top').click();
await pageA.waitForSelector('.studio-panel', { state: 'detached' });
await pageA.waitForTimeout(1400);

// A creates a private room.
await pageA.locator('.dock-item').filter({ hasText: 'Ruang' }).click();
await pageA.waitForSelector('.room-panel');
await pageA.getByRole('button', { name: /Buat Ruang Bersama/ }).click();
await pageA.waitForSelector('.room-code-tile', { timeout: 10000 });
await pageA.waitForTimeout(700);
const code = await pageA.locator('.room-code-tile').allTextContents();
console.log('ROOM_CODE', code);
await pageA.screenshot({ path: path.join(outDir, '01-room-a.png') });

// B joins using the four icons.
await pageB.locator('.dock-item').filter({ hasText: 'Ruang' }).click();
await pageB.waitForSelector('.room-panel');
for (const icon of code) {
  await pageB.locator('.icon-pick').filter({ hasText: icon.trim() }).first().click();
  await pageB.waitForTimeout(120);
}
await pageB.getByRole('button', { name: /Gabung/ }).click();
await pageB.waitForTimeout(1800);
await pageB.screenshot({ path: path.join(outDir, '02-room-b-joined.png') });

const countA = await pageA.locator('.room-chip-count').innerText();
const countB = await pageB.locator('.room-chip-count').innerText();
const roomLabelA = await pageA.locator('.room-chip-label').innerText();
const roomLabelB = await pageB.locator('.room-chip-label').innerText();
console.log('SYNCED_ROOM', JSON.stringify({ roomLabelA, roomLabelB, countA, countB }));

// Close both room sheets so the aquarium is interactable again.
await pageA.locator('.room-panel .sheet-header .icon-btn').click();
await pageB.locator('.room-panel .sheet-header .icon-btn').click();
await pageA.waitForTimeout(500);

// Feed from A while B watches.
await pageA.locator('.dock-item').filter({ hasText: 'Pakan' }).click();
await pageA.waitForTimeout(500);
await pageA.mouse.click(700, 300);
await pageA.waitForTimeout(800);
await pageA.screenshot({ path: path.join(outDir, '03-aquarium-a.png') });
await pageB.screenshot({ path: path.join(outDir, '04-aquarium-b.png') });

// Open collection on B and verify remote fish is not in the local collection.
await pageB.locator('.dock-item').filter({ hasText: 'Ikanku' }).click();
await pageB.waitForSelector('.collection-panel');
const bCollectionCount = await pageB.locator('.fish-card').count();
console.log('B_COLLECTION_COUNT', bCollectionCount);
await pageB.locator('.collection-panel .sheet-header .icon-btn').click();

console.log('MULTI_ERRORS', JSON.stringify(errors, null, 2));
console.log('SHOTS', outDir);
await browser.close();
