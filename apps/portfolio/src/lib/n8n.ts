import { config } from "../config";
import { readJson, removeStore, writeStore } from "./storage";

const KEY = "nm.n8n.settings";

/** القيم التي يعدّلها المستخدم يدويًا (تُحفظ في localStorage). الفارغ = اشتقاق تلقائي */
export type N8nOverrides = { baseUrl: string; webhookUrl: string; formUrl: string };
export type N8nResolved = N8nOverrides & { configured: boolean };

const EMPTY: N8nOverrides = { baseUrl: "", webhookUrl: "", formUrl: "" };

const trimSlash = (s: string) => s.trim().replace(/\/+$/, "");

/** يقبل http(s) فقط (يمنع javascript: وغيره) */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function loadOverrides(): N8nOverrides {
  const stored = readJson<Partial<N8nOverrides>>(KEY, {});
  return {
    baseUrl: typeof stored.baseUrl === "string" ? stored.baseUrl : "",
    webhookUrl: typeof stored.webhookUrl === "string" ? stored.webhookUrl : "",
    formUrl: typeof stored.formUrl === "string" ? stored.formUrl : "",
  };
}

export function saveOverrides(v: N8nOverrides): boolean {
  return writeStore(KEY, JSON.stringify({ baseUrl: trimSlash(v.baseUrl), webhookUrl: v.webhookUrl.trim(), formUrl: v.formUrl.trim() }));
}

export function resetOverrides(): void {
  removeStore(KEY);
}

/** يحسب الروابط النهائية: التعديل اليدوي أولًا، ثم المشتق من عنوان الخادم، ثم متغيرات البيئة */
export function resolveN8n(overrides: N8nOverrides = loadOverrides(), id: string = config.n8nWebhookId): N8nResolved {
  const baseUrl = trimSlash(overrides.baseUrl) || config.n8nBaseUrl;
  const webhookUrl = overrides.webhookUrl.trim() || (baseUrl ? `${baseUrl}/webhook/${id}` : "");
  const formUrl = overrides.formUrl.trim() || (baseUrl ? `${baseUrl}/form/${id}` : "");
  return { baseUrl, webhookUrl, formUrl, configured: Boolean(webhookUrl) };
}

export const emptyOverrides = (): N8nOverrides => ({ ...EMPTY });

export type ReviewPayload = {
  landingPageUrl: string;
  name: string;
  comments: string;
  lang: "ar" | "en";
};

export type SendResult = "delivered" | "unconfirmed";

export class N8nError extends Error {
  constructor(
    readonly code: "not-configured" | "invalid-url" | "status" | "network" | "timeout",
    readonly status?: number,
  ) {
    super(code);
  }
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * يرسل طلب المراجعة إلى webhook في n8n.
 * 1) محاولة JSON عادية (تتيح قراءة النتيجة إن كان CORS مفعّلًا في n8n).
 * 2) إن حجب المتصفح الطلب (TypeError) تُعاد المحاولة بصيغة form-urlencoded وبوضع no-cors؛
 *    النتيجة هنا غير قابلة للقراءة فتُرجع "unconfirmed". يحمل الطلبان نفس requestId ليتجاهل n8n التكرار.
 */
export async function sendReview(
  url: string,
  payload: ReviewPayload,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<SendResult> {
  if (!url) throw new N8nError("not-configured");
  if (!isHttpUrl(url)) throw new N8nError("invalid-url");
  const doFetch = opts.fetchImpl ?? fetch.bind(globalThis);
  const body = {
    ...payload,
    source: "ahmed-zahran-portfolio",
    submittedAt: new Date().toISOString(),
    requestId: newId(),
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new N8nError("status", res.status);
      return "delivered";
    } catch (e) {
      if (e instanceof N8nError) throw e;
      if ((e as Error).name === "AbortError") throw new N8nError("timeout");
      // TypeError: شبكة أو CORS — جرّب الإرسال بلا قراءة النتيجة
      try {
        await doFetch(url, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])),
          signal: ctrl.signal,
        });
        return "unconfirmed";
      } catch (e2) {
        if ((e2 as Error).name === "AbortError") throw new N8nError("timeout");
        throw new N8nError("network");
      }
    }
  } finally {
    clearTimeout(timer);
  }
}
