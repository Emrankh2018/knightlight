import { useEffect, useRef, useState } from 'react';
import Board from '../Board';
import Button from '../Button';
import { fmt, m } from '../../i18n';
import type { ExplainStep } from '../../lib/content/types';
import { playMoveSound } from '../../lib/sound';
import { bigButton, CLASS_BOARD, NORMAL_BOARD, orientationOf, StepLayout, TurnPill, useControls, type ViewProps } from './shared';

export default function ExplainView({ step, flipped, courseSide, classMode, header, notes, footer, controls, onComplete }: ViewProps<ExplainStep>) {
  const [ply, setPly] = useState(0);
  const total = step.moves.length;
  const finished = useRef(false);

  useEffect(() => {
    if (ply >= total && !finished.current) {
      finished.current = true;
      onComplete({ hint: false, mistakes: 0, failed: false });
    }
  }, [ply, total, onComplete]);

  const go = (to: number): void => {
    const next = Math.min(total, Math.max(0, to));
    if (next === ply) return;
    const move = step.moves[next - 1];
    if (next > ply && move) playMoveSound(move.san);
    setPly(next);
  };

  useControls(controls, {
    back: () => {
      if (ply === 0) return false;
      go(ply - 1);
      return true;
    },
    forward: () => {
      if (ply >= total) return false;
      go(ply + 1);
      return true;
    },
  });

  const move = ply > 0 ? step.moves[ply - 1] : undefined;
  const fen = move ? move.fen : step.fen;
  const arrows = move ? move.arrows : step.introArrows;
  const highlights = move ? move.highlights : step.introHighlights;
  const text = move ? move.comment : step.intro;
  const toMove = fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const btn = bigButton(classMode);

  const board = (
    <Board
      fen={fen}
      orientation={orientationOf(courseSide, flipped)}
      lastMove={move ? { from: move.uci.slice(0, 2), to: move.uci.slice(2, 4), san: move.san } : undefined}
      arrows={arrows}
      highlights={highlights}
      size={classMode ? CLASS_BOARD : NORMAL_BOARD}
      ariaLabel={m().lesson.boardLabel}
    />
  );

  const panel = (
    <>
      <TurnPill side={toMove} classMode={classMode} />
      <p className="font-bold text-muted">{move ? fmt(m().lesson.moveOf, { n: ply, total, san: move.san }) : m().lesson.startPosition}</p>
      {text ? <p className="font-semibold">{text}</p> : null}
      {total > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className={btn} onClick={() => go(ply - 1)} disabled={ply === 0}>
            {m().lesson.prevMove}
          </Button>
          <Button variant="secondary" className={btn} onClick={() => go(ply + 1)} disabled={ply >= total}>
            {m().lesson.nextMove}
          </Button>
        </div>
      ) : null}
    </>
  );

  return <StepLayout board={board} header={header} panel={panel} notes={notes} footer={footer} classMode={classMode} />;
}
