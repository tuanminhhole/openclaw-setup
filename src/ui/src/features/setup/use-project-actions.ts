import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type BotStatus } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useRefresh } from "@/lib/queries";
import { baseName } from "@/lib/utils";
import { useApp } from "@/stores/app";
import { confirmDialog, promptDialog } from "@/stores/dialogs";

/** Switch the UI (and the server's active project) to another project folder. */
export function useConnectProject() {
  const t = useT();
  const qc = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (projectDir: string) => api<BotStatus>("/api/project/connect", { body: { projectDir } }),
    onSuccess: async (result) => {
      useApp.getState().setProjectDir(result.projectDir || "");
      // The connect response already carries the bots: show them now, refresh the rest behind.
      qc.setQueryData(["status", result.projectDir], (prev: BotStatus | undefined) => ({ ...(prev || { bots: [] }), ...result }));
      toast.success(t("Đã kết nối project", "Project connected"), { description: baseName(result.projectDir || "") });
      await refresh();
    },
    onError: (err: Error) => toast.error(t("Lỗi kết nối", "Connection error"), { description: err.message }),
  });
}

export function useDeleteProject() {
  const t = useT();
  const refresh = useRefresh();
  return async (projectDir: string) => {
    const ok = await confirmDialog({
      title: t(`Xoá project "${baseName(projectDir)}"?`, `Delete project "${baseName(projectDir)}"?`),
      description: t("Thao tác này xoá hẳn thư mục project trên ổ đĩa. Không thể hoàn tác.", "This permanently deletes the project folder from disk. It cannot be undone."),
      okText: t("Xoá project", "Delete project"),
      danger: true,
    });
    if (!ok) return;
    const id = toast.loading(t("Đang xoá project...", "Deleting project..."));
    try {
      await api("/api/project/delete", { body: { projectDir } });
      if (useApp.getState().projectDir === projectDir) useApp.getState().setProjectDir("");
      toast.success(t("Đã xoá project", "Project deleted"), { id, description: baseName(projectDir) });
      await refresh();
    } catch (err) {
      toast.error(t("Lỗi khi xoá", "Delete error"), { id, description: (err as Error).message });
    }
  };
}

/** Native folder picker on the server's desktop; falls back to typing the path. */
export function usePickFolder() {
  const t = useT();
  const connect = useConnectProject();
  return async () => {
    let projectDir = "";
    try {
      const picked = await api<{ projectDir?: string }>("/api/project/pick-folder", { body: {} });
      projectDir = String(picked.projectDir || "").trim();
    } catch {
      const v = await promptDialog({
        title: t("Nhập đường dẫn project", "Enter project path"),
        description: t("Đường dẫn tuyệt đối tới thư mục project, ví dụ /home/ban/openclaw-bot hoặc C:\\openclaw-bot.", "Absolute path to the project folder, e.g. /home/you/openclaw-bot or C:\\openclaw-bot."),
        fields: [{ placeholder: "/home/you/openclaw-bot" }],
      });
      projectDir = v?.[0] || "";
    }
    if (!projectDir) return;
    connect.mutate(projectDir);
  };
}
