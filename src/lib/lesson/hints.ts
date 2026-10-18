import type { Arrow, Highlight } from '../content/types.ts';

export type HintLevel = 0 | 1 | 2 | 3;
export const MAX_HINT_LEVEL: HintLevel = 3;

export interface HintView {
  level: HintLevel;
  highlights: Highlight[];
  arrows: Arrow[];
  /** Hint texts revealed so far, in order. */
  texts: string[];
}

export function nextHintLevel(level: HintLevel): HintLevel {
  return level === 0 ? 1 : level === 1 ? 2 : 3;
}

export function usedHint(level: HintLevel): boolean {
  return level > 0;
}

/**
 * Hint ladder for one move. 1: from-square plus first hint text. 2: target square plus
 * second hint text. 3: the move as an arrow.
 */
export function hintView(hints: readonly string[], expectedUci: string | null, level: HintLevel): HintView {
  const view: HintView = { level, highlights: [], arrows: [], texts: [] };
  if (level === 0) return view;
  const first = hints[0];
  if (first !== undefined) view.texts.push(first);
  const second = hints[1];
  if (level >= 2 && second !== undefined) view.texts.push(second);
  if (expectedUci === null || expectedUci.length < 4) return view;
  const from = expectedUci.slice(0, 2);
  const to = expectedUci.slice(2, 4);
  view.highlights.push({ square: from, color: 'Y' });
  if (level >= 2) view.highlights.push({ square: to, color: 'Y' });
  if (level >= 3) view.arrows.push({ from, to, color: 'G' });
  return view;
}
