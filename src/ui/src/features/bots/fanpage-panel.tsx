import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Inbox, Lock, MessageSquareReply, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api, type Bot } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useFbHealth, useProjectDir } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { fbPlan, toneClass } from "./health";

/** Tab "Fanpage": goi tren MonkeyTech Connect, han muc thang, hop thu, tra loi binh luan. */
export function FanpagePanel({ bot }: { bot: Bot }) {
  const t = useT();
  const projectDir = useProjectDir();
  const fb = useFbHealth(true);
  const qc = useQueryClient();
  const info = fbPlan(bot, fb.data, t);
  const [busy, setBusy] = useState("");

  if (fb.isLoading) return <Skeleton className="h-48" />;
  if (bot.transport === "webhook") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fanpage</CardTitle>
          <CardDescription>{t("Bot này dùng app Meta riêng (webhook), không đi qua MonkeyTech Connect nên không có gói, hộp thư và trả lời bình luận.", "This bot uses its own Meta app (webhook), outside MonkeyTech Connect: no plan, inbox or comment replies.")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (!info) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fanpage</CardTitle>
          <CardDescription>{fb.data?.error ? t(`MonkeyTech Connect chưa trả lời: ${fb.data.error}`, `MonkeyTech Connect did not answer: ${fb.data.error}`) : t("Chưa có thông tin gói. Kết nối Fanpage trong Sửa bot, hoặc Connect đang chạy bản cũ.", "No plan info yet. Connect the Page under Edit bot, or Connect runs an older version.")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const { plan, page } = info;
  const paid = plan.plan !== "free";
  const settings = page?.settings || { commentReply: true, privateReply: false, handoverHours: 4 };

  const save = async (patch: Record<string, unknown>, key: string) => {
    setBusy(key);
    try {
      await api("/api/fb/settings", { body: { projectDir, pageId: bot.pageId, ...patch } });
      await qc.invalidateQueries({ queryKey: ["fb-health"] });
      toast.success(t("Đã lưu cài đặt Fanpage", "Fanpage settings saved"));
    } catch (err) {
      toast.error(t("Lưu thất bại", "Save failed"), { description: (err as Error).message });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {info.name}
            <Badge variant="outline" className={cn("font-normal", toneClass[info.tone])}>{info.short}</Badge>
          </CardTitle>
          <CardDescription>
            {plan.plan === "trial"
              ? t(`Toàn bộ tính năng Pro trong ${info.daysLeft} ngày nữa. Hết dùng thử bạn vẫn dùng miễn phí, bot không bị tắt.`, `All Pro features for ${info.daysLeft} more days. After that you keep a free plan; the bot is never switched off.`)
              : plan.plan === "free"
                ? t(`Bot trả lời tối đa ${plan.quota} hội thoại mỗi tháng. Vượt mức, tin vẫn vào hộp thư để bạn trả lời tay.`, `The bot answers up to ${plan.quota} conversations a month. Beyond that, messages still reach the inbox.`)
                : t(`Không giới hạn hội thoại. Hết hạn ${String(plan.expiresAt || "").slice(0, 10)}.`, `Unlimited conversations. Expires ${String(plan.expiresAt || "").slice(0, 10)}.`)}
          </CardDescription>
          <CardAction className="flex flex-wrap gap-2">
            {info.inboxUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={info.inboxUrl} target="_blank" rel="noopener"><Inbox />{t("Hộp thư", "Inbox")}</a>
              </Button>
            )}
            {info.billingUrl && (
              <Button size="sm" variant={paid ? "outline" : "default"} asChild>
                <a href={info.billingUrl} target="_blank" rel="noopener">{paid ? <ExternalLink /> : <Sparkles />}{paid ? t("Gói và thanh toán", "Plan and billing") : t("Nâng cấp Pro", "Upgrade to Pro")}</a>
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{t("Hội thoại bot trả lời tháng này", "Conversations answered this month")}</span>
            <span className="font-semibold tabular-nums">{plan.used}{plan.quota !== null ? <span className="font-normal text-muted-foreground">/{plan.quota}</span> : null}</span>
          </div>
          {plan.quota !== null && <Progress value={Math.min(100, (plan.used / plan.quota) * 100)} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquareReply className="size-4" />{t("Bình luận trên Fanpage", "Comments on the Page")}</CardTitle>
          <CardDescription>{t("Bot trả lời bình luận mới trên bài viết của Trang. Câu trả lời công khai ngắn gọn, mời khách nhắn tin khi cần tư vấn chi tiết.", "The bot answers new comments on the Page's posts: short public replies that invite the customer to message for details.")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3">
          <Row
            title={t("Tự động trả lời bình luận", "Auto-reply to comments")}
            locked={!paid}
            checked={paid && settings.commentReply}
            busy={busy === "c"}
            onChange={(v) => save({ commentReply: v }, "c")}
            t={t}
          />
          <Row
            title={t("Nhắn riêng cho người bình luận", "Message the commenter privately")}
            desc={t("Bot gửi câu trả lời qua Messenger, dưới bình luận chỉ để một dòng \"shop đã nhắn riêng\".", "The bot answers in Messenger and leaves a short \"we messaged you\" under the comment.")}
            locked={!paid}
            checked={paid && settings.privateReply}
            busy={busy === "p"}
            onChange={(v) => save({ privateReply: v }, "p")}
            t={t}
          />
          {!plan.commentsLive && (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs">{t("Quyền trả lời bình luận và đăng bài đang chờ Meta duyệt. Trong lúc chờ, chỉ tài khoản quản trị của app Meta dùng được hai tính năng này.", "Comment and publishing permissions are pending Meta review. Until then only accounts with a role on the Meta app can use them.")}</p>
          )}
          <p className="text-xs text-muted-foreground">{t("Nhân viên trả lời tay (trong hộp thư Connect hoặc Inbox Facebook) thì bot tự im với khách đó vài giờ để không chen ngang.", "When staff reply by hand (Connect inbox or Facebook Inbox), the bot stays quiet with that customer for a few hours.")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ title, desc, locked, checked, busy, onChange, t }: { title: string; desc?: string; locked: boolean; checked: boolean; busy: boolean; onChange: (v: boolean) => void; t: (vi: string, en: string) => string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          {title}
          {locked && <Badge variant="outline" className="gap-1 text-[11px]"><Lock className="size-3" />Pro</Badge>}
        </p>
        {desc && <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>}
      </div>
      <Switch checked={checked} disabled={locked || busy} onCheckedChange={onChange} aria-label={title} title={locked ? t("Tính năng gói Pro", "Pro feature") : undefined} />
    </div>
  );
}
