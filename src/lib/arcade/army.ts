import { Chess, type Color, type Move, type Square } from 'chess.js';
import type { PlayedMove } from '../play';

export const ARMY_BUDGET = 9;
export const ARMY_PRICES = { q: 9, r: 5, b: 3, n: 3 } as const;
export type ArmyPiece = keyof typeof ARMY_PRICES;
export const ARMY_PIECES = ['q', 'r', 'b', 'n'] as const satisfies readonly ArmyPiece[];

const MIN_SPEND = 8;
const HOME_FILES = { q: 'd', r: 'a', b: 'cfh', n: 'bgh' } as const;
const BOT_ARMIES: readonly (readonly ArmyPiece[])[] = [['q'], ['r', 'n'], ['r', 'b'], ['b', 'b', 'n'], ['n', 'n', 'n']];

export function armyCost(army: readonly ArmyPiece[]): number {
  return army.reduce((total, piece) => total + ARMY_PRICES[piece], 0);
}

export function canFieldArmy(army: readonly ArmyPiece[]): boolean {
  const spent = armyCost(army);
  return spent >= MIN_SPEND && spent <= ARMY_BUDGET;
}

export function draftComputerArmy(): readonly ArmyPiece[] {
  return BOT_ARMIES[Math.floor(Math.random() * BOT_ARMIES.length)] ?? ['q'];
}

function placeArmy(chess: Chess, color: Color, army: readonly ArmyPiece[]): void {
  const back = color === 'w' ? '1' : '8';
  const front = color === 'w' ? '2' : '7';
  chess.put({ type: 'k', color }, `e${back}`);
  for (const file of ['a', 'd', 'e', 'h'] as const) chess.put({ type: 'p', color }, `${file}${front}`);
  // Each kind has its usual home square first, then spaces for extra copies.
  for (const piece of ARMY_PIECES) {
    const count = army.filter((pick) => pick === piece).length;
    for (const file of HOME_FILES[piece].slice(0, count)) chess.put({ type: piece, color }, `${file}${back}` as Square);
  }
}

export function armyStart(white: readonly ArmyPiece[], black: readonly ArmyPiece[]): string {
  if (!canFieldArmy(white) || !canFieldArmy(black)) throw new Error('Army is outside the draft budget.');
  const chess = new Chess();
  chess.clear();
  placeArmy(chess, 'w', white);
  placeArmy(chess, 'b', black);
  return chess.fen();
}

/** Replay from the draft so normal draw detection includes the entire match history. */
export function replayArmy(start: string, moves: readonly PlayedMove[]): Chess {
  const chess = new Chess(start);
  for (const { from, to, promotion } of moves) chess.move({ from, to, promotion });
  return chess;
}

export function findArmyMove(chess: Chess, from: string, to: string, promotion?: string): Move | undefined {
  return chess.moves({ square: from as Square, verbose: true }).find((move) => move.to === to && move.promotion === promotion);
}
