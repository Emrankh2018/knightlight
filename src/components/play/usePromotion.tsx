import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PromotionPiece } from '../Board';
import PromotionPicker from './PromotionPicker';

export interface PromotionControl {
  /** Pass to `Board`'s `promotion` prop. Resolves with the chosen piece, or null when cancelled or closed. */
  ask: () => Promise<PromotionPiece | null>;
  open: boolean;
  /** Closes the picker, resolving the pending choice with null. Safe to call when it is closed. */
  cancel: () => void;
  /** Render this where the picker should appear. */
  picker: ReactNode;
}

/** The promotion picker and the promise the board waits on, so a page can close it whatever else happens. */
export function usePromotion(): PromotionControl {
  const settle = useRef<((piece: PromotionPiece | null) => void) | null>(null);
  const [open, setOpen] = useState(false);

  const pick = useCallback((piece: PromotionPiece | null): void => {
    const done = settle.current;
    if (!done) return;
    settle.current = null;
    setOpen(false);
    done(piece);
  }, []);

  const ask = useCallback(
    () =>
      new Promise<PromotionPiece | null>((resolve) => {
        settle.current?.(null);
        settle.current = resolve;
        setOpen(true);
      }),
    [],
  );

  const cancel = useCallback(() => pick(null), [pick]);

  useEffect(
    () => () => {
      settle.current?.(null);
      settle.current = null;
    },
    [],
  );

  return { ask, open, cancel, picker: open ? <PromotionPicker onPick={pick} /> : null };
}
