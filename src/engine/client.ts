import { chooseMove, LEVELS, type BotLevelId, type BotMove } from './levels.ts';
import { findBestMove } from './search.ts';
import type { BotRequest, BotResponse } from './worker.ts';

/** Thrown (rejected) when the side to move is checkmated or stalemated. */
export class NoLegalMoveError extends Error {
  constructor() {
    super('No legal move: the game is over.');
    this.name = 'NoLegalMoveError';
  }
}

/** Rejected for a request that a newer request replaced before it was answered (latest request wins). */
export class BotCancelledError extends Error {
  constructor() {
    super('Superseded by a newer request.');
    this.name = 'BotCancelledError';
  }
}

export interface Bot {
  /** `history` holds the position keys already seen in the game (see `positionKey`). */
  move(fen: string, level: BotLevelId, history?: readonly string[]): Promise<BotMove>;
  /** True once the worker failed or timed out; every later move comes from the main-thread fallback. */
  readonly broken: boolean;
  dispose(): void;
}

/** Synchronous fallback for tests and non-worker environments. Throws NoLegalMoveError at game end. */
export function moveSync(fen: string, level: BotLevelId, rng: () => number = Math.random, history: readonly string[] = []): BotMove {
  const move = chooseMove(fen, level, rng, history);
  if (move === null) throw new NoLegalMoveError();
  return move;
}

/** Quick, shallow main-thread move used when the worker is unusable. Always legal; takes a mate in one. */
export function fallbackMove(fen: string, rng: () => number = Math.random): BotMove {
  const result = findBestMove(fen, { depth: 2, timeMs: 150, randomness: 0.3, blunderChance: 0, rng });
  if (result === null) throw new NoLegalMoveError();
  return { uci: result.uci, san: result.san };
}

/** The part of a Worker the bot relies on, so tests can supply a fake. */
export interface WorkerLike {
  addEventListener(type: 'message', listener: (event: MessageEvent<BotResponse>) => void): void;
  addEventListener(type: 'error', listener: () => void): void;
  postMessage(message: BotRequest): void;
  terminate(): void;
}

export interface BotOptions {
  /** Fixed longest wait for one worker reply once the worker is working on it. Default: the level's time budget plus a margin, at least 3 s. */
  timeoutMs?: number;
  /** Creates the worker. Defaults to the bundled module worker. May throw. */
  createWorker?: () => WorkerLike;
}

const MIN_TIMEOUT_MS = 3000;
const TIMEOUT_MARGIN_MS = 1500;

interface Pending {
  request: BotRequest;
  resolve: (m: BotMove) => void;
  reject: (e: Error) => void;
}

/** A request the worker has not answered yet, with how long it may take once it is the one being worked on. */
interface Outstanding {
  id: number;
  timeoutMs: number;
}

function defaultWorker(): WorkerLike {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
}

/**
 * Creates a bot backed by a module Web Worker so searching never blocks the UI.
 * If the worker cannot start, crashes or does not answer in time, the bot is marked
 * broken and answers from a shallow main-thread search instead, so a game never stalls.
 */
export function createBot(options: BotOptions = {}): Bot {
  const pending = new Map<number, Pending>();
  /** Requests posted to the worker and not yet answered, oldest first. The worker handles them in order. */
  const outstanding: Outstanding[] = [];
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let nextId = 1;
  let disposed = false;
  let broken = false;
  let worker: WorkerLike | null = null;

  /** Times only the request the worker is on now, so time spent queued behind another never counts. */
  const rearm = (): void => {
    clearTimeout(watchdog);
    watchdog = undefined;
    const head = outstanding[0];
    if (head && worker) watchdog = setTimeout(breakWorker, head.timeoutMs);
  };

  const answerFromFallback = (p: Pending): void => {
    try {
      p.resolve(fallbackMove(p.request.fen));
    } catch (err) {
      p.reject(err instanceof NoLegalMoveError ? err : new Error('Bot failed'));
    }
  };

  function breakWorker(): void {
    clearTimeout(watchdog);
    watchdog = undefined;
    outstanding.length = 0;
    broken = true;
    worker?.terminate();
    worker = null;
    const waiting = [...pending.values()];
    pending.clear();
    for (const p of waiting) answerFromFallback(p);
  }

  try {
    worker = (options.createWorker ?? defaultWorker)();
    worker.addEventListener('message', (event: MessageEvent<BotResponse>) => {
      const res = event.data;
      const at = outstanding.findIndex((o) => o.id === res.id);
      if (at >= 0) outstanding.splice(0, at + 1);
      rearm();
      const entry = pending.get(res.id);
      if (!entry) return;
      pending.delete(res.id);
      if (!('error' in res)) entry.resolve({ uci: res.uci, san: res.san });
      else if (res.error === 'no-legal-move') entry.reject(new NoLegalMoveError());
      else answerFromFallback(entry);
    });
    worker.addEventListener('error', breakWorker);
  } catch {
    broken = true;
    worker = null;
  }

  return {
    get broken() {
      return broken;
    },
    move(fen, level, history = []) {
      if (disposed) return Promise.reject(new Error('Bot disposed'));
      return new Promise<BotMove>((resolve, reject) => {
        const id = nextId++;
        const request: BotRequest = { id, fen, level, history: [...history] };
        const entry: Pending = { request, resolve, reject };
        if (broken || !worker) {
          answerFromFallback(entry);
          return;
        }
        for (const old of pending.values()) old.reject(new BotCancelledError());
        pending.clear();
        pending.set(id, entry);
        outstanding.push({ id, timeoutMs: options.timeoutMs ?? Math.max(MIN_TIMEOUT_MS, LEVELS[level].timeMs + TIMEOUT_MARGIN_MS) });
        if (outstanding.length === 1) rearm();
        try {
          worker.postMessage(request);
        } catch {
          breakWorker();
        }
      });
    },
    dispose() {
      disposed = true;
      clearTimeout(watchdog);
      outstanding.length = 0;
      for (const p of pending.values()) p.reject(new Error('Bot disposed'));
      pending.clear();
      worker?.terminate();
      worker = null;
    },
  };
}
