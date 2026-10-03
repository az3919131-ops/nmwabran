import { eq } from "drizzle-orm";
import { cloneCatalog, deckStats, derive, type Catalog, type FileRec } from "@iltizam/core";
import type { AppCtx } from "../app";
import type { Tx } from "../db/client";
import { uploadedFiles } from "../db/schema";
import { notFound } from "../lib/errors";
import { loadCatalog, persistCatalogDiff } from "../repo/catalog";
import { loadProject, saveProject, takeSnapshot, type ApiProject } from "../repo/projects";

export interface MutCtx { p: ApiProject; cat: Catalog; tx: Tx; ctx: AppCtx }
export interface MutOpts { snapshot?: string }

/** يحمّل المشروع داخل معاملة، يطبّق fn، ثم يحفظ المشروع والمكتبة. يعيد المشروع المُحدَّث ونتيجة fn. */
export async function mutateProject<R>(ctx: AppCtx, id: string, opts: MutOpts, fn: (m: MutCtx) => Promise<R>): Promise<{ project: ApiProject; result: R; varCrossed: boolean }> {
  const out = await ctx.db.transaction(async (tx) => {
    const cat = await loadCatalog(tx);
    const before = cloneCatalog(cat);
    const p = await loadProject(tx, id, cat);
    if (!p) throw notFound("المشروع غير موجود");
    const wasOver = Math.abs(deckStats(p, cat).varPct) > 30;
    if (opts.snapshot) await takeSnapshot(tx, p, opts.snapshot);
    const prevAt = p.derived?.at ?? null;
    const result = await fn({ p, cat, tx, ctx });
    await saveProject(tx, p, { derived: p.derived ? (p.derived.at !== prevAt ? true : "keep") : false });
    await persistCatalogDiff(tx, before, cat);
    const nowOver = Math.abs(deckStats(p, cat).varPct) > 30;
    return { result, varCrossed: !wasOver && nowOver };
  });
  const cat = await loadCatalog(ctx.db);
  const project = (await loadProject(ctx.db, id, cat))!;
  return { project, result: out.result, varCrossed: out.varCrossed };
}

export function fileToRow(projectId: string, rec: FileRec, o: { storageKey?: string | null; mime?: string; uploadedBy?: string | null }) {
  return {
    id: rec.id, workOrderId: projectId, name: rec.name, size: rec.size, mime: o.mime ?? rec.type ?? "", ext: rec.ext, kind: rec.kind,
    status: rec.blocked ? "blocked" : rec.imported ? "imported" : rec.kind === "data" ? "failed" : "reference", rows: rec.rows || 0,
    storageKey: o.storageKey ?? null, ident: rec.ident ?? null, woState: rec.woState ?? null, report: rec.rep ?? [], geoN: rec.geoN ?? 0, uploadedBy: o.uploadedBy ?? null,
  };
}
export async function insertFile(tx: Tx, projectId: string, rec: FileRec, o: { storageKey?: string | null; mime?: string; uploadedBy?: string | null }): Promise<void> {
  await tx.insert(uploadedFiles).values(fileToRow(projectId, rec, o));
}
export async function updateFile(tx: Tx, projectId: string, rec: FileRec): Promise<void> {
  const { id, workOrderId, storageKey, uploadedBy, ...rest } = fileToRow(projectId, rec, {});
  void id; void workOrderId; void storageKey; void uploadedBy;
  await tx.update(uploadedFiles).set(rest).where(eq(uploadedFiles.id, rec.id));
}
export const rederive = (p: ApiProject, cat: Catalog) => { if (p.derived) p.derived = derive(p, cat); };
