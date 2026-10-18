import { useEffect, type ReactNode } from 'react';
import type { Side } from '../../lib/content/types';

export interface StepResult {
  /** A hint was used. */
  hint: boolean;
  mistakes: number;
  /** The answer was revealed or the quiz was answered wrong at least once. */
  failed: boolean;
}

export interface ViewProps<S> {
  step: S;
  flipped: boolean;
  courseSide: Side;
  /** Controls the lesson player renders at the bottom of the side panel. */
  footer: ReactNode;
  onComplete: (result: StepResult) => void;
}

export function orientationOf(base: Side, flipped: boolean): Side {
  if (!flipped) return base;
  return base === 'white' ? 'black' : 'white';
}

/** Board on the left (about 60%), side panel on the right; stacked on narrow screens. */
export function StepLayout({ board, panel, footer }: { board: ReactNode; panel: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div>{board}</div>
      <div className="space-y-4 rounded-2xl border-2 border-line bg-surface p-4">
        {panel}
        {footer}
      </div>
    </div>
  );
}

export function Feedback({ tone, children }: { tone: 'good' | 'bad' | 'info'; children: ReactNode }) {
  const cls =
    tone === 'good'
      ? 'border-leaf bg-leaf/15'
      : tone === 'bad'
        ? 'border-coral bg-coral/15'
        : 'border-line bg-bg';
  return (
    <p role="status" className={`rounded-xl border-2 px-4 py-3 text-lg font-bold ${cls}`}>
      {children}
    </p>
  );
}

/** True when a key press should be left to a focused control or text field. */
function isHandledElsewhere(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target;
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

/** Calls `handler` for key presses that no focused control has already used. */
export function useKeys(handler: (e: KeyboardEvent) => void): void {
  useEffect(() => {
    const listener = (e: KeyboardEvent): void => {
      if (!isHandledElsewhere(e)) handler(e);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [handler]);
}

export function isButtonTarget(e: KeyboardEvent): boolean {
  return e.target instanceof HTMLElement && ['BUTTON', 'A'].includes(e.target.tagName);
}
