import { ArrowUpCircle, Languages, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useStatus, useSystem } from "@/lib/queries";
import { isVersionNewer } from "@/lib/utils";
import { useApp } from "@/stores/app";
import { NAV_ITEMS } from "./nav";

export function AppHeader() {
  const t = useT();
  const route = useApp((s) => s.route);
  const { theme, setTheme, lang, setLang, go } = useApp();
  const sys = useSystem();
  const status = useStatus();
  const item = NAV_ITEMS.find((i) => i.id === route);
  const setupVer = sys.data?.versions?.setup;
  const latest = sys.data?.versions?.latestSetup;
  const hasUpdate = isVersionNewer(latest, setupVer);
  const gw = status.data?.gatewayStatus;

  const updateSetup = async () => {
    go("logs");
    const id = toast.loading(t("Đang cập nhật Setup UI...", "Updating Setup UI..."));
    try {
      await api("/api/setup/update", { body: {} });
      toast.success(t("Đang tải bản mới trong nền", "Downloading the new version in the background"), { id });
    } catch (err) {
      toast.error(t("Cập nhật thất bại", "Update failed"), { id, description: (err as Error).message });
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex w-full items-center justify-between gap-2 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
          <span className="truncate text-sm font-medium">{item ? t(item.vi, item.en) : ""}</span>
          {gw ? (
            <Badge variant="outline" className="ml-1 hidden gap-1.5 font-normal sm:inline-flex">
              <span className={`size-1.5 rounded-full ${gw === "online" ? "bg-success" : "bg-destructive"}`} />
              {gw === "online" ? t("Gateway đang chạy", "Gateway online") : t("Gateway tắt", "Gateway offline")}
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {hasUpdate ? (
            <Button size="sm" variant="outline" className="gap-1.5 border-success/40 text-success hover:text-success" onClick={updateSetup}>
              <ArrowUpCircle className="size-4" />
              {t("Cập nhật", "Update")} {latest}
            </Button>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => setLang(lang === "vi" ? "en" : "vi")} aria-label="Language">
                <Languages className="size-4" />
                <span className="sr-only">{lang}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{lang === "vi" ? "English" : "Tiếng Việt"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Theme">
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{theme === "dark" ? t("Giao diện sáng", "Light mode") : t("Giao diện tối", "Dark mode")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
