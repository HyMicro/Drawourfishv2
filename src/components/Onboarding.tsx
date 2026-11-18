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

        <p className="eyebrow">little ocean club</p>
        <h1>
          Gambar ikan.
          <br />
          <span>Lepaskan ke laut!</span>
        </h1>
        <p className="onboarding-lead">
          Pilih stiker atau gambar bebas, warnai sesukamu, lalu lihat ikanmu berenang bersama teman.
        </p>

        <div className="onboarding-steps">
          <div className="onboarding-step">
            <span className="step-icon">
              <Icon name="brush" size={24} />
            </span>
            <strong>Gambar</strong>
            <small>stiker & bebas</small>
          </div>
          <div className="onboarding-step">
            <span className="step-icon">
              <Icon name="wave" size={24} />
            </span>
            <strong>Lepaskan</strong>
            <small>langsung berenang</small>
          </div>
          <div className="onboarding-step">
            <span className="step-icon">
              <Icon name="heart" size={24} />
            </span>
            <strong>Bermain</strong>
            <small>pakan & emote</small>
          </div>
        </div>

        <div className="onboarding-safety">
          <Icon name="lock" size={17} />
          <span>Tanpa akun · tanpa chat · aman untuk anak</span>
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
            <Icon name="plus" size={22} />
            Gambar Ikan Pertamaku
          </button>
          <button
            type="button"
            className="glass-btn"
            onClick={() => {
              closeOnboarding();
            }}
          >
            Lihat dulu
          </button>
        </div>
      </section>
    </div>
  );
}
