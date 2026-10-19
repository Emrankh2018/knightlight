/**
 * Routes that are finished enough to show students. Flip an entry to `true` to bring the
 * route back into the nav and onto Home. Direct URLs always resolve, ready or not.
 */
export const READY_ROUTES: Readonly<Record<string, boolean>> = {
  '/courses': false,
  '/puzzles': true,
  '/tactics': true,
  '/teacher': false,
  '/openings': true,
  '/play': false,
  '/review': false,
  '/students': false,
  '/assign': false,
};

export function isReady(path: string): boolean {
  return path === '/' || READY_ROUTES[path] === true;
}
