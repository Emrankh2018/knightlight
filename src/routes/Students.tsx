import { useEffect, useMemo, useRef, useState } from 'react';
import AssignLinkMaker from '../components/students/AssignLinkMaker';
import BackupPanel from '../components/students/BackupPanel';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import ConfirmDialog from '../components/students/ConfirmDialog';
import Leaderboard from '../components/students/Leaderboard';
import StudentForm from '../components/students/StudentForm';
import { fmt, m } from '../i18n';
import { todayLocal } from '../lib/date';
import { statsFor, type SortKey, type StudentStats } from '../lib/leaderboard';
import { resetStudentProgress } from '../store/backup';
import { AVATARS, MAX_STUDENTS, useProfiles } from '../store/profiles';
import { readProgress, useProgress } from '../store/progress';
import { useUi } from '../store/ui';

type Dialog =
  | { kind: 'add' }
  | { kind: 'edit'; id: string }
  | { kind: 'delete'; id: string }
  | { kind: 'reset'; id: string };

export default function Students() {
  const t = m().students;
  const profiles = useProfiles((s) => s.profiles);
  const activeId = useProfiles((s) => s.activeId);
  const { add, rename, setAvatar, remove, switchTo } = useProfiles.getState();
  const activeData = useProgress((s) => s.data);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<SortKey>('xp');
  const [big, setBig] = useState(false);
  // Bumped when stored progress changes without the profile list or the active student changing (a reset).
  const [progressRev, setProgressRev] = useState(0);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [focusStatus, setFocusStatus] = useState(0);
  const projectorRef = useRef<HTMLButtonElement>(null);
  const wasBig = useRef(false);

  const rows = useMemo<StudentStats[]>(() => {
    void progressRev; // dependency only: forces a fresh read of every student's stored progress
    const today = todayLocal();
    return profiles.map((p) => statsFor(p, p.id === activeId ? activeData : readProgress(p.id), today));
  }, [profiles, activeId, activeData, progressRev]);

  useEffect(() => {
    if (focusStatus > 0) statusRef.current?.focus();
  }, [focusStatus]);

  useEffect(() => {
    if (wasBig.current && !big) projectorRef.current?.focus();
    wasBig.current = big;
  }, [big]);

  useEffect(() => {
    if (!big) return;
    document.documentElement.dataset.classMode = '';
    useUi.getState().setSuppressToasts(true);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setBig(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      delete document.documentElement.dataset.classMode;
      useUi.getState().setSuppressToasts(false);
      document.removeEventListener('keydown', onKey);
    };
  }, [big]);

  const target = dialog && dialog.kind !== 'add' ? profiles.find((p) => p.id === dialog.id) : undefined;
  const close = (): void => setDialog(null);

  if (big) {
    return (
      <Leaderboard rows={rows} sort={sort} onSort={setSort} big onToggleBig={() => setBig(false)} />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-baseline gap-x-4">
        <h1 className="text-3xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted">{t.privacy}</p>
      </header>

      <p
        ref={statusRef}
        role="status"
        tabIndex={-1}
        className="sticky top-2 z-30 rounded-xl border-2 border-ink bg-amber px-4 py-3 text-lg font-extrabold text-ink shadow-lg focus:outline-none focus-visible:outline-4 empty:hidden dark:border-amber"
      >
        {status}
      </p>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
      <div className="min-h-0 space-y-3 lg:overflow-y-auto lg:pe-1">
      <section aria-labelledby="roster-title" className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="roster-title" className="me-auto text-2xl font-extrabold">{t.listTitle}</h2>
          <span className="text-lg text-muted">{fmt(t.count, { count: profiles.length })}</span>
          <Button
            onClick={() => {
              if (profiles.length >= MAX_STUDENTS) setStatus(fmt(t.tooMany, { max: MAX_STUDENTS }));
              else setDialog({ kind: 'add' });
            }}
          >
            {t.add}
          </Button>
        </div>
        <ul className="grid gap-3 xl:grid-cols-2">
          {rows.map((r) => {
            const isActive = r.id === activeId;
            const only = profiles.length <= 1;
            return (
              <li key={r.id} className={`space-y-2 rounded-card border-2 bg-surface p-3 ${isActive ? 'border-ink dark:border-amber' : 'border-line'}`}>
                <div className="flex items-center gap-3">
                  <Avatar value={r.avatar} size="md" />
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-xl font-extrabold">{r.name}</h3>
                    {isActive ? <span className="inline-block rounded-full bg-amber px-3 py-0.5 text-base font-extrabold text-ink">{t.active}</span> : null}
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-base">
                  {(
                    [
                      [t.stats.level, r.level],
                      [t.stats.xp, r.xp],
                      [t.stats.streak, r.streak],
                      [t.stats.puzzles, r.puzzles],
                      [t.stats.lessons, r.lessons],
                      [t.stats.achievements, r.achievements],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-sm text-muted">{label}</dt>
                      <dd className="font-extrabold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap items-center gap-3">
                  {isActive ? null : (
                    <Button
                      aria-label={fmt(t.makeActive, { name: r.name })}
                      onClick={() => {
                        switchTo(r.id);
                        setStatus(fmt(t.nowActive, { name: r.name }));
                      }}
                    >
                      {t.makeActiveShort}
                    </Button>
                  )}
                  <Button variant="secondary" aria-label={fmt(t.editLabel, { name: r.name })} onClick={() => setDialog({ kind: 'edit', id: r.id })}>{t.edit}</Button>
                  <Button variant="secondary" aria-label={fmt(t.resetLabel, { name: r.name })} onClick={() => setDialog({ kind: 'reset', id: r.id })}>{t.reset}</Button>
                  <Button
                    variant="danger"
                    className="ms-auto"
                    aria-label={fmt(t.deleteLabel, { name: r.name })}
                    aria-disabled={only}
                    aria-describedby={only ? 'delete-last-note' : undefined}
                    onClick={() => {
                      if (!only) setDialog({ kind: 'delete', id: r.id });
                    }}
                  >
                    {t.delete}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        {profiles.length <= 1 ? <p id="delete-last-note" className="text-base text-muted">{t.deleteLast}</p> : null}
      </section>

      <details>
        <summary className="min-h-11 cursor-pointer text-xl font-bold">{m().students.backup.title}</summary>
        <BackupPanel />
      </details>
      </div>
      <div className="min-h-0 space-y-3 lg:overflow-y-auto lg:pe-1">
      <Leaderboard rows={rows} sort={sort} onSort={setSort} big={false} onToggleBig={() => setBig(true)} toggleRef={projectorRef} />

      <details>
        <summary className="min-h-11 cursor-pointer text-xl font-bold">{m().students.link.title}</summary>
        <AssignLinkMaker />
      </details>
      </div>
      </div>

      {dialog?.kind === 'add' ? (
        <StudentForm
          mode="add"
          others={profiles}
          initialName=""
          initialAvatar={nextAvatar(profiles.map((p) => p.avatar))}
          onClose={close}
          onSave={(name, avatar) => {
            setStatus(add(name, avatar) === null ? fmt(t.tooMany, { max: MAX_STUDENTS }) : fmt(t.added, { name }));
            close();
          }}
        />
      ) : null}
      {dialog?.kind === 'edit' && target ? (
        <StudentForm
          mode="edit"
          others={profiles}
          selfId={target.id}
          initialName={target.name}
          initialAvatar={target.avatar}
          onClose={close}
          onSave={(name, avatar) => {
            rename(target.id, name);
            setAvatar(target.id, avatar);
            setStatus(fmt(t.saved, { name }));
            close();
          }}
        />
      ) : null}
      {dialog?.kind === 'delete' && target ? (
        <ConfirmDialog
          title={fmt(t.deleteTitle, { name: target.name })}
          body={fmt(t.deleteBody, { name: target.name })}
          confirmLabel={t.deleteConfirm}
          onClose={close}
          onConfirm={() => {
            setStatus(remove(target.id) ? fmt(t.deleted, { name: target.name }) : t.actionFailed);
            close();
            setFocusStatus((n) => n + 1);
          }}
        />
      ) : null}
      {dialog?.kind === 'reset' && target ? (
        <ConfirmDialog
          title={fmt(t.resetTitle, { name: target.name })}
          body={fmt(t.resetBody, { name: target.name })}
          confirmLabel={fmt(t.resetConfirm, { name: target.name })}
          onClose={close}
          onConfirm={() => {
            setStatus(resetStudentProgress(target.id) ? fmt(t.resetDone, { name: target.name }) : t.actionFailed);
            setProgressRev((n) => n + 1);
            close();
            setFocusStatus((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function nextAvatar(used: readonly string[]): string {
  return AVATARS.find((a) => !used.includes(a)) ?? AVATARS[0];
}
