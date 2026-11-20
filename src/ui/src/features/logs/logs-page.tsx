import { Search } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CopyLogsButton, LogPane } from "@/features/common/log-pane";
import { PageHeader } from "@/features/layout/header";
import { useT } from "@/lib/i18n";
import { useApp } from "@/stores/app";

export function LogsPage() {
  const t = useT();
  const [q, setQ] = useState("");
  const count = useApp((s) => s.logs.length);
  return (
    <>
      <PageHeader
        title={t("Nhật ký", "Logs")}
        description={t(`${count} dòng từ lúc mở trang. Cài đặt, cập nhật, đăng nhập Zalo đều ghi ở đây.`, `${count} lines since this page opened. Installs, updates and Zalo logins all log here.`)}
        actions={<CopyLogsButton />}
      />
      <Card className="py-4">
        <CardContent className="grid grid-cols-1 gap-3 px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Lọc theo chữ, ví dụ zalo, error, fb-messenger", "Filter, e.g. zalo, error, fb-messenger")} className="pl-8" />
          </div>
          <LogPane filter={q} className="h-[calc(100svh-15rem)] min-h-80" />
        </CardContent>
      </Card>
    </>
  );
}
