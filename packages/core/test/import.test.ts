import { describe, it, expect } from "vitest";
import golden from "./golden/import.json";
import idg from "./golden/identity.json";
import geog from "./golden/geo.json";
import { SCENARIOS, IDENT_ROWS, IDENT_NAMES } from "./fixtures/import-scenarios.mjs";
import {
  newProject, cloneCatalog, makeT, importSheets, bookGeo, sheetKind, identityFromRows, identityFromText, identityFromName, woState, near, normCode,
  cellPair, dms, textGeo, scanText, readGeoText, DEFAULT_CATALOG, type FileRec, type GeoConflict, type SheetData,
} from "../src";

const T = makeT("ar");
const mkEnv = () => ({ p: newProject("x", "234022308"), cat: cloneCatalog(), T, conflicts: [] as GeoConflict[], guard: true });
const rec = (): FileRec => ({ id: "F1", name: "f.xlsx", ext: "xlsx", size: 0, type: "", kind: "data", imported: false, rows: 0, at: "", rep: [] });

describe("محرك الاستيراد يطابق المنصة الحالية (golden)", () => {
  for (const sc of SCENARIOS) {
    it("سيناريو: " + sc.name, () => {
      const g = (golden as any)[sc.name];
      const env = mkEnv(); const r = rec();
      const rep = importSheets(env, r, sc.sheets as SheetData[]);
      expect(rep).toEqual(g.rep);
      expect(r.imported).toBe(g.imported);
      expect(r.rows).toBe(g.rows);
      expect(env.p.boq).toEqual(g.boq);
      expect(env.p.mat).toEqual(g.mat);
      expect(env.p.rmus).toEqual(g.rmus);
      expect(env.p.sheets).toEqual(g.sheets);
      expect(!!env.p.derived).toBe(g.derived);
      expect(bookGeo(sc.sheets as SheetData[], "f.xlsx", T)).toEqual(g.bookGeo);
      expect(env.conflicts).toEqual(g.conf);
      expect(env.cat.materials.filter((m) => m.added).map((m) => m.c).concat(env.cat.works.filter((w) => w.added).map((w) => w.c))).toEqual(g.added);
      expect(sc.sheets.map((sh) => sheetKind(sh as SheetData, "234022308"))).toEqual(g.kinds);
    });
  }
  it("المكتبة الافتراضية لا تتلوث بالبنود المضافة", () => {
    const env = mkEnv();
    importSheets(env, rec(), SCENARIOS.find((s) => s.name === "boq-only")!.sheets as SheetData[]);
    expect(env.cat.works.some((w) => w.c === "301019999")).toBe(true);
    expect(DEFAULT_CATALOG.works.some((w) => w.c === "301019999")).toBe(false);
  });
  it("تعارض الإحداثيات (> 300م) يُبقي الأول ويعرض بطاقة تعارض", () => {
    const env = mkEnv();
    const a: SheetData = { name: "A", rows: [["unit", "lat", "lon"], ["R101552", 17.693713, 44.459428], ["R101553", 17.69, 44.45], ["R101554", 17.7, 44.46]] };
    const b: SheetData = { name: "B", rows: [["unit", "lat", "lon"], ["R101552", 17.8, 44.6], ["R101553", 17.69001, 44.45001], ["R101554", 17.7, 44.46]] };
    importSheets(env, rec(), [a]); importSheets(env, rec(), [b]);
    const q = env.p.rmus.find((r) => r.rmu === "R101552")!;
    expect(q.gps).toBe("17.693713,44.459428");       // الأول يبقى
    expect(env.conflicts).toHaveLength(1);
    expect(env.conflicts[0]).toMatchObject({ id: "R101552", a: "17.693713,44.459428", b: "17.800000,44.600000" });
    expect(env.conflicts[0].km).toBeGreaterThan(10);
  });
});

describe("هوية أمر العمل (golden)", () => {
  it("من الصفوف", () => {
    for (const k of Object.keys(IDENT_ROWS)) expect(identityFromRows((IDENT_ROWS as any)[k], DEFAULT_CATALOG)).toEqual((idg.rows as any)[k]);
  });
  it("من اسم الملف والنص", () => {
    for (const n of IDENT_NAMES) expect(identityFromName(n)).toEqual((idg.names as any)[n]);
    const texts: Record<string, string> = {
      labelled: "أمر العمل: 234022308\nاسم المشروع: مشروع الحصينية\nالموقع: طريق الحصينية نجران\nالقطاع: الجنوبي",
      uds: "رقم الطلب: 234099001\nالموضوع: ثقب أفقي",
      freq: "مشروع 234022308 ... 234022308 ... 234011111",
    };
    for (const k of Object.keys(texts)) expect(identityFromText(texts[k], DEFAULT_CATALOG)).toEqual((idg.text as any)[k]);
  });
  it("حالات المطابقة: مطابق / مختلف / طلب UDS مرتبط / اعتمد / ترجيحي", () => {
    for (const c of idg.states) expect(woState({ wo: c.wo }, c.id as any)).toBe(c.state);
    expect(woState({ wo: "234022308" }, { wo: "234011111" })).toBe("mismatch");
    expect(woState({ wo: "234022308" }, { wo: "234099001", woReq: true })).toBe("related"); // طلب فرعي ≠ تعارض
    expect(woState({ wo: "" }, { wo: "234011111" })).toBe("adopt");
  });
  it("التقارب النصي وتطبيع الأكواد", () => {
    for (const c of idg.near) expect(near(c.a, c.b)).toBe(c.r);
    for (const c of idg.normCode) expect(normCode(c.c)).toBe(c.r);
  });
});

describe("التقاط الإحداثيات (golden)", () => {
  it("cellPair / dms", () => {
    for (const c of geog.cellPair) expect(cellPair(c.v)).toEqual(c.r);
    for (const c of geog.dms) expect(dms(c.v)).toEqual(c.r);
  });
  it("textGeo / scanText / readGeoText", () => {
    expect(textGeo("نقطة 17.693713, 44.459428 وأخرى lat: 17.7 lon: 44.5 و E: 337000 N: 1956000 و 5.12345, 6.12345", "t.txt")).toEqual(geog.textGeo);
    expect(scanText("R101552 عند 17.693713, 44.459428 والبند 8111005 و 908114005", "t", "")).toEqual(geog.scanText);
    expect(readGeoText('<kml><Placemark><name>A</name><Point><coordinates>44.45,17.69,0</coordinates></Point></Placemark></kml>', "k.kml")).toEqual(geog.readGeo);
  });
});
