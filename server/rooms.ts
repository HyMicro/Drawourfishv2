import type { WebSocket } from 'ws';
import type { FishEntity, FishSync, RoomInfo } from '../shared/protocol';

export interface Client {
  id: string;
  ownerId: string;
  socket: WebSocket;
  room: Room | null;
  alive: boolean;
  lastMessageAt: number;
  messageBudget: number;
}

export interface Room {
  info: RoomInfo;
  clients: Set<Client>;
  fishes: Map<string, FishEntity>;
  /** Most recent transforms, kept for late joiners. */
  syncs: Map<string, FishSync>;
}

export const rooms = new Map<string, Room>();
