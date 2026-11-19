import { createId } from './utils';

const OWNER_KEY = 'dyf:owner:v3';
export const MAX_ACTIVE_FISH = 3;

let memoryOwner = '';

/**
 * Only the anonymous player id is stored locally. Fish collections and their
 * textures live on the realtime backend (Durable Object / Node store), never
 * in IndexedDB or localStorage.
 */
export async function ensureOwnerId(): Promise<string> {
  try {
    const existing = window.localStorage.getItem(OWNER_KEY);
    if (existing && /^[a-zA-Z0-9-]{6,64}$/.test(existing)) return existing;
  } catch {
    // localStorage unavailable — use the in-memory identity.
  }
  const ownerId = memoryOwner || createId();
  memoryOwner = ownerId;
  try {
    window.localStorage.setItem(OWNER_KEY, ownerId);
  } catch {
    // ignore
  }
  return ownerId;
}
