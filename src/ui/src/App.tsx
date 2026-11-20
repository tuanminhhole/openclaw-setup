import { useEffect } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlobalDialogs } from "@/features/common/global-dialogs";
import { WhatsNewDialog } from "@/features/common/whats-new-dialog";
import { useLogStream } from "@/features/common/use-log-stream";
import { ZaloLoginDialog } from "@/features/bots/zalo-login-dialog";
import { BotsPage } from "@/features/bots/bots-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { AppSidebar } from "@/features/layout/app-sidebar";
import { AppHeader } from "@/features/layout/header";
import { LogsPage } from "@/features/logs/logs-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { SetupPage } from "@/features/setup/setup-page";
import { useAdoptServerProject } from "@/lib/queries";
import { useApp } from "@/stores/app";

export function App() {
  const route = useApp((s) => s.route);
  const syncRoute = useApp((s) => s.syncRoute);
  useLogStream();
  useAdoptServerProject();
  useEffect(() => {
    window.addEventListener("popstate", syncRoute);
    window.addEventListener("hashchange", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("hashchange", syncRoute);
    };
  }, [syncRoute]);

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider defaultOpen={(() => { try { return localStorage.getItem("openclaw-nav") !== "1"; } catch { return true; } })()}>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <AppHeader />
          <div key={route} className="flex flex-1 flex-col gap-6 p-4 animate-in fade-in-0 duration-200 md:p-6">
            {route === "dashboard" && <DashboardPage />}
            {route === "bot" && <BotsPage />}
            {route === "setup" && <SetupPage />}
            {route === "logs" && <LogsPage />}
            {route === "settings" && <SettingsPage />}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <GlobalDialogs />
      <ZaloLoginDialog />
      <WhatsNewDialog />
      <Toaster position="bottom-right" richColors closeButton />
    </TooltipProvider>
  );
}
