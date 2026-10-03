// @ts-nocheck — منقول من المنصة القديمة (reference/legacy.html) للحفاظ على تطابق المخرجات؛ تحرسه اختبارات parity.
import { S, P, T, AR, $, esc, nf, money, toast, copyTable, CONTRACTORS, MATERIALS, WORKS, CAT, AUTH, totals, derive, authorityFor, geoPoints, feeders, projStats, libMat, libWork, can, editable, isAdmin, pmLine, ME, CF, firmProjects, firmStats, fHex, fInitials, STANDALONE, dig, near, toUTM, utmToLL, hav, ACCEPT_COLS, SHEET_FIELDS, DEFAULT_FACTORS, PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ROLES, MODULES, ACTS, initials2 } from "../runtime";
import { pmHTML } from "../ui";
import ORG_LOGO from "../assets/org-logo.webp";

function deckStats(p){
  const t=totals(p), d=p.derived;
  const pr = c => (WORKS.find(x=>x.c===c)||{p:0}).p;
  let planC=0, execC=0;
  WORKS.forEach(x=>{const b=p.boq[x.c]||{}; planC+=(+b.plan||0)*x.p; execC+=(+b.exec||0)*x.p;});
  const matIss = MATERIALS.reduce((s,m)=>{const b=p.mat[m.c]||{};return s+(+b.iss||0)*m.p;},0);
  const matReq = MATERIALS.reduce((s,m)=>{const b=p.mat[m.c]||{};return s+(+b.req||0)*m.p;},0);
  const ind = (execC+matReq)*p.factors.indirectPct/100;
  const cur = execC+matReq+ind;
  const est = p.estCost.mat+p.estCost.inst+p.estCost.ind;
  const varPct = est? (cur-est)/est*100 : 0;
  const setDone = p.rmus.filter(r=>r.set).length;
  const highOhm = p.rmus.filter(r=>+r.ohm>3).length;
  return {t,d,planC,execC,matIss,matReq,ind,cur,est,varPct,setDone,highOhm,pr};
}

function sBar(label, val, max, color, valText){
  const w = max? Math.max(Math.min(Math.abs(val)/max*100,100),1.2) : 1.2;
  return `<div class="sbar"><span class="sbar-l">${esc(label)}</span>
    <span class="sbar-t"><span class="sbar-f" style="width:${w}%;background:${color}"></span></span>
    <span class="sbar-v">${esc(valText)}</span></div>`;
}

function dBar(label, val, max, fmt){
  const w = max? Math.max(Math.abs(val)/max*50,0.8) : 0.8;
  const pos = val>=0;
  return `<div class="dbar"><span class="dbar-l">${esc(label)}</span>
    <span class="dbar-t"><span class="dbar-mid"></span>
      <span class="dbar-f" style="width:${w}%;${pos?"inset-inline-start:50%":"inset-inline-end:50%"};background:${pos?"var(--bad)":"var(--ok)"}"></span></span>
    <span class="dbar-v" style="color:${pos?"var(--bad)":"var(--ok)"}">${pos?"+":""}${fmt(val)}</span></div>`;
}

function ring(pct, label, sub){
  const r=42, c=2*Math.PI*r, off=c*(1-Math.min(Math.max(pct,0),100)/100);
  return `<div class="ringbox"><svg viewBox="0 0 110 110" width="110" height="110" role="img" aria-label="${esc(label)} ${nf(pct)}%">
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="11"></circle>
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--accent)" stroke-width="11" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 55 55)"></circle>
    <text x="55" y="61" text-anchor="middle" fill="var(--ink)" font-size="22" font-weight="600"
      font-family="ui-monospace, Menlo, Consolas, monospace">${nf(pct)}%</text></svg>
    <div class="ringlab"><b>${esc(label)}</b><span>${esc(sub)}</span></div></div>`;
}

function buildDeck(){
  const p=P(), S1=deckStats(p), t=S1.t, d=p.derived;
  const today = new Date().toLocaleDateString(AR()?"ar-EG":"en-GB",{dateStyle:"long"});
  const sl = [];

  /* 1 — الغلاف */
  sl.push({k:T("غلاف","Cover"), h:`<div class="cover">
    <div class="cov-mark">SEC</div>
    <div class="eyebrow">${T("الشركة السعودية للكهرباء · إدارة كهرباء ","Saudi Electricity Company · ")}${esc(p.admin)}</div>
    <h1>${esc(p.name)}</h1>
    <p class="cov-sub">${T("تقرير تحليلي لأمر العمل رقم","Analytical report — work order")} <span class="num">${esc(p.wo)}</span></p>
    <div class="cov-meta">
      <div><b>${T("المقاول","Contractor")}</b><span>${esc(CONTRACTORS[p.contractor]||"")}</span></div>
      <div><b>${T("الموقع","Site")}</b><span>${esc(p.site||"—")}</span></div>
      <div><b>${T("القطاع","Sector")}</b><span>${esc(p.sector)}</span></div>
      <div><b>${T("تاريخ التقرير","Report date")}</b><span>${esc(today)}</span></div>
    </div></div>`});

  /* 2 — نطاق المشروع */
  sl.push({k:T("نطاق المشروع","Project scope"), t:T("نطاق المشروع كما هو على الكروكي","Project scope per the layout drawing"),
    h:`<div class="sgrid4">
      ${[[t.rmuNew,"وحدة حلقية RMU","Ring main units",`${nf(t.rmu3w)} × 3W · ${nf(t.rmu4w)} × 4W`],
         [t.trTot,"محطة وحدة","Unit substations",`${nf(t.tr220)} × 500/220 · ${nf(t.tr400)} × 500/400`],
         [t.htCable,"م كابل ج.متوسط 3×400","m MV cable 3×400",T("36 ك.ف ألمنيوم","36kV aluminium")],
         [t.lt300+t.lt185+t.lt70,"م كابل ج.منخفض","m LV cable",`4×300 / 4×185 / 4×70`],
         [t.trench,"م.طولي حفريات","m of trenching",T("مسفلت ورملي","asphalt & sandy")],
         [t.asphalt+t.milling,"م² سفلتة وكشط","m² asphalt & milling",T("أمانة ووزارة النقل","municipality & MoT")],
         [t.poleSteel+t.poleWood,"عمود مُزال","poles removed",`${nf(t.poleSteel)} ${T("حديدي","steel")} · ${nf(t.poleWood)} ${T("خشبي","wood")}`],
         [t.trPole1+t.trPole2,"محول هوائي مُزال","overhead TRs removed",T("على عمود وعمودين","1-pole & 2-pole")]
        ].map(([v,ar,en,sub])=>`<div class="stile"><span class="stile-v">${nf(v)}</span>
          <span class="stile-k">${esc(T(ar,en))}</span><span class="stile-s">${esc(sub)}</span></div>`).join("")}
    </div>
    <p class="snote">${T("المشروع يحوّل مغذيين هوائيين 33 ك.ف إلى شبكة كابلات أرضية مع استبدال المحولات الهوائية بمحطات وحدة ووحدات حلقية.","The project converts two 33 kV overhead feeders to an underground cable network, replacing pole-mounted transformers with unit substations and ring main units.")}</p>`});

  /* 3 — الملخص المالي */
  sl.push({k:T("الملخص المالي","Financial summary"), t:T("الملخص التنفيذي المالي","Executive financial summary"),
    h:`<div class="sgrid3">
      <div class="stile big"><span class="stile-k">${T("المقايسة التقديرية","Estimated BOQ")}</span>
        <span class="stile-v">${money(S1.est)}</span><span class="stile-s">${T("ريال · معتمدة","SAR · approved")} ${esc(p.approvedDate||"—")}</span></div>
      <div class="stile big hi"><span class="stile-k">${T("الاعتماد الحالي المطلوب","Current approval sought")}</span>
        <span class="stile-v">${money(S1.cur)}</span><span class="stile-s">${T("ريال · شامل غير المباشرة","SAR · incl. indirect")}</span></div>
      <div class="stile big"><span class="stile-k">${T("فرق المقايسة","BOQ variance")}</span>
        <span class="stile-v" style="color:${S1.varPct>0?"var(--bad)":"var(--ok)"}">${S1.varPct>0?"+":""}${nf(S1.varPct,1)}%</span>
        <span class="stile-s">${S1.varPct>0?"+":""}${money(S1.cur-S1.est)} ${T("ريال","SAR")}</span></div>
    </div>
    <div class="stack">
      <div class="stack-t">${T("تركيبة التكلفة الحالية","Current cost composition")}</div>
      <div class="stack-bar">
        <span style="width:${S1.matReq/S1.cur*100}%;background:var(--accent)">${nf(S1.matReq/S1.cur*100)}%</span>
        <span style="width:${S1.execC/S1.cur*100}%;background:var(--accent-2)">${nf(S1.execC/S1.cur*100)}%</span>
        <span style="width:${S1.ind/S1.cur*100}%;background:var(--ink-3)">${nf(S1.ind/S1.cur*100)}%</span>
      </div>
      <div class="legend">
        <span><i style="background:var(--accent)"></i>${T("مواد","Materials")} — ${money(S1.matReq)}</span>
        <span><i style="background:var(--accent-2)"></i>${T("تركيبات وأجور","Works & wages")} — ${money(S1.execC)}</span>
        <span><i style="background:var(--ink-3)"></i>${T("غير مباشرة","Indirect")} ${nf(p.factors.indirectPct,1)}% — ${money(S1.ind)}</span>
      </div>
    </div>
    <div class="callout ${Math.abs(S1.varPct)>30?"warn":""}">
      <b>${T("صاحب الصلاحية","Approving authority")}:</b> ${esc(authorityFor(S1.varPct))}
      ${Math.abs(S1.varPct)>30?" — "+T("مع تقرير فني إلزامي","technical report mandatory"):""}</div>`});

  /* 4 — أكبر بنود الفرق */
  const varItems = WORKS.map(x=>{const b=p.boq[x.c]||{}; const dq=(+b.exec||0)-(+b.plan||0); return {x,dq,dv:dq*x.p};})
    .filter(o=>o.dv).sort((a,b)=>Math.abs(b.dv)-Math.abs(a.dv)).slice(0,9);
  const maxV = Math.max(...varItems.map(o=>Math.abs(o.dv)),1);
  sl.push({k:T("بنود الفرق","Variance drivers"), t:T("أكبر تسعة بنود مسببة لفرق المقايسة","The nine largest drivers of the BOQ variance"),
    h:`<div class="dbars">${varItems.map(o=>dBar(AR()?o.x.ar.slice(0,58):o.x.en, o.dv, maxV, money)).join("")}</div>
      <p class="snote">${T("الأعمدة إلى اليمين زيادة على المقايسة، وإلى اليسار وفر. الزيادة الأكبر مصدرها أعمال لم تكن مدرجة أصلًا في المقايسة (اختبارات الكابلات، النهايات الطرفية، الثقب الأفقي)، والوفر الأكبر مصدره حفريات نُفذت بأطوال أقل من المخطط.","Bars to the right are overruns, to the left savings. The largest overruns come from works not originally in the BOQ (cable testing, terminations, HDD); the largest savings from trenching executed shorter than planned.")}</p>`});

  /* 5 — المقارنة الثلاثية */
  const triple = [["304010202","كابل ج.متوسط","MV cable"],["304010102","كابل ج.منخفض 300","LV cable 300"],
    ["301010201","حفر م.ض رملي","MV trench sandy"],["301010205","حفر م.ض مسفلت","MV trench asphalt"],
    ["309020101","تركيب RMU","RMU install"],["308020101","قواعد RMU","RMU foundations"],
    ["306010004","كشط وسفلتة","Milling"],["302020001","ثقب أفقي","HDD"]];
  sl.push({k:T("المقارنة الثلاثية","Three-way check"), t:T("الكروكي × المقايسة × المنفّذ على الطبيعة","Layout × BOQ × site-executed"),
    h:`<table class="stbl"><thead><tr><th>${T("البند","Item")}</th><th class="n">${T("الكروكي","Layout")}</th>
      <th class="n">${T("المقايسة","BOQ")}</th><th class="n">${T("المنفّذ","Executed")}</th>
      <th class="n">${T("انحراف المنفّذ عن الكروكي","Executed vs layout")}</th></tr></thead>
      <tbody>${triple.map(([c,ar,en])=>{
        const b=p.boq[c]||{}, der=d?(d.works[c]||0):0, ex=+b.exec||0;
        const dev = der? (ex-der)/der*100 : null;
        return `<tr><td>${esc(T(ar,en))}</td><td class="n">${nf(der)}</td><td class="n">${nf(+b.plan||0)}</td>
          <td class="n">${nf(ex)}</td>
          <td class="n" style="color:${dev==null?"var(--ink-3)":Math.abs(dev)<=10?"var(--ok)":Math.abs(dev)<=25?"var(--warn)":"var(--bad)"}">
            ${dev==null?"—":(dev>0?"+":"")+nf(dev,1)+"%"}</td></tr>`;}).join("")}
      </tbody></table>
      <p class="snote">${T("الكروكي هو المرجع الهندسي؛ أي بند ينحرف عنه بأكثر من ±10% يحتاج تبريرًا مكتوبًا وصورة موقعية قبل رفعه للاستشاري.","The layout is the engineering reference; any item deviating by more than ±10% needs a written justification and a site photo before it reaches the consultant.")}</p>`});

  /* 6 — موازنة المواد */
  const gaps = MATERIALS.map(m=>{const b=p.mat[m.c]||{}; const g=(+b.req||0)-(+b.iss||0); return {m,g,v:g*m.p};})
    .filter(o=>o.g).sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).slice(0,8);
  const maxG = Math.max(...gaps.map(o=>Math.abs(o.v)),1);
  sl.push({k:T("موازنة المواد","Material balance"), t:T("العجز بين المصروف من المستودع والمطلوب للتنفيذ","Gap between store-issued and required quantities"),
    h:`<div class="sgrid3">
      <div class="stile"><span class="stile-k">${T("قيمة المصروف","Issued value")}</span><span class="stile-v">${money(S1.matIss)}</span><span class="stile-s">${T("ريال","SAR")}</span></div>
      <div class="stile"><span class="stile-k">${T("قيمة المطلوب","Required value")}</span><span class="stile-v">${money(S1.matReq)}</span><span class="stile-s">${T("ريال","SAR")}</span></div>
      <div class="stile"><span class="stile-k">${T("العجز","Shortfall")}</span>
        <span class="stile-v" style="color:var(--bad)">${money(S1.matReq-S1.matIss)}</span><span class="stile-s">${T("يلزمه تعديل مقايسة","requires BOQ revision")}</span></div>
    </div>
    <div class="dbars">${gaps.map(o=>dBar(AR()?o.m.ar.slice(0,52):o.m.en, o.v, maxG, money)).join("")}</div>`});

  /* 7 — الحفريات */
  const exc = [["saHT1","رملي · 1 كابل م.ض","Sandy · 1 MV","301010201"],["asHT1","مسفلت · 1 كابل م.ض","Asphalt · 1 MV","301010205"],
    ["saHT2","رملي · 2 كابل","Sandy · 2 MV","301010202"],["asHT2","مسفلت · 2 كابل","Asphalt · 2 MV","301010206"],
    ["saHT3","رملي · 3 كابل","Sandy · 3 MV","301010203"],["saLT13","رملي · 1:3 م.خ","Sandy · 1:3 LV","301010101"],
    ["asLT13","مسفلت · 1:3 م.خ","Asphalt · 1:3 LV","301010103"]];
  const maxE = Math.max(...exc.map(([k])=>t[k]),1);
  sl.push({k:T("الحفريات","Excavation"), t:T("توزيع الحفريات حسب نوع التربة وعدد الكابلات","Trenching split by soil type and cable count"),
    h:`<div class="scols">
      <div><div class="stack-t">${T("الأطوال بالمتر الطولي","Lengths in linear metres")}</div>
        <div class="sbars">${exc.map(([k,ar,en,code])=>sBar(T(ar,en), t[k], maxE,
          k.startsWith("as")?"var(--accent-2)":"var(--accent)", nf(t[k])+" م")).join("")}</div></div>
      <div><div class="stack-t">${T("الأثر على التكلفة","Cost impact")}</div>
        <table class="stbl compact"><tbody>
          ${exc.map(([k,ar,en,code])=>`<tr><td>${esc(T(ar,en))}</td><td class="n">${nf(S1.pr(code),0)}</td>
            <td class="n">${money(t[k]*S1.pr(code))}</td></tr>`).join("")}
          <tr class="tot"><td>${T("إجمالي الحفريات","Trenching total")}</td><td class="n">—</td>
            <td class="n">${money(exc.reduce((s,[k,,,c])=>s+t[k]*S1.pr(c),0))}</td></tr>
        </tbody></table>
        <p class="snote">${T("الحفر في التربة المسفلتة أغلى من الرملية بنحو 12%، ويضيف عليه بندَي إعادة السفلتة والكشط بالفرّادة — وهو ما يفسر أن ","Asphalt trenching costs about 12% more than sandy ground and adds reinstatement and milling on top — which is why ")}${nf((t.asphalt+t.milling)*0+(t.asHT1+t.asHT2+t.asLT13))} ${T("مترًا مسفلتًا فقط تستهلك حصة غير متناسبة من الميزانية.","asphalt metres alone consume a disproportionate share of the budget.")}</p></div>
    </div>`});

  /* 8 — الوحدات الحلقية والحماية */
  const setPct = p.rmus.length? S1.setDone/p.rmus.length*100 : 0;
  const ohmPct = p.rmus.length? (p.rmus.length-S1.highOhm)/p.rmus.length*100 : 0;
  const byFeeder = {};
  p.rmus.forEach(r=>{ byFeeder[r.feeder]=(byFeeder[r.feeder]||0)+1; });
  sl.push({k:T("الحماية والتأريض","Protection & earthing"), t:T("جاهزية الوحدات الحلقية للتشغيل","RMU readiness for energisation"),
    h:`<div class="scols">
      <div class="rings">${ring(setPct, T("ضبط الحماية مكتمل","Relay settings complete"), `${S1.setDone} / ${p.rmus.length} ${T("وحدة","units")}`)}
        ${ring(ohmPct, T("تأريض ضمن الحد","Earthing within limit"), `${p.rmus.length-S1.highOhm} / ${p.rmus.length} ≤ 3 Ω`)}</div>
      <div>
        <div class="stack-t">${T("التوزيع على المغذيات","Distribution by feeder")}</div>
        <div class="sbars">${Object.entries(byFeeder).map(([f,n])=>
          sBar(f, n, Math.max(...Object.values(byFeeder)), "var(--accent)", nf(n)+" "+T("وحدة","units"))).join("")}</div>
        <div class="callout ${S1.setDone<p.rmus.length?"warn":""}">
          ${S1.setDone<p.rmus.length
            ? `<b>${T("معوّق تشغيلي","Operational blocker")}:</b> ${p.rmus.length-S1.setDone} ${T("وحدة لم يُستكمل ضبط الحماية لها؛ لا يمكن التغذية قبل اعتماد إدارة الحماية.","units still lack completed relay settings; energisation cannot proceed before Protection approves them.")}`
            : `<b>${T("جاهز","Ready")}:</b> ${T("كل الوحدات مضبوطة ومعتمدة.","all units are set and approved.")}`}</div>
        ${S1.highOhm?`<div class="callout warn"><b>${T("تأريض","Earthing")}:</b> ${S1.highOhm} ${T("وحدة تتجاوز 3 أوم — يوصى بإضافة قضبان تأريض قبل الاستلام النهائي.","units exceed 3 Ω — additional rods are recommended before final acceptance.")}</div>`:""}
      </div></div>`});

  /* 9 — الاختبارات والجودة */
  sl.push({k:T("الاختبارات","Testing"), t:T("سجل الاختبارات المطلوبة للإغلاق","Test register required for closeout"),
    h:`<table class="stbl"><thead><tr><th>${T("الاختبار","Test")}</th><th>${T("رقم البند","Code")}</th>
      <th class="n">${T("العدد","Count")}</th><th class="n">${T("التكلفة ريال","Cost SAR")}</th><th>${T("الأساس","Basis")}</th></tr></thead>
      <tbody>${[["اختبار كابل ج.متوسط VLF","MV cable VLF test","311000016","كل قطعة كابل","Each cable section"],
        ["الكثافة القصوى (بروكتر)","Proctor max density","307010002","كل 800 م حفر","Per 800 m"],
        ["دك التربة للكثافة الحقلية","Field density","307010005","كل 800 م حفر","Per 800 m"],
        ["نسبة الأسفلت والتدرج","Asphalt gradation","307040002","كل 2500 م² سفلتة","Per 2,500 m²"]
      ].map(([ar,en,c,bar,ben])=>{const q=(p.boq[c]||{}).exec||(d?d.works[c]:0)||0;
        return `<tr><td>${esc(T(ar,en))}</td><td class="code">${c}</td><td class="n">${nf(q)}</td>
        <td class="n">${money(q*S1.pr(c))}</td><td>${esc(T(bar,ben))}</td></tr>`;}).join("")}
      </tbody></table>
      <p class="snote">${T("اختبار الكابلات VLF وحده يمثل البند الأكبر ضمن الأعمال غير المدرجة بالمقايسة الأصلية، وهو شرط لازم لقبول الشبكة من إدارة التشغيل — لذا يُدرج في تعديل المقايسة لا في المطالبات اللاحقة.","VLF cable testing alone is the largest item among works absent from the original BOQ, and it is a precondition for Operations to accept the network — so it belongs in the BOQ revision, not in later claims.")}</p>`});

  /* 10 — المخاطر */
  const risks = [
    [S1.matReq>S1.matIss, "عجز مواد غير مغطى بمقايسة","Material shortfall not covered by the BOQ",
     "يُوقف إغلاق أمر العمل حتى اعتماد تعديل المقايسة؛ الإجراء: رفع خطاب تعديل مقايسة بالكميات الفعلية.",
     "Blocks work-order closure until the revision is approved; action: submit a BOQ revision letter with actual quantities.","high"],
    [Math.abs(S1.varPct)>30, "فرق المقايسة يتجاوز 30%","Variance exceeds 30%",
     "ينتقل الاعتماد لنائب الرئيس التنفيذي ويستلزم تقريرًا فنيًا؛ الإجراء: إعداد التقرير الفني مع مبررات كل بند.",
     "Approval escalates to the EVP and a technical report is required; action: prepare it with per-item justification.","high"],
    [S1.setDone<p.rmus.length, "ضبط حماية غير مكتمل","Incomplete relay settings",
     "يمنع التغذية والاستلام النهائي؛ الإجراء: جدولة فريق الحماية للوحدات المتبقية.",
     "Prevents energisation and final acceptance; action: schedule the protection team for the remaining units.","med"],
    [S1.highOhm>0, "مقاومة تأريض فوق الحد","Earth resistance above limit",
     "ملاحظة متوقعة من الاستشاري عند الاستلام؛ الإجراء: إضافة قضبان تأريض وإعادة القياس والتوثيق بالصور.",
     "An expected consultant observation at handover; action: add rods, re-measure and document with photos.","med"],
    [true, "رخص الحفر واشتراطات الأمانة","Permits and municipality conditions",
     "أي انتهاء رخصة يوقف الحفر ويُحمّل المقاول تكلفة التعطّل؛ الإجراء: سجل رخص بتواريخ الانتهاء وتنبيه مبكر.",
     "An expired permit halts excavation at the contractor's cost; action: a permit register with expiry alerts.","med"],
    [true, "توثيق الكميات بالصور","Photographic quantity evidence",
     "غياب الصورة المؤرخة يُضعف أي مطالبة بند؛ الإجراء: ربط كل بند تجاوز 10% بصورة بالإحداثيات.",
     "Without dated photos any item claim weakens; action: tie every item beyond 10% to a geotagged photo.","low"]
  ].filter(r=>r[0]);
  sl.push({k:T("المخاطر","Risks"), t:T("المخاطر والمعوقات وإجراءات المعالجة","Risks, blockers and mitigating actions"),
    h:`<div class="risks">${risks.map(([,ar,en,dar,den,lv])=>`<div class="risk ${lv}">
      <span class="rlv">${lv==="high"?T("عالٍ","High"):lv==="med"?T("متوسط","Medium"):T("منخفض","Low")}</span>
      <div><b>${esc(T(ar,en))}</b><p>${esc(T(dar,den))}</p></div></div>`).join("")}</div>`});

  /* 11 — التوصيات */
  sl.push({k:T("التوصيات","Recommendations"), t:T("التوصيات والخطوات التالية","Recommendations and next steps"),
    h:`<ol class="steps">
      ${[["رفع نموذج تعديل المقايسة 02 بالكميات المنفّذة الفعلية","Submit BOQ revision Form 02 with the actual executed quantities",
          `${T("بقيمة","Value")} ${money(S1.cur-S1.est)} ${T("ريال ونسبة","SAR at")} ${nf(S1.varPct,1)}% — ${esc(authorityFor(S1.varPct))}`],
         ["إرجاع المواد الفائضة للمستودع قبل طلب الإغلاق","Return surplus materials to the store before requesting closure",
          T("لتفادي تطبيق آلية خصم قيمة المواد المفقودة من مستحقات المقاول.","To avoid the lost-materials deduction from contractor dues.")],
         ["استكمال ضبط الحماية واعتماده من إدارة الحماية","Complete relay settings and obtain Protection approval",
          `${p.rmus.length-S1.setDone} ${T("وحدة متبقية — شرط لازم للتغذية والاستلام النهائي.","units remaining — a precondition for energisation and final acceptance.")}`],
         ["تجميع تقارير VLF والبروكتر والكثافة الحقلية في ملف واحد","Compile VLF, Proctor and field-density reports into one file",
          T("مرتبة بأرقام البنود ومواقعها على الكروكي، لأنها أول ما يطلبه الاستشاري.","Ordered by item code and layout location — the first thing the consultant asks for.")],
         ["تسليم كروكي As-Built موقّعًا بإحداثيات كل معدة","Hand over a signed As-Built drawing with per-unit GPS",
          T("وتحديث بيانات GIS لتفادي إعادة فتح أمر العمل لاحقًا.","And update GIS to avoid the work order being reopened later.")],
         ["إقفال أمر العمل بمحضر استلام نهائي ومخالصة","Close the work order with a final acceptance record and discharge",
          T("بعد اكتمال البنود الخمسة السابقة دون ملاحظات معلّقة.","Once the five steps above are closed with no outstanding observations.")]
        ].map(([ar,en,sub])=>`<li><b>${esc(T(ar,en))}</b><span>${esc(sub)}</span></li>`).join("")}
    </ol>`});

  /* 12 — الخاتمة */
  sl.push({k:T("الخاتمة","Closing"), h:`<div class="cover end">
    <div class="eyebrow">${T("انتهى التقرير","End of report")}</div>
    <h1>${T("جاهز للعرض على الاستشاري","Ready for the consultant")}</h1>
    <p class="cov-sub">${esc(p.name)} · <span class="num">${esc(p.wo)}</span></p>
    <div class="cov-meta">
      <div><b>${T("مهندس المشروع","Project engineer")}</b><span>${T("م / أحمد زهران","Eng. Ahmed Zahran")}</span></div>
      <div><b>${T("المقاول","Contractor")}</b><span>${esc(CONTRACTORS[p.contractor]||"")}</span></div>
      <div><b>${T("الإدارة","Department")}</b><span>${T("إدارة كهرباء ","")}${esc(p.admin)}</span></div>
      <div><b>${T("التاريخ","Date")}</b><span>${esc(today)}</span></div>
    </div></div>`});

  DECK.slides = sl;
}

function renderDeckBase(){
  const n = DECK.slides.length;
  DECK.i = Math.max(0, Math.min(DECK.i, n-1));
  $("deckStage").innerHTML = DECK.slides.map((s,i)=>`
    <section class="slide${i===DECK.i?" on":""}" data-si="${i}" ${i===DECK.i?"":"aria-hidden=\"true\""}>
      ${s.t?`<header class="sl-head"><span class="sl-ix">${String(i+1).padStart(2,"0")}</span><h2>${esc(s.t)}</h2></header>`:""}
      <div class="sl-body">${s.h}</div>
      <footer class="sl-foot"><span>${esc(P().name)} · ${esc(P().wo)}</span><span class="num">${i+1} / ${n}</span></footer>
    </section>`).join("");
  $("deckPos").textContent = (DECK.i+1)+" / "+n;
  $("deckDots").innerHTML = DECK.slides.map((s,i)=>
    `<button class="ddot${i===DECK.i?" on":""}" data-di="${i}" title="${esc(s.k)}" aria-label="${esc(s.k)}"></button>`).join("");
  $("deckDots").querySelectorAll("button").forEach(b=>b.onclick=()=>{DECK.i=+b.dataset.di;renderDeck();});
  $("deckLabel").textContent = DECK.slides[DECK.i].k;
}

/** توقيع مدير المشاريع في تذييل كل شريحة */
function renderDeck(){
  renderDeckBase();
  document.querySelectorAll("#deckStage .sl-foot").forEach(f=>{
    if(f.querySelector(".pmsg")) return;
    const s=document.createElement("span"); s.className="pmsg";
    s.textContent = PM_ROLE_EN+" · "+PM_NAME;
    f.insertBefore(s, f.lastElementChild);
  });
}

function openDeck(){
  buildDeck(); DECK.i=0;
  $("deck").hidden=false; document.body.style.overflow="hidden";
  renderDeck(); $("deckNext").focus();
}

function closeDeck(){ $("deck").hidden=true; document.body.style.overflow=""; }

function stepDeck(d){ DECK.i=(DECK.i+d+DECK.slides.length)%DECK.slides.length; renderDeck(); }

let DECK = {i:0, slides:[]};

function installDeckKeys(){
  document.addEventListener("keydown", e=>{
  if($("deck").hidden) return;
  if(e.key==="Escape") closeDeck();
  else if(e.key==="ArrowRight") stepDeck(AR()?-1:1);
  else if(e.key==="ArrowLeft") stepDeck(AR()?1:-1);
  else if(e.key==="ArrowDown"||e.key===" "||e.key==="PageDown"){e.preventDefault();stepDeck(1);}
  else if(e.key==="ArrowUp"||e.key==="PageUp"){e.preventDefault();stepDeck(-1);}
  else if(e.key==="Home"){DECK.i=0;renderDeck();}
  else if(e.key==="End"){DECK.i=DECK.slides.length-1;renderDeck();}
});
}
function deckIsOpen(){ return !$("deck").hidden; }
export { DECK, buildDeck, renderDeck, openDeck, closeDeck, stepDeck, installDeckKeys, deckIsOpen };
