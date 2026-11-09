import { useEffect, useMemo, useRef, useState } from 'react';
import type { Color, Move } from 'chess.js';
import { createBot, type Bot } from '../../engine/client';
import { fmt, m } from '../../i18n';
import { ARMY_BUDGET, ARMY_PIECES, ARMY_PRICES, armyCost, armyStart, canFieldArmy, draftComputerArmy, findArmyMove, replayArmy, type ArmyPiece } from '../../lib/arcade/army';
import { boardResult, splitUci, type PlayedMove } from '../../lib/play';
import { playMoveSound } from '../../lib/sound';
import Button from '../Button';
import Card from '../Card';
import { PieceIcon, type PieceName } from '../icons';
import { usePromotion } from '../play/usePromotion';
import ArcadeBoard from './ArcadeBoard';

type Mode = 'computer' | 'local';
type Stage = { step: 'white' } | { step: 'pass' | 'black'; white: readonly ArmyPiece[] } | { step: 'match'; start: string };

const PIECE_ICONS = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' } as const satisfies Record<ArmyPiece, PieceName>;

function sideName(side: Color): string {
  return side === 'w' ? m().play.white : m().play.black;
}

function DraftShop({ side, onLock }: { side: Color; onLock: (army: readonly ArmyPiece[]) => void }) {
  const t = m().arcade.army;
  const [army, setArmy] = useState<ArmyPiece[]>([]);
  const pointsLeft = ARMY_BUDGET - armyCost(army);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  function add(piece: ArmyPiece): void {
    setArmy((current) => armyCost(current) + ARMY_PRICES[piece] <= ARMY_BUDGET ? [...current, piece] : current);
  }

  function remove(piece: ArmyPiece): void {
    setArmy((current) => {
      const index = current.indexOf(piece);
      return index < 0 ? current : current.filter((_, i) => i !== index);
    });
  }

  return (
    <Card className="mx-auto max-w-4xl space-y-4">
      <div className="space-y-1">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-extrabold focus:outline-none">{fmt(t.draftTitle, { side: sideName(side) })}</h2>
        <p className="text-muted">{t.draftRules}</p>
        <p role="status" className="text-lg font-extrabold tabular-nums">{fmt(t.budget, { left: pointsLeft, total: ARMY_BUDGET })}</p>
      </div>
      <fieldset>
        <legend className="mb-2 font-bold">{t.shop}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ARMY_PIECES.map((piece) => {
            const count = army.filter((pick) => pick === piece).length;
            return (
              <div key={piece} className="flex min-w-0 items-center gap-2 rounded-control border border-line p-2">
                <PieceIcon piece={PIECE_ICONS[piece]} width="1.75rem" height="1.75rem" className="shrink-0" />
                <div className="me-auto min-w-0">
                  <p className="font-extrabold">{t.pieces[piece]}</p>
                  <p className="text-sm text-muted">{fmt(t.price, { cost: ARMY_PRICES[piece] })}</p>
                </div>
                <Button variant="ghost" className="px-1" aria-label={fmt(t.remove, { piece: t.pieces[piece] })} disabled={count === 0} onClick={() => remove(piece)}><span aria-hidden="true">−</span></Button>
                <output aria-label={t.pieces[piece]} className="text-lg font-extrabold tabular-nums">{count}</output>
                <Button variant="secondary" className="px-1" aria-label={fmt(t.add, { piece: t.pieces[piece] })} disabled={pointsLeft < ARMY_PRICES[piece]} onClick={() => add(piece)}><span aria-hidden="true">+</span></Button>
              </div>
            );
          })}
        </div>
      </fieldset>
      <Button disabled={!canFieldArmy(army)} onClick={() => onLock(army)}>{t.lock}</Button>
    </Card>
  );
}

function DraftHandoff({ onContinue }: { onContinue: () => void }) {
  const t = m().arcade.army;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <Card className="mx-auto max-w-xl space-y-3">
      <h2 ref={heading} tabIndex={-1} className="text-2xl font-extrabold focus:outline-none">{t.locked}</h2>
      <p>{t.pass}</p>
      <Button onClick={onContinue}>{t.nextDraft}</Button>
    </Card>
  );
}

function ArmyMatch({ start, mode, onRematch }: { start: string; mode: Mode; onRematch: () => void }) {
  const t = m().arcade.army;
  const [moves, setMoves] = useState<PlayedMove[]>([]);
  const chess = useMemo(() => replayArmy(start, moves), [start, moves]);
  const over = boardResult(chess);
  const botTurn = mode === 'computer' && chess.turn() === 'b' && !over;
  const promotion = usePromotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const botRef = useRef<Bot | null>(null);

  useEffect(() => {
    heading.current?.focus();
    return () => {
      botRef.current?.dispose();
      botRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!botTurn) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        let move: Move | undefined;
        try {
          botRef.current ??= createBot();
          const { uci } = await botRef.current.move(chess.fen(), 'pawn');
          if (cancelled) return;
          const next = splitUci(uci);
          move = findArmyMove(chess, next.from, next.to, next.promotion);
        } catch {
          if (cancelled) return;
        }
        const legal = move ?? chess.moves({ verbose: true })[0];
        if (!legal) return;
        setMoves((current) => current === moves ? [...current, legal] : current);
        playMoveSound(legal.san);
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [botTurn, chess, moves]);

  function move(from: string, to: string, piece?: string): boolean {
    if (over || botTurn) return false;
    const legal = findArmyMove(chess, from, to, piece);
    if (!legal) return false;
    setMoves((current) => current === moves ? [...current, legal] : current);
    playMoveSound(legal.san);
    return true;
  }

  const status = over
    ? over.winner === null
      ? over.reason === 'stalemate' ? m().play.reasons.stalemate : fmt(t.draw, { reason: m().play.reasons[over.reason] })
      : fmt(t.winner, { side: sideName(over.winner) })
    : botTurn ? t.thinking : fmt(chess.inCheck() ? t.check : t.turn, { side: sideName(chess.turn()) });

  return (
    <ArcadeBoard fen={chess.fen()} label={t.boardLabel} interactive={!over && !botTurn && !promotion.open} onMove={move} promotion={promotion.ask} lastMove={moves.at(-1)}>
      <Card className="space-y-3">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-extrabold focus:outline-none">{t.matchTitle}</h2>
        <p role="status" className="text-lg font-extrabold">{status}</p>
        {promotion.picker}
        <Button variant="secondary" onClick={onRematch}>{t.rematch}</Button>
      </Card>
    </ArcadeBoard>
  );
}

export default function ArmyDraft({ mode }: { mode: Mode }) {
  const [stage, setStage] = useState<Stage>({ step: 'white' });

  if (stage.step === 'match') return <ArmyMatch start={stage.start} mode={mode} onRematch={() => setStage({ step: 'white' })} />;
  if (stage.step === 'pass') return <DraftHandoff onContinue={() => setStage({ step: 'black', white: stage.white })} />;
  if (stage.step === 'black') return <DraftShop key="black" side="b" onLock={(black) => setStage({ step: 'match', start: armyStart(stage.white, black) })} />;

  return <DraftShop key="white" side="w" onLock={(white) => setStage(mode === 'local' ? { step: 'pass', white } : { step: 'match', start: armyStart(white, draftComputerArmy()) })} />;
}
