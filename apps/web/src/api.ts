/**
 * عميل REST للخادم (/api/v1). رمز الوصول قصير العمر في الذاكرة فقط؛
 * التجديد عبر كوكي refresh المحمي (httpOnly) — لا يُخزَّن أي سر في المتصفح.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "error", public extra: Record<string, unknown> = {}) { super(message); }
}

const BASE = "/api/v1";
let access: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export const setAccessToken = (t: string | null): void => { access = t; };
export const getAccessToken = (): string | null => access;
export const onAuthLost = (fn: () => void): void => { onSessionLost = fn; };

async function parseError(res: Response): Promise<ApiError> {
  let body: any = null;
  try { body = await res.json(); } catch { /* غير JSON */ }
  const e = body?.error ?? {};
  const { code, message, ...extra } = e;
  return new ApiError(res.status, message ?? `خطأ ${res.status}`, code ?? "error", extra);
}

/** يجدّد رمز الوصول من كوكي refresh. يعيد المستخدم إن نجح. */
export async function refreshSession(): Promise<any | null> {
  const res = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "same-origin" });
  if (!res.ok) { access = null; return null; }
  const j = await res.json();
  access = j.accessToken;
  return j;
}

async function ensureRefresh(): Promise<boolean> {
  refreshing ??= refreshSession().then((j) => !!j).finally(() => { refreshing = null; });
  return refreshing;
}

export interface ReqOpts { form?: FormData; raw?: boolean; query?: Record<string, string | number | undefined>; noAuthRetry?: boolean; keepalive?: boolean }

export async function api<T = any>(method: string, path: string, body?: unknown, opts: ReqOpts = {}): Promise<T> {
  const qs = opts.query ? "?" + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : "";
  const run = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (access) headers.Authorization = `Bearer ${access}`;
    let payload: BodyInit | undefined;
    if (opts.form) payload = opts.form;
    else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    return fetch(`${BASE}${path}${qs}`, { method, headers, body: payload, credentials: "same-origin", keepalive: opts.keepalive });
  };
  let res = await run();
  if (res.status === 401 && !opts.noAuthRetry && !path.startsWith("/auth/")) {
    if (await ensureRefresh()) res = await run();
    else { onSessionLost?.(); throw new ApiError(401, "انتهت الجلسة — سجّل الدخول من جديد", "unauthorized"); }
  }
  if (!res.ok) throw await parseError(res);
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("json") ? await res.json() : await res.text()) as T;
}

export const get = <T = any>(p: string, query?: ReqOpts["query"]) => api<T>("GET", p, undefined, { query });
export const post = <T = any>(p: string, b?: unknown) => api<T>("POST", p, b ?? {});
export const put = <T = any>(p: string, b?: unknown) => api<T>("PUT", p, b ?? {});
export const patch = <T = any>(p: string, b?: unknown) => api<T>("PATCH", p, b ?? {});
export const del = <T = any>(p: string) => api<T>("DELETE", p);
export const upload = <T = any>(p: string, form: FormData) => api<T>("POST", p, undefined, { form });

/** تنزيل ملف من نقطة محمية (Blob) ثم حفظه */
export async function download(path: string, fallbackName: string, query?: ReqOpts["query"], method = "GET", body?: unknown): Promise<void> {
  const res = await api<Response>(method, path, body, { raw: true, query });
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename\*=UTF-8''([^;]+)/i.exec(cd) ?? /filename="?([^";]+)"?/i.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  saveBlob(await res.blob(), name);
}
export function saveBlob(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export async function openProtected(path: string, query?: ReqOpts["query"]): Promise<void> {
  const res = await api<Response>("GET", path, undefined, { raw: true, query });
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
