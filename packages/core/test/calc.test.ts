import { describe, it, expect } from "vitest";
import stats from "./golden/stats.json";
import { hassiniya, projStats, projState, firmStats, deckStats, invRows, invoiceCalc, wagesCalc, dashSummary, DEFAULT_CATALOG } from "../src";

const noT = <T extends { t?: unknown }>(s: T) => { const o: any = { ...s }; delete o.t; return o; };

describe("الحسابات المجمّعة تطابق المنصة الحالية (golden)", () => {
  const p = hassiniya();
  it("projStats / projState / firmStats", () => {
    expect(noT(projStats(p))).toEqual(stats.projStats);
    expect(noT(projState(p))).toEqual(stats.projState);
    expect(firmStats([p])).toEqual(stats.firmStats);
  });
  it("deckStats", () => {
    const s = deckStats(p);
    const g = stats.deckStats;
    for (const k of Object.keys(g) as (keyof typeof g)[]) expect((s as any)[k]).toBeCloseTo(g[k] as number, 6);
  });
  it("بنود الفاتورة (أجور ومواد)", () => {
    const r = invRows(p, DEFAULT_CATALOG, "ar");
    expect({ works: r.works, mats: r.mats }).toEqual(stats.invRows);
  });
  it("المستخلص: محتجز واستقطاع وضريبة وصافي", () => {
    const base = invoiceCalc(p, DEFAULT_CATALOG, "ar");
    const gross = base.wSum + base.mSum + base.ind;
    expect(base.gross).toBeCloseTo(gross, 6);
    expect(base.ret).toBeCloseTo(gross * 0.10, 6);
    expect(base.net).toBeCloseTo(gross - gross * 0.10, 6);
    p.inv = { no: "1", date: "", period: "", retentionPct: 5, deduct: 1000, prev: 5000, vatPct: 15, useVat: true };
    const c = invoiceCalc(p, DEFAULT_CATALOG, "ar");
    const ret = gross * 0.05;
    expect(c.net).toBeCloseTo(gross - ret - 1000 - 5000 + (gross - ret) * 0.15, 6);
    delete p.inv;
  });
  it("صفحة الأجور: الإجمالي الحالي والنسبة", () => {
    const w = wagesCalc(p);
    expect(w.worksTotal).toBeCloseTo(stats.deckStats.execC, 6);
    expect(w.curTotal).toBeCloseTo(stats.deckStats.cur, 6);
    expect(w.varPct).toBeCloseTo(stats.deckStats.varPct, 6);
  });
  it("ملخص لوحة التحكم", () => {
    const d = dashSummary([p]);
    expect(d.counts.run).toBe(1);
    expect(d.tot.est).toBeCloseTo(stats.projStats.est, 4);
    expect(d.geoCov).toBe(100);
  });
});
