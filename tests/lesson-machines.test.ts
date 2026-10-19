import { readdirSync, readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Course, FindMoveStep, LineDrillStep, QuizStep, StepMove } from '../src/lib/content/types';
import { evaluateFindMove } from '../src/lib/lesson/findMove';
import { MAX_HINT_LEVEL, hintView, nextHintLevel, usedHint, type HintLevel } from '../src/lib/lesson/hints';
import { REVEAL_AFTER, applyAuto, attemptDrill, autoMove, isDrillDone, isStudentTurn, revealedMove, startDrill } from '../src/lib/lesson/lineDrill';
import { completedCount, findLesson, flatLessons, isListed, lessonKey, nextLessonAfter, nextUp } from '../src/lib/lesson/nav';
import { gradeQuiz, quizResult } from '../src/lib/lesson/quiz';
import { awardFor, isClean, lessonEarnsCredit } from '../src/lib/lesson/scoring';
import { XP_RULES } from '../src/lib/xp';

/** Builds the played moves of a step from SAN, the way the content parser stores them. */
function movesFrom(fen: string, sans: string[]): StepMove[] {
  const chess = new Chess(fen);
  return sans.map((san) => {
    const mv = chess.move(san);
    return { san: mv.san, uci: `${mv.from}${mv.to}${mv.promotion ?? ''}`, fen: chess.fen(), arrows: [], highlights: [] };
  });
}

function base(fen: string, sans: string[]) {
  return { id: 't', fen, introArrows: [], introHighlights: [], moves: movesFrom(fen, sans), hints: ['Use the rook.', 'Go to the back rank.'] };
}

const BACK_RANK = '6k1/5ppp/8/8/8/8/8/R3R1K1 w - - 0 1';
const WITH_PAWNS = '6k1/5ppp/8/8/8/8/5PPP/R3R1K1 w - - 0 1';

function findMove(fen: string, sans: string[]): FindMoveStep {
  return { ...base(fen, sans), type: 'find-move', side: fen.split(' ')[1] === 'b' ? 'black' : 'white' };
}

function drill(sans: string[], side: 'white' | 'black'): LineDrillStep {
  const start = new Chess().fen();
  return { ...base(start, sans), type: 'line-drill', side, hints: ['Pawn to the center.'] };
}

describe('find-move machine', () => {
  it('accepts the expected move', () => {
    const step = findMove(BACK_RANK, ['Re8#']);
    const out = evaluateFindMove(step, 0, 'e1e8');
    expect(out.status).toBe('complete');
    expect(out.alternativeMate).toBe(false);
  });

  it('accepts a different checkmate on the final solver move', () => {
    const step = findMove(BACK_RANK, ['Re8#']);
    const out = evaluateFindMove(step, 0, 'a1a8');
    expect(out.status).toBe('complete');
    expect(out.alternativeMate).toBe(true);
    expect(out.played?.checkmate).toBe(true);
  });

  it('rejects a legal move that is not mate, and illegal moves', () => {
    const step = findMove(BACK_RANK, ['Re8#']);
    expect(evaluateFindMove(step, 0, 'e1e2').status).toBe('wrong');
    const illegal = evaluateFindMove(step, 0, 'e1a5');
    expect(illegal.status).toBe('wrong');
    expect(illegal.played).toBeNull();
  });

  it('does not accept another mate when the expected move is not mate', () => {
    const step = findMove(BACK_RANK, ['Re7']);
    expect(evaluateFindMove(step, 0, 'a1a8').status).toBe('wrong');
  });

  it('plays the opponent reply and moves on to the next solver move', () => {
    const step = findMove(WITH_PAWNS, ['Re7', 'f6', 'Rae1']);
    const first = evaluateFindMove(step, 0, 'e1e7');
    expect(first.status).toBe('correct');
    expect(first.reply?.san).toBe('f6');
    expect(first.nextIndex).toBe(2);
    expect(evaluateFindMove(step, 2, 'a1e1').status).toBe('complete');
  });

  it('only accepts the alternate mate on the last solver move of a longer line', () => {
    const step = findMove(WITH_PAWNS, ['Re7', 'f6', 'Re8#']);
    expect(evaluateFindMove(step, 0, 'a1a7').status).toBe('wrong');
  });
});

describe('hint ladder', () => {
  it('goes piece, square, move and stops', () => {
    expect(nextHintLevel(0)).toBe(1);
    expect(nextHintLevel(1)).toBe(2);
    expect(nextHintLevel(2)).toBe(3);
    expect(nextHintLevel(3)).toBe(3);
    expect(MAX_HINT_LEVEL).toBe(3);
    expect(usedHint(0)).toBe(false);
    expect(usedHint(1)).toBe(true);
  });

  it('reveals the from-square, then the target, then the arrow', () => {
    const hints = ['Use the rook.', 'Go to the back rank.'];
    const v = (level: HintLevel) => hintView(hints, 'e1e8', level);
    expect(v(0)).toMatchObject({ highlights: [], arrows: [], texts: [] });
    expect(v(1)).toMatchObject({ highlights: [{ square: 'e1' }], arrows: [], texts: ['Use the rook.'] });
    expect(v(2).highlights.map((h) => h.square)).toEqual(['e1', 'e8']);
    expect(v(2).texts).toEqual(hints);
    expect(v(3).arrows).toEqual([{ from: 'e1', to: 'e8', color: 'G' }]);
  });
});

describe('line-drill machine', () => {
  it('auto-plays the opponent and finishes after the last move', () => {
    const step = drill(['e4', 'e5', 'Nf3', 'Nc6'], 'white');
    let st = startDrill();
    expect(autoMove(step, st)).toBeNull();
    let res = attemptDrill(step, st, 'e2e4');
    expect(res.status).toBe('correct');
    st = res.state;
    expect(autoMove(step, st)?.san).toBe('e5');
    st = applyAuto(st);
    expect(isStudentTurn(step, st)).toBe(true);
    res = attemptDrill(step, st, 'g1f3');
    st = res.state;
    expect(isDrillDone(step, st)).toBe(false);
    expect(autoMove(step, st)?.san).toBe('Nc6');
    st = applyAuto(st);
    expect(isDrillDone(step, st)).toBe(true);
    expect(st.mistakes).toBe(0);
  });

  it('reports complete when the student plays the last move', () => {
    const step = drill(['e4', 'e5', 'Nf3'], 'white');
    let st = attemptDrill(step, startDrill(), 'e2e4').state;
    st = applyAuto(st);
    expect(attemptDrill(step, st, 'g1f3').status).toBe('complete');
  });

  it('counts mistakes and reveals the move after repeated failures', () => {
    const step = drill(['e4', 'e5'], 'white');
    let st = startDrill();
    for (let i = 0; i < REVEAL_AFTER; i++) {
      expect(revealedMove(step, st)).toBeNull();
      const res = attemptDrill(step, st, 'd2d4');
      expect(res.status).toBe('wrong');
      st = res.state;
    }
    expect(st.mistakes).toBe(REVEAL_AFTER);
    expect(revealedMove(step, st)?.san).toBe('e4');
    const ok = attemptDrill(step, st, 'e2e4');
    expect(ok.state.wrongTries).toBe(0);
    expect(ok.state.mistakes).toBe(REVEAL_AFTER);
  });

  it('starts with the opponent move when the student plays black', () => {
    const step = drill(['e4', 'e5'], 'black');
    let st = startDrill();
    expect(autoMove(step, st)?.san).toBe('e4');
    st = applyAuto(st);
    expect(attemptDrill(step, st, 'e7e5').status).toBe('complete');
  });
});

describe('quiz and scoring', () => {
  const quiz: QuizStep = { ...base(new Chess().fen(), []), type: 'quiz', question: 'Q', choices: ['a', 'b', 'c'], answer: 1 };

  it('grades the 0-based answer', () => {
    expect(gradeQuiz(quiz, 1)).toBe(true);
    expect(gradeQuiz(quiz, 0)).toBe(false);
    expect(gradeQuiz(quiz, -1)).toBe(false);
    expect(gradeQuiz(quiz, 1.5)).toBe(false);
  });

  it('scores a first-try answer as clean and a retried one as a hint', () => {
    expect(quizResult(0)).toEqual({ hint: false, mistakes: 0, failed: false });
    expect(quizResult(2)).toEqual({ hint: true, mistakes: 2, failed: false });
    expect(awardFor('quiz', quizResult(0)).step).toEqual({ hint: false });
    expect(awardFor('quiz', quizResult(1)).step).toEqual({ hint: true });
  });

  it('awards XP per step and per drilled line', () => {
    expect(XP_RULES.step).toEqual({ clean: 10, hint: 5 });
    expect(XP_RULES.line.clean).toBe(30);
    expect(awardFor('find-move', { hint: true, mistakes: 0, failed: false })).toEqual({ step: { hint: true }, line: null, srs: false });
    expect(awardFor('line-drill', { hint: false, mistakes: 0, failed: false })).toEqual({ step: { hint: false }, line: { clean: true }, srs: false });
  });

  it('queues a drill for spaced repetition on mistakes or reveal, and earns nothing when revealed', () => {
    expect(awardFor('line-drill', { hint: false, mistakes: 2, failed: false })).toEqual({ step: { hint: false }, line: { clean: false }, srs: true });
    expect(awardFor('line-drill', { hint: true, mistakes: 0, failed: true })).toEqual({ step: null, line: null, srs: true });
    expect(awardFor('find-move', { hint: true, mistakes: 1, failed: true })).toEqual({ step: null, line: null, srs: false });
  });

  it('keeps a lesson perfect only without hints, mistakes or reveals', () => {
    expect(isClean({ hint: false, mistakes: 0, failed: false })).toBe(true);
    expect(isClean({ hint: true, mistakes: 0, failed: false })).toBe(false);
    expect(isClean({ hint: false, mistakes: 1, failed: false })).toBe(false);
    expect(isClean({ hint: false, mistakes: 0, failed: true })).toBe(false);
  });
});

describe('lesson credit', () => {
  it('skips the lesson bonus when every practice step was only revealed', () => {
    expect(lessonEarnsCredit([{ type: 'explain', solved: true }, { type: 'find-move', solved: false }])).toBe(false);
    expect(lessonEarnsCredit([{ type: 'find-move', solved: false }, { type: 'quiz', solved: false }])).toBe(false);
  });

  it('counts a lesson once any practice step was solved', () => {
    expect(lessonEarnsCredit([{ type: 'explain', solved: true }, { type: 'find-move', solved: false }, { type: 'quiz', solved: true }])).toBe(true);
  });

  it('always counts a lesson that has no practice steps', () => {
    expect(lessonEarnsCredit([{ type: 'explain', solved: true }])).toBe(true);
    expect(lessonEarnsCredit([])).toBe(true);
  });
});

function shippedCourses(): Course[] {
  const dir = 'public/data/courses';
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as Course);
}

const KNOWN_LISTED = ['checkmate-patterns', 'tactics-basics', 'italian-game', 'queens-gambit', 'london-system', 'ruy-lopez', 'sicilian-defence'];

describe('course navigation helpers', () => {
  const courses = shippedCourses();
  const italian = courses.find((c) => c.slug === 'italian-game');

  it('hides the sample course from the library only', () => {
    const hidden = courses.filter((c) => !isListed(c));
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.every((c) => c.tags.includes('sample'))).toBe(true);
    expect(hidden.map((c) => c.slug)).toContain('sample-basics');
    const listed = courses.filter(isListed);
    expect(listed.every((c) => !c.tags.includes('sample'))).toBe(true);
    expect(listed.length + hidden.length).toBe(courses.length);
    for (const slug of KNOWN_LISTED) expect(listed.map((c) => c.slug)).toContain(slug);
  });

  it('finds lessons, the next lesson and the first unfinished lesson', () => {
    if (!italian) throw new Error('italian-game missing');
    const all = flatLessons(italian);
    const [a, b] = all;
    if (!a || !b) throw new Error('italian-game has fewer than 2 lessons');
    expect(findLesson(italian, a.lesson.id)?.lesson.id).toBe(a.lesson.id);
    expect(findLesson(italian, 'nope')).toBeNull();
    expect(nextLessonAfter(italian, a.lesson.id)?.lesson.id).toBe(b.lesson.id);
    expect(nextLessonAfter(italian, all[all.length - 1]?.lesson.id ?? '')).toBeNull();
    expect(nextUp(italian, {})?.lesson.id).toBe(a.lesson.id);
    expect(nextUp(italian, { [lessonKey(italian.slug, a.lesson.id)]: true })?.lesson.id).toBe(b.lesson.id);
    const everything = Object.fromEntries(all.map((l) => [lessonKey(italian.slug, l.lesson.id), true]));
    expect(nextUp(italian, everything)?.lesson.id).toBe(a.lesson.id);
    expect(completedCount(italian.slug, everything, all.length)).toBe(all.length);
    expect(completedCount(italian.slug, { 'other/x': true }, all.length)).toBe(0);
  });
});

describe('every shipped course is solvable by its own solution', () => {
  const courses = shippedCourses();

  it('ships the courses this test expects', () => {
    const slugs = courses.map((c) => c.slug);
    for (const slug of [...KNOWN_LISTED, 'sample-basics']) expect(slugs).toContain(slug);
    // Every authored course folder ships, and nothing ships without a source folder.
    const authored = readdirSync('content/courses', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect([...slugs].sort()).toEqual([...authored].sort());
    const catalog = (JSON.parse(readFileSync('public/data/courses/index.json', 'utf8')) as { slug: string }[]).map((c) => c.slug);
    expect([...catalog].sort()).toEqual([...slugs].sort());
  });

  it('completes every step through the player machines', () => {
    const rejected: string[] = [];
    const counts = { explain: 0, 'find-move': 0, 'line-drill': 0, quiz: 0 };
    for (const course of courses) {
      for (const { lesson } of flatLessons(course)) {
        for (const step of lesson.steps) {
          const where = `${course.slug}/${lesson.id}/${step.id}`;
          counts[step.type] += 1;
          if (step.type === 'explain') {
            const chess = new Chess(step.fen);
            for (const mv of step.moves) {
              try {
                chess.move({ from: mv.uci.slice(0, 2), to: mv.uci.slice(2, 4), promotion: mv.uci.slice(4) || undefined });
              } catch {
                rejected.push(`${where}: illegal explain move ${mv.san}`);
                break;
              }
              if (chess.fen() !== mv.fen) rejected.push(`${where}: explain fen mismatch after ${mv.san}`);
            }
          } else if (step.type === 'find-move') {
            let index = 0;
            let status = 'correct';
            while (status === 'correct' && index < step.moves.length) {
              const solution = step.moves[index];
              const out = evaluateFindMove(step, index, solution?.uci ?? '');
              status = out.status;
              if (out.status === 'wrong') rejected.push(`${where}: solver move ${index} (${solution?.san}) rejected`);
              else if (out.status === 'correct' && out.reply?.san !== step.moves[index + 1]?.san) rejected.push(`${where}: wrong reply after move ${index}`);
              index = out.nextIndex;
            }
            if (status !== 'complete') rejected.push(`${where}: find-move never completed (status ${status})`);
          } else if (step.type === 'line-drill') {
            let st = startDrill();
            let guard = 0;
            while (!isDrillDone(step, st) && guard++ < 200) {
              if (autoMove(step, st)) {
                st = applyAuto(st);
                continue;
              }
              const res = attemptDrill(step, st, step.moves[st.index]?.uci ?? '');
              if (res.status === 'wrong') {
                rejected.push(`${where}: drill move ${st.index} rejected`);
                break;
              }
              st = res.state;
            }
            if (!isDrillDone(step, st) || st.mistakes !== 0) rejected.push(`${where}: drill did not finish cleanly`);
          } else {
            if (!gradeQuiz(step, step.answer)) rejected.push(`${where}: quiz answer rejected`);
            if (step.answer < 0 || step.answer >= step.choices.length) rejected.push(`${where}: quiz answer out of range`);
            step.choices.forEach((_, i) => {
              if (i !== step.answer && gradeQuiz(step, i)) rejected.push(`${where}: wrong choice ${i} accepted`);
            });
          }
        }
      }
    }
    expect(counts['find-move']).toBeGreaterThan(0);
    expect(counts['line-drill']).toBeGreaterThan(0);
    expect(counts.quiz).toBeGreaterThan(0);
    expect(counts.explain).toBeGreaterThan(0);
    expect(rejected).toEqual([]);
  });
});
