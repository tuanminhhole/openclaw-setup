import { useQueryClient } from "@tanstack/react-query";
import { Check, CircleHelp, ExternalLink, FileText, KeyRound, Link2, Loader2, Paperclip, Plus, Trash2, Unplug, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, type Bot, type KnowledgeItem } from "@/lib/api";
import { BrandIcon } from "@/lib/brand";
import { CHANNELS, channelById } from "@/lib/channels";
import { pick, useT } from "@/lib/i18n";
import { useFeatures, useProjectDir, useRefresh, useRoles } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useApp } from "@/stores/app";
import { confirmDialog } from "@/stores/dialogs";
import { useZaloLogin } from "@/stores/zalo";
import { RoleIcon } from "./role-icons";

type FbPage = { id: string; name?: string; igId?: string; igUsername?: string; alreadyLinked?: { botId?: string; label?: string } | null };

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground transition-colors hover:text-foreground" aria-label="?">
          <CircleHelp className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty">{children}</TooltipContent>
    </Tooltip>
  );
}

function Section({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-3">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint ? <Hint>{hint}</Hint> : null}
      </div>
      {children}
    </section>
  );
}

function Chip({ active, disabled, onClick, children, title }: { active?: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-all",
        active ? "border-foreground/50 bg-foreground text-background" : "bg-background text-foreground/80 hover:border-foreground/30 hover:bg-accent",
        disabled && !active && "cursor-not-allowed opacity-40 hover:bg-background",
      )}
    >
      {active ? <Check className="size-3.5" /> : null}
      {children}
    </button>
  );
}

export function BotSheet({ open, onOpenChange, bot }: { open: boolean; onOpenChange: (o: boolean) => void; bot: Bot | null }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const tz = useApp((s) => s.tz);
  const storeChannel = useApp((s) => s.channel);
  const projectDir = useProjectDir();
  const refresh = useRefresh();
  const qc = useQueryClient();
  const roles = useRoles();
  const features = useFeatures(bot?.id || "");
  const isEdit = !!bot;

  const [channel, setChannel] = useState(bot?.channel || storeChannel || "telegram");
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [token, setToken] = useState("");
  const [mentionNames, setMentionNames] = useState("");
  const [roleId, setRoleId] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [reaction, setReaction] = useState("/-heart");
  const [customReaction, setCustomReaction] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerDescription, setOwnerDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState("");
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [saving, setSaving] = useState(false);
  // Facebook (relay through MonkeyTech Connect)
  const [fbPage, setFbPage] = useState<FbPage | null>(null);
  const [fbPages, setFbPages] = useState<FbPage[]>([]);
  const [fbPhase, setFbPhase] = useState<"idle" | "waiting" | "error">("idle");
  const [fbMsg, setFbMsg] = useState("");
  const [fbUrl, setFbUrl] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    const ch = bot?.channel || storeChannel || "telegram";
    setChannel(channelById(ch)?.comingSoon ? "telegram" : ch);
    setName(bot?.name || "");
    setAgentId(bot?.id || "");
    setIdTouched(!!bot);
    setToken("");
    setMentionNames(bot?.mentionNames || "");
    setRoleId(bot?.roleId || (ch === "fb-messenger" ? "cskh" : "tro-ly"));
    setCustomRole(bot?.customRole || "");
    setStyles(bot?.styles || []);
    setReaction(bot ? String(bot.reaction ?? "") : "/-heart");
    setCustomReaction("");
    setOwnerName(bot?.ownerName || bot?.userName || "");
    setOwnerDescription(bot?.ownerDescription || bot?.userDescription || "");
    setFiles([]);
    setLinks("");
    setKnowledge(bot?.knowledge || []);
    setFbPage(bot?.pageId ? { id: bot.pageId, name: bot.pageName, igId: bot.instagramId } : null);
    setFbPages([]);
    setFbPhase("idle");
    setFbMsg("");
    setFbUrl("");
  }, [open, bot, storeChannel]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  useEffect(() => {
    if (!open && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [open]);

  // Default role follows the channel on create (support for Facebook, assistant elsewhere).
  useEffect(() => {
    if (!isEdit && open) setRoleId(channel === "fb-messenger" ? "cskh" : "tro-ly");
  }, [channel, isEdit, open]);

  const catalog = roles.data;
  const reactionPresets = catalog?.reactions || [];
  const reactionIsPreset = reactionPresets.some((r) => r.id === reaction);
  const isFb = channel === "fb-messenger";
  const needsToken = channel === "telegram" || channel === "zalo-bot";
  // The Zalo Bot API has no reactions, so the picker would be a dead control there.
  const showReaction = channel !== "zalo-bot";
  const fbWebhook = isEdit && bot?.transport === "webhook";
  const fbPluginMissing = isFb && features.data && !features.data.installed?.["plugin:openclaw-fb-messenger"];

  const toggleStyle = (groupId: string, itemId: string, multi?: boolean, max?: number) => {
    const group = catalog?.styleGroups.find((g) => g.id === groupId);
    const ids = new Set(group?.items.map((i) => i.id) || []);
    setStyles((cur) => {
      const has = cur.includes(itemId);
      if (multi) {
        if (has) return cur.filter((x) => x !== itemId);
        const inGroup = cur.filter((x) => ids.has(x)).length;
        if (max && inGroup >= max) return cur;
        return [...cur, itemId];
      }
      const rest = cur.filter((x) => !ids.has(x));
      return has ? rest : [...rest, itemId];
    });
  };

  // Unlink the Page on MonkeyTech Connect: Connect stops relaying its messages to this bot.
  const disconnectFbPage = async () => {
    if (!fbPage?.id) return;
    const ok = await confirmDialog({
      title: t(`Ngắt kết nối Fanpage "${fbPage.name || fbPage.id}"?`, `Disconnect "${fbPage.name || fbPage.id}"?`),
      description: t("Bot ngừng nhận và trả lời tin nhắn của Trang này. Kết nối lại được bất cứ lúc nào bằng nút Kết nối Fanpage.", "The bot stops receiving and answering this Page's messages. Reconnect at any time with Connect Fanpage."),
      okText: t("Ngắt kết nối", "Disconnect"),
      danger: true,
    });
    if (!ok) return;
    const id = toast.loading(t("Đang ngắt kết nối...", "Disconnecting..."));
    try {
      await api("/api/fb/disconnect", { body: { projectDir, pageId: fbPage.id } });
      toast.success(t("Đã ngắt kết nối Fanpage", "Fanpage disconnected"), { id, description: t("Bot ngừng nhận tin của Trang. Mở Sửa bot, bấm Kết nối lại để dùng tiếp.", "The bot no longer receives the Page's messages. Edit the bot and click Reconnect to resume.") });
      qc.invalidateQueries({ queryKey: ["fb-health"] });
      // Close instead of leaving the form open: saving it would send the Page id and link it again.
      onOpenChange(false);
    } catch (err) {
      toast.error(t("Ngắt kết nối thất bại", "Disconnect failed"), { id, description: (err as Error).message });
    }
  };

  const startFbConnect = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    // Open the tab synchronously inside the click, or popup blockers eat it; point it at the URL after.
    const win = window.open("about:blank", "_blank");
    let started: { sessionId: string; connectUrl: string };
    try {
      started = await api("/api/fb/connect/start", { body: { projectDir } });
    } catch (err) {
      win?.close();
      setFbPhase("error");
      setFbMsg((err as Error).message);
      return;
    }
    if (win) win.location.href = started.connectUrl;
    else window.open(started.connectUrl, "_blank");
    setFbUrl(started.connectUrl);
    setFbPhase("waiting");
    setFbMsg("");
    const t0 = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - t0 > 15 * 60 * 1000) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setFbPhase("error");
        setFbMsg(t("Phiên kết nối đã hết hạn, bấm Kết nối lại.", "Connect session expired, click Connect again."));
        return;
      }
      let s: { status: string; pages?: FbPage[] };
      try {
        s = await api(`/api/fb/connect/${encodeURIComponent(started.sessionId)}?projectDir=${encodeURIComponent(projectDir)}`);
      } catch {
        return;
      }
      if (s.status === "pending") return;
      clearInterval(pollRef.current!);
      pollRef.current = null;
      if (s.status !== "done") {
        setFbPhase("error");
        setFbMsg(t("Phiên kết nối đã hết hạn, bấm Kết nối lại.", "Connect session expired, click Connect again."));
        return;
      }
      const pages = s.pages || [];
      if (!pages.length) {
        setFbPhase("error");
        setFbMsg(t("Không có Trang nào được cấp. Bấm Kết nối lại và chọn ít nhất một Trang trong hộp thoại Facebook.", "No Page was granted. Click Connect again and pick at least one Page in the Facebook dialog."));
        return;
      }
      setFbPhase("idle");
      setFbPages(pages);
      setFbPage(pages[0]);
      toast.success(t("Đã kết nối Facebook", "Facebook connected"), { description: t(`Nhận ${pages.length} Trang từ MonkeyTech Connect.`, `Received ${pages.length} Page(s) from MonkeyTech Connect.`) });
      qc.invalidateQueries({ queryKey: ["fb-health"] });
    }, 2000);
  };

  const removeKnowledge = async (item: KnowledgeItem) => {
    try {
      await api("/api/bot/knowledge", { method: "DELETE", body: { projectDir, agentId: bot?.id, path: item.path } });
      setKnowledge((k) => k.filter((x) => x.path !== item.path));
      qc.invalidateQueries({ queryKey: ["status"] });
      toast.success(t("Đã xoá tài liệu", "Document removed"));
    } catch (err) {
      toast.error(t("Chưa xoá được", "Not removed"), { description: (err as Error).message });
    }
  };

  const uploadKnowledge = async (id: string) => {
    const list = files.slice(0, 10);
    for (const f of list) if (f.size > 4 * 1024 * 1024) throw new Error(t(`Tệp ${f.name} quá 4MB`, `File ${f.name} is over 4MB`));
    if (!list.length && !links.trim()) return null;
    const payload = await Promise.all(
      list.map(
        (f) =>
          new Promise<{ name: string; contentBase64: string }>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve({ name: f.name, contentBase64: String(r.result).split(",")[1] || "" });
            r.onerror = reject;
            r.readAsDataURL(f);
          }),
      ),
    );
    return api<{ added: unknown[]; warnings: string[] }>("/api/bot/knowledge", { body: { projectDir, agentId: id, files: payload, links: links.trim() } });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) return toast.error(t("Nhập tên bot", "Enter a bot name"));
    const id = isEdit ? bot!.id : agentId || slugify(name);
    if (!isEdit && !/^[a-z0-9-_]+$/.test(id)) return toast.error(t("ID bot chỉ gồm chữ thường không dấu, số, - và _", "Bot ID: lowercase letters, digits, - and _ only"));
    if (!isEdit && needsToken && !token.trim()) return toast.error(t("Nhập token của bot", "Enter the bot token"));
    if (isFb && !fbWebhook && !fbPage?.id && !isEdit) return toast.error(t("Bấm Kết nối Fanpage và chọn Trang trước khi tạo bot.", "Connect a Facebook Page before creating the bot."));

    const body: Record<string, unknown> = {
      projectDir,
      channel,
      userTimezone: tz,
      botName: name.trim(),
      token: token.trim(),
      roleId,
      customRole: roleId === "tuy-chinh" ? customRole.trim() : "",
      styles,
      reaction: customReaction.trim() || reaction,
      personality: bot?.persona || "",
      ownerName: ownerName.trim(),
      ownerDescription: ownerDescription.trim(),
    };
    if (!isEdit) body.agentId = id;
    if (channel === "telegram") body.mentionNames = mentionNames;
    if (isFb) {
      if (fbWebhook) {
        body.transport = "webhook";
        body.pageId = bot?.pageId || "";
      } else {
        body.transport = "relay";
        body.pageId = fbPage?.id || bot?.pageId || "";
        body.pageName = fbPage?.name || bot?.pageName || "";
        body.instagramId = fbPage?.igId || bot?.instagramId || "";
        const owner = fbPage?.alreadyLinked;
        if (owner && fbPages.length) {
          const ok = await confirmDialog({
            title: t("Chuyển Trang sang bot này?", "Move the Page to this bot?"),
            description: t(`Trang đang gắn với bot "${owner.label || owner.botId}". Chuyển sang thì bot kia ngừng nhận tin của Trang.`, `The Page is linked to bot "${owner.label || owner.botId}". Moving it stops that bot from receiving the Page's messages.`),
            okText: t("Chuyển sang bot này", "Move it here"),
            cancelText: t("Để sau", "Not now"),
          });
          if (!ok) return;
          body.forceLink = true;
        }
      }
    }

    setSaving(true);
    const zalo = useZaloLogin.getState();
    const zaloCreate = channel === "zalo-personal" && !isEdit;
    if (zaloCreate) {
      onOpenChange(false);
      zalo.start(t("Đang tạo bot và khởi động QR Zalo...", "Creating the bot and starting the Zalo QR..."));
    }
    try {
      const result = await api<{ agentId: string; warning?: string; loginStarted?: boolean; loginHint?: string; restartNeeded?: boolean }>(isEdit ? `/api/bot/${encodeURIComponent(bot!.id)}` : "/api/bot/create", { method: isEdit ? "PUT" : "POST", body });
      let note = "";
      try {
        const k = await uploadKnowledge(result.agentId);
        if (k?.added?.length) note = t(` · đã nạp ${k.added.length} tài liệu`, ` · ${k.added.length} document(s) added`);
        if (k?.warnings?.length) toast.warning(t("Có liên kết không tải được", "Some links could not be fetched"), { description: k.warnings.join("\n") });
      } catch (err) {
        toast.error(t("Tài liệu chưa nạp được", "Documents not added"), { description: (err as Error).message });
      }
      toast.success(isEdit ? t("Đã lưu bot", "Bot saved") : t("Đã tạo bot", "Bot created"), { description: `${result.agentId}${result.warning ? ` · ${result.warning}` : ""}${note}` });
      useApp.getState().setChannel(channel);
      useApp.getState().setActiveBot(result.agentId);
      if (result.loginStarted) zalo.start(result.loginHint || t("Đang khởi động đăng nhập Zalo...", "Starting Zalo login..."));
      if (!zaloCreate) onOpenChange(false);
      await refresh();
    } catch (err) {
      toast.error(t("Lỗi thao tác", "Action error"), { description: (err as Error).message });
      if (zaloCreate) {
        zalo.close();
        onOpenChange(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const ch = channelById(channel);
  const roleList = catalog?.roles || [];

  return (
    <Sheet open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="flex items-center gap-2 text-lg">
            {ch ? <BrandIcon name={ch.icon} className="size-5" /> : null}
            {isEdit ? t("Sửa bot", "Edit bot") : t("Tạo bot mới", "New bot")}
          </SheetTitle>
          <SheetDescription>{t("Chọn kênh, vai và tính cách. Setup tự viết cấu hình và workspace cho bot.", "Pick a channel, role and temperament. Setup writes the config and workspace for you.")}</SheetDescription>
        </SheetHeader>

        <form id="bot-form" onSubmit={submit} className="grid grid-cols-1 flex-1 content-start gap-7 overflow-y-auto px-6 py-6">
          {!isEdit && (
            <Section title={t("Kênh", "Channel")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CHANNELS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={c.comingSoon}
                    onClick={() => setChannel(c.id)}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                      channel === c.id ? "border-foreground/50 bg-accent ring-1 ring-foreground/20" : "hover:bg-accent/60",
                      c.comingSoon && "cursor-not-allowed opacity-50 hover:bg-transparent",
                    )}
                  >
                    <BrandIcon name={c.icon} className="size-5" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{c.comingSoon ? t("Sắp ra mắt", "Coming soon") : c.subtitle}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title={t("Thông tin bot", "Bot details")}>
            <div className={cn("grid grid-cols-1 gap-4", isEdit ? "sm:grid-cols-[minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]")}>
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="bot-name">{t("Tên bot", "Bot name")}</Label>
                <Input id="bot-name" required placeholder="Williams" value={name} onChange={(e) => { setName(e.target.value); if (!idTouched) setAgentId(slugify(e.target.value)); }} />
              </div>
              {!isEdit && (
                <div className="grid grid-cols-1 gap-2">
                  <Label htmlFor="bot-id" className="flex items-center gap-1.5">
                    {t("ID bot", "Bot ID")}
                    <Hint>{t("Chữ thường không dấu, số, gạch ngang và gạch dưới. Dùng làm tên thư mục workspace, không đổi được sau khi tạo.", "Lowercase letters, digits, hyphens and underscores. Used as the workspace folder name; cannot change later.")}</Hint>
                  </Label>
                  <Input id="bot-id" required pattern="^[a-z0-9-_]+$" placeholder="william" value={agentId} onChange={(e) => { setAgentId(e.target.value); setIdTouched(true); }} className="font-mono" />
                </div>
              )}
              {showReaction && (
                <div className="grid grid-cols-1 content-start gap-2">
                  <Label className="flex items-center gap-1.5">
                    {t("Reaction xác nhận", "Ack reaction")}
                    <Hint>{t("Bot thả cảm xúc này lên tin của khách ngay khi nhận, để khách biết tin đã tới trong lúc bot soạn. Telegram chỉ nhận bộ emoji của Telegram; Zalo Bot API chưa có reaction.", "The bot reacts with this as soon as a message arrives. Telegram only accepts its own emoji set; the Zalo Bot API has no reactions.")}</Hint>
                  </Label>
                  <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
                  {reactionPresets.map((r) => (
                    <button
                      key={r.id || "off"}
                      type="button"
                      title={pick({ vi: r.vi || "", en: r.en || "" }, lang)}
                      onClick={() => { setReaction(r.id); setCustomReaction(""); }}
                      className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg border text-lg transition-all", !customReaction && reaction === r.id ? "border-foreground/50 bg-accent ring-1 ring-foreground/20" : "hover:bg-accent/60")}
                    >
                      {r.label}
                    </button>
                  ))}
                  <Input value={customReaction || (!reactionIsPreset && reaction ? reaction : "")} onChange={(e) => setCustomReaction(e.target.value)} maxLength={8} placeholder={t("khác", "other")} className="h-9 w-16 text-center text-base" />
                </div>
                </div>
              )}
            </div>
            {needsToken && (
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="bot-token">Token</Label>
                <Input id="bot-token" autoComplete="off" required={!isEdit} placeholder={channel === "telegram" ? "123456:ABC..." : "Zalo Bot token"} value={token} onChange={(e) => setToken(e.target.value)} className="font-mono" />
                {isEdit && <p className="text-xs text-muted-foreground">{t("Bỏ trống để giữ token cũ.", "Leave empty to keep the current token.")}</p>}
              </div>
            )}
            {channel === "telegram" && (
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="bot-mention" className="flex items-center gap-1.5">
                  {t("Tên gọi trong nhóm", "Names in groups")}
                  <Hint>{t("Cách nhau bằng dấu phẩy, tối đa 10 tên. Trong nhóm bot chỉ trả lời khi được tag @username hoặc khi tin có một trong các tên này. Nhớ vào BotFather gõ /setprivacy chọn Disable, rồi xoá và thêm lại bot vào nhóm.", "Comma-separated, up to 10. In groups the bot only replies when tagged or when a message contains one of these names. Turn off privacy mode in BotFather (/setprivacy, Disable), then re-add the bot to the group.")}</Hint>
                </Label>
                <Input id="bot-mention" autoComplete="off" placeholder={t("Kỳ Môn ơi, km ơi", "Kymon, hey km")} value={mentionNames} onChange={(e) => setMentionNames(e.target.value)} />
              </div>
            )}
          </Section>

          {isFb && (
            <Section title="Fanpage" hint={t('Chủ Trang bấm "Tiếp tục với Facebook" trên MonkeyTech Connect một lần. Bot không giữ token, không cần HTTPS riêng, nhận cả Instagram Direct nếu Trang đã gắn Instagram chuyên nghiệp.', 'The Page owner clicks "Continue with Facebook" on MonkeyTech Connect once. The bot holds no token, needs no public HTTPS, and also receives Instagram Direct if the Page has a professional Instagram account.')}>
              {fbWebhook ? (
                <Alert>
                  <AlertDescription>{t(`Bot này dùng app Meta riêng (webhook), Trang ${bot?.pageId}. Sửa token trong openclaw.json nếu cần.`, `This bot uses its own Meta app (webhook), Page ${bot?.pageId}. Edit the token in openclaw.json if needed.`)}</AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {fbPage?.id ? (
                        <>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span className="size-2 rounded-full bg-success" />
                            {fbPage.name || fbPage.id}
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {fbPage.id}
                            {fbPage.igUsername ? ` · Instagram @${fbPage.igUsername}` : ""}
                          </div>
                        </>
                      ) : fbPhase === "waiting" ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          {t("Đang chờ chủ Trang đăng nhập Facebook ở tab mới...", "Waiting for the Page owner on the new tab...")}
                        </div>
                      ) : (
                        <div className="text-sm text-warning">{t("Chưa chọn Trang", "No Page selected")}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {isEdit && fbPage?.id && (
                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={disconnectFbPage}>
                          <Unplug />
                          {t("Ngắt kết nối", "Disconnect")}
                        </Button>
                      )}
                      <Button type="button" variant={fbPage?.id ? "outline" : "default"} size="sm" onClick={startFbConnect}>
                        <KeyRound />
                        {fbPage?.id ? t("Kết nối lại", "Reconnect") : t("Kết nối Fanpage", "Connect Fanpage")}
                      </Button>
                    </div>
                  </div>
                  {fbPhase === "waiting" && fbUrl ? (
                    <a href={fbUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline">
                      <ExternalLink className="size-3" />
                      {t("Mở lại link kết nối", "Open the connect link again")}
                    </a>
                  ) : null}
                  {fbPhase === "error" && fbMsg ? <p className="text-xs text-destructive">{fbMsg}</p> : null}
                  {fbPages.length > 1 && (
                    <div className="grid grid-cols-1 gap-1.5">
                      <Label className="text-xs text-muted-foreground">{t("Chọn Trang cho bot này", "Pick the Page for this bot")}</Label>
                      <div className="grid grid-cols-1 gap-1.5">
                        {fbPages.map((p) => (
                          <button key={p.id} type="button" onClick={() => setFbPage(p)} className={cn("flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors", fbPage?.id === p.id ? "border-foreground/40 bg-accent" : "hover:bg-accent/60")}>
                            <span className="truncate">
                              {p.name || p.id}
                              {p.igUsername ? <span className="text-muted-foreground"> · @{p.igUsername}</span> : null}
                            </span>
                            {p.alreadyLinked ? <Badge variant="outline" className="text-[11px]">{t("đang thuộc", "owned by")} {p.alreadyLinked.label || p.alreadyLinked.botId}</Badge> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {fbPluginMissing && <p className="text-xs text-muted-foreground">{t("Plugin fb-messenger sẽ được cài tự động khi tạo bot.", "The fb-messenger plugin is installed automatically when the bot is created.")}</p>}
                </div>
              )}
            </Section>
          )}

          <Separator />

          <Section title={t("Vai trò", "Role")} hint={t('Mỗi vai có sẵn hướng dẫn ngầm (mục tiêu, cách làm việc, giới hạn), ghi vào SOUL.md trong workspace. Chọn "Tự mô tả" để tự viết.', 'Each role carries a built-in brief (goal, way of working, limits), written into SOUL.md. Pick "Custom" to write your own.')}>
            {roleList.length ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {roleList.map((r) => (
                  <button key={r.id} type="button" onClick={() => setRoleId(r.id)} className={cn("flex items-start gap-3 rounded-lg border p-3 text-left transition-all", roleId === r.id ? "border-foreground/50 bg-accent ring-1 ring-foreground/20" : "hover:bg-accent/60")}>
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md border bg-background", roleId === r.id && "border-foreground/30")}>
                      <RoleIcon id={r.id} fallback={r.icon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{pick(r.title, lang)}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{pick(r.desc, lang)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[68px] animate-pulse rounded-lg border bg-muted/40" />)}</div>
            )}
            {roleId === "tuy-chinh" && <Input placeholder={t("Ví dụ: Tư vấn khoá học tiếng Anh cho phụ huynh", "e.g. Advise parents on English courses")} value={customRole} onChange={(e) => setCustomRole(e.target.value)} />}
          </Section>

          <Section title={t("Tính cách và phong cách", "Temperament and style")} hint={t("Tính cách chọn tối đa 3, các nhóm khác chọn một; bỏ trống thì bot tự nhiên. Mỗi lựa chọn thành một đoạn mô tả hành vi trong SOUL.md. Rê chuột lên nhãn để xem.", "Pick up to 3 traits and one item in each other group; leave empty for the default voice. Each pick becomes a behaviour paragraph in SOUL.md. Hover a label to read it.")}>
            <div className="grid grid-cols-1 gap-4">
              {(catalog?.styleGroups || []).map((g) => {
                const inGroup = styles.filter((s) => g.items.some((i) => i.id === s)).length;
                return (
                  <div key={g.id} className="grid grid-cols-1 gap-2">
                    <div className="flex items-baseline gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {pick(g.title, lang)}
                      {g.multi ? <span className="normal-case tracking-normal">{t(`${inGroup}/${g.max || 3}`, `${inGroup}/${g.max || 3}`)}</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.items.map((i) => {
                        const active = styles.includes(i.id);
                        const capped = !!g.multi && !!g.max && inGroup >= g.max && !active;
                        return (
                          <Chip key={i.id} active={active} disabled={capped} title={pick(i.line, lang)} onClick={() => toggleStyle(g.id, i.id, g.multi, g.max)}>
                            {pick(i.label, lang)}
                          </Chip>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Separator />

          <Section title={t("Chủ bot", "Bot owner")} hint={t('Người bot phục vụ và báo cáo, ghi vào USER.md. Bot gọi người này là "chủ".', 'The person the bot works for, recorded in USER.md.')}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="owner-name">{t("Tên chủ bot", "Owner name")}</Label>
                <Input id="owner-name" placeholder={t("Anh Tuấn, chị Hoa...", "Your name")} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="owner-desc">{t("Về chủ bot", "About the owner")}</Label>
                <Input id="owner-desc" placeholder={t("Chủ tiệm tạp hoá ở Cần Thơ, thích nói ngắn gọn", "Grocery owner, prefers short answers")} value={ownerDescription} onChange={(e) => setOwnerDescription(e.target.value)} />
              </div>
            </div>
          </Section>

          <Section title={t("Tài liệu cho bot học", "Documents to learn from")} hint={t("Tệp chữ và trang web được chép vào USER.md (bot đọc ở mọi phiên). md, txt, csv, json đọc ngay; pdf, docx, xlsx, pptx, zip bot tự học ở lần chạy đầu. Tối đa 10 tệp, 4MB mỗi tệp. Link được tải về ngay lúc lưu.", "Text files and web pages are copied into USER.md (read in every session). md, txt, csv, json are read at once; pdf, docx, xlsx, pptx, zip are learned on first run. Up to 10 files, 4MB each. Links are fetched on save.")}>
            <input ref={fileInput} type="file" multiple hidden accept=".md,.txt,.csv,.json,.pdf,.docx,.xlsx,.pptx,.zip" onChange={(e) => { setFiles((cur) => [...cur, ...Array.from(e.target.files || [])].slice(0, 10)); e.currentTarget.value = ""; }} />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setFiles((cur) => [...cur, ...Array.from(e.dataTransfer.files || [])].slice(0, 10)); }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors hover:bg-accent/40"
            >
              <Upload className="size-5 text-muted-foreground" />
              <span className="text-sm font-medium">{t("Kéo thả tệp vào đây hoặc bấm để chọn", "Drop files here or click to choose")}</span>
              <span className="text-xs text-muted-foreground">md, txt, csv, json, pdf, docx, xlsx, pptx, zip</span>
            </button>
            {files.length > 0 && (
              <ul className="grid grid-cols-1 gap-1.5">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm animate-in fade-in-0 slide-in-from-top-1">
                    <Paperclip className="size-3.5 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{Math.ceil(f.size / 1024)} KB</span>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} aria-label="Remove">
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="links" className="flex items-center gap-1.5">
                <Link2 className="size-3.5" />
                {t("Thêm liên kết", "Add links")}
              </Label>
              <Textarea id="links" rows={2} placeholder={"monkeytech.vn\nhttps://docs.google.com/..."} value={links} onChange={(e) => setLinks(e.target.value)} />
            </div>
            {isEdit && (
              <div className="grid grid-cols-1 gap-2">
                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("Bot đã học", "Already learned")}</div>
                {knowledge.length ? (
                  <ul className="grid grid-cols-1 gap-1.5">
                    {knowledge.map((k) => (
                      <KnowledgeRow key={k.path} item={k} onRemove={() => removeKnowledge(k)} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("Chưa có tài liệu nào.", "Nothing yet.")}</p>
                )}
              </div>
            )}
          </Section>
        </form>

        <SheetFooter className="flex-row justify-end gap-2 border-t bg-background px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("Huỷ", "Cancel")}
          </Button>
          <Button type="submit" form="bot-form" disabled={saving} className="min-w-32">
            {saving ? <Loader2 className="animate-spin" /> : isEdit ? <Check /> : <Plus />}
            {saving ? t("Đang lưu...", "Saving...") : isEdit ? t("Lưu thay đổi", "Save changes") : t("Tạo bot", "Create bot")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Learned document with a two-step inline remove (no browser confirm, no re-render of the form). */
function KnowledgeRow({ item, onRemove }: { item: KnowledgeItem; onRemove: () => Promise<void> | void }) {
  const t = useT();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);
  const main = useMemo(() => {
    if (item.kind !== "link" || !item.url) return item.name;
    try {
      const u = new URL(item.url);
      return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
    } catch {
      return item.url;
    }
  }, [item]);
  const sub = item.kind === "link" ? item.name : item.kind === "binary" ? t("chờ bot tự học", "waiting to be learned") : "";
  const Icon = item.kind === "link" ? Link2 : item.kind === "binary" ? Paperclip : FileText;
  return (
    <li className={cn("flex items-center gap-3 rounded-md border px-3 py-2 transition-all", armed && "border-destructive/50 bg-destructive/5", busy && "opacity-50")}>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="grid grid-cols-1 min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{main}</span>
        {sub ? <span className="truncate text-xs text-muted-foreground">{sub}</span> : null}
      </span>
      <Button
        type="button"
        size="sm"
        variant={armed ? "destructive" : "ghost"}
        disabled={busy}
        onClick={async () => {
          if (!armed) return setArmed(true);
          setBusy(true);
          await onRemove();
          setBusy(false);
        }}
      >
        {armed ? t("Xoá thật?", "Really remove?") : t("Xoá", "Remove")}
      </Button>
    </li>
  );
}
