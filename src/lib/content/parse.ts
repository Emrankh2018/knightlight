// Turns course.json + chapter PGN text into the typed content model.
// Never throws on bad content: problems are collected as ContentIssue entries.

import { Chess } from 'chess.js';
import { extractAnnotations, parsePgnGames } from './pgn';
import type { RawGame } from './pgn';
import type {
  Arrow,
  Chapter,
  ContentIssue,
  Course,
  CourseKind,
  CourseMeta,
  Highlight,
  Lesson,
  Level,
  Side,
  Step,
  StepBase,
  StepMove,
  StepType,
  TeacherNotes,
} from './types';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const STEP_TYPES: readonly string[] = ['explain', 'find-move', 'line-drill', 'quiz'];
const KINDS: readonly string[] = ['skills', 'opening'];
const LEVELS: readonly string[] = ['beginner', 'intermediate', 'mid-advanced', 'advanced', 'master'];
const SIDES: readonly string[] = ['white', 'black'];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function first(game: RawGame, name: string): string | undefined {
  return game.tags[name]?.[0];
}

function splitList(value: string): string[] {
  return value
    .split(' | ')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function allLists(games: RawGame[], name: string): string[] {
  return games.flatMap((g) => (g.tags[name] ?? []).flatMap(splitList));
}

function chapterIdOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/\.pgn$/i, '');
}

/** Builds one step from one game. Pushes human-readable problems into `errs`. */
function buildStep(game: RawGame, id: string, isFirstOfLesson: boolean, errs: string[]): Step | undefined {
  errs.push(...game.errors);

  if (isFirstOfLesson && (first(game, 'LessonTitle') ?? '').trim() === '') {
    errs.push('Missing [LessonTitle] on the first game of the lesson');
  }

  const typeTag = first(game, 'Step')?.trim();
  let type: StepType | undefined;
  if (typeTag === undefined) errs.push('Missing [Step] tag');
  else if (!STEP_TYPES.includes(typeTag)) {
    errs.push(`Unknown [Step "${typeTag}"] (use explain, find-move, line-drill or quiz)`);
  } else type = typeTag as StepType;

  const fenTag = first(game, 'FEN')?.trim();
  const fen = fenTag === undefined || fenTag === '' ? START_FEN : fenTag;
  let chess: Chess | undefined;
  let turnSide: Side = 'white';
  try {
    chess = new Chess(fen);
    turnSide = chess.turn() === 'w' ? 'white' : 'black';
  } catch {
    errs.push(`Invalid FEN: ${fen}`);
  }

  const sideTag = first(game, 'Side')?.trim();
  let tagSide: Side | undefined;
  if (sideTag !== undefined) {
    if (SIDES.includes(sideTag)) tagSide = sideTag as Side;
    else errs.push(`Invalid [Side "${sideTag}"] (use white or black)`);
  }

  // Replay the moves.
  const moves: StepMove[] = [];
  const intro: string[] = [];
  const introArrows: Arrow[] = [];
  const introHighlights: Highlight[] = [];
  const comments: string[][] = [];
  let moveFailed = false;
  let variationReported = false;

  for (const token of game.tokens) {
    if (token.kind === 'variation') {
      if (!variationReported) errs.push('Variations ( ... ) are not supported');
      variationReported = true;
    } else if (token.kind === 'comment') {
      const ann = extractAnnotations(token.text);
      for (const item of ann.invalid) errs.push(`Unreadable annotation ${item}`);
      const last = moves[moves.length - 1];
      if (last === undefined) {
        if (ann.text !== undefined) intro.push(ann.text);
        introArrows.push(...ann.arrows);
        introHighlights.push(...ann.highlights);
      } else {
        if (ann.text !== undefined) (comments[moves.length - 1] ??= []).push(ann.text);
        last.arrows.push(...ann.arrows);
        last.highlights.push(...ann.highlights);
      }
    } else if (token.kind === 'move' && chess !== undefined && !moveFailed) {
      try {
        const m = chess.move(token.san);
        moves.push({
          san: m.san,
          uci: m.from + m.to + (m.promotion ?? ''),
          fen: chess.fen(),
          arrows: [],
          highlights: [],
        });
      } catch {
        moveFailed = true;
        errs.push(`Illegal or unreadable move "${token.san}" after ${moves.length} move(s)`);
      }
    }
  }
  comments.forEach((parts, index) => {
    const move = moves[index];
    if (move !== undefined && parts.length > 0) move.comment = parts.join(' ');
  });

  const hints = (game.tags['Hint'] ?? []).map((h) => h.trim()).filter((h) => h !== '');
  const base: Omit<StepBase, 'type'> = {
    id,
    fen,
    introArrows,
    introHighlights,
    moves,
    hints,
    ...(intro.length > 0 ? { intro: intro.join(' ') } : {}),
  };

  if (type === undefined || chess === undefined) return undefined;

  switch (type) {
    case 'explain':
      return { ...base, type };
    case 'find-move': {
      if (tagSide !== undefined && tagSide !== turnSide) {
        errs.push(`[Side "${tagSide}"] does not match the side to move in the FEN (${turnSide})`);
      }
      if (!moveFailed) {
        if (moves.length === 0) errs.push('find-move needs at least 1 move');
        else if (moves.length % 2 === 0) {
          errs.push(`find-move must end on the solver's move (odd number of moves), found ${moves.length}`);
        }
      }
      if (hints.length === 0) errs.push('find-move needs at least one [Hint]');
      return { ...base, type, side: turnSide };
    }
    case 'line-drill': {
      if (sideTag === undefined) errs.push('line-drill needs a [Side] tag');
      if (!moveFailed && moves.length < 2) errs.push('line-drill needs at least 2 moves');
      return { ...base, type, side: tagSide ?? turnSide };
    }
    case 'quiz': {
      const question = first(game, 'Question')?.trim() ?? '';
      if (question === '') errs.push('quiz needs a [Question]');
      const choicesTag = first(game, 'Choices');
      const choices = choicesTag === undefined ? [] : splitList(choicesTag);
      if (choicesTag === undefined) errs.push('quiz needs [Choices "a | b | c"]');
      else if (choices.length < 2) errs.push('quiz needs at least 2 choices separated by " | "');
      const choicesOk = choices.length >= 2;
      const answerTag = first(game, 'Answer')?.trim();
      let answer = 0;
      if (answerTag === undefined) errs.push('quiz needs an [Answer] (1 = first choice)');
      else if (!/^\d+$/.test(answerTag)) errs.push(`[Answer "${answerTag}"] must be a whole number`);
      else {
        const n = Number(answerTag);
        if (choicesOk && (n < 1 || n > choices.length)) {
          errs.push(`[Answer "${answerTag}"] is out of range (1 to ${choices.length})`);
        } else answer = n - 1;
      }
      const explanation = first(game, 'Explanation')?.trim();
      return {
        ...base,
        type,
        question,
        choices,
        answer,
        ...(explanation !== undefined && explanation !== '' ? { explanation } : {}),
      };
    }
  }
}

export function parseChapter(fileName: string, text: string): { chapter: Chapter; issues: ContentIssue[] } {
  const chapterId = chapterIdOf(fileName);
  const issues: ContentIssue[] = [];
  const games = parsePgnGames(text);
  if (games.length === 0) issues.push({ file: fileName, message: 'No games found in this file' });

  interface Group {
    id: string;
    games: { raw: RawGame; number: number }[];
  }
  const groups: Group[] = [];
  const pre = new Map<number, string[]>();
  const seenIds = new Set<string>();
  const state: { current: Group | undefined } = { current: undefined };

  games.forEach((raw, idx) => {
    const number = idx + 1;
    const errs: string[] = [];
    pre.set(number, errs);
    const lessonId = first(raw, 'Lesson')?.trim();
    if (lessonId === undefined || lessonId === '') {
      errs.push('Missing [Lesson] tag');
      state.current = undefined;
      return;
    }
    if (!KEBAB.test(lessonId)) {
      errs.push(`Lesson id "${lessonId}" must be lowercase words joined by hyphens (e.g. "my-lesson")`);
      state.current = undefined;
      return;
    }
    if (state.current !== undefined && state.current.id === lessonId) {
      state.current.games.push({ raw, number });
      return;
    }
    if (seenIds.has(lessonId)) {
      errs.push(`Duplicate lesson id "${lessonId}": a lesson's games must be consecutive`);
      state.current = undefined;
      return;
    }
    seenIds.add(lessonId);
    const group: Group = { id: lessonId, games: [{ raw, number }] };
    groups.push(group);
    state.current = group;
  });

  const lessons: Lesson[] = [];
  for (const group of groups) {
    const steps: Step[] = [];
    group.games.forEach(({ raw, number }, index) => {
      const errs = pre.get(number) ?? [];
      const step = buildStep(raw, `${chapterId}/${group.id}/${index}`, index === 0, errs);
      if (errs.length === 0 && step !== undefined) steps.push(step);
    });
    const rawGames = group.games.map((g) => g.raw);
    const teacherNotes: TeacherNotes = {
      points: allLists(rawGames, 'TeacherNotes'),
      mistakes: allLists(rawGames, 'Mistakes'),
      questions: allLists(rawGames, 'ClassQuestions'),
    };
    if (steps.length > 0) {
      const title = (first(rawGames[0] as RawGame, 'LessonTitle') ?? '').trim();
      lessons.push({ id: group.id, title: title === '' ? group.id : title, steps, teacherNotes });
    }
  }

  for (const [number, errs] of pre) {
    for (const message of errs) issues.push({ file: fileName, game: number, message });
  }

  return { chapter: { id: chapterId, title: chapterId, lessons }, issues };
}

// --- course.json -----------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseMeta(slug: string, meta: unknown): { value?: CourseMeta; issues: ContentIssue[] } {
  const issues: ContentIssue[] = [];
  const bad = (message: string): void => {
    issues.push({ file: 'course.json', message });
  };
  if (!KEBAB.test(slug)) bad(`Folder name "${slug}" must be lowercase words joined by hyphens`);
  if (!isRecord(meta)) {
    bad('course.json must contain a JSON object');
    return { issues };
  }
  const str = (key: string): string => {
    const v = meta[key];
    if (typeof v !== 'string' || v.trim() === '') {
      bad(`"${key}" is required and must be non-empty text`);
      return '';
    }
    return v;
  };
  const title = str('title');
  const description = str('description');

  const kind = meta['kind'];
  if (typeof kind !== 'string' || !KINDS.includes(kind)) bad('"kind" must be "skills" or "opening"');
  const level = meta['level'];
  if (typeof level !== 'string' || !LEVELS.includes(level)) {
    bad(`"level" must be one of: ${LEVELS.join(', ')}`);
  }
  if (typeof meta['reviewed'] !== 'boolean') bad('"reviewed" is required and must be true or false');

  let tags: string[] = [];
  const tagsRaw = meta['tags'];
  if (tagsRaw !== undefined) {
    if (Array.isArray(tagsRaw) && tagsRaw.every((t): t is string => typeof t === 'string')) tags = tagsRaw;
    else bad('"tags" must be a list of texts');
  }

  const side = meta['side'];
  if (side !== undefined && (typeof side !== 'string' || !SIDES.includes(side))) {
    bad('"side" must be "white" or "black"');
  }

  const chapters: { file: string; title: string }[] = [];
  const chaptersRaw = meta['chapters'];
  if (!Array.isArray(chaptersRaw) || chaptersRaw.length === 0) {
    bad('"chapters" must be a non-empty list of { "file", "title" }');
  } else {
    const files = new Set<string>();
    chaptersRaw.forEach((c: unknown, i: number) => {
      if (!isRecord(c) || typeof c['file'] !== 'string' || typeof c['title'] !== 'string') {
        bad(`chapters[${i}] needs text values for "file" and "title"`);
        return;
      }
      if (!c['file'].toLowerCase().endsWith('.pgn')) bad(`chapters[${i}].file "${c['file']}" must end in .pgn`);
      if (files.has(c['file'])) bad(`chapter file "${c['file']}" is listed twice`);
      files.add(c['file']);
      chapters.push({ file: c['file'], title: c['title'] });
    });
  }

  if (issues.length > 0) return { issues };
  const value: CourseMeta = {
    slug,
    title,
    kind: kind as CourseKind,
    level: level as Level,
    description,
    tags,
    reviewed: meta['reviewed'] as boolean,
    chapters,
    ...(side !== undefined ? { side: side as Side } : {}),
  };
  return { value, issues };
}

export function parseCourse(
  slug: string,
  meta: unknown,
  chapterTexts: Record<string, string>,
): { course?: Course; issues: ContentIssue[] } {
  const parsed = parseMeta(slug, meta);
  const issues = [...parsed.issues];
  if (parsed.value === undefined) return { issues };

  const courseMeta = parsed.value;
  const chapterList: Chapter[] = [];
  const lessonIds = new Set<string>();

  for (const entry of courseMeta.chapters) {
    const chapterText = chapterTexts[entry.file];
    if (chapterText === undefined) {
      issues.push({ file: entry.file, message: 'Chapter file listed in course.json was not found' });
      continue;
    }
    const { chapter, issues: chapterIssues } = parseChapter(entry.file, chapterText);
    issues.push(...chapterIssues);
    const lessons = chapter.lessons.filter((lesson) => {
      if (lessonIds.has(lesson.id)) {
        issues.push({
          file: entry.file,
          message: `Duplicate lesson id "${lesson.id}": already used in an earlier chapter of this course`,
        });
        return false;
      }
      lessonIds.add(lesson.id);
      return true;
    });
    chapterList.push({ ...chapter, title: entry.title, lessons });
  }

  return { course: { ...courseMeta, chapterList }, issues };
}
