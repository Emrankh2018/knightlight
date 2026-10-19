/// <reference lib="webworker" />
import { chooseMove, type BotLevelId } from './levels.ts';

export interface BotRequest {
  id: number;
  fen: string;
  level: BotLevelId;
  /** Position keys already seen in the game. */
  history?: string[];
}

export type BotResponse =
  | { id: number; uci: string; san: string }
  | { id: number; error: 'no-legal-move' | 'failed' | 'cancelled'; message?: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const queue: BotRequest[] = [];
let scheduled = false;

/** Requests that arrived while the worker was busy: only the newest is searched, the older ones are answered as cancelled. */
function drain(): void {
  scheduled = false;
  const batch = queue.splice(0);
  const newest = batch.pop();
  for (const old of batch) ctx.postMessage({ id: old.id, error: 'cancelled' } satisfies BotResponse);
  if (newest) answer(newest);
}

ctx.addEventListener('message', (event: MessageEvent<BotRequest>) => {
  queue.push(event.data);
  if (!scheduled) {
    scheduled = true;
    setTimeout(drain, 0);
  }
});

function answer({ id, fen, level, history }: BotRequest): void {
  let response: BotResponse;
  try {
    const move = chooseMove(fen, level, Math.random, history ?? []);
    response = move ? { id, ...move } : { id, error: 'no-legal-move' };
  } catch (err) {
    response = { id, error: 'failed', message: err instanceof Error ? err.message : String(err) };
  }
  ctx.postMessage(response);
}
