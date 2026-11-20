import { BadgeHelp, Calculator, CalendarCheck, Headphones, Megaphone, PencilLine, ShoppingBag, Sparkles, Wrench } from "lucide-react";

const ICONS: Record<string, typeof Sparkles> = {
  "tro-ly": Sparkles,
  cskh: Headphones,
  "ban-hang": ShoppingBag,
  "le-tan": CalendarCheck,
  "ke-toan": Calculator,
  marketing: Megaphone,
  it: Wrench,
  "tuy-chinh": PencilLine,
};

export function RoleIcon({ id, fallback }: { id: string; fallback?: string }) {
  const I = ICONS[id];
  if (I) return <I className="size-4.5" />;
  return fallback ? <span aria-hidden>{fallback}</span> : <BadgeHelp className="size-4.5" />;
}
