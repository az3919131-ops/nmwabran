// @ts-nocheck — منقول من المنصة القديمة (reference/legacy.html) للحفاظ على تطابق المخرجات؛ تحرسه اختبارات parity.
import { S, P, T, AR, $, esc, nf, money, toast, copyTable, CONTRACTORS, MATERIALS, WORKS, CAT, AUTH, totals, derive, authorityFor, geoPoints, feeders, projStats, libMat, libWork, can, editable, isAdmin, pmLine, ME, CF, firmProjects, firmStats, fHex, fInitials, STANDALONE, dig, near, toUTM, utmToLL, hav, ACCEPT_COLS, SHEET_FIELDS, DEFAULT_FACTORS, PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ROLES, MODULES, ACTS, initials2 } from "../runtime";
import { get as apiGet, download as apiDownloadRaw, openProtected, api } from "../api";
const apiDownload = (path, name) => apiDownloadRaw(path, name);
const apiOpen = (path) => openProtected(path);
async function apiBlobUrl(path){ const res = await api("GET", path, undefined, { raw: true }); return URL.createObjectURL(await res.blob()); }


const DOCV = {id:null, url:null, sheets:null, sh:0};
/** هل لهذا الملف أصل محفوظ على الخادم؟ */
const hasDoc = id => { for(const p of S.projects){ const f=(p.files||[]).find(x=>x.id===id); if(f) return !!f.hasOriginal; } return false; };
function docClose(){
  const w=$("docWrap"); if(!w) return;
  if(DOCV.url){ try{ URL.revokeObjectURL(DOCV.url); }catch(e){} DOCV.url=null; }
  w.hidden=true; w.innerHTML=""; DOCV.id=null; DOCV.sheets=null; document.body.style.overflow="";
}
function docSheetHTML(sh){
  const rows=(sh.rows||[]).slice(0,600);
  const wide=rows.reduce((m,r)=>Math.max(m,r.length),0);
  const head="<thead><tr><th></th>"+Array.from({length:Math.min(wide,40)},(_,i)=>{
    let s="", n=i+1; while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=Math.floor((n-1)/26); } return `<th>${s}</th>`;}).join("")+"</tr></thead>";
  const body=rows.map((r,i)=>`<tr><td class="rn">${i+1}</td>`+
    Array.from({length:Math.min(wide,40)},(_,j)=>`<td>${esc(String(r[j]==null?"":r[j]).slice(0,120))}</td>`).join("")+`</tr>`).join("");
  return `<div class="dsheet"><table>${head}<tbody>${body}</tbody></table></div>
    ${(sh.rows||[]).length>600?`<div class="note">${T(`عُرضت أول 600 صف من ${nf(sh.rows.length)} — نزّل الملف لعرضه كاملًا.`,`First 600 of ${nf(sh.rows.length)} rows shown — download the file to see all of it.`)}</div>`:""}`;
}
function docRenderSheets(){
  const st=$("docStage"); if(!st||!DOCV.sheets) return;
  st.innerHTML=`<div class="dtabs">${DOCV.sheets.map((s,i)=>
    `<button data-dsh="${i}" aria-pressed="${i===DOCV.sh}">${esc(s.name||("Sheet"+(i+1)))} · ${nf((s.rows||[]).length)}</button>`).join("")}</div>
    ${docSheetHTML(DOCV.sheets[DOCV.sh]||{rows:[]})}`;
  st.querySelectorAll("[data-dsh]").forEach(b=>b.onclick=()=>{ DOCV.sh=+b.dataset.dsh; docRenderSheets(); });
}
async function docOpen(id, name){
  const w=$("docWrap"); if(!w) return;
  const rec=(P().files||[]).find(f=>f.id===id) || {name:name||"", ext:""};
  w.innerHTML=`
    <div class="dbar2">
      <button class="btn sm" id="docClose" aria-label="${T("إغلاق","Close")}">✕</button>
      <div><div class="t" id="docTitle">${esc(rec.name||name||"")}</div><div class="s" id="docSub">${T("جارٍ الفتح…","Opening…")}</div></div>
      <span class="sp"></span>
      <button class="btn sm" id="docDl">${T("تنزيل الأصل","Download original")}</button>
      <button class="btn sm gh" id="docTab">${T("فتح في تبويب","Open in a tab")}</button>
    </div>
    <div class="dstage" id="docStage"><p class="muted">${T("جارٍ تحميل المستند…","Loading the document…")}</p></div>`;
  w.hidden=false; document.body.style.overflow="hidden"; DOCV.id=id; DOCV.sh=0;
  $("docClose").onclick=docClose;
  const st=$("docStage"), sub=$("docSub");
  const owner=S.projects.find(p=>(p.files||[]).some(f=>f.id===id));
  if(!owner || !rec.hasOriginal){
    st.innerHTML=`<div class="note warn">${T("أصل هذا الملف غير محفوظ على الخادم — رُفع قبل تفعيل حفظ الأصول. أعد رفعه ليُحفظ أصله ويُعرض هنا.",
      "The original of this file is not stored on the server — it was uploaded before original-file storage was enabled. Upload it again to view it here.")}</div>`;
    sub.textContent=T("الأصل غير متاح","Original unavailable");
    $("docDl").disabled=true; $("docTab").disabled=true;
    return;
  }
  const base="/projects/"+owner.id+"/files/"+id;
  const ext=(rec.ext||(rec.name||"").split(".").pop()||"").toLowerCase();
  sub.textContent=`${(ext||"—").toUpperCase()} · ${nf((rec.size||0)/1024)} KB`;
  $("docDl").onclick=async()=>{ try{ await apiDownload(base+"/original", rec.name||"document"); toast(T("تم تنزيل الأصل","Original downloaded")); }catch(e){ toast(e.message||String(e)); } };
  $("docTab").onclick=async()=>{ try{ await apiOpen(base+"/original"); }catch(e){ toast(e.message||String(e)); } };
  try{
    if(["png","jpg","jpeg","webp","gif","bmp"].includes(ext)){
      const url=await apiBlobUrl(base+"/original"); DOCV.url=url;
      st.innerHTML=`<img src="${url}" alt="${esc(rec.name||"")}">`;
    }
    else if(ext==="pdf"){
      const url=await apiBlobUrl(base+"/original"); DOCV.url=url;
      st.innerHTML=`<iframe src="${url}#view=FitH" title="${esc(rec.name||"PDF")}"></iframe>
        <div class="note">${T("إن لم تظهر الصفحات، اضغط «فتح في تبويب» لعرض الملف بعارض المتصفح.","If the pages do not appear, press “Open in a tab” to view it in the browser's own viewer.")}</div>`;
    }
    else if(["xlsx","xlsm","csv","docx","kml","gpx","geojson","json","txt","xml"].includes(ext)){
      const r=await apiGet(base+"/sheets");
      if(r.sheets){ DOCV.sheets=r.sheets; docRenderSheets(); }
      else if(ext==="docx") st.innerHTML=`<pre style="direction:rtl;text-align:start;font-family:var(--f-ui);font-size:13px">${esc(r.text||T("المستند بلا نص قابل للقراءة","No readable text in this document"))}</pre>`;
      else st.innerHTML=`<pre>${esc(String(r.text||"").slice(0,200000))}</pre>`;
    }
    else {
      st.innerHTML=`<div class="note">${T("لا يمكن عرض هذه الصيغة داخل المنصة — استخدم «تنزيل الأصل» أو «فتح في تبويب».",
        "This format cannot be previewed inside the platform — use “Download original” or “Open in a tab”.")}</div>`;
    }
  }catch(e){
    st.innerHTML=`<div class="note warn">${T("تعذّر عرض الملف: ","Could not render the file: ")+esc(e.message||e)}</div>`;
  }
}
function docBtnHTML(id){
  return hasDoc(id)
    ? `<button class="btn sm docbtn noprint" data-doc="${esc(id)}">👁 ${T("عرض الأصل","View original")}</button>`
    : `<button class="btn sm gh docbtn noprint" data-doc="${esc(id)}" title="${T("الأصل غير محفوظ — أعد رفع الملف","Original not stored — upload the file again")}">👁 ${T("عرض الأصل","View original")}</button>`;
}
function docAllCard(){
  const rows=[];
  S.projects.forEach((p,pi)=>(p.files||[]).forEach(f=>rows.push({pi, wo:p.wo, pname:p.name, f})));
  const stored=rows.filter(r=>hasDoc(r.f.id)).length;
  return `
  <div class="card" id="docAll"><header><h3>${T("أصول المستندات — كل المشاريع","Original documents — all projects")}</h3>
    <span class="sub">${nf(rows.length)} ${T("مرفق","attachments")} · ${nf(stored)} ${T("أصلها محفوظ ويُعرض هنا","stored and viewable here")}</span></header>
  <div class="body tight scroll" style="max-height:430px;overflow-y:auto"><table class="stbl"><thead><tr>
    <th>${T("أمر العمل","W/O")}</th><th>${T("المشروع","Project")}</th><th>${T("الملف","File")}</th>
    <th>${T("النوع","Type")}</th><th class="n">${T("الحجم","Size")}</th><th>${T("الحالة","Status")}</th><th>${T("عرض","View")}</th></tr></thead>
    <tbody>${rows.length? rows.map(r=>`<tr>
      <td class="code">${esc(r.wo||"—")}</td><td class="wrap-t">${esc(r.pname)}</td>
      <td class="wrap-t">${esc(r.f.name)}</td><td>${esc(r.f.ext||r.f.kind||"—")}</td>
      <td class="n">${nf((r.f.size||0)/1024)} KB</td>
      <td><span class="pill ${hasDoc(r.f.id)?"ok":"warn"}">${hasDoc(r.f.id)?T("الأصل محفوظ","Stored"):T("أعد رفعه","Re-upload")}</span></td>
      <td class="act">${docBtnHTML(r.f.id)}${r.pi!==S.active?`<button class="btn sm gh noprint" data-gopr="${r.pi}">${T("افتح المشروع","Open project")}</button>`:""}</td></tr>`).join("")
      :`<tr><td colspan="7" class="muted" style="padding:16px;text-align:center">${T("لا مرفقات بعد في أي مشروع","No attachments in any project yet")}</td></tr>`}
    </tbody></table></div>
  <div class="body"><div class="note">${T("يُحفظ أصل كل ملف يُرفع على الخادم (حتى 60 ميجابايت للملف)، فيمكن فتحه لاحقًا من أي صفحة دون إعادة رفعه — الإكسل يُعرض بأوراقه، والـPDF والصور تُعرض كما هي.",
    "Every uploaded file's original is stored on the server (up to 60 MB each), so it can be reopened later from any page without re-uploading — Excel opens with its sheets, PDFs and images render as they are.")}</div></div></div>`;
}

function ensureDocWrap(){
  if($("docWrap")) return;
  const d=document.createElement("div");
  d.className="dwrap"; d.id="docWrap"; d.hidden=true; d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true");
  document.body.appendChild(d);
  document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !$("docWrap").hidden) docClose(); });
}
/** بعد كل رسم: زر «عرض الأصل» بجوار كل مرفق + أزرار فتح المشاريع */
function wireDocs(v, onGoProject){
  v.querySelectorAll("[data-rmf]").forEach(b=>{
    const i=+b.dataset.rmf, f=(P().files||[])[i];
    if(f && !b.previousElementSibling?.dataset?.doc) b.insertAdjacentHTML("beforebegin", docBtnHTML(f.id));
  });
  v.querySelectorAll("[data-uprm]").forEach(b=>{
    const i=+b.dataset.uprm, f=(P().files||[])[i];
    if(f && !b.previousElementSibling?.dataset?.doc) b.insertAdjacentHTML("beforebegin", docBtnHTML(f.id));
  });
  v.querySelectorAll("[data-doc]").forEach(b=>b.onclick=()=>docOpen(b.dataset.doc));
  v.querySelectorAll("[data-gopr]").forEach(b=>b.onclick=()=>onGoProject(+b.dataset.gopr));
}
export { docAllCard, docOpen, docClose, ensureDocWrap, wireDocs };

