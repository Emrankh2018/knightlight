/** Tactic themes shown on the Tactics hub, easiest first. Every id must exist in public/data/puzzles/index.json. */
export const TACTIC_THEMES = [
  'mateIn1',
  'hangingPiece',
  'fork',
  'pin',
  'skewer',
  'backRankMate',
  'discoveredAttack',
  'mateIn2',
  'trappedPiece',
  'deflection',
  'attraction',
  'sacrifice',
  'mateIn3',
  'endgame',
] as const;

export type TacticTheme = (typeof TACTIC_THEMES)[number];
