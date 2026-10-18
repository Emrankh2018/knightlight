import { describe, expect, it } from 'vitest';
import { loadAllCourses } from '../scripts/lib/load-courses';

describe('real courses under content/courses', () => {
  const { courses, issues } = loadAllCourses();

  it('have zero content issues', () => {
    expect(issues.map((i) => `${i.file}${i.game === undefined ? '' : `#${i.game}`}: ${i.message}`)).toEqual([]);
  });

  it('each parse into a course', () => {
    for (const { slug, course } of courses) {
      expect(course, slug).toBeDefined();
    }
  });
});
