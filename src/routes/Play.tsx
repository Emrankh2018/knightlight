import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Board, { type PromotionPiece } from '../components/Board';
import Button from '../components/Button';
import PlaySetup, { type PlaySettings } from '../components/play/PlaySetup';
import PromotionPicker from '../components/play/PromotionPicker';
import SoundToggle from '../components/SoundToggle';
import { createBot, fallbackMove, type Bot } from '../engine/client';
import type { BotLevelId } from '../engine/level-ids';
import { fmt, m } from '../i18n';
import {
  MAX_HINTS,
  MIN_PLAYER_MOVES_FOR_XP,
  boardResult,
  playOn,
  playerMoveCount,
  positionKeys,
  replay,
  resolveColor,
  resultFor,
  splitUci,
  undoCount,
  type Color,
  type GameOver,
  type PlayedMove,
} from '../lib/play';
import { playMoveSound, playSound } from '../lib/sound';
import { XP_RULES, type GameResult } from '../lib/xp';
import { useProgress } from '../store/progress';

/** Board width: as tall as the viewport allows below the header, never narrower than 16rem. */
const BOARD_SIZE = 'max(16rem, min(100%, calc(100dvh - 8rem)))';
/** The bot never answers faster than this, so its move is easy to follow. */
const MIN_THINK_MS = 450;
const HINT_LEVEL: BotLevelId = 'queen';
const OFF_HOVER = 'aria-disabled:hover:bg-surface aria-disabled:hover:text-ink dark:aria-disabled:hover:bg-surface dark:aria-disabled:hover:text-amber';

interface Game {
  id: number;
  level: BotLevelId;
  player: Color;
  moves: PlayedMove[];
  /** Set when the game ended off the board: resignation or the clock. */
  ended: GameOver | null;
  clockMinutes: number;
}

interface Hint {
  fen: string;
  from: string;
  to: string;
}

type Confirm = 'resign' | 'new' | null;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function Play() {
  const [settings, setSettings] = useState<PlaySettings>({ level: 'pawn', color: 'w', clock: 0 });
  const [game, setGame] = useState<Game | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [hintBusy, setHintBusy] = useState(false);
  const [hintFailed, setHintFailed] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [clockMs, setClockMs] = useState(0);
  const [promoting, setPromoting] = useState(false);

  const botRef = useRef<Bot | null>(null);
  const clockLeft = useRef(0);
  const nextId = useRef(1);
  const awardedFor = useRef<number | null>(null);
  const promoResolve = useRef<((piece: PromotionPiece | null) => void) | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const recordBotGame = useProgress((s) => s.recordBotGame);

  const getBot = useCallback((): Bot => {
    botRef.current ??= createBot();
    return botRef.current;
  }, []);

  useEffect(
    () => () => {
      botRef.current?.dispose();
      botRef.current = null;
      promoResolve.current?.(null);
    },
    [],
  );

  const moves = game?.moves;
  const chess = useMemo(() => (moves ? replay(moves) : null), [moves]);
  const fen = chess?.fen() ?? '';
  const over: GameOver | null = game ? (game.ended ?? (chess ? boardResult(chess) : null)) : null;
  const playerTurn = game !== null && chess !== null && chess.turn() === game.player;
  const lastMove = moves && moves.length > 0 ? moves[moves.length - 1] : undefined;
  const clockOn = game !== null && game.clockMinutes > 0;
  const gameId = game?.id;
  const level = game?.level;
  const botToMove = gameId !== undefined && over === null && !playerTurn;
  /** The bot is on the move: it is thinking until its reply lands. */
  const thinking = botToMove;

  /** Bot reply. Cancelled whenever the moves, the game or the page change under it. */
  useEffect(() => {
    if (!botToMove || !moves || !level) return;
    let cancelled = false;
    const position = replay(moves).fen();
    const keys = positionKeys(moves);
    void (async () => {
      let uci: string;
      try {
        const [reply] = await Promise.all([getBot().move(position, level, keys), sleep(MIN_THINK_MS)]);
        uci = reply.uci;
      } catch {
        if (cancelled) return;
        try {
          uci = fallbackMove(position).uci;
        } catch {
          return;
        }
      }
      if (cancelled) return;
      const { from, to, promotion } = splitUci(uci);
      const next = playOn(moves, from, to, promotion);
      if (!next) return;
      setGame((g) => (g && g.id === gameId && g.moves === moves ? { ...g, moves: next } : g));
      playMoveSound((next[next.length - 1] as PlayedMove).san);
    })();
    return () => {
      cancelled = true;
    };
  }, [botToMove, gameId, moves, level, getBot]);

  /** The player's clock runs only on the player's turn. */
  const running = clockOn && playerTurn && over === null;
  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      clockLeft.current = Math.max(0, clockLeft.current - (now - last));
      last = now;
      setClockMs(clockLeft.current);
      if (clockLeft.current <= 0) {
        setGame((g) => (g && !g.ended ? { ...g, ended: { reason: 'time', winner: g.player === 'w' ? 'b' : 'w' } } : g));
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [running]);

  /** XP for the finished game, or 0 when it ended off the board before the player had really played. */
  const xpGained =
    game && over && !((over.reason === 'resign' || over.reason === 'time') && playerMoveCount(game.moves, game.player) < MIN_PLAYER_MOVES_FOR_XP)
      ? XP_RULES.game[resultFor(over, game.player)]
      : 0;
  const gameKey = game?.id;
  const gameLevel = game?.level;
  const gameResult: GameResult | null = game && over ? resultFor(over, game.player) : null;

  /** Records the finished game once. Undo is off after the end, so a game ends only once. */
  useEffect(() => {
    if (gameKey === undefined || !gameLevel || !gameResult || xpGained === 0 || awardedFor.current === gameKey) return;
    awardedFor.current = gameKey;
    recordBotGame(gameLevel, gameResult);
  }, [gameKey, gameLevel, gameResult, xpGained, recordBotGame]);

  useEffect(() => {
    if (over) resultRef.current?.focus();
  }, [over]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [moves?.length]);

  const startGame = (): void => {
    const id = nextId.current++;
    setGame({ id, level: settings.level, player: resolveColor(settings.color), moves: [], ended: null, clockMinutes: settings.clock });
    clockLeft.current = settings.clock * 60_000;
    setClockMs(clockLeft.current);
    setFlipped(false);
    setHint(null);
    setHintsLeft(MAX_HINTS);
    setHintFailed(false);
    setConfirm(null);
    window.setTimeout(() => boardRef.current?.focus(), 0);
  };

  const leave = (): void => {
    promoResolve.current?.(null);
    setGame(null);
    setConfirm(null);
  };

  const interactive = playerTurn && over === null && !thinking && !promoting;

  const onMove = (from: string, to: string, promotion?: PromotionPiece): boolean => {
    if (!interactive || !game) return false;
    const next = playOn(game.moves, from, to, promotion);
    if (!next) return false;
    setGame({ ...game, moves: next });
    setHint(null);
    setHintFailed(false);
    setConfirm(null);
    playMoveSound((next[next.length - 1] as PlayedMove).san);
    return true;
  };

  const promotion = (): Promise<PromotionPiece | null> =>
    new Promise((resolve) => {
      setPromoting(true);
      promoResolve.current = (piece) => {
        promoResolve.current = null;
        setPromoting(false);
        resolve(piece);
        window.setTimeout(() => boardRef.current?.focus(), 0);
      };
    });

  const undo = (): void => {
    if (!game || thinking || over) return;
    const n = undoCount(game.moves, game.player);
    if (n === 0) return;
    setGame({ ...game, moves: game.moves.slice(0, game.moves.length - n), ended: null });
    setHint(null);
    setConfirm(null);
  };

  const resign = (): void => {
    if (!game) return;
    setGame({ ...game, ended: { reason: 'resign', winner: game.player === 'w' ? 'b' : 'w' } });
    setConfirm(null);
  };

  const askHint = (): void => {
    if (hintsLeft === 0 || hintBusy) return;
    const asked = fen;
    setHintBusy(true);
    setHintFailed(false);
    getBot()
      .move(asked, HINT_LEVEL)
      .then(
        (mv) => {
          const { from, to } = splitUci(mv.uci);
          setHint({ fen: asked, from, to });
          setHintsLeft((n) => n - 1);
          playSound('hint');
        },
        () => setHintFailed(true),
      )
      .finally(() => setHintBusy(false));
  };

  const playAgain = (): void => {
    if (game) setSettings((s) => ({ ...s, level: game.level }));
    startGame();
  };

  if (!game || !chess) {
    return <PlaySetup value={settings} onChange={setSettings} onStart={startGame} />;
  }

  const t = m().play;
  const levelName = t.levels[game.level].name;
  const result = over ? resultFor(over, game.player) : null;
  const orientation = (game.player === 'w') !== flipped ? 'white' : 'black';
  const activeHint = hint && hint.fen === fen && !over ? hint : null;
  const pairs: { n: number; white?: string; black?: string }[] = [];
  game.moves.forEach((mv, i) => {
    if (i % 2 === 0) pairs.push({ n: i / 2 + 1, white: mv.san });
    else (pairs[pairs.length - 1] as { black?: string }).black = mv.san;
  });
  const status = over ? '' : !playerTurn ? fmt(t.thinking, { name: levelName }) : chess.inCheck() ? t.yourTurnCheck : t.yourTurn;
  const canUndo = !thinking && !over && undoCount(game.moves, game.player) > 0;
  const hintOff = !interactive || hintsLeft === 0 || hintBusy;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div>
        <Board
          ref={boardRef}
          fen={fen}
          orientation={orientation}
          interactive={interactive}
          onMove={onMove}
          promotion={promotion}
          lastMove={lastMove ? { from: lastMove.from, to: lastMove.to, san: lastMove.san } : undefined}
          arrows={activeHint ? [{ from: activeHint.from, to: activeHint.to, color: 'G' }] : []}
          size={BOARD_SIZE}
          ariaLabel={t.boardLabel}
        />
      </div>
      <div className="space-y-4 rounded-2xl border-2 border-line bg-surface p-4 text-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold">{t.title}</h1>
          <SoundToggle />
        </div>
        <p className="font-bold text-muted">{fmt(t.playing, { color: game.player === 'w' ? t.white : t.black, name: levelName })}</p>
        {clockOn ? <p className="text-xl font-extrabold tabular-nums">{fmt(t.clockLabel, { time: formatClock(clockMs) })}</p> : null}

        <div role="status" aria-live="polite" className="min-h-8 font-bold">
          {status ? (
            <span>
              {status}
              {thinking ? (
                <span aria-hidden="true" className="ms-1 inline-block motion-safe:animate-pulse">
                  ...
                </span>
              ) : null}
            </span>
          ) : null}
          {activeHint ? <span className="block text-muted">{fmt(t.hintText, { from: activeHint.from, to: activeHint.to })}</span> : null}
          {hintFailed ? <span className="block text-muted">{t.hintFailed}</span> : null}
        </div>

        {over && result ? (
          <section aria-labelledby="play-result" className="space-y-2 rounded-xl border-2 border-leaf bg-leaf/15 p-4">
            <h2 id="play-result" ref={resultRef} tabIndex={-1} className="text-2xl font-extrabold outline-none">
              {t.resultTitle[result]}
            </h2>
            <p>{t.reasons[over.reason]}</p>
            <p>{t.resultEncourage[result]}</p>
            {xpGained > 0 ? <p className="font-extrabold">{fmt(t.xp, { xp: xpGained })}</p> : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={playAgain}>{t.playAgain}</Button>
              <Button variant="secondary" onClick={leave}>
                {t.changeLevel}
              </Button>
            </div>
          </section>
        ) : null}

        {promoting ? <PromotionPicker onPick={(piece) => promoResolve.current?.(piece)} /> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (canUndo) undo();
            }}
            aria-disabled={!canUndo}
            title={t.undoHelp}
            className={OFF_HOVER}
          >
            {t.undo}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (!hintOff) askHint();
            }}
            aria-disabled={hintOff}
            className={OFF_HOVER}
          >
            {hintsLeft === 0 ? t.hintNone : fmt(t.hint, { n: hintsLeft })}
          </Button>
          <Button variant="secondary" onClick={() => setFlipped((f) => !f)}>
            {t.flip}
          </Button>
          {over ? null : (
            <Button variant="secondary" onClick={() => setConfirm('resign')}>
              {t.resign}
            </Button>
          )}
          {over ? null : (
            <Button variant="ghost" onClick={() => (game.moves.length > 0 ? setConfirm('new') : leave())}>
              {t.newGame}
            </Button>
          )}
        </div>

        {confirm ? (
          <div role="alertdialog" aria-label={confirm === 'resign' ? t.confirmResign : t.confirmNew} className="space-y-2 rounded-xl border-2 border-coral bg-coral/15 p-3">
            <p className="font-bold">{confirm === 'resign' ? t.confirmResign : t.confirmNew}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={confirm === 'resign' ? resign : leave}>
                {t.yes}
              </Button>
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                {t.keepPlaying}
              </Button>
            </div>
          </div>
        ) : null}

        <div>
          <h2 className="mb-1 text-xl font-extrabold">{t.moves}</h2>
          {pairs.length === 0 ? (
            <p className="text-muted">{t.noMoves}</p>
          ) : (
            <ol ref={listRef} aria-label={t.moves} className="max-h-48 space-y-0.5 overflow-auto pe-1 tabular-nums">
              {pairs.map((p) => (
                <li key={p.n} className="flex gap-3">
                  <span className="w-8 text-muted">{p.n}.</span>
                  <span className="w-20 font-bold">{p.white}</span>
                  <span className="w-20 font-bold">{p.black ?? ''}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <p className="text-sm text-muted">{t.shortcuts}</p>
      </div>
    </div>
  );
}
