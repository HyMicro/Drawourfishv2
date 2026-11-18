import { WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.WS_URL || 'ws://localhost:8787/ws';
const texture = fs.readFileSync(path.resolve('scripts/fixtures/fish.webp'));
const textureData = `data:image/webp;base64,${texture.toString('base64')}`;
console.log('TEXTURE_BYTES', texture.length, 'DATAURL', textureData.length);

const errors = [];

function client(name) {
  const ws = new WebSocket(url);
  const queue = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.type === 'ERROR') errors.push(`${name}: ${message.code} ${message.message}`);
    const waiterIndex = waiters.findIndex((entry) => entry.predicate(message));
    if (waiterIndex >= 0) {
      const [entry] = waiters.splice(waiterIndex, 1);
      clearTimeout(entry.timer);
      entry.resolve(message);
    } else {
      queue.push(message);
    }
  });
  const next = (predicate, timeout = 5000) =>
    new Promise((resolve, reject) => {
      const queueIndex = queue.findIndex(predicate);
      if (queueIndex >= 0) {
        resolve(queue.splice(queueIndex, 1)[0]);
        return;
      }
      const entry = {
        predicate,
        resolve,
        timer: setTimeout(() => {
          const index = waiters.indexOf(entry);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error(`${name}: timeout waiting for message`));
        }, timeout),
      };
      waiters.push(entry);
    });
  const ready = new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  return { name, ws, queue, next, ready, send: (data) => ws.send(JSON.stringify(data)) };
}

const A = client('A', 'owner-aaaa-1111');
const B = client('B', 'owner-bbbb-2222');
await Promise.all([A.ready, B.ready]);
A.send({ type: 'HELLO', ownerId: 'owner-aaaa-1111' });
B.send({ type: 'HELLO', ownerId: 'owner-bbbb-2222' });
const snapA = await A.next((message) => message.type === 'ROOM_SNAPSHOT');
const snapB = await B.next((message) => message.type === 'ROOM_SNAPSHOT');
console.log('PUBLIC_ROOMS', snapA.room.id, snapB.room.id, 'same=', snapA.room.id === snapB.room.id);

const fish = {
  id: 'fish-test-0001',
  ownerId: 'owner-aaaa-1111',
  name: 'Testy',
  templateId: 'goldfish',
  textureData,
  createdAt: Date.now(),
  transform: { x: 0.4, y: 0.5, targetX: 0.6, targetY: 0.5, speed: 0.45, facing: 1 },
  state: 'WANDER',
};
A.send({ type: 'FISH_SPAWN', fish });
const spawnB = await B.next((message) => message.type === 'FISH_SPAWN');
console.log('SPAWN_BROADCAST', spawnB.fish.id, spawnB.fish.name);

A.send({
  type: 'FISH_SYNC_BATCH',
  updates: [{ id: fish.id, x: 0.55, y: 0.4, targetX: 0.6, targetY: 0.4, state: 'WANDER', facing: 1 }],
});
const syncB = await B.next((message) => message.type === 'FISH_SYNC_BATCH');
console.log('SYNC_BROADCAST', syncB.updates[0].x, syncB.updates[0].y);

A.send({ type: 'FEED_DROP', pelletId: 'pellet-1', x: 0.5, y: 0.2 });
const feedB = await B.next((message) => message.type === 'FEED_DROP');
console.log('FEED_BROADCAST', feedB.pelletId, feedB.x);

A.send({ type: 'GLASS_TAP', x: 0.3, y: 0.4 });
const tapB = await B.next((message) => message.type === 'GLASS_TAP');
console.log('TAP_BROADCAST', tapB.x, tapB.y);

A.send({ type: 'EMOTE_SEND', targetFishId: fish.id, emote: 'HEART' });
const emoteB = await B.next((message) => message.type === 'EMOTE_EVENT');
console.log('EMOTE_BROADCAST', emoteB.emote, emoteB.targetFishId);

A.send({
  type: 'FISH_SPAWN',
  fish: { ...fish, id: 'fish-bad-0002', textureData: 'data:image/webp;base64,AAAA' },
});
const bad = await A.next((message) => message.type === 'ERROR');
console.log('VALIDATION_ERROR', bad.code);

A.send({ type: 'CREATE_PRIVATE' });
const privateA = await A.next((message) => message.type === 'ROOM_SNAPSHOT');
console.log('PRIVATE_ROOM', privateA.room.kind, privateA.room.code.join(''));
const code = privateA.room.code;
B.send({ type: 'JOIN_PRIVATE', code });
const privateB = await B.next((message) => message.type === 'ROOM_SNAPSHOT');
console.log('PRIVATE_JOIN', privateB.room.id === privateA.room.id, privateB.room.code.join(''));

const invalidSize = 'data:image/webp;base64,' + Buffer.alloc(90 * 1024, 1).toString('base64');
A.send({
  type: 'FISH_SPAWN',
  fish: { ...fish, id: 'fish-big-0003', textureData: invalidSize },
});
const big = await A.next((message) => message.type === 'ERROR');
console.log('SIZE_ERROR', big.code);

console.log('SERVER_ERRORS_COLLECTED', errors);
A.ws.close();
B.ws.close();
