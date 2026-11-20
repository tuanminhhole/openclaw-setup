import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useZaloLogin } from "@/stores/zalo";

export function ZaloLoginDialog() {
  const t = useT();
  const { open, qr, lines, close } = useZaloLogin();
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          api("/api/zalo/login/cancel", { body: {} }).catch(() => {});
          close();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Quét mã QR đăng nhập Zalo", "Scan the Zalo login QR")}</DialogTitle>
          <DialogDescription>{t("Mở Zalo trên điện thoại, chọn biểu tượng QR rồi quét mã bên dưới. Mã hiện sau vài giây.", "Open Zalo on your phone, tap the QR icon and scan the code below. It appears within a few seconds.")}</DialogDescription>
        </DialogHeader>
        <div className="mx-auto flex aspect-square w-64 items-center justify-center overflow-hidden rounded-xl border bg-white p-2">
          {qr ? <img src={qr} alt="Zalo QR" className="size-full object-contain animate-in fade-in-0 zoom-in-95" /> : <Skeleton className="size-full" />}
        </div>
        <pre ref={ref} className="max-h-36 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {lines.filter((l) => l !== "QR").slice(-40).join("\n") || t("Đang khởi động đăng nhập Zalo...", "Starting Zalo login...")}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
