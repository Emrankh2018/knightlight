import { Chess, type PieceSymbol, type Square } from 'chess.js';

export const GAME_IDS = ['castle', 'knight', 'detective'] as const;
export type GameId = typeof GAME_IDS[number];
export type GameStars = 1 | 2 | 3;
export type MiniGameProgress = Partial<Record<GameId, Record<string, { stars: GameStars; at: number }>>>;

export const CASTLE_QUESTS = [
  { id: 'captures', theme: 'hangingPiece', level: 'beginner', count: 5 },
  { id: 'mates', theme: 'mateIn1', level: 'beginner', count: 5 },
  { id: 'forks', theme: 'fork', level: 'beginner', count: 5 },
] as const;

const FILES = 'abcdefgh';
const SQUARE_RE = /^[a-h][1-8]$/;
const KNIGHT_OFFSETS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] as const;

/** A movement exercise: a lone knight, with no opponent and no invented blocking rules. */
export function knightMoves(square: string): string[] {
  if (!SQUARE_RE.test(square)) return [];
  const file = FILES.indexOf(square.charAt(0));
  const rank = Number(square.charAt(1));
  return KNIGHT_OFFSETS.flatMap(([df, dr]) => {
    const f = file + df;
    const r = rank + dr;
    return f >= 0 && f < 8 && r >= 1 && r <= 8 ? [`${FILES.charAt(f)}${r}`] : [];
  });
}

/** Includes both endpoints. Empty means invalid input. Searches at most 64 board squares. */
export function shortestKnightPath(from: string, to: string): string[] {
  return shortestKnightTrail(from, [], to);
}

/** Finds the shortest route collecting all treasures before exiting, not a greedy nearest treasure. */
export function shortestKnightTrail(from: string, treasures: readonly string[], exit: string): string[] {
  if (![from, exit, ...treasures].every((square) => SQUARE_RE.test(square)) || treasures.length > 3) return [];
  const targets = [...new Set(treasures)];
  const all = (1 << targets.length) - 1;
  const collect = (square: string, mask: number): number => {
    const index = targets.indexOf(square);
    return index < 0 ? mask : mask | (1 << index);
  };
  const initialMask = collect(from, 0);
  const queue = [{ square: from, mask: initialMask, path: [from] }];
  const seen = new Set([`${from}:${initialMask}`]);
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    if (!current) continue;
    if (current.square === exit && current.mask === all) return current.path;
    for (const square of knightMoves(current.square)) {
      const mask = collect(square, current.mask);
      const key = `${square}:${mask}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ square, mask, path: [...current.path, square] });
    }
  }
  return [];
}

export function knightTrailHint(current: string, remaining: readonly string[], exit: string): string | null {
  return shortestKnightTrail(current, remaining, exit)[1] ?? null;
}

export interface KnightLevel {
  id: string;
  start: string;
  treasures: readonly string[];
  exit: string;
  par: number;
}

export const KNIGHT_LEVELS: readonly KnightLevel[] = [
  { id: 'trail-1', start: 'b1', treasures: ['c3'], exit: 'e4' },
  { id: 'trail-2', start: 'g1', treasures: ['e2'], exit: 'f4' },
  { id: 'trail-3', start: 'a1', treasures: ['b3', 'd4'], exit: 'f5' },
  { id: 'trail-4', start: 'h1', treasures: ['f2', 'e4'], exit: 'c5' },
  { id: 'trail-5', start: 'b1', treasures: ['a3', 'd4'], exit: 'f5' },
  { id: 'trail-6', start: 'g8', treasures: ['e7', 'd5'], exit: 'b4' },
  { id: 'trail-7', start: 'a1', treasures: ['b3', 'e4', 'g5'], exit: 'h7' },
  { id: 'trail-8', start: 'h8', treasures: ['f7', 'c6', 'b4'], exit: 'a2' },
  { id: 'trail-9', start: 'd4', treasures: ['a1', 'h8', 'b7'], exit: 'g2' },
].map((level) => ({ ...level, par: shortestKnightTrail(level.start, level.treasures, level.exit).length - 1 }));

export interface DetectiveCase {
  id: string;
  fen: string;
  target: string;
  from: string;
  to: string;
  sourceId: string;
}

/** Positions after the setup move in the shipped Lichess CC0 beginner hangingPiece bucket. */
export const DETECTIVE_CASES: readonly DetectiveCase[] = [
  { id: 'case-1', fen: '4r1k1/ppq2p1p/2p3pB/3n4/3PQ3/P7/1P3PPP/R5K1 w - - 1 22', target: 'e8', from: 'e4', to: 'e8', sourceId: '52wd8' },
  { id: 'case-2', fen: '6k1/pp4pp/2p5/4n3/8/1P4Q1/1PP3PP/3r1R1K b - - 2 26', target: 'f1', from: 'd1', to: 'f1', sourceId: '8A4xs' },
  { id: 'case-3', fen: '2Q2q1k/6pp/8/4p3/8/6P1/6KP/8 w - - 0 35', target: 'f8', from: 'c8', to: 'f8', sourceId: 'AxhJH' },
  { id: 'case-4', fen: '3r2k1/pp3ppp/2p3b1/6P1/3R4/1P3B2/PKP2P2/4r3 w - - 0 25', target: 'd8', from: 'd4', to: 'd8', sourceId: '0AnCs' },
  { id: 'case-5', fen: '4r3/3Qn1pk/1pp4p/3pP3/q2P4/P3R3/1P3PPP/3R2K1 b - - 1 29', target: 'd1', from: 'a4', to: 'd1', sourceId: 'CpwKt' },
  { id: 'case-6', fen: 'r2qr1k1/pp1n1ppB/2pb4/8/3P2b1/5N2/PP3PPP/R1BQR1K1 b - - 0 13', target: 'h7', from: 'g8', to: 'h7', sourceId: 'MO9XC' },
  { id: 'case-7', fen: '8/8/p4Rp1/P2K3p/kPbB3r/8/8/8 w - - 0 50', target: 'c4', from: 'd5', to: 'c4', sourceId: 'aRisZ' },
  { id: 'case-8', fen: '5rk1/2p3p1/1p5p/p2P4/2P5/P4pP1/1P3Q1P/4q1K1 w - - 0 31', target: 'e1', from: 'f2', to: 'e1', sourceId: '5xAyQ' },
  { id: 'case-9', fen: '6k1/4PN2/1p4p1/p1pp2Pp/7P/8/PPP5/2K5 b - - 0 36', target: 'f7', from: 'g8', to: 'f7', sourceId: 'QMWey' },
];

/** Accept any legal capture proving the clue, including equivalent alternatives. */
export function tryDetectiveCapture(
  item: DetectiveCase,
  from: string,
  to: string,
  promotion?: Exclude<PieceSymbol, 'p' | 'k'>,
): string | null {
  if (!SQUARE_RE.test(from) || !SQUARE_RE.test(to) || to !== item.target) return null;
  try {
    const chess = new Chess(item.fen);
    const enemy = chess.turn() === 'w' ? 'b' : 'w';
    const target = chess.get(to as Square);
    if (!target || target.color !== enemy || target.type === 'k' || chess.isAttacked(to as Square, enemy)) return null;
    const move = chess.move({ from, to, promotion: promotion ?? 'q' });
    if (!move.captured || chess.moves({ verbose: true }).some((reply) => reply.to === to && reply.captured)) return null;
    return chess.fen();
  } catch {
    return null;
  }
}

export function isMiniGameStage(game: GameId, id: string): boolean {
  switch (game) {
    case 'castle': return CASTLE_QUESTS.some((quest) => quest.id === id);
    case 'knight': return KNIGHT_LEVELS.some((level) => level.id === id);
    case 'detective': return DETECTIVE_CASES.some((item) => item.id === id);
  }
}
