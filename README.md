# Draw Our Fish

**Draw Our Fish** — anak menggambar ikan sendiri, lalu melepaskannya ke satu akuarium online global. Semua pemain berenang di lautan yang sama tanpa ruang privat, tanpa kode undangan, tanpa akun, dan tanpa chat teks.

**Live:** **https://drawourfish.pages.dev**

Frontend disajikan dari Cloudflare Pages; backend WebSocket berjalan di Cloudflare Worker + Durable Object. URL publik bebas nama akun. Nama ikan tampil di atas setiap ikan di akuarium.

---

## Fitur

### Studio gambar
- **10 stiker ikan** dari template raster yang disediakan: Goldfish, Pufferfish, Bubblefish, Clownfish, Blue Tang, Baby Shark, Baby Fish, Spotfish, Grouper, Angelfish — plus **Gambar Bebas**.
- Template memakai tiga lapisan: siluet putih, detail garis/rim, dan hasil warna. Ember cat otomatis mengikuti bentuk tubuh ikan.
- **4 gaya kuas**: Spidol, Pensil, Krayon, Semprot/airbrush.
- **Warna lengkap**: slider Hue, Saturasi, dan Kecerahan + **24 swatch** + kode HEX dan nilai **RGB**.
- **8 mode blend**: Normal, Multiply, Screen, Overlay, Darken, Lighten, Dodge, Soft Light. Blend berlaku untuk kuas dan ember cat.
- Ember cat, penghapus, undo 15 langkah, reset, ukuran kuas 6–64 px.
- Nama acak lucu + dadu; ekspor WebP 384×384 (maks 80 KB).
- Setiap ikan mendapat pinggiran putih dan outline navy seperti stiker dari sheet template terbaru.
- Ikon UI diambil dari icon sheet yang disediakan; ikon aplikasi/PWA memakai goldfish dari sheet yang sama.

### Akuarium global
- **Satu Ocean Global**: satu ruangan global untuk semua pemain; tidak ada pembuatan/join ruang.
- **Nama di atas ikan** dalam label krem yang mengikuti gerakan ikan.
- Background laut dari gambar referensi yang sudah dibersihkan dari ikan, dengan sinar, gelembung, dan partikel halus.
- **Siluet ikan parallax** diekstrak sebagai aset transparan terpisah; bergerak pelan kiri/kanan dengan kedalaman berbeda.
- Mesh 16 segmen untuk gerak berenang organik; mode bebas memakai sprite melayang.
- Pakan bersama, riak ketuk kaca, emote (❤️ ✨ 🫧 🎵), dan long-press untuk menyembunyikan ikan.
- **Ikan tumbuh saat makan**: setiap pelet menambah ukuran hingga batas 1,8×; pertumbuhan tersimpan di backend.
- **Ikan tetap berenang** walau pemiliknya menutup tab: setelah sync berhenti, ikan beralih ke gerak otonom dan terus menjelajah laut.
- Sync 10 Hz + interpolasi; feed/tap/emote realtime.
- **Ikan disimpan di backend**: ikan tetap ada setelah pemain menutup tab/reload, tersimpan di Durable Object storage (Cloudflare) atau JSON store (server Node). Tidak ada tekstur ikan di localStorage/IndexedDB.
- Local Reef otomatis saat offline, dengan ikan AI.

### Koleksi, foto, PWA
- Koleksi ikan disimpan di backend (maks 30), maksimal 3 ikan aktif. Hanya ID anonim pemain yang disimpan di perangkat.
- Photo Booth: kartu pos 1080×1350 bernuansa krem/oranye, diunduh sebagai PNG.
- PWA installable; service worker menyimpan HTML, JS/CSS ber-hash, font, dan ikon untuk cold offline reload.
- Audio disintesis Web Audio (tanpa file audio): kuas, chime, splash, munch, kamera, BGM.

---

## Stack

| Lapisan | Teknologi |
| --- | --- |
| UI | React 19 + TypeScript + Vite 6 |
| Desain | Tailwind v4 (reset) + design system buku laut krem/oranye/toska |
| Grafik | PixiJS v8 WebGL (mesh 16 segmen, parallax, partikel, screenshot) |
| State | Zustand |
| Persistence | Cloudflare Durable Object storage / JSON server store + localStorage hanya untuk ID anonim |
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
Backend Worker dipakai lewat WebSocket internal; URL frontend yang dibagikan tetap bersih. URL Worker lama otomatis **302 redirect** ke domain Pages ini.

---

## Struktur

```
.
├─ worker/
│  ├─ index.ts             # Worker entry: /ws, /api/health, static assets
│  └─ room.ts              # Durable Object: ocean global + storage ikan
├─ shared/protocol.ts      # tipe & konstanta client/server
├─ server/                 # backend Node opsional (Docker/Render/local)
├─ src/
│  ├─ aquarium/engine.ts   # PixiJS: background, parallax, mesh, label, pakan
│  ├─ components/          # HUD, Studio, Collection, Photo, Emote
│  ├─ data/templates.ts    # 10 template + palet 24 warna
│  ├─ lib/fishArt.ts       # raster template, mask, sticker rim, export
│  ├─ lib/audio.ts
│  ├─ net/client.ts
│  ├─ store/useGameStore.ts
│  └─ index.css            # tema krem/oranye responsif
├─ public/
│  ├─ fish/                # shape, details, thumb, texture per ikan
│  ├─ silhouettes/         # siluet parallax transparan
│  ├─ icons/               # glyph UI hasil ekstraksi icon sheet
│  └─ underwater-bg.png    # background laut bersih 1920×1080
├─ wrangler.toml
├─ Dockerfile
└─ scripts/                # QA Playwright + protocol test + asset pipeline
```

---

## Keamanan & batasan server

- Tanpa akun/chat/email; `ownerId` anonim lokal.
- Nama ikan disanitasi server (maks 22 karakter).
- WebP square, 96–768 px, ≤80 KB, header divalidasi.
- Maks 18 ikan aktif, 60 koneksi, 3 ikan aktif/pemain, 30 ikan tersimpan/pemain.
- Rate limit pesan; payload WebSocket maks 150 KB.
- Emote dibatasi 4 pilihan.
- Nama ikan dibatasi huruf/angka/spasi/strip; karakter lain dibuang.
- WebSocket memeriksa Origin. `ALLOWED_ORIGINS` di `wrangler.toml` mengizinkan `https://drawourfish.pages.dev`; same-origin tetap diterima.
- Cloudflare Worker & Pages mengirim CSP, HSTS, nosniff, Permissions-Policy, Referrer-Policy, dan frame protection.
- CSP tanpa `unsafe-eval`; Pixi memakai polyfill `pixi.js/unsafe-eval` yang mengganti shader/uniform sync dengan implementasi tanpa-eval.
- `_headers` di Pages membatasi `connect-src` ke Worker WebSocket yang tepat; perbarui bila URL backend berubah.
- Cloudflare Durable Object menyimpan setiap ikan di storage persisten; ikan tetap ada saat pemilik disconnect/reload. Server Node memakai `.data/fish-store.json`.

---

## QA

```bash
npm run test:protocol      # spawn/sync/feed/tap/emote/validasi + persistence reconnect
npm run test:multiplayer   # dua browser, satu ocean global, ikan lintas pemain
npm run test:offline       # persistence backend, PWA cold offline, download foto
npm run test:interaction   # tap emote & long-press hide
npm run test:responsive    # iPad, ponsel kecil, landscape
npm run test:perf          # 18 ikan, FPS
npm run test:smoke         # screenshot alur utama
npm run test:origin        # origin WebSocket ditolak/diizinkan
```

Aset dapat dibangun ulang:

```bash
node scripts/build-fish-assets.mjs        # public/fish/*
node scripts/build-background-assets.mjs  # background + siluet
node scripts/build-ui-icons.mjs           # glyph UI dari icon sheet
node scripts/build-app-icon.mjs           # ikon PWA
```

Hasil uji terakhir:
- 18 ikan aktif = **50–60 FPS** di Chromium desktop dengan GPU.
- Aset WebP: background **±92 KB**, satu set 10 ikan **±0,9 MB** (shape/details/thumb/texture).
- Smoke desktop + mobile di `drawourfish.pages.dev`: **0 error konsol**.
- Multiplayer dua browser: keduanya melihat **Ocean Global** dan jumlah ikan yang sama, tanpa ruang/kode.
- Persistence live: ikan tetap ada setelah reload, koleksi dimuat dari backend, lalu hapus ikan juga tersinkron.
- Template ikan dan ikon UI terbaru sudah dipakai di live site.
- Protokol live: spawn, sync, feed, tap, emote, dan validasi payload lolos.
- Origin asing ditolak **403**, origin Worker/Pages diterima.

---

## Catatan implementasi

- **Mesh kustom**: `MeshRope` memaksa lebar geometri = tinggi tekstur persegi sehingga sirip/ekor rusak. Implementasi memakai mesh strip 16 segmen PixiJS `Mesh` dengan gerak sinus dan faktor kepala `(i/N)^1.6`.
- **Template raster**: `*-shape.webp` (siluet putih) dipakai sebagai mask ember cat; `*-details.webp` menyimpan rim, outline, mata, dan detail; `*-texture.webp` dipakai ikan AI.
- **Sticker rim**: band putih 6 px mengikuti alpha shape, dihitung dari tepi transparan, sehingga outline tetap rapi walau ada celah antialias.
- **Blend kuas**: tiap goresan digambar ke layer sementara, lalu dikomposit sekali ke kanvas cat saat pointer dilepas; ini mencegah artefak kotak saat memakai Multiply/Screen/Overlay.
- **Free-draw fill**: ember hanya mengisi area tertutup; jika tumpahan menyentuh tepi kanvas, operasi dibatalkan.
- **Parallax**: siluet diekstrak dari referensi, dinormalisasi ke navy, dan dianimasikan dengan kecepatan/alpha berbeda; background tetap diam tanpa camera movement.
- **UI**: dibuat manual dengan CSS/vektor, tanpa gambar UI hasil AI generatif.

---

## Lisensi

MIT.
