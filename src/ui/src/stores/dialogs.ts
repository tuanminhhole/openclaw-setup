import type { ReactNode } from "react";
import { create } from "zustand";

// Promise-based confirm / prompt / notice dialogs, rendered once by <GlobalDialogs/>.
// Replaces the browser confirm dialog and the hand-built modal stack of the legacy UI.

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  body?: ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  hideCancel?: boolean;
  icon?: ReactNode;
};
export type PromptField = { label?: string; placeholder?: string; value?: string };
export type PromptOptions = { title: string; description?: ReactNode; fields: PromptField[]; okText?: string };

type DialogState = {
  confirm: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  prompt: (PromptOptions & { resolve: (values: string[] | null) => void }) | null;
  openConfirm: (o: ConfirmOptions) => Promise<boolean>;
  openPrompt: (o: PromptOptions) => Promise<string[] | null>;
  closeConfirm: (ok: boolean) => void;
  closePrompt: (values: string[] | null) => void;
};

export const useDialogs = create<DialogState>((set, get) => ({
  confirm: null,
  prompt: null,
  openConfirm: (o) => new Promise<boolean>((resolve) => set({ confirm: { ...o, resolve } })),
  openPrompt: (o) => new Promise<string[] | null>((resolve) => set({ prompt: { ...o, resolve } })),
  closeConfirm: (ok) => {
    get().confirm?.resolve(ok);
    set({ confirm: null });
  },
  closePrompt: (values) => {
    get().prompt?.resolve(values);
    set({ prompt: null });
  },
}));

export const confirmDialog = (o: ConfirmOptions) => useDialogs.getState().openConfirm(o);
export const promptDialog = (o: PromptOptions) => useDialogs.getState().openPrompt(o);
