import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
}

interface UiState {
  toasts: Toast[];
  /** While true (Class Mode) toasts stay queued so they never cover the board. */
  suppressToasts: boolean;
  setSuppressToasts: (v: boolean) => void;
  /** Teacher view shows notes and class questions. Off by default and never saved. */
  teacherView: boolean;
  setTeacherView: (v: boolean) => void;
  pushToast: (message: string) => void;
  dismissToast: (id: number) => void;
}

let nextId = 1;

export const useUi = create<UiState>()((set) => ({
  toasts: [],
  suppressToasts: false,
  setSuppressToasts: (v) => set({ suppressToasts: v }),
  teacherView: false,
  setTeacherView: (v) => set({ teacherView: v }),
  pushToast: (message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
