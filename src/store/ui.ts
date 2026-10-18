import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
}

interface UiState {
  toasts: Toast[];
  pushToast: (message: string) => void;
  dismissToast: (id: number) => void;
}

let nextId = 1;

export const useUi = create<UiState>()((set) => ({
  toasts: [],
  pushToast: (message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
