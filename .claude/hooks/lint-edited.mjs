// PostToolUse hook (Edit|Write): lints the edited .ts/.tsx file under src/, tests/ or scripts/.
// Exit 2 feeds the eslint output back to Claude. No tsc here (too slow per edit).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DIRS = ['src/', 'tests/', 'scripts/'];

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

const input = JSON.parse((await readStdin()) || '{}');
const filePath = input.tool_input?.file_path;
if (typeof filePath !== 'string') process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const abs = path.resolve(root, filePath);
const rel = path.relative(root, abs).replace(/\\/g, '/');

if (!/\.tsx?$/.test(rel) || !DIRS.some((d) => rel.startsWith(d)) || !existsSync(abs)) process.exit(0);

const res = spawnSync('npx', ['eslint', `"${rel}"`], { cwd: root, shell: true, encoding: 'utf8' });
if (res.status !== 0) {
  process.stderr.write(`eslint failed for ${rel}:\n${res.stdout ?? ''}${res.stderr ?? ''}`);
  process.exit(2);
}
process.exit(0);
