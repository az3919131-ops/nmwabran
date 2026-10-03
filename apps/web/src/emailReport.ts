/**
 * زر «✉ إرسال التقرير»: نافذة تأكيد تعرض المستلمين النشطين (مدير النظام 🔒 دائمًا)، خيارات PDF/Excel، ملاحظة اختيارية،
 * ثم تتابع حالة كل مستلم بعد الإرسال. لا مفاتيح ولا كلمات مرور بريد هنا — الإرسال كله من الخادم.
 */
import { ADMIN_ONLY_REPORTS, reportTitle, type ReportKey } from "@iltizam/core";
import { $, AR, P, S, T, can, esc, toast } from "./runtime";
import { ApiError, get, post } from "./api";
import { trapDialog } from "./ui";
import { render } from "./render";
import { save, flushAll } from "./sync";
import { E } from "./views/emails";

interface Rcp { email: string; name: string; isSystem: boolean }
interface PerRecipient { email: string; status: "queued" | "sent" | "failed"; error?: string }
interface Job { id: string; status: string; perRecipient: PerRecipient[]; subject: string; attachments: { name: string; mode: string; bytes: number }[]; error: string | null }

const DONE = new Set(["sent", "failed", "partial"]);
const STATUS_AR: Record<string, string> = { queued: "في الطابور", sent: "تم الإرسال", failed: "فشل", partial: "جزئي", sending: "جارٍ الإرسال" };
const STATUS_EN: Record<string, string> = { queued: "Queued", sent: "Sent", failed: "Failed", partial: "Partial", sending: "Sending" };

const fmtKb = (n: number) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

export async function openEmailReport(): Promise<void> {
  const key = S.page as ReportKey;
  if (!can(key, "exp")) return;
  const p = P();
  const adminOnly = ADMIN_ONLY_REPORTS.includes(key);
  const needsProject = !adminOnly;
  if (needsProject && !p) { toast(T("اختر مشروعًا أولًا", "Select a project first")); return; }
  await flushAll().catch(() => {});                        // التقرير يعكس آخر تعديلاتك

  const w = document.createElement("div"); w.className = "askwrap"; w.id = "erWrap";
  const title = reportTitle(key, S.lang);
  const projLine = needsProject ? `${esc(p.name)} — W/O ${esc(p.wo || "—")}` : "";
  w.innerHTML = `<div class="askbox erbox" aria-labelledby="erT">
    <h4 id="erT">✉ ${T("إرسال التقرير", "Email report")}: ${esc(title)}</h4>
    ${projLine ? `<p class="muted" style="margin:0">${projLine}</p>` : ""}
    <div id="erBody"><p class="muted" role="status">${T("جارٍ تحميل المستلمين…", "Loading recipients…")}</p></div>
  </div>`;
  document.body.appendChild(w);
  let release = () => {}; let stop = false;
  const close = () => { stop = true; release(); w.remove(); };
  release = trapDialog(w, close);
  w.onclick = (e) => { if (e.target === w) close(); };

  let rcps: Rcp[] = []; let listErr = "";
  try { rcps = (await get(`/reports/${key}/recipients`)).recipients; }
  catch (e) { listErr = e instanceof ApiError ? e.message : T("تعذّر تحميل المستلمين", "Could not load recipients"); }

  const body = $("erBody") as HTMLElement;
  const rcpHtml = rcps.map((r) => `<li class="er-r${r.isSystem ? " sys" : ""}"><span class="em" dir="ltr">${esc(r.email)}</span>${r.name ? ` <span class="nm">${esc(r.name)}</span>` : ""}
      ${r.isSystem ? `<span class="pill ok" title="${T("مدير النظام — مستلم إلزامي", "System administrator — mandatory recipient")}">🔒 ${T("إلزامي", "mandatory")}</span>` : ""}</li>`).join("");
  body.innerHTML = `
    <div class="er-sec"><b>${T("المستلمون", "Recipients")} (${rcps.length})</b>
      ${listErr ? `<div class="note warn" role="alert">${esc(listErr)}</div>` : ""}
      <ul class="er-list" id="erList">${rcpHtml || `<li class="muted">${T("—", "—")}</li>`}</ul>
      <div class="muted" style="font-size:11.5px">${T("يصل التقرير لكل مستلم نشط ضمن نطاق هذا التقرير، ولمدير النظام دائمًا.", "Every active recipient in this report's scope gets it — and the system administrator always does.")}</div></div>
    <div class="er-sec er-opts">
      <label class="chk"><input type="checkbox" id="erPdf" checked> PDF</label>
      <label class="chk"><input type="checkbox" id="erXls" checked> Excel (XLSX)</label></div>
    <label class="fld"><span>${T("ملاحظة اختيارية تظهر في نص الرسالة", "Optional note shown in the email body")}</span>
      <textarea id="erNote" rows="3" maxlength="2000"></textarea></label>
    <div id="erStat" class="er-stat" role="status" aria-live="polite"></div>
    <div class="askbtns">
      ${can("emails", "view") ? `<button class="btn sm gh" id="erManage">${T("إدارة المستلمين", "Manage recipients")}</button>` : ""}
      <span style="flex:1"></span>
      <button class="btn sm" id="erNo">${T("إغلاق", "Close")}</button>
      <button class="btn sm pri" id="erGo">${T("إرسال الآن", "Send now")}</button></div>`;
  ($("erNo") as HTMLElement).onclick = close;
  const mg = $("erManage"); if (mg) mg.onclick = () => { close(); S.page = "emails"; E.loaded = false; save(); render(); };
  ($("erGo") as HTMLElement).focus();

  const go = $("erGo") as HTMLButtonElement;
  go.onclick = async () => {
    const pdf = ($("erPdf") as HTMLInputElement).checked, xls = ($("erXls") as HTMLInputElement).checked;
    if (!pdf && !xls) { ($("erStat") as HTMLElement).innerHTML = `<div class="gate-err" role="alert">${T("اختر PDF أو Excel على الأقل", "Pick PDF or Excel at least")}</div>`; return; }
    go.disabled = true; go.textContent = T("جارٍ الإرسال…", "Sending…");
    const stat = $("erStat") as HTMLElement;
    try {
      const { jobId } = await post(`/reports/${key}/send`, { workOrderId: needsProject ? p.id : null, lang: S.lang, attachPdf: pdf, attachXlsx: xls, note: ($("erNote") as HTMLTextAreaElement).value.trim() || undefined });
      stat.innerHTML = `<p class="muted">${T("أُضيف الإرسال إلى الطابور…", "Queued — sending…")}</p>`;
      let job: Job | null = null;
      for (let i = 0; i < 90 && !stop; i++) {
        await new Promise((r) => setTimeout(r, i < 5 ? 700 : 1500));
        if (stop) return;
        job = await get(`/reports/jobs/${jobId}`);
        stat.innerHTML = jobHtml(job!);
        if (DONE.has(job!.status)) break;
      }
      go.textContent = T("إرسال مرة أخرى", "Send again"); go.disabled = false;
      if (job && DONE.has(job.status)) toast(job.status === "sent" ? T("تم إرسال التقرير", "Report sent") : job.status === "partial" ? T("أُرسل لبعض المستلمين فقط", "Sent to some recipients only") : T("فشل الإرسال", "Sending failed"));
    } catch (e) {
      go.disabled = false; go.textContent = T("إرسال الآن", "Send now");
      stat.innerHTML = `<div class="gate-err" role="alert">${esc(e instanceof ApiError ? e.message : T("تعذّر الاتصال بالخادم", "Could not reach the server"))}</div>`;
    }
  };
}

function jobHtml(j: Job): string {
  const st = (AR() ? STATUS_AR : STATUS_EN)[j.status] ?? j.status;
  const tone = j.status === "sent" ? "ok" : j.status === "failed" ? "bad" : "warn";
  return `<div class="er-job"><div><span class="pill ${tone}">${esc(st)}</span> <span class="muted" style="font-size:11.5px">${esc(j.subject)}</span></div>
    ${j.attachments?.length ? `<div class="muted" style="font-size:11.5px">${j.attachments.map((a) => `${esc(a.name)} · ${fmtKb(a.bytes)}${a.mode === "link" ? ` · ${T("رابط تنزيل (7 أيام)", "download link (7 days)")}` : ""}`).join(" — ")}</div>` : ""}
    <ul class="er-list">${j.perRecipient.map((r) => `<li class="er-r"><span class="em" dir="ltr">${esc(r.email)}</span>
      <span class="pill ${r.status === "sent" ? "ok" : r.status === "failed" ? "bad" : "warn"}">${r.status === "sent" ? "✓ " + T("أُرسل", "sent") : r.status === "failed" ? "✕ " + T("فشل", "failed") : "⏳ " + T("بالطابور", "queued")}</span>
      ${r.error ? `<span class="muted" style="font-size:11px">${esc(r.error)}</span>` : ""}</li>`).join("")}</ul>
    ${j.error ? `<div class="note warn">${esc(j.error)}</div>` : ""}</div>`;
}
