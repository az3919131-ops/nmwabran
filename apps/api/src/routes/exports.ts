import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  allProjPts, csvAllDoc, csvDoc, dxfDoc, geojsonDoc, invoiceSheets, kmlAllDoc, kmlDoc, makeT, projectSheets, svgDoc, tallySheet, withSignature, type Lang,
} from "@iltizam/core";
import { audit } from "../lib/audit";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { loadCatalog } from "../repo/catalog";
import { contractorName, listProjects, loadProject, projectContractorId, type ApiProject } from "../repo/projects";
import { userHasContractor } from "../repo/users";
import { buildXlsx } from "../services/xlsxwriter";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ascii = (s: string) => String(s || "").replace(/[^\x20-\x7E]/g, "").trim();
const today = () => new Date().toISOString().slice(0, 10);

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  const ctx = app.ctx, db = ctx.db;
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["exports"];
  const L = (v: unknown): Lang => (v === "en" ? "en" : "ar");

  const needAccess = async (req: FastifyRequest, id: string) => {
    const cid = await projectContractorId(db, id);
    if (!cid) throw notFound("المشروع غير موجود");
    if (req.auth && !(await userHasContractor(db, req.auth.user, cid))) throw forbidden("لا تملك صلاحية على مقاول هذا المشروع", "contractor_forbidden");
    return cid;
  };
  const modFor = (kind: string) => (kind === "xlsx" ? "qty" : kind === "invoice" ? "inv" : kind === "tally" ? "master" : "map");

  r.get("/api/v1/projects/:id/export/:kind", {
    schema: { tags, summary: "تصدير مشروع: xlsx | invoice | tally | kml | dxf | csv | geojson | svg", params: z.object({ id: z.string().uuid(), kind: z.enum(["xlsx", "invoice", "tally", "kml", "dxf", "csv", "geojson", "svg"]) }), querystring: z.object({ lang: z.enum(["ar", "en"]).default("ar") }) },
    preHandler: app.requireUserOrKey("read:projects", (req) => modFor((req.params as { kind: string }).kind), "exp"),
  }, async (req, reply) => {
    const cid = await needAccess(req, req.params.id);
    const lang = L(req.query.lang), T = makeT(lang);
    const cat = await loadCatalog(db);
    const p = await loadProject(db, req.params.id, cat);
    if (!p) throw notFound("المشروع غير موجود");
    const cn = await contractorName(db, cid);
    const base = ascii(p.wo) || "project";
    const send = (name: string, mime: string, body: string | Buffer) => reply.header("Content-Type", mime).header("Content-Disposition", `attachment; filename="${name}"`).send(body);
    await audit(req, "exported", { entity: "project", entityId: p.id, detail: req.params.kind });
    switch (req.params.kind) {
      case "xlsx": return send(`takeoff-${base}-${today()}.xlsx`, XLSX_MIME, await buildXlsx(withSignature(projectSheets(p, cat, lang), lang), lang));
      case "invoice": {
        void ctx.events.emit("invoice.generated", { projectId: p.id, wo: p.wo, inv: p.inv?.no ?? "" });
        return send(`invoice-${base}-${p.inv?.no || "1"}.xlsx`, XLSX_MIME, await buildXlsx(withSignature(invoiceSheets(p, cat, lang, cn), lang), lang));
      }
      case "tally": return send(`tally-template-${base}.xlsx`, XLSX_MIME, await buildXlsx(tallySheet(p, lang), lang));
      case "kml": if (!p.rmus.length && !p.geo?.length) throw badRequest(T("لا توجد إحداثيات في جدول ضبط الحماية", "No coordinates in the protection table"), "no_geo"); return send(`${base}-map.kml`, "application/vnd.google-earth.kml+xml", kmlDoc(p, cn, { lang, T, cat }));
      case "dxf": return send(`${base}-map.dxf`, "application/dxf", dxfDoc(p));
      case "csv": return send(`${base}-map-mymaps.csv`, "text/csv; charset=utf-8", csvDoc(p));
      case "geojson": return send(`${base}-map.geojson`, "application/geo+json", geojsonDoc(p));
      case "svg": { const s = svgDoc(p); if (!s) throw badRequest(T("لا توجد إحداثيات في جدول ضبط الحماية", "No coordinates in the protection table"), "no_geo"); return send(`${base}-map-cad.svg`, "image/svg+xml", s); }
    }
  });

  /** «كل مشاريع الالتزام — تجميع جوجل إيرث»: KML/CSV لكل المشاريع المحددة (مجلد لكل أمر عمل) */
  r.get("/api/v1/portfolio/export/:kind", {
    schema: { tags, summary: "تجميع كل المشاريع على Google Earth (KML/CSV)", params: z.object({ kind: z.enum(["kml", "csv"]) }), querystring: z.object({ ids: z.string().optional(), coord: z.enum(["0", "1"]).default("1"), lang: z.enum(["ar", "en"]).default("ar") }) },
    preHandler: app.requirePerm("map", "exp"),
  }, async (req, reply) => {
    const lang = L(req.query.lang), T = makeT(lang), cat = await loadCatalog(db);
    const projects = await listProjects(db, cat, req.auth!.contractorIds);
    const want = req.query.ids ? new Set(req.query.ids.split(",")) : null;
    const gs = allProjPts(projects).filter((g) => g.n && (!want || want.has(g.id)));
    if (!gs.length) throw badRequest(T("اختر مشروعًا واحدًا على الأقل به إحداثيات", "Select at least one project that has coordinates"), "no_geo");
    const names = new Map<string, string>();
    for (const p of projects) if (!names.has(p.contractorId)) names.set(p.contractorId, await contractorName(db, p.contractorId));
    const coord = req.query.coord === "1";
    const stamp = today();
    await audit(req, "exported", { detail: "portfolio " + req.params.kind });
    if (req.params.kind === "csv") return reply.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", `attachment; filename="projects-${stamp}-mymaps.csv"`).send(csvAllDoc(gs, coord, T) + "\r\n\r\n" + '"Project manager","Eng. Ahmed Zahran"');
    const title = T("تجميع مشاريع ", "Portfolio — ") + [...new Set(gs.map((g) => names.get(projects[g.i].contractorId) ?? ""))].join("، ");
    return reply.header("Content-Type", "application/vnd.google-earth.kml+xml").header("Content-Disposition", `attachment; filename="projects-${stamp}.kml"`)
      .send(kmlAllDoc(gs, projects, (p) => names.get((p as ApiProject).contractorId) ?? "", title, coord, { lang, T, cat }));
  });
}
