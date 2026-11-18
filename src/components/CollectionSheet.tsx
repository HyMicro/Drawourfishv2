import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { getTemplate } from '../data/templates';
import { Icon } from './Icon';

export function CollectionSheet() {
  const closeCollection = useGameStore((state) => state.closeCollection);
  const openStudio = useGameStore((state) => state.openStudio);
  const collection = useGameStore((state) => state.collection);
  const activeIds = useGameStore((state) => state.activeIds);
  const toggleActive = useGameStore((state) => state.toggleActive);
  const deleteFish = useGameStore((state) => state.deleteFish);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'swimming'>('all');

  const sorted = [...collection].sort((a, b) => b.createdAt - a.createdAt);
  const shown = filter === 'swimming' ? sorted.filter((fish) => activeIds.includes(fish.id)) : sorted;

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeCollection();
      }}
    >
      <section className="glass-panel sheet-panel collection-panel" role="dialog" aria-modal="true" aria-label="Ikan milikku">
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Koleksi pribadi · tersimpan di perangkat</p>
            <h2>Ikanku</h2>
          </div>
          <div className="header-actions">
            <button type="button" className="glass-btn primary" onClick={openStudio}>
              <Icon name="plus" size={20} /> Ikan Baru
            </button>
            <button type="button" className="glass-btn icon-btn" onClick={closeCollection} aria-label="Tutup">
              <Icon name="close" size={24} />
            </button>
          </div>
        </header>

        <div className="collection-summary">
          <div className="summary-blind">
            <div className="summary-fish-stack">
              {sorted.slice(0, 3).map((fish) => (
                <img key={fish.id} src={fish.textureData} alt="" draggable={false} />
              ))}
            </div>
            <div>
              <strong>{activeIds.length} dari 3</strong>
              <span>ikan sedang berenang</span>
            </div>
          </div>
          <div className="filter-pills">
            <button
              type="button"
              className={`pill ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Semua · {sorted.length}
            </button>
            <button
              type="button"
              className={`pill ${filter === 'swimming' ? 'active' : ''}`}
              onClick={() => setFilter('swimming')}
            >
              Berenang · {activeIds.length}
            </button>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="empty-collection">
            <div className="empty-art">
              <Icon name="fish" size={64} />
            </div>
            <h3>{collection.length === 0 ? 'Belum ada ikan' : 'Belum ada yang berenang'}</h3>
            <p>
              {collection.length === 0
                ? 'Gambar ikan pertamamu — hasilnya langsung berenang di akuarium.'
                : 'Turunkan salah satu ikan dari koleksi untuk melihatnya berenang lagi.'}
            </p>
            <button type="button" className="glass-btn primary large" onClick={openStudio}>
              <Icon name="brush" size={22} /> Gambar Ikan
            </button>
          </div>
        ) : (
          <div className="collection-grid">
            {shown.map((fish) => {
              const active = activeIds.includes(fish.id);
              const template = getTemplate(fish.templateId);
              return (
                <article key={fish.id} className={`fish-card ${active ? 'swimming' : ''}`}>
                  <div className="fish-card-art">
                    <span className="fish-card-emoji">{template.emoji}</span>
                    <img src={fish.textureData} alt={`Ikan ${fish.name}`} draggable={false} />
                    {active && <span className="swimming-badge">Berenang</span>}
                  </div>
                  <div className="fish-card-body">
                    <div className="fish-card-title">
                      <strong>{fish.name}</strong>
                      <span>{template.label}</span>
                    </div>
                    {confirmDelete === fish.id ? (
                      <div className="delete-confirm">
                        <span>Hapus ikan?</span>
                        <button
                          type="button"
                          className="mini-btn danger"
                          onClick={() => {
                            deleteFish(fish.id);
                            setConfirmDelete(null);
                          }}
                        >
                          Ya
                        </button>
                        <button type="button" className="mini-btn" onClick={() => setConfirmDelete(null)}>
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="fish-card-actions">
                        <button
                          type="button"
                          className={`glass-btn small ${active ? 'subtle' : 'primary'}`}
                          onClick={() => toggleActive(fish.id)}
                        >
                          {active ? <Icon name="back" size={17} /> : <Icon name="wave" size={17} />}
                          {active ? 'Angkat' : 'Turunkan'}
                        </button>
                        <button
                          type="button"
                          className="glass-btn icon-btn small danger"
                          onClick={() => setConfirmDelete(fish.id)}
                          aria-label={`Hapus ${fish.name}`}
                        >
                          <Icon name="trash" size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <footer className="sheet-footer">
          <span>
            <Icon name="lock" size={14} /> Tersimpan di perangkat ini
          </span>
        </footer>
      </section>
    </div>
  );
}
