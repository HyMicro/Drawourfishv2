import { get, set } from 'idb-keyval';
import type { FishEntity } from '../../shared/protocol';
import { FISH_TEMPLATE_IDS } from '../../shared/protocol';
import { createId } from './utils';

const OWNER_KEY = 'dyf:owner:v2';
const COLLECTION_KEY = 'dyf:collection:v3';
const ACTIVE_KEY = 'dyf:active:v3';
const MAX_COLLECTION = 30;

function isFishEntity(value: unknown): value is FishEntity {
  if (!value || typeof value !== 'object') return false;
  const fish = value as Partial<FishEntity>;
  return (
    typeof fish.id === 'string' &&
    typeof fish.name === 'string' &&
    typeof fish.textureData === 'string' &&
    fish.textureData.startsWith('data:image/') &&
    typeof fish.templateId === 'string' &&
    (FISH_TEMPLATE_IDS as readonly string[]).includes(fish.templateId) &&
    typeof fish.createdAt === 'number'
  );
}

export async function ensureOwnerId(): Promise<string> {
  try {
    const existing = await get<string>(OWNER_KEY);
    if (existing && /^[a-zA-Z0-9-]{6,64}$/.test(existing)) return existing;
  } catch {
    // IndexedDB unavailable (private mode) — use an in-memory identity.
  }
  const ownerId = createId();
  try {
    await set(OWNER_KEY, ownerId);
  } catch {
    // ignore
  }
  return ownerId;
}

export async function loadCollection(ownerId: string): Promise<FishEntity[]> {
  try {
    const stored = await get<FishEntity[]>(COLLECTION_KEY);
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(isFishEntity)
      .filter((fish) => fish.textureData.length < 120_000)
      .slice(0, MAX_COLLECTION)
      .map((fish) => ({
        ...fish,
        ownerId,
        transform: {
          ...fish.transform,
          x: Number.isFinite(fish.transform?.x) ? fish.transform.x : 0.5,
          y: Number.isFinite(fish.transform?.y) ? fish.transform.y : 0.5,
        },
      }));
  } catch {
    return [];
  }
}

export async function loadActiveIds(): Promise<string[]> {
  try {
    const stored = await get<string[]>(ACTIVE_KEY);
    if (Array.isArray(stored)) return stored.filter((id) => typeof id === 'string').slice(0, 3);
  } catch {
    // ignore
  }
  return [];
}

export async function persistCollection(collection: FishEntity[]) {
  try {
    await set(COLLECTION_KEY, collection.slice(0, MAX_COLLECTION));
  } catch {
    // ignore quota errors
  }
}

export async function persistActive(activeIds: string[]) {
  try {
    await set(ACTIVE_KEY, activeIds.slice(0, 3));
  } catch {
    // ignore
  }
}

export const MAX_ACTIVE_FISH = 3;
