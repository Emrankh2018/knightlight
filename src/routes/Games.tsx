import { useEffect, useRef } from 'react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import Card from '../components/Card';
import { PieceIcon, type PieceName } from '../components/icons';
import ArmyDraft from '../components/arcade/ArmyDraft';
import BossBattle from '../components/arcade/BossBattle';
import ComboChess from '../components/arcade/ComboChess';
import { fmt, m } from '../i18n';
import { useProfiles } from '../store/profiles';

const GAME_IDS = ['boss', 'combo', 'army'] as const;
type GameId = typeof GAME_IDS[number];
const GAMES = { boss: BossBattle, combo: ComboChess, army: ArmyDraft };
const EMBLEMS: Record<GameId, PieceName> = { boss: 'queen', combo: 'knight', army: 'rook' };

function isGameId(id: string): id is GameId {
  return GAME_IDS.some((game) => game === id);
}

export default function Games() {
  const { game } = useParams();
  const [search] = useSearchParams();
  const { pathname, search: locationSearch } = useLocation();
  const activeId = useProfiles((state) => state.activeId);
  const page = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const t = m().arcade;
  const rawMode = search.get('mode');
  const mode = rawMode === 'computer' || rawMode === 'local' ? rawMode : null;

  useEffect(() => {
    page.current?.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [pathname, locationSearch]);

  if (game !== undefined && !isGameId(game)) return <Navigate to="/" replace />;

  if (!game) {
    return (
      <div className="kl-arcade-page space-y-5" ref={page}>
        <header>
          <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold focus:outline-none sm:text-4xl">{t.title}</h1>
          <p className="mt-2 text-lg text-muted">{t.intro}</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          {GAME_IDS.map((id) => {
            const info = t[id];
            const teaser = id === 'army' ? t.army.summary : t[id].teaser;
            return (
              <Card key={id} variant="interactive" className="flex min-w-0 flex-col p-0!">
                <div className={`kl-arcade-emblem kl-arcade-emblem-${id}`}>
                  <PieceIcon piece={EMBLEMS[id]} className="size-16" />
                </div>
                <div className="flex flex-1 flex-col items-start gap-3 p-4 sm:p-5">
                  <p className="text-sm font-extrabold tracking-wide text-muted uppercase">{info.genre}</p>
                  <h2 className="text-2xl font-bold">{info.title}</h2>
                  <p className="text-fg">{teaser}</p>
                  <ButtonLink to={`/games/${id}`} className="mt-auto">{fmt(t.play, { game: info.title })}</ButtonLink>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const Game = GAMES[game];
  const description = game === 'army' ? t.army.summary : t[game].rules;
  return (
    <div className="kl-arcade-page" ref={page}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold focus:outline-none sm:text-3xl">{t[game].title}</h1>
        <div className="flex flex-wrap gap-2">
          {mode && <ButtonLink to={`/games/${game}`} variant="ghost">{t.changeMode}</ButtonLink>}
          <ButtonLink to="/games" variant="secondary">{t.back}</ButtonLink>
        </div>
      </header>
      {mode ? (
        <Game key={`${game}-${mode}-${activeId}`} mode={mode} />
      ) : (
        <Card variant="hero" className="max-w-3xl space-y-4">
          <p className="text-lg">{description}</p>
          <h2 className="text-xl font-bold">{t.chooseMode}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['computer', 'local'] as const).map((option) => (
              <div key={option} className="space-y-2">
                <ButtonLink to={`/games/${game}?mode=${option}`} variant={option === 'computer' ? 'primary' : 'secondary'}>{t[option]}</ButtonLink>
                <p className="text-sm text-muted">{option === 'computer' ? t.computerHelp : t.localHelp}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
