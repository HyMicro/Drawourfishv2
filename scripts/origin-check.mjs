import { WebSocket } from 'ws';
const url = 'wss://draw-our-fish.izzaahyad03.workers.dev/ws';
let rejected = false;
const bad = new WebSocket(url, { headers: { Origin: 'https://evil.example' } });
bad.on('unexpected-response', (_req, res) => { console.log('BAD_ORIGIN_STATUS', res.statusCode); rejected = true; bad.terminate(); });
bad.on('open', () => { console.log('BAD_ORIGIN_OPENED (unexpected)'); bad.close(); });
bad.on('error', (e) => { if (!rejected) console.log('BAD_ORIGIN_ERROR', e.message); });
setTimeout(() => {
  const good = new WebSocket(url, { headers: { Origin: 'https://draw-our-fish.izzaahyad03.workers.dev' } });
  good.on('open', () => { console.log('GOOD_ORIGIN_OPENED'); good.close(); });
  good.on('error', (e) => console.log('GOOD_ORIGIN_ERROR', e.message));
  setTimeout(() => process.exit(0), 1500);
}, 1200);
