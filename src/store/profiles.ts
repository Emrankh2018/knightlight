import { create } from 'zustand';
import { fmt, m } from '../i18n';
import { clampName } from '../lib/students';
import { isRecord, isStr, isNum, KEYS, parseJson, readRaw, removeRaw, writeRaw } from './storage';

export const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🐸', '🐙', '🦄', '🐢', '🦉', '🐧', '🐬', '🦋', '🚀', '⭐', '🎲', '👑'] as const;

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
}

export interface ProfilesData {
  version: 1;
  profiles: Profile[];
  activeId: string;
}

/** Most students one device holds; keeps a class list and an import a sane size. */
export const MAX_STUDENTS = 200;

function isProfile(v: unknown): v is Profile {
  return (
    isRecord(v) &&
    isStr(v.id) &&
    v.id.length > 0 &&
    /^[A-Za-z0-9_-]+$/.test(v.id) &&
    isStr(v.name) &&
    isStr(v.avatar) &&
    (AVATARS as readonly string[]).includes(v.avatar) &&
    isNum(v.createdAt)
  );
}

/** Strict structural check; returns null when the value is not valid profile data. */
export function validateProfiles(v: unknown): ProfilesData | null {
  if (!isRecord(v) || v.version !== 1 || !Array.isArray(v.profiles) || !isStr(v.activeId)) return null;
  if (v.profiles.length > MAX_STUDENTS) return null;
  const profiles: Profile[] = [];
  for (const p of v.profiles as unknown[]) {
    if (!isProfile(p)) return null;
    const name = clampName(p.name);
    if (name.length === 0) return null;
    profiles.push({ id: p.id, name, avatar: p.avatar, createdAt: p.createdAt });
  }
  if (profiles.length === 0) return null;
  if (new Set(profiles.map((p) => p.id)).size !== profiles.length) return null;
  if (!profiles.some((p) => p.id === v.activeId)) return null;
  return { version: 1, profiles, activeId: v.activeId };
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

function defaultData(): ProfilesData {
  const id = newId();
  return {
    version: 1,
    profiles: [{ id, name: fmt(m().profile.defaultName, { n: 1 }), avatar: AVATARS[0], createdAt: Date.now() }],
    activeId: id,
  };
}

export function readProfiles(): ProfilesData {
  const valid = validateProfiles(parseJson(readRaw(KEYS.profiles)));
  if (valid) return valid;
  const fresh = defaultData();
  writeRaw(KEYS.profiles, JSON.stringify(fresh));
  return fresh;
}

interface ProfilesState extends ProfilesData {
  /** Returns the new id, or null (and does nothing) when MAX_STUDENTS is reached. */
  add: (name: string, avatar?: string) => string | null;
  rename: (id: string, name: string) => void;
  setAvatar: (id: string, avatar: string) => void;
  /** Returns false (and does nothing) when it is the last profile or the id is unknown. */
  remove: (id: string) => boolean;
  switchTo: (id: string) => void;
  /** Re-reads storage (after an import). */
  reload: () => void;
}

const cleanName = clampName;

export const useProfiles = create<ProfilesState>()((set, get) => {
  const persist = (): void => {
    const { profiles, activeId } = get();
    writeRaw(KEYS.profiles, JSON.stringify({ version: 1, profiles, activeId } satisfies ProfilesData));
  };
  return {
    ...readProfiles(),
    add: (name, avatar) => {
      const { profiles } = get();
      if (profiles.length >= MAX_STUDENTS) return null;
      const id = newId();
      const profile: Profile = {
        id,
        name: cleanName(name) || fmt(m().profile.defaultName, { n: profiles.length + 1 }),
        avatar: avatar && (AVATARS as readonly string[]).includes(avatar) ? avatar : (AVATARS[profiles.length % AVATARS.length] ?? AVATARS[0]),
        createdAt: Date.now(),
      };
      set({ profiles: [...profiles, profile], activeId: id });
      persist();
      return id;
    },
    rename: (id, name) => {
      const clean = cleanName(name);
      if (!clean) return;
      set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, name: clean } : p)) }));
      persist();
    },
    setAvatar: (id, avatar) => {
      if (!(AVATARS as readonly string[]).includes(avatar)) return;
      set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, avatar } : p)) }));
      persist();
    },
    remove: (id) => {
      const { profiles, activeId } = get();
      if (profiles.length <= 1 || !profiles.some((p) => p.id === id)) return false;
      const rest = profiles.filter((p) => p.id !== id);
      const next = activeId === id ? (rest[0]?.id ?? activeId) : activeId;
      set({ profiles: rest, activeId: next });
      persist();
      removeRaw(KEYS.progress(id));
      removeRaw(KEYS.progressBackup(id));
      return true;
    },
    switchTo: (id) => {
      if (!get().profiles.some((p) => p.id === id)) return;
      set({ activeId: id });
      persist();
    },
    reload: () => set(readProfiles()),
  };
});

const FALLBACK: Profile = { id: 'fallback', name: '', avatar: AVATARS[0], createdAt: 0 };

export function useActiveProfile(): Profile {
  return useProfiles((s) => s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0] ?? FALLBACK);
}
