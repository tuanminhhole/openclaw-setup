import { ArrowRightLeft, CheckCircle2, CircleAlert, FolderOpen, Link2, RefreshCw, Rocket, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyLogsButton, LogPane } from "@/features/common/log-pane";
import { PageHeader } from "@/features/layout/header";
import { api, type ProjectMeta } from "@/lib/api";
import { BrandIcon } from "@/lib/brand";
import { MODE_OPTIONS, OS_OPTIONS } from "@/lib/channels";
import { useT } from "@/lib/i18n";
import { useRefresh, useStatus, useSystem } from "@/lib/queries";
import { baseName, cn } from "@/lib/utils";
import { useApp } from "@/stores/app";
import { confirmDialog } from "@/stores/dialogs";
import { InstallDialog } from "./install-dialog";
import { useConnectProject, useDeleteProject, usePickFolder } from "./use-project-actions";

export function SetupPage() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const sys = useSystem();
  const status = useStatus();
  const refresh = useRefresh();
  const connect = useConnectProject();
  const del = useDeleteProject();
  const pick = usePickFolder();
  const moveToNative = useMoveToNative();
  const [os, setOs] = useState<string>("");
  const [installOpen, setInstallOpen] = useState(false);
  const pickedOs = os || sys.data?.os || "win";
  const projects = sys.data?.projects || [];
  const current = status.data?.projectDir || "";

  return (
    <>
      <PageHeader
        title={t("Cài OpenClaw trong vài phút", "Install OpenClaw in minutes")}
        description={t("Chọn hệ điều hành, bấm cài. OpenClaw và 9Router chạy thẳng trên máy (native) dưới dạng service tự bật lại.", "Pick the OS and install. OpenClaw and 9Router run directly on the machine (native) as auto-restarting services.")}
        actions={
          <Button onClick={() => setInstallOpen(true)}>
            <Rocket />
            {t("Cài OpenClaw", "Install OpenClaw")}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("Hệ điều hành và chế độ chạy", "Operating system and runtime")}</CardTitle>
            <CardDescription>{t("Đã chọn sẵn theo máy đang chạy Setup.", "Preselected from the machine running Setup.")}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {OS_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOs(o.id)}
                  className={cn("flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all hover:bg-accent/60", pickedOs === o.id && "border-foreground/40 bg-accent ring-1 ring-foreground/20")}
                >
                  <BrandIcon name={o.icon} className="size-5" />
                  <span className="text-sm font-medium">{o.title}</span>
                  <span className="text-xs text-muted-foreground">{lang === "vi" ? o.vi : o.en}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MODE_OPTIONS.map((m) => (
                <div key={m.id} className={cn("flex items-start gap-3 rounded-lg border p-3", m.retired ? "opacity-60" : "border-foreground/40 bg-accent")}>
                  <BrandIcon name={m.icon} className="mt-0.5 size-5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {m.title}
                      <Badge variant={m.retired ? "outline" : "secondary"}>{m.retired ? t("Đã ngừng", "Retired") : t("Khuyên dùng", "Recommended")}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{lang === "vi" ? m.vi : m.en}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Hệ thống", "System")}</CardTitle>
            <CardDescription>{sys.data ? `${sys.data.os} · ${sys.data.platform} · ${sys.data.arch}` : "…"}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 text-sm">
            {(["node", "npm", "docker"] as const).map((k) => {
              const ok = !!sys.data?.[k]?.ok;
              return (
                <div key={k} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="capitalize">{k}</span>
                  <span className={cn("flex items-center gap-1.5 text-xs", ok ? "text-success" : "text-muted-foreground")}>
                    {ok ? <CheckCircle2 className="size-3.5" /> : <CircleAlert className="size-3.5" />}
                    {ok ? sys.data?.[k]?.output || "OK" : k === "docker" ? t("Không cần", "Not needed") : t("Thiếu", "Missing")}
                  </span>
                </div>
              );
            })}
            <p className="pt-1 text-xs text-muted-foreground">
              {t("Cài theo", "Pins")}: {sys.data?.versions?.desiredOpenclaw} + {sys.data?.versions?.desiredNineRouter}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("Project trên máy này", "Projects on this machine")}</CardTitle>
          <CardDescription>{t("Kết nối để quản lý bot của project đó. Project còn chạy Docker có nút chuyển sang native.", "Connect to manage that project's bots. Projects still on Docker get a move-to-native button.")}</CardDescription>
          <CardAction className="flex gap-2">
            <Button variant="outline" size="sm" onClick={async () => { await api("/api/projects/discover"); await refresh(["system"]); }}>
              <RefreshCw />
              {t("Quét lại", "Rescan")}
            </Button>
            <Button variant="outline" size="sm" onClick={pick}>
              <FolderOpen />
              {t("Chọn thư mục", "Browse")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="hidden md:table-cell">{t("Chế độ", "Mode")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("Cổng", "Ports")}</TableHead>
                  <TableHead className="text-right">Bot</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <ProjectRow key={p.projectDir} p={p} current={p.projectDir === current} connecting={connect.isPending && connect.variables === p.projectDir} onConnect={() => connect.mutate(p.projectDir)} onDelete={() => del(p.projectDir)} onMove={() => moveToNative(p.projectDir)} />
                ))}
                {!projects.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      {t("Chưa phát hiện project nào. Bấm Cài OpenClaw để tạo project đầu tiên.", "No project found. Click Install OpenClaw to create the first one.")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Nhật ký trực tiếp", "Live log")}</CardTitle>
          <CardAction>
            <CopyLogsButton />
          </CardAction>
        </CardHeader>
        <CardContent>
          <LogPane tail={80} className="h-64" />
        </CardContent>
      </Card>

      <InstallDialog open={installOpen} onOpenChange={setInstallOpen} defaultOs={pickedOs} />
    </>
  );
}

function ProjectRow({ p, current, connecting, onConnect, onDelete, onMove }: { p: ProjectMeta; current: boolean; connecting: boolean; onConnect: () => void; onDelete: () => void; onMove: () => void }) {
  const t = useT();
  return (
    <TableRow className={cn(current && "bg-accent/50")}>
      <TableCell className="max-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{baseName(p.projectDir)}</span>
          {current && <Badge variant="secondary">{t("Đang chọn", "Active")}</Badge>}
        </div>
        <div className="truncate font-mono text-xs text-muted-foreground">{p.projectDir}</div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant="outline" className="capitalize">
          {p.mode || "-"}
        </Badge>
      </TableCell>
      <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
        GW {p.gatewayPort || "-"} · 9R {p.routerPort || "-"}
      </TableCell>
      <TableCell className="text-right tabular-nums">{p.botCount ?? 0}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {!current && (
            <Button size="sm" variant="outline" onClick={onConnect} disabled={connecting}>
              <Link2 />
              {t("Kết nối", "Connect")}
            </Button>
          )}
          {p.mode === "docker" && (
            <Button size="sm" variant="outline" onClick={onMove}>
              <ArrowRightLeft />
              {t("Chuyển sang Native", "Move to Native")}
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={onDelete} aria-label={t("Xoá project", "Delete project")}>
                <Trash2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("Xoá project", "Delete project")}</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Docker -> native, opened only from the project row (never automatically). */
function useMoveToNative() {
  const t = useT();
  const refresh = useRefresh();
  return async (dir: string) => {
    const rows: [string, string, string][] = [
      ["🖥️", t("Bot điều khiển được máy này", "The bot can drive this machine"), t("Chụp màn hình, rê chuột, bấm, gõ phím. Bản Docker không làm được.", "Screenshots, mouse, clicks, typing. Docker cannot.")],
      ["🛡️", t("Tránh lỗi làm chết bot", "Avoids the fault that kills bots"), t("OpenClaw mới không ghi được cấu hình qua thư mục chia sẻ Docker trên Windows.", "Recent OpenClaw cannot write its config through a Docker shared folder on Windows.")],
      ["⚡", t("Nhẹ và nhanh hơn", "Lighter and faster"), t("Không cần Docker Desktop chạy nền, ít RAM hơn.", "No Docker Desktop in the background, less RAM.")],
      ["🔒", t("An toàn như cũ", "Just as safe"), t("Bot vẫn chỉ nghe trên máy này. Điều khiển máy mặc định TẮT.", "The bot still listens locally. Computer control stays OFF by default.")],
    ];
    const ok = await confirmDialog({
      title: t("Chuyển project sang chạy thẳng trên máy?", "Move this project off Docker?"),
      description: t("Toàn bộ bot, tệp workspace và phiên đăng nhập Zalo giữ nguyên.", "Every bot, workspace file and Zalo login comes along."),
      body: (
        <div className="grid grid-cols-1 gap-3">
          <ul className="grid grid-cols-1 gap-2">
            {rows.map(([i, ttl, d]) => (
              <li key={ttl} className="flex gap-3 rounded-md border p-2.5">
                <span aria-hidden>{i}</span>
                <span>
                  <b className="font-medium">{ttl}</b>
                  <br />
                  <span className="text-muted-foreground">{d}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t("Mất 5 đến 15 phút tuỳ số plugin. Bot ngừng trả lời trong lúc chuyển, đừng đóng trang. Container cũ chỉ được dừng, không xoá, nên vẫn quay lui được.", "Takes 5 to 15 minutes depending on plugins. The bot stops replying meanwhile; keep this page open. Old containers are stopped, not deleted, so you can roll back.")}</p>
        </div>
      ),
      okText: t("Chuyển ngay", "Move now"),
      cancelText: t("Để sau", "Later"),
    });
    if (!ok) return;
    useApp.getState().setProjectDir(dir);
    useApp.getState().go("logs");
    const id = toast.loading(t("Đang chuyển sang native, xem tiến trình ở Nhật ký...", "Moving to native, watch the Logs page..."));
    try {
      await api("/api/runtime/update", { body: { projectDir: dir, target: "openclaw" } });
      toast.success(t("Đã chuyển xong", "Moved"), { id, description: t("Bot giờ chạy thẳng trên máy này.", "The bot now runs directly on this machine.") });
      await refresh();
    } catch (err) {
      toast.error(t("Chuyển không xong", "Move failed"), { id, description: (err as Error).message });
    }
  };
}
