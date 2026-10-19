import { useEffect } from 'react';
import { m } from '../i18n';
import { useUi, type Toast } from '../store/ui';

const LIFETIME_MS = 5000;

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useUi((s) => s.dismissToast);
  useEffect(() => {
    const t = window.setTimeout(() => dismiss(toast.id), LIFETIME_MS);
    return () => window.clearTimeout(t);
  }, [toast.id, dismiss]);
  return (
    <li className="flex items-center gap-3 rounded-xl border-2 border-amber bg-surface px-4 py-3 text-lg font-bold text-fg shadow-lg">
      <span aria-hidden="true">🏆</span>
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label={m().toast.dismiss}
        className="min-h-10 min-w-10 rounded-lg text-xl hover:bg-line/60"
      >
        <span aria-hidden="true">×</span>
      </button>
    </li>
  );
}

export default function Toasts() {
  const queued = useUi((s) => s.toasts);
  const suppress = useUi((s) => s.suppressToasts);
  const toasts = suppress ? [] : queued;
  return (
    <div role="region" aria-label={m().toast.region} aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <ul className="pointer-events-auto flex w-full max-w-md flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </ul>
    </div>
  );
}
