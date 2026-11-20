import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, withProject, type BotStatus, type Features, type FbHealth, type RoleCatalog, type SystemInfo, type WorkspaceFile, type ZaloHealth } from "@/lib/api";
import { useApp } from "@/stores/app";

/** The project the UI is looking at: the one picked here, else the one the server is connected to. */
export function useProjectDir() {
  const picked = useApp((s) => s.projectDir);
  const status = useQuery<BotStatus>({ queryKey: ["status", ""], queryFn: () => api("/api/bot/status"), enabled: !picked, staleTime: 15_000 });
  return picked || status.data?.projectDir || "";
}

export function useSystem() {
  return useQuery<SystemInfo>({ queryKey: ["system"], queryFn: () => api("/api/system"), staleTime: 30_000 });
}

export function useStatus() {
  const projectDir = useProjectDir();
  return useQuery<BotStatus>({
    queryKey: ["status", projectDir],
    queryFn: () => api(withProject("/api/bot/status", projectDir)),
    staleTime: 10_000,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useCatalog() {
  return useQuery<{ skills: { name: string; slug: string }[]; plugins: { name: string; package: string }[] }>({ queryKey: ["catalog"], queryFn: () => api("/api/catalog"), staleTime: 5 * 60_000 });
}

export function useRoles() {
  return useQuery<RoleCatalog>({ queryKey: ["roles"], queryFn: () => api("/api/bot/roles"), staleTime: Infinity });
}

export function useFeatures(agentId: string) {
  const projectDir = useProjectDir();
  return useQuery<Features>({
    queryKey: ["features", projectDir, agentId],
    queryFn: () => api(withProject("/api/features", projectDir, { agentId })),
    enabled: !!projectDir,
    staleTime: 20_000,
    placeholderData: (prev) => prev,
  });
}

export function useFiles(agentId: string) {
  const projectDir = useProjectDir();
  return useQuery<{ files: WorkspaceFile[] }>({
    queryKey: ["files", projectDir, agentId],
    queryFn: () => api(withProject("/api/bot/files", projectDir, { agentId })),
    enabled: !!projectDir && !!agentId,
    staleTime: 20_000,
  });
}

/** Live badges: the server caches the CLI probe, so a 10 s poll while the page is visible is cheap. */
export function useZaloHealth(enabled: boolean) {
  const projectDir = useProjectDir();
  return useQuery<ZaloHealth>({
    queryKey: ["zalo-health", projectDir],
    queryFn: () => api(withProject("/api/zalo/health", projectDir)),
    enabled: enabled && !!projectDir,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  });
}

export function useFbHealth(enabled: boolean) {
  const projectDir = useProjectDir();
  return useQuery<FbHealth>({
    queryKey: ["fb-health", projectDir],
    queryFn: () => api(withProject("/api/fb/health", projectDir)),
    enabled: enabled && !!projectDir,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  });
}

/** Refresh everything that depends on the selected project after a mutation. */
export function useRefresh() {
  const qc = useQueryClient();
  return (keys: string[] = ["status", "system", "features", "files", "zalo-health", "fb-health"]) =>
    Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

/** Keep the store's projectDir in sync with what the server reports once it is known. */
export function useAdoptServerProject() {
  const picked = useApp((s) => s.projectDir);
  const setProjectDir = useApp((s) => s.setProjectDir);
  const { data } = useQuery<BotStatus>({ queryKey: ["status", ""], queryFn: () => api("/api/bot/status"), enabled: !picked, staleTime: 15_000 });
  useEffect(() => {
    if (!picked && data?.projectDir) setProjectDir(data.projectDir);
  }, [picked, data?.projectDir, setProjectDir]);
}
