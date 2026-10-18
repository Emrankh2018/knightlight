// Usage: npm run validate:content
// Checks every course under content/courses and exits 1 if anything is wrong.

import { countCourse, loadAllCourses } from './lib/load-courses.ts';

const { courses, issues } = loadAllCourses();

for (const issue of issues) {
  const where = issue.game === undefined ? issue.file : `${issue.file}[#${issue.game}]`;
  console.log(`${where}: ${issue.message}`);
}

let chapters = 0;
let lessons = 0;
let steps = 0;
for (const { course } of courses) {
  if (course === undefined) continue;
  const c = countCourse(course);
  chapters += c.chapters;
  lessons += c.lessons;
  steps += c.steps;
}

console.log(
  `\n${courses.length} course(s), ${chapters} chapter(s), ${lessons} lesson(s), ${steps} step(s), ${issues.length} issue(s)`,
);
if (issues.length > 0) process.exitCode = 1;
