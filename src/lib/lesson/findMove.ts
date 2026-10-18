import type { FindMoveStep, StepMove } from '../content/types.ts';
import { normalizeUci, playUci, type PlayedMove } from './position.ts';

export type FindMoveStatus = 'wrong' | 'correct' | 'complete';

export interface FindMoveOutcome {
  status: FindMoveStatus;
  /** The student's move as played, or null when it was illegal. */
  played: PlayedMove | null;
  /** The expected solver move at this index. */
  solution: StepMove | null;
  /** Opponent reply to auto-play after a correct move. */
  reply: StepMove | null;
  /** Index of the next expected solver move. Equals moves.length when finished. */
  nextIndex: number;
  /** True when a different checkmate was accepted in place of the expected mate. */
  alternativeMate: boolean;
}

/** FEN of the position where the solver must play moves[index]. */
export function fenBefore(step: FindMoveStep, index: number): string {
  return index <= 0 ? step.fen : (step.moves[index - 1]?.fen ?? step.fen);
}

export function expectedAt(step: FindMoveStep, index: number): StepMove | null {
  return step.moves[index] ?? null;
}

/** True when moves[index] is the last move the solver has to find. */
export function isFinalSolverMove(step: FindMoveStep, index: number): boolean {
  return index + 2 >= step.moves.length;
}

/**
 * Judges the student's `attempt` (UCI) for the solver move at `index` (0, 2, 4, ...).
 * On the final solver move any legal checkmate counts when the expected move is mate.
 */
export function evaluateFindMove(step: FindMoveStep, index: number, attempt: string): FindMoveOutcome {
  const solution = expectedAt(step, index);
  const played = playUci(fenBefore(step, index), attempt);
  const wrong: FindMoveOutcome = { status: 'wrong', played, solution, reply: null, nextIndex: index, alternativeMate: false };
  if (!solution || !played) return wrong;

  const exact = normalizeUci(attempt) === normalizeUci(solution.uci);
  const expectedMate = solution.san.includes('#');
  const alternativeMate = !exact && expectedMate && isFinalSolverMove(step, index) && played.checkmate;
  if (!exact && !alternativeMate) return wrong;

  const reply = alternativeMate ? null : (step.moves[index + 1] ?? null);
  const nextIndex = alternativeMate ? step.moves.length : Math.min(index + 2, step.moves.length);
  const finished = nextIndex >= step.moves.length;
  return { status: finished ? 'complete' : 'correct', played, solution, reply, nextIndex, alternativeMate };
}
