import { chooseMove, type BotLevelId, type BotMove } from './levels.ts';
import type { BotRequest, BotResponse } from './worker.ts';

/** Thrown (rejected) when the side to move is checkmated or stalemated. */
export class NoLegalMoveError extends Error {
  constructor() {
    super('No legal move: the game is over.');
    this.name = 'NoLegalMoveError';
  }
}

export interface Bot {
  move(fen: string, level: BotLevelId): Promise<BotMove>;
  dispose(): void;
}

/** Synchronous fallback for tests and non-worker environments. Throws NoLegalMoveError at game end. */
export function moveSync(fen: string, level: BotLevelId, rng: () => number = Math.random): BotMove {
  const move = chooseMove(fen, level, rng);
  if (move === null) throw new NoLegalMoveError();
  return move;
}

interface Pending {
  resolve: (m: BotMove) => void;
  reject: (e: Error) => void;
}

/** Creates a bot backed by a module Web Worker so searching never blocks the UI. */
export function createBot(): Bot {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<number, Pending>();
  let nextId = 1;
  let disposed = false;

  const failAll = (message: string): void => {
    for (const p of pending.values()) p.reject(new Error(message));
    pending.clear();
  };

  worker.addEventListener('message', (event: MessageEvent<BotResponse>) => {
    const res = event.data;
    const entry = pending.get(res.id);
    if (!entry) return;
    pending.delete(res.id);
    if ('error' in res) {
      entry.reject(res.error === 'no-legal-move' ? new NoLegalMoveError() : new Error(res.message ?? 'Bot failed'));
    } else {
      entry.resolve({ uci: res.uci, san: res.san });
    }
  });
  worker.addEventListener('error', () => failAll('Bot worker crashed'));

  return {
    move(fen, level) {
      if (disposed) return Promise.reject(new Error('Bot disposed'));
      return new Promise<BotMove>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        const req: BotRequest = { id, fen, level };
        worker.postMessage(req);
      });
    },
    dispose() {
      disposed = true;
      failAll('Bot disposed');
      worker.terminate();
    },
  };
}
