import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board, { type PromotionPiece } from '../Board';
import Button from '../Button';
import Card from '../Card';
import { fmt, m } from '../../i18n';
import { DETECTIVE_CASES, tryDetectiveCapture } from '../../lib/games';
import { useProgress } from '../../store/progress';
import SelectionBoard, { type SelectionPiece } from './SelectionBoard';
import { Completed, GameHeader, GameLayout, Stars, useGameSave } from './shared';

type Case = typeof DETECTIVE_CASES[number];

export default function ChessDetective({ profileId }: { profileId: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const progress = useProgress((s) => s.data.games?.detective);
  const investigation = selected === null ? undefined : DETECTIVE_CASES[selected];
  return <><GameHeader game="detective" />{investigation && selected !== null ? <DetectiveRun key={`${investigation.id}-${attempt}`} investigation={investigation} index={selected} profileId={profileId} onChoose={() => setSelected(null)} onReplay={() => setAttempt((n) => n + 1)} onNext={selected < DETECTIVE_CASES.length - 1 ? () => setSelected(selected + 1) : undefined} /> : <div className="kl-game-selector space-y-4"><p className="text-lg">{m().games.detective.intro}</p><div className="kl-game-levels grid grid-cols-2 gap-3 sm:grid-cols-3">{DETECTIVE_CASES.map((item, i) => <Card key={item.id} className="space-y-3"><h2 className="text-xl font-extrabold">{fmt(m().games.detective.case, { number: i + 1 })}</h2><Stars count={progress?.[item.id]?.stars ?? 0} /><div><Button onClick={() => setSelected(i)}>{m().games.play}<span className="sr-only"> {fmt(m().games.detective.case, { number: i + 1 })}</span></Button></div></Card>)}</div></div>}</>;
}

function DetectiveRun({ investigation, index, profileId, onChoose, onReplay, onNext }: { investigation: Case; index: number; profileId: string; onChoose: () => void; onReplay: () => void; onNext?: () => void }) {
  const initial = useMemo(() => new Chess(investigation.fen), [investigation.fen]);
  const [phase, setPhase] = useState<'inspect' | 'capture' | 'solved'>('inspect');
  const phaseRef = useRef(phase);
  const [fen, setFen] = useState(investigation.fen);
  const [hinted, setHinted] = useState(false);
  const [message, setMessage] = useState('');
  const [wrong, setWrong] = useState(false);
  const mistakes = useRef(0);
  const assisted = useRef(false);
  const reward = useGameSave('detective', investigation.id, profileId);
  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase === 'capture') boardRef.current?.focus();
  }, [phase]);
  const orientation = initial.turn() === 'w' ? 'white' : 'black';
  const pieces: Record<string, SelectionPiece> = {};
  for (const row of initial.board()) for (const piece of row) if (piece) pieces[piece.square] = {
    color: piece.color,
    glyph: m().games.glyphs[`${piece.color}${piece.type}`] ?? '',
    name: `${piece.color === 'w' ? m().games.white : m().games.black} ${m().games.pieceNames[piece.type]}`,
  };
  const select = (square: string): void => {
    if (phaseRef.current !== 'inspect') return;
    if (square !== investigation.target) {
      mistakes.current += 1;
      setWrong(true);
      setMessage(m().games.detective.wrongClue);
      return;
    }
    phaseRef.current = 'capture';
    setPhase('capture');
    setHinted(false);
    setWrong(false);
    setMessage(m().games.detective.clue);
  };
  const move = (from: string, to: string, promotion?: PromotionPiece): boolean => {
    if (phaseRef.current !== 'capture') return false;
    const nextFen = tryDetectiveCapture(investigation, from, to, promotion);
    if (nextFen === null) {
      mistakes.current += 1;
      setWrong(true);
      setMessage(m().games.detective.wrongMove);
      return false;
    }
    phaseRef.current = 'solved';
    setPhase('solved');
    setFen(nextFen);
    setWrong(false);
    setMessage(m().games.detective.success);
    reward.save(!assisted.current && mistakes.current === 0 ? 3 : !assisted.current ? 2 : 1);
    return true;
  };
  const showHint = (): void => {
    assisted.current = true;
    setHinted(true);
    setWrong(false);
    setMessage(phase === 'inspect' ? fmt(m().games.detective.hintClue, { square: investigation.target }) : fmt(m().games.detective.hintMove, { from: investigation.from, to: investigation.to }));
  };
  return <GameLayout board={phase === 'inspect' ? <SelectionBoard label={m().games.detective.board} pieces={pieces} orientation={orientation} onSelect={select} hint={hinted ? investigation.target : null} /> : <Board ref={boardRef} fen={fen} orientation={orientation} interactive={phase === 'capture'} onMove={move} highlights={phase === 'capture' ? [{ square: investigation.target, color: 'Y' }] : []} arrows={hinted && phase === 'capture' ? [{ from: investigation.from, to: investigation.to, color: 'G' }] : []} ariaLabel={m().games.detective.captureBoard} size="var(--kl-games-board-size)" />}><Card className="space-y-3"><h2 className="text-2xl font-extrabold">{fmt(m().games.detective.challenge, { current: index + 1, total: DETECTIVE_CASES.length })}</h2><p className="text-lg">{phase === 'inspect' ? fmt(m().games.detective.inspectSimple, { color: orientation === 'white' ? m().games.white : m().games.black }) : phase === 'capture' ? m().games.detective.clue : fmt(m().games.detective.explanation, { square: investigation.target })}</p><p role="status" className={wrong ? 'font-bold text-error' : 'font-bold text-ok-text'}>{message}</p>{phase !== 'solved' ? <Button variant="secondary" onClick={showHint}>{m().games.hint}</Button> : null}<p className="text-sm text-muted">{fmt(m().games.detective.source, { id: investigation.sourceId })}</p></Card>{phase === 'solved' ? <Completed {...reward} onReplay={onReplay} next={onNext ? <Button onClick={onNext}>{m().games.detective.next}</Button> : undefined} /> : <p className="text-sm text-muted">{m().games.detective.scoring}</p>}<Button variant="ghost" onClick={onChoose}>{m().games.chooseLevel}</Button></GameLayout>;
}
