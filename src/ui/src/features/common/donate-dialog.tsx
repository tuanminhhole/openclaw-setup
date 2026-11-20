import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";

export function DonateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Ủng hộ OpenClaw Setup", "Support OpenClaw Setup")}</DialogTitle>
          <DialogDescription>{t("Đóng góp của bạn giúp duy trì hạ tầng, sửa lỗi và cải tiến công cụ mỗi ngày.", "Your support keeps the infrastructure running, fixes bugs and improves the tool.")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {[["/bvvbank.jpg", "BVBank"], ["/momo.jpg", "Momo"]].map(([src, name]) => (
            <figure key={name} className="overflow-hidden rounded-lg border bg-white">
              <img src={src} alt={name} className="aspect-square w-full object-cover" />
              <figcaption className="border-t bg-card py-2 text-center text-sm font-medium">{name}</figcaption>
            </figure>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
