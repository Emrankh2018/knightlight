// Usage: node scripts/gates.mjs
// Runs the project gates and prints a PASS/FAIL/WARN table. Exits 1 on any FAIL.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUZZLE_LIMIT = 25 * 1024 * 1024;
const results = [];

function lastLine(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.at(-1) ?? '';
}

function npmGate(name, script) {
  process.stdout.write(`running ${name}...\n`);
  const res = spawnSync(`npm run ${script}`, { cwd: root, shell: true, encoding: 'utf8' });
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  if (res.status !== 0) process.stdout.write(out);
  const detail = out.match(/^\s*Tests\s+.*$/m)?.[0].trim() ?? lastLine(out);
  results.push({ name, status: res.status === 0 ? 'PASS' : 'FAIL', detail: detail.slice(0, 90) });
}

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(p) : statSync(p).size;
  }
  return total;
}

npmGate('typecheck', 'typecheck');
npmGate('lint', 'lint');
npmGate('test', 'test');
npmGate('validate:content', 'validate:content');

const puzzleDir = path.join(root, 'public', 'data', 'puzzles');
if (existsSync(puzzleDir)) {
  const size = dirSize(puzzleDir);
  const mb = (size / 1024 / 1024).toFixed(2);
  results.push({ name: 'puzzle data < 25 MB', status: size < PUZZLE_LIMIT ? 'PASS' : 'FAIL', detail: `${mb} MB` });
} else {
  results.push({ name: 'puzzle data < 25 MB', status: 'FAIL', detail: 'public/data/puzzles missing' });
}

// Courses signed off by the coach. WARN only: sign-off happens over time.
const coursesDir = path.join(root, 'content', 'courses');
const reviewed = [];
let courseCount = 0;
if (existsSync(coursesDir)) {
  for (const slug of readdirSync(coursesDir)) {
    const file = path.join(coursesDir, slug, 'course.json');
    if (!existsSync(file)) continue;
    courseCount++;
    try {
      if (JSON.parse(readFileSync(file, 'utf8')).reviewed === true) reviewed.push(slug);
    } catch {
      results.push({ name: `course.json ${slug}`, status: 'FAIL', detail: 'invalid JSON' });
    }
  }
}
results.push({
  name: 'reviewed: true courses',
  status: reviewed.length ? 'WARN' : 'PASS',
  detail: reviewed.length ? `${reviewed.length}/${courseCount}: ${reviewed.join(', ')}` : `0/${courseCount}`,
});

const w = Math.max(...results.map((r) => r.name.length));
console.log(`\n${'Gate'.padEnd(w)}  Result  Detail`);
console.log(`${'-'.repeat(w)}  ------  ------`);
for (const r of results) console.log(`${r.name.padEnd(w)}  ${r.status.padEnd(6)}  ${r.detail}`);

const failed = results.filter((r) => r.status === 'FAIL').length;
console.log(failed ? `\n${failed} gate(s) FAILED` : '\nAll gates passed');
process.exitCode = failed ? 1 : 0;
