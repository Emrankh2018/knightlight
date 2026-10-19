import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { createBot, fallbackMove, moveSync, NoLegalMoveError, type WorkerLike } from '../src/engine/client.ts';
import { LEVEL_IDS, LEVELS, chooseMove, type BotLevelId } from '../src/engine/levels.ts';
import { positionKey } from '../src/engine/position-key.ts';
import { findBestMove } from '../src/engine/search.ts';
import { boardResult, playOn, playerMoveCount, positionKeys, replay, resultFor, undoCount, type PlayedMove } from '../src/lib/play.ts';
import { XP_RULES, xpFor } from '../src/lib/xp.ts';

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uciMove = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}) });
const legalFor = (fen: string): string[] => new Chess(fen).moves({ verbose: true }).map((x) => x.lan);

describe('bot plays only legal moves', () => {
  // Deeper levels are slow, so they get fewer games and plies.
  const plan: Record<BotLevelId, { games: number; plies: number }> = {
    pawn: { games: 12, plies: 40 },
    knight: { games: 8, plies: 30 },
    bishop: { games: 4, plies: 20 },
    rook: { games: 2, plies: 8 },
    queen: { games: 1, plies: 6 },
  };
  for (const id of LEVEL_IDS) {
    it(`level ${LEVELS[id].level} (${id}) against a random mover`, { timeout: 120_000 }, () => {
      const rng = seeded(100 + LEVELS[id].level);
      let botMoves = 0;
      for (let g = 0; g < plan[id].games; g++) {
        const chess = new Chess();
        const history: string[] = [positionKey(chess.fen())];
        const botColor = g % 2 === 0 ? 'w' : 'b';
        for (let ply = 0; ply < plan[id].plies && !chess.isGameOver(); ply++) {
          if (chess.turn() === botColor) {
            const mv = chooseMove(chess.fen(), id, rng, history);
            expect(mv).not.toBeNull();
            const uci = (mv as { uci: string }).uci;
            expect(legalFor(chess.fen())).toContain(uci);
            chess.move(uciMove(uci));
            botMoves++;
          } else {
            const options = chess.moves();
            chess.move(options[Math.floor(rng() * options.length)] as string);
          }
          history.push(positionKey(chess.fen()));
        }
      }
      expect(botMoves).toBeGreaterThan(0);
    });
  }
});

describe('mate in one', () => {
  const positions = [
    '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    '7k/8/6K1/8/8/8/8/Q7 w - - 0 1',
  ];
  for (const id of LEVEL_IDS) {
    it(`level ${LEVELS[id].level} takes it even when the rng would blunder`, () => {
      for (const fen of positions) {
        for (const rng of [() => 0, () => 0.99, seeded(3)]) {
          const mv = moveSync(fen, id, rng);
          const chess = new Chess(fen);
          chess.move(uciMove(mv.uci));
          expect(chess.isCheckmate()).toBe(true);
        }
      }
    });
  }
});

describe('search option sanitising', () => {
  const fen = '4k3/8/8/8/8/8/3Q4/4K3 w - - 0 1';
  for (const depth of [Number.NaN, -3, 0, Infinity, 2.7]) {
    it(`survives depth ${depth}`, { timeout: 30_000 }, () => {
      const r = findBestMove(fen, { depth, timeMs: 200, randomness: Number.NaN, blunderChance: 0, rng: seeded(1) });
      expect(r).not.toBeNull();
      expect(legalFor(fen)).toContain((r as { uci: string }).uci);
    });
  }
  it('survives a NaN time budget', () => {
    expect(findBestMove(fen, { depth: 2, timeMs: Number.NaN, randomness: 0, blunderChance: 0, rng: seeded(1) })).not.toBeNull();
  });
  it('rejects an unknown level with a clear error', () => {
    expect(() => chooseMove(fen, 'nope' as never)).toThrow(/Unknown bot level/);
  });
});

describe('repetition avoidance', () => {
  const fen = '4k3/8/8/8/8/8/3Q4/4K3 w - - 0 1';
  const base = { depth: 3, timeMs: 5000, randomness: 0, blunderChance: 0 };
  const keyAfter = (from: string, uci: string): string => {
    const c = new Chess(from);
    c.move(uciMove(uci));
    return positionKey(c.fen());
  };

  it('plays a different winning move when the best one repeats a position', () => {
    const first = findBestMove(fen, { ...base, rng: seeded(1) }) as { uci: string };
    const second = findBestMove(fen, { ...base, rng: seeded(1), avoidRepeats: true, history: [keyAfter(fen, first.uci)] }) as { uci: string; score: number };
    expect(second.uci).not.toBe(first.uci);
    expect(second.score).toBeGreaterThan(100);
  });

  it('ignores history when avoidRepeats is off', () => {
    const first = findBestMove(fen, { ...base, rng: seeded(1) }) as { uci: string };
    const again = findBestMove(fen, { ...base, rng: seeded(1), history: [keyAfter(fen, first.uci)] }) as { uci: string };
    expect(again.uci).toBe(first.uci);
  });

  it('keeps the same move when the position is not winning', () => {
    const equal = '4k3/8/8/8/8/8/8/K3r3 w - - 0 1';
    const a = findBestMove(equal, { ...base, depth: 2, rng: seeded(2) }) as { uci: string; score: number };
    expect(a.score).toBeLessThan(200);
    const b = findBestMove(equal, { ...base, depth: 2, rng: seeded(2), avoidRepeats: true, history: [keyAfter(equal, a.uci)] }) as { uci: string };
    expect(b.uci).toBe(a.uci);
  });

  it('a level 4 bot with the queen up does not shuffle into a threefold repetition', { timeout: 60_000 }, () => {
    const chess = new Chess(fen);
    const keys: string[] = [positionKey(chess.fen())];
    const rng = seeded(5);
    for (let ply = 0; ply < 30 && !chess.isGameOver(); ply++) {
      const uci = chess.turn() === 'w' ? moveSync(chess.fen(), 'rook', rng, keys).uci : (chess.moves({ verbose: true })[0] as { lan: string }).lan;
      chess.move(uciMove(uci));
      keys.push(positionKey(chess.fen()));
    }
    expect(chess.isThreefoldRepetition()).toBe(false);
  });
});

describe('engine client robustness', () => {
  const START = new Chess().fen();

  function silentWorker(): WorkerLike & { terminated: boolean } {
    return {
      terminated: false,
      addEventListener() {},
      postMessage() {},
      terminate() {
        this.terminated = true;
      },
    };
  }

  it('falls back to a legal main-thread move when the worker never answers', async () => {
    const worker = silentWorker();
    const bot = createBot({ timeoutMs: 40, createWorker: () => worker });
    const mv = await bot.move(START, 'queen');
    expect(legalFor(START)).toContain(mv.uci);
    expect(bot.broken).toBe(true);
    expect(worker.terminated).toBe(true);
    const again = await bot.move(START, 'pawn');
    expect(legalFor(START)).toContain(again.uci);
  });

  it('falls back when the worker cannot be created', async () => {
    const bot = createBot({
      createWorker: () => {
        throw new Error('no workers here');
      },
    });
    expect(bot.broken).toBe(true);
    const mv = await bot.move(START, 'knight');
    expect(legalFor(START)).toContain(mv.uci);
  });

  it('falls back when the worker reports an error', async () => {
    let fail: () => void = () => undefined;
    const worker: WorkerLike = {
      addEventListener(type: string, listener: unknown) {
        if (type === 'error') fail = listener as () => void;
      },
      postMessage() {
        fail();
      },
      terminate() {},
    };
    const bot = createBot({ createWorker: () => worker });
    const mv = await bot.move(START, 'bishop');
    expect(legalFor(START)).toContain(mv.uci);
    expect(bot.broken).toBe(true);
  });

  it('uses the worker reply, and rejects with NoLegalMoveError at the end of a game', async () => {
    let onMessage: (e: MessageEvent) => void = () => undefined;
    const worker: WorkerLike = {
      addEventListener(type: string, listener: unknown) {
        if (type === 'message') onMessage = listener as (e: MessageEvent) => void;
      },
      postMessage(req) {
        onMessage({ data: req.fen === START ? { id: req.id, uci: 'e2e4', san: 'e4' } : { id: req.id, error: 'no-legal-move' } } as MessageEvent);
      },
      terminate() {},
    };
    const bot = createBot({ timeoutMs: 1000, createWorker: () => worker });
    expect(await bot.move(START, 'pawn')).toEqual({ uci: 'e2e4', san: 'e4' });
    const mated = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    await expect(bot.move(mated, 'pawn')).rejects.toBeInstanceOf(NoLegalMoveError);
    expect(bot.broken).toBe(false);
  });

  it('the fallback takes a mate in one and rejects a finished game', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
    const c = new Chess(fen);
    c.move(uciMove(fallbackMove(fen).uci));
    expect(c.isCheckmate()).toBe(true);
    expect(() => fallbackMove('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')).toThrow(NoLegalMoveError);
  });
});

describe('game helpers', () => {
  const play = (sans: string[]): PlayedMove[] => {
    const c = new Chess();
    return sans.map((s) => {
      const mv = c.move(s);
      return { from: mv.from, to: mv.to, san: mv.san };
    });
  };

  it('detects checkmate, stalemate, insufficient material, threefold and fifty moves', () => {
    expect(boardResult(replay(play(['f3', 'e5', 'g4', 'Qh4#'])))).toEqual({ reason: 'checkmate', winner: 'b' });
    expect(boardResult(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toEqual({ reason: 'stalemate', winner: null });
    expect(boardResult(new Chess('8/8/4k3/8/8/3K4/8/8 w - - 0 1'))?.reason).toBe('insufficient');
    expect(boardResult(replay(play(['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'])))?.reason).toBe('threefold');
    expect(boardResult(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 100 80'))?.reason).toBe('fiftyMoves');
    expect(boardResult(new Chess())).toBeNull();
  });

  it('undo takes back the last full move pair for either colour', () => {
    expect(undoCount(play(['e4', 'e5']), 'w')).toBe(2);
    expect(undoCount(play(['e4']), 'b')).toBe(0);
    expect(undoCount(play(['e4', 'e5', 'Nf3']), 'b')).toBe(2);
    expect(undoCount(play(['e4', 'e5', 'Nf3']), 'w')).toBe(1);
    expect(undoCount([], 'w')).toBe(0);
  });

  it('counts player moves and maps results', () => {
    expect(playerMoveCount(play(['e4', 'e5', 'Nf3']), 'w')).toBe(2);
    expect(playerMoveCount(play(['e4', 'e5', 'Nf3']), 'b')).toBe(1);
    expect(resultFor({ reason: 'checkmate', winner: 'w' }, 'w')).toBe('win');
    expect(resultFor({ reason: 'checkmate', winner: 'w' }, 'b')).toBe('loss');
    expect(resultFor({ reason: 'stalemate', winner: null }, 'b')).toBe('draw');
  });

  it('playOn rejects illegal moves and records promotions', () => {
    expect(playOn([], 'e2', 'e5')).toBeNull();
    expect(playOn([], 'e2', 'e4')?.[0]?.san).toBe('e4');
    expect(positionKeys(play(['e4'])).length).toBe(2);
  });

  it('awards 20 / 10 / 5 XP for a win / draw / loss', () => {
    expect([XP_RULES.game.win, XP_RULES.game.draw, XP_RULES.game.loss]).toEqual([20, 10, 5]);
    expect(xpFor({ type: 'game', result: 'draw' })).toBe(10);
  });
});
