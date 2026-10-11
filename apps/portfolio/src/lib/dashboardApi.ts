import { config } from "../config";
import { readStore, removeStore, writeStore } from "./storage";
import { resolveN8n } from "./n8n";

// عقد واجهة لوحة التحكم مع n8n (workflow «واجهة لوحة التحكم»):
//   POST {url}  ترويسة x-dashboard-key  جسم JSON {action}
//   {action:"overview"}                         → {ok, message, replies[]}
//   {action:"save_message", message, enabled}   → {ok, message}
// حقل enabled في جدول n8n نص: "نعم" أو "لا" (متوافق مع نموذج التحديث الموجود).

export type DailyMessage = { message: string; enabled: boolean; updatedOn: string };
export type ReplyRow = {
  id: string;
  createdAt: string;
  phone: string;
  name: string;
  incomingText: string;
  replyDate: string;
  replyText: string;
};
export type Overview = { message: DailyMessage | null; replies: ReplyRow[] };

export class DashboardError extends Error {
  constructor(
    readonly code: "not-configured" | "unauthorized" | "network" | "server" | "bad-response",
    readonly status?: number,
  ) {
    super(code);
  }
}

const URL_KEY = "nm.dash.url";
const KEY_KEY = "nm.dash.key";
const MODE_KEY = "nm.dash.mode";

export type DashSession = { url: string; key: string; remember: boolean };

/** رابط الواجهة: ما حفظه المستخدم، وإلا المشتق من عنوان n8n */
export function defaultDashboardUrl(): string {
  const base = resolveN8n().baseUrl;
  return base ? `${base}/webhook/${config.n8nDashboardPath}` : "";
}

export function loadSession(): DashSession {
  const remembered = readStore(KEY_KEY, "local");
  return {
    url: readStore(URL_KEY, "local") || defaultDashboardUrl(),
    key: remembered ?? readStore(KEY_KEY, "session") ?? "",
    remember: remembered !== null,
  };
}

export function saveSession(s: DashSession): void {
  writeStore(URL_KEY, s.url.trim(), "local");
  removeStore(KEY_KEY, "local");
  removeStore(KEY_KEY, "session");
  // المفتاح يبقى في الجلسة فقط ما لم يطلب المستخدم تذكّره على هذا الجهاز
  writeStore(KEY_KEY, s.key, s.remember ? "local" : "session");
}

export function clearKey(): void {
  removeStore(KEY_KEY, "local");
  removeStore(KEY_KEY, "session");
}

export const isDemo = () => readStore(MODE_KEY, "session") === "demo";
export const setDemo = (on: boolean) => (on ? writeStore(MODE_KEY, "demo", "session") : removeStore(MODE_KEY, "session"));

async function call(session: Pick<DashSession, "url" | "key">, body: Record<string, unknown>, fetchImpl: typeof fetch = fetch.bind(globalThis)): Promise<unknown> {
  if (!session.url) throw new DashboardError("not-configured");
  let res: Response;
  try {
    res = await fetchImpl(session.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-dashboard-key": session.key },
      body: JSON.stringify(body),
    });
  } catch {
    throw new DashboardError("network");
  }
  if (res.status === 401 || res.status === 403) throw new DashboardError("unauthorized", res.status);
  if (!res.ok) throw new DashboardError("server", res.status);
  try {
    return await res.json();
  } catch {
    throw new DashboardError("bad-response", res.status);
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export function normalizeMessage(raw: unknown): DailyMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    message: str(r.message),
    enabled: r.enabled === true || str(r.enabled).trim() === "نعم",
    updatedOn: str(r.updated_on ?? r.updatedOn),
  };
}

export function normalizeReply(raw: unknown, index: number): ReplyRow {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(r.id ?? index),
    createdAt: str(r.createdAt),
    phone: str(r.phone),
    name: str(r.name),
    incomingText: str(r.incoming_text ?? r.incomingText),
    replyDate: str(r.reply_date ?? r.replyDate),
    replyText: str(r.reply_text ?? r.replyText),
  };
}

export async function fetchOverview(session: Pick<DashSession, "url" | "key">, fetchImpl?: typeof fetch): Promise<Overview> {
  const data = (await call(session, { action: "overview" }, fetchImpl)) as Record<string, unknown>;
  if (!data || data.ok !== true) throw new DashboardError("bad-response");
  const replies = Array.isArray(data.replies) ? data.replies.map(normalizeReply) : [];
  return { message: normalizeMessage(data.message), replies };
}

export async function saveDailyMessage(
  session: Pick<DashSession, "url" | "key">,
  input: { message: string; enabled: boolean },
  fetchImpl?: typeof fetch,
): Promise<DailyMessage> {
  const data = (await call(
    session,
    { action: "save_message", message: input.message, enabled: input.enabled ? "نعم" : "لا" },
    fetchImpl,
  )) as Record<string, unknown>;
  const msg = data && data.ok === true ? normalizeMessage(data.message) : null;
  if (!msg) throw new DashboardError("bad-response");
  return msg;
}
