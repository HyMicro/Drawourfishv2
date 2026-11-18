import { chromium } from 'playwright';
import { WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';

const textureData =
  'data:image/webp;base64,' +
  fs.readFileSync(path.resolve('scripts/fixtures/fish.webp')).toString('base64');
const browser = await chromium.launch({ headless: process.env.HEADLESS !== '0', args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
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
await page.waitForTimeout(500);

const clients = [];
const templates = ['clownfish', 'goldfish', 'puffer', 'shark', 'angelfish', 'tang', 'spotfish', 'grouper', 'bubblefish', 'babyfish'];

for (let c = 0; c < 6; c++) {
  const ws = new WebSocket('ws://localhost:8787/ws');
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  ws.on('message', () => {});
  ws.send(JSON.stringify({ type: 'HELLO', ownerId: `perf-owner-${c}000-1111` }));
  clients.push(ws);
}
await new Promise((resolve) => setTimeout(resolve, 400));

let fishIndex = 0;
for (const [clientIndex, ws] of clients.entries()) {
  for (let f = 0; f < 3; f++) {
    const i = fishIndex++;
    ws.send(
      JSON.stringify({
        type: 'FISH_SPAWN',
        fish: {
          id: `perf-fish-${String(i).padStart(4, '0')}`,
          ownerId: 'ignored-by-server',
          name: `Perf ${i}`,
          templateId: templates[i % templates.length],
          textureData,
          createdAt: Date.now(),
          transform: {
            x: 0.08 + (i % 8) * 0.11,
            y: 0.22 + Math.floor(i / 8) * 0.12,
            targetX: 0.2 + (i % 6) * 0.1,
            targetY: 0.3,
            speed: 0.45,
            facing: 1,
          },
          state: 'WANDER',
        },
      }),
    );
  }
}
await page.waitForTimeout(3500);
const hudCount = await page.locator('.fish-count').innerText();
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const loop = () => {
        frames++;
        if (performance.now() - start < 3000) requestAnimationFrame(loop);
        else resolve(Math.round((frames * 1000) / (performance.now() - start)));
      };
      requestAnimationFrame(loop);
    }),
);
await page.screenshot({ path: process.env.TEMP + '/dyf-perf.png', animations: 'disabled' });
console.log('FISH_HUD', hudCount, 'FPS', fps, 'ERRORS', JSON.stringify(errors));
for (const ws of clients) ws.close();
await browser.close();
