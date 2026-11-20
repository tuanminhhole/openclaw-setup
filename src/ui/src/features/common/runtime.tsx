import { useMutation } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type BotStatus, type SystemInfo } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useProjectDir, useRefresh } from "@/lib/queries";
import { cn, sameHostUrl } from "@/lib/utils";

export function StatusBadge({ value }: { value?: string }) {
  const v = value || "offline";
  const tone = v === "online" ? "text-success border-success/30 bg-success/10" : v === "unknown" ? "text-warning border-warning/30 bg-warning/10" : "text-destructive border-destructive/30 bg-destructive/10";
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium capitalize", tone)}>
      <span className="size-1.5 rounded-full bg-current" />
      {v}
    </Badge>
  );
}

/** OpenClaw / 9Router card: status, open the web UI, update to the pinned version. */
export function RuntimeRow({ name, target, url, port, status }: { name: string; target: "openclaw" | "9router"; url?: string; port: number; status?: string }) {
  const t = useT();
  const projectDir = useProjectDir();
  const refresh = useRefresh();
  const update = useMutation({
    mutationFn: () => api("/api/runtime/update", { body: { projectDir, target } }),
    onMutate: () => toast.loading(t(`Đang cập nhật ${name}...`, `Updating ${name}...`), { id: `upd-${target}` }),
    onSuccess: async () => {
      toast.success(t(`Đã cập nhật ${name}`, `${name} updated`), { id: `upd-${target}` });
      await refresh(["system", "status"]);
    },
    onError: (e: Error) => toast.error(t("Cập nhật thất bại", "Update failed"), { id: `upd-${target}`, description: e.message }),
  });
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border bg-card/50 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          {name}
          <StatusBadge value={status} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a href={sameHostUrl(url, port)} target="_blank" rel="noopener">
            <ExternalLink className="size-3.5" />
            {t("Mở web", "Open")}
          </a>
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={update.isPending} onClick={() => update.mutate()}>
          <RefreshCw className={cn("size-3.5", update.isPending && "animate-spin")} />
          {t("Cập nhật", "Update")}
        </Button>
      </div>
    </div>
  );
}

export function versionsOf(s?: BotStatus, sys?: SystemInfo) {
  const strip = (v: string, re: RegExp) => String(v || "-").replace(re, "");
  return {
    openclaw: strip(s?.runtimeVersions?.openclaw || sys?.versions?.currentOpenclaw || sys?.versions?.openclaw || "-", /^(openclaw|create-openclaw-bot)@/),
    router: strip(s?.runtimeVersions?.nineRouter || sys?.versions?.currentNineRouter || sys?.versions?.nineRouter || "-", /^9router@/),
    node: strip(s?.runtimeVersions?.node || sys?.versions?.currentNode || sys?.versions?.node || sys?.node?.output || "-", /^v/),
  };
}

export function KeyValueList({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex min-w-0 items-center justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-muted-foreground">{k}</dt>
          <dd className="min-w-0 truncate text-right font-medium tabular-nums" title={typeof v === "string" ? v : undefined}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
