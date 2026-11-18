import { useEffect, useRef } from 'react';
import { AquariumEngine } from '../aquarium/engine';
import { setEngine } from '../aquarium/bridge';
import { network } from '../net/client';
import { useGameStore } from '../store/useGameStore';

export function AquariumCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<AquariumEngine | null>(null);
  const liveFishes = useGameStore((state) => state.liveFishes);
  const hiddenIds = useGameStore((state) => state.hiddenIds);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ownerId = useGameStore.getState().ownerId;
    const engine = new AquariumEngine(container, ownerId, {
      onFishTap: (fish, x, y) => {
        useGameStore.getState().openEmoteMenu(fish, x, y);
      },
      onWaterTap: (x, y) => {
        network.tapGlass(x, y);
      },
      onPelletConsumed: (pelletId, fishId) => {
        network.consumeFeed(pelletId, fishId);
      },
    });
    engineRef.current = engine;
    setEngine(engine);
    void engine.init();
    return () => {
      setEngine(null);
      engineRef.current = null;
      engine.destroy();
    };
  }, []);

  useEffect(() => {
    engineRef.current?.syncFishes(Object.values(liveFishes), hiddenIds);
  }, [liveFishes, hiddenIds]);

  return <div className="aquarium-root" ref={containerRef} aria-hidden="false" />;
}
