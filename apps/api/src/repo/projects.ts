import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { DEFAULT_FACTORS, derive, type Catalog, type FileRec, type GeoConflict, type GeoPoint, type Project, type RmuRow, type Sheet } from "@iltizam/core";
import type { DB, Tx } from "../db/client";
import {
  contractors, geoPoints, layoutSheets, materialLines, projectSnapshots, rmuUnits, uploadedFiles, workOrderLines, workOrders,
} from "../db/schema";

/** مشروع كما يراه الـ API: نموذج core + معرّف المقاول (UUID) بدل الفهرس */
export type ApiProject = Project & { contractorId: string; version: number; updatedAt: string; createdAt: string; geoConflicts: GeoConflict[] };

/** ما يُرسل للعميل: بلا مفاتيح التخزين الداخلية */
export function projectDto(p: ApiProject, extra: Record<string, unknown> = {}) {
  return { ...p, files: p.files.map(({ storageKey, ...f }) => { void storageKey; return f; }), ...extra };
}

const n = (x: string | number | null | undefined) => (x == null || x === "" ? 0 : Number(x));
type Q = DB | Tx;

function toFileRec(f: typeof uploadedFiles.$inferSelect): FileRec {
  return {
    id: f.id, name: f.name, size: f.size, type: f.mime, ext: f.ext, kind: f.kind,
    imported: f.status === "imported", blocked: f.status === "blocked", rows: f.rows, at: f.createdAt.toISOString(),
    rep: (f.report as FileRec["rep"]) ?? [], ident: (f.ident as FileRec["ident"]) ?? undefined,
    woState: (f.woState as FileRec["woState"]) ?? undefined, geoN: f.geoN, hasOriginal: !!f.storageKey, storageKey: f.storageKey ?? undefined,
  };
}

/** يجمّع مشاريع من الجداول (6 استعلامات بغضّ النظر عن عدد المشاريع) */
async function assemble(db: Q, rows: (typeof workOrders.$inferSelect)[], cat: Catalog): Promise<ApiProject[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [sh, ln, ml, ru, gp, fl] = await Promise.all([
    db.select().from(layoutSheets).where(inArray(layoutSheets.workOrderId, ids)).orderBy(asc(layoutSheets.idx)),
    db.select().from(workOrderLines).where(inArray(workOrderLines.workOrderId, ids)),
    db.select().from(materialLines).where(inArray(materialLines.workOrderId, ids)),
    db.select().from(rmuUnits).where(inArray(rmuUnits.workOrderId, ids)).orderBy(asc(rmuUnits.ord)),
    db.select().from(geoPoints).where(inArray(geoPoints.workOrderId, ids)).orderBy(asc(geoPoints.ord)),
    db.select().from(uploadedFiles).where(inArray(uploadedFiles.workOrderId, ids)).orderBy(asc(uploadedFiles.createdAt)),
  ]);
  return rows.map((w) => {
    const sheets: Sheet[] = sh.filter((s) => s.workOrderId === w.id).map((s) => ({ ...(s.fields as Record<string, number>), name: s.name }));
    const boq: Project["boq"] = {};
    ln.filter((l) => l.workOrderId === w.id).forEach((l) => { boq[l.code] = { plan: n(l.plan), exec: n(l.exec) }; });
    const mat: Project["mat"] = {};
    ml.filter((l) => l.workOrderId === w.id).forEach((l) => { mat[l.code] = { iss: n(l.issued), req: n(l.required) }; });
    const rmus: RmuRow[] = ru.filter((r) => r.workOrderId === w.id).map((r) => ({
      no: r.seq, feeder: r.feeder, rmu: r.rmu, type: r.type, tr: r.tr, relay: r.relay, model: r.model, set: r.setDone,
      ratio: r.ctRatio, ohm: r.earthOhm, gps: r.gps, ...(r.gpsSrc ? { gpsSrc: r.gpsSrc } : {}),
    }));
    const geo: GeoPoint[] = gp.filter((g) => g.workOrderId === w.id).map((g) => ({ id: g.pointId, lat: n(g.lat), lon: n(g.lon), src: g.src, type: g.type }));
    const factors = { ...DEFAULT_FACTORS, ...(w.factors as object) };
    const p: ApiProject = {
      id: w.id, name: w.name, wo: w.woNumber, admin: w.admin, sector: w.sector, contractor: 0, contractorId: w.contractorId,
      site: w.site, approvedDate: w.approvedDate, estCost: { mat: n(w.estMat), inst: n(w.estInst), ind: n(w.estInd) },
      sheets: sheets.length ? sheets : [], factors, files: fl.filter((f) => f.workOrderId === w.id).map(toFileRec),
      derived: null, boq, mat, rmus, accept: (w.accept as Record<string, unknown>) ?? {}, notes: w.notes, geo,
      ...(w.invoice ? { inv: w.invoice as Project["inv"] } : {}), ...(w.prevTotal != null ? { prevTotal: n(w.prevTotal) } : {}),
      geoConflicts: (w.geoConflicts as GeoConflict[]) ?? [], version: w.version, updatedAt: w.updatedAt.toISOString(), createdAt: w.createdAt.toISOString(),
    };
    if (w.derivedAt) { p.derived = derive(p, cat); p.derived.at = w.derivedAt.toISOString(); }
    return p;
  });
}

export async function loadProject(db: Q, id: string, cat: Catalog): Promise<ApiProject | null> {
  const rows = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
  return (await assemble(db, rows, cat))[0] ?? null;
}
export async function listProjects(db: Q, cat: Catalog, contractorIds: string[] | null): Promise<ApiProject[]> {
  if (contractorIds && !contractorIds.length) return [];
  const rows = await db.select().from(workOrders)
    .where(contractorIds ? inArray(workOrders.contractorId, contractorIds) : undefined).orderBy(asc(workOrders.createdAt), asc(workOrders.name));
  return assemble(db, rows, cat);
}
export async function projectContractorId(db: Q, id: string): Promise<string | null> {
  const r = await db.select({ c: workOrders.contractorId }).from(workOrders).where(eq(workOrders.id, id)).limit(1);
  return r[0]?.c ?? null;
}

function lat(g: string): { lat: string | null; lon: string | null } {
  const m = String(g || "").match(/(-?\d+(?:\.\d+)?)\s*[,،\s]\s*(-?\d+(?:\.\d+)?)/);
  return m ? { lat: Number(m[1]).toFixed(6), lon: Number(m[2]).toFixed(6) } : { lat: null, lon: null };
}

/** يكتب أبناء المشروع (استبدال كامل) — داخل معاملة */
async function writeChildren(tx: Tx, id: string, p: Project): Promise<void> {
  await Promise.all([
    tx.delete(layoutSheets).where(eq(layoutSheets.workOrderId, id)),
    tx.delete(workOrderLines).where(eq(workOrderLines.workOrderId, id)),
    tx.delete(materialLines).where(eq(materialLines.workOrderId, id)),
    tx.delete(rmuUnits).where(eq(rmuUnits.workOrderId, id)),
    tx.delete(geoPoints).where(eq(geoPoints.workOrderId, id)),
  ]);
  if (p.sheets.length) {
    await tx.insert(layoutSheets).values(p.sheets.map((s, i) => {
      const { name, ...fields } = s;
      return { workOrderId: id, idx: i, name: String(name || "لوحة " + (i + 1)), fields };
    }));
  }
  const bl = Object.entries(p.boq);
  if (bl.length) await tx.insert(workOrderLines).values(bl.map(([code, v]) => ({ workOrderId: id, code, plan: String(+v.plan || 0), exec: String(+v.exec || 0) })));
  const ml = Object.entries(p.mat);
  if (ml.length) await tx.insert(materialLines).values(ml.map(([code, v]) => ({ workOrderId: id, code, issued: String(+v.iss || 0), required: String(+v.req || 0) })));
  if (p.rmus.length) {
    await tx.insert(rmuUnits).values(p.rmus.map((r, i) => ({
      workOrderId: id, ord: i, seq: +r.no || i + 1, feeder: r.feeder || "", rmu: r.rmu, type: r.type || "", tr: r.tr || "", relay: r.relay || "—",
      model: r.model || "—", setDone: !!r.set, ctRatio: r.ratio || "", earthOhm: String(r.ohm ?? ""), gps: r.gps || "", gpsSrc: r.gpsSrc ?? null, ...lat(r.gps),
    })));
  }
  const geo = p.geo ?? [];
  if (geo.length) {
    await tx.insert(geoPoints).values(geo.map((g, i) => ({
      workOrderId: id, ord: i, pointId: String(g.id || "PT"), lat: (+g.lat).toFixed(6), lon: (+g.lon).toFixed(6), src: g.src || "", type: g.type || "PT",
    })));
  }
}

export interface SaveOpts { derived?: boolean | "keep"; expectedVersion?: number }

/** إنشاء مشروع جديد (أو نسخ). يعيد المعرّف. */
export async function insertProject(tx: Tx, p: Project & { contractorId: string }, opts: { derived: boolean }): Promise<string> {
  const [row] = await tx.insert(workOrders).values({
    woNumber: p.wo, name: p.name, site: p.site, admin: p.admin, sector: p.sector, contractorId: p.contractorId, approvedDate: p.approvedDate,
    estMat: String(p.estCost.mat), estInst: String(p.estCost.inst), estInd: String(p.estCost.ind),
    derivedAt: opts.derived ? new Date() : null, factors: p.factors, notes: p.notes, invoice: p.inv ?? null,
    prevTotal: p.prevTotal != null ? String(p.prevTotal) : null, accept: p.accept ?? {}, geoConflicts: (p as any).geoConflicts ?? [],
  }).returning({ id: workOrders.id });
  await writeChildren(tx, row.id, p);
  return row.id;
}

/** حفظ كامل لبيانات المشروع (الاستبدال) مع قفل تفاؤلي اختياري */
export async function saveProject(tx: Tx, p: Project & { contractorId?: string }, opts: SaveOpts = {}): Promise<void> {
  const cur = await tx.select({ v: workOrders.version, d: workOrders.derivedAt }).from(workOrders).where(eq(workOrders.id, p.id)).limit(1);
  if (!cur.length) throw new Error("project_not_found");
  if (opts.expectedVersion != null && cur[0].v !== opts.expectedVersion) throw new Error("version_conflict");
  const derivedAt = opts.derived === "keep" || opts.derived === undefined ? (p.derived ? cur[0].d ?? new Date() : null) : opts.derived ? new Date() : null;
  await tx.update(workOrders).set({
    woNumber: p.wo, name: p.name, site: p.site, admin: p.admin, sector: p.sector, ...(p.contractorId ? { contractorId: p.contractorId } : {}),
    approvedDate: p.approvedDate, estMat: String(p.estCost.mat), estInst: String(p.estCost.inst), estInd: String(p.estCost.ind),
    derivedAt, factors: p.factors, notes: p.notes, invoice: p.inv ?? null, prevTotal: p.prevTotal != null ? String(p.prevTotal) : null,
    accept: p.accept ?? {}, geoConflicts: (p as any).geoConflicts ?? [], version: cur[0].v + 1, updatedAt: new Date(),
  }).where(eq(workOrders.id, p.id));
  await writeChildren(tx, p.id, p);
}

export async function deleteProject(tx: Tx, id: string): Promise<void> {
  await tx.delete(workOrders).where(eq(workOrders.id, id));
}

/** لقطة قبل أي استيراد — للتراجع. نحتفظ بآخر 8 لقطات لكل مشروع. */
export async function takeSnapshot(tx: Tx, p: ApiProject, label: string): Promise<void> {
  const { files, ...rest } = p;
  await tx.insert(projectSnapshots).values({ workOrderId: p.id, label, data: { ...rest, fileIds: files.map((f) => f.id) } });
  const old = await tx.select({ id: projectSnapshots.id }).from(projectSnapshots).where(eq(projectSnapshots.workOrderId, p.id)).orderBy(desc(projectSnapshots.id)).offset(8);
  if (old.length) await tx.delete(projectSnapshots).where(inArray(projectSnapshots.id, old.map((o) => o.id)));
}
export async function popSnapshot(tx: Tx, projectId: string): Promise<{ label: string; data: Omit<ApiProject, "files"> & { fileIds: string[] } } | null> {
  const r = await tx.select().from(projectSnapshots).where(eq(projectSnapshots.workOrderId, projectId)).orderBy(desc(projectSnapshots.id)).limit(1);
  if (!r.length) return null;
  await tx.delete(projectSnapshots).where(and(eq(projectSnapshots.id, r[0].id)));
  return { label: r[0].label, data: r[0].data as Omit<ApiProject, "files"> & { fileIds: string[] } };
}
export async function hasSnapshot(db: Q, projectId: string): Promise<boolean> {
  const r = await db.select({ id: projectSnapshots.id }).from(projectSnapshots).where(eq(projectSnapshots.workOrderId, projectId)).limit(1);
  return r.length > 0;
}

export async function contractorName(db: Q, id: string): Promise<string> {
  const r = await db.select({ n: contractors.name }).from(contractors).where(eq(contractors.id, id)).limit(1);
  return r[0]?.n ?? "";
}
