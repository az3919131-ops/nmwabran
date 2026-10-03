import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import parser from "cron-parser";
import { z } from "zod";
import { ADMIN_ONLY_REPORTS, REPORT_KEYS, readCsvText } from "@iltizam/core";
import { emailLog, emailRecipients, recipientReportScope, reportSchedules, users } from "../db/schema";
import { audit } from "../lib/audit";
import { HttpError, badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { EMAIL_RE, normEmail, validEmail } from "../services/recipients";
import { readXlsx } from "../services/readers";
import { createTestJob, type RecipientState } from "../services/reports/service";

const SYSTEM_MSG = "مدير النظام مستلم إلزامي — لا يمكن حذفه أو تعطيله أو تغيير بريده (يمكن تعديل الاسم فقط)";
const emailField = z.string().trim().max(254).refine((v) => EMAIL_RE.test(v), "صيغة البريد غير صحيحة");

export async function emailRoutes(app: FastifyInstance): Promise<void> {
  const ctx = app.ctx, db = ctx.db, admin = ctx.cfg.ADMIN_EMAIL.toLowerCase();
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["emails"];
  const idp = z.object({ id: z.string().uuid() });
  const isSys = (row: { isSystem: boolean; email: string }) => row.isSystem || normEmail(row.email) === admin;

  /* ───────── المستلمون ───────── */
  r.get("/api/v1/email-recipients", { schema: { tags, summary: "قائمة المستلمين + بطاقات الملخص" }, preHandler: app.requirePerm("emails", "view") }, async () => {
    const rows = await db.select().from(emailRecipients).orderBy(desc(emailRecipients.isSystem), asc(emailRecipients.createdAt));
    const names = new Map((await db.select({ id: users.id, name: users.name }).from(users)).map((u) => [u.id, u.name]));
    const logs = await db.select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(300);
    const last = new Map<string, { reportKey: string; at: string }>();
    for (const l of logs) for (const rc of l.recipients as RecipientState[]) if (rc.status === "sent" && !last.has(rc.email)) last.set(rc.email, { reportKey: l.reportKey, at: (l.sentAt ?? l.createdAt).toISOString() });
    const since = new Date(Date.now() - 30 * 86400000);
    let ok = 0, tot = 0;
    for (const l of logs) if (l.createdAt >= since) for (const rc of l.recipients as RecipientState[]) { if (rc.status === "sent") { ok++; tot++; } else if (rc.status === "failed") tot++; }
    const lastSend = logs.find((l) => l.sentAt)?.sentAt ?? null;
    return {
      summary: { total: rows.length, active: rows.filter((x) => x.active).length, lastSentAt: lastSend, successRate30d: tot ? Math.round((ok / tot) * 1000) / 10 : null, attempts30d: tot },
      adminEmail: admin,
      items: rows.map((x) => ({ id: x.id, email: x.email, name: x.name, roleLabel: x.roleLabel, active: x.active, isSystem: isSys(x), createdAt: x.createdAt, createdBy: x.createdBy ? names.get(x.createdBy) ?? "—" : "—", lastReport: last.get(x.email) ?? null })),
    };
  });

  const addOne = async (e: string, name: string, roleLabel: string, active: boolean, by: string | null) => {
    const email = normEmail(e);
    if (!validEmail(email)) throw badRequest("صيغة البريد غير صحيحة", "invalid_email");
    const dup = await db.select({ id: emailRecipients.id }).from(emailRecipients).where(eq(emailRecipients.email, email)).limit(1);
    if (dup.length) throw conflict("هذا البريد مسجّل بالفعل", "duplicate_email");
    const [row] = await db.insert(emailRecipients).values({ email, name, roleLabel, active, createdBy: by }).returning();
    return row;
  };
  r.post("/api/v1/email-recipients", {
    schema: { tags, summary: "إضافة مستلم", body: z.object({ email: emailField, name: z.string().trim().max(120).default(""), roleLabel: z.string().trim().max(120).default(""), active: z.boolean().default(true) }) },
    preHandler: app.requirePerm("emails", "edit"),
  }, async (req, reply) => {
    const row = await addOne(req.body.email, req.body.name, req.body.roleLabel, req.body.active, req.auth!.user.id);
    await audit(req, "recipient_add", { entity: "recipient", entityId: row.id, detail: row.email });
    reply.code(201);
    return row;
  });

  const bulkAdd = async (items: { email: string; name?: string }[], by: string | null) => {
    const added: string[] = [], skipped: { email: string; reason: string }[] = [], seen = new Set<string>();
    for (const it of items) {
      const email = normEmail(String(it.email ?? ""));
      if (!email) continue;
      if (seen.has(email)) { skipped.push({ email, reason: "مكرر في الطلب" }); continue; }
      seen.add(email);
      try { await addOne(email, (it.name ?? "").trim().slice(0, 120), "", true, by); added.push(email); }
      catch (e) { skipped.push({ email, reason: e instanceof HttpError ? e.message : "خطأ" }); }
    }
    return { added: added.length, addedEmails: added, skipped };
  };
  r.post("/api/v1/email-recipients/bulk", {
    schema: { tags, summary: "إضافة جماعية", body: z.object({ items: z.array(z.object({ email: z.string(), name: z.string().optional() })).min(1).max(500) }) },
    preHandler: app.requirePerm("emails", "edit"),
  }, async (req) => {
    const res = await bulkAdd(req.body.items, req.auth!.user.id);
    await audit(req, "recipient_bulk", { detail: `${res.added} added · ${res.skipped.length} skipped` });
    return res;
  });
  r.post("/api/v1/email-recipients/import", { schema: { tags, summary: "استيراد مستلمين من CSV/Excel (أعمدة: email, name)" }, preHandler: app.requirePerm("emails", "edit") }, async (req) => {
    const items: { email: string; name?: string }[] = [];
    for await (const part of req.parts()) {
      if (part.type !== "file") continue;
      const buf = await part.toBuffer();
      const ext = (part.filename.split(".").pop() || "").toLowerCase();
      const sheets = ["xlsx", "xlsm"].includes(ext) ? await readXlsx(buf) : readCsvText(buf.toString("utf8"));
      for (const sh of sheets) {
        const hdr = (sh.rows[0] ?? []).map((c) => String(c ?? "").trim().toLowerCase());
        let ei = hdr.findIndex((h) => /^(e-?mail|email|بريد|البريد)/.test(h)), ni = hdr.findIndex((h) => /^(name|الاسم|اسم)/.test(h));
        let start = 1;
        if (ei < 0) { ei = 0; ni = ni < 0 ? 1 : ni; start = EMAIL_RE.test(String(sh.rows[0]?.[0] ?? "").trim()) ? 0 : 1; }
        for (const row of sh.rows.slice(start)) { const e = String(row[ei] ?? "").trim(); if (e) items.push({ email: e, name: ni >= 0 ? String(row[ni] ?? "") : "" }); }
      }
    }
    if (!items.length) throw badRequest("لم يُعثر على عناوين بريد في الملف", "empty_file");
    if (items.length > 500) throw badRequest("الحد الأقصى 500 عنوان في الملف", "too_many");
    const res = await bulkAdd(items, req.auth!.user.id);
    await audit(req, "recipient_bulk", { detail: `import ${res.added} added · ${res.skipped.length} skipped` });
    return res;
  });

  r.patch("/api/v1/email-recipients/:id", {
    schema: { tags, params: idp, body: z.object({ email: emailField.optional(), name: z.string().trim().max(120).optional(), roleLabel: z.string().trim().max(120).optional(), active: z.boolean().optional() }) },
    preHandler: app.requirePerm("emails", "edit"),
  }, async (req) => {
    const [row] = await db.select().from(emailRecipients).where(eq(emailRecipients.id, req.params.id)).limit(1);
    if (!row) throw notFound("المستلم غير موجود");
    const b = req.body;
    if (isSys(row)) {
      if ((b.email !== undefined && normEmail(b.email) !== row.email) || (b.active !== undefined && b.active !== true) || (b.roleLabel !== undefined && b.roleLabel !== row.roleLabel)) throw forbidden(SYSTEM_MSG, "system_recipient");
    }
    const set: Partial<typeof emailRecipients.$inferInsert> = { updatedAt: new Date() };
    if (b.name !== undefined) set.name = b.name;
    if (!isSys(row)) {
      if (b.roleLabel !== undefined) set.roleLabel = b.roleLabel;
      if (b.active !== undefined) set.active = b.active;
      if (b.email !== undefined) {
        const e = normEmail(b.email);
        if (e !== row.email) {
          const dup = await db.select({ id: emailRecipients.id }).from(emailRecipients).where(eq(emailRecipients.email, e)).limit(1);
          if (dup.length) throw conflict("هذا البريد مسجّل بالفعل", "duplicate_email");
          set.email = e;
        }
      }
    }
    const [u] = await db.update(emailRecipients).set(set).where(eq(emailRecipients.id, row.id)).returning();
    await audit(req, "recipient_edit", { entity: "recipient", entityId: row.id, detail: row.email });
    return u;
  });
  r.delete("/api/v1/email-recipients/:id", { schema: { tags, params: idp }, preHandler: app.requirePerm("emails", "del") }, async (req) => {
    const [row] = await db.select().from(emailRecipients).where(eq(emailRecipients.id, req.params.id)).limit(1);
    if (!row) throw notFound("المستلم غير موجود");
    if (isSys(row)) throw forbidden(SYSTEM_MSG, "system_recipient");
    await db.delete(emailRecipients).where(eq(emailRecipients.id, row.id));
    await audit(req, "recipient_del", { entity: "recipient", entityId: row.id, detail: row.email });
    return { ok: true };
  });

  /* ───────── اختبار الإرسال ───────── */
  r.post("/api/v1/email-recipients/:id/test", { schema: { tags, summary: "رسالة اختبار لمستلم", params: idp }, preHandler: app.requirePerm("emails", "edit", { ignoreLock: true }) }, async (req, reply) => {
    const [row] = await db.select().from(emailRecipients).where(eq(emailRecipients.id, req.params.id)).limit(1);
    if (!row) throw notFound("المستلم غير موجود");
    const jobId = await createTestJob(ctx, { userId: req.auth!.user.id, isAdmin: req.auth!.user.role === "admin", contractorIds: null }, { emails: [row.email] });
    await audit(req, "recipient_test", { entityId: row.id, detail: row.email });
    reply.code(202);
    return { jobId };
  });
  r.post("/api/v1/email-recipients/test-all", { schema: { tags, summary: "رسالة اختبار لكل المستلمين النشطين" }, preHandler: app.requirePerm("emails", "edit", { ignoreLock: true }) }, async (req, reply) => {
    const jobId = await createTestJob(ctx, { userId: req.auth!.user.id, isAdmin: req.auth!.user.role === "admin", contractorIds: null }, {});
    await audit(req, "recipient_test_all");
    reply.code(202);
    return { jobId };
  });

  /* ───────── نطاق كل مستلم من التقارير ───────── */
  const scopable = REPORT_KEYS.filter((k) => !ADMIN_ONLY_REPORTS.includes(k));
  r.get("/api/v1/email-recipients/scope", { schema: { tags, summary: "مصفوفة نطاق التقارير (الافتراضي: الكل يتلقى الكل)" }, preHandler: app.requirePerm("emails", "view") }, async () => {
    const rows = await db.select().from(recipientReportScope).where(eq(recipientReportScope.allowed, false));
    return { reportKeys: scopable, denied: rows.map((x) => ({ recipientId: x.recipientId, reportKey: x.reportKey })) };
  });
  r.put("/api/v1/email-recipients/:id/scope", {
    schema: { tags, params: idp, body: z.object({ reportKey: z.string(), allowed: z.boolean() }) }, preHandler: app.requirePerm("emails", "edit"),
  }, async (req) => {
    const [row] = await db.select().from(emailRecipients).where(eq(emailRecipients.id, req.params.id)).limit(1);
    if (!row) throw notFound("المستلم غير موجود");
    if (isSys(row)) throw forbidden("مدير النظام يتلقى كل التقارير دائمًا ولا يمكن تقييده", "system_recipient");
    if (!scopable.includes(req.body.reportKey as never)) throw badRequest("نوع تقرير غير صالح للنطاق");
    await db.insert(recipientReportScope).values({ recipientId: row.id, reportKey: req.body.reportKey, allowed: req.body.allowed })
      .onConflictDoUpdate({ target: [recipientReportScope.recipientId, recipientReportScope.reportKey], set: { allowed: req.body.allowed } });
    await audit(req, "recipient_scope", { entityId: row.id, detail: `${row.email} · ${req.body.reportKey} = ${req.body.allowed}` });
    return { ok: true };
  });

  /* ───────── السجل وحالة المزوّد ───────── */
  r.get("/api/v1/email-log", { schema: { tags, summary: "سجل الإرسال", querystring: z.object({ limit: z.coerce.number().min(1).max(500).default(100), offset: z.coerce.number().min(0).default(0) }) }, preHandler: app.requirePerm("emails", "view") }, async (req) => {
    const rows = await db.select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(req.query.limit).offset(req.query.offset);
    const names = new Map((await db.select({ id: users.id, name: users.name }).from(users)).map((u) => [u.id, u.name]));
    const wo = rows.length ? await db.execute(sql`select id, name, wo_number from work_orders where id in (${sql.join(rows.filter((x) => x.workOrderId).map((x) => sql`${x.workOrderId}::uuid`), sql`, `)})`).catch(() => ({ rows: [] as any[] })) : { rows: [] as any[] };
    return rows.map((l) => ({
      id: l.id, reportKey: l.reportKey, workOrderId: l.workOrderId, project: (wo.rows as any[]).find((x) => x.id === l.workOrderId)?.name ?? null, wo: (wo.rows as any[]).find((x) => x.id === l.workOrderId)?.wo_number ?? null,
      sentBy: l.sentBy ? names.get(l.sentBy) ?? "—" : "جدولة/نظام", subject: l.subject, status: l.status, error: l.error, attempts: l.attempts, createdAt: l.createdAt, sentAt: l.sentAt,
      recipients: l.recipients, attachments: l.attachments, recipientCount: (l.recipients as unknown[]).length,
    }));
  });
  r.post("/api/v1/email-log/:id/retry", { schema: { tags, params: idp }, preHandler: app.requirePerm("emails", "edit", { ignoreLock: true }) }, async (req, reply) => {
    const [l] = await db.select().from(emailLog).where(eq(emailLog.id, req.params.id)).limit(1);
    if (!l) throw notFound("السجل غير موجود");
    if (!["failed", "partial"].includes(l.status)) throw badRequest("إعادة المحاولة للإرسالات الفاشلة أو الناقصة فقط", "not_retryable");
    const rec = (l.recipients as RecipientState[]).map((x) => (x.status === "failed" ? { ...x, status: "queued" as const, error: undefined } : x));
    await db.update(emailLog).set({ recipients: rec, status: "queued", error: null, attempts: 0 }).where(eq(emailLog.id, l.id));
    await ctx.queue.enqueueReport(l.id);
    await audit(req, "email_retry", { entityId: l.id });
    reply.code(202);
    return { jobId: l.id };
  });
  r.get("/api/v1/mail/health", { schema: { tags, summary: "حالة مزوّد البريد (أخضر/أحمر)" }, preHandler: app.requirePerm("emails", "view") }, async () => {
    const h = await ctx.mail.health();
    return { ...h, adminEmail: admin };
  });

  /* ───────── جدولة التقارير ───────── */
  const schedBody = z.object({ reportKey: z.string(), workOrderId: z.string().uuid().nullish(), cron: z.string().min(9).max(60), lang: z.enum(["ar", "en"]).default("ar"), attachPdf: z.boolean().default(true), attachXlsx: z.boolean().default(true), note: z.string().max(2000).nullish(), active: z.boolean().default(true) });
  const checkCron = (c: string) => { try { const it = parser.parseExpression(c); const a = it.next().toDate().getTime(), b = it.next().toDate().getTime(); if (b - a < 5 * 60000) throw new Error("min"); } catch { throw badRequest("صيغة cron غير صالحة أو متكررة أكثر من اللازم (الحد الأدنى 5 دقائق)", "bad_cron"); } };
  r.get("/api/v1/report-schedules", { schema: { tags, summary: "جدولة التقارير" }, preHandler: app.requirePerm("emails", "view") }, async () => db.select().from(reportSchedules).orderBy(desc(reportSchedules.createdAt)));
  r.post("/api/v1/report-schedules", { schema: { tags, body: schedBody }, preHandler: app.requirePerm("emails", "edit") }, async (req, reply) => {
    const b = req.body;
    if (!(REPORT_KEYS as readonly string[]).includes(b.reportKey)) throw badRequest("نوع تقرير غير معروف");
    if (ADMIN_ONLY_REPORTS.includes(b.reportKey as never) && req.auth!.user.role !== "admin") throw forbidden("هذا التقرير لمدير النظام فقط");
    checkCron(b.cron);
    const [s] = await db.insert(reportSchedules).values({ ...b, workOrderId: b.workOrderId ?? null, note: b.note ?? null, createdBy: req.auth!.user.id }).returning();
    await ctx.queue.syncSchedules();
    await audit(req, "schedule_add", { entityId: s.id, detail: `${b.reportKey} ${b.cron}` });
    reply.code(201);
    return s;
  });
  r.patch("/api/v1/report-schedules/:id", { schema: { tags, params: idp, body: schedBody.partial() }, preHandler: app.requirePerm("emails", "edit") }, async (req) => {
    if (req.body.cron) checkCron(req.body.cron);
    const [s] = await db.update(reportSchedules).set(req.body as never).where(eq(reportSchedules.id, req.params.id)).returning();
    if (!s) throw notFound("الجدول غير موجود");
    await audit(req, "schedule_edit", { entityId: s.id });
    return s;
  });
  r.delete("/api/v1/report-schedules/:id", { schema: { tags, params: idp }, preHandler: app.requirePerm("emails", "del") }, async (req) => {
    await db.delete(reportSchedules).where(eq(reportSchedules.id, req.params.id));
    await audit(req, "schedule_del", { entityId: req.params.id });
    return { ok: true };
  });
  void and; void gte; void inArray;
}
