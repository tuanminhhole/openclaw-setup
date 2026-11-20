import type { Bot, FbHealth, ZaloHealth } from "@/lib/api";

export type Tone = "ok" | "warn" | "bad";
type T = (vi: string, en: string) => string;

function zaloAccount(health: ZaloHealth | undefined, bot: Bot) {
  const accounts = health?.accounts || [];
  return accounts.find((a) => a.agentId === bot.id) || accounts.find((a) => a.accountId === (bot.accountId || "default")) || null;
}

// lastError wins over running: the gateway keeps running=true while the Zalo listener is stuck in a
// retry loop ("Đăng nhập thất bại"), so a running-first check painted dead bots green.
export function zaloBadges(bot: Bot, health: ZaloHealth | undefined, t: T) {
  const h = zaloAccount(health, bot);
  const loginFailed = !!h?.lastError && /đăng nhập|log ?in|auth|credential|session/i.test(String(h.lastError));
  const connection = !h ? t("Chưa rõ", "Unknown") : h.lastError ? t("Mất kết nối", "Disconnected") : h.running ? t("Đã kết nối", "Connected") : t("Đang kết nối", "Connecting");
  const login = !h ? t("Chưa rõ", "Unknown") : loginFailed ? t("Phiên hết hạn", "Session expired") : h.sessionSaved ? t("Đã đăng nhập", "Logged in") : t("Chưa đăng nhập", "Not logged in");
  const connectionTone: Tone = !h ? "warn" : h.lastError ? "bad" : h.running ? "ok" : "warn";
  const loginTone: Tone = !h ? "warn" : loginFailed ? "bad" : h.sessionSaved ? "ok" : "bad";
  return { health: h, connection, login, connectionTone, loginTone, error: h?.lastError || "" };
}

// Facebook relay: Page label (name from Connect) + connection (Connect still holds a token for it).
export function fbBadges(bot: Bot, h: FbHealth | undefined, t: T) {
  const pageId = bot.pageId || "";
  const label = bot.pageName || (pageId ? `#${pageId}` : t("Chưa chọn Trang", "No Page"));
  if (bot.transport === "webhook") return { connection: t("Webhook riêng", "Own webhook"), login: label, connectionTone: "warn" as Tone, loginTone: (pageId ? "ok" : "bad") as Tone };
  if (!pageId) return { connection: t("Chưa nối", "Not connected"), login: label, connectionTone: "bad" as Tone, loginTone: "bad" as Tone };
  if (!h) return { connection: t("Chưa rõ", "Unknown"), login: label, connectionTone: "warn" as Tone, loginTone: "ok" as Tone };
  if (!h.relay?.configured) return { connection: t("Chưa nối Connect", "Connect not set up"), login: label, connectionTone: "bad" as Tone, loginTone: "ok" as Tone };
  if (h.error) return { connection: t("Connect không trả lời", "Connect unreachable"), login: label, connectionTone: "warn" as Tone, loginTone: "ok" as Tone };
  const page = (h.pages || []).find((p) => String(p.id) === String(pageId));
  if (!page) return { connection: t("Chưa gắn với bot", "Not linked to bot"), login: label, connectionTone: "bad" as Tone, loginTone: "ok" as Tone };
  if (!page.connected) return { connection: t("Mất kết nối", "Disconnected"), login: page.name || label, connectionTone: "bad" as Tone, loginTone: "ok" as Tone };
  return { connection: t("Đã kết nối", "Connected"), login: page.name || label, connectionTone: "ok" as Tone, loginTone: "ok" as Tone, igUsername: page.igUsername };
}

export const toneClass: Record<Tone, string> = {
  ok: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
};

// Goi Fanpage tren Connect: nhan ngan cho bang bot + chi tiet cho tab Fanpage.
export function fbPlan(bot: Bot, h: FbHealth | undefined, t: T) {
  const page = (h?.pages || []).find((p) => String(p.id) === String(bot.pageId || ""));
  const plan = page?.plan || null;
  if (!plan) return null;
  const daysLeft = (sql?: string | null) => (sql ? Math.max(0, Math.ceil((new Date(sql.replace(" ", "T") + "Z").getTime() - Date.now()) / 864e5)) : 0);
  const name = { trial: t("Dùng thử Pro", "Pro trial"), free: t("Miễn phí", "Free"), pro: "Pro", team: "Team" }[plan.plan];
  const short = plan.plan === "trial" ? t(`Dùng thử · còn ${daysLeft(plan.expiresAt)} ngày`, `Trial · ${daysLeft(plan.expiresAt)} days left`)
    : plan.plan === "free" ? `${name} · ${plan.used}/${plan.quota}`
      : name;
  const full = plan.quota !== null && plan.used >= plan.quota;
  const near = plan.quota !== null && plan.used >= Math.ceil(plan.quota * 0.8);
  const tone: Tone = plan.plan === "free" ? (full ? "bad" : near ? "warn" : "warn") : "ok";
  return { page, plan, name, short, tone, full, near, daysLeft: daysLeft(plan.expiresAt), billingUrl: page?.billingUrl || "", inboxUrl: page?.inboxUrl || "" };
}
