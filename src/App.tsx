import { useEffect } from 'react';
import { AquariumCanvas } from './components/AquariumCanvas';
import { CollectionSheet } from './components/CollectionSheet';
import { DrawingStudio } from './components/DrawingStudio';
import { EmoteMenu } from './components/EmoteMenu';
import { Hud } from './components/Hud';
import { Onboarding } from './components/Onboarding';
import { PhotoBooth } from './components/PhotoBooth';
import { Toasts } from './components/Toasts';
import { Icon } from './components/Icon';
import { getEngine } from './aquarium/bridge';
import { sound } from './lib/audio';
import { network } from './net/client';
import { useGameStore } from './store/useGameStore';

export default function App() {
  const ready = useGameStore((state) => state.ready);
  const studioOpen = useGameStore((state) => state.studioOpen);
  const collectionOpen = useGameStore((state) => state.collectionOpen);
  const photoOpen = useGameStore((state) => state.photoOpen);
  const onboardingOpen = useGameStore((state) => state.onboardingOpen);

  useEffect(() => {
    network.configure({
      onStatus: (status) => {
        const store = useGameStore.getState();
        const wasOffline = store.connection === 'offline';
        store.setConnection(status);
        if (status === 'online' && wasOffline) {
          store.addToast('Tersambung lagi ke laut! 🌊', 'success');
        }
      },
      onMessage: (message) => {
        const store = useGameStore.getState();
        switch (message.type) {
          case 'ROOM_SNAPSHOT':
            store.applySnapshot(message.myFishes ?? message.fishes, message.fishes, message.clientId, message.onlineCount);
            break;
          case 'FISH_SPAWN':
            store.applyRemoteSpawn(message.fish);
            break;
          case 'FISH_DESPAWN':
            store.applyRemoteDespawn(message.fishId);
            break;
          case 'FISH_SYNC_BATCH':
            getEngine()?.applyRemoteSync(message.updates);
            break;
          case 'FEED_DROP':
            getEngine()?.addPellet(message.pelletId, message.x, message.y);
            break;
          case 'FEED_CONSUMED':
            getEngine()?.removePellet(message.pelletId);
            break;
          case 'GLASS_TAP':
            getEngine()?.remoteTap(message.x, message.y);
            break;
          case 'EMOTE_EVENT':
            getEngine()?.playEmote(message.targetFishId, message.emote);
            break;
          case 'FISH_GROWTH':
            store.applyGrowth(message.fishId, message.growth);
            getEngine()?.applyGrowth(message.fishId, message.growth);
            break;
          case 'ERROR':
            store.addToast(message.message, 'warn');
            break;
          default:
            break;
        }
      },
    });

    void useGameStore.getState().bootstrap();

    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });

    const syncTimer = window.setInterval(() => {
      if (!network.isOnline) return;
      const updates = getEngine()?.getLocalSyncs() ?? [];
      if (updates.length > 0) network.sendSync(updates);
    }, 100);

    return () => {
      window.clearInterval(syncTimer);
      window.removeEventListener('pointerdown', unlock);
      network.disconnect();
    };
  }, []);

  const overlayOpen = studioOpen || collectionOpen || photoOpen || (ready && onboardingOpen);

  return (
    <div className={`app-root ${photoOpen ? 'photo-mode' : ''}`}>
      {ready ? <AquariumCanvas /> : <div className="boot-water" />}
      <div className="water-vignette" aria-hidden="true" />
      <div className="surface-glow" aria-hidden="true" />

      {ready && !overlayOpen && <Hud />}
      {!ready && <BootSplash />}

      {ready && <Toasts />}
      {studioOpen && <DrawingStudio />}
      {collectionOpen && <CollectionSheet />}
      {photoOpen && <PhotoBooth />}
      <EmoteMenu />
      {ready && onboardingOpen && <Onboarding />}
    </div>
  );
}

function BootSplash() {
  return (
    <div className="boot-splash">
      <div className="boot-mark">
        <Icon name="fish" size={58} />
      </div>
      <h1>Draw Our Fish</h1>
      <p>Menyiapkan akuarium…</p>
      <div className="boot-bubbles" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
