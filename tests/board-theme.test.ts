import { readdirSync } from 'node:fs';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { coverFen } from '../src/lib/cover';
import { BOARD_THEMES, PICKABLE_BOARD_THEMES, effectiveBoardTheme, validateSettings, type BoardThemeId } from '../src/store/settings';

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0);
}
function ratio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe('board themes', () => {
  const ids = Object.keys(BOARD_THEMES) as BoardThemeId[];

  it.each(ids)('%s keeps notation at least 4.5:1 on both square colours', (id) => {
    const t = BOARD_THEMES[id];
    expect(ratio(t.onLight, t.light)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.onDark, t.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it('the two square colours of every theme are distinguishable (at least 2.5:1)', () => {
    for (const id of ids) expect(ratio(BOARD_THEMES[id].light, BOARD_THEMES[id].dark)).toBeGreaterThanOrEqual(2.5);
  });

  it('the projector theme has stronger square contrast than the default', () => {
    expect(ratio(BOARD_THEMES.projector.light, BOARD_THEMES.projector.dark)).toBeGreaterThan(ratio(BOARD_THEMES.cream.light, BOARD_THEMES.cream.dark));
  });

  it('only the default theme switches to dusk in dark mode', () => {
    expect(effectiveBoardTheme('cream', true)).toBe('dusk');
    expect(effectiveBoardTheme('cream', false)).toBe('cream');
    expect(effectiveBoardTheme('slate', true)).toBe('slate');
  });

  it('every pickable theme exists and saved settings with each theme stay valid', () => {
    for (const id of PICKABLE_BOARD_THEMES) {
      expect(BOARD_THEMES[id]).toBeDefined();
      expect(validateSettings({ version: 1, theme: 'light', boardTheme: id, sound: true, volume: 0.5, presentScale: 1 })).not.toBeNull();
    }
    expect(validateSettings({ version: 1, theme: 'light', boardTheme: 'nope', sound: true, volume: 0.5, presentScale: 1 })).toBeNull();
  });
});

describe('course cover positions', () => {
  it('returns a legal FEN for every shipped course and for unknown slugs', () => {
    const slugs = [...readdirSync('content/courses'), 'unknown-course', ''];
    for (const slug of slugs) {
      const fen = coverFen(slug);
      expect(() => new Chess(fen), slug).not.toThrow();
    }
  });

  it('shows the Italian Game after 3.Bc4', () => {
    const chess = new Chess(coverFen('italian-game'));
    expect(chess.get('c4')).toEqual({ type: 'b', color: 'w' });
    expect(chess.turn()).toBe('b');
  });

  it('the checkmate-patterns cover really is mate in one with Ra8', () => {
    const chess = new Chess(coverFen('checkmate-patterns'));
    chess.move('Ra8');
    expect(chess.isCheckmate()).toBe(true);
  });
});
