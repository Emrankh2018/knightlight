const KEY = 'knightlight:teacher-notes';
export const MAX_NOTES_CHARS = 5000;

/** Notes for this browser session. Never throws (storage can be blocked). */
export function loadNotes(): string {
  try {
    return sessionStorage.getItem(KEY)?.slice(0, MAX_NOTES_CHARS) ?? '';
  } catch {
    return '';
  }
}

export function saveNotes(text: string): void {
  try {
    sessionStorage.setItem(KEY, text.slice(0, MAX_NOTES_CHARS));
  } catch {
    /* storage unavailable: the notes simply stay on the page */
  }
}
