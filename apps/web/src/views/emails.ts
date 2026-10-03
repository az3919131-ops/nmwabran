/** صفحة «قوائم البريد»: إدارة المستلمين، نطاق التقارير، الاختبار، السجل، صحة المزوّد، الجدولة */
import { REPORT_TITLES, type ReportKey } from "@iltizam/core";
import { AR, AUTH, S, T, can, editable, esc, nf, toast } from "../runtime";
import { del, get, patch, post, put, upload } from "../api";
import { askOk, trapDialog } from "../ui";
import { render } from "../render";
import { safe } from "../actions/common";

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const PAGE_SIZE = 100, PAGE_ABOVE = 200;

interface Recipient { id: string; email: string; name: string; roleLabel: string; active: boolean; isSystem: boolean; createdAt: string; createdBy: string; lastReport: { reportKey: string; at: string } | null }
interface LogRow { id: string; reportKey: string; project: string | null; wo: string | null; sentBy: string; subject: string; status: string; error: string | null; attempts: number; createdAt: string; sentAt: string | null; recipients: { email: string; status: string; error?: string }[]; attachments: { name: string; mode: string }[] }
interface Sched { id: string; reportKey: string; workOrderId: string | null; cron: string; lang: string; attachPdf: boolean; attachXlsx: boolean; active: boolean; lastRunAt: string | null }

export const E = {
  loaded: false, loading: false, err: "",
  items: [] as Recipient[], summary: { total: 0, active: 0, lastSentAt: null as string | null, successRate30d: null as number | null, attempts30d: 0 },
  adminEmail: "", scopeKeys: [] as string[], denied: [] as { recipientId: string; reportKey: string }[],
  log: [] as LogRow[], logOffset: 0, logMore: false,
  health: null as null | { ok: boolean; provider: string; detail: string },
  schedules: [] as Sched[], page: 0, formErr: "", bulkMsg: "", testJob: null as string | null,
};

const fmt = (d: string | null, withTime = true) => d ? new Date(d).toLocaleString(AR() ? "ar-EG" : "en-GB", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }) : "—";
const rTitle = (k: string) => (REPORT_TITLES as Record<string, { ar: string; en: string }>)[k] ? T(REPORT_TITLES[k as ReportKey].ar, REPORT_TITLES[k as ReportKey].en) : (k === "test" ? T("رسالة اختبار", "Test message") : k);

export async function loadEmails(more = false): Promise<void> {
  E.loading = true;
  try {
    const [list, scope, log, health, sch] = await Promise.all([
      get("/email-recipients"), get("/email-recipients/scope"), get("/email-log", { limit: 50, offset: more ? E.logOffset : 0 }),
      get("/mail/health").catch(() => null), get("/report-schedules").catch(() => []),
    ]);
    E.items = list.items; E.summary = list.summary; E.adminEmail = list.adminEmail;
    E.scopeKeys = scope.reportKeys; E.denied = scope.denied;
    E.log = more ? [...E.log, ...log] : log; E.logOffset = E.log.length; E.logMore = log.length >= 50;
    E.health = health; E.schedules = sch; E.loaded = true; E.err = "";
  } catch (e: any) { E.err = e?.message ?? "error"; }
  finally { E.loading = false; }
}
const refresh = async (more = false) => { await loadEmails(more); render(); };

export function viewEmails(): string {
  if (!can("emails", "view")) return `<div class="card"><div class="body denied"><div class="ic">🔒</div><h3>${T("لا تملك صلاحية عرض قوائم البريد", "You cannot view the mailing lists")}</h3></div></div>`;
  if (!E.loaded) return `<div id="emailsPage"><div class="card"><div class="body"><p class="muted" role="status">${E.err ? esc(E.err) : T("جارٍ تحميل قوائم البريد…", "Loading mailing lists…")}</p></div></div></div>`;
  const canEdit = editable("emails"), canDel = can("emails", "del") && AUTH.unlocked, dis = canEdit ? "" : "disabled";
  const total = E.items.length, paged = total > PAGE_ABOVE;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (E.page >= pages) E.page = pages - 1;
  const shown = paged ? E.items.slice(E.page * PAGE_SIZE, (E.page + 1) * PAGE_SIZE) : E.items;
  const hl = E.health;
  return `<div id="emailsPage">
  <div class="sec-title"><h2>${T("قوائم البريد", "Mailing lists")}</h2>
    <span class="s">${T("من يتلقى التقارير المرسلة من الصفحات — مدير النظام مستلم إلزامي دائمًا", "Who receives the reports emailed from the pages — the administrator is always a mandatory recipient")}</span>
    <span style="flex:1 1 auto"></span>
    <span class="pill ${hl ? (hl.ok ? "ok" : "bad") : "warn"}" id="emHealth" title="${esc(hl?.detail ?? "")}" role="status">
      ${hl ? (hl.ok ? "● " + T("مزوّد البريد يعمل", "Mail provider OK") : "● " + T("مزوّد البريد لا يعمل", "Mail provider down")) : "● " + T("حالة المزوّد غير معروفة", "Provider status unknown")} · ${esc(hl?.provider ?? AUTH.features.mailProvider)}</span>
    <button class="btn sm noprint" id="emTestAll" ${canEdit ? "" : "disabled"}>${T("رسالة اختبار للجميع", "Test message to all")}</button></div>

  <div class="grid g4">
    <div class="stat hero"><span class="k">${T("المستلمون", "Recipients")}</span><span class="v">${nf(E.summary.total)}</span><span class="d">${T("في القائمة", "in the list")}</span></div>
    <div class="stat"><span class="k">${T("النشطون", "Active")}</span><span class="v">${nf(E.summary.active)}</span><span class="d">${T("يتلقون التقارير", "receiving reports")}</span></div>
    <div class="stat"><span class="k">${T("آخر إرسال", "Last send")}</span><span class="v" style="font-size:15px">${fmt(E.summary.lastSentAt)}</span><span class="d">&nbsp;</span></div>
    <div class="stat"><span class="k">${T("نجاح 30 يومًا", "30-day success")}</span><span class="v">${E.summary.successRate30d == null ? "—" : E.summary.successRate30d + "%"}</span>
      <span class="d">${nf(E.summary.attempts30d)} ${T("محاولة", "attempts")}</span></div>
  </div>

  <div class="card"><header><h3>${T("إضافة مستلم", "Add a recipient")}</h3></header>
    <div class="body"><form id="emAdd" class="em-form" novalidate>
      <label class="fld"><span>${T("البريد الإلكتروني", "Email")}</span><input type="email" id="emEmail" dir="ltr" autocomplete="off" placeholder="name@company.com" ${dis} aria-describedby="emErr"></label>
      <label class="fld"><span>${T("الاسم", "Name")}</span><input type="text" id="emName" maxlength="120" ${dis}></label>
      <label class="fld"><span>${T("الصفة (اختياري)", "Role (optional)")}</span><input type="text" id="emRole" maxlength="120" ${dis}></label>
      <button class="btn pri" id="emAddBtn" type="submit" ${dis}>${T("إضافة", "Add")}</button>
    </form>
    <div id="emErr" class="gate-err" role="alert" aria-live="assertive" ${E.formErr ? "" : "hidden"}>${esc(E.formErr)}</div>
    <details class="em-bulk"><summary>${T("إضافة جماعية: لصق قائمة أو استيراد ملف", "Bulk: paste a list or import a file")}</summary>
      <textarea id="emBulk" rows="4" dir="ltr" placeholder="a@x.com, Name&#10;b@y.com&#10;c@z.com;Name" ${dis}></textarea>
      <div class="rowflex"><button class="btn sm pri" id="emBulkBtn" ${dis}>${T("إضافة القائمة", "Add the list")}</button>
        <button class="btn sm" id="emImpBtn" ${dis}>${T("استيراد CSV / Excel", "Import CSV / Excel")}</button>
        <input type="file" id="emImpFile" accept=".csv,.xlsx,.xlsm" hidden></div>
      <div id="emBulkMsg" class="note" role="status" ${E.bulkMsg ? "" : "hidden"}>${E.bulkMsg}</div></details></div></div>

  <div class="card"><header><h3>${T("المستلمون", "Recipients")}</h3><span class="sub">${nf(total)}</span></header>
    <div class="body tight scroll"><table id="tblRecipients"><thead><tr>
      <th>${T("البريد", "Email")}</th><th>${T("الاسم", "Name")}</th><th>${T("الصفة", "Role")}</th><th>${T("نشط", "Active")}</th>
      <th>${T("أُضيف", "Added")}</th><th>${T("آخر تقرير", "Last report")}</th><th class="noprint">${T("إجراءات", "Actions")}</th></tr></thead>
      <tbody>${shown.map((r) => r.isSystem ? `<tr class="em-sys" data-rid="${esc(r.id)}">
        <td class="code" dir="ltr">🔒 ${esc(r.email)}</td>
        <td class="wrap-t"><span class="nm-view">${esc(r.name)}</span> <span class="pill ok">${T("مدير النظام — مستلم إلزامي", "System administrator — mandatory recipient")}</span></td>
        <td>—</td><td><label class="sw"><input type="checkbox" checked disabled aria-label="${T("مفعّل دائمًا", "always on")}"><i></i></label></td>
        <td class="n">${fmt(r.createdAt, false)}</td><td>${r.lastReport ? esc(rTitle(r.lastReport.reportKey)) + " · " + fmt(r.lastReport.at) : "—"}</td>
        <td class="noprint"><div class="rowflex"><button class="btn sm gh" data-ren="${esc(r.id)}" ${dis}>${T("تعديل الاسم", "Rename")}</button>
          <button class="btn sm gh" data-test="${esc(r.id)}" ${canEdit ? "" : "disabled"}>${T("اختبار", "Test")}</button></div></td></tr>`
        : `<tr data-rid="${esc(r.id)}">
        <td class="code" dir="ltr">${esc(r.email)}</td><td class="wrap-t">${esc(r.name || "—")}</td><td class="wrap-t">${esc(r.roleLabel || "—")}</td>
        <td><label class="sw"><input type="checkbox" data-act="${esc(r.id)}" ${r.active ? "checked" : ""} ${dis} aria-label="${T("تفعيل", "Active")} ${esc(r.email)}"><i></i></label></td>
        <td class="n">${fmt(r.createdAt, false)}<br><span class="muted" style="font-size:10.5px">${esc(r.createdBy)}</span></td>
        <td>${r.lastReport ? esc(rTitle(r.lastReport.reportKey)) + "<br><span class=\"muted\" style=\"font-size:10.5px\">" + fmt(r.lastReport.at) + "</span>" : "—"}</td>
        <td class="noprint"><div class="rowflex">
          <button class="btn sm gh" data-edit="${esc(r.id)}" ${dis}>${T("تعديل", "Edit")}</button>
          <button class="btn sm gh" data-test="${esc(r.id)}" ${canEdit ? "" : "disabled"}>${T("اختبار", "Test")}</button>
          <button class="btn sm gh" data-del="${esc(r.id)}" ${canDel ? "" : "disabled"}>${T("حذف", "Delete")}</button></div></td></tr>`).join("")}
      </tbody></table></div>
    ${paged ? `<div class="body rowflex noprint" style="justify-content:center"><button class="btn sm" id="emPrev" ${E.page === 0 ? "disabled" : ""}>‹</button>
      <span class="muted">${E.page + 1} / ${pages}</span><button class="btn sm" id="emNext" ${E.page >= pages - 1 ? "disabled" : ""}>›</button></div>` : ""}
  </div>

  <div class="card"><header><h3>${T("نطاق التقارير لكل مستلم", "Report scope per recipient")}</h3>
    <span class="sub">${T("الافتراضي: يتلقى كل مستلم كل التقارير — ألغِ التحديد لاستثناء تقرير", "Default: everyone gets every report — untick to exclude one")}</span></header>
    <div class="body tight scroll"><table id="tblScope"><thead><tr><th>${T("المستلم", "Recipient")}</th>${E.scopeKeys.map((k) => `<th title="${esc(rTitle(k))}" style="font-size:10.5px">${esc(rTitle(k))}</th>`).join("")}</tr></thead>
      <tbody>${E.items.map((r) => `<tr><td dir="ltr" class="code">${r.isSystem ? "🔒 " : ""}${esc(r.email)}</td>
        ${E.scopeKeys.map((k) => { const denied = E.denied.some((d) => d.recipientId === r.id && d.reportKey === k);
          return `<td><input type="checkbox" data-scope="${esc(r.id)}|${esc(k)}" ${denied ? "" : "checked"} ${r.isSystem || !canEdit ? "disabled" : ""} aria-label="${esc(r.email)} — ${esc(rTitle(k))}"></td>`; }).join("")}</tr>`).join("")}
      </tbody></table></div></div>

  <div class="card"><header><h3>${T("جدولة إرسال التقارير", "Scheduled reports")}</h3>
    <span class="sub">${T("أسبوعيًا أو شهريًا — بتوقيت الخادم", "weekly or monthly — in the server's time zone")}</span></header>
    <div class="body">
      <form id="schAdd" class="em-form" novalidate>
        <label class="fld"><span>${T("التقرير", "Report")}</span><select id="shKey" ${dis}>${E.scopeKeys.map((k) => `<option value="${esc(k)}">${esc(rTitle(k))}</option>`).join("")}</select></label>
        <label class="fld"><span>${T("المشروع", "Project")}</span><select id="shWo" ${dis}>${S.projects.map((p: any) => `<option value="${esc(p.id)}">${esc(p.name)} — ${esc(p.wo || "")}</option>`).join("")}</select></label>
        <label class="fld"><span>${T("التكرار", "Frequency")}</span><select id="shFreq" ${dis}><option value="weekly">${T("أسبوعيًا", "Weekly")}</option><option value="monthly">${T("شهريًا", "Monthly")}</option></select></label>
        <label class="fld"><span id="shDayL">${T("اليوم", "Day")}</span><select id="shDay" ${dis}></select></label>
        <label class="fld"><span>${T("الساعة", "Hour")}</span><select id="shHour" ${dis}>${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === 8 ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`).join("")}</select></label>
        <button class="btn pri" type="submit" ${dis}>${T("إضافة جدولة", "Add schedule")}</button></form>
      <div id="shErr" class="gate-err" role="alert" hidden></div>
      <table class="stbl" style="margin-top:10px"><thead><tr><th>${T("التقرير", "Report")}</th><th>${T("المشروع", "Project")}</th><th>cron</th><th>${T("آخر تشغيل", "Last run")}</th><th>${T("نشط", "Active")}</th><th></th></tr></thead>
      <tbody>${E.schedules.map((s) => { const p = S.projects.find((x: any) => x.id === s.workOrderId); return `<tr>
        <td>${esc(rTitle(s.reportKey))}</td><td>${esc(p ? p.name : "—")}</td><td class="code" dir="ltr">${esc(s.cron)}</td><td class="n">${fmt(s.lastRunAt)}</td>
        <td><label class="sw"><input type="checkbox" data-shact="${esc(s.id)}" ${s.active ? "checked" : ""} ${dis}><i></i></label></td>
        <td><button class="btn sm gh" data-shdel="${esc(s.id)}" ${canDel ? "" : "disabled"}>${T("حذف", "Delete")}</button></td></tr>`; }).join("")
        || `<tr><td colspan="6" class="muted" style="padding:10px">${T("لا جداول بعد", "No schedules yet")}</td></tr>`}</tbody></table></div></div>

  <div class="card"><header><h3>${T("سجل الإرسال", "Send log")}</h3><span class="sp"></span>
    <button class="btn sm gh noprint" id="emLogRefresh">${T("تحديث", "Refresh")}</button></header>
    <div class="body tight scroll"><table id="tblLog"><thead><tr><th>${T("الوقت", "Time")}</th><th>${T("التقرير", "Report")}</th><th>${T("المشروع", "Project")}</th><th>${T("المرسِل", "Sender")}</th>
      <th>${T("الحالة", "Status")}</th><th>${T("المستلمون", "Recipients")}</th><th class="noprint"></th></tr></thead>
      <tbody>${E.log.map((l) => { const ok = l.recipients.filter((x) => x.status === "sent").length, bad = l.recipients.filter((x) => x.status === "failed");
        return `<tr><td class="n">${fmt(l.createdAt)}</td><td>${esc(rTitle(l.reportKey))}</td><td class="wrap-t">${esc(l.project ?? "—")}${l.wo ? `<br><span class="code">${esc(l.wo)}</span>` : ""}</td>
        <td>${esc(l.sentBy)}</td>
        <td><span class="pill ${l.status === "sent" ? "ok" : l.status === "failed" ? "bad" : "warn"}">${esc(l.status)}</span></td>
        <td style="font-size:11.5px">${ok}/${l.recipients.length}${bad.length ? `<br><span style="color:var(--bad)">${esc(bad.map((b) => b.email + (b.error ? " — " + b.error : "")).join("؛ ").slice(0, 160))}</span>` : ""}${l.error ? `<br><span class="muted">${esc(l.error.slice(0, 120))}</span>` : ""}</td>
        <td class="noprint">${l.status === "failed" || l.status === "partial" ? `<button class="btn sm" data-retry="${esc(l.id)}" ${canEdit || can("emails", "edit") ? "" : "disabled"}>${T("إعادة المحاولة", "Retry")}</button>` : ""}</td></tr>`; }).join("")
        || `<tr><td colspan="7" class="muted" style="padding:12px">${T("لا إرسالات بعد", "No sends yet")}</td></tr>`}</tbody></table></div>
    ${E.logMore ? `<div class="body" style="text-align:center"><button class="btn sm" id="emLogMore">${T("عرض الأقدم", "Show older")}</button></div>` : ""}</div>
  </div>`;
}

const sched = (freq: string, day: number, hour: number) => freq === "weekly" ? `0 ${hour} * * ${day}` : `0 ${hour} ${day} * *`;

export function wireEmails(v: HTMLElement): void {
  if (!can("emails", "view")) return;
  if (!E.loaded) { if (!E.loading) void loadEmails().then(() => render()); return; }
  const $id = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const byId = (id: string) => E.items.find((x) => x.id === id);

  /* إضافة مستلم (تحقق RFC + أخطاء عربية) */
  const form = $id<HTMLFormElement>("emAdd");
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    const email = $id<HTMLInputElement>("emEmail")!.value.trim().toLowerCase();
    const err = (m: string) => { E.formErr = m; const el = $id("emErr")!; el.hidden = false; el.textContent = m; $id("emEmail")!.setAttribute("aria-invalid", "true"); };
    if (!email) return err(T("أدخل البريد الإلكتروني", "Enter the email address"));
    if (!EMAIL_RE.test(email) || email.length > 254) return err(T("صيغة البريد غير صحيحة", "The email format is invalid"));
    if (E.items.some((x) => x.email === email)) return err(T("هذا البريد مسجّل بالفعل", "This email is already registered"));
    try {
      await post("/email-recipients", { email, name: $id<HTMLInputElement>("emName")!.value.trim(), roleLabel: $id<HTMLInputElement>("emRole")!.value.trim() });
      E.formErr = ""; toast(T("تمت إضافة المستلم", "Recipient added")); await refresh();
    } catch (ex: any) { err(ex?.message ?? T("تعذّرت الإضافة", "Could not add")); }
  };

  /* إضافة جماعية بلصق نص */
  const bulkMsg = (r: { added: number; skipped: { email: string; reason: string }[] }) => {
    E.bulkMsg = `${T("أُضيف", "Added")}: <b>${r.added}</b>${r.skipped.length ? ` · ${T("متجاوَز", "skipped")}: <b>${r.skipped.length}</b><br>${r.skipped.slice(0, 12).map((s) => `<span dir="ltr">${esc(s.email)}</span> — ${esc(s.reason)}`).join("<br>")}` : ""}`;
  };
  $id("emBulkBtn")?.addEventListener("click", async () => {
    const txt = $id<HTMLTextAreaElement>("emBulk")!.value;
    const items = txt.split(/[\n;,\t]+/).map((s) => s.trim()).filter(Boolean).map((s) => ({ email: s.split(/\s+/)[0] }));
    // سطر «email, الاسم» أو «email الاسم»: نقرأ الاسم بعد العنوان
    const lines = txt.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: { email: string; name?: string }[] = [];
    for (const l of lines) {
      const m = l.match(/[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[^\s,;\t]+/g);
      if (!m) { parsed.push({ email: l }); continue; }
      const rest = l.replace(/[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[^\s,;\t]+/g, " ").replace(/[,;\t]+/g, " ").trim();
      m.forEach((e, i) => parsed.push({ email: e, name: i === 0 && m.length === 1 ? rest : "" }));
    }
    const list = parsed.length ? parsed : items;
    if (!list.length) { toast(T("الصق قائمة عناوين أولًا", "Paste a list of addresses first")); return; }
    const r = await safe(() => post("/email-recipients/bulk", { items: list }));
    if (r) { bulkMsg(r); await refresh(); }
  });
  $id("emImpBtn")?.addEventListener("click", () => $id<HTMLInputElement>("emImpFile")!.click());
  const imp = $id<HTMLInputElement>("emImpFile");
  if (imp) imp.onchange = async () => {
    const f = imp.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f, f.name);
    const r = await safe(() => upload("/email-recipients/import", fd)); imp.value = "";
    if (r) { bulkMsg(r); await refresh(); }
  };

  /* جدول المستلمين */
  v.querySelectorAll<HTMLInputElement>("[data-act]").forEach((c) => c.onchange = async () => {
    const r = await safe(() => patch(`/email-recipients/${c.dataset.act}`, { active: c.checked })); await refresh(); void r;
  });
  v.querySelectorAll<HTMLElement>("[data-ren],[data-edit]").forEach((b) => b.onclick = () => editDialog(byId((b.dataset.ren ?? b.dataset.edit)!)!));
  v.querySelectorAll<HTMLElement>("[data-del]").forEach((b) => b.onclick = () => {
    const r = byId(b.dataset.del!); if (!r) return;
    askOk(T("حذف المستلم", "Delete recipient"), T(`سيُحذف <b dir="ltr">${esc(r.email)}</b> من القائمة نهائيًا.`, `<b dir="ltr">${esc(r.email)}</b> will be removed from the list.`),
      async () => { const x = await safe(() => del(`/email-recipients/${r.id}`)); if (x) { toast(T("تم الحذف", "Deleted")); await refresh(); } }, T("حذف", "Delete"));
  });
  v.querySelectorAll<HTMLElement>("[data-test]").forEach((b) => b.onclick = async () => {
    const r = await safe(() => post(`/email-recipients/${b.dataset.test}/test`)); if (r) { toast(T("أُرسلت رسالة اختبار — راجع السجل", "Test message queued — see the log")); setTimeout(() => void refresh(), 2500); }
  });
  $id("emTestAll")?.addEventListener("click", async () => {
    const r = await safe(() => post("/email-recipients/test-all")); if (r) { toast(T("أُرسلت رسائل اختبار للمستلمين النشطين", "Test messages queued for active recipients")); setTimeout(() => void refresh(), 2500); }
  });
  $id("emPrev")?.addEventListener("click", () => { E.page = Math.max(0, E.page - 1); render(); });
  $id("emNext")?.addEventListener("click", () => { E.page++; render(); });

  /* نطاق التقارير */
  v.querySelectorAll<HTMLInputElement>("[data-scope]").forEach((c) => c.onchange = async () => {
    const [rid, key] = c.dataset.scope!.split("|");
    const r = await safe(() => put(`/email-recipients/${rid}/scope`, { reportKey: key, allowed: c.checked }));
    if (r) { E.denied = E.denied.filter((d) => !(d.recipientId === rid && d.reportKey === key)); if (!c.checked) E.denied.push({ recipientId: rid, reportKey: key }); }
    else c.checked = !c.checked;
  });

  /* الجدولة */
  const freq = $id<HTMLSelectElement>("shFreq"), day = $id<HTMLSelectElement>("shDay"), dl = $id("shDayL");
  const fillDay = () => {
    if (!freq || !day) return;
    if (freq.value === "weekly") { const names = AR() ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]; day.innerHTML = names.map((n, i) => `<option value="${i}">${n}</option>`).join(""); if (dl) dl.textContent = T("اليوم", "Day"); }
    else { day.innerHTML = Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join(""); if (dl) dl.textContent = T("يوم الشهر", "Day of month"); }
  };
  fillDay(); if (freq) freq.onchange = fillDay;
  const sf = $id<HTMLFormElement>("schAdd");
  if (sf) sf.onsubmit = async (e) => {
    e.preventDefault();
    const cron = sched(freq!.value, +day!.value, +$id<HTMLSelectElement>("shHour")!.value);
    const r = await safe(() => post("/report-schedules", { reportKey: $id<HTMLSelectElement>("shKey")!.value, workOrderId: $id<HTMLSelectElement>("shWo")!.value || null, cron, lang: S.lang, attachPdf: true, attachXlsx: true }));
    if (r) { toast(T("تمت إضافة الجدولة", "Schedule added")); await refresh(); }
  };
  v.querySelectorAll<HTMLInputElement>("[data-shact]").forEach((c) => c.onchange = async () => { await safe(() => patch(`/report-schedules/${c.dataset.shact}`, { active: c.checked })); await refresh(); });
  v.querySelectorAll<HTMLElement>("[data-shdel]").forEach((b) => b.onclick = async () => { const r = await safe(() => del(`/report-schedules/${b.dataset.shdel}`)); if (r) await refresh(); });

  /* السجل */
  $id("emLogRefresh")?.addEventListener("click", () => { void refresh(); });
  $id("emLogMore")?.addEventListener("click", () => { void refresh(true); });
  v.querySelectorAll<HTMLElement>("[data-retry]").forEach((b) => b.onclick = async () => {
    const r = await safe(() => post(`/email-log/${b.dataset.retry}/retry`)); if (r) { toast(T("أُعيدت المحاولة", "Retry queued")); setTimeout(() => void refresh(), 2500); }
  });
}

function editDialog(r: Recipient): void {
  const w = document.createElement("div"); w.className = "askwrap";
  const sys = r.isSystem;
  w.innerHTML = `<div class="askbox"><h4>${sys ? T("تعديل اسم مدير النظام", "Rename the system administrator") : T("تعديل المستلم", "Edit recipient")}</h4>
    <label class="fld"><span>${T("البريد", "Email")}</span><input type="email" id="edE" dir="ltr" value="${esc(r.email)}" ${sys ? "disabled" : ""}></label>
    <label class="fld"><span>${T("الاسم", "Name")}</span><input type="text" id="edN" maxlength="120" value="${esc(r.name)}"></label>
    ${sys ? `<div class="note">${T("مدير النظام مستلم إلزامي: لا يُحذف ولا يُعطَّل ولا يتغير بريده — يمكن تعديل الاسم فقط.", "The administrator is a mandatory recipient: it cannot be deleted, disabled or have its address changed — only the name can be edited.")}</div>`
      : `<label class="fld"><span>${T("الصفة", "Role")}</span><input type="text" id="edR" maxlength="120" value="${esc(r.roleLabel)}"></label>`}
    <div id="edErr" class="gate-err" role="alert" hidden></div>
    <div class="askbtns"><button class="btn sm" id="edNo">${T("إلغاء", "Cancel")}</button><button class="btn sm pri" id="edYes">${T("حفظ", "Save")}</button></div></div>`;
  document.body.appendChild(w);
  let release = () => {}; const close = () => { release(); w.remove(); }; release = trapDialog(w, close);
  (w.querySelector("#edNo") as HTMLElement).onclick = close;
  (w.querySelector("#edYes") as HTMLElement).onclick = async () => {
    const body: Record<string, unknown> = { name: (w.querySelector("#edN") as HTMLInputElement).value.trim() };
    if (!sys) {
      const email = (w.querySelector("#edE") as HTMLInputElement).value.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) { const e = w.querySelector("#edErr") as HTMLElement; e.hidden = false; e.textContent = T("صيغة البريد غير صحيحة", "The email format is invalid"); return; }
      body.email = email; body.roleLabel = (w.querySelector("#edR") as HTMLInputElement).value.trim();
    }
    const x = await safe(() => patch(`/email-recipients/${r.id}`, body));
    if (x) { close(); toast(T("تم الحفظ", "Saved")); await refresh(); }
  };
  w.onclick = (e) => { if (e.target === w) close(); };
}
