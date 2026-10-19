import type { QuizStep } from '../content/types.ts';
import type { StepResult } from './scoring.ts';

/** True when `choice` (0-based) is the right answer. */
export function gradeQuiz(step: QuizStep, choice: number): boolean {
  return Number.isInteger(choice) && choice === step.answer;
}

/** Result for a quiz solved after `wrongTries` wrong answers. A wrong try costs the clean bonus, like a hint. */
export function quizResult(wrongTries: number): StepResult {
  return { hint: wrongTries > 0, mistakes: wrongTries, failed: false };
}
