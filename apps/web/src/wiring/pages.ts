/** ربط أحداث كل صفحة بعد رسمها — يقابل طبقات render المتراكمة في المنصة القديمة */
import { $, AUTH, P, S, T, can, copyTable, editable, esc, toast } from "../runtime";
import { save, saveUi } from "../sync";
import { render } from "../render";
import { pmHTML } from "../ui";
import { PM_NAME, PM_ROLE_EN } from "../runtime";
import { geoConfCard, geoSrcCard } from "../views/master";
import { secBtnHTML, invOf } from "../views/qty";
import { DASH } from "../views/dash";
import { gaOpen } from "../overlays/ga";
import { wireDocs } from "../overlays/doc";
import { addClearButtons } from "../overlays/clear";
import { wireUpdBar, updBar } from "../overlays/updbar";
import { aiReviewNow, adoptWo, backfillTally, clearGeo, clearUploads, deleteFile, forceImport, intakeFiles, reimportFile, rescanGeo, secImport, tallyTemplate, undoImport, useGeoSource } from "../actions/imports";
import { invExcel } from "../actions/exports";
import { addProject, deleteProject, duplicateProject, firmAdd, firmDelete, firmGo, firmMove, firmNewProject, firmOpen, firmRename } from "../actions/projects";
import { denyToast, lockToast } from "../actions/common";

const arm = (b: HTMLElement, label: string, restore: string, ms = 3500): boolean => {
  if (b.dataset.armed) return true;
  b.dataset.armed = "1"; b.textContent = label; b.classList.add("pri");
  setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = restore; b.classList.remove("pri"); } }, ms);
  return false;
};
const on = (id: string, fn: (e?: any) => void) => { const el = $(id); if (el) el.onclick = fn; };

/** شريط التحديث في أعلى كل صفحة */
export function mountUpdBar(v: HTMLElement): void {
  v.insertAdjacentHTML("afterbegin", updBar());
  wireUpdBar(v);
}

/** الصفحة الماستر: السجل، بطاقة الهوية، المراجعة الذكية، المعدات */
export function wireMaster(v: HTMLElement): void {
  const fileIn = $("fileIn") as HTMLInputElement | null, drop = $("drop");
  if (fileIn) {
    fileIn.setAttribute("accept", ".xlsx,.xlsm,.csv,.pdf,.docx,.kml,.kmz,.gpx,.geojson,.json,.txt,image/*");
    fileIn.onchange = () => { void intakeFiles(fileIn.files!); fileIn.value = ""; };
  }
  if (drop) {
    drop.ondrop = (e: DragEvent) => { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer) void intakeFiles(e.dataTransfer.files); };
    const p4 = drop.querySelector("p");
    if (p4) p4.textContent = T("ارفع أي ملفات المشروع: إكسل (حصر، مقايسة، مواد وأجور، ضبط الحماية، الاستلام)، PDF، Word، صور الكروكي، KML/GPX. تُقرأ آليًا وتُستخرج منها الأرقام والمسميات والإحداثيات، ويُعاد الاستنباط فورًا.",
      "Upload any project file: Excel (tally, BOQ, materials, protection, acceptance), PDF, Word, layout images, KML/GPX. They are read automatically — codes, names and coordinates extracted, and the takeoff re-runs at once.");
  }
  const th = v.querySelector<HTMLElement>(".thumbs");
  if (th) { let vis = 0; th.querySelectorAll<HTMLElement>(".thumb").forEach((el, i) => { const f = P().files[i] || {}; if (f.kind !== "img") el.hidden = true; else vis++; }); if (!vis) th.hidden = true; }

  on("regAdd", () => ($("fileIn") as HTMLElement | null)?.click());
  on("regTpl", () => { void tallyTemplate(); });
  on("regBack", () => { void backfillTally(); });
  on("regUndo", () => { void undoImport(); });
  on("toMap", () => { S.page = "map"; save(); render(); });
  on("regClear", () => {
    const b = $("regClear");
    if (b.dataset.armed) { void clearUploads(false).then(() => { render(); toast(T("تم مسح السجل", "Register cleared")); }); return; }
    arm(b, T("تأكيد المسح؟", "Confirm clear?"), T("مسح السجل", "Clear register"));
  });
  v.querySelectorAll<HTMLElement>("[data-rmf]").forEach((b) => b.onclick = () => {
    if (!b.dataset.armed) { arm(b, T("تأكيد", "Confirm"), T("مسح", "Delete")); return; }
    const f = P().files[+b.dataset.rmf!]; if (f) void deleteFile(f.id);
  });
  v.querySelectorAll<HTMLElement>("[data-reimp]").forEach((b) => b.onclick = () => { void reimportFile(b.dataset.reimp!); });
  v.querySelectorAll<HTMLElement>("[data-go2]").forEach((el) => el.onclick = () => { S.page = el.dataset.go2!; save(); render(); });

  on("aiRun", () => { void aiReviewNow(); });
  const g = $("woGuard") as HTMLInputElement | null;
  if (g) g.onchange = () => { S.woGuard = g.checked; saveUi(); toast(g.checked ? T("الحماية مفعّلة — الملفات المختلفة لن تُستورد", "Guard on — mismatched files will not be imported") : T("الحماية موقوفة", "Guard off")); };
  v.querySelectorAll<HTMLElement>("[data-adopt]").forEach((b) => b.onclick = () => { void adoptWo(b.dataset.adopt!); });
  v.querySelectorAll<HTMLElement>("[data-force]").forEach((b) => b.onclick = () => { void forceImport(b.dataset.force!); });
}

/** بطاقتا تعارض/مصادر الإحداثيات (الماستر + الخريطة) */
export function wireGeo(v: HTMLElement): void {
  if (S.page === "map" && !$("geoSrc")) v.insertAdjacentHTML("beforeend", geoConfCard() + geoSrcCard());
  v.querySelectorAll<HTMLElement>("[data-usesrc]").forEach((b) => b.onclick = () => { void useGeoSource(b.dataset.usesrc!); });
  on("geoScan", () => { void rescanGeo(); });
  const c = $("geoClear");
  if (c) c.onclick = () => { if (!c.dataset.armed) { c.dataset.armed = "1"; c.textContent = T("تأكيد المسح", "Confirm"); return; } void clearGeo(); };
}

/** الحصر الشامل والفاتورة + أزرار الاستيراد المستقل لكل قسم */
export function wireQtyInv(v: HTMLElement): void {
  const MOUNT: Record<string, string> = { copySheets: "tally", copyBoq: "boq", copyMat: "mat", copyProt: "units", copyAcc: "units", copyWages: "boq" };
  Object.entries(MOUNT).forEach(([id, kind]) => { const b = $(id); if (b && !(b.previousElementSibling as HTMLElement | null)?.dataset?.sec) b.insertAdjacentHTML("beforebegin", secBtnHTML(kind)); });
  const gs = $("geoScan"); if (gs && !(gs.previousElementSibling as HTMLElement | null)?.dataset?.sec) gs.insertAdjacentHTML("beforebegin", secBtnHTML("geo"));
  const inp = $("secFile") as HTMLInputElement;
  inp.onchange = () => { if (inp.files && inp.files.length) { void secImport(S.secKind || "boq", inp.files); inp.value = ""; } };
  v.querySelectorAll<HTMLElement>("[data-sec]").forEach((b) => b.onclick = () => { S.secKind = b.dataset.sec; inp.value = ""; inp.click(); });
  on("copyQty", () => copyTable("#tblQty"));
  if (S.page === "inv") {
    const p = P(), iv = invOf(p);
    const bindV = (id: string, k: string, num?: boolean) => { const el = $(id); if (el) el.onchange = () => { iv[k] = num ? (+el.value || 0) : el.value; save(); render(); }; };
    bindV("iv_no", "no"); bindV("iv_date", "date"); bindV("iv_period", "period");
    bindV("iv_ret", "retentionPct", true); bindV("iv_ded", "deduct", true); bindV("iv_prev", "prev", true); bindV("iv_vat", "vatPct", true);
    const uv = $("iv_usevat") as HTMLInputElement | null; if (uv) uv.onchange = () => { iv.useVat = uv.checked; save(); render(); };
    on("invTabW", () => { S.invTab = "works"; save(); render(); });
    on("invTabM", () => { S.invTab = "mats"; save(); render(); });
    on("invCopy", () => copyTable(S.invTab === "mats" ? "#tblInvM" : "#tblInvW"));
    on("invXls", () => { void invExcel(); });
    on("invPrint", () => window.print());
  }
}

/** صفحة المقاولين والمشاريع */
export function wireFirms(v: HTMLElement): void {
  on("fAdd", firmAdd);
  on("fCopy", () => copyTable("#tblFirms"));
  const each = (sel: string, fn: (b: HTMLElement) => void) => v.querySelectorAll<HTMLElement>(sel).forEach((b) => { b.onclick = () => fn(b); });
  each("[data-fgo]", (b) => firmGo(+b.dataset.fgo!));
  each("[data-faddp]", (b) => firmNewProject(+b.dataset.faddp!));
  each("[data-fren]", (b) => firmRename(+b.dataset.fren!));
  each("[data-fdel]", (b) => firmDelete(+b.dataset.fdel!));
  each("[data-fopen]", (b) => firmOpen(+b.dataset.fopen!, "dash"));
  each("[data-fmap]", (b) => firmOpen(+b.dataset.fmap!, "map"));
  each("[data-fdup]", (b) => { void duplicateProject(+b.dataset.fdup!); });
  each("[data-fdelp]", (b) => deleteProject(+b.dataset.fdelp!));
  v.querySelectorAll<HTMLSelectElement>("[data-fmove]").forEach((s) => s.onchange = () => { if (s.value !== "") void firmMove(+s.dataset.fmove!, +s.value); });
}

/** لوحة التحكم: الترويسة أولًا ثم شريط التحديث؛ مرشحات الحالة؛ التجميع على Google Earth */
export function wireDash(v: HTMLElement): void {
  const hero = v.querySelector(".dhero");
  if (hero && v.firstElementChild !== hero) v.insertBefore(hero, v.firstChild);
  v.querySelectorAll<HTMLElement>("[data-st]").forEach((b) => b.onclick = () => { (DASH as any).filter = (DASH as any).filter === b.dataset.st ? null : b.dataset.st; render(); });
  on("dClear", () => { (DASH as any).filter = null; render(); });
  v.querySelectorAll<HTMLElement>("[data-dgo]").forEach((b) => b.onclick = () => { S.active = +b.dataset.dgo!; save(); render(); });
  on("dashAdd", () => { void addProject(); });
  on("btnAllIlt", gaOpen);
}

/** توقيع مدير المشاريع أسفل كل صفحة وداخل كل مستند/نموذج */
export function addPmSign(v: HTMLElement): void {
  const p = P();
  const pp = $("pmPrint"); if (pp && p) pp.textContent = `${PM_ROLE_EN} · ${PM_NAME}  —  ${p.name}${p.wo ? " · W/O " + p.wo : ""}`;
  v.querySelectorAll(".doc").forEach((d) => { if (!d.querySelector(".pmsign")) d.insertAdjacentHTML("beforeend", pmHTML()); });
  const last = v.lastElementChild;
  if (!last || !last.classList.contains("pmsign")) v.insertAdjacentHTML("beforeend", pmHTML(p ? p.name + (p.wo ? " · " + p.wo : "") : ""));
}

/** تعطيل المدخلات عند قفل التعديل أو غياب الصلاحية (الخادم يرفض على أي حال) */
export function applyPermsToView(v: HTMLElement): void {
  const page = S.page;
  if (!editable(page)) {
    v.querySelectorAll<HTMLInputElement>("input,select,textarea").forEach((el) => {
      if (el.closest(".pmsign") || el.type === "file") return;
      if (el.closest("#tblFirms") || el.closest("#emailsPage")) return;
      el.disabled = true; el.classList.add("locked-field");
    });
  }
  if (!can("import", "edit") || !AUTH.unlocked) {
    ["updRun", "updAdd", "updMore", "updUndo", "btnAiDerive"].forEach((id) => { const e = $(id); if (e) { e.disabled = true; e.classList.add("locked-field"); } });
    v.querySelectorAll(".drop,[data-upre],[data-sec],[data-secimp]").forEach((e) => { e.classList.add("locked-field"); e.setAttribute("aria-disabled", "true"); });
  }
  if (!can(page, "del") || !AUTH.unlocked) v.querySelectorAll<HTMLButtonElement>("[data-fdelp],[data-fdel],[data-udel],[data-delsheet]").forEach((e) => { e.disabled = true; e.classList.add("locked-field"); });
}

/** كل حقل بلا تسمية يأخذ اسمًا من سياقه: «عنوان العمود — اسم الصف» (قارئات الشاشة) */
export function labelInputs(v: HTMLElement): void {
  v.querySelectorAll<HTMLElement>("input,select,textarea").forEach((el) => {
    if ((el as HTMLInputElement).type === "hidden" || el.hidden) return;
    if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.closest("label") || (el.id && v.querySelector(`label[for="${CSS.escape(el.id)}"]`))) return;
    const td = el.closest("td,th") as HTMLTableCellElement | null;
    let name = "";
    if (td) {
      const row = td.parentElement as HTMLTableRowElement, table = td.closest("table") as HTMLTableElement | null;
      const head = table?.tHead?.rows[table.tHead.rows.length - 1]?.cells[td.cellIndex]?.textContent?.trim() ?? "";
      const first = (row.cells[0]?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 70);
      name = [first && row.cells[0] !== td ? first : "", head].filter(Boolean).join(" — ");
    }
    name ||= el.getAttribute("placeholder") || el.getAttribute("title") || (el as HTMLInputElement).name || el.dataset.key || el.dataset.f || el.id || "field";
    el.setAttribute("aria-label", name);
  });
}

/** مناطق التمرير (الجداول العريضة) تُفتح بلوحة المفاتيح: tabindex + دور region + اسم */
export function focusableScrollers(v: HTMLElement): void {
  v.querySelectorAll<HTMLElement>(".scroll").forEach((el, i) => {
    if (el.hasAttribute("tabindex")) return;
    const h = el.closest(".card")?.querySelector("h3")?.textContent?.trim() || el.id || `${T("جدول", "Table")} ${i + 1}`;
    el.setAttribute("tabindex", "0"); el.setAttribute("role", "region"); el.setAttribute("aria-label", h);
  });
}

export function wireExtras(v: HTMLElement): void {
  addClearButtons(v);
  wireDocs(v, (ix) => { S.active = ix; save(); render(); });
  void esc; void denyToast; void lockToast;
}
