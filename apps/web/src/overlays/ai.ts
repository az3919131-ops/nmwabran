// @ts-nocheck — منقول من المنصة القديمة (reference/legacy.html) للحفاظ على تطابق المخرجات؛ تحرسه اختبارات parity.
import { S, P, T, AR, $, esc, nf, money, toast, copyTable, CONTRACTORS, MATERIALS, WORKS, CAT, AUTH, totals, derive, authorityFor, geoPoints, feeders, projStats, libMat, libWork, can, editable, isAdmin, pmLine, ME, CF, firmProjects, firmStats, fHex, fInitials, STANDALONE, dig, near, toUTM, utmToLL, hav, ACCEPT_COLS, SHEET_FIELDS, DEFAULT_FACTORS, PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ROLES, MODULES, ACTS, initials2 } from "../runtime";
import { post as apiPost } from "../api";
import { pmHTML } from "../ui";


const AIQ = {turns:[], busy:false, ctl:null, scope:"firm"};
function mdLite(s){
  let h=esc(String(s||""));
  h=h.replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>").replace(/__([^_]+)__/g,"<b>$1</b>");
  h=h.replace(/^###?\s+(.+)$/gm,"<h5>$1</h5>");
  h=h.replace(/(?:^[-•]\s+.+\n?)+/gm, m=>"<ul>"+m.trim().split(/\n/).map(l=>"<li>"+l.replace(/^[-•]\s+/,"")+"</li>").join("")+"</ul>");
  return h;
}
function aiRow(role, html, idx){
  return `<div class="aimsg ${role==="user"?"u":"a"}" data-aix="${idx}">
    <span class="who">${role==="user"?T("أنت","You"):"محفظة Ai"}</span>
    <div class="bb">${html}</div>
    ${role==="user"?"":`<div class="tools noprint"><button data-aicopy="${idx}">${T("نسخ","Copy")}</button></div>`}</div>`;
}
function aiRender(){
  const b=$("aiBody"); if(!b) return;
  if(!AIQ.turns.length){
    b.innerHTML=`<div class="aiempty">
      <b>${T("اسأل محفظة Ai عن أي شيء في مشاريعك","Ask Portfolio Ai anything about your projects")}</b><br>
      ${T("الحصر، المقايسة، المواد، الأجور، ضبط الحماية، الإحداثيات، النماذج الناقصة، والمقارنة بين المقاولين — كلها متاحة للمساعد.","Takeoff, BOQ, materials, wages, protection settings, coordinates, missing forms and contractor comparison are all in its context.")}</div>`;
  } else {
    b.innerHTML=AIQ.turns.map((t,i)=>aiRow(t.role, t.role==="user"?esc(t.content):mdLite(t.content), i)).join("");
    b.querySelectorAll("[data-aicopy]").forEach(x=>x.onclick=()=>{
      navigator.clipboard.writeText(AIQ.turns[+x.dataset.aicopy].content).then(
        ()=>toast(T("تم نسخ الإجابة","Answer copied")), ()=>toast(T("تعذّر النسخ","Copy failed")));
    });
  }
  b.scrollTop=b.scrollHeight;
  const send=$("aiSend"); if(send){ send.disabled=AIQ.busy; send.textContent=AIQ.busy?T("…جارٍ","…"):T("إرسال","Send"); }
  const st=$("aiStop"); if(st) st.hidden=!AIQ.busy;
}
const AI_CHIPS = () => [
  T("ما أهم الملاحظات على حصر المشروع النشط قبل رفع الفاتورة؟","Key takeoff issues before invoicing?"),
  T("قارن بين المقاولين من حيث الانحراف والإنجاز","Compare contractors by variance and progress"),
  T("ما المستندات والنماذج الناقصة لإتمام الاستلام النهائي؟","Which documents are missing for final acceptance?"),
  T("لماذا تختلف المواد المصروفة عن المركّبة؟ وما المطلوب؟","Why do issued vs installed materials differ?"),
  T("راجع الحفريات والسفلتة مقابل أطوال الكابلات","Check excavation & asphalt against cable lengths"),
  T("اكتب ملخصًا تنفيذيًا للاستشاري عن المشروع النشط","Write an executive summary for the consultant"),
  T("ما الوحدات التي بلا ضبط حماية وما أثر ذلك؟","Which units lack protection settings and why it matters?"),
  T("هل الإحداثيات كافية لتغطية كل معدات المشروع؟","Are the coordinates covering all equipment?")
];
/** السؤال يُرسل إلى الخادم (Claude هناك؛ لا مفتاح في المتصفح) والخادم يبني السياق من بيانات المستخدم المسموح بها فقط */
async function aiSend(q){
  const text=String(q||"").trim(); if(!text||AIQ.busy) return;
  const hist=AIQ.turns.filter(t=>t.content).map(t=>({role:t.role, content:t.content}));
  AIQ.turns.push({role:"user", content:text});
  AIQ.busy=true;
  AIQ.turns.push({role:"assistant", content:T("…يحلل بيانات المحفظة","…analysing the portfolio")});
  aiRender();
  const ix=AIQ.turns.length-1;
  try{
    const p=P();
    const r=await apiPost("/ai/ask", {question:text, history:hist.slice(-16), scope:AIQ.scope, projectId:p&&p.id, contractorId:p&&p.contractorId});
    AIQ.turns[ix].content=r.answer||"";
  }catch(e){
    AIQ.turns[ix].content="**"+(e&&e.message||T("تعذّر الاتصال بالخادم","Could not reach the server"))+"**";
  }
  AIQ.busy=false; aiRender();
}
function aiHTML(){
  const f=CF(), n=firmProjects(f).length;
  return `<div class="aipane" role="dialog" aria-modal="true" aria-label="محفظة Ai">
    <div class="aihd">
      <div class="mk">✦</div>
      <div style="min-width:0"><div class="t">${T("محفظة Ai","Portfolio Ai")}</div>
        <div class="s">${T("مساعد ذكي يقرأ كل بيانات محفظتك ويجيب عنها","An assistant that reads your whole portfolio and answers about it")}</div></div>
      <span style="flex:1 1 auto"></span>
      <button class="btn sm gh" id="aiClear">${T("محادثة جديدة","New chat")}</button>
      <button class="btn sm" id="aiClose" aria-label="${T("إغلاق","Close")}">✕</button>
    </div>
    <div class="aiscope">
      <label><input type="radio" name="aisc" value="firm" ${AIQ.scope==="firm"?"checked":""}>${T("مشاريع هذا المقاول","This contractor")} (${nf(n)})</label>
      <label><input type="radio" name="aisc" value="one" ${AIQ.scope==="one"?"checked":""}>${T("المشروع النشط فقط","Active project only")}</label>
      <label><input type="radio" name="aisc" value="all" ${AIQ.scope==="all"?"checked":""}>${T("كل المقاولين","All contractors")}</label>
    </div>
    <div class="aibody" id="aiBody" aria-live="polite"></div>
    <div class="aichips" id="aiChips">${AI_CHIPS().map(c=>`<button data-aiq="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <div class="aifoot">
      <textarea id="aiIn" rows="1" aria-label="${T("سؤالك","Your question")}" placeholder="${T("اكتب سؤالك عن المشاريع، الحصر، المواد، الأجور، النماذج…","Ask about projects, takeoff, materials, wages, forms…")}"></textarea>
      <button class="btn sm gh" id="aiStop" hidden>${T("إيقاف","Stop")}</button>
      <button class="btn pri" id="aiSend">${T("إرسال","Send")}</button>
    </div>${pmHTML()}</div>`;
}
function aiOpen(){
  const w=$("aiWrap"); if(!w) return;
  w.innerHTML=aiHTML(); w.hidden=false; document.body.style.overflow="hidden";
  aiRender();
  const on=(id,fn)=>{ const el=$(id); if(el) el.onclick=fn; };
  on("aiClose", aiClose);
  on("aiClear", ()=>{ AIQ.turns=[]; AIQ.busy=false; aiRender(); });
  on("aiStop", ()=>{ AIQ.busy=false; aiRender(); });
  on("aiSend", ()=>{ const i=$("aiIn"); const v=i.value; i.value=""; i.style.height="auto"; aiSend(v); });
  const inp=$("aiIn");
  inp.oninput=()=>{ inp.style.height="auto"; inp.style.height=Math.min(inp.scrollHeight,130)+"px"; };
  inp.onkeydown=e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); $("aiSend").click(); } };
  w.querySelectorAll("[data-aiq]").forEach(b=>b.onclick=()=>aiSend(b.dataset.aiq));
  w.querySelectorAll("input[name=aisc]").forEach(r=>r.onchange=()=>{ AIQ.scope=r.value; });
  w.onclick=e=>{ if(e.target===w) aiClose(); };
  setTimeout(()=>{ const i=$("aiIn"); if(i) i.focus(); },60);
}
function aiClose(){ const w=$("aiWrap"); if(!w) return; w.hidden=true; w.innerHTML=""; document.body.style.overflow=""; }
function ensureAiUi(){
  if(!$("aiWrap")){
    const d=document.createElement("div"); d.className="aiwrap"; d.id="aiWrap"; d.hidden=true;
    document.body.appendChild(d);
    document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !$("aiWrap").hidden) aiClose(); });
  }
  if(!$("aiFab")){
    const b=document.createElement("button");
    b.className="aifab noprint"; b.id="aiFab"; b.type="button"; b.hidden=true;
    b.innerHTML=`<span class="sp">✦</span><span id="aiFabT"></span>`;
    b.onclick=aiOpen; document.body.appendChild(b);
  }
  const host=$("btnMap");
  if(host && !$("btnAiAsk")){
    const b=document.createElement("button");
    b.className="btn big noprint"; b.id="btnAiAsk"; b.type="button"; b.hidden=true;
    b.onclick=aiOpen; host.insertAdjacentElement("afterend", b);
  }
}
function refreshAiLabels(){
  const t=$("aiFabT"); if(t) t.textContent=T("محفظة Ai","Portfolio Ai");
  const b=$("btnAiAsk"); if(b) b.textContent="✦  "+T("محفظة Ai — اسأل عن مشاريعك","Portfolio Ai — ask about your projects");
  const fab=$("aiFab"); if(fab) fab.hidden=!can("ai","view");
  if(b) b.hidden=!can("ai","view");
}
export { AIQ, aiOpen, aiClose, ensureAiUi, refreshAiLabels };

