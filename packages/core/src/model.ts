import { BASE_BOQ, BASE_MAT, DEFAULT_FACTORS, HASSINIYA_SHEETS, RMU_ROWS, SHEET_FIELDS } from "./catalog";
import { derive } from "./derive";
import type { Project, Sheet } from "./types";

export function blankSheet(n: number): Sheet {
  const s: Sheet = { name: "لوحة " + n };
  SHEET_FIELDS.forEach((g) => g.f.forEach((f) => (s[f[0]] = 0)));
  return s;
}

export function newProject(name: string, wo: string, id = "P" + Math.random().toString(36).slice(2, 8)): Project {
  return {
    id, name, wo, admin: "نجران", sector: "الجنوبي", contractor: 0, site: "", approvedDate: "",
    estCost: { mat: 0, inst: 0, ind: 0 }, sheets: [blankSheet(1)], factors: { ...DEFAULT_FACTORS }, files: [],
    derived: null, boq: {}, mat: {}, rmus: [], accept: {}, notes: "",
  };
}

/** مشروع الحصينية (أمر عمل 234022308) ببياناته الكاملة كما في المنصة الحالية. */
export function hassiniya(id?: string): Project {
  const p = newProject("مشروع تحويل طريق الحصينية", "234022308", id);
  p.site = "طريق الحصينية – نجران";
  p.approvedDate = "2023-06-22";
  p.estCost = { mat: 3988328.9, inst: 2107546.56, ind: 1418591.53 };
  p.sheets = HASSINIYA_SHEETS.map((s) => ({ ...s })) as Sheet[];
  p.boq = JSON.parse(JSON.stringify(BASE_BOQ));
  p.mat = JSON.parse(JSON.stringify(BASE_MAT));
  p.derived = derive(p);
  p.rmus = RMU_ROWS.map((r) => ({
    no: r[0], feeder: r[1], rmu: r[2], type: r[3], tr: r[4], relay: r[5], model: r[6], set: r[7], ratio: r[8], ohm: r[9], gps: r[10],
  }));
  return p;
}
