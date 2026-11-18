import { useCallback, useEffect, useRef, useState } from 'react';
import { getEngine } from '../aquarium/bridge';
import { composePhoto } from '../lib/photo';
import { sound } from '../lib/audio';
import { useGameStore } from '../store/useGameStore';
import { Icon } from './Icon';

export function PhotoBooth() {
  const closePhoto = useGameStore((state) => state.closePhoto);
  const addToast = useGameStore((state) => state.addToast);
  const liveCount = useGameStore((state) => Object.keys(state.liveFishes).length);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(true);
  const aliveRef = useRef(true);

  const capture = useCallback(async () => {
    setBusy(true);
    setError(false);
    setPreview(null);
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // ignore
      }
    }
    const engine = getEngine();
    const shot = engine?.capture();
    if (!shot || !aliveRef.current) {
      if (aliveRef.current) {
        setError(true);
        setBusy(false);
      }
      return;
    }
    try {
      const framed = composePhoto(shot);
      const dataUrl = framed.toDataURL('image/png');
      if (aliveRef.current) {
        setPreview(dataUrl);
        setBusy(false);
        sound.shutter();
      }
    } catch (cause) {
      console.warn('[photo] composition failed', cause);
      if (aliveRef.current) {
        setError(true);
        setBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void capture();
    return () => {
      aliveRef.current = false;
    };
  }, [capture]);

  const download = () => {
    if (!preview) return;
    const date = new Date().toISOString().slice(0, 10);
    const anchor = document.createElement('a');
    anchor.href = preview;
    anchor.download = `draw-our-fish-${date}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    addToast('Kartu pos ikan tersimpan! 📸', 'success');
  };

  return (
    <div className="photo-overlay" role="dialog" aria-modal="true" aria-label="Mode foto">
      <div className="photo-topbar">
        <div className="photo-brand">
          <Icon name="camera" size={22} />
          <span>Glass Photo Booth</span>
        </div>
        <button type="button" className="glass-btn icon-btn" onClick={closePhoto} aria-label="Tutup mode foto">
          <Icon name="close" size={24} />
        </button>
      </div>

      <div className="photo-stage">
        {busy && (
          <div className="photo-loading glass-panel">
            <div className="photo-spinner" />
            <span>Menangkap akuarium…</span>
          </div>
        )}
        {error && !busy && (
          <div className="photo-error glass-panel">
            <div className="confirm-emoji">🫧</div>
            <h3>Akuarium belum siap difoto</h3>
            <p>Coba sekali lagi ya.</p>
            <button type="button" className="glass-btn primary" onClick={() => void capture()}>
              Coba Lagi
            </button>
          </div>
        )}
        {preview && (
          <div className="photo-preview-frame">
            <img src={preview} alt="Kartu pos akuarium" draggable={false} />
            <div className="photo-floating-tag">
              <Icon name="sparkles" size={16} /> {liveCount} ikan di bingkai
            </div>
          </div>
        )}
      </div>

      <div className="photo-actions glass-panel">
        <div className="photo-hint">
          <strong>Kartu pos akuarium</strong>
          <span>PNG siap masuk galeri perangkatmu.</span>
        </div>
        <div className="photo-buttons">
          <button type="button" className="glass-btn" onClick={() => void capture()} disabled={busy}>
            <Icon name="camera" size={20} /> Ambil Ulang
          </button>
          <button type="button" className="glass-btn primary" onClick={download} disabled={!preview}>
            <Icon name="download" size={20} /> Unduh PNG
          </button>
          <button type="button" className="glass-btn subtle" onClick={closePhoto}>
            Kembali
          </button>
        </div>
      </div>
    </div>
  );
}
