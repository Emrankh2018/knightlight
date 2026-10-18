/** localStorage access that never throws (private mode, quota, blocked storage). */

export const KEYS = {
  profiles: 'knightlight:v1:profiles',
  settings: 'knightlight:v1:settings',
  progress: (id: string): string => `knightlight:v1:profile:${id}`,
  progressBackup: (id: string): string => `knightlight:v1:profile:${id}:backup`,
} as const;

export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeRaw(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable: nothing to remove */
  }
}

export function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const isCount = (v: unknown): v is number => isNum(v) && v >= 0 && Number.isInteger(v);
export const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
export const isStr =(v: unknown): v is string => typeof v === 'string';
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Safe object key check so imported JSON cannot smuggle prototype keys. */
export const isSafeKey = (k: string): boolean => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
