import { m } from '../../i18n';
import type { TeacherNotes } from '../../lib/content/types';

function NoteList({ title, items, big }: { title: string; items: readonly string[]; big: boolean }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-1">
      <h3 className="font-extrabold">{title}</h3>
      <ul className={`list-disc space-y-1 ps-6 ${big ? 'text-xl' : 'text-base'}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** Coach-only notes of a lesson: talking points, common mistakes and questions to ask the class. */
export default function TeacherPanel({ notes, classMode = false }: { notes: TeacherNotes; classMode?: boolean }) {
  const empty = notes.points.length + notes.mistakes.length + notes.questions.length === 0;
  return (
    <section aria-label={m().lesson.teacherNotes} className="space-y-3 rounded-xl border-2 border-dashed border-ink/60 bg-bg p-4 dark:border-amber/60">
      <h2 className="text-lg font-extrabold">{m().lesson.teacherNotes}</h2>
      {empty ? <p className="text-muted">{m().lesson.notesEmpty}</p> : null}
      <NoteList title={m().lesson.notesQuestions} items={notes.questions} big={classMode} />
      <NoteList title={m().lesson.notesPoints} items={notes.points} big={classMode} />
      <NoteList title={m().lesson.notesMistakes} items={notes.mistakes} big={classMode} />
    </section>
  );
}
