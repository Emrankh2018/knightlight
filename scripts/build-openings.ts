import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { epdOf } from '../src/lib/openings';
import type { NextMove, Opening, OpeningsFile, PositionEntry, PositionsFile } from '../src/lib/openings';
import { downloadToFile } from './lib/download';

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';
const CACHE_DIR = '.cache/openings';
const OUT_DIR = 'public/data/openings';
const HEADER = 'eco\tname\tpgn';

function byString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sanMoves(pgn: string): string[] {
  return pgn.split(/\s+/).filter((t) => t.length > 0 && !/^\d+\.(\.\.)?$/.test(t));
}

function parseTsv(text: string, file: string): Opening[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines[0] !== HEADER) {
    throw new Error(`${file}: unexpected header ${JSON.stringify(lines[0])}, expected ${JSON.stringify(HEADER)}`);
  }
  const rows: Opening[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split('\t');
    const [eco, name, pgn] = cols;
    if (cols.length !== 3 || !eco || !name || !pgn) throw new Error(`${file}: malformed row ${JSON.stringify(line)}`);
    const chess = new Chess();
    const uci: string[] = [];
    for (const san of sanMoves(pgn)) {
      const move = chess.move(san);
      uci.push(`${move.from}${move.to}${move.promotion ?? ''}`);
    }
    rows.push({ eco, name, pgn, uci: uci.join(' ') });
  }
  return rows;
}

async function main(): Promise<void> {
  const all: Opening[] = [];
  for (const letter of ['a', 'b', 'c', 'd', 'e']) {
    const path = `${CACHE_DIR}/${letter}.tsv`;
    await downloadToFile(`${BASE}/${letter}.tsv`, path, 1);
    all.push(...parseTsv(await readFile(path, 'utf8'), path));
  }
  all.sort((a, b) => byString(a.eco, b.eco) || byString(a.pgn, b.pgn));

  const positions = new Map<string, PositionEntry>();
  const bestPlies = new Map<string, number>();
  const entryOf = (epd: string): PositionEntry => {
    let e = positions.get(epd);
    if (!e) {
      e = { n: [] };
      positions.set(epd, e);
    }
    return e;
  };

  all.forEach((opening, index) => {
    const chess = new Chess();
    let epd = epdOf(chess.fen());
    entryOf(epd);
    const ucis = opening.uci.split(' ');
    const sans = sanMoves(opening.pgn);
    sans.forEach((san, ply) => {
      const move = chess.move(san);
      const uci = ucis[ply] ?? '';
      const after = epdOf(chess.fen());
      const entry = entryOf(epd);
      if (!entry.n.some((n) => n[1] === uci)) entry.n.push([move.san, uci, after] satisfies NextMove);
      epd = after;
    });
    const final = entryOf(epd);
    const best = bestPlies.get(epd);
    if (best === undefined || sans.length < best) {
      final.o = index;
      bestPlies.set(epd, sans.length);
    }
  });

  const openingsFile: OpeningsFile = {
    version: 1,
    source: 'lichess-org/chess-openings (CC0)',
    openings: all,
  };
  const positionsFile: PositionsFile = Object.fromEntries(positions);
  await mkdir(OUT_DIR, { recursive: true });
  const openingsJson = JSON.stringify(openingsFile);
  const positionsJson = JSON.stringify(positionsFile);
  await writeFile(`${OUT_DIR}/openings.json`, openingsJson);
  await writeFile(`${OUT_DIR}/positions.json`, positionsJson);
  console.log(`openings: ${all.length}, positions: ${positions.size}`);
  console.log(
    `openings.json: ${(openingsJson.length / 1024).toFixed(0)} KB, positions.json: ${(positionsJson.length / 1024).toFixed(0)} KB`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
