import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';

interface ModalProps {
  title: string;
  /** Short text read out with the title. */
  description?: string;
  /** Element that gets focus on open. Defaults to the first focusable element. */
  initialFocus?: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Modal dialog on the native `<dialog>`: the browser traps focus, makes the page inert and closes on Escape.
 * Focus goes back to the opener on close, or to the page content when the opener no longer exists.
 */
export default function Modal({ title, description, initialFocus, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const target = initialFocus?.current ?? dialog.querySelector<HTMLElement>('input, select, textarea, button');
    target?.focus();
    return () => {
      if (dialog.open) dialog.close();
      const back = opener?.isConnected ? opener : document.getElementById('main');
      back?.focus();
    };
  }, [initialFocus]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border-2 border-ink bg-surface p-6 text-fg shadow-2xl backdrop:bg-black/60 dark:border-amber"
    >
      <h2 id={titleId} className="text-2xl font-extrabold">{title}</h2>
      {description ? <p id={descId} className="mt-2 text-lg">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </dialog>
  );
}
