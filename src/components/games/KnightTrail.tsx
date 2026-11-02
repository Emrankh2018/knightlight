import { useRef, useState } from 'react';
import Button from '../Button';
import Card from '../Card';
import { fmt, m } from '../../i18n';
import { KNIGHT_LEVELS, knightMoves, knightTrailHint } from '../../lib/games';
import { useProgress } from '../../store/progress';
import SelectionBoard from './SelectionBoard';
import { Completed, GameHeader, GameLayout, Stars, useGameSave } from './shared';

type Trail = typeof KNIGHT_LEVELS[number];

export default function KnightTrail({ profileId }: { profileId: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const progress = useProgress((s) => s.data.games?.knight);
  const level = selected === null ? undefined : KNIGHT_LEVELS[selected];
  return <><GameHeader game="knight" />{level && selected !== null ? <KnightRun key={`${level.id}-${attempt}`} level={level} index={selected} profileId={profileId} onChoose={() => setSelected(null)} onReplay={() => setAttempt((n) => n + 1)} onNext={selected < KNIGHT_LEVELS.length - 1 ? () => setSelected(selected + 1) : undefined} /> : <div className="kl-game-selector space-y-4"><p className="max-w-3xl text-lg">{m().games.knight.intro}</p><p className="text-muted">{m().games.knight.rules}</p><div className="kl-game-levels grid grid-cols-2 gap-3 sm:grid-cols-3">{KNIGHT_LEVELS.map((trail, i) => <Card key={trail.id} className="space-y-2"><h2 className="text-xl font-extrabold">{fmt(m().games.knight.level, { number: i + 1 })}</h2><p>{fmt(m().games.knight.par, { count: trail.par })}</p><Stars count={progress?.[trail.id]?.stars ?? 0} /><div><Button onClick={() => setSelected(i)}>{m().games.play}<span className="sr-only"> {fmt(m().games.knight.level, { number: i + 1 })}</span></Button></div></Card>)}</div></div>}</>;
}

function KnightRun({ level, index, profileId, onChoose, onReplay, onNext }: { level: Trail; index: number; profileId: string; onChoose: () => void; onReplay: () => void; onNext?: () => void }) {
  const [path, setPath] = useState<string[]>([level.start]);
  const currentPath = useRef(path);
  const finished = useRef(false);
  const [done, setDone] = useState(false);
  const assisted = useRef(false);
  const [message, setMessage] = useState(m().games.knight.prompt);
  const [wrong, setWrong] = useState(false);
  const [clue, setClue] = useState<string | null>(null);
  const reward = useGameSave('knight', level.id, profileId);
  const square = path[path.length - 1] ?? level.start;
  const remaining = level.treasures.filter((target) => !path.includes(target));
  const moves = path.length - 1;
  const onSelect = (destination: string): void => {
    if (finished.current) return;
    const previous = currentPath.current;
    const from = previous[previous.length - 1] ?? level.start;
    if (destination === from) return;
    if (!knightMoves(from).includes(destination)) {
      setMessage(m().games.knight.invalid);
      setWrong(true);
      return;
    }
    const next = [...previous, destination];
    currentPath.current = next;
    setPath(next);
    setClue(null);
    setWrong(false);
    const left = level.treasures.filter((target) => !next.includes(target));
    if (left.length === 0 && destination === level.exit) {
      finished.current = true;
      setDone(true);
      setMessage(m().games.knight.success);
      reward.save(!assisted.current && next.length - 1 === level.par ? 3 : next.length - 1 <= level.par + 2 ? 2 : 1);
    } else setMessage(destination === level.exit ? m().games.knight.needsGems : level.treasures.includes(destination) && !previous.includes(destination) ? m().games.knight.found : m().games.knight.prompt);
  };
  const showHint = (): void => {
    assisted.current = true;
    const destination = knightTrailHint(square, remaining, level.exit);
    setClue(destination);
    if (destination) { setMessage(fmt(m().games.knight.hint, { square: destination })); setWrong(false); }
  };
  const undo = (): void => {
    if (finished.current || currentPath.current.length <= 1) return;
    const next = currentPath.current.slice(0, -1);
    currentPath.current = next;
    setPath(next);
    setClue(null);
    setWrong(false);
    setMessage(m().games.knight.prompt);
  };
  return <GameLayout board={<SelectionBoard label={m().games.knight.board} initialSquare={level.start} pieces={{ [square]: { glyph: m().games.symbols.knight, name: m().games.knightPiece } }} treasures={remaining} exit={level.exit} hint={clue} onSelect={onSelect} disabled={done} />}><Card className="space-y-3"><h2 className="text-2xl font-extrabold">{fmt(m().games.knight.challenge, { current: index + 1, total: KNIGHT_LEVELS.length })}</h2><p>{m().games.knight.legend}</p><div className="flex flex-wrap gap-x-5 gap-y-1 text-lg font-extrabold"><span>{fmt(m().games.knight.moves, { count: moves })}</span><span>{fmt(m().games.knight.gems, { found: level.treasures.length - remaining.length, total: level.treasures.length })}</span></div><p>{fmt(m().games.knight.par, { count: level.par })}</p><p role="status" className={wrong ? 'font-bold text-error' : 'font-bold'}>{message}</p>{!done ? <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={showHint}>{m().games.hint}</Button><Button variant="secondary" onClick={undo} disabled={moves === 0}>{m().games.undo}</Button><Button variant="ghost" onClick={onReplay}>{m().games.restart}</Button></div> : null}</Card>{done ? <Completed {...reward} onReplay={onReplay} next={onNext ? <Button onClick={onNext}>{m().games.nextLevel}</Button> : undefined} /> : <p className="text-sm text-muted">{m().games.knight.scoring}</p>}<Button variant="ghost" onClick={onChoose}>{m().games.chooseLevel}</Button></GameLayout>;
}
