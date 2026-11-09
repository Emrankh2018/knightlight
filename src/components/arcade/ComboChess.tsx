import { useEffect, useRef, useState } from 'react';
import { fmt, m } from '../../i18n';
import { allowsComboMove, COMBO_TARGET, comboTurn, computerComboMove, endComboTurn, playComboMove, startComboGame } from '../../lib/arcade/combo';
import { playMoveSound, playSound } from '../../lib/sound';
import Button from '../Button';
import Card from '../Card';
import ArcadeBoard from './ArcadeBoard';

export default function ComboChess({ mode }: { mode: 'computer' | 'local' }) {
  const [game, setGame] = useState(startComboGame);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const turn = comboTurn(game);
  const computerTurn = mode === 'computer' && turn === 'b' && game.outcome === null;
  const interactive = game.outcome === null && !computerTurn;
  const t = m().arcade.combo;
  const colors = { w: m().play.white, b: m().play.black };

  useEffect(() => {
    if (!computerTurn) return;
    const timer = setTimeout(() => {
      const next = computerComboMove(game);
      if (next !== game && next.lastMove) playMoveSound(next.lastMove.san);
      setGame((current) => current === game ? next : current);
    }, 400);
    return () => clearTimeout(timer);
  }, [computerTurn, game]);

  const onMove = (from: string, to: string): boolean => {
    if (!interactive) return false;
    const next = playComboMove(game, from, to);
    if (!next) return false;
    setGame((current) => current === game ? next : current);
    if (next.outcome === turn) playSound('solved');
    else if (next.lastMove) playMoveSound(next.lastMove.san);
    return true;
  };

  const status = game.outcome === 'draw' ? t.draw
    : game.outcome ? fmt(t.won, { color: colors[game.outcome] })
    : computerTurn ? t.thinking
    : game.chain ? fmt(t.chain, { count: game.chain.count })
    : fmt(t.turn, { color: colors[turn] });

  return (
    <ArcadeBoard
      fen={game.fen}
      label={t.board}
      interactive={interactive}
      onMove={onMove}
      kingless
      moveFilter={(move) => allowsComboMove(game, move)}
      lastMove={game.lastMove}
    >
      <div className="grid grid-cols-2 gap-2">
        {(['w', 'b'] as const).map((color) => {
          const score = fmt(t.score, { color: colors[color], count: game.captures[color] });
          return (
            <Card key={color} className="p-3">
              <p className="font-bold tabular-nums">{score}</p>
              <progress aria-label={score} className="h-3 w-full accent-ink dark:accent-lamp" value={game.captures[color]} max={COMBO_TARGET} />
            </Card>
          );
        })}
      </div>
      <Card className="space-y-3">
        <p ref={statusRef} role="status" tabIndex={-1} className="font-bold">{status}</p>
        {interactive && game.chain && (
          <Button variant="secondary" onClick={() => {
            setGame(endComboTurn);
            statusRef.current?.focus();
          }}>{t.endTurn}</Button>
        )}
        {game.outcome && (
          <Button onClick={() => {
            setGame(startComboGame());
            statusRef.current?.focus();
          }}>{t.replay}</Button>
        )}
        <p className="text-muted">{t.rules}</p>
      </Card>
    </ArcadeBoard>
  );
}
