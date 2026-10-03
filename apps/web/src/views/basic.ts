// @ts-nocheck — منقول من المنصة القديمة (reference/legacy.html) للحفاظ على تطابق المخرجات؛ تحرسه اختبارات parity.
import { S, P, T, AR, $, esc, nf, money, toast, copyTable, CONTRACTORS, MATERIALS, WORKS, CAT, AUTH, totals, derive, authorityFor, geoPoints, feeders, projStats, libMat, libWork, can, editable, isAdmin, pmLine, ME, CF, firmProjects, firmStats, fHex, fInitials, STANDALONE, dig, near, toUTM, utmToLL, hav, ACCEPT_COLS, SHEET_FIELDS, DEFAULT_FACTORS, PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ROLES, MODULES, ACTS, initials2 } from "../runtime";

function viewMaster(){
  const p=P(), t=totals(p);
  return `
  <div class="sec-title"><span class="eyebrow">${T("الصفحة الماستر","Master sheet")}</span>
    <h2>${T("الكروكي وحصر الكميات","Layout drawing & quantity takeoff")}</h2></div>

  <div class="card"><header><h3>${T("بيانات المشروع","Project data")}</h3></header>
  <div class="body grid g4">
    <label class="fld"><span>${T("اسم المشروع","Project name")}</span><input type="text" id="f_name" value="${esc(p.name)}"></label>
    <label class="fld"><span>${T("رقم أمر العمل / UDS","Work order / UDS")}</span><input type="text" id="f_wo" value="${esc(p.wo)}"></label>
    <label class="fld"><span>${T("موقع المشروع","Site")}</span><input type="text" id="f_site" value="${esc(p.site)}"></label>
    <label class="fld"><span>${T("الإدارة","Department")}</span><input type="text" id="f_admin" value="${esc(p.admin)}"></label>
    <label class="fld"><span>${T("القطاع","Sector")}</span><input type="text" id="f_sector" value="${esc(p.sector)}"></label>
    <label class="fld"><span>${T("تاريخ اعتماد المقايسة","BOQ approval date")}</span><input type="date" id="f_date" value="${esc(p.approvedDate)}"></label>
    <label class="fld"><span>${T("تكلفة المواد التقديرية","Est. materials cost")}</span><input type="number" id="f_em" value="${p.estCost.mat}"></label>
    <label class="fld"><span>${T("تكلفة التركيبات التقديرية","Est. installation cost")}</span><input type="number" id="f_ei" value="${p.estCost.inst}"></label>
  </div></div>

  <div class="card"><header><h3>${T("رفع الكروكي","Upload layout drawing")}</h3>
    <span class="sub">${T("PDF أو صور اللوحات — تُحفظ داخل المتصفح","PDF or sheet images — held in your browser")}</span></header>
  <div class="body" style="display:flex;flex-direction:column;gap:12px">
    <div class="drop" id="drop" tabindex="0" role="button">
      <div class="ic">🗺️</div>
      <h4>${T("اسحب الكروكي هنا أو اضغط للاختيار","Drop the layout here or click to browse")}</h4>
      <p>${T("ارفع لوحة واحدة أو أكثر. بعد الرفع أدخل حصر كل لوحة في الجدول أدناه، ثم اضغط «استنباط الحصر وكل النماذج» ليُبنى حصر المواد والأجور والنماذج آليًا.","Upload one or more sheets. Enter each sheet's tally below, then press “Derive takeoff & all forms” to build materials, wages and every form automatically.")}</p>
      <input type="file" id="fileIn" multiple accept="image/*,.pdf" hidden>
    </div>
    ${p.files.length?`<div class="thumbs">${p.files.map((f,i)=>`<div class="thumb">
        ${f.url&&f.type.startsWith("image")?`<img src="${f.url}" alt="${esc(f.name)}">`:`<div class="ph">📄</div>`}
        <div class="meta"><b title="${esc(f.name)}">${esc(f.name)}</b>
        <span class="muted">${nf(f.size/1024)} KB</span>
        <button class="btn sm gh noprint" data-rmfile="${i}">${T("حذف","Remove")}</button></div></div>`).join("")}</div>`
      :`<p class="muted" style="font-size:12.5px">${T("لم تُرفع لوحات بعد.","No sheets uploaded yet.")}</p>`}
  </div></div>

  <div class="card"><header><h3>${T("حصر اللوحات من الكروكي","Sheet-by-sheet tally")}</h3>
    <span class="sub">${T("المدخلات التي يُبنى عليها الحصر الآلي","Inputs the automatic takeoff is built from")}</span>
    <span class="sp"></span>
    <button class="btn sm noprint" id="addSheet">${T("+ لوحة","+ Sheet")}</button>
    <button class="btn sm gh noprint" id="copySheets">${T("نسخ للإكسل","Copy to Excel")}</button></header>
  <div class="body tight scroll"><table id="tblSheets"><thead><tr>
    <th>${T("البند","Item")}</th>${p.sheets.map((s,i)=>`<th class="n">${esc(s.name||"لوحة "+(i+1))}</th>`).join("")}<th class="n">${T("الإجمالي","Total")}</th></tr></thead>
    <tbody>${SHEET_FIELDS.map(g=>`
      <tr><td colspan="${p.sheets.length+2}" style="background:var(--surface-2);font-weight:600;font-size:11.5px;color:var(--ink-2)">${esc(T(g.g,g.gEn))}</td></tr>
      ${g.f.map(f=>`<tr><td class="wrap-t">${esc(T(f[1],f[2]))}</td>
        ${p.sheets.map((s,i)=>`<td class="n"><input type="number" step="any" data-sheet="${i}" data-key="${f[0]}" value="${+s[f[0]]||0}"></td>`).join("")}
        <td class="n"><b>${nf(t[f[0]],t[f[0]]%1?1:0)}</b></td></tr>`).join("")}`).join("")}
    </tbody></table></div></div>

  <div class="card"><header><h3>${T("معاملات الحصر","Takeoff factors")}</h3>
    <span class="sub">${T("قواعد الاشتقاق حسب كود SEC — عدّلها لتناسب المشروع","SEC-code derivation rules — tune per project")}</span></header>
  <div class="body grid g6">${[
    ["drumLen","طول بكرة كابل م.ض (م)","MV drum length (m)"],["wastePct","نسبة الهالك %","Waste %"],
    ["indirectPct","تكاليف غير مباشرة %","Indirect %"],["cuPerRMU","نحاس 70 لكل RMU (م)","Cu 70 per RMU (m)"],
    ["cuPerTR","نحاس 35 لكل محطة (م)","Cu 35 per sub (m)"],["rodsPerRMU","قضبان تأريض/RMU","Rods per RMU"],
    ["rodsPerTR","قضبان تأريض/محطة","Rods per sub"],["rodsPerPillar","قضبان تأريض/لوحة","Rods per pillar"],
    ["cConnPerRMU","وصلة C لكل RMU","C-conn per RMU"],["luPerRMU","وصلة نحاس 70/RMU","Cu lug 70 per RMU"],
    ["clampPerTR","مشبك تأريض/محطة","Clamp per sub"],["connPerTR","وصلة نحاس 35/محطة","Cu lug 35 per sub"],
    ["elbowPerTR","أكواع 3×400/محطة","Elbows per sub"],["elbowPhases","أكواع لكل نهاية","Elbows per term"],
    ["bollardPerRMU","أعمدة حماية/معدة","Bollards per unit"],["vlfPerSection","اختبار VLF/قطعة","VLF per section"]
  ].map(([k,ar,en])=>`<label class="fld"><span>${esc(T(ar,en))}</span>
    <input type="number" step="any" data-factor="${k}" value="${p.factors[k]}"></label>`).join("")}</div></div>

  <div class="card"><header><h3>${T("ناتج الحصر الآلي","Derived takeoff")}</h3>
    <span class="sub">${p.derived?T("محدّث","Up to date"):T("اضغط زر الاستنباط في اللوحة الجانبية","Press Derive in the side panel")}</span>
    <span class="sp"></span><button class="btn sm gh noprint" id="copyDerived">${T("نسخ للإكسل","Copy to Excel")}</button></header>
  ${p.derived?`<div class="body tight scroll"><table id="tblDerived"><thead><tr>
      <th>${T("الصنف","Class")}</th><th>${T("رقم البند","Code")}</th><th>${T("الوصف","Description")}</th>
      <th>${T("الوحدة","Unit")}</th><th class="n">${T("الكمية","Qty")}</th>
      <th class="n">${T("سعر الوحدة","Unit price")}</th><th class="n">${T("الإجمالي ريال","Total SAR")}</th></tr></thead>
    <tbody>
      ${MATERIALS.filter(m=>(p.derived.mats[m.c]||0)>0).map(m=>`<tr>
        <td><span class="pill ${m.k==="main"?"acc":""}">${m.k==="main"?T("مادة رئيسية","Main"):T("مادة تفصيلية","Detail")}</span></td>
        <td class="code">${m.c}</td><td class="wrap-t">${esc(AR()?m.ar:m.en)}</td><td>${esc(T(m.u,m.u==="م"?"m":m.u==="عدد"?"no":m.u))}</td>
        <td class="n">${nf(p.derived.mats[m.c])}</td><td class="n">${nf(m.p,2)}</td>
        <td class="n">${money(p.derived.mats[m.c]*m.p)}</td></tr>`).join("")}
      ${WORKS.filter(x=>(p.derived.works[x.c]||0)>0).map(x=>`<tr>
        <td><span class="pill">${T("أجور","Works")}</span></td>
        <td class="code">${x.c}</td><td class="wrap-t">${esc(AR()?x.ar:x.en)}</td><td>${esc(x.u)}</td>
        <td class="n">${nf(p.derived.works[x.c],p.derived.works[x.c]%1?1:0)}</td><td class="n">${nf(x.p,2)}</td>
        <td class="n">${money(p.derived.works[x.c]*x.p)}</td></tr>`).join("")}
    </tbody>
    <tfoot>
      <tr><td colspan="6">${T("إجمالي المواد","Materials total")}</td><td class="n">${money(p.derived.cost.mat)}</td></tr>
      <tr><td colspan="6">${T("إجمالي التركيبات والأجور","Installation & works total")}</td><td class="n">${money(p.derived.cost.inst)}</td></tr>
      <tr><td colspan="6">${T("التكاليف غير المباشرة","Indirect costs")} (${nf(p.factors.indirectPct,1)}%)</td><td class="n">${money(p.derived.cost.ind)}</td></tr>
      <tr><td colspan="6">${T("التكلفة الإجمالية المستنبطة","Derived total cost")}</td><td class="n">${money(p.derived.cost.total)}</td></tr>
    </tfoot></table></div>`
  :`<div class="body"><p class="muted">${T("لا يوجد ناتج بعد — أدخل حصر اللوحات ثم شغّل محرك الاستنباط.","No output yet — enter the sheet tally, then run the derivation engine.")}</p></div>`}
  </div>`;
}

function viewBOQ(){
  const p=P(), d=p.derived;
  const rows = WORKS.map(x=>{
    const b=p.boq[x.c]||{plan:0,exec:0}, der=d?(d.works[x.c]||0):null;
    return {x, plan:+b.plan||0, exec:+b.exec||0, der};
  }).filter(r=>r.plan||r.exec||r.der);
  const sum = k => rows.reduce((s,r)=>s+(r[k]||0)*r.x.p,0);
  const planC=sum("plan"), execC=sum("exec"), derC=d?sum("der"):0;
  const matRows = MATERIALS.map(m=>{
    const b=p.mat[m.c]||{iss:0,req:0}, der=d?(d.mats[m.c]||0):null;
    return {m, iss:+b.iss||0, req:+b.req||0, der};
  }).filter(r=>r.iss||r.req||r.der);
  const issC=matRows.reduce((s,r)=>s+r.iss*r.m.p,0), reqC=matRows.reduce((s,r)=>s+r.req*r.m.p,0);
  return `
  <div class="sec-title"><span class="eyebrow">${T("الصفحة الثانية","Page two")}</span>
    <h2>${T("المقايسة ومقارنة المصروف بالمركّب","BOQ — issued vs installed vs layout")}</h2></div>

  <div class="grid g4">
    <div class="stat"><span class="k">${T("أجور المقايسة","BOQ works")}</span><span class="v">${money(planC)}</span><span class="d">${T("مخطط","Planned")}</span></div>
    <div class="stat"><span class="k">${T("أجور المنفّذ","Executed works")}</span><span class="v">${money(execC)}</span>
      <span class="d ${execC>planC?"delta up":"delta down"}">${execC>planC?"+":""}${money(execC-planC)} ${T("ريال","SAR")}</span></div>
    <div class="stat"><span class="k">${T("أجور الكروكي","Layout works")}</span><span class="v">${d?money(derC):"—"}</span><span class="d">${T("مستنبط آليًا","Auto-derived")}</span></div>
    <div class="stat"><span class="k">${T("فرق المواد","Material gap")}</span><span class="v ${reqC>issC?"delta up":"delta down"}">${money(reqC-issC)}</span><span class="d">${T("مطلوب − مصروف","Required − issued")}</span></div>
  </div>

  <div class="card"><header><h3>${T("بنود التركيبات والأجور","Installation & works items")}</h3>
    <span class="sub">${T("المخطط بالمقايسة · المنفّذ على الطبيعة · المستنبط من الكروكي","BOQ planned · site executed · layout derived")}</span>
    <span class="sp"></span><button class="btn sm gh noprint" id="copyBoq">${T("نسخ للإكسل","Copy to Excel")}</button></header>
  <div class="body tight scroll"><table id="tblBoq"><thead><tr>
    <th>${T("رقم البند","Code")}</th><th>${T("وصف البند","Description")}</th><th>${T("الوحدة","Unit")}</th>
    <th class="n">${T("السعر","Price")}</th><th class="n">${T("المخطط","Planned")}</th><th class="n">${T("المنفّذ","Executed")}</th>
    <th class="n">${T("الكروكي","Layout")}</th><th class="n">${T("فرق الكمية","Qty diff")}</th>
    <th class="n">${T("تكلفة الفرق","Cost diff")}</th><th>${T("الحالة","Status")}</th></tr></thead>
    <tbody>${rows.map(r=>{
      const diff=r.exec-r.plan, cd=diff*r.x.p;
      const dev = r.der!=null && r.exec ? Math.abs(r.exec-r.der)/Math.max(r.der,1)*100 : null;
      const st = dev==null?["","—"]:dev<=5?["ok",T("مطابق للكروكي","Matches layout")]:dev<=20?["warn",T("انحراف بسيط","Minor deviation")]:["bad",T("يحتاج مراجعة","Needs review")];
      return `<tr>
        <td class="code">${r.x.c}</td><td class="wrap-t">${esc(AR()?r.x.ar:r.x.en)}</td><td>${esc(r.x.u)}</td>
        <td class="n">${nf(r.x.p,2)}</td>
        <td class="n"><input type="number" step="any" data-boq="${r.x.c}" data-f="plan" value="${r.plan}"></td>
        <td class="n"><input type="number" step="any" data-boq="${r.x.c}" data-f="exec" value="${r.exec}"></td>
        <td class="n">${r.der==null?"—":nf(r.der,r.der%1?1:0)}</td>
        <td class="n ${diff>0?"delta up":diff<0?"delta down":"delta zero"}">${diff>0?"+":""}${nf(diff,diff%1?1:0)}</td>
        <td class="n ${cd>0?"delta up":cd<0?"delta down":"delta zero"}">${cd>0?"+":""}${money(cd)}</td>
        <td><span class="pill ${st[0]}">${st[1]}</span></td></tr>`;}).join("")}
    </tbody>
    <tfoot><tr><td colspan="4">${T("الإجمالي","Total")}</td><td class="n">${money(planC)}</td><td class="n">${money(execC)}</td>
      <td class="n">${d?money(derC):"—"}</td><td class="n">—</td>
      <td class="n ${execC>planC?"delta up":"delta down"}">${execC>planC?"+":""}${money(execC-planC)}</td><td></td></tr></tfoot>
  </table></div></div>

  <div class="card"><header><h3>${T("موازنة المواد","Material balance")}</h3>
    <span class="sub">${T("المصروف من المستودع (DDO) مقابل المطلوب للتنفيذ ومقابل الكروكي","Store-issued (DDO) vs required vs layout")}</span>
    <span class="sp"></span><button class="btn sm gh noprint" id="copyMat">${T("نسخ للإكسل","Copy to Excel")}</button></header>
  <div class="body tight scroll"><table id="tblMat"><thead><tr>
    <th>${T("الصنف","Class")}</th><th>${T("رقم المادة","Code")}</th><th>${T("وصف المادة","Description")}</th><th>${T("الوحدة","Unit")}</th>
    <th class="n">${T("السعر","Price")}</th><th class="n">${T("المصروف","Issued")}</th><th class="n">${T("المطلوب","Required")}</th>
    <th class="n">${T("الكروكي","Layout")}</th><th class="n">${T("العجز/الفائض","Gap")}</th><th class="n">${T("قيمة الفرق","Value")}</th></tr></thead>
    <tbody>${matRows.map(r=>{
      const gap=r.req-r.iss;
      return `<tr>
        <td><span class="pill ${r.m.k==="main"?"acc":""}">${r.m.k==="main"?T("رئيسية","Main"):T("تفصيلية","Detail")}</span></td>
        <td class="code">${r.m.c}</td><td class="wrap-t">${esc(AR()?r.m.ar:r.m.en)}</td><td>${esc(r.m.u)}</td>
        <td class="n">${nf(r.m.p,2)}</td>
        <td class="n"><input type="number" step="any" data-mat="${r.m.c}" data-f="iss" value="${r.iss}"></td>
        <td class="n"><input type="number" step="any" data-mat="${r.m.c}" data-f="req" value="${r.req}"></td>
        <td class="n">${r.der==null?"—":nf(r.der)}</td>
        <td class="n ${gap>0?"delta up":gap<0?"delta down":"delta zero"}">${gap>0?"+":""}${nf(gap)}</td>
        <td class="n ${gap>0?"delta up":gap<0?"delta down":"delta zero"}">${gap>0?"+":""}${money(gap*r.m.p)}</td></tr>`;}).join("")}
    </tbody>
    <tfoot><tr><td colspan="5">${T("الإجمالي","Total")}</td><td class="n">${money(issC)}</td><td class="n">${money(reqC)}</td>
      <td class="n">—</td><td class="n">—</td><td class="n ${reqC>issC?"delta up":"delta down"}">${money(reqC-issC)}</td></tr></tfoot>
  </table></div></div>

  <div class="note">${T("قاعدة المقارنة: المصروف يُؤخذ من أوامر التسليم المباشر (DDO) ودخول المستودع، والمركّب يُحصر على الطبيعة، والكروكي هو المرجع الهندسي. أي مادة مصروفة ولم تُركّب ولم تُرجَع للمستودع تُخصم من مستحقات المقاول وفق آلية خصم المواد المفقودة.","Comparison basis: issued quantities come from Direct Delivery Orders and store intake, installed quantities are measured on site, and the layout drawing is the engineering reference. Any material issued but neither installed nor returned is deducted from contractor dues under the lost-materials deduction mechanism.")}</div>`;
}

function viewWages(){
  const p=P(), d=p.derived;
  const groups = [
    ["exc","الحفريات","Excavation"],["duct","المواسير والثقب الأفقي","Ducts & HDD"],["lay","تمديد الكابلات","Cable laying"],
    ["term","النهايات والوصلات","Terminations & joints"],["asph","السفلتة","Asphalt"],["civil","الأعمال المدنية","Civil works"],
    ["inst","تركيب المعدات","Equipment installation"],["earth","التأريض","Earthing"],["prot","الحماية","Protection"],
    ["oh","أعمال هوائية","Overhead works"],["rem","الإزالات","Removals"],["test","الاختبارات","Testing"]
  ];
  const line = x => { const b=p.boq[x.c]||{}; return {q:+b.exec||0, v:(+b.exec||0)*x.p}; };
  const gTot = g => WORKS.filter(x=>x.g===g).reduce((s,x)=>s+line(x).v,0);
  const worksTotal = WORKS.reduce((s,x)=>s+line(x).v,0);
  const matReq = MATERIALS.reduce((s,m)=>{const b=p.mat[m.c]||{};return s+(+b.req||0)*m.p;},0);
  const matIss = MATERIALS.reduce((s,m)=>{const b=p.mat[m.c]||{};return s+(+b.iss||0)*m.p;},0);
  const ind = (worksTotal+matReq)*p.factors.indirectPct/100;
  const curTotal = worksTotal + matReq + ind;
  const estTotal = p.estCost.mat+p.estCost.inst+p.estCost.ind;
  const prevTotal = p.prevTotal || estTotal;
  const varPct = estTotal? (curTotal-estTotal)/estTotal*100 : 0;
  const bigItems = WORKS.map(x=>({x, ...line(x), plan:(+((p.boq[x.c]||{}).plan)||0)}))
    .map(o=>({...o, dq:o.q-o.plan, dv:(o.q-o.plan)*o.x.p}))
    .filter(o=>Math.abs(o.dv)>0).sort((a,b)=>Math.abs(b.dv)-Math.abs(a.dv)).slice(0,12);
  const maxG = Math.max(...groups.map(g=>gTot(g[0])),1);
  return `
  <div class="sec-title"><span class="eyebrow">${T("الصفحة الثالثة","Page three")}</span>
    <h2>${T("فاتورة الأجور ونموذج تعديل المقايسة","Wages invoice & BOQ revision form")}</h2></div>

  <div class="grid g4">
    <div class="stat hero"><span class="k">${T("صافي فاتورة الأجور","Net wages invoice")}</span><span class="v">${money(worksTotal)}</span>
      <span class="d">${T("ريال · كميات منفّذة","SAR · executed quantities")}</span></div>
    <div class="stat"><span class="k">${T("قيمة المواد المطلوبة","Required materials")}</span><span class="v">${money(matReq)}</span>
      <span class="d">${T("المصروف","Issued")}: ${money(matIss)}</span></div>
    <div class="stat"><span class="k">${T("التكاليف غير المباشرة","Indirect costs")}</span><span class="v">${money(ind)}</span>
      <span class="d">${nf(p.factors.indirectPct,1)}%</span></div>
    <div class="stat"><span class="k">${T("إجمالي الاعتماد الحالي","Current approval total")}</span><span class="v">${money(curTotal)}</span>
      <span class="d ${varPct>0?"delta up":"delta down"}">${varPct>0?"+":""}${nf(varPct,2)}% ${T("عن التقديرية","vs estimate")}</span></div>
  </div>

  <div class="grid g2">
    <div class="card"><header><h3>${T("توزيع الأجور على مجموعات الأعمال","Wages by work group")}</h3></header>
      <div class="body bars">${groups.map(([g,ar,en])=>{const v=gTot(g);return `<div class="bar-row">
        <span>${esc(T(ar,en))}</span><span class="bar-track"><span class="bar-fill" style="width:${v/maxG*100}%"></span></span>
        <span class="bar-val">${money(v)}</span></div>`;}).join("")}</div></div>

    <div class="card"><header><h3>${T("أكبر بنود الفرق","Largest variance items")}</h3>
      <span class="sub">${T("مرتبة بقيمة الفرق","Ranked by variance value")}</span></header>
      <div class="body tight scroll"><table><thead><tr><th>${T("البند","Code")}</th><th>${T("الوصف","Description")}</th>
        <th class="n">${T("فرق الكمية","Qty diff")}</th><th class="n">${T("قيمة الفرق","Value")}</th></tr></thead>
        <tbody>${bigItems.map(o=>`<tr><td class="code">${o.x.c}</td><td class="wrap-t">${esc(AR()?o.x.ar:o.x.en)}</td>
          <td class="n ${o.dq>0?"delta up":"delta down"}">${o.dq>0?"+":""}${nf(o.dq,o.dq%1?1:0)}</td>
          <td class="n ${o.dv>0?"delta up":"delta down"}">${o.dv>0?"+":""}${money(o.dv)}</td></tr>`).join("")}
        </tbody></table></div></div>
  </div>

  <div class="card"><header><h3>${T("فاتورة الأجور التفصيلية","Detailed wages invoice")}</h3>
    <span class="sub">${T("الكميات المنفّذة × سعر العقد الموحد","Executed quantities × unified-contract rate")}</span>
    <span class="sp"></span><button class="btn sm gh noprint" id="copyWages">${T("نسخ للإكسل","Copy to Excel")}</button></header>
  <div class="body tight scroll"><table id="tblWages"><thead><tr>
    <th>#</th><th>${T("رقم البند","Code")}</th><th>${T("وصف البند","Description")}</th><th>${T("الوحدة","Unit")}</th>
    <th class="n">${T("الكمية المنفّذة","Executed qty")}</th><th class="n">${T("سعر الوحدة","Rate")}</th><th class="n">${T("القيمة ريال","Value SAR")}</th></tr></thead>
    <tbody>${(()=>{let i=0;return groups.map(([g,ar,en])=>{
      const items = WORKS.filter(x=>x.g===g && line(x).q>0);
      if(!items.length) return "";
      return `<tr><td colspan="7" style="background:var(--surface-2);font-weight:600;font-size:11.5px;color:var(--ink-2)">${esc(T(ar,en))}</td></tr>`+
        items.map(x=>{const L=line(x);i++;return `<tr><td class="n">${i}</td><td class="code">${x.c}</td>
          <td class="wrap-t">${esc(AR()?x.ar:x.en)}</td><td>${esc(x.u)}</td>
          <td class="n">${nf(L.q,L.q%1?1:0)}</td><td class="n">${nf(x.p,2)}</td><td class="n">${money(L.v)}</td></tr>`;}).join("");
      }).join("");})()}
    </tbody>
    <tfoot><tr><td colspan="6">${T("إجمالي الأجور","Wages total")}</td><td class="n">${money(worksTotal)}</td></tr></tfoot>
  </table></div></div>

  <div class="card"><header><h3>${T("نموذج تعديل المقايسة (نموذج 02)","BOQ revision form (Form 02)")}</h3>
    <span class="sub">${T("نشاط التوزيع وخدمات المشتركين","Distribution & Customer Services")}</span>
    <span class="sp"></span><button class="btn sm noprint" id="printWages">${T("طباعة النموذج","Print form")}</button></header>
  <div class="body">
    <div class="doc">
      <div class="rowflex" style="justify-content:space-between;margin-bottom:12px">
        <div><h4>${T("نموذج تعديل مقايسة – 02","BOQ Revision – Form 02")}</h4>
          <span class="muted" style="font-size:12px">${T("الإدارة","Dept")}: ${esc(p.admin)} · ${T("القطاع","Sector")}: ${esc(p.sector)} · ${T("المقاول","Contractor")}: ${esc(CONTRACTORS[p.contractor]||"")}</span></div>
        <div class="tagrow"><span class="pill acc">${T("مقايسة رقم","BOQ")} ${esc(p.wo)}</span>
          <span class="pill">${T("اعتماد","Approved")} ${esc(p.approvedDate||"—")}</span></div>
      </div>
      <div class="scroll"><table id="tblRev"><thead><tr>
        <th>${T("تكلفة المقايسة","BOQ cost")}</th><th class="n">${T("التقديرية","Estimated")}</th>
        <th class="n">${T("آخر اعتماد سابق","Last approval")}</th><th class="n">${T("الاعتماد الحالي","Current approval")}</th>
        <th class="n">${T("الفرق ريال","Diff SAR")}</th><th class="n">${T("النسبة %","%")}</th></tr></thead>
        <tbody>
          ${[["تكلفة المواد","Materials", p.estCost.mat, matIss, matReq],
             ["تكلفة التركيبات","Installations", p.estCost.inst, p.estCost.inst, worksTotal],
             ["التكاليف غير المباشرة","Indirect", p.estCost.ind, (matIss+p.estCost.inst)*p.factors.indirectPct/100, ind]
            ].map(([ar,en,est,prev,cur])=>`<tr><td>${esc(T(ar,en))}</td>
              <td class="n">${money(est)}</td><td class="n">${money(prev)}</td><td class="n">${money(cur)}</td>
              <td class="n ${cur-est>0?"delta up":"delta down"}">${cur-est>0?"+":""}${money(cur-est)}</td>
              <td class="n ${cur-est>0?"delta up":"delta down"}">${est?nf((cur-est)/est*100,2):"—"}</td></tr>`).join("")}
        </tbody>
        <tfoot><tr><td>${T("التكلفة الإجمالية","Total cost")}</td><td class="n">${money(estTotal)}</td>
          <td class="n">${money(prevTotal)}</td><td class="n">${money(curTotal)}</td>
          <td class="n ${varPct>0?"delta up":"delta down"}">${varPct>0?"+":""}${money(curTotal-estTotal)}</td>
          <td class="n ${varPct>0?"delta up":"delta down"}">${nf(varPct,2)}</td></tr></tfoot>
      </table></div>

      <div class="note ${Math.abs(varPct)>30?"warn":""}" style="margin-top:12px">
        <b>${T("صاحب الصلاحية","Approving authority")}:</b> ${esc(authorityFor(varPct))}.
        ${T("تُحتسب نسبة فرق المقايسة على أساس المقايسة التقديرية.","The variance percentage is calculated against the estimated BOQ.")}
        ${Math.abs(varPct)>30?T(" ويلزم إرفاق تقرير فني لتجاوز الفرق 30%."," A technical report is required as the variance exceeds 30%."):""}
      </div>

      <label class="fld" style="margin-top:12px"><span>${T("مبررات زيادة/نقص تكلفة المقايسة","Justification for the variance")}</span>
        <textarea id="f_notes" rows="3">${esc(p.notes||"تطبيق آلية خصم قيمة المواد المفقودة من مستحقات المقاول لعدم إرجاعها، وزيادة أطوال الحفر والسفلتة وفق اشتراطات أمانة المنطقة.")}</textarea></label>

      <div class="sign">
        <div><b>${T("إعداد","Prepared")}</b>${T("مدير دائرة التخطيط والإنشاءات","Planning & Construction Manager")}</div>
        <div><b>${T("مراجعة","Reviewed")}</b>${T("مدير إدارة هندسة التوزيع","Distribution Engineering Manager")}</div>
        <div><b>${T("توصية","Recommended")}</b>${T("مدير إدارة كهرباء نجران","Najran Electricity Manager")}</div>
        <div><b>${T("اعتماد","Approved")}</b>${esc(authorityFor(varPct))}</div>
      </div>
      <p class="muted" style="font-size:11.5px;margin-top:12px">${T("المرفقات: 1) قائمة موازنة المواد والأعمال  2) مستندات تعديل المقايسة واشتراطات رخص الحفر  3) تقرير فني عند تجاوز الفرق 30%.","Attachments: 1) Material & works balance list  2) Revision documents and excavation permit conditions  3) Technical report if variance exceeds 30%.")}</p>
    </div>
  </div></div>`;
}

function viewForms(){
  const p=P(), t=totals(p), d=p.derived;
  const hdd = t.hdd, milling = t.milling, asph = t.asphalt;
  const trenchLV = t.asLT13+t.saLT13+t.saLT4, trenchMV = t.asHT1+t.saHT1+t.asHT2+t.saHT2+t.asHT3+t.saHT3+t.saHT4;
  const pr = c => (WORKS.find(x=>x.c===c)||{p:0}).p;
  return `
  <div class="sec-title"><span class="eyebrow">${T("الصفحة الرابعة","Page four")}</span>
    <h2>${T("النماذج المرتبطة بالكروكي","Forms linked to the layout")}</h2>
    <span class="s">${T("تُملأ آليًا من الحصر — راجعها ثم اطبعها","Auto-filled from the takeoff — review, then print")}</span></div>

  <div class="card"><header><h3>${T("ضبط الحماية للوحدات الحلقية","RMU protection settings")}</h3>
    <span class="sub">${p.rmus.length} ${T("وحدة","units")} · ${p.rmus.filter(r=>r.set).length} ${T("مضبوطة","set")}</span>
    <span class="sp"></span><button class="btn sm noprint" id="addRmu">${T("+ وحدة","+ Unit")}</button>
    <button class="btn sm gh noprint" id="copyProt">${T("نسخ للإكسل","Copy to Excel")}</button></header>
  <div class="body tight scroll"><table id="tblProt"><thead><tr>
    <th>#</th><th>${T("المغذي","Feeder")}</th><th>${T("رقم الوحدة","RMU no.")}</th><th>${T("النوع","Type")}</th>
    <th>${T("المحول","TR")}</th><th>${T("مصنّع الريلاي","Relay mfr.")}</th><th>${T("الموديل","Model")}</th>
    <th>${T("اكتمال الضبط","Setting done")}</th><th>${T("نسبة CT","CT ratio")}</th><th class="n">${T("التأريض Ω","Earth Ω")}</th>
    <th>${T("الإحداثيات","GPS")}</th></tr></thead>
    <tbody>${p.rmus.map((r,i)=>`<tr>
      <td class="n">${r.no}</td><td>${esc(r.feeder)}</td><td class="code">${esc(r.rmu)}</td><td>${esc(r.type)}</td>
      <td>${esc(r.tr||"—")}</td><td>${esc(r.relay)}</td><td>${esc(r.model)}</td>
      <td><label class="chk"><input type="checkbox" data-rmu="${i}" data-f="set" ${r.set?"checked":""}>
        <span class="pill ${r.set?"ok":"warn"}">${r.set?T("نعم","Yes"):T("لا","No")}</span></label></td>
      <td class="code">${esc(r.ratio||"—")}</td>
      <td class="n" style="color:${+r.ohm>3?"var(--warn)":"var(--ok)"}">${esc(r.ohm)}</td>
      <td class="code">${esc(r.gps)}</td></tr>`).join("")}
    </tbody></table></div></div>

  <div class="card"><header><h3>${T("محضر الاستلام النهائي","Final acceptance record")}</h3>
    <span class="sub">${T("فحص ظاهري وتشغيلي لكل وحدة","Visual & functional check per unit")}</span>
    <span class="sp"></span><button class="btn sm gh noprint" id="copyAcc">${T("نسخ للإكسل","Copy to Excel")}</button></header>
  <div class="body tight scroll"><table id="tblAcc"><thead><tr>
    <th>#</th><th>${T("المغذي","Feeder")}</th><th>${T("الوحدة","Unit")}</th><th>${T("النوع","Type")}</th>
    ${ACCEPT_COLS.map(c=>`<th>${esc(T(c[1],c[2]))}</th>`).join("")}<th class="n">${T("التأريض Ω","Earth Ω")}</th></tr></thead>
    <tbody>${p.rmus.map(r=>`<tr><td class="n">${r.no}</td><td>${esc(r.feeder)}</td><td class="code">${esc(r.rmu)}</td><td>${esc(r.type)}</td>
      ${ACCEPT_COLS.map(()=>`<td><span class="pill ok">OK</span></td>`).join("")}
      <td class="n" style="color:${+r.ohm>3?"var(--warn)":"var(--ok)"}">${esc(r.ohm)}</td></tr>`).join("")}
    </tbody></table></div></div>

  <div class="grid g2">
    <div class="card"><header><h3>${T("نموذج اعتماد الحفر العادي — نموذج (1)","Standard excavation approval — Form 1")}</h3></header>
      <div class="body"><div class="doc">
        <dl class="kv">
          <dt>${T("رقم الطلب في UDS","UDS request no.")}</dt><dd class="code">${esc(p.wo)}</dd>
          <dt>${T("اسم المشروع","Project")}</dt><dd>${esc(p.name)}</dd>
          <dt>${T("موقع المشروع","Site")}</dt><dd>${esc(p.site||"—")}</dd>
          <dt>${T("طول مسار الحفر ج.متوسط","MV trench length")}</dt><dd class="num">${nf(trenchMV)} ${T("م","m")}</dd>
          <dt>${T("طول مسار الحفر ج.منخفض","LV trench length")}</dt><dd class="num">${nf(trenchLV)} ${T("م","m")}</dd>
          <dt>${T("عمق الحفر حسب المواصفات","Specified depth")}</dt><dd class="num">0.65 ${T("م","m")}</dd>
          <dt>${T("عرض الحفر","Trench width")}</dt><dd class="num">${nf(p.factors.trenchWidthMV,2)} / ${nf(p.factors.trenchWidthLV,2)} ${T("م","m")}</dd>
          <dt>${T("تكلفة بند الأعمال","Works cost")}</dt><dd class="num">${money(trenchMV*pr("301010201")+trenchLV*pr("301010101"))} ${T("ريال","SAR")}</dd>
        </dl>
        <div class="sign"><div><b>${T("إعداد","Prepared")}</b>${T("مدير دائرة التخطيط والإنشاءات","Planning & Construction")}</div>
          <div><b>${T("توصية","Recommended")}</b>${T("مدير إدارة كهرباء نجران","Najran Electricity Manager")}</div>
          <div><b>${T("اعتماد","Approved")}</b>${T("نائب رئيس التوزيع وخدمات المشتركين","VP Distribution & Customer Services")}</div></div>
      </div></div></div>

    <div class="card"><header><h3>${T("نموذج اعتماد الثقب الأفقي — نموذج (3)","HDD approval — Form 3")}</h3></header>
      <div class="body"><div class="doc">
        <dl class="kv">
          <dt>${T("رقم الطلب في UDS","UDS request no.")}</dt><dd class="code">${esc(p.wo)}</dd>
          <dt>${T("اسم المشروع","Project")}</dt><dd>${T("تحويل الشبكة من هوائي إلى أرضي","Overhead-to-underground conversion")}</dd>
          <dt>${T("طول الثقب الأفقي","HDD length")}</dt><dd class="num">${nf(hdd)} ${T("م","m")}</dd>
          <dt>${T("عدد المواسير","Number of ducts")}</dt><dd class="num">${nf(Math.max(1,Math.round(hdd/25)))}</dd>
          <dt>${T("سعر بند 302020001","Rate 302020001")}</dt><dd class="num">${nf(pr("302020001"),2)} ${T("ريال/م","SAR/m")}</dd>
          <dt>${T("تكلفة بند الأعمال","Works cost")}</dt><dd class="num">${money(hdd*pr("302020001"))} ${T("ريال","SAR")}</dd>
          <dt>${T("المبررات","Justification")}</dt><dd>${T("حسب اشتراطات أمانة منطقة نجران لعبور الطرق الرئيسية","Per Najran Municipality requirements for main-road crossings")}</dd>
        </dl>
        <div class="sign"><div><b>${T("إعداد","Prepared")}</b>${T("مدير دائرة التخطيط","Planning Manager")}</div>
          <div><b>${T("مراجعة","Reviewed")}</b>${T("مدير إدارة هندسة التوزيع","Distribution Engineering")}</div>
          <div><b>${T("اعتماد","Approved")}</b>${T("نائب رئيس التوزيع وخدمات المشتركين","VP Distribution & Customer Services")}</div></div>
      </div></div></div>

    <div class="card"><header><h3>${T("نموذج الكشط وإعادة السفلتة — نموذج (4)","Milling & reinstatement — Form 4")}</h3></header>
      <div class="body"><div class="doc">
        <dl class="kv">
          <dt>${T("رقم الطلب في UDS","UDS request no.")}</dt><dd class="code">${esc(p.wo)}</dd>
          <dt>${T("طول مسار الحفر المسفلت","Asphalt trench length")}</dt><dd class="num">${nf(t.asHT1+t.asHT2+t.asHT3+t.asLT13)} ${T("م","m")}</dd>
          <dt>${T("عرض الحفر","Trench width")}</dt><dd class="num">${nf(p.factors.trenchWidthLV,2)} ${T("م","m")}</dd>
          <dt>${T("عرض الكشط وإعادة السفلتة","Milling width")}</dt><dd class="num">${nf(p.factors.trenchWidthMV,2)} ${T("م","m")}</dd>
          <dt>${T("مساحة إعادة السفلتة","Reinstatement area")}</dt><dd class="num">${nf(asph)} ${T("م²","m²")}</dd>
          <dt>${T("مساحة الكشط","Milling area")}</dt><dd class="num">${nf(milling)} ${T("م²","m²")}</dd>
          <dt>${T("إجمالي التكلفة","Total cost")}</dt><dd class="num">${money(asph*pr("306010002")+milling*pr("306010004"))} ${T("ريال","SAR")}</dd>
        </dl>
        <div class="sign"><div><b>${T("إعداد","Prepared")}</b>${T("مدير دائرة التخطيط والإنشاءات","Planning & Construction")}</div>
          <div><b>${T("اعتماد","Approved")}</b>${T("نائب رئيس التوزيع وخدمات المشتركين","VP Distribution & Customer Services")}</div></div>
      </div></div></div>

    <div class="card"><header><h3>${T("محضر استلام الأصول من المقاول","Asset handover record")}</h3></header>
      <div class="body tight scroll"><table id="tblAssets"><thead><tr><th>${T("الأصل","Asset")}</th>
        <th class="n">${T("العدد/الكمية","Qty")}</th><th>${T("الوحدة","Unit")}</th><th>${T("مرجع الحصر","Takeoff ref.")}</th></tr></thead>
        <tbody>${[
          ["وحدة حلقية RMU 3 مسارات","RMU 3-way",t.rmu3w,"عدد","8327004"],
          ["وحدة حلقية RMU 4 مسارات","RMU 4-way",t.rmu4w,"عدد","8327005"],
          ["محطة وحدة 500ك.ف.أ","Unit substation 500kVA",t.tr220+t.tr400,"عدد","8567054"],
          ["محطة وحدة داخلية","Indoor unit substation",t.trIndoor,"عدد","8569108"],
          ["لوحة توزيع فرعية","LV distribution pillar",t.pillars,"عدد","309010102"],
          ["كابل ج.متوسط 3×400","MV cable 3×400",t.htCable,"م","8114005"],
          ["كابل ج.منخفض 4×300","LV cable 4×300",t.lt300,"م","8111007"],
          ["كابل ج.منخفض 4×185","LV cable 4×185",t.lt185,"م","8111006"],
          ["كابل ج.منخفض 4×70","LV cable 4×70",t.lt70,"م","8111005"],
          ["أعمدة حماية","Protection bollards",p.factors.bollardPerRMU*(t.rmuNew+t.trTot),"عدد","604000002"],
          ["قضبان تأريض","Earth rods",p.factors.rodsPerRMU*t.rmuNew+p.factors.rodsPerTR*t.trTot+p.factors.rodsPerPillar*t.pillars,"عدد","8202054"]
        ].map(([ar,en,q,u,ref])=>`<tr><td class="wrap-t">${esc(T(ar,en))}</td><td class="n">${nf(q)}</td>
          <td>${esc(u)}</td><td class="code">${ref}</td></tr>`).join("")}
        </tbody></table></div></div>
  </div>

  <div class="card"><header><h3>${T("سجل الاختبارات المطلوبة","Required test register")}</h3></header>
    <div class="body tight scroll"><table><thead><tr><th>${T("الاختبار","Test")}</th><th>${T("رقم البند","Code")}</th>
      <th class="n">${T("العدد المطلوب","Required")}</th><th>${T("المرجع","Basis")}</th><th>${T("الحالة","Status")}</th></tr></thead>
      <tbody>${[
        ["اختبار كابل ج.متوسط VLF وتقديم التقارير","MV cable VLF test & reports","311000016",d?d.works["311000016"]:0,"كل قطعة كابل بين نهايتين","Each cable section"],
        ["اختبار الكثافة القصوى (بروكتر)","Proctor maximum density","307010002",d?d.works["307010002"]:0,"كل 800م حفر","Per 800 m of trench"],
        ["اختبار دك التربة للكثافة الحقلية","Field density compaction","307010005",d?d.works["307010005"]:0,"كل 800م حفر","Per 800 m of trench"],
        ["تعيين نسبة الأسفلت والتدرج الحبيبي","Asphalt content & gradation","307040002",d?d.works["307040002"]:0,"كل 2500م² سفلتة","Per 2,500 m² of asphalt"],
        ["قياس مقاومة التأريض ≤ 3 أوم","Earth resistance ≤ 3 Ω","—",p.rmus.length,"كل معدة أرضية","Each ground unit"],
        ["اختبار تتابع الأوجه قبل التغذية","Phase-sequence test before energising","—",p.rmus.length,"كل وحدة حلقية","Each RMU"]
      ].map(([ar,en,c,q,bar,ben])=>`<tr><td class="wrap-t">${esc(T(ar,en))}</td><td class="code">${c}</td>
        <td class="n">${nf(q||0)}</td><td>${esc(T(bar,ben))}</td>
        <td><span class="pill ${q?"acc":"warn"}">${q?T("مُستنبط","Derived"):T("بانتظار الحصر","Pending")}</span></td></tr>`).join("")}
      </tbody></table></div></div>`;
}

function viewRecs(){
  const p=P();
  const SEC = [
   ["حزمة إغلاق أمر العمل","Work-order closeout pack", [
     ["محضر الاستلام الابتدائي والنهائي موقّع من المشرف ورئيس وحدة المشاريع","Preliminary and final acceptance records signed by the supervisor and projects unit head"],
     ["قائمة موازنة المواد والأعمال (Material & Works Balance) مطابقة لـ SAP","Material & works balance list reconciled to SAP"],
     ["سند إرجاع المواد الفائضة للمستودع قبل طلب الإغلاق","Return note for surplus materials before requesting closure"],
     ["آلية خصم المواد المفقودة موقّعة من المقاول","Signed lost-materials deduction acknowledgement"],
     ["كروكي As-Built موقّع ومختوم بإحداثيات GPS لكل معدة","Signed and stamped As-Built drawing with GPS per unit"]]],
   ["مستندات الجهات الحكومية","Authority documentation", [
     ["رخصة حفر سارية من أمانة منطقة نجران وشروطها المرفقة","Valid excavation permit from Najran Municipality with its conditions"],
     ["موافقة وزارة النقل للطرق التابعة لها قبل الكشط وإعادة السفلتة","Ministry of Transport approval for its roads before milling and reinstatement"],
     ["إخلاء طرف من شركات الخدمات (مياه، اتصالات، غاز) قبل الحفر","No-objection certificates from utilities (water, telecom, gas) before excavation"],
     ["محضر تسليم موقع بعد إعادة الوضع لما كان عليه","Site handover record after full reinstatement"]]],
   ["الجودة والاختبارات","Quality & testing", [
     ["تقارير VLF لكل قطعة كابل ج.متوسط معتمدة من مختبر معتمد","VLF reports for every MV cable section from an accredited lab"],
     ["تقارير بروكتر والكثافة الحقلية مرتبطة بمواقع محددة على الكروكي","Proctor and field-density reports tied to marked layout locations"],
     ["شهادات المواد ومطابقتها لمواصفة SEC (Material Test Certificates)","Material test certificates conforming to SEC specification"],
     ["تقرير قياس مقاومة التأريض لكل معدة مع صور التوثيق","Earth-resistance measurement report per unit with photographic evidence"],
     ["تقرير تتابع الأوجه ونتائج ضبط الحماية موقّعة من وحدة الحماية","Phase-sequence report and relay settings signed by the protection unit"]]],
   ["الحماية والتشغيل","Protection & operations", [
     ["جدول ضبط الحماية النهائي معتمد من إدارة الحماية قبل التغذية","Final relay settings table approved by Protection before energising"],
     ["مخطط التشغيل Single Line Diagram محدّث بأرقام الوحدات والمغذيات","Updated single-line diagram with unit and feeder numbers"],
     ["تحديث بيانات GIS وربط إحداثيات كل RMU بنظام الشركة","GIS update linking each RMU's coordinates to the corporate system"],
     ["أمر عمل تشغيلي (Switching Program) معتمد لنقل الأحمال","Approved switching program for load transfer"]]],
   ["السلامة والبيئة","Safety & environment", [
     ["خطة السلامة المرورية معتمدة، ولوحات التحويلة قبل بدء الحفر","Approved traffic-management plan and diversion signage before excavation"],
     ["تصاريح العمل (Hot/Cold Work Permits) وسجل التوعية اليومي","Work permits and the daily toolbox-talk register"],
     ["خطة التخلص من نواتج الحفر والأسفلت المكشوط","Disposal plan for excavation spoil and milled asphalt"]]],
   ["مطالبات تتوقعها من الاستشاري","Likely consultant requests", [
     ["مقارنة ثلاثية: الكروكي × المصروف من المستودع × المركّب على الطبيعة لكل بند","Three-way comparison: layout × store-issued × site-installed for every item"],
     ["تبرير مكتوب لكل بند تجاوز فرقه ±10% مع صور ومرجع من الكروكي","Written justification for every item beyond ±10%, with photos and a layout reference"],
     ["جدول كميات مؤرّخ (Progress Measurement Sheet) شهري موقّع من المشرف","Dated monthly progress measurement sheet signed by the supervisor"],
     ["سجل التغييرات (Variation Register) مرتبط بأرقام نماذج الاعتماد","Variation register linked to the approval-form numbers"],
     ["شهادة إتمام أعمال ومخالصة نهائية من المقاول","Completion certificate and final contractor discharge"]]]
  ];
  return `
  <div class="sec-title"><span class="eyebrow">${T("الصفحة الأخيرة","Final page")}</span>
    <h2>${T("المقترحات والمستندات المتوقعة","Recommendations & expected documents")}</h2>
    <span class="s">${T("قراءة مهندس تخطيط لمتطلبات الاستشاري وإدارة تطوير المشاريع","A planning engineer's read of consultant and project-development requirements")}</span></div>

  <div class="note">${T("الترتيب أدناه يتبع مسار أمر العمل: من رخصة الحفر إلى إغلاق الأمر. أي مستند ناقص في مرحلة يوقف المرحلة التالية، ولذلك رُبط كل مستند ببند الحصر الذي يولّده.","The order below follows the work-order path from excavation permit to closure. A missing document at one stage blocks the next, so each document is tied to the takeoff item that generates it.")}</div>

  ${SEC.map(([ar,en,items])=>`<details class="acc" open><summary>${esc(T(ar,en))}
      <span class="pill">${items.length}</span></summary>
    <div class="c"><ul>${items.map(([a,e])=>`<li>${esc(T(a,e))}</li>`).join("")}</ul></div></details>`).join("")}

  <div class="card" style="margin-top:6px"><header><h3>${T("إضافات مقترحة للمنصة","Suggested platform additions")}</h3></header>
    <div class="body grid g2">
      ${[
        ["ربط رقم البند بصورة من الموقع","Tie each item code to a site photo","كل بند يتجاوز فرقه 10% يُرفق له صورة مؤرّخة بالإحداثيات، فيسقط أغلب الاعتراضات قبل أن تُرفع.","Any item beyond 10% gets a geotagged, dated photo — most objections fall away before they are raised."],
        ["حصر تراكمي شهري","Monthly cumulative measurement","توليد مستخلص شهري من نفس قاعدة الكميات بدل إعادة الحصر في نهاية المشروع.","Generate a monthly payment certificate from the same quantity base instead of re-measuring at the end."],
        ["مقارنة آلية مع SAP","Automatic SAP reconciliation","استيراد حركة المواد من SAP ومطابقتها ببند الحصر لكشف الفروق مبكرًا.","Import SAP material movements and match them to takeoff items to surface gaps early."],
        ["سجل رخص الحفر وتواريخ انتهائها","Permit register with expiry dates","تنبيه قبل انتهاء الرخصة بأسبوعين حتى لا يتوقف الحفر.","Alert two weeks before a permit expires so excavation is not halted."],
        ["مكتبة أسعار متعددة السنوات","Multi-year rate library","مقارنة بند العقد الموحد 2022 مقابل 2026 لنفس الكمية عند تجديد العقد.","Compare 2022 and 2026 unified-contract rates on the same quantities at contract renewal."],
        ["لوحة أعمار أوامر العمل","Work-order ageing board","ترتيب الأوامر حسب مدة بقائها دون إغلاق وتحديد سبب التعثر لكل أمر.","Rank work orders by time open and name the blocker for each."]
      ].map(([ar,en,dar,den])=>`<div class="card" style="box-shadow:none"><div class="body">
        <h4 style="font-size:13.5px;margin-bottom:5px">${esc(T(ar,en))}</h4>
        <p style="font-size:12.5px;color:var(--ink-2)">${esc(T(dar,den))}</p></div></div>`).join("")}
    </div></div>

  <div class="card"><header><h3>${T("ملاحظات المشروع","Project notes")}</h3></header>
    <div class="body"><label class="fld"><span>${T("ملاحظات حرة تُحفظ مع المشروع","Free notes saved with the project")}</span>
      <textarea id="f_notes2" rows="4">${esc(p.notes||"")}</textarea></label></div></div>`;
}

export { viewMaster, viewBOQ, viewWages, viewForms, viewRecs };
