import { Chess } from 'chess.js';

export interface Opening {
  eco: string;
  name: string;
  /** SAN movetext with move numbers, e.g. "1. e4 e5 2. Nf3". */
  pgn: string;
  /** Space-separated UCI moves. */
  uci: string;
}

export interface OpeningsFile {
  version: 1;
  source: string;
  openings: Opening[];
}

/** One continuation from a position: [san, uci, epdAfter]. */
export type NextMove = [san: string, uci: string, epdAfter: string];

export interface PositionEntry {
  /** Index into `openings` of the opening that ends at this position. */
  o?: number;
  /** Continuations seen in the opening index from this position. */
  n: NextMove[];
}

export type PositionsFile = Record<string, PositionEntry>;

export interface Continuation {
  san: string;
  uci: string;
  /** Name of the opening at the resulting position, if any. */
  name?: string;
}

export interface LookupResult {
  opening?: Opening;
  /** Number of half-moves played to reach the opening (0 when none). */
  ply: number;
}

/**
 * First four FEN fields (placement, side, castling, en passant). The
 * en-passant field is "-" unless an en-passant capture is actually legal.
 */
export function epdOf(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  const [board = '', side = 'w', castling = '-', ep = '-'] = parts;
  let epField = ep;
  if (epField !== '-') {
    try {
      const chess = new Chess(fen);
      const legal = chess.moves({ verbose: true }).some((m) => m.flags.includes('e'));
      if (!legal) epField = '-';
    } catch {
      epField = '-';
    }
  }
  return `${board} ${side} ${castling} ${epField}`;
}

function stripCheck(san: string): string {
  return san.replace(/[+#]+$/, '');
}

/** Turns "1.e4 e5 2.Nf3" or "e4 e5 Nf3" into ["e4","e5","Nf3"]. */
function sanTokens(text: string): string[] {
  return text
    .replace(/\d+\s*\.(\.\.)?/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map(stripCheck);
}

const SAN_TOKEN = /^([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|O-O(-O)?|0-0(-0)?)$/;
const ECO_QUERY = /^([A-E]\d{0,2}|[a-e]\d{2})$/;

export class OpeningIndex {
  readonly openings: readonly Opening[];
  private readonly positions: ReadonlyMap<string, PositionEntry>;
  private readonly sanLines: readonly string[][];

  constructor(openingsFile: OpeningsFile, positionsFile: PositionsFile) {
    this.openings = openingsFile.openings;
    this.positions = new Map(Object.entries(positionsFile));
    this.sanLines = this.openings.map((o) => sanTokens(o.pgn));
  }

  private nameAt(epd: string): string | undefined {
    const o = this.positions.get(epd)?.o;
    return o === undefined ? undefined : this.openings[o]?.name;
  }

  /**
   * Plays the UCI moves and returns the deepest position along the way that
   * has a named opening (the longest named opening). Transpositions resolve
   * because positions are matched by EPD, not by move order. Stops at the
   * first illegal move.
   */
  lookup(movesUci: string[]): LookupResult {
    const chess = new Chess();
    let result: LookupResult = { ply: 0 };
    for (let i = 0; i < movesUci.length; i++) {
      const uci = movesUci[i] ?? '';
      try {
        chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
      } catch {
        break;
      }
      const o = this.positions.get(epdOf(chess.fen()))?.o;
      const opening = o === undefined ? undefined : this.openings[o];
      if (opening) result = { opening, ply: i + 1 };
    }
    return result;
  }

  /** The opening that ends exactly at this position, if any. */
  lookupFen(fen: string): Opening | undefined {
    const o = this.positions.get(epdOf(fen))?.o;
    return o === undefined ? undefined : this.openings[o];
  }

  continuations(fen: string): Continuation[] {
    const entry = this.positions.get(epdOf(fen));
    if (!entry) return [];
    return entry.n.map(([san, uci, after]) => {
      const name = this.nameAt(after);
      return name === undefined ? { san, uci } : { san, uci, name };
    });
  }

  /**
   * Search by ECO prefix ("C5", "B90"), by name substring (case-insensitive)
   * or by move sequence ("e4 e5 Nf3", "1.e4 e5 2.Nf3"). Results are ordered
   * ECO matches, name matches, then move matches, without duplicates.
   */
  search(query: string, limit: number): Opening[] {
    const q = query.trim();
    if (q === '' || limit <= 0) return [];
    const seen = new Set<number>();
    const out: Opening[] = [];
    const add = (i: number): void => {
      const opening = this.openings[i];
      if (opening && !seen.has(i) && out.length < limit) {
        seen.add(i);
        out.push(opening);
      }
    };

    if (ECO_QUERY.test(q)) {
      const prefix = q.toUpperCase();
      this.openings.forEach((o, i) => {
        if (o.eco.startsWith(prefix)) add(i);
      });
    }

    const lower = q.toLowerCase();
    this.openings.forEach((o, i) => {
      if (o.name.toLowerCase().includes(lower)) add(i);
    });

    const tokens = sanTokens(q);
    if (tokens.length > 0 && tokens.every((t) => SAN_TOKEN.test(t))) {
      this.sanLines.forEach((line, i) => {
        if (line.length >= tokens.length && tokens.every((t, k) => line[k] === t)) add(i);
      });
    }
    return out;
  }
}

const cache = new Map<string, Promise<OpeningIndex>>();

/** Fetches openings.json and positions.json once per base URL and caches the index. */
export function loadOpeningIndex(baseUrl: string): Promise<OpeningIndex> {
  const base = baseUrl.replace(/\/+$/, '');
  const cached = cache.get(base);
  if (cached) return cached;
  const load = async (): Promise<OpeningIndex> => {
    const [openingsRes, positionsRes] = await Promise.all([
      fetch(`${base}/openings.json`),
      fetch(`${base}/positions.json`),
    ]);
    if (!openingsRes.ok || !positionsRes.ok) {
      throw new Error(`Failed to load opening data from ${base}`);
    }
    const openings = (await openingsRes.json()) as OpeningsFile;
    const positions = (await positionsRes.json()) as PositionsFile;
    return new OpeningIndex(openings, positions);
  };
  const promise = load().catch((err: unknown) => {
    cache.delete(base);
    throw err;
  });
  cache.set(base, promise);
  return promise;
}
