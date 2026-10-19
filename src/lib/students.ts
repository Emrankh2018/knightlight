export const MAX_STUDENT_NAME = 30;

export type NameProblem = 'empty' | 'tooLong' | 'duplicate';

/** Strips control and invisible characters, collapses whitespace and trims. */
export function sanitizeName(raw: string): string {
  return raw.normalize('NFC').replace(/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Sanitises a name and cuts it to the maximum length. Returns '' when nothing usable is left. */
export function clampName(raw: string): string {
  // Cut a huge string before normalising it; drop a half emoji (lone surrogate) left at the final cut.
  return sanitizeName(raw.slice(0, MAX_STUDENT_NAME * 4)).slice(0, MAX_STUDENT_NAME).replace(/\p{Cs}/gu, '').trim();
}

/** Returns the first problem with a (raw) name, or null when it is fine. Duplicates ignore case and `selfId`. */
export function nameProblem(
  raw: string,
  others: readonly { id: string; name: string }[],
  selfId?: string,
): NameProblem | null {
  const name = sanitizeName(raw);
  if (name.length === 0) return 'empty';
  if (name.length > MAX_STUDENT_NAME) return 'tooLong';
  const key = name.toLocaleLowerCase();
  if (others.some((p) => p.id !== selfId && sanitizeName(p.name).toLocaleLowerCase() === key)) return 'duplicate';
  return null;
}
