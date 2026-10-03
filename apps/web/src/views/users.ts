/** صفحة المستخدمون والصلاحيات (مدير النظام فقط) — البيانات من الخادم، والفرض عليه */
import { ACTS, AR, AUTH, CONTRACTORS, CONTRACTOR_IDS, MODULES, ROLES, S, T, esc, initials2, isAdmin, nf, toast } from "../runtime";
import { api, del, get, patch, post, put, saveBlob } from "../api";
import { askOk, askText, pwField, trapDialog } from "../ui";
import { render } from "../render";
import { safe } from "../actions/common";
import { PM_NAME, PM_NAME_AR } from "@iltizam/core";

interface UserRow { id: string; username: string; name: string; role: "admin" | "dept" | "pm"; active: boolean; allContractors: boolean; contractorIds: string[]; perms: Record<string, Record<string, number>>; lastLoginAt: string | null }
export const U: {
  loaded: boolean; users: UserRow[]; reqs: any[]; log: any[]; logTotal: number; sel: string | null; keys: any[]; hooks: any[]; hookEvents: string[]; newSecret: string | null;
} = { loaded: false, users: [], reqs: [], log: [], logTotal: 0, sel: null, keys: [], hooks: [], hookEvents: [], newSecret: null };

export async function loadUsersData(): Promise<void> {
  const [users, reqs, log, keys, hooks, ev] = await Promise.all([
    get("/users"), get("/auth/password/requests"), get("/audit-log", { limit: 60 }), get("/api-keys"), get("/webhooks"), get("/webhooks/events"),
  ]);
  U.users = users; U.reqs = reqs; U.log = log.items; U.logTotal = log.total; U.keys = keys; U.hooks = hooks; U.hookEvents = ev.events; U.loaded = true;
  if (!U.sel || !U.users.some((u) => u.id === U.sel)) U.sel = U.users[0]?.id ?? null;
}
const reload = async () => { await loadUsersData(); render(); };
const fmt = (d: string | Date | null, medium = false): string => d ? new Date(d).toLocaleString(AR() ? "ar-EG" : "en-GB", { dateStyle: "short", timeStyle: medium ? "medium" : "short" }) : "—";

const LOG_AR: Record<string, string> = {
  login: "تسجيل دخول", login_fail: "محاولة دخول فاشلة", logout: "تسجيل خروج", lock: "إقفال التعديل", unlock: "فتح قفل التعديل", unlock_fail: "فتح قفل فاشل",
  pw_request: "طلب تغيير كلمة مرور", pw_changed: "تغيير كلمة مرور", pw_bad_current: "كلمة مرور حالية خاطئة", pw_code_bad: "رمز تحقق خاطئ", pw_approved: "اعتماد طلب", pw_rejected: "رفض طلب",
  perm: "تعديل صلاحية", role: "تغيير دور", user_add: "إضافة مستخدم", user_del: "حذف مستخدم", user_tog: "إيقاف/تفعيل", user_ren: "تعديل اسم", user_pwd: "تعيين كلمة مرور",
  user_contractors: "تعديل مقاولي المستخدم", imported: "استيراد ملفات", files_cleared: "مسح الملفات المرفوعة", exported: "تصدير", denied: "محاولة بلا صلاحية",
  report_send: "إرسال تقرير", recipient_add: "إضافة مستلم", recipient_edit: "تعديل مستلم", recipient_del: "حذف مستلم", recipient_bulk: "إضافة مستلمين", recipient_test: "رسالة اختبار",
  schedule_add: "إضافة جدولة", schedule_del: "حذف جدولة", apikey_add: "إنشاء مفتاح API", apikey_revoke: "إلغاء مفتاح API", webhook_add: "إضافة Webhook", webhook_del: "حذف Webhook",
};
const LOG_EN: Record<string, string> = {
  login: "Sign in", login_fail: "Failed sign-in", logout: "Sign out", lock: "Edit lock on", unlock: "Edit unlocked", unlock_fail: "Failed unlock", pw_request: "Password request",
  pw_changed: "Password changed", pw_bad_current: "Wrong current password", pw_code_bad: "Wrong code", pw_approved: "Request approved", pw_rejected: "Request rejected",
  perm: "Permission changed", role: "Role changed", user_add: "User added", user_del: "User deleted", user_tog: "Suspend/activate", user_ren: "Name changed", user_pwd: "Password set",
  user_contractors: "User contractors changed", imported: "Files imported", files_cleared: "Uploaded files cleared", exported: "Export", denied: "Blocked action",
  report_send: "Report sent", recipient_add: "Recipient added", recipient_edit: "Recipient edited", recipient_del: "Recipient deleted", recipient_bulk: "Recipients added", recipient_test: "Test message",
  schedule_add: "Schedule added", schedule_del: "Schedule deleted", apikey_add: "API key created", apikey_revoke: "API key revoked", webhook_add: "Webhook added", webhook_del: "Webhook deleted",
};
const logName = (a: string): string => T(LOG_AR[a] ?? a, LOG_EN[a] ?? a);

export function viewUsers(): string {
  if (!isAdmin()) {
    return `<div class="card"><div class="body denied"><div class="ic">🔒</div>
    <h3>${T("هذه الصفحة لمدير النظام فقط", "This page is for the system administrator only")}</h3>
    <p>${T("إدارة المستخدمين والصلاحيات متاحة لحساب مدير النظام وحده. للاستفسار تواصل مع ", "User and permission management is restricted to the administrator account. Contact ")}
      <b>${esc(T(PM_NAME_AR, PM_NAME))}</b>.</p></div></div>`;
  }
  if (!U.loaded) return `<div class="card"><div class="body"><p class="muted" role="status">${T("جارٍ تحميل المستخدمين…", "Loading users…")}</p></div></div>`;
  const sel = U.users.find((u) => u.id === U.sel) ?? U.users[0];
  const pend = U.reqs.filter((r) => r.status === "pending" || r.status === "sent");
  const me = AUTH.me!;
  return `
  <div class="sec-title"><h2>${T("المستخدمون والصلاحيات", "Users & permissions")}</h2>
    <span class="s">${esc(T("محفظة الالتزام", "Compliance Vault"))} — ${T("من يدخل، وماذا يرى، وماذا يستطيع أن يفعل", "who signs in, what they see, and what they may do")}</span>
    <span style="flex:1 1 auto"></span>
    <button class="btn sm pri noprint" id="uAdd">${T("+ مستخدم جديد", "+ New user")}</button>
    <button class="btn sm noprint" id="uExp">${T("تصدير الدفتر", "Export register")}</button></div>

  <div class="grid g4">
    <div class="stat hero"><span class="k">${T("المستخدمون", "Users")}</span><span class="v">${nf(U.users.length)}</span>
      <span class="d">${nf(U.users.filter((x) => x.active).length)} ${T("نشط", "active")}</span></div>
    <div class="stat"><span class="k">${T("مدير النظام", "Administrators")}</span><span class="v">${nf(U.users.filter((x) => x.role === "admin").length)}</span>
      <span class="d">${esc(T(PM_NAME_AR, PM_NAME))}</span></div>
    <div class="stat"><span class="k">${T("طلبات كلمة مرور", "Password requests")}</span><span class="v">${nf(pend.length)}</span>
      <span class="d">${pend.length ? T("بانتظار الاعتماد", "awaiting approval") : T("لا يوجد معلّق", "none pending")}</span></div>
    <div class="stat"><span class="k">${T("أحداث مسجّلة", "Logged events")}</span><span class="v">${nf(U.logTotal)}</span>
      <span class="d">${T("آخر 60 حدثًا معروضة", "last 60 shown")}</span></div>
  </div>

  ${pend.length ? `<div class="card"><header><h3>${T("طلبات تغيير كلمة المرور", "Password change requests")}</h3>
    <span class="sub">${T("اعتمد الطلب ليُطبّق فورًا، أو ارفضه فيُلغى", "Approve to apply immediately, or reject to cancel")}</span></header>
    <div class="body tight scroll"><table><thead><tr>
      <th>${T("الطلب", "Request")}</th><th>${T("المستخدم", "User")}</th><th>${T("الحالة", "Status")}</th>
      <th>${T("البريد", "Email")}</th><th>${T("ينتهي", "Expires")}</th><th class="noprint">${T("إجراء", "Action")}</th></tr></thead>
      <tbody>${pend.map((r) => `<tr>
        <td class="code">${esc(String(r.id).slice(0, 8))}</td><td>${esc(r.name)} <span class="code">(${esc(r.user)})</span></td>
        <td><span class="pill ${r.status === "sent" ? "ok" : "warn"}">${r.status === "sent" ? T("أُرسل الرمز", "Code sent") : T("قيد الانتظار", "Pending")}</span></td>
        <td style="font-size:11.5px">${r.mailError ? esc(T("تعذّر إرسال البريد", "Mail failed")) : T("تم الإرسال للبريد", "Emailed")}</td>
        <td class="n">${fmt(r.expiresAt)}</td>
        <td class="noprint"><div class="rowflex">
          <button class="btn sm pri" data-pwok="${esc(r.id)}">${T("اعتماد", "Approve")}</button>
          <button class="btn sm gh" data-pwno="${esc(r.id)}">${T("رفض", "Reject")}</button></div></td></tr>`).join("")}
      </tbody></table></div></div>` : ""}

  <div class="card"><header><h3>${T("الحسابات", "Accounts")}</h3>
      <span class="sub">${T("اضغط أي حساب لتحرير صلاحياته", "select an account to edit its permissions")}</span></header>
      <div class="body tight scroll"><table><thead><tr>
        <th>${T("المستخدم", "User")}</th><th>${T("الاسم", "Name")}</th><th>${T("الدور", "Role")}</th><th>${T("آخر دخول", "Last sign-in")}</th>
        <th>${T("الحالة", "Status")}</th><th class="noprint">${T("إجراءات", "Actions")}</th></tr></thead>
        <tbody>${U.users.map((x) => `<tr${sel && x.id === sel.id ? ' style="background:var(--accent-soft)"' : ""} data-upick="${esc(x.id)}" style="cursor:pointer">
          <td><span class="who"><span class="av">${esc(initials2(x.name))}</span><span><span class="nm code">${esc(x.username)}</span></span></span></td>
          <td class="wrap-t">${esc(x.name)}</td>
          <td><select data-urole="${esc(x.id)}" aria-label="${T("الدور", "Role")}" ${x.id === me.id ? "disabled" : ""} style="min-width:120px">
            ${(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((r) => `<option value="${r}" ${x.role === r ? "selected" : ""}>${esc(T(ROLES[r].ar, ROLES[r].en))}</option>`).join("")}
          </select></td>
          <td class="n">${fmt(x.lastLoginAt)}</td>
          <td><span class="pill ${x.active ? "ok" : "bad"}">${x.active ? T("نشط", "Active") : T("موقوف", "Suspended")}</span></td>
          <td class="noprint"><div class="rowflex">
            <button class="btn sm gh" data-uren="${esc(x.id)}">${T("الاسم", "Rename")}</button>
            <button class="btn sm gh" data-upwd="${esc(x.id)}">${T("كلمة المرور", "Password")}</button>
            <button class="btn sm gh" data-utog="${esc(x.id)}" ${x.id === me.id ? "disabled" : ""}>${x.active ? T("إيقاف", "Suspend") : T("تفعيل", "Activate")}</button>
            <button class="btn sm gh" data-udel="${esc(x.id)}" ${x.id === me.id ? "disabled" : ""}>${T("حذف", "Delete")}</button>
          </div></td></tr>`).join("")}</tbody></table></div>
      <div class="body"><div class="note">${T("كلمات المرور لا تُعرض في أي مكان. تُحفظ على الخادم كتجزئة argon2id ولا يمكن استرجاعها — يمكن فقط تعيين كلمة جديدة.",
        "Passwords are never displayed. They are stored on the server as argon2id hashes and cannot be recovered — only replaced.")}</div></div>
  </div>

  ${sel ? `<div class="card"><header><h3>${T("المقاولون المسموح بهم: ", "Allowed contractors: ")}${esc(sel.name)}</h3></header>
    <div class="body" style="display:flex;flex-direction:column;gap:9px">
      ${sel.role === "admin" ? `<div class="note">${T("مدير النظام يرى كل المقاولين دائمًا.", "The administrator always sees every contractor.")}</div>` : `
      <label class="sw-row"><span class="sw"><input type="checkbox" id="uAllC" ${sel.allContractors ? "checked" : ""}><i></i></span> ${T("كل المقاولين (بلا عزل)", "All contractors (no isolation)")}</label>
      <div class="rowflex" style="flex-wrap:wrap;gap:12px">${CONTRACTORS.map((c, i) => `<label style="display:flex;gap:6px;align-items:center;font-size:12.5px">
        <input type="checkbox" data-ucon="${esc(CONTRACTOR_IDS[i])}" ${sel.contractorIds.includes(CONTRACTOR_IDS[i]) || sel.allContractors ? "checked" : ""} ${sel.allContractors ? "disabled" : ""}> ${esc(c)}</label>`).join("")}</div>
      <div class="note">${T("المستخدم المقيَّد لا يرى مشاريع غير مقاوليه — يُفرض ذلك على الخادم في كل طلب.", "A restricted user never sees projects of other contractors — enforced on the server for every request.")}</div>`}
    </div></div>` : ""}

  <div class="card"><header><h3>${T("صلاحيات: ", "Permissions: ")}${esc(sel ? sel.name : "—")}</h3>
      <span class="sp"></span>
      <button class="btn sm gh noprint" id="uReset">${T("إعادة لصلاحيات الدور", "Reset to role defaults")}</button></header>
      <div class="body tight scroll">
      ${sel ? `<table class="permtbl"><thead><tr><th>${T("الوحدة", "Module")}</th>
        ${ACTS.map((a) => `<th>${esc(T(a[1], a[2]))}</th>`).join("")}</tr></thead><tbody>
        ${MODULES.map((m) => { const p = sel.perms[m.id] || {}; return `<tr>
          <td>${esc(T(m.ar, m.en))}${m.id === "users" ? ` <span class="pill warn" style="font-size:10px">${T("حسّاس", "sensitive")}</span>` : ""}</td>
          ${ACTS.map((a) => `<td><label class="sw"><input type="checkbox" data-perm="${esc(sel.id)}|${m.id}|${a[0]}" aria-label="${esc(T(m.ar, m.en))} — ${esc(T(a[1], a[2]))}"
            ${p[a[0]] ? "checked" : ""} ${sel.role === "admin" ? "disabled checked" : ""}><i></i></label></td>`).join("")}
        </tr>`; }).join("")}
      </tbody></table>` : ""}
      </div>
      <div class="body"><div class="note">${sel && sel.role === "admin"
        ? T("مدير النظام يملك كل الصلاحيات دائمًا ولا يمكن تقييده.", "The system administrator always holds every permission and cannot be restricted.")
        : T("التعديل يسري فورًا على الخادم، ويظهر في واجهة المستخدم عند أول تحديث لجلسته.", "Changes apply on the server immediately and show in the user's interface at its next refresh.")}</div></div>
  </div>

  <div class="card"><header><h3>${T("مفاتيح API وWebhooks", "API keys & webhooks")}</h3>
    <span class="sub">${T("للتكامل مع n8n وZapier وأنظمة ERP — توثيق كامل في /api/docs", "for n8n, Zapier and ERP integrations — full docs at /api/docs")}</span>
    <span class="sp"></span>
    <button class="btn sm noprint" id="kAdd">${T("+ مفتاح API", "+ API key")}</button>
    <button class="btn sm noprint" id="hAdd">${T("+ Webhook", "+ Webhook")}</button></header>
    <div class="body tight scroll">
      ${U.newSecret ? `<div class="note warn" role="alert"><b>${T("احفظ هذه القيمة الآن — لن تُعرض مرة أخرى:", "Save this value now — it will not be shown again:")}</b> <code dir="ltr" style="user-select:all">${esc(U.newSecret)}</code></div>` : ""}
      <table class="stbl"><thead><tr><th>${T("المفتاح", "Key")}</th><th>${T("البادئة", "Prefix")}</th><th>${T("الصلاحيات", "Scopes")}</th><th>${T("آخر استخدام", "Last used")}</th><th></th></tr></thead>
      <tbody>${U.keys.filter((k) => k.active).map((k) => `<tr><td>${esc(k.name)}</td><td class="code">${esc(k.prefix)}…</td><td class="code" style="font-size:11px">${esc((k.scopes || []).join(", "))}</td>
        <td class="n">${fmt(k.lastUsedAt)}</td><td><button class="btn sm gh" data-kdel="${esc(k.id)}">${T("إلغاء", "Revoke")}</button></td></tr>`).join("")
        || `<tr><td colspan="5" class="muted" style="padding:10px">${T("لا مفاتيح بعد", "No keys yet")}</td></tr>`}</tbody></table>
      <table class="stbl" style="margin-top:12px"><thead><tr><th>Webhook URL</th><th>${T("الأحداث", "Events")}</th><th>${T("الحالة", "Status")}</th><th></th></tr></thead>
      <tbody>${U.hooks.map((h) => `<tr><td class="code" style="font-size:11px;word-break:break-all">${esc(h.url)}</td><td class="code" style="font-size:11px">${esc((h.events || []).join(", "))}</td>
        <td><span class="pill ${h.active ? "ok" : "warn"}">${h.active ? T("نشط", "Active") : T("موقوف", "Paused")}</span></td>
        <td class="noprint"><div class="rowflex"><button class="btn sm gh" data-htest="${esc(h.id)}">${T("اختبار", "Test")}</button>
          <button class="btn sm gh" data-hdel="${esc(h.id)}">${T("حذف", "Delete")}</button></div></td></tr>`).join("")
        || `<tr><td colspan="4" class="muted" style="padding:10px">${T("لا Webhooks بعد", "No webhooks yet")}</td></tr>`}</tbody></table>
    </div></div>

  <div class="card"><header><h3>${T("سجل الأحداث", "Audit log")}</h3>
    <span class="sub">${T("دخول وخروج، فتح القفل، تغيير الصلاحيات وكلمات المرور، الاستيراد والتصدير والتقارير", "sign-ins, unlocks, permission and password changes, imports, exports and reports")}</span>
    <span class="sp"></span><button class="btn sm gh noprint" id="uClr">${T("تفريغ السجل", "Clear log")}</button></header>
    <div class="body tight scroll" style="max-height:330px;overflow-y:auto"><table class="logtbl"><thead><tr>
      <th>${T("الوقت", "Time")}</th><th>${T("المستخدم", "User")}</th><th>${T("الحدث", "Event")}</th><th>${T("التفصيل", "Detail")}</th></tr></thead>
      <tbody>${U.log.map((l) => `<tr>
        <td class="n">${fmt(l.at, true)}</td>
        <td class="code">${esc(l.username)}</td><td>${esc(logName(l.action))}</td><td class="wrap-t">${esc(l.detail)}</td></tr>`).join("")
        || `<tr><td colspan="4" class="muted">${T("لا أحداث بعد", "No events yet")}</td></tr>`}</tbody></table></div></div>

  <div class="card"><header><h3>${T("الأمان", "Security")}</h3></header>
    <div class="body" style="display:flex;flex-direction:column;gap:11px;font-size:12.8px;line-height:1.95;color:var(--ink-2)">
      <div><b>${T("الحماية على الخادم:", "Server-side protection:")}</b>
        ${T("تسجيل الدخول والصلاحيات وقفل التعديل وعزل المقاولين تُفحص على الخادم في كل طلب (رمز JWT قصير العمر + كوكي تحديث محمي httpOnly). الواجهة تعرض فقط ما يسمح به الخادم.",
          "Sign-in, permissions, the edit lock and contractor isolation are verified on the server for every request (short-lived JWT + httpOnly refresh cookie). The interface only shows what the server allows.")}</div>
      <div><b>${T("كلمات المرور:", "Passwords:")}</b>
        ${T("تُحفظ كتجزئة argon2id، وتغييرها يتم برمز تحقق يُرسل إلى بريد مدير النظام (30 دقيقة، 5 محاولات). سجلات الخادم لا تطبع كلمات مرور ولا رموز تحقق.",
          "Stored as argon2id hashes; changes require a verification code emailed to the administrator (30 minutes, 5 attempts). Server logs never print passwords or codes.")}</div>
      <div><b>${T("الجلسة:", "Session:")}</b> ${T("تنتهي بإغلاق التبويب، وتبدأ كل زيارة جديدة بشاشة الدخول، وتبدأ الجلسة بقفل التعديل مفعّلًا.", "It ends when the tab closes, every new visit starts at the sign-in screen, and each session starts with the edit lock engaged.")}</div>
    </div></div>`;
}

/* ───────── الأحداث ───────── */
const byId = (id: string) => U.users.find((u) => u.id === id);

function setPasswordDialog(x: UserRow): void {
  const w = document.createElement("div"); w.className = "askwrap";
  w.innerHTML = `<div class="askbox"><h4>${T("تعيين كلمة مرور جديدة", "Set a new password")}</h4>
    <p>${T("لـ", "for")} <b>${esc(x.name)}</b> (<span dir="ltr">${esc(x.username)}</span>). ${T("لن تُعرض هذه الكلمة بعد الحفظ، وتنتهي كل جلسات المستخدم.", "It will never be shown again after saving, and all the user's sessions end.")}</p>
    ${pwField("spP", T("كلمة المرور (8 أحرف فأكثر)", "Password (8+ characters)"), false)}
    <div id="spErr" class="gate-err" role="alert" hidden></div>
    <div class="askbtns"><button class="btn sm" id="spNo">${T("إلغاء", "Cancel")}</button><button class="btn sm pri" id="spYes">${T("حفظ", "Save")}</button></div></div>`;
  document.body.appendChild(w);
  let release = () => {}; const close = () => { release(); w.remove(); }; release = trapDialog(w, close);
  const inp = w.querySelector("#spP") as HTMLInputElement; setTimeout(() => inp.focus(), 30);
  (w.querySelector("#spNo") as HTMLElement).onclick = close;
  (w.querySelector("[data-eye]") as HTMLElement).onclick = () => { inp.type = inp.type === "password" ? "text" : "password"; };
  (w.querySelector("#spYes") as HTMLElement).onclick = async () => {
    if (inp.value.length < 8) { const e = w.querySelector("#spErr") as HTMLElement; e.hidden = false; e.textContent = T("8 أحرف على الأقل", "At least 8 characters"); return; }
    const r = await safe(() => post(`/users/${x.id}/password`, { password: inp.value }));
    if (r) { close(); toast(T("تم تعيين كلمة المرور", "Password set")); await reload(); }
  };
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); (w.querySelector("#spYes") as HTMLElement).click(); } };
  w.onclick = (e) => { if (e.target === w) close(); };
}

export function wireUsers(v: HTMLElement): void {
  if (!isAdmin()) return;
  if (!U.loaded) { void safe(loadUsersData).then(() => render()); return; }
  const on = (id: string, fn: () => void) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  v.querySelectorAll<HTMLElement>("[data-upick]").forEach((tr) => tr.onclick = (e) => {
    if ((e.target as HTMLElement).closest("button,select,input")) return;
    U.sel = tr.dataset.upick!; render();
  });
  v.querySelectorAll<HTMLSelectElement>("[data-urole]").forEach((s) => s.onchange = async () => {
    const r = await safe(() => patch(`/users/${s.dataset.urole}`, { role: s.value }));
    if (r) toast(T("تم تغيير الدور وإعادة ضبط صلاحياته", "Role changed and permissions reset")); await reload();
  });
  v.querySelectorAll<HTMLInputElement>("[data-perm]").forEach((c) => c.onchange = async () => {
    const [uid, mod, act] = c.dataset.perm!.split("|"); const x = byId(uid); if (!x) return;
    const perms = JSON.parse(JSON.stringify(x.perms));
    perms[mod] = perms[mod] || { view: 0, edit: 0, del: 0, exp: 0 };
    perms[mod][act] = c.checked ? 1 : 0;
    if (act !== "view" && c.checked) perms[mod].view = 1;
    if (act === "view" && !c.checked) ACTS.forEach((a) => { perms[mod][a[0]] = 0; });
    const r = await safe(() => put(`/users/${uid}/permissions`, { perms }));
    if (r) await reload(); else await reload();
  });
  on("uReset", async () => { const x = byId(U.sel ?? ""); if (!x) return; const r = await safe(() => put(`/users/${x.id}/permissions`, { reset: true })); if (r) await reload(); });
  v.querySelectorAll<HTMLElement>("[data-uren]").forEach((b) => b.onclick = () => {
    const x = byId(b.dataset.uren!); if (!x) return;
    askText(T("اسم المستخدم المعروض", "Display name"), x.name, "", async (n) => { const r = await safe(() => patch(`/users/${x.id}`, { name: n })); if (r) await reload(); });
  });
  v.querySelectorAll<HTMLElement>("[data-utog]").forEach((b) => b.onclick = async () => {
    const x = byId(b.dataset.utog!); if (!x) return;
    const r = await safe(() => patch(`/users/${x.id}`, { active: !x.active })); if (r) await reload();
  });
  v.querySelectorAll<HTMLElement>("[data-udel]").forEach((b) => b.onclick = () => {
    const x = byId(b.dataset.udel!); if (!x) return;
    askOk(T("حذف المستخدم", "Delete user"), T(`سيُحذف حساب <b>${esc(x.name)}</b> (<span dir="ltr">${esc(x.username)}</span>) نهائيًا.`, `Account <b>${esc(x.name)}</b> (<span dir="ltr">${esc(x.username)}</span>) will be deleted permanently.`),
      async () => { const r = await safe(() => del(`/users/${x.id}`)); if (r) await reload(); }, T("حذف", "Delete"));
  });
  v.querySelectorAll<HTMLElement>("[data-upwd]").forEach((b) => b.onclick = () => { const x = byId(b.dataset.upwd!); if (x) setPasswordDialog(x); });
  on("uAdd", () => {
    askText(T("اسم المستخدم (إنجليزي بلا مسافات)", "Username (latin, no spaces)"), "", "username", (u) => {
      const un = u.trim().toLowerCase().replace(/\s+/g, "");
      if (!/^[a-z0-9._-]{3,20}$/.test(un)) { toast(T("اسم غير صالح — حروف إنجليزية وأرقام من 3 إلى 20", "Invalid — 3–20 latin characters or digits")); return; }
      if (U.users.some((x) => x.username === un)) { toast(T("هذا المستخدم موجود", "That username already exists")); return; }
      askText(T("الاسم المعروض", "Display name"), "", "", (nm) => {
        askText(T("كلمة المرور الأولية (8 أحرف فأكثر)", "Initial password (8+ characters)"), "", "", async (pw) => {
          if (pw.length < 8) { toast(T("8 أحرف على الأقل", "At least 8 characters")); return; }
          const r = await safe(() => post("/users", { username: un, name: nm, password: pw, role: "pm" }));
          if (r) { U.sel = r.id; toast(T("أُضيف المستخدم بدور «مدير مشاريع» — عدّل صلاحياته من الجدول", "User added as projects manager — adjust the permission grid")); await reload(); }
        });
      });
    });
  });
  on("uClr", () => askOk(T("تفريغ السجل", "Clear the log"), T("سيُحذف سجل الأحداث بالكامل ولا يمكن استرجاعه.", "The entire audit log will be deleted and cannot be recovered."),
    async () => { const r = await safe(() => del("/audit-log")); if (r) await reload(); }, T("تفريغ", "Clear")));
  on("uExp", () => {
    const data = JSON.stringify({ app: "iltizam", v: 1, at: new Date().toISOString(), project_manager: PM_NAME, note: "لا يحتوي هذا الملف أي كلمة مرور", users: U.users.map((x) => ({ username: x.username, name: x.name, role: x.role, active: x.active, perms: x.perms })), log: U.log }, null, 1);
    saveBlob(new Blob([data], { type: "application/json" }), `iltizam-users-${new Date().toISOString().slice(0, 10)}.json`);
    toast(T("تم تصدير دفتر المستخدمين", "User register exported"));
  });
  v.querySelectorAll<HTMLElement>("[data-pwok]").forEach((b) => b.onclick = async () => { const r = await safe(() => post(`/auth/password/requests/${b.dataset.pwok}/approve`)); if (r) await reload(); });
  v.querySelectorAll<HTMLElement>("[data-pwno]").forEach((b) => b.onclick = async () => { const r = await safe(() => post(`/auth/password/requests/${b.dataset.pwno}/reject`)); if (r) { toast(T("تم رفض الطلب", "Request rejected")); await reload(); } });

  /* عزل المقاولين لكل مستخدم */
  const allC = document.getElementById("uAllC") as HTMLInputElement | null;
  if (allC) allC.onchange = async () => { const r = await safe(() => patch(`/users/${U.sel}`, { allContractors: allC.checked })); if (r) await reload(); };
  v.querySelectorAll<HTMLInputElement>("[data-ucon]").forEach((c) => c.onchange = async () => {
    const x = byId(U.sel ?? ""); if (!x) return;
    const set = new Set(x.contractorIds); c.checked ? set.add(c.dataset.ucon!) : set.delete(c.dataset.ucon!);
    const r = await safe(() => patch(`/users/${x.id}`, { contractorIds: [...set] })); if (r) await reload();
  });

  /* مفاتيح API وWebhooks */
  on("kAdd", () => {
    askText(T("اسم المفتاح (مثل: n8n)", "Key name (e.g. n8n)"), "", "n8n", async (name) => {
      const scopes = ["read:projects", "write:imports", "send:reports"];
      const r = await safe(() => post("/api-keys", { name, scopes }));
      if (r) { U.newSecret = r.key; await reload(); }
    });
  });
  v.querySelectorAll<HTMLElement>("[data-kdel]").forEach((b) => b.onclick = async () => { const r = await safe(() => del(`/api-keys/${b.dataset.kdel}`)); if (r) { U.newSecret = null; await reload(); } });
  on("hAdd", () => {
    askText(T("رابط الـ Webhook (https://…)", "Webhook URL (https://…)"), "", "https://", async (url) => {
      const r = await safe(() => post("/webhooks", { url, events: U.hookEvents }));
      if (r) { U.newSecret = r.secret; await reload(); }
    });
  });
  v.querySelectorAll<HTMLElement>("[data-hdel]").forEach((b) => b.onclick = async () => { const r = await safe(() => del(`/webhooks/${b.dataset.hdel}`)); if (r) { U.newSecret = null; await reload(); } });
  v.querySelectorAll<HTMLElement>("[data-htest]").forEach((b) => b.onclick = async () => {
    const r = await safe(() => post(`/webhooks/${b.dataset.htest}/test`));
    if (r) toast(r.status === "delivered" ? T("وصل الحدث التجريبي", "Test event delivered") : T("فشل التسليم: ", "Delivery failed: ") + (r.error ?? r.responseCode ?? ""));
  });
  void S; void api;
}
