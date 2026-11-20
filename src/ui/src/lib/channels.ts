export type ChannelDef = { id: string; title: string; subtitle: string; icon: string; comingSoon?: boolean };

export const CHANNELS: ChannelDef[] = [
  { id: "telegram", title: "Telegram", subtitle: "Bot API", icon: "telegram" },
  { id: "zalo-personal", title: "Zalo cá nhân", subtitle: "OpenClaw Zalo Connect", icon: "zalo" },
  { id: "zalo-bot", title: "Zalo Bot API", subtitle: "bot.zaloplatforms.com", icon: "zalo" },
  { id: "fb-messenger", title: "Fanpage", subtitle: "Messenger + Instagram", icon: "messenger" },
  { id: "discord", title: "Discord", subtitle: "Bot", icon: "discord", comingSoon: true },
  { id: "lark", title: "Lark", subtitle: "Lark / Feishu", icon: "lark", comingSoon: true },
];

export const channelById = (id?: string) => CHANNELS.find((c) => c.id === id);

export const OS_OPTIONS = [
  { id: "win", title: "Windows", vi: "Máy bàn tự nhận diện", en: "Auto-detected desktop", icon: "windows" },
  { id: "macos", title: "macOS", vi: "Apple Silicon / Intel", en: "Apple Silicon / Intel", icon: "apple" },
  { id: "linux-desktop", title: "Linux Desktop", vi: "Ubuntu / Debian / Fedora", en: "Ubuntu / Debian / Fedora", icon: "linux" },
  { id: "vps", title: "Linux VPS", vi: "Cài server, mở UI qua SSH", en: "Server install, UI over SSH", icon: "ubuntu" },
];

// Native is the only mode for new projects. Docker stays visible but retired: OpenClaw 2026.9 cannot
// write its config through a Docker Desktop bind mount on Windows (win_kha, 09/09/2026).
export const MODE_OPTIONS = [
  { id: "native", title: "Native", vi: "Chạy thẳng trên máy, điều khiển được ứng dụng", en: "Runs on this machine, can drive apps", icon: "node", badge: "Recommended" },
  { id: "docker", title: "Docker", vi: "Đã ngừng cho project mới, project cũ vẫn chạy", en: "Retired for new projects, existing ones keep running", icon: "docker", badge: "Retired", retired: true },
];

export const TZ_OPTIONS: [string, string][] = [
  ["Asia/Ho_Chi_Minh", "Việt Nam (UTC+7)"],
  ["Asia/Bangkok", "Bangkok (UTC+7)"],
  ["Asia/Jakarta", "Jakarta (UTC+7)"],
  ["Asia/Singapore", "Singapore (UTC+8)"],
  ["Asia/Kuala_Lumpur", "Kuala Lumpur (UTC+8)"],
  ["Asia/Manila", "Manila (UTC+8)"],
  ["Asia/Shanghai", "Trung Quốc (UTC+8)"],
  ["Asia/Tokyo", "Tokyo (UTC+9)"],
  ["Asia/Seoul", "Seoul (UTC+9)"],
  ["Asia/Kolkata", "Ấn Độ (UTC+5:30)"],
  ["Asia/Dubai", "Dubai (UTC+4)"],
  ["Australia/Sydney", "Sydney (UTC+10/+11)"],
  ["Europe/London", "London (UTC+0/+1)"],
  ["Europe/Paris", "Paris (UTC+1/+2)"],
  ["America/New_York", "New York (UTC-5/-4)"],
  ["America/Los_Angeles", "Los Angeles (UTC-8/-7)"],
  ["UTC", "UTC"],
];
