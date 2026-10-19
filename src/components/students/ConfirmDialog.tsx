import { useRef, type ReactNode } from 'react';
import { m } from '../../i18n';
import Button from '../Button';
import Modal from '../Modal';

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

/** Destructive confirmation. Focus starts on Cancel so a stray Enter never confirms. */
export default function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose, children }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal title={title} description={body} initialFocus={cancelRef} onClose={onClose}>
      {children}
      <div className="flex flex-wrap justify-end gap-3">
        <Button ref={cancelRef} variant="secondary" onClick={onClose}>{m().students.cancel}</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
