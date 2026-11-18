import type { EmoteKind } from '../../shared/protocol';
import { EMOTES } from '../../shared/protocol';
import { getEngine } from '../aquarium/bridge';
import { network } from '../net/client';
import { useGameStore } from '../store/useGameStore';
import { Icon } from './Icon';

const EMOTE_LABELS: Record<EmoteKind, string> = {
  HEART: 'Hati',
  SPARKLE: 'Keren',
  BUBBLE: 'Gelembung',
  MUSIC: 'Nada',
};

export function EmoteMenu() {
  const target = useGameStore((state) => state.emoteTarget);
  const closeEmoteMenu = useGameStore((state) => state.closeEmoteMenu);
  const hideFish = useGameStore((state) => state.hideFish);

  if (!target) return null;

  const width = 286;
  const left = Math.max(14, Math.min(window.innerWidth - width - 14, target.x - width / 2));
  const top =
    target.y > window.innerHeight - 330
      ? Math.max(90, target.y - 292)
      : Math.min(window.innerHeight - 300, target.y + 20);

  const send = (emote: EmoteKind) => {
    const engine = getEngine();
    engine?.playEmote(target.fishId, emote);
    network.sendEmote(target.fishId, emote);
    closeEmoteMenu();
  };

  return (
    <div
      className="emote-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeEmoteMenu();
      }}
    >
      <div className="emote-menu glass-panel" style={{ left, top, width }} role="dialog" aria-label="Kirim reaksi">
        <div className="emote-header">
          <div className="emote-avatar">
            <Icon name="fish" size={22} />
          </div>
          <div>
            <strong>{target.name}</strong>
            <span>{target.isMine ? 'Ikan milikmu' : 'Ikan teman'}</span>
          </div>
          <button type="button" className="emote-close" onClick={closeEmoteMenu} aria-label="Tutup">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="emote-grid">
          {(Object.keys(EMOTES) as EmoteKind[]).map((kind) => (
            <button key={kind} type="button" className="emote-btn" onClick={() => send(kind)}>
              <span>{EMOTES[kind]}</span>
              <small>{EMOTE_LABELS[kind]}</small>
            </button>
          ))}
        </div>

        {!target.isMine && (
          <button
            type="button"
            className="emote-hide"
            onClick={() => {
              hideFish(target.fishId);
              closeEmoteMenu();
            }}
          >
            <Icon name="eye-off" size={17} />
            Sembunyikan ikan ini dari layarku
          </button>
        )}
      </div>
    </div>
  );
}
