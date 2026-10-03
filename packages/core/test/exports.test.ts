import { describe, it, expect } from "vitest";
import sheets from "./golden/sheets.json";
import pages from "./golden/pages.json";
import { hassiniya, projectSheets, qtyTable, DEFAULT_CATALOG, withSignature, invoiceSheets } from "../src";

const nf = (n: number, d = 0) => (isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
/** صفوف جدول الحصر كما تُرسم في المنصة الحالية: الخلايا الرقمية فقط */
function legacyQtyRows(html: string): string[][] {
  const tbody = html.slice(html.indexOf('<table id="tblQty"'), html.indexOf("</table>", html.indexOf('<table id="tblQty"')));
  return [...tbody.matchAll(/<tr>(?!<td colspan)([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td class="n">([\s\S]*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())).filter((r) => r.length);
}
describe("أوراق التصدير والحصر الشامل", () => {
  const p = hassiniya();
  for (const lang of ["ar", "en"] as const) {
    it("أوراق المشروع الست (" + lang + ")", () => {
      expect(projectSheets(p, DEFAULT_CATALOG, lang)).toEqual((sheets as any)[lang]);
    });
  }
  it("الحصر الشامل: كل خلية رقمية تطابق المنصة الحالية", () => {
    const legacy = legacyQtyRows((pages as any).ar.qty);
    const q = qtyTable(p, DEFAULT_CATALOG, "ar");
    const mine = q.sections.flatMap((s) => s.rows.map((r) => {
      const d = (r.exec || 0) - (r.plan || 0);
      const pct = r.plan ? Math.round((d / r.plan) * 1000) / 10 : r.exec ? 100 : 0;
      return [r.layout == null ? "—" : nf(r.layout), r.derived == null ? "—" : nf(r.derived), r.plan == null ? "—" : nf(r.plan), r.exec == null ? "—" : nf(r.exec),
        r.plan || r.exec ? (d > 0 ? "+" : "") + nf(d) + (r.plan ? ` (${d > 0 ? "+" : ""}${pct}%)` : "") : "—"];
    }));
    expect(mine.length).toBe(legacy.length);
    expect(mine).toEqual(legacy);
  });
  it("التوقيع أسفل كل ورقة مُصدَّرة", () => {
    const s = withSignature(projectSheets(p), "en", new Date("2026-01-02T03:04:00Z"));
    for (const [, rows] of s) { const last = rows.slice(-2); expect(last[0]).toEqual(["Project manager", "Eng. Ahmed Zahran"]); expect(last[1][3]).toBe("2026-01-02 03:04"); }
  });
  it("أوراق الفاتورة الثلاث", () => {
    const s = invoiceSheets(p, DEFAULT_CATALOG, "ar", "شركة");
    expect(s.map((x) => x[0])).toEqual(["فاتورة الأجور", "فاتورة المواد", "الملخص"]);
  });
});
