import { useEffect, useRef, useState } from 'react';
import Board from '../Board';
import { fmt, m } from '../../i18n';
import type { QuizStep } from '../../lib/content/types';
import { gradeQuiz, quizResult } from '../../lib/lesson/quiz';
import { playSound } from '../../lib/sound';
import { CLASS_BOARD, Feedback, NORMAL_BOARD, orientationOf, StepLayout, TurnPill, useControls, type ViewProps } from './shared';

export default function QuizView({ step, flipped, courseSide, classMode, header, notes, footer, controls, onComplete }: ViewProps<QuizStep>) {
  const [tried, setTried] = useState<readonly number[]>([]);
  const [solved, setSolved] = useState(false);
  const result = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (solved) result.current?.scrollIntoView({ block: 'nearest' });
  }, [solved]);

  const fen = step.moves.length > 0 ? (step.moves[step.moves.length - 1]?.fen ?? step.fen) : step.fen;
  const last = step.moves[step.moves.length - 1];
  const toMove = fen.split(' ')[1] === 'b' ? 'black' : 'white';

  const pick = (n: number): void => {
    if (solved || n < 0 || n >= step.choices.length || tried.includes(n)) return;
    if (gradeQuiz(step, n)) {
      setSolved(true);
      setTried([...tried, n]);
      playSound('solved');
      onComplete(quizResult(tried.length));
    } else {
      setTried([...tried, n]);
      playSound('wrong');
    }
  };

  useControls(controls, { answer: (n) => pick(n - 1) });

  const wrongShown = tried.length > 0 && !solved;

  const board = (
    <Board
      fen={fen}
      orientation={orientationOf(courseSide, flipped)}
      lastMove={last ? { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4), san: last.san } : undefined}
      arrows={step.moves.length > 0 ? (last?.arrows ?? []) : step.introArrows}
      highlights={step.moves.length > 0 ? (last?.highlights ?? []) : step.introHighlights}
      size={classMode ? CLASS_BOARD : NORMAL_BOARD}
      ariaLabel={m().lesson.boardLabel}
    />
  );

  const panel = (
    <>
      <TurnPill side={toMove} classMode={classMode} />
      {step.intro ? <p className="font-semibold">{step.intro}</p> : null}
      <h2 className="font-extrabold">{step.question}</h2>
      <ul className="space-y-2">
        {step.choices.map((choice, i) => {
          const wrong = tried.includes(i) && i !== step.answer;
          const right = solved && i === step.answer;
          return (
            <li key={`${i}-${choice}`}>
              <button
                type="button"
                aria-label={fmt(right ? m().lesson.choiceRight : wrong ? m().lesson.choiceWrong : m().lesson.choiceLabel, { n: i + 1, text: choice })}
                aria-disabled={wrong || solved}
                onClick={() => pick(i)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-4 py-2 text-start font-bold ${
                  right
                    ? 'border-leaf bg-leaf/15'
                    : wrong
                      ? 'border-dashed border-muted text-muted line-through'
                      : 'border-ink/60 bg-surface hover:border-ink dark:border-amber/60 dark:hover:border-amber'
                }`}
              >
                <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-line/60">
                  {i + 1}
                </span>
                {choice}
              </button>
            </li>
          );
        })}
      </ul>
      <div ref={result} role="status" className="space-y-3">
        {wrongShown ? <Feedback live={false} tone="bad" large={classMode}>{m().lesson.quizWrong}</Feedback> : null}
        {solved ? <Feedback live={false} tone="good" large={classMode}>{m().lesson.quizCorrect}</Feedback> : null}
        {solved && step.explanation ? (
          <p className="font-semibold">
            <span className="font-extrabold">{m().lesson.explanation}: </span>
            {step.explanation}
          </p>
        ) : null}
      </div>
    </>
  );

  return <StepLayout board={board} header={header} panel={panel} notes={notes} footer={footer} classMode={classMode} />;
}
