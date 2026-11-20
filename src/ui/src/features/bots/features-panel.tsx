import { useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, Globe, Loader2, Puzzle, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, type Bot } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useFeatures, useProjectDir, useStatus } from "@/lib/queries";
import { cn, portOf, sameHostUrl } from "@/lib/utils";
import { confirmDialog } from "@/stores/dialogs";

type Item = { id: string; title: string; desc: [string, string]; channels?: string[]; openWeb?: string; chrome?: boolean };

const SKILLS: Item[] = [
  { id: "cron", title: "Cron", desc: ["Lịch chạy việc định kỳ (SQLite), hướng dẫn nằm trong TOOLS.md", "Native scheduler (SQLite), guide in TOOLS.md"] },
  { id: "image-gen", title: "Tạo ảnh Infographic", desc: ["Tạo ảnh infographic, poster tự động qua 9Router", "Generate infographics and posters through 9Router"] },
  { id: "web-search", title: "Web Search", desc: ["Tìm kiếm web thời gian thực (DuckDuckGo)", "Real-time web search (DuckDuckGo)"] },
];
const PLUGINS: Item[] = [
  { id: "zalo-connect", title: "OpenClaw Zalo Connect", channels: ["zalo-personal"], desc: ["Kênh Zalo cá nhân (zca-js), bắt buộc cho bot Zalo. Tự cài khi tạo bot Zalo đầu tiên.", "Personal Zalo channel (zca-js), required for Zalo bots. Installed with the first Zalo bot."] },
  { id: "learning-memory", title: "Siêu Trí Nhớ Dài Hạn", desc: ["Nạp MEMORY.md và USER.md đã chắt lọc vào mọi lượt, kể cả trong nhóm, để bot không quên ngữ cảnh.", "Injects a curated MEMORY.md and USER.md into every turn, group chats included, so the bot keeps its context."] },
  { id: "openclaw-browser-automation", title: "Browser Automation", chrome: true, desc: ["Smart Search và trình duyệt (headless lẫn Chrome thật)", "Smart Search and a browser (headless or real Chrome)"] },
  { id: "openclaw-zalo-mod", title: "Zalo Mod", channels: ["zalo-personal", "zalo-bot"], openWeb: "/dashboard", desc: ["Quản trị nhóm Zalo: chống spam, CRM, công việc, báo cáo", "Zalo group moderation: anti-spam, CRM, tasks, reports"] },
  { id: "openclaw-fb-messenger", title: "Fanpage Messenger", channels: ["fb-messenger"], desc: ["Kênh Messenger và Instagram của Trang, bắt buộc cho bot Messenger", "Page Messenger and Instagram channel, required for Messenger bots"] },
  { id: "openclaw-facebook-crawler", title: "Facebook Crawler", channels: ["fb-messenger"], desc: ["Thu thập dữ liệu Facebook tự động", "Facebook crawler automation"] },
  { id: "openclaw-n8n-facebook-poster", title: "Facebook Poster (n8n)", channels: ["fb-messenger"], desc: ["Đăng bài Facebook tự động qua n8n", "Facebook post automation through n8n"] },
];

export function FeaturesPanel({ bot }: { bot: Bot }) {
  const t = useT();
  const features = useFeatures(bot.id);
  const forChannel = (i: Item) => !i.channels || i.channels.includes(bot.channel);
  return (
    <div className="grid grid-cols-1 gap-4">
      <Group icon={<Sparkles className="size-4" />} title={t("Kỹ năng", "Skills")} items={SKILLS.filter(forChannel)} kind="skill" bot={bot} loading={features.isLoading} />
      <Group icon={<Puzzle className="size-4" />} title="Plugins" items={PLUGINS.filter(forChannel)} kind="plugin" bot={bot} loading={features.isLoading} />
    </div>
  );
}

function Group({ icon, title, items, kind, bot, loading }: { icon: React.ReactNode; title: string; items: Item[]; kind: "skill" | "plugin"; bot: Bot; loading: boolean }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {loading ? items.map((i) => <Skeleton key={i.id} className="h-24" />) : items.map((i) => <FeatureCard key={i.id} item={i} kind={kind} bot={bot} />)}
      </CardContent>
    </Card>
  );
}

function FeatureCard({ item, kind, bot }: { item: Item; kind: "skill" | "plugin"; bot: Bot }) {
  const t = useT();
  const lang = t("vi", "en");
  const projectDir = useProjectDir();
  const status = useStatus();
  const features = useFeatures(bot.id);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"" | "toggle" | "install" | "chrome">("");
  const key = `${kind}:${item.id}`;
  const f = features.data;
  const locked = !!f?.locked?.[key];
  const needsInstall = kind === "plugin" || item.id === "image-gen";
  const installed = !needsInstall || !!f?.installed?.[key] || locked;
  const enabled = !!f?.flags?.[key] || locked;
  const version = needsInstall && installed ? f?.versions?.[key] : "";
  const featuresKey = ["features", projectDir, bot.id];

  const toggle = async (next: boolean) => {
    setBusy("toggle");
    // Optimistic: flip the switch now, the CLI round trip on a VPS can take seconds.
    qc.setQueryData(featuresKey, (old: any) => (old ? { ...old, flags: { ...old.flags, [key]: next } } : old));
    try {
      await api("/api/features/toggle", { body: { projectDir, kind, id: item.id, enabled: next, agentId: bot.id } });
      toast.success(next ? t("Đã bật", "Enabled") : t("Đã tắt", "Disabled"), { description: item.title });
    } catch (err) {
      toast.error(t("Thất bại", "Failed"), { description: (err as Error).message });
    } finally {
      await qc.invalidateQueries({ queryKey: ["features"] });
      if (kind === "skill") await qc.invalidateQueries({ queryKey: ["files"] });
      setBusy("");
    }
  };
  const install = async () => {
    setBusy("install");
    const id = toast.loading(installed ? t(`Đang cập nhật ${item.title}...`, `Updating ${item.title}...`) : t(`Đang cài ${item.title}...`, `Installing ${item.title}...`));
    try {
      await api("/api/features/install", { body: { projectDir, kind, id: item.id, agentId: bot.id } });
      toast.success(t("Cài đặt / cập nhật xong", "Installed / updated"), { id, description: item.title });
    } catch (err) {
      toast.error(t("Thất bại", "Failed"), { id, description: (err as Error).message });
    } finally {
      await qc.invalidateQueries({ queryKey: ["features"] });
      await qc.invalidateQueries({ queryKey: ["files"] });
      setBusy("");
    }
  };
  const chrome = async () => {
    setBusy("chrome");
    try {
      const r = await api<{ headless?: boolean; port?: number; chromeCmdMac?: string; chromeCmdWin?: string; tunnelCmd?: string }>("/api/browser/start-chrome", { body: {} });
      if (r.headless) {
        await confirmDialog({
          title: t("Dùng Chrome trên máy của bạn", "Use Chrome on your computer"),
          description: t("Máy chủ không có màn hình nên không mở Chrome tại đây. Chạy hai lệnh dưới trên máy của bạn và giữ chúng chạy, bot sẽ dùng Chrome đó (cổng 9222). Không làm cũng được: bot vẫn có trình duyệt ẩn sẵn.", "This server has no display. Run the two commands below on your computer and keep them running; the bot will use that Chrome (port 9222). Optional: the bot already has a headless browser."),
          body: (
            <div className="grid grid-cols-1 gap-2 text-sm">
              <p>1. {t("Mở Chrome debug, macOS:", "Start Chrome debug, macOS:")}</p>
              <Cmd text={r.chromeCmdMac} />
              <p>{t("Hoặc Windows:", "Or Windows:")}</p>
              <Cmd text={r.chromeCmdWin} />
              <p>2. {t("Tạo tunnel về máy chủ (cửa sổ terminal khác):", "Create the reverse tunnel (another terminal):")}</p>
              <Cmd text={r.tunnelCmd} />
            </div>
          ),
          okText: t("Đã hiểu", "Got it"),
          hideCancel: true,
        });
      } else {
        toast.success(t("Đã mở Chrome cho bot", "Chrome opened for the bot"), { description: t(`Cổng ${r.port}. Cửa sổ mới dùng bản sao profile của bạn (đã đăng nhập sẵn), Chrome thường cứ để nguyên.`, `Port ${r.port}. The new window runs a copy of your profile (signed in); your normal Chrome can stay open.`) });
      }
    } catch (err) {
      toast.error(t("Thất bại", "Failed"), { description: (err as Error).message });
    } finally {
      setBusy("");
    }
  };
  // zalo-mod's dashboard is always gateway port + 1 for the selected project.
  const webHref = item.openWeb ? sameHostUrl("", portOf(status.data?.gatewayUrl, 18789) + 1) + item.openWeb : "";

  return (
    <div className={cn("relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 transition-colors", enabled && installed && "border-foreground/20 bg-muted/30")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{item.title}</span>
            {version ? <Badge variant="secondary" className="font-mono text-[11px]">v{version}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{lang === "vi" ? item.desc[0] : item.desc[1]}</p>
        </div>
        {installed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Switch checked={enabled} disabled={locked || busy === "toggle"} onCheckedChange={toggle} aria-label={item.title} />
              </span>
            </TooltipTrigger>
            {locked ? <TooltipContent>{t("Bắt buộc cho kênh này, không tắt được", "Required for this channel")}</TooltipContent> : null}
          </Tooltip>
        )}
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        {!installed ? (
          <Button size="sm" onClick={install} disabled={!!busy}>
            {busy === "install" ? <Loader2 className="animate-spin" /> : <Download />}
            {t("Cài đặt", "Install")}
          </Button>
        ) : (
          <>
            {needsInstall && (
              <Button size="sm" variant="outline" onClick={install} disabled={!!busy}>
                <RefreshCw className={cn(busy === "install" && "animate-spin")} />
                {t("Cập nhật", "Update")}
              </Button>
            )}
            {webHref && (
              <Button size="sm" variant="outline" asChild>
                <a href={webHref} target="_blank" rel="noopener">
                  <ExternalLink />
                  {t("Mở web", "Open")}
                </a>
              </Button>
            )}
            {item.chrome && (
              <Button size="sm" variant="outline" onClick={chrome} disabled={!!busy}>
                {busy === "chrome" ? <Loader2 className="animate-spin" /> : <Globe />}
                {t("Mở Chrome cho bot", "Open Chrome for bot")}
              </Button>
            )}
          </>
        )}
      </div>
      {busy === "install" && <div className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-primary" />}
    </div>
  );
}

function Cmd({ text }: { text?: string }) {
  if (!text) return null;
  return <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs whitespace-pre">{text}</code>;
}

export { Cmd };
