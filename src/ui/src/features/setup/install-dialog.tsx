import { useMutation } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { OS_OPTIONS } from "@/lib/channels";
import { useT } from "@/lib/i18n";
import { useRefresh } from "@/lib/queries";
import { useApp } from "@/stores/app";

const defaultDir = (os: string) => (os === "win" ? "C:\\openclaw-bot" : os === "macos" ? "/Users/you/openclaw-bot" : "/home/you/openclaw-bot");

export function InstallDialog({ open, onOpenChange, defaultOs }: { open: boolean; onOpenChange: (o: boolean) => void; defaultOs: string }) {
  const t = useT();
  const tz = useApp((s) => s.tz);
  const refresh = useRefresh();
  const [os, setOs] = useState(defaultOs);
  const [dir, setDir] = useState(defaultDir(defaultOs));
  useEffect(() => {
    if (open) {
      setOs(defaultOs);
      setDir(defaultDir(defaultOs));
    }
  }, [open, defaultOs]);
  const install = useMutation({
    mutationFn: () => api("/api/install", { body: { os, mode: "native", projectDir: dir.trim(), userTimezone: tz } }),
    onSuccess: async () => {
      onOpenChange(false);
      toast.success(t("Đã bắt đầu cài, theo dõi ở Nhật ký", "Install started, follow it on the Logs page"));
      useApp.getState().go("logs");
      await refresh(["system", "status"]);
    },
    onError: (e: Error) => toast.error(t("Cài không được", "Install failed"), { description: e.message }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Tạo project mới", "Create a project")}</DialogTitle>
          <DialogDescription>{t("Setup tạo thư mục project, cài OpenClaw + 9Router bản đã ghim và bật service.", "Setup creates the project folder, installs the pinned OpenClaw + 9Router and starts the services.")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid grid-cols-1 gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!dir.trim()) return toast.error(t("Chưa có đường dẫn project", "Missing project path"));
            install.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-2">
            <Label>{t("Hệ điều hành", "Operating system")}</Label>
            <ToggleGroup type="single" variant="outline" value={os} onValueChange={(v) => { if (v) { setOs(v); setDir(defaultDir(v)); } }} className="w-full flex-wrap justify-start">
              {OS_OPTIONS.map((o) => (
                <ToggleGroupItem key={o.id} value={o.id} className="flex-1">
                  {o.title}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Label>{t("Chế độ", "Mode")}</Label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-foreground/40 bg-accent px-3 py-2 font-medium">Native</div>
              <div className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-muted-foreground" title={t("Đã ngừng cho project mới", "Retired for new projects")}>
                <Lock className="size-3.5" />
                Docker
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="install-dir">{t("Đường dẫn project", "Project path")}</Label>
            <Input id="install-dir" value={dir} onChange={(e) => setDir(e.target.value)} className="font-mono" />
            <p className="text-xs text-muted-foreground">{t("Đổi tên thư mục cuối thành tên bất kỳ, ví dụ tên công ty.", "Rename the last folder to anything, e.g. your company name.")}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Huỷ", "Cancel")}
            </Button>
            <Button type="submit" disabled={install.isPending}>
              {install.isPending ? t("Đang bắt đầu...", "Starting...") : t("Cài đặt", "Install")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
