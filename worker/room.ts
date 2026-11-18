/// <reference types="@cloudflare/workers-types" />
import {
  FISH_TEMPLATE_IDS,
  MAX_CLIENTS_PER_ROOM,
  MAX_FISH_PER_OWNER,
  MAX_TEXTURE_BYTES,
  ROOM_CAPACITY,
  SEA_ICONS,
  type ClientMessage,
  type EmoteKind,
  type FishEntity,
  type FishSync,
  type FishTemplateId,
  type RoomInfo,
  type ServerMessage,
} from '../shared/protocol';

const EMOTES = new Set<EmoteKind>(['HEART', 'SPARKLE', 'BUBBLE', 'MUSIC']);
const MAX_NAME = 22;
const MAX_MESSAGES_PER_10S = 180;

interface Client {
  id: string;
  ownerId: string;
  socket: WebSocket;
  room: Room | null;
  lastMessageAt: number;
  messageBudget: number;
}

interface Room {
  info: RoomInfo;
  clients: Set<Client>;
  fishes: Map<string, FishEntity>;
  syncs: Map<string, FishSync>;
}

function send(client: Client, message: ServerMessage) {
  try {
    client.socket.send(JSON.stringify(message));
  } catch {
    // Socket already closing; the close handler performs cleanup.
  }
}

function sendRoom(room: Room, message: ServerMessage, except?: Client) {
  for (const client of room.clients) {
    if (client !== except) send(client, message);
  }
}

function clamp01(value: unknown, fallback = 0.5): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(1, Math.max(0, n));
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

function readWebpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') return null;
  const chunk = ascii(12, 4);

  if (chunk === 'VP8X') {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }

  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) return null;
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }

  if (chunk === 'VP8 ') {
    const start = 20;
    if (bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) return null;
    const width = (bytes[start + 6] | (bytes[start + 7] << 8)) & 0x3fff;
    const height = (bytes[start + 8] | (bytes[start + 9] << 8)) & 0x3fff;
    return { width, height };
  }

  return null;
}

function validateTexture(dataUrl: unknown): string | null {
  if (typeof dataUrl !== 'string') return 'Tekstur tidak valid.';
  const prefix = 'data:image/webp;base64,';
  if (!dataUrl.startsWith(prefix)) return 'Format ikan harus WebP.';
  let binary: string;
  try {
    binary = atob(dataUrl.slice(prefix.length));
  } catch {
    return 'Tekstur tidak dapat dibaca.';
  }
  if (binary.length === 0) return 'Tekstur kosong.';
  if (binary.length > MAX_TEXTURE_BYTES) return 'Ikan terlalu besar (maks 80 KB).';
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const size = readWebpSize(bytes);
  if (!size) return 'Header WebP tidak valid.';
  if (size.width < 96 || size.height < 96) return 'Resolusi ikan terlalu kecil.';
  if (size.width > 768 || size.height > 768) return 'Resolusi ikan terlalu besar.';
  if (Math.abs(size.width - size.height) > 2) return 'Rasio ikan harus persegi.';
  return null;
}

export class ReefRoom {
  private rooms = new Map<string, Room>();
  private clients = new Set<Client>();
  private codeIndex = new Map<string, string>();
  private shardCounter = 0;

  constructor(_state: DurableObjectState, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.attach(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private attach(socket: WebSocket) {
    const client: Client = {
      id: crypto.randomUUID(),
      ownerId: 'anon',
      socket,
      room: null,
      lastMessageAt: Date.now(),
      messageBudget: MAX_MESSAGES_PER_10S,
    };
    this.clients.add(client);
    send(client, { type: 'WELCOME', clientId: client.id });

    socket.addEventListener('message', (event) => {
      const raw = event.data;
      if (typeof raw !== 'string' || raw.length > 150_000) {
        if (typeof raw !== 'string') socket.close(1009, 'payload too large');
        return;
      }
      let parsed: ClientMessage;
      try {
        parsed = JSON.parse(raw) as ClientMessage;
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') return;
      try {
        this.handleMessage(client, parsed);
      } catch (error) {
        console.error('[reef] message failed', error);
      }
    });

    socket.addEventListener('close', () => {
      this.leaveRoom(client);
      this.clients.delete(client);
    });

    socket.addEventListener('error', () => {
      // close event performs cleanup
    });
  }

  private randomRoomCode(): string[] {
    const code: string[] = [];
    for (let i = 0; i < 4; i++) code.push(SEA_ICONS[Math.floor(Math.random() * SEA_ICONS.length)]);
    return code;
  }

  private makePrivateRoom(): Room {
    let code = this.randomRoomCode();
    let key = code.join('');
    while (this.codeIndex.has(key)) {
      code = this.randomRoomCode();
      key = code.join('');
    }
    const room: Room = {
      info: {
        id: `private-${crypto.randomUUID().slice(0, 8)}`,
        code,
        kind: 'private',
        capacity: ROOM_CAPACITY,
        label: 'Ruang Keluarga',
      },
      clients: new Set(),
      fishes: new Map(),
      syncs: new Map(),
    };
    this.rooms.set(room.info.id, room);
    this.codeIndex.set(key, room.info.id);
    return room;
  }

  private makePublicRoom(): Room {
    this.shardCounter += 1;
    const room: Room = {
      info: {
        id: `ocean-${this.shardCounter}-${crypto.randomUUID().slice(0, 4)}`,
        code: ['🌊', '🐠', '🫧', '☀️'],
        kind: 'public',
        capacity: ROOM_CAPACITY,
        label: 'Ocean Publik',
      },
      clients: new Set(),
      fishes: new Map(),
      syncs: new Map(),
    };
    this.rooms.set(room.info.id, room);
    return room;
  }

  private findPublicRoom(): Room {
    let best: Room | null = null;
    for (const room of this.rooms.values()) {
      if (room.info.kind !== 'public') continue;
      if (room.clients.size >= MAX_CLIENTS_PER_ROOM) continue;
      if (room.fishes.size >= ROOM_CAPACITY) continue;
      if (!best || room.fishes.size < best.fishes.size) best = room;
    }
    return best ?? this.makePublicRoom();
  }

  private leaveRoom(client: Client) {
    const room = client.room;
    if (!room) return;
    for (const [fishId, fish] of room.fishes) {
      if (fish.ownerId === client.ownerId) {
        room.fishes.delete(fishId);
        room.syncs.delete(fishId);
        sendRoom(room, { type: 'FISH_DESPAWN', fishId });
      }
    }
    room.clients.delete(client);
    client.room = null;
    if (room.info.kind === 'private' && room.clients.size === 0) {
      this.rooms.delete(room.info.id);
      this.codeIndex.delete(room.info.code.join(''));
    }
    if (room.info.kind === 'public' && room.clients.size === 0 && this.rooms.size > 1) {
      this.rooms.delete(room.info.id);
    }
  }

  private enterRoom(client: Client, room: Room) {
    client.room = room;
    room.clients.add(client);
    send(client, {
      type: 'ROOM_SNAPSHOT',
      room: room.info,
      fishes: [...room.fishes.values()],
      clientId: client.id,
      onlineCount: room.clients.size,
    });
  }

  private sanitizeFish(client: Client, input: unknown): FishEntity | string {
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

  private handleSpawn(client: Client, message: Extract<ClientMessage, { type: 'FISH_SPAWN' }>) {
    const room = client.room;
    if (!room) return;
    const fishId = message.fish?.id;
    const existing = typeof fishId === 'string' ? room.fishes.get(fishId) : undefined;
    if (existing && existing.ownerId !== client.ownerId) return;
    if (!existing && room.fishes.size >= ROOM_CAPACITY) {
      send(client, { type: 'ERROR', code: 'ROOM_FULL', message: 'Akuarium penuh, ikanmu berenang lokal dulu.' });
      return;
    }
    const ownCount = [...room.fishes.values()].filter((fish) => fish.ownerId === client.ownerId).length;
    if (!existing && ownCount >= MAX_FISH_PER_OWNER) {
      send(client, { type: 'ERROR', code: 'RATE_LIMIT', message: 'Maksimal 3 ikan aktif.' });
      return;
    }
    const fish = this.sanitizeFish(client, message.fish);
    if (typeof fish === 'string') {
      send(client, { type: 'ERROR', code: 'INVALID_PAYLOAD', message: fish });
      return;
    }
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
    sendRoom(room, { type: 'FISH_SPAWN', fish });
  }

  private handleSync(client: Client, message: Extract<ClientMessage, { type: 'FISH_SYNC_BATCH' }>) {
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

  private handleMessage(client: Client, message: ClientMessage) {
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
        if (!client.room) this.enterRoom(client, this.findPublicRoom());
        break;
      }
      case 'FISH_SPAWN':
        this.handleSpawn(client, message);
        break;
      case 'FISH_DESPAWN': {
        if (!client.room || typeof message.fishId !== 'string') return;
        const fish = client.room.fishes.get(message.fishId);
        if (!fish || fish.ownerId !== client.ownerId) return;
        client.room.fishes.delete(message.fishId);
        client.room.syncs.delete(message.fishId);
        sendRoom(client.room, { type: 'FISH_DESPAWN', fishId: message.fishId });
        break;
      }
      case 'FISH_SYNC_BATCH':
        this.handleSync(client, message);
        break;
      case 'FEED_DROP':
        if (!client.room || typeof message.pelletId !== 'string' || message.pelletId.length > 64) return;
        sendRoom(client.room, {
          type: 'FEED_DROP',
          pelletId: message.pelletId,
          x: clamp01(message.x),
          y: clamp01(message.y, 0.1),
        });
        break;
      case 'FEED_CONSUMED':
        if (!client.room || typeof message.pelletId !== 'string' || typeof message.fishId !== 'string') return;
        sendRoom(client.room, {
          type: 'FEED_CONSUMED',
          pelletId: message.pelletId,
          fishId: message.fishId,
        });
        break;
      case 'GLASS_TAP':
        if (!client.room) return;
        sendRoom(client.room, { type: 'GLASS_TAP', x: clamp01(message.x), y: clamp01(message.y) }, client);
        break;
      case 'EMOTE_SEND':
        if (!client.room || !EMOTES.has(message.emote) || typeof message.targetFishId !== 'string') return;
        sendRoom(client.room, { type: 'EMOTE_EVENT', targetFishId: message.targetFishId, emote: message.emote }, client);
        break;
      case 'CREATE_PRIVATE': {
        this.leaveRoom(client);
        this.enterRoom(client, this.makePrivateRoom());
        break;
      }
      case 'JOIN_PRIVATE': {
        if (!Array.isArray(message.code) || message.code.length !== 4) {
          send(client, { type: 'ERROR', code: 'INVALID_CODE', message: 'Kode ruang harus 4 ikon.' });
          return;
        }
        const roomId = this.codeIndex.get(message.code.join(''));
        const room = roomId ? this.rooms.get(roomId) : undefined;
        if (!room) {
          send(client, { type: 'ERROR', code: 'ROOM_NOT_FOUND', message: 'Ruang tidak ditemukan.' });
          return;
        }
        if (room.clients.size >= MAX_CLIENTS_PER_ROOM) {
          send(client, { type: 'ERROR', code: 'ROOM_FULL', message: 'Ruang ini sedang penuh.' });
          return;
        }
        this.leaveRoom(client);
        this.enterRoom(client, room);
        break;
      }
      case 'LEAVE_PRIVATE': {
        if (!client.room) return;
        this.leaveRoom(client);
        this.enterRoom(client, this.findPublicRoom());
        break;
      }
      case 'PING':
        send(client, { type: 'PONG' });
        break;
      default:
        break;
    }
  }
}
