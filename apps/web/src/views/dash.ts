// @ts-nocheck — منقول من المنصة القديمة (reference/legacy.html) للحفاظ على تطابق المخرجات؛ تحرسه اختبارات parity.
import { S, P, T, AR, $, esc, nf, money, toast, copyTable, CONTRACTORS, MATERIALS, WORKS, CAT, AUTH, totals, derive, authorityFor, geoPoints, feeders, projStats, libMat, libWork, can, editable, isAdmin, pmLine, ME, CF, firmProjects, firmStats, fHex, fInitials, STANDALONE, dig, near, toUTM, utmToLL, hav, ACCEPT_COLS, SHEET_FIELDS, DEFAULT_FACTORS, PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ROLES, MODULES, ACTS, initials2 } from "../runtime";
import ORG_LOGO from "../assets/org-logo.webp";

const STATES = {
  ready  :{ar:"جاهز للفاتورة",  en:"Ready to invoice",   g:"✓", c:"good"},
  run    :{ar:"قيد التنفيذ",    en:"In progress",        g:"●", c:"info"},
  pending:{ar:"بانتظار الحصر",  en:"Awaiting takeoff",   g:"▲", c:"warn"},
  nogeo  :{ar:"ناقص إحداثيات",  en:"Missing coordinates",g:"◆", c:"serious"},
  draft  :{ar:"مسودة بلا ملفات",en:"Draft — no files",   g:"○", c:"neutral"}
};
const ST_ORDER = ["ready","run","pending","nogeo","draft"];
const stVar = k => "var(--st-"+STATES[k].c+")";
const stSoft = k => "var(--st-"+STATES[k].c+"-s)";
const DASH = {filter:null};

function projState(p){
  const s=projStats(p), files=(p.files||[]).length;
  const setPct = s.rmus? s.set/s.rmus*100 : 0;
  const bill = s.plan? (s.exec/s.plan*100) : 0;
  let k;
  if(!files && !s.derived && !s.rmus) k="draft";
  else if(!s.derived) k="pending";
  else if(!s.pts) k="nogeo";
  else if(setPct>=80 && s.exec>0) k="ready";
  else k="run";
  return Object.assign({}, s, {files, setPct, bill, k});
}

function meter(pct, label, tone){
  const v=Math.max(0,Math.min(pct,100));
  return `<span class="mtr" title="${esc(label)}: ${nf(pct)}%">
    <span class="t"><i style="width:${v}%;${tone?`--mc:${tone}`:""}"></i></span>
    <span class="n">${nf(pct)}%</span></span>`;
}

function viewDash2(){
  const cur=CF(), mine=firmProjects(cur).map(o=>o.p);
  const st=mine.map(projState);
  const tot={est:0, exec:0, plan:0, pts:0, rmu:0, tr:0, mv:0, files:0, wo:new Set()};
  mine.forEach((p,i)=>{ const s=st[i];
    tot.est+=s.est; tot.exec+=s.exec; tot.plan+=s.plan; tot.pts+=s.pts; tot.files+=s.files;
    tot.rmu+=s.t.rmuNew||0; tot.tr+=s.t.trTot||0; tot.mv+=s.t.htCable||0;
    if(String(p.wo||"").trim()) tot.wo.add(String(p.wo).trim()); });
  const varPct = tot.plan? (tot.exec-tot.plan)/tot.plan*100 : 0;
  const varTone = Math.abs(varPct)<=10?"var(--st-good)":Math.abs(varPct)<=30?"var(--st-warn)":"var(--st-serious)";
  const geoCov = mine.length? st.filter(s=>s.pts>0).length/mine.length*100 : 0;
  const counts = {}; ST_ORDER.forEach(k=>counts[k]=st.filter(s=>s.k===k).length);
  const shown = DASH.filter ? mine.map((p,i)=>({p,s:st[i]})).filter(o=>o.s.k===DASH.filter)
                            : mine.map((p,i)=>({p,s:st[i]}));
  const me=ME(), today=new Date().toLocaleDateString(AR()?"ar-SA":"en-GB",{dateStyle:"long"});

  /* المشروع النشط */
  const p=P(), ps=projState(p);
  const groups=[
    ["حفر ج.متوسط","MV trenching",["301010201","301010205","301010202","301010206","301010203","301010204"]],
    ["حفر ج.منخفض","LV trenching",["301010101","301010103","301010102"]],
    ["تمديد كابلات","Cable laying",["304010202","304010102","304010101","304010203"]],
    ["نهايات ووصلات","Terminations",["305020404","305020104","305020407","305010302"]],
    ["تركيب معدات","Equipment install",["309020101","309020203","308020101","308020105"]],
    ["إزالة الهوائي","Overhead removals",["201040003","201040006","204020301","204010301"]],
    ["سفلتة وكشط","Asphalt & milling",["306010002","306010004"]]
  ];
  const shortages=Object.entries(p.mat).filter(([c,v])=>(v.req||0)>(v.iss||0));
  const noSet=(p.rmus||[]).filter(r=>!r.set).length;
  const hiOhm=(p.rmus||[]).filter(r=>+r.ohm>3).length;
  const alerts=[];
  if(!ps.files) alerts.push(["serious","◆",T("لا توجد ملفات مرفوعة","No files uploaded"),
    T("ارفع الكروكي وملفات الإكسل في صفحة الماستر — كل الحصر والنماذج تُشتق منها.","Upload the layout and Excel files on the Master page — the whole takeoff and all forms derive from them.")]);
  if(!p.derived) alerts.push(["warn","▲",T("الحصر لم يُستنبط","Takeoff not derived"),
    T("اضغط «استنباط ومعالجة ذكية للبيانات» بعد رفع الملفات.","Press “Derive & AI-process data” after uploading the files.")]);
  if(!ps.pts) alerts.push(["serious","◆",T("لا إحداثيات لهذا المشروع","No coordinates for this project"),
    T("ارفع ضبط الحماية أو ملف KML — بدونها لا تظهر المعدات على الخريطة ولا في Google Earth.","Upload the protection file or a KML — without them no equipment appears on the map or in Google Earth.")]);
  if(shortages.length) alerts.push(["warn","▲",T("عجز مواد","Material shortfall")+" — "+shortages.length,
    T("كميات مطلوبة للتنفيذ أكبر من المصروف من المستودع، ويلزم لها خطاب تعديل مقايسة.","More is required than was issued from store; a BOQ revision letter is needed.")]);
  if(Math.abs(varPct)>30) alerts.push(["serious","◆",T("الانحراف تجاوز 30%","Variance above 30%"),
    T("يلزم تقرير فني مع نموذج تعديل المقايسة واعتماد ","A technical report with the BOQ revision and the approval of ")+authorityFor(varPct)+"."]);
  if(noSet) alerts.push(["warn","▲",T("ضبط الحماية غير مكتمل","Protection settings incomplete"),
    noSet+" "+T("وحدة حلقية بلا ضبط معتمد — يوقف الاستلام النهائي.","RMUs without approved settings — this blocks final acceptance.")]);
  if(hiOhm) alerts.push(["warn","▲",T("مقاومة تأريض مرتفعة","High earth resistance"),
    hiOhm+" "+T("وحدة تتجاوز 3 أوم؛ أضف قضبان تأريض وأعد القياس.","units above 3 Ω; add rods and re-measure.")]);
  if(!alerts.length) alerts.push(["good","✓",T("لا يوجد ما يعيق هذا المشروع","Nothing is blocking this project"),
    T("الملفات والحصر والإحداثيات والضبط مكتملة بالقدر الذي يسمح برفع الفاتورة.","Files, takeoff, coordinates and settings are complete enough to raise the invoice.")]);

  /* مقارنة المقاولين — مقياس واحد، لون واحد، وأرقام مباشرة */
  const firms=CONTRACTORS.map((c,i)=>({c,i,s:firmStats(i)})).filter(x=>x.s.n);
  const fmax=Math.max(1,...firms.map(x=>x.s.est));

  return `<div class="dash">
  <div class="dhero">
    <div class="dhero-top">
      <div class="dh-logo"><img src="${ORG_LOGO}" alt=""></div>
      <div style="min-width:0">
        <h1>${T("محفظة الالتزام للمشاريع للمقاولين","Compliance Vault — contractor project portfolio")}</h1>
        <p class="lede">${T("متابعة التزام كل مقاول بأوامر عمله: الحصر والمقايسة والمواد وضبط الحماية والإحداثيات والنماذج — في لوحة واحدة، وبحالة ملوّنة لكل مشروع.",
          "Tracking each contractor's compliance with their work orders — takeoff, BOQ, materials, protection settings, coordinates and forms, in one board with a colour-coded state per project.")}</p>
      </div>
      <div class="who2">
        <b>${esc(CONTRACTORS[cur]||"—")}</b>
        <span>${esc(today)}</span>
        ${me?`<span>${esc(me.name)} · ${esc(T(ROLES[me.role].ar,ROLES[me.role].en))}</span>`:""}
      </div>
    </div>
    <div class="dh-cta">
      <button class="btn-hero" id="btnAllIlt" type="button">
        <span class="ic">⌖</span>${T("كل مشاريع الالتزام — تجميع جوجل إيرث","All compliance projects — Google Earth")}</button>
      <span class="cnt">${T("يجمع إحداثيات كل المشاريع وأوامر العمل في لوحة واحدة","Every project's coordinates in one view")}</span>
    </div>
  </div>

  <div class="grid g6">
    <div class="ktile lead"><span class="k">${T("القيمة التقديرية","Estimated value")}</span>
      <span class="v">${money(tot.est)}</span><span class="d">${T("ريال سعودي","SAR")}</span></div>
    <div class="ktile"><span class="k">${T("المنفّذ (أجور)","Executed works")}</span>
      <span class="v">${money(tot.exec)}</span><span class="d">${T("من مقايسة","of BOQ")} ${money(tot.plan)}</span></div>
    <div class="ktile" style="--tc:${varTone}"><span class="k">${T("انحراف المقايسة","BOQ variance")}</span>
      <span class="v tone">${varPct>0?"+":""}${nf(varPct,1)}%</span>
      <span class="d">${esc(authorityFor(varPct))}</span></div>
    <div class="ktile" style="--tc:${counts.ready?"var(--st-good)":"var(--st-neutral)"}"><span class="k">${T("جاهزة للفاتورة","Ready to invoice")}</span>
      <span class="v tone">${nf(counts.ready)}</span><span class="d">${T("من","of")} ${nf(mine.length)} ${T("مشروع","projects")}</span></div>
    <div class="ktile" style="--tc:${geoCov>=80?"var(--st-good)":geoCov>=50?"var(--st-warn)":"var(--st-serious)"}">
      <span class="k">${T("تغطية الإحداثيات","Coordinate coverage")}</span>
      <span class="v tone">${nf(geoCov)}%</span><span class="d">${nf(st.filter(s=>s.pts>0).length)} ${T("مشروع موقّع","projects mapped")}</span></div>
    <div class="ktile" style="--tc:${counts.pending+counts.nogeo?"var(--st-warn)":"var(--st-good)"}">
      <span class="k">${T("تحتاج إجراء","Need action")}</span>
      <span class="v tone">${nf(counts.pending+counts.nogeo+counts.draft)}</span>
      <span class="d">${T("مشروع ناقص بيانات","projects missing data")}</span></div>
  </div>

  <div class="card"><header><h3>${T("حالة محفظة المقاول","Portfolio state")}</h3>
    <span class="sub">${T("اضغط أي حالة لعرض مشاريعها فقط","select a state to list only its projects")}</span>
    <span class="sp"></span>${DASH.filter?`<button class="btn sm gh noprint" id="dClear">${T("عرض الكل","Show all")}</button>`:""}</header>
    <div class="body">
      ${mine.length?`<div class="sbar">${ST_ORDER.filter(k=>counts[k]).map(k=>
        `<i style="background:${stVar(k)};flex:${counts[k]}" title="${esc(T(STATES[k].ar,STATES[k].en))}: ${counts[k]}"></i>`).join("")}</div>`
      :`<p class="muted" style="font-size:12.5px">${T("لا مشاريع لهذا المقاول بعد.","This contractor has no projects yet.")}</p>`}
      <div class="slegend">${ST_ORDER.map(k=>`<button class="schip ${counts[k]?"":"off"}" data-st="${k}"
        aria-pressed="${DASH.filter===k}" style="--ch:${stVar(k)};--chs:${stSoft(k)}">
        <span class="g">${STATES[k].g}</span>${esc(T(STATES[k].ar,STATES[k].en))} <b>${nf(counts[k])}</b></button>`).join("")}</div>
    </div></div>

  <div class="card"><header><h3>${T("مشاريع المقاول","Contractor projects")}</h3>
    <span class="sub">${DASH.filter?esc(T(STATES[DASH.filter].ar,STATES[DASH.filter].en)):T("كل الحالات","all states")} · ${nf(shown.length)}</span>
    <span class="sp"></span>
    <button class="btn sm noprint" id="dashAdd">${T("+ مشروع جديد","+ New project")}</button></header>
    <div class="body tight scroll"><table><thead><tr>
      <th style="width:4px"></th><th>${T("المشروع","Project")}</th><th>${T("أمر العمل","W/O")}</th>
      <th>${T("الحالة","State")}</th><th>${T("الحصر","Takeoff")}</th><th>${T("ضبط الحماية","Settings")}</th>
      <th>${T("الفاتورة","Invoicing")}</th><th class="n">${T("إحداثيات","Geo")}</th>
      <th class="n">${T("التقديرية","Estimated")}</th><th class="noprint"></th></tr></thead>
      <tbody>${shown.map(({p:x,s})=>`<tr class="prow" ${x===P()?'style="background:var(--accent-soft)"':""}>
        <td><span class="prail" style="--pc:${stVar(s.k)}"></span></td>
        <td class="wrap-t"><b>${esc(x.name)}</b>${x.site?`<br><span class="muted" style="font-size:11px">${esc(x.site)}</span>`:""}</td>
        <td class="code">${esc(x.wo||"—")}</td>
        <td><span class="pill" style="background:${stSoft(s.k)};color:${stVar(s.k)}">${STATES[s.k].g} ${esc(T(STATES[s.k].ar,STATES[s.k].en))}</span></td>
        <td>${meter(s.derived?100:0, T("الحصر","Takeoff"), s.derived?"var(--st-good)":"var(--st-warn)")}</td>
        <td>${meter(s.setPct, T("ضبط الحماية","Settings"), s.setPct>=80?"var(--st-good)":s.setPct>0?"var(--st-warn)":"var(--st-serious)")}</td>
        <td>${meter(Math.min(s.bill,100), T("المنفّذ من المقايسة","Executed of BOQ"), s.bill>110?"var(--st-serious)":"var(--st-good)")}</td>
        <td class="n">${s.pts?nf(s.pts):`<span style="color:var(--st-serious)">0</span>`}</td>
        <td class="n">${money(s.est)}</td>
        <td class="noprint"><button class="btn sm" data-dgo="${S.projects.indexOf(x)}">${T("فتح","Open")}</button></td>
      </tr>`).join("")||`<tr><td colspan="10" class="muted" style="text-align:center;padding:22px">${T("لا مشاريع في هذه الحالة","No projects in this state")}</td></tr>`}
      </tbody></table></div></div>

  <div class="grid g2">
    <div class="card"><header><h3>${T("تقدّم المشروع النشط","Active project progress")}</h3>
      <span class="sub">${esc(p.name)} · ${T("المنفّذ مقابل المخطط","executed vs planned")}</span></header>
      <div class="body" style="display:flex;flex-direction:column;gap:9px">
        ${groups.map(([ar,en,codes])=>{
          let pl=0,ex=0; codes.forEach(c=>{const b=p.boq[c]||{}; pl+=b.plan||0; ex+=b.exec||0;});
          const pc = pl? ex/pl*100 : (ex?130:0);
          const tone = pc>110?"var(--st-serious)":pc>=90?"var(--st-good)":pc>0?"var(--st-warn)":"var(--st-neutral)";
          return `<div class="cbar"><span class="lbl">${esc(T(ar,en))}</span>
            <span class="t" title="${esc(T(ar,en))}: ${nf(ex)} / ${nf(pl)}"><i style="width:${Math.min(pc,100)}%;background:${tone}"></i></span>
            <span class="n" style="color:${tone}">${nf(pc)}%</span></div>`;}).join("")}
        <div class="note" style="margin-top:3px">${T("النسبة = الكمية المنفّذة ÷ المخططة في المقايسة. فوق 110% تحتاج تعديل مقايسة معتمد.",
          "Percentage = executed ÷ planned quantity in the BOQ. Above 110% an approved BOQ revision is required.")}</div>
      </div></div>

    <div class="card"><header><h3>${T("ما يحتاج إجراءً الآن","What needs action now")}</h3>
      <span class="sub">${esc(p.name)}</span></header>
      <div class="body alerts">${alerts.map(([c,g,t,d])=>`<div class="alert" style="--ac:var(--st-${c})">
        <span class="g">${g}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div></div>`).join("")}</div></div>
  </div>

  ${firms.length>1?`<div class="card"><header><h3>${T("القيمة التقديرية حسب المقاول","Estimated value by contractor")}</h3>
    <span class="sub">${T("ريال سعودي · كل مقاول ومشاريعه","SAR · each contractor's own projects")}</span></header>
    <div class="body" style="display:flex;flex-direction:column;gap:9px">
      ${firms.sort((a,b)=>b.s.est-a.s.est).map(f=>`<div class="cbar">
        <span class="lbl" ${f.i===cur?'style="font-weight:700;color:var(--accent)"':""}>${esc(f.c)}</span>
        <span class="t" title="${esc(f.c)}: ${money(f.s.est)} SAR"><i style="width:${Math.max(2,f.s.est/fmax*100)}%"></i></span>
        <span class="n">${money(f.s.est)}</span></div>`).join("")}
    </div></div>`:""}
  </div>`;
}

export { STATES, ST_ORDER, DASH, projState, viewDash2 as viewDash };
