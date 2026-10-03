import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  authorityFor, cloneCatalog, deckStats, defaultInvoice, derive, dig, hassiniya as _h, newProject, readCsvText, runDerive, type FileRec, type GeoConflict, type Lang, type Rep, type SheetData,
} from "@iltizam/core";
import { uploadedFiles, workOrders } from "../db/schema";
import { audit } from "../lib/audit";
import { badRequest, conflict, forbidden, locked, notFound } from "../lib/errors";
import { importLogWrite } from "../services/importlog";
import { loadCatalog } from "../repo/catalog";
import {
  contractorName, deleteProject, hasSnapshot, insertProject, listProjects, loadProject, popSnapshot, projectContractorId, projectDto, saveProject, type ApiProject,
} from "../repo/projects";
import { userHasContractor } from "../repo/users";
import { extOf, finishImport, importParsed, importSection, makeEnv, processFiles, readParsed, refreshProject, type UploadedBlob } from "../services/imports";
import { insertFile, mutateProject, updateFile } from "../services/projects";
import { readDocxText, readXlsx } from "../services/readers";
import { contractors } from "../db/schema";
void _h;

const lang = z.enum(["ar", "en"]).default("ar");
const num = z.coerce.number().finite();
const sheetShape = z.record(z.string(), z.union([z.string(), z.number()]));
const putBody = z.object({
  name: z.string().min(1).max(200).optional(), wo: z.string().max(40).optional(), site: z.string().max(300).optional(), admin: z.string().max(200).optional(), sector: z.string().max(200).optional(),
  approvedDate: z.string().max(20).optional(),
  estCost: z.object({ mat: num, inst: num, ind: num }).optional(),
  sheets: z.array(sheetShape).min(1).max(60).optional(),
  factors: z.record(z.string(), num).optional(),
  boq: z.record(z.string(), z.object({ plan: num, exec: num })).optional(),
  mat: z.record(z.string(), z.object({ iss: num, req: num })).optional(),
  rmus: z.array(z.object({ no: num, feeder: z.string(), rmu: z.string().min(1), type: z.string(), tr: z.string(), relay: z.string(), model: z.string(), set: z.boolean(), ratio: z.string(), ohm: z.union([z.string(), z.number()]).transform(String), gps: z.string(), gpsSrc: z.string().optional() })).max(5000).optional(),
  notes: z.string().max(20000).optional(),
  inv: z.object({ no: z.string(), date: z.string(), period: z.string(), retentionPct: num, deduct: num, prev: num, vatPct: num, useVat: z.boolean() }).optional(),
  accept: z.record(z.string(), z.unknown()).optional(),
  derived: z.boolean().optional(),
  expectedVersion: z.number().int().optional(),
});

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  const ctx = app.ctx, db = ctx.db;
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["projects"];
  const idp = z.object({ id: z.string().uuid() });
  const fidp = z.object({ id: z.string().uuid(), fid: z.string().uuid() });

  /** عزل المقاولين: لا وصول لمشروع مقاول لا يملكه المستخدم */
  const guardProject = async (req: FastifyRequest, id: string): Promise<string> => {
    const cid = await projectContractorId(db, id);
    if (!cid) throw notFound("المشروع غير موجود");
    if (req.auth && !(await userHasContractor(db, req.auth.user, cid))) throw forbidden("لا تملك صلاحية على مقاول هذا المشروع", "contractor_forbidden");
    return cid;
  };
  const anyEdit = (req: FastifyRequest, mods: string[]) => {
    const a = req.auth!;
    if (!mods.some((m) => a.perms[m]?.edit)) throw forbidden("لا تملك صلاحية التعديل في هذه الصفحة");
    if (!a.unlocked) throw locked();
  };
  const emit = (event: string, payload: Record<string, unknown>) => { void Promise.resolve(ctx.events.emit(event, payload)).catch(() => {}); };

  r.get("/api/v1/projects", { schema: { tags, summary: "مشاريع المستخدم (حسب المقاولين المسموح بهم)" }, preHandler: app.authenticate }, async (req) => {
    const cat = await loadCatalog(db);
    return (await listProjects(db, cat, req.auth!.contractorIds)).map((p) => projectDto(p));
  });
  r.get("/api/v1/projects/:id", { schema: { tags, params: idp }, preHandler: app.requireUserOrKey("read:projects", "dash", "view") }, async (req) => {
    if (req.auth) await guardProject(req, req.params.id);
    const cat = await loadCatalog(db);
    const p = await loadProject(db, req.params.id, cat);
    if (!p) throw notFound("المشروع غير موجود");
    return projectDto(p, { canUndo: await hasSnapshot(db, p.id) });
  });

  r.post("/api/v1/projects", {
    schema: { tags, summary: "مشروع جديد (أو نسخ مشروع)", body: z.object({ name: z.string().min(1).max(200), wo: z.string().max(40).default(""), contractorId: z.string().uuid(), copyFromId: z.string().uuid().optional() }) },
    preHandler: app.requirePerm("firms", "edit"),
  }, async (req, reply) => {
    const { name, wo, contractorId, copyFromId } = req.body;
    if (!(await userHasContractor(db, req.auth!.user, contractorId))) throw forbidden("لا تملك صلاحية على هذا المقاول", "contractor_forbidden");
    const [c] = await db.select({ id: contractors.id }).from(contractors).where(eq(contractors.id, contractorId)).limit(1);
    if (!c) throw badRequest("المقاول غير موجود");
    const cat = await loadCatalog(db);
    let base = newProject(name, wo);
    let derived = false;
    if (copyFromId) {
      await guardProject(req, copyFromId);
      const src = await loadProject(db, copyFromId, cat);
      if (!src) throw notFound("المشروع المنسوخ غير موجود");
      base = { ...JSON.parse(JSON.stringify(src)), name, wo: wo || src.wo, files: [] }; derived = !!src.derived;
    }
    const id = await db.transaction((tx) => insertProject(tx, { ...base, contractorId }, { derived }));
    await audit(req, "project_add", { entity: "project", entityId: id, detail: `${name} · ${wo}` });
    emit("project.created", { projectId: id, name, wo, contractorId });
    reply.code(201);
    return projectDto((await loadProject(db, id, cat))!);
  });

  r.put("/api/v1/projects/:id", {
    schema: { tags, summary: "تعديل بيانات المشروع (الاستبدال الجزئي لكل حقل مُرسَل)", params: idp, body: putBody },
    preHandler: app.authenticate,
  }, async (req) => {
    await guardProject(req, req.params.id);
    const b = req.body;
    const need: string[][] = [];
    if (b.name !== undefined || b.wo !== undefined || b.site !== undefined || b.admin !== undefined || b.sector !== undefined || b.sheets || b.factors) need.push(["master"]);
    if (b.boq || b.mat) need.push(["boq", "wages", "inv", "master"]);
    if (b.rmus || b.accept) need.push(["forms", "master", "map"]);
    if (b.inv) need.push(["inv"]);
    if (b.notes !== undefined) need.push(["wages", "recs", "master"]);
    if (b.estCost || b.approvedDate !== undefined) need.push(["master", "wages"]);
    for (const m of need) anyEdit(req, m);
    if (!need.length) anyEdit(req, ["master"]);
    const { project, varCrossed } = await mutateProject(ctx, req.params.id, {}, async ({ p, cat }) => {
      if (b.expectedVersion != null && p.version !== b.expectedVersion) throw conflict("عُدّل المشروع من مكان آخر — أعد التحميل", "version_conflict");
      if (b.name !== undefined) p.name = b.name; if (b.wo !== undefined) p.wo = b.wo; if (b.site !== undefined) p.site = b.site;
      if (b.admin !== undefined) p.admin = b.admin; if (b.sector !== undefined) p.sector = b.sector; if (b.approvedDate !== undefined) p.approvedDate = b.approvedDate;
      if (b.estCost) p.estCost = b.estCost;
      if (b.sheets) p.sheets = b.sheets.map((s, i) => ({ ...s, name: String(s.name ?? "لوحة " + (i + 1)) }));
      if (b.factors) p.factors = { ...p.factors, ...b.factors };
      if (b.boq) p.boq = b.boq; if (b.mat) p.mat = b.mat; if (b.rmus) p.rmus = b.rmus.map((x) => ({ ...x }));
      if (b.notes !== undefined) p.notes = b.notes; if (b.inv) p.inv = b.inv; if (b.accept) p.accept = b.accept;
      if (b.derived === false) p.derived = null;
      else if (b.derived === true || p.derived) p.derived = derive(p, cat);
    });
    await audit(req, "project_edit", { entity: "project", entityId: req.params.id, detail: Object.keys(b).filter((k) => k !== "expectedVersion").join(",") });
    if (varCrossed) emit("variance.exceeded_30pct", { projectId: project.id, wo: project.wo, varPct: deckStats(project, await loadCatalog(db)).varPct });
    return projectDto(project, { canUndo: await hasSnapshot(db, project.id) });
  });

  r.delete("/api/v1/projects/:id", { schema: { tags, params: idp }, preHandler: app.requirePerm("firms", "del") }, async (req) => {
    await guardProject(req, req.params.id);
    const files = await db.select().from(uploadedFiles).where(eq(uploadedFiles.workOrderId, req.params.id));
    const p = await db.select({ n: workOrders.name, w: workOrders.woNumber }).from(workOrders).where(eq(workOrders.id, req.params.id)).limit(1);
    await db.transaction((tx) => deleteProject(tx, req.params.id));
    for (const f of files) if (f.storageKey) await ctx.storage.delete(f.storageKey).catch(() => {});
    await audit(req, "project_del", { entity: "project", entityId: req.params.id, detail: `${p[0]?.n} · ${p[0]?.w}` });
    return { ok: true };
  });

  r.post("/api/v1/projects/:id/move", { schema: { tags, summary: "نقل مشروع إلى مقاول آخر", params: idp, body: z.object({ contractorId: z.string().uuid() }) }, preHandler: app.requirePerm("firms", "edit") }, async (req) => {
    await guardProject(req, req.params.id);
    if (!(await userHasContractor(db, req.auth!.user, req.body.contractorId))) throw forbidden("لا تملك صلاحية على المقاول المنقول إليه", "contractor_forbidden");
    const [c] = await db.select().from(contractors).where(eq(contractors.id, req.body.contractorId)).limit(1);
    if (!c) throw badRequest("المقاول غير موجود");
    await db.update(workOrders).set({ contractorId: c.id, updatedAt: new Date() }).where(eq(workOrders.id, req.params.id));
    await audit(req, "project_move", { entity: "project", entityId: req.params.id, detail: "→ " + c.name });
    return projectDto((await loadProject(db, req.params.id, await loadCatalog(db)))!);
  });

  /* ───────── الاستنباط ───────── */
  r.post("/api/v1/projects/:id/derive", {
    schema: { tags, summary: "استنباط الحصر وكل النماذج (+ مراجعة فنية بالذكاء الاصطناعي إن فُعِّل)", params: idp, body: z.object({ lang, ai: z.boolean().default(true) }).default({}) },
    preHandler: app.requirePerm("import", "edit"),
  }, async (req) => {
    await guardProject(req, req.params.id);
    let empty = false;
    const { project } = await mutateProject(ctx, req.params.id, { snapshot: "derive" }, async ({ p, cat }) => {
      const env = makeEnv(p, cat, req.body.lang, true);
      empty = !runDerive(env);
    });
    if (empty) return reply400(`ارفع الملفات أو أدخل حصر اللوحات أولًا`);
    let notes: string | null = null;
    if (req.body.ai && ctx.ai.enabled) {
      try { const cat = await loadCatalog(db); notes = await ctx.ai.review(project, cat, project.files.map((f) => ({ ملف: f.name, نوع: f.ext, أمر_العمل: f.ident?.wo ?? "—", موقوف: !!f.blocked }))); } catch { notes = null; }
    }
    await audit(req, "derive", { entity: "project", entityId: project.id });
    emit("takeoff.derived", { projectId: project.id, wo: project.wo, cost: project.derived?.cost });
    return projectDto(project, { aiNotes: notes, aiEnabled: ctx.ai.enabled, canUndo: true });
  });
  const reply400 = (m: string): never => { throw badRequest(m, "nothing_to_derive"); };

  r.post("/api/v1/projects/:id/refresh", {
    schema: { tags, summary: "تحديث واستكمال: يعيد قراءة الملفات المحفوظة ويملأ النواقص", params: idp, body: z.object({ lang, page: z.string().default("dash") }).default({}) },
    preHandler: app.requirePerm("import", "edit"),
  }, async (req) => {
    await guardProject(req, req.params.id);
    let rep: Rep[] = [];
    const { project } = await mutateProject(ctx, req.params.id, { snapshot: "refresh" }, async ({ p, cat }) => { rep = await refreshProject(ctx, p, cat, req.body.lang, req.body.page); });
    await importLogWrite(db, { projectId: project.id, userId: req.auth!.user.id, kind: "refresh", summary: "تحديث واستكمال", report: rep });
    await audit(req, "refresh", { entity: "project", entityId: project.id });
    return projectDto(project, { report: rep, canUndo: true });
  });

  r.post("/api/v1/projects/:id/backfill", { schema: { tags, summary: "اشتقاق حصر اللوحات من المستورد", params: idp, body: z.object({ lang }).default({}) }, preHandler: app.requirePerm("import", "edit") }, async (req) => {
    await guardProject(req, req.params.id);
    const { backfillTally } = await import("@iltizam/core");
    const rep: Rep[] = [];
    let ok = false;
    const { project } = await mutateProject(ctx, req.params.id, { snapshot: "backfill" }, async ({ p, cat }) => { ok = backfillTally(makeEnv(p, cat, req.body.lang, true), rep); });
    if (!ok) throw badRequest("لا توجد بيانات مستوردة كافية للاشتقاق", "not_enough_data");
    return projectDto(project, { report: rep, canUndo: true });
  });

  /* ───────── رفع الملفات والاستيراد ───────── */
  const readUpload = async (req: FastifyRequest): Promise<{ blobs: UploadedBlob[]; fields: Record<string, string> }> => {
    const blobs: UploadedBlob[] = []; const fields: Record<string, string> = {};
    for await (const part of req.parts()) {
      if (part.type === "file") { const buf = await part.toBuffer(); if (buf.length) blobs.push({ name: part.filename, mime: part.mimetype, buf }); }
      else fields[part.fieldname] = String(part.value ?? "");
    }
    return { blobs, fields };
  };
  const storeKey = (pid: string, fid: string, name: string) => `projects/${pid}/${fid}/${name.replace(/[^\w.\-؀-ۿ]+/g, "_")}`;
  const mergeConflicts = (p: ApiProject, c: GeoConflict[]) => {
    const cur = p.geoConflicts ?? [];
    for (const x of c) if (!cur.some((y) => y.id === x.id && y.b === x.b)) cur.push(x);
    p.geoConflicts = cur;
  };

  r.post("/api/v1/projects/:id/files", { schema: { tags, summary: "رفع ملفات المشروع (إكسل/PDF/Word/صور/KML...) — تُقرأ وتُستورد وتُطابق هويتها", params: idp }, preHandler: app.requirePerm("import", "edit") }, async (req) => {
    await guardProject(req, req.params.id);
    const { blobs, fields } = await readUpload(req);
    if (!blobs.length) throw badRequest("لم يُرسل أي ملف", "no_files");
    const L = (fields.lang === "en" ? "en" : "ar") as Lang, guard = fields.guard !== "0" && fields.guard !== "false";
    let report: Rep[] = [];
    const { project } = await mutateProject(ctx, req.params.id, { snapshot: "upload" }, async ({ p, cat, tx }) => {
      const res = await processFiles(ctx, p, cat, blobs, { lang: L, guard, ai: ctx.ai });
      report = res.rep;
      mergeConflicts(p, res.conflicts);
      const env = makeEnv(p, cat, L, guard);
      finishImport(env, report);
      for (const { rec, blob } of res.recs) {
        const key = storeKey(p.id, rec.id, rec.name);
        await ctx.storage.put(key, blob.buf, blob.mime);
        await insertFile(tx, p.id, rec, { storageKey: key, mime: blob.mime, uploadedBy: req.auth?.user.id ?? null });
      }
    });
    const blocked = project.files.filter((f) => f.blocked).length;
    await importLogWrite(db, { projectId: project.id, userId: req.auth?.user.id ?? null, kind: "upload", summary: blobs.map((b) => b.name).join(" · "), report });
    await audit(req, "imported", { entity: "project", entityId: project.id, detail: `${blobs.length} files · ${blocked} blocked` });
    emit("import.completed", { projectId: project.id, wo: project.wo, files: blobs.map((b) => b.name), blocked });
    return projectDto(project, { report, blocked, canUndo: true });
  });

  r.post("/api/v1/projects/:id/import/:kind", {
    schema: { tags, summary: "استيراد مستقل لقسم واحد: tally | boq | mat | units | geo", params: z.object({ id: z.string().uuid(), kind: z.enum(["tally", "boq", "mat", "units", "geo"]) }) },
    preHandler: app.requirePerm("import", "edit"),
  }, async (req) => {
    await guardProject(req, req.params.id);
    const { blobs, fields } = await readUpload(req);
    if (!blobs.length) throw badRequest("لم يُرسل أي ملف", "no_files");
    const L = (fields.lang === "en" ? "en" : "ar") as Lang;
    const rep: Rep[] = [];
    const sheets: { name: string; sheets: SheetData[] }[] = [];
    for (const b of blobs) {
      const ext = extOf(b.name);
      if (["xlsx", "xlsm"].includes(ext)) sheets.push({ name: b.name, sheets: await readXlsx(b.buf) });
      else if (ext === "csv") sheets.push({ name: b.name, sheets: readCsvText(b.buf.toString("utf8")) });
      else rep.push(["skip", L === "ar" ? `«${b.name}»: يلزم ملف إكسل أو CSV لهذا القسم` : `“${b.name}”: this section needs an Excel or CSV file`]);
    }
    const { project } = await mutateProject(ctx, req.params.id, { snapshot: "section:" + req.params.kind }, async ({ p, cat }) => {
      const env = makeEnv(p, cat, L, true);
      importSection(env, req.params.kind, sheets, rep);
      mergeConflicts(p, env.conflicts);
    });
    await importLogWrite(db, { projectId: project.id, userId: req.auth!.user.id, kind: "section:" + req.params.kind, summary: blobs.map((b) => b.name).join(" · "), report: rep });
    await audit(req, "imported", { entity: "project", entityId: project.id, detail: "section " + req.params.kind });
    emit("import.completed", { projectId: project.id, wo: project.wo, section: req.params.kind });
    return projectDto(project, { report: rep, canUndo: true });
  });

  /** عرض أصل الملف المرفوع (إكسل بأوراقه/PDF/صورة...) */
  r.get("/api/v1/projects/:id/files/:fid/original", { schema: { tags, params: fidp }, preHandler: app.requirePerm("master", "view") }, async (req, reply) => {
    await guardProject(req, req.params.id);
    const [f] = await db.select().from(uploadedFiles).where(and(eq(uploadedFiles.id, req.params.fid), eq(uploadedFiles.workOrderId, req.params.id))).limit(1);
    if (!f || !f.storageKey) throw notFound("أصل الملف غير محفوظ — أعد رفعه");
    const s = await ctx.storage.get(f.storageKey);
    if (!s) throw notFound("أصل الملف غير محفوظ — أعد رفعه");
    const safe = /^(application\/pdf|image\/(png|jpe?g|gif|webp|bmp)|text\/plain|text\/csv|application\/vnd\.openxmlformats|application\/octet-stream|application\/json|application\/vnd\.google-earth)/.test(f.mime);
    reply.header("Content-Type", safe ? f.mime : "application/octet-stream").header("X-Content-Type-Options", "nosniff").header("Content-Security-Policy", "sandbox")
      .header("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    return reply.send(s.data);
  });
  /** أوراق الإكسل المقروءة (لعارض الأصل داخل المنصة) */
  r.get("/api/v1/projects/:id/files/:fid/sheets", { schema: { tags, params: fidp }, preHandler: app.requirePerm("master", "view") }, async (req) => {
    await guardProject(req, req.params.id);
    const [f] = await db.select().from(uploadedFiles).where(and(eq(uploadedFiles.id, req.params.fid), eq(uploadedFiles.workOrderId, req.params.id))).limit(1);
    if (!f?.storageKey) throw notFound("أصل الملف غير محفوظ — أعد رفعه");
    const s = await ctx.storage.get(f.storageKey);
    if (!s) throw notFound("أصل الملف غير محفوظ");
    if (["xlsx", "xlsm"].includes(f.ext)) return { sheets: (await readXlsx(s.data)).map((x) => ({ name: x.name, rows: x.rows.slice(0, 600), total: x.rows.length })) };
    if (f.ext === "csv") return { sheets: readCsvText(s.data.toString("utf8")).map((x) => ({ name: x.name, rows: x.rows.slice(0, 600), total: x.rows.length })) };
    if (["txt", "kml", "gpx", "geojson", "json", "xml"].includes(f.ext)) return { text: s.data.toString("utf8").slice(0, 200000) };
    if (f.ext === "docx") return { text: (await readDocxText(s.data)).slice(0, 200000) };
    throw badRequest("لا يمكن عرض هذه الصيغة داخل المنصة", "unsupported_preview");
  });

  const reimport = async (req: FastifyRequest<{ Params: { id: string; fid: string } }>, force: boolean, L: Lang) => {
    await guardProject(req, req.params.id);
    const [row] = await db.select().from(uploadedFiles).where(and(eq(uploadedFiles.id, req.params.fid), eq(uploadedFiles.workOrderId, req.params.id))).limit(1);
    if (!row?.storageKey) throw badRequest("أعد رفع الملف لاستيراده", "no_original");
    const stored = await ctx.storage.get(row.storageKey);
    if (!stored) throw badRequest("أعد رفع الملف لاستيراده", "no_original");
    const rep: Rep[] = [];
    const { project } = await mutateProject(ctx, req.params.id, { snapshot: force ? "force" : "reimport" }, async ({ p, cat, tx }) => {
      const env = makeEnv(p, cat, L, true);
      const parsed = await readParsed(row.ext, { name: row.name, mime: row.mime, buf: stored.data }, cat);
      const rec: FileRec = { id: row.id, name: row.name, size: row.size, type: row.mime, ext: row.ext, kind: row.kind, imported: false, rows: 0, at: new Date().toISOString(), rep: [], ident: (row.ident as any) ?? undefined, woState: (row.woState as any) ?? undefined };
      await importParsed(env, rec, parsed, rep, ctx.ai);
      mergeConflicts(p, env.conflicts);
      if (force) { rec.blocked = false; rec.imported = true; rep.unshift(["warn", L === "ar" ? `استُورد «${row.name}» رغم اختلاف رقم أمر العمل — راجع الكميات` : `“${row.name}” imported despite the work-order difference — review the quantities`]); }
      rec.rep = rep.slice();
      runDerive(env);
      await updateFile(tx, p.id, rec);
    });
    await importLogWrite(db, { projectId: project.id, userId: req.auth!.user.id, kind: force ? "force" : "reimport", summary: row.name, report: rep });
    await audit(req, force ? "import_force" : "reimport", { entity: "project", entityId: project.id, detail: row.name });
    return projectDto(project, { report: rep, canUndo: true });
  };
  const langBody = z.object({ lang }).default({});
  r.post("/api/v1/projects/:id/files/:fid/reimport", { schema: { tags, params: fidp, body: langBody }, preHandler: app.requirePerm("import", "edit") }, async (req) => reimport(req as never, false, req.body.lang));
  r.post("/api/v1/projects/:id/files/:fid/force", { schema: { tags, summary: "استورد رغم اختلاف أمر العمل", params: fidp, body: langBody }, preHandler: app.requirePerm("import", "edit") }, async (req) => reimport(req as never, true, req.body.lang));

  r.delete("/api/v1/projects/:id/files/:fid", { schema: { tags, params: fidp }, preHandler: app.requirePerm("import", "del") }, async (req) => {
    await guardProject(req, req.params.id);
    const [f] = await db.delete(uploadedFiles).where(and(eq(uploadedFiles.id, req.params.fid), eq(uploadedFiles.workOrderId, req.params.id))).returning();
    if (f?.storageKey) await ctx.storage.delete(f.storageKey).catch(() => {});
    await audit(req, "file_del", { entity: "project", entityId: req.params.id, detail: f?.name });
    return projectDto((await loadProject(db, req.params.id, await loadCatalog(db)))!);
  });

  /** مسح الملفات المرفوعة لمشروع واحد (+ اختياريًا البيانات المستوردة منها) لإعادة الرفع من نظيف */
  r.post("/api/v1/projects/:id/files/clear", {
    schema: { tags, summary: "مسح الملفات المرفوعة للمشروع", params: idp, body: z.object({ wipeData: z.boolean().default(false) }).default({}) },
    preHandler: app.requirePerm("import", "del"),
  }, async (req) => {
    await guardProject(req, req.params.id);
    const files = await db.select().from(uploadedFiles).where(eq(uploadedFiles.workOrderId, req.params.id));
    const { project } = await mutateProject(ctx, req.params.id, { snapshot: "clear" }, async ({ p, tx }) => {
      await tx.delete(uploadedFiles).where(eq(uploadedFiles.workOrderId, p.id));
      if (req.body.wipeData) { const b = newProject(p.name, p.wo); p.sheets = b.sheets; p.derived = null; p.boq = {}; p.mat = {}; p.rmus = []; p.accept = {}; p.geo = []; p.geoConflicts = []; }
    });
    for (const f of files) if (f.storageKey) await ctx.storage.delete(f.storageKey).catch(() => {});
    await audit(req, "files_cleared", { entity: "project", entityId: req.params.id, detail: `${project.wo} · ${files.length}${req.body.wipeData ? " + data" : ""}` });
    return projectDto(project, { cleared: files.length, canUndo: true });
  });

  r.post("/api/v1/projects/:id/adopt-wo", { schema: { tags, summary: "اعتمد رقم أمر العمل الموجود في الملفات", params: idp, body: z.object({ wo: z.string().min(6).max(20) }) }, preHandler: app.requirePerm("import", "edit") }, async (req) => {
    await guardProject(req, req.params.id);
    const { project } = await mutateProject(ctx, req.params.id, { snapshot: "adopt" }, async ({ p, tx }) => {
      p.wo = dig(req.body.wo);
      const f = p.files.find((x) => x.ident && dig(x.ident.wo || "") === p.wo && x.ident.name);
      if (f?.ident?.name) p.name = f.ident.name;
      if (f?.ident?.site) p.site = f.ident.site;
      void tx;
    });
    await audit(req, "adopt_wo", { entity: "project", entityId: project.id, detail: project.wo });
    return projectDto(project, { canUndo: true });
  });

  r.post("/api/v1/projects/:id/undo", { schema: { tags, summary: "التراجع عن آخر استيراد", params: idp }, preHandler: app.requirePerm("import", "edit") }, async (req) => {
    await guardProject(req, req.params.id);
    const cat = await loadCatalog(db);
    await db.transaction(async (tx) => {
      const snap = await popSnapshot(tx, req.params.id);
      if (!snap) throw badRequest("لا يوجد استيراد للتراجع عنه", "nothing_to_undo");
      const d = snap.data;
      const keep = new Set(d.fileIds);
      const cur = await tx.select().from(uploadedFiles).where(eq(uploadedFiles.workOrderId, req.params.id));
      for (const f of cur) if (!keep.has(f.id)) { await tx.delete(uploadedFiles).where(eq(uploadedFiles.id, f.id)); if (f.storageKey) await ctx.storage.delete(f.storageKey).catch(() => {}); }
      const p = await loadProject(tx, req.params.id, cat);
      await saveProject(tx, { ...(d as unknown as ApiProject), files: p?.files ?? [], contractorId: d.contractorId }, { derived: d.derived ? true : false });
    });
    await audit(req, "undo_import", { entity: "project", entityId: req.params.id });
    return projectDto((await loadProject(db, req.params.id, cat))!, { canUndo: await hasSnapshot(db, req.params.id) });
  });

  /* ───────── الإحداثيات ───────── */
  r.post("/api/v1/projects/:id/geo/scan", { schema: { tags, summary: "التقاط كل الإحداثيات من الملفات المحفوظة", params: idp, body: langBody }, preHandler: app.requirePerm("import", "edit") }, async (req) => {
    await guardProject(req, req.params.id);
    const rep: Rep[] = [];
    const { project } = await mutateProject(ctx, req.params.id, { snapshot: "geoscan" }, async ({ p, cat }) => {
      const env = makeEnv(p, cat, req.body.lang, true);
      const { bookGeo, mergeGeo, readGeoText, textGeo, matchGeoUnits } = await import("@iltizam/core");
      let n = 0, scanned = 0;
      for (const f of p.files) {
        if (f.blocked || !f.storageKey) continue;
        const s = await ctx.storage.get(f.storageKey); if (!s) continue;
        const parsed = await readParsed(f.ext, { name: f.name, mime: f.type, buf: s.data }, cat);
        let pts: { id?: string; lat: number; lon: number; src?: string; type?: string }[] | null = null;
        if (parsed.sheets) pts = bookGeo(parsed.sheets, f.name, env.T);
        else if (parsed.text != null) pts = ["kml", "gpx", "geojson", "json", "kmz"].includes(f.ext) ? [...readGeoText(parsed.text, f.name), ...textGeo(parsed.text, f.name)] : textGeo(parsed.text, f.name);
        if (!pts) continue;
        scanned++;
        const k = mergeGeo(env, pts, null, f.name); f.geoN = (f.geoN || 0) + k; n += k;
      }
      rep.push([n ? "ok" : "warn", n ? env.T(`مسح ${scanned} ملف — ${n} إحداثي جديد أُضيف`, `Scanned ${scanned} file(s) — ${n} new coordinates added`) : env.T(`مسح ${scanned} ملف — لا إحداثيات جديدة`, `Scanned ${scanned} file(s) — no new coordinates`)]);
      matchGeoUnits(env, rep);
    });
    return projectDto(project, { report: rep, canUndo: true });
  });
  r.post("/api/v1/projects/:id/geo/use-source", { schema: { tags, summary: "اعتمد إحداثيات ملف عند تعارض الإحداثيات", params: idp, body: z.object({ src: z.string().min(1) }) }, preHandler: app.requirePerm("import", "edit") }, async (req) => {
    await guardProject(req, req.params.id);
    let n = 0;
    const { project } = await mutateProject(ctx, req.params.id, { snapshot: "usesrc" }, async ({ p }) => {
      for (const c of (p.geoConflicts ?? []).filter((x) => x.bSrc === req.body.src)) {
        const q = p.rmus.find((r2) => r2.rmu === c.id); if (!q) continue;
        const keep = q.gps; q.gps = c.b; q.gpsSrc = c.bSrc; c.b = keep; c.bSrc = c.aSrc; c.a = q.gps; c.aSrc = req.body.src; n++;
      }
    });
    await audit(req, "geo_use_source", { entity: "project", entityId: project.id, detail: `${req.body.src} · ${n}` });
    return projectDto(project, { applied: n, canUndo: true });
  });
  r.delete("/api/v1/projects/:id/geo", { schema: { tags, summary: "مسح النقاط المستخرجة", params: idp }, preHandler: app.requirePerm("import", "del") }, async (req) => {
    await guardProject(req, req.params.id);
    const { project } = await mutateProject(ctx, req.params.id, {}, async ({ p }) => { p.geo = []; });
    await audit(req, "geo_clear", { entity: "project", entityId: project.id });
    return projectDto(project);
  });

  r.post("/api/v1/projects/:id/ai/review", { schema: { tags, summary: "مراجعة فنية بالذكاء الاصطناعي (Claude على الخادم)", params: idp }, preHandler: app.requirePerm("ai", "view") }, async (req) => {
    await guardProject(req, req.params.id);
    if (!ctx.ai.enabled) throw new (await import("../lib/errors")).HttpError(503, "المساعد الذكي غير مُهيّأ — ضع ANTHROPIC_API_KEY في بيئة الخادم", "ai_disabled");
    const cat = await loadCatalog(db);
    const p = await loadProject(db, req.params.id, cat);
    if (!p?.derived) throw badRequest("شغّل الاستنباط أولًا", "not_derived");
    return { notes: await ctx.ai.review(p, cat, p.files.map((f) => ({ ملف: f.name, نوع: f.ext, أمر_العمل: f.ident?.wo ?? "—", موقوف: !!f.blocked }))) };
  });
  void authorityFor; void defaultInvoice; void cloneCatalog; void contractorName;
}
