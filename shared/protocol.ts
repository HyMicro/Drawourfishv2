// Shared contracts between the browser client and the realtime server.
// Imported by both `src/` and `server/`.

export const FISH_TEMPLATE_IDS = [
  'clownfish',
  'goldfish',
  'puffer',
  'shark',
  'seahorse',
  'angelfish',
  'manta',
  'whale',
] as const;

export type FishTemplateId = (typeof FISH_TEMPLATE_IDS)[number];

export type FishState = 'WANDER' | 'SEEK_FOOD' | 'CURIOUS_TAP';

export type EmoteKind = 'HEART' | 'SPARKLE' | 'BUBBLE' | 'MUSIC';

export const EMOTES: Record<EmoteKind, string> = {
  HEART: '❤️',
  SPARKLE: '✨',
  BUBBLE: '🫧',
  MUSIC: '🎵',
};

export const SEA_ICONS = ['🦀', '⭐', '🐙', '🐚', '🐠', '🪼', '🐬', '🦑'] as const;

export type RoomKind = 'public' | 'private';

export interface FishTransform {
  /** Normalised 0..1 across the aquarium width. */
  x: number;
  /** Normalised 0..1 across the aquarium height. */
  y: number;
  targetX: number;
  targetY: number;
  /** Base swim speed in pixels/second at a 1280px reference width. */
  speed: number;
  facing: 1 | -1;
}

export interface FishEntity {
  id: string;
  ownerId: string;
  name: string;
  templateId: FishTemplateId;
  /** Compressed WebP data URL. */
  textureData: string;
  createdAt: number;
  transform: FishTransform;
  state: FishState;
}

export interface FishSync {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: FishState;
  facing: 1 | -1;
}

export interface RoomInfo {
  id: string;
  code: string[];
  kind: RoomKind;
  capacity: number;
  label: string;
}

export interface FeedPellet {
  id: string;
  x: number;
  y: number;
}

export interface ClientHello {
  type: 'HELLO';
  ownerId: string;
}

export interface ClientFishSpawn {
  type: 'FISH_SPAWN';
  fish: FishEntity;
}

export interface ClientFishDespawn {
  type: 'FISH_DESPAWN';
  fishId: string;
}

export interface ClientFishSync {
  type: 'FISH_SYNC_BATCH';
  updates: FishSync[];
}

export interface ClientFeedDrop {
  type: 'FEED_DROP';
  pelletId: string;
  x: number;
  y: number;
}

export interface ClientFeedConsumed {
  type: 'FEED_CONSUMED';
  pelletId: string;
  fishId: string;
}

export interface ClientGlassTap {
  type: 'GLASS_TAP';
  x: number;
  y: number;
}

export interface ClientEmote {
  type: 'EMOTE_SEND';
  targetFishId: string;
  emote: EmoteKind;
}

export interface ClientCreatePrivate {
  type: 'CREATE_PRIVATE';
}

export interface ClientJoinPrivate {
  type: 'JOIN_PRIVATE';
  code: string[];
}

export interface ClientLeavePrivate {
  type: 'LEAVE_PRIVATE';
}

export interface ClientPing {
  type: 'PING';
}

export type ClientMessage =
  | ClientHello
  | ClientFishSpawn
  | ClientFishDespawn
  | ClientFishSync
  | ClientFeedDrop
  | ClientFeedConsumed
  | ClientGlassTap
  | ClientEmote
  | ClientCreatePrivate
  | ClientJoinPrivate
  | ClientLeavePrivate
  | ClientPing;

export interface ServerWelcome {
  type: 'WELCOME';
  clientId: string;
}

export interface ServerRoomSnapshot {
  type: 'ROOM_SNAPSHOT';
  room: RoomInfo;
  fishes: FishEntity[];
  clientId: string;
  onlineCount: number;
}

export interface ServerFishSpawn {
  type: 'FISH_SPAWN';
  fish: FishEntity;
}

export interface ServerFishDespawn {
  type: 'FISH_DESPAWN';
  fishId: string;
}

export interface ServerFishSync {
  type: 'FISH_SYNC_BATCH';
  updates: FishSync[];
}

export interface ServerFeedDrop {
  type: 'FEED_DROP';
  pelletId: string;
  x: number;
  y: number;
}

export interface ServerFeedConsumed {
  type: 'FEED_CONSUMED';
  pelletId: string;
  fishId: string;
}

export interface ServerGlassTap {
  type: 'GLASS_TAP';
  x: number;
  y: number;
}

export interface ServerEmote {
  type: 'EMOTE_EVENT';
  targetFishId: string;
  emote: EmoteKind;
}

export interface ServerError {
  type: 'ERROR';
  code: 'ROOM_FULL' | 'ROOM_NOT_FOUND' | 'INVALID_CODE' | 'INVALID_PAYLOAD' | 'RATE_LIMIT' | 'UNKNOWN';
  message: string;
}

export interface ServerRoomClosed {
  type: 'ROOM_CLOSED';
  message: string;
}

export interface ServerPong {
  type: 'PONG';
}

export type ServerMessage =
  | ServerWelcome
  | ServerRoomSnapshot
  | ServerFishSpawn
  | ServerFishDespawn
  | ServerFishSync
  | ServerFeedDrop
  | ServerFeedConsumed
  | ServerGlassTap
  | ServerEmote
  | ServerError
  | ServerRoomClosed
  | ServerPong;

export const ROOM_CAPACITY = 18;
export const MAX_CLIENTS_PER_ROOM = 14;
export const MAX_FISH_PER_OWNER = 3;
export const MAX_TEXTURE_BYTES = 80 * 1024;
