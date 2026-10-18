/// <reference lib="webworker" />
import { chooseMove, type BotLevelId } from './levels.ts';

export interface BotRequest {
  id: number;
  fen: string;
  level: BotLevelId;
}

export type BotResponse =
  | { id: number; uci: string; san: string }
  | { id: number; error: 'no-legal-move' | 'failed'; message?: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', (event: MessageEvent<BotRequest>) => {
  const { id, fen, level } = event.data;
  let response: BotResponse;
  try {
    const move = chooseMove(fen, level);
    response = move ? { id, ...move } : { id, error: 'no-legal-move' };
  } catch (err) {
    response = { id, error: 'failed', message: err instanceof Error ? err.message : String(err) };
  }
  ctx.postMessage(response);
});
