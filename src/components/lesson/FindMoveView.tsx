import { useState } from 'react';
import Board, { type PromotionPiece } from '../Board';
import Button from '../Button';
import { fmt, m } from '../../i18n';
import type { Arrow, FindMoveStep, Highlight } from '../../lib/content/types';
import { evaluateFindMove, expectedAt, fenBefore } from '../../lib/lesson/findMove';
import { hintView, nextHintLevel, type HintLevel } from '../../lib/lesson/hints';
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
  SOLUTION_DELAY_MS,
  StepLayout,
  TurnPill,
  useControls,
  useLater,
  type ViewProps,
} from './shared';

type Phase = 'play' | 'busy' | 'done' | 'revealing' | 'shown';
type Note = 'none' | 'wrong' | 'correct' | 'alternate';

interface Shown {
  fen: string;
  lastMove?: { from: string; to: string; san: string };
}

export default function FindMoveView({ step, flipped, classMode, header, notes, footer, controls, onComplete }: ViewProps<FindMoveStep>) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState<Shown>({ fen: step.fen });
  const [phase, setPhase] = useState<Phase>('play');
  const [hintLevel, setHintLevel] = useState<HintLevel>(0);
  const [wrong, setWrong] = useState(0);
  const [hinted, setHinted] = useState(false);
  const [note, setNote] = useState<Note>('none');
  const [answer, setAnswer] = useState('');
  const later = useLater();

  const expected = expectedAt(step, index);
  const interactive = phase === 'play';

  const onMove = (from: string, to: string, promo?: PromotionPiece): boolean => {
    if (!interactive) return false;
    const out = evaluateFindMove(step, index, `${from}${to}${promo ?? ''}`);
    if (out.status === 'wrong' || !out.played) {
      setWrong((n) => n + 1);
      setNote('wrong');
      playSound('wrong');
      return false;
    }
    const played = out.played;
    setHintLevel(0);
    setShown({ fen: played.fen, lastMove: { from, to, san: played.san } });
    playMoveSound(played.san);
    if (out.status === 'complete') {
      setPhase('done');
      setNote(out.alternativeMate ? 'alternate' : 'correct');
      playSound('solved');
      onComplete({ hint: hinted, mistakes: wrong, failed: false });
      return true;
    }
    setPhase('busy');
    setNote('correct');
    const reply = out.reply;
    later(() => {
      if (reply) {
        setShown({ fen: reply.fen, lastMove: { from: reply.uci.slice(0, 2), to: reply.uci.slice(2, 4), san: reply.san } });
        playMoveSound(reply.san);
      }
      setIndex(out.nextIndex);
      setNote('none');
      setPhase('play');
    }, OPPONENT_DELAY_MS);
    return true;
  };

  /** Promotes to a queen unless the expected move is this very move with an underpromotion. */
  const promotion = (from: string, to: string): PromotionPiece => {
    const uci = expected?.uci ?? '';
    const piece = uci.slice(4);
    return uci.startsWith(`${from}${to}`) && (piece === 'n' || piece === 'b' || piece === 'r') ? piece : 'q';
  };

  const showHint = (): void => {
    if (phase !== 'play') return;
    setHinted(true);
    setNote('none');
    playSound('hint');
    setHintLevel((l) => nextHintLevel(l));
  };

  const showAnswer = (): void => {
    if (phase !== 'play' || !expected) return;
    setPhase('revealing');
    setNote('none');
    setHintLevel(0);
    setAnswer(expected.san);
    onComplete({ hint: true, mistakes: wrong, failed: true });
    step.moves.slice(index).forEach((mv, i) => {
      later(() => {
        setShown({ fen: mv.fen, lastMove: { from: mv.uci.slice(0, 2), to: mv.uci.slice(2, 4), san: mv.san } });
        playMoveSound(mv.san);
      }, SOLUTION_DELAY_MS * (i + 1));
    });
    later(() => setPhase('shown'), SOLUTION_DELAY_MS * (step.moves.length - index));
  };

  useControls(controls, { hint: showHint });

  const view = hintView(index === 0 ? step.hints : [], expected?.uci ?? null, hintLevel);
  const showLadder = phase === 'play' && hintLevel > 0;
  const highlights: Highlight[] = showLadder ? view.highlights : [];
  const arrows: Arrow[] = showLadder ? view.arrows : [];
  const comment = (phase === 'busy' || phase === 'done') && note === 'correct' ? step.moves[index]?.comment : undefined;
  const toMove = shown.fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const btn = bigButton(classMode);

  const board = (
    <Board
      fen={shown.fen}
      orientation={orientationOf(step.side, flipped)}
      interactive={interactive}
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
        {wrong > 0 ? <p className="font-bold text-muted">{fmt(m().lesson.mistakes, { count: wrong })}</p> : null}
      </div>
      {step.intro && index === 0 ? <p className="font-semibold">{step.intro}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className={`${btn} ${ARIA_OFF}`} onClick={showHint} aria-disabled={phase !== 'play'}>
          {m().lesson.hintButton}
        </Button>
        <Button variant="secondary" className={`${btn} ${ARIA_OFF}`} onClick={showAnswer} aria-disabled={phase !== 'play'}>
          {m().lesson.showAnswer}
        </Button>
      </div>
      <div role="status" className="space-y-3">
        {note === 'wrong' ? (
          <Feedback live={false} tone="bad" large={classMode}>
            {m().lesson.wrong}
          </Feedback>
        ) : null}
        {note === 'correct' && phase === 'busy' ? <Feedback live={false} tone="good" large={classMode}>{m().lesson.correct}</Feedback> : null}
        {phase === 'busy' ? <p className="font-bold text-muted">{m().lesson.opponentReplies}</p> : null}
        {phase === 'done' ? <Feedback live={false} tone="good" large={classMode}>{note === 'alternate' ? m().lesson.alternateMate : m().lesson.solved}</Feedback> : null}
        {comment ? <p className="font-semibold">{comment}</p> : null}
        {phase === 'revealing' || phase === 'shown' ? <Feedback live={false} tone="info" large={classMode}>{fmt(m().lesson.answerIs, { san: answer })}</Feedback> : null}
        <HintBox view={view} fen={fenBefore(step, index)} uci={expected?.uci ?? null} classMode={classMode} />
      </div>
    </>
  );

  return <StepLayout board={board} header={header} panel={panel} notes={notes} footer={footer} classMode={classMode} />;
}
