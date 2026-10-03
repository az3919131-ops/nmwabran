// @ts-nocheck — منقول من المنصة القديمة (reference/legacy.html) للحفاظ على تطابق المخرجات؛ تحرسه اختبارات parity.
import { S, P, T, AR, $, esc, nf, money, toast, copyTable, CONTRACTORS, MATERIALS, WORKS, CAT, AUTH, totals, derive, authorityFor, geoPoints, feeders, projStats, libMat, libWork, can, editable, isAdmin, pmLine, ME, CF, firmProjects, firmStats, fHex, fInitials, STANDALONE, dig, near, toUTM, utmToLL, hav, ACCEPT_COLS, SHEET_FIELDS, DEFAULT_FACTORS, PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ROLES, MODULES, ACTS, initials2 } from "../runtime";

const SEC = {
  tally:{ar:"حصر اللوحات",en:"Sheet tally"}, boq:{ar:"المقايسة والبنود",en:"BOQ items"},
  mat:{ar:"المواد",en:"Materials"}, units:{ar:"جدول الوحدات",en:"Unit schedule"},
  geo:{ar:"الإحداثيات",en:"Coordinates"}
};

function qRow(lab, labEn, unit, layout, derived, plan, exec, note, noteEn){
  const d = (exec||0)-(plan||0);
  const pct = plan? Math.round(d/plan*1000)/10 : (exec?100:0);
  return `<tr>
    <td class="wrap-t"><div class="qgrp"><b>${esc(T(lab,labEn))}</b>${note?`<span>${esc(T(note,noteEn||note))}</span>`:""}</div></td>
    <td>${esc(unit)}</td>
    <td class="n">${layout==null?"—":nf(layout)}</td>
    <td class="n">${derived==null?"—":nf(derived)}</td>
    <td class="n">${plan==null?"—":nf(plan)}</td>
    <td class="n">${exec==null?"—":nf(exec)}</td>
    <td class="n"><span class="delta ${d>0?"up":d<0?"down":"zero"}">${plan||exec?(d>0?"+":"")+nf(d)+(plan?` (${d>0?"+":""}${pct}%)`:""):"—"}</span></td></tr>`;
}

function viewQty(){
  const p=P(), t=totals(p), d=p.derived, B=c=>p.boq[c]||{plan:0,exec:0}, M=c=>p.mat[c]||{iss:0,req:0};
  const W=c=>(d&&d.works[c])||0, D=c=>(d&&d.mats[c])||0;
  const head=`<tr class="qhead"><td colspan="7">`;
  const th=`<thead><tr><th>${T("البند","Item")}</th><th>${T("الوحدة","Unit")}</th>
    <th class="n">${T("من الكروكي","From layout")}</th><th class="n">${T("المستنبط","Derived")}</th>
    <th class="n">${T("المخطط بالمقايسة","BOQ plan")}</th><th class="n">${T("المنفّذ","Executed")}</th>
    <th class="n">${T("الفرق","Variance")}</th></tr></thead>`;
  const drums = t.htCable? Math.ceil(t.htCable/(+p.factors.drumLen||1000)) : 0;

  const equip = `
    ${head}${T("أولًا · المعدات الرئيسية","1 · Main equipment")}</td></tr>
    ${qRow("وحدة حلقية RMU 3 مسارات","RMU 3-way","عدد", t.rmu3w, D("8327004"), M("8327004").iss, M("8327004").req, "لكل وحدة: قاعدة خرسانية + تركيب + تأريض 4 قضبان","Per unit: foundation + install + 4 earth rods")}
    ${qRow("وحدة حلقية RMU 4 مسارات","RMU 4-way","عدد", t.rmu4w, D("8327005"), M("8327005").iss, M("8327005").req, "3 خطوط + مسار محول (3L+1C)","3 lines + transformer way")}
    ${qRow("وحدات قائمة (لا تُورَّد)","Existing RMUs","عدد", t.rmuEx, null, null, null, "تُحسب لها أعمال ربط وتأريض فقط","Connection and earthing works only")}
    ${qRow("محطة وحدة 500 ك.ف.أ — 220ف","Unit sub 500kVA 220V","عدد", t.tr220, null, M("8567054").iss, M("8567054").req, "قاعدة 2808 ر.س + تركيب 1565 ر.س للوحدة","Foundation + installation per unit")}
    ${qRow("محطة وحدة 500 ك.ف.أ — 400ف","Unit sub 500kVA 400V","عدد", t.tr400, null, null, null)}
    ${qRow("محطة وحدة داخلية","Indoor unit sub","عدد", t.trIndoor, D("8569108"), M("8569108").iss, M("8569108").req)}
    ${qRow("إجمالي محطات الوحدة","Unit substations total","عدد", t.trTot, W("309020203"), B("309020203").plan, B("309020203").exec, "بند التركيب 309020203","Installation item 309020203")}
    ${qRow("لوحات توزيع فرعية (ميني بيلر)","LV distribution pillars","عدد", t.pillars, W("309010102"), B("309010102").plan, B("309010102").exec, "لكل لوحة: تأريض بقضيبين (بند 310010001)","Each: 2-rod earthing (item 310010001)")}
    ${qRow("أعمدة حماية للمعدات","Protection bollards","عدد", null, W("604000002"), B("604000002").plan, B("604000002").exec, `${p.factors.bollardPerRMU} أعمدة لكل معدة أرضية`, `${p.factors.bollardPerRMU} per ground unit`)}`;

  const cables = `
    ${head}${T("ثانيًا · الكابلات والبكرات","2 · Cables & drums")}</td></tr>
    ${qRow("كابل ج.متوسط 36ك.ف 3×400/35","MV 36kV 3×400/35","م", t.htCable, D("8114005"), M("8114005").iss, M("8114005").req, `يشمل هالك ${p.factors.wastePct}% · تمديد بند 304010202`, `Includes ${p.factors.wastePct}% waste`)}
    ${qRow("كابل أحادي 36ك.ف 1×50/16 نحاس","MV single 1×50/16 Cu","م", t.mvSingle, D("8113009"), M("8113009").iss, M("8113009").req, "للكابلات الصاعدة والربط الهوائي","Risers and overhead connections")}
    ${qRow("كابل ج.منخفض 4×300","LV 4×300","م", t.lt300, D("8111007"), M("8111007").iss, M("8111007").req)}
    ${qRow("كابل ج.منخفض 4×185","LV 4×185","م", t.lt185, D("8111006"), M("8111006").iss, M("8111006").req)}
    ${qRow("كابل ج.منخفض 4×70","LV 4×70","م", t.lt70, D("8111005"), M("8111005").iss, M("8111005").req)}
    ${qRow("عدد بكرات ج.متوسط","MV drums","بكرة", drums, null, null, null, `بكرة كل ${p.factors.drumLen} م — وصلة مستقيمة عند كل نهاية بكرة`, `One drum per ${p.factors.drumLen} m`)}
    ${qRow("وصلة مستقيمة ج.متوسط","MV straight joints","عدد", t.joints, W("305020104"), B("305020104").plan, B("305020104").exec, "طقم 8121179 لكل وصلة","Kit 8121179 per joint")}
    ${qRow("نهاية طرفية 3×400 (داخلي/خارجي)","MV terminations 3×400","عدد", t.term3x400, W("305020404"), B("305020404").plan, B("305020404").exec)}
    ${qRow("نهاية كوعية للفازة","MV elbow per phase","عدد", null, W("305020407"), B("305020407").plan, B("305020407").exec, `${p.factors.elbowPhases} أكواع لكل نهاية`, `${p.factors.elbowPhases} elbows per termination`)}
    ${qRow("نهاية ج.منخفض 4×300","LV termination 4×300","عدد", t.lt300Term, W("305010302"), B("305010302").plan, B("305010302").exec)}
    ${qRow("نهاية ج.منخفض 4×185","LV termination 4×185","عدد", t.lt185Term, W("305010301"), B("305010301").plan, B("305010301").exec)}
    ${qRow("كابل صاعد 3×400","Riser 3×400","عدد", t.riser400, null, null, null, "يقابله طقم نهاية 8121008 وكوع 8121182","Termination kit + elbow per riser")}`;

  const exc = `
    ${head}${T("ثالثًا · الحفريات والسفلتة","3 · Excavation & asphalt")}</td></tr>
    ${qRow("حفر ج.متوسط — كابل واحد، رملي","MV trench 1 cable, sandy","م", t.saHT1, W("301010201"), B("301010201").plan, B("301010201").exec)}
    ${qRow("حفر ج.متوسط — كابل واحد، مسفلت","MV trench 1 cable, asphalt","م", t.asHT1, W("301010205"), B("301010205").plan, B("301010205").exec)}
    ${qRow("حفر ج.متوسط — كابلان، رملي","MV trench 2 cables, sandy","م", t.saHT2, W("301010202"), B("301010202").plan, B("301010202").exec)}
    ${qRow("حفر ج.متوسط — كابلان، مسفلت","MV trench 2 cables, asphalt","م", t.asHT2, W("301010206"), B("301010206").plan, B("301010206").exec)}
    ${qRow("حفر ج.متوسط — 3 كابلات","MV trench 3 cables","م", t.saHT3+t.asHT3, W("301010203"), B("301010203").plan, B("301010203").exec)}
    ${qRow("حفر ج.متوسط — 4 كابلات","MV trench 4 cables","م", t.saHT4, W("301010204"), B("301010204").plan, B("301010204").exec)}
    ${qRow("حفر ج.منخفض 1:3 كابل، رملي","LV trench 1–3, sandy","م", t.saLT13, W("301010101"), B("301010101").plan, B("301010101").exec)}
    ${qRow("حفر ج.منخفض 1:3 كابل، مسفلت","LV trench 1–3, asphalt","م", t.asLT13, W("301010103"), B("301010103").plan, B("301010103").exec)}
    ${qRow("حفر ج.منخفض 4 كابلات","LV trench 4 cables","م", t.saLT4, W("301010102"), B("301010102").plan, B("301010102").exec)}
    ${qRow("إجمالي أطوال الحفر","Total trench length","م", t.trench, null, null, null, `عرض الحفر: ${p.factors.trenchWidthMV} م للضغط المتوسط · ${p.factors.trenchWidthLV} م للمنخفض`, "Trench widths from the factors")}
    ${qRow("إعادة سفلتة","Asphalt reinstatement","م²", t.asphalt, W("306010002"), B("306010002").plan, B("306010002").exec)}
    ${qRow("كشط وإعادة سفلتة بالفرّادة","Milling & reinstatement","م²", t.milling, W("306010004"), B("306010004").plan, B("306010004").exec, "يلزمه نموذج اعتماد الكشط رقم (4)","Requires milling approval form No. 4")}
    ${qRow("ثقب أفقي (HDD)","Horizontal drilling","م", t.hdd, W("302020001"), B("302020001").plan, B("302020001").exec, "يلزمه نموذج اعتماد الحفر وطلب UDS منفصل","Requires the drilling approval form")}
    ${qRow("مواسير PVC 6\" لعبور الشوارع","PVC ducts 6\"","م", null, W("302010002"), B("302010002").plan, B("302010002").exec)}`;

  const rem = `
    ${head}${T("رابعًا · إزالة الشبكة الهوائية","4 · Overhead removals")}</td></tr>
    ${qRow("إزالة عمود حديدي","Remove steel pole","عدد", t.poleSteel, W("201040003"), B("201040003").plan, B("201040003").exec)}
    ${qRow("إزالة عمود خشبي","Remove wooden pole","عدد", t.poleWood, W("201040006"), B("201040006").plan, B("201040006").exec)}
    ${qRow("إزالة محول على عمود واحد","Remove TR on 1 pole","عدد", t.trPole1, W("205040101"), B("205040101").plan, B("205040101").exec)}
    ${qRow("إزالة محول على عمودين","Remove TR on 2 poles","عدد", t.trPole2, W("205040102"), B("205040102").plan, B("205040102").exec)}
    ${qRow("إزالة موصلات ج.متوسط","Remove MV conductors","م", t.condMV, W("204020301"), B("204020301").plan, B("204020301").exec)}
    ${qRow("إزالة أسلاك معزولة ج.منخفض","Remove LV ABC","م", t.abcLV, W("204010301"), B("204010301").plan, B("204010301").exec)}
    ${qRow("إزالة كابل صاعد","Remove riser cable","عدد", t.riserRem, W("304040205"), B("304040205").plan, B("304040205").exec)}
    ${qRow("إزالة مفتاح فصل على الحمل","Remove LBS","عدد", t.lbsRem, W("205040206"), B("205040206").plan, B("205040206").exec)}`;

  const earth = `
    ${head}${T("خامسًا · التأريض والحماية والاختبارات","5 · Earthing, protection & tests")}</td></tr>
    ${qRow("قضبان تأريض 16مم × 2400مم","Earth rods","عدد", null, D("8202054"), M("8202054").iss, M("8202054").req, `${p.factors.rodsPerRMU}/وحدة حلقية · ${p.factors.rodsPerTR}/محطة · ${p.factors.rodsPerPillar}/لوحة`, "Per unit / substation / pillar")}
    ${qRow("موصل نحاس عارٍ 70مم²","Bare Cu 70mm²","م", t.htEarth, D("8111102"), M("8111102").iss, M("8111102").req, `${p.factors.cuPerRMU} م لكل وحدة حلقية`, `${p.factors.cuPerRMU} m per RMU`)}
    ${qRow("موصل نحاس عارٍ 35مم²","Bare Cu 35mm²","م", null, D("8111101"), M("8111101").iss, M("8111101").req, `${p.factors.cuPerTR} م لكل محطة وحدة`, `${p.factors.cuPerTR} m per substation`)}
    ${qRow("وصلات تأريض نوع C","C-type earth connectors","عدد", null, D("8202189"), M("8202189").iss, M("8202189").req, `${p.factors.cConnPerRMU} لكل وحدة`, `${p.factors.cConnPerRMU} per unit`)}
    ${qRow("تأريض معدة أرضية (4 قضبان)","Ground equipment earthing","عدد", null, W("310020001"), B("310020001").plan, B("310020001").exec)}
    ${qRow("تأريض لوحة توزيع (قضيبان)","Pillar earthing","عدد", null, W("310010001"), B("310010001").plan, B("310010001").exec)}
    ${qRow("اختبار كابل ج.متوسط VLF","MV VLF cable test","عدد", null, W("311000016"), B("311000016").plan, B("311000016").exec, "تقرير معتمد لكل قطعة كابل","Certified report per cable section")}
    ${qRow("اختبار دك التربة (كثافة حقلية)","Field density test","عدد", null, W("307010005"), B("307010005").plan, B("307010005").exec, "اختبار كل 800 م حفر","One test per 800 m of trench")}
    ${qRow("اختبار بروكتر","Proctor test","عدد", null, W("307010002"), B("307010002").plan, B("307010002").exec)}`;

  /* بنود مستوردة لا يقابلها حقل في جدول الحصر — تُعرض كاملة حتى لا يختفي شيء */
  const USED = new Set(["8327004","8327005","8567054","8569108","8114005","8113009","8111007","8111006","8111005",
    "8202054","8111102","8111101","8202189","309020203","309010102","604000002","305020104","305020404","305020407",
    "305010302","305010301","301010201","301010205","301010202","301010206","301010203","301010204","301010101",
    "301010103","301010102","306010002","306010004","302020001","302010002","201040003","201040006","205040101",
    "205040102","204020301","204010301","304040205","205040206","310020001","310010001","311000016","307010005","307010002"]);
  const extraW = Object.keys(p.boq).filter(c=>!USED.has(c) && (p.boq[c].plan||p.boq[c].exec))
    .map(c=>{ const w=libWork(c); return {c, n:w?T(w.ar,w.en):c, u:w?w.u:"—", pr:w?+w.p||0:0, pl:+p.boq[c].plan||0, ex:+p.boq[c].exec||0}; })
    .sort((a,b)=>b.ex*b.pr-a.ex*a.pr);
  const extraM = Object.keys(p.mat).filter(c=>!USED.has(c) && (p.mat[c].iss||p.mat[c].req))
    .map(c=>{ const m=libMat(c); return {c, n:m?T(m.ar,m.en):c, u:m?m.u:"—", pr:m?+m.p||0:0, pl:+p.mat[c].iss||0, ex:+p.mat[c].req||0}; })
    .sort((a,b)=>b.ex*b.pr-a.ex*a.pr);
  const extraCard = (extraW.length||extraM.length)?`
  <div class="card"><header><h3>${T("بنود ومواد مستوردة خارج جدول الحصر","Imported items outside the takeoff table")}</h3>
    <span class="sub">${nf(extraW.length)} ${T("بند","work items")} · ${nf(extraM.length)} ${T("مادة","materials")} — ${T("ترقيم عقد مختلف أو بنود إضافية","different contract numbering or extra items")}</span></header>
  <div class="body tight scroll"><table class="stbl"><thead><tr>
    <th>${T("الرقم","Code")}</th><th>${T("الوصف","Description")}</th><th>${T("الوحدة","Unit")}</th>
    <th class="n">${T("السعر","Rate")}</th><th class="n">${T("المخطط/المصروف","Planned/Issued")}</th>
    <th class="n">${T("المنفّذ/المركّب","Executed/Installed")}</th><th class="n">${T("القيمة","Amount")}</th></tr></thead>
    <tbody>${[...extraW,...extraM].slice(0,120).map(x=>`<tr><td class="code">${esc(x.c)}</td>
      <td class="wrap-t">${esc(x.n)}</td><td>${esc(x.u)}</td><td class="n">${nf(x.pr,2)}</td>
      <td class="n">${nf(x.pl)}</td><td class="n">${nf(x.ex)}</td><td class="n">${money(x.ex*x.pr)}</td></tr>`).join("")}</tbody>
  </table></div>
  <div class="body"><div class="note">${T("هذه بنود قرأتها المنصة من ملفاتك لكنها لا تقابل حقول الحصر القياسية (كود العقد الموحد 2023) — غالبًا لأن المشروع يستخدم ترقيم عقد آخر. قيمتها محسوبة بأسعار ملفك وتدخل في الفاتورة والمقارنة.",
    "These are items read from your files that do not map to the standard takeoff fields (2023 unified contract codes) — usually a different contract numbering. They are valued with your file's rates and are included in the invoice and the comparison.")}</div></div></div>`:"";

  const rmuWith = p.rmus.filter(r=>r.gps).length, setOK=p.rmus.filter(r=>r.set).length;
  return `
  <div class="sec-title"><h2>${T("الحصر الشامل — كل الكميات موضّحة","Full takeoff — every quantity explained")}</h2>
    <span class="s">${T("الكروكي مقابل المستنبط مقابل المقايسة مقابل المنفّذ، بند بند","Layout vs derived vs BOQ vs executed, item by item")}</span></div>

  <div class="grid g4">
    <div class="stat"><span class="k">${T("معدات أرضية","Ground units")}</span><span class="v">${nf(t.rmuNew+t.trTot)}</span>
      <span class="d">${nf(t.rmuNew)} ${T("حلقية","RMU")} + ${nf(t.trTot)} ${T("محطة","subs")}</span></div>
    <div class="stat"><span class="k">${T("أطوال الكابلات","Cable length")}</span><span class="v">${nf(t.htCable+t.lt300+t.lt185+t.lt70+t.mvSingle)}</span>
      <span class="d">${T("م · متوسط ومنخفض","m · MV + LV")}</span></div>
    <div class="stat"><span class="k">${T("إجمالي الحفريات","Total trench")}</span><span class="v">${nf(t.trench)}</span>
      <span class="d">${T("م طولي","linear m")} · ${nf(t.asphalt+t.milling)} ${T("م² سفلتة","m² asphalt")}</span></div>
    <div class="stat"><span class="k">${T("إزالات هوائية","Overhead removals")}</span><span class="v">${nf(t.poleSteel+t.poleWood)}</span>
      <span class="d">${T("عمود","poles")} · ${nf(t.condMV+t.abcLV)} ${T("م موصلات","m conductors")}</span></div>
  </div>

  <div class="card"><header><h3>${T("جدول الحصر التفصيلي","Detailed takeoff table")}</h3>
    <span class="sub">${T("الفرق = المنفّذ − المخطط","Variance = executed − planned")}</span><span class="sp"></span>
    ${secBtnHTML("tally")} ${secBtnHTML("boq")}
    <button class="btn sm noprint" id="copyQty">${T("نسخ للإكسل","Copy to Excel")}</button></header>
  <div class="body tight scroll"><table id="tblQty" class="qtbl">${th}<tbody>
    ${equip}${cables}${exc}${rem}${earth}
  </tbody></table></div></div>

  ${extraCard}

  <div class="card"><header><h3>${T("جاهزية التسليم","Handover readiness")}</h3></header>
  <div class="body grid g3">
    <div class="stat"><span class="k">${T("وحدات بإحداثيات","Units geo-referenced")}</span><span class="v">${nf(rmuWith)} / ${nf(p.rmus.length)}</span>
      <span class="d">${T("للخريطة وGoogle Earth","for the map and Google Earth")}</span></div>
    <div class="stat"><span class="k">${T("ضبط الحماية مكتمل","Protection set")}</span><span class="v">${nf(setOK)} / ${nf(p.rmus.length)}</span>
      <span class="d">${T("نموذج ضبط الحماية","Protection settings form")}</span></div>
    <div class="stat"><span class="k">${T("بنود بها تنفيذ","Items with execution")}</span><span class="v">${nf(Object.keys(p.boq).filter(c=>p.boq[c].exec).length)} / ${nf(Object.keys(p.boq).length)}</span>
      <span class="d">${T("أساس فاتورة الأجور","Basis of the wages invoice")}</span></div>
  </div></div>`;
}

function invOf(p){
  p.inv = p.inv || {no:"", date:"", period:"", retentionPct:10, deduct:0, prev:0, vatPct:15, useVat:false};
  return p.inv;
}

function invRows(p){
  const works=[], mats=[];
  Object.keys(p.boq).forEach(c=>{
    const w=libWork(c); const q=+p.boq[c].exec||0; if(!q) return;
    works.push({c, name:T(w?w.ar:c, w?w.en:c), u:w?w.u:"—", p:(w?(+w.p||0):0), q, amt:(w?(+w.p||0):0)*q, plan:+p.boq[c].plan||0});
  });
  Object.keys(p.mat).forEach(c=>{
    const m=libMat(c); const iss=+p.mat[c].iss||0, req=+p.mat[c].req||0; if(!iss && !req) return;
    mats.push({c, name:T(m?m.ar:c, m?m.en:c), u:m?m.u:"—", p:(m?(+m.p||0):0), iss, req, amt:(m?(+m.p||0):0)*req, k:m?m.k:"detail"});
  });
  works.sort((a,b)=>b.amt-a.amt); mats.sort((a,b)=>b.amt-a.amt);
  return {works, mats};
}

function viewInv(){
  const p=P(), iv=invOf(p), {works, mats}=invRows(p);
  const tab=S.invTab||"works";
  const wSum=works.reduce((s,x)=>s+x.amt,0), mSum=mats.reduce((s,x)=>s+x.amt,0);
  const mMain=mats.filter(x=>x.k==="main").reduce((s,x)=>s+x.amt,0);
  const ind=(wSum+mSum)*(+p.factors.indirectPct||0)/100;
  const gross=wSum+mSum+ind;
  const estTot=(p.estCost.mat||0)+(p.estCost.inst||0)+(p.estCost.ind||0);
  const varPct=estTot? (gross-estTot)/estTot*100 : 0;
  const ret=gross*(+iv.retentionPct||0)/100;
  const vat=iv.useVat? (gross-ret)*(+iv.vatPct||0)/100 : 0;
  const net=gross-ret-(+iv.deduct||0)-(+iv.prev||0)+vat;

  const wTbl=`<table id="tblInvW"><thead><tr><th>#</th><th>${T("رقم البند","Item")}</th><th>${T("الوصف","Description")}</th>
    <th>${T("الوحدة","Unit")}</th><th class="n">${T("السعر","Rate")}</th><th class="n">${T("المخطط","Planned")}</th>
    <th class="n">${T("المنفّذ","Executed")}</th><th class="n">${T("القيمة","Amount")}</th></tr></thead>
    <tbody>${works.map((x,i)=>`<tr><td class="n">${i+1}</td><td class="code">${esc(x.c)}</td>
      <td class="wrap-t">${esc(x.name)}</td><td>${esc(x.u)}</td><td class="n">${nf(x.p,2)}</td>
      <td class="n muted">${nf(x.plan)}</td><td class="n">${nf(x.q)}</td><td class="n">${money(x.amt)}</td></tr>`).join("")
      ||`<tr><td colspan="8" class="muted" style="padding:16px;text-align:center">${T("لا توجد بنود منفّذة — ارفع فاتورة الأجور أو المقايسة","No executed items — upload the wages invoice or the BOQ")}</td></tr>`}</tbody>
    <tfoot><tr><td colspan="7">${T("إجمالي الأجور (التركيبات)","Total works")}</td><td class="n">${money(wSum)}</td></tr></tfoot></table>`;

  const mTbl=`<table id="tblInvM"><thead><tr><th>#</th><th>${T("رقم المادة","Code")}</th><th>${T("الوصف","Description")}</th>
    <th>${T("الوحدة","Unit")}</th><th>${T("التصنيف","Class")}</th><th class="n">${T("السعر","Rate")}</th>
    <th class="n">${T("المصروف","Issued")}</th><th class="n">${T("المركّب","Installed")}</th>
    <th class="n">${T("الفرق","Diff")}</th><th class="n">${T("القيمة","Amount")}</th></tr></thead>
    <tbody>${mats.map((x,i)=>`<tr><td class="n">${i+1}</td><td class="code">${esc(x.c)}</td>
      <td class="wrap-t">${esc(x.name)}</td><td>${esc(x.u)}</td>
      <td><span class="pill ${x.k==="main"?"acc":""}">${x.k==="main"?T("رئيسية","Main"):T("تفصيلية","Detail")}</span></td>
      <td class="n">${nf(x.p,2)}</td><td class="n">${nf(x.iss)}</td><td class="n">${nf(x.req)}</td>
      <td class="n"><span class="delta ${x.req-x.iss>0?"up":x.req-x.iss<0?"down":"zero"}">${x.req-x.iss>0?"+":""}${nf(x.req-x.iss)}</span></td>
      <td class="n">${money(x.amt)}</td></tr>`).join("")
      ||`<tr><td colspan="10" class="muted" style="padding:16px;text-align:center">${T("لا توجد مواد — ارفع كشف المواد المنفذة","No materials — upload the executed-materials list")}</td></tr>`}</tbody>
    <tfoot><tr><td colspan="9">${T("إجمالي المواد","Total materials")}</td><td class="n">${money(mSum)}</td></tr></tfoot></table>`;

  return `
  <div class="sec-title"><h2>${T("الفاتورة — أجور ومواد","Invoice — works & materials")}</h2>
    <span class="s">${T("مستخلص أعمال مبني على الكميات المنفّذة وأسعار العقد","A payment application built from executed quantities and contract rates")}</span></div>

  <div class="card"><header><h3>${T("بيانات المستخلص","Invoice header")}</h3><span class="sp"></span>
    <button class="btn sm noprint" id="invXls">${T("تصدير الفاتورة Excel","Export invoice to Excel")}</button>
    <button class="btn sm noprint" id="invPrint">${T("طباعة / PDF","Print / PDF")}</button></header>
  <div class="body grid g4">
    <label class="fld"><span>${T("رقم المستخلص","Invoice no.")}</span><input type="text" id="iv_no" value="${esc(iv.no)}"></label>
    <label class="fld"><span>${T("التاريخ","Date")}</span><input type="date" id="iv_date" value="${esc(iv.date)}"></label>
    <label class="fld"><span>${T("الفترة","Period")}</span><input type="text" id="iv_period" value="${esc(iv.period)}" placeholder="${T("من — إلى","from — to")}"></label>
    <label class="fld"><span>${T("نسبة المحتجز %","Retention %")}</span><input type="number" id="iv_ret" value="${iv.retentionPct}"></label>
    <label class="fld"><span>${T("استقطاعات (ر.س)","Deductions (SAR)")}</span><input type="number" id="iv_ded" value="${iv.deduct}"></label>
    <label class="fld"><span>${T("مستخلصات سابقة (ر.س)","Previous invoices (SAR)")}</span><input type="number" id="iv_prev" value="${iv.prev}"></label>
    <label class="fld"><span>${T("ضريبة القيمة المضافة %","VAT %")}</span><input type="number" id="iv_vat" value="${iv.vatPct}"></label>
    <label class="chk" style="align-self:end;padding-bottom:7px"><input type="checkbox" id="iv_usevat" ${iv.useVat?"checked":""}> ${T("احتساب الضريبة","Apply VAT")}</label>
  </div></div>

  <div class="card"><header>
    <div class="invtabs noprint" role="group">
      <button id="invTabW" aria-pressed="${tab==="works"}">${T("الأجور","Works")} · ${money(wSum)}</button>
      <button id="invTabM" aria-pressed="${tab==="mats"}">${T("المواد","Materials")} · ${money(mSum)}</button>
    </div>
    <span class="sp"></span>
    ${tab==="works"?secBtnHTML("boq"):secBtnHTML("mat")}
    <button class="btn sm noprint" id="invCopy">${T("نسخ الجدول","Copy table")}</button></header>
  <div class="body tight scroll">${tab==="works"?wTbl:mTbl}</div></div>

  <div class="grid g2">
    <div class="card"><header><h3>${T("ملخص الفاتورة","Invoice summary")}</h3></header>
    <div class="body">
      <div class="sumrow"><span>${T("إجمالي الأجور (التركيبات)","Works total")}</span><span class="v">${money(wSum)}</span></div>
      <div class="sumrow"><span>${T("إجمالي المواد","Materials total")}</span><span class="v">${money(mSum)}</span></div>
      <div class="sumrow"><span>${T("منها مواد رئيسية","of which main materials")}</span><span class="v muted">${money(mMain)}</span></div>
      <div class="sumrow"><span>${T("التكاليف غير المباشرة","Indirect costs")} (${p.factors.indirectPct}%)</span><span class="v">${money(ind)}</span></div>
      <div class="sumrow"><span>${T("الإجمالي قبل الخصومات","Gross before deductions")}</span><span class="v">${money(gross)}</span></div>
      <div class="sumrow"><span>${T("المحتجز","Retention")} (${iv.retentionPct}%)</span><span class="v">−${money(ret)}</span></div>
      <div class="sumrow"><span>${T("استقطاعات أخرى","Other deductions")}</span><span class="v">−${money(iv.deduct)}</span></div>
      <div class="sumrow"><span>${T("مستخلصات سابقة","Previous invoices")}</span><span class="v">−${money(iv.prev)}</span></div>
      ${iv.useVat?`<div class="sumrow"><span>${T("ضريبة القيمة المضافة","VAT")} (${iv.vatPct}%)</span><span class="v">+${money(vat)}</span></div>`:""}
      <div class="sumrow tot"><span>${T("صافي المستحق","Net payable")}</span><span class="v">${money(net)} ${T("ر.س","SAR")}</span></div>
    </div></div>

    <div class="card"><header><h3>${T("التوزيع والاعتماد","Split & approval")}</h3></header>
    <div class="body" style="display:flex;flex-direction:column;gap:12px">
      <div class="stack"><div class="stack-t">${T("نسبة الأجور إلى المواد","Works vs materials share")}</div>
        <div class="stack-bar">
          <span style="flex:${Math.max(wSum,1)};background:var(--accent)">${wSum+mSum?Math.round(wSum/(wSum+mSum)*100):0}%</span>
          <span style="flex:${Math.max(mSum,1)};background:var(--accent-2)">${wSum+mSum?Math.round(mSum/(wSum+mSum)*100):0}%</span>
        </div>
        <div class="legend"><span><i style="background:var(--accent)"></i>${T("أجور","Works")}</span><span><i style="background:var(--accent-2)"></i>${T("مواد","Materials")}</span></div>
      </div>
      <dl class="kv">
        <dt>${T("المقاول","Contractor")}</dt><dd>${esc(CONTRACTORS[p.contractor]||"—")}</dd>
        <dt>${T("أمر العمل","Work order")}</dt><dd class="code">${esc(p.wo||"—")}</dd>
        <dt>${T("المشروع","Project")}</dt><dd>${esc(p.name||"—")}</dd>
        <dt>${T("عدد بنود الأجور","Work items")}</dt><dd>${nf(works.length)}</dd>
        <dt>${T("عدد المواد","Material items")}</dt><dd>${nf(mats.length)}</dd>
        <dt>${T("صاحب الصلاحية","Authority")}</dt><dd>${esc(authorityFor(varPct))}</dd>
      </dl>
      <div class="sign">
        <div><b>${T("أعدّ الفاتورة","Prepared by")}</b>${T("مهندس المشروع","Project engineer")}</div>
        <div><b>${T("راجعها","Reviewed by")}</b>${T("مهندس الإشراف","Supervision engineer")}</div>
        <div><b>${T("اعتمدها","Approved by")}</b>${esc(authorityFor(varPct))}</div>
      </div>
    </div></div>
  </div>`;
}

function secBtnHTML(kind){
  return `<button class="btn sm secbtn noprint" data-sec="${kind}" title="${T("استيراد إكسل لهذا القسم فقط","Import an Excel file into this section only")}">⬆ ${T("استيراد ","Import ")+T(SEC[kind].ar, SEC[kind].en)}</button>`;
}

export { viewQty, viewInv, invOf, invRows, secBtnHTML };
