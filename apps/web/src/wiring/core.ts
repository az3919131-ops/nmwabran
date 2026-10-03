/** ربط المدخلات العامة (data-sheet / data-factor / data-boq …) — يقابل wire() في المنصة القديمة */
import { $, P, S, T, blankSheet, copyTable, derive, toast } from "../runtime";
import { save } from "../sync";
import { render } from "../render";
import { addProject } from "../actions/projects";
import { intakeFiles, deleteFile } from "../actions/imports";

export function wire(): void {
  const p = P(), v = $("view") as HTMLElement;
  if (!p) return;
  const bind = (id: string, fn: (x: string) => void) => { const el = $(id); if (el) el.onchange = () => { fn(el.value); save(); render(); }; };
  bind("f_name", (x) => p.name = x); bind("f_wo", (x) => p.wo = x); bind("f_site", (x) => p.site = x);
  bind("f_admin", (x) => p.admin = x); bind("f_sector", (x) => p.sector = x); bind("f_date", (x) => p.approvedDate = x);
  bind("f_em", (x) => p.estCost.mat = +x || 0); bind("f_ei", (x) => p.estCost.inst = +x || 0);
  ["f_notes", "f_notes2"].forEach((id) => { const el = $(id); if (el) el.onchange = () => { p.notes = el.value; save(); }; });

  v.querySelectorAll<HTMLInputElement>("[data-sheet]").forEach((inp) => {
    inp.onchange = () => { p.sheets[+inp.dataset.sheet!][inp.dataset.key!] = +inp.value || 0; p.derived = null; save(); render(); };
  });
  v.querySelectorAll<HTMLInputElement>("[data-factor]").forEach((inp) => {
    inp.onchange = () => { p.factors[inp.dataset.factor!] = +inp.value || 0; if (p.derived) p.derived = derive(p); save(); render(); };
  });
  v.querySelectorAll<HTMLInputElement>("[data-boq]").forEach((inp) => {
    inp.onchange = () => { const c = inp.dataset.boq!; p.boq[c] = p.boq[c] || { plan: 0, exec: 0 }; p.boq[c][inp.dataset.f!] = +inp.value || 0; save(); render(); };
  });
  v.querySelectorAll<HTMLInputElement>("[data-mat]").forEach((inp) => {
    inp.onchange = () => { const c = inp.dataset.mat!; p.mat[c] = p.mat[c] || { iss: 0, req: 0 }; p.mat[c][inp.dataset.f!] = +inp.value || 0; save(); render(); };
  });
  v.querySelectorAll<HTMLInputElement>("[data-rmu]").forEach((inp) => {
    inp.onchange = () => { p.rmus[+inp.dataset.rmu!][inp.dataset.f!] = inp.type === "checkbox" ? inp.checked : inp.value; save(); render(); };
  });
  v.querySelectorAll<HTMLElement>("[data-go]").forEach((tr) => { tr.onclick = () => { S.active = +tr.dataset.go!; S.page = "master"; save(); render(); }; });
  v.querySelectorAll<HTMLElement>("[data-rmfile]").forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); const f = p.files[+b.dataset.rmfile!]; if (f) void deleteFile(f.id); };
  });
  v.querySelectorAll<HTMLElement>("[data-delsheet]").forEach((b) => {
    b.onclick = () => { if (p.sheets.length <= 1) { toast(T("لا يمكن حذف اللوحة الوحيدة", "Cannot delete the only sheet")); return; } p.sheets.splice(+b.dataset.delsheet!, 1); p.derived = null; save(); render(); };
  });

  const on = (id: string, fn: () => void) => { const el = $(id); if (el) el.onclick = fn; };
  on("addSheet", () => { p.sheets.push(blankSheet(p.sheets.length + 1)); p.derived = null; save(); render(); });
  on("dashAdd", () => { void addProject(); });
  on("addRmu", () => {
    const n = p.rmus.length + 1;
    p.rmus.push({ no: n, feeder: "NER —", rmu: "R" + (101580 + n), type: "3W", tr: "", relay: "—", model: "—", set: false, ratio: "", ohm: "3.0", gps: "" });
    save(); render();
  });
  on("copySheets", () => copyTable("#tblSheets")); on("copyDerived", () => copyTable("#tblDerived"));
  on("copyBoq", () => copyTable("#tblBoq")); on("copyMat", () => copyTable("#tblMat"));
  on("copyWages", () => copyTable("#tblWages")); on("copyProt", () => copyTable("#tblProt"));
  on("copyAcc", () => copyTable("#tblAcc")); on("printWages", () => window.print());

  // رفع الكروكي والملفات
  const drop = $("drop") as HTMLElement | null, fileIn = $("fileIn") as HTMLInputElement | null;
  if (drop && fileIn) {
    const pick = () => fileIn.click();
    drop.onclick = pick;
    drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer) void intakeFiles(e.dataTransfer.files); };
    fileIn.onchange = () => { void intakeFiles(fileIn.files!); fileIn.value = ""; };
  }
}
