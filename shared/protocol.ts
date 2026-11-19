// Shared contracts between the browser client and the realtime server.
// Imported by both `src/` and `server/`.

export const FISH_TEMPLATE_IDS = [
  'goldfish',
  'puffer',
  'bubblefish',
  'clownfish',
  'tang',
  'shark',
  'babyfish',
  'spotfish',
  'grouper',
  'angelfish',
  'free',
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

export interface ClientFishDelete {
  type: 'FISH_DELETE';
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

export interface ClientPing {
  type: 'PING';
}

export type ClientMessage =
  | ClientHello
  | ClientFishSpawn
  | ClientFishDespawn
  | ClientFishDelete
  | ClientFishSync
  | ClientFeedDrop
  | ClientFeedConsumed
  | ClientGlassTap
  | ClientEmote
  | ClientPing;

export interface ServerWelcome {
  type: 'WELCOME';
  clientId: string;
}

export interface ServerRoomSnapshot {
  type: 'ROOM_SNAPSHOT';
  room: RoomInfo;
  fishes: FishEntity[];
  /** All fish owned by this player, including inactive collection fish. */
  myFishes: FishEntity[];
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
  code: 'OCEAN_FULL' | 'INVALID_PAYLOAD' | 'RATE_LIMIT' | 'UNKNOWN';
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
  | ServerPong;

export const ROOM_CAPACITY = 18;
export const MAX_CLIENTS_PER_ROOM = 60;
export const MAX_FISH_PER_OWNER = 3;
export const MAX_TEXTURE_BYTES = 80 * 1024;
