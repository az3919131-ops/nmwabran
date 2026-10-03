// @ts-nocheck — منقول من المنصة القديمة (reference/legacy.html) للحفاظ على تطابق المخرجات؛ تحرسه اختبارات parity.
import { S, P, T, AR, $, esc, nf, money, toast, copyTable, CONTRACTORS, MATERIALS, WORKS, CAT, AUTH, totals, derive, authorityFor, geoPoints, feeders, projStats, libMat, libWork, can, editable, isAdmin, pmLine, ME, CF, firmProjects, firmStats, fHex, fInitials, STANDALONE, dig, near, toUTM, utmToLL, hav, ACCEPT_COLS, SHEET_FIELDS, DEFAULT_FACTORS, PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ROLES, MODULES, ACTS, initials2 } from "../runtime";
import { render } from "../render";
import { exportGeo } from "../actions/exports";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
const loadLeaflet = async () => L;

const MAPV = {mode:"cad", view:null, sel:null, leaflet:null};

function viewMap(){
  const p=P(), pts=geoPoints(p), fs=feeders(pts), t=totals(p);
  const routeLen = fs.filter(f=>!f.noRoute).reduce((s,f)=>s+f.len,0);
  const zone = pts[0]?pts[0].zone:38;
  const ratio = routeLen? t.htCable/routeLen : 0;
  if(MAPV.sel && !pts.find(q=>q.id===MAPV.sel)) MAPV.sel=null;
  const sel = pts.find(q=>q.id===MAPV.sel);
  return `
  <div class="sec-title"><span class="eyebrow">${T("الصفحة الخامسة","Page five")}</span>
    <h2>${T("الخريطة والإحداثيات","Map & coordinates")}</h2>
    <span class="s">${T("كل نقاط الكروكي على خريطة بإحداثيات حقيقية — تصدير إلى Google Earth وأوتوكاد","Every layout point on a real-coordinate map — export to Google Earth and AutoCAD")}</span></div>

  <div class="grid g4">
    <div class="stat hero"><span class="k">${T("نقاط بإحداثيات","Geo-referenced points")}</span><span class="v">${nf(pts.length)}</span>
      <span class="d">${T("من","of")} ${nf(p.rmus.length)} ${T("وحدة في جدول الحماية","units in the protection table")}</span></div>
    ${fs.filter(f=>!f.noRoute).slice(0,2).map(f=>`<div class="stat"><span class="k">${T("مسار المغذي","Feeder route")} ${esc(f.name)}</span>
      <span class="v">${nf(f.len)} ${T("م","m")}</span><span class="d">${nf(f.pts.length)} ${T("نقطة · خط مستقيم بين الوحدات","points · straight line between units")}</span></div>`).join("")}
    <div class="stat"><span class="k">${T("كابل الحصر ÷ طول المسار","Takeoff cable ÷ route length")}</span>
      <span class="v ${ratio>1.6||ratio<1.05?"delta up":""}">${ratio?nf(ratio,2)+"×":"—"}</span>
      <span class="d">${nf(t.htCable)} ${T("م كابل 3×400 مقابل","m of 3×400 vs")} ${nf(routeLen)} ${T("م مسار","m route")}</span></div>
  </div>

  <div class="card"><header>
    <h3>${T("فتح وتصدير","Open & export")}</h3><span class="sub">${T("نظام الإحداثيات: WGS84 · UTM المنطقة","Datum: WGS84 · UTM zone")} ${zone}N</span><span class="sp"></span>
    <button class="btn pri sm" id="gKml">${T("فتح في Google Earth (KML)","Open in Google Earth (KML)")}</button>
    <button class="btn sm" id="gDxf">${T("تحويل إلى CAD (DXF)","Convert to CAD (DXF)")}</button>
    <button class="btn sm" id="gCsv">${T("CSV لـ Google My Maps","CSV for Google My Maps")}</button>
    <button class="btn sm gh" id="gGeo">GeoJSON</button>
    <button class="btn sm gh" id="gSvg">${T("المخطط SVG","Drawing SVG")}</button>
  </header>
  <div class="body">
    <div class="linkrow">${fs.filter(f=>!f.noRoute).map(f=>{
      const chunks=[]; for(let i=0;i<f.pts.length;i+=9) chunks.push(f.pts.slice(Math.max(0,i-(i?1:0)), i+9));
      return chunks.map((c,ci)=>`<a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/${c.map(q=>q.lat+","+q.lon).join("/")}">
        ${T("مسار","Route")} ${esc(f.name)}${chunks.length>1?` · ${ci+1}/${chunks.length}`:""} ↗</a>`).join("");
    }).join("")}
    ${pts.length?`<a class="btn sm gh" target="_blank" rel="noopener" href="https://earth.google.com/web/search/${pts[Math.floor(pts.length/2)].lat},${pts[Math.floor(pts.length/2)].lon}">Google Earth ${T("على منتصف المشروع","at project centre")} ↗</a>`:""}
    </div>
  </div></div>

  <div class="mapwrap">
    <div class="cad" id="cad">
      <div class="cad-bar">
        <button class="btn sm" id="vCad" aria-pressed="${MAPV.mode==="cad"}">${T("مخطط CAD","CAD plan")}</button>
        <button class="btn sm" id="vSat" aria-pressed="${MAPV.mode==="sat"}">${T("قمر صناعي","Satellite")}</button>
        <button class="btn sm" id="vFit">${T("ملاءمة","Fit")}</button>
        <button class="btn sm" id="vIn">+</button><button class="btn sm" id="vOut">−</button>
      </div>
      <div id="sat" ${MAPV.mode==="sat"?"":"hidden"}></div>
      <svg id="cadSvg" role="img" aria-label="CAD plan" ${MAPV.mode==="sat"?"hidden":""}></svg>
      <div class="cad-legend" id="cadLeg">
        ${fs.map(f=>`<span><i style="background:${f.color}"></i>${esc(f.name)} · ${f.noRoute?nf(f.pts.length)+" pt":nf(f.len)+" m"}</span>`).join("")}
        <span>○ RMU 3W &nbsp; □ RMU 4W &nbsp; ▲ TR</span>
      </div>
      <div class="cad-coord" id="cadCoord">UTM ${zone}N</div>
      <div class="cad-tip" id="cadTip" hidden></div>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;min-width:0">
      <div class="card"><header><h3>${T("النقطة المحددة","Selected point")}</h3></header>
        <div class="body sel-card" id="selCard">${selCardHTML(sel)}</div></div>
      <div class="card"><header><h3>${T("جدول الإحداثيات","Coordinate schedule")}</h3><span class="sp"></span>
        <button class="btn sm gh noprint" id="copyGeo">${T("نسخ للإكسل","Copy to Excel")}</button></header>
        <div class="body tight scroll" style="max-height:470px;overflow-y:auto"><table id="tblGeo"><thead><tr>
          <th>${T("الوحدة","Unit")}</th><th>${T("المغذي","Feeder")}</th><th>${T("النوع","Type")}</th>
          <th class="n">Lat</th><th class="n">Lon</th><th class="n">E (m)</th><th class="n">N (m)</th><th class="n">${T("من السابقة","From prev.")}</th></tr></thead>
          <tbody>${fs.map(f=>f.pts.map(q=>`<tr data-pt="${esc(q.id)}" class="${q.id===MAPV.sel?"on":""}" style="cursor:pointer">
            <td class="code">${esc(q.id)}</td><td><span class="pill" style="background:${f.color}33;color:var(--ink)">${esc(f.name)}</span></td>
            <td>${esc(q.type)}${q.hasTR?" + TR":""}</td>
            <td class="n">${q.lat.toFixed(6)}</td><td class="n">${q.lon.toFixed(6)}</td>
            <td class="n">${nf(q.E,2)}</td><td class="n">${nf(q.N,2)}</td>
            <td class="n">${q.seg?nf(q.seg)+" m":"—"}</td></tr>`).join("")).join("")}
          </tbody></table></div></div>
    </div>
  </div>

  <div class="guide">
    <div class="g"><h4>${T("عرض كل النقاط في Google Earth","All points in Google Earth")}</h4><ol>
      <li>${T("اضغط «فتح في Google Earth (KML)»","Press “Open in Google Earth (KML)”")}</li>
      <li>${T("في Google Earth على الويب: مشاريع ← فتح ← استيراد ملف KML","Google Earth web: Projects → Open → Import KML file")}</li>
      <li>${T("أو افتح الملف مباشرة في Google Earth Pro","Or open it directly in Google Earth Pro")}</li></ol></div>
    <div class="g"><h4>${T("عرضها على Google Maps","Show them on Google Maps")}</h4><ol>
      <li>${T("افتح mymaps.google.com ← إنشاء خريطة","Open mymaps.google.com → Create map")}</li>
      <li>${T("استيراد ← اختر ملف KML أو CSV","Import → choose the KML or CSV file")}</li>
      <li>${T("الأعمدة Latitude و Longitude تُحدد الموقع، و Name للتسمية","Latitude & Longitude set position, Name labels it")}</li></ol></div>
    <div class="g"><h4>${T("فتح المخطط في أوتوكاد","Open the plan in AutoCAD")}</h4><ol>
      <li>${T("اضغط «تحويل إلى CAD (DXF)»","Press “Convert to CAD (DXF)”")}</li>
      <li>${T("الوحدة بالمتر، والإحداثيات UTM حقيقية — تطابق أي رفع مساحي","Units are metres with true UTM coordinates — matches any survey")}</li>
      <li>${T("طبقات منفصلة: RMU، محولات، كل مغذي، نصوص، شبكة","Separate layers: RMU, TR, each feeder, text, grid")}</li></ol></div>
  </div>
  <div class="note">${T("المسار المرسوم خط مستقيم بين الوحدات المتتالية على كل مغذي لتوضيح التسلسل، وليس مسار الحفر الفعلي. نسبة «كابل الحصر ÷ طول المسار» الطبيعية بين 1.1 و 1.5 بسبب انحناءات الطريق والصواعد والاحتياطي عند النهايات؛ خارج هذا المدى راجع الحصر.","The drawn route is a straight line between consecutive units on each feeder to show sequence — not the actual trench path. A normal “takeoff cable ÷ route length” ratio is 1.1–1.5 (road bends, risers, termination slack); outside that range, review the takeoff.")}</div>`;
}

function drawCad(){
  const svg=$("cadSvg"); if(!svg) return;
  const p=P(), pts=geoPoints(p), fs=feeders(pts);
  if(!pts.length){ svg.innerHTML=`<text x="50%" y="50%" fill="#8aa" text-anchor="middle" font-size="14">No coordinates in the protection table</text>`; svg.setAttribute("viewBox","0 0 400 300"); return; }
  const minE=Math.min(...pts.map(q=>q.E)), maxE=Math.max(...pts.map(q=>q.E));
  const minN=Math.min(...pts.map(q=>q.N)), maxN=Math.max(...pts.map(q=>q.N));
  const box=svg.getBoundingClientRect(), ar=(box.width||600)/(box.height||680);
  if(!MAPV.view || MAPV.view.key!==p.id){
    const w=(maxE-minE)||500, h=(maxN-minN)||500;
    let spanH=h*1.26, spanW=w*1.6;
    if(spanW/spanH<ar) spanW=spanH*ar; else spanH=spanW/ar;
    MAPV.view={key:p.id, cx:(minE+maxE)/2, cy:(minN+maxN)/2, w:spanW, h:spanH, fit:{cx:(minE+maxE)/2, cy:(minN+maxN)/2, w:spanW, h:spanH}};
  }
  const v=MAPV.view; v.h=v.w/ar;
  const X=E=>E, Y=N=>-N;                              // SVG y down → negate N
  const vx=v.cx-v.w/2, vy=-(v.cy+v.h/2);
  svg.setAttribute("viewBox",`${vx} ${vy} ${v.w} ${v.h}`);
  const px=v.w/(box.width||600);                     // metres per screen pixel
  const step=[25,50,100,200,250,500,1000,2000,5000].find(s=>s/px>=90)||5000;
  let g=`<rect x="${vx}" y="${vy}" width="${v.w}" height="${v.h}" fill="#0d171b"/>`;
  // grid
  const e0=Math.floor((v.cx-v.w/2)/step)*step, e1=v.cx+v.w/2, n0=Math.floor((v.cy-v.h/2)/step)*step, n1=v.cy+v.h/2;
  for(let e=e0;e<=e1;e+=step) g+=`<line x1="${e}" y1="${vy}" x2="${e}" y2="${vy+v.h}" stroke="#1d2e33" stroke-width="${px}"/>
      <text x="${e+3*px}" y="${vy+v.h-8*px}" fill="#5f7d80" font-size="${10*px}" font-family="ui-monospace,Consolas,monospace">E ${Math.round(e)}</text>`;
  for(let n=n0;n<=n1;n+=step) g+=`<line x1="${vx}" y1="${Y(n)}" x2="${vx+v.w}" y2="${Y(n)}" stroke="#1d2e33" stroke-width="${px}"/>
      <text x="${vx+6*px}" y="${Y(n)-3*px}" fill="#5f7d80" font-size="${10*px}" font-family="ui-monospace,Consolas,monospace">N ${Math.round(n)}</text>`;
  // routes
  fs.forEach(f=>{
    if(f.noRoute) return;
    g+=`<polyline points="${f.pts.map(q=>X(q.E)+","+Y(q.N)).join(" ")}" fill="none" stroke="${f.color}" stroke-width="${3*px}" stroke-linejoin="round" stroke-dasharray="${9*px} ${4*px}" opacity=".9"/>`;
  });
  // symbols + labels (feeder 1 labels to the east, feeder 2 to the west)
  const r=6*px;
  fs.forEach(f=>{
    const side = f.idx%2===0 ? 1 : -1;
    f.pts.forEach(q=>{
      const x=X(q.E), y=Y(q.N), on=q.id===MAPV.sel;
      const stroke=on?"#ffffff":f.color, sw=(on?2.6:1.6)*px;
      g+= q.type==="3W"
        ? `<circle cx="${x}" cy="${y}" r="${r}" fill="#0d171b" stroke="${stroke}" stroke-width="${sw}" data-pt="${esc(q.id)}"/>`
        : `<rect x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" fill="#0d171b" stroke="${stroke}" stroke-width="${sw}" data-pt="${esc(q.id)}"/>`;
      if(q.hasTR) g+=`<path d="M${x+side*(r+9*px)} ${y-5*px} l${5*px} ${9*px} l${-10*px} 0 z" fill="#e58076" pointer-events="none"/>`;
      g+=`<text x="${x+side*(r+(q.hasTR?20:6)*px)}" y="${y+4*px}" fill="${on?"#ffffff":"#cfe0db"}" font-size="${(on?12:10.5)*px}" font-weight="${on?700:400}"
          text-anchor="${side>0?"start":"end"}" font-family="ui-monospace,Consolas,monospace" pointer-events="none">${esc(q.id)}</text>`;
      g+=`<circle cx="${x}" cy="${y}" r="${r*2.2}" fill="transparent" data-pt="${esc(q.id)}" style="cursor:pointer"/>`;
    });
  });
  // north arrow + scale bar (screen-anchored)
  const nx=vx+v.w-34*px, ny=vy+60*px;
  g+=`<path d="M${nx} ${ny-22*px} l${9*px} ${24*px} l${-9*px} ${-6*px} l${-9*px} ${6*px} z" fill="#cfe0db"/>
      <text x="${nx}" y="${ny-28*px}" fill="#cfe0db" font-size="${12*px}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace">N</text>`;
  const sb=step, sx=vx+v.w-(sb/px+30)*px, sy=vy+v.h-44*px;
  g+=`<rect x="${sx}" y="${sy}" width="${sb/2}" height="${5*px}" fill="#cfe0db"/><rect x="${sx+sb/2}" y="${sy}" width="${sb/2}" height="${5*px}" fill="none" stroke="#cfe0db" stroke-width="${px}"/>
      <text x="${sx}" y="${sy-5*px}" fill="#cfe0db" font-size="${10*px}" font-family="ui-monospace,Consolas,monospace">0</text>
      <text x="${sx+sb}" y="${sy-5*px}" fill="#cfe0db" font-size="${10*px}" text-anchor="end" font-family="ui-monospace,Consolas,monospace">${sb} m</text>`;
  svg.innerHTML=g;
}

function svgToWorld(ev){
  const svg=$("cadSvg"), b=svg.getBoundingClientRect(), v=MAPV.view;
  const fx=(ev.clientX-b.left)/b.width, fy=(ev.clientY-b.top)/b.height;
  return {E: v.cx-v.w/2+fx*v.w, N: v.cy+v.h/2-fy*v.h};
}

function wireMap(){
  const svg=$("cadSvg"); if(!svg) return;
  const p=P(), pts=geoPoints(p), zone=pts[0]?pts[0].zone:38;
  drawCad();
  const tip=$("cadTip"), coord=$("cadCoord");
  let drag=null;
  svg.onpointerdown=e=>{ drag={x:e.clientX,y:e.clientY,cx:MAPV.view.cx,cy:MAPV.view.cy,moved:false}; svg.setPointerCapture(e.pointerId); svg.classList.add("drag"); };
  svg.onpointermove=e=>{
    const w=svgToWorld(e), ll=utmToLL(w.E,w.N,zone);
    coord.textContent=`E ${w.E.toFixed(1)}  N ${w.N.toFixed(1)}  ·  ${ll.lat.toFixed(6)}, ${ll.lon.toFixed(6)}`;
    if(drag){
      const b=svg.getBoundingClientRect(), dx=(e.clientX-drag.x)/b.width*MAPV.view.w, dy=(e.clientY-drag.y)/b.height*MAPV.view.h;
      if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>3) drag.moved=true;
      MAPV.view.cx=drag.cx-dx; MAPV.view.cy=drag.cy+dy; drawCad(); tip.hidden=true; return;
    }
    const id=e.target.getAttribute && e.target.getAttribute("data-pt"), q=id&&pts.find(x=>x.id===id);
    if(q){
      const b=$("cad").getBoundingClientRect();
      tip.innerHTML=`<b>${esc(q.id)}</b> · ${esc(q.feeder)} · ${esc(q.type)}${q.hasTR?" + TR":""}<br>${q.lat.toFixed(6)}, ${q.lon.toFixed(6)}<br>E ${q.E.toFixed(2)}  N ${q.N.toFixed(2)}`;
      tip.style.left=(e.clientX-b.left+14)+"px"; tip.style.top=(e.clientY-b.top+14)+"px"; tip.hidden=false;
    } else tip.hidden=true;
  };
  svg.onpointerup=e=>{
    svg.classList.remove("drag");
    const wasDrag=drag&&drag.moved; drag=null;
    if(wasDrag) return;
    const id=e.target.getAttribute && e.target.getAttribute("data-pt");
    if(id){ selectPt(id); }
  };
  svg.onpointerleave=()=>{ tip.hidden=true; };
  svg.onwheel=e=>{
    e.preventDefault();
    const w=svgToWorld(e), k=e.deltaY>0?1.2:1/1.2, v=MAPV.view;
    v.cx=w.E+(v.cx-w.E)*k; v.cy=w.N+(v.cy-w.N)*k; v.w*=k; v.h*=k; drawCad();
  };
  const zoom=k=>{ const v=MAPV.view; v.w*=k; v.h*=k; drawCad(); };
  $("vIn").onclick=()=>zoom(1/1.4); $("vOut").onclick=()=>zoom(1.4);
  $("vFit").onclick=()=>{ const f=MAPV.view.fit; Object.assign(MAPV.view,{cx:f.cx,cy:f.cy,w:f.w,h:f.h}); drawCad(); if(MAPV.leaflet) fitSat(); };
  $("vCad").onclick=()=>{ MAPV.mode="cad"; render(); };
  $("vSat").onclick=()=>{ MAPV.mode="sat"; render(); };
  document.querySelectorAll("#tblGeo tr[data-pt]").forEach(tr=>tr.onclick=()=>selectPt(tr.dataset.pt, true));
  $("copyGeo").onclick=()=>copyTable("#tblGeo");
  $("gKml").onclick=()=>exportGeo("kml"); $("gDxf").onclick=()=>exportGeo("dxf");
  $("gCsv").onclick=()=>exportGeo("csv"); $("gGeo").onclick=()=>exportGeo("geojson"); $("gSvg").onclick=()=>exportGeo("svg");
  if(MAPV.mode==="sat") mountSat();
}

function fitSat(){
  const pts=geoPoints(P()); if(!pts.length||!MAPV.leaflet) return;
  MAPV.leaflet.map.fitBounds(pts.map(q=>[q.lat,q.lon]), {padding:[40,40]});
}

function mkKind(q){ return q.extra ? "kp" : (q.hasTR ? "kt" : (q.type==="4W" ? "k4" : "k3")); }

function mkGlyphTxt(q){ return q.extra?"◇":(q.hasTR?"◆":(q.type==="4W"?"■":"●")); }

function uDet(p,q){
  const con = (typeof CONTRACTORS!=="undefined" && CONTRACTORS[p.contractor]) || CONTRACTORS[0] || "";
  return {
    wo:String(p.wo||"").trim(), proj:p.name||"", site:p.site||"",
    admin:p.admin||"", sector:p.sector||"", contractor:con,
    unit:q.id, type:q.type||"", tr:q.hasTR?(q.tr||"TR"):"", feeder:q.feeder||"",
    relay:q.relay||"", model:q.model||"", set:!!q.set, ratio:q.ratio||"", ohm:q.ohm||"",
    lat:q.lat, lon:q.lon, E:q.E, N:q.N, zone:q.zone, seg:+q.seg||0,
    extra:!!q.extra, src:q.src||""
  };
}

function detRows(d){
  const R=[], add=(k,v,m)=>{ if(v===null||v===undefined||v==="") return; R.push([k,v,!!m]); };
  add(T("أمر العمل","Work order"), d.wo||"—", true);
  add(T("المشروع","Project"), d.proj||"—");
  add(T("المقاول","Contractor"), d.contractor||"—");
  add(T("الموقع","Site"), d.site);
  add(T("الإدارة / القطاع","Admin / Sector"), [d.admin,d.sector].filter(Boolean).join(" · "));
  add(T("المغذي","Feeder"), d.feeder||"—");
  add(T("نوع الوحدة","Unit type"), d.extra ? T("نقطة إحداثي مستوردة","Imported geo point")
      : ("RMU "+(d.type||"—")) + (d.tr ? " + "+d.tr : ""));
  if(!d.extra){
    add(T("المحول","Transformer"), d.tr || T("بدون","none"));
    add(T("الريلاي","Relay"), [d.relay,d.model].filter(v=>v&&v!=="—").join(" · ")||"—");
    add(T("نسبة CT","CT ratio"), d.ratio||"—", true);
    add(T("مقاومة التأريض","Earth resistance"), d.ohm!==""?(d.ohm+" Ω"):"—", true);
  }
  if(d.extra && d.src) add(T("مصدر الإحداثي","Coordinate source"), d.src);
  add("WGS84 (Lat, Lon)", d.lat.toFixed(6)+", "+d.lon.toFixed(6), true);
  add("UTM "+d.zone+"N", "E "+nf(d.E,2)+" · N "+nf(d.N,2), true);
  if(d.seg) add(T("من الوحدة السابقة","From previous unit"), nf(Math.round(d.seg))+" m", true);
  return R;
}

const setBadge = d => d.extra ? "" :
  (d.set ? `<span class="bg ok">${T("الضبط مكتمل","Setting done")}</span>`
         : `<span class="bg wr">${T("بانتظار الضبط","Setting pending")}</span>`);

function popHTML(d, hex){
  const rows = detRows(d).map(([k,v,m])=>`<tr><th>${esc(k)}</th><td class="${m?"m":""}">${esc(v)}</td></tr>`).join("");
  const kind = d.extra ? T("نقطة","Point") : ("RMU "+(d.type||""));
  return `<div class="secpop" dir="${AR()?"rtl":"ltr"}" style="--mc:${hex}">
    <div class="hd"><div class="u">${esc(d.unit)}<span class="k">${esc(kind)}</span></div>
      <div class="c">${esc(d.contractor||"—")}</div></div>
    <div class="bd">
      ${setBadge(d)?`<div style="margin-bottom:7px">${setBadge(d)}</div>`:""}
      <table>${rows}</table>
      <div class="lk">
        <a href="https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lon}" target="_blank" rel="noopener">Google Maps ↗</a>
        <a href="https://earth.google.com/web/search/${d.lat},${d.lon}" target="_blank" rel="noopener">Earth ↗</a>
        <a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${d.lat},${d.lon}" target="_blank" rel="noopener">Street View ↗</a>
        <button type="button" onclick="secCopyPt('${d.lat}','${d.lon}','${esc(d.unit).replace(/'/g,"")}')">${T("نسخ الإحداثي","Copy coord.")}</button>
      </div>
      <div class="ft">${esc(T("الشركة السعودية للكهرباء — تحويل شبكة هوائية إلى أرضية","Saudi Electricity Company — overhead to underground conversion"))}</div>
    </div></div>`;
}

function secCopyPt(lat,lon,id){
  const t=`${id}\t${lat}\t${lon}`;
  if(navigator.clipboard) navigator.clipboard.writeText(t).then(
    ()=>toast(T("تم نسخ إحداثي ","Copied coordinate ")+id), ()=>toast(T("تعذّر النسخ","Copy failed")));
}

function mkIcon(L,q,hex,on){
  return L.divIcon({className:"", iconSize:[24,24], iconAnchor:[12,12], popupAnchor:[0,-12],
    html:`<div class="secmk ${mkKind(q)}${on?" on":""}" style="--mc:${hex}" title="${esc(q.id)}">
      <span class="pg"></span><span class="sh"></span>${q.hasTR?'<span class="tr"></span>':""}</div>`});
}

function mkSync(reg,id){
  if(!reg) return;
  Object.keys(reg).forEach(k=>{
    const el=reg[k] && reg[k]._icon && reg[k]._icon.querySelector(".secmk");
    if(el) el.classList.toggle("on", k===id);
  });
}

async function mountSat(){
  const host=$("sat");
  if(!STANDALONE){
    host.innerHTML=`<div style="position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#cfe0db;font-size:13px;line-height:1.8">
      ${T("صور الأقمار الصناعية تعمل في نسخة التطبيق على جهازك.<br>هنا استخدم «فتح في Google Earth (KML)» — البالون بداخله كل تفاصيل المعدة واسم المقاول.","Satellite imagery works in the desktop copy of the app.<br>Here use “Open in Google Earth (KML)” — each balloon carries the full equipment detail and the contractor name.")}</div>`;
    return;
  }
  try{
    const L=await loadLeaflet();
    if(!$("sat")) return;
    host.innerHTML=""; const div=document.createElement("div"); div.style.cssText="position:absolute;inset:0"; host.appendChild(div);
    const map=L.map(div,{zoomControl:false,attributionControl:true});
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {maxZoom:20, maxNativeZoom:19, attribution:"Imagery © Esri"}).addTo(map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",{maxZoom:20,maxNativeZoom:19,opacity:.7}).addTo(map);
    const p=P(), pts=geoPoints(p), fs=feeders(pts), reg={};
    fs.forEach(f=>{
      if(!f.noRoute) L.polyline(f.pts.map(q=>[q.lat,q.lon]),{color:f.color,weight:4,dashArray:"8 5",opacity:.95}).addTo(map);
      f.pts.forEach(q=>{
        const m=L.marker([q.lat,q.lon],{icon:mkIcon(L,q,f.color,q.id===MAPV.sel),riseOnHover:true,
          keyboard:true, title:q.id}).addTo(map);
        m.bindTooltip(`${q.id}${q.hasTR?" + TR":""}`,{direction:f.idx%2?"left":"right",offset:[f.idx%2?-13:13,0],opacity:.92});
        m.bindPopup(popHTML(uDet(p,q), f.color), {maxWidth:340, minWidth:322, autoPan:true, autoPanPadding:[22,30], keepInView:true, closeButton:true});
        m.on("click",()=>{ selectPt(q.id); });
        reg[q.id]=m;
      });
    });
    MAPV.leaflet={map, reg}; fitSat(); mkSync(reg, MAPV.sel);
  }catch(e){
    host.innerHTML=`<div style="position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#cfe0db;font-size:13px">
      ${T("تعذّر تحميل صور الأقمار الصناعية — تأكد من اتصال الإنترنت ثم اضغط «قمر صناعي» مرة أخرى.","Could not load satellite imagery — check the internet connection and press “Satellite” again.")}</div>`;
  }
}

function selectPt(id, center){
  MAPV.sel=id;
  const p=P(), q=geoPoints(p).find(x=>x.id===id);
  if(center && q && MAPV.view){ MAPV.view.cx=q.E; MAPV.view.cy=q.N; if(MAPV.view.w>MAPV.view.fit.w/3){ MAPV.view.w=MAPV.view.fit.w/3; } }
  const sc=$("selCard"); if(sc) sc.innerHTML=selCardHTML(q);
  document.querySelectorAll("#tblGeo tr[data-pt]").forEach(tr=>tr.classList.toggle("on", tr.dataset.pt===id));
  const row=document.querySelector(`#tblGeo tr[data-pt="${CSS.escape(id)}"]`); if(row && !center) row.scrollIntoView({block:"nearest"});
  drawCad();
  if(MAPV.leaflet){
    mkSync(MAPV.leaflet.reg, id);
    const m=MAPV.leaflet.reg && MAPV.leaflet.reg[id];
    if(q){ MAPV.leaflet.map.setView([q.lat,q.lon], Math.max(MAPV.leaflet.map.getZoom(),17)); }
    if(m && !m.isPopupOpen()) m.openPopup();
  }
}

function selCardHTML(q){
  if(!q) return `<p class="muted" style="font-size:12.5px">${T("اضغط أي نقطة على المخطط أو رمز المعدة على الخريطة لعرض كل تفاصيلها.","Click any point on the plan, or an equipment symbol on the map, to see its full detail.")}</p>`;
  const p=P(), d=uDet(p,q);
  const rows=detRows(d).map(([k,v,m])=>`<dt>${esc(k)}</dt><dd class="${m?"num":""}">${esc(v)}</dd>`).join("");
  return `<div class="rowflex"><span class="pill acc">${esc(q.id)}</span><span class="pill">${esc(q.feeder)}</span>
      <span class="pill">${q.extra?T("نقطة","Point"):"RMU "+esc(q.type)}${q.hasTR?" + "+esc(q.tr):""}</span>
      ${q.extra?"":(q.set?`<span class="pill ok">${T("مضبوطة","Set")}</span>`:`<span class="pill warn">${T("بدون ضبط","Not set")}</span>`)}</div>
    <dl class="kv">${rows}</dl>
    <div class="linkrow">
      <a class="btn sm pri" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${q.lat},${q.lon}">Google Maps ↗</a>
      <a class="btn sm" target="_blank" rel="noopener" href="https://earth.google.com/web/search/${q.lat},${q.lon}">Google Earth ↗</a>
      <a class="btn sm gh" target="_blank" rel="noopener" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${q.lat},${q.lon}">Street View ↗</a>
    </div>
    <div class="cw">${T("المقاول","Contractor")}: <b>${esc(d.contractor||"—")}</b>${d.wo?` · ${T("أمر العمل","W/O")} <b>${esc(d.wo)}</b>`:""}</div>`;
}

export { MAPV, viewMap, wireMap, drawCad, selectPt, secCopyPt, mkIcon, mkSync, popHTML, uDet };
