import { DEFAULT_CATALOG, totals, authorityFor } from "./derive";
import { geoPoints, feeders } from "./geo";
import type { Catalog, InvoiceHead, Lang, Project, Totals } from "./types";

const libMat = (cat: Catalog, c: string) => cat.materials.find((m) => m.c === c);
const libWork = (cat: Catalog, c: string) => cat.works.find((w) => w.c === c);

export interface ProjStats {
  t: Totals; plan: number; exec: number; iss: number; req: number; est: number; pts: number; rmus: number; set: number;
  files: number; derived: boolean; varPct: number;
}
export function projStats(p: Project, cat: Catalog = DEFAULT_CATALOG): ProjStats {
  const t = totals(p);
  let plan = 0, exec = 0;
  cat.works.forEach((x) => { const b = p.boq[x.c] || ({} as any); plan += (b.plan || 0) * x.p; exec += (b.exec || 0) * x.p; });
  let iss = 0, req = 0;
  cat.materials.forEach((x) => { const m = p.mat[x.c] || ({} as any); iss += (m.iss || 0) * x.p; req += (m.req || 0) * x.p; });
  const est = (p.estCost.mat || 0) + (p.estCost.inst || 0) + (p.estCost.ind || 0);
  const rm = p.rmus || [];
  return {
    t, plan, exec, iss, req, est, pts: geoPoints(p).length, rmus: rm.length, set: rm.filter((r) => r.set).length,
    files: (p.files || []).length, derived: !!p.derived, varPct: plan ? ((exec - plan) / plan) * 100 : 0,
  };
}
export function firmStats(list: Project[], cat: Catalog = DEFAULT_CATALOG) {
  const ps = list.map((p) => projStats(p, cat));
  const sum = (k: keyof ProjStats) => ps.reduce((s, x) => s + ((x[k] as number) || 0), 0);
  return {
    n: ps.length, est: sum("est"), plan: sum("plan"), exec: sum("exec"), iss: sum("iss"), pts: sum("pts"), rmus: sum("rmus"), set: sum("set"),
    files: sum("files"), derived: ps.filter((x) => x.derived).length,
    rmu: ps.reduce((s, x) => s + (x.t.rmuNew || 0), 0), tr: ps.reduce((s, x) => s + (x.t.trTot || 0), 0), mv: ps.reduce((s, x) => s + (x.t.htCable || 0), 0),
  };
}

export type StateKey = "ready" | "run" | "pending" | "nogeo" | "draft";
export const ST_ORDER: StateKey[] = ["ready", "run", "pending", "nogeo", "draft"];
export const STATES: Record<StateKey, { ar: string; en: string; g: string; c: string }> = {
  ready: { ar: "جاهز للفاتورة", en: "Ready to invoice", g: "✓", c: "good" },
  run: { ar: "قيد التنفيذ", en: "In progress", g: "●", c: "info" },
  pending: { ar: "بانتظار الحصر", en: "Awaiting takeoff", g: "▲", c: "warn" },
  nogeo: { ar: "ناقص إحداثيات", en: "Missing coordinates", g: "◆", c: "serious" },
  draft: { ar: "مسودة بلا ملفات", en: "Draft — no files", g: "○", c: "neutral" },
};
/** حالة كل مشروع في لوحة التحكم */
export function projState(p: Project, cat: Catalog = DEFAULT_CATALOG): ProjStats & { files: number; setPct: number; bill: number; k: StateKey } {
  const s = projStats(p, cat), files = (p.files || []).length;
  const setPct = s.rmus ? (s.set / s.rmus) * 100 : 0;
  const bill = s.plan ? (s.exec / s.plan) * 100 : 0;
  let k: StateKey;
  if (!files && !s.derived && !s.rmus) k = "draft";
  else if (!s.derived) k = "pending";
  else if (!s.pts) k = "nogeo";
  else if (setPct >= 80 && s.exec > 0) k = "ready";
  else k = "run";
  return Object.assign({}, s, { files, setPct, bill, k });
}

/** ملخص لوحة التحكم لمقاول واحد (البطاقات الستّ) */
export function dashSummary(mine: Project[], cat: Catalog = DEFAULT_CATALOG, lang: Lang = "ar") {
  const st = mine.map((p) => projState(p, cat));
  const tot = { est: 0, exec: 0, plan: 0, pts: 0, rmu: 0, tr: 0, mv: 0, files: 0, wo: new Set<string>() };
  mine.forEach((p, i) => {
    const s = st[i];
    tot.est += s.est; tot.exec += s.exec; tot.plan += s.plan; tot.pts += s.pts; tot.files += s.files;
    tot.rmu += s.t.rmuNew || 0; tot.tr += s.t.trTot || 0; tot.mv += s.t.htCable || 0;
    if (String(p.wo || "").trim()) tot.wo.add(String(p.wo).trim());
  });
  const varPct = tot.plan ? ((tot.exec - tot.plan) / tot.plan) * 100 : 0;
  const geoCov = mine.length ? (st.filter((s) => s.pts > 0).length / mine.length) * 100 : 0;
  const counts = {} as Record<StateKey, number>;
  ST_ORDER.forEach((k) => (counts[k] = st.filter((s) => s.k === k).length));
  return { st, tot: { ...tot, wo: tot.wo.size }, varPct, geoCov, counts, authority: authorityFor(varPct, lang), needAction: counts.pending + counts.nogeo + counts.draft };
}

/** إحصاءات العرض التقديمي */
export function deckStats(p: Project, cat: Catalog = DEFAULT_CATALOG) {
  const t = totals(p), d = p.derived;
  const pr = (c: string) => (libWork(cat, c) || { p: 0 }).p;
  let planC = 0, execC = 0;
  cat.works.forEach((x) => { const b = p.boq[x.c] || ({} as any); planC += (+b.plan || 0) * x.p; execC += (+b.exec || 0) * x.p; });
  const matIss = cat.materials.reduce((s, m) => { const b = p.mat[m.c] || ({} as any); return s + (+b.iss || 0) * m.p; }, 0);
  const matReq = cat.materials.reduce((s, m) => { const b = p.mat[m.c] || ({} as any); return s + (+b.req || 0) * m.p; }, 0);
  const ind = ((execC + matReq) * p.factors.indirectPct) / 100;
  const cur = execC + matReq + ind;
  const est = p.estCost.mat + p.estCost.inst + p.estCost.ind;
  const varPct = est ? ((cur - est) / est) * 100 : 0;
  const setDone = p.rmus.filter((r) => r.set).length;
  const highOhm = p.rmus.filter((r) => +r.ohm > 3).length;
  return { t, d, planC, execC, matIss, matReq, ind, cur, est, varPct, setDone, highOhm, pr };
}

/** أرقام صفحة فاتورة الأجور ونموذج تعديل المقايسة */
export function wagesCalc(p: Project, cat: Catalog = DEFAULT_CATALOG) {
  const line = (x: { c: string; p: number }) => { const b = p.boq[x.c] || ({} as any); return { q: +b.exec || 0, v: (+b.exec || 0) * x.p }; };
  const worksTotal = cat.works.reduce((s, x) => s + line(x).v, 0);
  const matReq = cat.materials.reduce((s, m) => { const b = p.mat[m.c] || ({} as any); return s + (+b.req || 0) * m.p; }, 0);
  const matIss = cat.materials.reduce((s, m) => { const b = p.mat[m.c] || ({} as any); return s + (+b.iss || 0) * m.p; }, 0);
  const ind = ((worksTotal + matReq) * p.factors.indirectPct) / 100;
  const curTotal = worksTotal + matReq + ind;
  const estTotal = p.estCost.mat + p.estCost.inst + p.estCost.ind;
  const prevTotal = p.prevTotal || estTotal;
  const varPct = estTotal ? ((curTotal - estTotal) / estTotal) * 100 : 0;
  return { worksTotal, matReq, matIss, ind, curTotal, estTotal, prevTotal, varPct, line };
}

/** نموذج 02 — ثلاثة أسطر: المواد، التركيبات، غير المباشرة */
export function revisionRows(p: Project, cat: Catalog = DEFAULT_CATALOG) {
  const w = wagesCalc(p, cat);
  return [
    { key: "mat", est: p.estCost.mat, prev: w.matIss, cur: w.matReq },
    { key: "inst", est: p.estCost.inst, prev: p.estCost.inst, cur: w.worksTotal },
    { key: "ind", est: p.estCost.ind, prev: ((w.matIss + p.estCost.inst) * p.factors.indirectPct) / 100, cur: w.ind },
  ];
}

/** المقايسة والمقارنة */
export function boqCalc(p: Project, cat: Catalog = DEFAULT_CATALOG) {
  const d = p.derived;
  const rows = cat.works.map((x) => {
    const b = p.boq[x.c] || { plan: 0, exec: 0 }, der = d ? d.works[x.c] || 0 : null;
    return { x, plan: +b.plan || 0, exec: +b.exec || 0, der };
  }).filter((r) => r.plan || r.exec || r.der);
  const sum = (k: "plan" | "exec" | "der") => rows.reduce((s, r) => s + ((r[k] as number) || 0) * r.x.p, 0);
  const planC = sum("plan"), execC = sum("exec"), derC = d ? sum("der") : 0;
  const matRows = cat.materials.map((m) => {
    const b = p.mat[m.c] || { iss: 0, req: 0 }, der = d ? d.mats[m.c] || 0 : null;
    return { m, iss: +b.iss || 0, req: +b.req || 0, der };
  }).filter((r) => r.iss || r.req || r.der);
  const issC = matRows.reduce((s, r) => s + r.iss * r.m.p, 0), reqC = matRows.reduce((s, r) => s + r.req * r.m.p, 0);
  return { rows, matRows, planC, execC, derC, issC, reqC };
}

export function defaultInvoice(): InvoiceHead {
  return { no: "", date: "", period: "", retentionPct: 10, deduct: 0, prev: 0, vatPct: 15, useVat: false };
}
export function invRows(p: Project, cat: Catalog, lang: Lang) {
  const works: { c: string; name: string; u: string; p: number; q: number; amt: number; plan: number }[] = [];
  const mats: { c: string; name: string; u: string; p: number; iss: number; req: number; amt: number; k: string }[] = [];
  Object.keys(p.boq).forEach((c) => {
    const w = libWork(cat, c); const q = +p.boq[c].exec || 0; if (!q) return;
    works.push({ c, name: lang === "ar" ? (w ? w.ar : c) : (w ? w.en : c), u: w ? w.u : "—", p: w ? +w.p || 0 : 0, q, amt: (w ? +w.p || 0 : 0) * q, plan: +p.boq[c].plan || 0 });
  });
  Object.keys(p.mat).forEach((c) => {
    const m = libMat(cat, c); const iss = +p.mat[c].iss || 0, req = +p.mat[c].req || 0; if (!iss && !req) return;
    mats.push({ c, name: lang === "ar" ? (m ? m.ar : c) : (m ? m.en : c), u: m ? m.u : "—", p: m ? +m.p || 0 : 0, iss, req, amt: (m ? +m.p || 0 : 0) * req, k: m ? m.k : "detail" });
  });
  works.sort((a, b) => b.amt - a.amt); mats.sort((a, b) => b.amt - a.amt);
  return { works, mats };
}
/** المستخلص: محتجز، استقطاعات، ضريبة اختيارية، صافي المستحق */
export function invoiceCalc(p: Project, cat: Catalog, lang: Lang) {
  const iv = p.inv || defaultInvoice();
  const { works, mats } = invRows(p, cat, lang);
  const wSum = works.reduce((s, x) => s + x.amt, 0), mSum = mats.reduce((s, x) => s + x.amt, 0);
  const mMain = mats.filter((x) => x.k === "main").reduce((s, x) => s + x.amt, 0);
  const ind = ((wSum + mSum) * (+p.factors.indirectPct || 0)) / 100;
  const gross = wSum + mSum + ind;
  const estTot = (p.estCost.mat || 0) + (p.estCost.inst || 0) + (p.estCost.ind || 0);
  const varPct = estTot ? ((gross - estTot) / estTot) * 100 : 0;
  const ret = (gross * (+iv.retentionPct || 0)) / 100;
  const vat = iv.useVat ? ((gross - ret) * (+iv.vatPct || 0)) / 100 : 0;
  const net = gross - ret - (+iv.deduct || 0) - (+iv.prev || 0) + vat;
  return { iv, works, mats, wSum, mSum, mMain, ind, gross, estTot, varPct, ret, vat, net };
}

/** مجموعات الأجور في صفحة الفاتورة */
export const WAGE_GROUPS: [string, string, string][] = [
  ["exc", "الحفريات", "Excavation"], ["duct", "المواسير والثقب الأفقي", "Ducts & HDD"], ["lay", "تمديد الكابلات", "Cable laying"],
  ["term", "النهايات والوصلات", "Terminations & joints"], ["asph", "السفلتة", "Asphalt"], ["civil", "الأعمال المدنية", "Civil works"],
  ["inst", "تركيب المعدات", "Equipment installation"], ["earth", "التأريض", "Earthing"], ["prot", "الحماية", "Protection"],
  ["oh", "أعمال هوائية", "Overhead works"], ["rem", "الإزالات", "Removals"], ["test", "الاختبارات", "Testing"],
];

/** نسب تقدّم المشروع حسب مجموعات البنود (لوحة التحكم) */
export const PROGRESS_GROUPS: [string, string, string[]][] = [
  ["حفر ج.متوسط", "MV trenching", ["301010201", "301010205", "301010202", "301010206", "301010203", "301010204"]],
  ["حفر ج.منخفض", "LV trenching", ["301010101", "301010103", "301010102"]],
  ["تمديد كابلات", "Cable laying", ["304010202", "304010102", "304010101", "304010203"]],
  ["نهايات ووصلات", "Terminations", ["305020404", "305020104", "305020407", "305010302"]],
  ["تركيب معدات", "Equipment install", ["309020101", "309020203", "308020101", "308020105"]],
  ["إزالة الهوائي", "Overhead removals", ["201040003", "201040006", "204020301", "204010301"]],
  ["سفلتة وكشط", "Asphalt & milling", ["306010002", "306010004"]],
];

/** تنبيهات المشروع (لوحة التحكم) */
export function projectAlerts(p: Project, cat: Catalog, lang: Lang) {
  const T = (a: string, e: string) => (lang === "ar" ? a : e);
  const ps = projState(p, cat);
  const varPct = ps.varPct;
  const shortages = Object.entries(p.mat).filter(([, v]) => (v.req || 0) > (v.iss || 0));
  const noSet = (p.rmus || []).filter((r) => !r.set).length;
  const hiOhm = (p.rmus || []).filter((r) => +r.ohm > 3).length;
  const alerts: [string, string, string, string][] = [];
  if (!ps.files) alerts.push(["serious", "◆", T("لا توجد ملفات مرفوعة", "No files uploaded"), T("ارفع الكروكي وملفات الإكسل في صفحة الماستر — كل الحصر والنماذج تُشتق منها.", "Upload the layout and Excel files on the Master page — the whole takeoff and all forms derive from them.")]);
  if (!p.derived) alerts.push(["warn", "▲", T("الحصر لم يُستنبط", "Takeoff not derived"), T("اضغط «استنباط ومعالجة ذكية للبيانات» بعد رفع الملفات.", "Press “Derive & AI-process data” after uploading the files.")]);
  if (!ps.pts) alerts.push(["serious", "◆", T("لا إحداثيات لهذا المشروع", "No coordinates for this project"), T("ارفع ضبط الحماية أو ملف KML — بدونها لا تظهر المعدات على الخريطة ولا في Google Earth.", "Upload the protection file or a KML — without them no equipment appears on the map or in Google Earth.")]);
  if (shortages.length) alerts.push(["warn", "▲", T("عجز مواد", "Material shortfall") + " — " + shortages.length, T("كميات مطلوبة للتنفيذ أكبر من المصروف من المستودع، ويلزم لها خطاب تعديل مقايسة.", "More is required than was issued from store; a BOQ revision letter is needed.")]);
  if (Math.abs(varPct) > 30) alerts.push(["serious", "◆", T("الانحراف تجاوز 30%", "Variance above 30%"), T("يلزم تقرير فني مع نموذج تعديل المقايسة واعتماد ", "A technical report with the BOQ revision and the approval of ") + authorityFor(varPct, lang) + "."]);
  if (noSet) alerts.push(["warn", "▲", T("ضبط الحماية غير مكتمل", "Protection settings incomplete"), noSet + " " + T("وحدة حلقية بلا ضبط معتمد — يوقف الاستلام النهائي.", "RMUs without approved settings — this blocks final acceptance.")]);
  if (hiOhm) alerts.push(["warn", "▲", T("مقاومة تأريض مرتفعة", "High earth resistance"), hiOhm + " " + T("وحدة تتجاوز 3 أوم؛ أضف قضبان تأريض وأعد القياس.", "units above 3 Ω; add rods and re-measure.")]);
  if (!alerts.length) alerts.push(["good", "✓", T("لا يوجد ما يعيق هذا المشروع", "Nothing is blocking this project"), T("الملفات والحصر والإحداثيات والضبط مكتملة بالقدر الذي يسمح برفع الفاتورة.", "Files, takeoff, coordinates and settings are complete enough to raise the invoice.")]);
  return alerts;
}

/** سياق محفظة Ai لمشروع واحد (يُرسل إلى Claude من الخادم فقط) */
export function aiProjBrief(p: Project, cat: Catalog, contractorName: string, full: boolean) {
  const s = projStats(p, cat), t = s.t, pts = geoPoints(p), fs = feeders(pts).filter((f) => !f.noRoute);
  const b: Record<string, unknown> = {
    المشروع: p.name, أمر_العمل: p.wo || "—", المقاول: contractorName || "—", الموقع: p.site || "—", الإدارة: p.admin, القطاع: p.sector,
    تاريخ_الاعتماد: p.approvedDate || "—", عدد_اللوحات: p.sheets.length, مرفقات: s.files,
    معدات: { RMU_3W: t.rmu3w, RMU_4W: t.rmu4w, محطات_وحدة: t.trTot, لوحات_توزيع: t.pillars, RMU_قائمة: t.rmuEx },
    كابلات_م: { ج_متوسط_3x400: t.htCable, "4x300": t.lt300, "4x185": t.lt185, "4x70": t.lt70, أحادي_50: t.mvSingle, نحاس_تأريض: t.htEarth },
    حفريات_م: { مسفلت: t.asHT1 + t.asHT2 + t.asHT3 + t.asLT13, رملي: t.saHT1 + t.saHT2 + t.saHT3 + t.saHT4 + t.saLT13 },
    سفلتة_م2: { إعادة: t.asphalt, كشط: t.milling }, ثقب_أفقي_م: t.hdd,
    إزالة_هوائي: { أعمدة_حديد: t.poleSteel, أعمدة_خشب: t.poleWood, محولات: t.trPole1 + t.trPole2, موصلات_م: t.condMV, معزول_م: t.abcLV },
    التكلفة_ريال: { تقديرية: Math.round(s.est), مقايسة_مخططة: Math.round(s.plan), منفّذ_أجور: Math.round(s.exec), مواد_مصروفة: Math.round(s.iss), مواد_مطلوبة: Math.round(s.req), انحراف_نسبة: +s.varPct.toFixed(1) },
    الحماية: { وحدات_بالجدول: s.rmus, مضبوطة: s.set, بدون_ضبط: s.rmus - s.set },
    الإحداثيات: { نقاط: pts.length, مغذيات: fs.length, طول_المسار_م: Math.round(fs.reduce((a, f) => a + f.len, 0)) },
    حالة_الحصر: s.derived ? "مُستنبَط" : "لم يُستنبط بعد",
  };
  if (!full) return b;
  const top = cat.works.map((w) => { const x = p.boq[w.c] || ({} as any); const dq = (+x.exec || 0) - (+x.plan || 0); return { بند: w.ar.slice(0, 46), كود: w.c, فرق_كمية: +dq.toFixed(1), فرق_ريال: Math.round(dq * w.p) }; })
    .filter((o) => o.فرق_ريال).sort((a, b2) => Math.abs(b2.فرق_ريال) - Math.abs(a.فرق_ريال)).slice(0, 12);
  const gaps = cat.materials.map((m) => { const x = p.mat[m.c] || ({} as any); const g = (+x.req || 0) - (+x.iss || 0); return { مادة: m.ar.slice(0, 44), كود: m.c, عجز: +g.toFixed(1), قيمة: Math.round(g * m.p) }; })
    .filter((o) => o.عجز).sort((a, b2) => Math.abs(b2.قيمة) - Math.abs(a.قيمة)).slice(0, 12);
  b.أكبر_فروق_المقايسة = top; b.فروق_المواد = gaps;
  b.وحدات_بدون_ضبط = (p.rmus || []).filter((r) => !r.set).map((r) => r.rmu).slice(0, 25);
  b.مرفقات_مرفوعة = (p.files || []).map((f) => f.name).slice(0, 30);
  return b;
}
