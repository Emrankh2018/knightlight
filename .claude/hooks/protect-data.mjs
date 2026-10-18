// PreToolUse hook (Edit|Write): blocks hand edits to generated output.
// Bash-run scripts (npm run data:*) are unaffected.
import path from 'node:path';

const PROTECTED = ['public/data/', '.cache/', 'dist/'];

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
const rel = path.relative(root, path.resolve(root, filePath)).replace(/\\/g, '/');

if (!rel.startsWith('../') && PROTECTED.some((p) => rel === p.slice(0, -1) || rel.startsWith(p))) {
  process.stderr.write(`Generated data: change the data:* scripts, not the output. (blocked: ${rel})\n`);
  process.exit(2);
}
process.exit(0);
