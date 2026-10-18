import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { parsePgnGames } from '../src/lib/content/pgn';
import { parseChapter, parseCourse } from '../src/lib/content/parse';

// The coach guide is the spec. Every example in it must be accepted by the real parser.
const doc = readFileSync('docs/AUTHORING.md', 'utf8').replace(/\r\n/g, '\n');

interface Block {
  lang: string;
  body: string;
  /** Nearest heading above the block. */
  heading: string;
  line: number;
}

function codeBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split('\n');
  let heading = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (/^#{1,6} /.test(line)) heading = line.replace(/^#+\s*/, '');
    const open = /^```(\w*)\s*$/.exec(line);
    if (!open) continue;
    const start = i + 1;
    let j = start;
    while (j < lines.length && !/^```\s*$/.test(lines[j] as string)) j++;
    blocks.push({ lang: open[1] ?? '', body: lines.slice(start, j).join('\n'), heading, line: start });
    i = j;
  }
  return blocks;
}

/**
 * The strict "zero issues" test uses the block exactly as printed. Tests about what an example
 * demonstrates add the missing LessonTitle first so one doc mistake does not mask other checks.
 */
function titled(body: string): string {
  return /^\[LessonTitle\s/m.test(body) ? body : body.replace(/^(\[Lesson\s.*)$/m, '$1\n[LessonTitle "Title"]');
}

const blocks = codeBlocks(doc);
const pgnBlocks = blocks.filter((b) => /^\[Lesson\s/m.test(b.body));
const jsonBlocks = blocks.filter((b) => b.lang === 'json');

describe('docs/AUTHORING.md extraction', () => {
  it('finds the example blocks (guards against the regexes silently matching nothing)', () => {
    expect(pgnBlocks.length).toBeGreaterThanOrEqual(6);
    expect(jsonBlocks.length).toBeGreaterThanOrEqual(1);
  });
});

describe('docs/AUTHORING.md PGN examples', () => {
  it.each(pgnBlocks.map((b) => [`${b.heading} (line ${b.line})`, b] as const))(
    'parses with zero issues: %s',
    (_name, block) => {
      const { issues } = parseChapter('example.pgn', block.body);
      expect(issues.map((i) => i.message)).toEqual([]);
    },
  );

  it('every example produces at least one lesson with at least one step (once titled)', () => {
    for (const b of pgnBlocks) {
      const { chapter } = parseChapter('example.pgn', titled(b.body));
      expect(chapter.lessons.length, `${b.heading} line ${b.line}`).toBeGreaterThan(0);
      expect(chapter.lessons[0]?.steps.length, `${b.heading} line ${b.line}`).toBeGreaterThan(0);
    }
  });

  it('the step type shown under each step-type heading is that step type', () => {
    for (const type of ['explain', 'find-move', 'line-drill', 'quiz']) {
      const block = pgnBlocks.find((b) => b.heading === type);
      expect(block, `section ${type}`).toBeDefined();
      const { chapter } = parseChapter('example.pgn', titled((block as Block).body));
      expect(chapter.lessons[0]?.steps[0]?.type).toBe(type);
    }
  });

  it('the lesson-building example forms one two-step lesson', () => {
    const block = pgnBlocks.find((b) => b.heading.includes('Putting a lesson together'));
    expect(block).toBeDefined();
    const { chapter } = parseChapter('example.pgn', titled((block as Block).body));
    expect(chapter.lessons).toHaveLength(1);
    expect(chapter.lessons[0]?.steps.map((s) => s.type)).toEqual(['explain', 'quiz']);
  });

  it('the comment example draws the arrow and square it claims to draw', () => {
    const block = blocks.find((b) => b.body.includes('[%cal Gf3e5]'));
    expect(block).toBeDefined();
    const text = `[Lesson "x"]\n[LessonTitle "X"]\n[Step "explain"]\n\n${(block as Block).body}\n`;
    const { chapter, issues } = parseChapter('example.pgn', text);
    expect(issues).toEqual([]);
    expect(chapter.lessons[0]?.steps[0]?.introArrows).toEqual([{ color: 'G', from: 'f3', to: 'e5' }]);
    expect(chapter.lessons[0]?.steps[0]?.introHighlights).toEqual([{ color: 'R', square: 'e5' }]);
  });

  it('the find-move example really is mate (the doc says "Checkmate.")', () => {
    const block = pgnBlocks.find((b) => b.heading === 'find-move') as Block;
    const { chapter } = parseChapter('example.pgn', titled(block.body));
    const step = chapter.lessons[0]?.steps[0];
    expect(new Chess(step?.moves[0]?.fen).isCheckmate()).toBe(true);
  });

  it('the quiz example answer matches its explanation (after 1. e4 it is Black to move)', () => {
    const block = pgnBlocks.find((b) => b.heading === 'quiz') as Block;
    const { chapter } = parseChapter('example.pgn', titled(block.body));
    const step = chapter.lessons[0]?.steps[0];
    expect(step?.type).toBe('quiz');
    if (step?.type !== 'quiz') return;
    expect(step.choices[step.answer]).toBe('Black');
    expect(new Chess(step.moves[0]?.fen).turn()).toBe('b');
  });
});

describe('docs/AUTHORING.md course.json example', () => {
  it('is accepted by the course parser', () => {
    const meta = JSON.parse((jsonBlocks[0] as Block).body) as { chapters: { file: string }[] };
    const chapterText = '[Lesson "l"]\n[LessonTitle "L"]\n[Step "explain"]\n\n*\n';
    const texts = Object.fromEntries(meta.chapters.map((c) => [c.file, chapterText.replace('"l"', `"l-${c.file.replace(/\W/g, '')}"`)]));
    const { course, issues } = parseCourse('my-first-course', meta, texts);
    expect(issues).toEqual([]);
    expect(course?.reviewed).toBe(false);
  });

  it('keeps the documented reviewed rule: the example ships with false', () => {
    const meta = JSON.parse((jsonBlocks[0] as Block).body) as { reviewed: unknown };
    expect(meta.reviewed).toBe(false);
  });

  it('documents every field the parser knows', () => {
    for (const field of ['title', 'kind', 'level', 'description', 'tags', 'reviewed', 'side', 'chapters']) {
      expect(doc, field).toContain(`\`${field}\``);
    }
    for (const level of ['beginner', 'intermediate', 'mid-advanced', 'advanced', 'master']) {
      expect(doc, level).toContain(level);
    }
  });
});

describe('docs/AUTHORING.md tag table', () => {
  // Inline examples such as `[Hint "Use your knight."]`; the table escapes bars as "\|".
  const inline = [...doc.matchAll(/`(\[[A-Za-z]+ "[^`]*"\])`/g)].map((m) => (m[1] as string).replace(/\\\|/g, '|'));

  it('finds the inline tag examples', () => {
    expect(inline.length).toBeGreaterThanOrEqual(10);
  });

  it('every inline tag example is a well-formed header', () => {
    for (const tag of inline) {
      const [g] = parsePgnGames(`${tag}\n\n*`);
      expect(g?.errors, tag).toEqual([]);
      expect(Object.keys(g?.tags ?? {}), tag).toHaveLength(1);
    }
  });

  it('the example FEN is a valid position', () => {
    const fens = inline.filter((t) => t.startsWith('[FEN '));
    expect(fens.length).toBeGreaterThan(0);
    for (const tag of fens) {
      const fen = /"([^"]*)"/.exec(tag)?.[1] ?? '';
      expect(() => new Chess(fen), fen).not.toThrow();
    }
  });

  it('every tag the parser reads is documented in the table', () => {
    for (const tag of [
      'Lesson',
      'LessonTitle',
      'Step',
      'FEN',
      'Side',
      'Hint',
      'TeacherNotes',
      'Mistakes',
      'ClassQuestions',
      'Question',
      'Choices',
      'Answer',
      'Explanation',
    ]) {
      expect(doc, tag).toContain(`| \`${tag}\``);
    }
  });
});

describe('docs/AUTHORING.md claims about behavior', () => {
  const ok = '[Lesson "l"]\n[LessonTitle "L"]\n[Step "explain"]\n\n';
  const issues = (text: string): string[] => parseChapter('c.pgn', text).issues.map((i) => i.message);

  it('"Marks such as ! and ? and numeric codes such as $1 are accepted and ignored"', () => {
    expect(issues(`${ok}1. e4! e5? 2. Nf3!! Nc6?? 3. Bb5!? a6?! $1 $14 *`)).toEqual([]);
  });

  it('"Black moves after a move number may be written 2... Nc6"', () => {
    expect(issues(`${ok}1. e4 e5 2. Nf3 2... Nc6 *`)).toEqual([]);
  });

  it('"The game ends with a result: *, 1-0, 0-1 or 1/2-1/2"', () => {
    for (const r of ['*', '1-0', '0-1', '1/2-1/2']) expect(issues(`${ok}1. e4 ${r}`), r).toEqual([]);
  });

  it('"To put a quote mark inside a value write \\", and for a backslash write \\\\"', () => {
    const text = '[Lesson "l"]\n[LessonTitle "L"]\n[Step "explain"]\n[Hint "say \\"hi\\" \\\\ ok"]\n\n1. e4 *';
    const step = parseChapter('c.pgn', text).chapter.lessons[0]?.steps[0];
    expect(step?.hints).toEqual(['say "hi" \\ ok']);
  });

  it('"Other tags (such as Event or Site) are allowed and ignored"', () => {
    expect(issues(`[Event "x"]\n[Site "y"]\n${ok}1. e4 *`)).toEqual([]);
  });

  it('"TeacherNotes, Mistakes and ClassQuestions can be on any game of a lesson"', () => {
    const text =
      `${ok}1. e4 *\n\n[Lesson "l"]\n[Step "explain"]\n[TeacherNotes "t"]\n[Mistakes "m"]\n[ClassQuestions "c"]\n\n1. d4 *\n`;
    const { chapter, issues: found } = parseChapter('c.pgn', text);
    expect(found).toEqual([]);
    expect(chapter.lessons[0]?.teacherNotes).toEqual({ points: ['t'], mistakes: ['m'], questions: ['c'] });
  });

  it('"A quiz asks about the position at the end of the moves (or the start if no moves)"', () => {
    const quiz = '[Lesson "q"]\n[LessonTitle "Q"]\n[Step "quiz"]\n[Question "q"]\n[Choices "a | b"]\n[Answer "1"]\n\n';
    expect(issues(`${quiz}*`)).toEqual([]);
    expect(issues(`${quiz}1. e4 *`)).toEqual([]);
  });

  it('the "Common errors" table quotes messages the code really produces', () => {
    const produced: Record<string, string[]> = {
      'Illegal or unreadable move': issues(`${ok}1. e5 *`),
      'Invalid FEN': issues(`[Lesson "l"]\n[LessonTitle "L"]\n[Step "explain"]\n[FEN "x"]\n\n*`),
      'Variations ( ... ) are not supported': issues(`${ok}1. e4 (1. d4) *`),
      'Missing [Lesson] tag': issues('[Step "explain"]\n\n*'),
      'Missing [LessonTitle] on the first game of the lesson': issues('[Lesson "l"]\n[Step "explain"]\n\n*'),
      'Unknown [Step': issues('[Lesson "l"]\n[LessonTitle "L"]\n[Step "x"]\n\n*'),
      'find-move needs at least one [Hint]': issues('[Lesson "l"]\n[LessonTitle "L"]\n[Step "find-move"]\n\n1. e4 *'),
      "find-move must end on the solver's move": issues(
        '[Lesson "l"]\n[LessonTitle "L"]\n[Step "find-move"]\n[Hint "h"]\n\n1. e4 e5 *',
      ),
      'line-drill needs a [Side] tag': issues('[Lesson "l"]\n[LessonTitle "L"]\n[Step "line-drill"]\n\n1. e4 e5 *'),
      'is out of range': issues(
        '[Lesson "l"]\n[LessonTitle "L"]\n[Step "quiz"]\n[Question "q"]\n[Choices "a | b"]\n[Answer "4"]\n\n*',
      ),
      'quiz needs [Choices': issues('[Lesson "l"]\n[LessonTitle "L"]\n[Step "quiz"]\n[Question "q"]\n[Answer "1"]\n\n*'),
      'Duplicate lesson id': issues(
        `${ok}*\n\n[Lesson "m"]\n[LessonTitle "M"]\n[Step "explain"]\n\n*\n\n[Lesson "l"]\n[Step "explain"]\n\n*\n`,
      ),
    };
    const section = doc.slice(doc.indexOf('## 7. Common errors'));
    for (const [message, found] of Object.entries(produced)) {
      expect(found.some((m) => m.includes(message)), `parser should emit "${message}"`).toBe(true);
      // The doc quotes it, allowing for the doc's own placeholder text such as "..." or a concrete move.
      const stable = message.replace(/ \( \.\.\. \)/, ' ( ... )');
      expect(section, `doc should mention "${stable}"`).toContain(stable.split(' [Step')[0] as string);
    }
  });

  it('the commands named in the doc exist in package.json', () => {
    const scripts = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts;
    const named = [...doc.matchAll(/^npm run ([\w:-]+)\s*$/gm)].map((m) => m[1] as string);
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) expect(scripts[name], `npm run ${name}`).toBeDefined();
  });
});
