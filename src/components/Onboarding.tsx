import { useGameStore } from '../store/useGameStore';
import { Icon } from './Icon';

export function Onboarding() {
  const closeOnboarding = useGameStore((state) => state.closeOnboarding);
  const openStudio = useGameStore((state) => state.openStudio);

  return (
    <div className="modal-backdrop onboarding-backdrop">
      <section className="glass-panel onboarding-card" role="dialog" aria-modal="true" aria-label="Selamat datang">
        <div className="onboarding-hero">
          <div className="onboarding-orbit orbit-one" />
          <div className="onboarding-orbit orbit-two" />
          <div className="onboarding-fish">
            <Icon name="fish" size={78} />
          </div>
          <span className="onboarding-bubble b1" />
          <span className="onboarding-bubble b2" />
          <span className="onboarding-bubble b3" />
        </div>

        <p className="eyebrow">Akuarium online bersama</p>
        <h1>
          Gambar ikanmu.
          <br />
          <span>Lepaskan ke laut!</span>
        </h1>
        <p className="onboarding-lead">
          Coret sesukamu — ikanmu selalu jadi. Berenang bersama ikan teman dari seluruh dunia, tanpa akun dan tanpa chat.
        </p>

        <div className="onboarding-steps">
          <div className="onboarding-step">
            <span className="step-icon">
              <Icon name="brush" size={26} />
            </span>
            <strong>Gambar</strong>
            <small>8 bentuk ikan lucu</small>
          </div>
          <div className="onboarding-step">
            <span className="step-icon">
              <Icon name="wave" size={26} />
            </span>
            <strong>Lepaskan</strong>
            <small>Ikan langsung berenang</small>
          </div>
          <div className="onboarding-step">
            <span className="step-icon">
              <Icon name="heart" size={26} />
            </span>
            <strong>Berteman</strong>
            <small>Beri makan & emote</small>
          </div>
        </div>

        <div className="onboarding-safety">
          <Icon name="lock" size={18} />
          <span>Aman untuk anak: tanpa chat, tanpa iklan, tanpa data pribadi.</span>
        </div>

        <div className="onboarding-actions">
          <button
            type="button"
            className="glass-btn primary large"
            onClick={() => {
              closeOnboarding();
              openStudio();
            }}
          >
            <Icon name="plus" size={24} />
            Gambar Ikan Pertamaku
          </button>
          <button
            type="button"
            className="glass-btn"
            onClick={() => {
              closeOnboarding();
            }}
          >
            Lihat akuarium dulu
          </button>
        </div>
      </section>
    </div>
  );
}
