import { randomUUID } from "node:crypto";
import {
  backfillTally, bookGeo, fillIdent, identityFromName, identityFromRows, identityFromText, identityGate, impCodes, impTally, impUnits, importSheets, makeT, matchGeoUnits,
  mergeGeo, mergeIdent, missingFor, readCsvText, readGeoText, runDerive, scanText, textGeo, totals, type Catalog, type FileRec, type GeoConflict, type Identity, type ImportEnv,
  type Lang, type Rep, type SheetData,
} from "@iltizam/core";
import type { AppCtx } from "../app";
import type { ApiProject } from "../repo/projects";
import { readDocxText, readKmzText, readPdfText, readXlsx } from "./readers";
import type { AiService } from "./ai";

export interface UploadedBlob { name: string; mime: string; buf: Buffer }
export interface PipelineResult { recs: { rec: FileRec; blob: UploadedBlob }[]; rep: Rep[]; conflicts: GeoConflict[] }

export const extOf = (n: string) => (n.split(".").pop() || "").toLowerCase();
export const kindOf = (ext: string, mime: string) =>
  ["xlsx", "xlsm", "csv"].includes(ext) ? "data" : ext === "pdf" ? "pdf" : /^image\//.test(mime) || ["png", "jpg", "jpeg", "webp"].includes(ext) ? "img" : "doc";

export function makeEnv(p: ApiProject, cat: Catalog, lang: Lang, guard: boolean, conflicts: GeoConflict[] = []): ImportEnv {
  return { p, cat, T: makeT(lang), conflicts, guard };
}

/** هوية الملف (رقم أمر العمل/الاسم/الموقع...) + البيانات المقروءة لإعادة الاستخدام */
async function readParsed(ext: string, blob: UploadedBlob, cat: Catalog) {
  if (["xlsx", "xlsm"].includes(ext)) {
    const sheets = await readXlsx(blob.buf);
    const all = sheets.flatMap((s) => s.rows.slice(0, 40));
    return { sheets, text: null as string | null, ident: mergeIdent(identityFromRows(all, cat), identityFromName(blob.name)) };
  }
  if (ext === "csv") {
    const text = blob.buf.toString("utf8");
    return { sheets: readCsvText(text), text, ident: mergeIdent(identityFromText(text, cat), identityFromName(blob.name)) };
  }
  if (ext === "docx") { const text = await readDocxText(blob.buf); return { sheets: null, text, ident: mergeIdent(identityFromText(text, cat), identityFromName(blob.name)) }; }
  if (ext === "pdf") { const text = readPdfText(blob.buf); return { sheets: null, text, ident: mergeIdent(identityFromText(text, cat), identityFromName(blob.name)) }; }
  if (["kml", "gpx", "geojson", "json", "txt", "xml"].includes(ext)) return { sheets: null, text: blob.buf.toString("utf8"), ident: identityFromName(blob.name) as Identity };
  if (ext === "kmz") return { sheets: null, text: await readKmzText(blob.buf), ident: identityFromName(blob.name) as Identity };
  return { sheets: null, text: null, ident: identityFromName(blob.name) as Identity };
}

/** يعالج ملفًا واحدًا بعد قبول هويته: استيراد الأوراق/النصوص + التقاط الإحداثيات (بدون حارس) */
export async function importParsed(env: ImportEnv, rec: FileRec, parsed: { sheets: SheetData[] | null; text: string | null }, rep: Rep[], ai?: AiService): Promise<void> {
  const { p, T } = env, ext = rec.ext;
  let did = false;
  if (parsed.sheets) {
    const r = importSheets(env, rec, parsed.sheets);
    r.forEach((x) => rep.push(x));
    // أوراق لم يُتعرَّف على تنسيقها → معالجة ذكية اختيارية
    if (ai?.enabled) {
      for (const sh of parsed.sheets) {
        const live = sh.rows.filter((r2) => r2.some((c) => String(c).trim() !== "")).length;
        if (live > 3 && !(await import("@iltizam/core")).sheetKind(sh, p.wo)) { if (await ai.mapSheet(env, sh, rep)) did = true; }
      }
    }
    did = true;
    let pts = bookGeo(parsed.sheets, rec.name, T);
    if (ext === "csv" && parsed.text) pts = pts.concat(scanText(parsed.text, rec.name, p.wo).points as never[]);
    const n = mergeGeo(env, pts, rep, rec.name);
    rec.geoN = (rec.geoN || 0) + n; if (n) rec.imported = true;
  } else if (parsed.text != null) {
    const text = parsed.text;
    if (["kml", "gpx", "geojson", "json", "kmz"].includes(ext)) {
      const pts = readGeoText(text, rec.name).concat(textGeo(text, rec.name) as never[]);
      const n = mergeGeo(env, pts, rep, rec.name);
      rec.rows = pts.length; rec.geoN = n; did = pts.length > 0;
      if (!pts.length) rep.push(["skip", T(`«${rec.name}»: لا توجد إحداثيات`, `“${rec.name}”: no coordinates found`)]);
    } else {
      const sc = scanText(text, rec.name, p.wo);
      const pts = (sc.points as never[]).concat(textGeo(text, rec.name) as never[]);
      const n = mergeGeo(env, pts, rep, rec.name);
      rec.geoN = n; if (n) did = true;
      if (ai?.enabled && text.length > 40) { if (await ai.docScan(env, text, rec.name, rep)) did = true; }
      if (ext === "pdf" && text.replace(/\s/g, "").length <= 200) {
        rep.push(["skip", T(`«${rec.name}»: PDF ممسوح ضوئيًا بلا نص — احفظ صفحاته كصور وارفعها لتُقرأ بالذكاء الاصطناعي`, `“${rec.name}”: scanned PDF with no text layer — save its pages as images and upload them for AI reading`)]);
      } else if (ext === "docx" && !did) rep.push(["skip", T(`«${rec.name}»: قُرئ النص ولم تُستخرج بنود`, `“${rec.name}”: text read, no items extracted`)]);
      rec.rows = ext === "pdf" ? pts.length : text.split("\n").length;
    }
  }
  rec.imported = rec.imported || did;
}

/** خط معالجة الملفات المرفوعة: هوية ← حارس ← استيراد ← التقاط إحداثيات (ثم الاستنباط من المستدعي) */
export async function processFiles(ctx: AppCtx, p: ApiProject, cat: Catalog, blobs: UploadedBlob[], o: { lang: Lang; guard: boolean; ai?: AiService }): Promise<PipelineResult> {
  const conflicts: GeoConflict[] = [];
  const env = makeEnv(p, cat, o.lang, o.guard, conflicts);
  const T = env.T;
  const rep: Rep[] = [];
  const recs: PipelineResult["recs"] = [];
  for (const blob of blobs.slice(0, 16)) {
    const ext = extOf(blob.name);
    const rec: FileRec = { id: randomUUID(), name: blob.name, size: blob.buf.length, type: blob.mime, ext, kind: kindOf(ext, blob.mime), imported: false, rows: 0, at: new Date().toISOString(), rep: [] };
    const own: Rep[] = [];
    try {
      const parsed = await readParsed(ext, blob, cat);
      const gate = identityGate(env, rec, parsed.ident, own);
      if (gate === "go") {
        if (ext === "xls") own.push(["skip", T(`«${rec.name}»: صيغة Excel قديمة — احفظه باسم .xlsx ثم ارفعه`, `“${rec.name}”: legacy Excel — save it as .xlsx and upload again`)]);
        else if (rec.kind === "img") {
          if (o.ai?.enabled) { if (await o.ai.imageScan(env, blob.buf, blob.mime, rec.name, own)) rec.imported = true; }
        } else if (parsed.sheets || parsed.text != null) await importParsed(env, rec, parsed, own, o.ai);
        else own.push(["skip", T(`«${rec.name}»: نوع ملف غير مدعوم`, `“${rec.name}”: unsupported file type`)]);
      }
    } catch (e: any) {
      own.push(["skip", T("تعذّرت قراءة ", "Could not read ") + blob.name + ": " + (e?.message ?? e)]);
    }
    rec.rep = own;
    own.forEach((x) => rep.push(x));
    recs.push({ rec, blob });
  }
  return { recs, rep, conflicts };
}

/** بعد الاستيراد: الاستنباط وملء ما لم يُدخل يدويًا */
export function finishImport(env: ImportEnv, rep: Rep[]): void {
  runDerive(env);
  void rep;
}

/** استيراد مستقل لقسم واحد (tally | boq | mat | units | geo) من أوراق جاهزة */
export function importSection(env: ImportEnv, kind: "tally" | "boq" | "mat" | "units" | "geo", sheetsByFile: { name: string; sheets: SheetData[] }[], rep: Rep[]): void {
  const { p, T } = env;
  for (const f of sheetsByFile) {
    let hit = 0;
    if (kind === "geo") {
      hit = mergeGeo(env, bookGeo(f.sheets, f.name, T), rep, f.name);
    } else {
      for (const sh of f.sheets) {
        const sel = () => JSON.stringify(kind === "tally" ? p.sheets : kind === "units" ? p.rmus : kind === "mat" ? p.mat : p.boq);
        const before = sel();
        if (kind === "tally") impTally(env, sh, rep); else if (kind === "units") impUnits(env, sh, rep); else impCodes(env, sh, rep);
        if (sel() !== before) hit++;
      }
    }
    if (!hit) rep.push(["warn", T(`«${f.name}»: لم يُعثر على بيانات تخص هذا القسم`, `“${f.name}”: no data for this section`)]);
  }
  if (kind !== "geo") runDerive(env);
}

/** «تحديث واستكمال»: يعيد قراءة الملفات المحفوظة ويملأ كل ناقص يمكن اشتقاقه (لا يستبدل ما أُدخل يدويًا) */
export async function refreshProject(ctx: AppCtx, p: ApiProject, cat: Catalog, lang: Lang, page: string): Promise<Rep[]> {
  const env = makeEnv(p, cat, lang, true, []);
  const { T } = env;
  const rep: Rep[] = [];
  let re = 0, none = 0;
  for (const f of p.files) {
    if (f.blocked) continue;
    const key = f.storageKey;
    const stored = key ? await ctx.storage.get(key) : null;
    if (!stored) { if (f.kind === "data") none++; continue; }
    const blob: UploadedBlob = { name: f.name, mime: f.type, buf: stored.data };
    const parsed = await readParsed(f.ext, blob, cat);
    f.rep = [];
    if (parsed.sheets) { importSheets(env, f, parsed.sheets).forEach((x) => rep.push(x)); mergeGeo(env, bookGeo(parsed.sheets, f.name, T), null, f.name); re++; }
    else if (parsed.text != null) {
      const pts = ["kml", "gpx", "geojson", "json", "kmz"].includes(f.ext) ? readGeoText(parsed.text, f.name).concat(textGeo(parsed.text, f.name) as never[]) : (textGeo(parsed.text, f.name) as never[]);
      mergeGeo(env, pts, null, f.name); re++;
    }
  }
  rep.unshift(["ok", re ? T(`أُعيدت قراءة ${re} ملف من السجل`, `${re} file(s) re-read from the register`) : T("لا توجد ملفات محفوظة", "No stored files")]);
  if (none) rep.push(["warn", T(`${none} ملف بيانات يحتاج إعادة رفع ليُقرأ من جديد`, `${none} data file(s) need re-uploading to be read again`)]);
  p.files.forEach((f) => { if (!f.blocked && f.ident) fillIdent(p, f.ident); });
  if (!totals(p).rmuNew && (Object.keys(p.boq).length || p.rmus.length)) backfillTally(env, rep);
  matchGeoUnits(env, rep);
  runDerive(env);
  if (p.derived && !(p.estCost.mat + p.estCost.inst)) {
    p.estCost = { mat: Math.round(p.derived.cost.mat), inst: Math.round(p.derived.cost.inst), ind: Math.round(p.derived.cost.ind) };
    rep.push(["ok", T("مُلئت المقايسة التقديرية من ناتج الكروكي", "Estimated BOQ cost filled from the derived takeoff")]);
  }
  const left = missingFor(p, page, T);
  rep.push([left.length ? "warn" : "ok", left.length ? T(`ما زال ينقص: ${left.map((x) => x.t + " (" + x.n + ")").join("، ")}`, `Still missing: ${left.map((x) => x.t + " (" + x.n + ")").join(", ")}`) : T("لا توجد بيانات ناقصة في هذه الصفحة", "Nothing missing on this page")]);
  return rep;
}
export { readParsed };
