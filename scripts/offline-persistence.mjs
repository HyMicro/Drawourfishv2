import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join(process.env.TEMP || '.', 'dyf-offline');
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.BASE_URL || 'http://localhost:8787';
const browser = await chromium.launch({ headless: process.env.HEADLESS !== '0' });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('WebSocket')) errors.push(`CONSOLE ${message.text()}`);
});

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('.onboarding-card, .draw-fab');
if (await page.locator('.onboarding-card').isVisible().catch(() => false)) {
  await page.getByRole('button', { name: 'Gambar Ikan Pertamaku' }).click();
} else {
  await page.waitForSelector('.draw-fab');
  await page.locator('.draw-fab').click();
}
await page.waitForSelector('.studio-panel');
const box = await page.locator('.drawing-canvas').boundingBox();
await page.locator('.swatch').nth(2).click();
await page.locator('.tool-chip').filter({ hasText: 'Ember' }).click();
await page.locator('.swatch').nth(5).click();
await page.mouse.click(box.x + box.width * 0.53, box.y + box.height * 0.56);
await page.waitForTimeout(350);
await page.locator('.name-pill input').fill('Pip Persist');
await page.locator('.finish-top').click();
await page.waitForSelector('.studio-panel', { state: 'detached' });
await page.waitForTimeout(1200);

// Verify service worker takes control and has cached hashed assets.
const swState = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return { supported: false };
  const registration = await navigator.serviceWorker.ready;
  await new Promise((resolve) => setTimeout(resolve, 800));
  const controller = Boolean(navigator.serviceWorker.controller);
  const keys = await caches.keys();
  const shell = keys.find((key) => key.includes('shell')) || null;
  const cache = shell ? await caches.open(shell) : null;
  const cached = cache ? (await cache.keys()).map((request) => request.url) : [];
  return {
    supported: true,
    controller,
    keys,
    hasJs: cached.some((url) => url.includes('/assets/index-') && url.endsWith('.js')),
    hasCss: cached.some((url) => url.endsWith('.css')),
    count: cached.length,
    registrationScope: registration.scope,
  };
});
console.log('SW_STATE', JSON.stringify(swState, null, 2));

// Reload online: fish should come back from the backend.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.draw-fab');
await page.waitForTimeout(1500);
const fishCount = await page.locator('.fish-count').innerText();
await page.locator('.dock-item').filter({ hasText: 'Ikanku' }).click();
await page.waitForSelector('.collection-panel');
const cards = await page.locator('.fish-card').count();
const fishName = await page.locator('.fish-card-title strong').first().innerText().catch(() => null);
console.log('PERSISTENCE', JSON.stringify({ cards, fishName, fishCount }));
await page.screenshot({ path: path.join(outDir, '01-persisted.png') });
const persistCard = page.locator('.fish-card').filter({ hasText: 'Pip Persist' }).first();
if (await persistCard.count()) {
  await persistCard.locator('.glass-btn.danger').click();
  await persistCard.locator('.delete-confirm .mini-btn.danger').click();
  await page.waitForTimeout(500);
}
await page.locator('.collection-panel .sheet-header .icon-btn').click();

// Photo booth + download while online.
await page.locator('.dock-item').filter({ hasText: 'Foto' }).click();
await page.waitForSelector('.photo-preview-frame img', { timeout: 15000 });
await page.waitForTimeout(300);
const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
await page.getByRole('button', { name: /Unduh PNG/ }).click();
const download = await downloadPromise;
console.log('PHOTO_DOWNLOAD', download ? download.suggestedFilename() : null);
await page.screenshot({ path: path.join(outDir, '03-photo.png') });
await page.locator('.photo-topbar .icon-btn').click();
await page.waitForTimeout(400);

// Cold offline reload via the service worker. WebSocket fails gracefully into
// Local Reef with resident fish and no technical error modal.
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForSelector('.draw-fab', { timeout: 20000 });
await page.waitForFunction(
  () => document.querySelector('.ocean-label')?.textContent === 'Local Reef',
  null,
  { timeout: 20000 },
);
await page.waitForTimeout(1200);
const offlineReloadLabel = await page.locator('.ocean-label').innerText();
const offlineCount = await page.locator('.fish-count').innerText();
const technicalToasts = await page.locator('.toast').filter({ hasText: /error|failed|websocket|gagal|error teknis/i }).count();
console.log('OFFLINE_RELOAD', JSON.stringify({ offlineReloadLabel, offlineCount, technicalToasts }));
await page.screenshot({ path: path.join(outDir, '04-offline-reload.png') });
await context.setOffline(false);

console.log('ERRORS', JSON.stringify(errors, null, 2));
console.log('SHOTS', outDir);
await browser.close();
