import { SHEET_FIELDS } from "./catalog";
import { DEFAULT_CATALOG, totals } from "./derive";
import { invoiceCalc, wagesCalc, revisionRows, boqCalc, WAGE_GROUPS } from "./calc";
import { qtyTable } from "./qty";
import { makeT } from "./i18n";
import { PM_NAME, PM_ROLE_AR, PM_ROLE_EN } from "./signature";
import type { Catalog, Lang, Project } from "./types";
import { ACCEPT_COLS } from "./catalog";

export type Cell = string | number;
export type SheetRows = [string, Cell[][]][];

/** أوراق تصدير المشروع الست (حصر اللوحات، الحصر المستنبط، المقايسة، موازنة المواد، فاتورة الأجور، ضبط الحماية) */
export function projectSheets(p: Project, cat: Catalog = DEFAULT_CATALOG, lang: Lang = "ar"): SheetRows {
  const T = makeT(lang), AR = lang === "ar", t = totals(p), d = p.derived, sheets: SheetRows = [];
  const s1: Cell[][] = [[T("البند", "Item"), ...p.sheets.map((s, i) => s.name || "لوحة " + (i + 1)), T("الإجمالي", "Total")]];
  SHEET_FIELDS.forEach((g) => {
    s1.push([T(g.g, g.gEn)]);
    g.f.forEach((f) => s1.push([T(f[1], f[2]), ...p.sheets.map((s) => +(s[f[0]] as number) || 0), +t[f[0]]]));
  });
  sheets.push([T("حصر اللوحات", "Sheet tally"), s1]);

  const s2: Cell[][] = [[T("الصنف", "Class"), T("رقم البند", "Code"), T("الوصف", "Description"), T("الوحدة", "Unit"), T("الكمية", "Qty"), T("سعر الوحدة", "Rate"), T("الإجمالي", "Total")]];
  if (d) {
    cat.materials.forEach((m) => { const q = d.mats[m.c] || 0; if (q) s2.push([m.k === "main" ? T("مادة رئيسية", "Main") : T("مادة تفصيلية", "Detail"), m.c, AR ? m.ar : m.en, m.u, q, m.p, +(q * m.p).toFixed(2)]); });
    cat.works.forEach((x) => { const q = d.works[x.c] || 0; if (q) s2.push([T("أجور", "Works"), x.c, AR ? x.ar : x.en, x.u, q, x.p, +(q * x.p).toFixed(2)]); });
    s2.push([T("إجمالي المواد", "Materials total"), "", "", "", "", "", Math.round(d.cost.mat)]);
    s2.push([T("إجمالي التركيبات", "Works total"), "", "", "", "", "", Math.round(d.cost.inst)]);
    s2.push([T("تكاليف غير مباشرة", "Indirect"), "", "", "", "", "", Math.round(d.cost.ind)]);
    s2.push([T("التكلفة الإجمالية", "Grand total"), "", "", "", "", "", Math.round(d.cost.total)]);
  }
  sheets.push([T("الحصر المستنبط", "Derived takeoff"), s2]);

  const s3: Cell[][] = [[T("رقم البند", "Code"), T("الوصف", "Description"), T("الوحدة", "Unit"), T("السعر", "Rate"), T("المخطط", "Planned"), T("المنفّذ", "Executed"), T("الكروكي", "Layout"), T("فرق الكمية", "Qty diff"), T("تكلفة الفرق", "Cost diff")]];
  cat.works.forEach((x) => {
    const b = p.boq[x.c] || ({} as any), pl = +b.plan || 0, ex = +b.exec || 0, der = d ? d.works[x.c] || 0 : 0;
    if (pl || ex || der) s3.push([x.c, AR ? x.ar : x.en, x.u, x.p, pl, ex, +der, +(ex - pl).toFixed(2), +((ex - pl) * x.p).toFixed(2)]);
  });
  sheets.push([T("المقايسة والمقارنة", "BOQ variance"), s3]);

  const s4: Cell[][] = [[T("رقم المادة", "Code"), T("الوصف", "Description"), T("الوحدة", "Unit"), T("السعر", "Rate"), T("المصروف", "Issued"), T("المطلوب", "Required"), T("الكروكي", "Layout"), T("العجز", "Gap"), T("قيمة الفرق", "Value")]];
  cat.materials.forEach((m) => {
    const b = p.mat[m.c] || ({} as any), is = +b.iss || 0, rq = +b.req || 0, der = d ? d.mats[m.c] || 0 : 0;
    if (is || rq || der) s4.push([m.c, AR ? m.ar : m.en, m.u, m.p, is, rq, +der, +(rq - is).toFixed(2), +((rq - is) * m.p).toFixed(2)]);
  });
  sheets.push([T("موازنة المواد", "Material balance"), s4]);

  const s5: Cell[][] = [[T("رقم البند", "Code"), T("الوصف", "Description"), T("الوحدة", "Unit"), T("الكمية المنفّذة", "Executed qty"), T("سعر الوحدة", "Rate"), T("القيمة", "Value")]];
  let wtot = 0;
  cat.works.forEach((x) => { const q = +(p.boq[x.c] || ({} as any)).exec || 0; if (q) { wtot += q * x.p; s5.push([x.c, AR ? x.ar : x.en, x.u, q, x.p, +(q * x.p).toFixed(2)]); } });
  s5.push([T("إجمالي الأجور", "Wages total"), "", "", "", "", Math.round(wtot)]);
  sheets.push([T("فاتورة الأجور", "Wages invoice"), s5]);

  sheets.push([T("ضبط الحماية", "Protection"), protectionRows(p, lang)]);
  return sheets;
}
export function protectionRows(p: Project, lang: Lang): Cell[][] {
  const T = makeT(lang);
  const s6: Cell[][] = [["#", T("المغذي", "Feeder"), T("رقم الوحدة", "RMU"), T("النوع", "Type"), T("المحول", "TR"), T("مصنّع الريلاي", "Relay"), T("الموديل", "Model"), T("اكتمال الضبط", "Setting done"), T("نسبة CT", "CT ratio"), T("التأريض أوم", "Earth Ω"), T("الإحداثيات", "GPS")]];
  p.rmus.forEach((r) => s6.push([+r.no, r.feeder, r.rmu, r.type, r.tr || "", r.relay, r.model, r.set ? T("نعم", "Yes") : T("لا", "No"), r.ratio || "", +r.ohm || 0, r.gps || ""]));
  return s6;
}
export function acceptanceRows(p: Project, lang: Lang): Cell[][] {
  const T = makeT(lang);
  const rows: Cell[][] = [["#", T("المغذي", "Feeder"), T("الوحدة", "Unit"), T("النوع", "Type"), ...ACCEPT_COLS.map((c) => T(c[1], c[2])), T("التأريض Ω", "Earth Ω")]];
  p.rmus.forEach((r) => rows.push([+r.no, r.feeder, r.rmu, r.type, ...ACCEPT_COLS.map(() => "OK"), +r.ohm || 0]));
  return rows;
}

/** الفاتورة: ثلاث أوراق (فاتورة الأجور، فاتورة المواد، الملخص) — ترويسات عربية كما في المنصة الحالية */
export function invoiceSheets(p: Project, cat: Catalog, lang: Lang, contractorName: string): SheetRows {
  const c = invoiceCalc(p, cat, lang), { works, mats, iv } = c;
  const head: Cell[][] = [["المشروع", p.name], ["أمر العمل", p.wo], ["المقاول", contractorName], ["رقم المستخلص", iv.no], ["التاريخ", iv.date], ["الفترة", iv.period], []];
  const s1: Cell[][] = [...head, ["#", "رقم البند", "الوصف", "الوحدة", "السعر", "المخطط", "المنفّذ", "القيمة"],
    ...works.map((x, i) => [i + 1, x.c, x.name, x.u, x.p, x.plan, x.q, Math.round(x.amt)] as Cell[]),
    ["", "", "", "", "", "", "إجمالي الأجور", Math.round(c.wSum)]];
  const s2: Cell[][] = [...head, ["#", "رقم المادة", "الوصف", "الوحدة", "التصنيف", "السعر", "المصروف", "المركّب", "الفرق", "القيمة"],
    ...mats.map((x, i) => [i + 1, x.c, x.name, x.u, x.k === "main" ? "رئيسية" : "تفصيلية", x.p, x.iss, x.req, x.req - x.iss, Math.round(x.amt)] as Cell[]),
    ["", "", "", "", "", "", "", "", "إجمالي المواد", Math.round(c.mSum)]];
  const s3: Cell[][] = [...head, ["البند", "القيمة (ر.س)"], ["إجمالي الأجور", Math.round(c.wSum)], ["إجمالي المواد", Math.round(c.mSum)],
    [`التكاليف غير المباشرة ${p.factors.indirectPct}%`, Math.round(c.ind)], ["الإجمالي قبل الخصومات", Math.round(c.gross)],
    [`المحتجز ${iv.retentionPct}%`, -Math.round(c.ret)], ["استقطاعات", -Math.round(+iv.deduct || 0)],
    ["مستخلصات سابقة", -Math.round(+iv.prev || 0)], ...(iv.useVat ? [[`ضريبة ${iv.vatPct}%`, Math.round(c.vat)] as Cell[]] : []),
    ["صافي المستحق", Math.round(c.net)]];
  return [["فاتورة الأجور", s1], ["فاتورة المواد", s2], ["الملخص", s3]];
}
/** قالب حصر اللوحات (إكسل) */
export function tallySheet(p: Project, lang: Lang): SheetRows {
  const T = makeT(lang), t = totals(p);
  const rows: Cell[][] = [[T("البند", "Item"), ...p.sheets.map((s, i) => s.name || "لوحة " + (i + 1)), T("الإجمالي", "Total")]];
  SHEET_FIELDS.forEach((g) => { rows.push([T(g.g, g.gEn)]); g.f.forEach((f) => rows.push([T(f[1], f[2]), ...p.sheets.map((s) => +(s[f[0]] as number) || 0), +t[f[0]]])); });
  return [[T("حصر اللوحات", "Sheet tally"), rows]];
}
/** الحصر الشامل كأوراق */
export function qtySheet(p: Project, cat: Catalog, lang: Lang): SheetRows {
  const T = makeT(lang), q = qtyTable(p, cat, lang);
  const rows: Cell[][] = [[T("البند", "Item"), T("الوحدة", "Unit"), T("من الكروكي", "From layout"), T("المستنبط", "Derived"), T("المخطط بالمقايسة", "BOQ plan"), T("المنفّذ", "Executed"), T("الفرق", "Variance"), T("ملاحظة", "Note")]];
  q.sections.forEach((s) => {
    rows.push([T(s.head, s.headEn)]);
    s.rows.forEach((r) => { const dv = (r.exec || 0) - (r.plan || 0); rows.push([T(r.lab, r.labEn), r.unit, r.layout ?? "", r.derived ?? "", r.plan ?? "", r.exec ?? "", r.plan != null || r.exec != null ? dv : "", T(r.note ?? "", r.noteEn ?? r.note ?? "")]); });
  });
  if (q.extraW.length || q.extraM.length) {
    rows.push([T("بنود ومواد مستوردة خارج جدول الحصر", "Imported items outside the takeoff table")]);
    [...q.extraW, ...q.extraM].forEach((x) => rows.push([`${x.c} — ${x.n}`, x.u, "", "", x.pl, x.ex, x.ex - x.pl, `${T("السعر", "Rate")} ${x.pr}`]));
  }
  return [[T("الحصر الشامل", "Full takeoff"), rows]];
}
/** نموذج تعديل المقايسة (02) */
export function revisionSheet(p: Project, cat: Catalog, lang: Lang, contractorName: string): SheetRows {
  const T = makeT(lang), w = wagesCalc(p, cat), rv = revisionRows(p, cat);
  const names: Record<string, [string, string]> = { mat: ["تكلفة المواد", "Materials"], inst: ["تكلفة التركيبات", "Installations"], ind: ["التكاليف غير المباشرة", "Indirect"] };
  const rows: Cell[][] = [
    [T("نموذج تعديل مقايسة – 02", "BOQ Revision – Form 02")],
    [T("المشروع", "Project"), p.name], [T("أمر العمل", "Work order"), p.wo], [T("المقاول", "Contractor"), contractorName],
    [T("الإدارة", "Dept"), p.admin], [T("القطاع", "Sector"), p.sector], [T("تاريخ اعتماد المقايسة", "BOQ approved"), p.approvedDate], [],
    [T("تكلفة المقايسة", "BOQ cost"), T("التقديرية", "Estimated"), T("آخر اعتماد سابق", "Last approval"), T("الاعتماد الحالي", "Current approval"), T("الفرق ريال", "Diff SAR"), T("النسبة %", "%")],
    ...rv.map((x) => [T(names[x.key][0], names[x.key][1]), Math.round(x.est), Math.round(x.prev), Math.round(x.cur), Math.round(x.cur - x.est), x.est ? +(((x.cur - x.est) / x.est) * 100).toFixed(2) : ""] as Cell[]),
    [T("التكلفة الإجمالية", "Total cost"), Math.round(w.estTotal), Math.round(w.prevTotal), Math.round(w.curTotal), Math.round(w.curTotal - w.estTotal), +w.varPct.toFixed(2)],
    [], [T("مبررات الزيادة/النقص", "Justification"), p.notes || ""],
  ];
  void WAGE_GROUPS; void boqCalc;
  return [[T("تعديل المقايسة", "BOQ revision"), rows]];
}
/** إضافة توقيع مدير المشاريع وتاريخ التصدير أسفل كل ورقة (كما في المنصة الحالية) */
export function withSignature(sheets: SheetRows, lang: Lang, exportedAt = new Date()): SheetRows {
  const T = makeT(lang);
  return sheets.map(([name, rows]) => {
    const r = rows.slice();
    r.push([]);
    r.push([T(PM_ROLE_AR, PM_ROLE_EN), PM_NAME]);
    r.push([T("المنصة", "Platform"), T("محفظة مشاريع المقاول", "Contractor Project Portfolio"), T("تاريخ التصدير", "Exported"), exportedAt.toISOString().slice(0, 16).replace("T", " ")]);
    return [name, r] as [string, Cell[][]];
  });
}
