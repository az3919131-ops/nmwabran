import { AUTHORITY, DEFAULT_FACTORS, MATERIALS, SHEET_FIELDS, WORKS } from "./catalog";
import type { AuthorityStep, Catalog, Derived, Lang, Project, Totals } from "./types";

export const DEFAULT_CATALOG: Catalog = { materials: MATERIALS, works: WORKS };
export const cloneCatalog = (c: Catalog = DEFAULT_CATALOG): Catalog => ({
  materials: c.materials.map((m) => ({ ...m })), works: c.works.map((w) => ({ ...w })),
});

/** إجماليات حصر اللوحات */
export function totals(p: Pick<Project, "sheets">): Totals {
  const t: Totals = {};
  SHEET_FIELDS.forEach((g) => g.f.forEach((f) => (t[f[0]] = 0)));
  p.sheets.forEach((s) => SHEET_FIELDS.forEach((g) => g.f.forEach((f) => (t[f[0]] += +(s[f[0]] as number) || 0))));
  t.rmuNew = t.rmu3w + t.rmu4w;
  t.trTot = t.tr220 + t.tr400 + t.trIndoor;
  t.trench = t.asHT1 + t.saHT1 + t.asHT2 + t.saHT2 + t.asHT3 + t.saHT3 + t.saHT4 + t.asLT13 + t.saLT13 + t.saLT4;
  return t;
}

/** محرك الاستنباط — منقول كما هو من المنصة الحالية (كود SEC + واقع مشروع الحصينية). */
export function derive(p: Pick<Project, "sheets" | "factors">, cat: Catalog = DEFAULT_CATALOG): Derived {
  const t = totals(p), F = p.factors, w = 1 + (+F.wastePct || 0) / 100, up = (n: number) => Math.ceil(n);
  const works: Record<string, number> = {
    "301010201": t.saHT1, "301010205": t.asHT1, "301010202": t.saHT2, "301010206": t.asHT2,
    "301010203": t.saHT3, "301010204": t.saHT4, "301010101": t.saLT13, "301010103": t.asLT13, "301010102": t.saLT4,
    "304010202": t.htCable, "304010203": t.mvSingle, "304010101": t.lt185 + t.lt70, "304010102": t.lt300,
    "306010002": t.asphalt, "306010004": t.milling, "302020001": t.hdd,
    "305020104": Math.max(t.joints, up(t.htCable / (+F.drumLen || 1000))),
    "305020404": t.term3x400,
    "305020407": +F.elbowPhases * (t.trTot + t.riser400),
    "305010301": t.lt185Term + t.lt70Term, "305010302": t.lt300Term,
    "308020101": t.rmuNew, "308020105": t.trTot,
    "309020101": t.rmuNew, "309020203": t.trTot,
    "310020001": t.rmuNew, "310010001": t.pillars, "309010102": t.pillars,
    "207000006": t.riserRem,
    "604000002": +F.bollardPerRMU * (t.rmuNew + t.trTot),
    "201040003": t.poleSteel, "201040006": t.poleWood,
    "205040101": t.trPole1, "205040102": t.trPole2,
    "204020301": t.condMV, "204010301": t.abcLV,
    "304040205": t.riserRem, "205040206": t.lbsRem,
    "311000016": up(t.term3x400 / 2) * (+F.vlfPerSection || 1),
    "307010002": up(t.trench / 800), "307010005": up(t.trench / 800),
    "307040002": Math.max(t.asphalt + t.milling > 0 ? 1 : 0, up((t.asphalt + t.milling) / 2500)),
  };
  const mats: Record<string, number> = {
    "8114005": Math.round(t.htCable * w), "8111007": Math.round(t.lt300 * w),
    "8111006": Math.round(t.lt185 * w), "8111005": Math.round(t.lt70 * w),
    "8113009": Math.round(t.mvSingle * w),
    "8327004": t.rmu3w, "8327005": t.rmu4w,
    "8567054": t.tr220 + t.tr400, "8569108": t.trIndoor,
    "8121179": works["305020104"],
    "8121182": +F.elbowPerTR * t.trTot + +F.elbowPhases * t.riser400,
    "8121139": +F.elbowPhases * Math.round(t.mvSingle / 12),
    "8121008": +F.elbowPhases * t.riser400,
    "8121009": t.lt185Term, "8121010": t.lt300Term,
    "8111102": +F.cuPerRMU * t.rmuNew, "8111101": +F.cuPerTR * t.trTot,
    "8202054": +F.rodsPerRMU * t.rmuNew + +F.rodsPerTR * t.trTot + +F.rodsPerPillar * t.pillars,
    "8202189": +F.cConnPerRMU * t.rmuNew, "8202098": +F.clampPerTR * t.trTot,
    "8202030": +F.connPerTR * t.trTot, "8122034": +F.luPerRMU * t.rmuNew,
  };
  let wc = 0, mc = 0;
  cat.works.forEach((x) => { wc += (works[x.c] || 0) * x.p; });
  cat.materials.forEach((x) => { mc += (mats[x.c] || 0) * x.p; });
  const ind = ((mc + wc) * (+p.factors.indirectPct || 0)) / 100;
  return { works, mats, t, cost: { mat: mc, inst: wc, ind, total: mc + wc + ind }, at: new Date().toISOString() };
}

export function authorityStep(pct: number): AuthorityStep {
  return AUTHORITY.find((x) => Math.abs(pct) <= x.max) || AUTHORITY[AUTHORITY.length - 1];
}
export function authorityFor(pct: number, lang: Lang): string {
  const a = authorityStep(pct);
  return lang === "ar" ? a.ar : a.en;
}
export { DEFAULT_FACTORS };
