import { describe, expect, it } from 'vitest';
import { extractAnnotations, parsePgnGames } from '../src/lib/content/pgn';
import { parseChapter } from '../src/lib/content/parse';
import type { FindMoveStep, QuizStep } from '../src/lib/content/types';

function game(tags: Record<string, string | string[]>, movetext = ''): string {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(tags)) {
    for (const v of Array.isArray(value) ? value : [value]) lines.push(`[${name} "${v}"]`);
  }
  return `${lines.join('\n')}\n\n${movetext}\n`;
}

const ok = { Lesson: 'l', LessonTitle: 'L', Step: 'explain' };
const messages = (text: string): string[] => parseChapter('c.pgn', text).issues.map((i) => i.message);

describe('line endings and BOM', () => {
  const sample =
    game({ ...ok, TeacherNotes: 'a | b' }, '{Intro [%cal Ge2e4]} 1. e4 {Center.} e5 *') +
    '\n' +
    game({ Lesson: 'm', LessonTitle: 'M', Step: 'quiz', Question: 'q', Choices: 'a | b', Answer: '2' }, '1. d4 *');

  it('parses CRLF text identically to LF text', () => {
    const lf = parseChapter('c.pgn', sample);
    const crlf = parseChapter('c.pgn', sample.replace(/\n/g, '\r\n'));
    expect(lf.issues).toEqual([]);
    expect(crlf.issues).toEqual([]);
    expect(crlf.chapter).toEqual(lf.chapter);
  });

  it('parses old-Mac CR-only text identically', () => {
    const lf = parseChapter('c.pgn', sample);
    expect(parseChapter('c.pgn', sample.replace(/\n/g, '\r')).chapter).toEqual(lf.chapter);
  });

  it('does not leave a stray CR in tag values or comments', () => {
    const text =
      '[Lesson "l"]\r\n[LessonTitle "L"]\r\n[Step "explain"]\r\n[Hint "h"]\r\n\r\n{Intro}\r\n1. e4 ; rest of line\r\n e5 *\r\n';
    const [g] = parsePgnGames(text);
    expect(g?.tags['Hint']).toEqual(['h']);
    expect(g?.tokens.some((t) => t.kind === 'comment' && t.text.includes('\r'))).toBe(false);
    const step = parseChapter('c.pgn', text).chapter.lessons[0]?.steps[0];
    expect(step?.hints).toEqual(['h']);
    expect(step?.moves.map((m) => m.san)).toEqual(['e4', 'e5']);
    expect(step?.moves[0]?.comment).toBe('rest of line');
  });

  it('ignores a UTF-8 BOM at the start of the file', () => {
    const lf = parseChapter('c.pgn', sample);
    const bom = parseChapter('c.pgn', `\uFEFF${sample}`);
    expect(bom.issues).toEqual([]);
    expect(bom.chapter).toEqual(lf.chapter);
    const [g] = parsePgnGames('﻿[Lesson "l"]\n\n*');
    expect(Object.keys(g?.tags ?? {})).toEqual(['Lesson']);
  });

  it('handles BOM and CRLF together', () => {
    const lf = parseChapter('c.pgn', sample);
    const both = parseChapter('c.pgn', `\uFEFF${sample.replace(/\n/g, '\r\n')}`);
    expect(both.issues).toEqual([]);
    expect(both.chapter).toEqual(lf.chapter);
  });

  it('reports an empty or whitespace-only file instead of throwing', () => {
    expect(messages('')).toEqual(['No games found in this file']);
    expect(messages('  \r\n\r\n')).toEqual(['No games found in this file']);
    expect(messages('﻿')).toEqual(['No games found in this file']);
  });
});

describe('comment edge cases', () => {
  it('ends a comment at the first closing brace (PGN has no escape for it) and reports the leftover', () => {
    // "{a \} b}" is the comment "a \" followed by the text "b}". That must surface as an error, not vanish.
    const m = messages(game(ok, '1. e4 {a \\} b} *'));
    expect(m.length).toBeGreaterThan(0);
    expect(m.join(' ')).toMatch(/Illegal|Unmatched/);
  });

  it('keeps brace-looking characters inside a semicolon comment', () => {
    const [g] = parsePgnGames('1. e4 ; has { and ( inside\ne5 *');
    expect(g?.tokens.map((t) => t.kind)).toEqual(['move', 'comment', 'move', 'result']);
  });

  it('does not treat ( ) ; or [ inside braces as syntax', () => {
    const text = game(ok, '1. e4 {a (b); [c] "d" [%not-closed} e5 *');
    const { chapter, issues } = parseChapter('c.pgn', text);
    expect(issues).toEqual([]);
    expect(chapter.lessons[0]?.steps[0]?.moves).toHaveLength(2);
  });

  it('keeps bracketed text that is not a [%command]', () => {
    const a = extractAnnotations('The [a-file] is open, see [1] and [%cal Ge2e4] too');
    expect(a.text).toBe('The [a-file] is open, see [1] and too');
    expect(a.arrows).toHaveLength(1);
    expect(a.invalid).toEqual([]);
    const text = game(ok, '{[Plan] Develop [fast]} 1. e4 {Control [d5].} *');
    const step = parseChapter('c.pgn', text).chapter.lessons[0]?.steps[0];
    expect(step?.intro).toBe('[Plan] Develop [fast]');
    expect(step?.moves[0]?.comment).toBe('Control [d5].');
  });

  it('a comment that looks like a header tag does not start a new game', () => {
    const text = game(ok, '1. e4 {\n\n[Lesson "other"]\n\n} e5 *');
    expect(parsePgnGames(text)).toHaveLength(1);
    expect(messages(text)).toEqual([]);
  });

  it('strips unknown [%...] commands such as [%clk] and [%eval] from the text', () => {
    const a = extractAnnotations('Good [%eval 0.3] move [%clk 0:00:10]');
    expect(a.text).toBe('Good move');
    expect(a.invalid).toEqual([]);
  });

  it('reports an unreadable arrow or square but keeps the valid ones', () => {
    const a = extractAnnotations('[%cal Ge2e4,Zz9z9,Gd1] [%csl Ge4,Rz9,e5]');
    expect(a.arrows).toEqual([{ color: 'G', from: 'e2', to: 'e4' }]);
    expect(a.highlights).toEqual([{ color: 'G', square: 'e4' }]);
    expect(a.invalid).toEqual(['[%cal Zz9z9]', '[%cal Gd1]', '[%csl Rz9]', '[%csl e5]']);
    const m = messages(game(ok, '1. e4 {[%cal Zz9z9]} *'));
    expect(m).toEqual([expect.stringMatching(/Unreadable annotation/)]);
  });

  it('accepts all four colors; lower-case colors are invalid', () => {
    const a = extractAnnotations('[%cal Ge2e4,Rd1h5,Yb1c3,Bg1f3] [%csl Ga1,Rb2,Yc3,Bd4]');
    expect(a.arrows.map((x) => x.color)).toEqual(['G', 'R', 'Y', 'B']);
    expect(a.highlights.map((x) => x.color)).toEqual(['G', 'R', 'Y', 'B']);
    expect(extractAnnotations('[%cal ge2e4]').invalid).toHaveLength(1);
  });

  it('an unterminated comment is an error, not a silent drop', () => {
    expect(messages(game(ok, '1. e4 {never closed'))).toEqual([expect.stringMatching(/Unterminated/)]);
  });

  it('a stray closing brace or parenthesis is an error', () => {
    expect(messages(game(ok, '1. e4 } e5 *'))).toEqual([expect.stringMatching(/Unmatched/)]);
    expect(messages(game(ok, '1. e4 ) e5 *'))).toEqual([expect.stringMatching(/Unmatched/)]);
  });

  it('a variation containing a brace comment with a paren is skipped as one variation', () => {
    const m = messages(game(ok, '1. e4 (1. d4 {a ) b} d5) e5 *'));
    expect(m).toEqual([expect.stringMatching(/Variations/)]);
  });

  it('two comments before the first move join into the intro', () => {
    const step = parseChapter('c.pgn', game(ok, '{One} {Two} 1. e4 *')).chapter.lessons[0]?.steps[0];
    expect(step?.intro).toBe('One Two');
    expect(step?.moves[0]?.comment).toBeUndefined();
  });
});

describe('move formats', () => {
  const PROMO = '7k/P7/8/8/8/8/8/K7 w - - 0 1';

  it('keeps promotion SAN with check and a lower-case q in the uci', () => {
    const step = parseChapter('c.pgn', game({ ...ok, FEN: PROMO }, '1. a8=Q+ *')).chapter.lessons[0]?.steps[0];
    expect(step?.moves[0]).toMatchObject({ san: 'a8=Q+', uci: 'a7a8q' });
    expect(step?.moves[0]?.uci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]$/);
  });

  it('writes under-promotions and capture promotions in uci', () => {
    const fen = 'r6k/1P6/8/8/8/8/8/6K1 w - - 0 1';
    const knight = parseChapter('c.pgn', game({ ...ok, FEN: fen }, '1. b8=N *')).chapter.lessons[0]?.steps[0];
    expect(knight?.moves[0]?.uci).toBe('b7b8n');
    const capture = parseChapter('c.pgn', game({ ...ok, FEN: fen }, '1. bxa8=R+ *')).chapter.lessons[0]?.steps[0];
    expect(capture?.moves[0]).toMatchObject({ san: 'bxa8=R+', uci: 'b7a8r' });
  });

  it('writes black promotion in lower case too', () => {
    const s = parseChapter('c.pgn', game({ ...ok, FEN: '7k/8/8/8/8/8/p7/6K1 b - - 0 1' }, '1... a1=N *')).chapter
      .lessons[0]?.steps[0];
    expect(s?.moves[0]?.uci).toBe('a2a1n');
  });

  it('accepts a promotion written with trailing annotation glyphs', () => {
    const step = parseChapter('c.pgn', game({ ...ok, FEN: PROMO }, '1. a8=Q+!! *')).chapter.lessons[0]?.steps[0];
    expect(step?.moves[0]?.san).toBe('a8=Q+');
  });

  it('rejects a pawn move to the last rank without a promotion piece', () => {
    expect(messages(game({ ...ok, FEN: PROMO }, '1. a8 *'))).toEqual([expect.stringMatching(/Illegal/)]);
  });

  it('writes castling as the king move in uci', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const step = parseChapter('c.pgn', game({ ...ok, FEN: fen }, '1. O-O O-O-O *')).chapter.lessons[0]
      ?.steps[0];
    expect(step?.moves.map((m) => [m.san, m.uci])).toEqual([
      ['O-O', 'e1g1'],
      ['O-O-O', 'e8c8'],
    ]);
    const queenside = parseChapter('c.pgn', game({ ...ok, FEN: fen }, '1. O-O-O O-O *')).chapter.lessons[0]?.steps[0];
    expect(queenside?.moves.map((m) => m.uci)).toEqual(['e1c1', 'e8g8']);
  });

  it('rejects castling when the right was lost or the path is attacked', () => {
    const noRights = 'r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1';
    expect(messages(game({ ...ok, FEN: noRights }, '1. O-O *'))).toEqual([expect.stringMatching(/Illegal/)]);
    const attacked = 'r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1';
    expect(messages(game({ ...ok, FEN: attacked }, '1. O-O *'))).toEqual([expect.stringMatching(/Illegal/)]);
  });

  it('records en passant and the resulting fen', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3';
    const step = parseChapter('c.pgn', game({ ...ok, FEN: fen }, '3... dxe3 *')).chapter.lessons[0]?.steps[0];
    expect(step?.moves[0]).toMatchObject({ san: 'dxe3', uci: 'd4e3' });
    expect(step?.moves[0]?.fen.split(' ')[0]).toBe('rnbqkbnr/ppp1pppp/8/8/8/4p3/PPPP1PPP/RNBQKBNR');
  });

  it('accepts moves written without a space after the move number', () => {
    expect(parseChapter('c.pgn', game(ok, '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 *')).issues).toEqual([]);
    expect(parseChapter('c.pgn', game(ok, '1.e4 e5 2.Nf3 Nc6 3.Bb5 3...a6 *')).issues).toEqual([]);
  });

  it('stops replaying after the first illegal move and reports it once', () => {
    const m = messages(game(ok, '1. e4 e5 2. Ke3 Qh4 3. Zz9 Nc6 *'));
    expect(m).toEqual([expect.stringMatching(/Illegal or unreadable move "Ke3" after 2 move\(s\)/)]);
  });

  it('a movetext of only a result token is fine for explain', () => {
    for (const r of ['*', '1-0', '0-1', '1/2-1/2']) expect(messages(game(ok, r)), r).toEqual([]);
  });
});

describe('step rules', () => {
  const MATE_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  const BLACK_FEN = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';

  it('find-move derives black as the solver from a black-to-move FEN', () => {
    const step = parseChapter('c.pgn', game({ ...ok, Step: 'find-move', Hint: 'h', FEN: BLACK_FEN }, '2... Nf6 *'))
      .chapter.lessons[0]?.steps[0] as FindMoveStep;
    expect(step.side).toBe('black');
  });

  it('find-move accepts a [Side] that agrees with the FEN', () => {
    const black = { ...ok, Step: 'find-move', Hint: 'h', FEN: BLACK_FEN, Side: 'black' };
    expect(messages(game(black, '2... Nf6 *'))).toEqual([]);
    const white = { ...ok, Step: 'find-move', Hint: 'h', FEN: MATE_FEN, Side: 'white' };
    expect(messages(game(white, '4. Qxf7# *'))).toEqual([]);
  });

  it('find-move rejects a [Side] that contradicts a black-to-move FEN', () => {
    const m = messages(game({ ...ok, Step: 'find-move', Hint: 'h', FEN: BLACK_FEN, Side: 'white' }, '2... Nf6 *'));
    expect(m).toEqual([expect.stringMatching(/does not match the side to move/)]);
  });

  it('find-move rejects an invalid [Side] value', () => {
    const m = messages(game({ ...ok, Step: 'find-move', Hint: 'h', Side: 'both' }, '1. e4 *'));
    expect(m).toEqual([expect.stringMatching(/Invalid \[Side/)]);
  });

  it('find-move with 3 moves is accepted, 0 moves is not', () => {
    expect(messages(game({ ...ok, Step: 'find-move', Hint: 'h' }, '1. e4 e5 2. Nf3 *'))).toEqual([]);
    expect(messages(game({ ...ok, Step: 'find-move', Hint: 'h' }, '*'))).toEqual([
      expect.stringMatching(/at least 1 move/),
    ]);
  });

  it('find-move does not count blank hints', () => {
    expect(messages(game({ ...ok, Step: 'find-move', Hint: ['', '   '] }, '1. e4 *'))).toEqual([
      expect.stringMatching(/Hint/),
    ]);
  });

  it('line-drill needs 2 moves and a valid side', () => {
    expect(messages(game({ ...ok, Step: 'line-drill', Side: 'white' }, '1. e4 *'))).toEqual([
      expect.stringMatching(/at least 2 moves/),
    ]);
    const bad = messages(game({ ...ok, Step: 'line-drill', Side: 'green' }, '1. e4 e5 *'));
    expect(bad.some((x) => /Invalid \[Side/.test(x))).toBe(true);
  });

  it('quiz with moves keeps them and the answer is 0-based', () => {
    const text = game(
      { ...ok, Step: 'quiz', Question: 'Who moves?', Choices: 'White | Black', Answer: '2', Explanation: 'Black.' },
      '1. e4 {Played.} *',
    );
    const { chapter, issues } = parseChapter('c.pgn', text);
    expect(issues).toEqual([]);
    const step = chapter.lessons[0]?.steps[0] as QuizStep;
    expect(step.moves.map((m) => m.san)).toEqual(['e4']);
    expect(step.moves[0]?.comment).toBe('Played.');
    expect(step.answer).toBe(1);
    expect(step.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  it('quiz with an illegal move is rejected', () => {
    const base = { ...ok, Step: 'quiz', Question: 'q', Choices: 'a | b', Answer: '1' };
    expect(messages(game(base, '1. e5 *'))).toEqual([expect.stringMatching(/Illegal/)]);
  });

  it('quiz rejects non-numeric, fractional and negative answers, one choice and a blank question', () => {
    const base = { ...ok, Step: 'quiz', Question: 'q', Choices: 'a | b' };
    for (const a of ['x', '1.5', '-1', '']) {
      expect(messages(game({ ...base, Answer: a })), `Answer=${a}`).toHaveLength(1);
    }
    expect(messages(game({ ...base, Choices: 'only', Answer: '1' }))).toEqual([
      expect.stringMatching(/at least 2 choices/),
    ]);
    expect(messages(game({ ...base, Question: '   ', Answer: '1' }))).toEqual([expect.stringMatching(/Question/)]);
  });

  it('quiz choices are trimmed and empty entries dropped', () => {
    const text = game({ ...ok, Step: 'quiz', Question: 'q', Choices: ' a |  | b |  c ', Answer: '3' });
    const step = parseChapter('c.pgn', text).chapter.lessons[0]?.steps[0] as QuizStep;
    expect(step.choices).toEqual(['a', 'b', 'c']);
  });

  it('a quiz on a custom FEN keeps that fen', () => {
    const text = game({ ...ok, Step: 'quiz', Question: 'q', Choices: 'a | b', Answer: '1', FEN: BLACK_FEN });
    expect(parseChapter('c.pgn', text).chapter.lessons[0]?.steps[0]?.fen).toBe(BLACK_FEN);
  });

  it('rejects a FEN with no kings without throwing', () => {
    expect(messages(game({ ...ok, FEN: '8/8/8/8/8/8/8/8 w - - 0 1' }))).toEqual([
      expect.stringMatching(/Invalid FEN/),
    ]);
  });
});

describe('many lessons in one file', () => {
  it('builds 60 lessons of 2 steps each, in order, with stable step ids', () => {
    let text = '';
    for (let i = 0; i < 60; i++) {
      text += game({ Lesson: `lesson-${i}`, LessonTitle: `Lesson ${i}`, Step: 'explain' }, '1. e4 *');
      text += '\n' + game({ Lesson: `lesson-${i}`, Step: 'explain' }, '1. d4 *') + '\n';
    }
    const { chapter, issues } = parseChapter('big.pgn', text);
    expect(issues).toEqual([]);
    expect(chapter.lessons).toHaveLength(60);
    expect(chapter.lessons.map((l) => l.id)).toEqual(Array.from({ length: 60 }, (_, i) => `lesson-${i}`));
    expect(chapter.lessons.every((l) => l.steps.length === 2)).toBe(true);
    expect(chapter.lessons[59]?.steps[1]?.id).toBe('big/lesson-59/1');
  });

  it('reports issue game numbers relative to the file, not the lesson', () => {
    const text =
      game({ Lesson: 'a', LessonTitle: 'A', Step: 'explain' }, '1. e4 *') +
      game({ Lesson: 'b', LessonTitle: 'B', Step: 'explain' }, '1. e4 *') +
      game({ Lesson: 'b', Step: 'explain' }, '1. e5 *');
    const { issues } = parseChapter('c.pgn', text);
    expect(issues).toEqual([{ file: 'c.pgn', game: 3, message: expect.stringMatching(/Illegal/) }]);
  });

  it('a lesson id reused non-contiguously is reported on the later game; earlier steps survive', () => {
    const text =
      game({ Lesson: 'a', LessonTitle: 'A', Step: 'explain' }, '1. e4 *') +
      game({ Lesson: 'b', LessonTitle: 'B', Step: 'explain' }, '1. d4 *') +
      game({ Lesson: 'a', Step: 'explain' }, '1. c4 *');
    const { chapter, issues } = parseChapter('c.pgn', text);
    expect(issues).toEqual([
      { file: 'c.pgn', game: 3, message: expect.stringMatching(/Duplicate lesson id "a".*consecutive/) },
    ]);
    expect(chapter.lessons.map((l) => [l.id, l.steps.length])).toEqual([
      ['a', 1],
      ['b', 1],
    ]);
  });

  it('a third and fourth appearance of the same id are each reported, never merged', () => {
    const g = (id: string): string => game({ Lesson: id, LessonTitle: id.toUpperCase(), Step: 'explain' }, '*');
    const { chapter, issues } = parseChapter('c.pgn', g('a') + g('b') + g('a') + g('a'));
    expect(issues.map((i) => i.game)).toEqual([3, 4]);
    expect(chapter.lessons.map((l) => l.id)).toEqual(['a', 'b']);
    expect(chapter.lessons[0]?.steps).toHaveLength(1);
  });

  it('a game with no [Lesson] tag between two games of one lesson is reported, and so is the split', () => {
    const text =
      game({ Lesson: 'a', LessonTitle: 'A', Step: 'explain' }, '1. e4 *') +
      game({ LessonTitle: 'X', Step: 'explain' }, '1. e4 *') +
      game({ Lesson: 'a', Step: 'explain' }, '1. d4 *');
    const m = messages(text);
    expect(m.some((x) => /Missing \[Lesson\]/.test(x))).toBe(true);
    expect(m.some((x) => /Duplicate lesson id "a"/.test(x))).toBe(true);
  });

  it('rejects non-kebab lesson ids and accepts kebab ones', () => {
    for (const id of ['Upper', 'has space', 'under_score', '-lead', 'trail-', 'dou--ble', 'é']) {
      expect(messages(game({ ...ok, Lesson: id })), id).toEqual([expect.stringMatching(/must be lowercase words/)]);
    }
    for (const id of ['a', 'a-b-c', '1', '2-bishops', 'e4-e5']) {
      expect(messages(game({ ...ok, Lesson: id })), id).toEqual([]);
    }
  });

  it('requires a LessonTitle only on the first game of a lesson', () => {
    const missingFirst =
      game({ Lesson: 'a', Step: 'explain' }, '1. e4 *') + game({ Lesson: 'a', Step: 'explain' }, '1. d4 *');
    expect(messages(missingFirst)).toEqual([expect.stringMatching(/Missing \[LessonTitle\]/)]);
    const blankTitle = game({ Lesson: 'a', LessonTitle: '   ', Step: 'explain' }, '*');
    expect(messages(blankTitle)).toEqual([expect.stringMatching(/Missing \[LessonTitle\]/)]);
  });

  it('a lesson whose only game is invalid yields no lesson at all', () => {
    const { chapter, issues } = parseChapter('c.pgn', game({ ...ok, Step: 'nope' }));
    expect(chapter.lessons).toEqual([]);
    expect(issues).toHaveLength(1);
  });
});

describe('tag syntax', () => {
  it('splits games on a blank line even when the previous game has no movetext', () => {
    const games = parsePgnGames('[Lesson "a"]\n[Step "explain"]\n\n[Lesson "b"]\n[Step "explain"]\n');
    expect(games).toHaveLength(2);
  });

  it('ignores unknown tags and keeps brackets inside tag values', () => {
    const text = game({ ...ok, Event: 'x', Site: 'y', Hint: 'Play [e4] now' }, '1. e4 *');
    const step = parseChapter('c.pgn', text).chapter.lessons[0]?.steps[0];
    expect(step?.hints).toEqual(['Play [e4] now']);
  });

  it('keeps non-latin text (Arabic) in tags and comments', () => {
    const text = game({ ...ok, LessonTitle: 'الحصان', Hint: 'استخدم الحصان' }, '{ابدأ هنا} 1. e4 *');
    const { chapter, issues } = parseChapter('c.pgn', text);
    expect(issues).toEqual([]);
    expect(chapter.lessons[0]?.title).toBe('الحصان');
    expect(chapter.lessons[0]?.steps[0]?.intro).toBe('ابدأ هنا');
  });

  it('a percent line is ignored only at the start of a line', () => {
    const [g] = parsePgnGames('[A "1"]\n\n% comment line\n1. e4 *');
    expect(g?.tokens.map((t) => t.kind)).toEqual(['move', 'result']);
  });
});
