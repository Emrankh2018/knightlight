/**
 * Minimal 0x88 board with legal move generation, written for the bot search.
 * Pure TypeScript, no DOM. Original code (MIT), not derived from any engine.
 *
 * Pieces are signed ints: white positive, black negative, magnitude = piece type.
 * Squares are 0x88 indices: rank * 16 + file, rank 0 = chess rank 1.
 */

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export type Side = 1 | -1;

/** A move packed into an int: from (7 bits), to (7 bits), promo type (3 bits), flags. */
export type Move = number;

export const FLAG_CAPTURE = 1 << 17;
export const FLAG_EP = 1 << 18;
export const FLAG_CASTLE = 1 << 19;
export const FLAG_DOUBLE = 1 << 20;

const CASTLE_WK = 1;
const CASTLE_WQ = 2;
const CASTLE_BK = 4;
const CASTLE_BQ = 8;

const KNIGHT_STEPS = [-33, -31, -18, -14, 14, 18, 31, 33];
const KING_STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];
const BISHOP_STEPS = [-17, -15, 15, 17];
const ROOK_STEPS = [-16, -1, 1, 16];

const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[4] = 15 & ~(CASTLE_WK | CASTLE_WQ);
CASTLE_MASK[0] = 15 & ~CASTLE_WQ;
CASTLE_MASK[7] = 15 & ~CASTLE_WK;
CASTLE_MASK[116] = 15 & ~(CASTLE_BK | CASTLE_BQ);
CASTLE_MASK[112] = 15 & ~CASTLE_BQ;
CASTLE_MASK[119] = 15 & ~CASTLE_BK;

const PIECE_CHARS: Record<string, number> = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };
const PROMO_CHARS = ['', '', 'n', 'b', 'r', 'q'];

export const moveFrom = (m: Move): number => m & 127;
export const moveTo = (m: Move): number => (m >> 7) & 127;
export const movePromo = (m: Move): number => (m >> 14) & 7;

export function squareName(sq: number): string {
  return String.fromCharCode(97 + (sq & 7)) + String(((sq >> 4) & 7) + 1);
}

export function parseSquare(name: string): number {
  const file = name.charCodeAt(0) - 97;
  const rank = name.charCodeAt(1) - 49;
  if (name.length !== 2 || file < 0 || file > 7 || rank < 0 || rank > 7) {
    throw new Error(`Invalid square: ${name}`);
  }
  return rank * 16 + file;
}

export function moveToUci(m: Move): string {
  return squareName(moveFrom(m)) + squareName(moveTo(m)) + PROMO_CHARS[movePromo(m)];
}

function makeMoveInt(from: number, to: number, promo: number, flags: number): Move {
  return from | (to << 7) | (promo << 14) | flags;
}

export class Board {
  readonly sq = new Int8Array(128);
  side: Side = 1;
  castling = 0;
  ep = -1;
  halfmove = 0;
  private readonly kingSq: [number, number] = [-1, -1];
  private readonly undoCaptured: number[] = [];
  private readonly undoCastling: number[] = [];
  private readonly undoEp: number[] = [];
  private readonly undoHalf: number[] = [];

  static fromFen(fen: string): Board {
    const board = new Board();
    const parts = fen.trim().split(/\s+/);
    const placement = parts[0];
    if (placement === undefined) throw new Error('Empty FEN');
    const ranks = placement.split('/');
    if (ranks.length !== 8) throw new Error(`Invalid FEN placement: ${fen}`);
    for (let r = 0; r < 8; r++) {
      const row = ranks[7 - r] as string;
      let file = 0;
      for (const ch of row) {
        const digit = Number(ch);
        if (digit >= 1 && digit <= 8) {
          file += digit;
        } else {
          const type = PIECE_CHARS[ch.toLowerCase()];
          if (type === undefined || file > 7) throw new Error(`Invalid FEN piece: ${ch}`);
          const color: Side = ch === ch.toUpperCase() ? 1 : -1;
          const s = r * 16 + file;
          board.sq[s] = color * type;
          if (type === KING) board.kingSq[color === 1 ? 0 : 1] = s;
          file++;
        }
      }
      if (file !== 8) throw new Error(`Invalid FEN rank: ${row}`);
    }
    if (board.kingSq[0] < 0 || board.kingSq[1] < 0) throw new Error('FEN needs both kings');
    board.side = parts[1] === 'b' ? -1 : 1;
    const rights = parts[2] ?? '-';
    if (rights.includes('K')) board.castling |= CASTLE_WK;
    if (rights.includes('Q')) board.castling |= CASTLE_WQ;
    if (rights.includes('k')) board.castling |= CASTLE_BK;
    if (rights.includes('q')) board.castling |= CASTLE_BQ;
    const ep = parts[3] ?? '-';
    board.ep = ep === '-' ? -1 : parseSquare(ep);
    board.halfmove = Number(parts[4] ?? '0') || 0;
    return board;
  }

  isAttacked(target: number, by: Side): boolean {
    const b = this.sq;
    // Pawns: a white pawn attacks target from target-15 / target-17.
    const p1 = target - by * 15;
    const p2 = target - by * 17;
    if (!(p1 & 0x88) && b[p1] === by * PAWN) return true;
    if (!(p2 & 0x88) && b[p2] === by * PAWN) return true;
    for (const d of KNIGHT_STEPS) {
      const s = target + d;
      if (!(s & 0x88) && b[s] === by * KNIGHT) return true;
    }
    for (const d of KING_STEPS) {
      const s = target + d;
      if (!(s & 0x88) && b[s] === by * KING) return true;
    }
    for (const d of BISHOP_STEPS) {
      for (let s = target + d; !(s & 0x88); s += d) {
        const p = b[s] as number;
        if (p === 0) continue;
        if (p === by * BISHOP || p === by * QUEEN) return true;
        break;
      }
    }
    for (const d of ROOK_STEPS) {
      for (let s = target + d; !(s & 0x88); s += d) {
        const p = b[s] as number;
        if (p === 0) continue;
        if (p === by * ROOK || p === by * QUEEN) return true;
        break;
      }
    }
    return false;
  }

  inCheck(): boolean {
    return this.isAttacked(this.kingSq[this.side === 1 ? 0 : 1], -this.side as Side);
  }

  /** Pseudo-legal moves (king safety is checked by makeMove). */
  generate(capturesOnly: boolean): Move[] {
    const out: Move[] = [];
    const b = this.sq;
    const side = this.side;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) {
        s += 7;
        continue;
      }
      const piece = b[s] as number;
      if (piece === 0 || piece > 0 !== side > 0) continue;
      const type = Math.abs(piece);
      if (type === PAWN) {
        this.genPawn(s, out, capturesOnly);
      } else if (type === KNIGHT || type === KING) {
        const steps = type === KNIGHT ? KNIGHT_STEPS : KING_STEPS;
        for (const d of steps) {
          const t = s + d;
          if (t & 0x88) continue;
          const target = b[t] as number;
          if (target === 0) {
            if (!capturesOnly) out.push(makeMoveInt(s, t, 0, 0));
          } else if (target > 0 !== side > 0) {
            out.push(makeMoveInt(s, t, 0, FLAG_CAPTURE));
          }
        }
        if (type === KING && !capturesOnly) this.genCastling(s, out);
      } else {
        const steps = type === BISHOP ? BISHOP_STEPS : type === ROOK ? ROOK_STEPS : KING_STEPS;
        for (const d of steps) {
          for (let t = s + d; !(t & 0x88); t += d) {
            const target = b[t] as number;
            if (target === 0) {
              if (!capturesOnly) out.push(makeMoveInt(s, t, 0, 0));
              continue;
            }
            if (target > 0 !== side > 0) out.push(makeMoveInt(s, t, 0, FLAG_CAPTURE));
            break;
          }
        }
      }
    }
    return out;
  }

  private genPawn(s: number, out: Move[], capturesOnly: boolean): void {
    const b = this.sq;
    const side = this.side;
    const dir = side * 16;
    const startRank = side === 1 ? 1 : 6;
    const lastRank = side === 1 ? 7 : 0;
    const one = s + dir;
    if (!(one & 0x88) && b[one] === 0) {
      if (one >> 4 === lastRank) {
        this.addPromotions(s, one, 0, out, capturesOnly);
      } else if (!capturesOnly) {
        out.push(makeMoveInt(s, one, 0, 0));
        if (s >> 4 === startRank && b[one + dir] === 0) {
          out.push(makeMoveInt(s, one + dir, 0, FLAG_DOUBLE));
        }
      }
    }
    for (const d of [dir - 1, dir + 1]) {
      const t = s + d;
      if (t & 0x88) continue;
      const target = b[t] as number;
      if (target !== 0 && target > 0 !== side > 0) {
        if (t >> 4 === lastRank) this.addPromotions(s, t, FLAG_CAPTURE, out, capturesOnly);
        else out.push(makeMoveInt(s, t, 0, FLAG_CAPTURE));
      } else if (target === 0 && t === this.ep) {
        out.push(makeMoveInt(s, t, 0, FLAG_CAPTURE | FLAG_EP));
      }
    }
  }

  private addPromotions(from: number, to: number, flags: number, out: Move[], queenOnly: boolean): void {
    out.push(makeMoveInt(from, to, QUEEN, flags));
    if (queenOnly) return;
    out.push(makeMoveInt(from, to, ROOK, flags));
    out.push(makeMoveInt(from, to, BISHOP, flags));
    out.push(makeMoveInt(from, to, KNIGHT, flags));
  }

  private genCastling(kingSquare: number, out: Move[]): void {
    const b = this.sq;
    const white = this.side === 1;
    const home = white ? 4 : 116;
    if (kingSquare !== home) return;
    const enemy = -this.side as Side;
    const kingSide = white ? CASTLE_WK : CASTLE_BK;
    const queenSide = white ? CASTLE_WQ : CASTLE_BQ;
    const wantKing = (this.castling & kingSide) !== 0;
    const wantQueen = (this.castling & queenSide) !== 0;
    if (!wantKing && !wantQueen) return;
    if (this.isAttacked(home, enemy)) return;
    if (
      wantKing &&
      b[home + 1] === 0 &&
      b[home + 2] === 0 &&
      b[home + 3] === this.side * ROOK &&
      !this.isAttacked(home + 1, enemy) &&
      !this.isAttacked(home + 2, enemy)
    ) {
      out.push(makeMoveInt(home, home + 2, 0, FLAG_CASTLE));
    }
    if (
      wantQueen &&
      b[home - 1] === 0 &&
      b[home - 2] === 0 &&
      b[home - 3] === 0 &&
      b[home - 4] === this.side * ROOK &&
      !this.isAttacked(home - 1, enemy) &&
      !this.isAttacked(home - 2, enemy)
    ) {
      out.push(makeMoveInt(home, home - 2, 0, FLAG_CASTLE));
    }
  }

  /** Plays a pseudo-legal move. Returns false (and leaves the board untouched) if it leaves the king in check. */
  makeMove(m: Move): boolean {
    const b = this.sq;
    const side = this.side;
    const from = moveFrom(m);
    const to = moveTo(m);
    const promo = movePromo(m);
    const piece = b[from] as number;
    const captured = m & FLAG_EP ? -side * PAWN : (b[to] as number);

    this.undoCaptured.push(captured);
    this.undoCastling.push(this.castling);
    this.undoEp.push(this.ep);
    this.undoHalf.push(this.halfmove);

    b[to] = promo ? side * promo : piece;
    b[from] = 0;
    if (m & FLAG_EP) b[to - side * 16] = 0;
    if (m & FLAG_CASTLE) {
      if (to > from) {
        b[to - 1] = b[to + 1] as number;
        b[to + 1] = 0;
      } else {
        b[to + 1] = b[to - 2] as number;
        b[to - 2] = 0;
      }
    }
    this.castling &= (CASTLE_MASK[from] as number) & (CASTLE_MASK[to] as number);
    this.ep = m & FLAG_DOUBLE ? (from + to) >> 1 : -1;
    this.halfmove = Math.abs(piece) === PAWN || captured !== 0 ? 0 : this.halfmove + 1;
    if (Math.abs(piece) === KING) this.kingSq[side === 1 ? 0 : 1] = to;
    this.side = -side as Side;

    if (this.isAttacked(this.kingSq[side === 1 ? 0 : 1], this.side)) {
      this.unmakeMove(m);
      return false;
    }
    return true;
  }

  unmakeMove(m: Move): void {
    const b = this.sq;
    const side = -this.side as Side;
    this.side = side;
    const from = moveFrom(m);
    const to = moveTo(m);
    const promo = movePromo(m);
    const captured = this.undoCaptured.pop() as number;
    this.castling = this.undoCastling.pop() as number;
    this.ep = this.undoEp.pop() as number;
    this.halfmove = this.undoHalf.pop() as number;

    const piece = promo ? side * PAWN : (b[to] as number);
    b[from] = piece;
    if (m & FLAG_EP) {
      b[to] = 0;
      b[to - side * 16] = captured;
    } else {
      b[to] = captured;
    }
    if (m & FLAG_CASTLE) {
      if (to > from) {
        b[to + 1] = b[to - 1] as number;
        b[to - 1] = 0;
      } else {
        b[to - 2] = b[to + 1] as number;
        b[to + 1] = 0;
      }
    }
    if (Math.abs(piece) === KING) this.kingSq[side === 1 ? 0 : 1] = from;
  }

  legalMoves(): Move[] {
    const legal: Move[] = [];
    for (const m of this.generate(false)) {
      if (this.makeMove(m)) {
        this.unmakeMove(m);
        legal.push(m);
      }
    }
    return legal;
  }

  hasLegalMove(): boolean {
    for (const m of this.generate(false)) {
      if (this.makeMove(m)) {
        this.unmakeMove(m);
        return true;
      }
    }
    return false;
  }

  perft(depth: number): number {
    if (depth === 0) return 1;
    let total = 0;
    for (const m of this.generate(false)) {
      if (!this.makeMove(m)) continue;
      total += depth === 1 ? 1 : this.perft(depth - 1);
      this.unmakeMove(m);
    }
    return total;
  }
}
