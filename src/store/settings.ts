import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { isBool, isNum, isRecord, isStr, KEYS, parseJson, readRaw, writeRaw } from './storage';

export type ThemeSetting = 'light' | 'dark' | 'system';
export const THEMES: readonly ThemeSetting[] = ['light', 'dark', 'system'];

export interface BoardPalette {
  light: string;
  dark: string;
  /** Notation colour on light and dark squares (each at least 4.5:1). */
  onLight: string;
  onDark: string;
}
const INK = '#111111';
const PAPER = '#F4EEE2';
export const BOARD_THEMES = {
  /** Default: parchment and soft sage. */
  cream: { light: '#F6EDD6', dark: '#4F877D', onLight: INK, onDark: INK },
  /** Used instead of `cream` when the app is in dark mode: dimmer squares, less glare on a dark page. */
  dusk: { light: '#CDBF9F', dark: '#2F5F5A', onLight: INK, onDark: PAPER },
  /** Projector: white and mid teal, the strongest square contrast that keeps notation readable. */
  projector: { light: '#FFFFFF', dark: '#4F877D', onLight: INK, onDark: INK },
  sunset: { light: '#FBE3C2', dark: '#C97B5A', onLight: INK, onDark: INK },
  slate: { light: '#DDE3E8', dark: '#6B7F94', onLight: INK, onDark: INK },
} as const satisfies Record<string, BoardPalette>;
export type BoardThemeId = keyof typeof BOARD_THEMES;
/** Themes a person can pick. `dusk` is applied automatically to `cream` in dark mode. */
export const PICKABLE_BOARD_THEMES: readonly BoardThemeId[] = ['cream', 'projector', 'sunset', 'slate'];
export const BOARD_THEME_IDS = Object.keys(BOARD_THEMES) as BoardThemeId[];

export const PRESENT_SCALE_MIN = 1;
export const PRESENT_SCALE_MAX = 2;

export interface SettingsData {
  version: 1;
  theme: ThemeSetting;
  boardTheme: BoardThemeId;
  sound: boolean;
  /** Sound effect volume, 0 to 1. */
  volume: number;
  presentScale: number;
}

export const DEFAULT_VOLUME = 0.6;

export const DEFAULT_SETTINGS: SettingsData = { version: 1, theme: 'system', boardTheme: 'cream', sound: true, volume: DEFAULT_VOLUME, presentScale: 1 };

export function validateSettings(v: unknown): SettingsData | null {
  if (!isRecord(v) || v.version !== 1) return null;
  if (!isStr(v.theme) || !(THEMES as readonly string[]).includes(v.theme)) return null;
  if (!isStr(v.boardTheme) || !(BOARD_THEME_IDS as readonly string[]).includes(v.boardTheme)) return null;
  if (!isBool(v.sound)) return null;
  if (v.volume !== undefined && (!isNum(v.volume) || v.volume < 0 || v.volume > 1)) return null;
  if (!isNum(v.presentScale) || v.presentScale < PRESENT_SCALE_MIN || v.presentScale > PRESENT_SCALE_MAX) return null;
  return { version: 1, theme: v.theme as ThemeSetting, boardTheme: v.boardTheme as BoardThemeId, sound: v.volume === undefined ? true : v.sound, volume: v.volume ?? DEFAULT_VOLUME, presentScale: v.presentScale };
}

function readSettings(): SettingsData {
  return validateSettings(parseJson(readRaw(KEYS.settings))) ?? DEFAULT_SETTINGS;
}

interface SettingsState extends SettingsData {
  setTheme: (theme: ThemeSetting) => void;
  setBoardTheme: (id: BoardThemeId) => void;
  setSound: (on: boolean) => void;
  setVolume: (volume: number) => void;
  setPresentScale: (scale: number) => void;
  reload: () => void;
}

export const useSettings = create<SettingsState>()((set, get) => {
  const persist = (): void => {
    const { theme, boardTheme, sound, volume, presentScale } = get();
    writeRaw(KEYS.settings, JSON.stringify({ version: 1, theme, boardTheme, sound, volume, presentScale } satisfies SettingsData));
  };
  return {
    ...readSettings(),
    setTheme: (theme) => {
      set({ theme });
      persist();
    },
    setBoardTheme: (boardTheme) => {
      set({ boardTheme });
      persist();
    },
    setSound: (sound) => {
      set({ sound });
      persist();
    },
    setVolume: (volume) => {
      if (!Number.isFinite(volume)) return;
      set({ volume: Math.min(1, Math.max(0, volume)) });
      persist();
    },
    setPresentScale: (scale) => {
      set({ presentScale: Math.min(PRESENT_SCALE_MAX, Math.max(PRESENT_SCALE_MIN, scale)) });
      persist();
    },
    reload: () => set(readSettings()),
  };
});

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function isDarkTheme(theme: ThemeSetting): boolean {
  return theme === 'dark' || (theme === 'system' && systemPrefersDark());
}

function subscribeSystemTheme(onChange: () => void): () => void {
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  } catch {
    return () => undefined;
  }
}

/** True while the app is drawn dark. Re-renders when the setting or the system preference changes. */
export function useIsDark(): boolean {
  const theme = useSettings((s) => s.theme);
  const system = useSyncExternalStore(subscribeSystemTheme, systemPrefersDark, () => false);
  return theme === 'dark' || (theme === 'system' && system);
}

/** The palette actually drawn: `cream` becomes `dusk` in dark mode. */
export function effectiveBoardTheme(id: BoardThemeId, dark: boolean): BoardThemeId {
  return id === 'cream' && dark ? 'dusk' : id;
}

function applyDom(): void {
  if (typeof document === 'undefined') return;
  const { theme, presentScale } = useSettings.getState();
  const dark = isDarkTheme(theme);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.setProperty('--kl-present-scale', String(presentScale));
}

if (typeof window !== 'undefined') {
  applyDom();
  useSettings.subscribe(applyDom);
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyDom);
  } catch {
    /* matchMedia unavailable */
  }
}
