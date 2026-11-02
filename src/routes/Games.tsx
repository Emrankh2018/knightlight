import { useEffect, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { fmt, m } from '../i18n';
import { CASTLE_QUESTS, DETECTIVE_CASES, GAME_IDS, KNIGHT_LEVELS, type GameId } from '../lib/games';
import { useProfiles } from '../store/profiles';
import { useProgress } from '../store/progress';
import { buttonClass } from '../components/Button';
import { GameEmblem } from '../components/games/shared';
import CastleQuest from '../components/games/CastleQuest';
import KnightTrail from '../components/games/KnightTrail';
import ChessDetective from '../components/games/ChessDetective';

export default function Games() {
  const profileId = useProfiles((s) => s.activeId);
  const { pathname } = useLocation();
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pageRef.current) pageRef.current.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [pathname, profileId]);
  return <div ref={pageRef} className="kl-games-page"><GamesContent key={profileId} profileId={profileId} /></div>;
}

function GamesContent({ profileId }: { profileId: string }) {
  const { game } = useParams();
  const progress = useProgress((s) => s.data.games);
  if (game === 'castle') return <CastleQuest profileId={profileId} />;
  if (game === 'knight') return <KnightTrail profileId={profileId} />;
  if (game === 'detective') return <ChessDetective profileId={profileId} />;
  if (game !== undefined) return <><h1 className="text-3xl">{m().common.notFound}</h1><Link to="/games" className={buttonClass('secondary', 'mt-4')}>{m().games.back}</Link></>;
  const totals: Record<GameId, number> = { castle: CASTLE_QUESTS.length, knight: KNIGHT_LEVELS.length, detective: DETECTIVE_CASES.length };
  return <div className="kl-game-hub-page space-y-5"><header className="kl-games-intro max-w-3xl"><h1 className="text-3xl font-bold sm:text-4xl">{m().games.title}</h1><p className="mt-2 text-lg text-muted">{m().games.intro}</p></header><div className="kl-game-hub">{GAME_IDS.map((id) => {
    const stars = Object.values(progress?.[id] ?? {}).reduce((sum, item) => sum + item.stars, 0);
    return <section key={id} className={`kl-adventure-card kl-adventure-${id}`}><GameEmblem game={id} className="kl-adventure-emblem" /><div className="relative space-y-3"><h2 className="kl-display text-2xl font-bold sm:text-3xl">{m().games[id].title}</h2><p className="max-w-lg text-lg">{m().games[id].intro}</p><p className="font-bold">{m().games[id].skill}</p><p>{fmt(m().games.hubProgress, { stars, total: totals[id] * 3 })}</p><Link to={`/games/${id}`} className={buttonClass('primary')}>{id === 'castle' ? m().games.start : m().games.play}<span className="sr-only"> {m().games[id].title}</span></Link></div></section>;
  })}</div><p className="text-muted">{m().games.help}</p></div>;
}
