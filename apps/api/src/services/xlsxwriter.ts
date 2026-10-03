import ExcelJS from "exceljs";
import type { Lang, SheetRows } from "@iltizam/core";

/** مصنّف إكسل: RTL للعربية، تجميد صف الترويسة، أرقام فعلية لا نصوص */
export async function buildXlsx(sheets: SheetRows, lang: Lang): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Project manager · Eng. Ahmed Zahran";
  wb.created = new Date();
  const used = new Set<string>();
  for (const [name0, rows] of sheets) {
    let name = name0.replace(/[\\/?*:[\]]/g, " ").slice(0, 28) || "Sheet";
    let k = 2; while (used.has(name)) name = name0.slice(0, 25) + " " + k++;
    used.add(name);
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: lang === "ar", state: "frozen", ySplit: 1, xSplit: 0 }] });
    const wide: number[] = [];
    rows.forEach((r, ri) => {
      const row = ws.addRow(r.map((v) => (typeof v === "number" && isFinite(v) ? v : v == null ? "" : String(v))));
      r.forEach((v, ci) => { wide[ci] = Math.max(wide[ci] ?? 8, Math.min(60, String(v ?? "").length + 2)); });
      if (ri === 0) { row.font = { bold: true }; row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBF2EA" } }; }
    });
    wide.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
