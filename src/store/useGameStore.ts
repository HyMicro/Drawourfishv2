import { create } from 'zustand';
import type { FishEntity } from '../../shared/protocol';
import { createBotFishes } from '../lib/bots';
import { network, type ConnectionStatus } from '../net/client';
import { sound } from '../lib/audio';
import {
  MAX_ACTIVE_FISH,
  ensureOwnerId,
} from '../lib/persistence';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'warn';
}

export interface EmoteTarget {
  fishId: string;
  name: string;
  isMine: boolean;
  x: number;
  y: number;
}

interface UIState {
  studioOpen: boolean;
  collectionOpen: boolean;
  photoOpen: boolean;
  emoteTarget: EmoteTarget | null;
  toasts: Toast[];
  muted: boolean;
  onboardingOpen: boolean;
}

interface GameStore extends UIState {
  ownerId: string;
  ready: boolean;
  collection: FishEntity[];
  activeIds: string[];
  liveFishes: Record<string, FishEntity>;
  bots: FishEntity[];
  hiddenIds: string[];
  onlineCount: number;
  clientId: string | null;
  connection: ConnectionStatus;

  bootstrap: () => Promise<void>;
  addFish: (fish: FishEntity) => void;
  toggleActive: (fishId: string) => void;
  deleteFish: (fishId: string) => void;
  setConnection: (status: ConnectionStatus) => void;
  goOffline: () => void;
  applySnapshot: (myFishes: FishEntity[], fishes: FishEntity[], clientId: string, onlineCount: number) => void;
  applyRemoteSpawn: (fish: FishEntity) => void;
  applyRemoteDespawn: (fishId: string) => void;
  applyGrowth: (fishId: string, growth: number) => void;
  hideFish: (fishId: string) => void;
  restoreHidden: () => void;

  openStudio: () => void;
  closeStudio: () => void;
  openCollection: () => void;
  closeCollection: () => void;
  openPhoto: () => void;
  closePhoto: () => void;
  openEmoteMenu: (fish: FishEntity, x: number, y: number) => void;
  closeEmoteMenu: () => void;
  toggleMute: () => void;
  addToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  closeOnboarding: () => void;
}

let bootPromise: Promise<void> | null = null;
const MUTE_KEY = 'dyf:muted:v1';

function readInitialMute(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function liveForLocalReef(collection: FishEntity[], activeIds: string[], bots: FishEntity[]) {
  const map: Record<string, FishEntity> = {};
  for (const fish of bots) map[fish.id] = fish;
  for (const fish of collection) {
    if (activeIds.includes(fish.id)) map[fish.id] = fish;
  }
  return map;
}

const BOT_HIDE_AT = 14;
const BOT_RETURN_AT = 12;

function isBot(fish: FishEntity) {
  return fish.ownerId.startsWith('bot-');
}

function realFishCount(liveFishes: Record<string, FishEntity>) {
  return Object.values(liveFishes).filter((fish) => !isBot(fish)).length;
}

/** Keep a quiet reef alive with two friendly residents, without exceeding the
 * 18-fish performance budget once the public room fills up. */
function addQuietReefBots(liveFishes: Record<string, FishEntity>, bots: FishEntity[]) {
  for (const bot of bots.slice(0, 2)) liveFishes[bot.id] = bot;
  return liveFishes;
}

function removeBots(liveFishes: Record<string, FishEntity>) {
  for (const fish of Object.values(liveFishes)) {
    if (isBot(fish)) delete liveFishes[fish.id];
  }
  return liveFishes;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  ownerId: '',
  ready: false,
  collection: [],
  activeIds: [],
  liveFishes: {},
  bots: [],
  hiddenIds: [],
  onlineCount: 0,
  clientId: null,
  connection: 'connecting',
  studioOpen: false,
  collectionOpen: false,
  photoOpen: false,
  emoteTarget: null,
  toasts: [],
  muted: readInitialMute(),
  onboardingOpen: false,

  bootstrap: async () => {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      const ownerId = await ensureOwnerId();

      let onboardingOpen = false;
      try {
        onboardingOpen = window.localStorage.getItem('dyf:onboarded:v1') !== '1';
      } catch {
        onboardingOpen = true;
      }

      const bots = createBotFishes();
      const muted = get().muted;
      if (muted) sound.setMuted(true);

      set({
        ownerId,
        collection: [],
        activeIds: [],
        bots,
        liveFishes: liveForLocalReef([], [], bots),
        muted,
        onboardingOpen,
        ready: true,
      });
      network.connect(ownerId);
    })();
    return bootPromise;
  },

  addFish: (fish) => {
    const state = get();
    const collection = [fish, ...state.collection].slice(0, 30);
    let activeIds = [...state.activeIds];
    let liveFishes = { ...state.liveFishes };
    delete liveFishes[fish.id];

    if (activeIds.length >= MAX_ACTIVE_FISH) {
      const evicted = activeIds.shift();
      if (evicted) {
        network.despawnFish(evicted);
        delete liveFishes[evicted];
      }
    }
    activeIds.push(fish.id);
    liveFishes[fish.id] = fish;

    set({ collection, activeIds, liveFishes, studioOpen: false, emoteTarget: null });
    network.spawnFish(fish);
    get().addToast(`${fish.name} berenang ke laut! 🫧`, 'success');
  },

  toggleActive: (fishId) => {
    const state = get();
    const fish = state.collection.find((item) => item.id === fishId);
    if (!fish) return;
    const liveFishes = { ...state.liveFishes };
    if (state.activeIds.includes(fishId)) {
      const activeIds = state.activeIds.filter((id) => id !== fishId);
      delete liveFishes[fishId];
      set({ activeIds, liveFishes });
      network.despawnFish(fishId);
      get().addToast(`${fish.name} kembali ke koleksi.`);
      sound.chime('soft');
      return;
    }
    if (state.activeIds.length >= MAX_ACTIVE_FISH) {
      get().addToast('Maksimal 3 ikan berenang. Angkat satu dulu ya!', 'warn');
      return;
    }
    const activeIds = [...state.activeIds, fishId];
    liveFishes[fishId] = fish;
    set({ activeIds, liveFishes });
    network.spawnFish(fish);
    sound.pop();
    get().addToast(`${fish.name} berenang lagi!`, 'success');
  },

  deleteFish: (fishId) => {
    const state = get();
    const fish = state.collection.find((item) => item.id === fishId);
    if (!fish) return;
    const activeIds = state.activeIds.filter((id) => id !== fishId);
    const liveFishes = { ...state.liveFishes };
    delete liveFishes[fishId];
    const collection = state.collection.filter((item) => item.id !== fishId);
    set({ activeIds, liveFishes, collection });
    network.deleteFish(fishId);
    get().addToast(`${fish.name} dilepas dari koleksi.`);
  },

  setConnection: (status) => {
    if (status === 'offline') {
      get().goOffline();
      return;
    }
    set({ connection: status });
  },

  goOffline: () => {
    const state = get();
    if (state.connection === 'offline') return;
    set({
      connection: 'offline',
      onlineCount: 0,
      clientId: null,
      liveFishes: liveForLocalReef(state.collection, state.activeIds, state.bots),
      emoteTarget: null,
    });
  },

  applySnapshot: (myFishes, fishes, clientId, onlineCount) => {
    const state = get();
    const seenMine = new Set<string>();
    const collection: FishEntity[] = [];
    for (const fish of Array.isArray(myFishes) ? myFishes : []) {
      if (!fish || typeof fish.id !== 'string' || fish.ownerId !== state.ownerId) continue;
      if (seenMine.has(fish.id)) continue;
      seenMine.add(fish.id);
      collection.push(fish);
    }
    collection.sort((a, b) => b.createdAt - a.createdAt);

    const liveFishes: Record<string, FishEntity> = {};
    const activeIds: string[] = [];
    for (const fish of Array.isArray(fishes) ? fishes : []) {
      if (!fish || typeof fish.id !== 'string' || liveFishes[fish.id]) continue;
      liveFishes[fish.id] = fish;
      if (fish.ownerId === state.ownerId) activeIds.push(fish.id);
    }
    if (realFishCount(liveFishes) < BOT_HIDE_AT) addQuietReefBots(liveFishes, state.bots);
    set({
      collection,
      activeIds: activeIds.slice(0, MAX_ACTIVE_FISH),
      clientId,
      onlineCount,
      connection: 'online',
      liveFishes,
      bots: state.bots,
      hiddenIds: state.hiddenIds.filter((id) => Boolean(liveFishes[id])),
    });
  },

  applyRemoteSpawn: (fish) => {
    const state = get();
    if (!fish || typeof fish.id !== 'string') return;
    const liveFishes = { ...state.liveFishes };
    if (fish.ownerId === state.ownerId) {
      const collection = state.collection.some((item) => item.id === fish.id)
        ? state.collection
        : [fish, ...state.collection].slice(0, 30);
      const activeIds = state.activeIds.includes(fish.id)
        ? state.activeIds
        : [...state.activeIds, fish.id].slice(0, MAX_ACTIVE_FISH);
      liveFishes[fish.id] = fish;
      set({ collection, activeIds, liveFishes });
      return;
    }
    if (liveFishes[fish.id]) return;
    const count = realFishCount(liveFishes);
    if (count >= 18) return;
    if (count + 1 >= BOT_HIDE_AT) removeBots(liveFishes);
    liveFishes[fish.id] = fish;
    set({ liveFishes });
    sound.pop();
  },

  applyRemoteDespawn: (fishId) => {
    const state = get();
    if (!state.liveFishes[fishId] && !state.activeIds.includes(fishId)) return;
    const liveFishes = { ...state.liveFishes };
    delete liveFishes[fishId];
    if (realFishCount(liveFishes) <= BOT_RETURN_AT) addQuietReefBots(liveFishes, state.bots);
    set({
      liveFishes,
      activeIds: state.activeIds.filter((id) => id !== fishId),
      hiddenIds: state.hiddenIds.filter((id) => id !== fishId),
      emoteTarget: state.emoteTarget?.fishId === fishId ? null : state.emoteTarget,
    });
  },

  applyGrowth: (fishId, growth) => {
    const state = get();
    const collection = state.collection.map((fish) =>
      fish.id === fishId ? { ...fish, growth } : fish,
    );
    const live = state.liveFishes[fishId];
    const liveFishes = live
      ? { ...state.liveFishes, [fishId]: { ...live, growth } }
      : state.liveFishes;
    set({ collection, liveFishes });
  },

  hideFish: (fishId) => {
    const state = get();
    if (state.hiddenIds.includes(fishId)) return;
    set({ hiddenIds: [...state.hiddenIds, fishId] });
    get().addToast('Ikan itu disembunyikan dari layar ini.');
  },

  restoreHidden: () => {
    set({ hiddenIds: [] });
    get().addToast('Semua ikan terlihat lagi.', 'success');
  },

  openStudio: () => {
    sound.unlock();
    sound.chime('bright');
    set({ studioOpen: true, collectionOpen: false, emoteTarget: null });
  },
  closeStudio: () => set({ studioOpen: false }),
  openCollection: () => {
    sound.unlock();
    sound.chime('soft');
    set({ collectionOpen: true, studioOpen: false, emoteTarget: null });
  },
  closeCollection: () => set({ collectionOpen: false }),
  openPhoto: () => {
    sound.unlock();
    sound.shutter();
    set({ photoOpen: true, studioOpen: false, collectionOpen: false, emoteTarget: null });
  },
  closePhoto: () => set({ photoOpen: false }),

  openEmoteMenu: (fish, x, y) => {
    sound.unlock();
    sound.pop();
    set({
      emoteTarget: {
        fishId: fish.id,
        name: fish.name,
        isMine: fish.ownerId === get().ownerId,
        x,
        y,
      },
    });
  },
  closeEmoteMenu: () => set({ emoteTarget: null }),

  toggleMute: () => {
    const muted = !get().muted;
    set({ muted });
    sound.setMuted(muted);
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // ignore
    }
    if (!muted) sound.chime('bright');
  },

  addToast: (message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, message, tone }] }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, 3600);
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  closeOnboarding: () => {
    try {
      window.localStorage.setItem('dyf:onboarded:v1', '1');
    } catch {
      // ignore
    }
    set({ onboardingOpen: false });
    sound.unlock();
    sound.chime('bright');
  },
}));
