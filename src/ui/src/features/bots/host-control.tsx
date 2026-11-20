import { CheckCircle2, Keyboard, MonitorUp, MousePointerClick, AppWindow, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useProjectDir, useSystem } from "@/lib/queries";
import { confirmDialog } from "@/stores/dialogs";

type ControlState = { enabled?: boolean; native?: boolean; started?: { ok?: boolean; reason?: string }; computerUse?: { ok?: boolean; enabled?: boolean; error?: string } };

/** "Điều khiển máy": confirm what is granted, toggle it, then show the OS permission steps. */
export function useHostControl() {
  const t = useT();
  const projectDir = useProjectDir();
  const sys = useSystem();
  const isMac = /mac|darwin/i.test(sys.data?.os || sys.data?.platform || "");

  const permission = async (kind: "screen" | "accessibility") => {
    try {
      const r = await api<{ opened?: boolean; screen?: { supported?: boolean; granted?: boolean } }>("/api/host/permissions", { body: { kind, projectDir } });
      if (!r.opened) return toast.error(t("Không mở được", "Could not open"), { description: t("Hệ điều hành này không có bảng cài đặt đó, hãy cấp quyền thủ công.", "This OS has no such settings pane, grant it manually.") });
      const granted = r.screen?.supported ? r.screen.granted : null;
      if (granted === false) toast.error(t("Chưa có quyền", "Not granted yet"), { description: t('Bật cho "node" trong danh sách vừa mở, rồi khởi động lại bot.', 'Tick "node" in the list that just opened, then restart the bot.'), duration: 8000 });
      else toast.success(t("Đã mở cài đặt quyền", "Opened settings"), { description: granted ? t("Quyền quay màn hình đã có. Bật thêm Accessibility nếu cần gõ và bấm.", "Screen recording is granted. Also enable Accessibility for typing and clicking.") : t('Bật quyền cho "node" trong danh sách vừa mở.', 'Tick "node" in the list that just opened.'), duration: 8000 });
    } catch (err) {
      toast.error(t("Thất bại", "Failed"), { description: (err as Error).message });
    }
  };

  const showResult = (r: ControlState) => {
    const cu = r.computerUse || {};
    const ok = !!(cu.ok && cu.enabled);
    confirmDialog({
      title: ok ? t("Đã bật điều khiển máy", "Computer control is on") : t("Bật chưa xong", "Not fully enabled"),
      description: t("Model chính của bot vẫn là smart-route, không đổi.", "Your bot keeps smart-route as its primary model."),
      body: (
        <div className="grid grid-cols-1 gap-3 text-sm">
          <ul className="grid grid-cols-1 gap-2">
            {ok ? (
              <>
                <Row icon={<CheckCircle2 className="text-success" />} text={t("Bot nhìn và điều khiển được máy này: chụp màn hình, rê chuột, bấm, gõ phím, kéo thả.", "The bot can see and drive this machine: screenshot, move, click, type, drag.")} />
                <Row icon={<CheckCircle2 className="text-success" />} text={t("Mở được mọi ứng dụng đang cài trên máy.", "It can open any installed app.")} />
              </>
            ) : (
              <Row icon={<TriangleAlert className="text-warning" />} text={t(`Chưa bật được: ${cu.error || "không rõ lý do"}`, `Could not enable: ${cu.error || "unknown reason"}`)} />
            )}
          </ul>
          {isMac && (
            <div className="grid grid-cols-1 gap-2 rounded-lg border p-3">
              <p className="font-medium">{t("Cấp quyền màn hình cho máy", "Grant the OS screen permissions")}</p>
              <p className="text-muted-foreground">{t("macOS chỉ cấp Screen Recording và Accessibility trong System Settings. Bấm nút dưới rồi bật cho node.", "macOS grants Screen Recording and Accessibility only in System Settings. Click below, then tick node.")}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => permission("screen")}>{t("Quay màn hình", "Screen recording")}</Button>
                <Button size="sm" variant="outline" onClick={() => permission("accessibility")}>{t("Accessibility (chuột, bàn phím)", "Accessibility (mouse, keys)")}</Button>
              </div>
            </div>
          )}
          <p className="text-muted-foreground">{t("Cách dùng: nhắn bot bình thường, ví dụ “chụp màn hình cho anh xem”. Chỉ dùng được trên máy có màn hình. Sau khi khởi động lại máy, bấm “1 - KHOI DONG BOT” là phần này tự bật lại.", "How to use it: just ask the bot, e.g. “take a screenshot”. Only works on a machine with a screen. After a reboot, “1 - KHOI DONG BOT” brings it back up.")}</p>
        </div>
      ),
      okText: t("Đóng", "Close"),
      hideCancel: true,
    });
  };

  return async () => {
    let cur: ControlState;
    try {
      cur = await api<ControlState>(`/api/host/control?projectDir=${encodeURIComponent(projectDir)}`);
    } catch (err) {
      toast.error(t("Thất bại", "Failed"), { description: (err as Error).message });
      return;
    }
    const on = !!cur.enabled;
    const ok = await confirmDialog({
      title: on ? t("Tắt điều khiển máy?", "Turn off PC control?") : t("Bật điều khiển máy?", "Turn on PC control?"),
      description: on ? t("Bot sẽ không còn mở được Chrome hay ứng dụng trên máy này.", "The bot will no longer open Chrome or apps on this machine.") : t("Bạn sắp cho bot những quyền sau trên MÁY NÀY:", "You are about to grant the bot the following on THIS machine:"),
      body: on ? undefined : (
        <div className="grid grid-cols-1 gap-3 text-sm">
          {cur.native && (
            <ul className="grid grid-cols-1 gap-2">
              <Row icon={<MonitorUp />} text={t("Nhìn màn hình: chụp màn hình khi bạn nhờ", "See the screen: screenshots when you ask")} />
              <Row icon={<MousePointerClick />} text={t("Điều khiển chuột và bàn phím trên máy này", "Mouse and keyboard control on this machine")} />
              <Row icon={<AppWindow />} text={t("Mở mọi ứng dụng đang cài, như người ngồi trước máy", "Open any installed app, like a person at the keyboard")} />
            </ul>
          )}
          <p className="flex items-center gap-2 text-muted-foreground"><Keyboard className="size-4" />{t("Chỉ dùng trên máy có màn hình, không áp dụng VPS.", "Desktop only, not a headless VPS.")}</p>
        </div>
      ),
      okText: on ? t("Tắt", "Turn off") : t("Bật", "Turn on"),
      danger: on,
    });
    if (!ok) return;
    const id = toast.loading(on ? t("Đang tắt...", "Turning off...") : t("Đang cấp quyền và khởi động node điều khiển (khoảng 30 giây)...", "Granting access and starting the control node (about 30 s)..."));
    try {
      const r = await api<ControlState>("/api/host/control", { body: { enabled: !on, projectDir } });
      if (!on && r.started && r.started.ok === false && r.started.reason) toast.warning(t("Đã bật, lưu ý", "Enabled, note"), { id, description: t("Không khởi động được service: ", "Service did not start: ") + r.started.reason });
      else toast.success(r.enabled ? t("Đã bật điều khiển máy", "PC control on") : t("Đã tắt", "Turned off"), { id });
      if (r.enabled && r.native) showResult(r);
    } catch (err) {
      toast.error(t("Thất bại", "Failed"), { id, description: (err as Error).message });
    }
  };
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-2.5 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
      {icon}
      <span>{text}</span>
    </li>
  );
}
