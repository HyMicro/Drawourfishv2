import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { WebSocket } from 'ws';
import {
  FISH_TEMPLATE_IDS,
  MAX_CLIENTS_PER_ROOM,
  MAX_FISH_PER_OWNER,
  MAX_TEXTURE_BYTES,
  FEED_GROWTH,
  MAX_FISH_GROWTH,
  ROOM_CAPACITY,
  type ClientMessage,
  type EmoteKind,
  type FishEntity,
  type FishSync,
  type FishTemplateId,
  type RoomInfo,
  type ServerMessage,
} from '../shared/protocol';
import { rooms, type Client, type Room } from './rooms';

const EMOTES = new Set<EmoteKind>(['HEART', 'SPARKLE', 'BUBBLE', 'MUSIC']);
const MAX_NAME = 22;
const MAX_MESSAGES_PER_10S = 160;
const MAX_COLLECTION_PER_OWNER = 30;

const clients = new Set<Client>();

const room: Room = {
  info: {
    id: 'ocean-global',
    capacity: ROOM_CAPACITY,
    label: 'Ocean Global',
  },
  clients: new Set(),
  fishes: new Map(),
  syncs: new Map(),
};
rooms.clear();
rooms.set(room.info.id, room);

const STORE_DIR = path.resolve('.data');
const STORE_FILE = path.join(STORE_DIR, 'fish-store.json');
const allFish = new Map<string, FishEntity>();
const activeIds = new Set<string>();
let saveTimer: NodeJS.Timeout | null = null;

function loadStore() {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { fishes?: FishEntity[]; activeIds?: string[] };
    for (const fish of parsed.fishes ?? []) {
      if (!fish || typeof fish.id !== 'string' || typeof fish.ownerId !== 'string') continue;
      allFish.set(fish.id, fish);
      if (parsed.activeIds?.includes(fish.id)) {
        activeIds.add(fish.id);
        room.fishes.set(fish.id, fish);
        room.syncs.set(fish.id, {
          id: fish.id,
          x: fish.transform.x,
          y: fish.transform.y,
          targetX: fish.transform.targetX,
          targetY: fish.transform.targetY,
          state: fish.state,
          facing: fish.transform.facing,
        });
      }
    }
  } catch {
    // First run or unreadable file — start with an empty ocean.
  }
}

function saveStoreNow() {
  saveTimer = null;
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    fs.writeFileSync(
      STORE_FILE,
      JSON.stringify({ fishes: [...allFish.values()], activeIds: [...activeIds] }),
    );
  } catch (error) {
    console.warn('[room] fish store write failed', error);
  }
}

function persistSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(saveStoreNow, 180);
}

loadStore();

function ownerFish(ownerId: string): FishEntity[] {
  return [...allFish.values()].filter((fish) => fish.ownerId === ownerId).sort((a, b) => b.createdAt - a.createdAt);
}

function deactivateFish(fish: FishEntity, broadcast = true) {
  activeIds.delete(fish.id);
  room.fishes.delete(fish.id);
  room.syncs.delete(fish.id);
  if (broadcast) sendRoom(room, { type: 'FISH_DESPAWN', fishId: fish.id });
  persistSoon();
}

function enforceCollectionLimit(ownerId: string, keepFishId: string) {
  const existing = allFish.get(keepFishId);
  if (existing && existing.ownerId === ownerId) return;
  const mine = ownerFish(ownerId);
  if (mine.length < MAX_COLLECTION_PER_OWNER) return;
  let remaining = mine.length;
  for (const fish of mine) {
    if (remaining < MAX_COLLECTION_PER_OWNER) break;
    if (fish.id === keepFishId) continue;
    if (activeIds.has(fish.id)) deactivateFish(fish);
    allFish.delete(fish.id);
    remaining -= 1;
  }
}

function send(client: Client, message: ServerMessage) {
  if (client.socket.readyState === 1) {
    client.socket.send(JSON.stringify(message));
  }
}

function sendRoom(target: Room, message: ServerMessage, except?: Client) {
  for (const client of target.clients) {
    if (client !== except) send(client, message);
  }
}

function leaveRoom(client: Client) {
  const target = client.room;
  if (!target) return;
  // Fish remain in the ocean and in the server store when a player leaves.
  target.clients.delete(client);
  client.room = null;
}

function enterRoom(client: Client) {
  if (room.clients.size >= MAX_CLIENTS_PER_ROOM) {
    send(client, { type: 'ERROR', code: 'OCEAN_FULL', message: 'Laut sedang penuh. Coba lagi sebentar.' });
    return;
  }
  client.room = room;
  room.clients.add(client);
  send(client, {
    type: 'ROOM_SNAPSHOT',
    room: room.info,
    fishes: [...room.fishes.values()],
    myFishes: ownerFish(client.ownerId),
    clientId: client.id,
    onlineCount: room.clients.size,
  });
}

function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Fish';
  const cleaned = raw
    .replace(/[^\p{L}\p{N} '\-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
  return cleaned || 'Fish';
}

function clamp01(value: unknown, fallback = 0.5): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(1, Math.max(0, n));
}

/**
 * Reads intrinsic dimensions from a WebP buffer. Returns null when the bytes
 * are not a WebP image we can understand.
 */
export function readWebpSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buffer.toString('ascii', 12, 16);

  if (chunk === 'VP8X') {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }

  if (chunk === 'VP8L') {
    if (buffer[20] !== 0x2f) return null;
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }

  if (chunk === 'VP8 ') {
    const start = 12 + 8;
    if (buffer[start + 3] !== 0x9d || buffer[start + 4] !== 0x01 || buffer[start + 5] !== 0x2a) return null;
    const width = buffer.readUInt16LE(start + 6) & 0x3fff;
    const height = buffer.readUInt16LE(start + 8) & 0x3fff;
    return { width, height };
  }

  return null;
}

export function validateTexture(dataUrl: unknown): string | null {
  if (typeof dataUrl !== 'string') return 'Tekstur tidak valid.';
  const prefix = 'data:image/webp;base64,';
  if (!dataUrl.startsWith(prefix)) return 'Format ikan harus WebP.';
  let bytes: Buffer;
  try {
    bytes = Buffer.from(dataUrl.slice(prefix.length), 'base64');
  } catch {
    return 'Tekstur tidak dapat dibaca.';
  }
  if (bytes.length === 0) return 'Tekstur kosong.';
  if (bytes.length > MAX_TEXTURE_BYTES) return 'Ikan terlalu besar (maks 80 KB).';
  const size = readWebpSize(bytes);
  if (!size) return 'Header WebP tidak valid.';
  if (size.width < 96 || size.height < 96) return 'Resolusi ikan terlalu kecil.';
  if (size.width > 768 || size.height > 768) return 'Resolusi ikan terlalu besar.';
  if (Math.abs(size.width - size.height) > 2) return 'Rasio ikan harus persegi.';
  return null;
}

export function sanitizeFish(client: Client, input: unknown): FishEntity | string {
  if (!input || typeof input !== 'object') return 'Data ikan tidak valid.';
  const raw = input as Partial<FishEntity>;
  if (typeof raw.id !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(raw.id)) return 'ID ikan tidak valid.';
  if (!FISH_TEMPLATE_IDS.includes(raw.templateId as FishTemplateId)) return 'Template ikan tidak dikenal.';
  const textureError = validateTexture(raw.textureData);
  if (textureError) return textureError;

  const room = client.room;
  const existing = room?.fishes.get(raw.id);
  if (existing && existing.ownerId !== client.ownerId) return 'Ikan milik pemain lain.';

  const transform = raw.transform ?? {
    x: 0.5,
    y: 0.5,
    targetX: 0.6,
    targetY: 0.5,
    speed: 0.5,
    facing: 1,
  };

  return {
    id: raw.id,
    ownerId: client.ownerId,
    name: sanitizeName(raw.name),
    templateId: raw.templateId as FishTemplateId,
    textureData: raw.textureData as string,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    growth: Math.min(MAX_FISH_GROWTH, Math.max(1, Number(raw.growth) || 1)),
    transform: {
      x: clamp01(transform.x),
      y: clamp01(transform.y),
      targetX: clamp01(transform.targetX),
      targetY: clamp01(transform.targetY),
      speed: Math.min(1, Math.max(0.1, Number(transform.speed) || 0.45)),
      facing: transform.facing === -1 ? -1 : 1,
    },
    state: 'WANDER',
  };
}

function handleSpawn(client: Client, message: Extract<ClientMessage, { type: 'FISH_SPAWN' }>) {
  if (!client.room) return;
  const fish = sanitizeFish(client, message.fish);
  if (typeof fish === 'string') {
    send(client, { type: 'ERROR', code: 'INVALID_PAYLOAD', message: fish });
    return;
  }
  const existing = room.fishes.get(fish.id);
  if (existing && existing.ownerId !== client.ownerId) return;

  if (!existing) {
    const ownActive = [...room.fishes.values()].filter((item) => item.ownerId === client.ownerId).length;
    if (ownActive >= MAX_FISH_PER_OWNER) {
      send(client, { type: 'ERROR', code: 'RATE_LIMIT', message: 'Maksimal 3 ikan aktif.' });
      return;
    }
    if (room.fishes.size >= ROOM_CAPACITY) {
      const oldest = [...room.fishes.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
      if (oldest) deactivateFish(oldest);
    }
  }

  enforceCollectionLimit(client.ownerId, fish.id);
  allFish.set(fish.id, fish);
  activeIds.add(fish.id);
  room.fishes.set(fish.id, fish);
  room.syncs.set(fish.id, {
    id: fish.id,
    x: fish.transform.x,
    y: fish.transform.y,
    targetX: fish.transform.targetX,
    targetY: fish.transform.targetY,
    state: fish.state,
    facing: fish.transform.facing,
  });
  persistSoon();
  sendRoom(room, { type: 'FISH_SPAWN', fish });
}

function handleDespawn(client: Client, fishId: string) {
  if (!client.room || typeof fishId !== 'string') return;
  const fish = room.fishes.get(fishId);
  if (!fish || fish.ownerId !== client.ownerId) return;
  deactivateFish(fish);
}

function handleDelete(client: Client, fishId: string) {
  if (!client.room || typeof fishId !== 'string') return;
  const fish = allFish.get(fishId);
  if (fish && fish.ownerId !== client.ownerId) return;
  if (fish && activeIds.has(fish.id)) deactivateFish(fish);
  allFish.delete(fishId);
  activeIds.delete(fishId);
  persistSoon();
}

function handleSync(client: Client, message: Extract<ClientMessage, { type: 'FISH_SYNC_BATCH' }>) {
  const room = client.room;
  if (!room || !Array.isArray(message.updates)) return;
  const accepted: FishSync[] = [];
  for (const update of message.updates.slice(0, 8)) {
    if (!update || typeof update.id !== 'string') continue;
    const fish = room.fishes.get(update.id);
    if (!fish || fish.ownerId !== client.ownerId) continue;
    const sync: FishSync = {
      id: update.id,
      x: clamp01(update.x),
      y: clamp01(update.y),
      targetX: clamp01(update.targetX),
      targetY: clamp01(update.targetY),
      state: update.state === 'SEEK_FOOD' || update.state === 'CURIOUS_TAP' ? update.state : 'WANDER',
      facing: update.facing === -1 ? -1 : 1,
    };
    fish.transform.x = sync.x;
    fish.transform.y = sync.y;
    fish.transform.targetX = sync.targetX;
    fish.transform.targetY = sync.targetY;
    fish.transform.facing = sync.facing;
    fish.state = sync.state;
    room.syncs.set(update.id, sync);
    accepted.push(sync);
  }
  if (accepted.length > 0) sendRoom(room, { type: 'FISH_SYNC_BATCH', updates: accepted }, client);
}

function handleFeedDrop(client: Client, message: Extract<ClientMessage, { type: 'FEED_DROP' }>) {
  if (!client.room) return;
  if (typeof message.pelletId !== 'string' || message.pelletId.length > 64) return;
  const x = clamp01(message.x);
  const y = clamp01(message.y, 0.1);
  sendRoom(client.room, { type: 'FEED_DROP', pelletId: message.pelletId, x, y });
}

function handleFeedConsumed(client: Client, message: Extract<ClientMessage, { type: 'FEED_CONSUMED' }>) {
  if (!client.room) return;
  if (typeof message.pelletId !== 'string' || typeof message.fishId !== 'string') return;
  const fish = room.fishes.get(message.fishId);
  if (fish) {
    const growth = Math.min(MAX_FISH_GROWTH, (fish.growth ?? 1) + FEED_GROWTH);
    fish.growth = growth;
    persistSoon();
    sendRoom(room, { type: 'FISH_GROWTH', fishId: fish.id, growth });
  }
  sendRoom(room, { type: 'FEED_CONSUMED', pelletId: message.pelletId, fishId: message.fishId });
}

function handleGlassTap(client: Client, message: Extract<ClientMessage, { type: 'GLASS_TAP' }>) {
  if (!client.room) return;
  sendRoom(client.room, { type: 'GLASS_TAP', x: clamp01(message.x), y: clamp01(message.y) }, client);
}

function handleEmote(client: Client, message: Extract<ClientMessage, { type: 'EMOTE_SEND' }>) {
  if (!client.room) return;
  if (!EMOTES.has(message.emote)) return;
  if (typeof message.targetFishId !== 'string') return;
  sendRoom(
    client.room,
    { type: 'EMOTE_EVENT', targetFishId: message.targetFishId, emote: message.emote },
    client,
  );
}

function handleMessage(client: Client, message: ClientMessage) {
  const now = Date.now();
  if (now - client.lastMessageAt > 10_000) {
    client.messageBudget = MAX_MESSAGES_PER_10S;
    client.lastMessageAt = now;
  }
  client.messageBudget -= 1;
  if (client.messageBudget < 0) return;

  switch (message.type) {
    case 'HELLO': {
      if (typeof message.ownerId !== 'string' || !/^[a-zA-Z0-9-]{6,64}$/.test(message.ownerId)) return;
      client.ownerId = message.ownerId;
      if (!client.room) enterRoom(client);
      break;
    }
    case 'FISH_SPAWN':
      handleSpawn(client, message);
      break;
    case 'FISH_DESPAWN':
      handleDespawn(client, message.fishId);
      break;
    case 'FISH_DELETE':
      handleDelete(client, message.fishId);
      break;
    case 'FISH_SYNC_BATCH':
      handleSync(client, message);
      break;
    case 'FEED_DROP':
      handleFeedDrop(client, message);
      break;
    case 'FEED_CONSUMED':
      handleFeedConsumed(client, message);
      break;
    case 'GLASS_TAP':
      handleGlassTap(client, message);
      break;
    case 'EMOTE_SEND':
      handleEmote(client, message);
      break;
    case 'PING':
      send(client, { type: 'PONG' });
      break;
    default:
      break;
  }
}

export function attachClient(socket: WebSocket) {
  const client: Client = {
    id: randomUUID(),
    ownerId: 'anon',
    socket,
    room: null,
    alive: true,
    lastMessageAt: Date.now(),
    messageBudget: MAX_MESSAGES_PER_10S,
  };
  clients.add(client);
  send(client, { type: 'WELCOME', clientId: client.id });

  socket.on('message', (raw) => {
    const rawSize = Array.isArray(raw)
      ? raw.reduce((total, chunk) => total + chunk.byteLength, 0)
      : raw.byteLength;
    if (rawSize > 150_000) {
      socket.close(1009, 'payload too large');
      return;
    }
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') return;
    try {
      handleMessage(client, parsed);
    } catch (error) {
      console.error('[room] message failed', error);
    }
  });

  socket.on('pong', () => {
    client.alive = true;
  });

  socket.on('close', () => {
    leaveRoom(client);
    clients.delete(client);
  });

  socket.on('error', () => {
    // close handler performs cleanup
  });
}

export function heartbeat() {
  for (const client of clients) {
    if (!client.alive) {
      client.socket.terminate();
      continue;
    }
    client.alive = false;
    try {
      client.socket.ping();
    } catch {
      // socket already closing
    }
  }
}

export function roomStats() {
  return {
    rooms: rooms.size,
    clients: clients.size,
    fishes: room.fishes.size,
    storedFishes: allFish.size,
  };
}


