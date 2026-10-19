import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { Decompress } from 'fzstd';
import type { Puzzle, PuzzleIndex, PuzzleLevel } from '../src/lib/puzzle-types';
import { downloadToFile, fileSize } from './lib/download';

const SOURCE_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const CACHE_FILE = '.cache/lichess_db_puzzle.csv.zst';
const OUT_DIR = 'public/data/puzzles';
const MIN_ARCHIVE_BYTES = 100e6;
const MAX_OUTPUT_BYTES = 25 * 1024 * 1024;

const SEED = 20261018;
const MIN_POPULARITY = 90;
const MIN_NB_PLAYS = 500;
const MAX_RATING_DEVIATION = 90;
/** Beginner (kids) level uses looser quality filters: low-rated themes like deflection are rare. */
const BEGINNER_MIN_POPULARITY = 60;
const BEGINNER_MIN_NB_PLAYS = 100;
const BEGINNER_MAX_RATING_DEVIATION = 110;
const PER_THEME_LEVEL = 150;
const PER_MIXED_LEVEL = 300;
/** No single main theme (or the "other" group) may fill more than this share of a mixed bucket. */
const MIXED_THEME_SHARE = 0.25;
/** Puzzles carry several tags (e.g. endgame + mateIn2), so the total tag count per theme is capped too. */
const MIXED_TAG_SHARE = 0.35;
const PER_MIXED_CATEGORY = Math.floor(PER_MIXED_LEVEL * MIXED_THEME_SHARE);

const REQUIRED = ['PuzzleId', 'FEN', 'Moves', 'Rating', 'RatingDeviation', 'Popularity', 'NbPlays', 'Themes', 'GameUrl'] as const;
const THEMES = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'fork',
  'pin',
  'skewer',
  'hangingPiece',
  'discoveredAttack',
  'deflection',
  'attraction',
  'backRankMate',
  'endgame',
  'sacrifice',
  'trappedPiece',
] as const;
const MATE_THEMES = new Set(['mateIn1', 'mateIn2', 'mateIn3', 'mate']);

const LEVELS = [
  { id: 'beginner', min: 0, max: 699 },
  { id: 'intermediate', min: 700, max: 1199 },
  { id: 'mid-advanced', min: 1200, max: 1599 },
  { id: 'advanced', min: 1600, max: 1999 },
  { id: 'master', min: 2000, max: 4000 },
] as const;

/** Deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Splits one CSV line, handling quoted fields defensively. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** True if the puzzle is playable: legal moves in sequence, even count, mate tags end in checkmate. */
function isValid(p: Puzzle): boolean {
  if (p.moves.length < 2 || p.moves.length % 2 !== 0) return false;
  let chess: Chess;
  try {
    chess = new Chess(p.fen);
    for (const uci of p.moves) {
      if (uci.length < 4) return false;
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
    }
  } catch {
    return false;
  }
  if (p.themes.some((t) => MATE_THEMES.has(t)) && !chess.isCheckmate()) return false;
  return true;
}

interface Reservoir {
  seen: number;
  items: Puzzle[];
}

function levelOf(rating: number): (typeof LEVELS)[number] | undefined {
  return LEVELS.find((l) => rating >= l.min && rating <= l.max);
}

/** Round-robin across the per-theme mixed reservoirs until PER_MIXED_LEVEL puzzles are taken. */
function interleaveMixed(levelId: string, reservoirs: Map<string, Reservoir>): Puzzle[] {
  const pools = [...THEMES, 'other'].map((c) => [...(reservoirs.get(`${levelId}/mixed/${c}`)?.items ?? [])]);
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  const tagCounts = new Map<string, number>();
  const tagCap = Math.floor(PER_MIXED_LEVEL * MIXED_TAG_SHARE);
  const overCap = (p: Puzzle): boolean => THEMES.some((t) => p.themes.includes(t) && (tagCounts.get(t) ?? 0) >= tagCap);
  for (let round = 0; out.length < PER_MIXED_LEVEL; round++) {
    let any = false;
    for (const pool of pools) {
      const p = pool[round];
      if (!p) continue;
      any = true;
      if (seen.has(p.id) || out.length >= PER_MIXED_LEVEL || overCap(p)) continue;
      seen.add(p.id);
      for (const t of THEMES) if (p.themes.includes(t)) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      out.push(p);
    }
    if (!any) break;
  }
  return out;
}

async function main(): Promise<void> {
  await downloadToFile(SOURCE_URL, CACHE_FILE, MIN_ARCHIVE_BYTES);
  const archiveBytes = await fileSize(CACHE_FILE);
  const rand = mulberry32(SEED);
  const reservoirs = new Map<string, Reservoir>();
  const reservoirFor = (key: string): Reservoir => {
    let r = reservoirs.get(key);
    if (!r) {
      r = { seen: 0, items: [] };
      reservoirs.set(key, r);
    }
    return r;
  };

  let columns: Map<string, number> | undefined;
  let totalRows = 0;
  let filteredRows = 0;
  let malformedRows = 0;
  let invalidPuzzles = 0;

  const handleLine = (line: string): void => {
    if (line === '') return;
    const fields = parseCsvLine(line);
    if (!columns) {
      const map = new Map(fields.map((name, i) => [name.trim(), i]));
      const missing = REQUIRED.filter((c) => !map.has(c));
      if (missing.length > 0) throw new Error(`CSV header is missing columns: ${missing.join(', ')} (got: ${fields.join(',')})`);
      columns = map;
      return;
    }
    totalRows++;
    const get = (name: (typeof REQUIRED)[number]): string => fields[columns?.get(name) ?? -1] ?? '';
    const rating = Number(get('Rating'));
    const deviation = Number(get('RatingDeviation'));
    const popularity = Number(get('Popularity'));
    const plays = Number(get('NbPlays'));
    if ([rating, deviation, popularity, plays].some((n) => !Number.isFinite(n)) || get('Rating') === '') {
      malformedRows++;
      return;
    }
    const level = levelOf(rating);
    if (!level) {
      malformedRows++;
      return;
    }
    const beginner = level.id === 'beginner';
    const minPopularity = beginner ? BEGINNER_MIN_POPULARITY : MIN_POPULARITY;
    const minPlays = beginner ? BEGINNER_MIN_NB_PLAYS : MIN_NB_PLAYS;
    const maxDeviation = beginner ? BEGINNER_MAX_RATING_DEVIATION : MAX_RATING_DEVIATION;
    if (popularity < minPopularity || plays < minPlays || deviation > maxDeviation) return;
    filteredRows++;

    const themes = get('Themes').split(' ').filter((t) => t !== '');
    const keys: string[] = [];
    for (const t of THEMES) if (themes.includes(t)) keys.push(`${level.id}/${t}`);
    // The mixed pool is split into one reservoir per main theme; each puzzle joins the
    // least-filled matching one (or "other"), so the buckets can later be interleaved.
    const matching = THEMES.filter((t) => themes.includes(t));
    let category = 'other';
    let fewest = Infinity;
    for (const t of matching) {
      const seen = reservoirs.get(`${level.id}/mixed/${t}`)?.seen ?? 0;
      if (seen < fewest) {
        fewest = seen;
        category = t;
      }
    }
    keys.push(`${level.id}/mixed/${category}`);

    let puzzle: Puzzle | undefined;
    let valid: boolean | undefined;
    for (const key of keys) {
      const cap = key.includes('/mixed/') ? PER_MIXED_CATEGORY : PER_THEME_LEVEL;
      const r = reservoirFor(key);
      r.seen++;
      let slot = -1;
      if (r.items.length < cap) slot = r.items.length;
      else {
        const j = Math.floor(rand() * r.seen);
        if (j < cap) slot = j;
      }
      if (slot < 0) continue;
      if (valid === undefined) {
        puzzle = {
          id: get('PuzzleId'),
          fen: get('FEN'),
          moves: get('Moves').split(' ').filter((m) => m !== ''),
          rating,
          themes,
          url: get('GameUrl'),
        };
        valid = isValid(puzzle);
        if (!valid) invalidPuzzles++;
      }
      if (valid && puzzle) r.items[slot] = puzzle;
    }
  };

  // Stream: file -> zstd -> text -> lines. Nothing but the reservoirs is retained.
  const decoder = new TextDecoder();
  let pending = '';
  const onData = (chunk: Uint8Array, final?: boolean): void => {
    pending += decoder.decode(chunk, { stream: !final });
    let start = 0;
    for (;;) {
      const nl = pending.indexOf('\n', start);
      if (nl < 0) break;
      handleLine(pending.slice(start, nl).replace(/\r$/, ''));
      start = nl + 1;
    }
    pending = pending.slice(start);
  };
  const zstd = new Decompress(onData);

  let readBytes = 0;
  let nextReport = 0.05;
  for await (const chunk of createReadStream(CACHE_FILE, { highWaterMark: 1 << 20 })) {
    const buf = chunk as Buffer;
    zstd.push(new Uint8Array(buf.buffer, buf.byteOffset, buf.length), false);
    readBytes += buf.length;
    if (readBytes / archiveBytes >= nextReport) {
      console.log(`  ${(readBytes / archiveBytes * 100).toFixed(0)}% read, ${totalRows} rows, ${filteredRows} passed filters`);
      nextReport += 0.05;
    }
  }
  zstd.push(new Uint8Array(0), true);
  if (pending !== '') handleLine(pending);
  if (!columns) throw new Error('CSV was empty');
  console.log(`rows: ${totalRows}, passed filters: ${filteredRows}, malformed: ${malformedRows}, invalid (skipped): ${invalidPuzzles}`);

  // Write output.
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  let totalBytes = 0;
  const levels: PuzzleLevel[] = [];
  const summary: string[] = [];
  for (const level of LEVELS) {
    const buckets: PuzzleLevel['buckets'] = [];
    await mkdir(`${OUT_DIR}/${level.id}`, { recursive: true });
    for (const theme of [...THEMES, 'mixed']) {
      const items = theme === 'mixed' ? interleaveMixed(level.id, reservoirs) : (reservoirs.get(`${level.id}/${theme}`)?.items ?? []);
      if (items.length === 0) continue;
      items.sort((a, b) => a.rating - b.rating || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const json = JSON.stringify(items);
      const file = `${level.id}/${theme}.json`;
      await writeFile(`${OUT_DIR}/${file}`, json);
      totalBytes += Buffer.byteLength(json);
      buckets.push({ theme, count: items.length, file });
      summary.push(`${file}: ${items.length}`);
    }
    levels.push({ id: level.id, min: level.min, max: level.max, buckets });
  }
  const index: PuzzleIndex = {
    version: 1,
    source: 'Lichess puzzle database (CC0)',
    generated: new Date().toISOString().slice(0, 10),
    filters: {
      minPopularity: MIN_POPULARITY,
      minNbPlays: MIN_NB_PLAYS,
      maxRatingDeviation: MAX_RATING_DEVIATION,
      beginner: {
        minPopularity: BEGINNER_MIN_POPULARITY,
        minNbPlays: BEGINNER_MIN_NB_PLAYS,
        maxRatingDeviation: BEGINNER_MAX_RATING_DEVIATION,
      },
      perThemeLevel: PER_THEME_LEVEL,
      perMixedLevel: PER_MIXED_LEVEL,
      seed: SEED,
    },
    levels,
  };
  const indexJson = JSON.stringify(index);
  await writeFile(`${OUT_DIR}/index.json`, indexJson);
  totalBytes += Buffer.byteLength(indexJson);
  console.log(summary.join('\n'));
  console.log(`total output: ${(totalBytes / 1024 / 1024).toFixed(2)} MB in ${summary.length} files`);
  if (totalBytes > MAX_OUTPUT_BYTES) throw new Error(`Output ${totalBytes} bytes exceeds the 25 MB limit`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
