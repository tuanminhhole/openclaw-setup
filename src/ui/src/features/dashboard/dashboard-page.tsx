import { Bot, Boxes, Cpu, FolderGit2, Globe, Puzzle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyLogsButton, LogPane } from "@/features/common/log-pane";
import { KeyValueList, RuntimeRow, versionsOf } from "@/features/common/runtime";
import { PageHeader } from "@/features/layout/header";
import { BrandIcon } from "@/lib/brand";
import { CHANNELS } from "@/lib/channels";
import { useT } from "@/lib/i18n";
import { useCatalog, useFeatures, useStatus, useSystem } from "@/lib/queries";
import { baseName, portOf } from "@/lib/utils";
import { useApp } from "@/stores/app";

export function DashboardPage() {
  const t = useT();
  const go = useApp((s) => s.go);
  const sys = useSystem();
  const status = useStatus();
  const catalog = useCatalog();
  const features = useFeatures(status.data?.bots?.[0]?.id || "");
  const s = status.data;
  const bots = s?.bots || [];
  const v = versionsOf(s, sys.data);
  const skills = catalog.data?.skills || [];
  const plugins = catalog.data?.plugins || [];
  const flags = features.data?.flags || {};
  const installed = features.data?.installed || {};
  const skillsOn = skills.filter((k) => flags[`skill:${k.slug}`]).length;
  const pluginsOn = plugins.filter((p) => installed[`plugin:${p.package}`]).length;

  const stats = [
    { icon: FolderGit2, label: t("Project hiện tại", "Current project"), value: s?.projectDir ? baseName(s.projectDir) : "-", meta: `${sys.data?.projects?.length ?? 0} project · ${s?.deployMode === "docker" ? "Docker" : "Native"}` },
    { icon: Bot, label: "Bot", value: String(bots.length), meta: CHANNELS.filter((c) => !c.comingSoon).map((c) => `${bots.filter((b) => b.channel === c.id).length} ${c.title}`).join(" · ") },
    { icon: Cpu, label: t("Model", "Model"), value: s?.activeModel || "smart-route", meta: `${t("qua", "via")} ${s?.activeProvider || "9Router"}` },
    { icon: Puzzle, label: t("Kỹ năng · Plugin", "Skills · Plugins"), value: `${skillsOn} · ${pluginsOn}`, meta: t(`trên ${skills.length} kỹ năng, ${plugins.length} plugin`, `of ${skills.length} skills, ${plugins.length} plugins`) },
  ];

  return (
    <>
      <PageHeader
        title={t("Tổng quan vận hành", "Operations overview")}
        description={t("Trạng thái runtime, phiên bản, bot và nhật ký của project đang chọn.", "Runtime status, versions, bots and logs of the selected project.")}
        actions={
          <>
            <Button variant="outline" onClick={() => go("setup")}>
              <Boxes />
              {t("Cài đặt", "Install")}
            </Button>
            <Button onClick={() => go("bot")}>
              <Sparkles />
              {t("Quản lý bot", "Manage bots")}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((st) => (
          <Card key={st.label} className="gap-3 py-5">
            <CardHeader className="px-5">
              <CardDescription className="flex items-center gap-2">
                <st.icon className="size-4" />
                {st.label}
              </CardDescription>
              <CardTitle className="truncate text-2xl font-semibold tabular-nums">{status.isLoading ? <Skeleton className="h-8 w-24" /> : st.value}</CardTitle>
            </CardHeader>
            <CardContent className="truncate px-5 text-xs text-muted-foreground">{st.meta}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("Bot theo kênh", "Bots by channel")}</CardTitle>
            <CardDescription>{t("Bấm một kênh để mở danh sách bot của kênh đó.", "Click a channel to open its bots.")}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CHANNELS.filter((c) => !c.comingSoon).map((c) => {
              const list = bots.filter((b) => b.channel === c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    useApp.getState().setChannel(c.id);
                    go("bot");
                  }}
                  className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                >
                  <span className="flex size-9 items-center justify-center rounded-md border bg-background">
                    <BrandIcon name={c.icon} className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{c.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{list.length ? list.map((b) => b.name).join(", ") : t("Chưa có bot", "No bots yet")}</span>
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{list.length}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Runtime", "Runtime")}</CardTitle>
            <CardDescription>{t("Gateway OpenClaw và bộ định tuyến model 9Router.", "OpenClaw gateway and the 9Router model router.")}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            <RuntimeRow name="OpenClaw" target="openclaw" url={s?.gatewayUrl} port={18789} status={s?.gatewayStatus} />
            <RuntimeRow name="9Router" target="9router" url={s?.routerUrl} port={20128} status={s?.routerStatus} />
            <KeyValueList
              rows={[
                ["OpenClaw", v.openclaw],
                ["9Router", v.router],
                ["Node.js", v.node],
                [t("Máy", "Machine"), `${sys.data?.os || "-"} · ${sys.data?.arch || "-"}`],
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <RemoteAccessCard />

      <Card>
        <CardHeader>
          <CardTitle>{t("Nhật ký trực tiếp", "Live log")}</CardTitle>
          <CardDescription>{t("80 dòng gần nhất. Xem đầy đủ ở trang Nhật ký.", "Last 80 lines. The Logs page has everything.")}</CardDescription>
          <CardAction>
            <CopyLogsButton />
          </CardAction>
        </CardHeader>
        <CardContent>
          <LogPane tail={80} className="h-72" />
        </CardContent>
      </Card>
    </>
  );
}

/** "Open from another machine": a ready SSH tunnel command for a headless server. */
function RemoteAccessCard() {
  const t = useT();
  const sys = useSystem();
  const status = useStatus();
  const r = sys.data?.remote;
  if (!r) return null;
  const s = status.data;
  // zalo-mod's dashboard is gateway port + 1, not a fixed 18790.
  const gwPort = Number(portOf(s?.gatewayUrl, 18789));
  const ports = Array.from(new Set([r.uiPort || 51789, gwPort, Number(portOf(s?.routerUrl, 20128)), gwPort + 1]));
  const cmd = `ssh ${ports.map((p) => `-L ${p}:127.0.0.1:${p}`).join(" ")} ${r.user || "root"}@${r.host || "<your-server-ip>"}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-4" />
          {t("Mở từ máy khác", "Open from another machine")}
        </CardTitle>
        <CardDescription>
          {t("Máy chủ không có trình duyệt. Trên MÁY của bạn chạy lệnh này rồi mở", "The server has no browser. On YOUR computer run this, then open")} <code className="rounded bg-muted px-1 py-0.5 text-xs">http://localhost:{r.uiPort || 51789}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Input readOnly value={cmd} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(cmd);
              toast.success(t("Đã copy lệnh", "Command copied"));
            } catch {
              toast.error(t("Không copy được, hãy bôi đen và copy tay", "Copy failed, select and copy by hand"));
            }
          }}
        >
          Copy
        </Button>
      </CardContent>
    </Card>
  );
}
