# Draw Our Fish

**Draw Your Fish (Online Edition)** — anak menggambar ikan sendiri, lalu melepaskannya ke akuarium online bersama. Nama deploy: **Draw Our Fish**.

Aplikasi PWA ramah anak dengan studio gambar 4-layer, simulasi renang real-time, akuarium publik/privat berbasis WebSocket, pakan bersama, emote, dan kartu pos foto. Tanpa akun, tanpa chat, tanpa data pribadi.

---

## Fitur Utama

### Studio Gambar
- 8 template siluet vektor: Clownfish, Goldfish, Pufferfish, Baby Shark, Seahorse, Angelfish, Manta Ray, Whale.
- 4 layer: siluet putih, coretan anak dengan auto-clipping, shading/specular, outline + mata di lapisan teratas.
- Kuas halus dengan interpolasi Quadratic Bezier, 3 ukuran (14/30/54 px pada kanvas 640).
- Ember cat dengan scanline stack-based flood fill yang dibatasi mask siluet.
- Penghapus, undo hingga 15 snapshot, reset.
- 16 warna cerah, generator nama acak, input nama.
- Ekspor otomatis ke WebP 384×384 (quality 0.82) di bawah batas server 80 KB.
- Auto-crop sesuai bounding box, latar transparan.

### Akuarium
- Latar laut atmosferik: gradien dalam, sinar matahari, gelembung, siluet terumbu, caustic.
- Mesh strip 16 segmen dengan gelombang sinus; area kepala stabil dan ekor meliuk. Gerak vertikal dibatasi agar ikan tetap ramah anak.
- Perilaku otonom: `WANDER`, `SEEK_FOOD` (1.8× kecepatan), `CURIOUS_TAP` (3 detik setelah ketukan kaca).
- Ketuk air → riak, gelembung, ikan mendekat; ketuk ikan → menu emote (❤️ ✨ 🫧 🎵); tahan 2 detik → opsi sembunyikan ikan teman dari layar lokal.
- Pakan jatuh, dimakan ikan, memicu squash-and-stretch, hati, dan suara munch.
- Mode lokal otomatis dengan 4 ikan AI saat koneksi hilang.

### Online & Ruangan
- Akuarium publik otomatis dengan shard maksimal 18 ikan aktif per ruangan.
- Ruang privat dengan kode **4 ikon laut** (mis. ⭐ 🐠 🐙 🐚) — tanpa mengetik.
- Sinkronisasi posisi 10 Hz + interpolasi halus di klien.
- Spawn/despawn, pakan bersama, ketukan kaca, emote tersinkron.
- Validasi server: WebP square ≤80 KB, nama disanitasi, maks 3 ikan/pemain, rate limit pesan.
- Dua ikan AI "reef residents" ditampilkan saat ruangan masih sepi; hilang otomatis saat ruangan ramai.

### Koleksi & Foto
- Koleksi hingga 30 ikan tersimpan di IndexedDB (`idb-keyval`), otomatis berenang lagi saat dibuka.
- Maksimal 3 ikan aktif; menambah ikan ke-4 otomatis mengangkat yang paling lama.
- Mode foto: tangkapan WebGL dibungkus kartu pos kaca 1080×1350, langsung diunduh sebagai PNG.
- PWA installable + service worker precache aset build (cold offline reload berfungsi).

### Audio
- Semua SFX dan BGM disintesis dengan Web Audio API (tanpa file audio): kuas dinamis, glass chime, splash, pop, munch, shutter, marimba/kalimba ambient.
- Tombol mute tersimpan di localStorage.

---

## Stack

| Lapisan | Teknologi |
| --- | --- |
| UI | React 19 + TypeScript + Vite 6 |
| Styling | Tailwind CSS v4 + custom Glassmorphism design system |
| Render | PixiJS v8 (WebGL): mesh strip, partikel, riak, screenshot |
| State | Zustand (state UI terpisah dari render loop) |
| Persistence | IndexedDB (`idb-keyval`) + localStorage (preferensi) |
| Realtime | Node.js + `ws` (Express serve static + WebSocket di origin yang sama) |
| Audio | Web Audio API |
| Deploy | Docker / Render blueprint, satu service |

---

## Menjalankan Lokal

Prasyarat: Node.js 20+.

```bash
npm install
npm run dev
```

- Frontend Vite: http://localhost:5173 (proxy `/ws` dan `/api` ke backend).
- Backend WebSocket + API: http://localhost:8787.
- Untuk membuka dari HP di Wi-Fi yang sama: jalankan `npm run dev:web -- --host`, lalu akses IP mesin di port 5173. Backend tetap diakses lewat proxy Vite.

### Build produksi

```bash
npm run build
npm start
```

Buka http://localhost:8787. Server Express menyajikan `dist/` dan WebSocket pada `/ws`.

### Variabel lingkungan

| Nama | Default | Keterangan |
| --- | --- | --- |
| `PORT` | `8787` | Port server HTTP + WebSocket. |
| `VITE_WS_URL` | _(kosong)_ | Opsional. URL WebSocket penuh, mis. `wss://api.contoh.com/ws`, jika frontend di-host terpisah dari backend. Perlu rebuild. |

Tidak ada API key, database, atau akun. Semua data ikan tersimpan di perangkat anak.

---

## Deploy

### Render (disarankan, satu service)

Repo sudah menyertakan [`render.yaml`](./render.yaml) dan [`Dockerfile`](./Dockerfile).

1. Push repo ke GitHub/GitLab.
2. Di Render → **New** → **Blueprint**.
3. Pilih repo, Render membaca `render.yaml`, service bernama **draw-our-fish**.
4. Deploy. Render menyuntikkan `PORT`; server mendengarkan port tersebut.
5. Health check: `/api/health`.

Hasil: `https://draw-our-fish.onrender.com` (atau nama unik lain). WebSocket otomatis memakai origin yang sama (`wss://.../ws`), termasuk di balik HTTPS Render.

> Free plan Render bisa tidur saat tidak ada trafik. Klien akan otomatis reconnect dan kembali ke Local Reef selama tidur.

### Docker di mana saja

```bash
docker build -t draw-our-fish .
docker run --rm -p 8787:8787 -e PORT=8787 draw-our-fish
```

Bisa dipakai di Fly.io, Railway, VPS, Koyeb, dll. Satu container sudah mencakup frontend + backend + WebSocket.

### Fly.io cepat

```bash
fly launch --name draw-our-fish --region sin
fly deploy
fly open
```

(Gunakan Dockerfile yang ada; tidak perlu database.)

### Frontend terpisah (opsional)

- Deploy `dist/` ke Netlify/Vercel/Cloudflare Pages.
- Deploy backend Node ke Render/Railway/Fly.
- Set `VITE_WS_URL=wss://backend-kamu/ws` lalu rebuild frontend.
- Server WebSocket tidak membatasi origin, sehingga koneksi lintas domain berfungsi. Untuk keamanan produksi, tambahkan allowlist origin di `server/index.ts`.

---

## Arsitektur

```
.
├─ shared/protocol.ts        # kontrak pesan & tipe bersama client/server
├─ server/
│  ├─ index.ts               # Express + HTTP upgrade WebSocket + static dist
│  ├─ roomManager.ts         # matchmaking, room privat, validasi, broadcast
│  └─ rooms.ts               # model Room/Client
├─ src/
│  ├─ aquarium/engine.ts     # PixiJS: background, mesh ikan, pakan, riak, emote
│  ├─ components/            # HUD, DrawingStudio, RoomSheet, PhotoBooth, dll.
│  ├─ data/templates.ts      # 8 Path2D siluet + palet
│  ├─ lib/fishArt.ts         # render 4 layer, shading, mata, ekspor WebP
│  ├─ lib/photo.ts           # komposisi kartu pos PNG
│  ├─ lib/audio.ts           # SoundKit Web Audio
│  ├─ net/client.ts          # WebSocket, reconnect, heartbeat
│  ├─ store/useGameStore.ts  # Zustand: koleksi, live fish, ruangan, UI
│  └─ index.css              # design system Underwater Glassmorphism
├─ public/                   # PWA manifest, ikon, service worker
├─ scripts/                  # smoke/multiplayer/protocol/offline/perf tests
├─ Dockerfile
└─ render.yaml
```

### Alur singkat

1. Client memuat aset (PWA) dan membuka WebSocket `/ws`.
2. `HELLO` → server memasukkan ke shard publik dengan ikan paling sedikit.
3. `ROOM_SNAPSHOT` → client memuat tekstur remote secara async dan menampilkan ikan.
4. Saat anak selesai menggambar, WebP 384×384 dikirim lewat `FISH_SPAWN`.
5. Server memvalidasi, menyimpan state, dan broadcast ke penghuni ruangan.
6. Pemilik ikan mengirim `FISH_SYNC_BATCH` tiap 100 ms; klien lain melakukan interpolasi.
7. Pakan/ketukan/emote disinkronkan lewat event terpisah.
8. Saat koneksi putus, klien masuk Local Reef dengan 4 ikan AI dan mencoba reconnect otomatis.

### Batas server

- 18 ikan per ruangan.
- 14 koneksi per ruangan.
- 3 ikan per pemain per ruangan.
- Tekstur: WebP square 96–768 px, ≤80 KB (dibaca dari header RIFF/WebP).
- Payload WebSocket maks 150 KB.
- Rate limit kasar 160 pesan / 10 detik per koneksi.

---

## Keamanan & Privasi Anak

- Tanpa akun, email, nama asli, atau chat teks.
- `ownerId` anonim dibuat lokal dan hanya dipakai untuk kepemilikan ikan.
- Nama ikan disanitasi di server (karakter HTML/backtick dihapus, maks 22 karakter).
- Emote dibatasi 4 pilihan.
- Ikan pemain lain bisa disembunyikan secara lokal (parental quick-hide).
- Data ikan tidak diunggah ke storage permanen; hanya berada di memori ruangan selama sesi.
- Koleksi pribadi disimpan di IndexedDB perangkat.

---

## Performa

Diukur pada Chromium desktop (WebGL): **18 ikan aktif = 60 FPS stabil**, tanpa error konsol. Bundle awal produksi:

- JavaScript inti (React + app + PixiJS): **±267 KB gzip**.
- CSS: **±11 KB gzip**.
- Total inti di bawah budget **350 KB gzip**.
- Tekstur ikan: ±17–30 KB WebP per ikan (di bawah batas 80 KB).
- Canvas studio 640×640; ekspor 384×384.
- Tekstur GPU dihancurkan saat ikan despawn (`texture.destroy(true)`), begitu juga background saat resize.

Pengujian lain yang sudah dijalankan:
- Dua klien masuk ruang privat dengan kode 4 ikon yang sama, posisi/ikan tersinkron.
- Protokol pakan, ketukan, emote, validasi ukuran/header WebP.
- Ketuk ikan membuka menu emote; long-press 2 detik membuka opsi hide.
- Reload offline (cold) melalui service worker → Local Reef tanpa pesan error teknis.
- Persistensi IndexedDB: ikan kembali berenang setelah reload.
- Unduh kartu pos PNG (`draw-our-fish-YYYY-MM-DD.png`) berhasil.
- Flood fill terukur ±1–10 ms per area pada desktop (target <15 ms).
- Build Docker + container health check `/api/health` berhasil.

---

## QA Scripts

Server harus berjalan (`npm start`) dan Playwright Chromium terpasang (`npx playwright install chromium`). jalankan:

```bash
npm run test:protocol      # backend: spawn/sync/feed/tap/emote/room + validasi
npm run test:multiplayer   # dua browser: ruang privat, ikan lintas pemain
npm run test:offline       # persistence, PWA cold offline, download foto
npm run test:interaction   # ketuk ikan → emote, long-press → hide
npm run test:responsive    # iPad, ponsel kecil, landscape, overflow
npm run test:perf          # 18 ikan, ukur FPS
npm run test:smoke         # screenshot desktop & mobile alur utama
```

Screenshot uji ditulis ke folder temp OS (`dyf-shots`, `dyf-multi`, `dyf-offline`).

---

## Catatan Desain

- **Mesh**: PRD menyebut `MeshRope`; implementasi akhir memakai mesh strip 16 segmen kustom di atas PixiJS `Mesh` dengan persamaan gelombang yang sama. Alasannya: `MeshRope` memaksa lebar geometri = tinggi tekstur persegi (384 px), sehingga tekstur ikan yang lebar terlipat dan sirip/ekor terpotong. Mesh strip menjaga sirip tetap utuh sambil mempertahankan gerak sinus, faktor kepala `(i/N)^1.6`, dan respons kecepatan.
- **Anti-fragmentasi**: flip arah memakai squash 250 ms, bukan interpolasi `scale.x` melalui nol agar ikan tidak tampak menjadi garis vertikal saat berbalik.
- **Bot ramah**: dua AI resident hanya muncul saat ruangan <14 ikan nyata; saat ramai, mereka pergi agar budget 18 ikan tetap terjaga.
- **Offline**: service worker meng-cache HTML, JS/CSS ber-hash, font, dan ikon saat install, sehingga reload dingin tanpa jaringan tetap menampilkan aplikasi.

---

## Status Roadmap

- [x] Fase 1 — Studio gambar, fisika lokal, IndexedDB
- [x] Fase 2 — Perilaku AI, riak, pakan, audio
- [x] Fase 3 — Multiplayer WebSocket, shard publik, ruang 4 ikon, feed/emote
- [x] Fase 4 — Photo booth, PWA/offline, optimasi tekstur, QA perangkat sentuh
- [ ] Produksi lanjutan: moderasi nama lebih ketat, allowlist origin, observability, CDN aset bila frontend dipisah

---

## Lisensi

MIT — silakan pakai, modifikasi, dan ajarkan pada anak-anak. 🐠
