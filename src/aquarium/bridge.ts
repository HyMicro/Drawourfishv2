import type { AquariumEngine } from './engine';

let current: AquariumEngine | null = null;

export function setEngine(engine: AquariumEngine | null) {
  current = engine;
}

export function getEngine(): AquariumEngine | null {
  return current;
}
