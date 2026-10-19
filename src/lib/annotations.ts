import type { Arrow, Highlight } from './content/types';

/** Adds the arrow, or removes it when the same arrow (same squares) is already drawn. A different color replaces it. */
export function toggleArrow(arrows: readonly Arrow[], arrow: Arrow): Arrow[] {
  const same = arrows.find((a) => a.from === arrow.from && a.to === arrow.to);
  const rest = arrows.filter((a) => a !== same);
  return same && same.color === arrow.color ? rest : [...rest, arrow];
}

/** Adds the highlight, or removes it when that square is already marked. A different color replaces it. */
export function toggleHighlight(highlights: readonly Highlight[], mark: Highlight): Highlight[] {
  const same = highlights.find((h) => h.square === mark.square);
  const rest = highlights.filter((h) => h !== same);
  return same && same.color === mark.color ? rest : [...rest, mark];
}

/** Arrow color from the modifier keys held while drawing: Shift red, Alt or Ctrl yellow, none green. */
export function toneOfModifiers(mod: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean }): Arrow['color'] {
  if (mod.shiftKey) return 'R';
  if (mod.altKey || mod.ctrlKey) return 'Y';
  return 'G';
}
