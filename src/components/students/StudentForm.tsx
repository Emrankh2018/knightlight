import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { fmt, m } from '../../i18n';
import { MAX_STUDENT_NAME, nameProblem, sanitizeName } from '../../lib/students';
import { AVATARS } from '../../store/profiles';
import Button from '../Button';
import Modal from '../Modal';

interface Props {
  mode: 'add' | 'edit';
  /** Existing students, used for the duplicate check. */
  others: readonly { id: string; name: string }[];
  selfId?: string;
  initialName: string;
  initialAvatar: string;
  onSave: (name: string, avatar: string) => void;
  onClose: () => void;
}

export default function StudentForm({ mode, others, selfId, initialName, initialAvatar, onSave, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [submitted, setSubmitted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const t = m().students;
  const problem = nameProblem(name, others, selfId);
  const shown = problem !== null && (submitted || problem !== 'empty') ? problem : null;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    setSubmitted(true);
    if (problem !== null) {
      nameRef.current?.focus();
      return;
    }
    onSave(sanitizeName(name), avatar);
  };

  const onAvatarKey = (e: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const last = AVATARS.length - 1;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    const pick = AVATARS[next];
    if (pick) setAvatar(pick);
    radios.current[next]?.focus();
  };

  return (
    <Modal title={mode === 'add' ? t.addTitle : t.editTitle} initialFocus={nameRef} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label htmlFor="student-name" className="block text-lg font-bold">{t.nameLabel}</label>
          <input
            id="student-name"
            ref={nameRef}
            type="text"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={shown !== null}
            aria-describedby="student-name-help student-name-error"
            className="min-h-12 w-full rounded-xl border-2 border-ink bg-bg px-3 text-lg text-fg dark:border-amber"
          />
          <p id="student-name-help" className="text-base text-muted">{fmt(t.nameHelp, { max: MAX_STUDENT_NAME })}</p>
          <p id="student-name-error" role="alert" className="text-base font-bold text-error">
            {shown !== null ? (
              <>
                <span aria-hidden="true">⚠ </span>
                {fmt(t.nameProblems[shown], { max: MAX_STUDENT_NAME })}
              </>
            ) : null}
          </p>
        </div>
        <div className="space-y-2">
          <p id="student-avatar-legend" className="text-lg font-bold">{t.avatarLegend}</p>
          <div role="radiogroup" aria-labelledby="student-avatar-legend" className="flex flex-wrap gap-2">
            {AVATARS.map((a, i) => (
              <button
                key={a}
                ref={(el) => {
                  radios.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={a === avatar}
                tabIndex={a === avatar ? 0 : -1}
                aria-label={fmt(t.avatarPick, { avatar: a })}
                onClick={() => setAvatar(a)}
                onKeyDown={(e) => onAvatarKey(e, i)}
                className={`flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 text-2xl ${a === avatar ? 'border-ink bg-amber dark:border-amber' : 'border-line hover:border-ink dark:hover:border-amber'}`}
              >
                <span aria-hidden="true">{a}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit">{m().common.save}</Button>
        </div>
      </form>
    </Modal>
  );
}
