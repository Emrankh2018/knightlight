// PreToolUse hook (Bash, Edit|Write): blocks adding GPL/AGPL chess packages.
// Exit 2 blocks the tool call; stderr is shown to Claude.
const DENYLIST = [
  'chessground',
  '@lichess-org/chessground',
  'stockfish',
  'stockfish.js',
  'stockfish.wasm',
  '@lichess-org/stockfish-web',
];

const INSTALL_VERBS = new Set(['install', 'i', 'add']);
const MANAGERS = new Set(['npm', 'pnpm', 'yarn']);

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

// "@scope/name@1.2.3" -> "@scope/name", "name@^1" -> "name"
function packageName(token) {
  const t = token.replace(/^['"]|['"]$/g, '').toLowerCase();
  const at = t.indexOf('@', 1);
  return at === -1 ? t : t.slice(0, at);
}

function blockedInCommand(command) {
  const hits = [];
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const tokens = segment.trim().split(/\s+/);
    const managerAt = tokens.findIndex((t) => MANAGERS.has(t.replace(/\.cmd$/i, '')));
    if (managerAt === -1) continue;
    if (!tokens.slice(managerAt + 1).some((t) => INSTALL_VERBS.has(t))) continue;
    for (const t of tokens) {
      const name = packageName(t);
      if (DENYLIST.includes(name)) hits.push(name);
    }
  }
  return hits;
}

function depKeysIn(text) {
  return DENYLIST.filter((name) => new RegExp(`"${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}"\\s*:`).test(text));
}

function block(hits) {
  process.stderr.write(
    `License guard: ${[...new Set(hits)].join(', ')} is GPL/AGPL and banned in this repo (AGENTS.md hard rules). Use a permissively licensed alternative.\n`,
  );
  process.exit(2);
}

const input = JSON.parse((await readStdin()) || '{}');
const tool = input.tool_name;
const ti = input.tool_input ?? {};

if (tool === 'Bash' && typeof ti.command === 'string') {
  const hits = blockedInCommand(ti.command);
  if (hits.length) block(hits);
} else if ((tool === 'Edit' || tool === 'Write') && typeof ti.file_path === 'string') {
  if (/(^|[\\/])package\.json$/i.test(ti.file_path)) {
    const added = tool === 'Write' ? (ti.content ?? '') : (ti.new_string ?? '');
    const before = tool === 'Edit' ? (ti.old_string ?? '') : '';
    const already = new Set(depKeysIn(before));
    const hits = depKeysIn(added).filter((n) => !already.has(n));
    if (hits.length) block(hits);
  }
}
process.exit(0);
