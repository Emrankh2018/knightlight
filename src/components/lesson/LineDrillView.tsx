import { useEffect, useRef, useState } from 'react';
import Board, { type PromotionPiece } from '../Board';
import Button from '../Button';
import { fmt, m } from '../../i18n';
import type { Arrow, Highlight, LineDrillStep } from '../../lib/content/types';
import { hintView, nextHintLevel, type HintLevel } from '../../lib/lesson/hints';
import { applyAuto, attemptDrill, autoMove, isDrillDone, isStudentTurn, moverAt, revealedMove, startDrill, type DrillState } from '../../lib/lesson/lineDrill';
import { playMoveSound, playSound } from '../../lib/sound';
import {
  ARIA_OFF,
  bigButton,
  CLASS_BOARD,
  Feedback,
  HintBox,
  NORMAL_BOARD,
  OPPONENT_DELAY_MS,
  orientationOf,
  StepLayout,
  TurnPill,
  useControls,
  type ViewProps,
} from './shared';

interface Shown {
  fen: string;
  lastMove?: { from: string; to: string; san: string };
}

export default function LineDrillView({ step, flipped, classMode, header, notes, footer, controls, onComplete }: ViewProps<LineDrillStep>) {
  const [st, setSt] = useState<DrillState>(startDrill);
  const [shown, setShown] = useState<Shown>({ fen: step.fen });
  const [hintLevel, setHintLevel] = useState<HintLevel>(0);
  const [hinted, setHinted] = useState(false);
  const [wrongNote, setWrongNote] = useState(false);
  const [comment, setComment] = useState<string | undefined>(undefined);
  const completed = useRef(false);

  const done = isDrillDone(step, st);
  const auto = autoMove(step, st);
  const student = isStudentTurn(step, st);
  const expected = student ? (step.moves[st.index] ?? null) : null;

  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => {
      setShown({ fen: auto.fen, lastMove: { from: auto.uci.slice(0, 2), to: auto.uci.slice(2, 4), san: auto.san } });
      setComment(auto.comment);
      playMoveSound(auto.san);
      setSt(applyAuto(st));
    }, OPPONENT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [auto, st]);

  useEffect(() => {
    if (!done || completed.current) return;
    completed.current = true;
    playSound('solved');
    onComplete({ hint: hinted, mistakes: st.mistakes, failed: false });
  }, [done, hinted, st.mistakes, onComplete]);

  const onMove = (from: string, to: string, promo?: PromotionPiece): boolean => {
    if (!student || !expected) return false;
    const uci = `${from}${to}${promo ?? ''}`;
    const res = attemptDrill(step, st, uci);
    if (res.status === 'wrong') {
      setSt(res.state);
      setWrongNote(true);
      playSound('wrong');
      return false;
    }
    setShown({ fen: expected.fen, lastMove: { from, to, san: expected.san } });
    setComment(expected.comment);
    setWrongNote(false);
    setHintLevel(0);
    playMoveSound(expected.san);
    setSt(res.state);
    return true;
  };

  /** Promotes to a queen unless the expected move is this very move with an underpromotion. */
  const promotion = (from: string, to: string): PromotionPiece => {
    const uci = expected?.uci ?? '';
    const piece = uci.slice(4);
    return uci.startsWith(`${from}${to}`) && (piece === 'n' || piece === 'b' || piece === 'r') ? piece : 'q';
  };

  const showHint = (): void => {
    if (!student) return;
    setHinted(true);
    setWrongNote(false);
    playSound('hint');
    setHintLevel((l) => nextHintLevel(l));
  };

  useControls(controls, { hint: showHint });

  const firstStudentMove = moverAt(step, 0) === step.side ? 0 : 1;
  const view = hintView(st.index === firstStudentMove ? step.hints : [], expected?.uci ?? null, student ? hintLevel : 0);
  const revealed = revealedMove(step, st);
  const highlights: Highlight[] = [...view.highlights, ...(revealed ? [{ square: revealed.uci.slice(0, 2), color: 'Y' as const }, { square: revealed.uci.slice(2, 4), color: 'G' as const }] : [])];
  const arrows: Arrow[] = [...view.arrows, ...(revealed ? [{ from: revealed.uci.slice(0, 2), to: revealed.uci.slice(2, 4), color: 'G' as const }] : [])];
  const toMove = shown.fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const btn = bigButton(classMode);

  const board = (
    <Board
      fen={shown.fen}
      orientation={orientationOf(step.side, flipped)}
      interactive={student}
      onMove={onMove}
      promotion={promotion}
      lastMove={shown.lastMove}
      highlights={highlights}
      arrows={arrows}
      size={classMode ? CLASS_BOARD : NORMAL_BOARD}
      ariaLabel={m().lesson.boardLabel}
    />
  );

  const panel = (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <TurnPill side={toMove} classMode={classMode} />
        {st.mistakes > 0 ? <p className="font-bold text-muted">{fmt(m().lesson.mistakes, { count: st.mistakes })}</p> : null}
      </div>
      {step.intro && st.index <= firstStudentMove ? <p className="font-semibold">{step.intro}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className={`${btn} ${ARIA_OFF}`} onClick={showHint} aria-disabled={!student}>
          {m().lesson.hintButton}
        </Button>
      </div>
      <div role="status" className="space-y-3">
        {wrongNote ? (
          <Feedback live={false} tone="bad" large={classMode}>
            {m().lesson.wrong}
          </Feedback>
        ) : null}
        {auto ? <p className="font-bold text-muted">{m().lesson.opponentReplies}</p> : null}
        {revealed ? <Feedback live={false} tone="info" large={classMode}>{fmt(m().lesson.answerIs, { san: revealed.san })}</Feedback> : null}
        {comment && !wrongNote ? <p className="font-semibold">{comment}</p> : null}
        {done ? (
          <Feedback live={false} tone="good" large={classMode}>
            {m().lesson.drillDone} {st.mistakes === 0 ? m().lesson.drillCleanRun : fmt(m().lesson.drillMistakes, { count: st.mistakes })}
          </Feedback>
        ) : null}
        <HintBox view={view} fen={shown.fen} uci={expected?.uci ?? null} classMode={classMode} />
      </div>
    </>
  );

  return <StepLayout board={board} header={header} panel={panel} notes={notes} footer={footer} classMode={classMode} />;
}
