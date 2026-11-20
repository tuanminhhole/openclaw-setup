import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/features/layout/header";
import { TZ_OPTIONS } from "@/lib/channels";
import { useT } from "@/lib/i18n";
import { useApp } from "@/stores/app";

export function SettingsPage() {
  const t = useT();
  const { theme, setTheme, lang, setLang, tz, setTz } = useApp();
  const tzOptions = TZ_OPTIONS.some(([id]) => id === tz) ? TZ_OPTIONS : [[tz, tz] as [string, string], ...TZ_OPTIONS];
  const Row = ({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Label className="text-sm font-medium">{title}</Label>
        <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
  return (
    <>
      <PageHeader title={t("Tuỳ chỉnh", "Preferences")} description={t("Giao diện, ngôn ngữ và múi giờ. Múi giờ áp cho bot tạo mới để lịch và cron chạy đúng giờ địa phương.", "Appearance, language and timezone. The timezone applies to new bots so schedules run in local time.")} />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{t("Giao diện", "Interface")}</CardTitle>
          <CardDescription>{t("Lưu trên trình duyệt này.", "Saved in this browser.")}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <Row title={t("Giao diện tối", "Dark mode")} desc={t("Nền tối dễ nhìn khi làm việc lâu.", "Easier on the eyes for long sessions.")}>
            <Switch checked={theme === "dark"} onCheckedChange={(c) => setTheme(c ? "dark" : "light")} />
          </Row>
          <Row title={t("Ngôn ngữ", "Language")} desc={t("Ngôn ngữ hiển thị của Setup UI.", "Display language of the Setup UI.")}>
            <ToggleGroup type="single" variant="outline" value={lang} onValueChange={(v) => v && setLang(v as "vi" | "en")}>
              <ToggleGroupItem value="vi">Tiếng Việt</ToggleGroupItem>
              <ToggleGroupItem value="en">English</ToggleGroupItem>
            </ToggleGroup>
          </Row>
          <Row title={t("Múi giờ", "Timezone")} desc={t("Áp dụng cho bot tạo mới.", "Applied to newly created bots.")}>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tzOptions.map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row title={t("Giao diện cũ", "Classic UI")} desc={t("Bản giao diện trước 5.21, giữ lại trong thời gian chuyển đổi.", "The pre-5.21 interface, kept during the transition.")}>
            <Button variant="outline" size="sm" asChild>
              <a href="/legacy/">{t("Mở giao diện cũ", "Open classic UI")}</a>
            </Button>
          </Row>
        </CardContent>
      </Card>
    </>
  );
}
