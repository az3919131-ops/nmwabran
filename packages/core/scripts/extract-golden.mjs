// يولّد test/golden/*.json بتشغيل المنصة القديمة (reference/legacy.html) داخل jsdom.
// الاختبارات تقارن بها مخرجات packages/core حتى تتطابق الأرقام والنصوص مع المنصة الحالية.
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootLegacy } from "./legacy-env.mjs";
import { SCENARIOS, IDENT_ROWS, IDENT_NAMES } from "../test/fixtures/import-scenarios.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../test/golden");
mkdirSync(OUT, { recursive: true });
const { dom, ev, errors } = bootLegacy();
if (errors.length) console.warn("legacy boot warnings:", errors);
const w = dom.window;
const put = (name, obj) => writeFileSync(path.join(OUT, name + ".json"), JSON.stringify(obj, null, 1));
const J = (code) => JSON.parse(ev(`JSON.stringify((function(){ return ${code} })())`) ?? "null");

ev("AUTH.me='ahmed'; AUTH.lock=false;");

/* 1) الاستنباط — مشروع الحصينية الافتراضي + متغيرات المعاملات */
const strip = (d) => { const o = JSON.parse(JSON.stringify(d)); delete o.at; return o; };
const derive = {};
derive.hassiniya = strip(J("P().derived"));
derive.totals = J("totals(P())");
for (const [k, v] of Object.entries({ wastePct: 5, drumLen: 500, indirectPct: 20, rodsPerRMU: 6, elbowPhases: 2, vlfPerSection: 2 })) {
  derive["factor_" + k] = strip(J(`(function(){ const p=JSON.parse(JSON.stringify(P())); p.factors.${k}=${v}; return derive(p); })()`));
}
derive.blank = strip(J(`derive(newProject("x","1"))`));
derive.authority = [0, 5, 10, 10.01, 19.9, 20, 25, 30, 30.01, 100, -12, -35].map((x) => ({ pct: x, ar: ev(`(S.lang="ar", authorityFor(${x}))`), en: ev(`(S.lang="en", authorityFor(${x}))`) }));
put("derive", derive);

/* 2) إحصاءات: لوحة التحكم، المقاول، العرض */
ev('S.lang="ar"');
const stats = {
  projStats: J("(function(){ const s=projStats(P()); delete s.t; return s; })()"),
  projState: J("(function(){ const s=projState(P()); delete s.t; return s; })()"),
  firmStats: J("firmStats(0)"),
  deckStats: J("(function(){ const s=deckStats(P()); return {planC:s.planC,execC:s.execC,matIss:s.matIss,matReq:s.matReq,ind:s.ind,cur:s.cur,est:s.est,varPct:s.varPct,setDone:s.setDone,highOhm:s.highOhm}; })()"),
  invRows: J("(function(){ const r=invRows(P()); return {works:r.works, mats:r.mats}; })()"),
  geoPoints: J("geoPoints(P()).map(q=>({id:q.id,lat:q.lat,lon:q.lon,E:q.E,N:q.N,zone:q.zone,type:q.type,hasTR:q.hasTR,feeder:q.feeder}))"),
  feeders: J("feeders(geoPoints(P())).map(f=>({name:f.name,len:f.len,n:f.pts.length,color:f.color,idx:f.idx,chain:f.pts.map(q=>q.id),segs:f.pts.map(q=>q.seg)}))"),
  utm: [[17.693713, 44.459428], [24.7136, 46.6753], [-33.9, 18.4]].map(([la, lo]) => ({ la, lo, ...J(`toUTM(${la},${lo})`) })),
  hav: J("hav({lat:17.69,lon:44.45},{lat:17.75,lon:44.5})"),
  utmToLL: J("utmToLL(337000,1956000,38)"),
};
put("stats", stats);

/* 3) صفحات كاملة (ar/en) */
const norm = (h) => String(h).replace(/\s+/g, " ").replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g, "DATE");
const pages = {};
for (const lang of ["ar", "en"]) {
  ev(`S.lang="${lang}"`);
  pages[lang] = {};
  for (const id of ["dash", "firms", "master", "qty", "boq", "wages", "inv", "forms", "map", "recs"]) {
    pages[lang][id] = norm(ev(`(S.page="${id}", VIEWS["${id}"]())`));
  }
  ev("buildDeck()");
  pages[lang].deck = J("DECK.slides.map(s=>({k:s.k,t:s.t||'',h:s.h}))").map((s) => ({ ...s, h: norm(s.h) }));
}
put("pages", pages);

/* 4) ملفات التصدير */
ev('S.lang="ar"');
const clean = (s) => String(s).replace(/"exported":\s*"[^"]*"/g, '"exported":"X"');
put("exports", {
  kml: ev("kmlDoc(P())"),
  csv: ev("csvDoc(P())"),
  geojson: clean(ev("geojsonDoc(P())")),
  dxf: ev("dxfDoc(P())"),
  kmlAll: ev("(GA.sel=null, kmlAllDoc())"),
  csvAll: ev("(GA.sel=null, csvAllDoc())"),
  pmLine: ev("pmLine()"),
});

/* 4b) أوراق تصدير المشروع */
const sh = {};
for (const lang of ["ar", "en"]) { ev(`S.lang="${lang}"`); sh[lang] = J("projectSheets()"); }
put("sheets", sh);

ev('S.lang="ar"');
/* 5) محرك الاستيراد */
const scen = {};
for (const sc of SCENARIOS) {
  ev(`(function(){ const p=newProject("x","234022308"); p.contractor=0; S.projects=[p]; S.active=0; GEOCONF.length=0; })()`);
  const snap = J(`(function(){
    const p=P(); const sheets=${JSON.stringify(sc.sheets)};
    const rec={id:"F1",name:"f.xlsx",ext:"xlsx"};
    const rep=importFile(rec, sheets, true);
    const geo = bookGeo(sheets, "f.xlsx");
    const added = MATERIALS.filter(m=>m.added).map(m=>m.c).concat(WORKS.filter(x=>x.added).map(x=>x.c));
    return {rep: rec.rep, imported: rec.imported, rows: rec.rows, boq:p.boq, mat:p.mat,
      rmus:p.rmus, sheets:p.sheets, derived:!!p.derived, bookGeo: geo, conf: GEOCONF.slice(), added,
      kinds: sheets.map(sh=>sheetKind(sh))};
  })()`);
  scen[sc.name] = snap;
  // تنظيف المكتبة المضافة
  ev(`(function(){ for(let i=MATERIALS.length-1;i>=0;i--) if(MATERIALS[i].added) MATERIALS.splice(i,1); for(let i=WORKS.length-1;i>=0;i--) if(WORKS[i].added) WORKS.splice(i,1); })()`);
}
put("import", scen);

/* 6) هوية أمر العمل */
const ident = { rows: {}, names: {}, text: {}, states: [] };
for (const [k, rows] of Object.entries(IDENT_ROWS)) ident.rows[k] = J(`identityFromRows(${JSON.stringify(rows)})`);
for (const n of IDENT_NAMES) ident.names[n] = J(`identityFromName(${JSON.stringify(n)})`);
const texts = {
  labelled: "أمر العمل: 234022308\nاسم المشروع: مشروع الحصينية\nالموقع: طريق الحصينية نجران\nالقطاع: الجنوبي",
  uds: "رقم الطلب: 234099001\nالموضوع: ثقب أفقي",
  freq: "مشروع 234022308 ... 234022308 ... 234011111",
};
for (const [k, t] of Object.entries(texts)) ident.text[k] = J(`identityFromText(${JSON.stringify(t)})`);
const cases = [
  ["234022308", { wo: "234022308" }], ["234022308", { wo: "234011111" }], ["234022308", { wo: "234099001", woReq: true }],
  ["", { wo: "234011111" }], ["", { wo: "234011111", woReq: true }], ["234022308", { wo: "234011111", woWeak: true }],
  ["234022308", { wo: "234022308", woWeak: true }], ["234022308", {}],
];
for (const [wo, id] of cases) ident.states.push({ wo, id, state: ev(`(function(){ const p=newProject("x",${JSON.stringify(wo)}); return woState(p, ${JSON.stringify(id)}); })()`) });
ident.near = [["الوبران", "شركة ناصر مانع وبران وشركاه"], ["نجران", "إدارة نجران"], ["شرورة", "نجران"]]
  .map(([a, b]) => ({ a, b, r: ev(`near(${JSON.stringify(a)},${JSON.stringify(b)})`) }));
ident.normCode = ["908111005", "08111005", "8111005", "301010201", "abc", "234022308"].map((c) => ({ c, r: ev(`normCode(${JSON.stringify(c)})`) }));
put("identity", ident);

/* 7) التقاط الإحداثيات */
const geo = {
  cellPair: ["17.693713, 44.459428", "N17.693713 E44.459428", "17°41'37.4\"N 44°27'33.9\"E", "44.459428 17.693713", "hello", "5.1 5.2", "1.5,2.5"]
    .map((v) => ({ v, r: J(`cellPair(${JSON.stringify(v)})`) })),
  dms: ["17°41'37.4\"N", "44°27'33.9\"E", "-17 41 37", "abc"].map((v) => ({ v, r: J(`dms(${JSON.stringify(v)})`) })),
  textGeo: J(`textGeo("نقطة 17.693713, 44.459428 وأخرى lat: 17.7 lon: 44.5 و E: 337000 N: 1956000 و 5.12345, 6.12345", "t.txt")`),
  scanText: J(`scanText("R101552 عند 17.693713, 44.459428 والبند 8111005 و 908114005", "t")`),
  readGeo: J(`readGeoText('<kml><Placemark><name>A</name><Point><coordinates>44.45,17.69,0</coordinates></Point></Placemark></kml>', "k.kml")`),
};
put("geo", geo);

console.log("golden written to", OUT);
process.exit(0);
