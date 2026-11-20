import { Bot, LayoutDashboard, type LucideIcon, ScrollText, Settings2, Wrench } from "lucide-react";
import type { Route } from "@/stores/app";

export type NavItem = { id: Route; vi: string; en: string; icon: LucideIcon; descVi: string; descEn: string };

export const NAV_GROUPS: { vi: string; en: string; items: NavItem[] }[] = [
  {
    vi: "Vận hành",
    en: "Operate",
    items: [
      { id: "dashboard", vi: "Tổng quan", en: "Overview", icon: LayoutDashboard, descVi: "Trạng thái runtime, phiên bản và nhật ký trực tiếp.", descEn: "Runtime status, versions and live logs." },
      { id: "bot", vi: "Bot", en: "Bots", icon: Bot, descVi: "Tạo, sửa bot theo kênh; kỹ năng, plugin và tệp workspace.", descEn: "Create and edit bots per channel; skills, plugins and workspace files." },
    ],
  },
  {
    vi: "Hệ thống",
    en: "System",
    items: [
      { id: "setup", vi: "Cài đặt", en: "Install", icon: Wrench, descVi: "Cài OpenClaw, kết nối hoặc chuyển project.", descEn: "Install OpenClaw, connect or move projects." },
      { id: "logs", vi: "Nhật ký", en: "Logs", icon: ScrollText, descVi: "Toàn bộ nhật ký cài đặt và vận hành.", descEn: "Full install and runtime log." },
      { id: "settings", vi: "Tuỳ chỉnh", en: "Preferences", icon: Settings2, descVi: "Giao diện, ngôn ngữ và múi giờ.", descEn: "Appearance, language and timezone." },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
