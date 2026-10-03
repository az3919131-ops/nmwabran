import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ADMIN_ONLY_REPORTS, REPORT_KEYS, isReportKey, type ReportKey } from "@iltizam/core";
import { emailLog } from "../db/schema";
import { audit } from "../lib/audit";
import { HttpError, badRequest, forbidden, notFound } from "../lib/errors";
import { signPrintToken, verifyDownload } from "../plugins/auth";
import { projectContractorId } from "../repo/projects";
import { PROJECT_REPORTS, createReportJob } from "../services/reports/service";

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  const ctx = app.ctx, db = ctx.db;
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["reports"];
  const keyp = z.object({ reportKey: z.enum(REPORT_KEYS as unknown as [ReportKey, ...ReportKey[]]) });

  /** POST /reports/:reportKey/send — غير متزامن: 202 { jobId } */
  r.post("/api/v1/reports/:reportKey/send", {
    schema: {
      tags, summary: "إرسال تقرير الصفحة بالبريد (PDF + Excel) لكل المستلمين النشطين + مدير النظام دائمًا", params: keyp,
      body: z.object({ workOrderId: z.string().uuid().nullish(), lang: z.enum(["ar", "en"]).default("ar"), attachPdf: z.boolean().default(true), attachXlsx: z.boolean().default(true), note: z.string().max(2000).optional(), extraRecipients: z.array(z.string()).max(50).optional() }),
      response: { 202: z.object({ jobId: z.string().uuid() }) },
    },
    preHandler: app.requireUserOrKey("send:reports", (req) => (req.params as { reportKey: string }).reportKey, "exp", { ignoreLock: true }),
  }, async (req, reply) => {
    const key = req.params.reportKey;
    if (ADMIN_ONLY_REPORTS.includes(key) && req.auth && req.auth.user.role !== "admin") throw forbidden("هذا التقرير لمدير النظام فقط ولا يُرسل لغيره");
    const by = req.auth
      ? { userId: req.auth.user.id, isAdmin: req.auth.user.role === "admin", contractorIds: req.auth.contractorIds }
      : { userId: null, isAdmin: false, contractorIds: null };
    const jobId = await createReportJob(ctx, { reportKey: key, workOrderId: req.body.workOrderId ?? null, lang: req.body.lang, attachPdf: req.body.attachPdf, attachXlsx: req.body.attachXlsx, note: req.body.note, extraRecipients: req.body.extraRecipients }, by);
    await audit(req, "report_send", { entity: "report", entityId: jobId, detail: `${key} · ${req.body.workOrderId ?? "-"}` });
    reply.code(202);
    return { jobId };
  });

  /** حالة المهمة: { status, perRecipient: [{email, status, error?}] } */
  r.get("/api/v1/reports/jobs/:jobId", { schema: { tags, params: z.object({ jobId: z.string().uuid() }) }, preHandler: app.requireUserOrKey("send:reports", "dash", "view") }, async (req) => {
    const [l] = await db.select().from(emailLog).where(eq(emailLog.id, req.params.jobId)).limit(1);
    if (!l) throw notFound("المهمة غير موجودة");
    if (req.auth && req.auth.user.role !== "admin" && l.sentBy !== req.auth.user.id && !req.auth.perms.emails?.view) throw forbidden("لا تملك صلاحية على هذه المهمة");
    const per = (l.recipients as { email: string; status: string; error?: string }[]).map((x) => ({ email: x.email, status: x.status, ...(x.error ? { error: x.error } : {}) }));
    return { id: l.id, status: l.status, perRecipient: per, subject: l.subject, attachments: l.attachments, error: l.error, attempts: l.attempts, createdAt: l.createdAt, sentAt: l.sentAt };
  });

  /** معاينة PDF بلا إرسال */
  r.get("/api/v1/reports/:reportKey/preview", {
    schema: { tags, summary: "معاينة PDF للتقرير بلا إرسال", params: keyp, querystring: z.object({ workOrderId: z.string().uuid().optional(), lang: z.enum(["ar", "en"]).default("ar") }) },
    preHandler: app.requirePerm("dash", "view"),
  }, async (req, reply) => {
    const key = req.params.reportKey;
    const a = req.auth!;
    if (!a.perms[key]?.exp) throw forbidden("لا تملك صلاحية التصدير في هذه الصفحة");
    if (ADMIN_ONLY_REPORTS.includes(key) && a.user.role !== "admin") throw forbidden("هذا التقرير لمدير النظام فقط");
    if (!ctx.pdf) throw new HttpError(503, "توليد PDF غير مفعّل على الخادم", "pdf_disabled");
    if (PROJECT_REPORTS.includes(key)) {
      if (!req.query.workOrderId) throw badRequest("workOrderId مطلوب لهذا التقرير", "work_order_required");
      const cid = await projectContractorId(db, req.query.workOrderId);
      if (!cid) throw notFound("المشروع غير موجود");
      if (a.contractorIds && !a.contractorIds.includes(cid)) throw forbidden("لا تملك صلاحية على مقاول هذا المشروع", "contractor_forbidden");
    }
    const token = await signPrintToken(ctx.cfg.JWT_SECRET, a.user.id, 300);
    const base = (ctx.cfg.PDF_RENDER_BASE_URL || `http://127.0.0.1:${ctx.cfg.PORT}`).replace(/\/$/, "");
    const pdf = await ctx.pdf.render(`${base}/?print=1&report=${key}${req.query.workOrderId ? `&wo=${req.query.workOrderId}` : ""}&lang=${req.query.lang}&token=${encodeURIComponent(token)}`, { lang: req.query.lang });
    reply.header("Content-Type", "application/pdf").header("Content-Disposition", `inline; filename="${key}-preview.pdf"`);
    return reply.send(pdf);
  });

  /** روابط التنزيل الموقّعة (صالحة 7 أيام) للمرفقات التي تجاوزت الحد */
  r.get("/api/v1/downloads/:token", { schema: { tags, params: z.object({ token: z.string().min(20) }) }, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req, reply) => {
    const v = await verifyDownload(ctx.cfg.JWT_SECRET, req.params.token);
    if (!v) throw new HttpError(410, "الرابط منتهي أو غير صالح", "link_expired");
    const f = await ctx.storage.get(v.key);
    if (!f) throw notFound("الملف غير موجود");
    const mime = v.name.endsWith(".pdf") ? "application/pdf" : v.name.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/octet-stream";
    reply.header("Content-Type", mime).header("X-Content-Type-Options", "nosniff").header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(v.name)}`);
    return reply.send(f.data);
  });
  void isReportKey;
}
