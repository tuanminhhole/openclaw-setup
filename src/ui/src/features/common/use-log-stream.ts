import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { cleanTerminalLine } from "@/lib/utils";
import { useApp } from "@/stores/app";
import { useZaloLogin } from "@/stores/zalo";

/**
 * One EventSource for the whole app (/api/install/logs). Lines go to the log store; the Zalo QR,
 * login events and the self-update restart are picked out here, as the legacy appendLogLine did.
 */
export function useLogStream() {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource("/api/install/logs");
    let healthTimer: ReturnType<typeof setTimeout> | null = null;
    es.onmessage = (e) => {
      let line = "";
      try {
        line = String(JSON.parse(e.data).line ?? "");
      } catch {
        return;
      }
      const qr = line.match(/^\[zalo-connect:qr\]\s+(data:image\/[a-zA-Z0-9.+-]+;base64,\S+)/);
      if (qr) {
        useZaloLogin.getState().setQr(qr[1]);
        return;
      }
      useApp.getState().pushLog(line);
      const z = useZaloLogin.getState();
      if (z.open || /\[zalo-connect\]/i.test(line)) z.push(cleanTerminalLine(line));
      if (/\[zalo-connect\].*(login saved|listener (connected|start failed)|restarted|login failed|logged out)/i.test(line) && !healthTimer) {
        healthTimer = setTimeout(() => {
          healthTimer = null;
          qc.invalidateQueries({ queryKey: ["zalo-health"] });
        }, 1500);
      }
      if (line.includes("Setup Wizard updated successfully")) waitForRestart();
    };
    return () => es.close();
  }, [qc]);
}

function waitForRestart() {
  const lang = useApp.getState().lang;
  const t = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const id = toast.loading(t("Đang khởi động lại Setup UI để áp dụng bản mới...", "Restarting Setup UI to apply the new version..."));
  let attempts = 0;
  const iv = setInterval(async () => {
    attempts++;
    try {
      const res = await fetch("/api/system");
      if (res.ok) {
        clearInterval(iv);
        toast.success(t("Đã cập nhật Setup UI", "Setup UI updated"), { id });
        setTimeout(() => location.reload(), 1200);
      }
    } catch {
      if (attempts > 75) {
        clearInterval(iv);
        toast.error(t("Không kết nối lại được Setup UI. Chạy lại lệnh khởi động.", "Cannot reconnect to Setup UI. Run the start command again."), { id });
      }
    }
  }, 2000);
}
