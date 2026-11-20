import { Check, ChevronsUpDown, Coffee, FolderGit2 } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar } from "@/components/ui/sidebar";
import { BrandIcon } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { useStatus, useSystem } from "@/lib/queries";
import { baseName } from "@/lib/utils";
import { useApp } from "@/stores/app";
import { DonateDialog } from "@/features/common/donate-dialog";
import { useConnectProject } from "@/features/setup/use-project-actions";
import { NAV_GROUPS } from "./nav";

const SOCIALS: { icon: string; label: string; href: string; size?: string }[] = [
  { icon: "facebook", label: "Facebook", href: "https://www.facebook.com/holeminhtuan.it/" },
  { icon: "telegram", label: "Telegram", href: "https://t.me/holeminhtuan_it" },
  { icon: "zalo", label: "Zalo", href: "https://zalo.me/0962794917", size: "size-5" },
  { icon: "github", label: "GitHub", href: "https://github.com/tuanminhhole/" },
];

export function AppSidebar() {
  const t = useT();
  const route = useApp((s) => s.route);
  const go = useApp((s) => s.go);
  const { isMobile, setOpenMobile } = useSidebar();
  const sys = useSystem();
  const status = useStatus();
  const [donate, setDonate] = useState(false);
  const botCount = status.data?.bots?.length ?? 0;

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => go("dashboard")} className="gap-3">
              <img src="/openclaw-logo.svg" alt="" className="size-8 shrink-0 rounded-md" />
              <div className="grid grid-cols-1 flex-1 text-left leading-tight">
                <span className="truncate font-semibold">OpenClaw Setup</span>
                <span className="truncate text-xs text-muted-foreground">v{sys.data?.versions?.setup || "…"}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ProjectSwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((g) => (
          <SidebarGroup key={g.en}>
            <SidebarGroupLabel>{t(g.vi, g.en)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => (
                  <SidebarMenuItem key={it.id}>
                    <SidebarMenuButton
                      isActive={route === it.id}
                      tooltip={t(it.vi, it.en)}
                      onClick={() => {
                        go(it.id);
                        if (isMobile) setOpenMobile(false);
                      }}
                    >
                      <it.icon />
                      <span>{t(it.vi, it.en)}</span>
                    </SidebarMenuButton>
                    {it.id === "bot" && botCount > 0 ? <SidebarMenuBadge>{botCount}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="rounded-lg border bg-card p-3 text-xs group-data-[collapsible=icon]:hidden">
          <p className="font-medium">{t("Công cụ này giúp ích cho bạn?", "Finding this useful?")}</p>
          <p className="mt-1 text-muted-foreground">{t("Mời tác giả một ly cà phê để duy trì và cải tiến OpenClaw Setup.", "Buy the author a coffee to keep OpenClaw Setup improving.")}</p>
          <button type="button" onClick={() => setDonate(true)} className="mt-2 inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline">
            <Coffee className="size-3.5" />
            {t("Mời cà phê", "Buy a coffee")}
          </button>
          <div className="mt-3 flex items-center gap-1 border-t pt-3">
            {SOCIALS.map((x) => (
              <a key={x.icon} href={x.href} target="_blank" rel="noopener" aria-label={x.label} title={x.label} className="inline-flex size-8 items-center justify-center rounded-md transition-all hover:-translate-y-0.5 hover:bg-accent">
                <BrandIcon name={x.icon} className={x.size || "size-4"} />
              </a>
            ))}
            <a href="https://monkeytech.vn" target="_blank" rel="noopener" aria-label="MonkeyTech" title="monkeytech.vn" className="ml-auto inline-flex size-8 items-center justify-center rounded-md transition-all hover:-translate-y-0.5 hover:bg-accent">
              <img src="/monkeytech-icon.webp" alt="MonkeyTech" className="size-5 rounded-[5px]" />
            </a>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
      <DonateDialog open={donate} onOpenChange={setDonate} />
    </Sidebar>
  );
}

function ProjectSwitcher() {
  const t = useT();
  const sys = useSystem();
  const status = useStatus();
  const connect = useConnectProject();
  const projects = sys.data?.projects || [];
  const current = status.data?.projectDir || "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="border bg-card data-[state=open]:bg-sidebar-accent" tooltip={current || t("Chưa có project", "No project")}>
          <FolderGit2 />
          <div className="grid grid-cols-1 flex-1 text-left text-xs leading-tight">
            <span className="truncate font-medium">{current ? baseName(current) : t("Chưa có project", "No project")}</span>
            <span className="truncate text-muted-foreground">{status.data?.deployMode === "docker" ? "Docker" : "Native"} · {status.data?.bots?.length ?? 0} bot</span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="start">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("Project trên máy này", "Projects on this machine")}</DropdownMenuLabel>
        {projects.map((p) => (
          <DropdownMenuItem key={p.projectDir} onSelect={() => p.projectDir !== current && connect.mutate(p.projectDir)} className="items-start gap-2">
            <Check className={p.projectDir === current ? "mt-0.5 opacity-100" : "mt-0.5 opacity-0"} />
            <div className="grid grid-cols-1 min-w-0 flex-1">
              <span className="truncate font-medium">{baseName(p.projectDir)}</span>
              <span className="truncate text-xs text-muted-foreground">{p.projectDir}</span>
            </div>
            <span className="text-xs text-muted-foreground">{p.botCount ?? 0}</span>
          </DropdownMenuItem>
        ))}
        {!projects.length && <div className="px-2 py-3 text-xs text-muted-foreground">{t("Chưa phát hiện project nào.", "No project detected.")}</div>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => useApp.getState().go("setup")}>{t("Quản lý project…", "Manage projects…")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
