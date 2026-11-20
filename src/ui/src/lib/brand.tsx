import { siApple, siDiscord, siDocker, siFacebook, siGithub, siInstagram, siLinux, siMessenger, siNodedotjs, siTelegram, siUbuntu, siZalo } from "simple-icons";
import { cn } from "@/lib/utils";

type Icon = { path: string; hex: string; title: string };

const WINDOWS: Icon = { title: "Windows", hex: "0078D4", path: "M0 3.45 9.75 2.1v9.45H0zm10.95-1.5L24 0v11.4H10.95zM0 12.6h9.75v9.45L0 20.55zm10.95 0H24V24l-13.05-1.8z" };

const ICONS: Record<string, Icon> = {
  telegram: siTelegram,
  zalo: siZalo,
  messenger: siMessenger,
  facebook: siFacebook,
  instagram: siInstagram,
  discord: siDiscord,
  github: siGithub,
  node: siNodedotjs,
  docker: siDocker,
  apple: siApple,
  linux: siLinux,
  ubuntu: siUbuntu,
  windows: WINDOWS,
};

/** Brand logo from simple-icons, bundled (no CDN: customer machines are often offline or on a VPS). */
export function BrandIcon({ name, className, mono = false }: { name: string; className?: string; mono?: boolean }) {
  if (name === "lark") return <img src="/lark.svg" alt="" className={cn("size-4", className)} />;
  const icon = ICONS[name];
  if (!icon) return null;
  const darkBrand = ["000000", "181717"].includes(icon.hex);
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={icon.title} className={cn("size-4 shrink-0", className)} fill={mono || darkBrand ? "currentColor" : `#${icon.hex}`}>
      <path d={icon.path} />
    </svg>
  );
}
