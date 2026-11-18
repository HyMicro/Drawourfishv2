import { useState } from 'react';
import { SEA_ICONS } from '../../shared/protocol';
import { network } from '../net/client';
import { useGameStore } from '../store/useGameStore';
import { Icon } from './Icon';

export function RoomSheet() {
  const closeRoom = useGameStore((state) => state.closeRoom);
  const room = useGameStore((state) => state.room);
  const connection = useGameStore((state) => state.connection);
  const onlineCount = useGameStore((state) => state.onlineCount);
  const hiddenIds = useGameStore((state) => state.hiddenIds);
  const restoreHidden = useGameStore((state) => state.restoreHidden);
  const addToast = useGameStore((state) => state.addToast);

  const [code, setCode] = useState<string[]>([SEA_ICONS[0], SEA_ICONS[1], SEA_ICONS[2], SEA_ICONS[3]]);
  const [slot, setSlot] = useState(0);
  const [joining, setJoining] = useState(false);

  const online = connection === 'online';

  const createRoom = () => {
    if (!online) {
      addToast('Belum tersambung. Ikanmu tetap berenang di Local Reef.', 'warn');
      return;
    }
    setJoining(true);
    network.createPrivateRoom();
    window.setTimeout(() => setJoining(false), 1200);
  };

  const joinRoom = () => {
    if (!online) {
      addToast('Belum tersambung ke laut. Coba lagi sebentar.', 'warn');
      return;
    }
    setJoining(true);
    network.joinPrivateRoom(code);
    window.setTimeout(() => setJoining(false), 1500);
  };

  const leaveRoom = () => {
    network.leavePrivateRoom();
    setJoining(true);
    window.setTimeout(() => setJoining(false), 1200);
  };

  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code.join(' '));
      addToast('Kode ruang disalin. Kirim ke keluarga ya!', 'success');
    } catch {
      addToast(`Kode ruang: ${room.code.join(' ')}`, 'info');
    }
  };

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeRoom();
      }}
    >
      <section className="glass-panel sheet-panel room-panel" role="dialog" aria-modal="true" aria-label="Ruang bersama">
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Shared Live Reef</p>
            <h2>Ruang Bersama</h2>
          </div>
          <button type="button" className="glass-btn icon-btn" onClick={closeRoom} aria-label="Tutup">
            <Icon name="close" size={24} />
          </button>
        </header>

        <div className={`connection-strip ${connection}`}>
          <span className={`status-dot ${connection}`} />
          {online ? (
            <span>
              {onlineCount} teman di ruang ini · {room?.capacity ?? 18} ikan
            </span>
          ) : (
            <span>
              <Icon name="wifi-off" size={15} /> Local Reef · menyambung otomatis
            </span>
          )}
        </div>

        {room?.kind === 'private' ? (
          <div className="room-current">
            <div className="room-card glass-inset">
              <div className="room-card-head">
                <span className="room-kind">
                  <Icon name="lock" size={18} /> Ruang Keluarga
                </span>
                <span className="room-live">LIVE</span>
              </div>
              <div className="room-code-visual" aria-label={`Kode ruang ${room.code.join(' ')}`}>
                {room.code.map((icon, index) => (
                  <span key={`${icon}-${index}`} className="room-code-tile">
                    {icon}
                  </span>
                ))}
              </div>
              <p>Bagikan 4 ikon ini. Tanpa chat, hanya ikan dan emote.</p>
              <div className="room-card-actions">
                <button type="button" className="glass-btn" onClick={copyCode}>
                  <Icon name="copy" size={20} /> Salin Kode
                </button>
                <button type="button" className="glass-btn subtle" onClick={leaveRoom} disabled={joining}>
                  <Icon name="globe" size={20} /> Kembali ke Ocean
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="room-create glass-inset">
            <div className="room-create-copy">
              <span className="feature-icon">
                <Icon name="users" size={28} />
              </span>
              <div>
                <h3>Ruang keluarga</h3>
                <p>Kumpulkan 4 ikon rahasia untuk saudara dan teman.</p>
              </div>
            </div>
            <button type="button" className="glass-btn primary" onClick={createRoom} disabled={joining}>
              <Icon name="plus" size={22} /> Buat Ruang Bersama
            </button>
          </div>
        )}

        {room?.kind !== 'private' && (
          <div className="join-room">
            <div className="tool-heading">
              <h3>Gabung dengan 4 ikon</h3>
              <span>{joining ? 'menyambungkan…' : 'ketuk ikon untuk ganti'}</span>
            </div>
            <div className="join-slots">
              {code.map((icon, index) => (
                <button
                  key={index}
                  type="button"
                  className={`join-slot ${slot === index ? 'active' : ''}`}
                  onClick={() => setSlot(index)}
                  aria-label={`Ikon ${index + 1}: ${icon}`}
                >
                  {icon}
                </button>
              ))}
              <button type="button" className="glass-btn primary join-button" onClick={joinRoom} disabled={joining || !online}>
                <Icon name="arrow-right" size={22} /> Gabung
              </button>
            </div>
            <div className="icon-picker">
              {SEA_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className="icon-pick"
                  onClick={() => {
                    setCode((current) => {
                      const next = [...current];
                      next[slot] = icon;
                      return next;
                    });
                    setSlot((current) => (current + 1) % 4);
                  }}
                  aria-label={`Pilih ikon ${icon}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        )}

        {hiddenIds.length > 0 && (
          <div className="hidden-strip">
            <span>
              <Icon name="eye-off" size={18} /> {hiddenIds.length} ikan disembunyikan
            </span>
            <button type="button" className="glass-btn subtle" onClick={restoreHidden}>
              Tampilkan lagi
            </button>
          </div>
        )}

        <footer className="room-footer">
          <span>
            <Icon name="lock" size={15} /> Tanpa chat teks · tanpa akun · tanpa data pribadi
          </span>
        </footer>
      </section>
    </div>
  );
}
