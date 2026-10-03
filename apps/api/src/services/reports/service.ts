import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { isReportKey, kmlDoc, makeT, reportTitle, ADMIN_ONLY_REPORTS, type Lang, type ReportKey } from "@iltizam/core";
import type { AppCtx } from "../../app";
import { emailLog, workOrders } from "../../db/schema";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { signDownload, signPrintToken } from "../../plugins/auth";
import { projectContractorId } from "../../repo/projects";
import { resolveRecipients } from "../recipients";
import { buildXlsx } from "../xlsxwriter";
import type { MailAttachment } from "../types";
import { loadReportData, type ReportData } from "./data";
import { kpisFor, sheetsFor } from "./kpis";
import { buildEmailHtml, buildEmailText, subjectFor, type BodyAttachmentNote } from "./mailbody";
import type { PdfRenderer } from "./pdf";

export const PROJECT_REPORTS: ReportKey[] = ["dash", "firms", "master", "qty", "boq", "wages", "inv", "forms", "map", "recs", "deck"];
const DOWNLOAD_TTL_SEC = 7 * 24 * 3600;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface ReportRequest {
  reportKey: string; workOrderId?: string | null; lang: Lang; attachPdf: boolean; attachXlsx: boolean; note?: string; extraRecipients?: string[];
  kind?: "report" | "test"; onlyRecipient?: string;
}
export interface Requester { userId: string | null; isAdmin: boolean; contractorIds: string[] | null }
export interface RecipientState { email: string; name: string; status: "queued" | "sent" | "failed"; error?: string }
export interface AttachmentInfo { name: string; mime: string; bytes: number; mode: "attached" | "link"; storageKey?: string }

const fileSafe = (s: string) => s.replace(/[^\w؀-ۿ.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

/** ينشئ سجل الإرسال (queued) ويضع المهمة في الطابور — يعيد jobId */
export async function createReportJob(ctx: AppCtx, req: ReportRequest, by: Requester): Promise<string> {
  if (!isReportKey(req.reportKey)) throw badRequest("نوع تقرير غير معروف", "bad_report");
  const key = req.reportKey as ReportKey;
  if (ADMIN_ONLY_REPORTS.includes(key) && !by.isAdmin) throw forbidden("هذا التقرير لمدير النظام فقط ولا يُرسل لغيره");
  let project: { id: string; name: string; wo: string } | null = null;
  if (PROJECT_REPORTS.includes(key)) {
    if (!req.workOrderId) throw badRequest("workOrderId مطلوب لهذا التقرير", "work_order_required");
    const cid = await projectContractorId(ctx.db, req.workOrderId);
    if (!cid) throw notFound("المشروع غير موجود");
    // حارس أمر العمل: لا يُرسل تقرير مشروع لمستخدم لا يملك صلاحية على مقاول المشروع
    if (by.contractorIds && !by.contractorIds.includes(cid)) throw forbidden("لا تملك صلاحية على مقاول هذا المشروع", "contractor_forbidden");
    const [w] = await ctx.db.select({ id: workOrders.id, name: workOrders.name, wo: workOrders.woNumber }).from(workOrders).where(eq(workOrders.id, req.workOrderId)).limit(1);
    project = w ?? null;
  }
  let rec = await resolveRecipients(ctx, key, req.extraRecipients ?? []);
  if (req.kind === "test" && req.onlyRecipient) rec = rec.filter((r) => r.email === req.onlyRecipient!.toLowerCase());
  const subject = req.kind === "test" ? `[محفظة الالتزام] رسالة اختبار — ${new Date().toISOString().slice(0, 16).replace("T", " ")}` : subjectFor(key, req.lang, project);
  const recipients: RecipientState[] = rec.map((r) => ({ email: r.email, name: r.name, status: "queued" }));
  const [row] = await ctx.db.insert(emailLog).values({
    reportKey: req.kind === "test" ? "test" : key, workOrderId: project?.id ?? null, sentBy: by.userId, recipients, subject, attachments: [], status: "queued",
    payload: { lang: req.lang, attachPdf: req.attachPdf, attachXlsx: req.attachXlsx, note: req.note ?? "", kind: req.kind ?? "report", contractorIds: by.contractorIds, key },
  }).returning({ id: emailLog.id });
  await ctx.queue.enqueueReport(row.id);
  return row.id;
}

interface JobPayload { lang: Lang; attachPdf: boolean; attachXlsx: boolean; note: string; kind: "report" | "test"; contractorIds: string[] | null; key: ReportKey }

/** ينفّذ المهمة: يولّد المرفقات ويرسل لكل مستلم على حدة ويحدّث الحالة. يرمي خطأ لإعادة المحاولة من الطابور. */
export async function runReportJob(ctx: AppCtx, jobId: string, deps: { pdf: PdfRenderer | null } = { pdf: null }): Promise<void> {
  deps = { pdf: deps.pdf ?? ctx.pdf };
  const db = ctx.db;
  const [row] = await db.select().from(emailLog).where(eq(emailLog.id, jobId)).limit(1);
  if (!row) return;
  const pl = row.payload as unknown as JobPayload;
  const lang = pl.lang, T = makeT(lang), key = pl.key;
  const recipients = (row.recipients as RecipientState[]).map((r) => ({ ...r }));
  const pending = recipients.filter((r) => r.status !== "sent");
  if (!pending.length) { await db.update(emailLog).set({ status: "sent" }).where(eq(emailLog.id, jobId)); return; }
  let attachments = (row.attachments as AttachmentInfo[]) ?? [];
  const mails: MailAttachment[] = [];
  const notices: string[] = [];
  let html: string, text: string;

  if (pl.kind === "test") {
    const body = T("هذه رسالة اختبار من محفظة الالتزام للتأكد من وصول البريد قبل التقارير الحقيقية.", "This is a test message from Compliance Vault to confirm delivery before real reports.");
    html = `<div dir="${lang === "ar" ? "rtl" : "ltr"}" style="font-family:Tahoma,Arial;font-size:14px"><p>${body}</p><p style="color:#3a5344"><b>Project manager · Eng. Ahmed Zahran</b></p><p style="color:#6b8374;font-size:12px">${T("أُرسل تلقائيًا من محفظة الالتزام", "Sent automatically by Compliance Vault")}</p></div>`;
    text = body + "\n\nProject manager · Eng. Ahmed Zahran";
  } else {
    const data: ReportData = await loadReportData(ctx, { workOrderId: row.workOrderId, lang, contractorIds: pl.contractorIds, includeAdmin: key === "users" || key === "emails" });
    const title = reportTitle(key, lang);
    const dateTag = new Date().toISOString().slice(0, 10), base = fileSafe(`${title}-${data.project?.wo || dateTag}-${dateTag}`);
    const files: MailAttachment[] = [];
    if (pl.attachXlsx) {
      const sheets = sheetsFor(key, data);
      if (sheets) files.push({ filename: base + ".xlsx", content: await buildXlsx(sheets, lang), contentType: XLSX_MIME });
    }
    if (key === "map" && data.project && (data.project.rmus.length || data.project.geo?.length)) {
      files.push({ filename: fileSafe(`${data.project.wo || "project"}-map`) + ".kml", content: Buffer.from(kmlDoc(data.project, data.contractorName, { lang, T, cat: data.cat })), contentType: "application/vnd.google-earth.kml+xml" });
    }
    if (pl.attachPdf) {
      try {
        if (!deps.pdf) throw new Error("توليد PDF غير مفعّل على الخادم");
        const token = await signPrintToken(ctx.cfg.JWT_SECRET, row.sentBy ?? (await systemUserId(ctx)), 300);
        const baseUrl = (ctx.cfg.PDF_RENDER_BASE_URL || `http://127.0.0.1:${ctx.cfg.PORT}`).replace(/\/$/, "");
        const url = `${baseUrl}/?print=1&report=${key}${row.workOrderId ? `&wo=${row.workOrderId}` : ""}&lang=${lang}&token=${encodeURIComponent(token)}`;
        files.unshift({ filename: base + ".pdf", content: await deps.pdf.render(url, { lang }), contentType: "application/pdf" });
      } catch (e: any) { notices.push(T("تعذّر توليد مرفق PDF: ", "Could not generate the PDF attachment: ") + String(e?.message ?? e).slice(0, 160)); }
    }
    // حجم المرفقات: فوق REPORT_MAX_ATTACH_MB يُرسل رابط تنزيل موقّع صالح 7 أيام بدل المرفق
    const total = files.reduce((s, f) => s + f.content.length, 0);
    const asLinks = total > ctx.cfg.REPORT_MAX_ATTACH_MB * 1024 * 1024;
    const notes: BodyAttachmentNote[] = [];
    attachments = [];
    for (const f of files) {
      if (asLinks) {
        const k = `reports/${jobId}/${f.filename}`;
        await ctx.storage.put(k, f.content, f.contentType);
        const tok = await signDownload(ctx.cfg.JWT_SECRET, k, f.filename, DOWNLOAD_TTL_SEC);
        const url = `${(ctx.cfg.PUBLIC_API_URL || ctx.cfg.APP_BASE_URL).replace(/\/$/, "")}/api/v1/downloads/${tok}`;
        attachments.push({ name: f.filename, mime: f.contentType, bytes: f.content.length, mode: "link", storageKey: k });
        notes.push({ name: f.filename, mode: "link", url, bytes: f.content.length });
      } else { mails.push(f); attachments.push({ name: f.filename, mime: f.contentType, bytes: f.content.length, mode: "attached" }); notes.push({ name: f.filename, mode: "attached", bytes: f.content.length }); }
    }
    if (asLinks) notices.push(T(`حجم المرفقات (${(total / 1048576).toFixed(1)} م.ب) يتجاوز ${ctx.cfg.REPORT_MAX_ATTACH_MB} م.ب — أُرسلت روابط تنزيل صالحة 7 أيام بدل المرفقات.`, `Attachments (${(total / 1048576).toFixed(1)} MB) exceed ${ctx.cfg.REPORT_MAX_ATTACH_MB} MB — sent as download links valid for 7 days instead.`));
    const kpis = kpisFor(key, data);
    const proj = data.project ? { name: data.project.name, wo: data.project.wo, contractor: data.contractorName } : null;
    html = buildEmailHtml({ lang, key, title, project: proj, kpis, note: pl.note, attachments: notes, notices, dateText: new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB", { dateStyle: "long" }) });
    text = buildEmailText({ title, project: proj, kpis, note: pl.note, lang });
    await db.update(emailLog).set({ attachments }).where(eq(emailLog.id, jobId));
  }

  // إرسال لكل مستلم على حدة: فشل واحد لا يوقف الباقين
  for (const r of recipients) {
    if (r.status === "sent") continue;
    const res = await ctx.mail.send({ to: [r.email], subject: row.subject, html, text, attachments: mails });
    if (res.ok) { r.status = "sent"; delete r.error; } else { r.status = "failed"; r.error = res.error ?? "فشل الإرسال"; }
  }
  const sent = recipients.filter((r) => r.status === "sent").length;
  const status = sent === recipients.length ? "sent" : sent > 0 ? "partial" : "failed";
  const errors = recipients.filter((r) => r.status === "failed").map((r) => `${r.email}: ${r.error}`).join(" | ");
  await db.update(emailLog).set({ recipients, status, error: errors ? errors.slice(0, 1500) : null, attempts: row.attempts + 1, sentAt: sent ? new Date() : row.sentAt }).where(eq(emailLog.id, jobId));
  const evt = { jobId, reportKey: row.reportKey, workOrderId: row.workOrderId, status, sent, total: recipients.length };
  if (status === "sent" || status === "partial") void Promise.resolve(ctx.events.emit("report.sent", evt)).catch(() => {});
  if (status !== "sent") {
    if (row.attempts + 1 >= 3) void Promise.resolve(ctx.events.emit("report.failed", { ...evt, error: errors })).catch(() => {});
    else throw new Error(`إرسال ناقص (${sent}/${recipients.length}) — ستُعاد المحاولة`);
  }
}

/** رسالة اختبار (لمستلم واحد أو لكل المستلمين النشطين + مدير النظام) — تمر بنفس الطابور وسجل الإرسال */
export async function createTestJob(ctx: AppCtx, by: Requester, o: { emails?: string[]; lang?: Lang }): Promise<string> {
  const { emailRecipients } = await import("../../db/schema");
  const admin = ctx.cfg.ADMIN_EMAIL.toLowerCase();
  let list: { email: string; name: string }[];
  if (o.emails) list = o.emails.map((e) => ({ email: e.toLowerCase(), name: "" }));
  else list = (await ctx.db.select().from(emailRecipients).where(eq(emailRecipients.active, true))).map((r) => ({ email: r.email, name: r.name }));
  if (!o.emails && !list.some((r) => r.email === admin)) list.push({ email: admin, name: "مدير النظام" });
  if (list.length > 50) throw badRequest("عدد المستلمين يتجاوز 50", "too_many_recipients");
  const [row] = await ctx.db.insert(emailLog).values({
    reportKey: "test", sentBy: by.userId, recipients: list.map((r) => ({ ...r, status: "queued" })), subject: `[محفظة الالتزام] رسالة اختبار — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    attachments: [], status: "queued", payload: { lang: o.lang ?? "ar", attachPdf: false, attachXlsx: false, note: "", kind: "test", contractorIds: null, key: "dash" },
  }).returning({ id: emailLog.id });
  await ctx.queue.enqueueReport(row.id);
  return row.id;
}

let sysUid: string | null = null;
async function systemUserId(ctx: AppCtx): Promise<string> {
  if (sysUid) return sysUid;
  const { users } = await import("../../db/schema");
  const [u] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  sysUid = u?.id ?? randomUUID();
  return sysUid;
}
export type { ReportData };
