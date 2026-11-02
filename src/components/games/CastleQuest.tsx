import { useCallback, useRef, useState } from 'react';
import Board, { type PromotionPiece } from '../Board';
import Button from '../Button';
import Card from '../Card';
import { fmt, m } from '../../i18n';
import { useLoad } from '../../hooks/useLoad';
import { loadPuzzleChunk } from '../../lib/data';
import { CASTLE_QUESTS } from '../../lib/games';
import type { Puzzle } from '../../lib/puzzle-types';
import { hint, start, tryMove, type PuzzleState } from '../../lib/puzzles';
import { useProgress } from '../../store/progress';
import { Completed, GameHeader, GameLayout, Stars, useGameSave } from './shared';

type Quest = typeof CASTLE_QUESTS[number];

export default function CastleQuest({ profileId }: { profileId: string }) {
  const [quest, setQuest] = useState<Quest | null>(null);
  const progress = useProgress((s) => s.data.games?.castle);
  return <><GameHeader game="castle" />{quest ? <CastleLoad key={quest.id} quest={quest} profileId={profileId} onChoose={() => setQuest(null)} /> : <div className="space-y-4"><p className="text-lg">{m().games.castle.intro}</p><div className="grid gap-4 md:grid-cols-3">{CASTLE_QUESTS.map((item) => <Card key={item.id} className="space-y-3"><h2 className="kl-display text-2xl font-bold">{m().games.castle.quests[item.id].title}</h2><p>{m().games.castle.quests[item.id].body}</p><Stars count={progress?.[item.id]?.stars ?? 0} /><div><Button onClick={() => setQuest(item)}>{m().games.start}<span className="sr-only"> {m().games.castle.quests[item.id].title}</span></Button></div></Card>)}</div></div>}</>;
}

function CastleLoad({ quest, profileId, onChoose }: { quest: Quest; profileId: string; onChoose: () => void }) {
  const [attempt, setAttempt] = useState(0);
  return <CastleRequest key={attempt} quest={quest} profileId={profileId} onChoose={onChoose} onReplay={() => setAttempt((n) => n + 1)} />;
}

function CastleRequest({ quest, profileId, onChoose, onReplay }: { quest: Quest; profileId: string; onChoose: () => void; onReplay: () => void }) {
  const load = useCallback(async () => {
    const puzzles = await loadPuzzleChunk(`${quest.level}/${quest.theme}.json`);
    const usable = [...puzzles].sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id)).filter((puzzle) => {
      try { start(puzzle); return true; } catch { return false; }
    }).slice(0, quest.count);
    if (usable.length !== quest.count) throw new Error('Not enough puzzles');
    return usable;
  }, [quest]);
  const result = useLoad(load);
  if (result.status === 'loading') return <p role="status">{m().common.loading}</p>;
  if (result.status === 'error') return <Card className="space-y-3"><p role="alert">{m().games.castle.retryLoad}</p><Button onClick={onReplay}>{m().common.retry}</Button><Button variant="secondary" onClick={onChoose}>{m().games.chooseLevel}</Button></Card>;
  return <CastleRun puzzles={result.data} quest={quest} profileId={profileId} onReplay={onReplay} onChoose={onChoose} />;
}

function CastleRun({ puzzles, quest, profileId, onReplay, onChoose }: { puzzles: Puzzle[]; quest: Quest; profileId: string; onReplay: () => void; onChoose: () => void }) {
  const [room, setRoom] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const mistakes = useRef(0);
  const reward = useGameSave('castle', quest.id, profileId);
  const puzzle = puzzles[room];
  if (!puzzle || room >= puzzles.length) return <><Completed {...reward} onReplay={onReplay} /><Button variant="ghost" className="mt-3" onClick={onChoose}>{m().games.chooseLevel}</Button></>;
  const finishedRoom = (errors: number): void => {
    mistakes.current += errors;
    setUnlocked(true);
  };
  const advance = (): void => {
    if (!unlocked) return;
    if (room === puzzles.length - 1) reward.save(mistakes.current === 0 ? 3 : mistakes.current <= 2 ? 2 : 1);
    setRoom((n) => n + 1);
    setUnlocked(false);
  };
  return <><div className="kl-castle-heading mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="kl-display text-2xl font-bold">{m().games.castle.quests[quest.id].title}</h2><Button variant="ghost" onClick={onChoose}>{m().games.chooseLevel}</Button></div><CastleRoom key={puzzle.id} puzzle={puzzle} quest={quest} room={room} total={puzzles.length} unlocked={unlocked} onSolved={finishedRoom} onNext={advance} /></>;
}

function CastleRoom({ puzzle, quest, room, total, unlocked, onSolved, onNext }: { puzzle: Puzzle; quest: Quest; room: number; total: number; unlocked: boolean; onSolved: (errors: number) => void; onNext: () => void }) {
  const [position, setPosition] = useState(() => start(puzzle));
  const current = useRef<PuzzleState>(position);
  const solved = useRef(false);
  const errors = useRef(0);
  const [message, setMessage] = useState('');
  const [shownHint, setShownHint] = useState(false);
  const [wrong, setWrong] = useState(false);
  const clue = hint(position, 3);
  const onMove = (from: string, to: string, promotion?: PromotionPiece): boolean => {
    if (solved.current) return false;
    const result = tryMove(current.current, `${from}${to}${promotion ?? ''}`);
    if (result.kind === 'wrong') {
      errors.current += 1;
      setWrong(true);
      setMessage(m().games.castle.wrong);
      return false;
    }
    current.current = result.state;
    setPosition(result.state);
    setShownHint(false);
    setWrong(false);
    if (result.kind === 'solved') {
      solved.current = true;
      setMessage(m().games.castle.correct);
      onSolved(errors.current);
    } else setMessage(fmt(m().games.castle.reply, { move: result.state.lastMove?.san ?? result.reply }));
    return true;
  };
  return <GameLayout board={<Board fen={position.fen} orientation={position.orientation} onMove={onMove} interactive={!unlocked} lastMove={position.lastMove} ariaLabel={m().games.castle.board} size="var(--kl-games-board-size)" highlights={shownHint && clue ? [{ square: clue.from, color: 'Y' }, ...(clue.to ? [{ square: clue.to, color: 'G' as const }] : [])] : []} />}><ol className="kl-castle-doors" aria-label={fmt(m().games.castle.room, { current: room + 1, total })}>{Array.from({ length: total }, (_, n) => <li key={n} className={n < room || n === room && unlocked ? 'is-open' : n === room ? 'is-current' : ''} aria-current={n === room ? 'step' : undefined}><span className="sr-only">{fmt(n < room || n === room && unlocked ? m().games.castle.doorDone : n === room ? m().games.castle.doorNow : m().games.castle.doorLocked, { number: n + 1 })}</span><span aria-hidden="true">{n + 1}</span></li>)}</ol><Card className="space-y-3"><p className="font-bold text-muted">{fmt(m().games.castle.room, { current: room + 1, total })}</p><h2 className="text-2xl font-extrabold">{room === total - 1 ? m().games.castle.boss : m().games.castle.quests[quest.id].body}</h2>{room === total - 1 ? <p>{m().games.castle.bossHelp}</p> : null}<p>{fmt(m().games.castle.side, { color: position.solver === 'white' ? m().games.white : m().games.black })}</p><p role="status" className={wrong ? 'font-bold text-error' : 'font-bold text-ok-text'}>{message}</p>{shownHint && clue ? <p>{fmt(m().games.castle.moveHint, { from: clue.from, to: clue.to ?? '' })}{puzzle.moves[position.index]?.[4] ? ` ${fmt(m().games.castle.hintPromotion, { piece: m().games.pieceNames[puzzle.moves[position.index]?.[4] ?? 'q'] ?? '' })}` : ''}</p> : null}{unlocked ? <><p>{m().games.castle.quests[quest.id].lesson}</p><Button onClick={onNext}>{room === total - 1 ? m().games.castle.finish : m().games.castle.next}</Button></> : <Button variant="secondary" onClick={() => { if (!shownHint) errors.current += 1; setShownHint(true); }}>{m().games.hint}</Button>}</Card><p className="text-sm text-muted">{m().games.castle.scoring}</p></GameLayout>;
}
