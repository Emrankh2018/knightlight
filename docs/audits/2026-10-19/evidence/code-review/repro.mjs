// Audit-only reproductions. No real browser or user storage is read or written.
// Run from repository root: node --import tsx .tmp/audit-2026-10-19/code-review/repro.mjs
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const db = new Map();
let quota = Infinity;
let blocked = false;
globalThis.localStorage = {
  getItem: (key) => db.get(key) ?? null,
  setItem: (key, value) => {
    const size = [...db].reduce((n, [k, v]) => n + (k === key ? 0 : k.length + v.length), 0) + key.length + value.length;
    if (blocked || size > quota) throw new Error('simulated quota');
    db.set(key, value);
  },
  removeItem: (key) => db.delete(key),
};
const { useProfiles, AVATARS } = await import('../../../src/store/profiles.ts');
const { emptyProgress, readProgress, validateProgress, useProgress } = await import('../../../src/store/progress.ts');
const { applyBackup, parseBackup, exportAll } = await import('../../../src/store/backup.ts');
const { KEYS } = await import('../../../src/store/storage.ts');
const { newItem, review } = await import('../../../src/lib/srs.ts');
const { parsePgnGames } = await import('../../../src/lib/content/pgn.ts');
const { parseChapter } = await import('../../../src/lib/content/parse.ts');
const settings = { version: 1, theme: 'dark', boardTheme: 'cream', sound: true, volume: 0.5, presentScale: 1 };
const results = { observedAt: new Date().toISOString(), cases: {}, sha256: {} };
const profile = (id, name = id) => ({ id, name, avatar: AVATARS[0], createdAt: 1 });
const old = { version: 1, activeId: 'old0', profiles: Array.from({ length: 20 }, (_, n) => profile(`old${n}`, `Student ABCDEFGHIJKLMNOPQRST${n}`)) };
const incoming = { version: 1, activeId: 'new0', profiles: [profile('new0'), profile('new1')] };
const large = { ...emptyProgress(), achievements: ['A'.repeat(2000)] };
db.clear();
db.set(KEYS.profiles, JSON.stringify(old));
useProfiles.getState().reload();
quota = 3500;
const rollbackResult = applyBackup({ exportedAt: '', profiles: incoming, settings, progress: { new0: large, new1: large } });
results.cases.importRollback = { result: rollbackResult, storedProfileIds: JSON.parse(db.get(KEYS.profiles)).profiles.map((p) => p.id), remainingKeys: [...db.keys()] };

quota = Infinity;
const xpProgress = { ...emptyProgress(), xp: 1e308 };
results.cases.hugeXpAcceptedByValidation = Boolean(validateProgress(xpProgress));
const hugeBackup = { app: 'knightlight', version: 1, profiles: { version: 1, activeId: 'p1', profiles: [profile('p1')] }, settings, progress: { p1: xpProgress } };
results.cases.hugeXpAcceptedByBackup = parseBackup(JSON.stringify(hugeBackup)).ok;
const child = spawnSync(process.execPath, ['--input-type=module', '-e', 'import {levelFor} from "./src/lib/xp.ts"; console.log(levelFor(1e308));'], { timeout: 1500, encoding: 'utf8' });
results.cases.hugeXpRender = { status: child.status, error: child.error?.code, stdout: child.stdout, stderr: child.stderr };

const oversizedSrs = { ...newItem('p1', 'puzzle', 'p1', '2026-10-19'), interval: 1e9, reps: 3 };
const srsProgress = { ...emptyProgress(), xp: 250, srs: { p1: oversizedSrs } };
results.cases.oversizedSrsAccepted = Boolean(validateProgress(srsProgress));
const reviewed = review(oversizedSrs, 'good', '2026-10-19');
db.clear();
db.set(KEYS.progress('srs'), JSON.stringify({ ...srsProgress, srs: { p1: reviewed } }));
results.cases.oversizedSrs = { reviewed, xpAfterReload: readProgress('srs').xp };

db.clear();
quota = 2200;
db.set(KEYS.progress('corrupt'), '{' + 'x'.repeat(1900));
readProgress('corrupt');
results.cases.corruptRecovery = { backupPresent: db.has(KEYS.progressBackup('corrupt')), originalPresent: [...db.values()].some((v) => v.length > 1000) };

db.clear();
quota = Infinity;
blocked = false;
db.set(KEYS.profiles, JSON.stringify({ version: 1, activeId: 'export', profiles: [profile('export')] }));
useProfiles.getState().reload();
useProgress.getState().load('export');
blocked = true;
useProgress.getState().recordPuzzle('audit-puzzle', 'beginner', true, false);
results.cases.unsavedExport = { visibleXp: useProgress.getState().data.xp, exportedXp: JSON.parse(exportAll()).progress.export.xp };
blocked = false;

results.cases.prototypeHeaders = Object.create(null);
for (const name of ['__proto__', 'constructor', 'toString']) {
  try { parsePgnGames(`[${name} "x"] 1. e4 *`); results.cases.prototypeHeaders[name] = 'no throw'; }
  catch (err) { results.cases.prototypeHeaders[name] = `${err.name}: ${err.message}`; }
}
try {
  parseChapter('audit.pgn', '[Lesson "x"]\n[LessonTitle "X"]\n[Step "explain"]\n' + ')'.repeat(150000) + ' *');
  results.cases.excessivePgnErrors = 'no throw';
} catch (err) { results.cases.excessivePgnErrors = `${err.name}: ${err.message}`; }

for (const path of ['src/store/backup.ts', 'src/store/progress.ts', 'src/store/profiles.ts', 'src/lib/xp.ts', 'src/lib/srs.ts', 'src/lib/content/pgn.ts', 'src/lib/content/parse.ts', 'src/routes/Play.tsx', 'src/lib/play.ts']) {
  results.sha256[path] = createHash('sha256').update(readFileSync(path)).digest('hex');
}
console.log(JSON.stringify(results, null, 2));
