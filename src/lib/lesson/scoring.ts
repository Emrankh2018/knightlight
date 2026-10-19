import type { StepType } from '../content/types.ts';

/** What the student did on one finished step. */
export interface StepResult {
  /** A hint was used, or a quiz was answered wrong before the right answer. */
  hint: boolean;
  mistakes: number;
  /** The answer was shown to the student, so the step earns nothing. */
  failed: boolean;
}

/** What the progress store should record for a finished step. */
export interface StepAward {
  /** Record the step (10 XP, 5 with a hint). Null when nothing is earned. */
  step: { hint: boolean } | null;
  /** Record a drilled line (30 XP clean, 15 with mistakes). Null for other step types. */
  line: { clean: boolean } | null;
  /** Put the line into the spaced-repetition queue. */
  srs: boolean;
}

export function awardFor(type: StepType, r: StepResult): StepAward {
  if (r.failed) return { step: null, line: null, srs: type === 'line-drill' };
  const drill = type === 'line-drill';
  return {
    step: { hint: r.hint },
    line: drill ? { clean: r.mistakes === 0 && !r.hint } : null,
    srs: drill && r.mistakes > 0,
  };
}

/** True when the result keeps a lesson "perfect": no hints, no mistakes, nothing revealed. */
export function isClean(r: StepResult): boolean {
  return !r.failed && !r.hint && r.mistakes === 0;
}

/**
 * Whether finishing a lesson earns the lesson bonus. A lesson with practice steps needs at least one of them
 * solved; if every practice step was only revealed, the bonus is skipped so "Show answer" cannot farm XP.
 * Lessons made only of explain steps always count.
 */
export function lessonEarnsCredit(steps: readonly { type: StepType; solved: boolean }[]): boolean {
  const practice = steps.filter((s) => s.type !== 'explain');
  return practice.length === 0 || practice.some((s) => s.solved);
}
