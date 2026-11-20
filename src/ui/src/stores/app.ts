import { create } from "zustand";

type Theme = "light" | "dark";
type Lang = "vi" | "en";
export type Route = "dashboard" | "bot" | "setup" | "logs" | "settings";

const ls = {
  get: (k: string, d: string) => {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

function routeFromHash(): Route {
  const r = location.hash.replace(/^#\/?/, "").split("?")[0];
  return (["dashboard", "bot", "setup", "logs", "settings"].includes(r) ? r : "dashboard") as Route;
}

type AppState = {
  theme: Theme;
  lang: Lang;
  tz: string;
  route: Route;
  /** Project the UI is looking at ('' = whatever the server is connected to). */
  projectDir: string;
  channel: string;
  activeBotId: string;
  logs: string[];
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  setTz: (tz: string) => void;
  go: (r: Route) => void;
  setProjectDir: (p: string) => void;
  setChannel: (c: string) => void;
  setActiveBot: (id: string) => void;
  pushLog: (line: string) => void;
  syncRoute: () => void;
  /** Bumped to ask the Bots page to open the create sheet (from the what's-new dialog, the dashboard...). */
  createBotNonce: number;
  requestCreateBot: (channel?: string) => void;
};

export const useApp = create<AppState>((set, get) => ({
  theme: (ls.get("openclaw-theme", "dark") as Theme) || "dark",
  lang: (ls.get("openclaw-lang", "vi") as Lang) || "vi",
  tz: ls.get("openclaw-tz", "Asia/Ho_Chi_Minh"),
  route: routeFromHash(),
  projectDir: "",
  channel: ls.get("openclaw-channel", "telegram"),
  activeBotId: "",
  logs: [],
  setTheme: (theme) => {
    ls.set("openclaw-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    set({ theme });
  },
  setLang: (lang) => {
    ls.set("openclaw-lang", lang);
    document.documentElement.lang = lang;
    set({ lang });
  },
  setTz: (tz) => {
    ls.set("openclaw-tz", tz);
    set({ tz });
  },
  go: (route) => {
    if (get().route !== route) history.pushState(null, "", `#/${route}`);
    set({ route });
    window.scrollTo({ top: 0 });
  },
  setProjectDir: (projectDir) => set({ projectDir, activeBotId: "" }),
  setChannel: (channel) => {
    ls.set("openclaw-channel", channel);
    set({ channel, activeBotId: "" });
  },
  setActiveBot: (activeBotId) => set({ activeBotId }),
  pushLog: (line) => set((s) => ({ logs: s.logs.length >= 3000 ? [...s.logs.slice(-2500), line] : [...s.logs, line] })),
  syncRoute: () => set({ route: routeFromHash() }),
  createBotNonce: 0,
  requestCreateBot: (channel) => {
    if (channel) get().setChannel(channel);
    get().go("bot");
    set((s) => ({ createBotNonce: s.createBotNonce + 1 }));
  },
}));
