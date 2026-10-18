import { create } from 'zustand';
import { isBool, isNum, isRecord, isStr, KEYS, parseJson, readRaw, writeRaw } from './storage';

export type ThemeSetting = 'light' | 'dark' | 'system';
export const THEMES: readonly ThemeSetting[] = ['light', 'dark', 'system'];

export const BOARD_THEMES = {
  cream: { light: '#F3E9D2', dark: '#3F8587' },
  sunset: { light: '#FBE3C2', dark: '#C97B5A' },
  slate: { light: '#DDE3E8', dark: '#6B7F94' },
} as const;
export type BoardThemeId = keyof typeof BOARD_THEMES;
export const BOARD_THEME_IDS = Object.keys(BOARD_THEMES) as BoardThemeId[];

export const PRESENT_SCALE_MIN = 1;
export const PRESENT_SCALE_MAX = 2;

export interface SettingsData {
  version: 1;
  theme: ThemeSetting;
  boardTheme: BoardThemeId;
  sound: boolean;
  presentScale: number;
}

export const DEFAULT_SETTINGS: SettingsData = { version: 1, theme: 'system', boardTheme: 'cream', sound: false, presentScale: 1 };

export function validateSettings(v: unknown): SettingsData | null {
  if (!isRecord(v) || v.version !== 1) return null;
  if (!isStr(v.theme) || !(THEMES as readonly string[]).includes(v.theme)) return null;
  if (!isStr(v.boardTheme) || !(BOARD_THEME_IDS as readonly string[]).includes(v.boardTheme)) return null;
  if (!isBool(v.sound)) return null;
  if (!isNum(v.presentScale) || v.presentScale < PRESENT_SCALE_MIN || v.presentScale > PRESENT_SCALE_MAX) return null;
  return { version: 1, theme: v.theme as ThemeSetting, boardTheme: v.boardTheme as BoardThemeId, sound: v.sound, presentScale: v.presentScale };
}

function readSettings(): SettingsData {
  return validateSettings(parseJson(readRaw(KEYS.settings))) ?? DEFAULT_SETTINGS;
}

interface SettingsState extends SettingsData {
  setTheme: (theme: ThemeSetting) => void;
  setBoardTheme: (id: BoardThemeId) => void;
  setSound: (on: boolean) => void;
  setPresentScale: (scale: number) => void;
  reload: () => void;
}

export const useSettings = create<SettingsState>()((set, get) => {
  const persist = (): void => {
    const { theme, boardTheme, sound, presentScale } = get();
    writeRaw(KEYS.settings, JSON.stringify({ version: 1, theme, boardTheme, sound, presentScale } satisfies SettingsData));
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

function applyDom(): void {
  if (typeof document === 'undefined') return;
  const { theme, presentScale } = useSettings.getState();
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
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
