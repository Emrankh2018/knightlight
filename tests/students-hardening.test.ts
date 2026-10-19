import { beforeEach, describe, expect, it, vi } from 'vitest';
import { liveStreak } from '../src/lib/leaderboard';
import { isRealDay, safeDiffDays } from '../src/lib/date';
import { updateStreak } from '../src/lib/xp';
import { BACKUP_APP } from '../src/store/backup';

const store = new Map<string, string>();

const profile = { id: 'p1', name: 'Sam', avatar: '🦊', createdAt: 1 };
const settings = { version: 1, theme: 'dark', boardTheme: 'cream', sound: true, volume: 0.5, presentScale: 1 };
const fresh = {
  version: 1, xp: 0, streak: { current: 0, best: 0 }, completedSteps: {}, completedLessons: {},
  puzzles: { solved: {}, byLevel: {}, streak: { current: 0, best: 0 } }, srs: {}, achievements: [], botWins: {}, linesDrilled: 0,
};

function backup(over: Record<string, unknown> = {}, profiles: unknown[] = [profile]): string {
  return JSON.stringify({
    app: BACKUP_APP,
    version: 1,
    exportedAt: '2026-03-10T10:00:00.000Z',
    profiles: { version: 1, profiles, activeId: (profiles[0] as { id: string }).id },
    progress: Object.fromEntries((profiles as { id: string }[]).map((p) => [p.id, fresh])),
    settings,
    ...over,
  });
}

async function load() {
  vi.resetModules();
  const backupMod = await import('../src/store/backup.ts');
  const profiles = await import('../src/store/profiles.ts');
  const progress = await import('../src/store/progress.ts');
  const storage = await import('../src/store/storage.ts');
  return { ...backupMod, ...profiles, ...progress, KEYS: storage.KEYS };
}

beforeEach(() => {
  store.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe('calendar days', () => {
  it('only accepts days that exist', () => {
    expect(isRealDay('2026-03-10')).toBe(true);
    expect(isRealDay('2028-02-29')).toBe(true);
    for (const d of ['2026-13-45', '2026-02-30', '2026-00-10', '2026-04-31', 'nope']) expect(isRealDay(d)).toBe(false);
    expect(safeDiffDays('2026-03-10', '2026-13-45')).toBeNull();
    expect(safeDiffDays('2026-03-10', '2026-03-08')).toBe(2);
  });

  it('streak helpers do not throw on a damaged day', () => {
    expect(liveStreak({ current: 4, lastDay: '2026-13-45' }, '2026-03-10')).toBe(0);
    expect(updateStreak({ current: 4, best: 6, lastDay: '2026-13-45' }, '2026-03-10')).toEqual({ current: 1, best: 6, lastDay: '2026-03-10' });
  });
});

describe('import rejects impossible days', () => {
  it.each(['2026-13-45', '2026-02-30'])('streak.lastDay %s', async (day) => {
    const { parseBackup } = await load();
    const bad = { ...fresh, streak: { current: 1, best: 1, lastDay: day } };
    expect(parseBackup(backup({ progress: { p1: bad } })).ok).toBe(false);
  });

  it('srs due date', async () => {
    const { parseBackup } = await load();
    const item = { id: 'a', kind: 'line', ref: 'r', ease: 2.5, interval: 1, reps: 1, lapses: 0, due: '2026-02-30' };
    expect(parseBackup(backup({ progress: { p1: { ...fresh, srs: { a: item } } } })).ok).toBe(false);
    expect(parseBackup(backup({ progress: { p1: { ...fresh, srs: { a: { ...item, due: '2026-02-28' } } } } })).ok).toBe(true);
  });

  it('names the damaged student', async () => {
    const { parseBackup } = await load();
    const bad = { ...fresh, streak: { current: 1, best: 1, lastDay: '2026-13-45' } };
    const r = parseBackup(backup({ progress: { p1: bad } }));
    expect(r).toEqual({ ok: false, error: 'The saved progress for Sam is damaged.' });
  });
});

describe('a corrupt day already in storage', () => {
  it('loads fresh progress, keeps a copy, and the student can still be reset and used', async () => {
    const first = await load();
    const id = first.useProfiles.getState().activeId;
    const bad = JSON.stringify({ ...fresh, xp: 90, streak: { current: 3, best: 3, lastDay: '2026-13-45' } });
    store.set(first.KEYS.progress(id), bad);

    const { useProgress, readProgress, resetStudentProgress, KEYS } = await load();
    expect(useProgress.getState().data.xp).toBe(0);
    expect(store.get(KEYS.progressBackup(id))).toBe(bad);

    expect(() => useProgress.getState().recordStep('s1', false)).not.toThrow();
    expect(useProgress.getState().data.xp).toBeGreaterThan(0);

    store.set(KEYS.progress(id), bad);
    expect(readProgress(id).xp).toBe(0);
    expect(resetStudentProgress(id)).toBe(true);
    expect(store.has(KEYS.progressBackup(id))).toBe(false);
  });
});

describe('profiles from an import', () => {
  it('cleans names: control and direction characters go, 30 characters at most', async () => {
    const { parseBackup } = await load();
    const name = `A\u0000b‮c  ${'x'.repeat(60)}`;
    const r = parseBackup(backup({}, [{ ...profile, name }]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const got = r.backup.profiles.profiles[0]?.name ?? '';
      expect(got.length).toBeLessThanOrEqual(30);
      expect(got.startsWith('A b c xxx')).toBe(true);
      expect(got.includes('\u0000') || got.includes('‮')).toBe(false);
    }
  });

  it('rejects a name that is empty once cleaned', async () => {
    const { parseBackup } = await load();
    expect(parseBackup(backup({}, [{ ...profile, name: '​ \u0007 ' }])).ok).toBe(false);
  });

  it('accepts MAX_STUDENTS and rejects one more', async () => {
    const { parseBackup, MAX_STUDENTS } = await load();
    const make = (n: number) => Array.from({ length: n }, (_, i) => ({ ...profile, id: `p${i}`, name: `S${i}` }));
    expect(parseBackup(backup({}, make(MAX_STUDENTS))).ok).toBe(true);
    expect(parseBackup(backup({}, make(MAX_STUDENTS + 1))).ok).toBe(false);
  });

  it('add stops at MAX_STUDENTS', async () => {
    const { useProfiles, MAX_STUDENTS } = await load();
    const many = Array.from({ length: MAX_STUDENTS }, (_, i) => ({ ...profile, id: `p${i}`, name: `S${i}` }));
    useProfiles.setState({ profiles: many, activeId: 'p0' });
    expect(useProfiles.getState().add('One more')).toBeNull();
    expect(useProfiles.getState().profiles).toHaveLength(MAX_STUDENTS);
  });
});

describe('applyBackup', () => {
  it('removes progress and corrupt-data copies of students that are dropped', async () => {
    const { useProfiles, applyBackup, parseBackup, KEYS } = await load();
    const old = { ...profile, id: 'old' };
    useProfiles.setState({ profiles: [old], activeId: 'old' });
    store.set(KEYS.progress('old'), JSON.stringify(fresh));
    store.set(KEYS.progressBackup('old'), '{"damaged":true}');
    const parsed = parseBackup(backup({}, [{ ...profile, id: 'new' }]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(applyBackup(parsed.backup)).toEqual({ ok: true });
    expect(store.has(KEYS.progress('old'))).toBe(false);
    expect(store.has(KEYS.progressBackup('old'))).toBe(false);
    expect(store.has(KEYS.progress('new'))).toBe(true);
  });
});
