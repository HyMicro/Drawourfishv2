import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
async function make(src, size, out) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="http://localhost:8787/${src}">`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, omitBackground: true });
  await page.close();
}
await make('icon.svg', 512, 'public/icon-512.png');
await make('icon.svg', 192, 'public/icon-192.png');
await make('icon-maskable.svg', 512, 'public/icon-maskable-512.png');
await make('icon.svg', 180, 'public/apple-touch-icon.png');
await browser.close();
