import { chromium } from 'playwright';

const SEA_ICONS = ['🦀', '⭐', '🐙', '🐚', '🐠', '🪼', '🐬', '🦑'];

const base = process.env.BASE_URL || 'https://draw-our-fish.izzaahyad03.workers.dev';
const browser = await chromium.launch({ headless: false });
const errors = [];
const contextA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageA = await contextA.newPage();
pageA.on('pageerror', (error) => errors.push(`A PAGEERROR ${error.message}`));
pageA.on('console', (message) => {
  if (message.type() === 'error') errors.push(`A CONSOLE ${message.text()}`);
});

await pageA.goto(base, { waitUntil: 'networkidle' });
await pageA.waitForSelector('.onboarding-card, .draw-fab', { timeout: 20000 });
if (await pageA.locator('.onboarding-card').isVisible().catch(() => false)) {
  await pageA.getByRole('button', { name: 'Lihat dulu' }).click();
}
await pageA.waitForSelector('.draw-fab');
await pageA.waitForTimeout(1000);

// Create a private room.
await pageA.locator('.dock-item').filter({ hasText: 'Ruang' }).click();
await pageA.waitForSelector('.room-panel');
await pageA.getByRole('button', { name: /Buat Ruang Bersama/ }).click();
await pageA.waitForSelector('.room-code-tile', { timeout: 10000 });
const code = (await pageA.locator('.room-code-tile').allTextContents()).map((value) => value.trim());
const indices = code.map((icon) => SEA_ICONS.indexOf(icon)).join('');
const invite = `${base}/?room=${indices}`;
console.log('INVITE_URL', invite);

// Deep-link join from a second browser context.
const contextB = await browser.newContext({ viewport: { width: 1100, height: 760 } });
const pageB = await contextB.newPage();
pageB.on('pageerror', (error) => errors.push(`B pageerror ${error.message}`));
pageB.on('console', (message) => {
  if (message.type() === 'error') errors.push(`B console ${message.text()}`);
});
await pageB.goto(invite, { waitUntil: 'networkidle' });
await pageB.waitForSelector('.onboarding-card, .draw-fab', { timeout: 20000 });
if (await pageB.locator('.onboarding-card').isVisible().catch(() => false)) {
  await pageB.getByRole('button', { name: 'Lihat dulu' }).click();
}
await pageB.waitForSelector('.draw-fab');
await pageB.waitForFunction(
  (expected) => document.querySelector('.room-label')?.textContent?.trim() === expected,
  code.join(' '),
  { timeout: 15000 },
);
await pageB.waitForTimeout(500);
const labelB = await pageB.locator('.room-label').innerText();
const countB = await pageB.locator('.fish-count').innerText();
const toastB = await pageB.locator('.toast').allTextContents();
console.log('DEEP_LINK_JOIN', JSON.stringify({ labelB, countB, toastB }));

await pageB.screenshot({ path: process.env.TEMP + '/dyf-deeplink.png' });
console.log('ERRORS', JSON.stringify(errors, null, 2));
await browser.close();
