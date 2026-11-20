import { create } from "zustand";

// Zalo QR login dialog. The QR arrives on the log stream as `[zalo-connect:qr] data:image/...`.
type ZaloLoginState = {
  open: boolean;
  qr: string;
  lines: string[];
  start: (hint: string) => void;
  setQr: (qr: string) => void;
  push: (line: string) => void;
  close: () => void;
};

export const useZaloLogin = create<ZaloLoginState>((set) => ({
  open: false,
  qr: "",
  lines: [],
  start: (hint) => set({ open: true, qr: "", lines: [hint] }),
  setQr: (qr) => set((s) => ({ qr, open: true, lines: [...s.lines, "QR"] })),
  push: (line) => set((s) => ({ lines: [...s.lines.slice(-150), line] })),
  close: () => set({ open: false }),
}));
