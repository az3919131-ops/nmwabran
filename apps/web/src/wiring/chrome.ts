/** عناصر الواجهة الثابتة حول الصفحة: الشريط الجانبي (المقاول/المشروع/أدوات البيانات)، شعار الجهة، التوقيع، اللغة والمظهر */
import { $, AR, AUTH, CF, CONTRACTORS, PAGES, PM_NAME, PM_ROLE_AR, PM_ROLE_EN, P, S, T, can, esc, fHex, firmGuard, firmProjects, nf, ORG_AR, ORG_EN, toast, editable } from "../runtime";
import { LS } from "../runtime";
import { render } from "../render";
import { save } from "../sync";
import ORG_LOGO from "../assets/org-logo.webp";
import { addProject, deleteProject, duplicateProject, firmAdd, firmDelete, firmGo, firmRename } from "../actions/projects";
import { deriveAndReview } from "../actions/imports";
import { backupData, exportWorkbook, restoreData } from "../actions/exports";
import { openDeck, closeDeck, stepDeck } from "../views/deck";
import { guardAct } from "../actions/common";
import { openEmailReport } from "../emailReport";
import { E } from "../views/emails";
import { U } from "../views/users";

let built = false;
/** ينشئ العناصر الديناميكية مرة واحدة ويربط أزرار الشريط الجانبي */
export function ensureChrome(): void {
  if (built) return; built = true;
  const head = document.querySelector(".rail-head");
  if (head && !$("orgChip")) {
    const d = document.createElement("div"); d.className = "orgchip"; d.id = "orgChip";
    d.innerHTML = `<img src="${ORG_LOGO}" alt=""><span id="orgTxt"></span>`; head.appendChild(d);
  }
  const sel = $("selContractor");
  if (sel && !$("firmBtns")) {
    const d = document.createElement("div"); d.className = "firmbtns noprint"; d.id = "firmBtns";
    d.innerHTML = `<button class="btn sm pri" id="btnAddFirm"></button><button class="btn sm gh" id="btnRenFirm"></button><button class="btn sm gh" id="btnDelFirm"></button>`;
    sel.insertAdjacentElement("afterend", d);
    const b = document.createElement("button"); b.className = "btn sm noprint"; b.id = "btnFirmsPage"; b.style.width = "100%";
    d.insertAdjacentElement("afterend", b);
  }
  const foot = document.querySelector(".rail-foot");
  if (foot && !$("dataTools")) {
    const box = document.createElement("div"); box.className = "railsec"; box.id = "dataTools"; box.style.borderBottom = "0";
    box.innerHTML = `<div class="lbl" id="dtLbl"></div><button class="btn sm" id="btnXls"></button>
      <div class="rowflex"><button class="btn sm gh" id="btnBackup"></button><button class="btn sm gh" id="btnRestore"></button></div>
      <input type="file" id="restoreIn" accept=".json,application/json" hidden>`;
    foot.parentNode!.insertBefore(box, foot);
  }
  if (!$("pmPrint")) { const d = document.createElement("div"); d.id = "pmPrint"; document.body.appendChild(d); }
  if (!$("secFile")) {
    const inp = document.createElement("input"); inp.type = "file"; inp.id = "secFile"; inp.multiple = true; inp.hidden = true; inp.accept = ".xlsx,.xlsm,.csv";
    document.body.appendChild(inp);
  }
  bindRail();
}

function bindRail(): void {
  const on = (id: string, fn: (e: any) => void) => { const el = $(id); if (el) el.onclick = fn; };
  on("btnAddProject", () => { void addProject(); });
  on("btnDupProject", () => { void duplicateProject(S.active); });
  on("btnDelProject", () => deleteProject(S.active, true));
  on("btnAddFirm", firmAdd); on("btnRenFirm", () => firmRename(CF())); on("btnDelFirm", () => firmDelete(CF()));
  on("btnFirmsPage", () => { S.page = "firms"; save(); render(); });
  $("selContractor").onchange = (e: any) => firmGo(+e.target.value);
  $("selProject").onchange = (e: any) => {
    const ix = +e.target.value, pr = S.projects[ix];
    if (!pr || (+pr.contractor || 0) !== CF()) { render(); return; }   // حارس: لا انتقال لمشروع مقاول آخر
    S.active = ix; save(); render();
  };
  on("btnDeriveAll", () => { void deriveAndReview(); });
  on("btnDeck", () => { if (!guardAct("deck", "view")) return; openDeck(); $("rail").classList.remove("open"); });
  on("deckClose", closeDeck); on("deckPrev", () => stepDeck(-1)); on("deckNext", () => stepDeck(1));
  on("deckPrint", () => window.print());
  on("deckFull", () => {
    const el = $("deck");
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => toast(T("ملء الشاشة غير متاح", "Full screen unavailable")));
  });
  on("btnMap", () => { if (!guardAct("map", "view")) return; S.page = "map"; save(); render(); $("rail").classList.remove("open"); });
  on("btnXls", () => { void exportWorkbook(); });
  on("btnBackup", () => { void backupData(); });
  on("btnRestore", () => $("restoreIn").click());
  $("restoreIn").onchange = (e: any) => { if (e.target.files[0]) void restoreData(e.target.files[0]); e.target.value = ""; };
  on("langAr", () => { S.lang = "ar"; save(); render(); });
  on("langEn", () => { S.lang = "en"; save(); render(); });
  on("btnTheme", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(LS + "-theme", next); } catch { /* ignore */ }
    applyLang();
  });
  try { const th = localStorage.getItem(LS + "-theme"); if (th) document.documentElement.setAttribute("data-theme", th); } catch { /* ignore */ }
  on("btnPrint", () => window.print());
  on("burger", () => $("rail").classList.toggle("open"));
  on("btnEmailReport", () => openEmailReport());
}

export function applyLang(): void {
  document.body.setAttribute("dir", AR() ? "rtl" : "ltr");
  document.body.setAttribute("lang", AR() ? "ar" : "en");
  document.documentElement.setAttribute("lang", AR() ? "ar" : "en");
  document.documentElement.setAttribute("dir", AR() ? "rtl" : "ltr");
  document.querySelectorAll<HTMLElement>("[data-ar]").forEach((el) => { el.textContent = AR() ? el.dataset.ar! : el.dataset.en!; });
  $("langAr").setAttribute("aria-pressed", String(AR()));
  $("langEn").setAttribute("aria-pressed", String(!AR()));
  $("btnTheme").textContent = document.documentElement.getAttribute("data-theme") === "dark" ? T("الوضع النهاري", "Light mode") : T("الوضع الليلي", "Dark mode");
}

/** الشريط الجانبي: مشاريع المقاول المختار فقط (عزل تام) */
export function renderRail(): void {
  ensureChrome();
  firmGuard();
  const cur = CF(), p = P() || { admin: "", sector: "", derived: null, wo: "", name: "", site: "" }, mine = firmProjects(cur);

  $("selContractor").innerHTML = CONTRACTORS.map((c, i) => `<option value="${i}">${esc(c)} — ${firmProjects(i).length} ${AR() ? "مشروع" : "proj."}</option>`).join("");
  $("selContractor").value = cur;
  $("selProject").innerHTML = mine.length
    ? mine.map((o) => `<option value="${o.ix}">${esc(o.p.name)}${o.p.wo ? " — " + esc(o.p.wo) : ""}</option>`).join("")
    : `<option value="${S.active}" disabled selected>${T("لا توجد مشاريع لهذا المقاول", "No projects for this contractor")}</option>`;
  if (mine.length) $("selProject").value = S.active;

  let box = $("frmScope");
  const fresh = !box; if (!box) box = document.createElement("div");
  box.className = "frmscope noprint"; box.id = "frmScope";
  box.innerHTML = `<i style="background:${fHex(cur)}"></i><span>${T("تُعرض مشاريع", "Showing")}
    <b>${esc(CONTRACTORS[cur] || "—")}</b> ${T("فقط", "only")} — ${nf(mine.length)} ${T("مشروع", "project(s)")}</span>`;
  if (fresh) $("projTags").insertAdjacentElement("beforebegin", box);

  $("nav").innerHTML = PAGES.map((pg, i) => `<button data-page="${pg.id}" aria-current="${S.page === pg.id}">
      <span class="ix">${i === 0 ? "◎" : String(i).padStart(2, "0")}</span><span>${esc(T(pg.ar, pg.en))}</span></button>`).join("");
  $("nav").querySelectorAll("button").forEach((b: HTMLElement) => b.onclick = () => {
    S.page = b.dataset.page!;
    if (S.page === "emails") E.loaded = false;        // بيانات حية عند كل دخول للصفحة
    if (S.page === "users") U.loaded = false;
    save(); render(); $("rail").classList.remove("open");
  });

  $("projTags").innerHTML =
    `<span class="pill" style="background:${fHex(cur)}33;color:var(--ink)">${esc(CONTRACTORS[cur] || "—")}</span>
     <span class="pill">${esc(p.admin)}</span><span class="pill">${esc(T("قطاع " + p.sector, p.sector))}</span>
     <span class="pill ${p.derived ? "ok" : "warn"}">${p.derived ? T("محصور", "Derived") : T("بانتظار الحصر", "Pending")}</span>`;
  $("woPill").textContent = T("أمر عمل ", "W/O ") + (p.wo || "—");
  $("deriveState").textContent = p.derived
    ? T("آخر تشغيل: ", "Last run: ") + new Date(p.derived.at).toLocaleString(AR() ? "ar-EG" : "en-GB", { dateStyle: "short", timeStyle: "short" })
    : T("لم يُشغّل بعد", "Not run yet");
  const pg = PAGES.find((x) => x.id === S.page) || PAGES[0];
  $("pageTitle").textContent = pg ? T(pg.ar, pg.en) : "";
  $("pageCrumb").textContent = (CONTRACTORS[cur] ? CONTRACTORS[cur] + " · " : "") + p.name + (p.site ? " · " + p.site : "");

  const set = (id: string, ar: string, en: string) => { const el = $(id); if (el) el.textContent = T(ar, en); };
  set("btnAddFirm", "+ مقاول", "+ Firm"); set("btnRenFirm", "تعديل", "Rename"); set("btnDelFirm", "حذف", "Delete");
  set("btnFirmsPage", "دفتر المقاولين والمشاريع ↗", "Contractor register ↗");
  set("dtLbl", "٤ · البيانات والتصدير", "4 · Data & export"); set("btnXls", "تصدير المشروع إلى Excel", "Export project to Excel");
  set("btnBackup", "حفظ نسخة", "Backup"); set("btnRestore", "استعادة", "Restore");
  set("btnMap", "⌖  عرض المشروع على الخريطة", "⌖  Show project on the map");
  const t = $("orgTxt"); if (t) t.innerHTML = `<b>${esc(T(ORG_AR, ORG_EN))}</b>${esc(T("مشاريع التحويل — نجران", "Conversion projects — Najran"))}`;
  const pr = document.querySelector(".rail-foot"); if (pr) {
    let r = pr.querySelector(".pmrail"); if (!r) { r = document.createElement("div"); r.className = "pmrail"; pr.appendChild(r); }
    r.innerHTML = `${esc(T(PM_ROLE_AR, PM_ROLE_EN))}<br><b>${esc(PM_NAME)}</b>`;
  }
  // الصلاحيات على أزرار الشريط
  const hide = (id: string, ok: boolean) => { const el = $(id); if (el) el.hidden = !ok; };
  hide("btnDeck", can("deck", "view")); hide("btnMap", can("map", "view"));
  const ro = !editable("firms");
  ["btnAddProject", "btnDupProject", "btnAddFirm", "btnRenFirm"].forEach((id) => { const el = $(id); if (el) { el.disabled = ro; el.classList.toggle("locked-field", ro); } });
  const bd = $("btnDelProject"); if (bd) { const x = !can("firms", "del") || !AUTH.unlocked; bd.disabled = x; bd.classList.toggle("locked-field", x); }
  const bf = $("btnDelFirm"); if (bf) { const x = !can("firms", "del") || !AUTH.unlocked; bf.disabled = x; bf.classList.toggle("locked-field", x); }
  const dr = $("btnDeriveAll"); if (dr && !S.busy) { const x = !can("import", "edit") || !AUTH.unlocked; dr.disabled = x; dr.classList.toggle("locked-field", x); dr.textContent = T("استنباط ومعالجة ذكية للبيانات", "Derive & AI-process data"); }
}
