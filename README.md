# Draw Our Fish

**Draw Your Fish (Online Edition)** — anak menggambar ikan sendiri, lalu melepaskannya ke akuarium online bersama. Nama produk/deploy: **Draw Our Fish**. UI baru bergaya Sanrio: pastel, sticker, sederhana.

**Live online (Cloudflare Pages):**
**https://drawourfish.pages.dev**

Frontend disajikan dari Cloudflare Pages; backend WebSocket berjalan di Cloudflare Worker + Durable Object. URL publik bebas nama akun. Tidak perlu akun anak, tidak ada chat teks, tidak ada data pribadi.

---

## Fitur

### Studio gambar baru
- **12 pilihan**: 11 stiker ikan + **Gambar Bebas**.
- Stiker baru terinspirasi referensi: **Squid**, **Betta**, **Koi**; plus Clownfish, Goldfish, Pufferfish, Baby Shark, Seahorse, Angelfish, Manta Ray, Whale.
- **Gambar Bebas**: kanvas kosong dengan panduan putus-putus. Coretan anak otomatis jadi stiker dengan pinggiran putih + garis cokelat lembut.
- **4 gaya kuas**: Spidol, Pensil, Krayon, Semprot/airbrush.
- **Slider ukuran kuas** 6–64 px.
- **Slider Hue** (semua warna) + 8 swatch cepat.
- Ember cat dengan auto-clipping siluet (template) atau deteksi area tertutup (mode bebas).
- Penghapus, undo 15 langkah, reset.
- Nama acak lucu + dadu; ekspor WebP 384×384 (maks 80 KB).
- Setiap ikan mendapat **sticker rim putih** seperti referensi, termasuk shading, outline, dan mata googly.

### Akuarium & sosial
- Mesh strip 16 segmen dengan gerak sinus organik; kepala stabil, badan tidak pernah berputar vertikal.
- Squid bergerak melayang (sprite), ikan lain berenang dengan mesh.
- Pakan bersama, riak ketuk kaca, ikan penasaran 3 detik, emote (❤️ ✨ 🫧 🎵), dan long-press untuk menyembunyikan ikan.
- Ruang publik otomatis (18 ikan/shards) dan **ruang privat 4 ikon**.
- **Link undangan ruang**: tombol “Salin Link” membuat URL `/?room=0123` yang otomatis memasukkan keluarga ke ruang yang sama.
- Sync 10 Hz + interpolasi; feed/tap/emote realtime.
- Local Reef otomatis saat offline, dengan 4 ikan AI.
- Dua ikan AI penghuni tampil saat ruangan sepi.

### Koleksi, foto, PWA
- Koleksi lokal IndexedDB (maks 30), maksimal 3 ikan aktif.
- Photo Booth: kartu pos 1080×1350 diunduh sebagai PNG.
- PWA installable; service worker menyimpan HTML, JS/CSS ber-hash, font, dan ikon untuk cold offline reload.
- Audio disintesis Web Audio (tanpa file audio): kuas, chime, splash, munch, kamera, BGM.

---

## Stack

| Lapisan | Teknologi |
| --- | --- |
| UI | React 19 + TypeScript + Vite 6 |
| Desain | Tailwind v4 (reset) + design system Sanrio custom |
| Grafik | PixiJS v8 WebGL (mesh 16 segmen, partikel, screenshot) |
| State | Zustand |
| Persistence | IndexedDB (`idb-keyval`) + localStorage |
| Online | **Cloudflare Pages (frontend) + Workers + Durable Objects (WebSocket)** |
| Backend lokal/Docker | Node.js `ws` + Express (protokol sama) |
| Audio | Web Audio API |
| Deploy | `wrangler` (Cloudflare Pages + Workers) / Docker opsional |

---

## Menjalankan lokal

Prasyarat: Node.js 20+ untuk aplikasi. Untuk deploy Cloudflare, gunakan Node.js **22.12+** (wrangler v4).

```bash
npm install
npm run dev
```

- Vite: http://localhost:5173 (proxy `/ws` ke backend).
- Backend Node: http://localhost:8787.

Build produksi + server Node:

```bash
npm run build
npm start
# http://localhost:8787
```

### Cloudflare lokal/deploy

```bash
npx wrangler login

# Backend Worker (Durable Object, /ws, /api/health)
npm run build
npm run deploy:cf

# Frontend publik di Pages (drawourfish.pages.dev)
npm run deploy:pages
```

`wrangler.toml` berisi Worker `draw-our-fish`, Durable Object `ReefRoom`, static assets, dan `ALLOWED_ORIGINS` untuk Pages. Frontend Pages memakai `.env.pages` untuk WebSocket cross-origin dan `public/_headers` untuk CSP/security headers.

Live publik: **https://drawourfish.pages.dev**  
Backend Worker dipakai lewat WebSocket internal; URL frontend yang dibagikan tetap bersih.

---

## Struktur

```
.
├─ worker/
│  ├─ index.ts             # Worker entry: /ws, /api/health, static assets
│  └─ room.ts              # Durable Object: matchmaking, room, sinkronisasi
├─ shared/protocol.ts      # tipe & konstanta client/server
├─ server/                 # backend Node opsional (Docker/Render/local)
├─ src/
│  ├─ aquarium/engine.ts   # PixiJS: background pastel, mesh, pakan, riak, emote
│  ├─ components/          # HUD, Studio, Room, Collection, Photo, Emote
│  ├─ data/templates.ts    # 12 template + palet
│  ├─ lib/fishArt.ts       # 4 layer, sticker rim, free-draw export
│  ├─ lib/audio.ts
│  ├─ net/client.ts
│  ├─ store/useGameStore.ts
│  └─ index.css            # tema Sanrio responsif
├─ wrangler.toml
├─ Dockerfile
└─ scripts/                # QA Playwright + protocol test
```

---

## Keamanan & batasan server

- Tanpa akun/chat/email; `ownerId` anonim lokal.
- Nama ikan disanitasi server (maks 22 karakter).
- WebP square, 96–768 px, ≤80 KB, header divalidasi.
- Maks 18 ikan/ruangan, 14 koneksi/ruangan, 3 ikan/pemain.
- Rate limit pesan; payload WebSocket maks 150 KB.
- Emote dibatasi 4 pilihan.
- Nama ikan dibatasi huruf/angka/spasi/strip; karakter lain dibuang.
- WebSocket memeriksa Origin. `ALLOWED_ORIGINS` di `wrangler.toml` mengizinkan `https://drawourfish.pages.dev`; same-origin tetap diterima.
- Cloudflare Worker & Pages mengirim CSP, HSTS, nosniff, Permissions-Policy, Referrer-Policy, dan frame protection.
- CSP tanpa `unsafe-eval`; Pixi memakai polyfill `pixi.js/unsafe-eval` yang mengganti shader/uniform sync dengan implementasi tanpa-eval.
- `_headers` di Pages membatasi `connect-src` ke Worker WebSocket yang tepat; perbarui bila URL backend berubah.
- Cloudflare Durable Object menyimpan ruangan selama ada koneksi; data ikan hanya di memori ruangan (bukan storage permanen).

---

## QA yang sudah dijalankan

```bash
npm run test:protocol      # worker online: spawn/sync/feed/tap/emote/private room
npm run test:multiplayer   # dua browser, ruang privat, ikan lintas pemain
npm run test:offline       # persistence, PWA cold offline, download foto
npm run test:interaction   # tap emote & long-press hide
npm run test:responsive    # iPad, ponsel kecil, landscape
npm run test:perf          # 18 ikan, FPS
npm run test:smoke         # screenshot alur utama
npm run test:invite        # link undangan ?room= otomatis join
npm run test:origin        # origin WebSocket ditolak/diizinkan
```

Hasil terakhir:
- 18 ikan aktif = **60 FPS** di Chromium desktop.
- Flood fill **±1–10 ms** di desktop.
- Bundle inti **±271 KB gzip** (JS) + 11 KB CSS.
- Free-draw + 3 template baru + brush style diuji; tidak ada error konsol.
- Deployment Cloudflare Pages + Worker & protokol WebSocket online lolos uji.
- Link undangan ruang `/?room=0123` otomatis join di `drawourfish.pages.dev`.
- Origin WebSocket asing ditolak `403`, origin Pages/Worker diterima.
- Smoke test desktop & mobile di domain Pages: 0 error konsol.

---

## Catatan implementasi

- **Mesh kustom**: PRD menyebut `MeshRope`, tetapi `MeshRope` memaksa lebar geometri = tinggi tekstur persegi sehingga sirip/ekor rusak. Implementasi memakai mesh strip 16 segmen PixiJS `Mesh` dengan gerak sinus dan faktor kepala `(i/N)^1.6`; hasil visual bersih.
- **Sticker rim**: pinggiran putih 38 px pada ruang desain 1024, lalu crop dengan padding. Mode bebas membangun halo dari alpha coretan.
- **Free-draw fill**: ember hanya mengisi area tertutup; jika tumpahan menyentuh tepi kanvas, operasi dibatalkan.
- **Sanrio UI**: dibuat manual dengan vektor/CSS, tanpa gambar hasil AI generatif.

---

## Lisensi

MIT.
