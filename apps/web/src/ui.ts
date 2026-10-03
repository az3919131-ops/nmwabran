/** نوافذ صغيرة وأدوات واجهة مشتركة (إدخال نص، تأكيد، انشغال، توقيع مدير المشاريع) */
import { AR, PM_NAME, PM_NAME_AR, PM_ROLE_AR, PM_ROLE_EN, S, T, esc } from "./runtime";

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

/** يربط نافذة منبثقة بإمكانية الوصول: دور dialog، حبس التركيز، Esc، إعادة التركيز */
export function trapDialog(w: HTMLElement, close: () => void): () => void {
  const prev = document.activeElement as HTMLElement | null;
  w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true");
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if (e.key !== "Tab") return;
    const f = [...w.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => !x.hidden && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  w.addEventListener("keydown", key);
  return () => { w.removeEventListener("keydown", key); try { prev?.focus(); } catch { /* ignore */ } };
}

export function askText(title: string, val: string, ph: string, cb: (v: string) => void): void {
  const w = document.createElement("div"); w.className = "askwrap";
  w.innerHTML = `<div class="askbox"><h4>${esc(title)}</h4>
    <input type="text" id="askIn" value="${esc(val || "")}" placeholder="${esc(ph || "")}" autocomplete="off" aria-label="${esc(title)}">
    <div class="askbtns"><button class="btn sm" id="askNo">${T("إلغاء", "Cancel")}</button>
      <button class="btn sm pri" id="askYes">${T("حفظ", "Save")}</button></div></div>`;
  document.body.appendChild(w);
  const inp = w.querySelector("#askIn") as HTMLInputElement;
  let release = () => {};
  const close = () => { release(); w.remove(); };
  release = trapDialog(w, close);
  setTimeout(() => { inp.focus(); inp.select(); }, 30);
  (w.querySelector("#askNo") as HTMLElement).onclick = close;
  (w.querySelector("#askYes") as HTMLElement).onclick = () => { const v = inp.value.trim(); if (!v) { inp.focus(); return; } close(); cb(v); };
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); (w.querySelector("#askYes") as HTMLElement).click(); } };
  w.onclick = (e) => { if (e.target === w) close(); };
}

export function askOk(title: string, msg: string, cb: () => void, okLabel?: string): void {
  const w = document.createElement("div"); w.className = "askwrap";
  w.innerHTML = `<div class="askbox"><h4>${esc(title)}</h4><p>${msg}</p>
    <div class="askbtns"><button class="btn sm" id="askNo">${T("إلغاء", "Cancel")}</button>
      <button class="btn sm pri" id="askYes">${esc(okLabel || T("تأكيد", "Confirm"))}</button></div></div>`;
  document.body.appendChild(w);
  let release = () => {};
  const close = () => { release(); w.remove(); };
  release = trapDialog(w, close);
  (w.querySelector("#askYes") as HTMLElement).focus();
  (w.querySelector("#askNo") as HTMLElement).onclick = close;
  (w.querySelector("#askYes") as HTMLElement).onclick = () => { close(); cb(); };
  w.onclick = (e) => { if (e.target === w) close(); };
}

/** حقل كلمة مرور بعين إظهار */
export function pwField(id: string, label: string, show: boolean): string {
  return `<label class="fld"><span>${esc(label)}</span><span class="pwrow">
    <input type="${show ? "text" : "password"}" id="${id}" dir="ltr" autocomplete="off">
    <button type="button" class="pweye" data-eye="${id}" aria-label="${T("إظهار/إخفاء", "Show/hide")}">${show ? "🙈" : "👁"}</button></span></label>`;
}

/* ───────── انشغال (معالجة طويلة): زر الاستنباط يدور كما في المنصة القديمة ───────── */
export function setBusy(on: boolean, label?: string): void {
  S.busy = on;
  const b = document.getElementById("btnDeriveAll") as HTMLButtonElement | null;
  if (b) {
    b.disabled = on;
    b.innerHTML = on ? `<span class="spin"></span> ${esc(label || T("جارٍ المعالجة…", "Working…"))}`
      : T("استنباط ومعالجة ذكية للبيانات", "Derive & AI-process data");
  }
  let st = document.getElementById("busyStatus");
  if (!st) { st = document.createElement("div"); st.id = "busyStatus"; st.className = "sr-only"; st.setAttribute("role", "status"); st.setAttribute("aria-live", "polite"); document.body.appendChild(st); }
  st.textContent = on ? (label || T("جارٍ المعالجة…", "Working…")) : "";
}

/** رسالة تنبيه عاجلة لقارئات الشاشة (aria-live) */
export function announce(msg: string): void {
  let r = document.getElementById("liveAlert");
  if (!r) { r = document.createElement("div"); r.id = "liveAlert"; r.className = "sr-only"; r.setAttribute("role", "alert"); r.setAttribute("aria-live", "assertive"); document.body.appendChild(r); }
  r.textContent = ""; setTimeout(() => { r!.textContent = msg; }, 30);
}

/** توقيع مدير المشاريع — يظهر أسفل كل صفحة ومستند وشريحة */
export function pmHTML(extra?: string): string {
  return `<div class="pmsign">
    <span class="rl">${esc(T(PM_ROLE_AR, PM_ROLE_EN))}</span><span class="dv">·</span>
    <span class="nm">${esc(PM_NAME)}</span>
    ${AR() ? `<span class="dv">·</span><span>${esc(PM_NAME_AR)}</span>` : ""}
    ${extra ? `<span class="dv">·</span><span>${esc(extra)}</span>` : ""}
  </div>`;
}
