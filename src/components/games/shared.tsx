import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Button, { ButtonLink } from '../Button';
import Card from '../Card';
import { fmt, m } from '../../i18n';
import type { GameId } from '../../lib/games';
import { useProgress } from '../../store/progress';

export function GameEmblem({ game, className = '' }: { game: GameId; className?: string }) {
  return (
    <svg viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {game === 'castle' ? <><path d="M15 85V28h15v12h14V20h15v20h14V28h15v57M12 85h80M42 85V66a12 12 0 0 1 24 0v19M21 56h8m45 0h8" /><path d="M53 20V6l23 7-23 7" fill="currentColor" strokeWidth="2" /><path d="m96 49 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2 5-10Z" fill="var(--color-amber)" strokeWidth="2" /></> : null}
      {game === 'knight' ? <><path d="M22 83h71M29 75h55M37 67c-1-17 19-21 12-35l-17 8-7-9 19-22 22 9c18 12 12 34 20 49M46 10l1-7 11 11M41 26h1" /><path d="m99 10 9 10-9 10-9-10 9-10ZM12 57l6 7-6 7-6-7 6-7Z" fill="var(--color-amber)" strokeWidth="2" /><path d="m95 42 5 5m-1 9 5 5" strokeDasharray="2 6" /></> : null}
      {game === 'detective' ? <><path d="M12 70V24h32l9 10h45v45H12v-9" /><circle cx="59" cy="49" r="20" fill="var(--kl-surface)" /><path d="m74 64 22 23M51 47l6 6 11-13" /><path d="M21 15h23l8 9" stroke="var(--color-amber)" /></> : null}
    </svg>
  );
}

export function Stars({ count }: { count: number }) {
  return <span className="inline-flex gap-1 text-xl" role="img" aria-label={fmt(m().games.stars, { count })}>{[1, 2, 3].map((n) => <span key={n} aria-hidden="true" className={n <= count ? 'text-ink dark:text-lamp' : 'text-muted'}>{n <= count ? m().games.symbols.star : m().games.symbols.openStar}</span>)}</span>;
}

export function GameHeader({ game }: { game: GameId }) {
  return <header className="kl-game-header mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><GameEmblem game={game} className="h-14 w-16 shrink-0 text-fg" /><div><h1 className="text-2xl font-bold sm:text-3xl">{m().games[game].title}</h1><p className="text-muted">{m().games[game].skill}</p></div></div><Link to="/games" className="inline-flex min-h-11 items-center font-bold underline">{m().games.back}</Link></header>;
}

export function GameLayout({ board, children }: { board: ReactNode; children: ReactNode }) {
  return <div className="kl-game-layout"><div className="kl-game-board">{board}</div><div className="kl-game-panel min-w-0 space-y-4">{children}</div></div>;
}

export function useGameSave(game: GameId, stageId: string, profileId: string) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [stars, setStars] = useState<1 | 2 | 3>(1);
  const save = (value: 1 | 2 | 3): void => {
    setStars(value);
    setSaved(useProgress.getState().recordMiniGame(game, stageId, value, profileId));
  };
  return { saved, stars, save, retry: () => save(stars) };
}

export function Completed({ stars, saved, retry, onReplay, next }: { stars: number; saved: boolean | null; retry: () => void; onReplay: () => void; next?: ReactNode }) {
  return <Card variant="hero" className="kl-game-completed space-y-3"><h2 className="text-2xl font-extrabold">{m().games.complete}</h2><Stars count={stars} /><p role="status">{saved ? fmt(m().games.earned, { count: stars }) : m().games.saveFailed}</p>{!saved ? <Button onClick={retry}>{m().games.retrySave}</Button> : null}<div className="flex flex-wrap gap-2">{next}<Button variant="secondary" onClick={onReplay}>{m().games.replay}</Button><ButtonLink to="/games" variant="ghost">{m().games.back}</ButtonLink></div></Card>;
}
