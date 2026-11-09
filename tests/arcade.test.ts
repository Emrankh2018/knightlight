import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { armyCost, armyStart, canFieldArmy, findArmyMove, replayArmy, type ArmyPiece } from '../src/lib/arcade/army';
import { chooseBossMove, playBossMove, startBoss } from '../src/lib/arcade/boss';
import { comboTurn, computerComboMove, endComboTurn, playComboMove, startComboGame } from '../src/lib/arcade/combo';

type Step = readonly [from: string, to: string];

function replay<T>(start: T, play: (state: T, from: string, to: string) => T | null, steps: readonly Step[]): T {
  return steps.reduce((state, [from, to]) => {
    const next = play(state, from, to);
    if (!next) throw new Error(`Expected ${from} to ${to} to be legal`);
    return next;
  }, start);
}

const bossPath = [['d4', 'd8'], ['a7', 'a8'], ['d8', 'a8'], ['d8', 'b8'], ['a8', 'b8']] as const;
const comboOpening = [['c1', 'h6'], ['c7', 'c6'], ['h6', 'g7']] as const;

describe('Boss Battle', () => {
  it('counts exactly three captures of the boss and adds two guards only on the final life', () => {
    const start = startBoss();
    const firstHit = replay(start, playBossMove, bossPath.slice(0, 1));
    expect(firstHit).toMatchObject({ lives: 2, event: 'returned', result: null, turn: 'b' });
    const finalLife = replay(firstHit, playBossMove, bossPath.slice(1, 3));
    expect(finalLife).toMatchObject({ lives: 1, event: 'guarded', result: null, turn: 'b' });
    const board = new Chess(finalLife.fen, { skipValidation: true });
    for (const square of ['c7', 'f7'] as const) expect(board.get(square)).toEqual({ type: 'p', color: 'b' });
    const win = replay(finalLife, playBossMove, bossPath.slice(3));
    expect(win).toMatchObject({ lives: 0, result: 'team' });
    expect(playBossMove(win, 'c7', 'c6')).toBeNull();
    expect(chooseBossMove(win)).toBeNull();
  });

  it('rejects illegal moves without altering the state and returns a legal bot reply only for Black', () => {
    const start = startBoss();
    const snapshot = structuredClone(start);
    expect(playBossMove(start, 'd4', 'e5')).toBeNull();
    expect(playBossMove(start, 'd8', 'd4')).toBeNull();
    expect(chooseBossMove(start)).toBeNull();
    expect(start).toEqual(snapshot);
    const replyPosition = replay(start, playBossMove, bossPath.slice(0, 1));
    const reply = chooseBossMove(replyPosition, () => 0.5);
    expect(reply?.color).toBe('b');
    if (!reply) throw new Error('Expected a boss reply');
    expect(playBossMove(replyPosition, reply.from, reply.to)).toMatchObject({ turn: 'w', lives: 2 });
  });

  it('keeps a promoted guard separate from the boss and detects when the party is wiped out', () => {
    const finalLife = { ...startBoss(), fen: '3q4/8/8/8/8/1R6/8/q7 w - - 0 1', lives: 1, queen: 'd8' as const };
    const afterGuard = replay(finalLife, playBossMove, [['b3', 'b1'], ['a1', 'b1']]);
    expect(afterGuard).toMatchObject({ lives: 1, result: 'boss', queen: 'd8' });
    const guardTaken = replay({ ...finalLife, fen: '3q4/8/8/8/8/8/8/qR6 w - - 0 1' }, playBossMove, [['b1', 'a1']]);
    expect(guardTaken).toMatchObject({ lives: 1, result: null, queen: 'd8' });
  });
});

describe('Combo Chess', () => {
  it('requires the same piece to capture, allows passing, and hands over after three captures', () => {
    const opening = replay(startComboGame(), playComboMove, comboOpening);
    expect(opening).toMatchObject({ chain: { from: 'g7', count: 1 }, captures: { w: 1, b: 0 } });
    expect(comboTurn(opening)).toBe('w');
    const snapshot = structuredClone(opening);
    expect(playComboMove(opening, 'g7', 'h8')).toBeNull();
    expect(playComboMove(opening, 'a2', 'a3')).toBeNull();
    expect(opening).toEqual(snapshot);
    const passed = endComboTurn(opening);
    expect(passed).toMatchObject({ chain: null, captures: { w: 1, b: 0 } });
    expect(comboTurn(passed)).toBe('b');
    const third = replay(opening, playComboMove, [['g7', 'f8'], ['f8', 'e7']]);
    expect(third).toMatchObject({ chain: null, captures: { w: 3, b: 0 } });
    expect(comboTurn(third)).toBe('b');
  });

  it('locks the round at five captures and provides a legal computer reply during play', () => {
    const blackTurn = replay(startComboGame(), playComboMove, comboOpening.slice(0, 1));
    const reply = computerComboMove(blackTurn, () => 0.5);
    expect(reply.fen).not.toBe(blackTurn.fen);
    if (!reply.lastMove) throw new Error('Expected a computer reply');
    expect(playComboMove(blackTurn, reply.lastMove.from, reply.lastMove.to)).toEqual(reply);
    const win = replay(startComboGame(), playComboMove, [
      ...comboOpening, ['g7', 'f8'], ['f8', 'e7'], ['c6', 'c5'], ['e7', 'd6'], ['a8', 'b8'], ['d6', 'c5'], ['c5', 'a7'],
    ]);
    expect(win).toMatchObject({ chain: null, outcome: 'w', captures: { w: 5, b: 0 } });
    expect(playComboMove(win, 'b8', 'a8')).toBeNull();
    expect(computerComboMove(win)).toBe(win);
  });
});

describe('Build Your Own Army', () => {
  it('uses the same budget for both sides and starts every eligible draft with legal kings and four pawns', () => {
    const armies = [['q'], ['r', 'n'], ['r', 'b'], ['b', 'b', 'b'], ['b', 'b', 'n'], ['b', 'n', 'n'], ['n', 'n', 'n']] as const satisfies readonly (readonly ArmyPiece[])[];
    for (const invalid of [[], ['r'], ['q', 'n'], ['r', 'r']] as const) {
      expect(canFieldArmy(invalid)).toBe(false);
      expect(() => armyStart(['q'], invalid)).toThrow();
    }
    for (const white of armies) {
      expect(armyCost(white)).toBeGreaterThanOrEqual(8);
      for (const black of armies) {
        const chess = new Chess(armyStart(white, black));
        const board = chess.board().flat();
        for (const [color, army] of [['w', white], ['b', black]] as const) {
          expect(board.filter((piece) => piece?.color === color).map((piece) => piece?.type).sort()).toEqual(['k', 'p', 'p', 'p', 'p', ...army].sort());
        }
        expect(chess.isAttacked('e1', 'b')).toBe(false);
        expect(chess.isAttacked('e8', 'w')).toBe(false);
        expect(chess.turn()).toBe('w');
      }
    }
  });

  it('keeps normal chess legality and full history for mate and repetition', () => {
    const mateStart = armyStart(['q'], ['r', 'n']);
    expect(findArmyMove(new Chess(mateStart), 'e2', 'e5')).toBeUndefined();
    const mate = replayArmy(mateStart, [
      { from: 'd1', to: 'b3', san: 'Qb3' }, { from: 'b8', to: 'c6', san: 'Nc6' }, { from: 'b3', to: 'g8', san: 'Qg8#' },
    ]);
    expect(mate.isCheckmate()).toBe(true);
    const cycle = [
      { from: 'b1', to: 'c3', san: 'Nc3' }, { from: 'b8', to: 'c6', san: 'Nc6' },
      { from: 'c3', to: 'b1', san: 'Nb1' }, { from: 'c6', to: 'b8', san: 'Nb8' },
    ];
    expect(replayArmy(armyStart(['r', 'n'], ['r', 'n']), [...cycle, ...cycle]).isThreefoldRepetition()).toBe(true);
  });
});
