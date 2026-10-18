import { describe, expect, it } from 'vitest';
import { extractAnnotations, parsePgnGames } from '../src/lib/content/pgn';
import { parseChapter, parseCourse } from '../src/lib/content/parse';
import type { FindMoveStep, LineDrillStep, QuizStep } from '../src/lib/content/types';

const MATE_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

function game(tags: Record<string, string | string[]>, movetext = ''): string {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(tags)) {
    for (const v of Array.isArray(value) ? value : [value]) lines.push(`[${name} "${v}"]`);
  }
  return `${lines.join('\n')}\n\n${movetext}\n`;
}

function messages(text: string): string[] {
  return parseChapter('c.pgn', text).issues.map((i) => i.message);
}

describe('pgn tokenizer', () => {
  it('reads tags with escapes and repeated tags', () => {
    const [g] = parsePgnGames('[Hint "say \\"hi\\" and \\\\"]\n[Hint "two"]\n\n1. e4 *');
    expect(g?.tags['Hint']).toEqual(['say "hi" and \\', 'two']);
  });

  it('handles move numbers, suffixes, NAGs and results', () => {
    const [g] = parsePgnGames('1. e4 e5 2.Nf3! Nc6?? $1 3... Bb4+ 1/2-1/2');
    const kinds = g?.tokens.map((t) => (t.kind === 'move' ? t.san : t.kind));
    expect(kinds).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'nag', 'Bb4+', 'result']);
  });

  it('splits several games and ends a game at its result', () => {
    const games = parsePgnGames('[A "1"]\n\n1. e4 1-0\n\n[A "2"]\n\n1. d4 0-1\n[A "3"]\n\n*');
    expect(games.map((g) => g.tags['A']?.[0])).toEqual(['1', '2', '3']);
  });

  it('keeps comments with commands and flags variations', () => {
    const [g] = parsePgnGames('1. e4 {hello [%cal Ge2e4]} (1. d4 {inner}) e5 *');
    expect(g?.tokens.map((t) => t.kind)).toEqual(['move', 'comment', 'variation', 'move', 'result']);
  });

  it('reports malformed headers and unterminated comments', () => {
    const [g] = parsePgnGames('[Broken "x\n[Ok "y"]\n\n1. e4 {open');
    expect(g?.errors.length).toBe(2);
    expect(g?.tags['Ok']).toEqual(['y']);
  });

  it('extracts arrows and highlights and cleans the text', () => {
    const a = extractAnnotations('  Look [%cal Ge2e4,Rd1d8] here [%csl Rd5,Ge4] [%clk 0:01]  ');
    expect(a.text).toBe('Look here');
    expect(a.arrows).toEqual([
      { color: 'G', from: 'e2', to: 'e4' },
      { color: 'R', from: 'd1', to: 'd8' },
    ]);
    expect(a.highlights).toEqual([
      { color: 'R', square: 'd5' },
      { color: 'G', square: 'e4' },
    ]);
    expect(extractAnnotations('[%csl Rd5]').text).toBeUndefined();
    expect(extractAnnotations('[%cal Xz9]').invalid).toHaveLength(1);
  });
});

describe('step types', () => {
  it('parses an explain step with intro, comments and canonical moves', () => {
    const text = game(
      { Lesson: 'l', LessonTitle: 'L', Step: 'explain' },
      '{Intro [%csl Gd4] [%cal Gd2d4]} 1. e4! {Center. [%cal Ge2e4]} e5 $1 {Reply} {More} *',
    );
    const { chapter, issues } = parseChapter('01-x.pgn', text);
    expect(issues).toEqual([]);
    const step = chapter.lessons[0]?.steps[0];
    expect(step?.id).toBe('01-x/l/0');
    expect(step?.intro).toBe('Intro');
    expect(step?.introHighlights).toEqual([{ color: 'G', square: 'd4' }]);
    expect(step?.introArrows).toEqual([{ color: 'G', from: 'd2', to: 'd4' }]);
    expect(step?.moves[0]).toMatchObject({ san: 'e4', uci: 'e2e4', comment: 'Center.' });
    expect(step?.moves[0]?.arrows).toEqual([{ color: 'G', from: 'e2', to: 'e4' }]);
    expect(step?.moves[1]?.comment).toBe('Reply More');
    expect(step?.moves[1]?.fen).toContain('4p3/4P3');
  });

  it('parses find-move with derived side and hints', () => {
    const text = game(
      { Lesson: 'l', LessonTitle: 'L', Step: 'find-move', FEN: MATE_FEN, Hint: ['Queen.', 'f7.'] },
      '4. Qxf7# *',
    );
    const step = parseChapter('c.pgn', text).chapter.lessons[0]?.steps[0] as FindMoveStep;
    expect(step.type).toBe('find-move');
    expect(step.side).toBe('white');
    expect(step.hints).toEqual(['Queen.', 'f7.']);
    expect(step.moves[0]?.san).toBe('Qxf7#');
  });

  it('parses line-drill with side and promotion uci', () => {
    const text = game(
      { Lesson: 'l', LessonTitle: 'L', Step: 'line-drill', Side: 'black' },
      '1. e4 e5 *',
    );
    const step = parseChapter('c.pgn', text).chapter.lessons[0]?.steps[0] as LineDrillStep;
    expect(step.side).toBe('black');
    const promo = game(
      { Lesson: 'p', LessonTitle: 'P', Step: 'explain', FEN: '8/P6k/8/8/8/8/8/K7 w - - 0 1' },
      '1. a8=Q+ *',
    );
    expect(parseChapter('c.pgn', promo).chapter.lessons[0]?.steps[0]?.moves[0]?.uci).toBe('a7a8q');
  });

  it('parses a quiz and converts the 1-based answer to 0-based', () => {
    const text = game(
      {
        Lesson: 'l',
        LessonTitle: 'L',
        Step: 'quiz',
        Question: 'Which?',
        Choices: 'a | b | c',
        Answer: '3',
        Explanation: 'Because.',
      },
      '1. e4 *',
    );
    const { chapter, issues } = parseChapter('c.pgn', text);
    expect(issues).toEqual([]);
    const step = chapter.lessons[0]?.steps[0] as QuizStep;
    expect(step.choices).toEqual(['a', 'b', 'c']);
    expect(step.answer).toBe(2);
    expect(step.explanation).toBe('Because.');
  });
});

describe('lessons', () => {
  it('groups consecutive games and merges teacher notes', () => {
    const text =
      game(
        { Lesson: 'one', LessonTitle: 'One', Step: 'explain', TeacherNotes: 'p1 | p2', Mistakes: 'm1' },
        '1. e4 *',
      ) +
      game({ Lesson: 'one', Step: 'explain', TeacherNotes: 'p3', ClassQuestions: 'q1 | q2' }, '1. d4 *') +
      game({ Lesson: 'two', LessonTitle: 'Two', Step: 'explain' }, '1. c4 *');
    const { chapter, issues } = parseChapter('c.pgn', text);
    expect(issues).toEqual([]);
    expect(chapter.lessons.map((l) => [l.id, l.title, l.steps.length])).toEqual([
      ['one', 'One', 2],
      ['two', 'Two', 1],
    ]);
    expect(chapter.lessons[0]?.teacherNotes).toEqual({
      points: ['p1', 'p2', 'p3'],
      mistakes: ['m1'],
      questions: ['q1', 'q2'],
    });
    expect(chapter.lessons[0]?.steps[1]?.id).toBe('c/one/1');
  });
});

describe('failing content', () => {
  const ok = { Lesson: 'l', LessonTitle: 'L', Step: 'explain' };

  it('rejects an illegal move and drops the game', () => {
    const result = parseChapter('c.pgn', game(ok, '1. e5 *'));
    expect(result.issues[0]).toMatchObject({ file: 'c.pgn', game: 1 });
    expect(result.issues[0]?.message).toMatch(/Illegal/);
    expect(result.chapter.lessons).toEqual([]);
  });

  it('rejects a malformed FEN', () => {
    expect(messages(game({ ...ok, FEN: 'not a fen' }))).toEqual([expect.stringMatching(/Invalid FEN/)]);
  });

  it('rejects find-move with an even number of moves', () => {
    const m = messages(game({ ...ok, Step: 'find-move', Hint: 'h' }, '1. e4 e5 *'));
    expect(m).toEqual([expect.stringMatching(/odd number/)]);
  });

  it('rejects find-move without a hint', () => {
    expect(messages(game({ ...ok, Step: 'find-move' }, '1. e4 *'))).toEqual([
      expect.stringMatching(/Hint/),
    ]);
  });

  it('rejects a find-move Side that contradicts the FEN', () => {
    const m = messages(game({ ...ok, Step: 'find-move', Hint: 'h', Side: 'black' }, '1. e4 *'));
    expect(m).toEqual([expect.stringMatching(/does not match/)]);
  });

  it('rejects a quiz missing Choices', () => {
    const m = messages(game({ ...ok, Step: 'quiz', Question: 'q', Answer: '1' }));
    expect(m).toEqual([expect.stringMatching(/Choices/)]);
  });

  it('rejects a quiz answer out of range', () => {
    const base = { ...ok, Step: 'quiz', Question: 'q', Choices: 'a | b' };
    expect(messages(game({ ...base, Answer: '3' }))).toEqual([expect.stringMatching(/out of range/)]);
    expect(messages(game({ ...base, Answer: '0' }))).toEqual([expect.stringMatching(/out of range/)]);
  });

  it('rejects a variation', () => {
    expect(messages(game(ok, '1. e4 (1. d4) e5 *'))).toEqual([expect.stringMatching(/Variations/)]);
  });

  it('rejects an unknown Step type', () => {
    expect(messages(game({ ...ok, Step: 'puzzle' }))).toEqual([expect.stringMatching(/Unknown \[Step/)]);
  });

  it('rejects a line-drill without Side', () => {
    expect(messages(game({ ...ok, Step: 'line-drill' }, '1. e4 e5 *'))).toEqual([
      expect.stringMatching(/Side/),
    ]);
  });

  it('rejects a duplicate lesson id inside a chapter and across chapters', () => {
    const a = game({ ...ok, Lesson: 'a' }) + game({ ...ok, Lesson: 'b', LessonTitle: 'B' }) + game({ ...ok, Lesson: 'a' });
    const m = messages(a);
    expect(m).toEqual([expect.stringMatching(/Duplicate lesson id "a"/)]);

    const meta = {
      title: 'T',
      kind: 'skills',
      level: 'beginner',
      description: 'd',
      tags: [],
      reviewed: false,
      chapters: [
        { file: '01.pgn', title: 'One' },
        { file: '02.pgn', title: 'Two' },
      ],
    };
    const course = parseCourse('t', meta, { '01.pgn': game(ok), '02.pgn': game(ok) });
    expect(course.issues.map((i) => i.message)).toEqual([expect.stringMatching(/earlier chapter/)]);
    expect(course.issues[0]?.file).toBe('02.pgn');
  });

  it('keeps valid games and reports the bad one', () => {
    const text = game(ok, '1. e4 *') + game(ok, '1. e5 *');
    const result = parseChapter('c.pgn', text);
    expect(result.chapter.lessons[0]?.steps).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.game).toBe(2);
  });
});

describe('course.json validation', () => {
  const good = {
    title: 'T',
    kind: 'opening',
    level: 'beginner',
    description: 'd',
    tags: ['x'],
    reviewed: false,
    side: 'white',
    chapters: [{ file: '01.pgn', title: 'One' }],
  };
  const text = game({ Lesson: 'l', LessonTitle: 'L', Step: 'explain' });

  it('builds a course with chapter titles from course.json', () => {
    const { course, issues } = parseCourse('my-course', good, { '01.pgn': text });
    expect(issues).toEqual([]);
    expect(course?.slug).toBe('my-course');
    expect(course?.side).toBe('white');
    expect(course?.chapterList[0]).toMatchObject({ id: '01', title: 'One' });
  });

  it('collects every problem in a bad course.json without throwing', () => {
    const bad = { title: '', kind: 'nope', level: 'expert', reviewed: 'no', chapters: [{ file: 'x.txt' }] };
    const { course, issues } = parseCourse('t', bad, {});
    expect(course).toBeUndefined();
    expect(issues.length).toBeGreaterThanOrEqual(5);
    expect(issues.every((i) => i.file === 'course.json')).toBe(true);
    expect(parseCourse('t', null, {}).issues).toHaveLength(1);
    expect(parseCourse('t', [], {}).course).toBeUndefined();
  });

  it('requires reviewed to be a boolean', () => {
    const { issues } = parseCourse('t', { ...good, reviewed: 'false' }, { '01.pgn': text });
    expect(issues.map((i) => i.message)).toEqual([expect.stringMatching(/reviewed/)]);
  });

  it('reports a missing chapter file', () => {
    const { course, issues } = parseCourse('t', good, {});
    expect(course?.chapterList).toEqual([]);
    expect(issues).toEqual([{ file: '01.pgn', message: expect.stringMatching(/not found/) }]);
  });
});
