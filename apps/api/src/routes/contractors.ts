import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { contractors, workOrders } from "../db/schema";
import { audit } from "../lib/audit";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";

const body = z.object({ name: z.string().trim().min(2).max(160), crNumber: z.string().max(60).nullish(), contactName: z.string().max(120).nullish(), contactPhone: z.string().max(60).nullish(), contactEmail: z.string().max(160).nullish() });

export async function contractorRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app.ctx;
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["contractors"];
  const idp = z.object({ id: z.string().uuid() });

  r.get("/api/v1/contractors", { schema: { tags, summary: "المقاولون (حسب صلاحية المستخدم)" }, preHandler: app.requirePerm("firms", "view") }, async (req) => {
    const ids = req.auth!.contractorIds;
    const rows = await db.select().from(contractors).where(ids ? inArray(contractors.id, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]) : undefined).orderBy(asc(contractors.sortOrder), asc(contractors.createdAt));
    const counts = await db.select({ c: workOrders.contractorId, n: count() }).from(workOrders).groupBy(workOrders.contractorId);
    return rows.map((c) => ({ ...c, projects: counts.find((x) => x.c === c.id)?.n ?? 0 }));
  });

  r.post("/api/v1/contractors", { schema: { tags, summary: "إضافة مقاول", body }, preHandler: app.requirePerm("firms", "edit") }, async (req, reply) => {
    const dup = await db.select({ id: contractors.id }).from(contractors).where(eq(contractors.name, req.body.name)).limit(1);
    if (dup.length) throw conflict("هذا المقاول مسجّل بالفعل", "duplicate_contractor");
    const [max] = await db.select({ n: count() }).from(contractors);
    const [c] = await db.insert(contractors).values({ ...req.body, sortOrder: max.n }).returning();
    await audit(req, "contractor_add", { entity: "contractor", entityId: c.id, detail: c.name });
    reply.code(201);
    return c;
  });

  r.patch("/api/v1/contractors/:id", { schema: { tags, params: idp, body: body.partial() }, preHandler: app.requirePerm("firms", "edit") }, async (req) => {
    if (req.auth!.contractorIds && !req.auth!.contractorIds.includes(req.params.id)) throw forbidden("لا تملك صلاحية على هذا المقاول");
    if (req.body.name) {
      const dup = await db.select({ id: contractors.id }).from(contractors).where(eq(contractors.name, req.body.name)).limit(1);
      if (dup.length && dup[0].id !== req.params.id) throw conflict("هذا المقاول مسجّل بالفعل", "duplicate_contractor");
    }
    const [c] = await db.update(contractors).set({ ...req.body, updatedAt: new Date() }).where(eq(contractors.id, req.params.id)).returning();
    if (!c) throw notFound("المقاول غير موجود");
    await audit(req, "contractor_edit", { entity: "contractor", entityId: c.id, detail: c.name });
    return c;
  });

  /** حذف مقاول: تُنقل مشاريعه إلى مقاول آخر (لا تُحذف المشاريع) */
  r.delete("/api/v1/contractors/:id", { schema: { tags, params: idp, querystring: z.object({ moveTo: z.string().uuid().optional() }) }, preHandler: app.requirePerm("firms", "del") }, async (req) => {
    if (req.auth!.contractorIds && !req.auth!.contractorIds.includes(req.params.id)) throw forbidden("لا تملك صلاحية على هذا المقاول");
    const all = await db.select().from(contractors);
    const c = all.find((x) => x.id === req.params.id); if (!c) throw notFound("المقاول غير موجود");
    if (all.length <= 1) throw badRequest("لا يمكن حذف المقاول الوحيد");
    const [{ n }] = await db.select({ n: count() }).from(workOrders).where(eq(workOrders.contractorId, c.id));
    if (n > 0) {
      const to = req.query.moveTo ?? all.find((x) => x.id !== c.id)!.id;
      if (to === c.id || !all.some((x) => x.id === to)) throw badRequest("مقاول النقل غير صالح");
      await db.update(workOrders).set({ contractorId: to, updatedAt: new Date() }).where(eq(workOrders.contractorId, c.id));
    }
    await db.delete(contractors).where(eq(contractors.id, c.id));
    await audit(req, "contractor_del", { entity: "contractor", entityId: c.id, detail: `${c.name} · moved ${n}` });
    return { ok: true, moved: n };
  });
}
