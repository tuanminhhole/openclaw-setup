import { ArrowRight, Inbox, PlugZap, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandIcon } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { useSystem } from "@/lib/queries";
import { isVersionNewer } from "@/lib/utils";
import { useApp } from "@/stores/app";

// The release this dialog announces. Bump it (and the copy) when a later release has its own news;
// anyone whose browser last saw an older release gets the dialog once.
const ANNOUNCE = "5.21.0";
const KEY = "openclaw-seen-release";

const read = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };

export function WhatsNewDialog() {
  const t = useT();
  const sys = useSystem();
  const [open, setOpen] = useState(false);
  const running = sys.data?.versions?.setup || "";

  useEffect(() => {
    // Only once the server runs the announced release (an old server behind a cached page says nothing).
    if (!running || isVersionNewer(ANNOUNCE, running)) return;
    const seen = read();
    if (!seen || isVersionNewer(ANNOUNCE, seen)) setOpen(true);
  }, [running]);

  const close = () => {
    write(running || ANNOUNCE);
    setOpen(false);
  };
  const tryIt = () => {
    close();
    useApp.getState().requestCreateBot("fb-messenger");
  };

  const points = [
    { icon: Inbox, title: t("Một bot trả lời cả Messenger lẫn Instagram", "One bot answers Messenger and Instagram"), desc: t("Tin nhắn vào Fanpage và Instagram Direct của Trang được bot trả lời theo vai và tài liệu bạn nạp.", "Messages to your Page and its Instagram Direct are answered with the role and documents you set.") },
    { icon: PlugZap, title: t("Kết nối trong một phút", "Connected in a minute"), desc: t("Bấm Kết nối Fanpage, đăng nhập Facebook, chọn Trang. Không cần tạo app Meta, không cần tên miền hay HTTPS.", "Click Connect Fanpage, sign in with Facebook, pick the Page. No Meta app, no domain or HTTPS needed.") },
    { icon: ShieldCheck, title: t("Bot không giữ token của Trang", "The bot never holds your Page token"), desc: t("Kết nối đi qua MonkeyTech Connect, ứng dụng đã được Meta duyệt. Ngắt kết nối bất cứ lúc nào.", "The connection runs through MonkeyTech Connect, an app approved by Meta. Disconnect at any time.") },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="relative flex h-36 items-center justify-center gap-5 border-b bg-gradient-to-br from-[#0866FF]/15 via-transparent to-[#FF0069]/15">
          <span className="flex size-16 items-center justify-center rounded-2xl border bg-card shadow-sm">
            <BrandIcon name="messenger" className="size-9" />
          </span>
          <span className="flex size-12 items-center justify-center rounded-2xl border bg-card shadow-sm">
            <BrandIcon name="instagram" className="size-7" />
          </span>
          <Badge className="absolute top-3 left-3 gap-1"><Sparkles className="size-3" />{t("Mới", "New")} · v{ANNOUNCE}</Badge>
        </div>
        <div className="grid grid-cols-1 gap-5 p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl">{t("Ra mắt kênh Fanpage", "Introducing the Fanpage channel")}</DialogTitle>
            <DialogDescription>{t("Bot chăm sóc khách hàng cho Fanpage Facebook, chạy cùng bot Zalo và Telegram bạn đang có.", "A customer-care bot for your Facebook Page, alongside your Zalo and Telegram bots.")}</DialogDescription>
          </DialogHeader>
          <ul className="grid grid-cols-1 gap-4">
            {points.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50"><p.icon className="size-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm">{t("Dùng thử Pro 30 ngày, không cần thanh toán. Sau đó vẫn dùng miễn phí cho 1 Trang, 150 hội thoại mỗi tháng.", "30-day Pro trial, no payment needed. After that you keep a free plan: 1 Page, 150 conversations a month.")}</p>
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{t("Cũng mới trong bản này: giao diện Setup làm lại, nhanh và mượt hơn. Giao diện cũ vẫn mở được trong Tuỳ chỉnh.", "Also new: a rebuilt, faster Setup interface. The classic one is still under Preferences.")}</p>
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="ghost" onClick={close}>{t("Để sau", "Later")}</Button>
          <Button onClick={tryIt}>
            {t("Tạo bot Fanpage", "Create a Fanpage bot")}
            <ArrowRight />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
