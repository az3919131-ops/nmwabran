import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { apiKeys, importLog, webhookDeliveries, webhookEndpoints, workOrders } from "../db/schema";
import { audit } from "../lib/audit";
import { forbidden, notFound, unauthorized } from "../lib/errors";
import { randomToken, safeEqual, sha256 } from "../lib/hash";
import { mutateProject } from "../services/projects";
import { extOf, finishImport, makeEnv, processFiles, type UploadedBlob } from "../services/imports";
import { insertFile } from "../services/projects";
import { API_SCOPES, WEBHOOK_EVENTS } from "../services/types";
import { deliverWebhook } from "../services/events";
import { importLogWrite } from "../services/importlog";
import type { Rep } from "@iltizam/core";
import { projectDto } from "../repo/projects";

export async function integrationRoutes(app: FastifyInstance): Promise<void> {
  const ctx = app.ctx, db = ctx.db;
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["integrations"];
  const idp = z.object({ id: z.string().uuid() });

  /* ───────── مفاتيح API للأنظمة الخارجية (n8n / Zapier / SAP) ───────── */
  r.get("/api/v1/api-keys", { schema: { tags, summary: "مفاتيح API (مجزّأة — لا تُعرض القيمة)" }, preHandler: app.requirePerm("users", "view") }, async () =>
    (await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt))).map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes, active: k.active, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt })));
  r.post("/api/v1/api-keys", { schema: { tags, summary: "إنشاء مفتاح (يظهر مرة واحدة)", body: z.object({ name: z.string().min(2).max(80), scopes: z.array(z.enum(API_SCOPES)).min(1) }) }, preHandler: app.requirePerm("users", "edit") }, async (req, reply) => {
    const key = "ilt_" + randomToken(30);
    const [k] = await db.insert(apiKeys).values({ name: req.body.name, keyHash: sha256(key), prefix: key.slice(0, 10), scopes: req.body.scopes, createdBy: req.auth!.user.id }).returning();
    await audit(req, "apikey_add", { entityId: k.id, detail: `${k.name} · ${req.body.scopes.join(",")}` });
    reply.code(201);
    return { id: k.id, name: k.name, scopes: k.scopes, key, note: "احفظ المفتاح الآن — لن يُعرض مرة أخرى" };
  });
  r.delete("/api/v1/api-keys/:id", { schema: { tags, params: idp }, preHandler: app.requirePerm("users", "del") }, async (req) => {
    await db.update(apiKeys).set({ active: false }).where(eq(apiKeys.id, req.params.id));
    await audit(req, "apikey_revoke", { entityId: req.params.id });
    return { ok: true };
  });

  /* ───────── Webhooks صادرة: توقيع HMAC-SHA256 في X-Signature ───────── */
  r.get("/api/v1/webhooks/events", { schema: { tags, summary: "الأحداث المتاحة" }, preHandler: app.requirePerm("users", "view") }, async () => ({ events: WEBHOOK_EVENTS }));
  r.get("/api/v1/webhooks", { schema: { tags }, preHandler: app.requirePerm("users", "view") }, async () =>
    (await db.select().from(webhookEndpoints).orderBy(desc(webhookEndpoints.createdAt))).map((w) => ({ id: w.id, url: w.url, events: w.events, active: w.active, createdAt: w.createdAt })));
  r.post("/api/v1/webhooks", { schema: { tags, summary: "تسجيل نقطة webhook (يُعاد السر مرة واحدة)", body: z.object({ url: z.string().url(), events: z.array(z.enum(WEBHOOK_EVENTS)).min(1) }) }, preHandler: app.requirePerm("users", "edit") }, async (req, reply) => {
    const secret = "whsec_" + randomToken(24);
    const [w] = await db.insert(webhookEndpoints).values({ url: req.body.url, events: req.body.events, secret, createdBy: req.auth!.user.id }).returning();
    await audit(req, "webhook_add", { entityId: w.id, detail: w.url });
    reply.code(201);
    return { id: w.id, url: w.url, events: w.events, secret, signature: "X-Signature: sha256=HMAC_SHA256(secret, rawBody)" };
  });
  r.patch("/api/v1/webhooks/:id", { schema: { tags, params: idp, body: z.object({ active: z.boolean().optional(), events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(), url: z.string().url().optional() }) }, preHandler: app.requirePerm("users", "edit") }, async (req) => {
    const [w] = await db.update(webhookEndpoints).set(req.body).where(eq(webhookEndpoints.id, req.params.id)).returning();
    if (!w) throw notFound("غير موجود");
    return { id: w.id, url: w.url, events: w.events, active: w.active };
  });
  r.delete("/api/v1/webhooks/:id", { schema: { tags, params: idp }, preHandler: app.requirePerm("users", "del") }, async (req) => {
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, req.params.id));
    await audit(req, "webhook_del", { entityId: req.params.id });
    return { ok: true };
  });
  r.post("/api/v1/webhooks/:id/test", { schema: { tags, summary: "إرسال حدث تجريبي ping", params: idp }, preHandler: app.requirePerm("users", "edit", { ignoreLock: true }) }, async (req) => {
    const [d] = await db.insert(webhookDeliveries).values({ endpointId: req.params.id, event: "ping", payload: { event: "ping", at: new Date().toISOString(), data: { ok: true } } }).returning({ id: webhookDeliveries.id });
    try { await deliverWebhook(db, d.id); } catch { /* الحالة تُسجَّل */ }
    const [x] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, d.id)).limit(1);
    return { status: x.status, responseCode: x.responseCode, error: x.error };
  });
  r.get("/api/v1/webhooks/:id/deliveries", { schema: { tags, params: idp }, preHandler: app.requirePerm("users", "view") }, async (req) =>
    db.select().from(webhookDeliveries).where(eq(webhookDeliveries.endpointId, req.params.id)).orderBy(desc(webhookDeliveries.id)).limit(50));

  /* ───────── Webhook وارد: استيراد ملف Excel/KML من n8n عبر نفس محرك الاستيراد ───────── */
  r.post("/api/v1/hooks/import", {
    schema: { tags, summary: "استيراد ملف (xlsx/csv/kml/...) لمشروع — لـ n8n وغيره. مصادقة: X-API-Key (write:imports) أو X-Webhook-Secret", querystring: z.object({ workOrderId: z.string().uuid().optional(), wo: z.string().optional(), lang: z.enum(["ar", "en"]).default("ar") }) },
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    preHandler: async function (req, reply) {
      const sec = req.headers["x-webhook-secret"];
      if (typeof sec === "string" && safeEqual(sec, ctx.cfg.WEBHOOK_SECRET)) return;
      await (app.requireUserOrKey("write:imports", "import", "edit", { ignoreLock: true }) as unknown as (rq: typeof req, rp: typeof reply) => Promise<void>).call(app, req, reply);
      if (!req.apiKey && !req.auth) throw unauthorized();
    },
  }, async (req) => {
    let projectId = req.query.workOrderId;
    if (!projectId && req.query.wo) {
      const [w] = await db.select({ id: workOrders.id }).from(workOrders).where(eq(workOrders.woNumber, req.query.wo)).limit(2);
      projectId = w?.id;
    }
    if (!projectId) throw notFound("حدّد workOrderId أو wo (رقم أمر العمل)");
    const blobs: UploadedBlob[] = [];
    for await (const part of req.parts()) if (part.type === "file") { const buf = await part.toBuffer(); if (buf.length) blobs.push({ name: part.filename, mime: part.mimetype, buf }); }
    if (!blobs.length) throw forbidden("لم يُرسل أي ملف", "no_files");
    let report: Rep[] = [];
    const { project } = await mutateProject(ctx, projectId, { snapshot: "hook" }, async ({ p, cat, tx }) => {
      const res = await processFiles(ctx, p, cat, blobs, { lang: req.query.lang, guard: true, ai: ctx.ai });
      report = res.rep;
      finishImport(makeEnv(p, cat, req.query.lang, true), report);
      for (const { rec, blob } of res.recs) {
        const key = `projects/${p.id}/${rec.id}/${blob.name.replace(/[^\w.\-]+/g, "_")}`;
        await ctx.storage.put(key, blob.buf, blob.mime);
        await insertFile(tx, p.id, rec, { storageKey: key, mime: blob.mime });
      }
    });
    await importLogWrite(db, { projectId: project.id, userId: null, kind: "hook", summary: blobs.map((b) => b.name).join(" · "), report });
    await audit(req, "imported", { entity: "project", entityId: project.id, detail: "hook " + blobs.map((b) => extOf(b.name)).join(",") });
    void Promise.resolve(ctx.events.emit("import.completed", { projectId: project.id, wo: project.wo, files: blobs.map((b) => b.name), via: "hook" })).catch(() => {});
    return projectDto(project, { report });
  });
  void importLog;
}
