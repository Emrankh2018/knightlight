// Shared course loading for validate-content.ts, build-content.ts and tests.
// Reads content/courses/<slug>/{course.json,*.pgn} and runs the parser.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCourse } from '../../src/lib/content/parse.ts';
import type { ContentIssue, Course } from '../../src/lib/content/types.ts';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const COURSES_DIR = path.join(REPO_ROOT, 'content', 'courses');

export interface LoadedCourse {
  slug: string;
  course?: Course;
}

export interface LoadResult {
  courses: LoadedCourse[];
  /** Every issue, with `file` rewritten to a repo-relative path. */
  issues: ContentIssue[];
}

export interface CourseCounts {
  chapters: number;
  lessons: number;
  steps: number;
}

export function countCourse(course: Course): CourseCounts {
  let lessons = 0;
  let steps = 0;
  for (const chapter of course.chapterList) {
    lessons += chapter.lessons.length;
    for (const lesson of chapter.lessons) steps += lesson.steps.length;
  }
  return { chapters: course.chapterList.length, lessons, steps };
}

export function loadAllCourses(coursesDir: string = COURSES_DIR): LoadResult {
  const courses: LoadedCourse[] = [];
  const issues: ContentIssue[] = [];
  if (!existsSync(coursesDir)) return { courses, issues };

  const slugs = readdirSync(coursesDir)
    .filter((name) => statSync(path.join(coursesDir, name)).isDirectory())
    .sort();

  for (const slug of slugs) {
    const dir = path.join(coursesDir, slug);
    const rel = (file: string): string => path.relative(REPO_ROOT, path.join(dir, file)).split(path.sep).join('/');
    const add = (list: ContentIssue[]): void => {
      for (const issue of list) issues.push({ ...issue, file: rel(issue.file) });
    };

    const metaPath = path.join(dir, 'course.json');
    if (!existsSync(metaPath)) {
      add([{ file: 'course.json', message: 'course.json is missing' }]);
      courses.push({ slug });
      continue;
    }
    let meta: unknown;
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
    } catch (error) {
      add([{ file: 'course.json', message: `course.json is not valid JSON: ${(error as Error).message}` }]);
      courses.push({ slug });
      continue;
    }

    const chapterTexts: Record<string, string> = {};
    const pgnFiles = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pgn'));
    for (const file of pgnFiles) chapterTexts[file] = readFileSync(path.join(dir, file), 'utf8');

    const result = parseCourse(slug, meta, chapterTexts);
    add(result.issues);
    if (result.course !== undefined) {
      const listed = new Set(result.course.chapters.map((c) => c.file));
      add(
        pgnFiles
          .filter((f) => !listed.has(f))
          .map((f) => ({ file: f, message: 'PGN file is not listed in course.json "chapters"' })),
      );
    }
    courses.push(result.course === undefined ? { slug } : { slug, course: result.course });
  }
  return { courses, issues };
}
