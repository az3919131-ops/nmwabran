// @ts-nocheck — منقول من المنصة القديمة (reference/legacy.html) للحفاظ على تطابق المخرجات؛ تحرسه اختبارات parity.
import { S, P, T, AR, $, esc, nf, money, toast, copyTable, CONTRACTORS, MATERIALS, WORKS, CAT, AUTH, totals, derive, authorityFor, geoPoints, feeders, projStats, libMat, libWork, can, editable, isAdmin, pmLine, ME, CF, firmProjects, firmStats, fHex, fInitials, STANDALONE, dig, near, toUTM, utmToLL, hav, ACCEPT_COLS, SHEET_FIELDS, DEFAULT_FACTORS, PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ROLES, MODULES, ACTS, initials2 } from "../runtime";

function viewFirms(){
  const cur=CF(), tot={n:S.projects.length, est:0, exec:0, pts:0, rmu:0, mv:0, wo:new Set()};
  S.projects.forEach(p=>{ const s=projStats(p); tot.est+=s.est; tot.exec+=s.exec; tot.pts+=s.pts;
    tot.rmu+=s.t.rmuNew||0; tot.mv+=s.t.htCable||0; if(String(p.wo||"").trim()) tot.wo.add(String(p.wo).trim()); });

  const cmp = CONTRACTORS.map((c,i)=>({c,i,s:firmStats(i)}));

  return `
  <div class="sec-title">
    <h2>${T("المقاولون والمشاريع","Contractors & projects")}</h2>
    <span class="s">${T("دفتر المقاولين — كل مقاول ومشاريعه وأوامر عمله على حدة","Contractor register — each contractor with their own projects and work orders")}</span>
    <span class="sp" style="flex:1 1 auto"></span>
    <button class="btn sm pri noprint" id="fAdd">${T("+ مقاول جديد","+ New contractor")}</button>
  </div>

  <div class="grid g6">
    <div class="stat hero"><span class="k">${T("المقاولون","Contractors")}</span><span class="v">${nf(CONTRACTORS.length)}</span>
      <span class="d">${T("مسجّلون في المنصة","registered")}</span></div>
    <div class="stat"><span class="k">${T("المشاريع","Projects")}</span><span class="v">${nf(tot.n)}</span>
      <span class="d">${nf(tot.wo.size)} ${T("أمر عمل","work orders")}</span></div>
    <div class="stat"><span class="k">${T("القيمة التقديرية","Estimated value")}</span><span class="v">${money(tot.est)}</span><span class="d">SAR</span></div>
    <div class="stat"><span class="k">${T("المنفّذ (أجور)","Executed (works)")}</span><span class="v">${money(tot.exec)}</span><span class="d">SAR</span></div>
    <div class="stat"><span class="k">${T("وحدات RMU","RMU units")}</span><span class="v">${nf(tot.rmu)}</span>
      <span class="d">${nf(Math.round(tot.mv))} ${T("م كابل ج.متوسط","m MV cable")}</span></div>
    <div class="stat"><span class="k">${T("نقاط الإحداثيات","Geo points")}</span><span class="v">${nf(tot.pts)}</span>
      <span class="d">${T("على الخريطة","mapped")}</span></div>
  </div>

  <div class="card"><header><h3>${T("مقارنة بين المقاولين","Contractor comparison")}</h3>
    <span class="sub">${T("كل الأرقام من مشاريع كل مقاول","all figures aggregated per contractor")}</span>
    <span class="sp"></span>
    <button class="btn sm gh noprint" id="fCopy">${T("نسخ للإكسل","Copy to Excel")}</button></header>
    <div class="body tight scroll"><table id="tblFirms"><thead><tr>
      <th>${T("المقاول","Contractor")}</th><th class="n">${T("مشاريع","Projects")}</th>
      <th class="n">${T("محصورة","Derived")}</th><th class="n">RMU</th><th class="n">${T("محطات","Unit subs")}</th>
      <th class="n">${T("كابل ج.م (م)","MV cable (m)")}</th><th class="n">${T("إحداثيات","Geo pts")}</th>
      <th class="n">${T("التقديرية","Estimated")}</th><th class="n">${T("المنفّذ","Executed")}</th>
      <th class="n">${T("انحراف %","Variance %")}</th><th class="n">${T("مرفقات","Files")}</th></tr></thead>
      <tbody>${cmp.map(({c,i,s})=>{
        const v=s.plan?((s.exec-s.plan)/s.plan*100):0;
        return `<tr${i===cur?' style="background:var(--accent-soft)"':""}>
        <td><span class="pill" style="background:${fHex(i)}33;color:var(--ink)">${esc(c)}</span></td>
        <td class="n">${nf(s.n)}</td><td class="n">${nf(s.derived)}</td><td class="n">${nf(s.rmu)}</td>
        <td class="n">${nf(s.tr)}</td><td class="n">${nf(Math.round(s.mv))}</td><td class="n">${nf(s.pts)}</td>
        <td class="n">${money(s.est)}</td><td class="n">${money(s.exec)}</td>
        <td class="n ${v>0?"delta up":v<0?"delta down":"delta zero"}">${s.plan?(v>0?"+":"")+v.toFixed(1)+"%":"—"}</td>
        <td class="n">${nf(s.files)}</td></tr>`;}).join("")}</tbody>
      <tfoot><tr><td>${T("الإجمالي","Total")}</td><td class="n">${nf(tot.n)}</td>
        <td class="n">${nf(cmp.reduce((a,x)=>a+x.s.derived,0))}</td><td class="n">${nf(tot.rmu)}</td>
        <td class="n">${nf(cmp.reduce((a,x)=>a+x.s.tr,0))}</td><td class="n">${nf(Math.round(tot.mv))}</td>
        <td class="n">${nf(tot.pts)}</td><td class="n">${money(tot.est)}</td><td class="n">${money(tot.exec)}</td>
        <td class="n">—</td><td class="n">${nf(cmp.reduce((a,x)=>a+x.s.files,0))}</td></tr></tfoot>
    </table></div></div>

  <div class="fgrid">${CONTRACTORS.map((c,i)=>firmCard(c,i,cur)).join("")}</div>

  <div class="note">${T("كل مشروع مربوط بمقاول واحد. استخدم قائمة «نقل» في صف المشروع لنقله إلى مقاول آخر دون فقد أي بيانات — الكروكي والحصر والمقايسة والنماذج والمرفقات تنتقل معه.","Every project belongs to one contractor. Use the “Move” dropdown in a project row to reassign it without losing anything — layout, takeoff, BOQ, forms and attachments move with it.")}</div>`;
}

function firmCard(c, i, cur){
  const s=firmStats(i), list=firmProjects(i);
  const done=s.n?Math.round(s.derived/s.n*100):0;
  const setPct=s.rmus?Math.round(s.set/s.rmus*100):0;
  return `<div class="fcard ${i===cur?"on":""}">
    <div class="fhead">
      <div class="favatar" style="background:${fHex(i)}">${esc(fInitials(c))}</div>
      <div style="min-width:0">
        <div class="fname">${esc(c)}</div>
        <div class="fsub">${nf(s.n)} ${T("مشروع","project(s)")} · ${nf(list.filter(o=>String(o.p.wo||"").trim()).length)} ${T("أمر عمل","W/O")}
          ${i===cur?` · <span style="color:var(--accent);font-weight:600">${T("المقاول النشط","active contractor")}</span>`:""}</div>
      </div>
      <span class="sp" style="flex:1 1 auto"></span>
      <div class="rowflex noprint">
        ${i===cur?"":`<button class="btn sm" data-fgo="${i}">${T("تفعيل","Activate")}</button>`}
        <button class="btn sm pri" data-faddp="${i}">${T("+ مشروع","+ Project")}</button>
        <button class="btn sm gh" data-fren="${i}">${T("تعديل الاسم","Rename")}</button>
        <button class="btn sm gh" data-fdel="${i}">${T("حذف","Delete")}</button>
      </div>
    </div>
    <div class="fkpi">
      <div><span class="k">${T("القيمة التقديرية","Estimated")}</span><span class="v">${money(s.est)}</span></div>
      <div><span class="k">${T("المنفّذ (أجور)","Executed works")}</span><span class="v">${money(s.exec)}</span></div>
      <div><span class="k">${T("مواد مصروفة","Materials issued")}</span><span class="v">${money(s.iss)}</span></div>
      <div><span class="k">RMU + ${T("محطات","subs")}</span><span class="v">${nf(s.rmu)} + ${nf(s.tr)}</span></div>
      <div><span class="k">${T("نقاط الإحداثيات","Geo points")}</span><span class="v">${nf(s.pts)}</span></div>
      <div><span class="k">${T("اكتمال الحصر","Takeoff done")}</span><span class="v">${done}%</span>
        <span class="fbar"><span style="width:${done}%"></span></span></div>
      <div><span class="k">${T("ضبط الحماية","Protection set")}</span><span class="v">${setPct}%</span>
        <span class="fbar"><span style="width:${setPct}%;background:${setPct>=80?"var(--ok)":"var(--warn)"}"></span></span></div>
    </div>
    ${list.length? `<div class="body tight scroll"><table class="ptbl"><thead><tr>
      <th>${T("المشروع","Project")}</th><th>${T("أمر العمل","W/O")}</th><th>${T("الموقع","Site")}</th>
      <th class="n">${T("لوحات","Sheets")}</th><th class="n">RMU</th><th class="n">${T("إحداثيات","Geo")}</th>
      <th class="n">${T("التقديرية","Estimated")}</th><th class="n">${T("المنفّذ","Executed")}</th>
      <th>${T("الحالة","Status")}</th><th class="noprint">${T("إجراءات","Actions")}</th></tr></thead>
      <tbody>${list.map(({p,ix})=>{ const st=projStats(p); return `<tr${ix===S.active?' style="background:var(--accent-soft)"':""}>
        <td class="wrap-t"><b>${esc(p.name)}</b></td>
        <td class="code">${esc(p.wo||"—")}</td>
        <td class="wrap-t" style="min-width:140px">${esc(p.site||"—")}</td>
        <td class="n">${nf(p.sheets.length)}</td><td class="n">${nf(st.rmus)}</td><td class="n">${nf(st.pts)}</td>
        <td class="n">${money(st.est)}</td><td class="n">${money(st.exec)}</td>
        <td><span class="pill ${st.derived?"ok":"warn"}">${st.derived?T("محصور","Derived"):T("بانتظار","Pending")}</span></td>
        <td class="noprint"><div class="act">
          <button class="btn sm pri" data-fopen="${ix}">${T("فتح","Open")}</button>
          <button class="btn sm" data-fmap="${ix}">${T("الخريطة","Map")}</button>
          <button class="btn sm gh" data-fdup="${ix}">${T("نسخ","Copy")}</button>
          <button class="btn sm gh" data-fdelp="${ix}">${T("حذف","Delete")}</button>
          <select data-fmove="${ix}" aria-label="${T("نقل إلى مقاول","Move to contractor")}">
            <option value="">${T("نقل إلى…","Move to…")}</option>
            ${CONTRACTORS.map((cc,ci)=>ci===i?"":`<option value="${ci}">${esc(cc)}</option>`).join("")}
          </select></div></td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="femp">${T("لا توجد مشاريع لهذا المقاول بعد — اضغط «+ مشروع» لإضافة أول أمر عمل.","No projects yet — press “+ Project” to add the first work order.")}</div>`}
  </div>`;
}

export { viewFirms };
