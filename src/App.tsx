import { useEffect, useRef } from 'react';
import { AquariumCanvas } from './components/AquariumCanvas';
import { CollectionSheet } from './components/CollectionSheet';
import { DrawingStudio } from './components/DrawingStudio';
import { EmoteMenu } from './components/EmoteMenu';
import { Hud } from './components/Hud';
import { Onboarding } from './components/Onboarding';
import { PhotoBooth } from './components/PhotoBooth';
import { RoomSheet } from './components/RoomSheet';
import { Toasts } from './components/Toasts';
import { Icon } from './components/Icon';
import { getEngine } from './aquarium/bridge';
import { sound } from './lib/audio';
import { network } from './net/client';
import { useGameStore } from './store/useGameStore';
import { SEA_ICONS } from '../shared/protocol';

export default function App() {
  const ready = useGameStore((state) => state.ready);
  const studioOpen = useGameStore((state) => state.studioOpen);
  const collectionOpen = useGameStore((state) => state.collectionOpen);
  const roomOpen = useGameStore((state) => state.roomOpen);
  const photoOpen = useGameStore((state) => state.photoOpen);
  const onboardingOpen = useGameStore((state) => state.onboardingOpen);
  const pendingRoomRef = useRef<string[] | null>(null);

  useEffect(() => {
    const roomParam = new URLSearchParams(window.location.search).get('room');
    if (roomParam && /^[0-7]{4}$/.test(roomParam)) {
      pendingRoomRef.current = roomParam.split('').map((index) => SEA_ICONS[Number(index)]);
    }

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
          case 'ROOM_SNAPSHOT': {
            const previous = store.room;
            store.applySnapshot(message.room, message.fishes, message.clientId, message.onlineCount);
            if (message.room.kind === 'private' && previous?.id !== message.room.id) {
              store.addToast(`Ruang keluarga siap! ${message.room.code.join(' ')}`, 'success');
            }
            if (pendingRoomRef.current) {
              const code = pendingRoomRef.current;
              pendingRoomRef.current = null;
              network.joinPrivateRoom(code);
            }
            break;
          }
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
          case 'ERROR':
            store.addToast(message.message, 'warn');
            break;
          case 'ROOM_CLOSED':
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

  const overlayOpen =
    studioOpen || collectionOpen || roomOpen || photoOpen || (ready && onboardingOpen);

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
      {roomOpen && <RoomSheet />}
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
