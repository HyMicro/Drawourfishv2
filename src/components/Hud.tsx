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
      : room.label
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
    for (const pellet of dropped) {
      network.dropFeed(pellet.id, pellet.x, pellet.y);
    }
  };

  return (
    <>
      <header className="hud-top">
        <div className="brand glass-chip">
          <span className="brand-mark">
            <Icon name="fish" size={30} />
          </span>
          <div className="brand-copy">
            <strong>Draw Our Fish</strong>
            <span>Shared Live Reef</span>
          </div>
        </div>

        <div className="top-actions">
          <button
            type="button"
            className="room-chip glass-chip"
            onClick={openRoom}
            aria-label="Buka ruang bersama"
          >
            <span className={`status-dot ${connection}`} aria-hidden="true" />
            <span className="room-chip-label">{roomLabel}</span>
            <span className="room-chip-count">
              <Icon name="fish" size={15} /> {fishCount}
            </span>
          </button>
          <button
            type="button"
            className="glass-btn icon-btn sound-btn"
            onClick={toggleMute}
            aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
          >
            <Icon name={muted ? 'volume-off' : 'volume'} size={25} />
          </button>
        </div>
      </header>

      <div className="hud-hint">
        <Icon name="sparkles" size={15} />
        <span>Ketuk ikan untuk menyapa · tahan 2 detik untuk menu</span>
      </div>

      <nav className="dock-shell" aria-label="Kontrol utama">
        <div className="dock glass-panel">
          <button type="button" className="dock-item" onClick={openRoom}>
            <span className="dock-icon">
              <Icon name="users" size={26} />
              {connection === 'offline' && <span className="tiny-badge">!</span>}
            </span>
            <span>Ruang</span>
          </button>
          <button type="button" className="dock-item" onClick={openCollection}>
            <span className="dock-icon">
              <Icon name="book" size={26} />
              <span className="count-badge">{activeIds.length}/3</span>
            </span>
            <span>Ikanku</span>
          </button>

          <button type="button" className="create-fab" onClick={openStudio} aria-label="Gambar ikan baru">
            <span className="fab-glow" aria-hidden="true" />
            <Icon name="plus" size={38} />
            <span>Gambar Ikan</span>
          </button>

          <button type="button" className="dock-item" onClick={feed}>
            <span className="dock-icon">
              <Icon name="feed" size={26} />
            </span>
            <span>Pakan</span>
          </button>
          <button type="button" className="dock-item" onClick={openPhoto}>
            <span className="dock-icon">
              <Icon name="camera" size={26} />
            </span>
            <span>Foto</span>
          </button>
        </div>
      </nav>
    </>
  );
}
