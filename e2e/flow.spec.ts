/**
 * اختبار تشغيل كامل في متصفح حقيقي:
 * دخول ← فتح القفل ← مشروع جديد ← رفع ملفات (حارس هوية أمر العمل) ← استنباط ← إضافة مستلم ← إرسال تقرير
 * ← التحقق من وصوله لمدير النظام وللمستلم المضاف (ومعه PDF وExcel والتوقيع).
 *
 * المحلي (بلا docker):  npm run test:e2e              — يشغّل المكدّس بنفسه مع خادم SMTP وهمي
 * على docker compose:   E2E_BASE_URL=http://localhost:5173 MAILHOG_URL=http://localhost:8025 npm run test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ADMIN_EMAIL = "az3919131@gmail.com";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "ahmed", ADMIN_PASS = process.env.E2E_ADMIN_PASSWORD || "Admin@12345";
const OUT = path.join(os.tmpdir(), "iltizam-e2e-files");
const WO = "234099001", EXTRA = `consultant.${Date.now() % 100000}@example.com`;

/* ───────── البريد: MailHog أو خادم SMTP الوهمي ───────── */
interface Mail { to: string[]; subject: string; html: string; attachments: { filename: string; size: number }[] }
const decodeWords = (s: string) => s.replace(/=\?UTF-8\?B\?([^?]+)\?=\s*/gi, (_, b) => Buffer.from(b, "base64").toString("utf8"));
async function readMail(): Promise<Mail[]> {
  if (process.env.MAILHOG_URL) {
    const j: any = await (await fetch(process.env.MAILHOG_URL + "/api/v2/messages?limit=200")).json();
    return j.items.map((m: any) => ({
      to: (m.To || []).map((t: any) => `${t.Mailbox}@${t.Domain}`.toLowerCase()),
      subject: decodeWords((m.Content.Headers.Subject || [""])[0]),
      html: String(m.Content.Body || ""),
      attachments: (m.MIME?.Parts || []).flatMap((p: any) => (p.MIME?.Parts ?? [p])).map((p: any) => {
        const cd = String((p.Headers?.["Content-Disposition"] || [""])[0]); const f = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(cd);
        return f ? { filename: decodeURIComponent(decodeWords(f[1])), size: Number(p.Size ?? 0) } : null;
      }).filter(Boolean),
    }));
  }
  return (await fetch(`http://127.0.0.1:${process.env.E2E_MAIL_API_PORT || 3199}/messages`)).json();
}
const mailTo = async (email: string, subjectPart = "") => (await readMail()).filter((m) => m.to.includes(email.toLowerCase()) && m.subject.includes(subjectPart));
async function untilMail(email: string, subjectPart: string) {
  await expect.poll(async () => (await mailTo(email, subjectPart)).length, { timeout: 90_000, intervals: [700, 1000, 1500] }).toBeGreaterThan(0);
  return (await mailTo(email, subjectPart))[0];
}

/* ───────── ملفات إكسل للاختبار ───────── */
async function xlsx(name: string, rows: unknown[][]): Promise<string> {
  mkdirSync(OUT, { recursive: true });
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Sheet1"); rows.forEach((r) => ws.addRow(r));
  const f = path.join(OUT, name); await wb.xlsx.writeFile(f); return f;
}
const protection = (wo: string) => xlsx(`protection-${wo}.xlsx`, [
  ["أمر العمل", wo, "اسم المشروع", "مشروع اختبار شامل"],
  ["الوحدة", "المغذي", "النوع", "الإحداثي"],
  ["R101552", "NER 409", "3W", "17.693713, 44.459428"], ["R101553", "NER 409", "4W", "17.694713, 44.460428"],
  ["R101554", "NER 409", "3W", "17.695713, 44.461428"], ["R101555", "NER 409", "4W", "17.696713, 44.462428"],
]);

/* ───────── أدوات الصفحة ───────── */
async function login(page: Page, user = ADMIN_USER, pass = ADMIN_PASS) {
  await page.goto("/");
  await expect(page.locator("#gate")).toBeVisible();
  await page.fill("#gU", user); await page.fill("#gP", pass); await page.click("#gGo");
  await expect(page.locator("#gate")).toBeHidden();
}
async function unlock(page: Page) {
  await page.click("#btnLock"); await page.fill("#lkP", ADMIN_PASS); await page.click("#lkYes");
  await expect(page.locator("#btnLock.off")).toBeVisible();
}
const go = (page: Page, id: string) => page.click(`#nav button[data-page="${id}"]`);
const synced = (page: Page) => page.waitForResponse((r) => /\/api\/v1\/projects\/[^/]+$/.test(r.url()) && r.request().method() === "PUT");

test.describe.serial("التدفق الكامل: دخول ← رفع ← استنباط ← إرسال تقرير", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await (await browser.newContext()).newPage(); });
  test.afterAll(async () => { await page.context().close(); });

  test("شاشة الدخول: بيانات خاطئة تُرفض برسالة عربية", async () => {
    await page.goto("/");
    await page.fill("#gU", ADMIN_USER); await page.fill("#gP", "wrong-password"); await page.click("#gGo");
    await expect(page.locator("#gErr")).toContainText("غير صحيحة");
    await expect(page.locator(".dhero")).toHaveCount(0);        // لا بيانات قبل الدخول
  });

  test("دخول مدير النظام: الجلسة تبدأ مقفلة، ثم يُفتح القفل بكلمة مرور المدير", async () => {
    await login(page);
    await expect(page.locator("#btnLock")).toContainText("مقفل");
    await page.click('#nav button[data-page="master"]');
    await expect(page.locator("#f_name")).toBeDisabled();       // التعديل ممنوع قبل الفتح
    await unlock(page);
    await expect(page.locator("#f_name")).toBeEnabled();
  });

  test("مشروع جديد + رفع ملف بنفس أمر العمل يُستورد، وملف بأمر عمل مختلف يُوقف", async () => {
    await page.click("#btnAddProject");
    await expect(page.locator("#f_wo")).toBeVisible();
    let s = synced(page); await page.fill("#f_wo", WO); await page.press("#f_wo", "Tab"); expect((await s).status()).toBe(200);
    s = synced(page); await page.fill("#f_name", "مشروع اختبار شامل"); await page.press("#f_name", "Tab"); expect((await s).status()).toBe(200);

    await page.setInputFiles("#fileIn", await protection(WO));
    await expect(page.locator(".reg tbody tr")).toHaveCount(1);
    await expect(page.locator(".reg tbody tr").first()).toContainText("مُستورد");

    // ملف يخص مشروعًا آخر: يُوقف ولا يخلط الكميات (حارس هوية أمر العمل)
    await page.setInputFiles("#fileIn", await protection("234011111"));
    await expect(page.locator(".reg tbody tr")).toHaveCount(2);
    await expect(page.locator("#woCard")).toContainText("234011111");
    await expect(page.locator("#woCard [data-adopt]")).toBeVisible();   // «اعتمد هذا الرقم»
  });

  test("استنباط الحصر: يظهر في لوحة التحكم والخريطة", async () => {
    await page.click("#btnDeriveAll");
    await expect(page.locator("#deriveState")).toContainText("آخر تشغيل", { timeout: 30_000 });
    await go(page, "map");
    await expect(page.locator("#tblGeo tbody tr")).toHaveCount(4);
    await go(page, "dash");
    await expect(page.locator(".dhero")).toBeVisible();
  });

  test("قوائم البريد: تحقق الصيغة بالعربية، مدير النظام 🔒 لا يُحذف، إضافة مستلم", async () => {
    await go(page, "emails");
    await expect(page.locator("#tblRecipients tr.em-sys")).toContainText(ADMIN_EMAIL);
    await expect(page.locator("#tblRecipients tr.em-sys")).toContainText("مستلم إلزامي");
    await expect(page.locator("#tblRecipients tr.em-sys [data-del]")).toHaveCount(0);        // لا حذف
    await expect(page.locator("#tblRecipients tr.em-sys input[type=checkbox]").first()).toBeDisabled();   // لا تعطيل

    await page.fill("#emEmail", "not-an-email"); await page.click("#emAddBtn");
    await expect(page.locator("#emErr")).toHaveText("صيغة البريد غير صحيحة");
    await page.fill("#emEmail", ADMIN_EMAIL.toUpperCase());
    await page.click("#emAddBtn");
    await expect(page.locator("#emErr")).toContainText("مسجّل بالفعل");                         // تكرار بلا حساسية لحالة الأحرف
    await page.fill("#emEmail", EXTRA); await page.fill("#emName", "استشاري المشروع"); await page.click("#emAddBtn");
    await expect(page.locator("#tblRecipients")).toContainText(EXTRA);
  });

  test("زر «إرسال التقرير» من صفحة المقايسة: يصل لمدير النظام وللمستلم المضاف بـ PDF وExcel", async () => {
    await go(page, "boq");
    await page.click("#btnEmailReport");
    await expect(page.locator("#erList")).toContainText(ADMIN_EMAIL);
    await expect(page.locator("#erList")).toContainText(EXTRA);
    await expect(page.locator("#erList .sys")).toContainText("إلزامي");
    await page.fill("#erNote", "ملاحظة اختبار شامل");
    await page.click("#erGo");
    await expect(page.locator(".er-job .pill.ok").first()).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("#erStat")).toContainText(ADMIN_EMAIL);

    const subjectPart = `W/O ${WO}`;
    for (const who of [ADMIN_EMAIL, EXTRA]) {
      const m = await untilMail(who, subjectPart);
      expect(m.subject).toMatch(/^\[محفظة الالتزام\] المقايسة والمقارنة — .+ — W\/O 234099001$/);
      expect(m.attachments.some((a) => /\.pdf$/i.test(a.filename) && a.size > 10_000)).toBe(true);
      expect(m.attachments.some((a) => /\.xlsx$/i.test(a.filename) && a.size > 3_000)).toBe(true);
      expect(m.html).toContain("Project manager");
      expect(m.html).toContain("Eng. Ahmed Zahran");
      expect(m.html).toContain("أُرسل تلقائيًا من محفظة الالتزام");
      expect(m.html).toContain("ملاحظة اختبار شامل");
    }
  });

  test("سجل الإرسال يعرض العملية، ومزوّد البريد أخضر", async () => {
    await page.keyboard.press("Escape");
    await go(page, "emails");
    await expect(page.locator("#tblLog tbody tr").first()).toContainText("المقايسة والمقارنة");
    await expect(page.locator("#emHealth")).toHaveClass(/ok/);
  });

  test("الخروج يُنهي الجلسة، وتبويب جديد يبدأ بشاشة الدخول", async () => {
    await page.reload();                                            // نفس التبويب: الجلسة باقية
    await expect(page.locator(".dhero, #view")).toBeVisible();
    const tab2 = await page.context().newPage();                    // تبويب جديد = زيارة جديدة
    await tab2.goto("/");
    await expect(tab2.locator("#gate")).toBeVisible();
    await tab2.close();
    await page.click("#btnOut");
    await expect(page.locator("#gate")).toBeVisible();
  });
});

test.describe("الصلاحيات وعزل البيانات", () => {
  test("مدير المشاريع لا يرى صفحة المستخدمين، وصفحة البريد للعرض فقط", async ({ page }) => {
    await login(page, "hamad", "Pm@12345");
    await expect(page.locator('#nav button[data-page="users"]')).toHaveCount(0);
    await go(page, "emails");
    await expect(page.locator("#emAddBtn")).toBeDisabled();
    await expect(page.locator("#emEmail")).toBeDisabled();
  });
  test("API: بلا رمز 401، ومدير المشاريع لا يقرأ المستخدمين", async ({ request, page }) => {
    expect((await request.get("/api/v1/projects")).status()).toBe(401);
    await login(page, "hamad", "Pm@12345");
    const tok = await page.evaluate(async () => { const r = await fetch("/api/v1/auth/refresh", { method: "POST" }); return (await r.json()).accessToken as string; });
    expect((await request.get("/api/v1/users", { headers: { authorization: "Bearer " + tok } })).status()).toBe(403);
  });
});

test.describe("إتاحة الوصول (WCAG 2.1 AA)", () => {
  const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
  const report = (v: any[]) => v.map((x) => `${x.id}: ${x.help} (${x.nodes.length}) → ${x.nodes.slice(0, 3).map((n: any) => n.target.join(" ")).join(" | ")}`).join("\n");
  test("شاشة الدخول", async ({ page }) => {
    await page.goto("/"); await expect(page.locator("#gate")).toBeVisible();
    const r = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(report(r.violations)).toBe("");
  });
  for (const id of ["dash", "master", "boq", "emails"]) {
    test(`صفحة ${id}`, async ({ page }) => {
      await login(page); await go(page, id);
      await expect(page.locator("#view")).not.toBeEmpty();
      await page.waitForTimeout(600);
      const r = await new AxeBuilder({ page }).withTags(tags).exclude(".leaflet-container").analyze();
      expect(report(r.violations)).toBe("");
    });
  }
});
