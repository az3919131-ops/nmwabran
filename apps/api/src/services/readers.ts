import ExcelJS from "exceljs";
import JSZip from "jszip";
import { inflateRawSync, inflateSync } from "node:zlib";
import type { SheetData } from "@iltizam/core";

function cellVal(v: unknown): string | number {
  if (v == null) return "";
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const o = v as any;
  if (o.richText) return o.richText.map((t: any) => t.text).join("");
  if (o.result !== undefined) return cellVal(o.result);
  if (o.text !== undefined) return String(o.text);
  if (o.error) return String(o.error);
  return String(v);
}
/** قارئ xlsx للخادم: أوراق بصفوف كثيفة (الخلية الفارغة = "") كما في قارئ المنصة الحالية */
export async function readXlsx(buf: Buffer): Promise<SheetData[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const out: SheetData[] = [];
  wb.eachSheet((ws) => {
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const arr: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => { arr[col - 1] = cellVal(cell.value); });
      if (arr.length) rows.push(Array.from(arr, (x) => (x == null ? "" : x)));
    });
    out.push({ name: ws.name || "Sheet", rows });
  });
  return out;
}

export async function readDocxText(buf: Buffer): Promise<string> {
  const z = await JSZip.loadAsync(buf);
  const f = z.file("word/document.xml");
  if (!f) return "";
  const xml = await f.async("string");
  const out: string[] = [];
  for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []) {
    const t = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")).join("");
    if (t.trim()) out.push(t.trim());
  }
  return out.join("\n");
}
export async function readKmzText(buf: Buffer): Promise<string> {
  const z = await JSZip.loadAsync(buf);
  const name = Object.keys(z.files).find((n) => /\.kml$/i.test(n));
  return name ? await z.files[name].async("string") : "";
}

function a85(s: string): Buffer {
  s = s.replace(/^<~/, "").replace(/~>[\s\S]*$/, "").replace(/\s+/g, "");
  const out: number[] = []; let t = 0, n = 0;
  for (const ch of s) {
    if (ch === "z" && n === 0) { out.push(0, 0, 0, 0); continue; }
    const c = ch.charCodeAt(0) - 33; if (c < 0 || c > 84) continue;
    t = t * 85 + c;
    if (++n === 5) { out.push((t >>> 24) & 255, (t >>> 16) & 255, (t >>> 8) & 255, t & 255); t = 0; n = 0; }
  }
  if (n) { for (let i = n; i < 5; i++) t = t * 85 + 84; const b = [(t >>> 24) & 255, (t >>> 16) & 255, (t >>> 8) & 255, t & 255]; out.push(...b.slice(0, n - 1)); }
  return Buffer.from(out);
}
/** استخراج نص PDF (للملفات النصية؛ الممسوحة ضوئيًا تحتاج قراءة بالذكاء الاصطناعي) — منقول من المنصة الحالية */
export function readPdfText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  let out = "";
  const re = /stream\r?\n/g; let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const st = m.index + m[0].length, en = raw.indexOf("endstream", st);
    if (en < 0) continue;
    const head = raw.slice(Math.max(0, m.index - 400), m.index);
    let bytes: Buffer = buf.subarray(st, en), s = "";
    try {
      if (/ASCII85Decode/.test(head)) bytes = a85(bytes.toString("latin1"));
      if (/FlateDecode/.test(head)) { try { bytes = inflateSync(bytes); } catch { bytes = inflateRawSync(bytes); } }
      s = bytes.toString("latin1");
    } catch { s = raw.slice(st, en); }
    if (!/T[Jj]/.test(s)) { re.lastIndex = en; continue; }
    s.replace(/\(((?:\\.|[^\\()])*)\)\s*Tj/g, (_, g) => { out += g.replace(/\\([()\\])/g, "$1") + " "; return ""; });
    s.replace(/\[((?:[^\][]|\\.)*)\]\s*TJ/g, (_, g) => { g.replace(/\(((?:\\.|[^\\()])*)\)/g, (__: string, t: string) => { out += t.replace(/\\([()\\])/g, "$1"); return ""; }); out += " "; return ""; });
    s.replace(/<([0-9A-Fa-f\s]{4,})>\s*Tj/g, (_, g) => { const h = g.replace(/\s+/g, ""); for (let i = 0; i + 3 < h.length; i += 4) { const cp = parseInt(h.substr(i, 4), 16); if (cp > 31 && cp < 65533) out += String.fromCharCode(cp); } out += " "; return ""; });
    out += "\n";
    re.lastIndex = en;
  }
  return out;
}
