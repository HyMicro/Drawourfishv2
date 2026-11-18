import { getEngine } from '../aquarium/bridge';
import { network } from '../net/client';
import { useGameStore } from '../store/useGameStore';
import { Icon } from './Icon';

export function Hud() {
  const openStudio = useGameStore((state) => state.openStudio);
  const openCollection = useGameStore((state) => state.openCollection);
  const openRoom = useGameStore((state) => state.openRoom);
  const openPhoto = useGameStore((state) => state.openPhoto);
  const addToast = useGameStore((state) => state.addToast);
  const toggleMute = useGameStore((state) => state.toggleMute);
  const muted = useGameStore((state) => state.muted);
  const connection = useGameStore((state) => state.connection);
  const room = useGameStore((state) => state.room);
  const liveFishes = useGameStore((state) => state.liveFishes);
  const activeIds = useGameStore((state) => state.activeIds);

  const fishCount = Object.keys(liveFishes).length;
  const roomLabel = room
    ? room.kind === 'private'
      ? room.code.join(' ')
      : 'Ocean'
    : connection === 'offline'
      ? 'Local Reef'
      : 'Menyambung…';

  const feed = () => {
    const engine = getEngine();
    if (!engine) {
      addToast('Tunggu akuarium siap sebentar ya.', 'warn');
      return;
    }
    const dropped = engine.spawnFeeding();
    for (const pellet of dropped) network.dropFeed(pellet.id, pellet.x, pellet.y);
  };

  return (
    <>
      <header className="hud-top">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="fish" size={27} />
          </span>
          <div className="brand-copy">
            <strong>Draw Our Fish</strong>
            <span>little ocean club</span>
          </div>
        </div>

        <div className="top-actions">
          <button type="button" className="room-pill" onClick={openRoom} aria-label="Buka ruang bersama">
            <span className={`status-dot ${connection}`} aria-hidden="true" />
            <span className="room-label">{roomLabel}</span>
            <span className="fish-count">
              <Icon name="fish" size={13} />
              {fishCount}
            </span>
          </button>
          <button
            type="button"
            className="round-btn sound-btn"
            onClick={toggleMute}
            aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
          >
            <Icon name={muted ? 'volume-off' : 'volume'} size={21} />
          </button>
        </div>
      </header>

      <nav className="dock-shell" aria-label="Kontrol utama">
        <div className="dock">
          <button type="button" className="dock-item" onClick={openCollection}>
            <span className="dock-icon">
              <Icon name="book" size={23} />
              <span className="count-badge">{activeIds.length}/3</span>
            </span>
            <span>Ikanku</span>
          </button>
          <button type="button" className="dock-item" onClick={feed}>
            <span className="dock-icon">
              <Icon name="feed" size={23} />
            </span>
            <span>Pakan</span>
          </button>

          <button type="button" className="draw-fab" onClick={openStudio} aria-label="Gambar ikan baru">
            <span className="draw-fab-icon">
              <Icon name="plus" size={27} />
            </span>
            <span>Gambar</span>
          </button>

          <button type="button" className="dock-item" onClick={openPhoto}>
            <span className="dock-icon">
              <Icon name="camera" size={23} />
            </span>
            <span>Foto</span>
          </button>
          <button type="button" className="dock-item" onClick={openRoom}>
            <span className="dock-icon">
              <Icon name="users" size={23} />
              {connection === 'offline' && <span className="tiny-badge">!</span>}
            </span>
            <span>Ruang</span>
          </button>
        </div>
      </nav>
    </>
  );
}
