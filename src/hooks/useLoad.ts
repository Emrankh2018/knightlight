import { useEffect, useState } from 'react';

export type LoadState<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

/** Runs `load` when its identity changes (keep it stable with useCallback or a module function). */
export function useLoad<T>(load: () => Promise<T>): LoadState<T> {
  const [res, setRes] = useState<{ load: () => Promise<T>; state: LoadState<T> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setRes({ load, state: { status: 'ready', data } });
      },
      () => {
        if (!cancelled) setRes({ load, state: { status: 'error' } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load]);
  return res !== null && res.load === load ? res.state : { status: 'loading' };
}
