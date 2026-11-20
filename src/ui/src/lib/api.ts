// Thin client for the Setup server (src/server/local-server.js). Every route and payload shape here
// matches what the legacy UI used, so the server stays untouched.

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method || (opts.body !== undefined ? "POST" : "GET"), signal: opts.signal };
  if (opts.body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, init);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).error || msg;
    } catch {}
    throw new ApiError(msg, res.status);
  }
  return res.json();
}

export function withProject(path: string, projectDir: string, extra: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  if (projectDir) params.set("projectDir", projectDir);
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null && v !== "") params.set(k, v);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

export type ProjectMeta = {
  projectDir: string;
  os?: string;
  mode?: "native" | "docker" | string;
  gatewayPort?: number;
  routerPort?: number;
  botCount?: number;
  hasDocker?: boolean;
};

export type SystemInfo = {
  os: string;
  platform: string;
  arch: string;
  recommendedMode?: string;
  node: { ok: boolean; output?: string };
  npm: { ok: boolean; output?: string };
  docker: { ok: boolean; output?: string };
  versions: Record<string, string>;
  remote?: { headless?: boolean; host?: string; user?: string; uiPort?: number } | null;
  projects: ProjectMeta[];
};

export type KnowledgeItem = { name: string; path: string; kind: "text" | "link" | "binary"; url?: string };

export type Bot = {
  id: string;
  name: string;
  role?: string;
  channel: string;
  accountId?: string;
  workspace?: string;
  persona?: string;
  ownerName?: string;
  ownerDescription?: string;
  userName?: string;
  userDescription?: string;
  emoji?: string;
  roleId?: string;
  customRole?: string;
  styles?: string[];
  knowledge?: KnowledgeItem[];
  reaction?: string;
  mentionNames?: string;
  transport?: string;
  pageId?: string;
  pageName?: string;
  instagramId?: string;
  appId?: string;
  pageAccessToken?: string;
  appSecret?: string;
  verifyToken?: string;
};

export type BotStatus = {
  installing?: boolean;
  installed?: boolean;
  lastError?: string | null;
  projectDir?: string;
  gatewayUrl?: string;
  routerUrl?: string;
  mode?: string;
  deployMode?: string;
  gatewayStatus?: string;
  routerStatus?: string;
  bots: Bot[];
  projects?: ProjectMeta[];
  runtimeVersions?: { openclaw?: string; nineRouter?: string; node?: string };
  activeModel?: string;
  activeProvider?: string;
  configError?: string;
};

export type Features = {
  flags: Record<string, boolean>;
  installed: Record<string, boolean>;
  versions: Record<string, string>;
  locked: Record<string, boolean>;
  zaloBackend?: string;
};

export type ZaloHealth = {
  accounts: { accountId: string; agentId?: string; running?: boolean; lastError?: string; sessionSaved?: boolean }[];
  installedVersion?: string;
  zaloModInstalled?: boolean;
  zaloModVersion?: string;
};

export type FanpagePlan = {
  plan: "trial" | "free" | "pro" | "team";
  expiresAt?: string | null;
  trialEndsAt?: string | null;
  used: number;
  quota: number | null;
  features: { comments: boolean; publish: boolean };
  commentsLive?: boolean;
};

export type FbHealth = {
  relay?: { configured?: boolean; url?: string; botId?: string };
  transport?: string;
  pages?: {
    id: string; name?: string; igUsername?: string; connected?: boolean; picture?: string;
    plan?: FanpagePlan | null;
    settings?: { commentReply: boolean; privateReply: boolean; handoverHours: number } | null;
    billingUrl?: string | null; inboxUrl?: string | null;
  }[];
  error?: string | null;
};

export type WorkspaceFile = { name: string; path: string; type: "file" | "dir"; content?: string; editable?: boolean };

export type RoleCatalog = {
  roles: { id: string; icon?: string; title: Record<string, string>; desc: Record<string, string>; toolProfile?: string }[];
  styleGroups: { id: string; title: Record<string, string>; multi?: boolean; max?: number; items: { id: string; label: Record<string, string>; line?: Record<string, string> }[] }[];
  reactions: { id: string; label: string; vi?: string; en?: string }[];
  defaultReaction: string;
};
