// Minimal PGN tokenizer for the Knightlight course format.
// Pure string processing: no node or browser APIs.

export type PgnResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export type PgnToken =
  | { kind: 'move'; san: string }
  | { kind: 'comment'; text: string }
  | { kind: 'nag'; value: number }
  | { kind: 'variation' }
  | { kind: 'result'; value: PgnResult };

export interface RawGame {
  /** Header tags; repeated tags keep every value in file order. */
  tags: Record<string, string[]>;
  tokens: PgnToken[];
  /** Problems found while tokenizing (bad header, unterminated comment, ...). */
  errors: string[];
}

const RESULTS: readonly string[] = ['1-0', '0-1', '1/2-1/2', '*'];
const WORD_END = new Set([' ', '\t', '\n', '{', '}', ';', '(', ')', '$', '[']);

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n';
}

/** Reads one `[Name "value"]` header starting at `start` (the `[`). Returns the next index. */
function readTag(text: string, start: number, game: RawGame): number {
  const n = text.length;
  let i = start + 1;
  while (i < n && isSpace(text[i] as string) && text[i] !== '\n') i++;
  const nameStart = i;
  while (i < n && /[A-Za-z0-9_]/.test(text[i] as string)) i++;
  const name = text.slice(nameStart, i);
  while (i < n && (text[i] === ' ' || text[i] === '\t')) i++;
  if (name === '' || text[i] !== '"') return failTag(text, start, game);
  i++;
  let value = '';
  let closed = false;
  while (i < n) {
    const ch = text[i] as string;
    if (ch === '\n') break;
    if (ch === '\\' && (text[i + 1] === '"' || text[i + 1] === '\\')) {
      value += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') {
      closed = true;
      i++;
      break;
    }
    value += ch;
    i++;
  }
  if (!closed) return failTag(text, start, game);
  while (i < n && (text[i] === ' ' || text[i] === '\t')) i++;
  if (text[i] !== ']') return failTag(text, start, game);
  const list = game.tags[name] ?? [];
  list.push(value);
  game.tags[name] = list;
  return i + 1;
}

function failTag(text: string, start: number, game: RawGame): number {
  let end = text.indexOf('\n', start);
  if (end === -1) end = text.length;
  game.errors.push(`Malformed header tag: ${text.slice(start, end).trim()}`);
  return end;
}

/** Skips a variation starting at `(`; returns the index after the matching `)`. */
function skipVariation(text: string, start: number): number {
  const n = text.length;
  let depth = 0;
  let i = start;
  while (i < n) {
    const ch = text[i];
    if (ch === '{') {
      const close = text.indexOf('}', i);
      i = close === -1 ? n : close + 1;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return n;
}

export function parsePgnGames(input: string): RawGame[] {
  const text = (input.charCodeAt(0) === 0xfeff ? input.slice(1) : input).replace(/\r\n?/g, '\n');
  const n = text.length;
  const games: RawGame[] = [];
  const state: { cur: RawGame | undefined; inMoves: boolean; tagEnd: number } = {
    cur: undefined,
    inMoves: false,
    tagEnd: 0,
  };

  const begin = (): RawGame => {
    const g: RawGame = { tags: {}, tokens: [], errors: [] };
    games.push(g);
    state.cur = g;
    state.inMoves = false;
    return g;
  };

  let i = 0;
  while (i < n) {
    const ch = text[i] as string;
    if (isSpace(ch)) {
      i++;
      continue;
    }
    if (ch === '[') {
      // A blank line after the headers means a new game started (games without moves or a result).
      const blankGap = /\n[ \t]*\n/.test(text.slice(state.tagEnd, i));
      const g =
        state.cur === undefined || state.inMoves || (blankGap && Object.keys(state.cur.tags).length > 0)
          ? begin()
          : state.cur;
      i = readTag(text, i, g);
      state.tagEnd = i;
      continue;
    }
    if (ch === '%' && (i === 0 || text[i - 1] === '\n')) {
      const eol = text.indexOf('\n', i);
      i = eol === -1 ? n : eol;
      continue;
    }
    const g = state.cur ?? begin();
    state.inMoves = true;

    if (ch === '{') {
      const close = text.indexOf('}', i);
      if (close === -1) {
        g.errors.push('Unterminated { comment');
        g.tokens.push({ kind: 'comment', text: text.slice(i + 1) });
        i = n;
      } else {
        g.tokens.push({ kind: 'comment', text: text.slice(i + 1, close) });
        i = close + 1;
      }
      continue;
    }
    if (ch === ';') {
      const eol = text.indexOf('\n', i);
      const end = eol === -1 ? n : eol;
      g.tokens.push({ kind: 'comment', text: text.slice(i + 1, end) });
      i = end;
      continue;
    }
    if (ch === '(') {
      g.tokens.push({ kind: 'variation' });
      i = skipVariation(text, i);
      continue;
    }
    if (ch === ')' || ch === '}') {
      g.errors.push(`Unmatched "${ch}"`);
      i++;
      continue;
    }
    if (ch === '$') {
      let j = i + 1;
      while (j < n && /[0-9]/.test(text[j] as string)) j++;
      g.tokens.push({ kind: 'nag', value: Number(text.slice(i + 1, j)) });
      i = j;
      continue;
    }

    let j = i;
    while (j < n && !WORD_END.has(text[j] as string)) j++;
    if (j === i) {
      i++;
      continue;
    }
    const word = text.slice(i, j);
    i = j;
    if (RESULTS.includes(word)) {
      g.tokens.push({ kind: 'result', value: word as PgnResult });
      state.cur = undefined;
      state.inMoves = false;
      continue;
    }
    const san = word.replace(/^\d+\.+/, '').replace(/[!?]+$/, '');
    if (san === '' || /^\d+$/.test(san) || /^\.+$/.test(san)) continue;
    g.tokens.push({ kind: 'move', san });
  }
  return games;
}

// --- Comment annotations ---------------------------------------------------

export type AnnotationColor = 'G' | 'R' | 'Y' | 'B';

export interface CommentAnnotations {
  /** Comment text with [%...] commands removed, whitespace collapsed; undefined if empty. */
  text: string | undefined;
  arrows: { from: string; to: string; color: AnnotationColor }[];
  highlights: { square: string; color: AnnotationColor }[];
  /** Command items that could not be understood. */
  invalid: string[];
}

const ARROW_ITEM = /^([GRYB])([a-h][1-8])([a-h][1-8])$/;
const SQUARE_ITEM = /^([GRYB])([a-h][1-8])$/;

export function extractAnnotations(comment: string): CommentAnnotations {
  const result: CommentAnnotations = { text: undefined, arrows: [], highlights: [], invalid: [] };
  const stripped = comment.replace(/\[%(\w+)\s*([^\]]*)\]/g, (_all, command: string, body: string) => {
    if (command !== 'cal' && command !== 'csl') return ' ';
    for (const raw of body.split(',')) {
      const item = raw.trim();
      if (item === '') continue;
      if (command === 'cal') {
        const m = ARROW_ITEM.exec(item);
        if (m) result.arrows.push({ color: m[1] as AnnotationColor, from: m[2] as string, to: m[3] as string });
        else result.invalid.push(`[%cal ${item}]`);
      } else {
        const m = SQUARE_ITEM.exec(item);
        if (m) result.highlights.push({ color: m[1] as AnnotationColor, square: m[2] as string });
        else result.invalid.push(`[%csl ${item}]`);
      }
    }
    return ' ';
  });
  const clean = stripped.replace(/\s+/g, ' ').trim();
  result.text = clean === '' ? undefined : clean;
  return result;
}
