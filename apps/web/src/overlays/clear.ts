// @ts-nocheck — منقول من المنصة القديمة (reference/legacy.html) للحفاظ على تطابق المخرجات؛ تحرسه اختبارات parity.
import { S, P, T, AR, $, esc, nf, money, toast, copyTable, CONTRACTORS, MATERIALS, WORKS, CAT, AUTH, totals, derive, authorityFor, geoPoints, feeders, projStats, libMat, libWork, can, editable, isAdmin, pmLine, ME, CF, firmProjects, firmStats, fHex, fInitials, STANDALONE, dig, near, toUTM, utmToLL, hav, ACCEPT_COLS, SHEET_FIELDS, DEFAULT_FACTORS, PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ROLES, MODULES, ACTS, initials2 } from "../runtime";
import { clearUploads } from "../actions/imports";
import { denyToast, lockToast } from "../actions/common";
import { render } from "../render";

function clearUploadsDlg(pi){
  const p=S.projects[pi]; if(!p) return;
  const n=(p.files||[]).length;
  let w=$("clrWrap");
  if(!w){ w=document.createElement("div"); w.id="clrWrap"; w.className="clrwrap"; w.hidden=true;
    w.setAttribute("role","dialog"); w.setAttribute("aria-modal","true"); document.body.appendChild(w); }
  w.innerHTML=`<div class="clrbox">
    <h3>${T("مسح الملفات المرفوعة","Clear uploaded files")} — ${esc(p.wo||"")} ${esc(p.name||"")}</h3>
    <div class="bd">
      <div>${T(`سيُمسح سجل الملفات (${nf(n)} ملف) وأصولها المحفوظة على الخادم، لتتمكن من رفعها من جديد واستيرادها للتحديث. هذا لمشروع واحد فقط — لا يتأثر أي مشروع أو مقاول آخر.`,
        `The file register (${nf(n)} files) and their stored originals will be cleared so you can upload and import them again. This affects this project only — no other project or contractor.`)}</div>
      <label class="opt"><input type="radio" name="clrmode" value="files" checked>
        <div><b>${T("مسح الملفات فقط","Clear files only")}</b>
        <span>${T("تبقى البيانات المستوردة (الحصر، المقايسة، الوحدات) كما هي، ثم يحدّثها الاستيراد التالي.","Imported data (tally, BOQ, units) stays and the next import updates it.")}</span></div></label>
      <label class="opt"><input type="radio" name="clrmode" value="all">
        <div><b>${T("مسح الملفات والبيانات المستوردة منها","Clear files and the data imported from them")}</b>
        <span>${T("يعيد جداول الحصر والمقايسة والمواد والوحدات والاستلام إلى الصفر لإعادة الاستيراد من نظيف. بيانات المشروع الأساسية (الاسم، أمر العمل، التكلفة التقديرية) تبقى.","Resets tally, BOQ, materials, units and acceptance to empty for a clean re-import. Core project info (name, W/O, estimate) stays.")}</span></div></label>
      <div class="muted" style="font-size:11.5px">${T("يمكنك التراجع بعدها بزر «تراجع عن آخر استيراد» ما دام ذلك متاحًا.","You can undo afterwards with “Undo last import” while it remains available.")}</div>
    </div>
    <div class="ft"><button class="btn gh" id="clrNo">${T("إلغاء","Cancel")}</button>
      <button class="btn danger" id="clrYes">${T("مسح","Clear")}</button></div></div>`;
  w.hidden=false;
  const close=()=>{ w.hidden=true; w.innerHTML=""; };
  $("clrNo").onclick=close;
  w.onclick=e=>{ if(e.target===w) close(); };
  $("clrYes").onclick=async()=>{
    const all=w.querySelector('input[name=clrmode]:checked').value==="all";
    close();
    const k=await clearUploads(all);
    render(); toast(T(`مُسح ${nf(k)} ملف — يمكنك رفعها من جديد`, `${nf(k)} files cleared — you can upload them again`));
  };
}


const openClear=()=>{ if(!can("import","del")){ denyToast("import","del"); return; } if(!AUTH.unlocked){ lockToast(); return; } clearUploadsDlg(S.active); };
const mkClr=(cls,label)=>{ const b=document.createElement("button"); b.type="button"; b.className=cls; b.dataset.clrup="1"; b.textContent=label; b.onclick=openClear; return b; };
/** زر «مسح الملفات المرفوعة» في شريط التحديث وسجل الكروكيات */
function addClearButtons(v){
  const L=T("مسح الملفات المرفوعة","Clear uploaded files");
  const add=$("updAdd");
  if(add && !v.querySelector('.updbar [data-clrup]')) add.insertAdjacentElement("afterend", mkClr("btn sm gh danger-t", "🗑 "+L));
  const rc=$("regClear");
  if(rc && !(rc.previousElementSibling && rc.previousElementSibling.dataset.clrup)){
    rc.insertAdjacentElement("beforebegin", mkClr("btn sm gh noprint regx","🗑 "+L)); }
}
export { clearUploadsDlg, addClearButtons };
