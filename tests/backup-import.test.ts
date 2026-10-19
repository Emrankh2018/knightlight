import { describe, expect, it } from 'vitest';
import { BACKUP_APP, MAX_IMPORT_BYTES, parseBackup } from '../src/store/backup';
import { MAX_XP } from '../src/lib/xp';
import { emptyProgress } from '../src/store/progress';

const profile = { id: 'p1', name: 'Sam', avatar: '🦊', createdAt: 1 };
const settings = { version: 1, theme: 'dark', boardTheme: 'cream', sound: true, volume: 0.5, presentScale: 1 };

function backup(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    app: BACKUP_APP,
    version: 1,
    exportedAt: '2026-03-10T10:00:00.000Z',
    profiles: { version: 1, profiles: [profile], activeId: 'p1' },
    progress: { p1: { ...emptyProgress(), xp: 120 } },
    settings,
    ...over,
  };
}

const parse = (v: unknown) => parseBackup(typeof v === 'string' ? v : JSON.stringify(v));

describe('parseBackup', () => {
  it('accepts a good backup and returns clean data', () => {
    const r = parse(backup());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.progress.p1?.xp).toBe(120);
      expect(r.backup.profiles.activeId).toBe('p1');
      expect(r.backup.exportedAt).toBe('2026-03-10T10:00:00.000Z');
    }
  });

  it('rejects text that is not JSON', () => {
    expect(parse('{nope').ok).toBe(false);
    expect(parse('').ok).toBe(false);
  });

  it('rejects other JSON shapes', () => {
    for (const v of ['[]', 'null', '42', '"x"', '{}', JSON.stringify(backup({ app: 'other' }))]) expect(parse(v).ok).toBe(false);
  });

  it('rejects a wrong version', () => {
    expect(parse(backup({ version: 2 }))).toEqual({ ok: false, error: 'This backup came from a different version of Knightlight.' });
  });

  it('rejects oversized input before parsing', () => {
    expect(parse(' '.repeat(MAX_IMPORT_BYTES + 1))).toEqual({ ok: false, error: 'That file is too large to be a Knightlight backup.' });
  });

  it('rejects corrupt parts', () => {
    expect(parse(backup({ settings: { version: 1 } })).ok).toBe(false);
    expect(parse(backup({ profiles: { version: 1, profiles: [], activeId: 'p1' } })).ok).toBe(false);
    expect(parse(backup({ profiles: { version: 1, profiles: [{ ...profile, avatar: 'x' }], activeId: 'p1' } })).ok).toBe(false);
    expect(parse(backup({ progress: {} })).ok).toBe(false);
    expect(parse(backup({ progress: { p1: { ...emptyProgress(), xp: -5 } } })).ok).toBe(false);
    expect(parse(backup({ progress: { p1: { ...emptyProgress(), xp: 'lots' } } })).ok).toBe(false);
    expect(parse(backup({ progress: [] })).ok).toBe(false);
  });

  it('rejects absurd XP before preview (AUD-02)', () => {
    expect(parse(backup({ progress: { p1: { ...emptyProgress(), xp: 1e308 } } })).ok).toBe(false);
    expect(parse(backup({ progress: { p1: { ...emptyProgress(), xp: MAX_XP + 1 } } })).ok).toBe(false);
    expect(parse(backup({ progress: { p1: { ...emptyProgress(), xp: MAX_XP } } })).ok).toBe(true);
  });

  it('fails when only one of several students has bad progress', () => {
    const second = { ...profile, id: 'p2', name: 'Lee' };
    const r = parse(backup({ profiles: { version: 1, profiles: [profile, second], activeId: 'p1' }, progress: { p1: emptyProgress(), p2: { version: 1 } } }));
    expect(r.ok).toBe(false);
  });

  it('rejects __proto__ as a student id', () => {
    const asId = backup({ profiles: { version: 1, profiles: [{ ...profile, id: '__proto__' }], activeId: '__proto__' } });
    expect(parse(asId).ok).toBe(false);
  });

  it('rejects a __proto__ key inside a progress map', () => {
    const bad = JSON.stringify(backup()).replace('"botWins":{}', '"botWins":{"__proto__":1}');
    expect(bad).toContain('"__proto__"');
    expect(parse(bad).ok).toBe(false);
    const steps = JSON.stringify(backup()).replace('"completedSteps":{}', '"completedSteps":{"__proto__":{"at":1,"hint":false}}');
    expect(parse(steps).ok).toBe(false);
    expect(({} as Record<string, unknown>).at).toBeUndefined();
  });

  it('truncates a very long exportedAt text', () => {
    const r = parse(backup({ exportedAt: 'x'.repeat(500) }));
    expect(r.ok && r.backup.exportedAt.length).toBe(40);
  });
});
