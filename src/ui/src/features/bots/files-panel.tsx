import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FileText, Folder, FolderOpen, Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, type Bot, type WorkspaceFile } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useFiles, useProjectDir } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Node = { name: string; path: string; dir: boolean; item?: WorkspaceFile; children: Node[] };

function buildTree(items: WorkspaceFile[]): Node[] {
  const roots: Node[] = [];
  const byPath = new Map<string, Node>();
  for (const item of items) {
    const parts = String(item.name || "").split("/").filter(Boolean);
    let prefix = "";
    let siblings = roots;
    parts.forEach((part, idx) => {
      prefix = prefix ? `${prefix}/${part}` : part;
      let node = byPath.get(prefix);
      const last = idx === parts.length - 1;
      if (!node) {
        node = { name: part, path: prefix, dir: last ? item.type === "dir" : true, item: last ? item : undefined, children: [] };
        byPath.set(prefix, node);
        siblings.push(node);
      }
      siblings = node.children;
    });
  }
  return roots;
}

function joinPath(root = "", child = "") {
  const r = root.replace(/[\\/]+$/, "");
  const c = child.replace(/^[\\/]+/, "");
  if (!r) return c || "-";
  if (!c) return r;
  return /^[A-Za-z]:/.test(r) || r.includes("\\") ? `${r}\\${c.replace(/\//g, "\\")}` : `${r}/${c.replace(/\\/g, "/")}`;
}

export function FilesPanel({ bot }: { bot: Bot }) {
  const t = useT();
  const projectDir = useProjectDir();
  const files = useFiles(bot.id);
  const qc = useQueryClient();
  const list = files.data?.files || [];
  const editable = useMemo(() => list.filter((f) => f.type !== "dir" && f.editable !== false), [list]);
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDrafts({});
    setSelected("");
  }, [bot.id]);
  const current = editable.find((f) => f.name === selected) || editable[0];
  const tree = useMemo(() => buildTree(list), [list]);
  const value = current ? drafts[current.name] ?? current.content ?? "" : "";
  const dirty = !!current && drafts[current.name] !== undefined && drafts[current.name] !== (current.content ?? "");

  const save = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await api(`/api/bot/files/${encodeURIComponent(current.name)}`, { method: "PUT", body: { projectDir, content: value } });
      qc.setQueryData(["files", projectDir, bot.id], (old: any) => (old ? { ...old, files: old.files.map((f: WorkspaceFile) => (f.name === current.name ? { ...f, content: value } : f)) } : old));
      setDrafts((d) => {
        const n = { ...d };
        delete n[current.name];
        return n;
      });
      toast.success(t("Đã lưu", "Saved"), { description: current.name.split("/").pop() });
    } catch (err) {
      toast.error(t("Lưu thất bại", "Save failed"), { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const workspace = String(bot.workspace || "").replace(/^\/home\/node\/project\/?/, "");
  const rel = current ? current.name.replace(/^\.openclaw[\\/][^\\/]+[\\/]?/, "") : "";
  const fullPath = workspace ? joinPath(projectDir, rel ? `${workspace}/${rel}` : workspace) : projectDir;

  const renderNode = (n: Node, depth: number): React.ReactNode => {
    const pad = { paddingLeft: 8 + depth * 14 };
    if (n.dir) {
      const isOpen = open[n.path] ?? depth < 2;
      return (
        <div key={n.path}>
          <button type="button" style={pad} className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm text-muted-foreground hover:bg-muted" onClick={() => setOpen((o) => ({ ...o, [n.path]: !isOpen }))}>
            <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", isOpen && "rotate-90")} />
            {isOpen ? <FolderOpen className="size-4 shrink-0" /> : <Folder className="size-4 shrink-0" />}
            <span className="truncate font-medium">{n.name}</span>
          </button>
          {isOpen && n.children.map((c) => renderNode(c, depth + 1))}
        </div>
      );
    }
    const canEdit = n.item?.editable !== false;
    const active = current?.name === n.path;
    return (
      <button
        key={n.path}
        type="button"
        disabled={!canEdit}
        title={n.path}
        style={{ paddingLeft: 8 + depth * 14 + 18 }}
        onClick={() => setSelected(n.path)}
        className={cn("flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-40", active && "bg-muted font-medium text-foreground")}
      >
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{n.name}</span>
        {drafts[n.path] !== undefined && drafts[n.path] !== (n.item?.content ?? "") && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-warning" />}
      </button>
    );
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{t("Cây thư mục bot", "Bot file tree")}</CardTitle>
        <CardDescription className="truncate font-mono text-xs" title={fullPath}>{fullPath || "-"}</CardDescription>
        <CardAction>
          <Button size="sm" onClick={save} disabled={!current || saving || !dirty}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {t("Lưu", "Save")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {files.isLoading ? (
          <Skeleton className="h-96" />
        ) : list.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
            <ScrollArea className="h-56 rounded-lg border p-1 md:h-[28rem]">{tree.map((n) => renderNode(n, 0))}</ScrollArea>
            {current ? (
              <Textarea
                value={value}
                onChange={(e) => setDrafts((d) => ({ ...d, [current.name]: e.target.value }))}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
                    e.preventDefault();
                    if (dirty) save();
                  }
                }}
                spellCheck={false}
                className="h-80 resize-none font-mono text-xs leading-relaxed md:h-[28rem]"
              />
            ) : (
              <div className="flex h-80 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground md:h-[28rem]">{t("Chọn một tệp để xem hoặc sửa", "Pick a file to view or edit")}</div>
            )}
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("Chưa có tệp", "No files yet")}</EmptyTitle>
              <EmptyDescription>{t("Workspace của bot này đang trống.", "This bot's workspace is empty.")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
