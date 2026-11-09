import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
const now = new Date('2026-11-02T09:00:00.000Z');

async function load() {
  vi.resetModules();
  const progress = await import('../src/store/progress');
  const profiles = await import('../src/store/profiles');
  const backup = await import('../src/store/backup');
  const { KEYS } = await import('../src/store/storage');
  return { ...progress, ...profiles, ...backup, KEYS };
}

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('legacy game progress validation', () => {
  it('loads older v1 progress and backups that have no game records', async () => {
    const { emptyProgress, useProgress, useProfiles, exportAll, parseBackup, KEYS } = await load();
    const old = { ...emptyProgress(), xp: 73, completedSteps: { lesson1: { at: 12, hint: false } } };
    expect(old).not.toHaveProperty('games');
    const id = useProfiles.getState().activeId;
    storage.set(KEYS.progress(id), JSON.stringify(old));
    useProgress.getState().load(id);
    expect(useProgress.getState().data).toEqual(old);
    const parsed = parseBackup(exportAll());
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.progress[id]).toEqual(old);
  });

  it('accepts every previously shipped stage and returns an independent copy', async () => {
    const { emptyProgress, validateProgress } = await load();
    const games = {
      castle: { captures: { stars: 1, at: 1 }, mates: { stars: 1, at: 1 }, forks: { stars: 1, at: 1 } },
      knight: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`trail-${i + 1}`, { stars: 2, at: 2 }])),
      detective: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`case-${i + 1}`, { stars: 3, at: 3 }])),
    };
    const valid = validateProgress({ ...emptyProgress(), games });
    expect(valid?.games).toEqual(games);
    games.castle.captures.stars = 3;
    expect(valid?.games?.castle?.captures?.stars).toBe(1);
    expect(validateProgress({ ...emptyProgress(), games: {} })?.games).toEqual({});
  });

  it('rejects invalid containers, identities, medals, and prototype keys', async () => {
    const { emptyProgress, validateProgress } = await load();
    const invalid: unknown[] = [
      null, [], 'medals', { mystery: {} }, { knight: [] }, { knight: { 'trail-10': { stars: 3, at: 1 } } },
      { detective: { 'trail-1': { stars: 3, at: 1 } } }, { knight: { 'trail-1': null } },
      JSON.parse('{"__proto__":{}}'), JSON.parse('{"knight":{"constructor":{"stars":3,"at":1}}}'),
    ];
    for (const stars of [0, 4, -1, 1.5, '3', null, Number.NaN, Number.POSITIVE_INFINITY]) {
      invalid.push({ knight: { 'trail-1': { stars, at: 1 } } });
    }
    for (const at of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, 'today', null, Number.NaN, Number.POSITIVE_INFINITY]) {
      invalid.push({ knight: { 'trail-1': { stars: 2, at } } });
    }
    for (const games of invalid) expect(validateProgress({ ...emptyProgress(), games }), JSON.stringify(games)).toBeNull();
    expect(({} as Record<string, unknown>).stars).toBeUndefined();
  });
});

describe('per-student history from retired games', () => {
  it('preserves saved stars and activity history when opening a saved profile and recording a lesson', async () => {
    const { emptyProgress, useProgress, useProfiles, readProgress, KEYS } = await load();
    const id = useProfiles.getState().activeId;
    const games = { detective: { 'case-1': { stars: 3, at: 10 } } };
    const streak = { current: 2, best: 5, lastDay: '2026-11-01' };
    storage.set(KEYS.progress(id), JSON.stringify({ ...emptyProgress(), xp: 73, streak, games }));
    useProgress.getState().load(id);
    expect(useProgress.getState().data).toMatchObject({ xp: 73, streak, games });

    const second = useProfiles.getState().add('Second student');
    if (!second) throw new Error('student not added');
    expect(useProgress.getState().profileId).toBe(second);
    expect(useProgress.getState().data).not.toHaveProperty('games');
    useProfiles.getState().switchTo(id);
    useProgress.getState().recordLesson('course/lesson', true);
    expect(readProgress(id)).toMatchObject({
      games,
      completedLessons: { 'course/lesson': { at: now.getTime(), perfect: true } },
      streak: { best: 5 },
    });
    expect(readProgress(second)).not.toHaveProperty('games');
  });

  it('round-trips saved stars through backup and clears only the reset student', async () => {
    const { emptyProgress, useProgress, useProfiles, exportAll, parseBackup, importAll, resetStudentProgress, readProgress, KEYS } = await load();
    const first = useProfiles.getState().activeId;
    const second = useProfiles.getState().add('Other learner');
    if (!second) throw new Error('student not added');
    const firstSave = { ...emptyProgress(), xp: 73, games: { castle: { captures: { stars: 2, at: 1 } } } };
    const secondSave = { ...emptyProgress(), xp: 31, games: { knight: { 'trail-1': { stars: 3, at: 2 } } } };
    storage.set(KEYS.progress(first), JSON.stringify(firstSave));
    storage.set(KEYS.progress(second), JSON.stringify(secondSave));

    const exported = exportAll();
    const parsed = parseBackup(exported);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.progress[first]).toEqual(firstSave);
    expect(parsed.backup.progress[second]).toEqual(secondSave);
    expect(resetStudentProgress(first)).toBe(true);
    expect(readProgress(first)).toEqual(emptyProgress());
    expect(readProgress(second)).toEqual(secondSave);
    expect(importAll(exported)).toEqual({ ok: true });
    expect(readProgress(first)).toEqual(firstSave);
    expect(useProgress.getState().data).toEqual(secondSave);
    useProfiles.getState().remove(first);
    expect(useProfiles.getState().profiles.some((profile) => profile.id === first)).toBe(false);
    expect(readProgress(first)).toEqual(emptyProgress());
  });
});
