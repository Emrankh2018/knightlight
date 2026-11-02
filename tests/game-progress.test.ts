import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CASTLE_QUESTS, DETECTIVE_CASES, KNIGHT_LEVELS, type GameId } from '../src/lib/games';

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

describe('game progress validation', () => {
  it('loads old v1 progress and old backups without a games field or lost learning progress', async () => {
    const { emptyProgress, validateProgress, useProgress, useProfiles, exportAll, parseBackup, KEYS } = await load();
    const old = { ...emptyProgress(), xp: 73, completedSteps: { lesson1: { at: 12, hint: false } } };
    delete old.games;
    expect(validateProgress(old)).toMatchObject({ xp: 73, completedSteps: old.completedSteps });
    const id = useProfiles.getState().activeId;
    storage.set(KEYS.progress(id), JSON.stringify(old));
    useProgress.getState().load(id);
    expect(useProgress.getState().data.xp).toBe(73);
    expect(useProgress.getState().data.games ?? {}).toEqual({});
    const json = JSON.parse(exportAll()) as { progress: Record<string, Record<string, unknown>> };
    const record = json.progress[id];
    if (!record) throw new Error('profile omitted');
    delete record.games;
    const parsed = parseBackup(JSON.stringify(json));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.progress[id]?.completedSteps).toEqual(old.completedSteps);
  });

  it('accepts every known stage, validates stars, and returns an independent copy', async () => {
    const { emptyProgress, validateProgress } = await load();
    const games = {
      castle: Object.fromEntries(CASTLE_QUESTS.map((level) => [level.id, { stars: 1, at: 1 }])),
      knight: Object.fromEntries(KNIGHT_LEVELS.map((level) => [level.id, { stars: 2, at: 2 }])),
      detective: Object.fromEntries(DETECTIVE_CASES.map((level) => [level.id, { stars: 3, at: 3 }])),
    };
    const valid = validateProgress({ ...emptyProgress(), games });
    expect(valid?.games).toEqual(games);
    const first = games.castle[CASTLE_QUESTS[0]?.id ?? ''];
    if (!first) throw new Error('missing castle stage');
    first.stars = 3;
    expect(valid?.games?.castle?.[CASTLE_QUESTS[0]?.id ?? '']?.stars).toBe(1);
  });

  it('rejects invalid containers, identities, medals, and prototype keys', async () => {
    const { emptyProgress, validateProgress } = await load();
    const stage = KNIGHT_LEVELS[0]?.id;
    if (!stage) throw new Error('no knight stages');
    const invalid: unknown[] = [null, [], 'medals', { mystery: {} }, { knight: [] }, { knight: { unknown: { stars: 3, at: 1 } } }];
    for (const stars of [0, 4, -1, 1.5, '3', null, Number.NaN, Number.POSITIVE_INFINITY]) invalid.push({ knight: { [stage]: { stars, at: 1 } } });
    for (const at of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, 'today', null, Number.NaN, Number.POSITIVE_INFINITY]) invalid.push({ knight: { [stage]: { stars: 2, at } } });
    invalid.push({ knight: { [stage]: null } });
    invalid.push(JSON.parse('{"__proto__":{}}') as unknown);
    invalid.push(JSON.parse('{"knight":{"constructor":{"stars":3,"at":1}}}') as unknown);
    for (const games of invalid) expect(validateProgress({ ...emptyProgress(), games }), JSON.stringify(games)).toBeNull();
    expect(({} as Record<string, unknown>).stars).toBeUndefined();
  });
});

describe('per-student game medals', () => {
  it('keeps the highest medals and first completion date without awarding repeat XP', async () => {
    const { useProgress, readProgress, useProfiles } = await load();
    const stage = KNIGHT_LEVELS[0]?.id;
    if (!stage) throw new Error('no knight stages');
    const id = useProfiles.getState().activeId;
    const originalXp = useProgress.getState().data.xp;
    useProgress.getState().recordMiniGame('knight', stage, 2);
    vi.setSystemTime(new Date(now.getTime() + 86_400_000));
    useProgress.getState().recordMiniGame('knight', stage, 1);
    expect(readProgress(id).games?.knight?.[stage]).toEqual({ stars: 2, at: now.getTime() });
    useProgress.getState().recordMiniGame('knight', stage, 3);
    useProgress.getState().recordMiniGame('knight', stage, 3);
    expect(readProgress(id).games?.knight?.[stage]).toEqual({ stars: 3, at: now.getTime() });
    expect(useProgress.getState().data.xp).toBe(originalXp);
  });

  it('ignores invalid game/stage/star writes without modifying progress', async () => {
    const { useProgress } = await load();
    const stage = KNIGHT_LEVELS[0]?.id;
    if (!stage) throw new Error('no knight stages');
    const before = structuredClone(useProgress.getState().data);
    for (const [game, id, stars] of [
      ['unknown', stage, 3], ['knight', 'unknown', 3], ['knight', '__proto__', 3],
      ['knight', stage, 0], ['knight', stage, 4], ['knight', stage, 1.5],
    ] as const) {
      useProgress.getState().recordMiniGame(game as GameId, id, stars as 1 | 2 | 3);
    }
    expect(useProgress.getState().data).toEqual(before);
  });

  it('isolates profiles and reloads medals from storage', async () => {
    const { useProgress, useProfiles, readProgress } = await load();
    const stage = DETECTIVE_CASES[0]?.id;
    if (!stage) throw new Error('no detective cases');
    const first = useProfiles.getState().activeId;
    useProgress.getState().recordMiniGame('detective', stage, 3);
    const second = useProfiles.getState().add('Second student');
    if (!second) throw new Error('student not added');
    expect(useProgress.getState().profileId).toBe(second);
    expect(useProgress.getState().data.games?.detective?.[stage]).toBeUndefined();
    useProgress.getState().recordMiniGame('detective', stage, 1);
    useProfiles.getState().switchTo(first);
    expect(useProgress.getState().data.games?.detective?.[stage]?.stars).toBe(3);
    expect(readProgress(second).games?.detective?.[stage]?.stars).toBe(1);
    useProgress.getState().load(first);
    expect(useProgress.getState().data.games?.detective?.[stage]?.stars).toBe(3);
  });

  it('rejects a stale completion after the student switches', async () => {
    const { useProgress, useProfiles, readProgress } = await load();
    const stage = KNIGHT_LEVELS[0]?.id;
    if (!stage) throw new Error('no knight stages');
    const first = useProfiles.getState().activeId;
    const second = useProfiles.getState().add('New learner');
    if (!second) throw new Error('student not added');
    expect(useProgress.getState().recordMiniGame('knight', stage, 3, first)).toBe(false);
    expect(readProgress(first).games ?? {}).toEqual({});
    expect(readProgress(second).games ?? {}).toEqual({});
    expect(useProgress.getState().recordMiniGame('knight', stage, 2, second)).toBe(true);
    expect(readProgress(second).games?.knight?.[stage]?.stars).toBe(2);
  });

  it('reports a failed write and preserves both saved and in-memory medals for a retry', async () => {
    const { useProgress, useProfiles, readProgress } = await load();
    const stage = KNIGHT_LEVELS[0]?.id;
    if (!stage) throw new Error('no knight stages');
    const id = useProfiles.getState().activeId;
    expect(useProgress.getState().recordMiniGame('knight', stage, 1, id)).toBe(true);
    const before = structuredClone(useProgress.getState().data);
    const saved = new Map(storage);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: (key: string) => void storage.delete(key),
    });
    expect(useProgress.getState().recordMiniGame('knight', stage, 3, id)).toBe(false);
    expect(useProgress.getState().data).toEqual(before);
    expect(storage).toEqual(saved);
    expect(readProgress(id).games?.knight?.[stage]?.stars).toBe(1);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    });
    expect(useProgress.getState().recordMiniGame('knight', stage, 3, id)).toBe(true);
    expect(readProgress(id).games?.knight?.[stage]?.stars).toBe(3);
  });

  it('preserves medals through existing backup/import and clears only the reset student', async () => {
    const { useProgress, useProfiles, exportAll, parseBackup, importAll, resetStudentProgress, readProgress } = await load();
    const castle = CASTLE_QUESTS[0]?.id;
    const knight = KNIGHT_LEVELS[0]?.id;
    if (!castle || !knight) throw new Error('missing game stages');
    const first = useProfiles.getState().activeId;
    useProgress.getState().recordMiniGame('castle', castle, 2);
    const second = useProfiles.getState().add('Other learner');
    if (!second) throw new Error('student not added');
    useProgress.getState().recordMiniGame('knight', knight, 3);
    const exported = exportAll();
    const parsed = parseBackup(exported);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('valid game backup rejected');
    expect(parsed.backup.progress[first]?.games?.castle?.[castle]?.stars).toBe(2);
    expect(parsed.backup.progress[second]?.games?.knight?.[knight]?.stars).toBe(3);
    expect(resetStudentProgress(first)).toBe(true);
    expect(readProgress(first).games ?? {}).toEqual({});
    expect(readProgress(second).games?.knight?.[knight]?.stars).toBe(3);
    expect(importAll(exported)).toEqual({ ok: true });
    expect(readProgress(first).games?.castle?.[castle]?.stars).toBe(2);
    expect(useProgress.getState().data.games?.knight?.[knight]?.stars).toBe(3);
    useProfiles.getState().remove(first);
    expect(useProfiles.getState().profiles.some((profile) => profile.id === first)).toBe(false);
    expect(readProgress(first).games ?? {}).toEqual({});
  });
});
