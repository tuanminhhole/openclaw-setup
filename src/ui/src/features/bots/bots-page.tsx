import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Bot as BotIcon, HardDrive, Hammer, KeyRound, Monitor, MoreHorizontal, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KeyValueList, RuntimeRow, versionsOf } from "@/features/common/runtime";
import { PageHeader } from "@/features/layout/header";
import { api, type Bot, withProject } from "@/lib/api";
import { BrandIcon } from "@/lib/brand";
import { CHANNELS } from "@/lib/channels";
import { useT } from "@/lib/i18n";
import { useFbHealth, useProjectDir, useRefresh, useStatus, useSystem, useZaloHealth } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useApp } from "@/stores/app";
import { confirmDialog, promptDialog } from "@/stores/dialogs";
import { useZaloLogin } from "@/stores/zalo";
import { BotSheet } from "./bot-sheet";
import { FeaturesPanel } from "./features-panel";
import { FilesPanel } from "./files-panel";
import { fbBadges, fbPlan, toneClass, zaloBadges } from "./health";
import { FanpagePanel } from "./fanpage-panel";
import { useHostControl } from "./host-control";

export function BotsPage() {
  const t = useT();
  const status = useStatus();
  const channel = useApp((s) => s.channel);
  const setChannel = useApp((s) => s.setChannel);
  const activeBotId = useApp((s) => s.activeBotId);
  const setActiveBot = useApp((s) => s.setActiveBot);
  const bots = status.data?.bots || [];
  const channelBots = useMemo(() => bots.filter((b) => b.channel === channel), [bots, channel]);
  const zalo = useZaloHealth(channel === "zalo-personal" && channelBots.length > 0);
  const fb = useFbHealth(channel === "fb-messenger" && channelBots.length > 0);
  const [sheet, setSheet] = useState<{ open: boolean; bot: Bot | null }>({ open: false, bot: null });
  const createBotNonce = useApp((s) => s.createBotNonce);
  useEffect(() => {
    if (createBotNonce) setSheet({ open: true, bot: null });
  }, [createBotNonce]);

  // Land on a channel that has bots, and keep a selected bot in the current channel.
  useEffect(() => {
    if (!bots.length) return;
    if (!bots.some((b) => b.channel === channel)) {
      const first = CHANNELS.find((c) => bots.some((b) => b.channel === c.id));
      if (first) setChannel(first.id);
    }
  }, [bots, channel, setChannel]);
  useEffect(() => {
    if (channelBots.length && !channelBots.some((b) => b.id === activeBotId)) setActiveBot(channelBots[0].id);
  }, [channelBots, activeBotId, setActiveBot]);
  const active = channelBots.find((b) => b.id === activeBotId) || null;

  return (
    <>
      <PageHeader
        title={t("Bot", "Bots")}
        description={t("Mỗi kênh một danh sách bot. Chọn một bot để bật kỹ năng, plugin và sửa tệp workspace.", "One list per channel. Pick a bot to toggle skills and plugins and edit its workspace.")}
        actions={
          <Button onClick={() => setSheet({ open: true, bot: null })}>
            <Plus />
            {t("Tạo bot", "New bot")}
          </Button>
        }
      />

      {status.data?.configError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>{t("Không đọc được config", "Cannot read config")}</AlertTitle>
          <AlertDescription className="font-mono text-xs">{status.data.configError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid grid-cols-1 min-w-0 gap-4">
          <Tabs value={channel} onValueChange={setChannel}>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <TabsList>
                {CHANNELS.map((c) => (
                  <TabsTrigger key={c.id} value={c.id} disabled={c.comingSoon} className="gap-2">
                    <BrandIcon name={c.icon} className="size-3.5" />
                    {c.title}
                    {c.comingSoon ? (
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">{t("Sắp", "Soon")}</Badge>
                    ) : (
                      <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{bots.filter((b) => b.channel === c.id).length}</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>{CHANNELS.find((c) => c.id === channel)?.title}</CardTitle>
              <CardDescription>{t(`${channelBots.length} bot`, `${channelBots.length} bot(s)`)}</CardDescription>
              <CardAction className="flex gap-2">
                {channel === "zalo-personal" && channelBots.length > 0 && <ZaloToolbar bot={active} onRefresh={() => zalo.refetch()} refreshing={zalo.isFetching} />}
                {channel === "fb-messenger" && channelBots.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => fb.refetch()} disabled={fb.isFetching}>
                    <RefreshCw className={cn(fb.isFetching && "animate-spin")} />
                    {t("Làm mới", "Refresh")}
                  </Button>
                )}
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {status.isLoading ? (
                <div className="grid grid-cols-1 gap-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : channelBots.length ? (
                <BotTable bots={channelBots} channel={channel} activeId={activeBotId} onSelect={setActiveBot} onEdit={(b) => setSheet({ open: true, bot: b })} zalo={zalo.data} fb={fb.data} />
              ) : (
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BotIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t("Chưa có bot ở kênh này", "No bots in this channel")}</EmptyTitle>
                    <EmptyDescription>{t("Tạo bot đầu tiên: chọn vai, tính cách và nạp tài liệu trong vài phút.", "Create the first one: pick a role, a temperament and add documents in minutes.")}</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button onClick={() => setSheet({ open: true, bot: null })}>
                      <Plus />
                      {t("Tạo bot", "New bot")}
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
            </CardContent>
          </Card>

          {active && (
            <Tabs key={active.id} defaultValue={active.channel === "fb-messenger" ? "fanpage" : "features"} className="gap-4">
              <TabsList>
                {active.channel === "fb-messenger" && <TabsTrigger value="fanpage">Fanpage</TabsTrigger>}
                <TabsTrigger value="features">{t("Kỹ năng và plugin", "Skills and plugins")}</TabsTrigger>
                <TabsTrigger value="files">{t("Tệp workspace", "Workspace files")}</TabsTrigger>
              </TabsList>
              {active.channel === "fb-messenger" && (
                <TabsContent value="fanpage">
                  <FanpagePanel bot={active} />
                </TabsContent>
              )}
              <TabsContent value="features">
                <FeaturesPanel bot={active} />
              </TabsContent>
              <TabsContent value="files">
                <FilesPanel bot={active} />
              </TabsContent>
            </Tabs>
          )}
        </div>

        <RuntimeSide channel={channel} zaloVersion={zalo.data?.installedVersion} zaloMod={zalo.data ? zalo.data.zaloModVersion || (zalo.data.zaloModInstalled ? "-" : t("Chưa cài", "Not installed")) : undefined} />
      </div>

      <BotSheet open={sheet.open} bot={sheet.bot} onOpenChange={(o) => setSheet((s) => ({ ...s, open: o }))} />
    </>
  );
}

function BotTable({ bots, channel, activeId, onSelect, onEdit, zalo, fb }: { bots: Bot[]; channel: string; activeId: string; onSelect: (id: string) => void; onEdit: (b: Bot) => void; zalo?: any; fb?: any }) {
  const t = useT();
  const projectDir = useProjectDir();
  const refresh = useRefresh();
  const isZalo = channel === "zalo-personal";
  const isFb = channel === "fb-messenger";
  const del = async (b: Bot) => {
    const ok = await confirmDialog({
      title: t(`Xoá bot "${b.name}"?`, `Delete bot "${b.name}"?`),
      description: t("Workspace và cấu hình của bot này sẽ bị xoá.", "This bot's workspace and config will be removed."),
      okText: t("Xoá bot", "Delete bot"),
      danger: true,
    });
    if (!ok) return;
    const id = toast.loading(t("Đang xoá bot...", "Deleting bot..."));
    try {
      await api(withProject(`/api/bot/${encodeURIComponent(b.id)}`, projectDir), { method: "DELETE" });
      toast.success(t("Đã xoá bot", "Bot deleted"), { id, description: b.name });
      await refresh();
    } catch (err) {
      toast.error(t("Lỗi khi xoá", "Delete error"), { id, description: (err as Error).message });
    }
  };
  return (
    <Table>
      <TableHeader className="bg-muted/40">
        <TableRow>
          <TableHead className="pl-6">Bot</TableHead>
          {isZalo && <TableHead>{t("Kết nối", "Connection")}</TableHead>}
          {isZalo && <TableHead>{t("Đăng nhập", "Login")}</TableHead>}
          {isFb && <TableHead>{t("Trang", "Page")}</TableHead>}
          {isFb && <TableHead>{t("Kết nối", "Connection")}</TableHead>}
          {isFb && <TableHead>{t("Gói", "Plan")}</TableHead>}
          <TableHead className="w-0 pr-4" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {bots.map((b) => {
          const z = isZalo ? zaloBadges(b, zalo, t) : null;
          const f = isFb ? fbBadges(b, fb, t) : null;
          const plan = isFb ? fbPlan(b, fb, t) : null;
          const role = (b.role || "").trim() || t("Trợ lý OpenClaw", "OpenClaw assistant");
          return (
            <TableRow key={b.id} data-state={activeId === b.id ? "selected" : undefined} onClick={() => onSelect(b.id)} className="cursor-pointer">
              <TableCell className="w-full min-w-44 max-w-0 pl-6">
                <div className="flex items-center gap-3">
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold uppercase", activeId === b.id && "border-foreground/40 bg-foreground text-background")}>{(b.name || b.id).slice(0, 2)}</span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{b.name}</div>
                    <div className="truncate text-xs text-muted-foreground" title={role}>
                      {role} · <span className="font-mono">{b.id}</span>
                    </div>
                  </div>
                </div>
              </TableCell>
              {z && (
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm", toneClass[z.connectionTone])}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {z.connection}
                      </span>
                    </TooltipTrigger>
                    {z.error ? <TooltipContent className="max-w-xs">{z.error}</TooltipContent> : null}
                  </Tooltip>
                </TableCell>
              )}
              {z && <TableCell className={cn("whitespace-nowrap text-sm", toneClass[z.loginTone])}>{z.login}</TableCell>}
              {f && <TableCell className={cn("max-w-40 truncate text-sm", toneClass[f.loginTone])}>{f.login}</TableCell>}
              {f && (
                <TableCell>
                  <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm", toneClass[f.connectionTone])}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {f.connection}
                  </span>
                </TableCell>
              )}
              {isFb && (
                <TableCell>
                  {plan ? (
                    <a href={plan.billingUrl || undefined} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className={cn("whitespace-nowrap text-sm underline-offset-4 hover:underline", toneClass[plan.tone])}>{plan.short}</a>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
              )}
              <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => onEdit(b)} aria-label={t("Sửa bot", "Edit bot")}>
                    <Pencil />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" aria-label="More">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(b)}>
                        <Pencil />
                        {t("Sửa bot", "Edit bot")}
                      </DropdownMenuItem>
                      {isZalo && (
                        <DropdownMenuItem onSelect={() => startZaloLogin(projectDir, b.id, t)}>
                          <KeyRound />
                          {t("Đăng nhập Zalo", "Zalo login")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => del(b)}>
                        <Trash2 />
                        {t("Xoá bot", "Delete bot")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

async function startZaloLogin(projectDir: string, agentId: string, t: (vi: string, en: string) => string) {
  useZaloLogin.getState().start(t("Đang chuẩn bị quét mã Zalo...", "Preparing the Zalo QR login..."));
  try {
    await api("/api/zalo/login", { body: { projectDir, agentId } });
  } catch (err) {
    useZaloLogin.getState().close();
    toast.error(t("Lỗi đăng nhập", "Login error"), { description: (err as Error).message });
  }
}

function ZaloToolbar({ bot, onRefresh, refreshing }: { bot: Bot | null; onRefresh: () => void; refreshing: boolean }) {
  const t = useT();
  const projectDir = useProjectDir();
  return (
    <>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw className={cn(refreshing && "animate-spin")} />
        {t("Làm mới", "Refresh")}
      </Button>
      {bot && (
        <Button variant="outline" size="sm" onClick={() => startZaloLogin(projectDir, bot.id, t)}>
          <KeyRound />
          {t("Đăng nhập Zalo", "Zalo login")}
        </Button>
      )}
    </>
  );
}

function RuntimeSide({ channel, zaloVersion, zaloMod }: { channel: string; zaloVersion?: string; zaloMod?: string }) {
  const t = useT();
  const status = useStatus();
  const sys = useSystem();
  const projectDir = useProjectDir();
  const refresh = useRefresh();
  const hostControl = useHostControl();
  const s = status.data;
  const isNative = s?.deployMode === "native";
  const v = versionsOf(s, sys.data);
  const restart = useMutation({
    mutationFn: () => api("/api/bot/restart", { body: { projectDir } }),
    onSuccess: async () => { toast.success(t("Đã khởi động lại bot", "Bot restarted")); await refresh(["status"]); },
    onError: (e: Error) => toast.error(t("Khởi động lại thất bại", "Restart failed"), { description: e.message }),
  });
  const rebuild = useMutation({
    mutationFn: () => api("/api/bot/rebuild", { body: { projectDir } }),
    onSuccess: async () => { toast.success(t("Đã rebuild container", "Container rebuilt")); await refresh(["status"]); },
    onError: (e: Error) => toast.error(t("Rebuild thất bại", "Rebuild failed"), { description: e.message }),
  });
  const addMount = async () => {
    const v2 = await promptDialog({
      title: t("Cấp quyền ổ đĩa hoặc thư mục", "Grant disk or folder access"),
      description: t("Đường dẫn trên máy (ví dụ /Users/ban/Documents hoặc D:/data). Áp cho mọi bot trong project rồi tự tạo lại container (10 đến 20 giây).", "Host path (e.g. /Users/you/Documents or D:/data). Applies to every bot in the project, then recreates the container (10 to 20 s)."),
      fields: [{ placeholder: "/Users/ban/Documents" }, { label: t("Tên mount (tuỳ chọn), thành /mnt/<tên>", "Mount name (optional), becomes /mnt/<name>"), placeholder: "baocao" }],
    });
    if (!v2) return;
    const id = toast.loading(t("Đang mount và tạo lại container...", "Mounting and recreating the container..."));
    try {
      const r = await api<{ alreadyMounted?: boolean; target: string; applied?: boolean }>("/api/bot/add-mount", { body: { projectDir, hostPath: v2[0], mountName: v2[1] || "" } });
      toast.success(r.alreadyMounted ? t("Đã có sẵn", "Already mounted") : t("Đã thêm mount", "Mount added"), { id, description: `${v2[0]} → ${r.target}` });
      await refresh(["status"]);
    } catch (err) {
      toast.error(t("Thất bại", "Failed"), { id, description: (err as Error).message });
    }
  };
  return (
    <Card className="h-max xl:sticky xl:top-20">
      <CardHeader>
        <CardTitle>{t("Trạng thái", "Status")}</CardTitle>
        <CardDescription>{isNative ? t("Native: chạy thẳng trên máy", "Native: runs on this machine") : t("Docker", "Docker")}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3">
        <RuntimeRow name="OpenClaw" target="openclaw" url={s?.gatewayUrl} port={18789} status={s?.gatewayStatus} />
        <RuntimeRow name="9Router" target="9router" url={s?.routerUrl} port={20128} status={s?.routerStatus} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => restart.mutate()} disabled={restart.isPending}>
            <RotateCcw className={cn(restart.isPending && "animate-spin")} />
            {t("Khởi động lại", "Restart")}
          </Button>
          <Button variant="outline" size="sm" onClick={hostControl}>
            <Monitor />
            {t("Điều khiển máy", "Control PC")}
          </Button>
          {!isNative && (
            <Button variant="outline" size="sm" onClick={() => rebuild.mutate()} disabled={rebuild.isPending}>
              <Hammer />
              Rebuild
            </Button>
          )}
          {!isNative && (
            <Button variant="outline" size="sm" onClick={addMount}>
              <HardDrive />
              {t("Cấp ổ đĩa", "Grant disk")}
            </Button>
          )}
        </div>
        <KeyValueList
          rows={[
            ["OpenClaw", v.openclaw],
            ["9Router", v.router],
            ...(channel === "zalo-personal" ? ([["Zalo Connect", zaloVersion || "-"], ["Zalo Mod", zaloMod ?? "…"]] as [string, string][]) : []),
          ]}
        />
      </CardContent>
    </Card>
  );
}
