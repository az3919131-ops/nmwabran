import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { MODULES, PM_NAME, PM_ROLE_EN, ROLES, newProject } from "@iltizam/core";
import { contractors } from "../db/schema";
import { audit } from "../lib/audit";
import { badRequest } from "../lib/errors";
import { loadCatalog } from "../repo/catalog";
import { insertProject, listProjects, projectDto } from "../repo/projects";
import { publicUser } from "./auth";

export async function coreRoutes(app: FastifyInstance): Promise<void> {
  const ctx = app.ctx, db = ctx.db;
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get("/api/v1/health", { schema: { tags: ["system"], summary: "فحص الصحة" }, config: { rateLimit: false } }, async () => {
    await db.execute(sql`select 1`);
    return { ok: true, service: "iltizam-api", time: new Date().toISOString() };
  });

  /** كل ما تحتاجه الواجهة بعد الدخول في طلب واحد */
  r.get("/api/v1/bootstrap", { schema: { tags: ["system"], summary: "بيانات بدء التشغيل: المستخدم والصلاحيات والمقاولون والمشاريع والمكتبة" }, preHandler: app.authenticate }, async (req) => {
    const a = req.auth!;
    const cat = await loadCatalog(db);
    const cs = await db.select().from(contractors).orderBy(asc(contractors.sortOrder), asc(contractors.createdAt));
    const list = a.contractorIds ? cs.filter((c) => a.contractorIds!.includes(c.id)) : cs;
    const projects = await listProjects(db, cat, a.contractorIds);
    return {
      user: publicUser(a.user), perms: a.perms, unlocked: a.unlocked, adminEmail: ctx.cfg.ADMIN_EMAIL, roles: ROLES, modules: MODULES,
      contractors: list.map((c) => ({ id: c.id, name: c.name, crNumber: c.crNumber, contactName: c.contactName })),
      projects: projects.map((p) => projectDto(p)), catalog: cat,
      features: { ai: ctx.ai.enabled, mailProvider: ctx.mail.name, pdf: !ctx.cfg.DISABLE_PDF },
    };
  });

  /* نسخة احتياطية: كل المقاولين والمشاريع (JSON) */
  r.get("/api/v1/backup", { schema: { tags: ["system"], summary: "نسخة احتياطية JSON للمقاولين والمشاريع" }, preHandler: app.requirePerm("dash", "exp") }, async (req, reply) => {
    const cat = await loadCatalog(db);
    const projects = await listProjects(db, cat, req.auth!.contractorIds);
    const cs = await db.select().from(contractors);
    await audit(req, "exported", { detail: "backup" });
    const body = { v: 1, at: new Date().toISOString(), platform: "Contractor Project Portfolio / محفظة الالتزام", role: PM_ROLE_EN, project_manager: PM_NAME,
      contractors: cs.filter((c) => projects.some((p) => p.contractorId === c.id)).map((c) => ({ id: c.id, name: c.name })), projects: projects.map((p) => projectDto(p, { files: [] })) };
    reply.header("Content-Disposition", `attachment; filename="portfolio-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    return body;
  });
  /** استعادة غير مدمّرة: تُضاف مشاريع النسخة كمشاريع جديدة (بدون استبدال الموجود) */
  r.post("/api/v1/restore", { schema: { tags: ["system"], summary: "استعادة نسخة احتياطية (إضافة مشاريعها كمشاريع جديدة)", body: z.object({ projects: z.array(z.record(z.string(), z.unknown())).min(1).max(500), contractors: z.array(z.object({ id: z.string(), name: z.string() })).optional() }) }, preHandler: app.requirePerm("dash", "edit") }, async (req) => {
    const all = await db.select().from(contractors);
    let added = 0;
    for (const raw of req.body.projects) {
      const cname = req.body.contractors?.find((c) => c.id === raw.contractorId)?.name;
      let c = (cname ? all.find((x) => x.name === cname) : undefined) ?? all.find((x) => x.id === raw.contractorId) ?? all[0];
      if (cname && !all.some((x) => x.name === cname)) { [c] = await db.insert(contractors).values({ name: cname, sortOrder: all.length }).returning(); all.push(c); }
      if (req.auth!.contractorIds && !req.auth!.contractorIds.includes(c.id)) continue;
      const base = { ...newProject(String(raw.name ?? "مشروع مستعاد"), String(raw.wo ?? "")), ...(raw as object) } as ReturnType<typeof newProject>;
      await db.transaction((tx) => insertProject(tx, { ...base, files: [], contractorId: c.id }, { derived: !!raw.derived }));
      added++;
    }
    if (!added) throw badRequest("لا توجد مشاريع صالحة في الملف", "empty_backup");
    await audit(req, "restore", { detail: added + " projects" });
    return { added };
  });
  void eq;
}
