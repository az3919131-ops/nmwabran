import { describe, it, expect } from "vitest";
import golden from "./golden/derive.json";
import { derive, totals, hassiniya, newProject, authorityFor, DEFAULT_FACTORS } from "../src";

const strip = <T extends { at?: string }>(d: T) => { const o = JSON.parse(JSON.stringify(d)); delete o.at; return o; };

describe("محرك الاستنباط يطابق المنصة الحالية (golden)", () => {
  it("مشروع الحصينية: كل الكميات والتكاليف", () => {
    const p = hassiniya();
    expect(strip(p.derived!)).toEqual(golden.hassiniya);
    expect(totals(p)).toEqual(golden.totals);
  });
  it("أرقام مرجعية صريحة للحصينية", () => {
    const d = hassiniya().derived!;
    expect(d.cost.mat).toBeCloseTo(6060521.63, 2);
    expect(d.cost.inst).toBe(2345316);
    expect(d.cost.total).toBeCloseTo(10381209.473049998, 6);
    expect(d.works["304010202"]).toBe(18000);
    expect(d.mats["8114005"]).toBe(18360); // 18000 × 1.02 هالك
    expect(d.works["305020104"]).toBe(19);  // max(وصلات الكروكي 19، ceil(18000/1000)=18)
  });
  for (const k of ["wastePct", "drumLen", "indirectPct", "rodsPerRMU", "elbowPhases", "vlfPerSection"] as const) {
    it("متغير المعامل " + k, () => {
      const vals: Record<string, number> = { wastePct: 5, drumLen: 500, indirectPct: 20, rodsPerRMU: 6, elbowPhases: 2, vlfPerSection: 2 };
      const p = hassiniya(); p.factors[k] = vals[k];
      expect(strip(derive(p))).toEqual((golden as any)["factor_" + k]);
    });
  }
  it("مشروع فارغ", () => {
    expect(strip(derive(newProject("x", "1")))).toEqual(golden.blank);
  });
  it("سلم الصلاحيات حسب نسبة الفرق", () => {
    for (const a of golden.authority) {
      expect(authorityFor(a.pct, "ar")).toBe(a.ar);
      expect(authorityFor(a.pct, "en")).toBe(a.en);
    }
    expect(authorityFor(10, "ar")).toContain("مدير إدارة كهرباء نجران");
    expect(authorityFor(20, "ar")).toContain("مدير إدارة هندسة التوزيع");
    expect(authorityFor(30, "ar")).toContain("نائب رئيس وحدة أعمال التوزيع");
    expect(authorityFor(31, "ar")).toContain("نائب الرئيس التنفيذي");
  });
  it("المعاملات الافتراضية: بكرة 1000م، هالك 2%، غير مباشرة 23.5%", () => {
    expect(DEFAULT_FACTORS.drumLen).toBe(1000);
    expect(DEFAULT_FACTORS.wastePct).toBe(2);
    expect(DEFAULT_FACTORS.indirectPct).toBe(23.5);
  });
});
