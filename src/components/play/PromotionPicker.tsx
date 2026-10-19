import { useEffect, useRef } from 'react';
import Button from '../Button';
import type { PromotionPiece } from '../Board';
import { m } from '../../i18n';

const ICONS: Record<PromotionPiece, string> = { q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E' };

/** Asks which piece a pawn becomes. Keys Q, R, B and N choose directly; Escape cancels; Tab stays inside. */
export default function PromotionPicker({ onPick }: { onPick: (piece: PromotionPiece | null) => void }) {
  const t = m().play;
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const options: { piece: PromotionPiece; label: string }[] = [
    { piece: 'q', label: t.promoteQ },
    { piece: 'r', label: t.promoteR },
    { piece: 'b', label: t.promoteB },
    { piece: 'n', label: t.promoteN },
  ];

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    first.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onPick(null);
        return;
      }
      if (e.key === 'Tab') {
        const items = Array.from(root.current?.querySelectorAll<HTMLElement>('button') ?? []);
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (!firstItem || !lastItem) return;
        const active = document.activeElement;
        if (!root.current?.contains(active)) {
          e.preventDefault();
          firstItem.focus();
        } else if (e.shiftKey && active === firstItem) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && active === lastItem) {
          e.preventDefault();
          firstItem.focus();
        }
        return;
      }
      const hit = options.find((o) => o.piece === e.key.toLowerCase());
      if (hit && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        onPick(hit.piece);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div ref={root} role="dialog" aria-modal="true" aria-label={t.promoteTitle} className="space-y-3 rounded-xl border-2 border-ink bg-bg p-3 dark:border-amber">
      <p className="text-lg font-extrabold">{t.promoteTitle}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o, i) => (
          <Button key={o.piece} ref={i === 0 ? first : undefined} variant="secondary" onClick={() => onPick(o.piece)}>
            <span aria-hidden="true" className="text-2xl leading-none">
              {ICONS[o.piece]}
            </span>
            {o.label}
          </Button>
        ))}
      </div>
      <Button variant="ghost" onClick={() => onPick(null)}>
        {t.promoteCancel}
      </Button>
    </div>
  );
}
