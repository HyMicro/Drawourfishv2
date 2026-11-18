/* Draw Our Fish — offline shell + runtime asset cache. */
const VERSION = 'dyf-v2.1.1';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

/** Cache the hashed Vite assets (and their fonts) so a cold offline reload works. */
async function precacheBuildAssets() {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch('/', { cache: 'reload' });
    if (!response.ok) return;
    await cache.put('/', response.clone());
    const html = await response.text();
    const assets = new Set();
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const value = match[1];
      if (value.startsWith('/assets/') || value.endsWith('.webmanifest') || value.endsWith('.svg')) {
        assets.add(value);
      }
    }
    await Promise.all(
      [...assets].map(async (url) => {
        try {
          const assetResponse = await fetch(url);
          if (!assetResponse.ok) return;
          await cache.put(url, assetResponse.clone());
          if (url.endsWith('.css')) {
            const css = await assetResponse.text();
            const fonts = new Set();
            for (const fontMatch of css.matchAll(/url\(([^)]+)\)/g)) {
              const raw = fontMatch[1].replace(/["']/g, '').trim();
              if (!raw || raw.startsWith('data:') || raw.startsWith('#')) continue;
              fonts.add(new URL(raw, new URL(url, self.location.origin)).href);
            }
            await Promise.all(
              [...fonts].map(async (fontUrl) => {
                try {
                  const fontResponse = await fetch(fontUrl);
                  if (fontResponse.ok) await cache.put(fontUrl, fontResponse);
                } catch {
                  // Fonts are optional; the shell still works.
                }
              }),
            );
          }
        } catch {
          // Individual optional assets should never block installation.
        }
      }),
    );
  } catch {
    // Offline install is a best-effort enhancement.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.addAll(SHELL_URLS).catch(() => undefined);
      await precacheBuildAssets();
      await self.skipWaiting();
    })().catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('dyf-') && key !== SHELL && key !== RUNTIME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put('/index.html', copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const copy = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(() => cached);
    }),
  );
});
