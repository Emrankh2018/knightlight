import { useCallback, useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import { fmt, m } from '../../i18n';
import type { Side } from '../../lib/content/types';
import type { HintView } from '../../lib/lesson/hints';
import { pieceOnFrom } from '../../lib/lesson/position';
import type { StepResult } from '../../lib/lesson/scoring';
import { useUi } from '../../store/ui';

export type { StepResult };

/** Present mode hides the site chrome and keeps toasts from covering the board. */
export function usePresentEffects(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    document.documentElement.dataset.classMode = '';
    useUi.getState().setSuppressToasts(true);
    return () => {
      delete document.documentElement.dataset.classMode;
      useUi.getState().setSuppressToasts(false);
    };
  }, [on]);
}

/** Board widths. Both are CSS variables from index.css: Present is as tall as the screen allows (portrait: leaves room for the controls); normal fits the viewport below the site header. */
export const CLASS_BOARD = 'var(--kl-lesson-board)';
export const NORMAL_BOARD = 'var(--kl-normal-board)';
export const OPPONENT_DELAY_MS = 500;
export const SOLUTION_DELAY_MS = 900;

/** Keyboard actions of the current step view. The player routes keys here before its own navigation. */
export interface StepControls {
  hint?: () => void;
  /** Step back inside the step (for example to the previous move). Returns true when it did something. */
  back?: () => boolean;
  /** Step forward inside the step. Returns true when it did something. */
  forward?: () => boolean;
  /** Pick answer `n` (1-based). */
  answer?: (n: number) => void;
}
export type ControlsRef = MutableRefObject<StepControls>;

/** Registers the view's key actions with the player for as long as the view is mounted. */
export function useControls(ref: ControlsRef, controls: StepControls): void {
  useEffect(() => {
    ref.current = controls;
    return () => {
      ref.current = {};
    };
  });
}

export interface ViewProps<S> {
  step: S;
  flipped: boolean;
  courseSide: Side;
  classMode: boolean;
  /** Title, step progress and mode toggles; rendered at the top of the side panel. */
  header: ReactNode;
  /** Teacher notes (or nothing); scrolls with the panel body. */
  notes: ReactNode;
  /** Step controls the lesson player renders at the bottom of the side panel; always visible. */
  footer: ReactNode;
  controls: ControlsRef;
  onComplete: (result: StepResult) => void;
}

export function orientationOf(base: Side, flipped: boolean): Side {
  if (!flipped) return base;
  return base === 'white' ? 'black' : 'white';
}

/** In Present mode the content fills the screen and hides the site chrome. */
export function PresentShell({ classMode, center = false, children }: { classMode: boolean; center?: boolean; children: ReactNode }) {
  return (
    <div
      className={
        classMode
          ? `fixed inset-0 z-40 grid gap-6 overflow-auto bg-bg p-4 ${
              center ? 'grid-cols-1 place-content-center justify-items-center' : 'grid-cols-[auto_minmax(0,1fr)] items-start portrait:grid-cols-1 portrait:justify-items-center'
            }`
          : 'grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start'
      }
    >
      {children}
    </div>
  );
}

/** The side panel is a flex column when `tall`: header and footer keep their size, only the body scrolls. */
export function SidePanel({ classMode, tall = false, children }: { classMode: boolean; tall?: boolean; children: ReactNode }) {
  const size = classMode
    ? tall
      ? 'h-[calc(100dvh-2rem)] w-full portrait:h-auto'
      : 'max-w-3xl'
    : tall
      ? 'lg:max-h-[calc(100dvh-6rem)]'
      : '';
  return <div className={`flex min-h-0 flex-col gap-3 rounded-2xl border-2 border-line bg-surface p-4 ${size}`}>{children}</div>;
}

/** Board on the left, side panel on the right; stacked on narrow screens. */
export function StepLayout({ board, header, panel, notes, footer, classMode }: { board: ReactNode; header: ReactNode; panel: ReactNode; notes: ReactNode; footer: ReactNode; classMode: boolean }) {
  return (
    <PresentShell classMode={classMode}>
      <div>{board}</div>
      <SidePanel classMode={classMode} tall>
        <div className="shrink-0">{header}</div>
        <div className={`min-h-0 flex-1 space-y-3 overflow-y-auto p-1 portrait:overflow-visible ${classMode ? 'text-xl 2xl:text-2xl' : 'text-lg'}`}>
          {panel}
          {notes}
        </div>
        <div className={`shrink-0 space-y-2 border-t-2 border-line bg-surface pt-2 ${classMode ? 'portrait:sticky portrait:bottom-0 portrait:z-10' : 'sticky bottom-0 z-10'}`}>{footer}</div>
      </SidePanel>
    </PresentShell>
  );
}

/** `live={false}` when a parent live region already announces it, so it is not read twice. */
export function Feedback({ tone, large = false, live = true, children }: { tone: 'good' | 'bad' | 'info'; large?: boolean; live?: boolean; children: ReactNode }) {
  const cls =
    tone === 'good'
      ? 'kl-pop border-leaf bg-leaf/15'
      : tone === 'bad'
        ? 'kl-nudge border-coral bg-coral/15'
        : 'border-line bg-bg';
  return (
    <p role={live ? 'status' : undefined} className={`rounded-xl border-2 font-bold ${large ? 'px-4 py-2 text-xl 2xl:text-2xl' : 'px-4 py-3 text-lg'} ${cls}`}>
      {children}
    </p>
  );
}

/** Which side moves, as a big pill. */
export function TurnPill({ side, classMode }: { side: Side; classMode: boolean }) {
  const white = side === 'white';
  return (
    <p className={`inline-flex items-center gap-3 rounded-xl border-2 border-ink px-4 ${classMode ? 'py-1 text-2xl' : 'py-2 text-xl'} font-extrabold dark:border-amber`}>
      <span aria-hidden="true" className={`inline-block size-6 rounded-full border-2 border-ink ${white ? 'bg-white' : 'bg-ink'}`} />
      {white ? m().lesson.whiteToMove : m().lesson.blackToMove}
    </p>
  );
}

/** The hint for the current ladder level: the coach's text when there is one, otherwise a generic line. */
export function HintBox({ view, fen, uci, classMode }: { view: HintView; fen: string; uci: string | null; classMode: boolean }) {
  if (view.level === 0) return null;
  const piece = uci === null ? null : pieceOnFrom(fen, uci);
  const pieceName = piece === null ? '' : (m().puzzles.pieces[piece] ?? '');
  const square = uci === null ? '' : uci.slice(2, 4);
  const authored = view.texts[view.level - 1];
  const text =
    view.level === 3
      ? m().lesson.noMoreHints
      : (authored ?? fmt(view.level === 1 ? m().puzzles.hintPiece : m().puzzles.hintTarget, { piece: pieceName, square }));
  return (
    <Feedback live={false} tone="info" large={classMode}>
      {fmt(m().lesson.hintLevel, { level: view.level })}: {text}
    </Feedback>
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

/** Style for buttons that stay focusable but are not available right now (use with aria-disabled). */
export const ARIA_OFF =
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-100 aria-disabled:border-2 aria-disabled:border-dashed aria-disabled:border-muted aria-disabled:bg-surface aria-disabled:text-muted aria-disabled:hover:bg-surface aria-disabled:hover:text-muted dark:aria-disabled:hover:bg-surface dark:aria-disabled:hover:text-muted';

export const bigButton = (classMode: boolean): string => (classMode ? 'min-h-14 px-5 text-xl 2xl:min-h-16 2xl:px-8 2xl:text-2xl' : '');

/** Schedules callbacks that are cancelled when the component unmounts. */
export function useLater(): (fn: () => void, ms: number) => void {
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);
  return useCallback((fn, ms) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
}
