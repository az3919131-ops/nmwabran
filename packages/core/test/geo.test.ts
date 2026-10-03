import { describe, it, expect } from "vitest";
import stats from "./golden/stats.json";
import ex from "./golden/exports.json";
import geo from "./golden/geo.json";
import {
  hassiniya, geoPoints, feeders, toUTM, utmToLL, hav, kmlDoc, csvDoc, geojsonDoc, dxfDoc, allProjPts, kmlAllDoc, csvAllDoc, makeT, DEFAULT_CATALOG, pmLine,
} from "../src";

const ws = (s: string) => s.replace(/\s+/g, " ").trim();
const CN = "شركة ناصر مانع وبران وشركاه";

describe("الجيو والإحداثيات (golden)", () => {
  const p = hassiniya();
  it("نقاط المشروع الـ29", () => {
    const pts = geoPoints(p);
    expect(pts.length).toBe(29);
    expect(pts.map((q) => ({ id: q.id, lat: q.lat, lon: q.lon, E: q.E, N: q.N, zone: q.zone, type: q.type, hasTR: q.hasTR, feeder: q.feeder }))).toEqual(stats.geoPoints);
  });
  it("المغذيات وأطوال المسارات", () => {
    const fs = feeders(geoPoints(p));
    expect(fs.map((f) => ({ name: f.name, len: f.len, n: f.pts.length, color: f.color, idx: f.idx, chain: f.pts.map((q) => q.id), segs: f.pts.map((q) => q.seg) }))).toEqual(stats.feeders);
  });
  it("UTM/haversine", () => {
    for (const u of stats.utm) { const r = toUTM(u.la, u.lo); expect(r.E).toBeCloseTo(u.E, 6); expect(r.N).toBeCloseTo(u.N, 6); expect(r.zone).toBe(u.zone); }
    expect(hav({ lat: 17.69, lon: 44.45 }, { lat: 17.75, lon: 44.5 })).toBeCloseTo(stats.hav, 6);
    const ll = utmToLL(337000, 1956000, 38);
    expect(ll.lat).toBeCloseTo(stats.utmToLL.lat, 8); expect(ll.lon).toBeCloseTo(stats.utmToLL.lon, 8);
  });
  const ctx = { lang: "ar" as const, T: makeT("ar"), cat: DEFAULT_CATALOG };
  it("KML/CSV/GeoJSON/DXF لمشروع واحد", () => {
    expect(ws(kmlDoc(p, CN, ctx))).toBe(ws(ex.kml));
    expect(csvDoc(p)).toBe(ex.csv);
    expect(geojsonDoc(p, "X").replace(/"exported":\s*"[^"]*"/, '"exported":"X"')).toBe(ex.geojson.replace(/"exported":\s*"[^"]*"/, '"exported":"X"'));
    expect(dxfDoc(p)).toBe(ex.dxf);
  });
  it("KML وCSV المجمّعان", () => {
    const projects = [p];
    const gs = allProjPts(projects).filter((g) => g.n);
    expect(ws(kmlAllDoc(gs, projects, () => CN, "تجميع مشاريع " + CN, true, ctx))).toBe(ws(ex.kmlAll));
    expect(csvAllDoc(gs, true, ctx.T)).toBe(ex.csvAll);
  });
  it("توقيع مدير المشاريع في كل مخرج", () => {
    expect(ex.pmLine).toBe(pmLine("ar"));
    expect(ex.kml).toContain("Project manager");
    expect(kmlDoc(p, CN, ctx)).toContain("Eng. Ahmed Zahran");
    expect(csvDoc(p)).toContain("Eng. Ahmed Zahran");
    expect(geojsonDoc(p)).toContain("Eng. Ahmed Zahran");
  });
});
