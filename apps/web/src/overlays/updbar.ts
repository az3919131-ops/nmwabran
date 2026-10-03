// @ts-nocheck — منقول من المنصة القديمة (reference/legacy.html) للحفاظ على تطابق المخرجات؛ تحرسه اختبارات parity.
import { S, P, T, AR, $, esc, nf, money, toast, copyTable, CONTRACTORS, MATERIALS, WORKS, CAT, AUTH, totals, derive, authorityFor, geoPoints, feeders, projStats, libMat, libWork, can, editable, isAdmin, pmLine, ME, CF, firmProjects, firmStats, fHex, fInitials, STANDALONE, dig, near, toUTM, utmToLL, hav, ACCEPT_COLS, SHEET_FIELDS, DEFAULT_FACTORS, PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ROLES, MODULES, ACTS, initials2 } from "../runtime";
import { missingFor as coreMissingFor } from "@iltizam/core";
import { render } from "../render";
import { save, saveUi } from "../sync";
import { smartFill, undoImport, intakeFiles, reimportFile, deleteFile } from "../actions/imports";


const PAGE_NAMES = {dash:["لوحة التحكم","Control centre"], master:["الماستر والكروكي","Master & layout"],
  boq:["المقايسة والمقارنة","BOQ & variance"], wages:["فاتورة الأجور","Wages invoice"],
  forms:["النماذج والاستلام","Forms & acceptance"], map:["الخريطة والإحداثيات","Map & coordinates"],
  recs:["المقترحات والمستندات","Recommendations"]};
PAGE_NAMES.qty=["الحصر الشامل","Full takeoff"]; PAGE_NAMES.inv=["الفاتورة","Invoice"];
/** ما ينقص كل صفحة (المنطق في packages/core) */
const missingFor = page => coreMissingFor(P(), page, T);
function updBar(){
  const miss=missingFor(S.page), n=miss.reduce((s,x)=>s+x.n,0);
  return `
  <div class="updbar ${n?"has":""} noprint">
    <span class="ttl"><i></i>${T("تحديث البيانات واستكمال النواقص","Refresh data & complete what's missing")}</span>
    <div class="misschips">${miss.length? miss.slice(0,4).map(x=>`<span class="mchip"><b>${nf(x.n)}</b>${esc(x.t)}</span>`).join("")
      +(miss.length>4?`<span class="mchip">+${miss.length-4}</span>`:"")
      :`<span class="mchip ok">${T("مكتملة","Complete")}</span>`}</div>
    <span class="sp"></span>
    <button class="btn sm pri" id="updRun">${T("تحديث واستكمال","Refresh & complete")}</button>
    <button class="btn sm" id="updAdd">${T("+ رفع ملفات","+ Upload files")}</button>
    <button class="btn sm gh" id="updMore">${S.updOpen?T("إخفاء تعديل الاستيراد","Hide import editor"):T("تعديل الاستيراد","Edit import")}</button>
    <input type="file" id="updFile" multiple hidden
      accept=".xlsx,.xlsm,.csv,.pdf,.docx,.kml,.kmz,.gpx,.geojson,.json,.txt,image/*">
  </div>
  ${S.updOpen?updPanel(miss):""}`;
}
function updPanel(miss){
  const p=P(), files=p.files||[];
  return `
  <div class="updpanel noprint"><div class="hd">${T("تعديل الاستيراد لهذه الصفحة","Import editor for this page")}
    <span class="muted" style="font-weight:400;font-size:11.5px">${T(...(PAGE_NAMES[S.page]||["",""]))}</span>
    <span class="sp" style="flex:1 1 auto"></span>
    ${P().canUndo?`<button class="btn sm gh" id="updUndo">${T("تراجع عن آخر تحديث","Undo last refresh")}</button>`:""}</div>
  <div class="bd">
    <div class="misslist">${miss.length? miss.map(x=>`<div class="missrow">
      <span class="c">${nf(x.n)}</span>
      <span class="x"><b>${esc(x.t)}</b><span>${esc(x.hint||"")}</span></span>
      ${x.go?`<span class="go"><button class="btn sm gh" data-goto="${x.go}">${T("افتح ","Open ")+T(...(PAGE_NAMES[x.go]||["",""]))}</button></span>`:""}
    </div>`).join("") : `<div class="note">${T("كل بيانات هذه الصفحة مكتملة من الملفات المرفوعة.","Every field on this page is complete from the uploaded files.")}</div>`}</div>

    <div class="scroll"><table class="stbl"><thead><tr>
      <th>${T("الملف","File")}</th><th>${T("النوع","Type")}</th><th>${T("الحالة","Status")}</th>
      <th class="n">${T("صفوف","Rows")}</th><th>${T("إجراء","Action")}</th></tr></thead>
      <tbody>${files.length? files.map((f,i)=>`<tr>
        <td class="wrap-t">${esc(f.name)}</td>
        <td>${esc(f.ext||f.kind||"—")}</td>
        <td><span class="pill ${f.blocked?"bad":f.imported?"ok":"warn"}">${
          f.blocked?T("موقوف","Blocked"):f.imported?T("مُستورد","Imported"):T("مرجع","Reference")}</span></td>
        <td class="n">${f.rows?nf(f.rows):"—"}</td>
        <td class="act">${(P().files.find(x=>x.id===f.id)||{}).hasOriginal?`<button class="btn sm gh" data-upre="${f.id}">${T("إعادة استيراد","Re-import")}</button>`:
          `<span class="muted" style="font-size:11.5px">${T("أعد رفعه","Re-upload")}</span>`}
          <button class="btn sm gh" data-uprm="${i}">${T("مسح","Delete")}</button></td></tr>`).join("")
        :`<tr><td colspan="5" class="muted" style="padding:14px;text-align:center">${T("لا ملفات — ارفع ملفات المشروع من الزر أعلاه، من أي صفحة.","No files — upload the project files from the button above, on any page.")}</td></tr>`}
      </tbody></table></div>
    <div class="note">${T("«تحديث واستكمال» يعيد قراءة كل ملف في السجل، ويطابق أرقام الوحدات بأسمائها مع النقاط والإحداثيات المستخرجة، ثم يعيد الاستنباط ويملأ كل حقل فارغ يمكن اشتقاقه — ولا يستبدل ما أدخلته يدويًا.",
      "“Refresh & complete” re-reads every file in the register, matches unit numbers and names against the extracted points and coordinates, then re-derives and fills every empty field it can — without overwriting anything you entered by hand.")}</div>
  </div></div>`;
}
/** ربط أزرار الشريط (يُستدعى بعد كل رسم) */
function wireUpdBar(v){
  const on=(id,fn)=>{ const el=$(id); if(el) el.onclick=fn; };
  on("updRun", smartFill);
  on("updAdd", ()=>$("updFile").click());
  on("updMore", ()=>{ S.updOpen=!S.updOpen; saveUi(); render(); });
  on("updUndo", ()=>undoImport());
  const fi=$("updFile"); if(fi) fi.onchange=()=>{ intakeFiles(fi.files); fi.value=""; };
  v.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>{ S.page=b.dataset.goto; save(); render(); });
  v.querySelectorAll("[data-upre]").forEach(b=>b.onclick=()=>reimportFile(b.dataset.upre));
  v.querySelectorAll("[data-uprm]").forEach(b=>b.onclick=()=>{
    if(!b.dataset.armed){ b.dataset.armed="1"; b.textContent=T("تأكيد المسح","Confirm"); return; }
    const f=P().files[+b.dataset.uprm]; if(f) deleteFile(f.id);
  });
}
export { updBar, missingFor, wireUpdBar, PAGE_NAMES };

