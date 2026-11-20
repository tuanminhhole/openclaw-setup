import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function baseName(p = "") {
  const clean = String(p).replace(/[\\/]+$/, "");
  return clean.split(/[\\/]/).pop() || p;
}

/** true when `a` is a strictly newer dotted version than `b`. */
export function isVersionNewer(a?: string, b?: string) {
  if (!a || !b) return false;
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/**
 * A URL on the SAME host the dashboard is viewed from, so "Open" works through a localhost tunnel,
 * the server IP or a domain, and never points at the viewer's own localhost from another machine.
 */
export function sameHostUrl(rawUrl: string | undefined, fallbackPort: number) {
  let port = String(fallbackPort);
  try {
    const u = new URL(rawUrl || "");
    if (u.port) port = u.port;
  } catch {}
  const proto = location.protocol === "https:" ? "https:" : "http:";
  return `${proto}//${location.hostname || "127.0.0.1"}:${port}`;
}

export function portOf(raw: string | undefined, def: number) {
  try {
    return Number(new URL(raw || "").port) || def;
  } catch {
    return def;
  }
}

export function cleanTerminalLine(s = "") {
  return String(s).replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").replace(/\r/g, "");
}
