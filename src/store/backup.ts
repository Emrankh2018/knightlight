import { fmt, m } from '../i18n';
import { useProfiles, validateProfiles, type ProfilesData } from './profiles';
import { emptyProgress, readProgress, useProgress, validateProgress, type Progress } from './progress';
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
  const { theme, boardTheme, sound, volume, presentScale } = useSettings.getState();
  const file: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profiles: { version: 1, profiles, activeId },
    progress,
    settings: { version: 1, theme, boardTheme, sound, volume, presentScale },
  };
  return JSON.stringify(file, null, 2);
}

export type ImportResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Largest backup text accepted, in characters. Real backups are far smaller. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** A backup that passed every check. Nothing has been written yet. */
export interface ValidBackup {
  exportedAt: string;
  profiles: ProfilesData;
  progress: Record<string, Progress>;
  settings: SettingsData;
}

export type ParsedBackup = { ok: true; backup: ValidBackup } | { ok: false; error: string };

/** Validates the whole backup text without touching storage. */
export function parseBackup(json: string): ParsedBackup {
  if (json.length > MAX_IMPORT_BYTES) return fail(m().backup.tooLarge);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    return fail(m().backup.badJson);
  }
  if (!isRecord(parsed) || parsed.app !== BACKUP_APP || !isNum(parsed.version)) return fail(m().backup.badStructure);
  if (parsed.version !== BACKUP_VERSION) return fail(m().backup.badVersion);

  const profiles = validateProfiles(parsed.profiles);
  if (!profiles) return fail(m().backup.badProfiles);
  const settings = validateSettings(parsed.settings);
  if (!settings) return fail(m().backup.badSettings);
  if (!isRecord(parsed.progress)) return fail(m().backup.badProgress);
  const progress: Record<string, Progress> = {};
  for (const p of profiles.profiles) {
    const raw = isSafeKey(p.id) ? parsed.progress[p.id] : undefined;
    const valid = validateProgress(raw);
    if (!valid) return fail(fmt(m().backup.badProgressFor, { name: p.name }));
    progress[p.id] = valid;
  }
  const exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt.slice(0, 40) : '';
  return { ok: true, backup: { exportedAt, profiles, progress, settings } };
}

/**
 * Writes a validated backup, replacing every current student. A failed write is rolled back on a best-effort
 * basis: the previous values are written back, which can itself fail if storage is full or blocked, and a
 * second tab writing at the same moment is not guarded against. The caller should offer an export first.
 */
export function applyBackup({ profiles, settings, progress }: ValidBackup): ImportResult {
  const writes: [string, string][] = [
    [KEYS.profiles, JSON.stringify(profiles)],
    [KEYS.settings, JSON.stringify(settings)],
    ...profiles.profiles.map((p): [string, string] => [KEYS.progress(p.id), JSON.stringify(progress[p.id])]),
  ];
  const staleKeys = useProfiles
    .getState()
    .profiles.filter((p) => !profiles.profiles.some((n) => n.id === p.id))
    .flatMap((p) => [KEYS.progress(p.id), KEYS.progressBackup(p.id)]);
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

/** Validates the whole backup first; only then writes. */
export function importAll(json: string): ImportResult {
  const parsed = parseBackup(json);
  return parsed.ok ? applyBackup(parsed.backup) : parsed;
}

/** Replaces one student's progress with a fresh record (also clears the corrupt-data backup copy). */
export function resetStudentProgress(id: string): boolean {
  if (!useProfiles.getState().profiles.some((p) => p.id === id)) return false;
  removeRaw(KEYS.progressBackup(id));
  if (!writeRaw(KEYS.progress(id), JSON.stringify(emptyProgress()))) return false;
  if (useProgress.getState().profileId === id) useProgress.getState().load(id);
  return true;
}
