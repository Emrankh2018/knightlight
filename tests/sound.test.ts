import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

interface Counters {
  contexts: number;
  oscillators: number;
  started: number;
  resumed: number;
  masterGains: number[];
  setState: (state: string) => void;
}

function installAudio(state: 'running' | 'suspended' | 'interrupted' | 'closed'): Counters {
  const c: Counters = { contexts: 0, oscillators: 0, started: 0, resumed: 0, masterGains: [], setState: () => undefined };
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  class FakeContext {
    state: string = state;
    currentTime = 0;
    destination = {};
    constructor() {
      c.contexts += 1;
      c.setState = (next) => {
        this.state = next;
      };
    }
    resume(): Promise<void> {
      c.resumed += 1;
      this.state = 'running';
      return Promise.resolve();
    }
    createGain() {
      const gain = param();
      c.masterGains.push(0);
      return { gain, connect: vi.fn() };
    }
    createOscillator() {
      c.oscillators += 1;
      return {
        type: 'sine',
        frequency: param(),
        connect: vi.fn(),
        start: () => {
          c.started += 1;
        },
        stop: vi.fn(),
      };
    }
  }
  vi.stubGlobal('AudioContext', FakeContext);
  return c;
}

async function load() {
  vi.resetModules();
  const sound = await import('../src/lib/sound.ts');
  const settings = await import('../src/store/settings.ts');
  return { ...sound, ...settings };
}

beforeEach(() => {
  store.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe('soundForMove', () => {
  it('picks the sound from SAN, most dramatic first', async () => {
    const { soundForMove } = await load();
    expect(soundForMove('e4')).toBe('move');
    expect(soundForMove('Nf3')).toBe('move');
    expect(soundForMove('exd5')).toBe('capture');
    expect(soundForMove('Qxf7+')).toBe('check');
    expect(soundForMove('Qxf7#')).toBe('checkmate');
    expect(soundForMove('O-O')).toBe('castle');
    expect(soundForMove('O-O-O')).toBe('castle');
    expect(soundForMove('O-O+')).toBe('check');
    expect(soundForMove('e8=Q')).toBe('promotion');
    expect(soundForMove('exd8=Q+')).toBe('check');
  });
});

describe('playSound', () => {
  it('is silent and safe before the first gesture', async () => {
    const c = installAudio('running');
    const { playSound } = await load();
    expect(() => playSound('move')).not.toThrow();
    expect(c.contexts).toBe(0);
    expect(c.started).toBe(0);
  });

  it('creates the context once on unlock and plays oscillators', async () => {
    const c = installAudio('running');
    const { playSound, unlockAudio } = await load();
    unlockAudio();
    unlockAudio();
    expect(c.contexts).toBe(1);
    playSound('move');
    expect(c.started).toBe(2);
    playSound('castle');
    expect(c.started).toBe(2 + 4);
    playSound('solved');
    expect(c.started).toBe(6 + 4);
  });

  it('resumes a suspended context before playing', async () => {
    const c = installAudio('suspended');
    const { playSound, unlockAudio } = await load();
    unlockAudio();
    expect(c.resumed).toBe(1);
    playSound('wrong');
    await Promise.resolve();
    await Promise.resolve();
    expect(c.started).toBe(1);
  });

  it('resumes an interrupted context (Safari/iOS) on unlock and before playing', async () => {
    const c = installAudio('interrupted');
    const { playSound, unlockAudio } = await load();
    unlockAudio();
    expect(c.resumed).toBe(1);
    playSound('wrong');
    expect(c.started).toBe(1);
  });

  it('resumes from playSound when the context is interrupted later', async () => {
    const c = installAudio('running');
    const { playSound, unlockAudio } = await load();
    unlockAudio();
    c.setState('interrupted');
    playSound('wrong');
    expect(c.resumed).toBe(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(c.started).toBe(1);
  });

  it('recreates a closed context', async () => {
    const c = installAudio('running');
    const { playSound, unlockAudio } = await load();
    unlockAudio();
    c.setState('closed');
    unlockAudio();
    expect(c.contexts).toBe(2);
    c.setState('closed');
    playSound('wrong');
    expect(c.contexts).toBe(3);
    expect(c.started).toBe(1);
  });

  it('plays nothing when muted or at zero volume', async () => {
    const c = installAudio('running');
    const { playSound, unlockAudio, useSettings } = await load();
    unlockAudio();
    useSettings.getState().setSound(false);
    playSound('move');
    expect(c.started).toBe(0);
    useSettings.getState().setSound(true);
    useSettings.getState().setVolume(0);
    playSound('move');
    expect(c.started).toBe(0);
    useSettings.getState().setVolume(0.5);
    playSound('move');
    expect(c.started).toBe(2);
  });

  it('does not throw when AudioContext is missing or throws', async () => {
    const { playSound, unlockAudio } = await load();
    expect(() => {
      unlockAudio();
      playSound('hint');
    }).not.toThrow();
    vi.stubGlobal('AudioContext', class {
      constructor() {
        throw new Error('blocked');
      }
    });
    const again = await load();
    expect(() => {
      again.unlockAudio();
      again.playSound('hint');
    }).not.toThrow();
  });
});

describe('sound settings', () => {
  it('defaults to on at moderate volume', async () => {
    const { useSettings } = await load();
    expect(useSettings.getState().sound).toBe(true);
    expect(useSettings.getState().volume).toBeGreaterThan(0.3);
    expect(useSettings.getState().volume).toBeLessThan(0.8);
  });

  it('persists mute and volume across reloads, clamping volume', async () => {
    const first = await load();
    first.useSettings.getState().setSound(false);
    first.useSettings.getState().setVolume(5);
    expect(first.useSettings.getState().volume).toBe(1);
    first.useSettings.getState().setVolume(0.25);
    const second = await load();
    expect(second.useSettings.getState().sound).toBe(false);
    expect(second.useSettings.getState().volume).toBe(0.25);
  });

  it('ignores non-finite volumes so settings are not reset', async () => {
    const { useSettings } = await load();
    useSettings.getState().setVolume(0.3);
    useSettings.getState().setVolume(Number.NaN);
    useSettings.getState().setVolume(Number.POSITIVE_INFINITY);
    expect(useSettings.getState().volume).toBe(0.3);
    expect(JSON.parse(store.get('knightlight:v1:settings') ?? '{}')).toMatchObject({ volume: 0.3 });
  });

  it('accepts older saved settings without a volume (sound migrates to the new default ON) and rejects bad volumes', async () => {
    const { validateSettings, DEFAULT_VOLUME } = await load();
    const old = { version: 1, theme: 'light', boardTheme: 'cream', sound: false, presentScale: 1 };
    expect(validateSettings(old)).toMatchObject({ sound: true, volume: DEFAULT_VOLUME });
    expect(validateSettings({ ...old, volume: 0.4 })).toMatchObject({ sound: false, volume: 0.4 });
    expect(validateSettings({ ...old, volume: 2 })).toBeNull();
    expect(validateSettings({ ...old, volume: 'loud' })).toBeNull();
  });
});
