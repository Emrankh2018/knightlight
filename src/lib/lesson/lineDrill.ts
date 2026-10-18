import type { LineDrillStep, Side, StepMove } from '../content/types.ts';
import { normalizeUci, otherSide, turnOf } from './position.ts';

/** Wrong tries on one move before the expected move is shown. */
export const REVEAL_AFTER = 2;

export interface DrillState {
  /** Index into step.moves of the next move to play. */
  index: number;
  /** All wrong attempts in this drill. */
  mistakes: number;
  /** Wrong attempts on the current move. */
  wrongTries: number;
}

export type DrillStatus = 'correct' | 'wrong' | 'complete';

export interface DrillResult {
  status: DrillStatus;
  state: DrillState;
}

export function startDrill(): DrillState {
  return { index: 0, mistakes: 0, wrongTries: 0 };
}

/** Which side plays moves[index]; sides alternate from the FEN's side to move. */
export function moverAt(step: LineDrillStep, index: number): Side {
  const first = turnOf(step.fen);
  return index % 2 === 0 ? first : otherSide(first);
}

export function isDrillDone(step: LineDrillStep, state: DrillState): boolean {
  return state.index >= step.moves.length;
}

export function isStudentTurn(step: LineDrillStep, state: DrillState): boolean {
  return !isDrillDone(step, state) && moverAt(step, state.index) === step.side;
}

/** The opponent move the app should play now, or null on the student's turn or when finished. */
export function autoMove(step: LineDrillStep, state: DrillState): StepMove | null {
  if (isDrillDone(step, state) || moverAt(step, state.index) === step.side) return null;
  return step.moves[state.index] ?? null;
}

/** Records that the app played the opponent move at the current index. */
export function applyAuto(state: DrillState): DrillState {
  return { ...state, index: state.index + 1, wrongTries: 0 };
}

/** The expected student move once the student has failed {@link REVEAL_AFTER} times, else null. */
export function revealedMove(step: LineDrillStep, state: DrillState): StepMove | null {
  if (state.wrongTries < REVEAL_AFTER || !isStudentTurn(step, state)) return null;
  return step.moves[state.index] ?? null;
}

/** Judges the student's move (UCI). 'complete' means the student's move was the last of the line. */
export function attemptDrill(step: LineDrillStep, state: DrillState, attempt: string): DrillResult {
  const expected = step.moves[state.index];
  if (!expected || !isStudentTurn(step, state)) return { status: 'wrong', state };
  if (normalizeUci(attempt) !== normalizeUci(expected.uci)) {
    return { status: 'wrong', state: { ...state, mistakes: state.mistakes + 1, wrongTries: state.wrongTries + 1 } };
  }
  const next: DrillState = { ...state, index: state.index + 1, wrongTries: 0 };
  return { status: isDrillDone(step, next) ? 'complete' : 'correct', state: next };
}
