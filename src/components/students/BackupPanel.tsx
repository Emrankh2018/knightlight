import { useRef, useState, type ChangeEvent } from 'react';
import { fmt, m } from '../../i18n';
import { todayLocal } from '../../lib/date';
import { statsFor } from '../../lib/leaderboard';
import { applyBackup, exportAll, MAX_IMPORT_BYTES, parseBackup, type ValidBackup } from '../../store/backup';
import { useProfiles } from '../../store/profiles';
import { emptyProgress } from '../../store/progress';
import Button from '../Button';
import ConfirmDialog from './ConfirmDialog';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

function download(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function BackupPanel() {
  const t = m().students.backup;
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState<ValidBackup | null>(null);
  const [savedFirst, setSavedFirst] = useState(false);
  const currentCount = useProfiles((s) => s.profiles.length);

  const onExport = (): void => {
    download(exportAll(), `knightlight-backup-${todayLocal()}.json`);
    setNotice({ kind: 'ok', text: t.exported });
  };

  const onExportFirst = (): void => {
    download(exportAll(), `knightlight-backup-${todayLocal()}.json`);
    setSavedFirst(true);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setNotice(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setNotice({ kind: 'error', text: fmt(t.importFailed, { reason: fmt(t.tooBig, { max: MAX_IMPORT_BYTES / (1024 * 1024) }) }) });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNotice({ kind: 'error', text: fmt(t.importFailed, { reason: t.readFailed }) });
      return;
    }
    const parsed = parseBackup(text);
    if (parsed.ok) setPending(parsed.backup);
    else setNotice({ kind: 'error', text: fmt(t.importFailed, { reason: parsed.error }) });
  };

  const confirm = (): void => {
    if (!pending) return;
    const result = applyBackup(pending);
    const count = pending.profiles.profiles.length;
    setPending(null);
    setSavedFirst(false);
    setNotice(result.ok ? { kind: 'ok', text: fmt(t.imported, { count }) } : { kind: 'error', text: fmt(t.importFailed, { reason: result.error }) });
  };

  const today = todayLocal();
  const date = pending && /^\d{4}-\d{2}-\d{2}/.test(pending.exportedAt) ? fmt(t.previewDate, { date: pending.exportedAt.slice(0, 10) }) : '';

  return (
    <section aria-labelledby="backup-title" className="space-y-3">
      <h2 id="backup-title" className="text-2xl font-extrabold">{t.title}</h2>
      <p className="text-lg">{t.intro}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onExport}>{t.exportLabel}</Button>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>{t.importLabel}</Button>
        <input ref={inputRef} type="file" accept=".json,application/json" aria-label={t.fileInput} hidden onChange={(e) => void onFile(e)} />
      </div>
      <p className="text-base text-muted">{t.exportNote}</p>
      <p role={notice?.kind === 'error' ? 'alert' : 'status'} className={`text-lg font-bold ${notice?.kind === 'error' ? 'text-error' : ''}`}>
        {notice?.kind === 'error' ? (
          <>
            <span aria-hidden="true">⚠ </span>
            {m().students.errorPrefix} {notice.text}
          </>
        ) : (
          notice?.text
        )}
      </p>
      {pending ? (
        <ConfirmDialog
          title={t.previewTitle}
          body={fmt(t.previewBody, { count: pending.profiles.profiles.length, date, current: currentCount })}
          confirmLabel={t.importConfirm}
          onConfirm={confirm}
          onClose={() => {
            setPending(null);
            setSavedFirst(false);
          }}
        >
          <div className="mb-4 space-y-2">
            <Button variant="secondary" onClick={onExportFirst}>{t.exportFirst}</Button>
            <p role="status" className="text-base font-bold">{savedFirst ? t.exported : ''}</p>
          </div>
          <ul aria-label={t.previewList} className="mb-4 max-h-60 space-y-1 overflow-y-auto text-lg">
            {pending.profiles.profiles.map((p) => {
              const s = statsFor(p, pending.progress[p.id] ?? emptyProgress(), today);
              return (
                <li key={p.id} className="flex items-start gap-2">
                  <span aria-hidden="true">{p.avatar}</span>
                  <span className="break-words">{fmt(t.previewRow, { name: p.name, level: s.level, xp: s.xp, puzzles: s.puzzles, lessons: s.lessons })}</span>
                </li>
              );
            })}
          </ul>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
