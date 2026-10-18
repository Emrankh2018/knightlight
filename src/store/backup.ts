import { fmt, m } from '../i18n';
import { useProfiles, validateProfiles, type ProfilesData } from './profiles';
import { readProgress, useProgress, validateProgress, type Progress } from './progress';
import { useSettings, validateSettings, type SettingsData } from './settings';
import { isRecord, isSafeKey, isNum, KEYS, readRaw, removeRaw, writeRaw } from './storage';

export const BACKUP_APP = 'knightlight';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  profiles: ProfilesData;
  progress: Record<string, Progress>;
  settings: SettingsData;
}

/** JSON of all profiles, their progress and the settings. */
export function exportAll(): string {
  const { profiles, activeId } = useProfiles.getState();
  const progress: Record<string, Progress> = {};
  for (const p of profiles) progress[p.id] = readProgress(p.id);
  const { theme, boardTheme, sound, presentScale } = useSettings.getState();
  const file: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profiles: { version: 1, profiles, activeId },
    progress,
    settings: { version: 1, theme, boardTheme, sound, presentScale },
  };
  return JSON.stringify(file, null, 2);
}

export type ImportResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ImportResult => ({ ok: false, error });

/** Validates the whole backup first; only then writes. A failed write is rolled back. */
export function importAll(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    return fail(m().backup.badJson);
  }
  if (!isRecord(parsed) || parsed.app !== BACKUP_APP || !isNum(parsed.version)) return fail(m().backup.badStructure);
  if (parsed.version !== BACKUP_VERSION) return fail(m().backup.badVersion);

  const profiles = validateProfiles(parsed.profiles);
  if (!profiles) return fail(fmt(m().backup.badField, { where: 'profiles' }));
  const settings = validateSettings(parsed.settings);
  if (!settings) return fail(fmt(m().backup.badField, { where: 'settings' }));
  if (!isRecord(parsed.progress)) return fail(fmt(m().backup.badField, { where: 'progress' }));
  const progress: Record<string, Progress> = {};
  for (const p of profiles.profiles) {
    const raw = isSafeKey(p.id) ? parsed.progress[p.id] : undefined;
    const valid = validateProgress(raw);
    if (!valid) return fail(fmt(m().backup.badField, { where: `progress for ${p.name}` }));
    progress[p.id] = valid;
  }

  const writes: [string, string][] = [
    [KEYS.profiles, JSON.stringify(profiles)],
    [KEYS.settings, JSON.stringify(settings)],
    ...profiles.profiles.map((p): [string, string] => [KEYS.progress(p.id), JSON.stringify(progress[p.id])]),
  ];
  const staleKeys = useProfiles
    .getState()
    .profiles.filter((p) => !profiles.profiles.some((n) => n.id === p.id))
    .map((p) => KEYS.progress(p.id));
  const touched = [...writes.map(([k]) => k), ...staleKeys];
  const previous = new Map<string, string | null>(touched.map((k) => [k, readRaw(k)]));

  const rollback = (): void => {
    for (const [k, v] of previous) {
      if (v === null) removeRaw(k);
      else writeRaw(k, v);
    }
  };
  for (const [k, v] of writes) {
    if (!writeRaw(k, v)) {
      rollback();
      return fail(m().backup.writeFailed);
    }
  }
  for (const k of staleKeys) removeRaw(k);

  useProfiles.getState().reload();
  useSettings.getState().reload();
  useProgress.getState().load(useProfiles.getState().activeId);
  return { ok: true };
}
