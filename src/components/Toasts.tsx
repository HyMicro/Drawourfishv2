import { useGameStore } from '../store/useGameStore';
import { Icon } from './Icon';

export function Toasts() {
  const toasts = useGameStore((state) => state.toasts);
  const dismissToast = useGameStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          type="button"
          key={toast.id}
          className={`toast glass-panel ${toast.tone}`}
          onClick={() => dismissToast(toast.id)}
        >
          <span className="toast-icon">
            <Icon name={toast.tone === 'warn' ? 'help' : toast.tone === 'success' ? 'sparkles' : 'wave'} size={20} />
          </span>
          <span>{toast.message}</span>
        </button>
      ))}
    </div>
  );
}
