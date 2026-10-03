import { escHtml, makeT, PM_NAME, PM_ROLE_EN, type Lang, type ReportKey, reportTitle } from "@iltizam/core";
import type { Kpi } from "./kpis";

export const SUBJECT_PREFIX = "[محفظة الالتزام]";
export function subjectFor(key: ReportKey, lang: Lang, project: { name: string; wo: string } | null, date = new Date()): string {
  const title = reportTitle(key, lang);
  return project ? `${SUBJECT_PREFIX} ${title} — ${project.name} — W/O ${project.wo || "—"}` : `${SUBJECT_PREFIX} ${title} — ${date.toISOString().slice(0, 10)}`;
}

export interface BodyAttachmentNote { name: string; mode: "attached" | "link"; url?: string; bytes: number }

/** جسم HTML (RTL للعربية): ملخص 4–6 أرقام، ثم التوقيع، ثم تذييل «أُرسل تلقائيًا» */
export function buildEmailHtml(o: { lang: Lang; key: ReportKey; title: string; project: { name: string; wo: string; contractor: string } | null; kpis: Kpi[]; note?: string; attachments: BodyAttachmentNote[]; notices: string[]; dateText: string }): string {
  const T = makeT(o.lang), rtl = o.lang === "ar", e = escHtml;
  const rows = o.kpis.map((k) => `<tr><td style="padding:9px 12px;border-bottom:1px solid #e3ece4;color:#4a6353;font-size:13px">${e(k.k)}</td><td style="padding:9px 12px;border-bottom:1px solid #e3ece4;font:700 15px Consolas,Menlo,monospace;direction:ltr;text-align:${rtl ? "left" : "right"};color:#0d2417">${e(k.v)}${k.d ? `<div style="font:11px Tahoma,Arial;color:#6b8374;direction:${rtl ? "rtl" : "ltr"}">${e(k.d)}</div>` : ""}</td></tr>`).join("");
  const atts = o.attachments.map((a) => `<li style="margin:3px 0">${a.mode === "link" ? `<a href="${e(a.url ?? "#")}">${e(a.name)}</a> <span style="color:#6b8374">(${T("رابط تنزيل صالح 7 أيام", "download link valid for 7 days")})</span>` : e(a.name)} <span style="color:#6b8374">· ${(a.bytes / 1024).toFixed(0)} KB</span></li>`).join("");
  return `<!doctype html><html lang="${o.lang}" dir="${rtl ? "rtl" : "ltr"}"><body style="margin:0;background:#f2f7f1;font-family:Tahoma,'Segoe UI',Arial,sans-serif;direction:${rtl ? "rtl" : "ltr"};color:#0d2417">
<div style="max-width:640px;margin:0 auto;padding:18px">
 <div style="background:#1c6b3c;color:#fff;border-radius:12px 12px 0 0;padding:16px 20px">
   <div style="font-size:11px;letter-spacing:.08em;opacity:.8">${e(T("محفظة الالتزام للمشاريع للمقاولين", "Compliance Vault — contractor project portfolio"))}</div>
   <div style="font-size:19px;font-weight:700;margin-top:4px">${e(o.title)}</div>
   ${o.project ? `<div style="font-size:12.5px;opacity:.9;margin-top:6px">${e(o.project.name)} · W/O ${e(o.project.wo || "—")}${o.project.contractor ? ` · ${e(o.project.contractor)}` : ""}</div>` : ""}
 </div>
 <div style="background:#fff;border:1px solid #d5e2d3;border-top:0;border-radius:0 0 12px 12px;padding:16px 20px">
   ${o.note ? `<div style="background:#e2f0e1;border-${rtl ? "right" : "left"}:3px solid #1c6b3c;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:14px;white-space:pre-wrap">${e(o.note)}</div>` : ""}
   <div style="font-size:12px;color:#6b8374;margin-bottom:6px">${e(T("ملخص الأرقام الرئيسية", "Key figures"))} — ${e(o.dateText)}</div>
   <table style="width:100%;border-collapse:collapse;border:1px solid #e3ece4;border-radius:8px">${rows}</table>
   ${atts ? `<div style="margin-top:14px;font-size:13px"><b>${e(T("المرفقات", "Attachments"))}</b><ul style="margin:6px 0;padding-${rtl ? "right" : "left"}:20px">${atts}</ul></div>` : ""}
   ${o.notices.map((n) => `<div style="margin-top:10px;background:#f8edd5;color:#9a6210;border-radius:8px;padding:9px 12px;font-size:12.5px">${e(n)}</div>`).join("")}
   <div style="margin-top:18px;padding-top:12px;border-top:1px solid #d5e2d3;text-align:center;font-size:12.5px;color:#3a5344"><b style="color:#1c6b3c;letter-spacing:.06em;text-transform:uppercase;font-size:11px">${PM_ROLE_EN}</b> · <b style="direction:ltr;unicode-bidi:isolate">${PM_NAME}</b></div>
 </div>
 <div style="text-align:center;font-size:11px;color:#6b8374;margin-top:10px">${e(T("أُرسل تلقائيًا من محفظة الالتزام", "Sent automatically by Compliance Vault"))}</div>
</div></body></html>`;
}
export function buildEmailText(o: { title: string; project: { name: string; wo: string } | null; kpis: Kpi[]; note?: string; lang: Lang }): string {
  const T = makeT(o.lang);
  return [o.title, o.project ? `${o.project.name} · W/O ${o.project.wo}` : "", o.note ? "\n" + o.note : "", "", ...o.kpis.map((k) => `${k.k}: ${k.v}${k.d ? " (" + k.d + ")" : ""}`), "", `${PM_ROLE_EN} · ${PM_NAME}`, T("أُرسل تلقائيًا من محفظة الالتزام", "Sent automatically by Compliance Vault")].filter((x) => x !== undefined).join("\n");
}
