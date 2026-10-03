/**
 * الرسم المركزي: يجمع في ترتيب واحد ما كانت المنصة القديمة تركّبه كطبقات متتالية حول render().
 * الصفحة = قالب HTML (views/*) + ربط أحداث (wiring/*) + طبقات مشتركة (شريط التحديث، التوقيع، الصلاحيات).
 */
import { $, AUTH, P, PAGES, S, T, can, firmGuard, firmProjects, visiblePages } from "./runtime";
import { gateRender, renderUserBar } from "./auth";
import { applyLang, renderRail } from "./wiring/chrome";
import { wire } from "./wiring/core";
import { addPmSign, applyPermsToView, focusableScrollers, labelInputs, mountUpdBar, wireDash, wireExtras, wireFirms, wireGeo, wireMaster, wireQtyInv } from "./wiring/pages";
import { viewDash } from "./views/dash";
import { viewBOQ, viewForms, viewRecs, viewWages } from "./views/basic";
import { viewMasterFull } from "./views/master";
import { viewFirms } from "./views/firms";
import { viewQty, viewInv } from "./views/qty";
import { MAPV, viewMap, wireMap } from "./views/map";
import { viewUsers, wireUsers } from "./views/users";
import { viewEmails, wireEmails } from "./views/emails";
import { buildDeck, renderDeck, deckIsOpen } from "./views/deck";
import { refreshAiLabels } from "./overlays/ai";
import { saveUi } from "./sync";
import { addProject } from "./actions/projects";

export const VIEWS: Record<string, () => string> = {
  dash: viewDash, firms: viewFirms, master: viewMasterFull, qty: viewQty, boq: viewBOQ, wages: viewWages, inv: viewInv,
  forms: viewForms, map: viewMap, recs: viewRecs, emails: viewEmails, users: viewUsers,
};
/** صفحات لا تحتاج مشروعًا نشطًا */
const NO_PROJECT_OK = new Set(["firms", "emails", "users"]);

function emptyState(): string {
  return `<div class="card"><div class="body denied"><div class="ic">📂</div>
    <h3>${T("لا توجد مشاريع لهذا المقاول", "No projects for this contractor")}</h3>
    <p>${T("أنشئ مشروعًا جديدًا من الشريط الجانبي أو من صفحة «المقاولون والمشاريع».", "Create a project from the side rail or from the “Contractors & projects” page.")}</p>
    ${can("firms", "edit") ? `<button class="btn pri" id="dashAdd">${T("+ مشروع جديد", "+ New project")}</button>` : ""}</div></div>`;
}

export function render(): void {
  if (!AUTH.me || !AUTH.me.active) { gateRender(); return; }
  firmGuard();
  // المشروع النشط يتبع المقاول المختار دائمًا
  const f = +((P() || {}).contractor) || 0, mine = firmProjects(f);
  if (mine.length && !mine.some((o) => o.ix === S.active)) S.active = mine[0].ix;
  // صفحة بلا صلاحية عرض → أول صفحة مسموحة
  if (!can(S.page, "view")) { const first = visiblePages()[0]; if (first && first.id !== S.page) S.page = first.id; }

  const mv = MAPV as any;
  if (mv.leaflet) { try { mv.leaflet.map.remove(); } catch { /* ignore */ } mv.leaflet = null; }

  applyLang();
  renderRail();
  renderUserBar();
  const v = $("view") as HTMLElement;
  const hasProject = !!P();
  v.innerHTML = hasProject || NO_PROJECT_OK.has(S.page) ? (VIEWS[S.page] || viewDash)() : emptyState();
  v.dataset.page = S.page;
  if (hasProject) wire();
  window.scrollTo(0, 0);

  // زر «إرسال التقرير»: يظهر لمن يملك صلاحية التصدير في الصفحة الحالية
  const eb = $("btnEmailReport"); if (eb) eb.hidden = !can(S.page, "exp");

  if (deckIsOpen() && hasProject) { buildDeck(); renderDeck(); }
  if (S.page === "map" && hasProject) wireMap();
  if (hasProject) {
    if (S.page === "master") wireMaster(v);
    mountUpdBar(v);
    wireGeo(v);
    wireQtyInv(v);
    if (S.page === "dash") wireDash(v);
  }
  if (S.page === "firms") wireFirms(v);
  if (S.page === "users") wireUsers(v);
  if (S.page === "emails") wireEmails(v);
  if (S.page === "dash" && !hasProject) { const b = $("dashAdd"); if (b) b.onclick = () => { void addProject(); }; }
  if (hasProject) wireExtras(v);
  addPmSign(v);
  applyPermsToView(v);
  focusableScrollers(v);
  labelInputs(v);
  refreshAiLabels();
  document.title = T("محفظة الالتزام للمشاريع للمقاولين", "Compliance Vault — contractor projects") + " · " + (PAGES.find((x) => x.id === S.page)?.[S.lang === "ar" ? "ar" : "en"] ?? "");
  saveUi();
}
