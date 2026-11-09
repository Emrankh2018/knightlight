import { useEffect, useState } from 'react';
import { fmt, m } from '../../i18n';
import { chooseBossMove, playBossMove, startBoss } from '../../lib/arcade/boss';
import Button from '../Button';
import Card from '../Card';
import ArcadeBoard from './ArcadeBoard';

const BOSS_PAUSE_MS = 500;

export default function BossBattle({ mode }: { mode: 'computer' | 'local' }) {
  const [battle, setBattle] = useState(startBoss);
  const arcade = m().arcade;
  const t = arcade.boss;
  const thinking = mode === 'computer' && battle.turn === 'b' && battle.result === null;
  const interactive = !thinking && battle.result === null;

  useEffect(() => {
    if (!thinking) return;
    const timer = window.setTimeout(() => {
      const move = chooseBossMove(battle);
      const reply = move && playBossMove(battle, move.from, move.to);
      setBattle((current) => (current === battle ? reply ?? { ...battle, result: 'draw' } : current));
    }, BOSS_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [battle, thinking]);

  function movePiece(from: string, to: string): boolean {
    if (!interactive) return false;
    const next = playBossMove(battle, from, to);
    if (!next) return false;
    setBattle(next);
    return true;
  }

  const resultText = { team: t.teamWin, boss: t.bossWin, draw: t.draw };
  const turnText = thinking ? t.bossThinking : battle.turn === 'w' ? t.teamTurn : t.bossTurn;

  return (
    <ArcadeBoard
      fen={battle.fen}
      label={t.board}
      interactive={interactive}
      onMove={movePiece}
      lastMove={battle.lastMove}
      kingless
    >
      <Card className="space-y-3">
        <dl>
          <dt className="text-base font-bold text-muted">{t.lives}</dt>
          <dd className="text-2xl font-extrabold tabular-nums">{fmt(t.livesRemaining, { remaining: battle.lives })}</dd>
        </dl>
        <div className="grid grid-cols-3 gap-2" aria-hidden="true">
          {[1, 2, 3].map((life) => (
            <span key={life} className={`h-2 rounded-full border border-line ${life <= battle.lives ? 'bg-amber' : 'bg-surface'}`} />
          ))}
        </div>
        <div role="status" className="space-y-1">
          <p className="text-lg font-extrabold">{battle.result ? resultText[battle.result] : turnText}</p>
          {battle.event && !battle.result ? <p className="font-semibold">{t[battle.event]}</p> : null}
        </div>
        <p className="text-base text-muted">{t.rules}</p>
        <Button variant={battle.result ? 'primary' : 'secondary'} onClick={() => setBattle(startBoss())}>
          {battle.result ? arcade.replay : arcade.restart}
        </Button>
      </Card>
    </ArcadeBoard>
  );
}
