import { escHtml } from "./i18n";
import { pmLine, PM_NAME, PM_ROLE_EN } from "./signature";
import type { Ctx, Lang, Project, RmuRow } from "./types";

/* ═══════ WGS84 ⇄ UTM ═══════ */
export function toUTM(lat: number, lon: number) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const zone = Math.floor((lon + 180) / 6) + 1, lon0 = (zone - 1) * 6 - 180 + 3;
  const ph = (lat * Math.PI) / 180, la = ((lon - lon0) * Math.PI) / 180;
  const s = Math.sin(ph), c = Math.cos(ph), t = Math.tan(ph);
  const N = a / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c, A = c * la;
  const M = a * ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256) * ph - ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * ph)
    + ((15 * e2 * e2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * ph) - ((35 * e2 ** 3) / 3072) * Math.sin(6 * ph));
  const E = k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120) + 500000;
  let Nn = k0 * (M + N * t * ((A * A) / 2 + ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720));
  if (lat < 0) Nn += 10000000;
  return { E, N: Nn, zone };
}
export function utmToLL(E: number, N: number, zone: number) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2), e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const x = E - 500000, M = N / k0, mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256));
  const p1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu);
  const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1), N1 = a / Math.sqrt(1 - e2 * s * s), T1 = t * t, C1 = ep2 * c * c, R1 = (a * (1 - e2)) / Math.pow(1 - e2 * s * s, 1.5), D = x / (N1 * k0);
  const lat = p1 - ((N1 * t) / R1) * ((D * D) / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24 + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720);
  const lon = (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) / c;
  return { lat: (lat * 180) / Math.PI, lon: (zone - 1) * 6 - 180 + 3 + (lon * 180) / Math.PI };
}
export function hav(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371008.8, r = (x: number) => (x * Math.PI) / 180;
  const dl = r(b.lat - a.lat), dn = r(b.lon - a.lon);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ═══════ نقاط المشروع والمغذيات ═══════ */
export const EXTRA_FEEDER = "نقاط مستخرجة";
export interface GeoPt extends RmuRow {
  id: string; lat: number; lon: number; E: number; N: number; zone: number; hasTR: boolean;
  extra?: boolean; src?: string; seg?: number;
}
export interface Feeder { name: string; pts: GeoPt[]; len: number; color: string; idx: number; noRoute?: boolean }

export function geoPoints(p: Pick<Project, "rmus" | "geo">): GeoPt[] {
  const pts: GeoPt[] = [];
  p.rmus.forEach((r) => {
    const m = String(r.gps || "").match(/(-?\d+(?:\.\d+)?)\s*[,،\s]\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return;
    const lat = +m[1], lon = +m[2];
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    const u = toUTM(lat, lon);
    pts.push({ ...r, id: r.rmu.replace(/\s+/g, ""), lat, lon, E: u.E, N: u.N, zone: u.zone, hasTR: !!(r.tr && r.tr.trim()) });
  });
  (p.geo || []).forEach((x) => {
    if (!isFinite(x.lat) || !isFinite(x.lon)) return;
    if (pts.some((q) => Math.abs(q.lat - x.lat) < 5e-5 && Math.abs(q.lon - x.lon) < 5e-5)) return;
    const u = toUTM(x.lat, x.lon);
    pts.push({
      no: 0, feeder: EXTRA_FEEDER, rmu: x.id || "PT", id: (x.id || "PT").replace(/\s+/g, ""), type: x.type || "PT", tr: "",
      relay: x.src || "—", model: "—", set: false, ratio: "", ohm: "", gps: x.lat + "," + x.lon,
      lat: x.lat, lon: x.lon, E: u.E, N: u.N, zone: u.zone, hasTR: false, extra: true, src: x.src || "",
    });
  });
  return pts;
}
export const FEED_HEX = ["49b9a4", "e0ab55", "8fb3ff", "e58076"];
/** ترتيب كل مغذي على امتداد المسار (أقرب جار بدءًا من أقصى الجنوب) */
export function feeders(pts: GeoPt[]): Feeder[] {
  const g: Record<string, GeoPt[]> = {};
  pts.forEach((q) => { (g[q.feeder || "—"] = g[q.feeder || "—"] || []).push(q); });
  const out: Feeder[] = [];
  Object.keys(g).sort().forEach((f, fi) => {
    if (f === EXTRA_FEEDER) {
      out.push({ name: f, pts: g[f].map((q) => ({ ...q, seg: 0 })), len: 0, color: "#b08ee8", idx: out.length, noRoute: true });
      return;
    }
    const left = g[f].slice();
    left.sort((a, b) => a.lat - b.lat);
    const chain = [left.shift() as GeoPt];
    while (left.length) {
      const last = chain[chain.length - 1];
      let bi = 0, bd = 1e18;
      left.forEach((q, i) => { const d = hav(last, q); if (d < bd) { bd = d; bi = i; } });
      chain.push(left.splice(bi, 1)[0]);
    }
    let len = 0;
    chain.forEach((q, i) => { q.seg = i ? hav(chain[i - 1], q) : 0; len += q.seg; });
    out.push({ name: f, pts: chain, len, color: ["#49b9a4", "#e0ab55", "#8fb3ff", "#e58076"][fi % 4], idx: fi });
  });
  return out;
}

/* ═══════ تعارض الإحداثيات بين ملفين لنفس الوحدة (> 300 م يُبقي الأول) ═══════ */
export interface GeoConflict { id: string; a: string; aSrc: string; b: string; bSrc: string; km: number }
export function setUnitGps(q: RmuRow, lat: number, lon: number, src: string, conflicts: GeoConflict[]): boolean {
  const g = (+lat).toFixed(6) + "," + (+lon).toFixed(6);
  if (!q.gps) { q.gps = g; q.gpsSrc = src || ""; return true; }
  const m = String(q.gps).match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (!m) { q.gps = g; q.gpsSrc = src || ""; return true; }
  const d = Math.hypot((+m[1] - lat) * 111.32, (+m[2] - lon) * 111.32 * Math.cos((lat * Math.PI) / 180)); // كم
  if (d > 0.3 && !conflicts.some((c) => c.id === q.rmu && c.b === g)) {
    conflicts.push({ id: q.rmu, a: q.gps, aSrc: q.gpsSrc || "—", b: g, bSrc: src || "—", km: Math.round(d * 10) / 10 });
  }
  return false;
}

/* ═══════ تفاصيل المعدة (مصدر واحد للبالون والبطاقة وKML) ═══════ */
export interface UDet {
  wo: string; proj: string; site: string; admin: string; sector: string; contractor: string;
  unit: string; type: string; tr: string; feeder: string; relay: string; model: string; set: boolean; ratio: string; ohm: string;
  lat: number; lon: number; E: number; N: number; zone: number; seg: number; extra: boolean; src: string;
}
export function uDet(p: Project, q: GeoPt, contractorName: string): UDet {
  return {
    wo: String(p.wo || "").trim(), proj: p.name || "", site: p.site || "", admin: p.admin || "", sector: p.sector || "", contractor: contractorName,
    unit: q.id, type: q.type || "", tr: q.hasTR ? q.tr || "TR" : "", feeder: q.feeder || "", relay: q.relay || "", model: q.model || "",
    set: !!q.set, ratio: q.ratio || "", ohm: q.ohm || "", lat: q.lat, lon: q.lon, E: q.E, N: q.N, zone: q.zone, seg: +(q.seg || 0),
    extra: !!q.extra, src: q.src || "",
  };
}
const nfp = (n: number, d = 0) => (isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export function detRows(d: UDet, T: Ctx["T"]): [string, string, boolean][] {
  const R: [string, string, boolean][] = [];
  const add = (k: string, v: string | number | null | undefined, m?: boolean) => { if (v === null || v === undefined || v === "") return; R.push([k, String(v), !!m]); };
  add(T("أمر العمل", "Work order"), d.wo || "—", true);
  add(T("المشروع", "Project"), d.proj || "—");
  add(T("المقاول", "Contractor"), d.contractor || "—");
  add(T("الموقع", "Site"), d.site);
  add(T("الإدارة / القطاع", "Admin / Sector"), [d.admin, d.sector].filter(Boolean).join(" · "));
  add(T("المغذي", "Feeder"), d.feeder || "—");
  add(T("نوع الوحدة", "Unit type"), d.extra ? T("نقطة إحداثي مستوردة", "Imported geo point") : "RMU " + (d.type || "—") + (d.tr ? " + " + d.tr : ""));
  if (!d.extra) {
    add(T("المحول", "Transformer"), d.tr || T("بدون", "none"));
    add(T("الريلاي", "Relay"), [d.relay, d.model].filter((v) => v && v !== "—").join(" · ") || "—");
    add(T("نسبة CT", "CT ratio"), d.ratio || "—", true);
    add(T("مقاومة التأريض", "Earth resistance"), d.ohm !== "" ? d.ohm + " Ω" : "—", true);
  }
  if (d.extra && d.src) add(T("مصدر الإحداثي", "Coordinate source"), d.src);
  add("WGS84 (Lat, Lon)", d.lat.toFixed(6) + ", " + d.lon.toFixed(6), true);
  add("UTM " + d.zone + "N", "E " + nfp(d.E, 2) + " · N " + nfp(d.N, 2), true);
  if (d.seg) add(T("من الوحدة السابقة", "From previous unit"), nfp(Math.round(d.seg)) + " m", true);
  return R;
}

/* ═══════ ملفات التصدير ═══════ */
const ascii = (s: unknown) => String(s || "").replace(/[^\x20-\x7E]/g, "").trim();
const KX = (s: unknown) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
const KCOL = (hex: string) => "ff" + hex.slice(4, 6) + hex.slice(2, 4) + hex.slice(0, 2);
const KSH = "https://maps.google.com/mapfiles/kml/shapes/";
const KICON: Record<string, string> = { c: KSH + "placemark_circle.png", s: KSH + "square.png", t: KSH + "triangle.png", d: KSH + "open-diamond.png" };
const KSCALE: Record<string, number> = { c: 1.15, s: 1.2, t: 1.3, d: 1.05 };
const kKind = (q: GeoPt) => (q.extra ? "d" : q.hasTR ? "t" : q.type === "4W" ? "s" : "c");
const hx = (c: string) => String(c || "").replace("#", "");

function kStyles(pfx: string, hex: string): string {
  return Object.keys(KICON).map((k) => {
    const balloon = `<BalloonStyle><bgColor>ffF4F8F7</bgColor><textColor>ff10222a</textColor>
      <text>$[description]</text><displayMode>default</displayMode></BalloonStyle>`;
    return `
  <Style id="n_${pfx}_${k}">
    <IconStyle><color>${KCOL(hex)}</color><colorMode>normal</colorMode><scale>${KSCALE[k]}</scale>
      <Icon><href>${KICON[k]}</href></Icon><hotSpot x="0.5" y="0.5" xunits="fraction" yunits="fraction"/></IconStyle>
    <LabelStyle><color>${KCOL(hex)}</color><scale>0.85</scale></LabelStyle>
    ${balloon}</Style>
  <Style id="h_${pfx}_${k}">
    <IconStyle><color>ffffffff</color><colorMode>normal</colorMode><scale>${(KSCALE[k] * 1.65).toFixed(2)}</scale>
      <Icon><href>${KICON[k]}</href></Icon><hotSpot x="0.5" y="0.5" xunits="fraction" yunits="fraction"/></IconStyle>
    <LabelStyle><color>ffffffff</color><scale>1.05</scale></LabelStyle>
    ${balloon}</Style>
  <StyleMap id="m_${pfx}_${k}">
    <Pair><key>normal</key><styleUrl>#n_${pfx}_${k}</styleUrl></Pair>
    <Pair><key>highlight</key><styleUrl>#h_${pfx}_${k}</styleUrl></Pair></StyleMap>`;
  }).join("");
}
function kBalloon(d: UDet, hex: string, ctx: Ctx): string {
  const { T, lang } = ctx;
  const rows = detRows(d, T).map(([k, v, m]) =>
    `<tr><td style="padding:4px 10px;color:#5d6f74;font-size:11px;white-space:nowrap;border-top:1px solid #e2eae9">${KX(k)}</td>
      <td style="padding:4px 10px;color:#10222a;font-size:12.5px;font-weight:bold;border-top:1px solid #e2eae9${m ? ";font-family:Consolas,monospace;direction:ltr" : ""}">${KX(v)}</td></tr>`).join("");
  const st = d.extra ? "" : d.set
    ? `<span style="background:#dff3e4;color:#1d7a3d;padding:2px 8px;border-radius:9px;font-size:10.5px;font-weight:bold">${KX(T("الضبط مكتمل", "Setting done"))}</span>`
    : `<span style="background:#fdeed4;color:#8a5b12;padding:2px 8px;border-radius:9px;font-size:10.5px;font-weight:bold">${KX(T("بانتظار الضبط", "Setting pending"))}</span>`;
  const kind = d.extra ? KX(T("نقطة إحداثي", "Geo point")) : "RMU " + KX(d.type || "");
  const base = `<div style="font-family:Tahoma,Segoe UI,Arial,sans-serif;direction:${lang === "ar" ? "rtl" : "ltr"};min-width:300px;max-width:400px">
  <div style="background:#${hx(hex)};padding:9px 12px;border-radius:6px 6px 0 0">
    <div style="font:bold 16px Consolas,monospace;color:#08201c;direction:ltr">${KX(d.unit)}
      <span style="font:bold 10px Tahoma;background:rgba(0,0,0,.18);color:#08201c;padding:2px 7px;border-radius:9px;vertical-align:3px">${kind}</span></div>
    <div style="font-size:11.5px;color:#07231d;margin-top:3px;font-weight:bold">${KX(d.contractor || "—")}</div></div>
  ${st ? `<div style="padding:7px 12px 0;background:#f4f8f7">${st}</div>` : ""}
  <table style="border-collapse:collapse;width:100%;background:#f4f8f7">${rows}</table>
  <div style="padding:8px 12px;background:#e9f1ef;border-radius:0 0 6px 6px;font-size:11px">
    <a href="https://www.google.com/maps/search/?api=1&amp;query=${d.lat},${d.lon}">Google Maps</a> &#183;
    <a href="https://www.google.com/maps/@?api=1&amp;map_action=pano&amp;viewpoint=${d.lat},${d.lon}">Street View</a>
    <div style="margin-top:5px;color:#6a7d80;font-size:10px">${KX(T("الشركة السعودية للكهرباء — تحويل شبكة هوائية إلى أرضية", "Saudi Electricity Company — overhead to underground conversion"))}</div></div>
  </div>`;
  return base.replace(/<\/div>\s*$/, `<div style="padding:5px 12px 9px;background:#e9f1ef;color:#44595c;font-size:10px;text-align:center">
          ${KX(PM_ROLE_EN)} &#183; <b>${KX(PM_NAME)}</b></div></div>`);
}
function kExtData(d: UDet): string {
  const e: [string, string | number][] = [["work_order", d.wo], ["project", d.proj], ["contractor", d.contractor], ["site", d.site],
    ["admin", d.admin], ["sector", d.sector], ["unit", d.unit], ["unit_type", d.extra ? "POINT" : "RMU " + d.type],
    ["transformer", d.tr], ["feeder", d.feeder], ["relay", d.relay], ["relay_model", d.model],
    ["setting_done", d.extra ? "" : d.set ? "YES" : "NO"], ["ct_ratio", d.ratio], ["earth_ohm", d.ohm],
    ["latitude", d.lat.toFixed(6)], ["longitude", d.lon.toFixed(6)],
    ["utm_zone", d.zone + "N"], ["utm_e", d.E.toFixed(2)], ["utm_n", d.N.toFixed(2)]];
  return "<ExtendedData>" + e.filter((r) => r[1] !== "" && r[1] != null).map((r) => `<Data name="${r[0]}"><value>${KX(r[1])}</value></Data>`).join("") + "</ExtendedData>";
}
function kPlacemark(pfx: string, d: UDet, q: GeoPt, hex: string, name: string, ctx: Ctx): string {
  const { T } = ctx;
  return `<Placemark><name>${KX(name)}</name><styleUrl>#m_${pfx}_${kKind(q)}</styleUrl>
      <Snippet maxLines="2">${KX((d.wo ? T("أمر عمل ", "W/O ") + d.wo + " · " : "") + (d.extra ? T("نقطة", "Point") : "RMU " + d.type) + (d.tr ? " + " + d.tr : "") + " · " + d.contractor)}</Snippet>
      <description><![CDATA[${kBalloon(d, hex, ctx)}]]></description>
      ${kExtData(d)}
      <Point><extrude>0</extrude><altitudeMode>clampToGround</altitudeMode><coordinates>${q.lon},${q.lat},0</coordinates></Point></Placemark>`;
}
const tagDoc = (s: string, lang: Lang) => s.replace(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/, (_m, g) => `<description><![CDATA[${g} · ${pmLine(lang)}]]></description>`);

/** KML لمشروع واحد: رمز متفاعل + بالون تفاصيل (يحمل اسم المقاول). */
export function kmlDoc(p: Project, contractorName: string, ctx: Ctx): string {
  const { T } = ctx;
  const pts = geoPoints(p), fs = feeders(pts);
  const styles = fs.map((f, i) => `  <Style id="line${i}"><LineStyle><color>${KCOL(hx(f.color))}</color><width>4</width></LineStyle></Style>` + kStyles("f" + i, hx(f.color))).join("");
  const folders = fs.map((f, i) => `
  <Folder><name>${KX(f.name)} — ${f.pts.length} ${f.noRoute ? KX(T("نقطة", "points")) : "RMU"}${f.noRoute ? "" : " — " + Math.round(f.len) + " m"}</name><open>1</open>
    ${f.noRoute ? "" : `<Placemark><name>${KX(f.name)} ${KX(T("مسار", "route"))}</name><styleUrl>#line${i}</styleUrl>
      <description><![CDATA[${KX(T("تسلسل خط مستقيم بين الوحدات", "Straight-line sequence between units"))}: ${Math.round(f.len)} m]]></description>
      <LineString><tessellate>1</tessellate><coordinates>${f.pts.map((q) => `${q.lon},${q.lat},0`).join(" ")}</coordinates></LineString></Placemark>`}
    ${f.pts.map((q) => kPlacemark("f" + i, uDet(p, q, contractorName), q, hx(f.color), q.id + (q.hasTR ? " + " + q.tr : ""), ctx)).join("\n    ")}
  </Folder>`).join("");
  return tagDoc(`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${KX(p.name)} — ${KX(p.wo)}</name>
  <description><![CDATA[${KX(p.site || "")} · ${KX(T("المقاول", "Contractor"))}: ${KX(contractorName)} · WGS84 / UTM ${pts[0] ? pts[0].zone : 38}N]]></description>
  <open>1</open>${styles}${folders}
</Document>
</kml>`, ctx.lang);
}
export function csvDoc(p: Project): string {
  const pts = geoPoints(p), fs = feeders(pts);
  const rows: (string | number)[][] = [["Name", "Latitude", "Longitude", "Feeder", "Type", "TR", "Relay", "Setting", "Earth_ohm", "UTM_E", "UTM_N", "UTM_Zone", "Seq"]];
  fs.forEach((f) => f.pts.forEach((q, i) => rows.push([q.id, q.lat.toFixed(6), q.lon.toFixed(6), q.feeder, "RMU " + q.type, q.tr || "", q.relay + " " + q.model, q.set ? "YES" : "NO", q.ohm, q.E.toFixed(2), q.N.toFixed(2), q.zone + "N", i + 1])));
  const base = "﻿" + rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",")).join("\r\n");
  return base + "\r\n\r\n" + `"${PM_ROLE_EN}","${PM_NAME}"`;
}
export function geojsonDoc(p: Project, exportedAt = new Date().toISOString()): string {
  const pts = geoPoints(p), fs = feeders(pts), feats: unknown[] = [];
  fs.forEach((f) => {
    feats.push({ type: "Feature", properties: { name: f.name + " route", feeder: f.name, length_m: Math.round(f.len) }, geometry: { type: "LineString", coordinates: f.pts.map((q) => [q.lon, q.lat]) } });
    f.pts.forEach((q) => feats.push({ type: "Feature", properties: { name: q.id, feeder: q.feeder, type: q.type, tr: q.tr || "", relay: q.relay, setting: q.set, earth_ohm: +q.ohm, utm_e: +q.E.toFixed(2), utm_n: +q.N.toFixed(2) }, geometry: { type: "Point", coordinates: [q.lon, q.lat] } }));
  });
  const o: Record<string, unknown> = { type: "FeatureCollection", name: p.name, features: feats };
  o.properties = { project_manager: PM_NAME, role: PM_ROLE_EN, platform: "Contractor Project Portfolio", exported: exportedAt };
  return JSON.stringify(o, null, 1);
}
/** DXF R12 بإحداثيات UTM حقيقية (متر) */
export function dxfDoc(p: Project): string {
  const pts = geoPoints(p), fs = feeders(pts), zone = pts[0] ? pts[0].zone : 38, out: string[] = [];
  const w = (...a: (string | number)[]) => { for (let i = 0; i < a.length; i += 2) { out.push(String(a[i])); out.push(String(a[i + 1])); } };
  const f3 = (n: number) => Number(n).toFixed(3);
  const layers: [string, number][] = [["RMU-3W", 4], ["RMU-4W", 5], ["TR", 1], ["TEXT", 7], ["COORD", 8], ["GRID", 252], ["FRAME", 7], ["NORTH", 7]];
  fs.forEach((f, i) => layers.push(["MV-" + ascii(f.name).replace(/\s+/g, "_"), [4, 2, 5, 1][i % 4]]));
  const minE = Math.min(...pts.map((q) => q.E)) - 400, maxE = Math.max(...pts.map((q) => q.E)) + 400;
  const minN = Math.min(...pts.map((q) => q.N)) - 400, maxN = Math.max(...pts.map((q) => q.N)) + 400;
  w(0, "SECTION", 2, "HEADER", 9, "$ACADVER", 1, "AC1009", 9, "$INSBASE", 10, "0.0", 20, "0.0", 30, "0.0",
    9, "$EXTMIN", 10, f3(minE), 20, f3(minN), 30, "0.0", 9, "$EXTMAX", 10, f3(maxE), 20, f3(maxN), 30, "0.0",
    9, "$LIMMIN", 10, f3(minE), 20, f3(minN), 9, "$LIMMAX", 10, f3(maxE), 20, f3(maxN), 9, "$TEXTSIZE", 40, "5.0", 0, "ENDSEC");
  w(0, "SECTION", 2, "TABLES",
    0, "TABLE", 2, "LTYPE", 70, "1", 0, "LTYPE", 2, "CONTINUOUS", 70, "0", 3, "Solid line", 72, "65", 73, "0", 40, "0.0", 0, "ENDTAB",
    0, "TABLE", 2, "LAYER", 70, String(layers.length));
  layers.forEach(([n, c]) => w(0, "LAYER", 2, n, 70, "0", 62, String(c), 6, "CONTINUOUS"));
  w(0, "ENDTAB", 0, "TABLE", 2, "STYLE", 70, "1", 0, "STYLE", 2, "STANDARD", 70, "0", 40, "0.0", 41, "1.0", 50, "0.0", 71, "0", 42, "2.5", 3, "txt", 4, "", 0, "ENDTAB", 0, "ENDSEC");
  w(0, "SECTION", 2, "ENTITIES");
  const line = (L: string, x1: number, y1: number, x2: number, y2: number) => w(0, "LINE", 8, L, 10, f3(x1), 20, f3(y1), 30, "0.0", 11, f3(x2), 21, f3(y2), 31, "0.0");
  const text = (L: string, x: number, y: number, h: number, s: string, rot = 0) => w(0, "TEXT", 8, L, 10, f3(x), 20, f3(y), 30, "0.0", 40, f3(h), 1, ascii(s) || "-", 50, f3(rot));
  const poly = (L: string, vs: [number, number][]) => { w(0, "POLYLINE", 8, L, 66, "1", 70, "1", 10, "0.0", 20, "0.0", 30, "0.0"); vs.forEach(([x, y]) => w(0, "VERTEX", 8, L, 10, f3(x), 20, f3(y), 30, "0.0")); w(0, "SEQEND", 8, L); };
  const g = 500;
  for (let e = Math.ceil(minE / g) * g; e <= maxE; e += g) { line("GRID", e, minN, e, maxN); text("GRID", e + 4, minN + 6, 8, "E " + e, 90); }
  for (let n = Math.ceil(minN / g) * g; n <= maxN; n += g) { line("GRID", minE, n, maxE, n); text("GRID", minE + 6, n + 4, 8, "N " + n); }
  poly("FRAME", [[minE, minN], [maxE, minN], [maxE, maxN], [minE, maxN]]);
  const tbx = minE + 10, tby = minN + 20;
  text("TEXT", tbx, tby + 72, 16, "OH TO UG CONVERSION - W/O " + ascii(p.wo));
  text("TEXT", tbx, tby + 50, 10, "SITE: " + (ascii(p.site) || "NAJRAN") + "  |  RMU: " + pts.length + "  |  FEEDERS: " + fs.map((f) => ascii(f.name)).join(", "));
  text("TEXT", tbx, tby + 32, 9, "COORDINATES: WGS84 / UTM ZONE " + zone + "N  -  UNITS: METRES");
  text("TEXT", tbx, tby + 15, 9, fs.map((f) => ascii(f.name) + " ROUTE " + Math.round(f.len) + " m").join("   "));
  text("TEXT", tbx, tby, 7, "Generated from project coordinates - straight line between consecutive units, not trench path");
  const nx = maxE - 60, ny = maxN - 120;
  line("NORTH", nx, ny, nx, ny + 80); line("NORTH", nx, ny + 80, nx - 14, ny + 50); line("NORTH", nx, ny + 80, nx + 14, ny + 50); text("NORTH", nx - 6, ny + 90, 18, "N");
  fs.forEach((f) => {
    if (f.noRoute) return;
    const L = "MV-" + ascii(f.name).replace(/\s+/g, "_");
    for (let i = 1; i < f.pts.length; i++) {
      const a = f.pts[i - 1], b = f.pts[i];
      line(L, a.E, a.N, b.E, b.N);
      const mx = (a.E + b.E) / 2, my = (a.N + b.N) / 2, ang = (Math.atan2(b.N - a.N, b.E - a.E) * 180) / Math.PI;
      const rot = ang > 90 || ang < -90 ? ang + 180 : ang;
      text(L, mx + 6, my + 6, 5, Math.round(b.seg || 0) + " m", rot);
    }
  });
  fs.forEach((f) => {
    const side = f.idx % 2 === 0 ? 1 : -1;
    f.pts.forEach((q) => {
      w(0, "POINT", 8, q.type === "3W" ? "RMU-3W" : "RMU-4W", 10, f3(q.E), 20, f3(q.N), 30, "0.0");
      if (q.type === "3W") w(0, "CIRCLE", 8, "RMU-3W", 10, f3(q.E), 20, f3(q.N), 30, "0.0", 40, "8.0");
      else poly("RMU-4W", [[q.E - 8, q.N - 8], [q.E + 8, q.N - 8], [q.E + 8, q.N + 8], [q.E - 8, q.N + 8]]);
      if (q.hasTR) { const tx = q.E + side * 22; poly("TR", [[tx - 7, q.N - 6], [tx + 7, q.N - 6], [tx, q.N + 8]]); }
      const lx = side > 0 ? q.E + (q.hasTR ? 34 : 14) : q.E - (q.hasTR ? 34 : 14) - 110;
      text("TEXT", lx, q.N + 2, 8, q.id + " (" + q.type + (q.hasTR ? "+TR" : "") + ")");
      text("COORD", lx, q.N - 9, 4.5, "E " + q.E.toFixed(2) + "  N " + q.N.toFixed(2));
      text("COORD", lx, q.N - 16, 4.5, q.lat.toFixed(6) + ", " + q.lon.toFixed(6));
    });
  });
  w(0, "ENDSEC", 0, "EOF");
  return out.join("\r\n");
}

/* ═══════ تجميع كل المشاريع (Google Earth) ═══════ */
export const GEO_HEX = ["49b9a4", "e0ab55", "8fb3ff", "e58076", "b08ee8", "5fc27e", "d99ac0", "9fb7c9"];
export interface ProjGeo { i: number; id: string; wo: string; name: string; site: string; hex: string; pts: GeoPt[]; chain: GeoPt[]; route: number; n: number }
export function allProjPts(projects: Project[]): ProjGeo[] {
  return projects.map((p, i) => {
    const pts = geoPoints(p);
    const fs = feeders(pts).filter((f) => !f.noRoute);
    const route = fs.reduce((s, f) => s + f.len, 0);
    return { i, id: p.id, wo: String(p.wo || "").trim(), name: p.name, site: p.site, hex: GEO_HEX[i % GEO_HEX.length], pts, chain: fs.flatMap((f) => f.pts), route, n: pts.length };
  });
}
/** اسم المعلَم: رقم أمر العمل فوق المعدة ثم الإحداثي */
export function gaLabel(g: ProjGeo, q: GeoPt, coord: boolean, T: Ctx["T"]): string {
  const wo = g.wo || T("بلا أمر عمل", "no W/O");
  return coord ? `${wo} · ${q.id} · ${q.lat.toFixed(6)},${q.lon.toFixed(6)}` : `${wo} · ${q.id}`;
}
export function kmlAllDoc(gs: ProjGeo[], projects: Project[], contractorOf: (p: Project) => string, title: string, coord: boolean, ctx: Ctx): string {
  const { T } = ctx;
  const styles = gs.map((g, i) => `  <Style id="gl${i}"><LineStyle><color>${KCOL(g.hex)}</color><width>4</width></LineStyle></Style>` + kStyles("g" + i, g.hex)).join("");
  const folders = gs.map((g, i) => {
    const p = projects[g.i];
    const cn = contractorOf(p);
    return `
  <Folder><name>${KX(T("أمر عمل ", "W/O ") + (g.wo || "—") + " — " + g.name)}</name><open>0</open>
    <description><![CDATA[${KX(g.site || "")} · ${KX(T("المقاول", "Contractor"))}: ${KX(cn)} · ${g.n} ${KX(T("نقطة", "points"))} · ${KX(T("مسار", "route"))} ${Math.round(g.route)} m]]></description>
    ${g.chain.length > 1 ? `<Placemark><name>${KX((g.wo || g.name) + " — " + T("المسار", "route"))}</name><styleUrl>#gl${i}</styleUrl>
      <LineString><tessellate>1</tessellate><coordinates>${g.chain.map((q) => `${q.lon},${q.lat},0`).join(" ")}</coordinates></LineString></Placemark>` : ""}
    ${g.pts.map((q) => kPlacemark("g" + i, uDet(p, q, cn), q, g.hex, gaLabel(g, q, coord, T), ctx)).join("\n    ")}
  </Folder>`;
  }).join("");
  return tagDoc(`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <name>${KX(title)}</name>
  <description><![CDATA[${gs.length} ${KX(T("مشروع", "projects"))} · ${gs.reduce((s, g) => s + g.n, 0)} ${KX(T("نقطة بإحداثيات", "geo points"))} · WGS84]]></description>
  <open>1</open>${styles}${folders}
</Document></kml>`, ctx.lang);
}
export function csvAllDoc(gs: ProjGeo[], coord: boolean, T: Ctx["T"]): string {
  const rows: (string | number)[][] = [[T("أمر العمل", "Work order"), T("المشروع", "Project"), T("الوحدة", "Unit"), T("المغذي", "Feeder"),
    T("النوع", "Type"), "Latitude", "Longitude", "E_UTM", "N_UTM", T("الوصف", "Label")]];
  gs.forEach((g) => g.pts.forEach((q) => rows.push([g.wo, g.name, q.id, q.feeder, q.type, q.lat.toFixed(6), q.lon.toFixed(6), q.E.toFixed(2), q.N.toFixed(2), gaLabel(g, q, coord, T)])));
  return "﻿" + rows.map((r) => r.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

/* ═══════ مخطط CAD (SVG بالأمتار، الشمال لأعلى) ═══════ */
export interface CadView { cx: number; cy: number; w: number; h: number; key?: string; fit?: { cx: number; cy: number; w: number; h: number } }
export function cadFitView(pts: GeoPt[], aspect: number, key = ""): CadView {
  const minE = Math.min(...pts.map((q) => q.E)), maxE = Math.max(...pts.map((q) => q.E));
  const minN = Math.min(...pts.map((q) => q.N)), maxN = Math.max(...pts.map((q) => q.N));
  const w = maxE - minE || 500, h = maxN - minN || 500;
  let spanH = h * 1.26, spanW = w * 1.6;
  if (spanW / spanH < aspect) spanW = spanH * aspect; else spanH = spanW / aspect;
  const v = { key, cx: (minE + maxE) / 2, cy: (minN + maxN) / 2, w: spanW, h: spanH };
  return { ...v, fit: { cx: v.cx, cy: v.cy, w: spanW, h: spanH } };
}
export function cadMarkup(pts: GeoPt[], fs: Feeder[], v: CadView, boxW: number, sel: string | null): { viewBox: string; markup: string } {
  const Y = (N: number) => -N;
  const vx = v.cx - v.w / 2, vy = -(v.cy + v.h / 2);
  const px = v.w / (boxW || 600);
  const step = [25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((s) => s / px >= 90) || 5000;
  let g = `<rect x="${vx}" y="${vy}" width="${v.w}" height="${v.h}" fill="#0d171b"/>`;
  const e0 = Math.floor((v.cx - v.w / 2) / step) * step, e1 = v.cx + v.w / 2, n0 = Math.floor((v.cy - v.h / 2) / step) * step, n1 = v.cy + v.h / 2;
  for (let e = e0; e <= e1; e += step) g += `<line x1="${e}" y1="${vy}" x2="${e}" y2="${vy + v.h}" stroke="#1d2e33" stroke-width="${px}"/>
      <text x="${e + 3 * px}" y="${vy + v.h - 8 * px}" fill="#5f7d80" font-size="${10 * px}" font-family="ui-monospace,Consolas,monospace">E ${Math.round(e)}</text>`;
  for (let n = n0; n <= n1; n += step) g += `<line x1="${vx}" y1="${Y(n)}" x2="${vx + v.w}" y2="${Y(n)}" stroke="#1d2e33" stroke-width="${px}"/>
      <text x="${vx + 6 * px}" y="${Y(n) - 3 * px}" fill="#5f7d80" font-size="${10 * px}" font-family="ui-monospace,Consolas,monospace">N ${Math.round(n)}</text>`;
  fs.forEach((f) => {
    if (f.noRoute) return;
    g += `<polyline points="${f.pts.map((q) => q.E + "," + Y(q.N)).join(" ")}" fill="none" stroke="${f.color}" stroke-width="${3 * px}" stroke-linejoin="round" stroke-dasharray="${9 * px} ${4 * px}" opacity=".9"/>`;
  });
  const r = 6 * px;
  fs.forEach((f) => {
    const side = f.idx % 2 === 0 ? 1 : -1;
    f.pts.forEach((q) => {
      const x = q.E, y = Y(q.N), on = q.id === sel;
      const stroke = on ? "#ffffff" : f.color, sw = (on ? 2.6 : 1.6) * px;
      g += q.type === "3W"
        ? `<circle cx="${x}" cy="${y}" r="${r}" fill="#0d171b" stroke="${stroke}" stroke-width="${sw}" data-pt="${escHtml(q.id)}"/>`
        : `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" fill="#0d171b" stroke="${stroke}" stroke-width="${sw}" data-pt="${escHtml(q.id)}"/>`;
      if (q.hasTR) g += `<path d="M${x + side * (r + 9 * px)} ${y - 5 * px} l${5 * px} ${9 * px} l${-10 * px} 0 z" fill="#e58076" pointer-events="none"/>`;
      g += `<text x="${x + side * (r + (q.hasTR ? 20 : 6) * px)}" y="${y + 4 * px}" fill="${on ? "#ffffff" : "#cfe0db"}" font-size="${(on ? 12 : 10.5) * px}" font-weight="${on ? 700 : 400}"
          text-anchor="${side > 0 ? "start" : "end"}" font-family="ui-monospace,Consolas,monospace" pointer-events="none">${escHtml(q.id)}</text>`;
      g += `<circle cx="${x}" cy="${y}" r="${r * 2.2}" fill="transparent" data-pt="${escHtml(q.id)}" style="cursor:pointer"/>`;
    });
  });
  const nx = vx + v.w - 34 * px, ny = vy + 60 * px;
  g += `<path d="M${nx} ${ny - 22 * px} l${9 * px} ${24 * px} l${-9 * px} ${-6 * px} l${-9 * px} ${6 * px} z" fill="#cfe0db"/>
      <text x="${nx}" y="${ny - 28 * px}" fill="#cfe0db" font-size="${12 * px}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace">N</text>`;
  const sb = step, sx = vx + v.w - (sb / px + 30) * px, sy = vy + v.h - 44 * px;
  g += `<rect x="${sx}" y="${sy}" width="${sb / 2}" height="${5 * px}" fill="#cfe0db"/><rect x="${sx + sb / 2}" y="${sy}" width="${sb / 2}" height="${5 * px}" fill="none" stroke="#cfe0db" stroke-width="${px}"/>
      <text x="${sx}" y="${sy - 5 * px}" fill="#cfe0db" font-size="${10 * px}" font-family="ui-monospace,Consolas,monospace">0</text>
      <text x="${sx + sb}" y="${sy - 5 * px}" fill="#cfe0db" font-size="${10 * px}" text-anchor="end" font-family="ui-monospace,Consolas,monospace">${sb} m</text>`;
  return { viewBox: `${vx} ${vy} ${v.w} ${v.h}`, markup: g };
}
export function svgDoc(p: Project, boxW = 1000, boxH = 680): string {
  const pts = geoPoints(p), fs = feeders(pts);
  if (!pts.length) return "";
  const v = cadFitView(pts, boxW / boxH, p.id);
  const { viewBox, markup } = cadMarkup(pts, fs, v, boxW, null);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="1600" height="${Math.round((1600 * v.h) / v.w)}">${markup}</svg>`;
}
