// Content model shared by the parser, validator CLI, build script and the app.
// One PGN game = one Step. Consecutive games sharing a [Lesson] tag form a Lesson.

export type StepType = 'explain' | 'find-move' | 'line-drill' | 'quiz';
export type Side = 'white' | 'black';
export type Level = 'beginner' | 'intermediate' | 'mid-advanced' | 'advanced' | 'master';
export type CourseKind = 'skills' | 'opening';

/** Arrow from [%cal Ge2e4]; color letter G/R/Y/B. */
export interface Arrow {
  from: string;
  to: string;
  color: 'G' | 'R' | 'Y' | 'B';
}

/** Square highlight from [%csl Rd5]. */
export interface Highlight {
  square: string;
  color: 'G' | 'R' | 'Y' | 'B';
}

/** One half-move inside a step, with the position after it. */
export interface StepMove {
  san: string;
  uci: string;
  /** FEN after this move. */
  fen: string;
  comment?: string;
  arrows: Arrow[];
  highlights: Highlight[];
}

export interface StepBase {
  id: string;
  type: StepType;
  /** Starting FEN (from [FEN] or the standard start). */
  fen: string;
  /** Comment before the first move, shown on the starting position. */
  intro?: string;
  introArrows: Arrow[];
  introHighlights: Highlight[];
  moves: StepMove[];
  hints: string[];
}

export interface ExplainStep extends StepBase {
  type: 'explain';
}

/** moves[0] is the solution; then opponent reply, next solution, ... */
export interface FindMoveStep extends StepBase {
  type: 'find-move';
  /** Side to move at the start (the solver). */
  side: Side;
}

/** Student plays `side`, app answers with the other side from `moves`. */
export interface LineDrillStep extends StepBase {
  type: 'line-drill';
  side: Side;
}

export interface QuizStep extends StepBase {
  type: 'quiz';
  question: string;
  choices: string[];
  /** 0-based index into choices. */
  answer: number;
  explanation?: string;
}

export type Step = ExplainStep | FindMoveStep | LineDrillStep | QuizStep;

export interface TeacherNotes {
  points: string[];
  mistakes: string[];
  questions: string[];
}

export interface Lesson {
  id: string;
  title: string;
  steps: Step[];
  teacherNotes: TeacherNotes;
}

export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface CourseMeta {
  slug: string;
  title: string;
  kind: CourseKind;
  level: Level;
  description: string;
  tags: string[];
  reviewed: boolean;
  /** Opening courses: the side the course teaches. */
  side?: Side;
  /** Chapter files in display order, relative to the course folder. */
  chapters: { file: string; title: string }[];
}

export interface Course extends CourseMeta {
  chapterList: Chapter[];
}

export interface ContentIssue {
  file: string;
  /** 1-based game index inside the file, when applicable. */
  game?: number;
  message: string;
}
