import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { defaultPerms, MODULE_IDS, type PermMap, type Role } from "@iltizam/core";
import { auditLog, sessions, userContractors, users } from "../db/schema";
import { audit } from "../lib/audit";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { hashPassword } from "../lib/hash";
import { getPerms, getUserById, setPerms, setUserContractors } from "../repo/users";
import { publicUser } from "./auth";

const MIN_PW = 8;
const role = z.enum(["admin", "dept", "pm"]);
const permShape = z.record(z.string(), z.object({ view: z.coerce.number().min(0).max(1), edit: z.coerce.number().min(0).max(1), del: z.coerce.number().min(0).max(1), exp: z.coerce.number().min(0).max(1) }));

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app.ctx;
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["users"];
  const idp = z.object({ id: z.string().uuid() });

  const activeAdmins = async (excludeId?: string) => (await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.active, true), excludeId ? ne(users.id, excludeId) : undefined))).length;
  const detail = async (u: typeof users.$inferSelect) => ({
    ...publicUser(u), lastLoginAt: u.lastLoginAt, createdAt: u.createdAt, perms: await getPerms(db, u),
    contractorIds: (await db.select({ c: userContractors.contractorId }).from(userContractors).where(eq(userContractors.userId, u.id))).map((x) => x.c),
  });

  r.get("/api/v1/users", { schema: { tags, summary: "قائمة المستخدمين وصلاحياتهم (مدير النظام)" }, preHandler: app.requirePerm("users", "view") }, async () => {
    const rows = await db.select().from(users).orderBy(users.createdAt);
    return Promise.all(rows.map(detail));
  });

  r.post("/api/v1/users", {
    schema: { tags, summary: "مستخدم جديد", body: z.object({ username: z.string().regex(/^[a-z0-9._-]{3,20}$/i, "اسم المستخدم 3–20 حرفًا إنجليزيًا أو رقمًا"), name: z.string().min(1).max(80), password: z.string().min(MIN_PW, `كلمة المرور ${MIN_PW} أحرف فأكثر`).max(200), role: role.default("pm") }) },
    preHandler: app.requirePerm("users", "edit"),
  }, async (req, reply) => {
    const b = req.body, un = b.username.toLowerCase();
    const dup = await db.select({ id: users.id }).from(users).where(eq(users.username, un)).limit(1);
    if (dup.length) throw conflict("هذا المستخدم موجود", "duplicate_user");
    const [u] = await db.insert(users).values({ username: un, name: b.name, role: b.role as Role, passwordHash: await hashPassword(b.password) }).returning();
    await setPerms(db, u.id, defaultPerms(b.role as Role));
    await audit(req, "user_add", { entity: "user", entityId: u.id, detail: `${un} · ${b.name}` });
    reply.code(201);
    return detail(u);
  });

  r.patch("/api/v1/users/:id", {
    schema: { tags, params: idp, body: z.object({ name: z.string().min(1).max(80).optional(), role: role.optional(), active: z.boolean().optional(), allContractors: z.boolean().optional(), contractorIds: z.array(z.string().uuid()).optional() }) },
    preHandler: app.requirePerm("users", "edit"),
  }, async (req) => {
    const u = await getUserById(db, req.params.id); if (!u) throw notFound("المستخدم غير موجود");
    const b = req.body, self = u.id === req.auth!.user.id;
    if (self && (b.role !== undefined && b.role !== u.role)) throw forbidden("لا يمكنك تغيير دور حسابك");
    if (self && b.active === false) throw forbidden("لا يمكنك إيقاف حسابك");
    if (u.role === "admin" && ((b.role && b.role !== "admin") || b.active === false) && (await activeAdmins(u.id)) < 1) throw badRequest("لا يمكن إيقاف أو تخفيض مدير النظام الوحيد");
    const set: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (b.name !== undefined) set.name = b.name;
    if (b.active !== undefined) set.active = b.active;
    if (b.allContractors !== undefined) set.allContractors = b.allContractors;
    if (b.role !== undefined && b.role !== u.role) set.role = b.role as Role;
    await db.update(users).set(set).where(eq(users.id, u.id));
    if (b.role !== undefined && b.role !== u.role) { await setPerms(db, u.id, defaultPerms(b.role as Role)); await audit(req, "role", { entityId: u.id, detail: `${u.username} → ${b.role}` }); }
    if (b.active !== undefined && b.active !== u.active) {
      await audit(req, "user_tog", { entityId: u.id, detail: `${u.username} → ${b.active ? "active" : "suspended"}` });
      if (!b.active) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, u.id));
    }
    if (b.name !== undefined && b.name !== u.name) await audit(req, "user_ren", { entityId: u.id, detail: `${u.username} → ${b.name}` });
    if (b.contractorIds) { await setUserContractors(db, u.id, b.contractorIds); await audit(req, "user_contractors", { entityId: u.id, detail: b.contractorIds.length + " contractors" }); }
    return detail((await getUserById(db, u.id))!);
  });

  r.put("/api/v1/users/:id/permissions", {
    schema: { tags, summary: "تعديل مصفوفة الصلاحيات (عرض/تعديل/حذف/تصدير لكل وحدة)", params: idp, body: z.object({ perms: permShape.optional(), reset: z.boolean().optional() }) },
    preHandler: app.requirePerm("users", "edit"),
  }, async (req) => {
    const u = await getUserById(db, req.params.id); if (!u) throw notFound("المستخدم غير موجود");
    if (u.role === "admin") throw forbidden("مدير النظام يملك كل الصلاحيات دائمًا ولا يمكن تقييده");
    let perms: PermMap = req.body.reset ? defaultPerms(u.role as Role) : (req.body.perms as PermMap | undefined) ?? await getPerms(db, u);
    perms = Object.fromEntries(MODULE_IDS.map((m) => [m, perms[m] ?? { view: 0, edit: 0, del: 0, exp: 0 }])) as PermMap;
    await setPerms(db, u.id, perms);
    await audit(req, "perm", { entityId: u.id, detail: `${u.username} · ${req.body.reset ? "reset" : "updated"}` });
    return { perms: await getPerms(db, u) };
  });

  r.post("/api/v1/users/:id/password", {
    schema: { tags, summary: "تعيين كلمة مرور جديدة (مدير النظام)", params: idp, body: z.object({ password: z.string().min(MIN_PW, `كلمة المرور ${MIN_PW} أحرف فأكثر`).max(200) }) },
    preHandler: app.requirePerm("users", "edit"),
  }, async (req) => {
    const u = await getUserById(db, req.params.id); if (!u) throw notFound("المستخدم غير موجود");
    await db.update(users).set({ passwordHash: await hashPassword(req.body.password), failedLogins: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(users.id, u.id));
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, u.id));
    await audit(req, "user_pwd", { entityId: u.id, detail: u.username });
    return { ok: true };
  });

  r.delete("/api/v1/users/:id", { schema: { tags, params: idp }, preHandler: app.requirePerm("users", "del") }, async (req) => {
    const u = await getUserById(db, req.params.id); if (!u) throw notFound("المستخدم غير موجود");
    if (u.id === req.auth!.user.id) throw forbidden("لا يمكنك حذف حسابك");
    if (u.role === "admin" && (await activeAdmins(u.id)) < 1) throw badRequest("لا يمكن حذف مدير النظام الوحيد");
    await db.delete(users).where(eq(users.id, u.id));
    await audit(req, "user_del", { entityId: u.id, detail: u.username });
    return { ok: true };
  });

  r.get("/api/v1/audit-log", { schema: { tags, summary: "سجل الأحداث", querystring: z.object({ limit: z.coerce.number().min(1).max(500).default(100), offset: z.coerce.number().min(0).default(0) }) }, preHandler: app.requirePerm("users", "view") }, async (req) => {
    const rows = await db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(req.query.limit).offset(req.query.offset);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(auditLog);
    return { total: n, items: rows };
  });
  r.delete("/api/v1/audit-log", { schema: { tags, summary: "تفريغ السجل" }, preHandler: app.requirePerm("users", "del") }, async (req) => {
    await audit(req, "audit_clear");
    await db.delete(auditLog).where(sql`${auditLog.action} <> 'audit_clear'`);
    return { ok: true };
  });
}
