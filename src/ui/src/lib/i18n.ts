import { useApp } from "@/stores/app";

/** `t('Tiếng Việt', 'English')`: the strings live next to the markup, like the legacy UI. */
export function useT() {
  const lang = useApp((s) => s.lang);
  return (vi: string, en: string) => (lang === "vi" ? vi : en);
}

export function pick(obj: Record<string, string> | string | undefined, lang: string) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[lang] || obj.vi || obj.en || "";
}
