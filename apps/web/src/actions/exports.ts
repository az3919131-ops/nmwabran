/** التصدير: يُبنى كل ملف على الخادم (XLSX/KML/DXF/CSV/GeoJSON/SVG) ويُنزَّل هنا */
import { P, S, T, toast } from "../runtime";
import { api, download, get, post, saveBlob } from "../api";
import { guardAct, safe } from "./common";
import { gaSelectedIds } from "../overlays/ga";
import { render } from "../render";
import { replaceProject, save, refreshContractors, reloadAllProjects } from "../sync";

const pid = () => P().id as string;

export async function exportWorkbook(): Promise<void> {
  if (!guardAct("qty", "exp")) return;
  const ok = await safe(() => download(`/projects/${pid()}/export/xlsx`, "takeoff.xlsx", { lang: S.lang }).then(() => true));
  if (ok) toast(T("تم تصدير ملف إكسل بست أوراق", "Excel workbook with six sheets exported"));
}
export async function invExcel(): Promise<void> {
  if (!guardAct("inv", "exp")) return;
  const ok = await safe(() => download(`/projects/${pid()}/export/invoice`, "invoice.xlsx", { lang: S.lang }).then(() => true));
  if (ok) toast(T("تم تصدير الفاتورة بثلاث أوراق", "Invoice exported with three sheets"));
}
export async function exportGeo(kind: string): Promise<void> {
  if (!guardAct("map", "exp")) return;
  if (!P().rmus.some((r: any) => String(r.gps || "").trim()) && !(P().geo || []).length) { toast(T("لا توجد إحداثيات في جدول ضبط الحماية", "No coordinates in the protection table")); return; }
  const ok = await safe(() => download(`/projects/${pid()}/export/${kind}`, `map.${kind}`, { lang: S.lang }).then(() => true));
  if (ok) toast(T("تم التنزيل: ", "Downloaded: ") + kind.toUpperCase());
}
/** تجميع Google Earth لكل المشاريع المحددة */
export async function gaExport(kind: "kml" | "csv", coord: boolean): Promise<void> {
  if (!guardAct("map", "exp")) return;
  const ids = gaSelectedIds();
  if (!ids.length) { toast(T("اختر مشروعًا واحدًا على الأقل به إحداثيات", "Select at least one project that has coordinates")); return; }
  const ok = await safe(() => download(`/portfolio/export/${kind}`, `projects.${kind}`, { ids: ids.join(","), coord: coord ? "1" : "0", lang: S.lang }).then(() => true));
  if (ok) toast(T("تم التنزيل", "Downloaded"));
}

export async function backupData(): Promise<void> {
  if (!guardAct("dash", "exp")) return;
  const ok = await safe(() => download("/backup", "portfolio-backup.json").then(() => true));
  if (ok) toast(T("تم حفظ نسخة احتياطية من كل المشاريع والمقاولين", "Backup of all projects & contractors saved"));
}
/** استعادة غير مدمّرة: مشاريع النسخة تُضاف كمشاريع جديدة */
export async function restoreData(file: File): Promise<void> {
  if (!guardAct("dash", "edit")) return;
  let o: any;
  try { o = JSON.parse(await file.text()); if (!o.projects?.length) throw 0; }
  catch { toast(T("الملف غير صالح — اختر ملف نسخة احتياطية بصيغة JSON", "Invalid file — choose a JSON backup")); return; }
  const res = await safe(() => post("/restore", { projects: o.projects, contractors: o.contractors }));
  if (!res) return;
  await refreshContractors(); await reloadAllProjects();
  save(); render();
  toast(T(`أُضيف ${res.added} مشروع من النسخة الاحتياطية`, `${res.added} project(s) restored from the backup`));
}
export { api, get, saveBlob, replaceProject };
