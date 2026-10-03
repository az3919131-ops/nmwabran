import { DEFAULT_CATALOG, totals } from "./derive";
import { libMat, libWork } from "./identity";
import type { Catalog, Lang, Project } from "./types";

export interface QtyRow { lab: string; labEn: string; unit: string; layout: number | null; derived: number | null; plan: number | null; exec: number | null; note?: string; noteEn?: string }
export interface QtySection { head: string; headEn: string; rows: QtyRow[] }
export interface QtyExtra { c: string; n: string; u: string; pr: number; pl: number; ex: number }

/** جدول الحصر الشامل: الكروكي × المستنبط × المقايسة × المنفّذ — بند بند (منقول من صفحة «الحصر الشامل») */
export function qtyTable(p: Project, cat: Catalog = DEFAULT_CATALOG, lang: Lang = "ar") {
  const t = totals(p), d = p.derived;
  const B = (c: string) => p.boq[c] || { plan: 0, exec: 0 }, M = (c: string) => p.mat[c] || { iss: 0, req: 0 };
  const W = (c: string) => (d && d.works[c]) || 0, D = (c: string) => (d && d.mats[c]) || 0;
  const row = (lab: string, labEn: string, unit: string, layout: number | null, derived: number | null, plan: number | null, exec: number | null, note?: string, noteEn?: string): QtyRow =>
    ({ lab, labEn, unit, layout, derived, plan, exec, note, noteEn });
  const drums = t.htCable ? Math.ceil(t.htCable / (+p.factors.drumLen || 1000)) : 0;
  const f = p.factors;
  const sections: QtySection[] = [
    { head: "أولًا · المعدات الرئيسية", headEn: "1 · Main equipment", rows: [
      row("وحدة حلقية RMU 3 مسارات", "RMU 3-way", "عدد", t.rmu3w, D("8327004"), M("8327004").iss, M("8327004").req, "لكل وحدة: قاعدة خرسانية + تركيب + تأريض 4 قضبان", "Per unit: foundation + install + 4 earth rods"),
      row("وحدة حلقية RMU 4 مسارات", "RMU 4-way", "عدد", t.rmu4w, D("8327005"), M("8327005").iss, M("8327005").req, "3 خطوط + مسار محول (3L+1C)", "3 lines + transformer way"),
      row("وحدات قائمة (لا تُورَّد)", "Existing RMUs", "عدد", t.rmuEx, null, null, null, "تُحسب لها أعمال ربط وتأريض فقط", "Connection and earthing works only"),
      row("محطة وحدة 500 ك.ف.أ — 220ف", "Unit sub 500kVA 220V", "عدد", t.tr220, null, M("8567054").iss, M("8567054").req, "قاعدة 2808 ر.س + تركيب 1565 ر.س للوحدة", "Foundation + installation per unit"),
      row("محطة وحدة 500 ك.ف.أ — 400ف", "Unit sub 500kVA 400V", "عدد", t.tr400, null, null, null),
      row("محطة وحدة داخلية", "Indoor unit sub", "عدد", t.trIndoor, D("8569108"), M("8569108").iss, M("8569108").req),
      row("إجمالي محطات الوحدة", "Unit substations total", "عدد", t.trTot, W("309020203"), B("309020203").plan, B("309020203").exec, "بند التركيب 309020203", "Installation item 309020203"),
      row("لوحات توزيع فرعية (ميني بيلر)", "LV distribution pillars", "عدد", t.pillars, W("309010102"), B("309010102").plan, B("309010102").exec, "لكل لوحة: تأريض بقضيبين (بند 310010001)", "Each: 2-rod earthing (item 310010001)"),
      row("أعمدة حماية للمعدات", "Protection bollards", "عدد", null, W("604000002"), B("604000002").plan, B("604000002").exec, `${f.bollardPerRMU} أعمدة لكل معدة أرضية`, `${f.bollardPerRMU} per ground unit`),
    ] },
    { head: "ثانيًا · الكابلات والبكرات", headEn: "2 · Cables & drums", rows: [
      row("كابل ج.متوسط 36ك.ف 3×400/35", "MV 36kV 3×400/35", "م", t.htCable, D("8114005"), M("8114005").iss, M("8114005").req, `يشمل هالك ${f.wastePct}% · تمديد بند 304010202`, `Includes ${f.wastePct}% waste`),
      row("كابل أحادي 36ك.ف 1×50/16 نحاس", "MV single 1×50/16 Cu", "م", t.mvSingle, D("8113009"), M("8113009").iss, M("8113009").req, "للكابلات الصاعدة والربط الهوائي", "Risers and overhead connections"),
      row("كابل ج.منخفض 4×300", "LV 4×300", "م", t.lt300, D("8111007"), M("8111007").iss, M("8111007").req),
      row("كابل ج.منخفض 4×185", "LV 4×185", "م", t.lt185, D("8111006"), M("8111006").iss, M("8111006").req),
      row("كابل ج.منخفض 4×70", "LV 4×70", "م", t.lt70, D("8111005"), M("8111005").iss, M("8111005").req),
      row("عدد بكرات ج.متوسط", "MV drums", "بكرة", drums, null, null, null, `بكرة كل ${f.drumLen} م — وصلة مستقيمة عند كل نهاية بكرة`, `One drum per ${f.drumLen} m`),
      row("وصلة مستقيمة ج.متوسط", "MV straight joints", "عدد", t.joints, W("305020104"), B("305020104").plan, B("305020104").exec, "طقم 8121179 لكل وصلة", "Kit 8121179 per joint"),
      row("نهاية طرفية 3×400 (داخلي/خارجي)", "MV terminations 3×400", "عدد", t.term3x400, W("305020404"), B("305020404").plan, B("305020404").exec),
      row("نهاية كوعية للفازة", "MV elbow per phase", "عدد", null, W("305020407"), B("305020407").plan, B("305020407").exec, `${f.elbowPhases} أكواع لكل نهاية`, `${f.elbowPhases} elbows per termination`),
      row("نهاية ج.منخفض 4×300", "LV termination 4×300", "عدد", t.lt300Term, W("305010302"), B("305010302").plan, B("305010302").exec),
      row("نهاية ج.منخفض 4×185", "LV termination 4×185", "عدد", t.lt185Term, W("305010301"), B("305010301").plan, B("305010301").exec),
      row("كابل صاعد 3×400", "Riser 3×400", "عدد", t.riser400, null, null, null, "يقابله طقم نهاية 8121008 وكوع 8121182", "Termination kit + elbow per riser"),
    ] },
    { head: "ثالثًا · الحفريات والسفلتة", headEn: "3 · Excavation & asphalt", rows: [
      row("حفر ج.متوسط — كابل واحد، رملي", "MV trench 1 cable, sandy", "م", t.saHT1, W("301010201"), B("301010201").plan, B("301010201").exec),
      row("حفر ج.متوسط — كابل واحد، مسفلت", "MV trench 1 cable, asphalt", "م", t.asHT1, W("301010205"), B("301010205").plan, B("301010205").exec),
      row("حفر ج.متوسط — كابلان، رملي", "MV trench 2 cables, sandy", "م", t.saHT2, W("301010202"), B("301010202").plan, B("301010202").exec),
      row("حفر ج.متوسط — كابلان، مسفلت", "MV trench 2 cables, asphalt", "م", t.asHT2, W("301010206"), B("301010206").plan, B("301010206").exec),
      row("حفر ج.متوسط — 3 كابلات", "MV trench 3 cables", "م", t.saHT3 + t.asHT3, W("301010203"), B("301010203").plan, B("301010203").exec),
      row("حفر ج.متوسط — 4 كابلات", "MV trench 4 cables", "م", t.saHT4, W("301010204"), B("301010204").plan, B("301010204").exec),
      row("حفر ج.منخفض 1:3 كابل، رملي", "LV trench 1–3, sandy", "م", t.saLT13, W("301010101"), B("301010101").plan, B("301010101").exec),
      row("حفر ج.منخفض 1:3 كابل، مسفلت", "LV trench 1–3, asphalt", "م", t.asLT13, W("301010103"), B("301010103").plan, B("301010103").exec),
      row("حفر ج.منخفض 4 كابلات", "LV trench 4 cables", "م", t.saLT4, W("301010102"), B("301010102").plan, B("301010102").exec),
      row("إجمالي أطوال الحفر", "Total trench length", "م", t.trench, null, null, null, `عرض الحفر: ${f.trenchWidthMV} م للضغط المتوسط · ${f.trenchWidthLV} م للمنخفض`, "Trench widths from the factors"),
      row("إعادة سفلتة", "Asphalt reinstatement", "م²", t.asphalt, W("306010002"), B("306010002").plan, B("306010002").exec),
      row("كشط وإعادة سفلتة بالفرّادة", "Milling & reinstatement", "م²", t.milling, W("306010004"), B("306010004").plan, B("306010004").exec, "يلزمه نموذج اعتماد الكشط رقم (4)", "Requires milling approval form No. 4"),
      row("ثقب أفقي (HDD)", "Horizontal drilling", "م", t.hdd, W("302020001"), B("302020001").plan, B("302020001").exec, "يلزمه نموذج اعتماد الحفر وطلب UDS منفصل", "Requires the drilling approval form"),
      row('مواسير PVC 6" لعبور الشوارع', 'PVC ducts 6"', "م", null, W("302010002"), B("302010002").plan, B("302010002").exec),
    ] },
    { head: "رابعًا · إزالة الشبكة الهوائية", headEn: "4 · Overhead removals", rows: [
      row("إزالة عمود حديدي", "Remove steel pole", "عدد", t.poleSteel, W("201040003"), B("201040003").plan, B("201040003").exec),
      row("إزالة عمود خشبي", "Remove wooden pole", "عدد", t.poleWood, W("201040006"), B("201040006").plan, B("201040006").exec),
      row("إزالة محول على عمود واحد", "Remove TR on 1 pole", "عدد", t.trPole1, W("205040101"), B("205040101").plan, B("205040101").exec),
      row("إزالة محول على عمودين", "Remove TR on 2 poles", "عدد", t.trPole2, W("205040102"), B("205040102").plan, B("205040102").exec),
      row("إزالة موصلات ج.متوسط", "Remove MV conductors", "م", t.condMV, W("204020301"), B("204020301").plan, B("204020301").exec),
      row("إزالة أسلاك معزولة ج.منخفض", "Remove LV ABC", "م", t.abcLV, W("204010301"), B("204010301").plan, B("204010301").exec),
      row("إزالة كابل صاعد", "Remove riser cable", "عدد", t.riserRem, W("304040205"), B("304040205").plan, B("304040205").exec),
      row("إزالة مفتاح فصل على الحمل", "Remove LBS", "عدد", t.lbsRem, W("205040206"), B("205040206").plan, B("205040206").exec),
    ] },
    { head: "خامسًا · التأريض والحماية والاختبارات", headEn: "5 · Earthing, protection & tests", rows: [
      row("قضبان تأريض 16مم × 2400مم", "Earth rods", "عدد", null, D("8202054"), M("8202054").iss, M("8202054").req, `${f.rodsPerRMU}/وحدة حلقية · ${f.rodsPerTR}/محطة · ${f.rodsPerPillar}/لوحة`, "Per unit / substation / pillar"),
      row("موصل نحاس عارٍ 70مم²", "Bare Cu 70mm²", "م", t.htEarth, D("8111102"), M("8111102").iss, M("8111102").req, `${f.cuPerRMU} م لكل وحدة حلقية`, `${f.cuPerRMU} m per RMU`),
      row("موصل نحاس عارٍ 35مم²", "Bare Cu 35mm²", "م", null, D("8111101"), M("8111101").iss, M("8111101").req, `${f.cuPerTR} م لكل محطة وحدة`, `${f.cuPerTR} m per substation`),
      row("وصلات تأريض نوع C", "C-type earth connectors", "عدد", null, D("8202189"), M("8202189").iss, M("8202189").req, `${f.cConnPerRMU} لكل وحدة`, `${f.cConnPerRMU} per unit`),
      row("تأريض معدة أرضية (4 قضبان)", "Ground equipment earthing", "عدد", null, W("310020001"), B("310020001").plan, B("310020001").exec),
      row("تأريض لوحة توزيع (قضيبان)", "Pillar earthing", "عدد", null, W("310010001"), B("310010001").plan, B("310010001").exec),
      row("اختبار كابل ج.متوسط VLF", "MV VLF cable test", "عدد", null, W("311000016"), B("311000016").plan, B("311000016").exec, "تقرير معتمد لكل قطعة كابل", "Certified report per cable section"),
      row("اختبار دك التربة (كثافة حقلية)", "Field density test", "عدد", null, W("307010005"), B("307010005").plan, B("307010005").exec, "اختبار كل 800 م حفر", "One test per 800 m of trench"),
      row("اختبار بروكتر", "Proctor test", "عدد", null, W("307010002"), B("307010002").plan, B("307010002").exec),
    ] },
  ];
  /* بنود مستوردة لا يقابلها حقل في جدول الحصر — تُعرض كاملة حتى لا يختفي شيء */
  const USED = new Set(["8327004", "8327005", "8567054", "8569108", "8114005", "8113009", "8111007", "8111006", "8111005",
    "8202054", "8111102", "8111101", "8202189", "309020203", "309010102", "604000002", "305020104", "305020404", "305020407",
    "305010302", "305010301", "301010201", "301010205", "301010202", "301010206", "301010203", "301010204", "301010101",
    "301010103", "301010102", "306010002", "306010004", "302020001", "302010002", "201040003", "201040006", "205040101",
    "205040102", "204020301", "204010301", "304040205", "205040206", "310020001", "310010001", "311000016", "307010005", "307010002"]);
  const T = (a: string, e: string) => (lang === "ar" ? a : e);
  const extraW: QtyExtra[] = Object.keys(p.boq).filter((c) => !USED.has(c) && (p.boq[c].plan || p.boq[c].exec))
    .map((c) => { const w = libWork(cat, c); return { c, n: w ? T(w.ar, w.en) : c, u: w ? w.u : "—", pr: w ? +w.p || 0 : 0, pl: +p.boq[c].plan || 0, ex: +p.boq[c].exec || 0 }; })
    .sort((a, b) => b.ex * b.pr - a.ex * a.pr);
  const extraM: QtyExtra[] = Object.keys(p.mat).filter((c) => !USED.has(c) && (p.mat[c].iss || p.mat[c].req))
    .map((c) => { const m = libMat(cat, c); return { c, n: m ? T(m.ar, m.en) : c, u: m ? m.u : "—", pr: m ? +m.p || 0 : 0, pl: +p.mat[c].iss || 0, ex: +p.mat[c].req || 0 }; })
    .sort((a, b) => b.ex * b.pr - a.ex * a.pr);
  return { sections, extraW, extraM, t, drums };
}
