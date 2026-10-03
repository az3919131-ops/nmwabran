// @ts-nocheck — منقول من المنصة القديمة (reference/legacy.html) للحفاظ على تطابق المخرجات؛ تحرسه اختبارات parity.
import { S, P, T, AR, $, esc, nf, money, toast, copyTable, CONTRACTORS, MATERIALS, WORKS, CAT, AUTH, totals, derive, authorityFor, geoPoints, feeders, projStats, libMat, libWork, can, editable, isAdmin, pmLine, ME, CF, firmProjects, firmStats, fHex, fInitials, STANDALONE, dig, near, toUTM, utmToLL, hav, ACCEPT_COLS, SHEET_FIELDS, DEFAULT_FACTORS, PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ROLES, MODULES, ACTS, initials2 } from "../runtime";
import { allProjPts as coreAllProjPts, gaLabel as coreGaLabel } from "@iltizam/core";
import { gaExport } from "../actions/exports";
import { mkIcon, mkSync, popHTML, uDet } from "../views/map";
import L from "leaflet";
const loadLeaflet = async () => L;


const GEO_HEX = ["49b9a4","e0ab55","8fb3ff","e58076","b08ee8","5fc27e","d99ac0","9fb7c9"];
const GA = {coord:true, sel:null, map:null, reg:null, pt:null};

/* كل النقاط في كل المشاريع، موسومة برقم أمر العمل (المحسوبة في packages/core) */
function allProjPts(){ return coreAllProjPts(S.projects); }
function gaLabel(g, q){ return coreGaLabel(g, q, GA.coord, T); }
/** خريطة التجميع تبدأ على مشاريع المقاول المختار فقط */
function gaSelected(){
  const all=allProjPts(), f=CF();
  const own=g=>(+((S.projects[g.i]||{}).contractor)||0)===f;
  if(!GA.sel) GA.sel = Object.fromEntries(all.map(g=>[g.id, g.n>0 && own(g)]));
  all.forEach(g=>{ if(GA.sel[g.id]===undefined) GA.sel[g.id] = g.n>0 && own(g); });
  return all.filter(g=>g.n && GA.sel[g.id]);
}
const gaSelectedIds = () => gaSelected().map(g=>g.id);
const gaReset = () => { GA.sel = null; };
function gaCenter(){
  const pts=gaSelected().flatMap(g=>g.pts);
  if(!pts.length) return null;
  return {lat:pts.reduce((s,q)=>s+q.lat,0)/pts.length, lon:pts.reduce((s,q)=>s+q.lon,0)/pts.length, n:pts.length};
}
function gaHTML(){
  const all=allProjPts(); gaSelected();
  const gs=all.filter(g=>g.n && GA.sel[g.id]);
  const tot=gs.reduce((s,g)=>s+g.n,0), route=gs.reduce((s,g)=>s+g.route,0);
  const c=gaCenter();
  const ge=c?`https://earth.google.com/web/@${c.lat},${c.lon},700a,12000d,35y,0h,0t,0r`:"https://earth.google.com/web/";
  const gm=c?`https://www.google.com/maps/@${c.lat},${c.lon},15z/data=!3m1!1e3`:"https://www.google.com/maps";
  return `
  <div class="gbar">
    <button class="btn sm" id="gaClose">✕</button>
    <div><div class="t">${T("كل مشاريع الالتزام — تجميع جوجل إيرث","All compliance projects — Google Earth")}</div>
      <div class="s">${nf(gs.length)} ${T("أمر عمل","work orders")} · ${nf(tot)} ${T("نقطة","points")} · ${nf(Math.round(route))} ${T("م مسارات","m of routes")}</div></div>
    <span class="sp"></span>
    <label class="sw"><input type="checkbox" id="gaCoord" ${GA.coord?"checked":""}>${T("اكتب الإحداثي مع رقم أمر العمل","Show the coordinate with the W/O")}</label>
    <button class="btn sm pri" id="gaKml">${T("تنزيل KML لكل المشاريع","Download KML for all projects")}</button>
    <button class="btn sm" id="gaCsv">${T("CSV لـ My Maps","CSV for My Maps")}</button>
    <a class="btn sm" href="${ge}" target="_blank" rel="noopener">${T("فتح Google Earth ↗","Open Google Earth ↗")}</a>
    <a class="btn sm gh" href="${gm}" target="_blank" rel="noopener">${T("خرائط جوجل ↗","Google Maps ↗")}</a>
  </div>
  <div class="gbody">
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="card"><header><h3>${T("أوامر العمل المُجمّعة","Work orders included")}</h3>
        <span class="sp"></span>
        <button class="btn sm gh" id="gaAll">${T("تحديد الكل","Select all")}</button>
        <button class="btn sm gh" id="gaNone">${T("إلغاء الكل","Clear")}</button></header>
      <div class="body tight scroll"><table class="stbl"><thead><tr>
        <th></th><th>${T("أمر العمل","Work order")}</th><th>${T("المشروع","Project")}</th>
        <th class="n">${T("نقاط","Points")}</th><th class="n">${T("المسار (م)","Route (m)")}</th></tr></thead>
        <tbody>${all.map(g=>`<tr>
          <td><input type="checkbox" data-gsel="${esc(g.id)}" ${GA.sel[g.id]?"checked":""} ${g.n?"":"disabled"} style="width:16px;height:16px"></td>
          <td class="code" style="color:#${g.hex}">${esc(g.wo||"—")}</td>
          <td class="wrap-t">${esc(g.name)}${g.site?`<br><span class="muted" style="font-size:11px">${esc(g.site)}</span>`:""}</td>
          <td class="n">${g.n?nf(g.n):`<span class="muted">${T("بلا إحداثيات","none")}</span>`}</td>
          <td class="n">${g.route?nf(Math.round(g.route)):"—"}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td></td><td>${T("الإجمالي","Total")}</td><td></td><td class="n">${nf(tot)}</td><td class="n">${nf(Math.round(route))}</td></tr></tfoot>
      </table></div></div>

      <div class="card"><header><h3>${T("خطوات الفتح على Google Earth","Opening it in Google Earth")}</h3></header>
      <div class="body"><ol class="gsteps">
        <li><b>${T("نزّل KML المجمّع","Download the combined KML")}</b> — ${T("يحتوي مجلدًا لكل أمر عمل، واسم كل معدة يبدأ برقم أمر العمل ثم الإحداثي.","one folder per work order; every placemark's name starts with the work-order number, then the coordinate.")}</li>
        <li><b>${T("افتح Google Earth Web","Open Google Earth Web")}</b> — ${T("من الزر أعلاه، ثم: مشاريع ← جديد ← استيراد ملف KML.","from the button above, then: Projects → New → Import KML file.")}</li>
        <li><b>${T("أو Google Earth Pro","Or Google Earth Pro")}</b> — ${T("ملف ← فتح ← اختر الملف؛ تظهر كل المشاريع بألوان مختلفة في لوحة واحدة.","File → Open → pick the file; all projects appear in one panel, each in its own colour.")}</li>
        <li><b>${T("أو My Maps","Or My Maps")}</b> — ${T("استخدم ملف CSV لاستيراد النقاط في خرائط جوجل المخصّصة.","use the CSV to import the points into a custom Google map.")}</li>
      </ol></div></div>
    </div>

    <div>
      <div class="gmap" id="gaMap"></div>
      <div class="gleg">${gs.map(g=>`<span><i style="background:#${g.hex}"></i>${esc(g.wo||g.name)} (${nf(g.n)})</span>`).join("")
        ||`<span class="muted">${T("لا توجد نقاط — ارفع ملف ضبط الحماية أو KML في أي مشروع","No points — upload a protection file or KML in any project")}</span>`}</div>
    </div>
  </div>`;
}
async function gaMount(){
  const host=$("gaMap"); if(!host) return;
  const gs=gaSelected();
  if(!gs.length){ host.innerHTML=`<div style="position:absolute;inset:0;display:grid;place-items:center;color:#cfe0db;font-size:13px;text-align:center;padding:22px">${T("لا توجد إحداثيات في المشاريع المحددة","No coordinates in the selected projects")}</div>`; return; }
  if(!STANDALONE){
    host.innerHTML=`<div style="position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#cfe0db;font-size:13px;line-height:1.9">
      ${T("معاينة القمر الصناعي تعمل في نسخة التطبيق على جهازك.<br>هنا نزّل KML المجمّع — الضغط على رمز أي معدة يعرض كل تفاصيلها واسم المقاول.","Satellite preview works in the desktop copy.<br>Here, download the combined KML — clicking any equipment symbol shows its full detail and the contractor name.")}</div>`;
    return;
  }
  try{
    const L=await loadLeaflet(); if(!$("gaMap")) return;
    host.innerHTML=""; const div=document.createElement("div"); div.style.cssText="position:absolute;inset:0"; host.appendChild(div);
    const map=L.map(div,{zoomControl:true, attributionControl:true});
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {maxZoom:20, maxNativeZoom:19, attribution:"Imagery © Esri"}).addTo(map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
      {maxZoom:20, maxNativeZoom:19, opacity:.7}).addTo(map);
    const box=[], reg={};
    gs.forEach(g=>{
      const p=S.projects[g.i]||S.projects.find(z=>z.id===g.id)||P();
      if(g.chain.length>1) L.polyline(g.chain.map(q=>[q.lat,q.lon]),{color:"#"+g.hex,weight:3.5,dashArray:"8 5",opacity:.95}).addTo(map);
      g.pts.forEach(q=>{
        box.push([q.lat,q.lon]);
        const key=g.id+"|"+q.id;
        const m=L.marker([q.lat,q.lon],{icon:mkIcon(L,q,"#"+g.hex,false),riseOnHover:true,title:(g.wo?g.wo+" · ":"")+q.id}).addTo(map);
        m.bindTooltip(`<span class="glab">${esc(gaLabel(g,q))}</span>`,{permanent:true,direction:"right",offset:[13,0],opacity:1,className:"gtt"});
        m.bindPopup(popHTML(uDet(p,q), "#"+g.hex), {maxWidth:340, minWidth:322, autoPan:true, autoPanPadding:[22,30], keepInView:true});
        m.on("popupopen",()=>{ GA.pt=key; mkSync(reg,key); });
        m.on("popupclose",()=>{ if(GA.pt===key){ GA.pt=null; mkSync(reg,null); } });
        reg[key]=m;
      });
    });
    map.fitBounds(L.latLngBounds(box).pad(0.12));
    GA.map=map; GA.reg=reg;
  }catch(e){
    host.innerHTML=`<div style="position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#cfe0db;font-size:13px">${T("تعذّر تحميل صور الأقمار الصناعية — تحقق من الإنترنت.","Could not load satellite imagery — check the connection.")}</div>`;
  }
}
function gaOpen(){
  const w=$("gaWrap"); if(!w) return;
  w.innerHTML=gaHTML(); w.hidden=false; document.body.style.overflow="hidden";
  gaWire(); gaMount();
}
function gaClose(){ const w=$("gaWrap"); if(!w) return; w.hidden=true; w.innerHTML=""; if(GA.map){ try{ GA.map.remove(); }catch(e){} } GA.map=null; document.body.style.overflow=""; }
function gaRefresh(){ const w=$("gaWrap"); if(!w||w.hidden) return; w.innerHTML=gaHTML(); gaWire(); gaMount(); }
function gaWire(){
  const w=$("gaWrap");
  const on=(id,fn)=>{ const el=$(id); if(el) el.onclick=fn; };
  on("gaClose", gaClose);
  on("gaKml", ()=>gaExport("kml", GA.coord));
  on("gaCsv", ()=>gaExport("csv", GA.coord));
  on("gaAll", ()=>{ allProjPts().forEach(g=>{ if(g.n) GA.sel[g.id]=true; }); gaRefresh(); });
  on("gaNone", ()=>{ Object.keys(GA.sel).forEach(k=>GA.sel[k]=false); gaRefresh(); });
  const cc=$("gaCoord"); if(cc) cc.onchange=()=>{ GA.coord=cc.checked; gaRefresh(); };
  w.querySelectorAll("[data-gsel]").forEach(b=>b.onchange=()=>{ GA.sel[b.dataset.gsel]=b.checked; gaRefresh(); });
    const bar=document.querySelector("#gaWrap .gbar");
    if(bar && !$("gaFirms")){
      const d=document.createElement("div"); d.id="gaFirms";
      d.style.cssText="flex:1 1 100%;display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding-top:5px;border-top:1px solid var(--line);margin-top:3px";
      d.innerHTML=`<span class="s" style="font-size:11.5px;color:var(--ink-3)">${T("عرض مشاريع مقاول:","Show one contractor:")}</span>`
        + CONTRACTORS.map((c,i)=>{
            const n=firmProjects(i).filter(o=>geoPoints(o.p).length).length;
            return `<button class="btn sm" data-gfirm="${i}" ${n?"":"disabled"}>
              <i style="width:9px;height:9px;border-radius:3px;background:${fHex(i)};display:inline-block"></i>
              ${esc(c)} (${n})</button>`;
          }).join("")
        + `<button class="btn sm gh" data-gfirm="all">${T("كل المقاولين","All contractors")}</button>`;
      bar.appendChild(d);
      d.querySelectorAll("[data-gfirm]").forEach(b=>b.onclick=()=>{
        const v=b.dataset.gfirm;
        allProjPts().forEach(g=>{
          const fi=+((S.projects[g.i]||{}).contractor)||0;
          GA.sel[g.id] = g.n>0 && (v==="all" || fi===+v);
        });
        gaRefresh();
      });
    }
    /* اسم المقاول تحت اسم كل مشروع في جدول التجميع */
    const all=allProjPts();
    document.querySelectorAll("#gaWrap [data-gsel]").forEach(cb=>{
      const g=all.find(x=>x.id===cb.dataset.gsel), tr=cb.closest("tr");
      const cell=tr && tr.children[2];
      if(g && cell && !cell.querySelector(".gfirm")){
        const fi=+((S.projects[g.i]||{}).contractor)||0;
        cell.insertAdjacentHTML("beforeend",
          `<br><span class="gfirm" style="font-size:10.5px;color:${fHex(fi)};font-weight:600">${esc(CONTRACTORS[fi]||"")}</span>`);
      }
    });
}

/* بطاقة «كل مشاريع الالتزام» في لوحة التحكم (تحت شريط التحديث) */
function gaDashCard(){
  const all=allProjPts(), tot=all.reduce((s,g)=>s+g.n,0), wos=all.filter(g=>g.n).length;
  return `<div class="card" id="gaCard"><header><h3>${T("كل مشاريع الالتزام","All compliance projects")}</h3>
      <span class="sub">${nf(wos)} ${T("أمر عمل بإحداثيات","work orders with coordinates")} · ${nf(tot)} ${T("نقطة","points")}</span>
      <span class="sp"></span>
      <button class="btn sm pri noprint" id="btnGeoAll">⌖ ${T("عرض كل مشاريع الالتزام","Open all compliance projects")}</button></header>
    <div class="body"><div class="note">${T("يجمع إحداثيات كل المشاريع وأوامر العمل في لوحة واحدة: مجلد لكل أمر عمل، واسم كل معدة يبدأ برقم أمر العمل ثم الإحداثي — للفتح في Google Earth أو Google My Maps.",
      "Collects every project's coordinates into one view: a folder per work order, and each placemark's name starts with the work-order number followed by its coordinate — for Google Earth or Google My Maps.")}</div></div></div>`;
}
const gaWO = () => allProjPts().filter(g=>g.n).length;
const gaPts = () => allProjPts().reduce((a,g)=>a+g.n,0);
function ensureGaWrap(){
  if($("gaWrap")) return;
  const d=document.createElement("div");
  d.className="gwrap"; d.id="gaWrap"; d.hidden=true; d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true");
  document.body.appendChild(d);
  document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !$("gaWrap").hidden) gaClose(); });
}
export { GA, allProjPts, gaSelectedIds, gaReset, gaOpen, gaClose, gaRefresh, gaDashCard, gaWO, gaPts, ensureGaWrap };

