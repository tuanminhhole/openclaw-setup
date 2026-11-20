import { Check, Copy } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useApp } from "@/stores/app";

/** Terminal-style log view. Sticks to the bottom only while the reader is already at the bottom. */
export function LogPane({ tail = 0, className, filter = "" }: { tail?: number; className?: string; filter?: string }) {
  const t = useT();
  const logs = useApp((s) => s.logs);
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  let lines = tail ? logs.slice(-tail) : logs;
  if (filter) {
    const f = filter.toLowerCase();
    lines = lines.filter((l) => l.toLowerCase().includes(f));
  }
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
      }}
      className={cn("log-pane overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[12px] leading-relaxed text-muted-foreground dark:bg-black/30", className)}
    >
      {lines.length ? lines.map((l, i) => <p key={i}>{l}</p>) : <p className="italic">{t("Chưa có nhật ký.", "No log lines yet.")}</p>}
    </div>
  );
}

export function CopyLogsButton({ size = "sm" }: { size?: "sm" | "icon" }) {
  const t = useT();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 1200);
    return () => clearTimeout(id);
  }, [done]);
  const copy = async () => {
    const text = useApp.getState().logs.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
    } catch {
      toast.error(t("Không copy được (cần https hoặc localhost)", "Copy failed (needs https or localhost)"));
    }
  };
  return (
    <Button variant="outline" size={size === "icon" ? "icon" : "sm"} onClick={copy} aria-label="Copy logs" className="gap-1.5">
      {done ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      {size === "icon" ? null : t("Copy log", "Copy log")}
    </Button>
  );
}
