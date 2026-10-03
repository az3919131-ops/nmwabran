/** الدخول وقفل التعديل وتغيير كلمة المرور — كلها عبر الخادم (JWT قصير + كوكي refresh httpOnly) */
import { AR, AUTH, S, T, $, esc, initials2, PM_NAME, ROLES, ORG_AR, ORG_EN, toast, ALL_PAGES, can, isAdmin, nf } from "./runtime";
import { ApiError, api, post, refreshSession, setAccessToken } from "./api";
import { applyBootstrap, flushAll, loadUi, saveUi } from "./sync";
import { pmHTML, pwField, trapDialog } from "./ui";
import { render } from "./render";
import ORG_LOGO from "./assets/org-logo.webp";

const SESS_KEY = "iltizam-tab-session";
const GATE = { err: "", busy: false, show: false };

/** الجلسة مرتبطة بالتبويب: إغلاق التبويب ينهيها، وأي زيارة جديدة تبدأ بكلمة المرور */
const markTab = (on: boolean) => { try { on ? sessionStorage.setItem(SESS_KEY, "1") : sessionStorage.removeItem(SESS_KEY); } catch { /* ignore */ } };
const hasTab = () => { try { return sessionStorage.getItem(SESS_KEY) === "1"; } catch { return false; } };

async function loadBootstrap(): Promise<void> {
  const b = await api("GET", "/bootstrap");
  applyBootstrap(b);
  const ui = loadUi();
  const first = ALL_PAGES.find((p) => can(p.id, "view"));
  if (ui.lang) S.lang = ui.lang;
  if (typeof ui.woGuard === "boolean") S.woGuard = ui.woGuard;
  if (typeof ui.updOpen === "boolean") S.updOpen = ui.updOpen;
  const wanted = ui.page && can(ui.page, "view") ? ui.page : (first?.id ?? "dash");
  S.page = wanted;
  const ai = S.projects.findIndex((p: any) => p.id === ui.activeId);
  S.active = ai >= 0 ? ai : 0;
}

/** عند فتح الصفحة: إن كان التبويب نفسه (تحديث) نستعيد الجلسة، وإلا نظهر شاشة الدخول */
export async function bootAuth(): Promise<boolean> {
  if (hasTab()) {
    const j = await refreshSession().catch(() => null);
    if (j) { AUTH.me = j.user; await loadBootstrap(); gateRender(); return true; }
    markTab(false);
  } else {
    // زيارة جديدة: أنهِ أي جلسة قديمة على الخادم (كوكي من تبويب سابق)
    void fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
  }
  gateRender();
  return false;
}

const GATE_POINTS = () => [
  [T("حصر الكميات والمقايسة", "Takeoff & BOQ"), T("الكروكي والمواد والأجور والفواتير", "layouts, materials, works and invoices")],
  [T("ضبط الحماية والإحداثيات", "Settings & coordinates"), T("كل معدة على خريطة واحدة", "every unit on one map")],
  [T("النماذج والاستلام", "Forms & acceptance"), T("مستندات جاهزة للاستشاري", "consultant-ready documents")],
];

function gateHTML(): string {
  return `
  <div class="gate-brand">
    <div class="gate-logo"><img src="${ORG_LOGO}" alt=""><span><b>${esc(T(ORG_AR, ORG_EN))}</b>${esc(T("مشاريع التحويل — نجران", "Conversion projects — Najran"))}</span></div>
    <div class="gate-h">
      <h1>${T("محفظة الالتزام", "Compliance Vault")}</h1>
      <p>${T("بوابة الدخول إلى محفظة مشاريع المقاول. كل مستخدم يرى ما تسمح به صلاحيته فقط، وكل استيراد وتعديل وتصدير يُسجَّل باسمه.",
        "The gateway to the contractor project portfolio. Each user sees only what their permissions allow, and every import, edit and export is recorded under their name.")}</p>
    </div>
    <div class="gate-facts">${GATE_POINTS().map(([a, b]) => `<div><b class="pt">${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div>
  </div>
  <div class="gate-form"><div class="gate-card">
    <h2>${T("تسجيل الدخول", "Sign in")}</h2>
    <p class="sub">${T("أدخل اسم المستخدم وكلمة المرور الخاصين بك. لا تُعرض كلمات المرور في أي مكان داخل المنصة.",
      "Enter your username and password. Passwords are never shown anywhere in the platform.")}</p>
    <div id="gErr" class="gate-err" role="alert" aria-live="assertive" ${GATE.err ? "" : "hidden"}>${esc(GATE.err)}</div>
    <label class="fld"><span>${T("اسم المستخدم", "Username")}</span>
      <input type="text" id="gU" autocomplete="username" dir="ltr" placeholder="username" autocapitalize="off" spellcheck="false"></label>
    <label class="fld"><span>${T("كلمة المرور", "Password")}</span>
      <span class="pwrow"><input type="${GATE.show ? "text" : "password"}" id="gP" autocomplete="current-password" dir="ltr">
        <button type="button" class="pweye" id="gEye" aria-label="${T("إظهار كلمة المرور", "Show password")}">${GATE.show ? "🙈" : "👁"}</button></span></label>
    <button class="btn pri big" id="gGo" ${GATE.busy ? "disabled" : ""}>${GATE.busy ? T("جارٍ التحقق…", "Checking…") : T("دخول", "Sign in")}</button>
    <div class="gate-note">
      ${T("نسيت كلمة المرور؟ تواصل مع مدير النظام", "Forgot your password? Contact the system administrator")}
      <b> ${esc(T("م. أحمد زهران", "Eng. Ahmed Zahran"))}</b>.<br>
      ${T("تغيير كلمة المرور يتم من داخل المنصة بعد الدخول، برمز تحقق يُرسل إلى بريد مدير النظام.",
        "Password changes happen inside the platform after signing in, with a verification code sent to the administrator's inbox.")}
    </div>
    <div class="gate-note" style="border:0;padding-top:0">${pmHTML()}</div>
  </div></div>`;
}

export function gateRender(): void {
  let g = $("gate");
  if (!g) { g = document.createElement("div"); g.className = "gate"; g.id = "gate"; g.setAttribute("role", "dialog"); g.setAttribute("aria-modal", "true"); g.setAttribute("aria-label", "Sign in"); document.body.appendChild(g); }
  if (AUTH.me && AUTH.me.active) { g.hidden = true; g.innerHTML = ""; document.body.classList.add("authed"); document.body.style.overflow = ""; return; }
  document.body.classList.remove("authed");
  g.hidden = false; g.innerHTML = gateHTML(); document.body.style.overflow = "hidden";
  applyDirLang();
  const go = async () => {
    if (GATE.busy) return;
    const u = ($("gU") as HTMLInputElement).value.trim().toLowerCase(), p = ($("gP") as HTMLInputElement).value;
    if (!u || !p) { GATE.err = T("أدخل اسم المستخدم وكلمة المرور", "Enter your username and password"); gateRender(); return; }
    GATE.busy = true; GATE.err = ""; gateRender();
    try {
      const r = await post("/auth/login", { username: u, password: p });
      setAccessToken(r.accessToken);
      AUTH.me = r.user; markTab(true);
      await loadBootstrap();
      GATE.err = ""; GATE.busy = false;
      gateRender(); render();
      toast(T("مرحبًا ", "Welcome ") + r.user.name);
    } catch (e) {
      GATE.busy = false;
      AUTH.me = null; setAccessToken(null); markTab(false);
      GATE.err = e instanceof ApiError ? e.message : T("تعذّر الاتصال بالخادم", "Could not reach the server");
      gateRender();
    }
  };
  ($("gGo") as HTMLElement).onclick = go;
  ($("gEye") as HTMLElement).onclick = () => { GATE.show = !GATE.show; const v = ($("gP") as HTMLInputElement).value, u = ($("gU") as HTMLInputElement).value; gateRender(); ($("gP") as HTMLInputElement).value = v; ($("gU") as HTMLInputElement).value = u; ($("gP") as HTMLElement).focus(); };
  ["gU", "gP"].forEach((id) => { ($(id) as HTMLElement).onkeydown = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); void go(); } }; });
  setTimeout(() => { const el = $("gU") as HTMLInputElement | null; if (el && !el.value) el.focus(); }, 50);
}
function applyDirLang(): void {
  document.body.setAttribute("dir", AR() ? "rtl" : "ltr"); document.body.setAttribute("lang", AR() ? "ar" : "en");
}

export async function logout(): Promise<void> {
  await flushAll().catch(() => {});
  try { await post("/auth/logout"); } catch { /* ignore */ }
  setAccessToken(null); markTab(false);
  AUTH.me = null; AUTH.unlocked = false; AUTH.perms = {}; S.projects = [];
  GATE.err = ""; gateRender(); toast(T("تم تسجيل الخروج", "Signed out"));
}

/* ───────── قفل التعديل — بكلمة مرور مدير النظام (يتحقق منها الخادم) ───────── */
export async function lockToggle(): Promise<void> {
  if (AUTH.unlocked) {
    try { await post("/auth/lock"); } catch { /* ignore */ }
    AUTH.unlocked = false; render(); toast(T("تم تفعيل قفل التعديل", "Edit lock engaged")); return;
  }
  const w = document.createElement("div"); w.className = "askwrap";
  w.innerHTML = `<div class="askbox"><h4>${T("فتح قفل التعديل", "Unlock editing")}</h4>
    <p>${T("أدخل كلمة مرور مدير النظام لفتح التعديل والاستيراد في هذه الجلسة.", "Enter the system administrator password to unlock editing and importing for this session.")}</p>
    <span class="pwrow"><input type="password" id="lkP" dir="ltr" autocomplete="off" aria-label="${T("كلمة مرور مدير النظام", "Administrator password")}">
      <button type="button" class="pweye" id="lkEye" aria-label="${T("إظهار", "Show")}">👁</button></span>
    <div id="lkErr" class="gate-err" role="alert" hidden></div>
    <div class="askbtns"><button class="btn sm" id="lkNo">${T("إلغاء", "Cancel")}</button>
      <button class="btn sm pri" id="lkYes">${T("فتح القفل", "Unlock")}</button></div></div>`;
  document.body.appendChild(w);
  let release = () => {};
  const close = () => { release(); w.remove(); };
  release = trapDialog(w, close);
  const inp = w.querySelector("#lkP") as HTMLInputElement;
  setTimeout(() => inp.focus(), 30);
  (w.querySelector("#lkNo") as HTMLElement).onclick = close;
  (w.querySelector("#lkEye") as HTMLElement).onclick = () => { inp.type = inp.type === "password" ? "text" : "password"; };
  const go = async () => {
    try {
      await post("/auth/unlock", { password: inp.value });
      close(); AUTH.unlocked = true; render(); toast(T("تم فتح قفل التعديل", "Editing unlocked"));
    } catch (e) {
      const el = w.querySelector("#lkErr") as HTMLElement; el.hidden = false;
      el.textContent = e instanceof ApiError && e.code === "bad_admin_password" ? T("كلمة مرور مدير النظام غير صحيحة", "Incorrect administrator password") : (e instanceof ApiError ? e.message : T("تعذّر الاتصال بالخادم", "Could not reach the server"));
      inp.select();
    }
  };
  (w.querySelector("#lkYes") as HTMLElement).onclick = go;
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); void go(); } };
  w.onclick = (e) => { if (e.target === w) close(); };
}

/* ───────── تغيير كلمة المرور — رمز تحقق إلى بريد مدير النظام ───────── */
const PWF = { step: 1, busy: false, err: "", ok: "", req: null as null | { id: string; left: number }, show: false };
let pwRelease: () => void = () => {};
export function pwOpen(): void {
  PWF.step = 1; PWF.err = ""; PWF.ok = ""; PWF.req = null; PWF.busy = false;
  const w = document.createElement("div"); w.className = "askwrap"; w.id = "pwWrap";
  document.body.appendChild(w); pwRelease = trapDialog(w, pwClose); pwDraw();
}
function pwClose(): void { const w = $("pwWrap"); if (w) { pwRelease(); w.remove(); } }
function pwDraw(): void {
  const w = $("pwWrap"); if (!w || !AUTH.me) return;
  w.innerHTML = PWF.step === 1 ? `<div class="askbox">
      <h4>${T("تغيير كلمة المرور", "Change password")}</h4>
      <p>${T("بعد إدخال كلمة المرور الجديدة يُرسل رمز من 6 أرقام إلى بريد مدير النظام للتأكيد.", "After you enter the new password, a 6-digit code is emailed to the administrator for confirmation.")}</p>
      <div class="gate-err" role="alert" ${PWF.err ? "" : "hidden"}>${esc(PWF.err)}</div>
      ${pwField("pw0", T("كلمة المرور الحالية", "Current password"), PWF.show)}
      ${pwField("pw1", T("كلمة المرور الجديدة (8 أحرف فأكثر)", "New password (8+ characters)"), PWF.show)}
      ${pwField("pw2", T("تأكيد كلمة المرور الجديدة", "Confirm new password"), PWF.show)}
      <div class="askbtns"><button class="btn sm" id="pwNo">${T("إلغاء", "Cancel")}</button>
        <button class="btn sm pri" id="pwGo" ${PWF.busy ? "disabled" : ""}>${PWF.busy ? T("جارٍ الإرسال…", "Sending…") : T("إرسال رمز التحقق", "Send code")}</button></div>
    </div>` : `<div class="askbox">
      <h4>${T("أدخل رمز التحقق", "Enter the verification code")}</h4>
      ${PWF.ok ? `<p style="color:var(--ok)">${esc(PWF.ok)}</p>` : ""}
      <p>${T("الرمز صالح 30 دقيقة، ولديك 5 محاولات.", "The code is valid for 30 minutes; you have 5 attempts.")}
        ${PWF.req ? `<br><span class="muted" style="font-size:11.5px">${T("رقم الطلب", "Request")}: <span dir="ltr">${esc(PWF.req.id)}</span> · ${T("المحاولات المتبقية", "Attempts left")}: ${PWF.req.left}</span>` : ""}</p>
      <div class="gate-err" role="alert" ${PWF.err ? "" : "hidden"}>${esc(PWF.err)}</div>
      <input type="text" id="pwC" dir="ltr" inputmode="numeric" maxlength="6" placeholder="------" aria-label="${T("رمز التحقق", "Verification code")}"
        style="text-align:center;letter-spacing:.5em;font-family:var(--f-mono);font-size:19px">
      <div class="askbtns"><button class="btn sm" id="pwNo">${T("إغلاق", "Close")}</button>
        <button class="btn sm pri" id="pwVer" ${PWF.busy ? "disabled" : ""}>${T("تأكيد التغيير", "Confirm change")}</button></div>
    </div>`;
  (w as HTMLElement).querySelectorAll<HTMLElement>("[data-eye]").forEach((b) => b.onclick = () => {
    const vals: Record<string, string> = {}; w.querySelectorAll("input").forEach((i) => vals[i.id] = i.value);
    PWF.show = !PWF.show; pwDraw();
    Object.keys(vals).forEach((k) => { const el = $(k) as HTMLInputElement | null; if (el) el.value = vals[k]; });
  });
  const no = $("pwNo"); if (no) no.onclick = pwClose;
  const go = $("pwGo");
  if (go) go.onclick = async () => {
    if (PWF.busy) return;
    const cur = ($("pw0") as HTMLInputElement).value, n1 = ($("pw1") as HTMLInputElement).value, n2 = ($("pw2") as HTMLInputElement).value;
    if (n1.length < 8) { PWF.err = T("كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف", "The new password must be at least 8 characters"); pwDraw(); return; }
    if (n1 !== n2) { PWF.err = T("كلمتا المرور الجديدتان غير متطابقتين", "The two new passwords do not match"); pwDraw(); return; }
    PWF.busy = true; PWF.err = ""; pwDraw();
    try {
      const r = await post("/auth/password/request", { current: cur, next: n1 });
      PWF.busy = false;
      PWF.ok = r.mailed ? T("أُرسل الرمز إلى بريد مدير النظام.", "The code was emailed to the administrator.")
        : T("تعذّر إرسال البريد — الطلب الآن «قيد الانتظار» ويعتمده مدير النظام من صفحة المستخدمين.", "Email could not be sent — the request is now pending and the administrator approves it from the users page.");
      PWF.req = { id: r.requestId, left: 5 }; PWF.step = 2; pwDraw();
    } catch (e) {
      PWF.busy = false; PWF.err = e instanceof ApiError ? e.message : T("تعذّر الاتصال بالخادم", "Could not reach the server"); pwDraw();
    }
  };
  const ver = $("pwVer");
  if (ver) ver.onclick = async () => {
    if (!PWF.req || PWF.busy) return;
    PWF.busy = true; pwDraw();
    try {
      await post("/auth/password/confirm", { requestId: PWF.req.id, code: ($("pwC") as HTMLInputElement | null)?.value.trim() ?? "" });
      pwClose(); toast(T("تم تغيير كلمة المرور", "Password changed"));
    } catch (e) {
      PWF.busy = false;
      if (e instanceof ApiError) { PWF.err = e.message; if (typeof e.extra.attemptsLeft === "number") PWF.req.left = e.extra.attemptsLeft as number; }
      else PWF.err = T("تعذّر الاتصال بالخادم", "Could not reach the server");
      pwDraw();
    }
  };
  const c = $("pwC") as HTMLInputElement | null;
  if (c) { setTimeout(() => c.focus(), 40); c.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); (ver as HTMLElement).click(); } }; }
  w.onclick = (e) => { if (e.target === w) pwClose(); };
}

/* ───────── شريط المستخدم في أعلى الصفحة ───────── */
export function renderUserBar(): void {
  const me = AUTH.me; if (!me) return;
  const bar = document.querySelector(".topbar .rowflex");
  if (!bar) return;
  let who = $("uWho");
  if (!who) { who = document.createElement("div"); who.id = "uWho"; who.className = "rowflex noprint"; bar.insertBefore(who, bar.firstChild); }
  who.innerHTML = `
    <button class="lockpill ${AUTH.unlocked ? "off" : "on"}" id="btnLock" title="${T("قفل التعديل والاستيراد", "Edit & import lock")}" aria-pressed="${!AUTH.unlocked}">
      ${AUTH.unlocked ? "🔓" : "🔒"} ${AUTH.unlocked ? T("مفتوح", "Unlocked") : T("مقفل", "Locked")}</button>
    <button class="btn sm gh" id="btnPwd">${T("كلمة المرور", "Password")}</button>
    <span class="who"><span class="av">${esc(initials2(me.name))}</span>
      <span><span class="nm">${esc(me.name)}</span><span class="rl">${esc(T(ROLES[me.role].ar, ROLES[me.role].en))}</span></span></span>
    <button class="btn sm" id="btnOut">${T("خروج", "Sign out")}</button>`;
  const on = (id: string, fn: () => void) => { const el = $(id); if (el) el.onclick = fn; };
  on("btnLock", () => { void lockToggle(); }); on("btnPwd", pwOpen); on("btnOut", () => { void logout(); });
}
export { isAdmin, nf, PM_NAME, api, saveUi };
