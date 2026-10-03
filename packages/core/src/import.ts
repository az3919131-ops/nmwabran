import { SHEET_FIELDS } from "./catalog";
import { derive, totals } from "./derive";
import { geoPoints, setUnitGps, utmToLL, type GeoConflict } from "./geo";
import { fillIdent, isMatCode, isWorkCode, libMat, libWork, nz, normCode, woState } from "./identity";
import { blankSheet } from "./model";
import type { Catalog, Ctx, FileRec, Identity, Material, Project, Rep, RmuRow, Sheet, Work } from "./types";

export type Row = unknown[];
export interface SheetData { name: string; rows: Row[] }

/** سياق الاستيراد: المشروع + المكتبة (تُوسَّع بالبنود الجديدة) + ترجمة + تعارضات الإحداثيات */
export interface ImportEnv { p: Project; cat: Catalog; T: Ctx["T"]; conflicts: GeoConflict[]; guard: boolean }

export const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ""));
  return isFinite(n) ? n : null;
};
/** ترويسة مركّبة: تُدمج حتى 3 صفوف فوق أول صف بيانات */
export function composite(rows: Row[], firstData: number): string[] {
  const h: string[] = [];
  for (let r = Math.max(0, firstData - 3); r < firstData; r++) {
    (rows[r] || []).forEach((c, i) => { const v = String(c || "").trim(); if (v) h[i] = (h[i] ? h[i] + " " : "") + v; });
  }
  return h;
}
export function findCol(hdr: string[], ...pats: (string | RegExp)[]): number {
  for (let i = 0; i < hdr.length; i++) {
    const h = nz(hdr[i]); if (!h) continue;
    if (pats.some((p) => (p instanceof RegExp ? p.test(h) : h.includes(nz(p))))) return i;
  }
  return -1;
}
/** أكثر عمود يحتوي قيمًا تحقق الشرط */
export function bestCol(rows: Row[], test: (c: unknown) => boolean, min?: number): { col: number; count: number } {
  const cnt: Record<number, number> = {}; let w = 0;
  rows.forEach((r) => r.forEach((c, i) => { if (test(c)) { cnt[i] = (cnt[i] || 0) + 1; w = Math.max(w, cnt[i]); } }));
  if (w < (min || 3)) return { col: -1, count: w };
  const col = +Object.keys(cnt).find((k) => cnt[+k] === w)!;
  return { col, count: w };
}
export const isUnitId = (v: unknown) => /^R\s?-?\d{3,7}$/i.test(String(v == null ? "" : v).trim());
/** ترويسة عمود الوحدات — لا تُقبل «الوحدة» وحدها لأنها وحدة القياس في المقايسات */
const UNIT_HDR = /(rmu|ring\s?main|switch\s?gear|unit\s*(no|id|name|number)|رقم\s*الوحده|اسم\s*الوحده|رقم\s*المحطه|اسم\s*المحطه|وحده\s*حلقيه|رقم\s*الحلقه|رقم\s*المفتاح|الوحدات)/i;
const PROT_HINT = /(relay|setting|ground|ohm|feeder|ct ?ratio|gps|lat|المغذي|التاريض|التأريض|الحمايه|الاستلام|احداث|الاحداثيات|محول|كابل)/i;
export const unitIdAt = (v: unknown, strict: boolean): string => {
  const s = String(v == null ? "" : v).trim();
  if (strict) return isUnitId(s) ? s.replace(/\s+/g, "").toUpperCase() : "";
  if (!s || s.length > 20 || !/\d/.test(s)) return "";
  if (/[.,]/.test(s) && /^\d+[.,]\d+$/.test(s)) return ""; // كسور = كميات لا أرقام وحدات
  const id = s.replace(/\s+/g, "").toUpperCase();
  if (/^\d+$/.test(id)) return id.length >= 4 ? "R" + id : "RMU-" + id; // 017550 → R017550 · 7 → RMU-7
  return id;
};
export function unitCol(rows: Row[]): { col: number; strict: boolean; hdr: number; n: number } {
  const st = bestCol(rows, isUnitId);
  const strict = st.col >= 0 ? { col: st.col, strict: true, hdr: -1, n: st.count } : null;
  let flex: { col: number; strict: boolean; hdr: number; n: number } | null = null;
  const txt = rows.slice(0, 60).flat().map((c) => nz(c)).join(" ");
  if (PROT_HINT.test(txt)) {
    for (let r = 0; r < Math.min(14, rows.length); r++) {
      const row = rows[r] || [];
      for (let i = 0; i < row.length; i++) {
        if (!UNIT_HDR.test(nz(row[i])) || /\d/.test(String(row[i]))) continue; // الترويسة نص بلا أرقام
        const vals = new Set<string>();
        for (let k = r + 1; k < rows.length; k++) {
          const id = unitIdAt((rows[k] || [])[i], false);
          if (id) vals.add(id);
        }
        if (vals.size >= 3 && (!flex || vals.size > flex.n)) flex = { col: i, strict: false, hdr: r, n: vals.size };
      }
    }
  }
  if (strict && flex) return flex.n > strict.n ? flex : strict;
  return strict || flex || { col: -1, strict: false, hdr: -1, n: 0 };
}
export const codeOf = (v: unknown, wo: string): string => {
  const k = normCode(v); if (k === normCode(wo)) return "";
  return isMatCode(k) || isWorkCode(k) ? k : "";
};
export const TALLY_LABELS: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  SHEET_FIELDS.forEach((g) => g.f.forEach((f) => { m[nz(f[1])] = f[0]; m[nz(f[2])] = f[0]; }));
  return m;
})();

/** تعرّف على نوع الورقة */
export function sheetKind(sh: SheetData, wo: string): "units" | "tally" | "codes" | null {
  const rows = sh.rows; if (!rows.length) return null;
  if (unitCol(rows).col >= 0) return "units";
  const h = rows.findIndex((r) => nz(r[0]) === "البند");
  if (h >= 0 && rows.some((r) => TALLY_LABELS[nz(r[0])])) return "tally";
  if (bestCol(rows, (c) => !!codeOf(c, wo), 5).col >= 0) return "codes";
  return null;
}

/* ═══════ التقاط الإحداثيات من كل الأنواع ═══════ */
const GEO_BOX = { lat: [15.5, 33.5], lon: [33.5, 56.5] };
export const inKSA = (la: number, lo: number) => la >= GEO_BOX.lat[0] && la <= GEO_BOX.lat[1] && lo >= GEO_BOX.lon[0] && lo <= GEO_BOX.lon[1];
const okLL = (la: number, lo: number) => isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;

/** درجات/دقائق/ثوان → عشري */
export function dms(str: string): { v: number; hemi: string } | null {
  const m = String(str).match(/(-?\d{1,3})\s*[°ºd:\s]\s*(\d{1,2})\s*['′m:\s]\s*(\d{1,2}(?:\.\d+)?)\s*["″s]?\s*([NSEWنجشق])?/i);
  if (!m) return null;
  let v = Math.abs(+m[1]) + +m[2] / 60 + +m[3] / 3600;
  if (+m[1] < 0 || /[SW]/i.test(m[4] || "")) v = -v;
  return { v, hemi: (m[4] || "").toUpperCase() };
}
/** خلية واحدة قد تحمل زوج إحداثيات كاملًا */
export function cellPair(v: unknown): { lat: number; lon: number } | null {
  const s = String(v == null ? "" : v).trim();
  if (s.length < 7 || s.length > 80) return null;
  if (!/\d[.,°º\s]\d/.test(s)) return null;
  const two = s.split(/[,;|]|\s{2,}|(?<=["″NSEW])\s+/i).filter((x) => /\d/.test(x));
  if (two.length >= 2) {
    const a = dms(two[0]), b = dms(two[1]);
    if (a && b) {
      let la = a.v, lo = b.v;
      if (a.hemi === "E" || b.hemi === "N") { la = b.v; lo = a.v; }
      if (okLL(la, lo) && inKSA(la, lo)) return { lat: la, lon: lo };
    }
  }
  const m = s.match(/([NSنج]?\s*-?\d{1,3}\.\d{3,10})\s*[°º]?\s*[,;\s]+\s*([EWشق]?\s*-?\d{1,3}\.\d{3,10})/i);
  if (m) {
    const a = parseFloat(String(m[1]).replace(/[^\d.\-]/g, "")), b = parseFloat(String(m[2]).replace(/[^\d.\-]/g, ""));
    let la = a, lo = b;
    if (!inKSA(la, lo) && inKSA(b, a)) { la = b; lo = a; }
    if (okLL(la, lo) && inKSA(la, lo)) return { lat: la, lon: lo };
  }
  return null;
}
const H_LAT = /(lat(itude)?|خطالعرض|خط العرض|شمال|احداثيشمالي|عرض)/i;
const H_LON = /(lon(g(itude)?)?|خطالطول|خط الطول|شرق|احداثيشرقي|طول)/i;
const H_ANY = /(gps|coord|احداث|الاحداثيات|الموقع|location|position|utm)/i;
const H_E = /^(e|easting|utm ?e|شرقي|الاحداثي الشرقي)$/i;
const H_N = /^(n|northing|utm ?n|شمالي|الاحداثي الشمالي)$/i;
const H_ID = /(unit|rmu|اسم|رقم|الوحده|المحطه|النقطه|point|name|id|وصف|بيان)/i;
function headerRow(rows: Row[]): number {
  let best = -1, score = 0;
  for (let r = 0; r < Math.min(12, rows.length); r++) {
    const s = (rows[r] || []).reduce((a: number, c) => a + (H_LAT.test(nz(c)) || H_LON.test(nz(c)) || H_ANY.test(nz(c)) || H_E.test(String(c).trim()) || H_N.test(String(c).trim()) ? 1 : 0), 0);
    if (s > score) { score = s; best = r; }
  }
  return score ? best : -1;
}
export interface GeoHit { id: string; lat: number; lon: number; type: string; src: string }
/** كل إحداثيات ورقة واحدة — بلا ذكاء اصطناعي */
export function sheetGeo(sh: SheetData, fileName: string, T: Ctx["T"]): GeoHit[] {
  const rows = sh.rows || [], out: GeoHit[] = [];
  if (!rows.length) return out;
  const hr = headerRow(rows);
  let cLat = -1, cLon = -1, cE = -1, cN = -1, cId = -1, cZone = -1;
  if (hr >= 0) {
    const hdr = (rows[hr] || []).map((c) => nz(c)), raw = (rows[hr] || []).map((c) => String(c == null ? "" : c).trim());
    hdr.forEach((h, i) => {
      if (cLat < 0 && H_LAT.test(h)) cLat = i;
      else if (cLon < 0 && H_LON.test(h)) cLon = i;
      if (cE < 0 && H_E.test(raw[i])) cE = i;
      if (cN < 0 && H_N.test(raw[i])) cN = i;
      if (cZone < 0 && /zone|منطقه/i.test(h)) cZone = i;
      if (cId < 0 && H_ID.test(h)) cId = i;
    });
  }
  const rowId = (r: Row) => {
    if (cId >= 0 && String(r[cId] || "").trim()) return String(r[cId]).trim().slice(0, 22);
    for (const c of r) { const s = String(c == null ? "" : c).trim(); if (/^R\s?1\d{5}$/i.test(s)) return s.replace(/\s+/g, ""); }
    for (const c of r) {
      const s = String(c == null ? "" : c).trim();
      if (s.length >= 3 && s.length <= 22 && !/^\d+([.,]\d+)?$/.test(s) && !cellPair(s)) return s;
    }
    return "PT";
  };
  const push = (lat: number, lon: number, id: string, row: number) => {
    if (!okLL(lat, lon) || !inKSA(lat, lon)) return;
    out.push({ id, lat, lon, type: "PT", src: `${fileName} · ${sh.name} · ${T("صف", "row")} ${row + 1}` });
  };
  const max = Math.min(rows.length, 6000);
  for (let i = hr >= 0 ? hr + 1 : 0; i < max; i++) {
    const r = rows[i] || []; if (!r.length) continue;
    let done = false;
    if (cLat >= 0 && cLon >= 0) {
      const a = String(r[cLat] == null ? "" : r[cLat]).trim(), b = String(r[cLon] == null ? "" : r[cLon]).trim();
      if (a && b) {
        let la = parseFloat(a.replace(/[^\d.\-]/g, "")), lo = parseFloat(b.replace(/[^\d.\-]/g, ""));
        const da = dms(a), db = dms(b); if (da && db) { la = da.v; lo = db.v; }
        if (okLL(la, lo)) {
          if (!inKSA(la, lo) && inKSA(lo, la)) { const t = la; la = lo; lo = t; }
          if (inKSA(la, lo)) { push(la, lo, rowId(r), i); done = true; }
        }
      }
    }
    if (!done && cE >= 0 && cN >= 0) {
      const E = parseFloat(String(r[cE]).replace(/[^\d.\-]/g, "")), N = parseFloat(String(r[cN]).replace(/[^\d.\-]/g, ""));
      const z = cZone >= 0 ? parseInt(String(r[cZone]).replace(/\D/g, ""), 10) || 38 : 38;
      if (isFinite(E) && isFinite(N) && E > 100000 && E < 900000 && N > 1000000 && N < 4000000) {
        const ll = utmToLL(E, N, z); if (inKSA(ll.lat, ll.lon)) { push(ll.lat, ll.lon, rowId(r), i); done = true; }
      }
    }
    if (!done) { for (const c of r) { const q = cellPair(c); if (q) { push(q.lat, q.lon, rowId(r), i); break; } } }
  }
  return out;
}
export function bookGeo(sheets: SheetData[], fileName: string, T: Ctx["T"]): GeoHit[] {
  const out: GeoHit[] = [];
  (sheets || []).forEach((sh) => { try { sheetGeo(sh, fileName, T).forEach((x) => out.push(x)); } catch { /* ورقة تالفة */ } });
  return out;
}
/** مسح نصي موسّع: عشري + DMS + N/E + UTM */
export function textGeo(text: string, name: string): GeoHit[] {
  const out: GeoHit[] = [], s = String(text || "");
  const push = (la: number, lo: number, id?: string) => { if (okLL(la, lo) && inKSA(la, lo)) out.push({ id: id || "PT", lat: la, lon: lo, type: "PT", src: name }); };
  let m: RegExpExecArray | null;
  const dec = /(-?\d{1,3}\.\d{3,10})\s*[°º]?\s*[,;\s]+\s*(-?\d{1,3}\.\d{3,10})/g;
  while ((m = dec.exec(s))) { const a = +m[1], b = +m[2]; if (inKSA(a, b)) push(a, b); else if (inKSA(b, a)) push(b, a); }
  const d2 = /(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*["″]?\s*([NSشج])[\s,;]+(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*["″]?\s*([EWقغ])/gi;
  while ((m = d2.exec(s))) {
    const la = +m[1] + +m[2] / 60 + +m[3] / 3600, lo = +m[5] + +m[6] / 60 + +m[7] / 3600;
    push(/[Ss]/.test(m[4]) ? -la : la, /[Ww]/.test(m[8]) ? -lo : lo);
  }
  const lab = /(?:lat(?:itude)?|خط\s*العرض)\D{0,12}(-?\d{1,3}\.\d{3,10})[\s\S]{0,40}?(?:lon(?:g|gitude)?|خط\s*الطول)\D{0,12}(-?\d{1,3}\.\d{3,10})/gi;
  while ((m = lab.exec(s))) push(+m[1], +m[2]);
  const utm = /\bE\s*[:=]?\s*(\d{6}(?:\.\d+)?)\D{1,12}N\s*[:=]?\s*(\d{7}(?:\.\d+)?)/gi;
  while ((m = utm.exec(s))) { const ll = utmToLL(+m[1], +m[2], 38); push(ll.lat, ll.lon); }
  return out;
}
const unCdata = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim();
/** ملفات KML/GPX/GeoJSON (محلّل نصي بلا DOM ليعمل في الخادم) */
export function readGeoText(s: string, name: string): { id: string; lat: number; lon: number; src: string }[] {
  const pts: { id: string; lat: number; lon: number; src: string }[] = [];
  if (/<kml|<gpx/i.test(s)) {
    for (const pm of s.match(/<Placemark[\s\S]*?<\/Placemark>/gi) || []) {
      const nm = unCdata((pm.match(/<name[^>]*>([\s\S]*?)<\/name>/i) || [, ""])[1] as string);
      for (const cm of pm.matchAll(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi)) {
        cm[1].trim().split(/\s+/).forEach((t, i) => {
          const [lo, la] = t.split(",").map(Number);
          if (isFinite(la) && isFinite(lo)) pts.push({ id: (nm || name) + (i ? "-" + (i + 1) : ""), lat: la, lon: lo, src: name });
        });
      }
    }
    let wi = 0;
    for (const w of s.matchAll(/<(wpt|trkpt)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
      wi++;
      const la = +((w[2].match(/lat\s*=\s*["']([^"']+)["']/i) || [, "NaN"])[1] as string), lo = +((w[2].match(/lon\s*=\s*["']([^"']+)["']/i) || [, "NaN"])[1] as string);
      const nm = unCdata((w[3].match(/<name[^>]*>([\s\S]*?)<\/name>/i) || [, ""])[1] as string) || "WPT" + wi;
      if (isFinite(la) && isFinite(lo)) pts.push({ id: nm, lat: la, lon: lo, src: name });
    }
    return pts;
  }
  try {
    const j = JSON.parse(s);
    const walk = (g: any, nm: string) => {
      if (!g) return;
      if (g.type === "FeatureCollection") g.features.forEach((f: any) => walk(f.geometry, (f.properties && (f.properties.name || f.properties.Name)) || nm));
      else if (g.type === "Point") pts.push({ id: nm || name, lat: g.coordinates[1], lon: g.coordinates[0], src: name });
      else if (g.type === "LineString" || g.type === "MultiPoint") g.coordinates.forEach((c: number[], i: number) => pts.push({ id: (nm || name) + "-" + (i + 1), lat: c[1], lon: c[0], src: name }));
    };
    walk(j.type === "FeatureCollection" ? j : j.geometry || j, "");
  } catch { /* ليس JSON */ }
  return pts;
}
/** مسح نصي: إحداثيات، أرقام وحدات، أكواد بنود */
export function scanText(text: string, name: string, wo: string) {
  const found = { points: [] as { id: string; lat: number; lon: number; src: string }[], codes: [] as string[], units: [] as string[] };
  let m: RegExpExecArray | null;
  const coord = /(\d{2}\.\d{4,8})\s*[,;\s]\s*(\d{2}\.\d{4,8})/g;
  while ((m = coord.exec(text))) {
    const a = +m[1], b = +m[2];
    const lat = a < 34 ? a : b, lon = a < 34 ? b : a;
    if (lat >= 16 && lat <= 33 && lon >= 34 && lon <= 56) found.points.push({ id: "PT", lat, lon, src: name });
  }
  const un = /\bR\s?1\d{5}\b/g;
  while ((m = un.exec(text))) found.units.push(m[0].replace(/\s+/g, ""));
  const cd = /\b9?\d{7,9}\b/g;
  while ((m = cd.exec(text))) { const k = codeOf(m[0], wo); if (k) found.codes.push(k); }
  return found;
}
/** دمج مع منع التكرار الدقيق (≈1 م) */
export function mergeGeo(env: ImportEnv, pts: { id?: string; lat: number; lon: number; src?: string; type?: string }[], rep: Rep[] | null, name: string): number {
  if (!pts.length) return 0;
  const p = env.p, T = env.T;
  p.geo = p.geo || [];
  const key = (la: number, lo: number) => la.toFixed(5) + "," + lo.toFixed(5);
  const seen = new Set(p.geo.map((g) => key(+g.lat, +g.lon)));
  (p.rmus || []).forEach((r) => { const m = String(r.gps || "").match(/(-?\d+\.\d+)\s*[,،\s]\s*(-?\d+\.\d+)/); if (m) seen.add(key(+m[1], +m[2])); });
  let n = 0;
  pts.forEach((x) => {
    const k = key(+x.lat, +x.lon); if (seen.has(k)) return; seen.add(k);
    p.geo!.push({ id: x.id && x.id !== "PT" ? String(x.id).slice(0, 22) : "PT-" + (p.geo!.length + 1), lat: +x.lat, lon: +x.lon, src: x.src || name, type: x.type || "PT" });
    n++;
  });
  if (n && rep) rep.push(["ok", T(`${n} إحداثي جديد من «${name}» — يظهر على الخريطة و Google Earth`, `${n} new coordinates from “${name}” — visible on the map and in Google Earth`)]);
  return n;
}

/* ═══════ مستوردو الأقسام ═══════ */
function addLibMat(cat: Catalog, code: string, name: string, price: number | null): Material {
  const m: Material = { c: code, ar: String(name || "مادة " + code).slice(0, 90), en: String(name || "Material " + code).slice(0, 90), u: "عدد", p: +(price as number) || 0, k: "detail", g: "acc", added: true };
  cat.materials.push(m); return m;
}
function addLibWork(cat: Catalog, code: string, name: string, price: number | null): Work {
  const w: Work = { c: code, ar: String(name || "بند " + code).slice(0, 110), en: String(name || "Item " + code).slice(0, 110), u: "عدد", p: +(price as number) || 0, g: "inst", added: true };
  cat.works.push(w); return w;
}

/** جدول الوحدات: ضبط الحماية / الاستلام النهائي / أي جدول به أرقام RMU */
export function impUnits(env: ImportEnv, sh: SheetData, rep: Rep[]): void {
  const { p, T } = env;
  const rows = sh.rows, uc = unitCol(rows), idc = uc.col;
  if (idc < 0) return;
  const ok = (r: Row) => !!unitIdAt(r[idc], uc.strict);
  const data = rows.filter((r, i) => (uc.hdr < 0 || i > uc.hdr) && ok(r));
  const first = rows.findIndex((r, i) => (uc.hdr < 0 || i > uc.hdr) && ok(r));
  const hdr = composite(rows, first);
  const cF = findCol(hdr, "feeder", "المغذي"), cT = findCol(hdr, "equipment type", "rmu type", /\btype\b/),
    cTR = findCol(hdr, "tr number", "tr-number", /\btr\b/), cRel = findCol(hdr, "relay", "protection data"),
    cMan = findCol(hdr, "manufacturer"), cMod = findCol(hdr, "model"),
    cSet = findCol(hdr, "setting completed", "setting"), cRat = findCol(hdr, "ct connected", "ratio"),
    cOhm = findCol(hdr, "ground ohm", "ground", "ohm", "التاريض");
  let n = 0, add = 0, gps = 0, ohm = 0;
  data.forEach((r) => {
    const id = unitIdAt(r[idc], uc.strict);
    let q = p.rmus.find((x) => String(x.rmu).replace(/\s+/g, "").toUpperCase() === id);
    if (!q) { q = { no: 0, feeder: "", rmu: id, type: "", tr: "", relay: "—", model: "—", set: false, ratio: "", ohm: "", gps: "" } as RmuRow; p.rmus.push(q); add++; }
    const nums = r.map(num);
    const lat = nums.find((v) => v !== null && v >= 16 && v <= 33 && String(v).includes(".")),
      lon = nums.find((v) => v !== null && v >= 34 && v <= 56 && String(v).includes("."));
    if (lat && lon) { if (setUnitGps(q, lat, lon, sh.name, env.conflicts)) gps++; }
    else if (!q.gps) {
      for (const c of r) { const pr = cellPair(c); if (pr) { if (setUnitGps(q, pr.lat, pr.lon, sh.name, env.conflicts)) gps++; break; } }
    }
    if (cF >= 0 && r[cF]) q.feeder = String(r[cF]).trim();
    if (cT >= 0 && r[cT]) { const m = /([34])\s*w/i.exec(String(r[cT])); if (m) q.type = m[1] + "W"; }
    if (cTR >= 0 && r[cTR] && !/^ok$/i.test(String(r[cTR]))) q.tr = String(r[cTR]).trim();
    if (cMan >= 0 && r[cMan]) q.model = String(r[cMan]).trim() + (cMod >= 0 && r[cMod] ? " " + String(r[cMod]).trim() : "");
    if (cRel >= 0 && r[cRel] && /[A-Za-z]/.test(String(r[cRel]))) q.relay = String(r[cRel]).trim();
    if (cSet >= 0 && /yes|نعم|تم/i.test(String(r[cSet] || ""))) q.set = true;
    if (cRat >= 0 && /\d+\s*\/\s*\d+/.test(String(r[cRat] || ""))) q.ratio = String(r[cRat]).trim();
    if (cOhm >= 0) { const o = num(r[cOhm]); if (o !== null && o > 0 && o < 200) { q.ohm = String(o); ohm++; } }
    n++;
  });
  p.rmus.forEach((q, i) => (q.no = i + 1));
  rep.push(["ok", T(`جدول الوحدات: ${n} وحدة (${add} جديدة)${gps ? ` · ${gps} بإحداثيات` : ""}${ohm ? ` · ${ohm} بمقاومة تأريض` : ""}`,
    `Unit schedule: ${n} units (${add} new)${gps ? ` · ${gps} with coordinates` : ""}${ohm ? ` · ${ohm} with earth readings` : ""}`)]);
}

/** جداول أرقام البنود: أمر التسليم / المقايسة / أي جدول كود+كمية */
export function impCodes(env: ImportEnv, sh: SheetData, rep: Rep[]): void {
  const { p, cat, T } = env;
  const rows = sh.rows, cc = bestCol(rows, (c) => !!codeOf(c, p.wo), 5);
  if (cc.col < 0) return;
  const ci = cc.col, data = rows.filter((r) => codeOf(r[ci], p.wo));
  const first = rows.findIndex((r) => codeOf(r[ci], p.wo));
  const hdr = composite(rows, first);
  const cQty = findCol(hdr, "كميه", "الكميه", /\bqty\b/, "quantity"),
    cPrice = findCol(hdr, "سعر البند", "سعر الوحده", "price", "rate"),
    cPlan = findCol(hdr, "المخطط", "planned"), cExec = findCol(hdr, "المنفذ", "executed"),
    cIss = findCol(hdr, "المصروف", "issued"), cReq = findCol(hdr, "المطلوب", "required");
  let cDesc = findCol(hdr, "وصف البند", "الوصف", "المواد", "التركيبات", "description", "اسم الماده");
  if (cDesc < 0) { const d = bestCol(data, (c) => typeof c === "string" && c.trim().length >= 8); cDesc = d.col; }
  const mode = cPlan >= 0 || cExec >= 0 || cIss >= 0 ? "boq" : "qty";
  let qtyCol = cQty;
  if (mode === "qty" && qtyCol < 0) {
    const sum: Record<number, number> = {}, cntc: Record<number, number> = {};
    data.forEach((r) => r.forEach((c, i) => {
      if (i === ci || i === cPrice || i === cDesc) return; const v = num(c);
      if (v !== null && v > 0 && v < 1e7) { sum[i] = (sum[i] || 0) + v; cntc[i] = (cntc[i] || 0) + 1; }
    }));
    const cand = Object.keys(sum).filter((i) => cntc[+i] >= Math.max(3, data.length * 0.3));
    if (cand.length) qtyCol = +cand.reduce((a, b) => (sum[+a] >= sum[+b] ? a : b));
  }
  let mats = 0, works = 0, priced = 0, zero = 0, extra = 0;
  const added: string[] = [];
  data.forEach((r) => {
    const code = codeOf(r[ci], p.wo);
    const desc = cDesc >= 0 ? String(r[cDesc] || "").trim() : "";
    const price = cPrice >= 0 ? num(r[cPrice]) : null;
    const plan = cPlan >= 0 ? num(r[cPlan]) : cIss >= 0 ? num(r[cIss]) : null;
    const exec = cExec >= 0 ? num(r[cExec]) : cReq >= 0 ? num(r[cReq]) : null;
    const qty = qtyCol >= 0 ? num(r[qtyCol]) : null;
    if (isMatCode(code)) {
      let m = libMat(cat, code);
      if (!m) { m = addLibMat(cat, code, desc, price); added.push(code); }
      else if (desc && desc.length > 6 && !m.added && /[A-Za-z]/.test(desc) && !nz(m.en).includes(nz(desc).slice(0, 12))) m.en = desc.slice(0, 90);
      if (price !== null && price > 0) { m.p = price; priced++; }
      const b = (p.mat[code] = p.mat[code] || { iss: 0, req: 0 });
      if (mode === "boq") {
        if (plan !== null && plan > 0) { b.iss = plan; if (exec !== null) b.req = exec; }
        else if (exec !== null && exec > 0) { b.req = (+b.iss || 0) + exec; extra++; } // صف إضافة: المطلوب = المصروف + الفرق
      } else if (qty !== null) { b.iss = (+b.iss || 0) + qty; b.req = Math.max(+b.req || 0, b.iss); }
      else zero++;
      mats++;
    } else {
      let w = libWork(cat, code);
      if (!w) { w = addLibWork(cat, code, desc, price); added.push(code); }
      if (price !== null && price > 0) { w.p = price; priced++; }
      const b = (p.boq[code] = p.boq[code] || { plan: 0, exec: 0 });
      if (mode === "boq") { if (plan !== null) b.plan = plan; if (exec !== null) b.exec = exec; }
      else if (qty !== null) b.plan = (+b.plan || 0) + qty;
      else zero++;
      works++;
    }
  });
  rep.push(["ok", T(`${mode === "boq" ? "المقايسة" : "الكميات"} من «${sh.name}»: ${mats} مادة و ${works} بند أجور${priced ? ` · ${priced} سعر محدّث` : ""}`,
    `${mode === "boq" ? "BOQ" : "Quantities"} from “${sh.name}”: ${mats} materials, ${works} work items${priced ? ` · ${priced} prices updated` : ""}`)]);
  if (added.length) rep.push(["new", T(`أُضيف ${added.length} بند جديد للمكتبة بمسمياته من الملف: `, `${added.length} new items added with their file names: `) + added.slice(0, 8).join(" · ") + (added.length > 8 ? " …" : "")]);
  if (extra) rep.push(["new", T(`${extra} مادة صف إضافة — المطلوب = المصروف + فرق التنفيذ`, `${extra} materials as addition rows — required = issued + executed difference`)]);
  if (zero) rep.push(["skip", T(`${zero} بند بلا كمية واضحة — سُجّل بصفر`, `${zero} items with no clear quantity — recorded as zero`)]);
}
export function impTally(env: ImportEnv, sh: SheetData, rep: Rep[]): void {
  const { p, T } = env;
  const rows = sh.rows, h = rows.findIndex((r) => nz(r[0]) === "البند"), hdr = rows[h] || [];
  const cols: { i: number; name: string }[] = [];
  for (let i = 1; i < hdr.length; i++) { const t = nz(hdr[i]); if (!t || t.includes(nz("الاجمالي")) || t.includes("total")) continue; cols.push({ i, name: String(hdr[i]).trim() }); }
  if (!cols.length) { rep.push(["skip", T("قالب الحصر: لم يُعثر على أعمدة لوحات", "Tally template: no sheet columns found")]); return; }
  const sheets: Sheet[] = cols.map((c, i) => { const s = blankSheet(i + 1); s.name = c.name; return s; });
  let n = 0;
  rows.slice(h + 1).forEach((r) => {
    const key = TALLY_LABELS[nz(r[0])]; if (!key) return;
    cols.forEach((c, ci) => { const v = num(r[c.i]); sheets[ci][key] = v === null ? 0 : v; }); n++;
  });
  if (n) {
    p.sheets = sheets; p.derived = null;
    rep.push(["ok", T(`حصر اللوحات: ${cols.length} لوحة و ${n} حقل — استُبدل حصر المشروع`, `Sheet tally: ${cols.length} sheets, ${n} fields — project tally replaced`)]);
  }
}

/** تشغيل الاستيراد على ملف (أوراق جاهزة) — يعيد تقرير الاستيراد */
export function importSheets(env: ImportEnv, rec: FileRec, sheets: SheetData[]): Rep[] {
  const { p, T } = env, rep: Rep[] = [];
  let touched = 0;
  sheets.forEach((sh) => {
    const k = sheetKind(sh, p.wo);
    const live = sh.rows.filter((r) => r.some((c) => String(c).trim() !== "")).length;
    if (!k) { if (live > 3) rep.push(["skip", T(`الورقة «${sh.name}»: ${live} صف لم يُتعرّف على تنسيقها`, `Sheet “${sh.name}”: ${live} rows, format not recognised`)]); return; }
    touched++;
    if (k === "units") impUnits(env, sh, rep);
    else if (k === "tally") impTally(env, sh, rep);
    else impCodes(env, sh, rep);
  });
  if (p.derived) p.derived = derive(p, env.cat);
  rec.imported = touched > 0; rec.rows = sheets.reduce((s, x) => s + x.rows.length, 0); rec.at = new Date().toISOString();
  rec.rep = rep;
  return rep;
}

/** اشتقاق حصر اللوحات عكسيًا من البيانات المستوردة */
export function backfillTally(env: ImportEnv, rep?: Rep[]): boolean {
  const { p, T } = env;
  const q = (c: string) => { const b = p.boq[c]; return b ? +b.exec || +b.plan || 0 : 0; };
  const m = (c: string) => { const b = p.mat[c]; return b ? +b.req || +b.iss || 0 : 0; };
  const s = blankSheet(1); s.name = T("من الملفات المستوردة", "From imported files");
  const u3 = p.rmus.filter((r) => r.type === "3W").length, u4 = p.rmus.filter((r) => r.type === "4W").length;
  const trs = p.rmus.filter((r) => r.tr && r.tr.trim()).length;
  Object.assign(s, {
    rmu3w: u3 || m("8327004"), rmu4w: u4 || m("8327005"),
    tr220: Math.round((trs || m("8567054")) / 2), tr400: (trs || m("8567054")) - Math.round((trs || m("8567054")) / 2),
    trIndoor: m("8569108"), pillars: q("309010102"),
    htCable: q("304010202") || m("8114005"), mvSingle: q("304010203") || m("8113009"),
    lt300: q("304010102") || m("8111007"), lt185: q("304010101") || m("8111006"), lt70: 0,
    htEarth: m("8111102"),
    saHT1: q("301010201"), asHT1: q("301010205"), saHT2: q("301010202"), asHT2: q("301010206"),
    saHT3: q("301010203"), asHT3: 0, saHT4: q("301010204"), saLT13: q("301010101"), asLT13: q("301010103"), saLT4: q("301010102"),
    asphalt: q("306010002"), milling: q("306010004"), hdd: q("302020001"),
    joints: q("305020104"), term3x400: q("305020404"), lt300Term: q("305010302"), lt185Term: q("305010301"), lt70Term: 0,
    riser400: 0,
    poleSteel: q("201040003"), poleWood: q("201040006"), trPole1: q("205040101"), trPole2: q("205040102"),
    condMV: q("204020301"), abcLV: q("204010301"), riserRem: q("304040205"), lbsRem: q("205040206"),
  });
  const filled = SHEET_FIELDS.reduce((a, g) => a + g.f.filter((f) => +(s[f[0]] as number) > 0).length, 0);
  if (!filled) return false;
  p.sheets = [s]; p.derived = derive(p, env.cat);
  if (rep) {
    rep.push(["ok", T(`مُلئ ${filled} حقلًا في حصر اللوحات من كميات المقايسة والمواد والوحدات المستوردة`, `${filled} tally fields filled from the imported BOQ, materials and unit data`)]);
    rep.push(["new", T("راجع الأطوال والحفريات قبل اعتماد الحصر — الاشتقاق العكسي يفترض أن المنفّذ يمثل الكروكي", "Review lengths and excavation before approving — back-fill assumes executed quantities represent the layout")]);
  }
  return true;
}

/** ما بعد الاستيراد: يشغّل الاستنباط ويملأ ما لم يُدخل يدويًا (runDerive) */
export function runDerive(env: ImportEnv): boolean {
  const { p } = env, t = totals(p);
  if (!t.htCable && !t.lt300 && !t.rmuNew && !Object.keys(p.boq).length && !p.rmus.length) return false;
  if (!t.rmuNew && (Object.keys(p.boq).length || p.rmus.length)) backfillTally(env);
  p.derived = derive(p, env.cat);
  Object.entries(p.derived.works).forEach(([c, q]) => {
    p.boq[c] = p.boq[c] || { plan: 0, exec: 0 };
    if (!p.boq[c].plan && !p.boq[c].exec) { p.boq[c].plan = Math.round(q * 10) / 10; p.boq[c].exec = Math.round(q * 10) / 10; }
  });
  Object.entries(p.derived.mats).forEach(([c, q]) => {
    p.mat[c] = p.mat[c] || { iss: 0, req: 0 };
    if (!p.mat[c].iss && !p.mat[c].req) { p.mat[c].iss = q; p.mat[c].req = q; }
  });
  const t2 = totals(p);
  if (!p.rmus.length && t2.rmuNew) {
    p.rmus = Array.from({ length: t2.rmuNew }, (_, i) => ({ no: i + 1, feeder: "—", rmu: "R" + (101580 + i + 1), type: i < t2.rmu3w ? "3W" : "4W", tr: "", relay: "—", model: "—", set: false, ratio: "", ohm: "", gps: "" }));
  }
  return true;
}

/** مطابقة النقاط المستخرجة بأسماء الوحدات */
export function matchGeoUnits(env: ImportEnv, rep?: Rep[]): number {
  const { p, T } = env, extras = p.geo || [];
  if (!extras.length || !p.rmus.length) return 0;
  const key = (x: unknown) => nz(String(x || "")).replace(/[^a-z0-9ا-ي]/gi, "").toUpperCase();
  let hit = 0;
  p.rmus.forEach((r) => {
    if (String(r.gps || "").trim()) return;
    const ks = [r.rmu, r.no ? "R" + r.no : ""].map(key).filter((k) => k.length >= 4);
    if (!ks.length) return;
    const i = extras.findIndex((g) => { const id = key(g.id); return id.length >= 4 && ks.some((k) => id === k || id.includes(k) || k.includes(id)); });
    if (i >= 0) { r.gps = extras[i].lat + "," + extras[i].lon; extras.splice(i, 1); hit++; }
  });
  if (hit && rep) rep.push(["ok", T(`طُوبقت إحداثيات ${hit} وحدة بأسمائها من النقاط المستخرجة`, `${hit} unit(s) matched to extracted coordinates by name`)]);
  return hit;
}

/** حارس الهوية: يقرر هل يُستورد الملف أم يُوقف (يعدّل p/rec/rep كما في المنصة الحالية) */
export function identityGate(env: ImportEnv, rec: FileRec, ident: Identity, rep: Rep[]): "go" | "blocked" {
  const { p, T } = env;
  rec.ident = ident;
  const st = woState(p, ident);
  rec.woState = st;
  if (st === "adopt" || st === "match" || st === "related") fillIdent(p, ident);
  const dg = (v: string) => String(v || "").replace(/[^\d]/g, "");
  if (st === "adopt") {
    p.wo = ident.wo!;
    if (!p.name || /^مشروع تحويل رقم/.test(p.name)) p.name = ident.name || p.name;
    rep.push(["ok", T(`أُخذ رقم أمر العمل ${p.wo} من «${rec.name}»${ident.name ? ` · المشروع: ${ident.name}` : ""}`, `Work order ${p.wo} taken from “${rec.name}”${ident.name ? ` · project: ${ident.name}` : ""}`)]);
  } else if (st === "related") {
    rep.push(["ok", T(`«${rec.name}» طلب UDS مرتبط رقم ${ident.wo} ضمن أمر العمل ${dg(p.wo)} — استُورد`, `“${rec.name}” is a related UDS request ${ident.wo} under work order ${dg(p.wo)} — imported`)]);
  } else if (st === "weak") {
    rep.push(["warn", T(`«${rec.name}»: لم يُذكر رقم أمر العمل صراحة — استُورد وربطه ترجيحي، راجع البطاقة`, `“${rec.name}”: no explicit work-order number — imported with an inferred link; check the identity card`)]);
  } else if (st === "mismatch" && env.guard) {
    rec.blocked = true; rec.imported = false;
    rep.push(["warn", T(`«${rec.name}» يحمل أمر عمل ${ident.wo} بينما المشروع الحالي ${dg(p.wo)} — لم تُستورد بياناته. افتح بطاقة مطابقة أمر العمل لاعتماده أو استيراده رغم الاختلاف.`,
      `“${rec.name}” carries work order ${ident.wo} while this project is ${dg(p.wo)} — its data was not imported. Use the work-order matching card to adopt it or import anyway.`)]);
    return "blocked";
  } else if (st === "mismatch") {
    rep.push(["warn", T(`تحذير: «${rec.name}» يحمل أمر عمل ${ident.wo} مختلفًا عن ${dg(p.wo)} — استُورد رغم ذلك لأن الحماية موقوفة.`, `Warning: “${rec.name}” carries work order ${ident.wo}, not ${dg(p.wo)} — imported anyway because the guard is off.`)]);
  } else if (st === "match") {
    rep.push(["ok", T(`مطابقة: «${rec.name}» يحمل نفس أمر العمل ${dg(p.wo)}`, `Match: “${rec.name}” carries work order ${dg(p.wo)}`)]);
  }
  return "go";
}

/** ما ينقص كل صفحة (شريط «تحديث البيانات واستكمال النواقص») */
export interface Missing { n: number; t: string; hint: string; go: string | null }
export function missingFor(p: Project, page: string, T: Ctx["T"]): Missing[] {
  const t = totals(p), d = p.derived, out: Missing[] = [];
  const pts = geoPoints(p);
  const add = (n: number, ar: string, en: string, hint: string, go: string | null) => { if (n > 0) out.push({ n, t: T(ar, en), hint, go }); };
  const noGps = p.rmus.filter((r) => !String(r.gps || "").trim()).length;
  const loose = (p.geo || []).length;
  const boqZero = Object.keys(p.boq).filter((c) => !p.boq[c].plan && !p.boq[c].exec).length;
  const boqNoExec = Object.keys(p.boq).filter((c) => p.boq[c].plan && !p.boq[c].exec).length;
  const matZero = Object.keys(p.mat).filter((c) => !p.mat[c].iss && !p.mat[c].req).length;
  const derNotInBoq = d ? Object.keys(d.works).filter((c) => d.works[c] > 0 && !p.boq[c]).length : 0;
  const derMatNotIn = d ? Object.keys(d.mats).filter((c) => d.mats[c] > 0 && !p.mat[c]).length : 0;
  if (page === "dash") {
    add(p.wo ? 0 : 1, "رقم أمر العمل غير مُدخل", "Work order not set", T("يُقرأ آليًا من أي ملف يُرفع", "Read automatically from any uploaded file"), "master");
    add(String(p.site || "").trim() ? 0 : 1, "موقع المشروع غير مُدخل", "Site not set", T("يُقرأ من ترويسة ملفات الحصر والصلاحية", "From the tally / authority file header"), "master");
    add(d ? 0 : 1, "لم يُشغَّل الاستنباط بعد", "Takeoff not derived yet", T("اضغط تحديث واستكمال", "Press refresh & complete"), "master");
    add(p.estCost.mat + p.estCost.inst ? 0 : 1, "المقايسة التقديرية غير مُدخلة", "Estimated BOQ cost empty", T("تُملأ من ناتج الكروكي", "Filled from the derived takeoff"), "master");
    add(p.files.length ? 0 : 1, "لا توجد ملفات مرفوعة", "No files uploaded", T("ارفع الكروكي وملفات الإكسل", "Upload the layout and Excel files"), "master");
  }
  if (page === "master") {
    add(p.files.length ? 0 : 1, "لا توجد ملفات مرفوعة", "No files uploaded", T("ارفع الكروكي والنماذج", "Upload the layout and forms"), null);
    add(t.rmuNew || t.htCable || t.lt300 ? 0 : 1, "حصر اللوحات فارغ", "Sheet tally empty", T("يُشتق آليًا من البنود المستوردة", "Back-filled from the imported items"), null);
    add(p.wo ? 0 : 1, "رقم أمر العمل غير مُدخل", "Work order not set", T("يُقرأ من الملفات", "Read from the files"), null);
    add(noGps, "وحدة بلا إحداثيات", "unit(s) without coordinates", T("تُطابق بأسمائها مع نقاط الملفات", "Matched by name against file points"), "map");
    add((p.files || []).filter((f) => f.blocked).length, "ملف موقوف لاختلاف أمر العمل", "file(s) blocked on a work-order mismatch", T("راجع بطاقة الهوية", "See the identity card"), null);
  }
  if (page === "boq") {
    add(boqZero, "بند بلا كميات", "item(s) with no quantities", T("تُملأ من ناتج الكروكي", "Filled from the derived takeoff"), null);
    add(derNotInBoq, "بند مستنبط غير مدرج بالمقايسة", "derived item(s) missing from the BOQ", T("يُضاف بالتحديث", "Added on refresh"), null);
    add(matZero, "مادة بلا كميات", "material(s) with no quantities", T("تُملأ من المصروف والمستنبط", "Filled from issues and the takeoff"), null);
    add(derMatNotIn, "مادة مستنبطة غير مدرجة", "derived material(s) not listed", T("تُضاف بالتحديث", "Added on refresh"), null);
  }
  if (page === "wages") {
    add(boqNoExec, "بند مخطط بلا تنفيذ", "planned item(s) with no execution", T("ارفع فاتورة الأجور أو ملف المواد والأجور", "Upload the wages invoice or the materials & wages file"), null);
    add(String(p.approvedDate || "").trim() ? 0 : 1, "تاريخ اعتماد المقايسة غير مُدخل", "BOQ approval date not set", T("يُقرأ من ملف الصلاحية", "Read from the authority file"), null);
    add(p.estCost.mat + p.estCost.inst ? 0 : 1, "التكلفة التقديرية غير مُدخلة", "Estimated cost empty", T("تُملأ من ناتج الكروكي", "Filled from the derived takeoff"), null);
  }
  if (page === "forms") {
    add(p.rmus.length ? 0 : 1, "جدول الوحدات فارغ", "Unit schedule empty", T("ارفع ملف ضبط الحماية أو الاستلام", "Upload the protection or acceptance file"), null);
    add(p.rmus.filter((r) => !r.set).length, "وحدة لم يكتمل ضبط حمايتها", "unit(s) without protection settings", T("تُقرأ من ملف ضبط الحماية", "Read from the protection file"), null);
    add(p.rmus.filter((r) => !String(r.ratio || "").trim() && r.tr).length, "وحدة بمحول بلا نسبة تحويل", "unit(s) with a TR but no ratio", T("تُقرأ من ملف ضبط الحماية", "Read from the protection file"), null);
    add(p.rmus.filter((r) => !String(r.ohm || "").trim()).length, "وحدة بلا قياس مقاومة تأريض", "unit(s) without an earth-resistance value", T("تُقرأ من ملف الاستلام النهائي", "Read from the final acceptance file"), null);
    add(noGps, "وحدة بلا إحداثيات", "unit(s) without coordinates", T("تُطابق بأسمائها", "Matched by name"), "map");
  }
  if (page === "map") {
    add(noGps, "وحدة بلا إحداثيات", "unit(s) without coordinates", T("تُطابق باسم الوحدة مع نقاط الملفات المرفوعة", "Matched by unit name against points from the uploaded files"), null);
    add(pts.length ? 0 : 1, "لا توجد نقاط على الخريطة", "No points on the map", T("ارفع ضبط الحماية أو ملف KML/KMZ", "Upload the protection file or a KML/KMZ"), null);
    add(noGps ? loose : 0, "نقطة مستخرجة غير مرتبطة بوحدة", "loose point(s) not linked to a unit", T("تُربط آليًا عند تطابق الاسم", "Linked automatically when the name matches"), null);
    add(p.rmus.filter((r) => String(r.gps || "").trim() && !String(r.feeder || "").replace(/NER|—|-/g, "").trim()).length, "وحدة بلا اسم مغذي", "unit(s) without a feeder name", T("يُقرأ من ملف ضبط الحماية", "Read from the protection file"), null);
  }
  if (page === "recs") add(d ? 0 : 1, "لم يُشغَّل الاستنباط بعد", "Takeoff not derived yet", T("اضغط تحديث واستكمال", "Press refresh & complete"), "master");
  return out;
}

/** قارئ CSV (يقبل , و ;) */
export function readCsvText(s: string): SheetData[] {
  const rows: Row[] = []; let row: string[] = [], cur = "", q = false;
  s = s.replace(/^\ufeff/, "");
  const conv = (r: string[]) => r.map((x) => (isFinite(+x) && x.trim() !== "" ? +x : x));
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === "," || ch === ";") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(conv(row)); row = []; cur = ""; }
    else if (ch !== "\r") cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(conv(row)); }
  return [{ name: "CSV", rows }];
}
