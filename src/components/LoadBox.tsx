import { useState } from 'react';
import { m } from '../i18n';
import { parseLoadInput } from '../lib/explorer';
import Button from './Button';

/** Paste a FEN position or a PGN game. */
export default function LoadBox({ onLoad, showShareNote = true }: { onLoad: (startFen: string, sans: string[]) => void; showShareNote?: boolean }) {
  const t = m().openings;
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = (): void => {
    const res = parseLoadInput(text);
    if (res.ok) {
      onLoad(res.startFen, res.sans);
      setText('');
      setMessage({ ok: true, text: t.loaded });
    } else {
      setMessage({ ok: false, text: t.loadErrors[res.reason] });
    }
  };
  return (
    <details className="rounded-xl border-2 border-line px-3 py-2">
      <summary className="min-h-12 cursor-pointer py-3 text-lg font-bold">{t.loadTitle}</summary>
      <div className="space-y-2 pt-2">
        {showShareNote ? <p className="text-base text-muted">{t.loadNotShared}</p> : null}
        <label htmlFor="op-load" className="block text-base font-bold">{t.loadLabel}</label>
        <textarea
          id="op-load"
          value={text}
          rows={3}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setMessage(null);
          }}
          className="w-full rounded-lg border-2 border-line bg-bg p-2 font-mono text-base"
        />
        <Button variant="secondary" onClick={submit}>{t.loadButton}</Button>
        {message ? (
          <p role={message.ok ? 'status' : 'alert'} className={`text-base font-bold ${message.ok ? 'text-ok-text' : 'text-error'}`}>{message.text}</p>
        ) : null}
      </div>
    </details>
  );
}
