import type { Course, CourseMeta, Lesson } from '../content/types.ts';

/** Courses carrying this tag are test fixtures and stay out of the library. */
export const SAMPLE_TAG = 'sample';

export function isListed(course: Pick<CourseMeta, 'tags'>): boolean {
  return !course.tags.includes(SAMPLE_TAG);
}

export const lessonKey = (slug: string, lessonId: string): string => `${slug}/${lessonId}`;
export const stepKey = (slug: string, stepId: string): string => `${slug}/${stepId}`;

export interface FlatLesson {
  chapterIndex: number;
  chapterTitle: string;
  lesson: Lesson;
}

export function flatLessons(course: Course): FlatLesson[] {
  return course.chapterList.flatMap((chapter, chapterIndex) =>
    chapter.lessons.map((lesson) => ({ chapterIndex, chapterTitle: chapter.title, lesson })),
  );
}

export function findLesson(course: Course, lessonId: string): FlatLesson | null {
  return flatLessons(course).find((l) => l.lesson.id === lessonId) ?? null;
}

export function nextLessonAfter(course: Course, lessonId: string): FlatLesson | null {
  const all = flatLessons(course);
  const at = all.findIndex((l) => l.lesson.id === lessonId);
  return at < 0 ? null : (all[at + 1] ?? null);
}

/** Number of completed lessons of `slug`, never more than `total`. */
export function completedCount(slug: string, completed: Readonly<Record<string, unknown>>, total: number): number {
  const prefix = `${slug}/`;
  const n = Object.keys(completed).filter((k) => k.startsWith(prefix)).length;
  return Math.min(n, total);
}

/** The first lesson not yet completed, or the first lesson when all are done. Null for an empty course. */
export function nextUp(course: Course, completed: Readonly<Record<string, unknown>>): FlatLesson | null {
  const all = flatLessons(course);
  return all.find((l) => completed[lessonKey(course.slug, l.lesson.id)] === undefined) ?? all[0] ?? null;
}

/** Router state for links that should pick a lesson up at the saved step. Other links start at step 1. */
export const RESUME_STATE = { resume: true } as const;
