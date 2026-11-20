import { useEffect, useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { useDialogs } from "@/stores/dialogs";

export function GlobalDialogs() {
  const t = useT();
  const { confirm, prompt, closeConfirm, closePrompt } = useDialogs();
  const [values, setValues] = useState<string[]>([]);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (prompt) setValues(prompt.fields.map((f) => f.value || ""));
  }, [prompt]);

  return (
    <>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && closeConfirm(false)}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirm?.icon}
              {confirm?.title}
            </AlertDialogTitle>
            {confirm?.description ? <AlertDialogDescription>{confirm.description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          {confirm?.body ? <div className="text-sm">{confirm.body}</div> : null}
          <AlertDialogFooter>
            {!confirm?.hideCancel && <AlertDialogCancel>{confirm?.cancelText || t("Huỷ", "Cancel")}</AlertDialogCancel>}
            <AlertDialogAction variant={confirm?.danger ? "destructive" : "default"} onClick={() => closeConfirm(true)}>
              {confirm?.okText || t("Đồng ý", "OK")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!prompt} onOpenChange={(o) => !o && closePrompt(null)}>
        <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => { e.preventDefault(); first.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>{prompt?.title}</DialogTitle>
            {prompt?.description ? <DialogDescription>{prompt.description}</DialogDescription> : null}
          </DialogHeader>
          <form
            className="grid grid-cols-1 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!values[0]?.trim()) return;
              closePrompt(values.map((v) => v.trim()));
            }}
          >
            {prompt?.fields.map((f, i) => (
              <div key={i} className="grid grid-cols-1 gap-2">
                {f.label ? <Label htmlFor={`prompt-${i}`}>{f.label}</Label> : null}
                <Input id={`prompt-${i}`} ref={i === 0 ? first : undefined} placeholder={f.placeholder} value={values[i] ?? ""} onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))} />
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => closePrompt(null)}>
                {t("Huỷ", "Cancel")}
              </Button>
              <Button type="submit">{prompt?.okText || t("Xác nhận", "Confirm")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
