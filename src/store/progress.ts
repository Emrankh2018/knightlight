import { create } from 'zustand';
import { LEVEL_IDS, type BotLevelId } from '../engine/level-ids';
import { fmt, m } from '../i18n';
import { evaluateAchievements, type Stats } from '../lib/achievements';
import { isRealDay, todayLocal } from '../lib/date';
import { GAME_IDS, isMiniGameStage, type GameId, type GameStars, type MiniGameProgress } from '../lib/games';
import { newItem, review, type SrsGrade, type SrsItem, type SrsKind } from '../lib/srs';
import { MAX_XP, updateStreak, xpFor, type GameResult, type StreakState, type XpEvent } from '../lib/xp';
import { useProfiles } from './profiles';
import { useUi } from './ui';
import { DAY_RE, isBool, isCount, isNum, isRecord, isSafeKey, isStr, KEYS, parseJson, readRaw, writeRaw } from './storage';

export interface Progress {
  version: 1;
  xp: number;
  streak: StreakState;
  completedSteps: Record<string, { at: number; hint: boolean }>;
  completedLessons: Record<string, { at: number; perfect: boolean }>;
  lastLesson?: { course: string; lesson: string; step: number };
  puzzles: {
    solved: Record<string, { at: number; hint: boolean }>;
    byLevel: Record<string, { solved: number; attempted: number }>;
    streak: { current: number; best: number };
  };
  srs: Record<string, SrsItem>;
  achievements: string[];
  botWins: Record<string, number>;
  linesDrilled: number;
  games?: MiniGameProgress;
}

export function emptyProgress(): Progress {
  return {
    version: 1,
    xp: 0,
    streak: { current: 0, best: 0 },
    completedSteps: {},
    completedLessons: {},
    puzzles: { solved: {}, byLevel: {}, streak: { current: 0, best: 0 } },
    srs: {},
    achievements: [],
    botWins: {},
    linesDrilled: 0,
    games: {},
  };
}

const SRS_KINDS: readonly string[] = ['line', 'puzzle', 'step'];

function mapOf<T>(v: unknown, check: (x: unknown) => T | null): Record<string, T> | null {
  if (!isRecord(v)) return null;
  const out: Record<string, T> = {};
  for (const [k, x] of Object.entries(v)) {
    if (!isSafeKey(k)) return null;
    const c = check(x);
    if (c === null) return null;
    out[k] = c;
  }
  return out;
}

function parseSrs(v: unknown): SrsItem | null {
  if (!isRecord(v)) return null;
  if (!isStr(v.id) || !isStr(v.ref) || !isStr(v.kind) || !SRS_KINDS.includes(v.kind)) return null;
  if (!isNum(v.ease) || !isCount(v.interval) || !isCount(v.reps) || !isCount(v.lapses)) return null;
  if (!isStr(v.due) || !DAY_RE.test(v.due) || !isRealDay(v.due)) return null;
  return { id: v.id, kind: v.kind as SrsKind, ref: v.ref, ease: v.ease, interval: v.interval, reps: v.reps, due: v.due, lapses: v.lapses };
}

function parseStreak(v: unknown): StreakState | null {
  if (!isRecord(v) || !isCount(v.current) || !isCount(v.best)) return null;
  if (v.lastDay === undefined) return { current: v.current, best: v.best };
  if (!isStr(v.lastDay) || !DAY_RE.test(v.lastDay) || !isRealDay(v.lastDay)) return null;
  return { current: v.current, best: v.best, lastDay: v.lastDay };
}

function parseGames(value: unknown): MiniGameProgress | null {
  if (!isRecord(value)) return null;
  const games: MiniGameProgress = {};
  for (const [key, stages] of Object.entries(value)) {
    if (!(GAME_IDS as readonly string[]).includes(key) || !isRecord(stages)) return null;
    const game = key as GameId;
    const entries: NonNullable<MiniGameProgress[GameId]> = {};
    for (const [id, entry] of Object.entries(stages)) {
      if (!isMiniGameStage(game, id) || !isRecord(entry)) return null;
      if (entry.stars !== 1 && entry.stars !== 2 && entry.stars !== 3) return null;
      if (!isCount(entry.at) || !Number.isSafeInteger(entry.at)) return null;
      entries[id] = { stars: entry.stars, at: entry.at };
    }
    games[game] = entries;
  }
  return games;
}

/** Strict validation of one progress record. Returns a clean copy, or null if anything is off. */
export function validateProgress(v: unknown): Progress | null {
  if (!isRecord(v) || v.version !== 1 || !isCount(v.xp) || v.xp > MAX_XP || !isCount(v.linesDrilled)) return null;
  const streak = parseStreak(v.streak);
  if (!streak) return null;
  const completedSteps = mapOf(v.completedSteps, (x) => (isRecord(x) && isNum(x.at) && isBool(x.hint) ? { at: x.at, hint: x.hint } : null));
  const completedLessons = mapOf(v.completedLessons, (x) => (isRecord(x) && isNum(x.at) && isBool(x.perfect) ? { at: x.at, perfect: x.perfect } : null));
  if (!completedSteps || !completedLessons) return null;
  let lastLesson: Progress['lastLesson'];
  if (v.lastLesson !== undefined) {
    const l = v.lastLesson;
    if (!isRecord(l) || !isStr(l.course) || !isStr(l.lesson) || !isCount(l.step)) return null;
    lastLesson = { course: l.course, lesson: l.lesson, step: l.step };
  }
  if (!isRecord(v.puzzles)) return null;
  const pz = v.puzzles;
  const solved = mapOf(pz.solved, (x) => (isRecord(x) && isNum(x.at) && isBool(x.hint) ? { at: x.at, hint: x.hint } : null));
  const byLevel = mapOf(pz.byLevel, (x) => (isRecord(x) && isCount(x.solved) && isCount(x.attempted) ? { solved: x.solved, attempted: x.attempted } : null));
  if (!solved || !byLevel || !isRecord(pz.streak) || !isCount(pz.streak.current) || !isCount(pz.streak.best)) return null;
  const srs = mapOf(v.srs, parseSrs);
  if (!srs) return null;
  if (!Array.isArray(v.achievements) || !(v.achievements as unknown[]).every(isStr)) return null;
  const botWins = mapOf(v.botWins, (x) => (isCount(x) ? x : null));
  if (!botWins) return null;
  const out: Progress = {
    version: 1,
    xp: v.xp,
    streak,
    completedSteps,
    completedLessons,
    puzzles: { solved, byLevel, streak: { current: pz.streak.current, best: pz.streak.best } },
    srs,
    achievements: [...(v.achievements as string[])],
    botWins,
    linesDrilled: v.linesDrilled,
  };
  if (lastLesson) out.lastLesson = lastLesson;
  if (v.games !== undefined) {
    const games = parseGames(v.games);
    if (!games) return null;
    out.games = games;
  }
  return out;
}

/** Loads a profile's progress. Unknown versions and corrupt JSON are copied to a backup key and replaced by a fresh record. */
export function readProgress(id: string): Progress {
  const raw = readRaw(KEYS.progress(id));
  if (raw === null) return emptyProgress();
  const valid = validateProgress(parseJson(raw));
  if (valid) return valid;
  writeRaw(KEYS.progressBackup(id), raw);
  const fresh = emptyProgress();
  writeRaw(KEYS.progress(id), JSON.stringify(fresh));
  return fresh;
}

function statsOf(p: Progress): Stats {
  const botWins: Partial<Record<BotLevelId, number>> = {};
  for (const lvl of LEVEL_IDS) {
    const n = p.botWins[lvl];
    if (n !== undefined) botWins[lvl] = n;
  }
  return {
    lessonsCompleted: Object.keys(p.completedLessons).length,
    puzzlesSolved: Object.keys(p.puzzles.solved).length,
    bestStreak: p.streak.best,
    linesDrilled: p.linesDrilled,
    totalXp: p.xp,
    botWins,
    perfectLessons: Object.values(p.completedLessons).filter((l) => l.perfect).length,
  };
}

interface ProgressState {
  profileId: string;
  data: Progress;
  load: (id: string) => void;
  recordStep: (stepId: string, hint: boolean) => void;
  recordLesson: (lessonKey: string, perfect: boolean) => void;
  recordPuzzle: (id: string, level: string, solved: boolean, hint: boolean) => void;
  recordLine: (ref: string, clean: boolean) => void;
  recordBotWin: (levelId: BotLevelId) => void;
  /** Records one finished game against the bot: XP for the result, plus a win tally on a win. */
  recordBotGame: (levelId: BotLevelId, result: GameResult) => void;
  addSrs: (id: string, kind: SrsKind, ref: string) => void;
  reviewSrs: (id: string, grade: SrsGrade) => void;
  removeSrs: (id: string) => void;
  setLastLesson: (course: string, lesson: string, step: number) => void;
  /** Saves best stars once per stage. The captured profile ID guards late callbacks after a switch. */
  recordMiniGame: (game: GameId, stageId: string, stars: GameStars, expectedProfileId?: string) => boolean;
}

export const useProgress = create<ProgressState>()((set, get) => {
  /** Applies `change`, awards XP, updates the streak, evaluates achievements, persists, and queues toasts. */
  const commit = (change: (draft: Progress) => XpEvent[] | void, countsAsActivity = true): void => {
    const { profileId, data } = get();
    const draft = structuredClone(data);
    const events = change(draft) ?? [];
    if (countsAsActivity) {
      const before = draft.streak.current;
      draft.streak = updateStreak(draft.streak, todayLocal());
      if (draft.streak.current > before && before > 0) events.push({ type: 'streak' });
    }
    for (const e of events) draft.xp = Math.min(MAX_XP, draft.xp + xpFor(e));
    const unlocked = evaluateAchievements(statsOf(draft), draft.achievements);
    if (unlocked.length > 0) draft.achievements = [...draft.achievements, ...unlocked];
    writeRaw(KEYS.progress(profileId), JSON.stringify(draft));
    set({ data: draft });
    for (const id of unlocked) {
      useUi.getState().pushToast(fmt(m().toast.achievementUnlocked, { name: m().achievements[id] ?? id }));
    }
  };

  const initialId = useProfiles.getState().activeId;
  return {
    profileId: initialId,
    data: readProgress(initialId),
    load: (id) => set({ profileId: id, data: readProgress(id) }),
    recordStep: (stepId, hint) =>
      commit((d) => {
        if (d.completedSteps[stepId]) return;
        d.completedSteps[stepId] = { at: Date.now(), hint };
        return [{ type: 'step', hint }];
      }),
    recordLesson: (lessonKey, perfect) =>
      commit((d) => {
        const prev = d.completedLessons[lessonKey];
        d.completedLessons[lessonKey] = { at: prev?.at ?? Date.now(), perfect: perfect || (prev?.perfect ?? false) };
        return prev ? [] : [{ type: 'lesson' }];
      }),
    recordPuzzle: (id, level, solved, hint) =>
      commit((d) => {
        const lv = d.puzzles.byLevel[level] ?? { solved: 0, attempted: 0 };
        lv.attempted += 1;
        d.puzzles.byLevel[level] = lv;
        if (!solved) {
          d.puzzles.streak.current = 0;
          return;
        }
        d.puzzles.streak.current += 1;
        d.puzzles.streak.best = Math.max(d.puzzles.streak.best, d.puzzles.streak.current);
        if (d.puzzles.solved[id]) return;
        d.puzzles.solved[id] = { at: Date.now(), hint };
        lv.solved += 1;
        return [{ type: 'puzzle', hint }];
      }),
    recordLine: (_ref, clean) =>
      commit((d) => {
        d.linesDrilled += 1;
        return [{ type: 'line', clean }];
      }),
    recordBotWin: (levelId) =>
      commit((d) => {
        d.botWins[levelId] = (d.botWins[levelId] ?? 0) + 1;
      }),
    recordBotGame: (levelId, result) =>
      commit((d) => {
        if (result === 'win') d.botWins[levelId] = (d.botWins[levelId] ?? 0) + 1;
        return [{ type: 'game', result }];
      }),
    addSrs: (id, kind, ref) =>
      commit((d) => {
        if (!d.srs[id]) d.srs[id] = newItem(id, kind, ref, todayLocal());
      }, false),
    reviewSrs: (id, grade) =>
      commit((d) => {
        const item = d.srs[id];
        if (item) d.srs[id] = review(item, grade, todayLocal());
      }),
    removeSrs: (id) =>
      commit((d) => {
        delete d.srs[id];
      }, false),
    setLastLesson: (course, lesson, step) =>
      commit((d) => {
        d.lastLesson = { course, lesson, step };
      }, false),
    recordMiniGame: (game, stageId, stars, expectedProfileId) => {
      const { profileId, data } = get();
      if (expectedProfileId !== undefined && expectedProfileId !== profileId) return false;
      if (!(GAME_IDS as readonly string[]).includes(game) || !isMiniGameStage(game, stageId)) return false;
      if (stars !== 1 && stars !== 2 && stars !== 3) return false;
      const draft = structuredClone(data);
      const previous = draft.games?.[game]?.[stageId];
      draft.games ??= {};
      draft.games[game] ??= {};
      const stages = draft.games[game];
      if (!stages) return false;
      stages[stageId] = { stars: Math.max(previous?.stars ?? 0, stars) as GameStars, at: previous?.at ?? Date.now() };
      draft.streak = updateStreak(draft.streak, todayLocal());
      if (!writeRaw(KEYS.progress(profileId), JSON.stringify(draft))) return false;
      set({ data: draft });
      return true;
    },
  };
});

/** Keep the progress store pointed at the active profile. */
useProfiles.subscribe((state, prev) => {
  if (state.activeId !== prev.activeId) useProgress.getState().load(state.activeId);
});
