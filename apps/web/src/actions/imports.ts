/** الاستيراد والمعالجة: كل القراءة والمطابقة والاستنباط تجري على الخادم؛ هنا الاستدعاء وعرض النتيجة */
import { P, S, T, nf, toast } from "../runtime";
import { del, download, post, upload } from "../api";
import { reloadCatalog, replaceProject, save } from "../sync";
import { render } from "../render";
import { setBusy } from "../ui";
import { guardAct, safe } from "./common";

const PAGE_NAMES: Record<string, [string, string]> = {
  dash: ["لوحة التحكم", "Control centre"], master: ["الماستر والكروكي", "Master & layout"], boq: ["المقايسة والمقارنة", "BOQ & variance"],
  wages: ["فاتورة الأجور", "Wages invoice"], forms: ["النماذج والاستلام", "Forms & acceptance"], map: ["الخريطة والإحداثيات", "Map & coordinates"],
  recs: ["المقترحات والمستندات", "Recommendations"], qty: ["الحصر الشامل", "Full takeoff"], inv: ["الفاتورة", "Invoice"],
};
export const pageName = (id: string): string => { const n = PAGE_NAMES[id] ?? ["", ""]; return T(n[0], n[1]); };

type Rep = [string, string][];
const done = async (dto: any, file: string, extra?: () => void): Promise<void> => {
  replaceProject(dto);
  if (dto.report) S.lastRep = { file, rep: dto.report as Rep };
  await reloadCatalog().catch(() => {});
  extra?.();
  save(); render();
};
const pid = () => P().id as string;

/** رفع ملفات المشروع (إكسل/PDF/Word/صور/KML…) */
export async function intakeFiles(list: FileList | File[]): Promise<void> {
  if (S.busy || !guardAct("import", "edit")) return;
  const files = [...list].slice(0, 12); if (!files.length) return;
  const form = new FormData();
  form.append("lang", S.lang); form.append("guard", S.woGuard ? "1" : "0");
  for (const f of files) form.append("file", f, f.name);
  const dto = await safe(() => upload(`/projects/${pid()}/files`, form), { busy: T("جارٍ قراءة الملفات…", "Reading files…") });
  if (!dto) return;
  const blocked = dto.blocked ?? 0;
  await done(dto, files.map((f) => f.name).join(" · "), () => { if (blocked) S.page = "master"; });
  toast(blocked
    ? T(`تمت المعالجة — ${blocked} ملف موقوف لاختلاف رقم أمر العمل، راجع بطاقة الهوية`, `Processed — ${blocked} file(s) blocked over a work-order mismatch; see the identity card`)
    : T("تمت معالجة الملفات وتحديث كل الصفحات", "Files processed — every page updated"));
}

/** زر «استنباط ومعالجة ذكية»: يشغّل المحرك (+ مراجعة Claude من الخادم إن فُعِّل) */
export async function deriveAndReview(): Promise<void> {
  if (S.busy || !guardAct("import", "edit")) return;
  let dto: any;
  try {
    setBusy(true, T("استنباط الكميات…", "Deriving quantities…"));
    dto = await post(`/projects/${pid()}/derive`, { lang: S.lang, ai: true });
  } catch (e: any) {
    setBusy(false);
    if (e?.code === "nothing_to_derive") { toast(T("ارفع الملفات أو أدخل حصر اللوحات أولًا", "Upload files or enter the sheet tally first")); S.page = "master"; save(); render(); }
    else toast(e?.message ?? T("تعذّر الاتصال بالخادم", "Could not reach the server"));
    return;
  }
  setBusy(false);
  S.aiNotes = dto.aiNotes ?? null;
  replaceProject(dto);
  S.page = "master"; save(); render();
  toast(dto.aiNotes ? T("تم الاستنباط والمراجعة الفنية", "Derived and reviewed") : T("تم استنباط الحصر وكل النماذج", "Takeoff and all forms derived"));
}

export async function aiReviewNow(): Promise<void> {
  if (S.busy) return;
  const r = await safe(() => post(`/projects/${pid()}/ai/review`, {}), { busy: T("مراجعة فنية…", "Reviewing…") });
  if (r) { S.aiNotes = r.notes; render(); }
}

/** تحديث واستكمال: يعيد قراءة الملفات المحفوظة ويملأ كل ناقص يمكن اشتقاقه */
export async function smartFill(): Promise<void> {
  if (S.busy || !guardAct("import", "edit")) return;
  const dto = await safe(() => post(`/projects/${pid()}/refresh`, { lang: S.lang, page: S.page }), { busy: T("تحديث واستكمال البيانات…", "Refreshing & completing…") });
  if (!dto) return;
  await done(dto, T("تحديث واستكمال — ", "Refresh & complete — ") + pageName(S.page));
  toast(T("تم تحديث البيانات واستكمال ما يمكن اشتقاقه", "Data refreshed — everything derivable has been filled"));
}

export async function undoImport(): Promise<void> {
  if (!guardAct("import", "edit")) return;
  const dto = await safe(() => post(`/projects/${pid()}/undo`, {}));
  if (!dto) return;
  replaceProject(dto); S.lastRep = null; save(); render();
  toast(T("تم التراجع عن آخر استيراد", "Last import undone"));
}

export async function backfillTally(): Promise<void> {
  if (!guardAct("import", "edit")) return;
  const dto = await safe(() => post(`/projects/${pid()}/backfill`, { lang: S.lang }));
  if (!dto) return;
  await done(dto, T("اشتقاق حصر اللوحات", "Back-fill sheet tally"));
  toast(T("اشتُقّ حصر اللوحات من البنود المستوردة", "Sheet tally back-filled from the imported items"));
}

const SEC_NAMES: Record<string, [string, string]> = {
  tally: ["حصر اللوحات", "Sheet tally"], boq: ["المقايسة والبنود", "BOQ items"], mat: ["المواد", "Materials"], units: ["جدول الوحدات", "Unit schedule"], geo: ["الإحداثيات", "Coordinates"],
};
export async function secImport(kind: string, list: FileList | File[]): Promise<void> {
  if (S.busy || !guardAct("import", "edit")) return;
  const files = [...list].filter(Boolean); if (!files.length) return;
  const form = new FormData(); form.append("lang", S.lang);
  for (const f of files) form.append("file", f, f.name);
  const nm = SEC_NAMES[kind] ?? ["", ""];
  const dto = await safe(() => upload(`/projects/${pid()}/import/${kind}`, form), { busy: T("استيراد ", "Importing ") + T(nm[0], nm[1]) + "…" });
  if (!dto) return;
  await done(dto, T("استيراد قسم: ", "Section import: ") + T(nm[0], nm[1]));
  toast(T("تم استيراد القسم وتحديث كل الصفحات", "Section imported — all pages updated"));
}

export async function reimportFile(fid: string): Promise<void> {
  if (S.busy || !guardAct("import", "edit")) return;
  const rec = P().files.find((f: any) => f.id === fid);
  const dto = await safe(() => post(`/projects/${pid()}/files/${fid}/reimport`, { lang: S.lang }), { busy: T("إعادة الاستيراد…", "Re-importing…") });
  if (!dto) return;
  await done(dto, rec?.name ?? "");
  toast(T("أُعيد استيراد الملف وتحديث الصفحات", "File re-imported — pages updated"));
}
export async function forceImport(fid: string): Promise<void> {
  if (S.busy || !guardAct("import", "edit")) return;
  const rec = P().files.find((f: any) => f.id === fid);
  const dto = await safe(() => post(`/projects/${pid()}/files/${fid}/force`, { lang: S.lang }), { busy: T("استيراد…", "Importing…") });
  if (!dto) return;
  await done(dto, rec?.name ?? "");
}
export async function adoptWo(wo: string): Promise<void> {
  if (!guardAct("import", "edit")) return;
  const dto = await safe(() => post(`/projects/${pid()}/adopt-wo`, { wo }));
  if (!dto) return;
  replaceProject(dto); save(); render();
  toast(T("اعتُمد رقم أمر العمل ", "Work order adopted: ") + dto.wo);
}
export async function deleteFile(fid: string): Promise<void> {
  if (!guardAct("import", "del")) return;
  const dto = await safe(() => del(`/projects/${pid()}/files/${fid}`));
  if (!dto) return;
  replaceProject(dto); save(); render();
  toast(T("حُذف الملف من السجل", "File removed from the register"));
}
export async function clearUploads(wipeData: boolean): Promise<number> {
  if (!guardAct("import", "del")) return 0;
  const dto = await safe(() => post(`/projects/${pid()}/files/clear`, { wipeData }));
  if (!dto) return 0;
  replaceProject(dto); S.lastRep = null; save();
  return dto.cleared ?? 0;
}

/* ───────── الإحداثيات ───────── */
export async function rescanGeo(): Promise<void> {
  if (S.busy || !guardAct("import", "edit")) return;
  const before = (P().geo || []).length;
  const dto = await safe(() => post(`/projects/${pid()}/geo/scan`, { lang: S.lang }), { busy: T("مسح الملفات بحثًا عن الإحداثيات…", "Scanning files for coordinates…") });
  if (!dto) return;
  await done(dto, T("التقاط الإحداثيات", "Coordinate capture"));
  const n = (P().geo || []).length - before;
  toast(n > 0 ? T(`أُضيف ${nf(n)} إحداثي جديد`, `${nf(n)} new coordinates added`)
    : T("لا إحداثيات جديدة — كل ما في الملفات المحفوظة مُستخرج بالفعل", "No new coordinates — everything in the cached files is already extracted"));
}
export async function useGeoSource(src: string): Promise<void> {
  if (!guardAct("import", "edit")) return;
  const dto = await safe(() => post(`/projects/${pid()}/geo/use-source`, { src }));
  if (!dto) return;
  replaceProject(dto); save(); render();
  toast(T(`اعتُمدت إحداثيات «${src}» لـ ${dto.applied} وحدة`, `Coordinates from “${src}” applied to ${dto.applied} unit(s)`));
}
export async function clearGeo(): Promise<void> {
  if (!guardAct("import", "del")) return;
  const dto = await safe(() => del(`/projects/${pid()}/geo`));
  if (!dto) return;
  replaceProject(dto); save(); render(); toast(T("مُسحت النقاط المستخرجة", "Extracted points cleared"));
}

export async function tallyTemplate(): Promise<void> {
  await safe(() => download(`/projects/${pid()}/export/tally`, "tally-template.xlsx", { lang: S.lang }));
}
export { setBusy };
