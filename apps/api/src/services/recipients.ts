import { and, eq } from "drizzle-orm";
import { ADMIN_ONLY_REPORTS, type ReportKey } from "@iltizam/core";
import type { AppCtx } from "../app";
import { emailRecipients, recipientReportScope } from "../db/schema";
import { badRequest } from "../lib/errors";

export const MAX_RECIPIENTS = 50;
/** تحقق صيغة البريد (RFC مبسّط عمليًا) */
export const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
export const normEmail = (e: string) => e.trim().toLowerCase();
export const validEmail = (e: string) => e.length <= 254 && EMAIL_RE.test(e);

export interface ResolvedRecipient { email: string; name: string; source: "list" | "extra" | "admin" }

/**
 * قائمة مستلمي تقرير: المستلمون النشطون الذين يسمح نطاقهم بهذا التقرير + العناوين الإضافية للطلب
 * + ADMIN_EMAIL دائمًا (يُضاف برمجيًا حتى لو حُذف من الجدول يدويًا). إزالة التكرار بلا حساسية لحالة الأحرف. حد أقصى 50.
 * تقارير users/emails لا تذهب إلا لمدير النظام.
 */
export async function resolveRecipients(ctx: AppCtx, key: ReportKey, extra: string[] = []): Promise<ResolvedRecipient[]> {
  const admin = normEmail(ctx.cfg.ADMIN_EMAIL);
  const out = new Map<string, ResolvedRecipient>();
  const add = (email: string, name: string, source: ResolvedRecipient["source"]) => { const e = normEmail(email); if (!out.has(e)) out.set(e, { email: e, name, source }); };
  if (ADMIN_ONLY_REPORTS.includes(key)) { add(admin, "مدير النظام", "admin"); return [...out.values()]; }
  const rows = await ctx.db.select().from(emailRecipients).where(eq(emailRecipients.active, true));
  const denied = new Set((await ctx.db.select().from(recipientReportScope).where(and(eq(recipientReportScope.reportKey, key), eq(recipientReportScope.allowed, false)))).map((x) => x.recipientId));
  // مدير النظام يتلقى الكل دائمًا ولا يُقيَّد
  for (const r of rows) if (!denied.has(r.id) || r.isSystem || normEmail(r.email) === admin) add(r.email, r.name, "list");
  for (const e of extra) { const n = normEmail(e); if (!validEmail(n)) throw badRequest(`بريد غير صالح: ${e}`, "invalid_email"); add(n, "", "extra"); }
  add(admin, "مدير النظام", "admin"); // يُضاف برمجيًا قبل الإرسال
  if (out.size > MAX_RECIPIENTS) throw badRequest(`عدد المستلمين (${out.size}) يتجاوز الحد الأقصى ${MAX_RECIPIENTS} للطلب الواحد`, "too_many_recipients");
  return [...out.values()];
}
