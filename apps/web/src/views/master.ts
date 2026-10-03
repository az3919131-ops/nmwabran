// @ts-nocheck — منقول من المنصة القديمة (reference/legacy.html) للحفاظ على تطابق المخرجات؛ تحرسه اختبارات parity.
import { S, P, T, AR, $, esc, nf, money, toast, copyTable, CONTRACTORS, MATERIALS, WORKS, CAT, AUTH, totals, derive, authorityFor, geoPoints, feeders, projStats, libMat, libWork, can, editable, isAdmin, pmLine, ME, CF, firmProjects, firmStats, fHex, fInitials, STANDALONE, dig, near, toUTM, utmToLL, hav, ACCEPT_COLS, SHEET_FIELDS, DEFAULT_FACTORS, PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ROLES, MODULES, ACTS, initials2 } from "../runtime";
import { viewMaster } from "./basic";
import { docAllCard } from "../overlays/doc";

function masterExtras(){
  const p=P(), t=totals(p), d=p.derived;
  const pts=(typeof geoPoints==="function")?geoPoints(p):[];
  const boqN=Object.keys(p.boq).filter(c=>(p.boq[c].plan||p.boq[c].exec)).length;
  const matN=Object.keys(p.mat).filter(c=>(p.mat[c].iss||p.mat[c].req)).length;
  const cables=[["8114005","كابل ج.متوسط 3×400","MV 3×400",t.htCable],["8111007","كابل 4×300","LV 4×300",t.lt300],
    ["8111006","كابل 4×185","LV 4×185",t.lt185],["8111005","كابل 4×70","LV 4×70",t.lt70],["8113009","أحادي 1×50","Single 1×50",t.mvSingle]];
  return `
  <div class="card"><header><h3>${T("سجل الكروكيات والنماذج","Layout & forms register")}</h3>
    <span class="sub">${T("كل ملف يُرفع هنا تُستورد بياناته إلى باقي الصفحات","Every file uploaded here feeds the other pages")}</span>
    <span class="sp"></span>
    <button class="btn sm pri noprint" id="regAdd">${T("+ رفع ملفات","+ Upload files")}</button>
    <button class="btn sm noprint" id="regTpl">${T("قالب حصر Excel","Excel tally template")}</button>
    <button class="btn sm noprint" id="regBack">${T("اشتقاق حصر اللوحات من المستورد","Back-fill tally from imports")}</button>
    ${P().canUndo?`<button class="btn sm gh noprint" id="regUndo">${T("تراجع عن آخر استيراد","Undo last import")}</button>`:""}
    <button class="btn sm gh noprint" id="regClear">${T("مسح السجل","Clear register")}</button></header>
  <div class="body tight scroll"><table class="reg"><thead><tr>
    <th>#</th><th>${T("الملف","File")}</th><th>${T("النوع","Type")}</th><th class="n">${T("الحجم","Size")}</th>
    <th>${T("التاريخ","Date")}</th><th>${T("الحالة","Status")}</th><th class="n">${T("صفوف","Rows")}</th><th>${T("إجراءات","Actions")}</th></tr></thead>
    <tbody>${p.files.length? p.files.map((f,i)=>`<tr>
      <td class="n">${i+1}</td>
      <td class="wrap-t">${f.url?`<img src="${f.url}" alt="" style="width:34px;height:24px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-inline-end:7px">`:""}${esc(f.name)}</td>
      <td><span class="pill ${f.kind==="data"?"acc":""}">${
        ["xlsx","xlsm"].includes(f.ext)?T("إكسل","Excel"): f.ext==="csv"?"CSV": f.ext==="pdf"?"PDF": f.ext==="docx"?"Word":
        ["kml","kmz","gpx","geojson"].includes(f.ext)?T("إحداثيات","Coordinates"): f.kind==="img"?T("صورة كروكي","Layout image"):(f.ext||"—")}</span></td>
      <td class="n">${nf((f.size||0)/1024)} KB</td>
      <td class="code">${(f.at||"").slice(0,10)}</td>
      <td><span class="pill ${f.imported?"ok":f.kind==="data"?"bad":"warn"}">${f.imported?T("مُستورد","Imported"):f.kind==="data"?T("لم يُقرأ","Not read"):T("مرجع بصري","Visual reference")}</span></td>
      <td class="n">${f.rows?nf(f.rows):"—"}</td>
      <td class="act noprint">
        ${(P().files.find(x=>x.id===f.id)||{}).hasOriginal?`<button class="btn sm gh" data-reimp="${f.id}">${T("إعادة استيراد","Re-import")}</button>`:""}
        <button class="btn sm gh" data-rmf="${i}">${T("مسح","Delete")}</button></td></tr>`).join("")
      :`<tr><td colspan="8" style="padding:18px;text-align:center;color:var(--ink-3)">${T("لم تُرفع ملفات بعد — ارفع الكروكي وملفات الإكسل (الحصر، ضبط الحماية، الاستلام، المقايسة).","No files yet — upload the layout drawing and the Excel files (tally, protection, acceptance, BOQ).")}</td></tr>`}
    </tbody></table></div>
  ${S.lastRep?`<div class="body" style="border-top:1px solid var(--line)">
    <div class="stack-t" style="margin-bottom:7px">${T("تقرير آخر استيراد","Last import report")} — ${esc(S.lastRep.file)}</div>
    <div class="rep">${S.lastRep.rep.map(([k,m])=>`<div class="r"><i style="background:${k==="ok"?"var(--ok)":k==="new"?"var(--accent-2)":k==="ai"?"var(--accent)":k==="warn"?"var(--bad)":"var(--warn)"}"></i><span>${esc(m)}</span></div>`).join("")}</div></div>`:""}
  </div>

  <div class="card"><header><h3>${T("المعدات والإحداثيات من الكروكي","Equipment & coordinates from the layout")}</h3>
    <span class="sub">${nf(pts.length)} ${T("نقطة بإحداثيات","geo-referenced points")}</span><span class="sp"></span>
    <button class="btn sm noprint" id="toMap">${T("فتح الخريطة","Open the map")}</button></header>
  <div class="body grid g2">
    <div>
      <div class="stack-t" style="margin-bottom:7px">${T("الكابلات المستخدمة طبقًا للكروكي","Cables used per the layout")}</div>
      <table class="stbl" style="font-size:12.5px"><tbody>
        ${cables.filter(c=>c[3]).map(([code,ar,en,q])=>{
          const m=libMat(code), der=d?(d.mats[code]||0):0;
          return `<tr><td class="code">${code}</td><td class="wrap-t">${esc(T(ar,en))}</td>
            <td class="n">${nf(q)} ${T("م","m")}</td><td class="n muted">${der?nf(der)+T(" م بالهالك"," m w/ waste"):""}</td></tr>`;}).join("")
        ||`<tr><td class="muted" style="padding:10px">${T("أدخل أطوال الكابلات في جدول حصر اللوحات","Enter cable lengths in the tally table")}</td></tr>`}
      </tbody></table>
    </div>
    <div>
      <div class="stack-t" style="margin-bottom:7px">${T("المعدات الأرضية","Ground equipment")}</div>
      <div class="scroll" style="max-height:220px;overflow-y:auto"><table class="stbl" style="font-size:12px"><thead><tr>
        <th>${T("الوحدة","Unit")}</th><th>${T("المغذي","Feeder")}</th><th>${T("النوع","Type")}</th><th class="n">Lat</th><th class="n">Lon</th></tr></thead>
        <tbody>${pts.length? pts.slice(0,60).map(q=>`<tr><td class="code">${esc(q.id)}</td><td>${esc(q.feeder)}</td>
          <td>${esc(q.type)}${q.hasTR?" + TR":""}</td><td class="n">${q.lat.toFixed(6)}</td><td class="n">${q.lon.toFixed(6)}</td></tr>`).join("")
          :`<tr><td colspan="5" class="muted" style="padding:10px">${T("ارفع ملف ضبط الحماية ليُستورد جدول الوحدات بإحداثياتها","Upload the protection-settings file to import the unit schedule with coordinates")}</td></tr>`}
        </tbody></table></div>
    </div>
  </div></div>

  <div class="card"><header><h3>${T("تدفق البيانات إلى الصفحات","Data flow to the pages")}</h3>
    <span class="sub">${T("كل ما يلي مصدره هذه الصفحة","Everything below is sourced from this page")}</span></header>
  <div class="body flow">
    ${[[boqN, "المقايسة والمقارنة","BOQ & variance","بند أجور","work items","boq"],
       [matN, "موازنة المواد","Material balance","مادة","materials","boq"],
       [Object.keys(p.boq).filter(c=>p.boq[c].exec).length, "فاتورة الأجور","Wages invoice","بند منفّذ","executed items","wages"],
       [p.rmus.length, "النماذج والاستلام","Forms & acceptance","وحدة حلقية","ring main units","forms"],
       [pts.length, "الخريطة والإحداثيات","Map & coordinates","نقطة","points","map"],
       [p.sheets.length, "الحصر المستنبط","Derived takeoff","لوحة كروكي","layout sheets","master"]
      ].map(([n,ar,en,uar,uen,page])=>`<div class="f" data-go2="${page}" style="cursor:pointer">
        <span class="n">${nf(n)}</span><b>${esc(T(ar,en))}</b><span>${esc(T(uar,uen))}</span></div>`).join("")}
  </div></div>`;
}

function aiCard(){
  const on = !!AUTH.features.ai;
  return `<div class="card"><header><h3>${T("المراجعة الفنية بالذكاء الاصطناعي","AI technical review")}</h3>
    <span class="ai-badge ${on?"":"off"}">${on?T("متاح","Available"):T("غير مُهيّأ على الخادم","Not configured on the server")}</span>
    <span class="sp"></span>
    ${on?`<button class="btn sm noprint" id="aiRun">${T("مراجعة الحصر الآن","Review the takeoff now")}</button>`:""}</header>
  <div class="body">
    ${S.aiNotes? `<div class="ai-out">${esc(S.aiNotes)}</div>`
      : `<p class="muted" style="font-size:12.5px">${on
        ? T("اضغط «استنباط ومعالجة ذكية» أو «مراجعة الحصر الآن» ليقرأ الذكاء الاصطناعي كميات المشروع ويكتب ملاحظات مهندس حصر عليها.","Press “Derive & AI-process” or “Review the takeoff now” to get a quantity-surveyor's read on the project figures.")
        : T("المعالجة الذكية تعمل من الخادم عند ضبط ANTHROPIC_API_KEY في بيئته. بدونه تعمل المنصة بمحرك الاستنباط والقراءة المباشرة للملفات.","AI processing runs on the server when ANTHROPIC_API_KEY is configured in its environment. Without it the platform uses the deterministic engine and direct file reading.")}</p>`}
  </div></div>`;
}

function woCard(){
  const p=P(), files=p.files||[];
  const ev=files.filter(f=>f.ident && f.ident.wo && !f.ident.woWeak);
  const ok=ev.filter(f=>dig(f.ident.wo)===dig(p.wo)).length;
  const rel=ev.filter(f=>dig(f.ident.wo)!==dig(p.wo) && f.ident.woReq);          // طلبات UDS مرتبطة
  const bad=ev.filter(f=>dig(f.ident.wo)!==dig(p.wo) && !f.ident.woReq);         // أوامر عمل مختلفة فعلًا
  const src=k=>{ const f=files.find(x=>x.ident&&x.ident[k]); return f? f.name : T("إدخال يدوي","manual entry"); };
  const fields=[
    ["wo", T("رقم أمر العمل / UDS","Work order / UDS"), p.wo, true],
    ["name", T("اسم المشروع","Project name"), p.name, false],
    ["site", T("موقع المشروع","Site"), p.site||"—", false],
    ["admin", T("الإدارة","Department"), p.admin||"—", false],
    ["sector", T("القطاع","Sector"), p.sector||"—", false],
    ["contractor", T("المقاول","Contractor"), CONTRACTORS[p.contractor]||"—", false]
  ];
  return `
  <div class="card" id="woCard"><header><h3>${T("هوية أمر العمل ومطابقتها بالملفات","Work-order identity & file matching")}</h3>
    <span class="sub">${ev.length? T(`${ok} من ${ev.length} ملف مطابق`, `${ok} of ${ev.length} files match`)+(rel.length?T(` · ${rel.length} طلب UDS مرتبط`,` · ${rel.length} related UDS request(s)`):"") : T("لم يُقرأ رقم أمر عمل من الملفات بعد","No work-order number read from files yet")}</span>
    <span class="sp"></span>
    <label class="sw noprint"><input type="checkbox" id="woGuard" ${S.woGuard?"checked":""}>
      ${T("حماية المطابقة","Matching guard")}</label></header>
  <div class="body" style="display:flex;flex-direction:column;gap:12px">
    <div class="idgrid">${fields.map(([k,lab,val,isNum])=>{
      const from=files.find(f=>f.ident&&f.ident[k]&&String(f.ident[k]).trim());
      let cls=null, txt="";
      if(k==="wo" && ev.length){
        if(!bad.length){ cls="ok"; txt=T("مطابق لكل الملفات","Matches all files"); }
        else if(ok){ cls="warn"; txt=T(`مطابق ${ok} ومختلف ${bad.length}`,`${ok} match · ${bad.length} differ`); }
        else { cls="bad"; txt=T("مختلف عن الملفات","Differs from files"); }
      } else if(k!=="wo" && from){
        const s=near(from.ident[k], val); cls=s?"ok":"warn";
        txt=s?T("مطابق للملفات","Matches files"):T("يختلف عن الملف","Differs from file");
      }
      return `<div class="idg"><b>${esc(lab)}</b>
        <span class="v ${isNum?"num":""}">${esc(val||"—")}</span>
        <span class="s">${from? T("من ","from ")+esc(from.name) : T("إدخال يدوي","manual entry")}</span>
        ${cls?`<span class="pill ${cls}" style="align-self:flex-start;margin-top:3px">${txt}</span>`:""}
      </div>`;}).join("")}</div>

    ${ev.length?`<div class="scroll"><table class="stbl"><thead><tr>
      <th>${T("الملف","File")}</th><th>${T("رقم أمر العمل في الملف","Work order in file")}</th>
      <th>${T("اسم المشروع في الملف","Project name in file")}</th><th>${T("الحالة","Status")}</th><th>${T("إجراء","Action")}</th></tr></thead>
      <tbody>${ev.map(f=>{
        const same=dig(f.ident.wo)===dig(p.wo), isRel=!same && !!f.ident.woReq;
        const tag = same ? ""
                  : f.ident.woReq ? T("طلب UDS","UDS request")
                  : f.ident.woFromName ? T("من اسم الملف","from filename")
                  : f.ident.woWeak ? T("ترجيح","inferred") : "";
        return `<tr><td class="wrap-t">${esc(f.name)}</td>
          <td class="code">${esc(f.ident.wo)}${tag?` <span class="muted">(${tag})</span>`:""}</td>
          <td class="wrap-t">${esc(f.ident.name||"—")}</td>
          <td><span class="pill ${same?"ok":isRel?"warn":f.blocked?"bad":"warn"}">${
            same?T("مطابق","Match"):isRel?T("طلب مرتبط","Related request"):f.blocked?T("موقوف","Blocked"):T("مختلف","Differs")}</span></td>
          <td class="act noprint">${same||isRel?"—":`<button class="btn sm" data-adopt="${esc(f.ident.wo)}">${T("اعتمد هذا الرقم","Adopt this number")}</button>
            ${f.blocked&&(P().files.find(x=>x.id===f.id)||{}).hasOriginal?`<button class="btn sm gh" data-force="${f.id}">${T("استورد رغم الاختلاف","Import anyway")}</button>`:""}`}</td></tr>`;
      }).join("")}</tbody></table></div>`:""}

    ${bad.length?`<div class="note warn">${T("ملفات بأرقام أوامر عمل مختلفة تعني عادة أنها تخص مشروعًا آخر. اعتمد الرقم الصحيح، أو أنشئ مشروعًا جديدًا وارفعها فيه، حتى لا تختلط كميات مشروعين في مقايسة واحدة.",
      "Files with different work-order numbers usually belong to another project. Adopt the correct number, or create a new project and upload them there, so two projects' quantities never mix in one BOQ.")}</div>`:""}
  </div></div>`;
}

function geoConfCard(){
  if(!(P().geoConflicts||[]).length) return "";
  const byB={}; (P().geoConflicts||[]).forEach(c=>{ byB[c.bSrc]=(byB[c.bSrc]||0)+1; });
  return `
  <div class="card" id="geoConf"><header><h3>${T("تعارض إحداثيات بين الملفات","Coordinate conflict between files")}</h3>
    <span class="sub">${nf((P().geoConflicts||[]).length)} ${T("وحدة لها إحداثيان مختلفان","unit(s) with two different coordinates")}</span>
    <span class="sp"></span>
    ${Object.keys(byB).map(s=>`<button class="btn sm noprint" data-usesrc="${esc(s)}">${T("اعتمد ","Use ")+esc(s)}</button>`).join("")}</header>
  <div class="body">
    <div class="note warn">${T("نفس رقم الوحدة يحمل موقعين متباعدين في ملفين — غالبًا أحد الملفين منقول من مشروع آخر ولم تُحدَّث إحداثياته. المنصة أبقت أول قراءة ولم تستبدلها.",
      "The same unit number carries two distant locations in two files — usually one file was copied from another project and its coordinates were never updated. The platform kept the first reading and did not overwrite it.")}</div>
    <div class="scroll" style="margin-top:10px"><table class="stbl"><thead><tr>
      <th>${T("الوحدة","Unit")}</th><th>${T("المعتمد حاليًا","Currently used")}</th><th>${T("المصدر","Source")}</th>
      <th>${T("القيمة الأخرى","Other value")}</th><th>${T("المصدر","Source")}</th><th class="n">${T("الفارق (كم)","Gap (km)")}</th></tr></thead>
      <tbody>${(P().geoConflicts||[]).slice(0,60).map(c=>`<tr><td class="code">${esc(c.id)}</td>
        <td class="code">${esc(c.a)}</td><td class="wrap-t">${esc(c.aSrc)}</td>
        <td class="code">${esc(c.b)}</td><td class="wrap-t">${esc(c.bSrc)}</td>
        <td class="n">${nf(c.km)}</td></tr>`).join("")}</tbody></table></div>
  </div></div>`;
}

function geoSrcCard(){
  const p=P(), pts=geoPoints(p), byUnit=pts.filter(q=>!q.extra).length, extra=pts.length-byUnit;
  const src={};
  (p.geo||[]).forEach(g=>{ const s=String(g.src||"—").split(" · ")[0]; src[s]=(src[s]||0)+1; });
  const rows=Object.entries(src).sort((a,b)=>b[1]-a[1]);
  return `
  <div class="card" id="geoSrc"><header><h3>${T("مصادر الإحداثيات في هذا المشروع","Coordinate sources in this project")}</h3>
    <span class="sub">${nf(pts.length)} ${T("نقطة","points")} · ${nf(byUnit)} ${T("من جدول الوحدات","from the unit schedule")} · ${nf(extra)} ${T("مستخرجة من الملفات","extracted from files")}</span>
    <span class="sp"></span>
    <button class="btn sm pri noprint" id="geoScan">${T("التقاط كل الإحداثيات من الملفات","Capture every coordinate from the files")}</button>
    ${(p.geo||[]).length?`<button class="btn sm gh noprint" id="geoClear">${T("مسح النقاط المستخرجة","Clear extracted points")}</button>`:""}</header>
  <div class="body">
    ${rows.length?`<div class="scroll"><table class="stbl"><thead><tr><th>${T("الملف","File")}</th><th class="n">${T("نقاط","Points")}</th></tr></thead>
      <tbody>${rows.map(([s,n])=>`<tr><td class="wrap-t">${esc(s)}</td><td class="n">${nf(n)}</td></tr>`).join("")}</tbody></table></div>`
     :`<div class="note">${T("لم تُستخرج إحداثيات من الملفات بعد. ارفع الكروكي (KML/KMZ/GPX)، أو أي إكسل به أعمدة Latitude/Longitude أو E/N بنظام UTM، أو PDF مكتوب به إحداثيات — ثم اضغط «التقاط كل الإحداثيات».",
       "No coordinates extracted from files yet. Upload the layout (KML/KMZ/GPX), any Excel with Latitude/Longitude or UTM E/N columns, or a PDF containing coordinates — then press “Capture every coordinate”.")}</div>`}
    <div class="note" style="margin-top:10px">${T("يقرأ المحرك: عمودَي خط العرض/خط الطول، وخلية واحدة بها «17.693713, 44.459428»، وصيغة الدرجات والدقائق والثواني، وأعمدة UTM (E/N) بالمنطقة 38، ونصوص PDF وWord — ويستبعد أي رقم خارج حدود المملكة.",
      "The engine reads latitude/longitude column pairs, a single cell holding “17.693713, 44.459428”, degrees-minutes-seconds, UTM E/N columns (zone 38), and PDF/Word text — and rejects any number outside Saudi bounds.")}</div>
  </div></div>`;
}

function viewMasterFull(){ return viewMaster() + woCard() + masterExtras() + aiCard() + geoConfCard() + geoSrcCard() + docAllCard(); }
export { viewMasterFull, woCard, masterExtras, aiCard, geoConfCard, geoSrcCard };
