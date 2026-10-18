// Usage: npm run data:content
// Writes public/data/courses/index.json (catalog) and <slug>.json (full course).
// Fails without writing anything if any course has an issue.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, countCourse, loadAllCourses } from './lib/load-courses.ts';

const { courses, issues } = loadAllCourses();

if (issues.length > 0) {
  for (const issue of issues) {
    const where = issue.game === undefined ? issue.file : `${issue.file}[#${issue.game}]`;
    console.error(`${where}: ${issue.message}`);
  }
  console.error(`\nContent has ${issues.length} issue(s); nothing was written. Run npm run validate:content.`);
  process.exit(1);
}

const outDir = path.join(REPO_ROOT, 'public', 'data', 'courses');
mkdirSync(outDir, { recursive: true });

const catalog: object[] = [];
for (const { course } of courses) {
  if (course === undefined) continue;
  const meta: Record<string, unknown> = { ...course };
  delete meta['chapterList'];
  catalog.push({ ...meta, counts: countCourse(course) });
  writeFileSync(path.join(outDir, `${course.slug}.json`), JSON.stringify(course) + '\n');
}
writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`Wrote ${catalog.length} course(s) to public/data/courses/`);
